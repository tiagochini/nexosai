import { Worker, type Job } from "bullmq";
import { eq, and, inArray } from "drizzle-orm";
import { db, campaignsTable, auditLogsTable } from "@workspace/db";
import {
  transitionCampaign,
  STRATEGY_PHASE_ENTRY_STATUSES,
  CONTENT_PHASE_ENTRY_STATUSES,
} from "../campaigns/campaigns.service.js";
import { saveVerticalLearning } from "../campaign-brain/vertical-memory.service.js";
import { QUEUE_NAMES, type CampaignOrchestrationJob } from "../queue/queue.service.js";
import { orchestrateCampaign } from "../agents/command.agent.js";
import { generateCampaignContent } from "../content/content.service.js";
import { emitCampaignEvent } from "../realtime/realtime.service.js";
import { logger } from "../../lib/logger.js";
import { env } from "../../lib/env.js";

const redisConnection = {
  url: env.REDIS_URL,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy: (times: number) => {
    if (times > 3) return null;
    return Math.min(times * 1000, 5000);
  },
};

// ── Job processors ────────────────────────────────────────────────────────────

async function processRunStrategy(job: Job<CampaignOrchestrationJob>): Promise<void> {
  const { campaignId, workspaceId } = job.data;
  const log = logger.child({ jobId: job.id, campaignId, action: "run_strategy" });

  // RC-010 FIX: Pre-check campaign status before executing.
  // A stale BullMQ job (queued before a server crash/restart) may arrive AFTER
  // boot cleanup has already reset the campaign to a different status. If the
  // campaign is in a late-pipeline status (live, completed, cancelled, approved,
  // executing, awaiting_approval) it was already processed — skip gracefully.
  const [pre] = await db
    .select({ status: campaignsTable.status })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!pre) {
    log.warn({ campaignId }, "RC-010: Campaign not found — skipping stale strategy job");
    return;
  }

  // PIPELINE_KERNEL: single source of truth
  if (!(STRATEGY_PHASE_ENTRY_STATUSES as readonly string[]).includes(pre.status)) {
    log.warn(
      { campaignId, status: pre.status },
      "RC-010: Campaign not in strategy-eligible state — skipping stale retry job (prevents double credit charge)",
    );
    return;
  }

  emitCampaignEvent({
    campaignId,
    type: "execution_update",
    message: "Iniciando fase de estratégia...",
    data: { phase: "strategy", progress: 0 },
    timestamp: new Date().toISOString(),
  });

  try {
    const result = await orchestrateCampaign(campaignId, workspaceId, log);

    emitCampaignEvent({
      campaignId,
      type: "execution_update",
      message: `Fase de estratégia concluída — ${result.agentsRun.length} agentes executados`,
      data: { phase: "strategy", progress: 100, agentsRun: result.agentsRun, status: result.status },
      timestamp: new Date().toISOString(),
    });

    log.info({ agentsRun: result.agentsRun, finalStatus: result.status }, "Strategy phase completed");
  } catch (err) {
    log.error({ err }, "Strategy phase failed");
    emitCampaignEvent({
      campaignId,
      type: "agent_failed",
      message: `Fase de estratégia falhou: ${err instanceof Error ? err.message : String(err)}`,
      timestamp: new Date().toISOString(),
    });
    throw err;
  }
}

