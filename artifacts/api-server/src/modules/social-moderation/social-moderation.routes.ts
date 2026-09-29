import express, { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  getModerationConfig,
  saveModerationConfig,
  getCommentActions,
  syncPostComments,
  overrideCommentAction,
  type CommentPlatform,
  type CommentClassification,
  type CommentActionType,
} from "./social-moderation.service.js";
import { db, workspaceIntegrationsTable, socialConversationTurnsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  parseVerifiedMetaWebhook,
  verifyMetaWebhookSubscription,
} from "../social/meta-webhook.security.js";
import { processMetaWebhookDelivery } from "../social/meta-webhook.processor.js";
import { listMetaEvidence } from "../social/meta-webhook-evidence.service.js";

const router = Router();

// ─── Config ────────────────────────────────────────────────────────────────

router.get("/config", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.auth.workspaceId;
  const config = await getModerationConfig(workspaceId);
  res.json({ config });
});

router.put("/config", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.auth.workspaceId;
  await saveModerationConfig(workspaceId, req.body as Record<string, unknown>);
  res.json({ ok: true });
});

// ─── Comment Actions (dashboard) ───────────────────────────────────────────

router.get("/actions", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.auth.workspaceId;
  const { platform, classification, action, limit, offset } =
    req.query as Record<string, string>;

  const result = await getCommentActions(workspaceId, {
    platform: platform as CommentPlatform | undefined,
    classification: classification as CommentClassification | undefined,
    action: action as CommentActionType | undefined,
    limit: limit ? Number(limit) : 50,
    offset: offset ? Number(offset) : 0,
  });

  res.json(result);
});

// App Review evidence is strictly workspace-scoped and token-free by construction.
router.get("/review-evidence", requireAuth, async (req, res): Promise<void> => {
  const id = typeof req.query["id"] === "string" ? req.query["id"] : undefined;
  const events = await listMetaEvidence(req.auth.workspaceId, id);
  const turns = await db.select().from(socialConversationTurnsTable)
    .where(eq(socialConversationTurnsTable.workspaceId, req.auth.workspaceId))
    .orderBy(socialConversationTurnsTable.receivedAt);
  res.json({ events, conversationTurns: turns });
});

// ─── Override (manual action from dashboard) ───────────────────────────────

router.post(
  "/actions/:actionId/override",
  requireAuth,
  async (req, res): Promise<void> => {
    const workspaceId = req.auth.workspaceId;
    const actionId = req.params["actionId"] as string;
    const { newAction, manualReply, integrationId } = req.body as {
      newAction: CommentActionType;
      manualReply?: string;
      integrationId?: string;
    };

    let accessToken: string | undefined;
    if (integrationId) {
      const integration = await db
        .select({ accessToken: workspaceIntegrationsTable.accessToken })
        .from(workspaceIntegrationsTable)
        .where(
          and(
            eq(workspaceIntegrationsTable.id, integrationId),
            eq(workspaceIntegrationsTable.workspaceId, workspaceId)
          )
        )
        .limit(1)
        .then((r) => r[0]);
      accessToken = integration?.accessToken ?? undefined;
    }

    await overrideCommentAction(
      actionId,
      workspaceId,
      req.auth.userId,
      newAction,
      manualReply,
      accessToken
    );

    res.json({ ok: true });
  }
);

// ─── Sync (manually pull comments from a specific post) ───────────────────

router.post("/sync", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.auth.workspaceId;
  const { postId, platform, integrationId, campaignId } = req.body as {
    postId: string;
    platform: CommentPlatform;
    integrationId: string;
    campaignId?: string;
  };

  const integration = await db
    .select({
      accessToken: workspaceIntegrationsTable.accessToken,
      accountId: workspaceIntegrationsTable.accountId,
    })
    .from(workspaceIntegrationsTable)
    .where(
      and(
        eq(workspaceIntegrationsTable.id, integrationId),
        eq(workspaceIntegrationsTable.workspaceId, workspaceId)
      )
    )
    .limit(1)
    .then((r) => r[0]);

  if (!integration?.accessToken || !integration.accountId) {
    res.status(422).json({
      error: "Integration not connected or missing access token",
    });
    return;
  }

  const result = await syncPostComments({
    workspaceId,
    integrationId,
    accountId: integration.accountId,
    postId,
    platform,
    accessToken: integration.accessToken,
    campaignId,
  });

  res.json(result);
});

// ─── Meta Webhook — GET (verification) ────────────────────────────────────

router.get("/webhooks/meta", verifyMetaWebhookSubscription);

// ─── Meta Webhook — POST (events) ─────────────────────────────────────────

router.post("/webhooks/meta", express.raw({ type: "application/json", limit: "10mb" }), (req, res): void => {
  const body = parseVerifiedMetaWebhook(req, res);
  if (body === null) return;
  // Acknowledge immediately — Meta requires < 200ms
  res.sendStatus(200);

  setImmediate(async () => {
    try {
      await processMetaWebhookDelivery(body, req.log);
    } catch (err) {
      req.log.error({ err }, "Meta webhook processing error");
    }
  });
});

// ─── Stats ─────────────────────────────────────────────────────────────────

router.get("/stats", requireAuth, async (req, res): Promise<void> => {
  const workspaceId = req.auth.workspaceId;
  const allActions = await getCommentActions(workspaceId, { limit: 1000 });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayActions = allActions.actions.filter((a) => a.createdAt >= today);

  const byAction = (list: typeof allActions.actions) => ({
    deleted: list.filter((a) => a.action === "deleted").length,
    hidden: list.filter((a) => a.action === "hidden").length,
    replied: list.filter((a) => a.action === "replied").length,
    pending: list.filter((a) => a.action === "pending").length,
    liked: list.filter((a) => a.action === "liked").length,
    ignored: list.filter((a) => a.action === "ignored").length,
    error: list.filter((a) => a.action === "error").length,
  });

  res.json({
    stats: {
      total: allActions.total,
      todayTotal: todayActions.length,
      byAction: byAction(allActions.actions),
      todayByAction: byAction(todayActions),
      byClassification: {
        hostile: allActions.actions.filter((a) => a.classification === "hostile").length,
        spam: allActions.actions.filter((a) => a.classification === "spam").length,
        question: allActions.actions.filter((a) => a.classification === "question").length,
        compliment: allActions.actions.filter((a) => a.classification === "compliment").length,
        objection: allActions.actions.filter((a) => a.classification === "objection").length,
        neutral: allActions.actions.filter((a) => a.classification === "neutral").length,
      },
    },
  });
});

export default router;
