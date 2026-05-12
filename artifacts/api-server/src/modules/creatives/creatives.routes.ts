import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  listCreatives,
  generateConcept,
  approveConceptAndGeneratePreview,
  approvePreviewAndGenerateFinal,
  rejectCreative,
  regenerateImage,
} from "./creatives.service.js";
import { z } from "zod/v4";

const router = Router();

router.use(requireAuth);

// GET /campaigns/:id/creatives
router.get("/:campaignId/creatives", async (req, res) => {
  const { campaignId } = req.params;
  const workspaceId = req.auth.workspaceId;
  const creatives = await listCreatives(campaignId, workspaceId);
  res.json({ creatives });
});

// POST /campaigns/:id/creatives/concept
router.post("/:campaignId/creatives/concept", async (req, res) => {
  const { campaignId } = req.params;
  const workspaceId = req.auth.workspaceId;

  const schema = z.object({
    platform: z.enum(["instagram", "facebook", "google", "tiktok", "universal"]).default("instagram"),
    format: z.enum(["feed_square", "feed_portrait", "stories", "banner", "carousel_slide"]).default("feed_square"),
    requestNote: z.string().max(500).optional().default(""),
  });

  const body = schema.parse(req.body);

  const creative = await generateConcept(
    campaignId,
    workspaceId,
    body.platform,
    body.format,
    body.requestNote,
    req.log,
  );
  res.status(201).json({ creative });
});

// POST /campaigns/:id/creatives/:creativeId/approve-concept
router.post("/:campaignId/creatives/:creativeId/approve-concept", async (req, res) => {
  const { creativeId } = req.params;
  const workspaceId = req.auth.workspaceId;

  setImmediate(async () => {
    try {
      await approveConceptAndGeneratePreview(creativeId, workspaceId, req.log);
    } catch (err) {
      req.log.error({ err, creativeId }, "Background preview generation failed");
    }
  });

  res.json({ status: "preview_generating", message: "Gerando preview... acompanhe o status." });
});

// POST /campaigns/:id/creatives/:creativeId/approve-preview
router.post("/:campaignId/creatives/:creativeId/approve-preview", async (req, res) => {
  const { creativeId } = req.params;
  const workspaceId = req.auth.workspaceId;

  setImmediate(async () => {
    try {
      await approvePreviewAndGenerateFinal(creativeId, workspaceId, req.log);
    } catch (err) {
      req.log.error({ err, creativeId }, "Background final generation failed");
    }
  });

  res.json({ status: "final_generating", message: "Gerando versão final em alta resolução..." });
});

// POST /campaigns/:id/creatives/:creativeId/reject
router.post("/:campaignId/creatives/:creativeId/reject", async (req, res) => {
  const { creativeId } = req.params;
  const body = z.object({ reason: z.string().optional().default("") }).parse(req.body);
  const creative = await rejectCreative(creativeId, body.reason);
  res.json({ creative });
});

// POST /campaigns/:id/creatives/:creativeId/regenerate
router.post("/:campaignId/creatives/:creativeId/regenerate", async (req, res) => {
  const { creativeId } = req.params;
  const workspaceId = req.auth.workspaceId;
  const body = z.object({ quality: z.enum(["standard", "hd"]).default("standard") }).parse(req.body);

  setImmediate(async () => {
    try {
      await regenerateImage(creativeId, workspaceId, body.quality, req.log);
    } catch (err) {
      req.log.error({ err, creativeId }, "Regenerate image failed");
    }
  });

  res.json({ status: "generating", message: "Regenerando imagem..." });
});

export default router;
