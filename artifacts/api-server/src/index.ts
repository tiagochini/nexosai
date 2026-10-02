import http from "http";
import app from "./app.js";
import { logger } from "./lib/logger.js";

import { initRealtime } from "./modules/realtime/realtime.service.js";
import {
  getQueue,
  closeAllQueues,
  QUEUE_NAMES,
} from "./modules/queue/queue.service.js";
import {
  initOrchestrationWorker,
  closeOrchestrationWorker,
} from "./modules/orchestration/orchestration.worker.js";
import { resumeGeneratingCampaigns } from "./modules/orchestration/orchestration.service.js";
import {
  startSocialScheduler,
  startMetricsSyncScheduler,
  stopSocialScheduler,
  stopMetricsSyncScheduler,
} from "./modules/social/social.worker.js";
import {
  startPaidMediaScheduler,
  stopPaidMediaScheduler,
} from "./modules/paid-media/paid-media.worker.js";
import {
  initSequenceScheduler,
  closeSequenceScheduler,
} from "./modules/launch-sequence/sequence-scheduler.worker.js";
import {
  startLifecycleScheduler,
  stopLifecycleScheduler,
} from "./modules/lifecycle/lifecycle.worker.js";
import {
  startFunnelScheduler,
  stopFunnelScheduler,
} from "./modules/academy/academy-funnel.service.js";
import {
  startRegionalAcquisitionScheduler,
  stopRegionalAcquisitionScheduler,
} from "./modules/market-intel/regional-acquisition.service.js";
import { cleanupDisconnectedIntegrationDuplicates } from "./modules/integrations/integration-cleanup.service.js";
import { recoverStudioRenders } from "./modules/video-editor/audiovisual-studio.service.js";
import { organizeAllWorkspaceRecordings } from "./modules/recording/recording.service.js";
import {
  startApprovalSlaScheduler,
  stopApprovalSlaScheduler,
} from "./modules/approval-center/approval-sla.service.js";
import {
  db,
  pool,
  campaignAgentsTable,
  campaignsTable,
  socialPostsTable,
} from "@workspace/db";
import { eq, and, lt } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// [P1] BUILD_TAG — timestamp estático gravado no momento da compilação.
// Visível nos logs de produção (nível ERROR flui). Prova qual binário está rodando.
logger.info(
  { buildTag: "NEXOS_VIDEO_STORAGE_V1", builtAt: "2026-08-13T20:10:22Z" },
  "[BUILD_TAG] api-server booting",
);

const httpServer = http.createServer(app);
let shuttingDown = false;

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "Unhandled promise rejection — shutting down");
  void shutdown("unhandledRejection");
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — shutting down");
  void shutdown("uncaughtException");
});

