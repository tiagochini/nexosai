import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { getPlatformStats, getProofCases, buildLiveProofCases } from "./self-proof.service.js";

const router = Router();

/**
 * GET /api/self-proof/stats
 * Returns aggregate platform stats (auth required — internal use).
 */
router.get("/stats", requireAuth, async (req, res) => {
  const stats = await getPlatformStats();
  res.json({ stats });
});

/**
 * GET /api/self-proof/cases
 * Returns proof cases (static + live). Auth optional — used by landing page too.
 */
router.get("/cases", async (req, res) => {
  const stats = await getPlatformStats();
  const cases = buildLiveProofCases(stats);
  res.json({
    cases,
    summary: {
      totalCampaigns: stats.totalCampaigns,
      agentSuccessRate: stats.agentSuccessRate,
      totalRevenueBrl: stats.totalRevenueBrl,
      liveCampaigns: stats.liveCampaigns,
      generatedAt: stats.generatedAt,
    },
  });
});

/**
 * GET /api/self-proof/public
 * Lightweight public endpoint — for use in landing page without auth.
 * Returns only high-level aggregate, no PII.
 */
router.get("/public", async (_req, res) => {
  const stats = await getPlatformStats();
  res.json({
    totalCampaigns: stats.totalCampaigns,
    agentSuccessRate: stats.agentSuccessRate,
    liveCampaigns: stats.liveCampaigns,
    generatedAt: stats.generatedAt,
  });
});

export default router;
