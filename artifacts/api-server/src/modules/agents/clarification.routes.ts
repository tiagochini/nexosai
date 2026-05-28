import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, agentClarificationRequestsTable, campaignsTable } from "@workspace/db";
import { requireAuth } from "../auth/auth.middleware.js";
import { AppError } from "../../lib/errors.js";
import { emitCampaignEvent } from "../realtime/realtime.service.js";

const router = Router({ mergeParams: true });

router.get("/:campaignId/clarifications", requireAuth, async (req, res) => {
  const campaignId = String(req.params.campaignId);
  const workspaceId = req.auth!.workspaceId;

  const [campaign] = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) throw new AppError(404, "Campaign not found");

  const items = await db
    .select()
    .from(agentClarificationRequestsTable)
    .where(eq(agentClarificationRequestsTable.campaignId, campaignId))
    .orderBy(desc(agentClarificationRequestsTable.createdAt));

  res.json({ clarifications: items });
});

router.post("/:campaignId/clarifications/:requestId/answer", requireAuth, async (req, res) => {
  const campaignId = String(req.params.campaignId);
  const requestId = String(req.params.requestId);
  const workspaceId = req.auth!.workspaceId;
  const { answer } = req.body as { answer: string };

  if (!answer?.trim()) throw new AppError(400, "Answer is required");

  const [campaign] = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) throw new AppError(404, "Campaign not found");

  const [existing] = await db
    .select()
    .from(agentClarificationRequestsTable)
    .where(
      and(
        eq(agentClarificationRequestsTable.id, requestId),
        eq(agentClarificationRequestsTable.campaignId, campaignId),
      ),
    )
    .limit(1);

  if (!existing) throw new AppError(404, "Clarification request not found");

  const [updated] = await db
    .update(agentClarificationRequestsTable)
    .set({
      answer: answer.trim(),
      status: "answered",
      answeredAt: new Date(),
    })
    .where(eq(agentClarificationRequestsTable.id, requestId))
    .returning();

  emitCampaignEvent({
    campaignId,
    type: "clarification_answered",
    agentType: updated!.agentRole,
    message: `Resposta recebida para: ${updated!.question.slice(0, 80)}`,
    data: {
      requestId,
      answer: answer.trim(),
      isBriefingGap: updated!.isBriefingGap,
    },
    timestamp: new Date().toISOString(),
  });

  res.json({ ok: true, clarification: updated });
});

router.post("/:campaignId/clarifications/:requestId/dismiss", requireAuth, async (req, res) => {
  const campaignId = String(req.params.campaignId);
  const requestId = String(req.params.requestId);
  const workspaceId = req.auth!.workspaceId;

  const [campaign] = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) throw new AppError(404, "Campaign not found");

  await db
    .update(agentClarificationRequestsTable)
    .set({ status: "dismissed" })
    .where(
      and(
        eq(agentClarificationRequestsTable.id, requestId),
        eq(agentClarificationRequestsTable.campaignId, campaignId),
      ),
    );

  res.json({ ok: true });
});

export default router;
