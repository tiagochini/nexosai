import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  getIntakeQuestions,
  saveIntakeData,
  validateIntakeCompleteness,
  type CampaignType,
  type CampaignTrack,
} from "./intake.service.js";
import {
  extractIntakeFromText,
  processConversationalTurn,
  finalizeIntake,
  type ConversationTurn,
} from "./intake.ai.js";
import {
  validateRevenueViability,
  calculateReadinessScore,
  recommendTrackFromRevenue,
} from "./intake.scoring.js";
import { AppError } from "../../lib/errors.js";
import { eq, and } from "drizzle-orm";
import { db, campaignsTable } from "@workspace/db";

const router = Router();
router.use(requireAuth);

router.get("/:campaignId/questions", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  try {
    const [campaign] = await db
      .select({ type: campaignsTable.type, track: campaignsTable.track, status: campaignsTable.status })
      .from(campaignsTable)
      .where(
        and(
          eq(campaignsTable.id, campaignId),
          eq(campaignsTable.workspaceId, req.auth.workspaceId),
        ),
      )
      .limit(1);

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found", code: "NOT_FOUND" });
      return;
    }

    const type = (campaign.type ?? "launch") as CampaignType;
    const track = (campaign.track ?? "six_digits") as CampaignTrack;
    const questions = getIntakeQuestions(type, track);

    res.json({
      campaignId,
      type,
      track,
      questions,
      totalQuestions: questions.length,
      requiredQuestions: questions.filter((q) => q.required).length,
      sections: [...new Set(questions.map((q) => q.section))],
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.post("/:campaignId", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  const bodySchema = z.object({
    intakeData: z.record(z.string(), z.unknown()),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const campaign = await saveIntakeData(
      campaignId,
      req.auth.workspaceId,
      parsed.data.intakeData,
      req.log,
    );

    const type = (campaign.type ?? "launch") as CampaignType;
    const track = (campaign.track ?? "six_digits") as CampaignTrack;
    const completeness = validateIntakeCompleteness(type, track, parsed.data.intakeData);
    const questions = getIntakeQuestions(type, track);

    res.json({
      campaign,
      completeness: {
        valid: completeness.valid,
        missingRequired: completeness.missingRequired,
        progress: Math.round(
          (Object.keys(parsed.data.intakeData).length / questions.length) * 100,
        ),
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.get("/:campaignId", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  try {
    const [campaign] = await db
      .select()
      .from(campaignsTable)
      .where(
        and(
          eq(campaignsTable.id, campaignId),
          eq(campaignsTable.workspaceId, req.auth.workspaceId),
        ),
      )
      .limit(1);

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found", code: "NOT_FOUND" });
      return;
    }

    const type = (campaign.type ?? "launch") as CampaignType;
    const track = (campaign.track ?? "six_digits") as CampaignTrack;
    const intakeData = (campaign.intakeData ?? {}) as Record<string, unknown>;
    const completeness = validateIntakeCompleteness(type, track, intakeData);
    const questions = getIntakeQuestions(type, track);

    res.json({
      campaignId,
      type,
      track,
      intakeData,
      completeness: {
        valid: completeness.valid,
        missingRequired: completeness.missingRequired,
        progress: Math.round(
          (Object.keys(intakeData).length / questions.length) * 100,
        ),
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// ─── Natural language extraction ──────────────────────────────────────────────

const extractSchema = z.object({
  text: z.string().min(10),
});

router.post("/:campaignId/extract", async (req, res): Promise<void> => {
  const parsed = extractSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const result = await extractIntakeFromText(
    req.params["campaignId"] as string,
    req.auth.workspaceId,
    parsed.data.text,
    req.log
  );

  res.json(result);
});

// ─── Conversational turn ──────────────────────────────────────────────────────

const conversationSchema = z.object({
  message: z.string().min(1),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .optional()
    .default([]),
});

router.post("/:campaignId/conversation", async (req, res): Promise<void> => {
  const parsed = conversationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    // Limit history to last 12 turns (6 pairs) to avoid context overflow
    const fullHistory = parsed.data.history as ConversationTurn[];
    const trimmedHistory = fullHistory.slice(-12);

    const result = await processConversationalTurn(
      req.params["campaignId"] as string,
      req.auth.workspaceId,
      parsed.data.message,
      trimmedHistory,
      req.log
    );

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Conversation turn failed");
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    // Return a graceful fallback instead of a raw 500, so the frontend can continue
    res.status(200).json({
      extracted: {},
      aiMessage: "Tive uma dificuldade técnica neste momento. Pode repetir sua última resposta?",
      nextQuestionId: null,
      isComplete: false,
      progress: 0,
      missingRequired: [],
      intakeData: {},
      _error: true,
    });
  }
});

// ─── Readiness score ──────────────────────────────────────────────────────────

router.get("/:campaignId/readiness", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, req.auth.workspaceId)))
    .limit(1);

  if (!campaign) {
    res.status(404).json({ error: "Campaign not found", code: "NOT_FOUND" });
    return;
  }

  const type = (campaign.type ?? "launch") as CampaignType;
  const track = (campaign.track ?? "six_digits") as CampaignTrack;
  const intakeData = (campaign.intakeData ?? {}) as Record<string, unknown>;

  const readiness = calculateReadinessScore(type, track, intakeData);
  const completeness = validateIntakeCompleteness(type, track, intakeData);
  const questions = getIntakeQuestions(type, track);

  res.json({
    campaignId,
    readiness,
    completeness: {
      valid: completeness.valid,
      missingRequired: completeness.missingRequired,
      progress: Math.round(
        ((questions.length - completeness.missingRequired.length) / questions.length) * 100
      ),
    },
  });
});

// ─── Revenue viability check ──────────────────────────────────────────────────

const revenueSchema = z.object({
  revenueTarget: z.number().positive(),
  budget: z.number().positive(),
  productPrice: z.number().positive(),
  track: z.enum(["six_digits", "eight_digits", "ten_digits", "not_applicable"]).optional(),
  launchDays: z.number().optional(),
  hasAffiliate: z.boolean().optional(),
});

router.post("/:campaignId/validate-revenue", async (req, res): Promise<void> => {
  const parsed = revenueSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const d = parsed.data;
  const recommendedTrack = recommendTrackFromRevenue(d.revenueTarget);
  const viability = validateRevenueViability({
    revenueTarget: d.revenueTarget,
    budget: d.budget,
    productPrice: d.productPrice,
    track: d.track ?? recommendedTrack,
    launchDays: d.launchDays,
    hasAffiliate: d.hasAffiliate,
  });

  res.json({ viability });
});

// ─── Track recommendation ─────────────────────────────────────────────────────

router.get("/:campaignId/recommend-track", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, req.auth.workspaceId)))
    .limit(1);

  if (!campaign) {
    res.status(404).json({ error: "Campaign not found", code: "NOT_FOUND" });
    return;
  }

  const intakeData = (campaign.intakeData ?? {}) as Record<string, unknown>;
  const revenueTarget = Number(intakeData["campaign.revenueTarget"] ?? campaign.revenueTarget ?? 0);
  const budget = Number(intakeData["campaign.budget.total"] ?? intakeData["campaign.budget.traffic"] ?? 0);
  const productPrice = Number(intakeData["product.price"] ?? 0);

  const recommendedTrack = recommendTrackFromRevenue(revenueTarget);

  let viability = null;
  if (revenueTarget > 0 && budget > 0 && productPrice > 0) {
    viability = validateRevenueViability({
      revenueTarget,
      budget,
      productPrice,
      track: recommendedTrack,
    });
  }

  res.json({
    currentTrack: campaign.track,
    recommendedTrack,
    revenueTarget,
    viability,
  });
});

// ─── Confirm campaign type (AI-proposed) ─────────────────────────────────────

const confirmTypeSchema = z.object({
  type: z.enum([
    "launch", "perpetual_launch", "flash_sale", "live_sale", "continuous_sales",
    "subscription_growth", "authority", "audience_growth", "branding",
    "creator_monetization", "upsell", "remarketing", "affiliate", "scale", "regional_dominance",
  ]),
  track: z.enum(["six_digits", "eight_digits", "ten_digits", "not_applicable"]),
});

router.post("/:campaignId/confirm-type", async (req, res): Promise<void> => {
  const parsed = confirmTypeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const campaignId = req.params["campaignId"] as string;

  try {
    const [campaign] = await db
      .select({ id: campaignsTable.id, workspaceId: campaignsTable.workspaceId })
      .from(campaignsTable)
      .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, req.auth.workspaceId)))
      .limit(1);

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found", code: "NOT_FOUND" });
      return;
    }

    const [updated] = await db
      .update(campaignsTable)
      .set({ type: parsed.data.type, track: parsed.data.track, updatedAt: new Date() })
      .where(eq(campaignsTable.id, campaignId))
      .returning();

    req.log.info({ campaignId, type: parsed.data.type, track: parsed.data.track }, "Campaign type confirmed by user from AI proposal");
    res.json({ campaign: updated, message: "Modelo confirmado" });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// ─── Finalize intake ──────────────────────────────────────────────────────────

router.post("/:campaignId/finalize", async (req, res): Promise<void> => {
  const campaign = await finalizeIntake(
    req.params["campaignId"] as string,
    req.auth.workspaceId,
    req.log
  );
  res.json({ campaign, message: "Intake finalizado — campanha pronta para execução" });
});

export default router;
