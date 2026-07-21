/**
 * NEXOS AI — Content Post-Approval Hooks
 * ───────────────────────────────────────────────────────────────────────────
 * Fase 2: all side-effects triggered after content piece approval are
 * isolated here. content.routes.ts calls runPostApprovalHooks() — one call,
 * fully fire-and-forget, never blocks the HTTP response.
 *
 * Each hook is individually wrapped in .catch() so a failure in one never
 * prevents the others from running.
 */

// autoPostApprovedContent removed from fire-and-forget hook — now called only
// from the explicit POST /campaigns/:id/content/:pieceId/publish-social endpoint. (Fix: A1/Bug #04)
import { autoGenerateCreativesFromBrief } from "./creative-auto-gen.service.js";
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

  // Hook 2 — Social auto-post REMOVED from fire-and-forget.
  // Publishing to social networks is now an EXPLICIT two-step action:
  //   Step 1 (approval): piece moves to "approved" — no post fires.
  //   Step 2 (publish):  user clicks "Publicar nas Redes", reviews platforms,
  //                      confirms → POST /campaigns/:id/content/:pieceId/publish-social
  // This prevents accidental publishing during internal review. (Fix: Bug #04)

  // Hook 3 — Auto-generate creative concepts if this is a media brief
  if (pieceType === "media_brief") {
    setImmediate(() => {
      autoGenerateCreativesFromBrief(campaignId, workspaceId, pieceId, log)
        .catch(() => undefined);
    });
  }

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
