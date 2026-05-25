import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  scheduleLiveLaunch,
  cancelScheduledLive,
  listScheduledLives,
} from "./live-launcher.service.js";

const router = Router();
router.use(requireAuth);

const scheduleSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional().default(""),
  delayMinutes: z.number().min(0).max(480).default(5),
  durationMinutes: z.number().min(1).max(60).default(5),
  campaignId: z.string().uuid().optional(),
  redirectUrl: z.string().url().optional(),
});

router.post("/schedule", async (req, res): Promise<void> => {
  let parsed;
  try { parsed = scheduleSchema.parse(req.body); } catch {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }

  const result = await scheduleLiveLaunch({
    workspaceId: req.auth.workspaceId,
    title: parsed.title,
    description: parsed.description,
    delayMs: parsed.delayMinutes * 60 * 1000,
    durationMs: parsed.durationMinutes * 60 * 1000,
    campaignId: parsed.campaignId,
    redirectUrl: parsed.redirectUrl,
  });

  res.status(201).json({ session: result });
});

router.delete("/:sessionId", async (req, res): Promise<void> => {
  const cancelled = cancelScheduledLive(req.params.sessionId as string);
  if (!cancelled) {
    res.status(404).json({ error: "Sessão não encontrada ou já disparada." });
    return;
  }
  res.json({ ok: true });
});

router.get("/", async (_req, res): Promise<void> => {
  res.json({ sessions: listScheduledLives() });
});

export default router;
