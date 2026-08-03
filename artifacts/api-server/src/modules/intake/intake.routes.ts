import { Router } from "express";
import { z } from "zod/v4";
import multer from "multer";
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
  simulateBudget,
  type ProductCategory,
  type CampaignModelType,
} from "./intake.simulation.js";
import {
  validateRevenueViability,
  calculateReadinessScore,
  recommendTrackFromRevenue,
} from "./intake.scoring.js";
import { transcribeAudio } from "../ai-gateway/ai-gateway.service.js";
import { AppError } from "../../lib/errors.js";
import { eq, and } from "drizzle-orm";
import { db, campaignsTable, usersTable } from "@workspace/db";

// ─── Multer: in-memory, 100 MB limit, audio/video only ───────────────────────
const ALLOWED_AUDIO_VIDEO_MIMES = [
  "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/mp3",
  "audio/wav", "audio/x-wav", "audio/m4a", "audio/x-m4a",
  "video/mp4", "video/webm", "video/ogg", "video/quicktime",
  "video/x-msvideo", "video/mpeg", "video/3gpp",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (
      ALLOWED_AUDIO_VIDEO_MIMES.includes(file.mimetype) ||
      file.mimetype.startsWith("audio/") ||
      file.mimetype.startsWith("video/")
    ) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de arquivo não suportado: ${file.mimetype}. Use áudio ou vídeo.`));
    }
  },
});

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
    const requiredQuestions = questions.filter((q) => q.required);
    const totalRequired = requiredQuestions.length;
    const answeredRequired = totalRequired - completeness.missingRequired.length;
    const percentage = totalRequired > 0 ? Math.round((answeredRequired / totalRequired) * 100) : 100;

    res.json({
      campaign,
      completeness: {
        valid: completeness.valid,
        missingRequired: completeness.missingRequired,
        progress: Math.round(
          (Object.keys(parsed.data.intakeData).length / Math.max(questions.length, 1)) * 100,
        ),
        percentage,
        answeredRequired,
        totalRequired,
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
    const requiredQuestions = questions.filter((q) => q.required);
    const totalRequired = requiredQuestions.length;
    const answeredRequired = totalRequired - completeness.missingRequired.length;
    const percentage = totalRequired > 0 ? Math.round((answeredRequired / totalRequired) * 100) : 100;

    // _intakeChatComplete is set server-side when the agent sends the wrap-up
    // "click below" message. This survives browser close + re-login (localStorage
    // chatComplete does not). Use it as an OR condition so the "Ver e Aprovar
    // Master Plan" button reappears after any session reset.
    const chatCompletedOnServer = intakeData["_intakeChatComplete"] === true;

    // Map id → key so the client-generated schema (IntakeQuestion.key) matches
    const questionsForClient = questions.map((q) => ({
      key: q.id,
      label: q.label,
      type: q.type,
      required: q.required,
      section: q.section,
      placeholder: q.placeholder,
      description: q.description,
      options: q.options,
    }));

    res.json({
      campaignId,
      type,
      track,
      intakeData,
      questions: questionsForClient,
      completeness: {
        valid: completeness.valid || chatCompletedOnServer,
        missingRequired: chatCompletedOnServer ? [] : completeness.missingRequired,
        progress: chatCompletedOnServer ? 100 : Math.round(
          (Object.keys(intakeData).length / Math.max(questions.length, 1)) * 100,
        ),
        percentage: chatCompletedOnServer ? 100 : percentage,
        answeredRequired: chatCompletedOnServer ? totalRequired : answeredRequired,
        totalRequired,
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

// ─── Audio / video transcription via Whisper ─────────────────────────────────

router.post(
  "/:campaignId/transcribe",
  upload.single("file"),
  async (req, res): Promise<void> => {
    const campaignId = req.params["campaignId"] as string;

    if (!req.file) {
      res.status(400).json({ error: "Nenhum arquivo enviado.", code: "NO_FILE" });
      return;
    }

    // Verify campaign ownership before transcribing
    const [campaign] = await db
      .select({ id: campaignsTable.id })
      .from(campaignsTable)
      .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, req.auth.workspaceId)))
      .limit(1);

    if (!campaign) {
      res.status(404).json({ error: "Campanha não encontrada.", code: "NOT_FOUND" });
      return;
    }

    try {
      const base64 = req.file.buffer.toString("base64");
      const mimeType = req.file.mimetype || "audio/webm";

      req.log.info(
        { campaignId, mimeType, bytes: req.file.size, originalName: req.file.originalname },
        "Transcribing audio/video via Whisper",
      );

      const transcript = await transcribeAudio(base64, mimeType, req.log);

      if (!transcript || transcript.trim().length === 0) {
        res.status(422).json({
          error: "Não foi possível detectar fala no arquivo. Verifique o áudio e tente novamente.",
          code: "EMPTY_TRANSCRIPT",
        });
        return;
      }

      req.log.info({ campaignId, transcriptLength: transcript.length }, "Whisper transcription complete");
      res.json({ transcript: transcript.trim() });
    } catch (err) {
      req.log.error({ err, campaignId }, "Whisper transcription failed");
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: err.message, code: err.code });
        return;
      }
      res.status(502).json({
        error: "Erro ao transcrever áudio. Verifique se o arquivo contém fala audível e tente novamente.",
        code: "TRANSCRIPTION_ERROR",
      });
    }
  },
);

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

    // Fetch user locale so the AI responds in their chosen language
    const [userRow] = await db
      .select({ locale: usersTable.locale })
      .from(usersTable)
      .where(eq(usersTable.id, req.auth.userId))
      .limit(1);
    const locale = userRow?.locale ?? "pt-BR";

    const result = await processConversationalTurn(
      req.params["campaignId"] as string,
      req.auth.workspaceId,
      parsed.data.message,
      trimmedHistory,
      req.log,
      locale
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
  const requiredQuestions = questions.filter((q) => q.required);
  const totalRequired = requiredQuestions.length;
  const answeredRequired = totalRequired - completeness.missingRequired.length;
  const percentage = totalRequired > 0 ? Math.round((answeredRequired / totalRequired) * 100) : 100;

  res.json({
    campaignId,
    readiness,
    completeness: {
      valid: completeness.valid,
      missingRequired: completeness.missingRequired,
      progress: Math.round(
        ((questions.length - completeness.missingRequired.length) / Math.max(questions.length, 1)) * 100
      ),
      percentage,
      answeredRequired,
      totalRequired,
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

// ─── Budget simulation ────────────────────────────────────────────────────────

const simulateSchema = z.object({
  budget: z.number().positive(),
  productPrice: z.number().positive(),
  campaignType: z.string().optional(),
  productCategory: z.string().optional(),
});

router.post("/:campaignId/simulate-budget", async (req, res): Promise<void> => {
  const parsed = simulateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const campaignId = req.params["campaignId"] as string;

  try {
    const [campaign] = await db
      .select({ type: campaignsTable.type, intakeData: campaignsTable.intakeData })
      .from(campaignsTable)
      .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, req.auth.workspaceId)))
      .limit(1);

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found", code: "NOT_FOUND" });
      return;
    }

    const intakeData = (campaign.intakeData ?? {}) as Record<string, unknown>;
    const campaignType = (parsed.data.campaignType ?? campaign.type ?? "launch") as CampaignModelType;
    const productCategory = (parsed.data.productCategory ?? intakeData["product.category"] ?? "infoproduct") as ProductCategory;

    const simulation = simulateBudget(
      parsed.data.budget,
      parsed.data.productPrice,
      campaignType,
      productCategory,
    );

    res.json({ simulation });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
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
