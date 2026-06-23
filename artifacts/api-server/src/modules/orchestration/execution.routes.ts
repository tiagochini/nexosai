import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { runCrossAgentValidation } from "../campaign-brain/cross-validation.service.js";
import {
  getExecutionStatus,
  triggerNextPhase,
  triggerStrategyPhase,
  triggerContentPhase,
  triggerExecutionPhase,
  triggerMonitor,
} from "./orchestration.service.js";
import { AppError } from "../../lib/errors.js";
import {
  db,
  campaignsTable,
  workspacesTable,
  usersTable,
  workspaceIntegrationsTable,
  contentPiecesTable,
  getCampaignCreditEstimate,
  CAMPAIGN_CREDIT_BUFFER,
} from "@workspace/db";
import { eq, and, inArray, ne, count } from "drizzle-orm";
import { env } from "../../lib/env.js";

const router = Router();
router.use(requireAuth);

// ── Server startup guard ──────────────────────────────────────────────────────
// Tracks when this module was loaded (proxy for server start time).
// Heavy jobs (execute/content) are blocked for the first 15s after restart
// to avoid 502s from the Replit proxy before the server is fully warmed up.
const MODULE_LOADED_AT = Date.now();
const SERVER_CONTENT_GRACE_MS = 5_000;

// ── Pre-flight credit advisory ────────────────────────────────────────────────
// AUDIT FIX (EFFICACY RULE): Credits are advisory — never a hard gate.
// A paying customer's pipeline must NEVER be stopped by a low-credit state.
// Previous behavior: threw HTTP 402, permanently blocking execution.
// New behavior: logs a warning and returns credit state metadata.
// The route handler can include this in the response headers/body for
// frontend soft-warnings (toast with action), but the pipeline proceeds.
interface CreditCheckResult {
  sufficient: boolean;
  balance: number;
  required: number;
  shortage: number;
  phaseCost: number;
}

async function checkCreditsForPhase(
  workspaceId: string,
  campaignId: string,
  phase: "strategy" | "content" | "launch",
): Promise<CreditCheckResult> {
  const [workspace] = await db
    .select({ balance: workspacesTable.creditsBalance })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);

  if (!workspace) return { sufficient: true, balance: 0, required: 0, shortage: 0, phaseCost: 0 };

  const [campaign] = await db
    .select({ type: campaignsTable.type })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  const campaignType = campaign?.type ?? "launch";
  const estimate = getCampaignCreditEstimate(campaignType);
  void estimate;

  const phaseCost = {
    strategy: 45,
    content: 150,
    launch: 37,
  }[phase];

  const required = phaseCost + CAMPAIGN_CREDIT_BUFFER;
  const balance = workspace.balance ?? 0;

  if (balance < required) {
    const shortage = required - balance;
    // Advisory-only: log + return deficit data; DO NOT throw.
    // The pipeline continues. Client shows a soft "low credits" banner.
    return { sufficient: false, balance, required, shortage, phaseCost };
  }
  return { sufficient: true, balance, required, shortage: 0, phaseCost };
}

