import { eq, and, desc, ne, count, inArray, sql } from "drizzle-orm";
import {
  db,
  campaignsTable,
  contentPiecesTable,
  campaignAgentsTable,
  mediaBriefsTable,
  auditLogsTable,
} from "@workspace/db";
import { transitionCampaign, CONTENT_PHASE_ENTRY_STATUSES } from "../campaigns/campaigns.service.js";
import { runAgent, parseAgentJSON, setComplianceHint } from "../agents/agent.runner.js";
import { withRegenContext } from "../agents/regen-context.js";
import { setFallbackMode } from "../ai-gateway/ai-gateway.service.js";
import { classifyPipelineError } from "../agents/error-classifier.js";
import { runEthicsAutocorrect } from "../agents/ethics-autocorrect.agent.js";
import { runContextRefinement } from "../agents/context-refinement.agent.js";
import { runCopywriterAgent } from "../agents/copywriter.agent.js";
import { runSocialMediaAgent } from "../agents/social-media.agent.js";
import { runAdCopyAgent } from "../agents/ad-copy.agent.js";
import { runVSLScriptAgent } from "../agents/vsl-script.agent.js";
import { runMediaBriefAgent } from "../agents/media-brief.agent.js";
import { runCPLScriptAgent } from "../agents/cpl-script.agent.js";
import { runPrelaunchWarmingAgent } from "../agents/prelaunch-warming.agent.js";
import { runWebinarScriptAgent } from "../agents/webinar-script.agent.js";
import { runLiveScriptAgent } from "../agents/live-script.agent.js";
import { runStoriesSequenceAgent } from "../agents/stories-sequence.agent.js";
import { runCreativeDirectorAgent } from "../agents/creative-director.agent.js";
import { runLandingPageAgent } from "../agents/landing-page.agent.js";
import { runTargetingAgent, type TargetingOutput } from "../agents/targeting.agent.js";
import { runMediaBuyerAgent } from "../agents/media-buyer.agent.js";
import { runVideoStrategyAgent } from "../agents/video-strategy.agent.js";
import { runCreatorGrowthAgent } from "../agents/creator-growth.agent.js";
import { runOrganicTrafficAgent } from "../agents/organic-traffic.agent.js";
import { runComplianceAgent } from "../agents/compliance.agent.js";
import { runOptimizationAgent } from "../agents/optimization.agent.js";
import { runEmotionalCoherenceCheck } from "../agents/emotional-coherence-checker.agent.js";
import { emitCampaignEvent } from "../realtime/realtime.service.js";
import { calculateReverseBudget, saveBudgetProposal } from "./budget-reverse.service.js";
import { AppError, NotFoundError, ValidationError } from "../../lib/errors.js";
import {
  assertPsychologyLayerComplete,
  TYPES_WITH_PSYCHOLOGY_LAYER,
} from "../../lib/psychology-layer.js";
import type { ProfileBuilderOutput } from "../agents/profile-builder.agent.js";
import type { StrategyOutput } from "../agents/strategy.agent.js";
import type { Logger } from "pino";
import { logger as rootLogger } from "../../lib/logger.js";
import { generateCampaignEmotionalArc } from "../agents/campaign-emotional-arc.agent.js";
import {
  getArcFromIntakeData,
  buildArcOverviewBlock,
  getAvatarStateForPhase,
  buildPhaseStateBlock,
} from "../agents/dynamic-avatar-state.js";

export interface ContentGenerationResult {
  campaignId: string;
  piecesGenerated: number;
  mediaBriefsGenerated: number;
  agentsRun: string[];
  errors: { agent: string; error: string }[];
  status: "completed" | "partial" | "failed";
  /** Per-piece execution record — always present, even when all pieces fail. */
  pieceResults: LsPieceContentEntry[];
}

// PIPELINE_KERNEL: CONTENT_PHASE_ENTRY_STATUSES replaces this local array.
// Imported from campaigns.service.ts — single source of truth.
// RC-001 FIX preserved: "generating" excluded to prevent double-trigger.
const CONTENT_GENERATION_ALLOWED_STATUSES = CONTENT_PHASE_ENTRY_STATUSES;

// ── Helpers ───────────────────────────────────────────────────────────────────

function emitAgentError(campaignId: string, agentType: string, err: unknown) {
  emitCampaignEvent({
    campaignId,
    type: "agent_failed",
    agentType,
    message: `Agente ${agentType} falhou: ${err instanceof Error ? err.message : String(err)}`,
    timestamp: new Date().toISOString(),
  });
}

function extractProfile(audienceData: unknown): ProfileBuilderOutput | undefined {
  if (!audienceData || typeof audienceData !== "object") return undefined;
  const d = audienceData as Record<string, unknown>;
  if (!d["primaryAvatar"]) return undefined;
  return audienceData as ProfileBuilderOutput;
}

// ── Per-piece execution result ────────────────────────────────────────────────
// Tracks the outcome of each individual agent run within generateCampaignContent.
// Returned in the ContentGenerationResult so callers know which pieces succeeded,
// which failed, and why — without needing to infer from separate agentsRun/errors arrays.
export type LsPieceContentEntry = {
  pieceType: string;
  agentKey: string;
  status: "success" | "failed";
  pieceId?: string;
  error?: string;
};

// ── Piece content empty detection ─────────────────────────────────────────────
// Returns true when a content piece was saved but its payload is effectively empty
// (LLM returned truncated JSON, empty arrays, or a bare object with no useful data).
// Used by the auto-repair sweep to identify pieces that need regeneration.
// Piece types whose "real content" lives in one specific top-level array key.
// A broken/fallback agent response for these types can still carry unrelated
// scalar fields (e.g. a raw-text dump like `adCopyNotes`), which would fool the
// generic hasScalar short-circuit below into treating it as non-empty. Checking
// the meaningful key directly avoids that false negative. Mirrors the frontend's
// isEmptyApiPiece() switch in campaigns/content.tsx.
const PIECE_TYPE_MEANINGFUL_ARRAY_KEY: Record<string, string> = {
  landing_page_structure: "sections",
  vsl_script: "sections",
  ad_copy: "segments",
  targeting_config: "metaAudiences",
  media_buying_plan: "dailyAllocations",
  // B1-3: content_calendar empty is determined by its "calendar" array — not scalar heuristics.
  // campaignTitle (string) would fool the generic hasScalar path into reporting "not empty".
  content_calendar: "calendar",
};

export function isPieceContentEmpty(content: unknown, pieceType?: string): boolean {
  if (!content || typeof content !== "object") return true;
  const obj = content as Record<string, unknown>;
  if (Object.keys(obj).length === 0) return true;

  if (pieceType === "email_sequence") {
    const es = obj["emailSequence"] as Record<string, unknown[]> | undefined;
    const total =
      (es?.["preLaunch"]?.length ?? 0) + (es?.["cartOpen"]?.length ?? 0) + (es?.["cartClose"]?.length ?? 0);
    return total === 0;
  }

  const meaningfulKey = pieceType ? PIECE_TYPE_MEANINGFUL_ARRAY_KEY[pieceType] : undefined;
  if (meaningfulKey) {
    const arr = obj[meaningfulKey];
    return !Array.isArray(arr) || arr.length === 0;
  }

  // Generic fallback for piece types without a known meaningful array key.
  // If every top-level array in the object is empty, the piece has no real content.
  // Scalars (strings, numbers) count as content so we only apply this when there
  // are no non-array/non-object values at the top level.
  const values = Object.values(obj);
  const hasScalar = values.some(v => typeof v === "string" || typeof v === "number");
  if (hasScalar) return false;
  const arrays = values.filter(v => Array.isArray(v));
  if (arrays.length > 0 && arrays.every(a => (a as unknown[]).length === 0)) return true;
  return false;
}

// ALL piece types that have a dedicated regeneration agent.
// Every type must appear here — the auto-repair sweep now covers the full set.
// Adding a new agent → add its piece type here AND in PIECE_TYPE_TO_AGENT below.
const REGENERABLE_PIECE_TYPES: ReadonlySet<string> = new Set([
  "email_sequence",
  "landing_page_structure",
  "vsl_script",
  "ad_copy",
  "targeting_config",
  "media_buying_plan",
  "creative_direction",
  "content_calendar",
  "prelaunch_warming",
  "cpl_script",
  "webinar_script",
  "live_script",
  "stories_sequence",
  "video_strategy",
  "creator_growth_plan",
  "seo_organic_plan",
  "media_brief",
  "compliance_report",
]);

// ── B2: Contract retry ceiling ────────────────────────────────────────────────
// A piece that keeps failing validation after MAX_CONTRACT_RETRIES regenerations
// stays permanently rejected rather than looping forever.
const MAX_CONTRACT_RETRIES = 2;

