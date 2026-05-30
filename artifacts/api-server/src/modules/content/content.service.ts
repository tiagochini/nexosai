import { eq, and, desc, ne } from "drizzle-orm";
import {
  db,
  campaignsTable,
  contentPiecesTable,
  mediaBriefsTable,
  auditLogsTable,
} from "@workspace/db";
import { transitionCampaign, CONTENT_PHASE_ENTRY_STATUSES } from "../campaigns/campaigns.service.js";
import { runAgent, parseAgentJSON } from "../agents/agent.runner.js";
import { runCopywriterAgent } from "../agents/copywriter.agent.js";
import { runSocialMediaAgent } from "../agents/social-media.agent.js";
import { runAdCopyAgent } from "../agents/ad-copy.agent.js";
import { runVSLScriptAgent } from "../agents/vsl-script.agent.js";
import { runMediaBriefAgent } from "../agents/media-brief.agent.js";
import { runCPLScriptAgent } from "../agents/cpl-script.agent.js";
import { runWebinarScriptAgent } from "../agents/webinar-script.agent.js";
import { runLiveScriptAgent } from "../agents/live-script.agent.js";
import { runStoriesSequenceAgent } from "../agents/stories-sequence.agent.js";
import { runCreativeDirectorAgent } from "../agents/creative-director.agent.js";
import { runLandingPageAgent } from "../agents/landing-page.agent.js";
import { runTargetingAgent } from "../agents/targeting.agent.js";
import { runMediaBuyerAgent } from "../agents/media-buyer.agent.js";
import { runVideoStrategyAgent } from "../agents/video-strategy.agent.js";
import { runCreatorGrowthAgent } from "../agents/creator-growth.agent.js";
import { runComplianceAgent } from "../agents/compliance.agent.js";
import { runOptimizationAgent } from "../agents/optimization.agent.js";
import { runEmotionalCoherenceCheck } from "../agents/emotional-coherence-checker.agent.js";
import { emitCampaignEvent } from "../realtime/realtime.service.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
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
  const isResume = campaign.status === "generating";

  if (done.size > 0) {
    log.info({ campaignId, done: [...done], isResume }, "CHECKPOINT: resuming content generation — skipping already completed agents");
  }

  const skipAgent = (pieceType: string, agentName: string): boolean => {
    if (!done.has(pieceType)) return false;
    agentsRun.push(agentName);
    piecesGenerated++;
    log.info({ campaignId, agentName, pieceType }, "CHECKPOINT: agent already completed — skipping LLM call");
    emitCampaignEvent({
      campaignId,
      type: "agent_completed",
      agentType: agentName,
      message: `${agentName} — ✓ retomado do checkpoint (saída já salva)`,
      timestamp: new Date().toISOString(),
    });
    return true;
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

    const [piece] = await db
      .insert(contentPiecesTable)
      .values({
        campaignId,
        workspaceId,
        type: "email_sequence",
        status: "draft",
        title: `Copy Completa — ${copyOutput.campaignTitle}`,
        content: copyOutput as any,
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
          content: lpOutput as any,
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

    const [piece] = await db
      .insert(contentPiecesTable)
      .values({
        campaignId,
        workspaceId,
        type: "ad_copy",
        status: "draft",
        title: `Pacote de Anúncios — ${adOutput.segments.length} segmentos`,
        content: adOutput as any,
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

      const [piece] = await db
        .insert(contentPiecesTable)
        .values({
          campaignId,
          workspaceId,
          type: "vsl_script",
          status: "draft",
          title: vslOutput.title,
          content: vslOutput as any,
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

      const [piece] = await db
        .insert(contentPiecesTable)
        .values({
          campaignId,
          workspaceId,
          type: "cpl_script",
          status: "draft",
          title: `CPL — ${cplOutput.totalVideos} Vídeos de Pré-Lançamento`,
          content: cplOutput as any,
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

  // ── 15. Media Brief Agent ────────────────────────────────────────────────────
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push({ agent: "compliance", error: msg });
    log.error({ err, campaignId }, "Compliance agent failed");
    emitAgentError(campaignId, "compliance", err);
  }

  // ── Final status ─────────────────────────────────────────────────────────────
  // After content generation: move to awaiting_approval so user can review and
  // approve before launch. If ALL agents failed fall back to strategy_ready so
  // the user can re-trigger content generation.
  const allFailed = errors.length > 0 && agentsRun.length === 0;
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

  return {
    campaignId,
    piecesGenerated,
    mediaBriefsGenerated,
    agentsRun,
    errors,
    status: errors.length === 0 ? "completed" : errors.length < agentsRun.length ? "partial" : "failed",
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
