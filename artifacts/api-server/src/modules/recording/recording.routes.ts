import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import * as svc from "./recording.service.js";

const router = Router();
router.use(requireAuth);

const startSchema = z.object({
  name: z.string().min(1).max(200),
  campaignId: z.uuid().optional(),
});

const eventSchema = z.object({
  type: z.enum([
    "briefing_started", "briefing_completed", "strategy_generated",
    "copy_generated", "approval_requested", "approved",
    "creative_delivered", "budget_set", "campaign_activated",
    "cart_opened", "cart_closed", "metrics_snapshot", "custom",
  ]),
  phase: z.string().default("geral"),
  data: z.record(z.string(), z.unknown()).default({}),
});

// POST /api/recordings — start a new recording
router.post("/", async (req, res): Promise<void> => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const { name, campaignId } = parsed.data;
  const rec = await svc.startRecording(req.auth.workspaceId, name, campaignId);
  res.status(201).json({ recording: rec });
});

// GET /api/recordings — list all (including active sessions for re-sync)
router.get("/", async (req, res): Promise<void> => {
  const list = await svc.listRecordings(req.auth.workspaceId);
  res.json({ recordings: list });
});

// POST /api/recordings/:id/events — add event
router.post("/:id/events", async (req, res): Promise<void> => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const { type, phase, data } = parsed.data;
  const rec = await svc.addEvent(req.params["id"]!, req.auth.workspaceId, type, phase, data as Record<string, unknown>);
  if (!rec) { res.status(404).json({ error: "Gravação não encontrada ou encerrada" }); return; }
  res.json({ recording: rec });
});

// POST /api/recordings/:id/pause
router.post("/:id/pause", async (req, res): Promise<void> => {
  const rec = await svc.pauseRecording(req.params["id"]!, req.auth.workspaceId);
  if (!rec) { res.status(404).json({ error: "Gravação não encontrada ou não está gravando" }); return; }
  res.json({ recording: rec });
});

// POST /api/recordings/:id/resume
router.post("/:id/resume", async (req, res): Promise<void> => {
  const rec = await svc.resumeRecording(req.params["id"]!, req.auth.workspaceId);
  if (!rec) { res.status(404).json({ error: "Gravação não encontrada ou não está pausada" }); return; }
  res.json({ recording: rec });
});

// POST /api/recordings/:id/stop
router.post("/:id/stop", async (req, res): Promise<void> => {
  const rec = await svc.stopRecording(req.params["id"]!, req.auth.workspaceId);
  if (!rec) { res.status(404).json({ error: "Gravação não encontrada" }); return; }
  res.json({ recording: rec });
});

// POST /api/recordings/:id/upload — stream raw video body directly to disk
// Client sends: Content-Type: video/webm, body = raw blob
router.post("/:id/upload", async (req, res): Promise<void> => {
  const result = await svc.uploadVideo(req.params["id"]!, req.auth.workspaceId, req);
  if (!result) { res.status(404).json({ error: "Gravação não encontrada" }); return; }
  res.json({ ok: true, size: result.size, path: result.path });
});

// GET /api/recordings/:id/video — stream video file (supports Range for seeking)
router.get("/:id/video", async (req, res): Promise<void> => {
  await svc.serveVideo(req.params["id"]!, req.auth.workspaceId, res);
});

// GET /api/recordings/:id/export — stream ZIP download
router.get("/:id/export", async (req, res): Promise<void> => {
  await svc.exportZip(req.params["id"]!, req.auth.workspaceId, res);
});

export default router;
