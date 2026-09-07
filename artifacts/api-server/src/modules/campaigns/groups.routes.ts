import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import { AppError } from "../../lib/errors.js";
import {
  listCampaignGroups,
  createCampaignGroup,
  updateCampaignGroup,
  deleteCampaignGroup,
} from "./groups.service.js";

const router = Router();
router.use(requireAuth);

const createGroupSchema = z.object({
  platform: z.enum(["whatsapp", "telegram", "facebook"]),
  groupName: z.string().min(1).max(200),
  groupLink: z.string().max(500).optional(),
  groupId: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  segment: z.string().max(50).optional(),
  memberCount: z.number().int().min(0).optional(),
});

const updateGroupSchema = z.object({
  groupName: z.string().min(1).max(200).optional(),
  groupLink: z.string().max(500).optional(),
  description: z.string().max(1000).optional(),
  segment: z.string().max(50).optional(),
  memberCount: z.number().int().min(0).optional(),
  status: z.enum(["active", "inactive", "archived", "capability_blocked", "sync_failed"]).optional(),
});

// GET /campaigns/:campaignId/groups
router.get("/:campaignId/groups", async (req, res): Promise<void> => {
  const { campaignId } = req.params as { campaignId: string };
  try {
    const groups = await listCampaignGroups(campaignId, req.auth.workspaceId);
    res.json({ groups });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// POST /campaigns/:campaignId/groups
router.post("/:campaignId/groups", async (req, res): Promise<void> => {
  const { campaignId } = req.params as { campaignId: string };
  const parsed = createGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
    return;
  }
  try {
    const group = await createCampaignGroup(campaignId, req.auth.workspaceId, parsed.data);
    res.status(201).json({ group });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// PATCH /campaigns/:campaignId/groups/:groupId
router.patch("/:campaignId/groups/:groupId", async (req, res): Promise<void> => {
  const { groupId } = req.params as { campaignId: string; groupId: string };
  const parsed = updateGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos", details: parsed.error.issues });
    return;
  }
  try {
    const group = await updateCampaignGroup(groupId, req.auth.workspaceId, parsed.data);
    res.json({ group });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// DELETE /campaigns/:campaignId/groups/:groupId
router.delete("/:campaignId/groups/:groupId", async (req, res): Promise<void> => {
  const { groupId } = req.params as { campaignId: string; groupId: string };
  try {
    await deleteCampaignGroup(groupId, req.auth.workspaceId);
    res.json({ message: "Grupo removido" });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

export default router;
