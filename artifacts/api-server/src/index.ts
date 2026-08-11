import http from "http";
import app from "./app.js";
import { logger } from "./lib/logger.js";

// ─── Suppress ioredis/BullMQ stderr noise in non-production ──────────────────
if (process.env["NODE_ENV"] !== "production") {
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (data: string | Buffer, encoding?: unknown, callback?: unknown): boolean => {
    const str = data.toString();
    if (
      str.includes("ECONNREFUSED") ||
      str.includes("Connection is closed") ||
      str.includes("url.parse()") ||
      str.includes("DEP0169")
    )
      return true;
    return originalStderrWrite(data as never, encoding as never, callback as never);
  };
}
import { initRealtime } from "./modules/realtime/realtime.service.js";
import { getQueue, closeAllQueues, drainQueueAtBoot, QUEUE_NAMES } from "./modules/queue/queue.service.js";
import { initOrchestrationWorker, closeOrchestrationWorker } from "./modules/orchestration/orchestration.worker.js";
import { resumeGeneratingCampaigns } from "./modules/orchestration/orchestration.service.js";
import { startSocialScheduler, stopSocialScheduler } from "./modules/social/social.worker.js";
import { initSequenceScheduler, closeSequenceScheduler } from "./modules/launch-sequence/sequence-scheduler.worker.js";
import { startFunnelScheduler } from "./modules/academy/academy-funnel.service.js";
import { db, campaignAgentsTable, campaignsTable, workspaceIntegrationsTable, workspacesTable, socialPresencePostsTable, socialPresenceConfigTable } from "@workspace/db";
import { eq, and, lt, sql as sqlRaw, like, inArray } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ─── Suppress noisy Redis/ioredis unhandled rejections in dev ─────────────────
process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  if (
    msg.includes("ECONNREFUSED") ||
    msg.includes("Connection is closed") ||
    msg.includes("connect ECONNREFUSED")
  ) {
    return;
  }
  logger.error({ reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  const msg = err.message ?? "";
  if (msg.includes("ECONNREFUSED") || msg.includes("Connection is closed")) {
    return;
  }
  logger.fatal({ err }, "Uncaught exception — shutting down");
  process.exit(1);
});

const httpServer = http.createServer(app);

// ── Long-running AI requests (strategy / content / agents) can take 5-10 min.
// Default Node.js HTTP timeout is 5 seconds — way too short. Set to 12 minutes.
// headersTimeout must be strictly greater than keepAliveTimeout.
httpServer.timeout = 12 * 60 * 1000;          // 12 min request timeout
httpServer.keepAliveTimeout = 65 * 1000;       // 65 s keep-alive (> nginx default 60s)
httpServer.headersTimeout = 66 * 1000;         // must be > keepAliveTimeout

try {
  initRealtime(httpServer);
} catch (err) {
  logger.warn({ err }, "WebSocket init failed — Redis may not be available, continuing without realtime");
}

try {
  getQueue(QUEUE_NAMES.CAMPAIGN_ORCHESTRATION);
  getQueue(QUEUE_NAMES.AGENT_EXECUTION);
  getQueue(QUEUE_NAMES.CONTENT_GENERATION);
  logger.info("Job queues initialized");
} catch (err) {
  logger.warn({ err }, "Queue init failed — Redis may not be available, continuing without queues");
}

initOrchestrationWorker();
startSocialScheduler();
initSequenceScheduler();
startFunnelScheduler();

