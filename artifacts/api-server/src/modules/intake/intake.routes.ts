import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  getIntakeQuestions,
  saveIntakeData,
  validateIntakeCompleteness,
  type CampaignType,
  type CampaignTrack,
} from "./intake.service.js";
import { AppError } from "../../lib/errors.js";
import { eq, and } from "drizzle-orm";
import { db, campaignsTable } from "@workspace/db";

const router = Router();
router.use(requireAuth);

router.get("/:campaignId/questions", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  try {
    const [campaign] = await db
      .select({ type: campaignsTable.type, track: campaignsTable.track, status: campaignsTable.status })
      .from(campaignsTable)
      .where(
        and(
          eq(campaignsTable.id, campaignId),
          eq(campaignsTable.workspaceId, req.auth.workspaceId),
        ),
      )
      .limit(1);

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found", code: "NOT_FOUND" });
      return;
    }

    const type = (campaign.type ?? "launch") as CampaignType;
    const track = (campaign.track ?? "six_digits") as CampaignTrack;
    const questions = getIntakeQuestions(type, track);

    res.json({
      campaignId,
      type,
      track,
      questions,
      totalQuestions: questions.length,
      requiredQuestions: questions.filter((q) => q.required).length,
      sections: [...new Set(questions.map((q) => q.section))],
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.post("/:campaignId", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  const bodySchema = z.object({
    intakeData: z.record(z.string(), z.unknown()),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const campaign = await saveIntakeData(
      campaignId,
      req.auth.workspaceId,
      parsed.data.intakeData,
      req.log,
    );

    const type = (campaign.type ?? "launch") as CampaignType;
    const track = (campaign.track ?? "six_digits") as CampaignTrack;
    const completeness = validateIntakeCompleteness(type, track, parsed.data.intakeData);
    const questions = getIntakeQuestions(type, track);

    res.json({
      campaign,
      completeness: {
        valid: completeness.valid,
        missingRequired: completeness.missingRequired,
        progress: Math.round(
          (Object.keys(parsed.data.intakeData).length / questions.length) * 100,
        ),
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.get("/:campaignId", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  try {
    const [campaign] = await db
      .select()
      .from(campaignsTable)
      .where(
        and(
          eq(campaignsTable.id, campaignId),
          eq(campaignsTable.workspaceId, req.auth.workspaceId),
        ),
      )
      .limit(1);

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found", code: "NOT_FOUND" });
      return;
    }

    const type = (campaign.type ?? "launch") as CampaignType;
    const track = (campaign.track ?? "six_digits") as CampaignTrack;
    const intakeData = (campaign.intakeData ?? {}) as Record<string, unknown>;
    const completeness = validateIntakeCompleteness(type, track, intakeData);
    const questions = getIntakeQuestions(type, track);

    res.json({
      campaignId,
      type,
      track,
      intakeData,
      completeness: {
        valid: completeness.valid,
        missingRequired: completeness.missingRequired,
        progress: Math.round(
          (Object.keys(intakeData).length / questions.length) * 100,
        ),
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

export default router;
