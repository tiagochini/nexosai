/**
 * NEXOS AI — Content Post-Approval Hooks
 * ───────────────────────────────────────────────────────────────────────────
 * Fase 2: all side-effects triggered after content piece approval are
 * isolated here. content.routes.ts calls runPostApprovalHooks() — one call,
 * fully fire-and-forget, never blocks the HTTP response.
 *
 * Each hook is individually wrapped in .catch() so a failure in one never
 * prevents the others from running.
 *
 * Fix E1/Bug #09: autoGenerateCreativesFromBrief() removed from this hook.
 * Approving a media_brief NO LONGER auto-creates creative concept records.
 * Creative generation requires an explicit second action by the user:
 *   POST /campaigns/:id/content/:pieceId/generate-creatives
 * This mirrors the A1/Bug #04 fix (approve ≠ execute).
 */

// autoPostApprovedContent re-enabled selectively for social piece types only.
// The original blanket removal (Fix: A1/Bug #04) was too broad — non-social pieces
// (briefs, strategies, etc.) correctly stay manual, but social content pieces should
// auto-publish (or auto-schedule for retry) when approved.
// autoGenerateCreativesFromBrief removed from fire-and-forget hook — now called only
// from the explicit POST /campaigns/:id/content/:pieceId/generate-creatives endpoint. (Fix: E1/Bug #09)
import { processContentPieceApproval } from "../memory/memory.service.js";
import { runStrategicAlignmentEngine } from "../campaign-brain/alignment.service.js";
import { getCampaignBrain, updateBrainSection } from "../campaign-brain/campaign-brain.service.js";
import type { Logger } from "pino";

// Piece types that should auto-publish to social media on approval.
// Non-social types (ad_copy, vsl_script, targeting_config, etc.) are intentionally excluded.
const SOCIAL_AUTO_PUBLISH_TYPES = new Set([
  "content_calendar", "social_post",
  "instagram_post", "instagram_story", "instagram_reel",
  "feed_image", "feed_video", "story", "reel", "carousel",
  "tiktok_video", "tiktok_reel", "short_video",
]);

export interface PostApprovalContext {
  workspaceId: string;
  campaignId: string;
  pieceId: string;
  pieceType: string;
  log: Logger;
}

/**
 * Runs all post-approval side-effects fire-and-forget.
 * NEVER throws. NEVER awaited by the caller.
 * Each hook is independently isolated — one failure does not stop the others.
 */
export function runPostApprovalHooks(ctx: PostApprovalContext): void {
  const { workspaceId, campaignId, pieceId, pieceType, log } = ctx;

  // Hook 1 — Save to campaign memory layer (agentRole = pieceType, approved = true)
  processContentPieceApproval(workspaceId, campaignId, pieceId, pieceType, true)
    .catch(() => undefined);

  // Hook 2 — Social auto-post: fires ONLY for social piece types.
  // Non-social pieces (ad_copy, vsl_script, briefings, etc.) remain manual.
  // For social pieces with no media yet, autoPostApprovedContent creates a
  // scheduled row that the 60s tick retries until the image becomes available.
  if (SOCIAL_AUTO_PUBLISH_TYPES.has(pieceType)) {
    setImmediate(() => {
      import("../social/social.autopost.service.js")
        .then(({ autoPostApprovedContent }) =>
          autoPostApprovedContent(workspaceId, campaignId, pieceId)
        )
        .catch(() => undefined);
    });
  }

  // Hook 3 — REMOVED (Fix E1/Bug #09):
  // autoGenerateCreativesFromBrief() no longer fires automatically on media_brief approval.
  // Creative generation is now an EXPLICIT two-step flow:
  //   Step 1 (approval): piece moves to "approved" — no creative records created.
  //   Step 2 (generate): user confirms → POST /campaigns/:id/content/:pieceId/generate-creatives
  //                      → autoGenerateCreativesFromBrief() runs → concept records created.
  // No DALL-E credits are consumed without the user explicitly initiating Step 2.

  // Hook 4 — Contradiction detector: re-run alignment after each approval
  setImmediate(() => {
    getCampaignBrain(campaignId)
      .then((brain) => {
        if (!brain) return;
        return runStrategicAlignmentEngine(campaignId, brain, log).then((report) => {
          if (report.contradictions.length > 0) {
            return updateBrainSection(campaignId, "contradictions", report.contradictions, log);
          }
          return undefined;
        });
      })
      .catch(() => undefined);
  });
}
