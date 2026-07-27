import { eq, and, desc, gt } from "drizzle-orm";
import {
  db,
  campaignsTable,
  campaignAgentsTable,
  approvalCheckpointsTable,
  auditLogsTable,
} from "@workspace/db";
import {
  STRATEGY_PHASE_ENTRY_STATUSES,
  CONTENT_PHASE_ENTRY_STATUSES,
  LAUNCH_PHASE_ENTRY_STATUSES,
} from "../campaigns/campaigns.service.js";
import { getQueue, QUEUE_NAMES, isRedisAvailable, type CampaignOrchestrationJob } from "../queue/queue.service.js";
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
  // Check Redis availability FIRST — BullMQ's lazyConnect silently buffers jobs
  // even when Redis is down, so we cannot rely on queue.add() throwing.
  const redisOk = await isRedisAvailable();
  if (!redisOk) {
    log.warn({ action: job.action }, "Redis unavailable — executing directly");
    setImmediate(() => {
      executeDirectly(job, logger).catch((execErr) =>
        logger.error({ execErr, action: job.action }, "Direct execution failed"),
      );
    });
    return { queued: false };
  }

  try {
    const queue = getQueue(QUEUE_NAMES.CAMPAIGN_ORCHESTRATION);
    const dedupJobId = `${job.campaignId}-${job.action}`;

    // RC-DEDUP FIX: If a prior job with this jobId is in failed/completed state,
    // BullMQ's dedup silently returns the existing job without creating a new one
    // and the worker will never re-process it.
    //
    // RC-WORKER FIX: If the BullMQ worker's blocking connection is not consuming
    // (BRPOP silently broken in some Redis configurations), a stale failed job is
    // a strong signal that the worker is unhealthy. In that case, execute directly.
    const existingJob = await queue.getJob(dedupJobId);
    if (existingJob) {
      const state = await existingJob.getState();
      if (state === "failed") {
        // Prior job failed AND worker didn't pick it up → execute directly, don't re-queue
        log.warn({ dedupJobId, state, action: job.action }, "Stale failed job detected — worker unhealthy, falling back to direct execution");
        await existingJob.remove().catch(() => undefined);
        setImmediate(() => {
          executeDirectly(job, logger).catch((execErr) =>
            logger.error({ execErr, action: job.action }, "Direct execution (stale-job fallback) failed"),
          );
        });
        return { queued: false };
      } else if (state === "completed") {
        // Completed jobs should have been cleaned up by removeOnComplete — remove and re-queue
        log.warn({ dedupJobId, state, action: job.action }, "Stale completed dedup job — removing before re-enqueue");
        await existingJob.remove().catch(() => undefined);
      } else if (state === "active") {
        // RC-011 FIX: Zombie active job detection after server restart.
        // BullMQ jobs that were in-flight remain "active" in Redis with no worker to
        // renew the lock. We detect these by age (> lockDuration = 5 min after crash
        // the lock has expired) and kill them so a fresh job can be queued.
        //
        // ROOT CAUSE OF PREVIOUS BUG: job.remove() on an active job requires the
        // worker's lock token. Without it BullMQ rejects the call silently (our
        // .catch(() => undefined) swallowed the error). queue.add() then returned the
        // existing zombie via dedup — no new "waiting" job was ever created and the
        // worker never woke up. The user had to wait 5+ min for stalledInterval to fire.
        //
        // FIX: use moveToFailed('0', false) instead. BullMQ v5 runs a Lua script that
        // checks whether the Redis lock key EXISTS:
        //   • lock key EXISTS (TTL > 0)  → lock still valid → legitimate running job
        //                                   → throws "Missing lock" → we honour dedup
        //   • lock key MISSING (TTL = 0)  → lock expired → zombie confirmed
        //                                   → moves to failed → slot freed → fresh job added
        // This is atomic and safe: a live worker renewing every 150s is NEVER killed.
        const ageMs = Date.now() - (existingJob.timestamp ?? 0);
        // lockDuration is 300 s. After 5 min the lock has definitely expired on a zombie.
        // Legitimate long-running jobs are safe because their worker keeps renewing the lock.
        const ORPHAN_THRESHOLD_MS = 5 * 60_000;
        if (ageMs > ORPHAN_THRESHOLD_MS) {
          log.warn({ dedupJobId, state, ageMs, action: job.action }, "RC-011: Zombie active job (>5 min, lock expired) — clearing via moveToFailed");
          let cleared = false;
          try {
            // moveToFailed with fake token '0': succeeds when Redis lock key is absent
            // (expired zombie), throws when lock is still held (legitimate active job).
            await existingJob.moveToFailed(
              new Error("RC-011: zombie — lock expired, killed by enqueueOrExecute"),
              "0",
              false,
            );
            cleared = true;
            log.info({ dedupJobId }, "RC-011: zombie cleared via moveToFailed (lock was absent in Redis)");
          } catch (_moveErr) {
            // Lock key still exists → the job is legitimately running or the stall
            // mechanism hasn't fired yet. Fall back to remove() as a best-effort attempt.
            await existingJob.remove().catch(() => undefined);
            const afterRemove = await queue.getJob(dedupJobId);
            if (!afterRemove) {
              cleared = true;
              log.info({ dedupJobId }, "RC-011: zombie cleared via remove() fallback");
            } else {
              log.warn(
                { dedupJobId, ageMs },
                "RC-011: cannot clear zombie (lock held or Redis error). Stall mechanism will recover within stalledInterval (~30 s). Honouring dedup.",
              );
              return { queued: true, jobId: dedupJobId };
            }
          }
          if (!cleared) return { queued: true, jobId: dedupJobId };
          // Fall through to add a fresh waiting job below
        } else {
          // Job is actively being processed (age < 5 min) — honour the dedup
          log.info({ dedupJobId, state, ageMs, action: job.action }, "Dedup: job recently queued or actively running — skipping");
          return { queued: true, jobId: dedupJobId };
        }
      } else if (state === "waiting" || state === "delayed") {
        // Job is already waiting in the queue. This is normal — the worker may be busy
        // with other concurrent jobs (concurrency = 3). A "waiting" job does NOT mean
        // the worker is dead; it just hasn't been picked up yet. Honour the dedup.
        //
        // PREVIOUS BUG: this path used executeDirectly after 30 s, which was wrong.
        // "waiting" only indicates queueing delay, never worker failure. The worker
        // processes waiting jobs as soon as a concurrency slot opens.
        log.info(
          { dedupJobId, state, ageMs: Date.now() - (existingJob.timestamp ?? 0), action: job.action },
          "Dedup: job already waiting in queue — skipping",
        );
        return { queued: true, jobId: dedupJobId };
      }
    }

    // RC-004 FIX: Use jobId for BullMQ deduplication. BullMQ ignores duplicate
    // add() calls with an existing jobId that is still waiting/active. This
    // prevents double-click race conditions where two requests arrive before the
    // "running agents" guard can detect the first execution has started.
    // jobId format: campaignId-action ensures one pending job per campaign per phase.
    // RC-008 FIX: attempts reduced from 3 → 1. Campaign orchestration jobs charge
    // real AI credits on every execution. Automatic retries would silently
    // double/triple-charge credits without user consent after a transient failure.
    // If a job fails, the campaign is reset to a recoverable status (strategy_ready
    // or intake) by boot cleanup, and the user can manually re-trigger via the UI.
    // This also partially mitigates RC-010 (stale job race with boot cleanup).
    const bullJob = await queue.add(
      `campaign-${job.campaignId}-${job.action}`,
      job,
      {
        jobId: dedupJobId,
        attempts: 1,
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
      },
    );
    log.info({ jobId: bullJob.id, action: job.action }, "Orchestration job enqueued");
    return { queued: true, jobId: bullJob.id ?? undefined };
  } catch (err) {
    // Fallback for unexpected queue errors
    log.warn({ action: job.action }, "Queue error — executing directly");
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

  // PIPELINE_KERNEL: single source of truth
  if (!(STRATEGY_PHASE_ENTRY_STATUSES as readonly string[]).includes(campaign.status)) {
    throw new ValidationError(
      `Cannot start strategy phase from status "${campaign.status}"`,
    );
  }

  // Guard: prevent double-triggering — only block on RECENT running agents (started
  // within 15 min). Older rows are orphaned (pipeline exited before agent returned)
  // and should not permanently block the next phase trigger.
  const AGENT_STALE_MS = 15 * 60 * 1000;
  const staleThreshold = new Date(Date.now() - AGENT_STALE_MS);
  const [existingRun] = await db
    .select({ id: campaignAgentsTable.id, startedAt: campaignAgentsTable.startedAt })
    .from(campaignAgentsTable)
    .where(
      and(
        eq(campaignAgentsTable.campaignId, campaignId),
        eq(campaignAgentsTable.status, "running"),
        gt(campaignAgentsTable.startedAt, staleThreshold),
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

  // Touch updatedAt NOW so the failsafe stuck-timer starts from this moment,
  // not from whenever the campaign was last updated (which could be hours ago).
  await db
    .update(campaignsTable)
    .set({ updatedAt: new Date() })
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)));

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

  // PIPELINE_KERNEL: single source of truth — CONTENT_PHASE_ENTRY_STATUSES from campaigns.service
  // RC-002 FIX preserved: "generating" excluded — already in progress, no re-trigger.
  if (!(CONTENT_PHASE_ENTRY_STATUSES as readonly string[]).includes(campaign.status)) {
    throw new ValidationError(
      `Cannot start content generation from status "${campaign.status}". Allowed: ${[...CONTENT_PHASE_ENTRY_STATUSES].join(", ")}.`,
    );
  }

  // Guard: prevent double-triggering — only block on RECENT CONTENT-PHASE running agents
  // (started within 15 min). Strategy-phase agents (strategy, offer, command,
  // execution_governor, launch_manager, profile_builder, etc.) may still be completing
  // background work (doctrine gate, self-critique, analytics) when the campaign reaches
  // strategy_ready. They must NOT block the user from starting content generation.
  // Only block if a content-phase agent is already running (i.e. generation already started).
  const STRATEGY_PHASE_AGENT_TYPES = new Set([
    "command", "execution_governor", "profile_builder", "strategy", "offer",
    "launch_manager", "market_validator", "offer_price_validator", "brand_validator",
    "market_intel", "analytics", "self_critique", "doctrine_gate",
  ]);
  const CONTENT_AGENT_STALE_MS = 15 * 60 * 1000;
  const contentStaleThreshold = new Date(Date.now() - CONTENT_AGENT_STALE_MS);
  const runningAgents = await db
    .select({ id: campaignAgentsTable.id, agentType: campaignAgentsTable.agentType, startedAt: campaignAgentsTable.startedAt })
    .from(campaignAgentsTable)
    .where(
      and(
        eq(campaignAgentsTable.campaignId, campaignId),
        eq(campaignAgentsTable.status, "running"),
        gt(campaignAgentsTable.startedAt, contentStaleThreshold),
      ),
    );

  const existingContentRun = runningAgents.find(
    (a) => !STRATEGY_PHASE_AGENT_TYPES.has(a.agentType ?? ""),
  );

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

  // Touch updatedAt NOW so the failsafe stuck-timer starts from this moment.
  await db
    .update(campaignsTable)
    .set({ updatedAt: new Date() })
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)));

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

  // PIPELINE_KERNEL: single source of truth
  if (!(LAUNCH_PHASE_ENTRY_STATUSES as readonly string[]).includes(campaign.status)) {
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

// ── Boot: resume generating campaigns after server restart ────────────────────
// Called from index.ts AFTER the DB boot cleanup (agents marked failed, queue
// drained). Finds all campaigns stuck in "generating" and re-enqueues them so
// they resume from the last checkpoint saved in contentPiecesTable.
// Bypasses the triggerContentPhase guards (running-agent check) since at boot
// all agents have already been set to "failed".
export async function resumeGeneratingCampaigns(): Promise<void> {
  try {
    const generating = await db
      .select({ id: campaignsTable.id, workspaceId: campaignsTable.workspaceId })
      .from(campaignsTable)
      .where(eq(campaignsTable.status, "generating"));

    if (generating.length === 0) return;

    logger.warn({ count: generating.length }, "Boot cleanup: re-enqueueing generating campaigns for checkpoint resume");

    for (const campaign of generating) {
      await enqueueOrExecute(
        { campaignId: campaign.id, workspaceId: campaign.workspaceId, action: "generate_content" },
        logger,
      ).catch((err) => {
        logger.error({ err, campaignId: campaign.id }, "Boot cleanup: failed to re-enqueue generating campaign");
      });
    }
  } catch (err) {
    logger.error({ err }, "Boot cleanup: resumeGeneratingCampaigns failed");
  }
}
