import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  listClientProfiles,
  getClientProfile,
  createClientProfile,
  updateClientProfile,
  deleteClientProfile,
} from "./client-profiles.service.js";

const router = Router();
router.use(requireAuth);

const profileBodySchema = z.object({
  name:           z.string().min(1).max(120),
  industry:       z.string().max(80).optional(),
  productName:    z.string().max(120).optional(),
  targetAudience: z.string().max(300).optional(),
  brandVoice:     z.string().max(200).optional(),
  mainPain:       z.string().max(300).optional(),
  transformation: z.string().max(300).optional(),
  website:        z.url().optional().or(z.literal("")),
  notes:          z.string().max(2000).optional(),
});

router.get("/", async (req, res): Promise<void> => {
  const profiles = await listClientProfiles(req.auth.workspaceId);
  res.json({ profiles });
});

router.get("/:id", async (req, res): Promise<void> => {
  const profile = await getClientProfile(req.params.id!, req.auth.workspaceId);
  res.json({ profile });
});

router.post("/", async (req, res): Promise<void> => {
  const parsed = profileBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }
  const profile = await createClientProfile(req.auth.workspaceId, parsed.data);
  res.status(201).json({ profile });
});

router.patch("/:id", async (req, res): Promise<void> => {
  const parsed = profileBodySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }
  const profile = await updateClientProfile(req.params.id!, req.auth.workspaceId, parsed.data);
  res.json({ profile });
});

router.delete("/:id", async (req, res): Promise<void> => {
  await deleteClientProfile(req.params.id!, req.auth.workspaceId);
  res.status(204).send();
});

export default router;
