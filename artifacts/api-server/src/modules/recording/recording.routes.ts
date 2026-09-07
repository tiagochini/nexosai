import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import { verifyAccessToken } from "../auth/auth.service.js";
import * as svc from "./recording.service.js";
import { deductCredits } from "../credits/credits.service.js";

const router = Router();

// Public-ish video streaming — accepts ?token= query param (needed for <video src> elements)
// Must be registered BEFORE router.use(requireAuth) so it bypasses the middleware
router.get("/:id/video-stream", async (req, res): Promise<void> => {
  const rawToken = req.query["token"];
  if (typeof rawToken !== "string" || !rawToken) {
    res.status(401).json({ error: "token query param required" }); return;
  }
  let workspaceId: string;
  try {
    const payload = verifyAccessToken(rawToken);
    workspaceId = payload.workspaceId;
  } catch {
    res.status(401).json({ error: "Invalid token" }); return;
  }
  await svc.serveVideo(req.params["id"]!, workspaceId, res);
});

router.use(requireAuth);

const startSchema = z.object({
  name: z.string().min(1).max(200),
  campaignId: z.uuid().optional(),
  recordingMode: z.enum(["manual", "automatic"]).optional(),
  folderId: z.uuid().optional(),
});
const folderSchema = z.object({ name: z.string().trim().min(1).max(120) });

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
  const { name, campaignId, recordingMode, folderId } = parsed.data;
  try {
    const rec = await svc.startRecording(req.auth.workspaceId, name, { campaignId, recordingMode, folderId });
    res.status(201).json({ recording: svc.recordingResponse(rec) });
  } catch (err) {
    if (err instanceof svc.RecordingFolderNotFoundError) { res.status(404).json({ error: "Pasta de gravação não encontrada" }); return; }
    if (err instanceof svc.RecordingFolderModeMismatchError) {
      res.status(409).json({ error: "Essa pasta do sistema não aceita este tipo de gravação", code: "RECORDING_FOLDER_MODE_MISMATCH" });
      return;
    }
    throw err;
  }
});

// Folder routes must precede /:id routes.
router.get("/folders", async (req, res): Promise<void> => {
  res.json({ folders: await svc.listFolders(req.auth.workspaceId) });
});
router.post("/folders", async (req, res): Promise<void> => {
  const parsed = folderSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  res.status(201).json({ folder: await svc.createFolder(req.auth.workspaceId, parsed.data.name) });
});
router.patch("/folders/:id", async (req, res): Promise<void> => {
  const parsed = folderSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  try {
    const folder = await svc.renameFolder(req.params["id"]!, req.auth.workspaceId, parsed.data.name);
    if (!folder) { res.status(404).json({ error: "Pasta de gravação não encontrada" }); return; }
    res.json({ folder });
  } catch (err) {
    if (err instanceof svc.ProtectedRecordingFolderError) { res.status(409).json({ error: "Pastas do sistema não podem ser alteradas" }); return; }
    throw err;
  }
});
router.delete("/folders/:id", async (req, res): Promise<void> => {
  try {
    const deleted = await svc.deleteFolder(req.params["id"]!, req.auth.workspaceId);
    if (!deleted) { res.status(404).json({ error: "Pasta de gravação não encontrada" }); return; }
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof svc.ProtectedRecordingFolderError) { res.status(409).json({ error: "Pastas do sistema não podem ser excluídas" }); return; }
    throw err;
  }
});

// GET /api/recordings — list all (including active sessions for re-sync)
router.get("/", async (req, res): Promise<void> => {
  const folderId = typeof req.query["folderId"] === "string" ? req.query["folderId"] : undefined;
  try {
    const list = await svc.listRecordings(req.auth.workspaceId, folderId);
    res.json({ recordings: list });
  } catch (err) {
    if (err instanceof svc.RecordingFolderNotFoundError) { res.status(404).json({ error: "Pasta de gravação não encontrada" }); return; }
    throw err;
  }
});

// GET /api/recordings/:id — get single recording (used by video editor to load recording)
router.get("/:id", async (req, res): Promise<void> => {
  const rec = await svc.getRecording(req.params["id"]!, req.auth.workspaceId);
  if (!rec) { res.status(404).json({ error: "Gravação não encontrada" }); return; }
  res.json({ recording: rec });
});

