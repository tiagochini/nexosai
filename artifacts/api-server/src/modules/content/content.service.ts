import { eq, and, desc, ne } from "drizzle-orm";
import {
  db,
  campaignsTable,
  contentPiecesTable,
  mediaBriefsTable,
  auditLogsTable,
} from "@workspace/db";
import { transitionCampaign, CONTENT_PHASE_ENTRY_STATUSES } from "../campaigns/campaigns.service.js";
import { runAgent, parseAgentJSON, setComplianceHint } from "../agents/agent.runner.js";
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
import { runTargetingAgent } from "../agents/targeting.agent.js";
import { runMediaBuyerAgent } from "../agents/media-buyer.agent.js";
import { runVideoStrategyAgent } from "../agents/video-strategy.agent.js";
import { runCreatorGrowthAgent } from "../agents/creator-growth.agent.js";
import { runOrganicTrafficAgent } from "../agents/organic-traffic.agent.js";
import { runComplianceAgent } from "../agents/compliance.agent.js";
import { runOptimizationAgent } from "../agents/optimization.agent.js";
import { runEmotionalCoherenceCheck } from "../agents/emotional-coherence-checker.agent.js";
import { emitCampaignEvent } from "../realtime/realtime.service.js";
import { AppError, NotFoundError, ValidationError } from "../../lib/errors.js";
import type { ProfileBuilderOutput } from "../agents/profile-builder.agent.js";
import type { StrategyOutput } from "../agents/strategy.agent.js";
import type { Logger } from "pino";
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
export function isPieceContentEmpty(content: unknown): boolean {
  if (!content || typeof content !== "object") return true;
  const obj = content as Record<string, unknown>;
  if (Object.keys(obj).length === 0) return true;
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

// Piece types that have a dedicated regeneration agent (must stay in sync with PIECE_TYPE_TO_AGENT).
const REGENERABLE_PIECE_TYPES: ReadonlySet<string> = new Set([
  "email_sequence",
  "landing_page_structure",
  "vsl_script",
  "ad_copy",
  "targeting_config",
  "media_buying_plan",
]);

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

  // Agent → piece type mapping (used to record lastFailedPieceType in brainData)
  const AGENT_PIECE_TYPE: Record<string, string> = {
    creative_director: "creative_direction",
    copywriter: "email_sequence",
    social_media: "social_media_calendar",
    ad_copy: "ad_copy",
    vsl_script: "vsl_script",
    cpl_script: "cpl_script",
    webinar_script: "webinar_script",
    live_script: "live_script",
    stories_sequence: "stories_sequence",
    landing_page: "landing_page",
    targeting: "targeting_config",
    media_buyer: "media_buying_plan",
    video_strategy: "video_strategy",
    creator_growth: "creator_growth",
    compliance: "compliance",
    optimization: "optimization",
  };

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

  // ── OUTPUT CONTRACT VALIDATION ───────────────────────────────────────────────
  // Every agent must produce output that matches the expected schema for its piece type.
  // If the output is structurally wrong (wrong keys, empty critical arrays), throw here
  // so the catch block records the failure WITHOUT saving corrupt data to the DB.
  // "No crash" ≠ "good output" — this layer enforces the difference.
  const validatePieceContract = (pieceType: string, content: unknown): void => {
    const obj = (content ?? {}) as Record<string, unknown>;
    switch (pieceType) {
      case "email_sequence": {
        // Must have emailSequence.preLaunch array — not ad copy segments format
        const emailSeq = obj.emailSequence as { preLaunch?: unknown[]; cartOpen?: unknown[] } | undefined;
        if (!emailSeq?.preLaunch) {
          throw new AppError(422, `email_sequence output has wrong format — missing emailSequence.preLaunch. Got top-level keys: [${Object.keys(obj).join(", ")}]. LLM likely returned ad copy schema instead of email sequence schema.`);
        }
        if (emailSeq.preLaunch.length === 0 && (emailSeq.cartOpen?.length ?? 0) === 0) {
          throw new AppError(422, `email_sequence output has zero emails in preLaunch and cartOpen — empty LLM response`);
        }
        break;
      }
      case "vsl_script": {
        const sections = (obj.sections as unknown[] | undefined)?.length ?? 0;
        if (sections === 0) {
          throw new AppError(422, `vsl_script output has zero sections — LLM returned truncated or empty response`);
        }
        break;
      }
      case "ad_copy": {
        const segs = (obj.segments as unknown[] | undefined)?.length ?? 0;
        const ads = (obj.ads as unknown[] | undefined)?.length ?? 0;
        if (segs === 0 && ads === 0) {
          throw new AppError(422, `ad_copy output has no segments or ads — empty LLM response`);
        }
        break;
      }
      case "landing_page_structure": {
        const sections = (obj.sections as unknown[] | undefined)?.length ?? 0;
        const headline = typeof obj.headline === "string" && obj.headline.length > 0;
        const overallStructure = typeof obj.overallStructure === "string" && obj.overallStructure.length > 0;
        if (sections === 0 && !headline && !overallStructure) {
          throw new AppError(422, `landing_page_structure output missing sections, headline, and overallStructure`);
        }
        break;
      }
      case "cpl_script": {
        const videos = (obj.videos as unknown[] | undefined)?.length ?? 0;
        if (videos === 0) {
          throw new AppError(422, `cpl_script output has no videos — LLM returned empty response`);
        }
        break;
      }
      case "stories_sequence": {
        const stories = (obj.stories as unknown[] | undefined)?.length ?? 0;
        if (stories === 0) {
          throw new AppError(422, `stories_sequence output has no stories — LLM returned empty response`);
        }
        break;
      }
      case "targeting_config": {
        const audiences = (obj.audiences as unknown[] | undefined)?.length ?? 0;
        const segments = (obj.segments as unknown[] | undefined)?.length ?? 0;
        if (audiences === 0 && segments === 0) {
          throw new AppError(422, `targeting_config output has no audiences or segments`);
        }
        break;
      }
    }
  };

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
  const existingArc = getArcFromIntakeData(intakeData);
  const arc = existingArc ?? await generateCampaignEmotionalArc(campaignId, workspaceId, intakeData, strategy, log);
  if (arc && !existingArc) {
    intakeData = { ...intakeData, _emotionalArc: arc };
  }

  // Pre-compute phase contexts for phase-aware agents
  const arcOverviewBlock = arc ? buildArcOverviewBlock(arc) : "";
  const cartOpenState = arc ? getAvatarStateForPhase(arc, "cart_open") : null;
  const cartPhaseBlock = cartOpenState ? buildPhaseStateBlock(cartOpenState) : arcOverviewBlock;

  // Capture copy and ad content references for compliance agent (set after generation)
  let capturedCopyContent: Record<string, unknown> | undefined;
  let capturedAdContent: Record<string, unknown> | undefined;

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
        status: "draft",
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

    // Output contract: throws if LLM returned wrong schema (e.g. ad copy instead of email sequence)
    validatePieceContract("email_sequence", copyOutput);

    const [piece] = await db
      .insert(contentPiecesTable)
      .values({
        campaignId,
        workspaceId,
        type: "email_sequence",
        status: "draft",
        title: `Copy Completa — ${copyOutput.campaignTitle}`,
        content: { ...copyOutput, _qualityScore: (copyOutput as any)._qualityScore ?? null } as any,
        aiProvider: "openai",
        creditsUsed: 80,
      })
      .returning();

    piecesGenerated++;
    agentsRun.push("copywriter");

    emitCampaignEvent({
      campaignId,
      type: "agent_completed",
      agentType: "copywriter",
      message: `Copywriter concluído — ${copyOutput.emailSequence.preLaunch.length + copyOutput.emailSequence.cartOpen.length + copyOutput.emailSequence.cartClose.length} e-mails + página de vendas + WhatsApp`,
      data: { pieceId: piece?.id },
      timestamp: new Date().toISOString(),
    });

    log.info({ campaignId, pieceId: piece?.id }, "Copywriter agent completed");
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

      const [piece] = await db
        .insert(contentPiecesTable)
        .values({
          campaignId,
          workspaceId,
          type: "landing_page_structure",
          status: "draft",
          title: `Página de Vendas — ${lpOutput.sections.length} seções | ${lpOutput.pageType}`,
          content: { ...lpOutput, _qualityScore: (lpOutput as any)._qualityScore ?? null } as any,
          aiProvider: "openai",
          creditsUsed: 65,
        })
        .returning();

      piecesGenerated++;
      agentsRun.push("landing_page");

      emitCampaignEvent({
        campaignId,
        type: "agent_completed",
        agentType: "landing_page",
        message: `Landing Page concluída — ${lpOutput.sections.length} seções wireframadas com copy + specs técnicas`,
        data: { pieceId: piece?.id },
        timestamp: new Date().toISOString(),
      });

      log.info({ campaignId, pieceId: piece?.id, sections: lpOutput.sections.length }, "Landing page agent completed");
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

    const [piece] = await db
      .insert(contentPiecesTable)
      .values({
        campaignId,
        workspaceId,
        type: "content_calendar",
        status: "draft",
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

    validatePieceContract("ad_copy", adOutput);

    const [piece] = await db
      .insert(contentPiecesTable)
      .values({
        campaignId,
        workspaceId,
        type: "ad_copy",
        status: "draft",
        title: `Pacote de Anúncios — ${adOutput.segments.length} segmentos`,
        content: { ...adOutput, _qualityScore: (adOutput as any)._qualityScore ?? null } as any,
        aiProvider: "openai",
        creditsUsed: 50,
      })
      .returning();

    piecesGenerated++;
    agentsRun.push("ad_copy");

    emitCampaignEvent({
      campaignId,
      type: "agent_completed",
      agentType: "ad_copy",
      message: `Ad Copy concluído — ${adOutput.segments.length} segmentos com Meta + Google + TikTok`,
      data: { pieceId: piece?.id },
      timestamp: new Date().toISOString(),
    });

    log.info({ campaignId, pieceId: piece?.id }, "Ad copy agent completed");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push({ agent: "ad_copy", error: msg });
    log.error({ err, campaignId }, "Ad copy agent failed");
    emitAgentError(campaignId, "ad_copy", err);
  }

  // ── 6. Targeting Agent (campaigns with traffic budget) ───────────────────────
  if (hasTrafficBudget) {
    if (!skipAgent("targeting_config", "targeting")) try {
      emitCampaignEvent({
        campaignId,
        type: "agent_started",
        agentType: "targeting",
        message: "Agente Targeting — configurando audiências no Meta, Google e TikTok...",
        timestamp: new Date().toISOString(),
      });

      const targetingOutput = await runTargetingAgent(
        campaignId,
        workspaceId,
        intakeData,
        profile,
        log,
      );

      validatePieceContract("targeting_config", targetingOutput);

      const [piece] = await db
        .insert(contentPiecesTable)
        .values({
          campaignId,
          workspaceId,
          type: "targeting_config",
          status: "draft",
          title: `Configuração de Audiências — ${targetingOutput.metaAudiences.length} Meta + ${targetingOutput.googleAudiences.length} Google + ${targetingOutput.tiktokAudiences.length} TikTok`,
          content: targetingOutput as any,
          aiProvider: "openai",
          creditsUsed: 55,
        })
        .returning();

      piecesGenerated++;
      agentsRun.push("targeting");

      emitCampaignEvent({
        campaignId,
        type: "agent_completed",
        agentType: "targeting",
        message: `Targeting concluído — ${targetingOutput.metaAudiences.length + targetingOutput.googleAudiences.length + targetingOutput.tiktokAudiences.length} audiências configuradas + UTMs prontos`,
        data: { pieceId: piece?.id },
        timestamp: new Date().toISOString(),
      });

      log.info({ campaignId, pieceId: piece?.id }, "Targeting agent completed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ agent: "targeting", error: msg });
      log.error({ err, campaignId }, "Targeting agent failed");
      emitAgentError(campaignId, "targeting", err);
    }
  }

  // ── 7. Media Buyer Agent (campaigns with traffic budget) ─────────────────────
  if (hasTrafficBudget) {
    if (!skipAgent("media_buying_plan", "media_buyer")) try {
      emitCampaignEvent({
        campaignId,
        type: "agent_started",
        agentType: "media_buyer",
        message: "Agente Media Buyer — planejando veiculação e alocação diária de budget...",
        timestamp: new Date().toISOString(),
      });

      const mediaBuyerOutput = await runMediaBuyerAgent(
        campaignId,
        workspaceId,
        intakeData,
        strategy,
        profile,
        launchPlan,
        log,
      );

      const [piece] = await db
        .insert(contentPiecesTable)
        .values({
          campaignId,
          workspaceId,
          type: "media_buying_plan",
          status: "draft",
          title: `Plano de Media Buying — R$${mediaBuyerOutput.totalBudget} | ${mediaBuyerOutput.dailyAllocations.length} dias`,
          content: mediaBuyerOutput as any,
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

      validatePieceContract("vsl_script", vslOutput);

      const [piece] = await db
        .insert(contentPiecesTable)
        .values({
          campaignId,
          workspaceId,
          type: "vsl_script",
          status: "draft",
          title: vslOutput.title,
          content: { ...vslOutput, _qualityScore: (vslOutput as any)._qualityScore ?? null } as any,
          aiProvider: "openai",
          creditsUsed: 70,
        })
        .returning();

      piecesGenerated++;
      agentsRun.push("vsl_script");

      emitCampaignEvent({
        campaignId,
        type: "agent_completed",
        agentType: "vsl_script",
        message: `VSL Script concluído — ${vslOutput.totalDuration} | ${vslOutput.sections.length} seções`,
        data: { pieceId: piece?.id },
        timestamp: new Date().toISOString(),
      });

      log.info({ campaignId, pieceId: piece?.id, duration: vslOutput.totalDuration }, "VSL script agent completed");
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
          type: "content_calendar",
          status: "draft",
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

      validatePieceContract("cpl_script", cplOutput);

      const [piece] = await db
        .insert(contentPiecesTable)
        .values({
          campaignId,
          workspaceId,
          type: "cpl_script",
          status: "draft",
          title: `CPL — ${cplOutput.totalVideos} Vídeos de Pré-Lançamento`,
          content: { ...cplOutput, _qualityScore: (cplOutput as any)._qualityScore ?? null } as any,
          aiProvider: "openai",
          creditsUsed: 75,
        })
        .returning();

      piecesGenerated++;
      agentsRun.push("cpl_script");

      emitCampaignEvent({
        campaignId,
        type: "agent_completed",
        agentType: "cpl_script",
        message: `CPL concluído — ${cplOutput.totalVideos} roteiros de CPL prontos para gravar`,
        data: { pieceId: piece?.id },
        timestamp: new Date().toISOString(),
      });

      log.info({ campaignId, pieceId: piece?.id, videos: cplOutput.totalVideos }, "CPL script agent completed");
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
          status: "draft",
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
          status: "draft",
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
        message: `Live Script concluído — ${liveOutput.totalDuration} | ${liveOutput.segments.length} segmentos roteirizados`,
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

    validatePieceContract("stories_sequence", storiesOutput);

    const [piece] = await db
      .insert(contentPiecesTable)
      .values({
        campaignId,
        workspaceId,
        type: "stories_sequence",
        status: "draft",
        title: `Stories — ${storiesOutput.totalSequences} sequências narrativas`,
        content: storiesOutput as any,
        aiProvider: "openai",
        creditsUsed: 45,
      })
      .returning();

    piecesGenerated++;
    agentsRun.push("stories_sequence");

    emitCampaignEvent({
      campaignId,
      type: "agent_completed",
      agentType: "stories_sequence",
      message: `Stories concluídos — ${storiesOutput.sequences.length} sequências com frames completos`,
      data: { pieceId: piece?.id },
      timestamp: new Date().toISOString(),
    });

    log.info({ campaignId, pieceId: piece?.id, sequences: storiesOutput.sequences.length }, "Stories sequence agent completed");
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
          status: "draft",
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
          status: "draft",
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
          status: "draft",
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
      (p) => REGENERABLE_PIECE_TYPES.has(p.type ?? "") && isPieceContentEmpty(p.content),
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
            if (updated && !isPieceContentEmpty(updated.content)) {
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

  // ── Emotional Coherence Check (fire-and-forget) ───────────────────────────
  // Runs after content generation completes. Checks if pieces respect the arc
  // progression. Non-blocking — saves report to campaign.metadata._coherenceReport.
  if (!allFailed && piecesGenerated > 0) {
    setImmediate(() => {
      runEmotionalCoherenceCheck(campaignId, workspaceId, log).catch(err => {
        log.error({ err, campaignId }, "Coherence check fire-and-forget failed");
      });
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
    status: errors.length === 0 ? "completed" : errors.length < agentsRun.length ? "partial" : "failed",
    pieceResults,
  };
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
      status: "draft",
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

  return { pieces, total: pieces.length };
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
    .select({ id: campaignsTable.id })
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
  return piece;
}

export async function rejectContentPiece(
  campaignId: string,
  workspaceId: string,
  pieceId: string,
  reason: string,
) {
  const [campaign] = await db
    .select({ id: campaignsTable.id })
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

  const { content: rawOutput } = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "copywriter",
    systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    log,
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
};

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

  let newContent: unknown;

  try {
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
      default:
        throw new ValidationError(`Unknown agent: ${agentName}`);
    }
  } catch (err) {
    log.error({ err, campaignId, pieceId, agentName }, "Regeneration agent failed");
    throw err;
  }

  // NULL / EMPTY GUARD — if the agent returned null, undefined, or an empty object
  // without throwing, refuse to overwrite the DB row with empty content.
  // This prevents silent data loss where a piece goes from empty→still empty but
  // gets status "pending_approval" and appears to have been successfully regenerated.
  if (isPieceContentEmpty(newContent)) {
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

  const [updated] = await db
    .update(contentPiecesTable)
    .set({
      content: newContent as any,
      status: "pending_approval",
      approvedAt: null,
    })
    .where(and(eq(contentPiecesTable.id, pieceId), eq(contentPiecesTable.campaignId, campaignId)))
    .returning();

  if (!updated) throw new NotFoundError("Content piece");

  log.info({ pieceId, campaignId, agentName }, "Content piece regenerated successfully");
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

  const { content: rawOutput } = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "copywriter",
    systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    log,
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
export async function resolveComplianceReview(
  campaignId: string,
  workspaceId: string,
  decision: "accept_all" | "custom" | "override",
  corrections: Array<{ violationIndex: number; acceptedText: string }> | undefined,
  log: Logger,
): Promise<{ ok: boolean; status: string }> {
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
