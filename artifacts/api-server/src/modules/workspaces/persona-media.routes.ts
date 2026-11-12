import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, workspacesTable } from "@workspace/db";
import { verifyAccessToken } from "../auth/auth.service.js";
import { avatarSampleObjectKey, createGCSObjectStream, createGCSReadStream, getGCSObjectMeta, getGCSRecordingSize } from "../../lib/gcs-recordings.js";

// Public-ish media streaming for persona cloning (training/consent videos) so that
// external providers (HeyGen) can fetch them over plain HTTPS via ?token=.
// Must be mounted BEFORE any router.use(requireAuth) so it bypasses that middleware.
// Key format enforced: persona-media/{workspaceId}/{kind}-{timestamp}.webm
const router = Router();

router.get("/persona-media/:workspaceId/:file", async (req, res): Promise<void> => {
  const rawToken = req.query["token"];
  if (typeof rawToken !== "string" || !rawToken) {
    res.status(401).json({ error: "token query param required" });
    return;
  }
  let workspaceId: string;
  try {
    const payload = verifyAccessToken(rawToken);
    workspaceId = payload.workspaceId;
  } catch {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  const paramWorkspaceId = req.params["workspaceId"]!;
  if (paramWorkspaceId !== workspaceId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const key = `persona-media/${paramWorkspaceId}/${req.params["file"]}`;
  try {
    const total = await getGCSRecordingSize(key);
    res.setHeader("Content-Type", "video/webm");
    res.setHeader("Content-Length", total);
    createGCSReadStream(key).pipe(res);
  } catch {
    res.status(404).json({ error: "Media not found" });
  }
});

// Short-lived provider fallback for private avatar samples when GCS URL signing is unavailable.
router.get("/persona-avatar-sample/:workspaceId/:sampleId", async (req, res): Promise<void> => {
  const rawToken = req.query["token"];
  if (typeof rawToken !== "string" || !rawToken) {
    res.status(401).json({ error: "token query param required" });
    return;
  }
  let tokenWorkspaceId: string;
  try {
    tokenWorkspaceId = verifyAccessToken(rawToken).workspaceId;
  } catch {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  const workspaceId = req.params["workspaceId"]!;
  const sampleId = req.params["sampleId"]!;
  if (workspaceId !== tokenWorkspaceId || !/^[0-9a-f-]{36}$/i.test(sampleId)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const [workspace] = await db.select({ settings: workspacesTable.settings })
    .from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).limit(1);
  const settings = (workspace?.settings ?? {}) as Record<string, unknown>;
  const persona = (settings["persona"] ?? {}) as Record<string, unknown>;
  const sample = (Array.isArray(persona["avatarSamples"]) ? persona["avatarSamples"] : [])
    .find((item): item is Record<string, unknown> => !!item && typeof item === "object"
      && (item as Record<string, unknown>)["sampleId"] === sampleId) as Record<string, unknown> | undefined;
  const mimeType = typeof sample?.["mimeType"] === "string" ? sample["mimeType"] : "";
  const extension = mimeType === "video/webm" ? "webm" : mimeType === "video/mp4" ? "mp4" : null;
  if (!sample || !extension) {
    res.status(404).json({ error: "Media not found" });
    return;
  }
  try {
    const key = avatarSampleObjectKey(workspaceId, sampleId, extension);
    const meta = await getGCSObjectMeta(key);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", String(meta.size));
    res.setHeader("Cache-Control", "private, no-store");
    createGCSObjectStream(key).pipe(res);
  } catch {
    res.status(404).json({ error: "Media not found" });
  }
});

export default router;
