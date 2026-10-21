import { eq, and, inArray, sql } from "drizzle-orm";
import {
  db,
  contentPiecesTable,
  workspaceIntegrationsTable,
  socialPostsTable,
  campaignCreativesTable,
  executionEvidenceTable,
} from "@workspace/db";
import { logger } from "../../lib/logger.js";
import { getCampaignScheduleItemFingerprint, publishPost } from "./social.service.js";
import { getApprovedMasterplan } from "../masterplan/masterplan.service.js";
import { AppError } from "../../lib/errors.js";
import type { SocialPost } from "@workspace/db";

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
      .where(and(
        eq(contentPiecesTable.id, pieceId),
        eq(contentPiecesTable.workspaceId, workspaceId),
        eq(contentPiecesTable.campaignId, campaignId),
        eq(contentPiecesTable.status, "approved"),
      ))
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
 * Legacy approval callback. Approval is not publication authorization.
 * The explicit preview/confirmation route is the only publication entrypoint.
 */
export async function autoPostApprovedContent(
  workspaceId: string,
  campaignId: string,
  pieceId: string,
): Promise<void> {
  // Approval alone is never authorization to publish. Keep this legacy helper
  // fail-closed until a versioned opt-in policy and immutable approval snapshot
  // are supplied by a future API. Throw before any read/write/provider access.
  throw new AppError(
    412,
    "Social publication requires explicit preview confirmation and approval snapshot",
    "SOCIAL_APPROVAL_CONFIRMATION_REQUIRED",
  );
}

// ── Scheduled Social Posts ────────────────────────────────────────────────────

const SOCIAL_PIECE_TYPES = ["social_post", "content_calendar", "stories_sequence"] as const;
const SOCIAL_SCHEDULE_CONFIRMATION_REQUIRED = "SOCIAL_SCHEDULE_CONFIRMATION_REQUIRED";

