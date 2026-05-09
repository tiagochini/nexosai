import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  createVsl,
  getVsls,
  getVsl,
  generateVsl,
  updateVslSection,
  approveVsl,
  rejectVsl,
} from "./vsl.service.js";

const router = Router();

const createSchema = z.object({
  title: z.string().min(1),
  campaignId: z.string().uuid().optional(),
  format: z.enum(["vsl", "webinar", "masterclass", "challenge_day", "long_form_video"]).optional(),
  productName: z.string().optional(),
  productPrice: z.string().optional(),
  targetAudience: z.string().optional(),
  mainPromise: z.string().optional(),
});

const sectionPatchSchema = z.object({
  script: z.string().optional(),
  toneNotes: z.string().optional(),
  visualDirection: z.string().optional(),
  objective: z.string().optional(),
});

router.post("/", requireAuth, async (req, res): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }
  const vsl = await createVsl(req.auth.workspaceId, parsed.data);
  res.status(201).json({ vsl });
});

router.get("/", requireAuth, async (req, res): Promise<void> => {
  const { campaignId } = req.query as Record<string, string | undefined>;
  const vsls = await getVsls(req.auth.workspaceId, campaignId);
  res.json({ vsls, total: vsls.length });
});

router.get("/:id", requireAuth, async (req, res): Promise<void> => {
  const vsl = await getVsl(req.auth.workspaceId, req.params["id"] as string);
  res.json({ vsl });
});

router.post("/:id/generate", requireAuth, async (req, res): Promise<void> => {
  const vsl = await generateVsl(req.auth.workspaceId, req.params["id"] as string, req.log);
  res.json({ vsl });
});

router.patch("/:id/sections/:sectionId", requireAuth, async (req, res): Promise<void> => {
  const parsed = sectionPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }
  const vsl = await updateVslSection(
    req.auth.workspaceId,
    req.params["id"] as string,
    req.params["sectionId"] as string,
    parsed.data,
  );
  res.json({ vsl });
});

router.post("/:id/approve", requireAuth, async (req, res): Promise<void> => {
  const vsl = await approveVsl(req.auth.workspaceId, req.params["id"] as string);
  res.json({ vsl });
});

router.post("/:id/reject", requireAuth, async (req, res): Promise<void> => {
  const { reason } = req.body as { reason?: string };
  if (!reason) {
    res.status(400).json({ error: "Reason is required", code: "VALIDATION_ERROR" });
    return;
  }
  const vsl = await rejectVsl(req.auth.workspaceId, req.params["id"] as string, reason);
  res.json({ vsl });
});

export default router;
