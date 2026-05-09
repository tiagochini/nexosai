import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  createLaunchSequence,
  getLaunchSequences,
  getLaunchSequence,
  updateLaunchSequence,
  deleteLaunchSequence,
  generateSequencePlan,
  updateSequenceItem,
} from "./launch-sequence.service.js";

const router = Router();

const createSchema = z.object({
  name: z.string().min(1),
  model: z.enum(["plf", "formula_de_lancamento", "semente", "afiliado", "perpetual", "custom"]),
  campaignId: z.string().uuid().optional(),
  totalDays: z.number().int().min(7).max(60).optional(),
  launchStartDate: z.string().optional(),
  cartOpenDate: z.string().optional(),
  cartCloseDate: z.string().optional(),
  revenueTarget: z.string().optional(),
  productName: z.string().optional(),
  productPrice: z.string().optional(),
});

const updateSchema = createSchema.partial().extend({
  status: z.enum(["draft", "scheduled", "active", "paused", "completed", "cancelled"]).optional(),
});

const itemPatchSchema = z.object({
  status: z.enum(["pending", "content_generating", "content_ready", "scheduled", "dispatched", "skipped"]).optional(),
  scheduledAt: z.string().optional(),
  contentPieceId: z.string().uuid().optional(),
  copyHints: z.string().optional(),
});

router.post("/", requireAuth, async (req, res): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }
  const sequence = await createLaunchSequence(req.auth.workspaceId, parsed.data);
  res.status(201).json({ sequence });
});

router.get("/", requireAuth, async (req, res): Promise<void> => {
  const sequences = await getLaunchSequences(req.auth.workspaceId);
  res.json({ sequences, total: sequences.length });
});

router.get("/:id", requireAuth, async (req, res): Promise<void> => {
  const sequence = await getLaunchSequence(req.auth.workspaceId, req.params["id"] as string);
  res.json({ sequence });
});

router.patch("/:id", requireAuth, async (req, res): Promise<void> => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }
  const sequence = await updateLaunchSequence(req.auth.workspaceId, req.params["id"] as string, parsed.data);
  res.json({ sequence });
});

router.delete("/:id", requireAuth, async (req, res): Promise<void> => {
  await deleteLaunchSequence(req.auth.workspaceId, req.params["id"] as string);
  res.json({ success: true });
});

router.post("/:id/generate", requireAuth, async (req, res): Promise<void> => {
  const sequence = await generateSequencePlan(req.auth.workspaceId, req.params["id"] as string, req.log);
  res.json({ sequence });
});

router.patch("/:id/items/:itemId", requireAuth, async (req, res): Promise<void> => {
  const parsed = itemPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }
  const item = await updateSequenceItem(
    req.auth.workspaceId,
    req.params["id"] as string,
    req.params["itemId"] as string,
    parsed.data,
  );
  res.json({ item });
});

export default router;
