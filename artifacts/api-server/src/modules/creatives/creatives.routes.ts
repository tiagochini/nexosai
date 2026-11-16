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
import { and, eq } from "drizzle-orm";
import { db, campaignCreativesTable } from "@workspace/db";
import { createGCSObjectStream, getGCSObjectMeta } from "../../lib/gcs-recordings.js";

const router = Router();

router.use(requireAuth);

// GET /campaigns/:campaignId/creatives/:creativeId/media — workspace-scoped media stream.
router.get("/:campaignId/creatives/:creativeId/media/:variant", async (req, res): Promise<void> => {
  const { campaignId, creativeId } = req.params;
  const variant = z.enum(["preview", "final"]).parse(req.params["variant"]);
  const workspaceId = req.auth.workspaceId;
  const [creative] = await db.select({ key: variant === "final" ? campaignCreativesTable.finalUrl : campaignCreativesTable.previewUrl })
    .from(campaignCreativesTable)
    .where(and(
      eq(campaignCreativesTable.id, creativeId),
      eq(campaignCreativesTable.campaignId, campaignId),
      eq(campaignCreativesTable.workspaceId, workspaceId),
    ))
    .limit(1);
  const key = creative?.key;
  const expectedPrefix = `campaigns/${workspaceId}/${campaignId}/creatives/${creativeId}/`;
  if (!key?.startsWith(expectedPrefix)) { res.status(404).json({ error: "Imagem não encontrada" }); return; }
  let metadata;
  try { metadata = await getGCSObjectMeta(key); }
  catch { res.status(404).json({ error: "Imagem não encontrada" }); return; }
  if (!metadata.contentType.startsWith("image/")) { res.status(404).json({ error: "Imagem não encontrada" }); return; }
  res.setHeader("Content-Type", metadata.contentType);
  res.setHeader("Content-Length", String(metadata.size));
  res.setHeader("Cache-Control", "private, max-age=300");
  res.setHeader("X-Content-Type-Options", "nosniff");
  createGCSObjectStream(key).on("error", () => res.destroy()).pipe(res);
});

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
  const workspaceId = req.auth.workspaceId;
  const body = z.object({ reason: z.string().optional().default("") }).parse(req.body);
  const creative = await rejectCreative(creativeId, workspaceId, body.reason);
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