// ── B2: Output contract validation (module-level — used by both generateCampaignContent and regeneratePiece) ──
// Returns a human-readable violation string when the piece fails its schema contract,
// or null when the output is structurally sound.
// This intentionally stays lightweight (array-presence checks, not deep Zod parse)
// because it must be fast and allocation-free inside a pipeline hot-path.
export function validatePieceContract(pieceType: string, content: unknown): string | null {
  const obj = (content ?? {}) as Record<string, unknown>;
  switch (pieceType) {
    case "email_sequence": {
      const emailSeq = obj.emailSequence as { preLaunch?: unknown[]; cartOpen?: unknown[] } | undefined;
      if (!emailSeq?.preLaunch) {
        return `email_sequence: missing emailSequence.preLaunch — LLM may have returned wrong schema (keys: [${Object.keys(obj).join(", ")}])`;
      }
      if (emailSeq.preLaunch.length === 0 && (emailSeq.cartOpen?.length ?? 0) === 0) {
        return `email_sequence: preLaunch and cartOpen are empty — LLM returned minimal output`;
      }
      break;
    }
    case "vsl_script": {
      const sections = (obj.sections as unknown[] | undefined)?.length ?? 0;
      if (sections === 0) {
        return `vsl_script: zero sections — LLM returned truncated or empty response`;
      }
      break;
    }
    case "ad_copy": {
      const segs = (obj.segments as unknown[] | undefined)?.length ?? 0;
      const ads = (obj.ads as unknown[] | undefined)?.length ?? 0;
      if (segs === 0 && ads === 0) {
        return `ad_copy: no segments or ads — LLM returned empty response`;
      }
      break;
    }
    case "landing_page_structure": {
      const sections = (obj.sections as unknown[] | undefined)?.length ?? 0;
      const headline = typeof obj.headline === "string" && obj.headline.length > 0;
      const overallStructure = typeof obj.overallStructure === "string" && obj.overallStructure.length > 0;
      if (sections === 0 && !headline && !overallStructure) {
        return `landing_page_structure: missing sections, headline, and overallStructure`;
      }
      break;
    }
    case "cpl_script": {
      const videos = (obj.videos as { hook?: string; structure?: unknown[] }[] | undefined) ?? [];
      if (videos.length === 0) {
        return `cpl_script: no videos — LLM returned empty response`;
      }
      // [#61] Also flag if every video has an empty hook AND empty structure sections
      const allEmpty = videos.every(
        (v) => (!v.hook || v.hook.trim() === "") && (!v.structure || v.structure.length === 0),
      );
      if (allEmpty) {
        return `cpl_script: all videos have empty liveScript (hook+structure) — output degradado`;
      }
      break;
    }
    case "stories_sequence": {
      const sequences = (obj.sequences as unknown[] | undefined)?.length ?? 0;
      if (sequences === 0) {
        return `stories_sequence: no sequences — LLM returned empty response (keys: [${Object.keys(obj).join(", ")}])`;
      }
      break;
    }
    case "targeting_config": {
      const meta = (obj.metaAudiences as unknown[] | undefined)?.length ?? 0;
      const google = (obj.googleAudiences as unknown[] | undefined)?.length ?? 0;
      const tiktok = (obj.tiktokAudiences as unknown[] | undefined)?.length ?? 0;
      if (meta === 0 && google === 0 && tiktok === 0) {
        return `targeting_config: no metaAudiences, googleAudiences, or tiktokAudiences (keys: [${Object.keys(obj).join(", ")}])`;
      }
      break;
    }
  }
  return null;
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export async function generateCampaignContent(
  campaignId: string,
  workspaceId: string,
  log: Logger,
): Promise<ContentGenerationResult> {
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.id, campaignId),
        eq(campaignsTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  if (!(CONTENT_GENERATION_ALLOWED_STATUSES as readonly string[]).includes(campaign.status)) {
    throw new ValidationError(
      `Cannot generate content from status "${campaign.status}". Allowed: ${[...CONTENT_GENERATION_ALLOWED_STATUSES].join(", ")}.`,
    );
  }

  // ── [#56] Serialization lock — prevent concurrent generateCampaignContent runs ──
  // pg_try_advisory_lock is NON-BLOCKING: the first caller acquires the lock (true),
  // all concurrent callers for the same campaignId return false immediately.
  // This prevents B-4: multiple rapid execute/content triggers running the same
  // agents in parallel and creating duplicate content_pieces rows.
  // Lock is session-scoped and released in the finally block at the end of this function.
  let contentAdvisoryLockHash: number | null = null;
  try {
    const lockResult = await db.execute(
      sql`SELECT pg_try_advisory_lock(hashtext(${campaignId})) AS acquired`,
    );
    const row = (Array.isArray(lockResult) ? lockResult[0] : (lockResult as any).rows?.[0]) as Record<string, unknown> | undefined;
    if (row?.["acquired"] === false) {
      log.warn({ campaignId }, "[#56] generateCampaignContent: advisory lock already held by concurrent execution — aborting to prevent duplicate content pieces");
      return {
        campaignId,
        piecesGenerated: 0,
        mediaBriefsGenerated: 0,
        agentsRun: [],
        errors: [],
        status: "completed" as const,
        pieceResults: [],
      };
    }
    // Lock acquired — compute the hash for the unlock call in finally.
    // hashtext() returns a 32-bit integer; cast to number is safe.
    contentAdvisoryLockHash = typeof row?.["acquired"] === "boolean"
      ? (await db.execute(sql`SELECT hashtext(${campaignId}) AS h`).then(
          (r) => Number(((Array.isArray(r) ? r[0] : (r as any).rows?.[0]) as any)?.h ?? 0),
        ).catch(() => null))
      : null;
  } catch (lockErr) {
    // Non-fatal: if advisory lock call fails (e.g. permissions), proceed without lock.
    log.warn({ lockErr, campaignId }, "[#56] Advisory lock check failed — proceeding without lock (non-fatal)");
  }

  let intakeData = (campaign.intakeData ?? {}) as Record<string, unknown>;
  const profile = campaign.audienceData
    ? extractProfile(campaign.audienceData)
    : undefined;
  // RC-003 FIX: DB schema enforces notNull().default({}) on strategyData, so
  // strategy is NEVER null at runtime. The previous `if (!strategy) throw` guard
  // was dead code. We now cast with a safe fallback ({} as StrategyOutput) so
  // TypeScript is satisfied and callers always receive a typed object (possibly empty).
  // Empty strategy is allowed for the "skip strategy → generate content" user flow.
  const strategy = ((campaign.strategyData ?? {}) as unknown) as StrategyOutput;
  const launchPlan = (campaign.timelineData ?? undefined) as
    | Record<string, unknown>
    | undefined;

  const strategyIsEmpty = Object.keys(campaign.strategyData as Record<string, unknown> ?? {}).length === 0;
  if (strategyIsEmpty) {
    log.warn(
      { campaignId },
      "Content generation started with empty strategy data — agents will use intake data only. Quality may be reduced.",
    );
  }

  const agentsRun: string[] = [];
  const errors: { agent: string; error: string }[] = [];
  let piecesGenerated = 0;
  let mediaBriefsGenerated = 0;

  // ── Trava 1: Retry counter + skipped pieces ───────────────────────────────
  // Read contentRetry state from brainData (no schema migration needed).
  // retryCount >= 3 is already blocked at the endpoint layer; here we just
  // consume the state to activate fallback mode and skip user-flagged pieces.
  const brainRaw = ((campaign.brainData ?? {}) as Record<string, unknown>);
  const contentRetry = ((brainRaw["contentRetry"] ?? {}) as Record<string, unknown>);
  const currentRetryCount = (contentRetry["retryCount"] as number | undefined) ?? 0;
  const skippedPieces = ((contentRetry["skippedPieces"] ?? []) as string[]);

  // ── Offer Psychology Layer injection ──────────────────────────────────────
  // Read the 7-agent psychology layer built during the strategy phase and inject
  // it as a structured context block (_psychologyLayer key) into intakeData.
  // The copy agents (ad_copy, vsl_script, landing_page) read this key and include
  // it in their user message — giving them pricing, objections, hooks, and scarcity
  // context they previously lacked.
  //
  // PRECONDITION CHECK: for campaign types that run the psychology pipeline,
  // the layer must be present AND complete before content generation proceeds.
  // "Complete" means at least 3 of the 6 agent sections must be non-null AND
  // hook_factory (the synthesizer that requires A+B) must be present.
  // Partial layers (e.g. only 1 agent succeeded) are insufficient context for copy.
  const campaignTypeForPsychCheck = String(campaign.type ?? "launch");
  const offerPsychologyLayer = (brainRaw["offerPsychologyLayer"] ?? null) as Record<string, unknown> | null;
  assertPsychologyLayerComplete(campaignTypeForPsychCheck, offerPsychologyLayer);
  if (offerPsychologyLayer) {
    const psychBlocks: string[] = [];
    const psy_pricing = offerPsychologyLayer.pricing as Record<string, unknown> | null;
    const psy_obj = offerPsychologyLayer.objections as Record<string, unknown> | null;
    const psy_hooks = offerPsychologyLayer.hooks as Record<string, unknown> | null;
    const psy_scarcity = offerPsychologyLayer.scarcity as Record<string, unknown> | null;
    const psy_upsell = offerPsychologyLayer.upsell as Record<string, unknown> | null;
    const psy_testimonials = offerPsychologyLayer.testimonials as Record<string, unknown> | null;

    if (psy_pricing) {
      psychBlocks.push([
        `## Pricing Psychology`,
        `Preço recomendado: R$${(psy_pricing as any).recommendedPrice ?? ""} | Justificativa: ${(psy_pricing as any).priceJustification ?? ""}`,
        `Ancoramento: ${(psy_pricing as any).anchoring?.anchorScript ?? ""}`,
        `Parcelamento: ${(psy_pricing as any).paymentPlanPsychology?.recommendedStructure ?? ""}`,
        `Garantia: ${(psy_pricing as any).guaranteeStrategy?.type ?? ""} — ${(psy_pricing as any).guaranteeStrategy?.guaranteeCopy ?? ""}`,
      ].filter(Boolean).join("\n"));
    }
    if (psy_obj) {
      const kills = ((psy_obj as any).topObjections as unknown[] ?? [])
        .slice(0, 5)
        .map((o: any) => `- "${o.objection}": ${o.killer}`)
        .join("\n");
      if (kills) psychBlocks.push(`## Objection Kills\n${kills}`);
    }
    if (psy_hooks) {
      const topHooks = ((psy_hooks as any).hooks as unknown[] ?? [])
        .filter((h: any) => h.estimatedCTR === "very_high" || h.estimatedCTR === "high")
        .slice(0, 5)
        .map((h: any) => `- [${h.type}] ${h.hook}`)
        .join("\n");
      if (topHooks) {
        psychBlocks.push([
          `## High-CTR Hooks`,
          topHooks,
          `Hook vencedor: ${(psy_hooks as any).winnerRecommendation?.reasoning ?? ""}`,
        ].join("\n"));
      }
    }
    if (psy_scarcity) {
      const primaryScarcity = (psy_scarcity as any).primaryScarcity;
      if (primaryScarcity) {
        psychBlocks.push([
          `## Scarcity Architecture`,
          `Mecanismo: ${primaryScarcity.mechanism ?? ""}`,
          `Script de urgência: ${primaryScarcity.script ?? ""}`,
        ].join("\n"));
      }
    }
    if (psy_upsell) {
      const upsells = ((psy_upsell as any).upsells as unknown[] ?? [])
        .slice(0, 3)
        .map((u: any) => `- ${u.name} (R$${u.price}): ${u.pitch ?? u.positioning ?? ""}`)
        .join("\n");
      if (upsells) psychBlocks.push(`## Upsell Architecture\n${upsells}`);
    }
    if (psy_testimonials) {
      const strategy_proof = (psy_testimonials as any).collectionStrategy?.immediateRequests?.slice(0, 3)?.join("; ");
      if (strategy_proof) psychBlocks.push(`## Proof Strategy\nBuscar depoimentos sobre: ${strategy_proof}`);
    }

    if (psychBlocks.length > 0) {
      intakeData = {
        ...intakeData,
        _psychologyLayer: `# Offer Psychology Layer (Agentes de Psicologia de Oferta)\n\n${psychBlocks.join("\n\n")}`,
      };
      log.info({ campaignId, sections: psychBlocks.length }, "[PSYCH-LAYER] injected into content agent context");
    }
  }

  // ── Compliance hint injection ─────────────────────────────────────────────
  // If a previous COMPLIANCE_VIOLATION autocorrection stored a rewrite directive
  // for the last-failed piece type, inject it into agent.runner so the LLM
  // receives it as a COMPLIANCE OVERRIDE block in the system prompt.
  const complianceCorrections = ((contentRetry["complianceCorrections"] ?? {}) as Record<string, string>);
  const lastFailedPieceType = (contentRetry["lastFailedPieceType"] as string | undefined) ?? "";
  const activeComplianceHint = complianceCorrections[lastFailedPieceType];
  if (activeComplianceHint) {
    setComplianceHint(activeComplianceHint);
    log.info({ campaignId, lastFailedPieceType }, "[ETHICS-AUTOCORRECT] Compliance hint injected for piece type %s", lastFailedPieceType);
  }

  // Trava 2: Fallback model on retry — on 2nd+ attempt, swap heavy models
  // for lighter alternatives to break context-overflow / safety-block loops.
  if (currentRetryCount >= 2) {
    setFallbackMode(true);
    log.warn({ campaignId, retryCount: currentRetryCount }, "[FAILSAFE] Retry #%d — activating fallback models (haiku/gpt-4o-mini)", currentRetryCount);
  }

  const campaignType = String(intakeData["campaign.type"] ?? campaign.type ?? "launch");
  const salesChannel = String(intakeData["campaign.salesChannel"] ?? "sales_page");
  const trafficBudget = Number(intakeData["campaign.budget.traffic"] ?? 0);
  const hasTrafficBudget = trafficBudget > 0;

  // ── Budget Reverse Engineering ────────────────────────────────────────────────
  // If no traffic budget was set but a revenue target exists, calculate a
  // proposed budget using CPL/conversion benchmarks so targeting and media
  // buying agents are NEVER silently skipped.  The pieces are inserted with
  // status "budget_proposed" instead of "pending_approval" so the user knows
  // they need to confirm/adjust before the plan is actionable.
  let isReverseBudget = false;
  let agentIntakeData: Record<string, unknown> = intakeData;

  if (!hasTrafficBudget) {
    const revenueTarget = Number(intakeData["campaign.revenueTarget"] ?? 0);
    if (revenueTarget > 0) {
      const proposal = await calculateReverseBudget(campaignId, workspaceId, intakeData, log);
      if (proposal && proposal.budgetMid > 0) {
        isReverseBudget = true;
        agentIntakeData = {
          ...intakeData,
          "campaign.budget.traffic": proposal.budgetMid,
          "campaign.budget.traffic_is_proposed": true,
          "campaign.budget.traffic_reasoning": proposal.reasoning,
        };
        await saveBudgetProposal(campaignId, workspaceId, proposal, log);
        emitCampaignEvent({
          campaignId,
          type: "agent_started",
          agentType: "budget_reverse",
          message:
            `Nenhum budget informado — Engenharia Reversa calculou ` +
            `R$${proposal.budgetMid.toLocaleString("pt-BR")} ` +
            `para meta de R$${revenueTarget.toLocaleString("pt-BR")} ` +
            `(ROAS implícito ${proposal.impliedROAS}x). ` +
            `Gerando Targeting e Media Buying com budget proposto...`,
          data: { budgetMid: proposal.budgetMid, impliedROAS: proposal.impliedROAS },
          timestamp: new Date().toISOString(),
        });
      } else {
        emitCampaignEvent({
          campaignId,
          type: "budget_skip_warning",
          message:
            "Budget de tráfego não informado e não foi possível calcular proposta " +
            "(preço do produto ausente?). Targeting e Media Buying não foram gerados. " +
            "Informe o preço do produto no intake para ativar o cálculo automático.",
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      emitCampaignEvent({
        campaignId,
        type: "budget_skip_warning",
        message:
          "Budget de tráfego não informado e sem meta de resultado definida. " +
          "Targeting e Media Buying não foram gerados. " +
          "Acesse as configurações da campanha para informar o budget ou a meta de receita.",
        timestamp: new Date().toISOString(),
      });
    }
  }

  const runTrafficAgents = hasTrafficBudget || isReverseBudget;

  const isCreatorCampaign = ["audience_growth", "creator_monetization"].includes(campaignType);
  const isVideoFocused = isCreatorCampaign || salesChannel === "youtube";

  // ── CHECKPOINT SYSTEM ──────────────────────────────────────────────────────
  // Load existing content pieces for this campaign. After a server restart,
  // the job is re-enqueued and the processor resumes from where it left off:
  // agents whose output is already saved in contentPiecesTable are skipped
  // automatically — no LLM call, no credits charged, no duplicate piece.
  //
  // skipAgent(): returns true (skip) if the piece already exists, false (run) otherwise.
  // Emits "agent_completed" on skip so the live feed stays accurate.
  const existingPieces = await db
    .select({ type: contentPiecesTable.type })
    .from(contentPiecesTable)
    .where(eq(contentPiecesTable.campaignId, campaignId));
  const done = new Set<string>(existingPieces.map((p) => p.type));
  // Trava 1 (cont.): also skip user-flagged pieces so deterministic failures
  // don't block the rest of the pipeline on retry.
  for (const s of skippedPieces) done.add(s);
  const isResume = campaign.status === "generating";

  if (done.size > 0) {
    log.info({ campaignId, done: [...done], isResume, skippedPieces }, "CHECKPOINT: resuming content generation — skipping already completed agents");
  }

  // Agent → canonical piece type mapping (must match contentTypeEnum in lib/db/src/schema/content.ts
  // AND the pieceType keys passed to skipAgent() calls throughout this function).
  // Non-canonical values here cause lastFailedPieceType to mismatch skippedPieces keys → auto-skip
  // targets the wrong piece type → deterministic failure loop never breaks.
  const AGENT_PIECE_TYPE: Record<string, string> = {
    creative_director: "creative_direction",
    copywriter: "email_sequence",
    social_media: "content_calendar",       // skipAgent uses "content_calendar"
    ad_copy: "ad_copy",
    vsl_script: "vsl_script",
    cpl_script: "cpl_script",
    webinar_script: "webinar_script",
    live_script: "live_script",
    stories_sequence: "stories_sequence",
    landing_page: "landing_page_structure", // skipAgent uses "landing_page_structure"
    targeting: "targeting_config",
    media_buyer: "media_buying_plan",
    video_strategy: "video_strategy",
    creator_growth: "creator_growth_plan",  // skipAgent uses "creator_growth_plan"
    compliance: "compliance_report",        // skipAgent uses "compliance_report"
    // prelaunch_warming is intentionally mapped to its own skipAgent key ("prelaunch_warming"),
    // NOT to "content_calendar". Mapping to "content_calendar" would cause auto-skip to add
    // "content_calendar" to skippedPieces, which would then skip the social_media agent too
    // (collision). The skipAgent call for prelaunch uses "prelaunch_warming" as its skip key,
    // so the lastFailedPieceType must also be "prelaunch_warming" for skip targeting to be precise.
    // Note: "prelaunch_warming" is not a DB enum value — placeholder insert guards against this.
    prelaunch_warming: "prelaunch_warming", // skipAgent key, NOT a DB content_type enum value
    organic_traffic: "seo_organic_plan",    // skipAgent uses "seo_organic_plan"
    media_brief: "media_brief",             // skipAgent uses "media_brief"
  };

  // ── [C3] Extend done Set with completed campaign_agents rows ─────────────────
  // Covers the restart gap: runAgent completed (credits charged, campaign_agents
  // updated to status=completed) but the server crashed BEFORE contentPiecesTable
  // INSERT. On restart, skipAgent would return false (no piece in DB) and re-run
  // the agent — charging credits again.
  // Fix: if campaign_agents has a completed row for this agentType, treat the
  // piece as done so the agent is NOT re-run (and credits NOT re-charged).
  try {
    const completedAgents = await db
      .select({ agentType: campaignAgentsTable.agentType })
      .from(campaignAgentsTable)
      .where(
        and(
          eq(campaignAgentsTable.campaignId, campaignId),
          eq(campaignAgentsTable.status, "completed"),
        ),
      );

    for (const { agentType } of completedAgents) {
      const pieceType = AGENT_PIECE_TYPE[agentType as string];
      if (pieceType && !done.has(pieceType)) {
        done.add(pieceType);
        log.warn(
          { campaignId, agentType, pieceType },
          "[C3] CHECKPOINT: agent completed (campaign_agents) but content piece missing — skipping agent to prevent double credit charge",
        );
      }
    }
  } catch (c3Err) {
    log.warn({ c3Err, campaignId }, "[C3] Failed to load completed agents for skip-check (non-fatal — pipeline continues)");
  }

  const skipAgent = (pieceType: string, agentName: string): boolean => {
    if (!done.has(pieceType)) return false;
    agentsRun.push(agentName);
    piecesGenerated++;
    if (skippedPieces.includes(pieceType)) {
      log.info({ campaignId, agentName, pieceType }, "CHECKPOINT: agent skipped by user request");
      emitCampaignEvent({
        campaignId,
        type: "agent_completed",
        agentType: agentName,
        message: `${agentName} — ⏭ pulado pelo usuário`,
        timestamp: new Date().toISOString(),
      });
    } else {
      log.info({ campaignId, agentName, pieceType }, "CHECKPOINT: agent already completed — skipping LLM call");
      emitCampaignEvent({
        campaignId,
        type: "agent_completed",
        agentType: agentName,
        message: `${agentName} — ✓ retomado do checkpoint (saída já salva)`,
        timestamp: new Date().toISOString(),
      });
    }
    return true;
  };

  // validatePieceContract is now a module-level export (see above generateCampaignContent).
  // B2: violations now BLOCK the piece (status="rejected") and trigger auto-reprocess.

  // Only transition to "generating" on a fresh run — skip if already there (resume after restart)
  if (!isResume) {
    await transitionCampaign(campaignId, workspaceId, "generating", "content generation phase started", log);
  }

  emitCampaignEvent({
    campaignId,
    type: "phase_changed",
    message: "Iniciando produção de conteúdo — agentes em execução...",
    data: { phase: "content_production" },
    timestamp: new Date().toISOString(),
  });

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "content.generation.started",
    actor: "system",
    data: {
      hasProfile: !!profile,
      hasStrategy: !!strategy,
      hasLaunchPlan: !!launchPlan,
      campaignType,
      salesChannel,
      hasTrafficBudget,
    },
  });

  // ── Campaign Emotional Arc ────────────────────────────────────────────────────
  // Generated BEFORE any content agent runs. Provides the 9-phase psychological
  // progression map so every agent knows WHERE in the funnel each piece belongs.
  // Fire-and-wait: arc must exist before CPL/live/stories/webinar agents consume it.
  // Idempotency is handled inside generateCampaignEmotionalArc via brainData.emotionalArc.
  const arc = await generateCampaignEmotionalArc(campaignId, workspaceId, intakeData, strategy, log);
  if (arc) {
    // Mirror arc into in-memory intakeData so phase-aware helpers (getArcFromIntakeData,
    // buildArcOverviewBlock) work for the current generation session without extra DB reads.
    intakeData = { ...intakeData, _emotionalArc: arc };
  }

  // Pre-compute phase contexts for phase-aware agents
  const arcOverviewBlock = arc ? buildArcOverviewBlock(arc) : "";
  const cartOpenState = arc ? getAvatarStateForPhase(arc, "cart_open") : null;
  const cartPhaseBlock = cartOpenState ? buildPhaseStateBlock(cartOpenState) : arcOverviewBlock;

  // Capture copy and ad content references for compliance agent (set after generation)
  let capturedCopyContent: Record<string, unknown> | undefined;
  let capturedAdContent: Record<string, unknown> | undefined;

  // ── Pipeline heartbeat ────────────────────────────────────────────────────────
  // Updates pipelineCheckpoint.lastProgressAt every 90 seconds while agents run.
  // The stuck-campaign scheduler (sequence-scheduler.worker.ts) checks this field
  // to distinguish "running but slow" from "truly stuck" — preventing false resets
  // that would interrupt legitimate 30-60 min content generation pipelines.
  const heartbeatInterval = setInterval(() => {
    db.select({ bd: (campaignsTable as any).brainData })
      .from(campaignsTable)
      .where(eq(campaignsTable.id, campaignId))
      .limit(1)
      .then(([row]) => {
        const brain = ((row?.bd ?? {}) as Record<string, unknown>);
        const cp = ((brain["pipelineCheckpoint"] ?? {}) as Record<string, unknown>);
        const nowIso = new Date().toISOString();
        return db.update(campaignsTable).set({
          updatedAt: new Date(),
          brainData: { ...brain, pipelineCheckpoint: { ...cp, lastProgressAt: nowIso } } as any,
        }).where(eq(campaignsTable.id, campaignId));
      })
      .catch(() => { /* non-fatal — heartbeat is best-effort */ });
  }, 90_000);

  try {
  // ── 1. Creative Director (all campaigns — sets visual identity first) ─────────
  if (!skipAgent("creative_direction", "creative_director")) try {
    emitCampaignEvent({
      campaignId,
      type: "agent_started",
      agentType: "creative_director",
      message: "Agente Creative Director — definindo identidade visual da campanha...",
      timestamp: new Date().toISOString(),
    });

    const creativeOutput = await runCreativeDirectorAgent(
      campaignId,
      workspaceId,
      intakeData,
      profile,
      log,
    );

    const [piece] = await db
      .insert(contentPiecesTable)
      .values({
        campaignId,
        workspaceId,
        type: "creative_direction",
        status: "pending_approval",
        title: `Direção Criativa — ${creativeOutput.campaignTitle}`,
        content: creativeOutput as any,
        aiProvider: "openai",
        creditsUsed: 40,
      })
      .returning();

    piecesGenerated++;
    agentsRun.push("creative_director");

    emitCampaignEvent({
      campaignId,
      type: "agent_completed",
      agentType: "creative_director",
      message: `Creative Director concluído — identidade visual completa com ${Object.keys(creativeOutput.colorSystem).length} tokens de cor + tipografia + guia de estilo`,
      data: { pieceId: piece?.id },
      timestamp: new Date().toISOString(),
    });

    log.info({ campaignId, pieceId: piece?.id }, "Creative director agent completed");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push({ agent: "creative_director", error: msg });
    log.error({ err, campaignId }, "Creative director agent failed");
    emitAgentError(campaignId, "creative_director", err);
  }

  // ── 2. Copywriter Agent ──────────────────────────────────────────────────────
  if (!skipAgent("email_sequence", "copywriter")) try {
    emitCampaignEvent({
      campaignId,
      type: "agent_started",
      agentType: "copywriter",
      message: "Agente Copywriter — escrevendo toda a copy da campanha...",
      timestamp: new Date().toISOString(),
    });

    const copyOutput = await runCopywriterAgent(
      campaignId,
      workspaceId,
      intakeData,
      strategy,
      profile,
      launchPlan,
      log,
    );

    capturedCopyContent = copyOutput as unknown as Record<string, unknown>;

    const copyContractWarn = validatePieceContract("email_sequence", copyOutput);

    // B2: contract violation → rejected + auto-reprocess; no violation → pending_approval
    if (copyContractWarn) {
      log.warn({ campaignId, contractWarn: copyContractWarn }, "[B2] email_sequence contract violation — blocking (status=rejected), scheduling reprocess");
      const [blocked] = await db
        .insert(contentPiecesTable)
        .values({
          campaignId,
          workspaceId,
          type: "email_sequence",
          status: "rejected",
          rejectionReason: "contract",
          title: `Copy Completa — ${copyOutput.campaignTitle ?? "Campanha"}`,
          content: { ...copyOutput, _qualityScore: (copyOutput as any)._qualityScore ?? null, _contractViolation: copyContractWarn, _retryCount: 0 } as any,
          aiProvider: "openai",
          creditsUsed: 80,
        })
        .returning();
      emitCampaignEvent({
        campaignId,
        type: "contract_violation",
        agentType: "copywriter",
        message: `⚠️ email_sequence violou o contrato — bloqueado para reprocessamento automático`,
        data: { pieceId: blocked?.id, reason: copyContractWarn },
        timestamp: new Date().toISOString(),
      });
      if (blocked) {
        setImmediate(() => {
          regeneratePiece(campaignId, workspaceId, blocked.id, log).catch(err => {
            log.error({ err, campaignId, pieceId: blocked.id }, "[B2] email_sequence auto-reprocess failed");
          });
        });
      }
    } else {
      const [piece] = await db
        .insert(contentPiecesTable)
        .values({
          campaignId,
          workspaceId,
          type: "email_sequence",
          status: "pending_approval",
          title: `Copy Completa — ${copyOutput.campaignTitle ?? "Campanha"}`,
          content: { ...copyOutput, _qualityScore: (copyOutput as any)._qualityScore ?? null } as any,
          aiProvider: "openai",
          creditsUsed: 80,
        })
        .returning();
      emitCampaignEvent({
        campaignId,
        type: "agent_completed",
        agentType: "copywriter",
        message: `Copywriter concluído — ${(copyOutput.emailSequence?.preLaunch?.length ?? 0) + (copyOutput.emailSequence?.cartOpen?.length ?? 0) + (copyOutput.emailSequence?.cartClose?.length ?? 0)} e-mails + página de vendas + WhatsApp`,
        data: { pieceId: piece?.id },
        timestamp: new Date().toISOString(),
      });
      log.info({ campaignId, pieceId: piece?.id }, "Copywriter agent completed");
    }

    piecesGenerated++;
    agentsRun.push("copywriter");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push({ agent: "copywriter", error: msg });
    log.error({ err, campaignId }, "Copywriter agent failed");
    emitAgentError(campaignId, "copywriter", err);
  }

  // ── 3. Landing Page Agent (all campaigns with page-based sales) ──────────────
  const hasLandingPage = !["challenge_funnel"].includes(campaignType);

  if (hasLandingPage) {
    if (!skipAgent("landing_page_structure", "landing_page")) try {
      emitCampaignEvent({
        campaignId,
        type: "agent_started",
        agentType: "landing_page",
        message: "Agente Landing Page — estruturando página de vendas com CRO...",
        timestamp: new Date().toISOString(),
      });

      const lpOutput = await runLandingPageAgent(
        campaignId,
        workspaceId,
        intakeData,
        strategy,
        profile,
        log,
      );

      const lpContractWarn = validatePieceContract("landing_page_structure", lpOutput);

      // B2: contract violation → rejected + auto-reprocess
      if (lpContractWarn) {
        log.warn({ campaignId, contractWarn: lpContractWarn }, "[B2] landing_page_structure contract violation — blocking (status=rejected), scheduling reprocess");
        const [blocked] = await db
          .insert(contentPiecesTable)
          .values({
            campaignId,
            workspaceId,
            type: "landing_page_structure",
            status: "rejected",
            rejectionReason: "contract",
            title: `Página de Vendas — ${lpOutput.sections?.length ?? 0} seções | ${lpOutput.pageType ?? "vsl"}`,
            content: { ...lpOutput, _qualityScore: (lpOutput as any)._qualityScore ?? null, _contractViolation: lpContractWarn, _retryCount: 0 } as any,
            aiProvider: "openai",
            creditsUsed: 65,
          })
          .returning();
        emitCampaignEvent({
          campaignId,
          type: "contract_violation",
          agentType: "landing_page",
          message: `⚠️ landing_page_structure violou o contrato — bloqueado para reprocessamento automático`,
          data: { pieceId: blocked?.id, reason: lpContractWarn },
          timestamp: new Date().toISOString(),
        });
        if (blocked) {
          setImmediate(() => {
            regeneratePiece(campaignId, workspaceId, blocked.id, log).catch(err => {
              log.error({ err, campaignId, pieceId: blocked.id }, "[B2] landing_page auto-reprocess failed");
            });
          });
        }
      } else {
        const [piece] = await db
          .insert(contentPiecesTable)
          .values({
            campaignId,
            workspaceId,
            type: "landing_page_structure",
            status: "pending_approval",
            title: `Página de Vendas — ${lpOutput.sections?.length ?? 0} seções | ${lpOutput.pageType ?? "vsl"}`,
            content: { ...lpOutput, _qualityScore: (lpOutput as any)._qualityScore ?? null } as any,
            aiProvider: "openai",
            creditsUsed: 65,
          })
          .returning();
        emitCampaignEvent({
          campaignId,
          type: "agent_completed",
          agentType: "landing_page",
          message: `Landing Page concluída — ${lpOutput.sections.length} seções wireframadas com copy + specs técnicas`,
          data: { pieceId: piece?.id },
          timestamp: new Date().toISOString(),
        });
        log.info({ campaignId, pieceId: piece?.id, sections: lpOutput.sections.length }, "Landing page agent completed");
      }

      piecesGenerated++;
      agentsRun.push("landing_page");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ agent: "landing_page", error: msg });
      log.error({ err, campaignId }, "Landing page agent failed");
      emitAgentError(campaignId, "landing_page", err);
    }
  }

  // ── 4. Social Media Agent ────────────────────────────────────────────────────
  if (!skipAgent("content_calendar", "social_media")) try {
    emitCampaignEvent({
      campaignId,
      type: "agent_started",
      agentType: "social_media",
      message: "Agente Social Media — montando calendário de conteúdo...",
      timestamp: new Date().toISOString(),
    });

    const socialOutput = await runSocialMediaAgent(
      campaignId,
      workspaceId,
      intakeData,
      strategy,
      profile,
      launchPlan,
      log,
    );

    // B1-2: Block saving calendar:[] as pending_approval.
    // Zero posts = explicit failure — save a sentinel (status:"rejected", _calendarEmpty:true)
    // so the auto-repair sweep detects and regenerates it.
    // isPieceContentEmpty now checks the "calendar" key directly for content_calendar pieces.
    if (socialOutput.calendar.length === 0) {
      log.warn({ campaignId }, "[B1] Social media returned calendar:[] — blocking pending_approval, saving sentinel for auto-repair");
      emitCampaignEvent({
        campaignId,
        type: "agent_failed",
        agentType: "social_media",
        message: "Agente Social Media retornou calendário vazio (0 posts) — auto-reparo disparado automaticamente",
        timestamp: new Date().toISOString(),
      });
      // Sentinel piece: status "rejected" (not pending_approval), content signals empty state.
      // Auto-repair sweep queries ALL pieces regardless of status — will detect and regenerate this.
      await db.insert(contentPiecesTable).values({
        campaignId,
        workspaceId,
        type: "content_calendar",
        status: "rejected",
        title: "Calendário de Social Media — aguardando auto-reparo",
        content: {
          _calendarEmpty: true,
          _notGenerated: true,
          calendar: [],
          totalDays: socialOutput.totalDays || 0,
          campaignTitle: socialOutput.campaignTitle || "",
        } as any,
        aiProvider: "openai",
        creditsUsed: 0,
      });
      // Track as error, not success — do NOT increment piecesGenerated or agentsRun
      errors.push({ agent: "social_media", error: "calendar:[] — 0 posts returned; auto-repair required" });
    } else {
      // Calendar has posts — normal success path
      const [piece] = await db
        .insert(contentPiecesTable)
        .values({
          campaignId,
          workspaceId,
          type: "content_calendar",
          status: "pending_approval",
          title: `Calendário de Social Media — ${socialOutput.totalDays} dias`,
          content: socialOutput as any,
          aiProvider: "openai",
          creditsUsed: 60,
        })
        .returning();

      piecesGenerated++;
      agentsRun.push("social_media");

      emitCampaignEvent({
        campaignId,
        type: "agent_completed",
        agentType: "social_media",
        message: `Social Media concluído — ${socialOutput.calendar.length} posts em ${socialOutput.totalDays} dias`,
        data: { pieceId: piece?.id },
        timestamp: new Date().toISOString(),
      });

      log.info({ campaignId, pieceId: piece?.id, posts: socialOutput.calendar.length }, "Social media agent completed");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push({ agent: "social_media", error: msg });
    log.error({ err, campaignId }, "Social media agent failed");
    emitAgentError(campaignId, "social_media", err);
  }

  // ── 5. Ad Copy Agent ─────────────────────────────────────────────────────────
  if (!skipAgent("ad_copy", "ad_copy")) try {
    emitCampaignEvent({
      campaignId,
      type: "agent_started",
      agentType: "ad_copy",
      message: "Agente Ad Copy — criando anúncios para Meta, Google e TikTok...",
      timestamp: new Date().toISOString(),
    });

    const adOutput = await runAdCopyAgent(
      campaignId,
      workspaceId,
      intakeData,
      strategy,
      profile,
      log,
    );

    capturedAdContent = adOutput as unknown as Record<string, unknown>;

    const adContractWarn = validatePieceContract("ad_copy", adOutput);

    // B2: contract violation → rejected + auto-reprocess
    if (adContractWarn) {
      log.warn({ campaignId, contractWarn: adContractWarn }, "[B2] ad_copy contract violation — blocking (status=rejected), scheduling reprocess");
      const [blocked] = await db
        .insert(contentPiecesTable)
        .values({
          campaignId,
          workspaceId,
          type: "ad_copy",
          status: "rejected",
          rejectionReason: "contract",
          title: `Pacote de Anúncios — ${(adOutput.segments?.length ?? 0)} segmentos`,
          content: { ...adOutput, _qualityScore: (adOutput as any)._qualityScore ?? null, _contractViolation: adContractWarn, _retryCount: 0 } as any,
          aiProvider: "openai",
          creditsUsed: 50,
        })
        .returning();
      emitCampaignEvent({
        campaignId,
        type: "contract_violation",
        agentType: "ad_copy",
        message: `⚠️ ad_copy violou o contrato — bloqueado para reprocessamento automático`,
        data: { pieceId: blocked?.id, reason: adContractWarn },
        timestamp: new Date().toISOString(),
      });
      if (blocked) {
        setImmediate(() => {
          regeneratePiece(campaignId, workspaceId, blocked.id, log).catch(err => {
            log.error({ err, campaignId, pieceId: blocked.id }, "[B2] ad_copy auto-reprocess failed");
          });
        });
      }
    } else {
      const [piece] = await db
        .insert(contentPiecesTable)
        .values({
          campaignId,
          workspaceId,
          type: "ad_copy",
          status: "pending_approval",
          title: `Pacote de Anúncios — ${(adOutput.segments?.length ?? 0)} segmentos`,
          content: { ...adOutput, _qualityScore: (adOutput as any)._qualityScore ?? null } as any,
          aiProvider: "openai",
          creditsUsed: 50,
        })
        .returning();
      emitCampaignEvent({
        campaignId,
        type: "agent_completed",
        agentType: "ad_copy",
        message: `Ad Copy concluído — ${adOutput.segments?.length ?? 0} segmentos com Meta + Google + TikTok`,
        data: { pieceId: piece?.id },
        timestamp: new Date().toISOString(),
      });
      log.info({ campaignId, pieceId: piece?.id }, "Ad copy agent completed");
    }

    piecesGenerated++;
    agentsRun.push("ad_copy");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push({ agent: "ad_copy", error: msg });
    log.error({ err, campaignId }, "Ad copy agent failed");
    emitAgentError(campaignId, "ad_copy", err);
  }

  // ── 6. Targeting Agent (campaigns with traffic budget OR reverse-engineered budget) ──
  // capturedTargetingOutput is passed downstream to media buyer (explicit dependency).
  // When isReverseBudget=true, agentIntakeData already has the proposed budget injected.
  let capturedTargetingOutput: TargetingOutput | undefined;

  if (runTrafficAgents) {
    if (!skipAgent("targeting_config", "targeting")) try {
      emitCampaignEvent({
        campaignId,
        type: "agent_started",
        agentType: "targeting",
        message: isReverseBudget
          ? `Agente Targeting — configurando audiências com budget proposto R$${Number(agentIntakeData["campaign.budget.traffic"]).toLocaleString("pt-BR")}...`
          : "Agente Targeting — configurando audiências no Meta, Google e TikTok...",
        timestamp: new Date().toISOString(),
      });

      // Chunked delivery: runTargetingAgent internally runs 3 focused calls
      // (Meta → Google → TikTok+UTMs) in parallel, each with its own token budget.
      // No single call ever generates the full output — truncation structurally impossible.
      const targetingOutput = await runTargetingAgent(
        campaignId,
        workspaceId,
        agentIntakeData,
        profile,
        log,
      );

      const targetingContractWarn = validatePieceContract("targeting_config", targetingOutput);

      capturedTargetingOutput = targetingOutput;

      // B2: contract violation → rejected + auto-reprocess
      if (targetingContractWarn) {
        log.warn({ campaignId, contractWarn: targetingContractWarn }, "[B2] targeting_config contract violation — blocking (status=rejected), scheduling reprocess");
        const [blocked] = await db
          .insert(contentPiecesTable)
          .values({
            campaignId,
            workspaceId,
            type: "targeting_config",
            status: "rejected",
            rejectionReason: "contract",
            title: `Configuração de Audiências — ${(targetingOutput.metaAudiences?.length ?? 0)} Meta + ${(targetingOutput.googleAudiences?.length ?? 0)} Google + ${(targetingOutput.tiktokAudiences?.length ?? 0)} TikTok`,
            content: { ...targetingOutput, _contractViolation: targetingContractWarn, _retryCount: 0 } as any,
            aiProvider: "openai",
            creditsUsed: 55,
          })
          .returning();
        emitCampaignEvent({
          campaignId,
          type: "contract_violation",
          agentType: "targeting",
          message: `⚠️ targeting_config violou o contrato — bloqueado para reprocessamento automático`,
          data: { pieceId: blocked?.id, reason: targetingContractWarn },
          timestamp: new Date().toISOString(),
        });
        if (blocked) {
          setImmediate(() => {
            regeneratePiece(campaignId, workspaceId, blocked.id, log).catch(err => {
              log.error({ err, campaignId, pieceId: blocked.id }, "[B2] targeting auto-reprocess failed");
            });
          });
        }
      } else {
        const [piece] = await db
          .insert(contentPiecesTable)
          .values({
            campaignId,
            workspaceId,
            type: "targeting_config",
            status: isReverseBudget ? "budget_proposed" : "pending_approval",
            title: `Configuração de Audiências — ${(targetingOutput.metaAudiences?.length ?? 0)} Meta + ${(targetingOutput.googleAudiences?.length ?? 0)} Google + ${(targetingOutput.tiktokAudiences?.length ?? 0)} TikTok${isReverseBudget ? " [Budget Proposto]" : ""}`,
            content: { ...targetingOutput, _budgetProposed: isReverseBudget } as any,
            aiProvider: "openai",
            creditsUsed: 55,
          })
          .returning();
        emitCampaignEvent({
          campaignId,
          type: "agent_completed",
          agentType: "targeting",
          message: `Targeting concluído — ${(targetingOutput.metaAudiences?.length ?? 0) + (targetingOutput.googleAudiences?.length ?? 0) + (targetingOutput.tiktokAudiences?.length ?? 0)} audiências configuradas + UTMs prontos`,
          data: { pieceId: piece?.id },
          timestamp: new Date().toISOString(),
        });
        log.info({ campaignId, pieceId: piece?.id }, "Targeting agent completed");
      }

      piecesGenerated++;
      agentsRun.push("targeting");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ agent: "targeting", error: msg });
      log.error({ err, campaignId }, "Targeting agent failed");
      emitAgentError(campaignId, "targeting", err);
    }
  }

  // ── 7. Media Buyer Agent (campaigns with traffic budget OR reverse-engineered budget) ──
  if (runTrafficAgents) {
    if (!skipAgent("media_buying_plan", "media_buyer")) try {
      emitCampaignEvent({
        campaignId,
        type: "agent_started",
        agentType: "media_buyer",
        message: isReverseBudget
          ? `Agente Media Buyer — planejando veiculação com budget proposto R$${Number(agentIntakeData["campaign.budget.traffic"]).toLocaleString("pt-BR")}...`
          : "Agente Media Buyer — planejando veiculação e alocação diária de budget...",
        timestamp: new Date().toISOString(),
      });

      // Pass targeting audiences summary so media buyer has explicit audience context.
      const targetingAudiences = capturedTargetingOutput
        ? {
            meta: capturedTargetingOutput.metaAudiences?.length ?? 0,
            google: capturedTargetingOutput.googleAudiences?.length ?? 0,
            tiktok: capturedTargetingOutput.tiktokAudiences?.length ?? 0,
            notes: capturedTargetingOutput.targetingNotes ?? "",
          }
        : undefined;

      const mediaBuyerOutput = await runMediaBuyerAgent(
        campaignId,
        workspaceId,
        agentIntakeData,
        strategy,
        profile,
        launchPlan,
        log,
        targetingAudiences,
      );

      const [piece] = await db
        .insert(contentPiecesTable)
        .values({
          campaignId,
          workspaceId,
          type: "media_buying_plan",
          status: isReverseBudget ? "budget_proposed" : "pending_approval",
          title: `Plano de Media Buying — R$${mediaBuyerOutput.totalBudget} | ${mediaBuyerOutput.dailyAllocations.length} dias${isReverseBudget ? " [Budget Proposto]" : ""}`,
          content: { ...mediaBuyerOutput, _budgetProposed: isReverseBudget } as any,
          aiProvider: "openai",
          creditsUsed: 60,
        })
        .returning();

      piecesGenerated++;
      agentsRun.push("media_buyer");

      emitCampaignEvent({
        campaignId,
        type: "agent_completed",
        agentType: "media_buyer",
        message: `Media Buyer concluído — budget diário + regras de escala + critérios de corte + plano de testes A/B`,
        data: { pieceId: piece?.id },
        timestamp: new Date().toISOString(),
      });

      log.info({ campaignId, pieceId: piece?.id }, "Media buyer agent completed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ agent: "media_buyer", error: msg });
      log.error({ err, campaignId }, "Media buyer agent failed");
      emitAgentError(campaignId, "media_buyer", err);
    }
  }

  // ── 8. VSL Script Agent ──────────────────────────────────────────────────────
  const hasVSL = ["launch", "perpetual_launch", "continuous_sales", "live_sale"].includes(campaignType);

  if (hasVSL) {
    if (!skipAgent("vsl_script", "vsl_script")) try {
      emitCampaignEvent({
        campaignId,
        type: "agent_started",
        agentType: "vsl_script",
        message: "Agente VSL Script — escrevendo roteiro completo do vídeo de vendas...",
        timestamp: new Date().toISOString(),
      });

      const vslOutput = await runVSLScriptAgent(
        campaignId,
        workspaceId,
        intakeData,
        strategy,
        profile,
        log,
      );

      const vslContractWarn = validatePieceContract("vsl_script", vslOutput);

      // B2: contract violation → rejected + auto-reprocess
      if (vslContractWarn) {
        log.warn({ campaignId, contractWarn: vslContractWarn }, "[B2] vsl_script contract violation — blocking (status=rejected), scheduling reprocess");
        const [blocked] = await db
          .insert(contentPiecesTable)
          .values({
            campaignId,
            workspaceId,
            type: "vsl_script",
            status: "rejected",
            rejectionReason: "contract",
            title: vslOutput.title ?? "VSL Script",
            content: { ...vslOutput, _qualityScore: (vslOutput as any)._qualityScore ?? null, _contractViolation: vslContractWarn, _retryCount: 0 } as any,
            aiProvider: "openai",
            creditsUsed: 70,
          })
          .returning();
        emitCampaignEvent({
          campaignId,
          type: "contract_violation",
          agentType: "vsl_script",
          message: `⚠️ vsl_script violou o contrato — bloqueado para reprocessamento automático`,
          data: { pieceId: blocked?.id, reason: vslContractWarn },
          timestamp: new Date().toISOString(),
        });
        if (blocked) {
          setImmediate(() => {
            regeneratePiece(campaignId, workspaceId, blocked.id, log).catch(err => {
              log.error({ err, campaignId, pieceId: blocked.id }, "[B2] vsl_script auto-reprocess failed");
            });
          });
        }
      } else {
        const [piece] = await db
          .insert(contentPiecesTable)
          .values({
            campaignId,
            workspaceId,
            type: "vsl_script",
            status: "pending_approval",
            title: vslOutput.title ?? "VSL Script",
            content: { ...vslOutput, _qualityScore: (vslOutput as any)._qualityScore ?? null } as any,
            aiProvider: "openai",
            creditsUsed: 70,
          })
          .returning();
        emitCampaignEvent({
          campaignId,
          type: "agent_completed",
          agentType: "vsl_script",
          message: `VSL Script concluído — ${vslOutput.totalDuration ?? ""} | ${vslOutput.sections?.length ?? 0} seções`,
          data: { pieceId: piece?.id },
          timestamp: new Date().toISOString(),
        });
        log.info({ campaignId, pieceId: piece?.id, duration: vslOutput.totalDuration }, "VSL script agent completed");
      }

      piecesGenerated++;
      agentsRun.push("vsl_script");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ agent: "vsl_script", error: msg });
      log.error({ err, campaignId }, "VSL script agent failed");
      emitAgentError(campaignId, "vsl_script", err);
    }
  }

  // ── 8.5 Pre-launch Warming Agent (optional — launch campaigns only) ──────────
  const hasPrelaunchWarming = ["launch", "perpetual_launch"].includes(campaignType);

  if (hasPrelaunchWarming && profile && strategy) {
    if (!skipAgent("prelaunch_warming", "content_calendar")) try {
      emitCampaignEvent({
        campaignId,
        type: "agent_started",
        agentType: "prelaunch_warming" as any,
        message: "Agente de Aquecimento — criando sequência de micro-convicções para os 7 dias antes do CPL 1...",
        timestamp: new Date().toISOString(),
      });

      // Derive duration from intake: check for explicit warmup days setting,
      // default to 7. Use 14 when launch track is 8-digit or 10-digit (longer prep).
      const rawWarmup = intakeData["launch.warmupDays"] ?? intakeData["campaign.warmupDays"];
      const parsedWarmup = rawWarmup ? parseInt(String(rawWarmup), 10) : NaN;
      const track = String(intakeData["campaign.track"] ?? intakeData["launch.track"] ?? "");
      const defaultDays = (track === "8digit" || track === "10digit") ? 14 : 7;
      const warmingDays: 7 | 14 = (!isNaN(parsedWarmup) && parsedWarmup >= 12) ? 14 : defaultDays;

      const warmingOutput = await runPrelaunchWarmingAgent(
        campaignId,
        workspaceId,
        strategy,
        profile,
        intakeData,
        warmingDays,
        log,
      );

      const [warmingPiece] = await db
        .insert(contentPiecesTable)
        .values({
          campaignId,
          workspaceId,
          type: "prelaunch_warming",
          status: "pending_approval",
          title: `Aquecimento Pré-Lançamento — ${warmingOutput.warmingDuration} dias`,
          content: { ...warmingOutput, _qualityScore: (warmingOutput as any)._qualityScore ?? null } as any,
          aiProvider: "anthropic",
          creditsUsed: 40,
        })
        .returning();

      piecesGenerated++;
      agentsRun.push("prelaunch_warming");

      emitCampaignEvent({
        campaignId,
        type: "agent_completed",
        agentType: "prelaunch_warming" as any,
        message: `Aquecimento concluído — ${warmingOutput.days.length} dias de conteúdo para preparar a audiência`,
        data: { pieceId: warmingPiece?.id },
        timestamp: new Date().toISOString(),
      });

      log.info({ campaignId, pieceId: warmingPiece?.id, days: warmingOutput.days.length }, "Prelaunch warming agent completed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ agent: "prelaunch_warming", error: msg });
      log.warn({ err, campaignId }, "Prelaunch warming agent failed — continuing pipeline");
    }
  }

  // ── 9. CPL Script Agent ──────────────────────────────────────────────────────
  const hasCPL = ["launch", "perpetual_launch", "live_sale", "flash_sale"].includes(campaignType);

  if (hasCPL) {
    if (!skipAgent("cpl_script", "cpl_script")) try {
      emitCampaignEvent({
        campaignId,
        type: "agent_started",
        agentType: "cpl_script",
        message: "Agente CPL Script — escrevendo roteiros de pré-lançamento (CPL 1-4)...",
        timestamp: new Date().toISOString(),
      });

      const cplOutput = await runCPLScriptAgent(
        campaignId,
        workspaceId,
        intakeData,
        strategy,
        profile,
        launchPlan,
        log,
        arcOverviewBlock || undefined,
      );

      const cplContractWarn = validatePieceContract("cpl_script", cplOutput);

      // B2: contract violation → rejected + auto-reprocess
      if (cplContractWarn) {
        log.warn({ campaignId, contractWarn: cplContractWarn }, "[B2] cpl_script contract violation — blocking (status=rejected), scheduling reprocess");
        const [blocked] = await db
          .insert(contentPiecesTable)
          .values({
            campaignId,
            workspaceId,
            type: "cpl_script",
            status: "rejected",
            rejectionReason: "contract",
            title: `CPL — ${cplOutput.totalVideos ?? cplOutput.videos?.length ?? 0} Vídeos de Pré-Lançamento`,
            content: { ...cplOutput, _qualityScore: (cplOutput as any)._qualityScore ?? null, _contractViolation: cplContractWarn, _retryCount: 0 } as any,
            aiProvider: "openai",
            creditsUsed: 75,
          })
          .returning();
        emitCampaignEvent({
          campaignId,
          type: "contract_violation",
          agentType: "cpl_script",
          message: `⚠️ cpl_script violou o contrato — bloqueado para reprocessamento automático`,
          data: { pieceId: blocked?.id, reason: cplContractWarn },
          timestamp: new Date().toISOString(),
        });
        if (blocked) {
          setImmediate(() => {
            regeneratePiece(campaignId, workspaceId, blocked.id, log).catch(err => {
              log.error({ err, campaignId, pieceId: blocked.id }, "[B2] cpl_script auto-reprocess failed");
            });
          });
        }
      } else {
        const degradedCPLs: number[] = (cplOutput as any)._degradedCPLs ?? [];
        const [piece] = await db
          .insert(contentPiecesTable)
          .values({
            campaignId,
            workspaceId,
            type: "cpl_script",
            status: "pending_approval",
            title: `CPL — ${cplOutput.totalVideos ?? cplOutput.videos?.length ?? 0} Vídeos de Pré-Lançamento`,
            content: {
              ...cplOutput,
              _qualityScore: (cplOutput as any)._qualityScore ?? null,
              ...(degradedCPLs.length > 0 ? { _degradedCPLs: degradedCPLs } : {}),
            } as any,
            aiProvider: "openai",
            creditsUsed: 75,
          })
          .returning();

        // [#60] Warn founder when any CPL still has empty liveScript after retries
        if (degradedCPLs.length > 0) {
          const warningMsg = `⚠️ CPL ${degradedCPLs.map((n) => `${n}`).join(", ")} gerado com roteiro incompleto — regeneração recomendada`;
          log.warn({ campaignId, pieceId: piece?.id, degradedCPLs }, "[#60] CPL roteiros incompletos após retries — emitindo agent_warning");

          // Real-time Socket.io event (visible while the founder is watching live)
          emitCampaignEvent({
            campaignId,
            type: "agent_warning",
            agentType: "cpl_script",
            message: warningMsg,
            data: { pieceId: piece?.id, degradedCPLs },
            timestamp: new Date().toISOString(),
          });

          // [#60] Persist to audit_logs so the warning survives after the live feed
          // disappears — founders who weren't watching can still see it in history.
          db.insert(auditLogsTable).values({
            workspaceId,
            campaignId,
            action: "agent_warning",
            actor: "system",
            data: {
              type: "cpl_degraded",
              pieceId: piece?.id ?? null,
              degradedCPLs,
              message: warningMsg,
            },
          }).catch((err: unknown) => {
            log.warn({ err, campaignId }, "[#60] audit_log persist for agent_warning failed — non-fatal");
          });
        }

        emitCampaignEvent({
          campaignId,
          type: "agent_completed",
          agentType: "cpl_script",
          message: `CPL concluído — ${cplOutput.totalVideos ?? cplOutput.videos?.length ?? 0} roteiros de CPL prontos para gravar`,
          data: { pieceId: piece?.id },
          timestamp: new Date().toISOString(),
        });
        log.info({ campaignId, pieceId: piece?.id, videos: cplOutput.totalVideos, degradedCPLs }, "CPL script agent completed");
      }

      piecesGenerated++;
      agentsRun.push("cpl_script");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ agent: "cpl_script", error: msg });
      log.error({ err, campaignId }, "CPL script agent failed");
      emitAgentError(campaignId, "cpl_script", err);
    }
  }

  // ── 10. Webinar Script Agent ─────────────────────────────────────────────────
  const hasWebinar = ["perpetual_launch", "live_sale", "authority", "subscription_growth"].includes(campaignType)
    || salesChannel === "webinar";

  if (hasWebinar) {
    if (!skipAgent("webinar_script", "webinar_script")) try {
      emitCampaignEvent({
        campaignId,
        type: "agent_started",
        agentType: "webinar_script",
        message: "Agente Webinar Script — escrevendo roteiro completo do webinar/masterclass...",
        timestamp: new Date().toISOString(),
      });

      const webinarOutput = await runWebinarScriptAgent(
        campaignId,
        workspaceId,
        intakeData,
        strategy,
        profile,
        log,
        cartPhaseBlock || undefined,
      );

      const [piece] = await db
        .insert(contentPiecesTable)
        .values({
          campaignId,
          workspaceId,
          type: "webinar_script",
          status: "pending_approval",
          title: webinarOutput.title,
          content: webinarOutput as any,
          aiProvider: "openai",
          creditsUsed: 80,
        })
        .returning();

      piecesGenerated++;
      agentsRun.push("webinar_script");

      emitCampaignEvent({
        campaignId,
        type: "agent_completed",
        agentType: "webinar_script",
        message: `Webinar concluído — ${webinarOutput.totalDuration} | ${webinarOutput.sections.length} seções + Q&A roteirizado`,
        data: { pieceId: piece?.id },
        timestamp: new Date().toISOString(),
      });

      log.info({ campaignId, pieceId: piece?.id, duration: webinarOutput.totalDuration }, "Webinar script agent completed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ agent: "webinar_script", error: msg });
      log.error({ err, campaignId }, "Webinar script agent failed");
      emitAgentError(campaignId, "webinar_script", err);
    }
  }

  // ── 11. Live Script Agent ────────────────────────────────────────────────────
  const hasLive = ["launch", "live_sale", "flash_sale", "perpetual_launch"].includes(campaignType);

  if (hasLive) {
    if (!skipAgent("live_script", "live_script")) try {
      emitCampaignEvent({
        campaignId,
        type: "agent_started",
        agentType: "live_script",
        message: "Agente Live Script — roteirizando live de abertura de carrinho...",
        timestamp: new Date().toISOString(),
      });

      const liveOutput = await runLiveScriptAgent(
        campaignId,
        workspaceId,
        intakeData,
        strategy,
        profile,
        launchPlan,
        log,
        cartPhaseBlock || undefined,
      );

      const [piece] = await db
        .insert(contentPiecesTable)
        .values({
          campaignId,
          workspaceId,
          type: "live_script",
          status: "pending_approval",
          title: liveOutput.title,
          content: liveOutput as any,
          aiProvider: "openai",
          creditsUsed: 65,
        })
        .returning();

      piecesGenerated++;
      agentsRun.push("live_script");

      emitCampaignEvent({
        campaignId,
        type: "agent_completed",
        agentType: "live_script",
        message: `Live Script concluído — ${liveOutput.totalDuration ?? "—"} | ${liveOutput.segments?.length ?? 0} segmentos roteirizados`,
        data: { pieceId: piece?.id },
        timestamp: new Date().toISOString(),
      });

      log.info({ campaignId, pieceId: piece?.id, duration: liveOutput.totalDuration }, "Live script agent completed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ agent: "live_script", error: msg });
      log.error({ err, campaignId }, "Live script agent failed");
      emitAgentError(campaignId, "live_script", err);
    }
  }

  // ── 12. Stories Sequence Agent (all campaign types) ──────────────────────────
  if (!skipAgent("stories_sequence", "stories_sequence")) try {
    emitCampaignEvent({
      campaignId,
      type: "agent_started",
      agentType: "stories_sequence",
      message: "Agente Stories Sequence — criando sequências narrativas frame a frame...",
      timestamp: new Date().toISOString(),
    });

    const storiesOutput = await runStoriesSequenceAgent(
      campaignId,
      workspaceId,
      intakeData,
      strategy,
      profile,
      launchPlan,
      log,
      arcOverviewBlock || undefined,
    );

    const storiesContractWarn = validatePieceContract("stories_sequence", storiesOutput);

    // B2: contract violation → rejected + auto-reprocess
    if (storiesContractWarn) {
      log.warn({ campaignId, contractWarn: storiesContractWarn }, "[B2] stories_sequence contract violation — blocking (status=rejected), scheduling reprocess");
      const [blocked] = await db
        .insert(contentPiecesTable)
        .values({
          campaignId,
          workspaceId,
          type: "stories_sequence",
          status: "rejected",
          rejectionReason: "contract",
          title: `Stories — ${storiesOutput.totalSequences ?? storiesOutput.sequences?.length ?? 0} sequências narrativas`,
          content: { ...storiesOutput, _contractViolation: storiesContractWarn, _retryCount: 0 } as any,
          aiProvider: "openai",
          creditsUsed: 45,
        })
        .returning();
      emitCampaignEvent({
        campaignId,
        type: "contract_violation",
        agentType: "stories_sequence",
        message: `⚠️ stories_sequence violou o contrato — bloqueado para reprocessamento automático`,
        data: { pieceId: blocked?.id, reason: storiesContractWarn },
        timestamp: new Date().toISOString(),
      });
      if (blocked) {
        setImmediate(() => {
          regeneratePiece(campaignId, workspaceId, blocked.id, log).catch(err => {
            log.error({ err, campaignId, pieceId: blocked.id }, "[B2] stories_sequence auto-reprocess failed");
          });
        });
      }
    } else {
      const [piece] = await db
        .insert(contentPiecesTable)
        .values({
          campaignId,
          workspaceId,
          type: "stories_sequence",
          status: "pending_approval",
          title: `Stories — ${storiesOutput.totalSequences ?? storiesOutput.sequences?.length ?? 0} sequências narrativas`,
          content: { ...storiesOutput } as any,
          aiProvider: "openai",
          creditsUsed: 45,
        })
        .returning();
      emitCampaignEvent({
        campaignId,
        type: "agent_completed",
        agentType: "stories_sequence",
        message: `Stories concluídos — ${storiesOutput.sequences?.length ?? 0} sequências com frames completos`,
        data: { pieceId: piece?.id },
        timestamp: new Date().toISOString(),
      });
      log.info({ campaignId, pieceId: piece?.id, sequences: storiesOutput.sequences.length }, "Stories sequence agent completed");
    }

    piecesGenerated++;
    agentsRun.push("stories_sequence");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push({ agent: "stories_sequence", error: msg });
    log.error({ err, campaignId }, "Stories sequence agent failed");
    emitAgentError(campaignId, "stories_sequence", err);
  }

  // ── 13. Video Strategy Agent (creator/video campaigns) ───────────────────────
  if (isVideoFocused) {
    if (!skipAgent("video_strategy", "video_strategy")) try {
      emitCampaignEvent({
        campaignId,
        type: "agent_started",
        agentType: "video_strategy",
        message: "Agente Video Strategy — planejando estratégia de canal e série de vídeos...",
        timestamp: new Date().toISOString(),
      });

      const videoOutput = await runVideoStrategyAgent(
        campaignId,
        workspaceId,
        intakeData,
        profile,
        log,
      );

      const [piece] = await db
        .insert(contentPiecesTable)
        .values({
          campaignId,
          workspaceId,
          type: "video_strategy",
          status: "pending_approval",
          title: `Estratégia de Vídeo — ${videoOutput.seriesPlanning.totalEpisodes} episódios | ${videoOutput.channelStrategy.primaryPlatform}`,
          content: videoOutput as any,
          aiProvider: "google",
          creditsUsed: 50,
        })
        .returning();

      piecesGenerated++;
      agentsRun.push("video_strategy");

      emitCampaignEvent({
        campaignId,
        type: "agent_completed",
        agentType: "video_strategy",
        message: `Video Strategy concluído — série de ${videoOutput.seriesPlanning.totalEpisodes} episódios + SEO + short-form strategy`,
        data: { pieceId: piece?.id },
        timestamp: new Date().toISOString(),
      });

      log.info({ campaignId, pieceId: piece?.id, episodes: videoOutput.seriesPlanning.totalEpisodes }, "Video strategy agent completed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ agent: "video_strategy", error: msg });
      log.error({ err, campaignId }, "Video strategy agent failed");
      emitAgentError(campaignId, "video_strategy", err);
    }
  }

  // ── 14. Creator Growth Agent (creator campaigns) ─────────────────────────────
  if (isCreatorCampaign) {
    if (!skipAgent("creator_growth_plan", "creator_growth")) try {
      emitCampaignEvent({
        campaignId,
        type: "agent_started",
        agentType: "creator_growth",
        message: "Agente Creator Growth — elaborando plano de crescimento de audiência...",
        timestamp: new Date().toISOString(),
      });

      const growthOutput = await runCreatorGrowthAgent(
        campaignId,
        workspaceId,
        intakeData,
        profile,
        log,
      );

      const [piece] = await db
        .insert(contentPiecesTable)
        .values({
          campaignId,
          workspaceId,
          type: "creator_growth_plan",
          status: "pending_approval",
          title: `Plano de Crescimento — ${growthOutput.growthStrategy.length} pilares | 12 semanas`,
          content: growthOutput as any,
          aiProvider: "google",
          creditsUsed: 45,
        })
        .returning();

      piecesGenerated++;
      agentsRun.push("creator_growth");

      emitCampaignEvent({
        campaignId,
        type: "agent_completed",
        agentType: "creator_growth",
        message: `Creator Growth concluído — ${growthOutput.collaborationPlan.length} colaborações + plano 12 semanas + KPIs`,
        data: { pieceId: piece?.id },
        timestamp: new Date().toISOString(),
      });

      log.info({ campaignId, pieceId: piece?.id }, "Creator growth agent completed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ agent: "creator_growth", error: msg });
      log.error({ err, campaignId }, "Creator growth agent failed");
      emitAgentError(campaignId, "creator_growth", err);
    }
  }

  // ── 15. SEO Organic Intelligence Agent (perpetual campaigns) ─────────────────
  const hasSEO = ["perpetual", "perpetual_launch", "continuous_sales"].includes(campaignType);

  if (hasSEO) {
    if (!skipAgent("seo_organic_plan", "organic_traffic")) try {
      emitCampaignEvent({
        campaignId,
        type: "agent_started",
        agentType: "organic_traffic",
        message: "Agente SEO Orgânico — construindo estratégia de tráfego orgânico para funil perpétuo...",
        timestamp: new Date().toISOString(),
      });

      const seoOutput = await runOrganicTrafficAgent(
        campaignId,
        workspaceId,
        intakeData,
        strategy,
        profile,
        log,
      );

      const [piece] = await db
        .insert(contentPiecesTable)
        .values({
          campaignId,
          workspaceId,
          type: "seo_organic_plan",
          status: "pending_approval",
          title: `SEO Orgânico Perpétuo — ${seoOutput.phases.length} fases | ${seoOutput.platformPlaybooks.length} plataformas`,
          content: seoOutput as any,
          aiProvider: "anthropic",
          creditsUsed: 55,
        })
        .returning();

      piecesGenerated++;
      agentsRun.push("organic_traffic");

      emitCampaignEvent({
        campaignId,
        type: "agent_completed",
        agentType: "organic_traffic",
        message: `SEO Orgânico concluído — ${seoOutput.followerGrowthPlan.length} táticas de crescimento + calendário semanal + KPIs 30/60/90d`,
        data: { pieceId: piece?.id },
        timestamp: new Date().toISOString(),
      });

      log.info({ campaignId, pieceId: piece?.id, phases: seoOutput.phases.length }, "SEO organic plan agent completed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ agent: "organic_traffic", error: msg });
      log.error({ err, campaignId }, "SEO organic plan agent failed");
      emitAgentError(campaignId, "organic_traffic", err);
    }
  }

  // ── 16. Media Brief Agent ────────────────────────────────────────────────────
  if (!skipAgent("media_brief", "media_brief")) try {
    emitCampaignEvent({
      campaignId,
      type: "agent_started",
      agentType: "media_brief",
      message: "Agente Media Brief — criando briefings visuais para imagens e vídeos...",
      timestamp: new Date().toISOString(),
    });

    const mediaOutput = await runMediaBriefAgent(
      campaignId,
      workspaceId,
      intakeData,
      profile,
      undefined,
      log,
    );

    const [piece] = await db
      .insert(contentPiecesTable)
      .values({
        campaignId,
        workspaceId,
        type: "media_brief",
        status: "pending_approval",
        title: `Briefings de Mídia — ${mediaOutput.imageConcepts.length} imagens + ${mediaOutput.videoConcepts.length} vídeos`,
        content: mediaOutput as any,
        aiProvider: "google",
        creditsUsed: 40,
      })
      .returning();

    const allConcepts = [
      ...mediaOutput.imageConcepts.map((c) => ({ ...c, kind: "image" as const })),
      ...mediaOutput.videoConcepts.map((c) => ({ ...c, kind: "video" as const })),
    ];

    for (const concept of allConcepts.slice(0, 20)) {
      await db.insert(mediaBriefsTable).values({
        campaignId,
        workspaceId,
        contentPieceId: piece?.id,
        mediaType: concept.kind,
        conceptStatus: "pending_concept",
        conceptData: concept as any,
      });
      mediaBriefsGenerated++;
    }

    piecesGenerated++;
    agentsRun.push("media_brief");

    emitCampaignEvent({
      campaignId,
      type: "agent_completed",
      agentType: "media_brief",
      message: `Media Brief concluído — ${mediaOutput.imageConcepts.length} conceitos de imagem + ${mediaOutput.videoConcepts.length} conceitos de vídeo aguardando aprovação`,
      data: { pieceId: piece?.id, mediaBriefs: mediaBriefsGenerated },
      timestamp: new Date().toISOString(),
    });

    log.info(
      { campaignId, pieceId: piece?.id, mediaBriefs: mediaBriefsGenerated },
      "Media brief agent completed",
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push({ agent: "media_brief", error: msg });
    log.error({ err, campaignId }, "Media brief agent failed");
    emitAgentError(campaignId, "media_brief", err);
  }

  // ── 16. Compliance Agent (LAST — reviews all copy generated above) ────────────
  if (!skipAgent("compliance_report", "compliance")) try {
    emitCampaignEvent({
      campaignId,
      type: "agent_started",
      agentType: "compliance",
      message: "Agente Compliance — verificando toda a copy contra CONAR, CDC e políticas de plataforma...",
      timestamp: new Date().toISOString(),
    });

    const complianceOutput = await runComplianceAgent(
      campaignId,
      workspaceId,
      intakeData,
      capturedCopyContent,
      capturedAdContent,
      log,
    );

    const [piece] = await db
      .insert(contentPiecesTable)
      .values({
        campaignId,
        workspaceId,
        type: "compliance_report",
        status: complianceOutput.overallRiskLevel === "safe" || complianceOutput.overallRiskLevel === "low_risk"
          ? "approved"
          : "pending_approval",
        title: `Relatório de Compliance — Score ${complianceOutput.complianceScore}/100 | ${complianceOutput.overallRiskLevel.toUpperCase()}`,
        content: complianceOutput as any,
        aiProvider: "anthropic",
        creditsUsed: 50,
      })
      .returning();

    piecesGenerated++;
    agentsRun.push("compliance");

    const violationCount = complianceOutput.violations.length;
    const criticalCount = complianceOutput.violations.filter((v) => v.severity === "critical").length;
    const highCount = complianceOutput.violations.filter((v) => v.severity === "high").length;

    emitCampaignEvent({
      campaignId,
      type: "agent_completed",
      agentType: "compliance",
      message: `Compliance concluído — Score: ${complianceOutput.complianceScore}/100 | ${violationCount} violações (${criticalCount} críticas) | Risco: ${complianceOutput.overallRiskLevel}`,
      data: {
        pieceId: piece?.id,
        score: complianceOutput.complianceScore,
        riskLevel: complianceOutput.overallRiskLevel,
        violations: violationCount,
        critical: criticalCount,
      },
      timestamp: new Date().toISOString(),
    });

    log.info(
      { campaignId, pieceId: piece?.id, score: complianceOutput.complianceScore, riskLevel: complianceOutput.overallRiskLevel },
      "Compliance agent completed",
    );

    // ── COMPLIANCE GATE ────────────────────────────────────────────────────────
    // If the compliance agent found critical or high-severity violations in a
    // high_risk or blocked campaign, pause the pipeline at compliance_review.
    // The user must resolve (accept suggestions / custom edits / override) before
    // the pipeline can continue to awaiting_approval.
    const needsUserReview =
      (complianceOutput.overallRiskLevel === "high_risk" || complianceOutput.overallRiskLevel === "blocked") &&
      (criticalCount > 0 || highCount > 0);

    if (needsUserReview) {
      // Store compliance review state in brainData so the frontend can read it
      const [current] = await db
        .select({ brainData: campaignsTable.brainData })
        .from(campaignsTable)
        .where(eq(campaignsTable.id, campaignId))
        .limit(1);
      const brainNow = ((current?.brainData ?? {}) as Record<string, unknown>);

      await db
        .update(campaignsTable)
        .set({
          brainData: {
            ...brainNow,
            complianceReview: {
              pieceId: piece?.id ?? null,
              score: complianceOutput.complianceScore,
              riskLevel: complianceOutput.overallRiskLevel,
              violations: complianceOutput.violations,
              approvedElements: complianceOutput.approvedElements,
              requiredDisclosures: complianceOutput.requiredDisclosures,
              legalRecommendations: complianceOutput.legalRecommendations,
              conarAnalysis: complianceOutput.conarAnalysis,
              platformPolicies: complianceOutput.platformPolicies,
              complianceNotes: complianceOutput.complianceNotes,
              reviewedAt: new Date().toISOString(),
              userDecision: null,
            },
          } as any,
        })
        .where(eq(campaignsTable.id, campaignId));

      await transitionCampaign(campaignId, workspaceId, "compliance_review", "compliance gate — critical violations require user review", log);

      emitCampaignEvent({
        campaignId,
        type: "phase_changed",
        agentType: "compliance",
        message: `🛡️ Compliance requer sua revisão — ${criticalCount} violações críticas e ${highCount} altas encontradas. Score: ${complianceOutput.complianceScore}/100`,
        data: {
          violations: violationCount,
          critical: criticalCount,
          high: highCount,
          riskLevel: complianceOutput.overallRiskLevel,
          pieceId: piece?.id,
          requiresAction: true,
        },
        timestamp: new Date().toISOString(),
      });

      log.warn(
        { campaignId, score: complianceOutput.complianceScore, critical: criticalCount, high: highCount },
        "COMPLIANCE GATE: pipeline paused — user review required before awaiting_approval",
      );

      setFallbackMode(false);
      setComplianceHint(null);
      return {
        campaignId,
        piecesGenerated,
        mediaBriefsGenerated: 0,
        agentsRun,
        errors,
        status: "partial",
        pieceResults: [],
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push({ agent: "compliance", error: msg });
    log.error({ err, campaignId }, "Compliance agent failed");
    emitAgentError(campaignId, "compliance", err);
  }

  // ── AUTO-REPAIR SWEEP ────────────────────────────────────────────────────────
  // Before transitioning to awaiting_approval, detect any content pieces that
  // were saved with empty arrays (agent ran but LLM returned truncated/invalid JSON).
  // Auto-regenerate them inline — up to 2 attempts per piece, max 5 pieces total.
  // This is the last line of defense before the campaign reaches the user.
  // If retries still produce empty content, log clearly — never silently deliver empties.
  if (agentsRun.length > 0) {
    const allPieces = await db
      .select({ id: contentPiecesTable.id, type: contentPiecesTable.type, content: contentPiecesTable.content })
      .from(contentPiecesTable)
      .where(eq(contentPiecesTable.campaignId, campaignId));

    const emptyPieces = allPieces.filter(
      (p) => REGENERABLE_PIECE_TYPES.has(p.type ?? "") && isPieceContentEmpty(p.content, p.type ?? undefined),
    );

    if (emptyPieces.length > 0) {
      log.warn(
        { campaignId, count: emptyPieces.length, types: emptyPieces.map(p => p.type) },
        "[AUTO-REPAIR] %d empty pieces detected after content generation — starting auto-repair sweep",
        emptyPieces.length,
      );
      emitCampaignEvent({
        campaignId,
        type: "execution_update",
        message: `🔄 Auto-reparo: ${emptyPieces.length} peça${emptyPieces.length !== 1 ? "s" : ""} vazia${emptyPieces.length !== 1 ? "s" : ""} detectada${emptyPieces.length !== 1 ? "s" : ""} — regenerando automaticamente...`,
        data: { phase: "auto_repair", pieces: emptyPieces.map(p => p.type) },
        timestamp: new Date().toISOString(),
      });

      const MAX_AUTO_REPAIRS = 5;
      let repaired = 0;
      let repairFailed = 0;
      for (const piece of emptyPieces.slice(0, MAX_AUTO_REPAIRS)) {
        let success = false;
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            emitCampaignEvent({
              campaignId,
              type: "agent_started",
              agentType: PIECE_TYPE_TO_AGENT[piece.type ?? ""] ?? piece.type ?? "unknown",
              message: `🔄 Auto-reparo (tentativa ${attempt}/2): regenerando ${piece.type}...`,
              timestamp: new Date().toISOString(),
            });
            await regeneratePiece(campaignId, workspaceId, piece.id, log);
            // Verify the piece is no longer empty
            const [updated] = await db
              .select({ content: contentPiecesTable.content })
              .from(contentPiecesTable)
              .where(eq(contentPiecesTable.id, piece.id))
              .limit(1);
            if (updated && !isPieceContentEmpty(updated.content, piece.type ?? undefined)) {
              emitCampaignEvent({
                campaignId,
                type: "agent_completed",
                agentType: PIECE_TYPE_TO_AGENT[piece.type ?? ""] ?? piece.type ?? "unknown",
                message: `✅ Auto-reparo concluído: ${piece.type} regenerado com sucesso`,
                timestamp: new Date().toISOString(),
              });
              repaired++;
              success = true;
              break;
            }
            log.warn({ campaignId, pieceId: piece.id, type: piece.type, attempt }, "[AUTO-REPAIR] Attempt %d produced empty content again — retrying", attempt);
          } catch (err) {
            log.error({ err, campaignId, pieceId: piece.id, type: piece.type, attempt }, "[AUTO-REPAIR] Attempt %d threw error", attempt);
            // small delay before retry
            if (attempt === 1) await new Promise(r => setTimeout(r, 2000));
          }
        }
        if (!success) {
          repairFailed++;
          log.error(
            { campaignId, pieceId: piece.id, type: piece.type },
            "[AUTO-REPAIR] FAILED after 2 attempts — piece will be visible as empty in review",
          );
          emitCampaignEvent({
            campaignId,
            type: "agent_failed",
            agentType: piece.type ?? "unknown",
            message: `⚠️ Auto-reparo falhou para ${piece.type} após 2 tentativas — peça requer revisão manual`,
            timestamp: new Date().toISOString(),
          });
        }
      }

      log.info(
        { campaignId, repaired, repairFailed, total: emptyPieces.length },
        "[AUTO-REPAIR] Sweep complete — %d repaired, %d failed",
        repaired,
        repairFailed,
      );
      emitCampaignEvent({
        campaignId,
        type: "execution_update",
        message: repairFailed === 0
          ? `✅ Auto-reparo concluído — ${repaired} peça${repaired !== 1 ? "s" : ""} recuperada${repaired !== 1 ? "s" : ""}`
          : `⚠️ Auto-reparo parcial — ${repaired} recuperadas, ${repairFailed} requerem atenção`,
        data: { phase: "auto_repair", repaired, repairFailed },
        timestamp: new Date().toISOString(),
      });
    }

    // All piece types now have agents in REGENERABLE_PIECE_TYPES.
    // If any pieces are still empty after the sweep above (exceeded MAX_AUTO_REPAIRS cap),
    // run a second pass specifically for those — no banner, no _autoRepairFailed.
    const stillEmpty = await db
      .select({ id: contentPiecesTable.id, type: contentPiecesTable.type, content: contentPiecesTable.content })
      .from(contentPiecesTable)
      .where(eq(contentPiecesTable.campaignId, campaignId));
    const remainingEmpty = stillEmpty.filter(
      (p) =>
        isPieceContentEmpty(p.content, p.type ?? undefined) &&
        !((p.content as Record<string, unknown>)?._minimalFallback),
    );
    if (remainingEmpty.length > 0) {
      log.warn(
        { campaignId, count: remainingEmpty.length, types: remainingEmpty.map(p => p.type) },
        "[AUTO-REPAIR] %d pieces still empty after sweep — running second pass",
        remainingEmpty.length,
      );
      for (const piece of remainingEmpty) {
        try {
          await regeneratePiece(campaignId, workspaceId, piece.id, log);
        } catch (err) {
          // If regeneration still fails, inject a minimal structural placeholder
          // so the piece is never blank. The protocol requires delivery, not a banner.
          log.warn({ err, campaignId, pieceId: piece.id, type: piece.type }, "[AUTO-REPAIR] Second pass failed — injecting minimal fallback");
          const fallback = buildMinimalFallback(piece.type ?? "", intakeData);
          try {
            await db
              .update(contentPiecesTable)
              .set({ content: fallback, updatedAt: new Date() })
              .where(eq(contentPiecesTable.id, piece.id));
          } catch (dbErr) {
            log.error({ dbErr, campaignId, pieceId: piece.id }, "[AUTO-REPAIR] Failed to write minimal fallback");
          }
        }
      }
    }
  }

  // ── B2 FIX (Bug #03): CONTRACT VIOLATION SWEEP ───────────────────────────────
  // Pieces saved with _contractViolation: true were silently delivered to the user
  // as "pending_approval" — they looked valid but violated the agent output contract.
  // Now: detect them after generation, auto-regenerate (up to 2 attempts each, max 5).
  // If all retries fail, the piece remains with the flag — clearly visible to the user
  // as a quality warning, but never silently delivered as if it were clean.
  if (agentsRun.length > 0) {
    const allPiecesForViolation = await db
      .select({ id: contentPiecesTable.id, type: contentPiecesTable.type, content: contentPiecesTable.content, status: contentPiecesTable.status })
      .from(contentPiecesTable)
      .where(eq(contentPiecesTable.campaignId, campaignId));

    const violatedPieces = allPiecesForViolation.filter((p) => {
      if (p.status === "approved" || p.status === "rejected") return false; // don't touch user-decided pieces
      const c = (p.content ?? {}) as Record<string, unknown>;
      return !!c["_contractViolation"];
    });

    if (violatedPieces.length > 0) {
      log.warn(
        { campaignId, count: violatedPieces.length, types: violatedPieces.map(p => p.type) },
        "[CONTRACT-REPAIR] %d pieces with _contractViolation detected — auto-regenerating",
        violatedPieces.length,
      );
      emitCampaignEvent({
        campaignId,
        type: "execution_update",
        message: `🔄 Contrato de qualidade: ${violatedPieces.length} peça${violatedPieces.length !== 1 ? "s" : ""} fora do padrão — corrigindo automaticamente...`,
        data: { phase: "contract_repair", pieces: violatedPieces.map(p => p.type) },
        timestamp: new Date().toISOString(),
      });

      const MAX_CONTRACT_REPAIRS = 5;
      for (const piece of violatedPieces.slice(0, MAX_CONTRACT_REPAIRS)) {
        let fixed = false;
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            await regeneratePiece(campaignId, workspaceId, piece.id, log);
            // Check if the violation is cleared
            const [updated] = await db
              .select({ content: contentPiecesTable.content })
              .from(contentPiecesTable)
              .where(eq(contentPiecesTable.id, piece.id))
              .limit(1);
            const newContent = (updated?.content ?? {}) as Record<string, unknown>;
            if (!newContent["_contractViolation"]) {
              fixed = true;
              log.info({ campaignId, pieceId: piece.id, type: piece.type, attempt }, "[CONTRACT-REPAIR] Violation cleared on attempt %d", attempt);
              break;
            }
            log.warn({ campaignId, pieceId: piece.id, attempt }, "[CONTRACT-REPAIR] Attempt %d — violation still present", attempt);
          } catch (err) {
            log.error({ err, campaignId, pieceId: piece.id, attempt }, "[CONTRACT-REPAIR] Attempt %d threw error", attempt);
            if (attempt === 1) await new Promise(r => setTimeout(r, 1500));
          }
        }
        if (!fixed) {
          log.error({ campaignId, pieceId: piece.id, type: piece.type }, "[CONTRACT-REPAIR] Could not clear violation after 2 attempts — piece flagged for manual review");
        }
      }
    }
  }

  // ── TRUNCATION COMPLETENESS CHECK ──────────────────────────────────────────────
  // Detect pieces where the LLM output was truncated mid-JSON (repairTruncatedJson
  // auto-closed the braces, so the piece isn't "empty", but the arrays are too short
  // to be usable). Keys must match the ACTUAL agent output schemas:
  //   email_sequence  → { emailSequence: { preLaunch: [...], cartOpen: [...], ... } }
  //   stories_sequence → { sequences: [...] }
  // The predicate is piece-type-specific to avoid false positives on valid short outputs.
  if (agentsRun.length > 0) {
    const isTruncated = (pieceType: string, c: Record<string, unknown>): boolean => {
      if (c["_minimalFallback"] || c["_autoSkipped"]) return false;
      switch (pieceType) {
        case "email_sequence": {
          // emailSequence is nested: { preLaunch: [], cartOpen: [], ... }
          const es = c["emailSequence"] as Record<string, unknown[]> | undefined;
          if (!es || typeof es !== "object") return true; // missing top-level key = truncated
          const total = (es["preLaunch"]?.length ?? 0) + (es["cartOpen"]?.length ?? 0);
          return total < 2; // at least preLaunch[0] + cartOpen[0]
        }
        case "stories_sequence": {
          const seqs = c["sequences"] as unknown[] | undefined;
          return !Array.isArray(seqs) || seqs.length < 2;
        }
        default:
          return false;
      }
    };

    const allPiecesForSparse = await db
      .select({ id: contentPiecesTable.id, type: contentPiecesTable.type, content: contentPiecesTable.content })
      .from(contentPiecesTable)
      .where(eq(contentPiecesTable.campaignId, campaignId));

    const sparsePieces = allPiecesForSparse.filter((p) => {
      const c = (p.content ?? {}) as Record<string, unknown>;
      return isTruncated(p.type ?? "", c);
    });

    if (sparsePieces.length > 0) {
      log.warn(
        { campaignId, count: sparsePieces.length, types: sparsePieces.map(p => p.type) },
        "[TRUNCATION-CHECK] %d pieces are sparse (truncated output) — attempting re-generation",
        sparsePieces.length,
      );
      for (const piece of sparsePieces) {
        try {
          await regeneratePiece(campaignId, workspaceId, piece.id, log);
          // Verify improved after regeneration
          const [refreshed] = await db
            .select({ content: contentPiecesTable.content })
            .from(contentPiecesTable)
            .where(eq(contentPiecesTable.id, piece.id))
            .limit(1);
          if (refreshed && isTruncated(piece.type ?? "", (refreshed.content ?? {}) as Record<string, unknown>)) {
            // Still sparse after re-gen — inject full buildMinimalFallback so UI shows structured content
            log.warn({ campaignId, pieceId: piece.id, type: piece.type }, "[TRUNCATION-CHECK] Still sparse after re-gen — injecting minimal fallback");
            const fallback = buildMinimalFallback(piece.type ?? "", intakeData);
            await db.update(contentPiecesTable).set({ content: fallback, updatedAt: new Date() }).where(eq(contentPiecesTable.id, piece.id))
              .catch(err => log.warn({ err, campaignId, pieceId: piece.id }, "[TRUNCATION-CHECK] fallback write failed"));
          }
        } catch (err) {
          log.warn({ err, campaignId, pieceId: piece.id, type: piece.type }, "[TRUNCATION-CHECK] re-gen threw — injecting minimal fallback");
          const fallback = buildMinimalFallback(piece.type ?? "", intakeData);
          await db.update(contentPiecesTable).set({ content: fallback, updatedAt: new Date() }).where(eq(contentPiecesTable.id, piece.id))
            .catch(e => log.warn({ e, campaignId, pieceId: piece.id }, "[TRUNCATION-CHECK] fallback write failed"));
        }
      }
    }
  }

  // ── Final status ─────────────────────────────────────────────────────────────
  // After content generation: move to awaiting_approval so user can review and
  // approve before launch. If ALL agents failed fall back to strategy_ready so
  // the user can re-trigger content generation.
  //
  // CHECKPOINT FIX: if done.size > 0 (existing pieces from a previous run were
  // preserved via checkpoint skip), those pieces count as successful output.
  // Only reset to strategy_ready when the run produced NO pieces at all (no
  // new agents ran AND no existing checkpoint pieces exist).
  const allFailed = errors.length > 0 && agentsRun.length === 0 && done.size === 0;
  const finalStatus: "awaiting_approval" | "strategy_ready" = allFailed
    ? "strategy_ready"
    : "awaiting_approval";

  // Move all generated content pieces from draft → pending_approval so they
  // appear correctly in the content review page. Pieces already approved or
  // rejected are left unchanged.
  if (!allFailed) {
    await db
      .update(contentPiecesTable)
      .set({ status: "pending_approval", updatedAt: new Date() })
      .where(
        and(
          eq(contentPiecesTable.campaignId, campaignId),
          eq(contentPiecesTable.status, "draft"),
        ),
      );
  }

  await transitionCampaign(campaignId, workspaceId, finalStatus, "content generation phase completed", log, {
    executionStartedAt: new Date(),
  });

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "content.generation.completed",
    actor: "system",
    data: { agentsRun, piecesGenerated, mediaBriefsGenerated, errors, finalStatus },
  });

  emitCampaignEvent({
    campaignId,
    type: "phase_changed",
    message: `Produção de conteúdo concluída — ${piecesGenerated} peças geradas por ${agentsRun.length} agentes`,
    data: { agentsRun, piecesGenerated, mediaBriefsGenerated, errors: errors.length },
    timestamp: new Date().toISOString(),
  });

  // ── Compliance pre-scan: fire-and-forget sweep of all generated pieces ───────
  // Runs validatePieceCompliance on every pending_approval piece in background
  // so the approval page has a full compliance landscape before user reviews.
  if (!allFailed) {
    const sweep = await import("./content-compliance-sweep.js");
    setImmediate(() => {
      sweep.runComplianceSweep(campaignId, workspaceId, log)
        .catch(() => undefined);
    });
  }

  // ── Trava cleanup: always reset fallback mode + compliance hint after content run ──
  setFallbackMode(false);
  setComplianceHint(null);

  // ── Trava 3: Write contentRetry state to brainData ───────────────────────
  // Stores last-failed agent info so the frontend can show exactly WHERE the
  // pipeline stalled and offer a targeted "skip" action for that specific piece.
  // requiresIntervention is set when all non-skipped agents failed (allFailed).
  if (errors.length > 0) {
    const lastErr = errors[errors.length - 1];
    const lastFailedPieceTypeLocal = AGENT_PIECE_TYPE[lastErr.agent] ?? "";
    const errorType = classifyPipelineError(lastErr.error);
    const newContentRetry: Record<string, unknown> = {
      ...contentRetry,
      lastFailedAgent: lastErr.agent,
      lastFailedPieceType: lastFailedPieceTypeLocal,
      lastFailedError: lastErr.error.slice(0, 300),
      lastFailedAt: new Date().toISOString(),
      lastErrorType: errorType,
      requiresIntervention: allFailed,
      autocorrectionStatus: allFailed ? "pending" : undefined,
    };
    await db
      .update(campaignsTable)
      .set({ brainData: { ...brainRaw, contentRetry: newContentRetry } as any })
      .where(eq(campaignsTable.id, campaignId))
      .catch(err => log.warn({ err, campaignId }, "[FAILSAFE] Failed to write contentRetry state — non-blocking"));

    // ── Autocorrection dispatch (fire-and-forget) ────────────────────────
    // When all agents failed (requiresIntervention), route to the appropriate
    // autocorrector based on the error type. Non-blocking — never delays HTTP.
    if (allFailed && lastFailedPieceTypeLocal) {
      const strategyData = ((campaign.brainData as any)?.["strategyData"] ?? {}) as Record<string, unknown>;

      if (errorType === "COMPLIANCE_VIOLATION") {
        log.info({ campaignId, errorType, lastFailedPieceTypeLocal }, "[AUTOCORRECT] Routing to Ethics Autocorrect Agent");
        setImmediate(() => {
          runEthicsAutocorrect(campaignId, workspaceId, lastFailedPieceTypeLocal, lastErr.agent, lastErr.error, strategyData, intakeData, log)
            .catch(err2 => log.warn({ err: err2, campaignId }, "[AUTOCORRECT] Ethics autocorrect failed — non-blocking"));
        });
      } else if (errorType === "INVALID_INPUT_CONTEXT") {
        log.info({ campaignId, errorType, lastFailedPieceTypeLocal }, "[AUTOCORRECT] Routing to Context Refinement Agent");
        setImmediate(() => {
          runContextRefinement(campaignId, workspaceId, lastFailedPieceTypeLocal, lastErr.agent, lastErr.error, intakeData, log)
            .catch(err2 => log.warn({ err: err2, campaignId }, "[AUTOCORRECT] Context refinement failed — non-blocking"));
        });
      } else {
        // INFRASTRUCTURE_OR_TIMEOUT — fallback model is already active for next retry
        log.info({ campaignId, errorType }, "[AUTOCORRECT] Infrastructure error — fallback model active, awaiting user retry");
      }
    }
  } else if (piecesGenerated > 0) {
    // All agents succeeded — reset retry state
    const clearedRetry: Record<string, unknown> = {
      ...contentRetry,
      retryCount: 0,
      requiresIntervention: false,
      lastFailedAgent: undefined,
      lastFailedPieceType: undefined,
      lastFailedError: undefined,
    };
    await db
      .update(campaignsTable)
      .set({ brainData: { ...brainRaw, contentRetry: clearedRetry } as any })
      .where(eq(campaignsTable.id, campaignId))
      .catch(err => log.warn({ err, campaignId }, "[FAILSAFE] Failed to clear contentRetry state — non-blocking"));
  }

  // ── Emotional Coherence Check (awaited) ─────────────────────────────────────
  // Runs after content generation completes. Checks if pieces respect the arc
  // progression. Awaited so the result is persisted to brainData.coherenceReport
  // before this function returns — founder sees it immediately in the approval UI.
  // Any failure is non-fatal; generation result is unaffected.
  if (!allFailed && piecesGenerated > 0) {
    await runEmotionalCoherenceCheck(campaignId, workspaceId, log).catch(err => {
      log.error({ err, campaignId }, "Coherence check failed — non-blocking");
    });
  }

  // Derive per-piece result entries from the agentsRun / errors arrays already tracked.
  // No need to touch individual agent blocks — success entries come from agentsRun,
  // failure entries from errors. Empty-agent-response failures surfaced via auto-repair.
  const pieceResults: LsPieceContentEntry[] = [
    ...agentsRun.map((agentKey) => ({
      pieceType: AGENT_PIECE_TYPE[agentKey] ?? agentKey,
      agentKey,
      status: "success" as const,
    })),
    ...errors.map((e) => ({
      pieceType: AGENT_PIECE_TYPE[e.agent] ?? e.agent,
      agentKey: e.agent,
      status: "failed" as const,
      error: e.error,
    })),
  ];

  return {
    campaignId,
    piecesGenerated,
    mediaBriefsGenerated,
    agentsRun,
    errors,
    status: errors.length === 0 ? "completed" : agentsRun.length > 0 ? "partial" : "failed",
    pieceResults,
  };
  } finally {
    clearInterval(heartbeatInterval);
    // ── [#56] Release advisory lock ───────────────────────────────────────────
    if (contentAdvisoryLockHash !== null) {
      await db.execute(sql`SELECT pg_advisory_unlock(${contentAdvisoryLockHash})`)
        .catch((unlockErr) => log.warn({ unlockErr, campaignId }, "[#56] Advisory lock release failed (non-fatal)"));
    }
  }
}