// ── C0.6.2 TEMP — log DB host at boot (never logs password) ──────────────────
try {
  const dbUrl = new URL(process.env["DATABASE_URL"] ?? "");
  logger.info(
    {
      "[C0.6.2]": true,
      dbHost: dbUrl.hostname,
      dbName: dbUrl.pathname,
      dbUser: dbUrl.username,
    },
    "Boot DB connection info",
  );
} catch {
  /* noop */
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Long-running AI requests (strategy / content / agents) can take 5-10 min.
// Default Node.js HTTP timeout is 5 seconds — way too short. Set to 12 minutes.
// headersTimeout must be strictly greater than keepAliveTimeout.
httpServer.timeout = 12 * 60 * 1000; // 12 min request timeout
httpServer.keepAliveTimeout = 65 * 1000; // 65 s keep-alive (> nginx default 60s)
httpServer.headersTimeout = 66 * 1000; // must be > keepAliveTimeout

try {
  initRealtime(httpServer);
} catch (err) {
  logger.warn(
    { err },
    "WebSocket init failed — Redis may not be available, continuing without realtime",
  );
}

const localSafeMode =
  process.env["LOCAL_SAFE_MODE"] === "true" &&
  process.env["NODE_ENV"] !== "production";

if (!localSafeMode) {
  try {
    getQueue(QUEUE_NAMES.CAMPAIGN_ORCHESTRATION);
    getQueue(QUEUE_NAMES.AGENT_EXECUTION);
    getQueue(QUEUE_NAMES.CONTENT_GENERATION);
    logger.info("Job queues initialized");
  } catch (err) {
    logger.warn(
      { err },
      "Queue init failed — Redis may not be available, continuing without queues",
    );
  }
}

// ── Boot cleanup: recover orphaned campaigns before accepting any requests ────
// RC-007 FIX: All cleanup operations are awaited via Promise.all() before
// httpServer.listen() is called, ensuring a consistent state on boot.
//
// Cleanup order:
//   1. Mark only conclusively stale running agents as failed.
//   2. Recover stale generating campaigns from their checkpoints.
//   3. Reset campaigns stuck in "analyzing" → "intake".
//
// This process can be one of several API instances.  Queue jobs have no
// instance-owner field, so boot must never drain them: a job may be owned by a
// healthy sibling.  In particular, failed jobs are retained as audit evidence.
// Agent rows do have started_at; 30 minutes is safely beyond the 12-minute HTTP
// timeout and normal 5–10 minute AI call, so it is the only destructive recovery
// performed here.
const bootRecoveryCutoff = new Date(Date.now() - 30 * 60 * 1000);

async function startBackgroundServices(): Promise<void> {
  initOrchestrationWorker();
  startSocialScheduler();
  startMetricsSyncScheduler(async () =>
    db
      .select({
        id: socialPostsTable.id,
        workspaceId: socialPostsTable.workspaceId,
      })
      .from(socialPostsTable)
      .where(eq(socialPostsTable.status, "published")),
  );
  startPaidMediaScheduler();
  await initSequenceScheduler();
  startLifecycleScheduler();
  startFunnelScheduler();
  startApprovalSlaScheduler();
}

function scheduleRecordingOrganizationSweep(): void {
  setImmediate(() => {
    void organizeAllWorkspaceRecordings()
      .then((result) =>
        logger.info(result, "Recording folders organized for all workspaces"),
      )
      .catch((err) =>
        logger.error({ err }, "Recording folder organization sweep failed"),
      );
  });
}

if (localSafeMode) {
  logger.warn(
    "LOCAL_SAFE_MODE enabled — boot recovery and background schedulers are disabled",
  );
  httpServer.listen(port, () => {
    logger.info({ port }, "NexOS AI API Server listening in local safe mode");
  });
} else {
  Promise.all([
    db
      .update(campaignAgentsTable)
      .set({
        status: "failed",
        errorMessage: "Servidor reiniciado — execução interrompida",
        completedAt: new Date(),
      })
      .where(
        and(
          eq(campaignAgentsTable.status, "running"),
          lt(campaignAgentsTable.startedAt, bootRecoveryCutoff),
        ),
      )
      .then((result) => {
        if (result.rowCount && result.rowCount > 0) {
          logger.error(
            { count: result.rowCount, staleBefore: bootRecoveryCutoff },
            "Boot cleanup: marked stale running agents as failed",
          );
        }
      })
      .catch((err) => logger.error({ err }, "Boot cleanup (agents) failed")),

    // NOTE: "generating" campaigns are NOT reset here — they will be re-enqueued
    // below (after agents are marked failed) so content generation resumes from
    // the last checkpoint saved in contentPiecesTable.

    // Only abandoned OAuth debris with an identical logical identity is removed.
    // The typed service uses the canonical purpose classifier, which distinguishes
    // legacy organic Meta Pages from paid-media credentials.
    cleanupDisconnectedIntegrationDuplicates()
      .then((count) => {
        if (count > 0) {
          logger.error(
            { count },
            "Boot cleanup: removed duplicate workspace_integrations rows",
          );
        }
      })
      .catch((err) =>
        logger.error({ err }, "Boot cleanup (integration dedup) failed"),
      ),

    // RC-FIX: Only reset campaigns stuck in "analyzing" for > 30 min.
    // Campaigns that JUST transitioned (e.g. fresh finalize before a restart) must NOT be reset,
    // or the user loses their work silently. 30 min is enough time for any real strategy run.
    db
      .update(campaignsTable)
      .set({ status: "intake", updatedAt: new Date() })
      .where(
        and(
          eq(campaignsTable.status, "analyzing"),
          lt(campaignsTable.updatedAt, new Date(Date.now() - 30 * 60 * 1000)),
        ),
      )
      .then((result) => {
        if (result.rowCount && result.rowCount > 0) {
          logger.error(
            { count: result.rowCount },
            "Boot cleanup: reset analyzing campaigns to intake",
          );
        }
      })
      .catch((err) =>
        logger.error({ err }, "Boot cleanup (analyzing reset) failed"),
      ),
  ])
    .then(async () => {
      // Stale recovery is deliberately complete before explicit resume. Queue state
      // remains untouched, and resume itself excludes campaigns with a fresh agent.
      await resumeGeneratingCampaigns(bootRecoveryCutoff);
      await recoverStudioRenders(logger);

      // Do not begin consuming jobs until stale recovery has finished. Starting
      // workers above would let a second instance race its own boot checks.
      await startBackgroundServices();

      httpServer.listen(port, (err?: Error) => {
        if (err) {
          logger.error({ err }, "Error listening on port");
          process.exit(1);
        }
        logger.info({ port }, "NexOS AI API Server listening");
        scheduleRecordingOrganizationSweep();
        startRegionalAcquisitionScheduler();
      });
    })
    .catch(async (err) => {
      logger.error(
        { err },
        "Boot cleanup failed — starting server anyway to avoid complete outage",
      );
      await startBackgroundServices().catch((serviceErr) =>
        logger.error(
          { err: serviceErr },
          "Background service startup failed after cleanup error",
        ),
      );
      httpServer.listen(port, () => {
        logger.info({ port }, "NexOS AI API Server listening (cleanup failed)");
        scheduleRecordingOrganizationSweep();
        startRegionalAcquisitionScheduler();
      });
    });
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutdown signal received");

  const forcedExit = setTimeout(() => {
    logger.fatal({ signal }, "Graceful shutdown timed out");
    process.exit(1);
  }, 10_000);
  forcedExit.unref();

  const httpClosed = new Promise<void>((resolve) => {
    httpServer.close((err) => {
      if (
        err &&
        (err as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING"
      ) {
        logger.error({ err }, "HTTP server close failed");
      }
      resolve();
    });
  });

  stopSocialScheduler();
  stopMetricsSyncScheduler();
  stopRegionalAcquisitionScheduler();
  stopLifecycleScheduler();
  stopApprovalSlaScheduler();
  stopPaidMediaScheduler();
  stopFunnelScheduler();

  // Let accepted HTTP requests and active workers finish before closing the
  // queues and database they may still need during their final operations.
  const drainResults = await Promise.allSettled([
    closeSequenceScheduler(),
    closeOrchestrationWorker(),
    httpClosed,
  ]);
  const resourceResults = await Promise.allSettled([closeAllQueues(), pool.end()]);
  const rejected = [...drainResults, ...resourceResults].filter(
    (result) => result.status === "rejected",
  );
  if (rejected.length > 0) {
    logger.error({ rejected }, "One or more resources failed to close cleanly");
  }

  clearTimeout(forcedExit);
  logger.info("Graceful shutdown completed");
  process.exit(signal === "SIGTERM" || signal === "SIGINT" ? 0 : 1);
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
