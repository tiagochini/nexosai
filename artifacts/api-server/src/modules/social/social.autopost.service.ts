import { eq, and, inArray } from "drizzle-orm";
import {
  db,
  contentPiecesTable,
  workspaceIntegrationsTable,
  socialPostsTable,
  mediaBriefsTable,
  campaignCreativesTable,
} from "@workspace/db";
import { logger } from "../../lib/logger.js";
import { publishToInstagram, publishToFacebook, publishToTikTok } from "./social.publisher.js";
import type { SocialPost, WorkspaceIntegration } from "@workspace/db";

// Maps content piece types → DB provider values to query
// content_calendar is the main type emitted by the social_media agent.
// We look at the metadata.platform field to determine the actual platform.
const CONTENT_TYPE_PROVIDERS: Record<string, string[]> = {
  instagram_post:   ["instagram"],
  instagram_story:  ["instagram"],
  instagram_reel:   ["instagram"],
  facebook_post:    ["meta_ads"],
  facebook_video:   ["meta_ads"],
  feed_image:       ["instagram", "meta_ads"],
  feed_video:       ["instagram", "meta_ads", "tiktok_ads"],
  story:            ["instagram"],
  reel:             ["instagram", "tiktok_ads"],
  carousel:         ["instagram"],
  tiktok_video:     ["tiktok_ads"],
  tiktok_reel:      ["tiktok_ads"],
  short_video:      ["tiktok_ads", "instagram"],
  // Social posts from the main pipeline (social_media agent output)
  content_calendar: ["instagram", "meta_ads", "tiktok_ads"],
  social_post:      ["instagram", "meta_ads", "tiktok_ads"],
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
 * Falls back to approved media briefs linked to the piece, then to
 * approved campaign creatives (finalUrl from campaignCreativesTable).
 */
async function extractMediaUrls(
  pieceId: string,
  content: unknown,
  campaignId?: string,
): Promise<string[]> {
  // 0. Check for a creative generated specifically for this piece via generate-visual.
  //    The creative stores metadata.contentPieceId so we can link them even without
  //    writing back to the piece (contentPiecesTable has no metadata column).
  {
    const { sql: drizzleSql } = await import("drizzle-orm");
    const linked = await db
      .select({ finalUrl: campaignCreativesTable.finalUrl })
      .from(campaignCreativesTable)
      .where(
        and(
          drizzleSql`${campaignCreativesTable.metadata}->>'contentPieceId' = ${pieceId}`,
          eq(campaignCreativesTable.status, "approved"),
        ),
      )
      .limit(1);
    const linkedUrl = linked[0]?.finalUrl;
    if (typeof linkedUrl === "string" && linkedUrl) return [linkedUrl];
  }

  // 1. Try to extract from content JSONB
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

  // 2. Fall back to approved media briefs linked to this piece (legacy)
  const briefs = await db
    .select({ finalUrl: mediaBriefsTable.finalUrl })
    .from(mediaBriefsTable)
    .where(
      and(
        eq(mediaBriefsTable.contentPieceId, pieceId),
        eq(mediaBriefsTable.conceptStatus, "concept_approved"),
      )
    )
    .limit(5);

  const briefUrls = briefs
    .map((b) => b.finalUrl)
    .filter((u): u is string => typeof u === "string" && u.length > 0);

  if (briefUrls.length > 0) return briefUrls;

  // 3. Fall back to approved campaign creatives with finalUrl (new system)
  if (campaignId) {
    const creatives = await db
      .select({ finalUrl: campaignCreativesTable.finalUrl })
      .from(campaignCreativesTable)
      .where(
        and(
          eq(campaignCreativesTable.campaignId, campaignId),
          eq(campaignCreativesTable.status, "approved"),
        )
      )
      .limit(3);

    const creativeUrls = creatives
      .map((c) => c.finalUrl)
      .filter((u): u is string => typeof u === "string" && u.length > 0);

    if (creativeUrls.length > 0) return creativeUrls;
  }

  return [];
}

/**
 * Preview which platforms would receive a post for a given content piece.
 * Used by the publish-social gate (Bug #04 fix) to show the user what they are
 * about to publish to BEFORE they confirm. Never publishes anything.
 */
export async function getPublishPreview(
  workspaceId: string,
  campaignId: string,
  pieceId: string,
): Promise<{ platforms: { provider: string; platform: string; label: string }[]; pieceType: string; caption: string }> {
  const [piece] = await db
    .select()
    .from(contentPiecesTable)
    .where(eq(contentPiecesTable.id, pieceId))
    .limit(1);

  if (!piece) return { platforms: [], pieceType: "", caption: "" };

  const contentType = piece.type ?? "";
  const providers = CONTENT_TYPE_PROVIDERS[contentType] ?? [];
  if (providers.length === 0) return { platforms: [], pieceType: contentType, caption: "" };

  const uniqueProviders = [...new Set(providers)];
  const integrations = await db
    .select({ provider: workspaceIntegrationsTable.provider })
    .from(workspaceIntegrationsTable)
    .where(
      and(
        eq(workspaceIntegrationsTable.workspaceId, workspaceId),
        inArray(workspaceIntegrationsTable.provider, uniqueProviders as any),
        eq(workspaceIntegrationsTable.status, "connected"),
      ),
    );

  const PROVIDER_LABELS: Record<string, string> = {
    instagram: "Instagram",
    meta_ads: "Facebook",
    tiktok_ads: "TikTok",
  };

  const platforms = integrations.map((i) => ({
    provider: i.provider as string,
    platform: (PROVIDER_TO_PLATFORM[i.provider as string] ?? i.provider) as string,
    label: PROVIDER_LABELS[i.provider as string] ?? i.provider as string,
  }));

  const caption = extractCaption(piece.content);

  return { platforms, pieceType: contentType, caption: caption.slice(0, 280) };
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
    // If a scheduled social post row exists for this piece, it means the launch
    // sequence is managing timing — update the media/caption and let the scheduler
    // fire at the right moment instead of publishing immediately.
    const existingScheduled = await db
      .select({ id: socialPostsTable.id })
      .from(socialPostsTable)
      .where(
        and(
          eq(socialPostsTable.contentPieceId, pieceId),
          eq(socialPostsTable.status, "scheduled"),
        ),
      )
      .limit(1);

    if (existingScheduled.length > 0) {
      logger.info({ workspaceId, pieceId }, "social.autopost: scheduled row exists — deferring to scheduler");
      return;
    }

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
    const mediaUrls = await extractMediaUrls(pieceId, piece.content, campaignId);

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
        manualRetryCount: 0,
        reelScript: null,
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

// ── Scheduled Social Posts ────────────────────────────────────────────────────

const SOCIAL_PIECE_TYPES = ["social_post", "content_calendar", "stories_sequence"] as const;

/**
 * Called when a launch sequence is activated.
 * Creates socialPostsTable rows (status="scheduled") for every social content
 * piece linked to the campaign, timed by dayIndex relative to startAt.
 * One row per piece × connected integration.
 * Safe to call multiple times — uses onConflictDoNothing on (contentPieceId, integrationId).
 */
export async function createScheduledSocialPosts(
  workspaceId: string,
  campaignId: string,
  _sequenceId: string,
  startAt: Date,
): Promise<void> {
  try {
    // Fetch all connected social integrations for this workspace
    const integrations = await db
      .select()
      .from(workspaceIntegrationsTable)
      .where(
        and(
          eq(workspaceIntegrationsTable.workspaceId, workspaceId),
          inArray(workspaceIntegrationsTable.provider, ["instagram", "meta_ads", "tiktok_ads"] as any),
          eq(workspaceIntegrationsTable.status, "connected"),
        ),
      );

    if (integrations.length === 0) {
      logger.info({ workspaceId, campaignId }, "createScheduledSocialPosts: no connected social integrations — skip");
      return;
    }

    // Fetch all social content pieces for this campaign that have a dayIndex
    const pieces = await db
      .select()
      .from(contentPiecesTable)
      .where(
        and(
          eq(contentPiecesTable.campaignId, campaignId),
          inArray(contentPiecesTable.type, SOCIAL_PIECE_TYPES as any),
        ),
      );

    const { sql: drizzleSql } = await import("drizzle-orm");
    let created = 0;

    for (const piece of pieces) {
      const dayIdx = typeof piece.dayIndex === "number" ? piece.dayIndex : 0;
      const scheduledAt = new Date(startAt);
      scheduledAt.setDate(scheduledAt.getDate() + dayIdx);
      // Default to 9am in campaign timezone (scheduler will use scheduledAt directly)
      scheduledAt.setHours(9, 0, 0, 0);

      const contentType = piece.type ?? "";
      const postType = (CONTENT_TYPE_POST_TYPE[contentType] ?? "feed_image") as any;
      const caption = extractCaption(piece.content);
      const providers = CONTENT_TYPE_PROVIDERS[contentType] ?? ["instagram"];

      for (const integration of integrations) {
        const provider = integration.provider as string;
        if (!providers.includes(provider)) continue;
        const platform = PROVIDER_TO_PLATFORM[provider] ?? "instagram";

        try {
          await db.insert(socialPostsTable).values({
            workspaceId,
            campaignId: campaignId || null,
            contentPieceId: piece.id,
            integrationId: integration.id,
            platform: platform as any,
            postType,
            status: "scheduled",
            caption,
            hashtags: [],
            mediaUrls: [],
            scheduledAt,
            aiGenerated: true,
          });
          created++;
        } catch {
          // Row may already exist — ignore duplicate key errors
        }
      }
    }

    logger.info({ workspaceId, campaignId, created }, "createScheduledSocialPosts: scheduled posts created");
  } catch (err) {
    logger.warn({ err, workspaceId, campaignId }, "createScheduledSocialPosts: error (non-fatal)");
  }
}

/**
 * Called every 60s by the sequence scheduler tick.
 * Finds socialPostsTable rows where status="scheduled" AND scheduledAt <= now.
 * If mediaUrls is empty, tries to resolve from campaignCreativesTable before posting.
 * If still no media → skips (retries next tick) rather than failing permanently.
 */
export async function processScheduledSocialPosts(): Promise<void> {
  const log = logger.child({ component: "social-post-scheduler" });
  try {
    const { sql: drizzleSql, lte } = await import("drizzle-orm");
    const now = new Date();

    const due = await db
      .select({
        post: socialPostsTable,
        integration: workspaceIntegrationsTable,
      })
      .from(socialPostsTable)
      .innerJoin(workspaceIntegrationsTable, eq(socialPostsTable.integrationId, workspaceIntegrationsTable.id))
      .where(
        and(
          eq(socialPostsTable.status, "scheduled"),
          lte(socialPostsTable.scheduledAt, now),
        ),
      )
      .limit(50);

    if (due.length === 0) return;
    log.info({ count: due.length }, "processScheduledSocialPosts: processing due posts");

    for (const { post, integration } of due) {
      try {
        // Mark as publishing to prevent double-processing
        await db
          .update(socialPostsTable)
          .set({ status: "publishing" })
          .where(eq(socialPostsTable.id, post.id));

        // Resolve media URLs — prefer piece-linked creative, then existing mediaUrls
        let mediaUrls: string[] = Array.isArray(post.mediaUrls) ? (post.mediaUrls as string[]) : [];

        if (mediaUrls.length === 0 && post.contentPieceId) {
          const linked = await db
            .select({ finalUrl: campaignCreativesTable.finalUrl })
            .from(campaignCreativesTable)
            .where(
              and(
                drizzleSql`${campaignCreativesTable.metadata}->>'contentPieceId' = ${post.contentPieceId}`,
                eq(campaignCreativesTable.status, "approved"),
              ),
            )
            .limit(1);
          if (linked[0]?.finalUrl) mediaUrls = [linked[0].finalUrl];
        }

        // Instagram requires media — reschedule for next tick if not yet ready
        if (post.platform === "instagram" && mediaUrls.length === 0) {
          log.info({ postId: post.id }, "processScheduledSocialPosts: Instagram post waiting for media — reset to scheduled");
          await db
            .update(socialPostsTable)
            .set({ status: "scheduled" })
            .where(eq(socialPostsTable.id, post.id));
          continue;
        }

        const mockPost = { ...post, mediaUrls, status: "publishing" as const };

        let result;
        if (post.platform === "instagram") {
          result = await publishToInstagram(mockPost as any, integration);
        } else if (post.platform === "facebook_page") {
          result = await publishToFacebook(mockPost as any, integration);
        } else if (post.platform === "tiktok") {
          result = await publishToTikTok(mockPost as any, integration);
        } else {
          await db.update(socialPostsTable).set({ status: "failed", errorMessage: `Unsupported platform: ${post.platform}` }).where(eq(socialPostsTable.id, post.id));
          continue;
        }

        if (result.success) {
          await db.update(socialPostsTable).set({
            status: "published",
            mediaUrls,
            publishedAt: new Date(),
            platformPostId: result.platformPostId ?? null,
            platformUrl: result.platformUrl ?? null,
          }).where(eq(socialPostsTable.id, post.id));
          log.info({ postId: post.id, platform: post.platform }, "processScheduledSocialPosts: published");
        } else {
          const retryCount = (post.retryCount ?? 0) + 1;
          const nextStatus = retryCount >= 3 ? "failed" : "scheduled";
          await db.update(socialPostsTable).set({
            status: nextStatus as any,
            retryCount,
            errorMessage: result.error ?? "Unknown error",
          }).where(eq(socialPostsTable.id, post.id));
          log.warn({ postId: post.id, platform: post.platform, error: result.error, retryCount }, "processScheduledSocialPosts: publish failed");
        }
      } catch (itemErr) {
        await db.update(socialPostsTable).set({ status: "scheduled" }).where(eq(socialPostsTable.id, post.id)).catch(() => {});
        log.warn({ itemErr, postId: post.id }, "processScheduledSocialPosts: item error (reset to scheduled)");
      }
    }
  } catch (err) {
    logger.warn({ err }, "processScheduledSocialPosts: tick error (non-fatal)");
  }
}
