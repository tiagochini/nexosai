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
import { resumeGeneratingCampaigns } from "./modules/orchestration/orchestration.service.js";
import { startSocialScheduler, startMetricsSyncScheduler, stopSocialScheduler, stopMetricsSyncScheduler } from "./modules/social/social.worker.js";
import { startPaidMediaScheduler, stopPaidMediaScheduler } from "./modules/paid-media/paid-media.worker.js";
import { initSequenceScheduler, closeSequenceScheduler } from "./modules/launch-sequence/sequence-scheduler.worker.js";
import { startLifecycleScheduler, stopLifecycleScheduler } from "./modules/lifecycle/lifecycle.worker.js";
import { startFunnelScheduler } from "./modules/academy/academy-funnel.service.js";
import { startRegionalAcquisitionScheduler, stopRegionalAcquisitionScheduler } from "./modules/market-intel/regional-acquisition.service.js";
import { cleanupDisconnectedIntegrationDuplicates } from "./modules/integrations/integration-cleanup.service.js";
import { recoverStudioRenders } from "./modules/video-editor/audiovisual-studio.service.js";
import { organizeAllWorkspaceRecordings } from "./modules/recording/recording.service.js";
import { db, campaignAgentsTable, campaignsTable, socialPresencePostsTable, socialPresenceConfigTable, socialPostsTable } from "@workspace/db";
import { eq, and, lt, sql as sqlRaw, like, inArray } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// [P1] BUILD_TAG — timestamp estático gravado no momento da compilação.
// Visível nos logs de produção (nível ERROR flui). Prova qual binário está rodando.
logger.info({ buildTag: "NEXOS_VIDEO_STORAGE_V1", builtAt: "2026-08-13T20:10:22Z" }, "[BUILD_TAG] api-server booting");

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

// ── C0.6.2 TEMP — log DB host at boot (never logs password) ──────────────────
try {
  const dbUrl = new URL(process.env["DATABASE_URL"] ?? "");
  logger.info({ "[C0.6.2]": true, dbHost: dbUrl.hostname, dbName: dbUrl.pathname, dbUser: dbUrl.username }, "Boot DB connection info");
} catch { /* noop */ }
// ─────────────────────────────────────────────────────────────────────────────

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
startMetricsSyncScheduler(async () => db
  .select({ id: socialPostsTable.id, workspaceId: socialPostsTable.workspaceId })
  .from(socialPostsTable)
  .where(eq(socialPostsTable.status, "published")));
  startPaidMediaScheduler();
  await initSequenceScheduler();
  startLifecycleScheduler();
  startFunnelScheduler();
}

function scheduleRecordingOrganizationSweep(): void {
  setImmediate(() => {
    void organizeAllWorkspaceRecordings()
      .then((result) => logger.info(result, "Recording folders organized for all workspaces"))
      .catch((err) => logger.error({ err }, "Recording folder organization sweep failed"));
  });
}

