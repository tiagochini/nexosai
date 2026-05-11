import { eq, and, inArray } from "drizzle-orm";
import {
  db,
  contentPiecesTable,
  workspaceIntegrationsTable,
  socialPostsTable,
} from "@workspace/db";
import { logger } from "../../lib/logger.js";
import { publishToInstagram, publishToFacebook } from "./social.publisher.js";
import type { SocialPost, WorkspaceIntegration } from "@workspace/db";

// Maps content piece types → social platforms to publish
const CONTENT_TYPE_PLATFORMS: Record<string, string[]> = {
  instagram_post:  ["instagram"],
  instagram_story: ["instagram"],
  instagram_reel:  ["instagram"],
  facebook_post:   ["facebook"],
  facebook_video:  ["facebook"],
  feed_image:      ["instagram", "facebook"],
  feed_video:      ["instagram", "facebook"],
  story:           ["instagram"],
  reel:            ["instagram"],
  carousel:        ["instagram"],
};

const CONTENT_TYPE_POST_TYPE: Record<string, string> = {
  instagram_post:  "feed_image",
  instagram_story: "story",
  instagram_reel:  "reel",
  facebook_post:   "feed_image",
  facebook_video:  "feed_video",
  feed_image:      "feed_image",
  feed_video:      "feed_video",
  story:           "story",
  reel:            "reel",
  carousel:        "carousel",
};

/**
 * Triggered fire-and-forget after content piece approval.
 * Publishes to all connected social integrations that match the content type.
 * Never throws — all errors are logged internally.
 */
export async function autoPostApprovedContent(
  workspaceId: string,
  campaignId: string,
  pieceId: string,
): Promise<void> {
  try {
    const [piece] = await db
      .select()
      .from(contentPiecesTable)
      .where(eq(contentPiecesTable.id, pieceId))
      .limit(1);

    if (!piece) return;

    const contentType = piece.type ?? "";
    const platforms = CONTENT_TYPE_PLATFORMS[contentType];
    if (!platforms || platforms.length === 0) return;

    const uniquePlatforms = [...new Set(platforms)];
    const integrations = await db
      .select()
      .from(workspaceIntegrationsTable)
      .where(
        and(
          eq(workspaceIntegrationsTable.workspaceId, workspaceId),
          inArray(workspaceIntegrationsTable.provider, uniquePlatforms as any),
          eq(workspaceIntegrationsTable.status, "connected"),
        )
      );

    if (integrations.length === 0) {
      logger.info({ workspaceId, pieceId, platforms }, "social.autopost: no connected integrations, skip");
      return;
    }

    const postType = (CONTENT_TYPE_POST_TYPE[contentType] ?? "feed_image") as SocialPost["postType"];
    const caption = typeof piece.content === "string"
      ? piece.content.slice(0, 2200)
      : "";

    const providerMap = new Map<string, WorkspaceIntegration>(
      integrations.map(i => [i.provider as string, i])
    );

    for (const platform of uniquePlatforms) {
      const integration = providerMap.get(platform);
      if (!integration) continue;

      // Build a minimal SocialPost to satisfy publisher types
      const mockPost: SocialPost = {
        id: piece.id,
        workspaceId,
        campaignId: campaignId || null,
        contentPieceId: pieceId,
        integrationId: integration.id,
        platform: platform as SocialPost["platform"],
        postType,
        status: "publishing",
        caption,
        hashtags: [],
        mediaUrls: [],
        callToAction: null,
        linkUrl: null,
        scheduledAt: null,
        publishedAt: null,
        platformPostId: null,
        platformUrl: null,
        metrics: { likes: 0, comments: 0, shares: 0, views: 0, reach: 0, impressions: 0, clicks: 0 },
        retryCount: 0,
        errorMessage: null,
        aiGenerated: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      let result;
      if (platform === "instagram") {
        result = await publishToInstagram(mockPost, integration);
      } else if (platform === "facebook") {
        result = await publishToFacebook(mockPost, integration);
      } else {
        continue;
      }

      if (result.success) {
        logger.info({ platform, platformPostId: result.platformPostId, pieceId }, "social.autopost: published");
        await db.insert(socialPostsTable).values({
          workspaceId,
          campaignId: campaignId || null,
          contentPieceId: pieceId,
          integrationId: integration.id,
          platform: platform as SocialPost["platform"],
          postType,
          caption,
          hashtags: [],
          mediaUrls: [],
          status: "published",
          platformPostId: result.platformPostId ?? null,
          platformUrl: result.platformUrl ?? null,
          publishedAt: new Date(),
          aiGenerated: true,
        }).onConflictDoNothing();
      } else {
        logger.warn({ platform, error: result.error, pieceId }, "social.autopost: publish failed");
        // Record the failure for visibility
        await db.insert(socialPostsTable).values({
          workspaceId,
          campaignId: campaignId || null,
          contentPieceId: pieceId,
          integrationId: integration.id,
          platform: platform as SocialPost["platform"],
          postType,
          caption,
          hashtags: [],
          mediaUrls: [],
          status: "failed",
          errorMessage: result.error ?? "Unknown error",
          aiGenerated: true,
        }).onConflictDoNothing();
      }
    }
  } catch (err) {
    logger.error({ err, workspaceId, pieceId }, "social.autopost: unexpected error");
  }
}
