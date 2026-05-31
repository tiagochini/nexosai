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
  workspaceIntegrationsTable,
  getCampaignCreditEstimate,
  CAMPAIGN_CREDIT_BUFFER,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { env } from "../../lib/env.js";

const router = Router();
router.use(requireAuth);

// ── Server startup guard ──────────────────────────────────────────────────────
// Tracks when this module was loaded (proxy for server start time).
// Heavy jobs (execute/content) are blocked for the first 15s after restart
// to avoid 502s from the Replit proxy before the server is fully warmed up.
const MODULE_LOADED_AT = Date.now();
const SERVER_CONTENT_GRACE_MS = 15_000;

// ── Pre-flight credit check ───────────────────────────────────────────────────
// Returns the credits needed for a phase; throws 402 if balance insufficient.
async function checkCreditsForPhase(
  workspaceId: string,
  campaignId: string,
  phase: "strategy" | "content" | "launch",
): Promise<void> {
  const [workspace] = await db
    .select({ balance: workspacesTable.creditsBalance })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);

  if (!workspace) return;

  const [campaign] = await db
    .select({ type: campaignsTable.type })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  const campaignType = campaign?.type ?? "launch";
  const estimate = getCampaignCreditEstimate(campaignType);

  const phaseCost = {
    strategy: 45,
    content: 150,
    launch: 37,
  }[phase];

  // Require phase cost + buffer (next campaign headroom)
  const required = phaseCost + CAMPAIGN_CREDIT_BUFFER;
  const balance = workspace.balance ?? 0;

  if (balance < required) {
    const shortage = required - balance;
    throw new AppError(
      402,
      `Créditos insuficientes para iniciar esta fase. ` +
        `Saldo atual: ${balance} cr. ` +
        `Necessário: ${required} cr (${phaseCost} para a fase + ${CAMPAIGN_CREDIT_BUFFER} de reserva). ` +
        `Compre mais ${shortage} crédito${shortage !== 1 ? "s" : ""} para continuar.`,
      "INSUFFICIENT_CREDITS",
      {
        balance,
        required,
        phaseCost,
        buffer: CAMPAIGN_CREDIT_BUFFER,
        shortage,
        campaignType,
        estimatedTotal: estimate.typical,
      },
    );
  }
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
    await checkCreditsForPhase(req.auth.workspaceId, campaignId, "strategy");
    const result = await triggerStrategyPhase(campaignId, req.auth.workspaceId, req.log);
    res.status(202).json({
      message: result.queued
        ? "Fase de estratégia enfileirada — Command → Profile → Strategy → Offer → Manager → Financial Projector"
        : "Fase de estratégia iniciada diretamente",
      campaignId,
      action: "run_strategy",
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
    await checkCreditsForPhase(req.auth.workspaceId, campaignId, "content");
    const result = await triggerContentPhase(campaignId, req.auth.workspaceId, req.log);
    res.status(202).json({
      message: result.queued
        ? "Geração de conteúdo enfileirada — 16 agentes em sequência"
        : "Geração de conteúdo iniciada diretamente",
      campaignId,
      action: "generate_content",
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

// POST /campaigns/:campaignId/execute/retry — failsafe recovery for stuck campaigns
// Clears the pipeline lock, forces campaign back to a retryable state, and re-enqueues
// the appropriate job. Safe to call from analyzing or generating status only.
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
    // Clear pipeline lock — set lockedAt + lastProgressAt to null so the next run
    // acquires a fresh lock without hitting the "Pipeline já está executando" guard.
    const brain = ((campaign.brainData ?? {}) as Record<string, unknown>);
    const cp = ((brain["pipelineCheckpoint"] ?? {}) as Record<string, unknown>);
    const clearedBrain = { ...brain, pipelineCheckpoint: { ...cp, lockedAt: null, lastProgressAt: null } };

    if (campaign.status === "analyzing") {
      // analyzing → intake: valid transition (same as command agent blocked verdict).
      // Resets to intake so the RC-010 guard in processRunStrategy accepts the new job.
      await db
        .update(campaignsTable)
        .set({ status: "intake" as any, updatedAt: new Date(), brainData: clearedBrain as any })
        .where(eq(campaignsTable.id, campaignId));
      const result = await triggerStrategyPhase(campaignId, workspaceId, req.log);
      req.log.info({ campaignId }, "[FAILSAFE] analyzing → intake → strategy re-enqueued");
      res.status(202).json({ retried: true, phase: "strategy", queued: result.queued });
    } else {
      // generating → strategy_ready: resets content phase so RC-010 guard accepts the job.
      // skipAgent() inside generateCampaignContent ensures already-generated pieces are
      // NOT re-generated — only the failed/missing ones are produced.
      await db
        .update(campaignsTable)
        .set({ status: "strategy_ready" as any, updatedAt: new Date(), brainData: clearedBrain as any })
        .where(eq(campaignsTable.id, campaignId));
      const result = await triggerContentPhase(campaignId, workspaceId, req.log);
      req.log.info({ campaignId }, "[FAILSAFE] generating → strategy_ready → content re-enqueued");
      res.status(202).json({ retried: true, phase: "content", queued: result.queued });
    }
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code, data: (err as AppError & { data?: unknown }).data });
      return;
    }
    throw err;
  }
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

    await checkCreditsForPhase(req.auth.workspaceId, campaignId, "launch");
    const result = await triggerExecutionPhase(campaignId, req.auth.workspaceId, req.log);
    res.status(202).json({
      message: result.queued
        ? "Lançamento enfileirado — campanha será ativada em instantes"
        : "Lançamento iniciado diretamente",
      campaignId,
      action: "execute",
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
