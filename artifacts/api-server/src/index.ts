import http from "http";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { initRealtime } from "./modules/realtime/realtime.service.js";
import { getQueue, QUEUE_NAMES } from "./modules/queue/queue.service.js";
import { initOrchestrationWorker, closeOrchestrationWorker } from "./modules/orchestration/orchestration.worker.js";
import { startSocialScheduler, stopSocialScheduler } from "./modules/social/social.worker.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

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
  await closeOrchestrationWorker();
  httpServer.close(() => process.exit(0));
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