async function processGenerateContent(job: Job<CampaignOrchestrationJob>): Promise<void> {
  const { campaignId, workspaceId } = job.data;
  const log = logger.child({ jobId: job.id, campaignId, action: "generate_content" });

  // RC-010 FIX: Same pre-check as processRunStrategy. After boot cleanup resets
  // "generating" → "strategy_ready", a stale BullMQ content job could arrive and
  // re-generate content + re-charge credits. Skip if campaign is no longer in a
  // content-eligible state.
  const [pre] = await db
    .select({ status: campaignsTable.status })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!pre) {
    log.warn({ campaignId }, "RC-010: Campaign not found — skipping stale content job");
    return;
  }

  // PIPELINE_KERNEL: single source of truth — RC-001 FIX preserved: "generating" excluded.
  // User must explicitly trigger again via UI (manual consent = no surprise credit charge).
  if (!(CONTENT_PHASE_ENTRY_STATUSES as readonly string[]).includes(pre.status)) {
    log.warn(
      { campaignId, status: pre.status },
      "RC-010: Campaign not in content-eligible state — skipping stale retry job (prevents double credit charge)",
    );
    return;
  }

  emitCampaignEvent({
    campaignId,
    type: "execution_update",
    message: "Iniciando geração de conteúdo — 16 agentes em sequência...",
    data: { phase: "content", progress: 0 },
    timestamp: new Date().toISOString(),
  });

  try {
    const result = await generateCampaignContent(campaignId, workspaceId, log);

    emitCampaignEvent({
      campaignId,
      type: "execution_update",
      message: `Conteúdo gerado — ${result.piecesGenerated} peças, ${result.mediaBriefsGenerated} briefs`,
      data: {
        phase: "content",
        progress: 100,
        piecesGenerated: result.piecesGenerated,
        mediaBriefsGenerated: result.mediaBriefsGenerated,
        agentsRun: result.agentsRun,
        errors: result.errors,
        status: result.status,
      },
      timestamp: new Date().toISOString(),
    });

    log.info(
      { piecesGenerated: result.piecesGenerated, agentsRun: result.agentsRun.length },
      "Content phase completed",
    );

    // Transition to awaiting_approval so user can review content pieces before launch.
    await transitionCampaign(campaignId, workspaceId, "awaiting_approval", "content generation complete — awaiting approval", log);

    emitCampaignEvent({
      campaignId,
      type: "phase_changed",
      message: `${result.piecesGenerated} peças geradas — aguardando sua aprovação para lançar`,
      data: { status: "awaiting_approval", piecesGenerated: result.piecesGenerated },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    log.error({ err }, "Content phase failed");
    emitCampaignEvent({
      campaignId,
      type: "agent_failed",
      message: `Geração de conteúdo falhou: ${err instanceof Error ? err.message : String(err)}`,
      timestamp: new Date().toISOString(),
    });
    throw err;
  }
}

async function processExecute(job: Job<CampaignOrchestrationJob>): Promise<void> {
  const { campaignId, workspaceId } = job.data;
  const log = logger.child({ jobId: job.id, campaignId, action: "execute" });

  const [campaign] = await db
    .select({ id: campaignsTable.id, status: campaignsTable.status })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }

  // approved → executing → live
  if (campaign.status === "approved") {
    await transitionCampaign(campaignId, workspaceId, "executing", "launch phase activated", log, {
      executionStartedAt: new Date(),
    });

    emitCampaignEvent({
      campaignId,
      type: "phase_changed",
      message: "Campanha em execução — ativando canais...",
      data: { status: "executing" },
      timestamp: new Date().toISOString(),
    });

    await db.insert(auditLogsTable).values({
      workspaceId,
      campaignId,
      action: "campaign.status.executing",
      actor: "system",
      data: { previous: "approved", next: "executing" },
    });

    // Simulate channel activation delay then go live
    await new Promise((r) => setTimeout(r, 1500));
  }

  await transitionCampaign(campaignId, workspaceId, "live", "campaign channels active", log);

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "campaign.status.live",
    actor: "system",
    data: { previous: "executing", next: "live" },
  });

  emitCampaignEvent({
    campaignId,
    type: "phase_changed",
    message: "Campanha ao vivo — monitoramento iniciado",
    data: { status: "live" },
    timestamp: new Date().toISOString(),
  });

  log.info({ campaignId }, "Campaign is now live");
}

async function processMonitor(job: Job<CampaignOrchestrationJob>): Promise<void> {
  const { campaignId } = job.data;
  const log = logger.child({ jobId: job.id, campaignId, action: "monitor" });

  emitCampaignEvent({
    campaignId,
    type: "execution_update",
    message: "Health check em andamento...",
    data: { phase: "monitor" },
    timestamp: new Date().toISOString(),
  });

  log.info({ campaignId }, "Monitor job processed (metrics service handles auto-optimization)");
}

async function processComplete(job: Job<CampaignOrchestrationJob>): Promise<void> {
  const { campaignId, workspaceId } = job.data;
  const log = logger.child({ jobId: job.id, campaignId, action: "complete" });

  await transitionCampaign(campaignId, workspaceId, "completed", "campaign lifecycle complete", log, {
    completedAt: new Date(),
  });

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "campaign.status.completed",
    actor: "system",
    data: { completedVia: "orchestration_worker" },
  });

  emitCampaignEvent({
    campaignId,
    type: "campaign_completed",
    message: "Campanha concluída com sucesso",
    data: { status: "completed" },
    timestamp: new Date().toISOString(),
  });

  log.info({ campaignId }, "Campaign completed");

  // Learning Memory per Vertical — fire-and-forget — accumulates intelligence across campaigns
  setImmediate(() => {
    saveVerticalLearning(campaignId, workspaceId, log).catch((err: unknown) => {
      log.warn({ err, campaignId }, "Vertical Memory save failed — non-blocking");
    });
  });
}

// ── Worker factory ─────────────────────────────────────────────────────────────

let worker: Worker | null = null;