// ── Optimization (separate — needs live metrics) ──────────────────────────────

export async function optimizeCampaign(
  campaignId: string,
  workspaceId: string,
  currentMetrics: Record<string, unknown>,
  log: Logger,
): Promise<{ pieceId: string; output: ReturnType<typeof runOptimizationAgent> extends Promise<infer T> ? T : never }> {
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.id, campaignId),
        eq(campaignsTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  const intakeData = (campaign.intakeData ?? {}) as Record<string, unknown>;

  emitCampaignEvent({
    campaignId,
    type: "agent_started",
    agentType: "optimization",
    message: "Agente Optimization — analisando performance e gerando recomendações...",
    timestamp: new Date().toISOString(),
  });

  const optimizationOutput = await runOptimizationAgent(
    campaignId,
    workspaceId,
    intakeData,
    currentMetrics,
    log,
  );

  const [piece] = await db
    .insert(contentPiecesTable)
    .values({
      campaignId,
      workspaceId,
      type: "optimization_report",
      status: "pending_approval",
      title: `Relatório de Otimização — Score ${optimizationOutput.overallHealthScore}/100 | ${optimizationOutput.healthTrend}`,
      content: optimizationOutput as any,
      aiProvider: "google",
      creditsUsed: 35,
    })
    .returning();

  emitCampaignEvent({
    campaignId,
    type: "agent_completed",
    agentType: "optimization",
    message: `Otimização concluída — ${optimizationOutput.recommendations.length} recomendações | ${optimizationOutput.recommendations.filter((r) => r.priority === "critical").length} críticas`,
    data: {
      pieceId: piece?.id,
      score: optimizationOutput.overallHealthScore,
      recommendations: optimizationOutput.recommendations.length,
    },
    timestamp: new Date().toISOString(),
  });

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "content.optimization.completed",
    actor: "system",
    data: {
      score: optimizationOutput.overallHealthScore,
      trend: optimizationOutput.healthTrend,
      recommendations: optimizationOutput.recommendations.length,
    },
  });

  return { pieceId: piece?.id ?? "", output: optimizationOutput as any };
}