/**
 * Called when a launch sequence is activated.
 * Creates socialPostsTable rows (status="scheduled") for every social content
 * piece linked to the campaign, timed by dayIndex relative to startAt.
 * One row per piece × connected integration.
 * Safe to call multiple times — the canonical row is reconciled by publishPost.
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
          eq(contentPiecesTable.workspaceId, workspaceId),
          inArray(contentPiecesTable.type, SOCIAL_PIECE_TYPES as any),
          eq(contentPiecesTable.status, "approved"),
        ),
      );

    const dossier = await getApprovedMasterplan(workspaceId, campaignId);
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

        const [inserted] = await db.transaction(async (tx) => {
          await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${workspaceId}:${piece.id}:${integration.id}`}))`);
          return tx.insert(socialPostsTable).values({
            workspaceId,
            campaignId: campaignId || null,
            masterplanVersionId: dossier?.id ?? null,
            contextFingerprint: dossier?.contextFingerprint ?? null,
            contentPieceId: piece.id,
            integrationId: integration.id,
            platform: platform as any,
            postType,
            // Launch activation cannot carry the explicit preview/target
            // authorization required for a future campaign send. Persist the
            // durable row for audit/idempotency, but never advertise it as
            // scheduled work that the worker may publish.
            status: "failed",
            caption,
            hashtags: [],
            mediaUrls: [],
            scheduledAt,
            errorMessage: SOCIAL_SCHEDULE_CONFIRMATION_REQUIRED,
            aiGenerated: true,
          }).onConflictDoNothing().returning({ id: socialPostsTable.id });
        });
        if (inserted) created++;
      }
    }

    logger.info({ workspaceId, campaignId, created }, "createScheduledSocialPosts: blocked unconfirmed campaign rows created");
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
export async function processScheduledSocialPosts(now = new Date()): Promise<void> {
  const log = logger.child({ component: "social-post-scheduler" });
  try {
    const { lte, sql: drizzleSql } = await import("drizzle-orm");
    const due = await db
      .select({
        post: socialPostsTable,
        integration: workspaceIntegrationsTable,
      })
      .from(socialPostsTable)
      // An integration ID alone is not authorization for a scheduler job. Keep
      // provider credentials bound to the same workspace as the post.
      .innerJoin(
        workspaceIntegrationsTable,
        and(
          eq(socialPostsTable.integrationId, workspaceIntegrationsTable.id),
          eq(socialPostsTable.workspaceId, workspaceIntegrationsTable.workspaceId),
        ),
      )
      .innerJoin(
        contentPiecesTable,
        and(
          eq(socialPostsTable.contentPieceId, contentPiecesTable.id),
          eq(socialPostsTable.workspaceId, contentPiecesTable.workspaceId),
          eq(socialPostsTable.campaignId, contentPiecesTable.campaignId),
          eq(contentPiecesTable.status, "approved"),
        ),
      )
      .where(
        and(
          eq(socialPostsTable.status, "scheduled"),
          lte(socialPostsTable.scheduledAt, now),
        ),
      )
      .limit(50);

    if (due.length === 0) return;
    log.info({ count: due.length }, "processScheduledSocialPosts: processing due posts");

    for (const { post } of due) {
      try {
        // A campaign schedule is executable only when a durable, append-only
        // confirmation matches the current source, approved plan, target and time.
        if (post.campaignId && post.contentPieceId) {
          const [evidence] = await db.select().from(executionEvidenceTable).where(and(
            eq(executionEvidenceTable.workspaceId, post.workspaceId),
            eq(executionEvidenceTable.subjectType, "social_post"),
            eq(executionEvidenceTable.subjectId, post.id),
            eq(executionEvidenceTable.state, "planned"),
          )).limit(1);
          const details = evidence?.details as Record<string, unknown> | undefined;
          let currentFingerprint: string | undefined;
          try {
            if (post.scheduledAt) {
              currentFingerprint = await getCampaignScheduleItemFingerprint(
                post.workspaceId, post.campaignId, post.contentPieceId,
                post.integrationId, post.scheduledAt,
              );
            }
          } catch {
            currentFingerprint = undefined;
          }
          if (details?.kind !== "campaign_schedule_confirmation"
            || details?.version !== 1
            || details?.explicitConfirmation !== true
            || typeof details?.fingerprint !== "string"
            || details.fingerprint !== currentFingerprint) {
          await db.update(socialPostsTable).set({
            status: "failed",
            scheduledAt: null,
            errorMessage: details?.kind === "campaign_schedule_confirmation"
              ? "Confirmação do agendamento está desatualizada; gere uma nova prévia"
              : SOCIAL_SCHEDULE_CONFIRMATION_REQUIRED,
            updatedAt: new Date(),
          }).where(and(
            eq(socialPostsTable.id, post.id),
            eq(socialPostsTable.workspaceId, post.workspaceId),
            eq(socialPostsTable.status, "scheduled"),
          ));
            log.warn({ postId: post.id }, "processScheduledSocialPosts: missing or stale schedule confirmation");
          continue;
          }
        }

        // Hydrate media before handing the durable row to the canonical publisher.
        let mediaUrls: string[] = Array.isArray(post.mediaUrls) ? (post.mediaUrls as string[]) : [];

        if (mediaUrls.length === 0 && post.contentPieceId) {
          const linked = await db
            .select({ finalUrl: campaignCreativesTable.finalUrl })
            .from(campaignCreativesTable)
            .where(
              and(
                drizzleSql`${campaignCreativesTable.metadata}->>'contentPieceId' = ${post.contentPieceId}`,
                eq(campaignCreativesTable.workspaceId, post.workspaceId),
                post.campaignId ? eq(campaignCreativesTable.campaignId, post.campaignId) : undefined,
                eq(campaignCreativesTable.status, "approved"),
              ),
            )
            .limit(1);
          if (linked[0]?.finalUrl) mediaUrls = [linked[0].finalUrl];
        }

        if (mediaUrls.length > 0 && JSON.stringify(mediaUrls) !== JSON.stringify(post.mediaUrls ?? [])) {
          await db.update(socialPostsTable).set({ mediaUrls, updatedAt: new Date() }).where(and(
            eq(socialPostsTable.id, post.id), eq(socialPostsTable.workspaceId, post.workspaceId),
            eq(socialPostsTable.status, "scheduled"),
          ));
        }
        // Do not hand an unhydrated Instagram row to the provider adapter.
        // Leave it due for the next poll after creative generation completes.
        if (post.platform === "instagram" && mediaUrls.length === 0) {
          log.info({ postId: post.id }, "processScheduledSocialPosts: waiting for approved media");
          continue;
        }
        await publishPost(post.workspaceId, post.id);
        log.info({ postId: post.id, platform: post.platform }, "processScheduledSocialPosts: canonical publish complete");
      } catch (itemErr) {
        const code = itemErr && typeof itemErr === "object" && "code" in itemErr
          ? (itemErr as { code?: string }).code
          : undefined;
        if (code === "MASTERPLAN_CONTEXT_MISMATCH") {
          await db.update(socialPostsTable).set({
            status: "failed",
            scheduledAt: null,
            errorMessage: "Cannot publish: social post has no current approved dossier binding",
            updatedAt: new Date(),
          }).where(and(
            eq(socialPostsTable.id, post.id),
            eq(socialPostsTable.workspaceId, post.workspaceId),
            eq(socialPostsTable.status, "scheduled"),
          ));
        }
        // Never reset an in-flight/ambiguous attempt: publishPost owns recovery.
        log.warn({ itemErr, postId: post.id }, "processScheduledSocialPosts: canonical publish failed");
      }
    }
  } catch (err) {
    logger.warn({ err }, "processScheduledSocialPosts: tick error (non-fatal)");
  }
}
