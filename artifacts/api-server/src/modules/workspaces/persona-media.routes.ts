import { Router } from "express";
import { verifyAccessToken } from "../auth/auth.service.js";
import { createGCSReadStream, getGCSRecordingSize } from "../../lib/gcs-recordings.js";

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

export default router;
