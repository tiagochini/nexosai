import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import { deployLanding, generateLandingRevision, resolvePublishedLanding } from "./landing-publication.service.js";
import rateLimit from "express-rate-limit";
import { AppError } from "../../lib/errors.js";
import { landingTrackingSchema, trackLandingPageView } from "./landing-tracking.service.js";
const router = Router();
router.post("/:pageId/events", rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }), async (req, res): Promise<void> => {
  const parsed = landingTrackingSchema.extend({ eventId: z.string().uuid() }).safeParse({ ...req.body, pageId: req.params["pageId"] });
  if (!parsed.success) { res.status(400).json({ error: "Evento inválido.", code: "VALIDATION_ERROR" }); return; }
  try { res.status(202).json(await trackLandingPageView(parsed.data, { origin: req.get("origin"), ip: req.ip, userAgent: req.get("user-agent") })); }
  catch (error) {
    if (error instanceof AppError) { res.status(error.statusCode).json({ error: error.message, code: error.code }); return; }
    res.status(503).json({ error: "Rastreamento temporariamente indisponível.", code: "LANDING_TRACKING_UNAVAILABLE" });
  }
});
const source = z.object({ pageTitle: z.string(), metaTitle: z.string(), metaDescription: z.string(), sections: z.array(z.object({ headline: z.string(), subheadline: z.string().optional(), bodyContent: z.string(), cta: z.object({ text: z.string() }).optional(), aboveTheFold: z.boolean().optional() })) });
router.get("/resolve", async (req, res): Promise<void> => { const host = String(req.query["host"] ?? req.headers.host ?? "").split(":")[0]!; const slug = String(req.query["slug"] ?? ""); const page = await resolvePublishedLanding(host, slug); if (!page) { res.status(404).json({ error: "Página não encontrada", code: "NOT_FOUND" }); return; } res.json({ page }); });
router.post("/revisions", requireAuth, async (req, res): Promise<void> => { const p = z.object({ campaignId: z.string().uuid().optional(), title: z.string().min(1).max(160), slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/), source, leadCaptureSequenceId: z.string().uuid().optional() }).safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message, code: "VALIDATION_ERROR" }); return; } res.status(201).json(await generateLandingRevision(req.auth.workspaceId, p.data)); });
router.post("/:pageId/deploy", requireAuth, async (req, res): Promise<void> => { const p = z.object({ revisionId: z.string().uuid(), domainId: z.string().uuid().optional(), idempotencyKey: z.string().min(8).max(200) }).safeParse(req.body); if (!p.success) { res.status(400).json({ error: p.error.message, code: "VALIDATION_ERROR" }); return; } res.status(202).json(await deployLanding(req.auth.workspaceId, req.params["pageId"] as string, p.data)); });
export default router;