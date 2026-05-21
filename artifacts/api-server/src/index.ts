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
import { getQueue, closeAllQueues, QUEUE_NAMES } from "./modules/queue/queue.service.js";
import { initOrchestrationWorker, closeOrchestrationWorker } from "./modules/orchestration/orchestration.worker.js";
import { startSocialScheduler, stopSocialScheduler } from "./modules/social/social.worker.js";
import { initSequenceScheduler, closeSequenceScheduler } from "./modules/launch-sequence/sequence-scheduler.worker.js";
import { startFunnelScheduler } from "./modules/academy/academy-funnel.service.js";
import { db, campaignAgentsTable, campaignsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

// ── Boot cleanup: mark orphaned "running" agents as failed ────────────────────
// If the server was restarted mid-execution, agents stay stuck as "running"
// forever. This cleanup runs once on boot to recover those campaigns.
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
  .catch((err) => logger.error({ err }, "Boot cleanup failed"));

// ── Boot cleanup: reset campaigns stuck in "generating" → "strategy_ready" ───
// Content generation runs in-process (setImmediate when Redis unavailable).
// A server restart kills the process, leaving campaigns stuck in "generating".
// Reset them so the user can trigger generation again cleanly.
db.update(campaignsTable)
  .set({ status: "strategy_ready", updatedAt: new Date() })
  .where(eq(campaignsTable.status, "generating"))
  .then((result) => {
    if (result.rowCount && result.rowCount > 0) {
      logger.warn({ count: result.rowCount }, "Boot cleanup: reset generating campaigns to strategy_ready");
    }
  })
  .catch((err) => logger.error({ err }, "Boot cleanup (generating reset) failed"));

// ── Boot cleanup: reset campaigns stuck in "analyzing" → "intake" ─────────
// Strategy generation also runs in-process; a restart leaves them in "analyzing".
// Reset to "intake" so the user can re-trigger strategy generation.
db.update(campaignsTable)
  .set({ status: "intake", updatedAt: new Date() })
  .where(eq(campaignsTable.status, "analyzing"))
  .then((result) => {
    if (result.rowCount && result.rowCount > 0) {
      logger.warn({ count: result.rowCount }, "Boot cleanup: reset analyzing campaigns to intake");
    }
  })
  .catch((err) => logger.error({ err }, "Boot cleanup (analyzing reset) failed"));

httpServer.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "NexOS AI API Server listening");
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
