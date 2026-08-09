/**
 * Psychology Layer Completeness Validation
 *
 * Extracted from content.service.ts as a standalone utility so it can be
 * imported by tests without pulling in DB/agent/realtime dependencies.
 *
 * Completeness rules (enforced in generateCampaignContent):
 *  - Campaign types in TYPES_WITH_PSYCHOLOGY_LAYER require the layer (missing → 409)
 *  - "Complete" means hook_factory output MUST be present (Step C synthesises A+B)
 *  - At least PSYCH_LAYER_MIN_OTHER_SECTIONS additional sections must be non-null
 *
 * Partial layers (e.g. only 1 agent succeeded, hooks absent) are insufficient
 * context for ad_copy / vsl_script / landing_page copy agents.
 */

import { AppError } from "./errors.js";

/** Campaign types whose copy agents require a complete psychology layer. */
export const TYPES_WITH_PSYCHOLOGY_LAYER: readonly string[] = [
  "launch", "perpetual_launch", "flash_sale", "live_sale", "continuous_sales",
  "subscription_growth", "upsell", "affiliate",
];

/** Supporting sections beyond hook_factory that must be present. */
const PSYCH_SUPPORTING_SECTIONS = [
  "pricing", "objections", "scarcity", "upsell", "testimonials",
] as const;

/** Minimum supporting (non-hook) sections required for the layer to be "complete". */
export const PSYCH_LAYER_MIN_OTHER_SECTIONS = 2;

/** Human-readable agent labels for display in UI warnings. */
export const PSYCH_AGENT_DISPLAY_NAMES: Record<string, string> = {
  pricing: "Pricing Psychologist",
  upsell: "Upsell Architect",
  objections: "Objection Killer",
  testimonials: "Testimonial Curator",
  scarcity: "Scarcity Engineer",
  hooks: "Hook Factory",
};

/**
 * Returns the list of psychology layer sections (agent names) that are absent
 * in the given layer. An empty array means the layer is complete.
 *
 * Useful for UI diagnostics — shows which specific agents need to be re-run.
 * Does NOT enforce the minimum-sections rule (use assertPsychologyLayerComplete for that).
 */
export function getPsychologyLayerMissingAgents(
  layer: Record<string, unknown> | null,
): string[] {
  if (!layer) return Object.values(PSYCH_AGENT_DISPLAY_NAMES);
  const allSections = ["pricing", "upsell", "objections", "testimonials", "scarcity", "hooks"] as const;
  return allSections
    .filter((k) => layer[k] === null || layer[k] === undefined)
    .map((k) => PSYCH_AGENT_DISPLAY_NAMES[k] ?? k);
}

/**
 * Assert that the offer psychology layer is present and complete for the given
 * campaign type. Throws AppError(409) if:
 *  - The campaign type requires a layer but none is present (PSYCHOLOGY_LAYER_MISSING)
 *  - hook_factory output is absent (PSYCHOLOGY_LAYER_INCOMPLETE)
 *  - Fewer than PSYCH_LAYER_MIN_OTHER_SECTIONS supporting sections are non-null
 *
 * No-ops for campaign types that do not run the psychology pipeline.
 */
export function assertPsychologyLayerComplete(
  campaignType: string,
  layer: Record<string, unknown> | null,
): void {
  if (!TYPES_WITH_PSYCHOLOGY_LAYER.includes(campaignType)) return;

  if (!layer) {
    throw new AppError(
      409,
      `[PSYCH-LAYER] Psychology layer missing for campaign type '${campaignType}'. ` +
      "Re-run the strategy pipeline (pricing_psychologist, objection_killer, hook_factory, etc.) " +
      "before generating content — ad copy, VSL, and landing page require this context.",
      "PSYCHOLOGY_LAYER_MISSING",
    );
  }

  // hook_factory (Step C) must be present — it synthesises the A+B outputs into
  // targeted hooks; without it copy agents have no hook strategy at all.
  if (!layer["hooks"]) {
    throw new AppError(
      409,
      `[PSYCH-LAYER] Psychology layer incomplete for campaign type '${campaignType}': ` +
      "hook_factory output is absent. This step synthesises A+B context; without it copy agents " +
      "lack hook strategy. Re-run the strategy pipeline to complete the psychology phase.",
      "PSYCHOLOGY_LAYER_INCOMPLETE",
    );
  }

  // At least PSYCH_LAYER_MIN_OTHER_SECTIONS supporting sections must be non-null.
  const presentOther = PSYCH_SUPPORTING_SECTIONS.filter(
    (k) => layer[k] !== null && layer[k] !== undefined,
  );
  if (presentOther.length < PSYCH_LAYER_MIN_OTHER_SECTIONS) {
    throw new AppError(
      409,
      `[PSYCH-LAYER] Psychology layer incomplete for campaign type '${campaignType}': ` +
      `only ${presentOther.length}/${PSYCH_SUPPORTING_SECTIONS.length} supporting sections present ` +
      `(${presentOther.join(", ")}); minimum ${PSYCH_LAYER_MIN_OTHER_SECTIONS} required alongside hooks. ` +
      "Re-run the strategy pipeline to complete pricing_psychologist, objection_killer, and scarcity_engineer.",
      "PSYCHOLOGY_LAYER_INCOMPLETE",
    );
  }
}