Promise.all([
  db.update(campaignAgentsTable)
    .set({
      status: "failed",
      errorMessage: "Servidor reiniciado — execução interrompida",
      completedAt: new Date(),
    })
    .where(and(
      eq(campaignAgentsTable.status, "running"),
      lt(campaignAgentsTable.startedAt, bootRecoveryCutoff),
    ))
    .then((result) => {
      if (result.rowCount && result.rowCount > 0) {
        logger.error({ count: result.rowCount, staleBefore: bootRecoveryCutoff }, "Boot cleanup: marked stale running agents as failed");
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
        logger.error({ count }, "Boot cleanup: removed duplicate workspace_integrations rows");
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
        logger.error({ count: result.rowCount }, "Boot cleanup: cleared NexOS placeholder business_context from social_presence_config");
      }
    })
    .catch((err) => logger.error({ err }, "Boot cleanup (presence business_context) failed")),

  // HEYGEN-FIX: Clear stale/invalid heygenAvatarId values from workspace persona settings.
  // v3 API requer look UUIDs (ex: "f29d5ce5-..."). IDs no formato v2 legado
  // ("Name_style_YYYYMMDD") são rejeitados com 400 e devem ser limpos para forçar
  // o usuário a reselecionar da lista v3 atualizada. Regex cobre o padrão: Word_word_8digits.
  db.execute(sqlRaw`
    UPDATE workspaces
    SET settings = settings #- '{persona,heygenAvatarId}'
    WHERE settings->'persona'->>'heygenAvatarId' ~ '^[A-Za-z][A-Za-z0-9]*[-_][A-Za-z][A-Za-z0-9]*[-_][0-9]{8}$'
       OR settings->'persona'->>'heygenAvatarId' IN (
         'Daisy-inskirt-20220818',
         'Kayla-inblackskirt-20220818',
         'Tyler-incasualsuit-20220721'
       )
  `)
    .then((result) => {
      if (result.rowCount && result.rowCount > 0) {
        logger.error({ count: result.rowCount }, "Boot cleanup: cleared legacy v2 HeyGen avatar IDs — users must re-select from v3 catalog");
      }
    })
    .catch((err) => logger.error({ err }, "Boot cleanup (heygen avatar) failed")),

  // HEYGEN-FIX: Reset social presence posts bloqueados por avatar v2 inválido.
  // Posts com storyboard pronto mas falha na geração de vídeo (avatar rejeitado pelo v3)
  // são resetados para storyboard_ready + scheduled para nova tentativa automática.
  db.execute(sqlRaw`
    UPDATE social_presence_posts
    SET
      media_gen_status = 'storyboard_ready',
      status           = 'scheduled',
      error_message    = 'Avatar anterior inválido foi atualizado — selecione um novo avatar em Configurações → Persona para gerar o vídeo automaticamente.',
      updated_at       = NOW()
    WHERE (
        error_message LIKE '%Daisy-inskirt%'
     OR error_message LIKE '%avatar not found%'
     OR error_message LIKE '%does not support Avatar IV%'
     OR error_message LIKE '%Unable to extract tag%'
     OR error_message LIKE '%HeyGen API error 400%'
     OR error_message LIKE '%HeyGen API error 404%'
    )
      AND format IN ('reel', 'feed_video', 'story')
      AND status NOT IN ('published', 'failed')
      AND media_gen_status IN ('failed', 'storyboard_ready', 'storyboard_draft')
  `)
    .then((result) => {
      if (result.rowCount && result.rowCount > 0) {
        logger.error({ count: result.rowCount }, "Boot cleanup: reset social presence posts blocked by invalid HeyGen avatar");
      }
    })
    .catch((err) => logger.error({ err }, "Boot cleanup (heygen posts reset) failed")),

  // ONE-TIME PERSONA FIX — workspace 21aa4337: aponta para grupo 307779b4 (consent_status:accepted)
  // ao invés de 46f9eeb3 (consent_status:pending). Idempotente: só roda se o valor antigo ainda estiver presente.
  // DD4: async IIFE para sequenciar diagnóstico pré-UPDATE antes do UPDATE. Todos os logs em logger.error
  // para garantir visibilidade nos logs de produção independente do log level configurado.
  (async () => {
    // DD4-DIAGNÓSTICO: expõe o valor real da persona no banco no momento exato do boot
    const diag = await db.execute(sqlRaw`
      SELECT settings->'persona'->>'heygenAvatarId' AS avatar_id,
             settings->'persona'->>'digitalTwinId'  AS twin_id,
             settings->'persona'->>'heygenVoiceId'  AS voice_id
      FROM workspaces WHERE id = '21aa4337-82db-4671-bd8c-acdbeb9f6495'
    `);
    logger.info({ personaNoBoot: diag.rows[0] }, "[PERSONA-FIX] Diagnóstico pré-UPDATE");

    const result = await db.execute(sqlRaw`
      UPDATE workspaces
      SET settings = jsonb_set(
        jsonb_set(
          jsonb_set(
            settings,
            '{persona,heygenAvatarId}',
            '"5279d1ea433e4b9f8715a1b58c811260"'
          ),
          '{persona,digitalTwinId}',
          '"307779b4e7094592b1478ed72fc8ecdf"'
        ),
        '{persona,heygenVoiceId}',
        '"6b7a93651c2b45958dc220e11a71b505"'
      )
      WHERE id = '21aa4337-82db-4671-bd8c-acdbeb9f6495'
        AND settings->'persona'->>'heygenAvatarId' = '7ecb72e295624b20b6b14ad98148744a'
    `);
    if (result.rowCount && result.rowCount > 0) {
      logger.error({ workspaceId: "21aa4337", newAvatarId: "5279d1ea433e4b9f8715a1b58c811260", newGroupId: "307779b4e7094592b1478ed72fc8ecdf", newVoiceId: "6b7a93651c2b45958dc220e11a71b505" }, "[PERSONA-FIX] Persona atualizada para grupo com consent_status:accepted ✓");
    } else {
      logger.info({ workspaceId: "21aa4337" }, "[PERSONA-FIX] Sem alteração — valor já atualizado ou workspace não encontrado");
    }
  })().catch((err) => logger.error({ err }, "Boot cleanup (persona fix) failed")),

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
        logger.error({ count: result.rowCount }, "Boot cleanup: reset analyzing campaigns to intake");
      }
    })
    .catch((err) => logger.error({ err }, "Boot cleanup (analyzing reset) failed")),
]).then(async () => {
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
}).catch(async (err) => {
  logger.error({ err }, "Boot cleanup failed — starting server anyway to avoid complete outage");
  await startBackgroundServices().catch((serviceErr) =>
    logger.error({ err: serviceErr }, "Background service startup failed after cleanup error"),
  );
  httpServer.listen(port, () => {
    logger.info({ port }, "NexOS AI API Server listening (cleanup failed)");
    scheduleRecordingOrganizationSweep();
    startRegionalAcquisitionScheduler();
  });
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutdown signal received");
  stopSocialScheduler();
  stopMetricsSyncScheduler();
  stopRegionalAcquisitionScheduler();
  await closeSequenceScheduler();
  stopLifecycleScheduler();
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
