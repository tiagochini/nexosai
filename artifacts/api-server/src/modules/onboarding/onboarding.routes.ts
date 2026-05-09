import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import { db, campaignsTable, workspacesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { createCampaign } from "../campaigns/campaigns.service.js";
import { saveIntakeData } from "../intake/intake.service.js";
import {
  processProductFinderTurn,
  processAffiliateNexosTurn,
  type ProductFinderTurn,
} from "./product-finder.agent.js";

const router = Router();
router.use(requireAuth);

// ─── Onboarding status ────────────────────────────────────────────────────────
// Returns whether this workspace needs onboarding (no campaigns yet)

router.get("/status", async (req, res): Promise<void> => {
  const [campaignCount] = await db
    .select({ count: count() })
    .from(campaignsTable)
    .where(eq(campaignsTable.workspaceId, req.auth.workspaceId));

  const [workspace] = await db
    .select({ createdAt: workspacesTable.createdAt, name: workspacesTable.name })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, req.auth.workspaceId))
    .limit(1);

  const total = campaignCount?.count ?? 0;
  const daysSinceCreation = workspace?.createdAt
    ? Math.floor((Date.now() - new Date(workspace.createdAt).getTime()) / 86_400_000)
    : 0;

  res.json({
    needsOnboarding: total === 0,
    campaignCount: total,
    daysSinceCreation,
    workspaceName: workspace?.name ?? "",
  });
});

// ─── Start onboarding path ────────────────────────────────────────────────────
// Creates the first campaign based on the chosen path

const startSchema = z.object({
  path: z.enum(["has_product", "building_product", "affiliate_nexos"]),
  title: z.string().optional(),
});

router.post("/start", async (req, res): Promise<void> => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const { path, title } = parsed.data;

  let campaign;

  if (path === "has_product") {
    campaign = await createCampaign(req.auth.workspaceId, {
      title: title ?? "Meu Primeiro Lançamento",
      type: "launch",
      track: "six_digits",
      intakeData: { _onboardingPath: "has_product" },
    }, req.log);
  } else if (path === "building_product") {
    campaign = await createCampaign(req.auth.workspaceId, {
      title: title ?? "Produto em Desenvolvimento",
      type: "launch",
      track: "six_digits",
      intakeData: { _onboardingPath: "building_product" },
    }, req.log);
  } else {
    // affiliate_nexos — special affiliate campaign for NexOS AI itself
    campaign = await createCampaign(req.auth.workspaceId, {
      title: "Afiliado NexOS AI",
      type: "affiliate",
      track: "six_digits",
      intakeData: {
        _onboardingPath: "affiliate_nexos",
        "product.name": "NexOS AI",
        "product.description": "Plataforma de automação de lançamentos digitais com IA — executa estratégia, gera conteúdo e coordena toda a operação",
        "product.category": "software",
        "product.deliveryMethod": "100_online",
      },
    }, req.log);
  }

  res.status(201).json({ campaign, path });
});

// ─── Product finder conversation ──────────────────────────────────────────────

const productFinderSchema = z.object({
  message: z.string().min(1),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .optional()
    .default([]),
  campaignId: z.string().uuid().optional(),
});

router.post("/product-finder/message", async (req, res): Promise<void> => {
  const parsed = productFinderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const { message, history, campaignId } = parsed.data;

  const result = await processProductFinderTurn(
    req.auth.workspaceId,
    message,
    history as ProductFinderTurn[],
    req.log
  );

  // If product confirmed + intake snapshot available, save to campaign
  if (result.isComplete && result.intakeSnapshot && campaignId) {
    try {
      await saveIntakeData(campaignId, req.auth.workspaceId, result.intakeSnapshot, req.log);
    } catch (err) {
      req.log.warn({ err, campaignId }, "Could not save intake snapshot from product finder");
    }
  }

  res.json(result);
});

// ─── Affiliate NexOS conversation ─────────────────────────────────────────────

const affiliateSchema = z.object({
  message: z.string().min(1),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .optional()
    .default([]),
});

router.post("/affiliate-nexos/message", async (req, res): Promise<void> => {
  const parsed = affiliateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const result = await processAffiliateNexosTurn(
    req.auth.workspaceId,
    parsed.data.message,
    parsed.data.history as ProductFinderTurn[],
    req.log
  );

  res.json(result);
});

export default router;
