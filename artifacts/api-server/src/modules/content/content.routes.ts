import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import { AppError } from "../../lib/errors.js";
import {
  generateCampaignContent,
  getCampaignContent,
  getCampaignMediaBriefs,
  approveContentPiece,
  rejectContentPiece,
  approveMediaBrief,
  rejectMediaBrief,
  optimizeCampaign,
} from "./content.service.js";
import { processContentPieceApproval } from "../memory/memory.service.js";
import { autoPostApprovedContent } from "../social/social.autopost.service.js";
import { ContentTypeSchema } from "@workspace/db";

const router = Router();
router.use(requireAuth);

// GET /campaigns/:campaignId/content — list all content pieces
router.get("/:campaignId/content", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;
  const type = req.query["type"] as string | undefined;
  const mentalTrigger = req.query["trigger"] as string | undefined;
  const launchPhase = req.query["launchPhase"] as string | undefined;

  if (type) {
    const parsed = ContentTypeSchema.safeParse(type);
    if (!parsed.success) {
      res.status(400).json({ error: `Invalid type: ${type}`, code: "VALIDATION_ERROR" });
      return;
    }
  }

  try {
    const result = await getCampaignContent(
      campaignId,
      req.auth.workspaceId,
      type,
      mentalTrigger,
      launchPhase,
    );
    res.json(result);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// GET /campaigns/:campaignId/content/media-briefs — list media briefs
router.get("/:campaignId/content/media-briefs", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  try {
    const result = await getCampaignMediaBriefs(campaignId, req.auth.workspaceId);
    res.json(result);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/content/generate — trigger content generation
router.post("/:campaignId/content/generate", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  try {
    const result = await generateCampaignContent(
      campaignId,
      req.auth.workspaceId,
      req.log,
    );
    res.status(202).json({
      message: "Content generation completed",
      result,
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/content/:pieceId/approve
router.post("/:campaignId/content/:pieceId/approve", async (req, res): Promise<void> => {
  const { campaignId, pieceId } = req.params as { campaignId: string; pieceId: string };

  try {
    const piece = await approveContentPiece(
      campaignId,
      req.auth.workspaceId,
      pieceId,
    );
    // Fire-and-forget: memory save + social auto-post — never blocks response
    processContentPieceApproval(
      req.auth.workspaceId,
      campaignId,
      pieceId,
      piece.type ?? "copywriter",
      true,
    ).catch(() => undefined);
    autoPostApprovedContent(req.auth.workspaceId, campaignId, pieceId).catch(() => undefined);
    res.json({ message: "Content piece approved", piece });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/content/:pieceId/reject
const rejectPieceSchema = z.object({
  reason: z.string().optional().default(""),
  feedback: z.string().optional().default(""),
});

router.post("/:campaignId/content/:pieceId/reject", async (req, res): Promise<void> => {
  const { campaignId, pieceId } = req.params as { campaignId: string; pieceId: string };

  const parsed = rejectPieceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const reason = parsed.data.reason || parsed.data.feedback || "";
    const piece = await rejectContentPiece(
      campaignId,
      req.auth.workspaceId,
      pieceId,
      reason,
    );
    // Fire-and-forget memory save — never blocks response
    processContentPieceApproval(
      req.auth.workspaceId,
      campaignId,
      pieceId,
      piece.type ?? "copywriter",
      false,
      reason,
    ).catch(() => undefined);
    res.json({ message: "Content piece rejected", piece });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/content/media-briefs/:briefId/approve
router.post("/:campaignId/content/media-briefs/:briefId/approve", async (req, res): Promise<void> => {
  const { campaignId, briefId } = req.params as { campaignId: string; briefId: string };

  try {
    const brief = await approveMediaBrief(campaignId, req.auth.workspaceId, briefId);
    res.json({ message: "Media brief concept approved", brief });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/content/media-briefs/:briefId/reject
const rejectBriefSchema = z.object({
  feedback: z.string().min(1, "Feedback is required for rejection"),
});

router.post("/:campaignId/content/media-briefs/:briefId/reject", async (req, res): Promise<void> => {
  const { campaignId, briefId } = req.params as { campaignId: string; briefId: string };

  const parsed = rejectBriefSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const brief = await rejectMediaBrief(
      campaignId,
      req.auth.workspaceId,
      briefId,
      parsed.data.feedback,
    );
    res.json({ message: "Media brief concept rejected", brief });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/content/optimize — run optimization agent with live metrics
const optimizeSchema = z.object({
  metrics: z.record(z.string(), z.unknown()),
});

router.post("/:campaignId/content/optimize", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  const parsed = optimizeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const result = await optimizeCampaign(
      campaignId,
      req.auth.workspaceId,
      parsed.data.metrics,
      req.log,
    );
    res.status(202).json({
      message: "Optimization analysis completed",
      pieceId: result.pieceId,
      output: result.output,
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