export function initOrchestrationWorker(): Worker | null {
  try {
    worker = new Worker<CampaignOrchestrationJob>(
      QUEUE_NAMES.CAMPAIGN_ORCHESTRATION,
      async (job) => {
        logger.info({ jobId: job.id, action: job.data.action, campaignId: job.data.campaignId }, "Processing orchestration job");

        switch (job.data.action) {
          case "run_strategy":
            await processRunStrategy(job);
            break;
          case "generate_content":
            await processGenerateContent(job);
            break;
          case "execute":
            await processExecute(job);
            break;
          case "monitor":
            await processMonitor(job);
            break;
          case "complete":
            await processComplete(job);
            break;
          default:
            logger.warn({ action: (job.data as any).action }, "Unknown orchestration action");
        }
      },
      {
        connection: redisConnection,
        concurrency: 3,
        limiter: { max: 10, duration: 60_000 },
        // RC-011 FIX: maxStalledCount: 0 was causing UnrecoverableError on first
        // stall with no retries. Changed to 1 — the pre-flight status check inside
        // each processor (PIPELINE_KERNEL) prevents double credit charges by skipping
        // if the campaign is no longer in the expected entry state.
        maxStalledCount: 1,
        // RC-011 FIX: Reduced from 600_000 to 30_000 for fast orphan detection.
        // Redis is now Pay-As-You-Go (no request budget) so the cost concern that
        // motivated the 10-min interval no longer applies. 30s means orphaned jobs
        // (server restart killed the worker mid-run) are detected and recycled quickly
        // rather than blocking dedup for 10 minutes.
        stalledInterval: 30_000,
        // RC-011 FIX: lockDuration 300_000 (5 min) — AI content generation takes
        // up to 3 min. The worker auto-extends every lockDuration/2 (150s) so a
        // legitimately running job will never be falsely stalled. Only truly orphaned
        // jobs (no heartbeat after server restart) will stall within 30s.
        lockDuration: 300_000,
      },
    );

    worker.on("completed", (job) => {
      logger.info({ jobId: job.id, action: job.data.action }, "Orchestration job completed");
    });

    worker.on("failed", async (job, err) => {
      logger.error({ jobId: job?.id, action: job?.data.action, err }, "Orchestration job failed");

      // RC-011 FIX: Reset campaign status when a job fails permanently so the
      // user can retry via the UI. Without this, campaigns stay in "generating"
      // or "analyzing" indefinitely after a runtime failure (boot cleanup only
      // runs at startup — it won't rescue campaigns that fail mid-session).
      //
      // The pre-flight PIPELINE_KERNEL check inside each processor already
      // prevents double-credit-charges: if the campaign was already advanced
      // (e.g. boot cleanup reset it to strategy_ready), the new job will
      // skip gracefully without re-running agents.
      if (!job) return;
      const { campaignId, workspaceId, action } = job.data;

      const resetStatus =
        action === "generate_content" ? "strategy_ready" :
        action === "run_strategy" ? "intake" :
        null;

      if (resetStatus) {
        // Only reset from the "active processing" state for this action.
        // Using eq() avoids the enum-type mismatch that inArray() hits with Drizzle.
        const fromStatus =
          resetStatus === "strategy_ready" ? "generating" :
          "analyzing" as const;
        try {
          const result = await db
            .update(campaignsTable)
            .set({ status: resetStatus as typeof fromStatus, updatedAt: new Date() })
            .where(
              and(
                eq(campaignsTable.id, campaignId),
                eq(campaignsTable.workspaceId, workspaceId),
                eq(campaignsTable.status, fromStatus),
              ),
            );
          if (result.rowCount && result.rowCount > 0) {
            logger.warn({ campaignId, action, resetStatus }, "RC-011: Campaign reset after job failure — user can retry");
          }
        } catch (resetErr) {
          logger.error({ resetErr, campaignId, action }, "RC-011: Failed to reset campaign status after job failure");
        }
      }
    });

    worker.on("error", (err) => {
      // Suppress known non-fatal Redis errors — these are handled by the
      // enqueueOrExecute fallback and do not require error logging.
      const code = (err as NodeJS.ErrnoException).code;
      const msg = err.message ?? "";
      if (
        code === "ECONNREFUSED" ||
        msg.includes("ECONNREFUSED") ||
        msg.includes("Connection is closed") ||
        msg.includes("maxRetriesPerRequest") ||
        msg.includes("max requests limit exceeded") ||
        msg.includes("ETIMEDOUT")
      ) return;
      logger.error({ err }, "Orchestration worker error");
    });

    logger.info("Orchestration worker initialized");
    return worker;
  } catch (err) {
    logger.warn({ err }, "Could not initialize orchestration worker — Redis may be unavailable");
    return null;
  }
}

export async function closeOrchestrationWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}

// ── Direct execution fallback (when Redis unavailable) ───────────────────────

export async function executeDirectly(job: CampaignOrchestrationJob, log: typeof logger): Promise<void> {
  const fakeJob = { data: job, id: `direct-${Date.now()}` } as Job<CampaignOrchestrationJob>;

  switch (job.action) {
    case "run_strategy":
      await processRunStrategy(fakeJob);
      break;
    case "generate_content":
      await processGenerateContent(fakeJob);
      break;
    case "execute":
      await processExecute(fakeJob);
      break;
    case "monitor":
      await processMonitor(fakeJob);
      break;
    case "complete":
      await processComplete(fakeJob);
      break;
  }
}
