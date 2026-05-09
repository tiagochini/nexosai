import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import { logger } from "../../lib/logger.js";
import {
  runComplianceCheck,
  checkContentPiece,
  batchCheckContent,
  listChecks,
  getCheck,
  reviewCheck,
  getCampaignCompliance,
  getComplianceStats,
} from "./compliance.service.js";

const router = Router();

// ─── Stats dashboard ──────────────────────────────────────────────────────────

router.get("/stats", requireAuth, async (req, res): Promise<void> => {
  const stats = await getComplianceStats(req.auth.workspaceId);
  res.json(stats);
});

// ─── Run check on raw text ────────────────────────────────────────────────────

const checkSchema = z.object({
  contentTitle: z.string().min(1),
  contentType: z.string().min(1),
  contentText: z.string().min(1),
  contentId: z.string().optional(),
  campaignId: z.string().optional(),
  platform: z
    .enum(["meta_ads", "google_ads", "tiktok", "conar", "cvm", "anvisa", "generic"])
    .optional(),
});

router.post("/check", requireAuth, async (req, res): Promise<void> => {
  const parsed = checkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const check = await runComplianceCheck(req.auth.workspaceId, parsed.data, req.log);
  res.status(201).json({ check });
});

// ─── Check by content piece id ────────────────────────────────────────────────

const contentCheckSchema = z.object({
  contentId: z.string().uuid(),
  platform: z
    .enum(["meta_ads", "google_ads", "tiktok", "conar", "cvm", "anvisa", "generic"])
    .optional()
    .default("generic"),
});

router.post("/check/content", requireAuth, async (req, res): Promise<void> => {
  const parsed = contentCheckSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const check = await checkContentPiece(
    req.auth.workspaceId,
    parsed.data.contentId,
    parsed.data.platform,
    req.log
  );
  res.status(201).json({ check });
});

// ─── Batch check ──────────────────────────────────────────────────────────────

const batchSchema = z.object({
  contentIds: z.array(z.string().uuid()).min(1).max(20),
  platform: z
    .enum(["meta_ads", "google_ads", "tiktok", "conar", "cvm", "anvisa", "generic"])
    .optional()
    .default("generic"),
});

router.post("/check/batch", requireAuth, async (req, res): Promise<void> => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const checks = await batchCheckContent(
    req.auth.workspaceId,
    parsed.data.contentIds,
    parsed.data.platform,
    req.log
  );
  res.status(201).json({ checks, count: checks.length });
});

// ─── List checks ──────────────────────────────────────────────────────────────

router.get("/checks", requireAuth, async (req, res): Promise<void> => {
  const { campaignId, status, platform, limit, offset } = req.query as Record<string, string>;

  const checks = await listChecks(req.auth.workspaceId, {
    campaignId,
    status,
    platform,
    limit: limit ? parseInt(limit, 10) : undefined,
    offset: offset ? parseInt(offset, 10) : undefined,
  });

  res.json({ checks, count: checks.length });
});

router.get("/checks/:checkId", requireAuth, async (req, res): Promise<void> => {
  const check = await getCheck(
    req.auth.workspaceId,
    req.params["checkId"] as string
  );
  res.json({ check });
});

// ─── Human review ─────────────────────────────────────────────────────────────

const reviewSchema = z.object({
  action: z.enum(["approved", "rejected", "modified"]),
  note: z.string().optional(),
});

router.patch(
  "/checks/:checkId/review",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
      return;
    }

    const check = await reviewCheck(
      req.auth.workspaceId,
      req.params["checkId"] as string,
      req.auth.userId,
      parsed.data.action,
      parsed.data.note
    );
    res.json({ check });
  }
);

// ─── Campaign compliance ──────────────────────────────────────────────────────

router.get(
  "/campaign/:campaignId",
  requireAuth,
  async (req, res): Promise<void> => {
    const result = await getCampaignCompliance(
      req.auth.workspaceId,
      req.params["campaignId"] as string
    );
    res.json(result);
  }
);

export default router;