// ── Boot cleanup: recover orphaned campaigns before accepting any requests ────
// RC-007 FIX: All cleanup operations are awaited via Promise.all() before
// httpServer.listen() is called, ensuring a consistent state on boot.
//
// RC-011 FINAL FIX: BullMQ queue drain added as step 0.
// After a server restart, any BullMQ jobs that were "active" or "waiting" are
// orphaned — their worker process was killed. Previously only the DB was cleaned
// (campaigns reset to recoverable statuses) but the Redis queue still held stale
// "active" jobs. On the next user action, the dedup check would see them as
// "already running" and silently skip the new execution — leaving the user stuck
// with a campaign that appeared to be working but was doing nothing.
//
// Cleanup order:
//   0. Drain orphaned BullMQ jobs (active/waiting/delayed/failed → removed)
//   1. Mark all "running" agents as failed (orphaned from crashed process)
//   2. Reset campaigns stuck in "generating" → "strategy_ready" (content interrupted)
//   3. Reset campaigns stuck in "analyzing"  → "intake"          (strategy interrupted)
//
// All are idempotent — safe to run on every boot even if no cleanup is needed.
// Queue drain runs first (non-blocking, non-fatal if Redis is unavailable).
Promise.all([
  drainQueueAtBoot(QUEUE_NAMES.CAMPAIGN_ORCHESTRATION),
  drainQueueAtBoot(QUEUE_NAMES.AGENT_EXECUTION),
  drainQueueAtBoot(QUEUE_NAMES.CONTENT_GENERATION),
  db.update(campaignAgentsTable)
    .set({
      status: "failed",
      errorMessage: "Servidor reiniciado — execução interrompida",
      completedAt: new Date(),
    })
    .where(eq(campaignAgentsTable.status, "running"))
    .then((result) => {
      if (result.rowCount && result.rowCount > 0) {
        logger.warn({ count: result.rowCount }, "Boot cleanup: marked orphaned running agents as failed");
      }
    })
    .catch((err) => logger.error({ err }, "Boot cleanup (agents) failed")),

  // NOTE: "generating" campaigns are NOT reset here — they will be re-enqueued
  // below (after agents are marked failed) so content generation resumes from
  // the last checkpoint saved in contentPiecesTable.

  // INTEGRATION-DEDUP: Delete older duplicate rows in workspace_integrations, keeping only the
  // most recent row per (workspace_id, provider). This fixes the state where multiple failed
  // OAuth attempts each created a separate disconnected row (no UNIQUE constraint on the pair).
  // The OAuth upsert now does DELETE + INSERT to prevent new duplicates, but existing ones
  // in production must be cleaned up at boot. Safe to run on every boot — idempotent.
  db.execute(sqlRaw`
    DELETE FROM workspace_integrations
    WHERE id NOT IN (
      SELECT DISTINCT ON (workspace_id, provider) id
      FROM workspace_integrations
      ORDER BY workspace_id, provider, created_at DESC
    )
  `)
    .then((result) => {
      if (result.rowCount && result.rowCount > 0) {
        logger.warn({ count: result.rowCount }, "Boot cleanup: removed duplicate workspace_integrations rows");
      }
    })
    .catch((err) => logger.error({ err }, "Boot cleanup (integration dedup) failed")),

  // PRESENCE-FIX: Eliminar business_context NexOS de contas de clientes.
  // O campo pode ter sido preenchido com texto de teste/demonstração da plataforma durante
  // o onboarding. Clientes devem ter business_context vazio até preencherem seus próprios dados.
  // A remoção é permanente e idempotente — na próxima geração o planner usa só o intake real.
  db.execute(sqlRaw`
    UPDATE social_presence_config
    SET business_context = ''
    WHERE business_context ILIKE '%nexos%'
       OR business_context ILIKE '%prova de que%'
       OR business_context ILIKE '%integração das redes sociais%'
       OR business_context ILIKE '%teste de integração%'
       OR business_context ILIKE '%prova de conceito%'
  `)
    .then((result) => {
      if (result.rowCount && result.rowCount > 0) {
        logger.warn({ count: result.rowCount }, "Boot cleanup: cleared NexOS placeholder business_context from social_presence_config");
      }
    })
    .catch((err) => logger.error({ err }, "Boot cleanup (presence business_context) failed")),

  // HEYGEN-FIX: Clear stale/invalid heygenAvatarId values from workspace persona settings.
  // HeyGen periodically retires stock avatars; workspaces that had one of these saved IDs
  // will get a 404 on every video generation attempt. Removing the stale ID forces the user
  // to re-select from the live HeyGen catalog, which now loads dynamically.
  db.execute(sqlRaw`
    UPDATE workspaces
    SET settings = settings #- '{persona,heygenAvatarId}'
    WHERE settings->'persona'->>'heygenAvatarId' IN (
      'Daisy-inskirt-20220818',
      'Kayla-inblackskirt-20220818',
      'Tyler-incasualsuit-20220721'
    )
  `)
    .then((result) => {
      if (result.rowCount && result.rowCount > 0) {
        logger.warn({ count: result.rowCount }, "Boot cleanup: cleared stale HeyGen avatar IDs from workspace settings");
      }
    })
    .catch((err) => logger.error({ err }, "Boot cleanup (heygen avatar) failed")),

  // HEYGEN-FIX: Reset social presence posts that failed due to the stale Daisy avatar.
  // These posts have a valid storyboard — only the video generation step failed.
  // Resetting them to storyboard_ready + scheduled allows the scheduler to retry
  // automatically once the user selects a valid avatar.
  db.execute(sqlRaw`
    UPDATE social_presence_posts
    SET
      media_gen_status = 'storyboard_ready',
      status           = 'scheduled',
      error_message    = 'Avatar anterior inválido foi corrigido automaticamente — configure um avatar em Configurações → Persona para gerar o vídeo.',
      updated_at       = NOW()
    WHERE error_message LIKE '%Daisy-inskirt-20220818%'
      AND format IN ('reel', 'feed_video', 'story')
      AND status != 'published'
  `)
    .then((result) => {
      if (result.rowCount && result.rowCount > 0) {
        logger.warn({ count: result.rowCount }, "Boot cleanup: reset social presence posts blocked by stale HeyGen avatar");
      }
    })
    .catch((err) => logger.error({ err }, "Boot cleanup (heygen posts reset) failed")),

  // RC-FIX: Only reset campaigns stuck in "analyzing" for > 30 min.
  // Campaigns that JUST transitioned (e.g. fresh finalize before a restart) must NOT be reset,
  // or the user loses their work silently. 30 min is enough time for any real strategy run.
  db.update(campaignsTable)
    .set({ status: "intake", updatedAt: new Date() })
    .where(and(
      eq(campaignsTable.status, "analyzing"),
      lt(campaignsTable.updatedAt, new Date(Date.now() - 30 * 60 * 1000)),
    ))
    .then((result) => {
      if (result.rowCount && result.rowCount > 0) {
        logger.warn({ count: result.rowCount }, "Boot cleanup: reset analyzing campaigns to intake");
      }
    })
    .catch((err) => logger.error({ err }, "Boot cleanup (analyzing reset) failed")),
]).then(async () => {
  // Re-enqueue generating campaigns AFTER agents are marked failed + queue drained.
  // They will resume from the checkpoint in contentPiecesTable (skipping completed agents).
  await resumeGeneratingCampaigns();

  httpServer.listen(port, (err?: Error) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "NexOS AI API Server listening");
  });
}).catch((err) => {
  logger.error({ err }, "Boot cleanup failed — starting server anyway to avoid complete outage");
  httpServer.listen(port, () => {
    logger.info({ port }, "NexOS AI API Server listening (cleanup failed)");
  });
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutdown signal received");
  stopSocialScheduler();
  await closeSequenceScheduler();
  await closeOrchestrationWorker();
  await closeAllQueues();
  httpServer.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 10_000).unref();
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