// ── Read queries ──────────────────────────────────────────────────────────────

export async function getCampaignContent(
  campaignId: string,
  workspaceId: string,
  type?: string,
  mentalTrigger?: string,
  launchPhase?: string,
) {
  const [campaign] = await db
    .select({ id: campaignsTable.id, brainData: (campaignsTable as any).brainData })
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.id, campaignId),
        eq(campaignsTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  // Extract complianceRevision from brainData — drives per-piece correction UI
  const brain = ((campaign as any).brainData ?? {}) as Record<string, unknown>;
  const complianceRevision = (brain["complianceRevision"] ?? null) as {
    inProgress?: boolean;
    startedAt?: string;
    completedAt?: string;
    outcome?: string;
    attempts?: Record<string, number>;   // pieceId → attemptCount
    activePieceTypes?: string[];
    atMaxRetries?: string[];             // pieceTypes that hit 2-attempt ceiling
    requiresHumanDecision?: boolean;
  } | null;

  const conditions = [eq(contentPiecesTable.campaignId, campaignId)];
  if (type) {
    const { contentTypeValues } = await import("@workspace/db");
    if (!contentTypeValues.includes(type as never)) {
      throw new ValidationError(`Invalid type: ${type}`);
    }
    conditions.push(eq(contentPiecesTable.type, type as never));
  }
  if (mentalTrigger) {
    conditions.push(eq(contentPiecesTable.mentalTrigger, mentalTrigger as never));
  }
  if (launchPhase) {
    conditions.push(eq(contentPiecesTable.launchPhase, launchPhase));
  }

  const pieces = await db
    .select()
    .from(contentPiecesTable)
    .where(and(...conditions))
    .orderBy(desc(contentPiecesTable.createdAt));

  return { pieces, total: pieces.length, complianceRevision };
}

