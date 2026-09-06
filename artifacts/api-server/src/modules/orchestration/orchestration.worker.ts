import { Worker, type Job } from "bullmq";
import { eq, and, inArray, sql } from "drizzle-orm";
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
import { bridgeCampaignToSequence } from "../launch-sequence/sequence-bridge.service.js";
import { enforceLaunchAutonomyGate, enforceNoMandatoryPause } from "../autonomy/autonomy.service.js";
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

  // ── Strategy heartbeat ────────────────────────────────────────────────────
  // Updates pipelineCheckpoint.lastProgressAt every 90s while strategy agents run.
  // Keeps the 5-minute stuck-campaign guard from incorrectly resetting active runs.
  const strategyHeartbeat = setInterval(async () => {
    try {
      const [row] = await db
        .select({ bd: (campaignsTable as any).brainData })
        .from(campaignsTable)
        .where(eq(campaignsTable.id, campaignId))
        .limit(1);
      const brain = ((row?.bd ?? {}) as Record<string, unknown>);
      const cp = ((brain["pipelineCheckpoint"] ?? {}) as Record<string, unknown>);
      await db.update(campaignsTable).set({
        updatedAt: new Date(),
        brainData: { ...brain, pipelineCheckpoint: { ...cp, lastProgressAt: new Date().toISOString() } } as any,
      }).where(eq(campaignsTable.id, campaignId));
    } catch { /* non-fatal — heartbeat is best-effort */ }
  }, 90_000);

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
  } finally {
    clearInterval(strategyHeartbeat);
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
    .select({ status: campaignsTable.status, strategyData: campaignsTable.strategyData })
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

  // STRATEGY INTEGRITY GUARD: warn if strategyData is empty but continue anyway.
  // AUDIT FIX: changed from hard abort → warn-and-continue.
  // Previous behavior: if strategyData was null/empty, abort content generation and
  // reset to strategy_ready — paying customer had to manually re-trigger strategy.
  // New behavior: log a warning and let content agents run with empty fallback data.
  // Content agents have their own intake data + profile which provides enough context
  // to produce reasonable output even without strategy. The mission is "customer gets
  // their deliverable" — not "customer gets a perfect deliverable or nothing at all."
  const strategyObj = pre.strategyData as Record<string, unknown> | null | undefined;
  const strategyIsEmpty = !strategyObj || Object.keys(strategyObj).length === 0;
  if (strategyIsEmpty) {
    log.warn({ campaignId }, "STRATEGY_EMPTY: strategyData is empty — proceeding with content generation using intake data only. Output quality may be reduced.");
    // DEGRADED-MODE CONTRACT: stamp campaign record so downstream systems + UI can detect
    // reduced-quality mode. This flag persists and is excluded from "successful delivery"
    // SLA metrics. It is NOT cleared by the content pipeline (intentional — auditable).
    await db
      .update(campaignsTable)
      .set({
        brainData: sql`COALESCE(${campaignsTable.brainData}, '{}'::jsonb) || ${JSON.stringify({ _degradedMode: true, _degradedReason: "STRATEGY_EMPTY", _degradedAt: new Date().toISOString() })}::jsonb`,
      })
      .where(eq(campaignsTable.id, campaignId))
      .catch(() => {/* non-fatal — flag is best-effort */});
    emitCampaignEvent({
      campaignId,
      type: "execution_update",
      message: "⚠️ Estratégia parcial — gerando conteúdo com dados do briefing. Qualidade pode ser reduzida.",
      data: { phase: "content", progress: 0, warning: "STRATEGY_EMPTY", degradedMode: true },
      timestamp: new Date().toISOString(),
    });
    // Continue — do NOT abort or reset. Content agents handle empty strategyData gracefully.
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

    // NOTE: generateCampaignContent already handles status transition internally
    // (generating → awaiting_approval or generating → strategy_ready if all failed).
    // DO NOT call transitionCampaign here — it would cause a double-transition error
    // that silently resets the campaign back to strategy_ready via the failed handler.

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
      { piecesGenerated: result.piecesGenerated, agentsRun: result.agentsRun.length, finalStatus: result.status },
      "Content phase completed",
    );
  } catch (err) {
    log.error({ err }, "Content phase failed — notifying frontend and resetting campaign");
    // Explicitly reset campaign to strategy_ready so user can retry via UI.
    // This catches true crashes (out-of-memory, uncaught throw, etc.) —
    // normal agent failures are handled inside generateCampaignContent and
    // never reach this catch block.
    try {
      await db
        .update(campaignsTable)
        .set({ status: "strategy_ready", updatedAt: new Date() })
        .where(
          and(
            eq(campaignsTable.id, campaignId),
            eq(campaignsTable.workspaceId, workspaceId),
            eq(campaignsTable.status, "generating"),
          ),
        );
    } catch (resetErr) {
      log.error({ resetErr, campaignId }, "Failed to reset campaign after content generation crash");
    }
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

  // A paused campaign must never fall through to `live`. Resolving a mandatory
  // pause only removes the block; resuming the campaign remains an explicit
  // user-controlled operation.
  if (campaign.status === "paused") {
    log.warn({ campaignId }, "Launch worker stopped because campaign is paused");
    await db.insert(auditLogsTable).values({
      workspaceId,
      campaignId,
      action: "campaign.execution.blocked_paused",
      actor: "system",
      data: { currentStatus: campaign.status },
    });
    return;
  }

  // Final worker boundary: acceptances or pauses may change after queueing.
  await enforceLaunchAutonomyGate(workspaceId, campaignId, "system:orchestration-worker");
  await enforceNoMandatoryPause(workspaceId, {
    campaignId,
    channel: "campaign",
    action: "launch",
  });

  // approved → executing → live
  // The no-Redis fallback has already atomically moved approved → executing to
  // claim the phase. Its explicit marker lets this processor perform the same
  // bridge/activation work rather than treating its own claim as a prior run.
  if (campaign.status === "approved" || job.data.directClaimed) {
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

    // Bridge approved content pieces → launch sequence items so the scheduler
    // has real dispatch items to send. Non-fatal: if this fails the campaign
    // still goes live — operators can manually create sequences as fallback.
    try {
      await enforceLaunchAutonomyGate(workspaceId, campaignId, "system:orchestration-worker");
      await enforceNoMandatoryPause(workspaceId, { campaignId, channel: "campaign", action: "launch" });
      const bridge = await bridgeCampaignToSequence(campaignId, workspaceId, log);
      log.info(
        { campaignId, sequenceId: bridge.sequenceId, itemsCreated: bridge.itemsCreated, reason: bridge.reason },
        "[EXECUTE] Sequence bridge completed",
      );
    } catch (bridgeErr) {
      log.warn(
        { campaignId, err: bridgeErr instanceof Error ? bridgeErr.message : String(bridgeErr) },
        "[EXECUTE] Sequence bridge failed (non-fatal) — campaign will still go live",
      );
    }
  } else if (campaign.status !== "executing") {
    log.warn({ campaignId, status: campaign.status }, "Launch worker stopped because campaign is not launchable");
    return;
  }

  const [beforeLive] = await db.select({ status: campaignsTable.status }).from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId))).limit(1);
  if (!beforeLive || beforeLive.status === "paused") {
    log.warn({ campaignId, status: beforeLive?.status }, "Launch worker stopped before live transition");
    return;
  }
  await enforceLaunchAutonomyGate(workspaceId, campaignId, "system:orchestration-worker");
  await enforceNoMandatoryPause(workspaceId, { campaignId, channel: "campaign", action: "launch" });
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

