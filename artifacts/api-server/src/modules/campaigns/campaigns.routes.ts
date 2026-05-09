import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  createCampaign,
  getCampaign,
  listCampaigns,
  updateCampaignStatus,
  getCampaignWithAgents,
  DIGIT_TRACK_LABELS,
} from "./campaigns.service.js";
import { AppError } from "../../lib/errors.js";

const router = Router();
router.use(requireAuth);

const createCampaignSchema = z.object({
  title: z.string().min(3),
  type: z
    .enum([
      "launch",
      "branding",
      "authority",
      "audience_growth",
      "continuous_sales",
      "regional_dominance",
      "upsell",
      "remarketing",
      "creator_monetization",
      "scale",
      "affiliate",
    ])
    .default("launch"),
  track: z
    .enum(["six_digits", "eight_digits", "ten_digits"])
    .default("six_digits"),
  locale: z.enum(["pt-BR", "en-US", "es-LA"]).default("pt-BR"),
  intakeData: z.record(z.string(), z.unknown()).default({}),
});

const statusTransitionSchema = z.object({
  status: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
});

router.get("/tracks", (_req, res): void => {
  res.json({ tracks: DIGIT_TRACK_LABELS });
});

router.get("/", async (req, res): Promise<void> => {
  const campaigns = await listCampaigns(req.auth.workspaceId);
  res.json({ campaigns });
});

router.post("/", async (req, res): Promise<void> => {
  const parsed = createCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const campaign = await createCampaign(req.auth.workspaceId, parsed.data, req.log);
    res.status(201).json({ campaign });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.get("/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  try {
    const { campaign, agents, checkpoints } = await getCampaignWithAgents(
      id,
      req.auth.workspaceId,
    );
    res.json({ campaign, agents, checkpoints });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.patch("/:id/status", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"];
  const parsed = statusTransitionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const campaign = await updateCampaignStatus(
      id,
      req.auth.workspaceId,
      parsed.data.status,
      req.log,
      parsed.data.data,
    );
    res.json({ campaign });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

export default router;