export async function getMediaBriefs(campaignId: string, workspaceId: string) {
  const [campaign] = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.id, campaignId),
        eq(campaignsTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  const briefs = await db
    .select()
    .from(mediaBriefsTable)
    .where(eq(mediaBriefsTable.campaignId, campaignId))
    .orderBy(desc(mediaBriefsTable.createdAt));

  return { briefs, total: briefs.length };
}

// Alias for route backwards compatibility
export const getCampaignMediaBriefs = getMediaBriefs;

// ── Approval / rejection ──────────────────────────────────────────────────────

export async function approveContentPiece(
  campaignId: string,
  workspaceId: string,
  pieceId: string,
) {
  const [campaign] = await db
    .select({ id: campaignsTable.id, status: campaignsTable.status })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);
  if (!campaign) throw new NotFoundError("Campaign");

  const [piece] = await db
    .update(contentPiecesTable)
    .set({ status: "approved", approvedAt: new Date() })
    .where(and(eq(contentPiecesTable.id, pieceId), eq(contentPiecesTable.campaignId, campaignId)))
    .returning();

  if (!piece) throw new NotFoundError("Content piece");

  // Auto-transition campaign awaiting_approval → approved ONLY when every piece is
  // approved. We must check for BOTH pending_approval AND rejected pieces — a campaign
  // where all pending_approval are gone but some are rejected is NOT ready to launch.
  if (campaign.status === "awaiting_approval") {
    const [notReady] = await db
      .select({ count: count() })
      .from(contentPiecesTable)
      .where(
        and(
          eq(contentPiecesTable.campaignId, campaignId),
          inArray(contentPiecesTable.status, ["pending_approval", "rejected"]),
        ),
      );

    if ((notReady?.count ?? 1) === 0) {
      await transitionCampaign(campaignId, workspaceId, "approved", "all content pieces approved", rootLogger);
    }
  }

  return piece;
}