// POST /api/recordings/:id/events — add event
router.post("/:id/events", async (req, res): Promise<void> => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const { type, phase, data } = parsed.data;
  const rec = await svc.addEvent(req.params["id"]!, req.auth.workspaceId, type, phase, data as Record<string, unknown>);
  if (!rec) { res.status(404).json({ error: "Gravação não encontrada ou encerrada" }); return; }
  res.json({ recording: svc.recordingResponse(rec) });
});

// POST /api/recordings/:id/pause
router.post("/:id/pause", async (req, res): Promise<void> => {
  const rec = await svc.pauseRecording(req.params["id"]!, req.auth.workspaceId);
  if (!rec) { res.status(404).json({ error: "Gravação não encontrada ou não está gravando" }); return; }
  res.json({ recording: svc.recordingResponse(rec) });
});

// POST /api/recordings/:id/resume
router.post("/:id/resume", async (req, res): Promise<void> => {
  const rec = await svc.resumeRecording(req.params["id"]!, req.auth.workspaceId);
  if (!rec) { res.status(404).json({ error: "Gravação não encontrada ou não está pausada" }); return; }
  res.json({ recording: svc.recordingResponse(rec) });
});

// POST /api/recordings/:id/stop
router.post("/:id/stop", async (req, res): Promise<void> => {
  const rec = await svc.stopRecording(req.params["id"]!, req.auth.workspaceId);
  if (!rec) { res.status(404).json({ error: "Gravação não encontrada" }); return; }
  res.json({ recording: svc.recordingResponse(rec) });
});

// POST /api/recordings/:id/upload — stream raw video body directly to disk
// Client sends: Content-Type: video/webm, body = raw blob
// Optional query param: ?mode=hybrid — deducts video_hybrid credits (30cr)
router.post("/:id/upload", async (req, res): Promise<void> => {
  let result: Awaited<ReturnType<typeof svc.uploadVideo>>;
  try { result = await svc.uploadVideo(req.params["id"]!, req.auth.workspaceId, req); }
  catch { res.status(500).json({ error: "Falha ao receber o arquivo de vídeo" }); return; }
  if (!result) { res.status(404).json({ error: "Gravação não encontrada" }); return; }
  if (req.query["mode"] === "hybrid") {
    setImmediate(async () => {
      // [C3-STANDALONE] idempotency: one charge per recording upload — prevents double-charge on retry
      try { await deductCredits(req.auth.workspaceId, "video_hybrid", req.log, undefined, undefined, undefined, undefined, `ws:${req.auth.workspaceId}:recording:hybrid:${req.params["id"]!}`); } catch {}
    });
  }
  if (!result.recording) { res.status(502).json({ error: "Falha ao enviar o vídeo ao storage. Tente novamente.", size: result.size }); return; }
  res.json({ ok: true, size: result.size, recording: result.recording });
});

// GET /api/recordings/:id/video — stream video file (supports Range for seeking)
router.get("/:id/video", async (req, res): Promise<void> => {
  await svc.serveVideo(req.params["id"]!, req.auth.workspaceId, res);
});

// GET /api/recordings/:id/stream — serve video (alias for client preview)
router.get("/:id/stream", async (req, res): Promise<void> => {
  await svc.serveVideo(req.params["id"]!, req.auth.workspaceId, res);
});

// DELETE /api/recordings/:id
router.delete("/:id", async (req, res): Promise<void> => {
  let ok: boolean;
  try { ok = await svc.deleteRecording(req.params["id"]!, req.auth.workspaceId); }
  catch { res.status(502).json({ error: "Não foi possível excluir o arquivo de vídeo" }); return; }
  if (!ok) { res.status(404).json({ error: "Gravação não encontrada" }); return; }
  res.json({ ok: true });
});

// GET /api/recordings/:id/export — stream ZIP download
router.get("/:id/export", async (req, res): Promise<void> => {
  await svc.exportZip(req.params["id"]!, req.auth.workspaceId, res);
});

export default router;
