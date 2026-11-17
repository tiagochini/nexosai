import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  listCreatives,
  generateConcept,
  approveConceptAndGeneratePreview,
  approvePreviewAndGenerateFinal,
  rejectCreative,
  regenerateImage,
  updateCreativeConcept,
  saveCreativeReferenceImage,
  removeCreativeReferenceImage,
  getCreativeReference,
  translateCreativeConcept,
} from "./creatives.service.js";
import { z } from "zod/v4";
import { and, eq } from "drizzle-orm";
import { db, campaignCreativesTable } from "@workspace/db";
import { createGCSObjectStream, getGCSObjectMeta } from "../../lib/gcs-recordings.js";

const router = Router();
const referenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, ["image/png", "image/jpeg", "image/webp"].includes(file.mimetype)),
});

router.use(requireAuth);

router.get("/:campaignId/creatives/:creativeId/media/reference", async (req, res): Promise<void> => {
  const reference = await getCreativeReference(req.params.campaignId, req.params.creativeId, req.auth.workspaceId);
  if (!reference) { res.status(404).json({ error: "Imagem de referência não encontrada" }); return; }
  try {
    const meta = await getGCSObjectMeta(reference.key);
    if (!meta.contentType.startsWith("image/")) { res.status(404).json({ error: "Imagem não encontrada" }); return; }
    res.setHeader("Content-Type", meta.contentType);
    res.setHeader("Content-Length", String(meta.size));
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("X-Content-Type-Options", "nosniff");
    createGCSObjectStream(reference.key).on("error", () => res.destroy()).pipe(res);
  } catch { res.status(404).json({ error: "Imagem de referência não encontrada" }); }
});

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
    locale: z.enum(["pt-BR", "en-US", "en-AU", "es-LA"]).default("pt-BR"),
  });

  const body = schema.parse(req.body);

  const creative = await generateConcept(
    campaignId,
    workspaceId,
    body.platform,
    body.format,
    body.requestNote,
    body.locale,
    req.log,
  );
  res.status(201).json({ creative });
});

// POST /campaigns/:id/creatives/:creativeId/approve-concept
router.post("/:campaignId/creatives/:creativeId/approve-concept", async (req, res) => {
  const { creativeId } = req.params;
  const workspaceId = req.auth.workspaceId;
  const creative = await approveConceptAndGeneratePreview(creativeId, workspaceId, req.log);
  res.json({ creative });
});

// POST /campaigns/:id/creatives/:creativeId/approve-preview
router.post("/:campaignId/creatives/:creativeId/approve-preview", async (req, res) => {
  const { creativeId } = req.params;
  const workspaceId = req.auth.workspaceId;
  const creative = await approvePreviewAndGenerateFinal(creativeId, workspaceId, req.log);
  res.json({ creative });
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
  const creative = await regenerateImage(creativeId, workspaceId, body.quality, req.log);
  res.json({ creative });
});

router.patch("/:campaignId/creatives/:creativeId/concept", async (req, res) => {
  const body = z.object({
    headline: z.string().trim().min(1).max(240).optional(),
    subHeadline: z.string().trim().max(500).optional(),
    visualDescription: z.string().trim().max(4000).optional(),
    cta: z.string().trim().max(120).optional(),
    dallePrompt: z.string().trim().min(1).max(6000).optional(),
    locale: z.enum(["pt-BR", "en-US", "en-AU", "es-LA"]).default("pt-BR"),
  }).refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualizar").parse(req.body);
  const { locale, ...fields } = body;
  const creative = await updateCreativeConcept(req.params.campaignId, req.params.creativeId, req.auth.workspaceId, fields, locale);
  res.json({ creative });
});

router.post("/:campaignId/creatives/:creativeId/translate", async (req, res) => {
  const { locale } = z.object({ locale: z.enum(["pt-BR", "en-US", "en-AU", "es-LA"]) }).parse(req.body);
  const creative = await translateCreativeConcept(req.params.campaignId, req.params.creativeId, req.auth.workspaceId, locale, req.log);
  res.json({ creative });
});

router.post("/:campaignId/creatives/:creativeId/reference-image", referenceUpload.single("image"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "Selecione uma imagem PNG, JPEG ou WebP de até 10 MB." }); return; }
  const creative = await saveCreativeReferenceImage(String(req.params.campaignId), String(req.params.creativeId), req.auth.workspaceId, req.file.buffer, req.file.mimetype);
  res.json({ creative });
});

router.delete("/:campaignId/creatives/:creativeId/reference-image", async (req, res) => {
  const creative = await removeCreativeReferenceImage(req.params.campaignId, req.params.creativeId, req.auth.workspaceId);
  res.json({ creative });
});

export default router;