export async function rejectContentPiece(
  campaignId: string,
  workspaceId: string,
  pieceId: string,
  reason: string,
) {
  const [campaign] = await db
    .select({ id: campaignsTable.id, status: campaignsTable.status })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);
  if (!campaign) throw new NotFoundError("Campaign");

  const [piece] = await db
    .update(contentPiecesTable)
    .set({ status: "rejected", rejectedAt: new Date(), rejectionReason: reason })
    .where(and(eq(contentPiecesTable.id, pieceId), eq(contentPiecesTable.campaignId, campaignId)))
    .returning();

  if (!piece) throw new NotFoundError("Content piece");

  // If campaign was already approved and the user rejects a piece, roll back to
  // awaiting_approval so the gate is re-opened. The state machine explicitly allows
  // approved → awaiting_approval for this case.
  if (campaign.status === "approved") {
    await transitionCampaign(
      campaignId,
      workspaceId,
      "awaiting_approval",
      `piece ${pieceId} rejected after approval — re-opening review gate`,
      rootLogger,
    );
  }

  return piece;
}

export async function approveMediaBrief(
  campaignId: string,
  workspaceId: string,
  briefId: string,
) {
  const [campaign] = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);
  if (!campaign) throw new NotFoundError("Campaign");

  const [brief] = await db
    .update(mediaBriefsTable)
    .set({ conceptStatus: "concept_approved", approvedAt: new Date() })
    .where(and(eq(mediaBriefsTable.id, briefId), eq(mediaBriefsTable.campaignId, campaignId)))
    .returning();

  if (!brief) throw new NotFoundError("Media brief");
  return brief;
}

export async function rewriteContentPiece(
  campaignId: string,
  workspaceId: string,
  pieceId: string,
  feedback: string,
  log: Logger,
) {
  const [campaign] = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);
  if (!campaign) throw new NotFoundError("Campaign");

  const [piece] = await db
    .select()
    .from(contentPiecesTable)
    .where(and(eq(contentPiecesTable.id, pieceId), eq(contentPiecesTable.campaignId, campaignId)))
    .limit(1);
  if (!piece) throw new NotFoundError("Content piece");

  const contentStr = JSON.stringify(piece.content, null, 2).slice(0, 6000);
  const userFeedback = feedback.trim() || "Melhore o copy geral, tornando mais persuasivo e alinhado com o produto e avatar.";

  const systemPrompt = `Você é um especialista em copywriting para lançamentos digitais brasileiros.
Sua missão é REESCREVER uma peça de conteúdo incorporando 100% do feedback do revisor humano.

REGRAS CRÍTICAS:
- Mantenha EXATAMENTE a mesma estrutura JSON e os mesmos campos do original
- Reescreva APENAS o conteúdo textual (body, subject, headline, hook, message, script, cta, etc.)
- Incorpore o feedback integralmente — o revisor é quem tem a palavra final
- Responda APENAS com o JSON reescrito, sem comentários adicionais fora do JSON
- Preserve o idioma original (PT-BR) de cada campo
- Se o feedback pedir mais urgência, adicione. Se pedir simplificação, simplifique. Se pedir mudança de tom, mude.`;

  const userMessage = `PEÇA ORIGINAL (tipo: ${piece.type}):
${contentStr}

FEEDBACK DO REVISOR:
"${userFeedback}"

Reescreva essa peça incorporando o feedback acima. Retorne APENAS o JSON com a mesma estrutura do original.`;

  // ── [C3-REGEN] Rewrite idempotency key ────────────────────────────────────
  // Same pattern as regeneratePiece: piece-scoped + time-bucketed so rapid
  // double-submits within 1 minute share the key (1 charge) while subsequent
  // rewrites get a fresh key (new charge).
  const rewriteBucket = Math.floor(Date.now() / 60_000);
  const rewriteIdempotencyKey = `${campaignId}:${pieceId}:rewrite:${rewriteBucket}`;

  let rawOutput!: string;
  await withRegenContext(rewriteIdempotencyKey, async () => {
    const result = await runAgent({
      campaignId,
      workspaceId,
      agentRole: "copywriter",
      systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      log,
    });
    rawOutput = result.content;
  });

  const fallbackContent = piece.content as Record<string, unknown>;
  const parsed = parseAgentJSON<Record<string, unknown>>(rawOutput, fallbackContent);
  const newContent = (parsed && typeof parsed === "object" && !Array.isArray(parsed))
    ? parsed
    : fallbackContent;

  const [updated] = await db
    .update(contentPiecesTable)
    .set({
      content: newContent,
      status: "pending_approval",
      approvedAt: null,
    })
    .where(and(eq(contentPiecesTable.id, pieceId), eq(contentPiecesTable.campaignId, campaignId)))
    .returning();

  if (!updated) throw new NotFoundError("Content piece");

  log.info({ pieceId, campaignId, feedback: userFeedback.slice(0, 80) }, "Content piece rewritten by AI");
  return updated;
}

// ── Piece-level regeneration ───────────────────────────────────────────────────
// Re-runs the original agent for a specific content piece type.
// Used to recover empty/failed pieces without re-running the full pipeline.

const PIECE_TYPE_TO_AGENT: Record<string, string> = {
  email_sequence: "copywriter",
  landing_page_structure: "landing_page",
  vsl_script: "vsl_script",
  ad_copy: "ad_copy",
  targeting_config: "targeting",
  media_buying_plan: "media_buyer",
  creative_direction: "creative_director",
  content_calendar: "social_media",
  prelaunch_warming: "prelaunch_warming",
  cpl_script: "cpl_script",
  webinar_script: "webinar_script",
  live_script: "live_script",
  stories_sequence: "stories_sequence",
  video_strategy: "video_strategy",
  creator_growth_plan: "creator_growth",
  seo_organic_plan: "organic_traffic",
  media_brief: "media_brief",
  compliance_report: "compliance",
};

// ── Not-Generated sentinel ─────────────────────────────────────────────────────
// When ALL AI retries fail for a piece, mark it as explicitly "not generated"
// so the frontend renders "Não gerada — clique para regenerar" instead of hiding it.
//
// Audit protocol rule: injecting fake template content = masking failure = FAIL.
// A piece with _notGenerated: true is VISIBLE and ACTIONABLE (user can regenerate),
// but makes no pretense of being real AI output.
function buildMinimalFallback(pieceType: string, _intakeData: Record<string, unknown>): Record<string, unknown> {
  return {
    _notGenerated: true,
    _minimalFallback: true,
    pieceType,
    reason: "Não foi possível gerar este conteúdo após múltiplas tentativas. Clique em \"Reescrever com IA\" para gerar.",
  };
}

