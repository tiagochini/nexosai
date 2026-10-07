import { logger } from "../../lib/logger.js";
import {
  findWorkspaceByPlatformAccount,
  processIncomingComment,
  type CommentPlatform,
} from "../social-moderation/social-moderation.service.js";
import { processMetaWebhook } from "./social.service.js";

type MetaCommentChange = {
  platform: Extract<CommentPlatform, "instagram" | "facebook_page">;
  accountId: string;
  postId: string;
  commentId: string;
  parentCommentId?: string;
  authorId: string;
  authorName: string;
  text: string;
};

type WebhookLogger = Pick<typeof logger, "warn">;

/**
 * Normalize comment deliveries independently from Express so both public Meta
 * callback URLs use the same behavior and the payload contract is testable.
 */
export function extractMetaCommentChanges(body: unknown): MetaCommentChange[] {
  const payload = body as {
    object?: string;
    entry?: Array<{
      id?: string;
      changes?: Array<{
        field?: string;
        value?: {
          item?: string;
          id?: string;
          text?: string;
          media?: { id?: string };
          comment_id?: string;
          parent_id?: string;
          from?: { id?: string; name?: string; username?: string };
          message?: string;
          post_id?: string;
          verb?: string;
        };
      }>;
    }>;
  };

  if (payload.object !== "page" && payload.object !== "instagram") return [];
  const platform: MetaCommentChange["platform"] = payload.object === "instagram"
    ? "instagram"
    : "facebook_page";
  const comments: MetaCommentChange[] = [];

  for (const entry of payload.entry ?? []) {
    if (!entry.id) continue;
    for (const change of entry.changes ?? []) {
      if (change.field !== "comments" && change.field !== "feed") continue;
      const value = change.value ?? {};
      if (value.item !== "comment" && change.field !== "comments") continue;
      const commentId = platform === "instagram" ? value.id ?? value.comment_id : value.comment_id;
      const text = platform === "instagram" ? value.text ?? value.message : value.message;
      if (value.verb === "remove" || !commentId || !text) continue;
      comments.push({
        platform,
        accountId: entry.id,
        postId: (platform === "instagram" ? value.media?.id : undefined) ?? value.post_id ?? entry.id,
        commentId,
        ...(value.parent_id ? { parentCommentId: value.parent_id } : {}),
        authorId: value.from?.id ?? "unknown",
        authorName: value.from?.name ?? value.from?.username ?? "unknown",
        text,
      });
    }
  }
  return comments;
}

/** Process one verified Meta delivery. Idempotency is enforced downstream. */
export async function processMetaWebhookDelivery(
  body: unknown,
  requestLogger: WebhookLogger = logger,
): Promise<void> {
  // DMs are centralized in social.service.
  await processMetaWebhook(body);

  // Comments use the moderation pipeline. Both compatibility callback URLs
  // call this function, so a dashboard URL migration cannot disable comments.
  for (const comment of extractMetaCommentChanges(body)) {
    const workspace = await findWorkspaceByPlatformAccount(
      comment.platform,
      comment.accountId,
    );
    if (!workspace) {
      requestLogger.warn(
        { platform: comment.platform, accountId: comment.accountId, commentId: comment.commentId },
        "Ignoring unroutable Meta comment webhook",
      );
      continue;
    }

    await processIncomingComment({
      workspaceId: workspace.workspaceId,
      platform: comment.platform,
      postId: comment.postId,
      commentId: comment.commentId,
      parentCommentId: comment.parentCommentId,
      authorName: comment.authorName,
      authorId: comment.authorId,
      commentText: comment.text,
      accessToken: workspace.accessToken,
      integrationId: workspace.integrationId,
      igAccountId: comment.accountId,
    });
  }
}
