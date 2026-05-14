import { eq, and, desc } from "drizzle-orm";
import {
  db,
  campaignsTable,
  campaignAgentsTable,
  approvalCheckpointsTable,
  auditLogsTable,
} from "@workspace/db";
import { getQueue, QUEUE_NAMES, type CampaignOrchestrationJob } from "../queue/queue.service.js";
import { executeDirectly } from "./orchestration.worker.js";
import { emitCampaignEvent } from "../realtime/realtime.service.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import type { Logger } from "pino";

// ── Execution status ──────────────────────────────────────────────────────────

export interface ExecutionStatus {
  campaignId: string;
  status: string;
  phase: string;
  canExecute: boolean;
  nextAction: string | null;
  activeAgents: {
    id: string;
    agentType: string;
    status: string;
    startedAt: Date | null;
    creditsUsed: number;
  }[];
  pendingCheckpoints: {
    id: string;
    checkpointType: string;
    status: string;
    createdAt: Date;
  }[];
  recentEvents: {
    action: string;
    actor: string;
    createdAt: Date;
    data: unknown;
  }[];
  executionStartedAt: Date | null;
  completedAt: Date | null;
}

const PHASE_LABELS: Record<string, string> = {
  intake: "Intake — preenchimento de dados",
  analyzing: "Analisando — agentes de estratégia em execução",
  strategy_ready: "Estratégia pronta — aguardando aprovação ou geração de conteúdo",
  generating: "Gerando conteúdo — agentes de conteúdo em execução",
  awaiting_approval: "Aguardando aprovação do usuário",
  approved: "Aprovado — pronto para execução",
  executing: "Executando — ativando canais de distribuição",
  live: "Ao vivo — campanha ativa e monitorada",
  paused: "Pausado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const NEXT_ACTION_MAP: Record<string, string | null> = {
  intake: "execute/strategy",
  analyzing: null, // in progress
  strategy_ready: "execute/content",
  generating: null, // in progress
  awaiting_approval: null, // waiting user
  approved: "execute/launch",
  executing: null, // in progress
  live: "execute/monitor",
  paused: "execute/launch",
  completed: null,
  cancelled: null,
};

export async function getExecutionStatus(
  campaignId: string,
  workspaceId: string,
): Promise<ExecutionStatus> {
  const [campaign] = await db
    .select({
      id: campaignsTable.id,
      status: campaignsTable.status,
      executionStartedAt: campaignsTable.executionStartedAt,
      completedAt: campaignsTable.completedAt,
    })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  const [activeAgents, pendingCheckpoints, recentEvents] = await Promise.all([
    db
      .select({
        id: campaignAgentsTable.id,
        agentType: campaignAgentsTable.agentType,
        status: campaignAgentsTable.status,
        startedAt: campaignAgentsTable.startedAt,
        creditsUsed: campaignAgentsTable.creditsUsed,
      })
      .from(campaignAgentsTable)
      .where(
        and(
          eq(campaignAgentsTable.campaignId, campaignId),
          eq(campaignAgentsTable.status, "running"),
        ),
      ),

    db
      .select({
        id: approvalCheckpointsTable.id,
        checkpointType: approvalCheckpointsTable.checkpointType,
        status: approvalCheckpointsTable.status,
        createdAt: approvalCheckpointsTable.createdAt,
      })
      .from(approvalCheckpointsTable)
      .where(
        and(
          eq(approvalCheckpointsTable.campaignId, campaignId),
          eq(approvalCheckpointsTable.status, "pending"),
        ),
      )
      .orderBy(desc(approvalCheckpointsTable.createdAt)),

    db
      .select({
        action: auditLogsTable.action,
        actor: auditLogsTable.actor,
        createdAt: auditLogsTable.createdAt,
        data: auditLogsTable.data,
      })
      .from(auditLogsTable)
      .where(eq(auditLogsTable.campaignId, campaignId))
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(10),
  ]);

  const status = campaign.status;
  const nextAction = NEXT_ACTION_MAP[status] ?? null;
  const inProgressStatuses = ["analyzing", "generating", "executing"];
  const canExecute = nextAction !== null && !inProgressStatuses.includes(status);

  return {
    campaignId,
    status,
    phase: PHASE_LABELS[status] ?? status,
    canExecute,
    nextAction,
    activeAgents: activeAgents.map((a) => ({
      ...a,
      creditsUsed: a.creditsUsed ?? 0,
    })),
    pendingCheckpoints,
    recentEvents,
    executionStartedAt: campaign.executionStartedAt,
    completedAt: campaign.completedAt,
  };
}

// ── Phase triggers ─────────────────────────────────────────────────────────────

async function enqueueOrExecute(
  job: CampaignOrchestrationJob,
  log: Logger,
): Promise<{ queued: boolean; jobId?: string }> {
  try {
    const queue = getQueue(QUEUE_NAMES.CAMPAIGN_ORCHESTRATION);
    const bullJob = await queue.add(
      `campaign-${job.campaignId}-${job.action}`,
      job,
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
      },
    );
    log.info({ jobId: bullJob.id, action: job.action }, "Orchestration job enqueued");
    return { queued: true, jobId: bullJob.id ?? undefined };
  } catch (err) {
    // Redis unavailable — execute directly (non-blocking via setImmediate)
    log.warn({ action: job.action }, "Redis unavailable — executing directly");
    setImmediate(() => {
      executeDirectly(job, logger).catch((execErr) =>
        logger.error({ execErr, action: job.action }, "Direct execution failed"),
      );
    });
    return { queued: false };
  }
}