export async function regeneratePiece(
  campaignId: string,
  workspaceId: string,
  pieceId: string,
  log: Logger,
) {
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);
  if (!campaign) throw new NotFoundError("Campaign");

  const [piece] = await db
    .select()
    .from(contentPiecesTable)
    .where(and(eq(contentPiecesTable.id, pieceId), eq(contentPiecesTable.campaignId, campaignId)))
    .limit(1);
  if (!piece) throw new NotFoundError("Content piece");

  const agentName = PIECE_TYPE_TO_AGENT[piece.type ?? ""];
  if (!agentName) {
    throw new ValidationError(`No regeneration agent configured for piece type "${piece.type}". Use the AI rewrite endpoint instead.`);
  }

  const intakeData = (campaign.intakeData ?? {}) as Record<string, unknown>;
  const strategy = ((campaign.strategyData ?? {}) as unknown) as StrategyOutput;
  const profile = campaign.audienceData ? extractProfile(campaign.audienceData) : undefined;
  const launchPlan = (campaign.timelineData ?? undefined) as Record<string, unknown> | undefined;

  log.info({ campaignId, pieceId, agentName, pieceType: piece.type }, "Regenerating content piece");

  // ── [C3-REGEN] Regeneration idempotency key ────────────────────────────────
  // A time-bucketed key scoped to this specific piece, distinct from the initial
  // pipeline key (${campaignId}:${agentRole}).  Two concurrent requests within
  // the same 1-minute window share the same key → ON CONFLICT DO NOTHING → 1
  // credit charge.  A new regeneration after a minute → fresh key → new charge.
  const regenBucket = Math.floor(Date.now() / 60_000);
  const regenIdempotencyKey = `${campaignId}:${pieceId}:regen:${regenBucket}`;

  log.debug({ campaignId, pieceId, regenIdempotencyKey }, "[C3-REGEN] regeneration idempotency key set");

  let newContent: unknown;

  try {
    // Wrap all agent calls so critique.runner.ts and agent.runner.ts use the
    // regen-specific key for credit deduction instead of the pipeline key.
    await withRegenContext(regenIdempotencyKey, async () => {
    switch (agentName) {
      case "copywriter": {
        const out = await runCopywriterAgent(campaignId, workspaceId, intakeData, strategy, profile, launchPlan, log);
        newContent = out;
        break;
      }
      case "landing_page": {
        const out = await runLandingPageAgent(campaignId, workspaceId, intakeData, strategy, profile, log);
        newContent = out;
        break;
      }
      case "vsl_script": {
        const out = await runVSLScriptAgent(campaignId, workspaceId, intakeData, strategy, profile, log);
        newContent = out;
        break;
      }
      case "ad_copy": {
        const out = await runAdCopyAgent(campaignId, workspaceId, intakeData, strategy, profile, log);
        newContent = out;
        break;
      }
      case "targeting": {
        const out = await runTargetingAgent(campaignId, workspaceId, intakeData, profile, log);
        newContent = out;
        break;
      }
      case "media_buyer": {
        const out = await runMediaBuyerAgent(campaignId, workspaceId, intakeData, strategy, profile, launchPlan, log);
        newContent = out;
        break;
      }
      case "creative_director": {
        const out = await runCreativeDirectorAgent(campaignId, workspaceId, intakeData, profile, log);
        newContent = out;
        break;
      }
      case "social_media": {
        const out = await runSocialMediaAgent(campaignId, workspaceId, intakeData, strategy, profile, launchPlan, log);
        newContent = out;
        break;
      }
      case "prelaunch_warming": {
        const out = await runPrelaunchWarmingAgent(campaignId, workspaceId, strategy, profile, intakeData, 7, log);
        newContent = out;
        break;
      }
      case "cpl_script": {
        const out = await runCPLScriptAgent(campaignId, workspaceId, intakeData, strategy, profile, launchPlan, log);
        newContent = out;
        break;
      }
      case "webinar_script": {
        const out = await runWebinarScriptAgent(campaignId, workspaceId, intakeData, strategy, profile, log);
        newContent = out;
        break;
      }
      case "live_script": {
        const out = await runLiveScriptAgent(campaignId, workspaceId, intakeData, strategy, profile, launchPlan, log);
        newContent = out;
        break;
      }
      case "stories_sequence": {
        const out = await runStoriesSequenceAgent(campaignId, workspaceId, intakeData, strategy, profile, launchPlan, log);
        newContent = out;
        break;
      }
      case "video_strategy": {
        const out = await runVideoStrategyAgent(campaignId, workspaceId, intakeData, profile, log);
        newContent = out;
        break;
      }
      case "creator_growth": {
        const out = await runCreatorGrowthAgent(campaignId, workspaceId, intakeData, profile, log);
        newContent = out;
        break;
      }
      case "organic_traffic": {
        const out = await runOrganicTrafficAgent(campaignId, workspaceId, intakeData, strategy, profile, log);
        newContent = out;
        break;
      }
      case "media_brief": {
        // Pass existing social calendar if present as context
        const [socialPiece] = await db
          .select({ content: contentPiecesTable.content })
          .from(contentPiecesTable)
          .where(and(eq(contentPiecesTable.campaignId, campaignId), eq(contentPiecesTable.type, "content_calendar")))
          .limit(1);
        const out = await runMediaBriefAgent(
          campaignId,
          workspaceId,
          intakeData,
          profile,
          (socialPiece?.content as Record<string, unknown> | undefined),
          log,
        );
        newContent = out;
        break;
      }
      case "compliance": {
        const [emailPiece] = await db
          .select({ content: contentPiecesTable.content })
          .from(contentPiecesTable)
          .where(and(eq(contentPiecesTable.campaignId, campaignId), eq(contentPiecesTable.type, "email_sequence")))
          .limit(1);
        const [adPiece] = await db
          .select({ content: contentPiecesTable.content })
          .from(contentPiecesTable)
          .where(and(eq(contentPiecesTable.campaignId, campaignId), eq(contentPiecesTable.type, "ad_copy")))
          .limit(1);
        const out = await runComplianceAgent(
          campaignId,
          workspaceId,
          intakeData,
          (emailPiece?.content as Record<string, unknown> | undefined),
          (adPiece?.content as Record<string, unknown> | undefined),
          log,
        );
        newContent = out;
        break;
      }
      default:
        throw new ValidationError(`Unknown agent: ${agentName}`);
    }
    }); // end withRegenContext
  } catch (err) {
    log.error({ err, campaignId, pieceId, agentName }, "Regeneration agent failed");
    throw err;
  }

  // NULL / EMPTY GUARD — if the agent returned null, undefined, or an empty object
  // without throwing, refuse to overwrite the DB row with empty content.
  // This prevents silent data loss where a piece goes from empty→still empty but
  // gets status "pending_approval" and appears to have been successfully regenerated.
  if (isPieceContentEmpty(newContent, piece.type ?? undefined)) {
    const emptyErr = new ValidationError(
      `Agent "${agentName}" returned empty content for piece type "${piece.type}" (empty_agent_response). ` +
      `The piece was NOT updated. Retry or check LLM connectivity.`,
    );
    log.error(
      { campaignId, pieceId, agentName, pieceType: piece.type },
      "[REGENERATE] empty_agent_response — refusing DB write to preserve existing piece",
    );
    throw emptyErr;
  }

  // B2: Re-validate contract on the newly generated content.
  // Read existing retry counter (default 0 for pieces coming from the initial pipeline).
  const existingContent = (piece.content ?? {}) as Record<string, unknown>;
  const currentRetryCount = typeof existingContent._retryCount === "number" ? existingContent._retryCount : 0;
  const regenContractWarn = validatePieceContract(piece.type ?? "", newContent);

  if (regenContractWarn) {
    const nextRetryCount = currentRetryCount + 1;
    if (nextRetryCount > MAX_CONTRACT_RETRIES) {
      // Ceiling hit — mark permanently rejected, stop looping.
      log.error(
        { campaignId, pieceId, agentName, contractWarn: regenContractWarn, retries: currentRetryCount },
        "[B2] regeneratePiece: contract still violated after MAX_CONTRACT_RETRIES — marking _permanentlyRejected",
      );
      const [updated] = await db
        .update(contentPiecesTable)
        .set({
          content: { ...newContent as Record<string, unknown>, _contractViolation: regenContractWarn, _retryCount: nextRetryCount, _permanentlyRejected: true } as any,
          status: "rejected",
          rejectionReason: "contract",
          approvedAt: null,
        })
        .where(and(eq(contentPiecesTable.id, pieceId), eq(contentPiecesTable.campaignId, campaignId)))
        .returning();
      if (!updated) throw new NotFoundError("Content piece");
      emitCampaignEvent({
        campaignId,
        type: "contract_violation",
        agentType: agentName,
        message: `🚫 ${piece.type} permanentemente rejeitado após ${nextRetryCount} tentativas — revisão manual necessária`,
        data: { pieceId, reason: regenContractWarn, permanentlyRejected: true },
        timestamp: new Date().toISOString(),
      });
      return updated;
    }

    // Under ceiling — keep rejected, increment counter, schedule another attempt.
    log.warn(
      { campaignId, pieceId, agentName, contractWarn: regenContractWarn, nextRetryCount },
      `[B2] regeneratePiece: contract still violated (attempt ${nextRetryCount}/${MAX_CONTRACT_RETRIES}) — scheduling retry`,
    );
    const [updated] = await db
      .update(contentPiecesTable)
      .set({
        content: { ...newContent as Record<string, unknown>, _contractViolation: regenContractWarn, _retryCount: nextRetryCount } as any,
        status: "rejected",
        rejectionReason: "contract",
        approvedAt: null,
      })
      .where(and(eq(contentPiecesTable.id, pieceId), eq(contentPiecesTable.campaignId, campaignId)))
      .returning();
    if (!updated) throw new NotFoundError("Content piece");
    emitCampaignEvent({
      campaignId,
      type: "contract_violation",
      agentType: agentName,
      message: `⚠️ ${piece.type} ainda viola o contrato (tentativa ${nextRetryCount}/${MAX_CONTRACT_RETRIES}) — reagendando reprocessamento`,
      data: { pieceId, reason: regenContractWarn, retryCount: nextRetryCount },
      timestamp: new Date().toISOString(),
    });
    setImmediate(() => {
      regeneratePiece(campaignId, workspaceId, pieceId, log).catch(err => {
        log.error({ err, campaignId, pieceId }, "[B2] scheduled retry from regeneratePiece failed");
      });
    });
    return updated;
  }

  // Contract clean — promote to pending_approval.
  // Clear rejectionReason so stale "compliance" or "contract" markers don't persist on a clean piece.
  const [updated] = await db
    .update(contentPiecesTable)
    .set({
      content: newContent as any,
      status: "pending_approval",
      rejectionReason: null,
      approvedAt: null,
    })
    .where(and(eq(contentPiecesTable.id, pieceId), eq(contentPiecesTable.campaignId, campaignId)))
    .returning();

  if (!updated) throw new NotFoundError("Content piece");

  // [#60] Emit agent_warning in the regenerate path when CPL liveScripts are degraded.
  // Without this, founders who regenerate a CPL (vs. initial generation) would never see
  // the amber badge warning — the audit_log row would simply never be written.
  if (piece.type === "cpl_script") {
    const regenDegradedCPLs: number[] = Array.isArray((newContent as Record<string, unknown>)._degradedCPLs)
      ? ((newContent as Record<string, unknown>)._degradedCPLs as number[])
      : [];
    if (regenDegradedCPLs.length > 0) {
      const regenWarningMsg = `⚠️ CPL ${regenDegradedCPLs.join(", ")} regenerado com roteiro incompleto — nova regeneração recomendada`;
      log.warn({ campaignId, pieceId, degradedCPLs: regenDegradedCPLs }, "[#60] CPL roteiros incompletos no caminho regenerate — emitindo agent_warning");
      emitCampaignEvent({
        campaignId,
        type: "agent_warning",
        agentType: "cpl_script",
        message: regenWarningMsg,
        data: { pieceId, degradedCPLs: regenDegradedCPLs },
        timestamp: new Date().toISOString(),
      });
      db.insert(auditLogsTable).values({
        workspaceId,
        campaignId,
        action: "agent_warning",
        actor: "system",
        data: { type: "cpl_degraded", pieceId, degradedCPLs: regenDegradedCPLs, message: regenWarningMsg },
      }).catch((err: unknown) => {
        log.warn({ err, campaignId }, "[#60] audit_log persist for agent_warning (regenerate path) failed — non-fatal");
      });
    }
  }

  log.info({ pieceId, campaignId, agentName }, "Content piece regenerated successfully — contract clean, status=pending_approval");
  return updated;
}

const PLATFORM_TO_DB_TYPE: Record<string, string> = {
  tiktok: "social_post",
  instagram: "social_post",
  facebook: "social_post",
  email: "email_sequence",
  whatsapp: "whatsapp_broadcast",
  ads: "ad_copy",
  landing: "landing_page_structure",
};

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook",
  email: "E-mail", whatsapp: "WhatsApp", ads: "Ads", landing: "Landing Page",
};

export async function generateExtraContent(
  campaignId: string,
  workspaceId: string,
  platform: string,
  count: number,
  instructions: string,
  log: Logger,
) {
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);
  if (!campaign) throw new NotFoundError("Campaign");

  // Fetch existing pieces for context
  const existingPieces = await db
    .select({ type: contentPiecesTable.type, content: contentPiecesTable.content })
    .from(contentPiecesTable)
    .where(eq(contentPiecesTable.campaignId, campaignId))
    .limit(5);

  const platformLabel = PLATFORM_LABELS[platform] ?? platform;
  const safeCount = Math.max(1, Math.min(10, count));
  const existingContext = existingPieces
    .map(p => JSON.stringify(p.content).slice(0, 400))
    .join("\n---\n");

  // [#62] Extra-content idempotency key — scoped to (campaignId, platform, 1-minute bucket).
  // Without this, runAgent falls back to the pipeline-level key `${campaignId}:copywriter`,
  // which was already registered during initial content generation → C3 fires ON CONFLICT DO
  // NOTHING and charges 0 credits for every subsequent "gerar mais conteúdo" call.
  // Key format: `${campaignId}:${platform}:extra:${bucket}`
  //   → Same call twice within the same minute → 1 charge (idempotent, dedup rapid double-clicks)
  //   → A new minute → fresh key → new charge
  const extraBucket = Math.floor(Date.now() / 60_000);
  const extraIdempotencyKey = `${campaignId}:${platform}:extra:${extraBucket}`;

  const systemPrompt = `Você é um especialista em copywriting para lançamentos digitais brasileiros.
Gere exatamente ${safeCount} peça(s) de conteúdo para a plataforma ${platformLabel}.

FORMATO DE SAÍDA — retorne APENAS este JSON, sem comentários:
{
  "extraPieces": [
    {
      "title": "Título descritivo da peça",
      "platform": "${platform}",
      "type": ${platform === "tiktok" ? '"reel"' : platform === "instagram" ? '"post"' : platform === "email" ? '"email"' : platform === "whatsapp" ? '"message"' : platform === "ads" ? '"ad"' : '"copy"'},
      "dayIndex": 1,
      "body": "Texto principal da peça",
      "callToAction": "CTA aqui",
      ${platform === "tiktok" ? '"tiktokHook": "Hook de abertura do vídeo",' : ""}
      "segment": "all"
    }
  ]
}

REGRAS:
- dayIndex entre 0 e 7 (0=pré-lançamento, 5=abertura carrinho, 7=fechamento)
- Escreva em PT-BR, tom persuasivo e autêntico
- Variar os dias e gatilhos mentais entre as peças geradas
- Para TikTok: inclua tiktokHook criativo e impactante
- Para e-mail: body deve incluir preview text + corpo completo`;

  const userMessage = [
    `CAMPANHA: ${campaign.title ?? "Digital Product Launch"}`,
    instructions ? `INSTRUÇÕES DO USUÁRIO: ${instructions}` : "",
    existingContext ? `CONTEXTO DAS PEÇAS EXISTENTES (para manter coerência):\n${existingContext}` : "",
    `\nGere ${safeCount} peça(s) para ${platformLabel}.`,
  ].filter(Boolean).join("\n\n");

  // [#62] Wrap runAgent inside withRegenContext so C3 uses the extra-scoped key,
  // not the pipeline-level `${campaignId}:copywriter` key that was consumed at initial generation.
  // withRegenContext<T> returns Promise<T> — we propagate the string directly.
  const rawOutput = await withRegenContext(extraIdempotencyKey, async () => {
    const result = await runAgent({
      campaignId,
      workspaceId,
      agentRole: "copywriter",
      systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      log,
    });
    return result.content;
  });

  const parsed = parseAgentJSON<{ extraPieces?: unknown[] }>(rawOutput, { extraPieces: [] });
  const extraPieces = Array.isArray(parsed.extraPieces) ? parsed.extraPieces : [];

  if (extraPieces.length === 0) throw new ValidationError("AI did not return valid pieces");

  const dbType = (PLATFORM_TO_DB_TYPE[platform] ?? "social_post") as "social_post" | "email_sequence" | "whatsapp_broadcast" | "ad_copy" | "landing_page_structure";

  const [saved] = await db
    .insert(contentPiecesTable)
    .values({
      campaignId,
      workspaceId,
      type: dbType,
      status: "pending_approval",
      launchPhase: "pre_launch",
      content: { extraPieces } as Record<string, unknown>,
      title: `${platformLabel} — Geração Extra (${safeCount} peça${safeCount > 1 ? "s" : ""})`,
    })
    .returning();

  log.info({ campaignId, platform, count: safeCount }, "Extra content generated");
  return { piece: saved, extraPieces };
}

export async function rejectMediaBrief(
  campaignId: string,
  workspaceId: string,
  briefId: string,
  feedback: string,
) {
  const [campaign] = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);
  if (!campaign) throw new NotFoundError("Campaign");

  const [brief] = await db
    .update(mediaBriefsTable)
    .set({ conceptStatus: "concept_rejected", userFeedback: feedback })
    .where(and(eq(mediaBriefsTable.id, briefId), eq(mediaBriefsTable.campaignId, campaignId)))
    .returning();

  if (!brief) throw new NotFoundError("Media brief");
  return brief;
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveComplianceReview
// decision: "accept_all" | "custom" | "override"
// All three move the campaign to awaiting_approval. Override is logged.
// ─────────────────────────────────────────────────────────────────────────────
// ── Sistema 3: Compliance Gate → Copy Loop — helpers ──────────────────────────
// Resolves which piece types a violation affects (by scanning the `location` string),
// builds compliance hints WITHOUT correctedText (so the copy agent reformulates
// independently, not by copying the compliance-suggested wording), and drives the
// two-attempt ceiling tracked per piece in brainData.complianceRevision.attempts.

type ComplianceViolationForRevision = {
  severity: string;
  category: string;
  location: string;
  originalText?: string;
  correctedText?: string;
  issue: string;
  legalBasis: string;
};

function inferPieceTypesFromLocation(location: string | undefined | null): string[] {
  if (!location) return ["email_sequence", "landing_page_structure", "ad_copy"];
  const loc = location.toLowerCase();
  const types: string[] = [];
  if (loc.includes("email") || loc.includes("sequência") || loc.includes("sequencia") || loc.includes("carrinho") || loc.includes("whatsapp") || loc.includes("sms")) {
    types.push("email_sequence");
  }
  if (loc.includes("landing") || loc.includes("página") || loc.includes("pagina") || loc.includes("sales page") || loc.includes("vendas") || loc.includes("hero") || loc.includes("headline")) {
    types.push("landing_page_structure");
  }
  if (loc.includes("vsl") || loc.includes("video de vendas")) {
    types.push("vsl_script");
  }
  if (loc.includes("ad") || loc.includes("anúncio") || loc.includes("anuncio") || loc.includes("criativo")) {
    types.push("ad_copy");
  }
  // Generic location (e.g. "nome do produto") → apply to all primary content pieces
  return types.length > 0 ? [...new Set(types)] : ["email_sequence", "landing_page_structure", "ad_copy"];
}

function groupViolationsByPieceType(
  violations: ComplianceViolationForRevision[],
): Record<string, ComplianceViolationForRevision[]> {
  const grouped: Record<string, ComplianceViolationForRevision[]> = {};
  for (const v of violations) {
    for (const t of inferPieceTypesFromLocation(v.location)) {
      if (!grouped[t]) grouped[t] = [];
      grouped[t].push(v);
    }
  }
  return grouped;
}

function buildComplianceRevisionHint(
  pieceType: string,
  violations: ComplianceViolationForRevision[],
): string {
  const lines: string[] = [
    `[COMPLIANCE OVERRIDE — ${pieceType}]`,
    "",
    "Violações legais identificadas na versão anterior. Reescreva preservando intenção persuasiva, dentro dos limites legais. NÃO copie nenhuma frase marcada abaixo:",
    "",
  ];
  for (const v of violations) {
    const cat = (v.category ?? "VIOLAÇÃO").toUpperCase();
    const sev = (v.severity ?? "high").toUpperCase();
    const issue = v.issue ?? (v as any).description ?? "Ver relatório de compliance";
    const basis = v.legalBasis ?? (v as any).legalRef ?? "";
    lines.push(`• ${cat} (${sev}): ${issue}`);
    if (basis) lines.push(`  Base legal: ${basis}`);
    if (v.location) lines.push(`  Localização: ${v.location}`);
    if (v.correctedText) {
      lines.push(`  Sugestão de reformulação segura do compliance (referência, não cópia obrigatória): ${v.correctedText}`);
      lines.push(`  Use esta sugestão como baliza de limite legal — ela já está dentro dos limites seguros. Mas não a copie literalmente: a versão do compliance tende a ser genérica e menos persuasiva. Sua tarefa é produzir uma versão que respeite os mesmos limites legais desta sugestão, mas com mais força de gancho, especificidade e apelo comercial do que a sugestão fornecida.`);
    }
    lines.push("");
  }
  lines.push("REGRAS:");
  lines.push("- Substituir por linguagem de transformação, prova social concreta ou urgência legítima.");
  lines.push("- Manter força de gancho e poder de conversão — compliance não implica texto fraco.");
  lines.push("- Se a sugestão do compliance for fornecida acima, use-a como piso legal mínimo — não como teto criativo. A cópia literal da sugestão é uma falha: significa zero valor agregado de copy. Produza algo mais forte.");
  return lines.join("\n");
}

