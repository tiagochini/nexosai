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

// Social publication is deliberately not an approval side-effect. Approval records
// memory and alignment only; publication requires the explicit preview/confirmation
// route in social.service.ts. autoGenerateCreativesFromBrief is called only
// from the explicit POST /campaigns/:id/content/:pieceId/generate-creatives endpoint. (Fix: E1/Bug #09)
import { processContentPieceApproval } from "../memory/memory.service.js";
import { runStrategicAlignmentEngine } from "../campaign-brain/alignment.service.js";
import { getCampaignBrain, updateBrainSection } from "../campaign-brain/campaign-brain.service.js";
import type { Logger } from "pino";

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

  // Hook 2 — REMOVED: social publication requires explicit preview confirmation.
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