export async function triggerStrategyPhase(
  campaignId: string,
  workspaceId: string,
  log: Logger,
): Promise<{ queued: boolean; jobId?: string }> {
  const [campaign] = await db
    .select({ status: campaignsTable.status })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  const allowedStatuses = ["intake", "analyzing", "strategy_ready"];
  if (!allowedStatuses.includes(campaign.status)) {
    throw new ValidationError(
      `Cannot start strategy phase from status "${campaign.status}"`,
    );
  }

  // Guard: prevent double-triggering — if agents are already running, reject
  const [existingRun] = await db
    .select({ id: campaignAgentsTable.id })
    .from(campaignAgentsTable)
    .where(
      and(
        eq(campaignAgentsTable.campaignId, campaignId),
        eq(campaignAgentsTable.status, "running"),
      ),
    )
    .limit(1);

  if (existingRun) {
    throw new ValidationError(
      "Agentes já estão em execução para esta campanha. Aguarde a conclusão antes de tentar novamente.",
    );
  }

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "campaign.execution.strategy_triggered",
    actor: "user",
    data: { currentStatus: campaign.status },
  });

  emitCampaignEvent({
    campaignId,
    type: "execution_update",
    message: "Fase de estratégia enfileirada — agentes serão ativados em instantes",
    data: { phase: "strategy", queued: true },
    timestamp: new Date().toISOString(),
  });

  return enqueueOrExecute({ campaignId, workspaceId, action: "run_strategy" }, log);
}

export async function triggerContentPhase(
  campaignId: string,
  workspaceId: string,
  log: Logger,
): Promise<{ queued: boolean; jobId?: string }> {
  const [campaign] = await db
    .select({ status: campaignsTable.status })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  const allowedStatuses = ["strategy_ready", "approved", "generating", "awaiting_approval"];
  if (!allowedStatuses.includes(campaign.status)) {
    throw new ValidationError(
      `Cannot start content generation from status "${campaign.status}". Strategy phase must complete first.`,
    );
  }

  // Guard: prevent double-triggering — if agents are already running, reject
  const [existingContentRun] = await db
    .select({ id: campaignAgentsTable.id })
    .from(campaignAgentsTable)
    .where(
      and(
        eq(campaignAgentsTable.campaignId, campaignId),
        eq(campaignAgentsTable.status, "running"),
      ),
    )
    .limit(1);

  if (existingContentRun) {
    throw new ValidationError(
      "Agentes já estão em execução para esta campanha. Aguarde a conclusão antes de tentar novamente.",
    );
  }

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "campaign.execution.content_triggered",
    actor: "user",
    data: { currentStatus: campaign.status },
  });

  emitCampaignEvent({
    campaignId,
    type: "execution_update",
    message: "Geração de conteúdo enfileirada — 16 agentes serão ativados",
    data: { phase: "content", queued: true },
    timestamp: new Date().toISOString(),
  });

  return enqueueOrExecute({ campaignId, workspaceId, action: "generate_content" }, log);
}

export async function triggerExecutionPhase(
  campaignId: string,
  workspaceId: string,
  log: Logger,
): Promise<{ queued: boolean; jobId?: string }> {
  const [campaign] = await db
    .select({ status: campaignsTable.status })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  const allowedStatuses = ["approved", "paused"];
  if (!allowedStatuses.includes(campaign.status)) {
    throw new ValidationError(
      `Cannot launch from status "${campaign.status}". Campaign must be approved first.`,
    );
  }

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "campaign.execution.launch_triggered",
    actor: "user",
    data: { currentStatus: campaign.status },
  });

  emitCampaignEvent({
    campaignId,
    type: "execution_update",
    message: "Lançamento enfileirado — campanha será ativada em instantes",
    data: { phase: "execute", queued: true },
    timestamp: new Date().toISOString(),
  });

  return enqueueOrExecute({ campaignId, workspaceId, action: "execute" }, log);
}

export async function triggerMonitor(
  campaignId: string,
  workspaceId: string,
  log: Logger,
): Promise<{ queued: boolean; jobId?: string }> {
  const [campaign] = await db
    .select({ status: campaignsTable.status })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  if (!["live", "executing"].includes(campaign.status)) {
    throw new ValidationError(`Campaign must be live to monitor (current: "${campaign.status}")`);
  }

  return enqueueOrExecute({ campaignId, workspaceId, action: "monitor" }, log);
}

// ── Smart trigger — picks next phase automatically ────────────────────────────

export async function triggerNextPhase(
  campaignId: string,
  workspaceId: string,
  log: Logger,
): Promise<{ queued: boolean; jobId?: string; action: string }> {
  const [campaign] = await db
    .select({ status: campaignsTable.status })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  const status = campaign.status;

  if (["intake", "analyzing"].includes(status)) {
    const result = await triggerStrategyPhase(campaignId, workspaceId, log);
    return { ...result, action: "run_strategy" };
  }

  if (status === "strategy_ready") {
    const result = await triggerContentPhase(campaignId, workspaceId, log);
    return { ...result, action: "generate_content" };
  }

  if (["approved", "paused"].includes(status)) {
    const result = await triggerExecutionPhase(campaignId, workspaceId, log);
    return { ...result, action: "execute" };
  }

  if (["live", "executing"].includes(status)) {
    const result = await triggerMonitor(campaignId, workspaceId, log);
    return { ...result, action: "monitor" };
  }

  throw new ValidationError(
    `No next phase available for campaign in status "${status}". ` +
      (status === "awaiting_approval"
        ? "Approve or reject the pending checkpoints first."
        : status === "completed" || status === "cancelled"
          ? "Campaign has ended."
          : "Campaign may be in progress."),
  );
}