/** Lifecycle only; health must not expose BullMQ connection details. */
export function isOrchestrationWorkerRunning(): boolean {
  return worker !== null;
}

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
        // ROOT CAUSE FIX (production stall): lockDuration must be large enough that
        // the worker's lock-renewal heartbeat (fired every lockDuration/2) never
        // races with a slow LLM call. Content generation runs up to 16 sequential
        // LLM calls; each can take 30-90s under load. With lockDuration=30s the
        // renewal fires every 15s — if Node.js event-loop is busy processing an LLM
        // response, the renewal is delayed and BullMQ marks the job as stalled.
        //
        // With maxStalledCount=0 a single stall becomes UnrecoverableError and the
        // job dies silently (no frontend notification, campaign stuck in "generating").
        // This was the exact production failure observed in logs:
        //   UnrecoverableError: job stalled more than allowable limit
        //
        // Fix: lockDuration=300s (5 min) → renewal every 150s → 16 agents × 90s max
        // = 1440s worst case, which is well within Node.js's ability to renew every
        // 150s between LLM calls (each call awaits before the next starts).
        //
        // stalledInterval: 30 s — stall detection fires every 30 s.
        // After a server crash the orphaned job's lock expires after lockDuration (300 s).
        // The next stalledInterval tick (≤ 30 s later) detects it and requeues.
        // Total orphan recovery time after restart: ≤ 330 s (5.5 min worst case).
        //
        // Previously stalledInterval was 300 s (same as lockDuration), giving a worst-case
        // of 600 s (10 min) — and RC-011's remove() bug meant it could be indefinite.
        // RC-011 is now fixed (moveToFailed path) but stalledInterval=30 s is the
        // belt-and-suspenders fallback that guarantees natural recovery even if
        // RC-011 is bypassed or the user doesn't re-trigger manually.
        //
        // lockDuration stays at 300 s: the lock is renewed every 150 s (lockDuration/2).
        // Each LLM call is a non-blocking await — the event loop is free between calls
        // to process the renewal timer. A legitimate 16-agent content run (≤ 24 min)
        // renews the lock safely throughout its lifetime.
        //
        // maxStalledCount=2: allows 2 stall detections before the job dies. Covers the
        // edge case where a CPU-heavy JSON parse briefly delays a renewal tick.
        maxStalledCount: 2,
        stalledInterval: 30_000,
        lockDuration: 300_000,
      },
    );

    worker.on("completed", (job) => {
      logger.info({ jobId: job.id, action: job.data.action }, "Orchestration job completed");
    });

    worker.on("failed", async (job, err) => {
      logger.error({ jobId: job?.id, action: job?.data.action, err }, "Orchestration job failed");

      // generate_content: the catch block inside processGenerateContent already:
      //   1. Resets campaign to strategy_ready
      //   2. Emits agent_failed to the frontend
      // So we do NOT reset again here — that would be a no-op at best, and at
      // worst could race with a legitimate transition (e.g. awaiting_approval).
      //
      // run_strategy: processRunStrategy re-throws without resetting, so we
      // handle it here.
      if (!job) return;
      const { campaignId, workspaceId, action } = job.data;

      if (action === "run_strategy") {
        try {
          // Keep campaign in "analyzing" so the user can click "Gerar Estratégia" to retry
          // without having to redo the entire intake conversation. Reset to "intake" only
          // if the command agent itself determined intake was incomplete (handled inside
          // orchestrateCampaign via transitionCampaign("intake")).
          const result = await db
            .update(campaignsTable)
            .set({ updatedAt: new Date() })
            .where(
              and(
                eq(campaignsTable.id, campaignId),
                eq(campaignsTable.workspaceId, workspaceId),
                eq(campaignsTable.status, "analyzing"),
              ),
            );
          if (result.rowCount && result.rowCount > 0) {
            logger.warn({ campaignId, action }, "Strategy job failed — campaign stays in analyzing so user can retry via Gerar Estratégia");
          }
        } catch (resetErr) {
          logger.error({ resetErr, campaignId, action }, "Failed to reset campaign status after strategy job failure");
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