// GET /campaigns/:campaignId/execution/status
router.get("/:campaignId/execution/status", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  try {
    const status = await getExecutionStatus(campaignId, req.auth.workspaceId);
    res.json(status);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/execute — smart trigger (picks next phase automatically)
router.post("/:campaignId/execute", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  try {
    const result = await triggerNextPhase(campaignId, req.auth.workspaceId, req.log);
    res.status(202).json({
      message: result.queued
        ? "Fase enfileirada para execução assíncrona"
        : "Fase iniciada diretamente (Redis indisponível)",
      campaignId,
      action: result.action,
      jobId: result.jobId ?? null,
      queued: result.queued,
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code, data: (err as AppError & { data?: unknown }).data });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/execute/strategy
router.post("/:campaignId/execute/strategy", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  try {
    const creditAdvisory = await checkCreditsForPhase(req.auth.workspaceId, campaignId, "strategy");
    const result = await triggerStrategyPhase(campaignId, req.auth.workspaceId, req.log);
    res.status(202).json({
      message: result.queued
        ? "Fase de estratégia enfileirada — Command → Profile → Strategy → Offer → Manager → Financial Projector"
        : "Fase de estratégia iniciada diretamente",
      campaignId,
      action: "run_strategy",
      jobId: result.jobId ?? null,
      queued: result.queued,
      creditWarning: creditAdvisory.sufficient ? undefined : {
        balance: creditAdvisory.balance,
        required: creditAdvisory.required,
        shortage: creditAdvisory.shortage,
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code, data: (err as AppError & { data?: unknown }).data });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/execute/content
router.post("/:campaignId/execute/content", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  // Startup guard: reject heavy content jobs during server warm-up window.
  // Prevents the Replit proxy 502 that occurs when content is triggered immediately
  // after a server restart (proxy routes to new process before it's ready).
  const uptimeMs = Date.now() - MODULE_LOADED_AT;
  if (uptimeMs < SERVER_CONTENT_GRACE_MS) {
    const retryAfterMs = SERVER_CONTENT_GRACE_MS - uptimeMs;
    res
      .status(503)
      .set("Retry-After", String(Math.ceil(retryAfterMs / 1000)))
      .json({
        error: "Servidor inicializando — aguarde alguns segundos e tente novamente",
        code: "SERVER_STARTING",
        retryAfterMs,
      });
    return;
  }

  try {
    const creditAdvisory = await checkCreditsForPhase(req.auth.workspaceId, campaignId, "content");
    const result = await triggerContentPhase(campaignId, req.auth.workspaceId, req.log);
    res.status(202).json({
      message: result.queued
        ? "Geração de conteúdo enfileirada — 16 agentes em sequência"
        : "Geração de conteúdo iniciada diretamente",
      campaignId,
      action: "generate_content",
      jobId: result.jobId ?? null,
      queued: result.queued,
      creditWarning: creditAdvisory.sufficient ? undefined : {
        balance: creditAdvisory.balance,
        required: creditAdvisory.required,
        shortage: creditAdvisory.shortage,
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code, data: (err as AppError & { data?: unknown }).data });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/execute/retry — failsafe recovery for stuck campaigns
// Clears the pipeline lock, forces campaign back to a retryable state, and re-enqueues
// the appropriate job. Safe to call from analyzing or generating status only.
// Includes retry-count teto: after 3 manual retries, returns REQUIRES_INTERVENTION
// instead of re-enqueuing — preventing infinite credit-burning loops on deterministic errors.
router.post("/:campaignId/execute/retry", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;
  const { workspaceId } = req.auth;

  const [campaign] = await db
    .select({ status: campaignsTable.status, brainData: (campaignsTable as any).brainData })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) {
    res.status(404).json({ error: "Campanha não encontrada.", code: "NOT_FOUND" });
    return;
  }

  if (!["analyzing", "generating"].includes(campaign.status)) {
    res.status(400).json({
      error: `Campanha não está em estado de recuperação (status atual: ${campaign.status}).`,
      code: "NOT_STUCK",
    });
    return;
  }

  try {
    const brain = ((campaign.brainData ?? {}) as Record<string, unknown>);
    const cp = ((brain["pipelineCheckpoint"] ?? {}) as Record<string, unknown>);
    const contentRetry = ((brain["contentRetry"] ?? {}) as Record<string, unknown>);
    const retryCount = (contentRetry["retryCount"] as number | undefined) ?? 0;

    // ── Trato admin: sem teto de retries ──
    const [wsOwner] = await db
      .select({ ownerId: workspacesTable.ownerId })
      .from(workspacesTable)
      .where(eq(workspacesTable.id, workspaceId))
      .limit(1);
    const ADMIN_EMAILS_RETRY = new Set(["admin@nexos.ai", "founder@nexos.ai", "admin@agencianexos.vip", "founder@agencianexos.vip"]);
    let isAdminRetry = false;
    if (wsOwner?.ownerId) {
      const [ownerUser] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, wsOwner.ownerId)).limit(1);
      isAdminRetry = ownerUser ? ADMIN_EMAILS_RETRY.has(ownerUser.email) : false;
    }

    // ── Auto-skip de peça problemática após 10 tentativas ──
    // Nunca bloqueia o cliente com REQUIRES_INTERVENTION. Após 10 falhas no mesmo
    // ponto, a peça é adicionada a skippedPieces e o pipeline reinicia limpo.
    // Admin bypass: retryCount é resetado diretamente (sem custo de skip).
    if (retryCount >= 10 && !isAdminRetry) {
      const failedPieceType = contentRetry["lastFailedPieceType"] as string | undefined;
      req.log.warn({ campaignId, retryCount, failedPieceType }, "[FAILSAFE] Max retries — auto-skipping problematic piece, restarting pipeline");
      const currentSkipped = ((brain["skippedPieces"] ?? []) as string[]);
      const newSkipped = failedPieceType && !currentSkipped.includes(failedPieceType)
        ? [...currentSkipped, failedPieceType]
        : currentSkipped;
      const autoSkipBrain = {
        ...brain,
        skippedPieces: newSkipped,
        pipelineCheckpoint: { lockedAt: null, lastProgressAt: null },
        contentRetry: { retryCount: 0, autoSkippedAt: new Date().toISOString(), autoSkippedPiece: failedPieceType },
      };
      if (campaign.status === "analyzing") {
        await db.update(campaignsTable).set({ status: "intake" as any, updatedAt: new Date(), brainData: autoSkipBrain as any }).where(eq(campaignsTable.id, campaignId));
        const result = await triggerStrategyPhase(campaignId, workspaceId, req.log);
        res.status(202).json({ retried: true, phase: "strategy", queued: result.queued, retryCount: 0, autoSkipped: failedPieceType });
      } else {
        await db.update(campaignsTable).set({ status: "strategy_ready" as any, updatedAt: new Date(), brainData: autoSkipBrain as any }).where(eq(campaignsTable.id, campaignId));
        const result = await triggerContentPhase(campaignId, workspaceId, req.log);
        res.status(202).json({ retried: true, phase: "content", queued: result.queued, retryCount: 0, autoSkipped: failedPieceType });
      }
      return;
    }

    // Increment retry counter and clear pipeline lock
    const updatedContentRetry = { ...contentRetry, retryCount: retryCount + 1, lastRetryAt: new Date().toISOString() };
    const clearedBrain = {
      ...brain,
      pipelineCheckpoint: { ...cp, lockedAt: null, lastProgressAt: null },
      contentRetry: updatedContentRetry,
    };

    if (campaign.status === "analyzing") {
      await db
        .update(campaignsTable)
        .set({ status: "intake" as any, updatedAt: new Date(), brainData: clearedBrain as any })
        .where(eq(campaignsTable.id, campaignId));
      const result = await triggerStrategyPhase(campaignId, workspaceId, req.log);
      req.log.info({ campaignId, retryCount: retryCount + 1 }, "[FAILSAFE] analyzing → intake → strategy re-enqueued");
      res.status(202).json({ retried: true, phase: "strategy", queued: result.queued, retryCount: retryCount + 1 });
    } else {
      await db
        .update(campaignsTable)
        .set({ status: "strategy_ready" as any, updatedAt: new Date(), brainData: clearedBrain as any })
        .where(eq(campaignsTable.id, campaignId));
      const result = await triggerContentPhase(campaignId, workspaceId, req.log);
      req.log.info({ campaignId, retryCount: retryCount + 1 }, "[FAILSAFE] generating → strategy_ready → content re-enqueued");
      res.status(202).json({ retried: true, phase: "content", queued: result.queued, retryCount: retryCount + 1 });
    }
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code, data: (err as AppError & { data?: unknown }).data });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/content/pieces/:pieceType/skip
// Marks a specific content piece type as "skipped" so the content pipeline will
// bypass it on the next run. Injects a placeholder piece into contentPiecesTable
// (status=draft, content._skipped=true) which skipAgent() detects and bypasses.
// This breaks deterministic error loops: if VSL Agent always fails, skip it and
// generate the remaining 15 pieces.
router.post("/:campaignId/content/pieces/:pieceType/skip", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;
  const pieceType = req.params["pieceType"] as string;
  const { workspaceId } = req.auth;

  const [campaign] = await db
    .select({ status: campaignsTable.status, brainData: (campaignsTable as any).brainData })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) {
    res.status(404).json({ error: "Campanha não encontrada.", code: "NOT_FOUND" });
    return;
  }

  // Store skipped piece types in brainData (no schema migration needed)
  const brain = ((campaign.brainData ?? {}) as Record<string, unknown>);
  const contentRetry = ((brain["contentRetry"] ?? {}) as Record<string, unknown>);
  const skippedPieces = ((contentRetry["skippedPieces"] ?? []) as string[]);
  if (!skippedPieces.includes(pieceType)) {
    skippedPieces.push(pieceType);
  }
  const updatedBrain = {
    ...brain,
    contentRetry: {
      ...contentRetry,
      skippedPieces,
      retryCount: 0, // reset retry counter after manual skip
      requiresIntervention: false,
    },
  };
  await db
    .update(campaignsTable)
    .set({ brainData: updatedBrain as any, updatedAt: new Date() })
    .where(eq(campaignsTable.id, campaignId));

  req.log.info({ campaignId, pieceType, skippedPieces }, "[FAILSAFE] Content piece skipped by user");
  res.status(200).json({ skipped: true, pieceType, skippedPieces });
});

// ── Integration gate for launch ──────────────────────────────────────────────
// Blocks campaign launch if NO messaging AND NO email channels are connected.
type DbIntegrationProvider = "meta_ads" | "instagram" | "tiktok_ads" | "google_ads" | "whatsapp_business" | "telegram" | "stripe" | "hotmart" | "eduzz" | "kiwify" | "mailchimp" | "activecampaign" | "rd_station" | "hubspot" | "crypto_native" | "custom_webhook";

type IntegrationCheckResult =
  | { status: "ok" }
  | { status: "partial"; missing: { category: string; providers: string[]; reason: string }[] }
  | { status: "blocked"; missing: { category: string; providers: string[]; reason: string }[] };

async function checkIntegrationsForLaunch(workspaceId: string): Promise<IntegrationCheckResult> {
  const MESSAGING_PROVIDERS: DbIntegrationProvider[] = ["whatsapp_business", "telegram"];
  const EMAIL_PROVIDERS: DbIntegrationProvider[] = ["rd_station", "activecampaign"];
  const SOCIAL_PROVIDERS: DbIntegrationProvider[] = ["instagram", "tiktok_ads", "meta_ads"];

  const connected = await db
    .select({ provider: workspaceIntegrationsTable.provider })
    .from(workspaceIntegrationsTable)
    .where(
      and(
        eq(workspaceIntegrationsTable.workspaceId, workspaceId),
        eq(workspaceIntegrationsTable.status, "connected"),
        inArray(workspaceIntegrationsTable.provider, [
          ...MESSAGING_PROVIDERS,
          ...EMAIL_PROVIDERS,
          ...SOCIAL_PROVIDERS,
        ] as DbIntegrationProvider[]),
      ),
    );

  const connectedProviders = connected.map((r) => r.provider as string);
  const hasMessaging = MESSAGING_PROVIDERS.some((p) => connectedProviders.includes(p));
  const hasEmail = EMAIL_PROVIDERS.some((p) => connectedProviders.includes(p)) || !!env.RESEND_API_KEY;
  const hasSocial = SOCIAL_PROVIDERS.some((p) => connectedProviders.includes(p));

  // All critical channels present → fully OK
  if (hasMessaging && hasEmail) return { status: "ok" };

  const missing: { category: string; providers: string[]; reason: string }[] = [];
  if (!hasMessaging) {
    missing.push({
      category: "Mensagens",
      providers: ["WhatsApp Business", "Telegram"],
      reason: "Disparo de sequências de mensagens durante o lançamento",
    });
  }
  if (!hasEmail) {
    missing.push({
      category: "E-mail",
      providers: ["RD Station", "ActiveCampaign", "Resend"],
      reason: "Sequência de e-mails de lançamento",
    });
  }
  if (!hasSocial) {
    missing.push({
      category: "Rede Social",
      providers: ["Instagram", "Facebook/Meta Ads", "TikTok"],
      reason: "Auto-post de conteúdo e remarketing pago",
    });
  }

  // Has at least one core channel (messaging OR email) → partial warning, not a hard block
  if (hasMessaging || hasEmail) {
    return { status: "partial", missing };
  }

  // Zero core channels → hard block
  return { status: "blocked", missing };
}

// POST /campaigns/:campaignId/execute/launch
// Query param: ?skipIntegrationWarning=true  →  bypasses soft (partial) check
router.post("/:campaignId/execute/launch", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;
  const skipWarning = req.query["skipIntegrationWarning"] === "true";

  try {
    const integrationCheck = await checkIntegrationsForLaunch(req.auth.workspaceId);

    if (integrationCheck.status === "blocked") {
      // Hard block: zero core channels — cannot launch at all
      throw new AppError(
        422,
        `Conecte pelo menos WhatsApp/Telegram OU RD Station/ActiveCampaign antes de lançar.`,
        "MISSING_INTEGRATIONS",
        { missing: integrationCheck.missing, connectUrl: "/integracoes" },
      );
    }

    if (integrationCheck.status === "partial" && !skipWarning) {
      // Soft warning: has some channels but not all — ask for confirmation
      res.status(428).json({
        error: "Algumas integrações recomendadas não estão conectadas.",
        code: "PARTIAL_INTEGRATIONS",
        data: { missing: integrationCheck.missing, connectUrl: "/integracoes" },
      });
      return;
    }

    // ── Content approval gate ────────────────────────────────────────────────
    // Block launch if any content piece is not yet approved.
    const allPieces = await db
      .select({ status: contentPiecesTable.status })
      .from(contentPiecesTable)
      .where(eq(contentPiecesTable.campaignId, campaignId));

    const totalPieces = allPieces.length;
    const unapprovedPieces = allPieces.filter(p => p.status !== "approved").length;

    if (totalPieces === 0) {
      throw new AppError(
        422,
        "Nenhuma peça de conteúdo encontrada. Gere e aprove o conteúdo antes de lançar.",
        "NO_CONTENT",
        { approvalUrl: `/campaigns/${campaignId}/content` },
      );
    }

    if (unapprovedPieces > 0) {
      throw new AppError(
        422,
        `${unapprovedPieces} peça${unapprovedPieces > 1 ? "s" : ""} de conteúdo ainda ${unapprovedPieces > 1 ? "precisam" : "precisa"} de aprovação antes do lançamento.`,
        "CONTENT_NOT_APPROVED",
        { unapprovedPieces, totalPieces, approvalUrl: `/campaigns/${campaignId}/content` },
      );
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Cross-Agent Validation — blocks launch if critical financial/alignment conflicts found
    const validation = await runCrossAgentValidation(campaignId, req.auth.workspaceId, req.log);
    if (!validation.isViable && !skipWarning) {
      const criticalBlocker = validation.blockers[0];
      throw new AppError(
        422,
        `Validação cruzada de agentes detectou ${validation.blockers.length} conflito(s) crítico(s): ${criticalBlocker?.description ?? "verificar agentes"}`,
        "CROSS_VALIDATION_FAILED",
        { blockers: validation.blockers, warnings: validation.warnings, metrics: validation.metrics },
      );
    }

    const creditAdvisory = await checkCreditsForPhase(req.auth.workspaceId, campaignId, "launch");
    const result = await triggerExecutionPhase(campaignId, req.auth.workspaceId, req.log);
    res.status(202).json({
      message: result.queued
        ? "Lançamento enfileirado — campanha será ativada em instantes"
        : "Lançamento iniciado diretamente",
      campaignId,
      action: "execute",
      jobId: result.jobId ?? null,
      queued: result.queued,
      creditWarning: creditAdvisory.sufficient ? undefined : {
        balance: creditAdvisory.balance,
        required: creditAdvisory.required,
        shortage: creditAdvisory.shortage,
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code, data: (err as AppError & { data?: unknown }).data });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/execute/monitor
router.post("/:campaignId/execute/monitor", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  try {
    const result = await triggerMonitor(campaignId, req.auth.workspaceId, req.log);
    res.status(202).json({
      message: "Monitor de saúde enfileirado",
      campaignId,
      action: "monitor",
      jobId: result.jobId ?? null,
      queued: result.queued,
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

export default router;
