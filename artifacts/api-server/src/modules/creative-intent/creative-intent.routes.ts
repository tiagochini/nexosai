import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  generateCreativeIntent,
  getCreativeIntent,
  approveCreativeDraft,
  revokeCreativeApproval,
} from "./creative-intent.service.js";

const router = Router();

// GET /campaigns/:campaignId/creative-intent
router.get("/:campaignId/creative-intent", requireAuth, async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;
  const intent = await getCreativeIntent(campaignId, req.auth.workspaceId);
  res.json({ intent });
});

// POST /campaigns/:campaignId/creative-intent/generate
router.post("/:campaignId/creative-intent/generate", requireAuth, async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;
  const intent = await generateCreativeIntent(campaignId, req.auth.workspaceId, req.log);
  res.status(201).json({ intent });
});

// POST /campaigns/:campaignId/creative-intent/approve/:draftIndex
router.post("/:campaignId/creative-intent/approve/:draftIndex", requireAuth, async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;
  const draftIndex = parseInt(req.params["draftIndex"] as string, 10);
  if (isNaN(draftIndex)) {
    res.status(400).json({ error: "Invalid draft index" });
    return;
  }
  const intent = await approveCreativeDraft(campaignId, req.auth.workspaceId, draftIndex, req.log);
  res.json({ intent });
});

// DELETE /campaigns/:campaignId/creative-intent/approval
router.delete("/:campaignId/creative-intent/approval", requireAuth, async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;
  await revokeCreativeApproval(campaignId, req.auth.workspaceId, req.log);
  res.json({ ok: true });
});

export default router;
