import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  createCampaign,
  getCampaign,
  listCampaigns,
  updateCampaignStatus,
  getCampaignWithAgents,
  getCampaignLiveStats,
  DIGIT_TRACK_LABELS,
  mergeIntakeDirectives,
  reorientCampaign,
} from "./campaigns.service.js";
import { triggerStrategyPhase } from "../orchestration/orchestration.service.js";
import { AppError } from "../../lib/errors.js";
import { db, workspacesTable, workspaceIntegrationsTable, CAMPAIGN_CREDIT_BUFFER } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { env } from "../../lib/env.js";

const REORIENT_STRATEGY_COST = 45;

const router = Router();
router.use(requireAuth);

const createCampaignSchema = z.object({
  title: z.string().min(3),
  type: z
    .enum([
      // Closed-cart / event-driven
      "launch",
      "perpetual_launch",
      "flash_sale",
      "live_sale",
      // Always-open cart / evergreen
      "continuous_sales",
      "subscription_growth",
      // Relationship / authority
      "authority",
      "audience_growth",
      "branding",
      "creator_monetization",
      // Activation / reengagement
      "upsell",
      "remarketing",
      "affiliate",
      // Expansion
      "scale",
      "regional_dominance",
    ])
    .default("launch"),
  track: z
    .enum(["six_digits", "eight_digits", "ten_digits", "not_applicable"])
    .default("six_digits"),
  locale: z.enum(["pt-BR", "en-US", "en-AU", "es-LA"]).default("pt-BR"),
  intakeData: z.record(z.string(), z.unknown()).default({}),
});

const statusTransitionSchema = z.object({
  status: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
});

router.get("/tracks", (_req, res): void => {
  res.json({ tracks: DIGIT_TRACK_LABELS });
});

router.get("/", async (req, res): Promise<void> => {
  const campaigns = await listCampaigns(req.auth.workspaceId);
  res.json({ campaigns });
});

router.post("/", async (req, res): Promise<void> => {
  const parsed = createCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const campaign = await createCampaign(req.auth.workspaceId, parsed.data, req.log, req.auth.email);
    res.status(201).json({ campaign });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.get("/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  try {
    const { campaign, agents, checkpoints } = await getCampaignWithAgents(
      id,
      req.auth.workspaceId,
    );
    res.json({ campaign, agents, checkpoints });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.get("/:id/live-stats", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  try {
    const stats = await getCampaignLiveStats(id!, req.auth.workspaceId);
    res.json({ liveStats: stats });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.post("/:id/reorient", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const directive = req.body?.directive as string | undefined;
  if (!directive || typeof directive !== "string" || directive.trim().length < 10) {
    res.status(400).json({ error: "directive deve ter ao menos 10 caracteres", code: "VALIDATION_ERROR" });
    return;
  }
  try {
    // Pre-flight credit check — strategy phase costs 45 cr + buffer
    const [workspace] = await db
      .select({ balance: workspacesTable.creditsBalance })
      .from(workspacesTable)
      .where(eq(workspacesTable.id, req.auth.workspaceId))
      .limit(1);

    const balance = workspace?.balance ?? 0;
    const required = REORIENT_STRATEGY_COST + CAMPAIGN_CREDIT_BUFFER;
    if (balance < required) {
      const shortage = required - balance;
      res.status(402).json({
        error:
          `Créditos insuficientes para reconstruir a estratégia. ` +
          `Saldo atual: ${balance} cr. Necessário: ${required} cr (${REORIENT_STRATEGY_COST} para análise + ${CAMPAIGN_CREDIT_BUFFER} de reserva). ` +
          `Adquira mais ${shortage} crédito${shortage !== 1 ? "s" : ""} para continuar.`,
        code: "INSUFFICIENT_CREDITS",
        data: { balance, required, shortage },
      });
      return;
    }

    await reorientCampaign(id, req.auth.workspaceId, directive.trim(), req.log);
    setImmediate(() =>
      triggerStrategyPhase(id, req.auth.workspaceId, req.log).catch((err) =>
        req.log.warn({ err, campaignId: id }, "Failed to trigger strategy after reorient"),
      ),
    );
    res.json({ ok: true, status: "analyzing" });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.patch("/:id/directives", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const directives = req.body?.directives as Record<string, string> | undefined;
  if (!directives || typeof directives !== "object") {
    res.status(400).json({ error: "directives object required", code: "VALIDATION_ERROR" });
    return;
  }
  try {
    const campaign = await mergeIntakeDirectives(id, req.auth.workspaceId, directives, req.log);
    res.json({ campaign });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.patch("/:id/status", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const parsed = statusTransitionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  // INTEGRATION GATE: block awaiting_approval → approved if core channels are missing.
  // Without WhatsApp/Telegram AND email platform, the launch sequence has no delivery
  // channels — approving content would be approving a campaign that can never run.
  if (parsed.data.status === "approved") {
    const MESSAGING: string[] = ["whatsapp_business", "telegram"];
    const EMAIL: string[] = ["rd_station", "activecampaign"];
    const connected = await db
      .select({ provider: workspaceIntegrationsTable.provider })
      .from(workspaceIntegrationsTable)
      .where(
        and(
          eq(workspaceIntegrationsTable.workspaceId, req.auth.workspaceId),
          eq(workspaceIntegrationsTable.status, "connected"),
          inArray(workspaceIntegrationsTable.provider, [...MESSAGING, ...EMAIL] as any),
        ),
      );
    const providers = connected.map((r) => r.provider as string);
    const hasMessaging = MESSAGING.some((p) => providers.includes(p));
    const hasEmail = EMAIL.some((p) => providers.includes(p)) || !!env.RESEND_API_KEY;

    if (!hasMessaging || !hasEmail) {
      const missing: { category: string; providers: string[]; reason: string }[] = [];
      if (!hasMessaging) {
        missing.push({
          category: "Mensagens",
          providers: ["WhatsApp Business", "Telegram"],
          reason: "Disparo de sequências de mensagens — obrigatório para lançamento",
        });
      }
      if (!hasEmail) {
        missing.push({
          category: "E-mail",
          providers: ["RD Station", "ActiveCampaign", "Resend"],
          reason: "Sequência de e-mails de lançamento — obrigatório para lançamento",
        });
      }
      res.status(422).json({
        error: "Conecte WhatsApp/Telegram e uma plataforma de e-mail antes de aprovar o conteúdo. Sem esses canais, a campanha não tem como ser entregue.",
        code: "MISSING_INTEGRATIONS",
        data: { missing, connectUrl: "/integracoes" },
      });
      return;
    }
  }

  try {
    const campaign = await updateCampaignStatus(
      id,
      req.auth.workspaceId,
      parsed.data.status,
      req.log,
      parsed.data.data,
    );
    res.json({ campaign });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// GET /campaigns/:id/launch-financials — Plano financeiro e de mídia para pré-lançamento
router.get("/:id/launch-financials", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  try {
    const { getLaunchFinancials } = await import("./campaigns.service.js");
    const financials = await getLaunchFinancials(id!, req.auth.workspaceId);
    res.json({ financials });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// GET /campaigns/:id/decision-trace — Arquiteto mode explainability
router.get("/:id/decision-trace", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  try {
    const { getDecisionTrace } = await import("../campaign-brain/decision-trace.service.js");
    const trace = await getDecisionTrace(id, req.auth.workspaceId);
    res.json({ trace });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

export default router;