async function clearComplianceRevisionProgress(
  campaignId: string,
  brainNow: Record<string, unknown>,
): Promise<void> {
  const existing = ((brainNow["complianceRevision"] ?? {}) as Record<string, unknown>);
  await db
    .update(campaignsTable)
    .set({
      brainData: {
        ...brainNow,
        complianceRevision: { ...existing, inProgress: false, errorAt: new Date().toISOString() },
      } as any,
    })
    .where(eq(campaignsTable.id, campaignId))
    .catch(() => {});
}

// ── runComplianceRevisionLoop — fire-and-forget revision engine ────────────────
// Injects compliance hints (without correctedText) → regenerates affected pieces
// via regeneratePiece (zero credit cost — deductCredits is never called by
// regeneratePiece) → re-evaluates compliance via runComplianceAgent.
// On pass: transitions to awaiting_approval.
// On fail: stays in compliance_review; marks requiresHumanDecision when ceiling hit.
async function runComplianceRevisionLoop(
  campaignId: string,
  workspaceId: string,
  piecesToRetry: Array<{ pieceId: string; pieceType: string; hint: string; attemptNum: number }>,
  log: Logger,
): Promise<void> {
  // Step 1: Regenerate each affected piece with compliance hint injected
  for (const p of piecesToRetry) {
    emitCampaignEvent({
      campaignId,
      type: "agent_started",
      agentType: p.pieceType,
      message: `📋 Reescrevendo ${p.pieceType} por compliance (tentativa ${p.attemptNum} de 2)...`,
      data: { pieceId: p.pieceId, attempt: p.attemptNum, rejectionReason: "compliance" },
      timestamp: new Date().toISOString(),
    });
    setComplianceHint(p.hint);
    try {
      await regeneratePiece(campaignId, workspaceId, p.pieceId, log);
      log.info({ campaignId, pieceId: p.pieceId, pieceType: p.pieceType, attempt: p.attemptNum }, "[COMPLIANCE REVISION] piece regenerated");
      emitCampaignEvent({
        campaignId,
        type: "agent_completed",
        agentType: p.pieceType,
        message: `✅ ${p.pieceType} reescrito (tentativa ${p.attemptNum} de 2) — aguardando reavaliação`,
        data: { pieceId: p.pieceId, attempt: p.attemptNum },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      log.error({ err, campaignId, pieceId: p.pieceId, pieceType: p.pieceType }, "[COMPLIANCE REVISION] regeneratePiece failed");
      emitCampaignEvent({
        campaignId,
        type: "agent_failed",
        agentType: p.pieceType,
        message: `⚠️ Falha na reescrita de ${p.pieceType} — peça mantida como rejeitada`,
        data: { pieceId: p.pieceId, attempt: p.attemptNum },
        timestamp: new Date().toISOString(),
      });
    } finally {
      setComplianceHint(null);
    }
  }

  // Step 2: Re-run compliance evaluation on full content
  emitCampaignEvent({
    campaignId,
    type: "agent_started",
    agentType: "compliance",
    message: "🔍 Reavaliando conformidade legal do conteúdo reescrito...",
    timestamp: new Date().toISOString(),
  });

  const [campaignNow] = await db
    .select({ brainData: campaignsTable.brainData, intakeData: campaignsTable.intakeData, status: campaignsTable.status })
    .from(campaignsTable)
    .where(eq(campaignsTable.id, campaignId))
    .limit(1);

  if (!campaignNow || campaignNow.status !== "compliance_review") {
    log.warn({ campaignId, status: campaignNow?.status }, "[COMPLIANCE REVISION] campaign no longer in compliance_review — aborting");
    return;
  }

  const [emailPiece] = await db
    .select({ content: contentPiecesTable.content })
    .from(contentPiecesTable)
    .where(and(eq(contentPiecesTable.campaignId, campaignId), eq(contentPiecesTable.type, "email_sequence")))
    .limit(1);

  const [adPiece] = await db
    .select({ content: contentPiecesTable.content })
    .from(contentPiecesTable)
    .where(and(eq(contentPiecesTable.campaignId, campaignId), eq(contentPiecesTable.type, "ad_copy")))
    .limit(1);

  const intakeData = ((campaignNow.intakeData ?? {}) as Record<string, unknown>);
  const brainNow2 = ((campaignNow.brainData ?? {}) as Record<string, unknown>);
  const existingRevision2 = ((brainNow2["complianceRevision"] ?? {}) as Record<string, unknown>);

  let complianceResult: Awaited<ReturnType<typeof runComplianceAgent>>;
  try {
    complianceResult = await runComplianceAgent(
      campaignId,
      workspaceId,
      intakeData,
      emailPiece?.content as Record<string, unknown> | undefined,
      adPiece?.content as Record<string, unknown> | undefined,
      log,
    );
  } catch (err) {
    log.error({ err, campaignId }, "[COMPLIANCE REVISION] re-evaluation failed — keeping in compliance_review");
    emitCampaignEvent({
      campaignId,
      type: "agent_failed",
      agentType: "compliance",
      message: "⚠️ Erro na reavaliação de compliance — decisão manual necessária",
      timestamp: new Date().toISOString(),
    });
    await clearComplianceRevisionProgress(campaignId, brainNow2);
    return;
  }

  // Step 3: Evaluate result and transition accordingly
  const criticalCount2 = ((complianceResult.violations ?? []) as ComplianceViolationForRevision[]).filter(v => v.severity === "critical").length;
  const highCount2 = ((complianceResult.violations ?? []) as ComplianceViolationForRevision[]).filter(v => v.severity === "high").length;
  const stillFailing = (complianceResult.overallRiskLevel === "high_risk" || complianceResult.overallRiskLevel === "blocked") && (criticalCount2 > 0 || highCount2 > 0);

  const [reportPiece] = await db
    .select({ id: contentPiecesTable.id })
    .from(contentPiecesTable)
    .where(and(eq(contentPiecesTable.campaignId, campaignId), eq(contentPiecesTable.type, "compliance_report")))
    .limit(1);

  if (!stillFailing) {
    // ✅ Compliance cleared — advance to awaiting_approval
    if (reportPiece) {
      await db
        .update(contentPiecesTable)
        .set({ content: complianceResult as any, status: "approved", updatedAt: new Date() })
        .where(eq(contentPiecesTable.id, reportPiece.id));
    }
    await db
      .update(campaignsTable)
      .set({
        brainData: {
          ...brainNow2,
          complianceReview: { ...complianceResult, resolvedByRevision: true, resolvedAt: new Date().toISOString() },
          complianceRevision: { ...existingRevision2, inProgress: false, completedAt: new Date().toISOString(), outcome: "approved" },
        } as any,
      })
      .where(eq(campaignsTable.id, campaignId));

    emitCampaignEvent({
      campaignId,
      type: "phase_changed",
      message: "✅ Compliance aprovado após reescrita automática — conteúdo pronto para revisão final!",
      data: { status: "awaiting_approval", riskLevel: complianceResult.overallRiskLevel },
      timestamp: new Date().toISOString(),
    });
    await transitionCampaign(campaignId, workspaceId, "awaiting_approval", "compliance cleared after auto-revision", log);
    log.info({ campaignId, riskLevel: complianceResult.overallRiskLevel }, "[COMPLIANCE REVISION] cleared — transitioned to awaiting_approval");
  } else {
    // ❌ Still failing — keep in compliance_review with updated data
    if (reportPiece) {
      await db
        .update(contentPiecesTable)
        .set({ content: { ...(complianceResult as any), pieceId: reportPiece.id }, status: "pending_approval", updatedAt: new Date() })
        .where(eq(contentPiecesTable.id, reportPiece.id));
    }

    const pieceAttempts2 = ((existingRevision2["attempts"] ?? {}) as Record<string, number>);
    const hasRetriesLeft = piecesToRetry.some(p => (pieceAttempts2[p.pieceId] ?? 0) < 2);

    await db
      .update(campaignsTable)
      .set({
        brainData: {
          ...brainNow2,
          complianceReview: { ...(complianceResult as any), pieceId: reportPiece?.id },
          complianceRevision: {
            ...existingRevision2,
            inProgress: false,
            lastRevaluatedAt: new Date().toISOString(),
            outcome: "still_failing",
            requiresHumanDecision: !hasRetriesLeft,
          },
        } as any,
      })
      .where(eq(campaignsTable.id, campaignId));

    const actionMsg = hasRetriesLeft
      ? `⚠️ Compliance ainda detecta violações após reescrita (tentativa ${piecesToRetry[0]?.attemptNum ?? 1} de 2). Solicite nova revisão ou use accept_all/override.`
      : "⚠️ Máximo de 2 tentativas automáticas atingido. Compliance ainda detecta violações — use accept_all ou override para avançar.";

    emitCampaignEvent({
      campaignId,
      type: "phase_changed",
      message: actionMsg,
      data: {
        riskLevel: complianceResult.overallRiskLevel,
        violations: complianceResult.violations,
        requiresHumanDecision: !hasRetriesLeft,
        status: "compliance_review",
      },
      timestamp: new Date().toISOString(),
    });
    log.warn({ campaignId, criticalCount: criticalCount2, highCount: highCount2, hasRetriesLeft }, "[COMPLIANCE REVISION] still failing after auto-revision");
  }
}

export async function resolveComplianceReview(
  campaignId: string,
  workspaceId: string,
  decision: "accept_all" | "custom" | "override" | "request_revision",
  corrections: Array<{ violationIndex: number; acceptedText: string }> | undefined,
  log: Logger,
): Promise<{ ok: boolean; status: string; message?: string; revisionState?: Record<string, unknown> }> {
  const [campaign] = await db
    .select({ id: campaignsTable.id, status: campaignsTable.status, brainData: campaignsTable.brainData })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");
  if (campaign.status !== "compliance_review") {
    throw new AppError(409, "Campaign is not in compliance_review status", "INVALID_STATE");
  }

  const brainNow = ((campaign.brainData ?? {}) as Record<string, unknown>);
  const reviewData = ((brainNow["complianceReview"] ?? {}) as Record<string, unknown>);

  // ── 4ª decisão: request_revision (Sistema 3 — Compliance Gate → Copy loop) ──
  // Extrai violações HIGH/CRITICAL, constrói compliance hints SEM correctedText
  // (o agente de copy deve reformular sozinho, não copiar a sugestão pronta),
  // marca peças como rejected com rejectionReason: "compliance" (DISTINTO do
  // rejectionReason: "contract" do B2), e dispara runComplianceRevisionLoop.
  // Custo zero: regeneratePiece nunca chama deductCredits.
  // Teto: 2 tentativas por peça em brainData.complianceRevision.attempts[pieceId].
  if (decision === "request_revision") {
    const violations = ((reviewData["violations"] ?? []) as ComplianceViolationForRevision[]);
    const highCritical = violations.filter(v => v.severity === "critical" || v.severity === "high");

    if (highCritical.length === 0) {
      throw new AppError(400, "Nenhuma violação HIGH ou CRITICAL encontrada — use accept_all ou override", "NO_ACTIONABLE_VIOLATIONS");
    }

    const existingRevision = ((brainNow["complianceRevision"] ?? {}) as Record<string, unknown>);
    const pieceAttempts = ((existingRevision["attempts"] ?? {}) as Record<string, number>);

    // Load content pieces that could be affected (primary persuasive types)
    const candidatePieces = await db
      .select({ id: contentPiecesTable.id, type: contentPiecesTable.type })
      .from(contentPiecesTable)
      .where(and(
        eq(contentPiecesTable.campaignId, campaignId),
        inArray(contentPiecesTable.type, ["email_sequence", "landing_page_structure", "vsl_script", "ad_copy"]),
      ));

    const violationsByPieceType = groupViolationsByPieceType(highCritical);

    const piecesToRetry: Array<{ pieceId: string; pieceType: string; hint: string; attemptNum: number }> = [];
    const atMaxRetries: string[] = [];

    for (const piece of candidatePieces) {
      const pieceType = piece.type as string;
      if (!violationsByPieceType[pieceType]) continue;
      const currentAttempts = pieceAttempts[piece.id] ?? 0;
      if (currentAttempts >= 2) {
        atMaxRetries.push(pieceType);
        continue;
      }
      const hint = buildComplianceRevisionHint(pieceType, violationsByPieceType[pieceType]!);
      piecesToRetry.push({ pieceId: piece.id, pieceType, hint, attemptNum: currentAttempts + 1 });
    }

    if (piecesToRetry.length === 0) {
      throw new AppError(
        409,
        "Limite de 2 tentativas automáticas atingido para todas as peças. Use accept_all ou override para avançar.",
        "MAX_COMPLIANCE_RETRIES",
      );
    }

    // Update per-piece attempt counts (survive across piece content replacement)
    const newAttempts: Record<string, number> = { ...pieceAttempts };
    for (const p of piecesToRetry) newAttempts[p.pieceId] = p.attemptNum;

    // Mark affected pieces as rejected with rejectionReason: "compliance"
    // Distinct from B2's rejectionReason: "contract" — different pipeline, different counter
    for (const p of piecesToRetry) {
      await db
        .update(contentPiecesTable)
        .set({ status: "rejected", rejectionReason: "compliance", updatedAt: new Date() })
        .where(eq(contentPiecesTable.id, p.pieceId));
    }

    // Store hints in contentRetry.complianceCorrections for injection during regen
    const existingContentRetry = ((brainNow["contentRetry"] ?? {}) as Record<string, unknown>);
    const complianceCorrections = { ...((existingContentRetry["complianceCorrections"] ?? {}) as Record<string, string>) };
    for (const p of piecesToRetry) complianceCorrections[p.pieceType] = p.hint;

    const newRevision: Record<string, unknown> = {
      ...existingRevision,
      inProgress: true,
      startedAt: new Date().toISOString(),
      attempts: newAttempts,
      activePieceTypes: piecesToRetry.map(p => p.pieceType),
      atMaxRetries,
    };

    await db
      .update(campaignsTable)
      .set({
        brainData: {
          ...brainNow,
          complianceReview: { ...reviewData, userDecision: { decision, decidedAt: new Date().toISOString() } },
          complianceRevision: newRevision,
          contentRetry: { ...existingContentRetry, complianceCorrections },
        } as any,
      })
      .where(eq(campaignsTable.id, campaignId));

    await db.insert(auditLogsTable).values({
      workspaceId,
      campaignId,
      action: "compliance.revision.started",
      actor: "user",
      data: {
        piecesToRetry: piecesToRetry.map(p => ({ pieceType: p.pieceType, attempt: p.attemptNum })),
        atMaxRetries,
        highCriticalViolationCount: highCritical.length,
      },
    });

    // Fire-and-forget — never blocks HTTP response
    setImmediate(() => {
      runComplianceRevisionLoop(campaignId, workspaceId, piecesToRetry, log).catch(err => {
        log.error({ err, campaignId }, "[COMPLIANCE REVISION] loop failed — non-blocking");
      });
    });

    emitCampaignEvent({
      campaignId,
      type: "phase_changed",
      message: `🔄 Correção automática iniciada — ${piecesToRetry.length} peça(s) em reescrita por compliance...`,
      data: { decision, activePieceTypes: piecesToRetry.map(p => p.pieceType), status: "compliance_review" },
      timestamp: new Date().toISOString(),
    });

    log.info({ campaignId, piecesToRetry: piecesToRetry.length, atMaxRetries }, "[COMPLIANCE REVISION] initiated");
    return {
      ok: true,
      status: "compliance_review",
      message: `Correção automática iniciada para ${piecesToRetry.length} peça(s). Acompanhe o progresso em tempo real.`,
      revisionState: {
        inProgress: true,
        activePieceTypes: piecesToRetry.map(p => p.pieceType),
        atMaxRetries,
        attempts: newAttempts,
      },
    };
  }

  const userDecision: Record<string, unknown> = {
    decision,
    decidedAt: new Date().toISOString(),
    corrections: corrections ?? [],
    isOverride: decision === "override",
  };

  const pieceId = reviewData["pieceId"] as string | null | undefined;
  if (pieceId) {
    const [existingPiece] = await db
      .select({ content: contentPiecesTable.content })
      .from(contentPiecesTable)
      .where(and(eq(contentPiecesTable.id, pieceId), eq(contentPiecesTable.campaignId, campaignId)))
      .limit(1);
    if (existingPiece) {
      const pieceContent = ((existingPiece.content ?? {}) as Record<string, unknown>);
      await db
        .update(contentPiecesTable)
        .set({ status: "approved", content: { ...pieceContent, userDecision } as any, updatedAt: new Date() })
        .where(eq(contentPiecesTable.id, pieceId));
    }
  }

  await db
    .update(campaignsTable)
    .set({
      brainData: {
        ...brainNow,
        complianceReview: { ...reviewData, userDecision },
        ...(decision === "override" ? { complianceOverride: { at: new Date().toISOString(), by: "user" } } : {}),
      } as any,
    })
    .where(eq(campaignsTable.id, campaignId));

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "compliance.review.resolved",
    actor: "user",
    data: {
      decision,
      riskLevel: reviewData["riskLevel"],
      score: reviewData["score"],
      violationCount: (reviewData["violations"] as unknown[])?.length ?? 0,
      isOverride: decision === "override",
    },
  });

  await transitionCampaign(campaignId, workspaceId, "awaiting_approval", `compliance resolved — decision: ${decision}`, log);

  const msg = decision === "override"
    ? "✅ Publicação autorizada — compliance registrado para auditoria."
    : decision === "accept_all"
    ? "✅ Sugestões de compliance aceitas — conteúdo pronto para revisão final."
    : "✅ Correções personalizadas registradas — conteúdo pronto para revisão final.";

  emitCampaignEvent({ campaignId, type: "phase_changed", message: msg, data: { decision, status: "awaiting_approval" }, timestamp: new Date().toISOString() });
  log.info({ campaignId, decision }, "Compliance review resolved by user");
  return { ok: true, status: "awaiting_approval" };
}

// ── patchContentPiece — targeted text replacement without full AI rewrite ──────

function deepReplaceText(val: unknown, original: string, corrected: string): unknown {
  if (typeof val === "string") return val.split(original).join(corrected);
  if (Array.isArray(val)) return val.map(item => deepReplaceText(item, original, corrected));
  if (val !== null && typeof val === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      result[k] = deepReplaceText(v, original, corrected);
    }
    return result;
  }
  return val;
}

export async function patchContentPiece(
  campaignId: string,
  workspaceId: string,
  pieceId: string,
  patches: { originalText: string; correctedText: string }[],
) {
  const [campaign] = await db
    .select({ id: campaignsTable.id })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);
  if (!campaign) throw new NotFoundError("Campaign");

  const [piece] = await db
    .select({ content: contentPiecesTable.content })
    .from(contentPiecesTable)
    .where(and(eq(contentPiecesTable.id, pieceId), eq(contentPiecesTable.campaignId, campaignId)))
    .limit(1);
  if (!piece) throw new NotFoundError("Content piece");

  let updated: unknown = piece.content;
  for (const { originalText, correctedText } of patches) {
    if (originalText && correctedText && originalText !== correctedText) {
      updated = deepReplaceText(updated, originalText, correctedText);
    }
  }

  const [saved] = await db
    .update(contentPiecesTable)
    .set({ content: updated as Record<string, unknown> })
    .where(and(eq(contentPiecesTable.id, pieceId), eq(contentPiecesTable.campaignId, campaignId)))
    .returning();

  if (!saved) throw new NotFoundError("Content piece");
  return saved;
}
