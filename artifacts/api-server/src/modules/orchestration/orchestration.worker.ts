import { Worker, type Job } from "bullmq";
import { eq, and } from "drizzle-orm";
import { db, campaignsTable, auditLogsTable } from "@workspace/db";
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
    await db
      .update(campaignsTable)
      .set({ status: "executing", executionStartedAt: new Date() })
      .where(eq(campaignsTable.id, campaignId));

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

  await db
    .update(campaignsTable)
    .set({ status: "live" })
    .where(eq(campaignsTable.id, campaignId));

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

  await db
    .update(campaignsTable)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(campaignsTable.id, campaignId));

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
      },
    );

    worker.on("completed", (job) => {
      logger.info({ jobId: job.id, action: job.data.action }, "Orchestration job completed");
    });

    worker.on("failed", (job, err) => {
      logger.error({ jobId: job?.id, action: job?.data.action, err }, "Orchestration job failed");
    });

    worker.on("error", (err) => {
      // Redis connection errors during dev — expected when Redis is not running
      if ((err as NodeJS.ErrnoException).code === "ECONNREFUSED") return;
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
