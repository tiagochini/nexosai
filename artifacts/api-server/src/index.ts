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
import { db, campaignAgentsTable, campaignsTable } from "@workspace/db";
import { eq, and, lt } from "drizzle-orm";

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
