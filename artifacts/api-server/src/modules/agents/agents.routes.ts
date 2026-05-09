import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import { orchestrateCampaign } from "./command.agent.js";
import { AppError } from "../../lib/errors.js";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  campaignAgentsTable,
  approvalCheckpointsTable,
  campaignsTable,
  auditLogsTable,
} from "@workspace/db";

const router = Router();
router.use(requireAuth);

router.post("/:campaignId/orchestrate", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  try {
    const result = await orchestrateCampaign(
      campaignId,
      req.auth.workspaceId,
      req.log,
    );
    res.json({ message: "Orchestration completed", result });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.get("/:campaignId/agents", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  try {
    const [campaign] = await db
      .select({ id: campaignsTable.id })
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

    const agents = await db
      .select()
      .from(campaignAgentsTable)
      .where(eq(campaignAgentsTable.campaignId, campaignId))
      .orderBy(campaignAgentsTable.createdAt);

    const checkpoints = await db
      .select()
      .from(approvalCheckpointsTable)
      .where(eq(approvalCheckpointsTable.campaignId, campaignId))
      .orderBy(desc(approvalCheckpointsTable.createdAt));

    res.json({ agents, checkpoints });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

const approveSchema = z.object({
  checkpointId: z.string().uuid(),
  approved: z.boolean(),
  feedback: z.string().optional(),
});

router.post("/:campaignId/approve", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  const parsed = approveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  try {
    const [campaign] = await db
      .select({ id: campaignsTable.id })
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

    const [checkpoint] = await db
      .select()
      .from(approvalCheckpointsTable)
      .where(
        and(
          eq(approvalCheckpointsTable.id, parsed.data.checkpointId),
          eq(approvalCheckpointsTable.campaignId, campaignId),
        ),
      )
      .limit(1);

    if (!checkpoint) {
      res.status(404).json({ error: "Checkpoint not found", code: "NOT_FOUND" });
      return;
    }

    if (checkpoint.status !== "pending") {
      res.status(400).json({
        error: `Checkpoint already ${checkpoint.status}`,
        code: "VALIDATION_ERROR",
      });
      return;
    }

    const newStatus = parsed.data.approved ? "approved" : "rejected";

    const [updatedCheckpoint] = await db
      .update(approvalCheckpointsTable)
      .set({
        status: newStatus,
        approvedAt: parsed.data.approved ? new Date() : null,
        userFeedback: parsed.data.feedback,
      })
      .where(eq(approvalCheckpointsTable.id, parsed.data.checkpointId))
      .returning();

    await db.insert(auditLogsTable).values({
      workspaceId: req.auth.workspaceId,
      campaignId,
      action: parsed.data.approved ? "checkpoint.approved" : "checkpoint.rejected",
      actor: "user",
      data: {
        checkpointId: parsed.data.checkpointId,
        type: checkpoint.checkpointType,
        feedback: parsed.data.feedback,
      },
    });

    const pendingCheckpoints = await db
      .select({ id: approvalCheckpointsTable.id })
      .from(approvalCheckpointsTable)
      .where(
        and(
          eq(approvalCheckpointsTable.campaignId, campaignId),
          eq(approvalCheckpointsTable.status, "pending"),
        ),
      );

    if (pendingCheckpoints.length === 0 && parsed.data.approved) {
      await db
        .update(campaignsTable)
        .set({ status: "approved" })
        .where(eq(campaignsTable.id, campaignId));
    }

    res.json({
      checkpoint: updatedCheckpoint,
      message: parsed.data.approved
        ? "Checkpoint approved"
        : "Checkpoint rejected",
    });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

router.get("/:campaignId/checkpoints", async (req, res): Promise<void> => {
  const campaignId = req.params["campaignId"] as string;

  try {
    const [campaign] = await db
      .select({ id: campaignsTable.id })
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

    const checkpoints = await db
      .select()
      .from(approvalCheckpointsTable)
      .where(eq(approvalCheckpointsTable.campaignId, campaignId))
      .orderBy(desc(approvalCheckpointsTable.createdAt));

    res.json({ checkpoints });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

export default router;
