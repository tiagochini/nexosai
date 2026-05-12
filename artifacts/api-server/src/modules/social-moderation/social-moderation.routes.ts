import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  getModerationConfig,
  saveModerationConfig,
  getCommentActions,
  syncPostComments,
  processIncomingComment,
  overrideCommentAction,
  findWorkspaceByPlatformAccount,
  type CommentPlatform,
  type CommentClassification,
  type CommentActionType,
} from "./social-moderation.service.js";
import { db, workspaceIntegrationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

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

  if (!integration?.accessToken) {
    res.status(422).json({
      error: "Integration not connected or missing access token",
    });
    return;
  }

  const result = await syncPostComments({
    workspaceId,
    postId,
    platform,
    accessToken: integration.accessToken,
    campaignId,
  });

  res.json(result);
});

// ─── Meta Webhook — GET (verification) ────────────────────────────────────

router.get("/webhooks/meta", (req, res): void => {
  const mode = String(req.query["hub.mode"] ?? "");
  const token = String(req.query["hub.verify_token"] ?? "");
  const challenge = String(req.query["hub.challenge"] ?? "");

  if (mode === "subscribe" && token === "nexos_webhook_verify") {
    req.log.info("Meta webhook verified");
    res.status(200).send(challenge);
    return;
  }
  res.sendStatus(403);
});

// ─── Meta Webhook — POST (events) ─────────────────────────────────────────

router.post("/webhooks/meta", (req, res): void => {
  // Acknowledge immediately — Meta requires < 200ms
  res.sendStatus(200);

  setImmediate(async () => {
    try {
      const body = req.body as {
        object?: string;
        entry?: Array<{
          id: string;
          changes?: Array<{
            field: string;
            value: {
              item?: string;
              comment_id?: string;
              parent_id?: string;
              from?: { id: string; name: string };
              message?: string;
              post_id?: string;
              verb?: string;
            };
          }>;
        }>;
      };

      if (body.object !== "page" && body.object !== "instagram") return;

      for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
          if (change.field !== "comments" && change.field !== "feed")
            continue;

          const val = change.value;
          if (val.item !== "comment" && change.field !== "comments") continue;
          if (val.verb === "remove") continue;

          const commentId = val.comment_id;
          const postId = val.post_id ?? entry.id;
          const authorId = val.from?.id ?? "unknown";
          const authorName = val.from?.name ?? "unknown";
          const text = val.message ?? "";
          const platform: CommentPlatform =
            body.object === "instagram" ? "instagram" : "facebook_page";

          if (!commentId || !text) continue;

          const workspace = await findWorkspaceByPlatformAccount(
            platform,
            entry.id
          );
          if (!workspace) continue;

          await processIncomingComment({
            workspaceId: workspace.workspaceId,
            platform,
            postId,
            commentId,
            parentCommentId: val.parent_id,
            authorName,
            authorId,
            commentText: text,
            accessToken: workspace.accessToken,
          });
        }
      }
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
