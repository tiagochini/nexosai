import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { registerFingerprint, lookupFingerprint, listRecentDownloads } from "./fingerprint.service.js";
import { AppError, UnauthorizedError } from "../../lib/errors.js";

const ADMIN_EMAILS = new Set(["admin@nexos.ai", "founder@nexos.ai"]);

function requireAdmin(email: string) {
  if (!ADMIN_EMAILS.has(email)) {
    throw new UnauthorizedError("Admin access required");
  }
}

const router = Router();

// POST /api/fingerprints — authenticated user registers a PDF download
router.post("/", requireAuth, async (req, res): Promise<void> => {
  const {
    fingerprint, campaignId, campaignTitle, track,
    userName, userEmail, workspaceName,
  } = req.body as {
    fingerprint: string;
    campaignId: string;
    campaignTitle?: string;
    track?: string;
    userName?: string;
    userEmail?: string;
    workspaceName?: string;
  };

  if (!fingerprint || !campaignId) {
    throw new AppError(400, "fingerprint and campaignId are required");
  }

  await registerFingerprint({
    fingerprint,
    userId: req.auth.userId,
    userEmail: userEmail ?? req.auth.email ?? "",
    userName: userName ?? "",
    workspaceId: req.auth.workspaceId,
    workspaceName: workspaceName ?? "",
    campaignId,
    campaignTitle,
    track,
    ipAddress: req.ip ?? undefined,
    userAgent: req.headers["user-agent"],
  });

  res.status(201).json({ ok: true });
});

// GET /api/fingerprints/:code — admin lookup by fingerprint code
router.get("/:code", requireAuth, async (req, res): Promise<void> => {
  requireAdmin(req.auth.email);
  const { code } = req.params as { code: string };
  const record = await lookupFingerprint(code);
  if (!record) throw new AppError(404, "Fingerprint não encontrado");
  res.json({ record });
});

// GET /api/fingerprints — admin list recent downloads
router.get("/", requireAuth, async (req, res): Promise<void> => {
  requireAdmin(req.auth.email);
  const limit = Math.min(Number(req.query["limit"] ?? 100), 500);
  const records = await listRecentDownloads(limit);
  res.json({ records });
});

export default router;
