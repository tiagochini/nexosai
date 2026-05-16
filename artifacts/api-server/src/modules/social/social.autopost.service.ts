import { eq, and, inArray } from "drizzle-orm";
import {
  db,
  contentPiecesTable,
  workspaceIntegrationsTable,
  socialPostsTable,
  mediaBriefsTable,
} from "@workspace/db";
import { logger } from "../../lib/logger.js";
import { publishToInstagram, publishToFacebook, publishToTikTok } from "./social.publisher.js";
import type { SocialPost, WorkspaceIntegration } from "@workspace/db";

// Maps content piece types → DB provider values to query
const CONTENT_TYPE_PROVIDERS: Record<string, string[]> = {
  instagram_post:  ["instagram"],
  instagram_story: ["instagram"],
  instagram_reel:  ["instagram"],
  facebook_post:   ["meta_ads"],
  facebook_video:  ["meta_ads"],
  feed_image:      ["instagram", "meta_ads"],
  feed_video:      ["instagram", "meta_ads", "tiktok_ads"],
  story:           ["instagram"],
  reel:            ["instagram", "tiktok_ads"],
  carousel:        ["instagram"],
  tiktok_video:    ["tiktok_ads"],
  tiktok_reel:     ["tiktok_ads"],
  short_video:     ["tiktok_ads", "instagram"],
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
  tiktok_video:    "feed_video",
  tiktok_reel:     "reel",
  short_video:     "reel",
};

// Maps DB provider → SocialPost platform field
const PROVIDER_TO_PLATFORM: Record<string, SocialPost["platform"]> = {
  instagram:  "instagram",
  meta_ads:   "facebook_page",
  tiktok_ads: "tiktok",
};

/**
 * Extracts the text caption from a content piece's JSONB content field.
 * Content can be a string or an object with various text keys.
 */
function extractCaption(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") return content.slice(0, 2200);
  if (typeof content === "object" && content !== null) {
    const c = content as Record<string, unknown>;
    const text =
      c["caption"] ??
      c["body"] ??
      c["text"] ??
      c["copy"] ??
      c["message"] ??
      c["content"] ??
      null;
    if (typeof text === "string") return text.slice(0, 2200);
  }
  return "";
}

/**
 * Extracts media URLs from a content piece's JSONB content field.
 * Falls back to approved media briefs linked to the piece.
 */
async function extractMediaUrls(
  pieceId: string,
  content: unknown
): Promise<string[]> {
  // Try to extract from content JSONB
  if (content && typeof content === "object" && content !== null) {
    const c = content as Record<string, unknown>;
    const fromContent =
      c["mediaUrls"] ?? c["media_urls"] ?? c["imageUrls"] ?? c["videoUrls"];
    if (Array.isArray(fromContent) && fromContent.length > 0) {
      return fromContent.filter((u): u is string => typeof u === "string");
    }
    const single = c["mediaUrl"] ?? c["imageUrl"] ?? c["videoUrl"] ?? c["url"];
    if (typeof single === "string" && single) return [single];
  }

  // Fall back to approved media briefs linked to this piece
  const briefs = await db
    .select({ finalUrl: mediaBriefsTable.finalUrl })
    .from(mediaBriefsTable)
    .where(
      and(
        eq(mediaBriefsTable.contentPieceId, pieceId),
        eq(mediaBriefsTable.conceptStatus, "concept_approved")
      )
    )
    .limit(10);

  const urls = briefs
    .map((b) => b.finalUrl)
    .filter((u): u is string => typeof u === "string" && u.length > 0);

  return urls;
}

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
    const providers = CONTENT_TYPE_PROVIDERS[contentType];
    if (!providers || providers.length === 0) {
      logger.info({ workspaceId, pieceId, contentType }, "social.autopost: content type has no platforms, skip");
      return;
    }

    const uniqueProviders = [...new Set(providers)];
    const integrations = await db
      .select()
      .from(workspaceIntegrationsTable)
      .where(
        and(
          eq(workspaceIntegrationsTable.workspaceId, workspaceId),
          inArray(workspaceIntegrationsTable.provider, uniqueProviders as any),
          eq(workspaceIntegrationsTable.status, "connected"),
        )
      );

    if (integrations.length === 0) {
      logger.info({ workspaceId, pieceId, providers: uniqueProviders }, "social.autopost: no connected integrations, skip");
      return;
    }

    const postType = (CONTENT_TYPE_POST_TYPE[contentType] ?? "feed_image") as SocialPost["postType"];
    const caption = extractCaption(piece.content);
    const mediaUrls = await extractMediaUrls(pieceId, piece.content);

    const providerMap = new Map<string, WorkspaceIntegration>(
      integrations.map(i => [i.provider as string, i])
    );

    for (const providerKey of uniqueProviders) {
      const integration = providerMap.get(providerKey);
      if (!integration) continue;

      const platform = PROVIDER_TO_PLATFORM[providerKey] ?? "facebook_page";

      // Instagram requires media — skip gracefully if none available
      if (platform === "instagram" && mediaUrls.length === 0) {
        logger.info({ workspaceId, pieceId }, "social.autopost: Instagram skipped — no media URLs available");
        continue;
      }

      const mockPost: SocialPost = {
        id: piece.id,
        workspaceId,
        campaignId: campaignId || null,
        contentPieceId: pieceId,
        integrationId: integration.id,
        platform,
        postType,
        status: "publishing",
        caption,
        hashtags: [],
        mediaUrls,
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
      } else if (platform === "facebook_page") {
        result = await publishToFacebook(mockPost, integration);
      } else if (platform === "tiktok") {
        result = await publishToTikTok(mockPost, integration);
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
          platform,
          postType,
          caption,
          hashtags: [],
          mediaUrls,
          status: "published",
          platformPostId: result.platformPostId ?? null,
          platformUrl: result.platformUrl ?? null,
          publishedAt: new Date(),
          aiGenerated: true,
        }).onConflictDoNothing();
      } else {
        logger.warn({ platform, error: result.error, pieceId }, "social.autopost: publish failed");
        await db.insert(socialPostsTable).values({
          workspaceId,
          campaignId: campaignId || null,
          contentPieceId: pieceId,
          integrationId: integration.id,
          platform,
          postType,
          caption,
          hashtags: [],
          mediaUrls,
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
