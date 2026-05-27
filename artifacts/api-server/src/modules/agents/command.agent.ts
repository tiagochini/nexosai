import { eq, and } from "drizzle-orm";
import { db, campaignsTable, auditLogsTable } from "@workspace/db";
import { transitionCampaign, VALID_STATUS_TRANSITIONS, STRATEGY_PHASE_ENTRY_STATUSES } from "../campaigns/campaigns.service.js";
import { buildCampaignBrain, getCampaignBrain, updateBrainSection } from "../campaign-brain/campaign-brain.service.js";
import { getCreativeIntent, getApprovedDirectionContext } from "../creative-intent/creative-intent.service.js";
import { runStrategicAlignmentEngine } from "../campaign-brain/alignment.service.js";
import { runAgent, parseAgentJSON } from "./agent.runner.js";
import { runProfileBuilderAgent, type ProfileBuilderOutput } from "./profile-builder.agent.js";
import { runStrategyAgent } from "./strategy.agent.js";
import { runOfferAgent } from "./offer.agent.js";
import { runStrategicCoreBriefing, type StrategicBrief } from "./strategic-core.agent.js";
import { runLaunchManagerAgent } from "./launch-manager.agent.js";
import { runContinuousSalesManagerAgent } from "./continuous-sales-manager.agent.js";
import { runPerpetualLaunchManagerAgent } from "./perpetual-launch-manager.agent.js";
import { runFinancialProjectorAgent } from "./financial-projector.agent.js";
import { runTrafficIntelligenceAgent, type TrafficIntelligenceOutput } from "./traffic-intelligence.agent.js";
import { runExecutionGovernor, type ExecutionPlan } from "./execution-governor.agent.js";
import { runBusinessIntelligenceAgent, type BusinessIntelligenceOutput } from "./business-intelligence.agent.js";
import { runMemoryCompression } from "./memory-compression.agent.js";
import { buildCrossCampaignIntelligence } from "./cross-campaign-intelligence.service.js";
import { runUXSimplificationEngine } from "./ux-simplification.agent.js";
import {
  initializeCampaignMemory,
  getCampaignMemory,
  addMemoryEntry,
  assembleCampaignContext,
  setDoctrine,
  type CampaignMemory,
} from "./campaign-memory.service.js";
import { runStrategicDoctrineEngine, type DoctrineOutput } from "./strategic-doctrine.agent.js";
import { checkDoctrineAsync } from "../campaign-brain/doctrine-gate.service.js";
import { runSelfCritique } from "../campaign-brain/self-critique.service.js";
import { emitCampaignEvent } from "../realtime/realtime.service.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { validateIntakeCompleteness, type CampaignType, type CampaignTrack } from "../intake/intake.service.js";
import { getCampaignCreditEstimate } from "@workspace/db";
import type { Logger } from "pino";

export interface OrchestrationResult {
  campaignId: string;
  type: string;
  track: string;
  agentsRun: string[];
  profile?: Record<string, unknown>;
  strategy?: Record<string, unknown>;
  offerAnalysis?: Record<string, unknown>;
  launchPlan?: Record<string, unknown>;
  financialProjection?: Record<string, unknown>;
  trafficPlan?: Record<string, unknown>;
  executionPlan?: ExecutionPlan;
  businessIntelligence?: BusinessIntelligenceOutput;
  checkpointsPending: string[];
  status: string;
}

// Maps each campaign type to its manager agent and whether it uses the financial projector
const CAMPAIGN_TYPE_CONFIG: Record<
  CampaignType,
  {
    label: string;
    managerAgent:
      | "launch_manager"
      | "continuous_sales_manager"
      | "perpetual_launch_manager"
      | "generic";
    hasFinancialProjection: boolean;
    defaultTrack: CampaignTrack;
    thinkingMessage: string;
  }
> = {
  launch: {
    label: "Lançamento clássico (carrinho fechado → abertura → fechamento → remarketing)",
    managerAgent: "launch_manager",
    hasFinancialProjection: true,
    defaultTrack: "six_digits",
    thinkingMessage: "Estruturando ciclo completo de lançamento com carrinho fechado...",
  },
  perpetual_launch: {
    label: "Lançamento perpétuo (webinar perpétuo, carrinho individual por lead)",
    managerAgent: "perpetual_launch_manager",
    hasFinancialProjection: true,
    defaultTrack: "not_applicable",
    thinkingMessage: "Mapeando funil de lançamento perpétuo com abertura individual...",
  },
  flash_sale: {
    label: "Queima relâmpago (24-48h de urgência extrema)",
    managerAgent: "generic",
    hasFinancialProjection: true,
    defaultTrack: "not_applicable",
    thinkingMessage: "Montando estratégia de queima relâmpago...",
  },
  live_sale: {
    label: "Live de vendas (evento ao vivo)",
    managerAgent: "generic",
    hasFinancialProjection: true,
    defaultTrack: "not_applicable",
    thinkingMessage: "Planejando estrutura da live de vendas...",
  },
  continuous_sales: {
    label: "Vendas contínuas / evergreen (carrinho sempre aberto)",
    managerAgent: "continuous_sales_manager",
    hasFinancialProjection: true,
    defaultTrack: "not_applicable",
    thinkingMessage: "Construindo funil evergreen com CAC/LTV otimizados...",
  },
  subscription_growth: {
    label: "Crescimento de assinatura / membership",
    managerAgent: "continuous_sales_manager",
    hasFinancialProjection: true,
    defaultTrack: "not_applicable",
    thinkingMessage: "Desenhando modelo de crescimento de assinantes...",
  },
  authority: {
    label: "Construção de autoridade e posicionamento",
    managerAgent: "generic",
    hasFinancialProjection: false,
    defaultTrack: "not_applicable",
    thinkingMessage: "Mapeando estratégia de autoridade e posicionamento...",
  },
  audience_growth: {
    label: "Crescimento de audiência",
    managerAgent: "generic",
    hasFinancialProjection: false,
    defaultTrack: "not_applicable",
    thinkingMessage: "Estruturando plano de crescimento de audiência...",
  },
  branding: {
    label: "Branding e construção de marca",
    managerAgent: "generic",
    hasFinancialProjection: false,
    defaultTrack: "not_applicable",
    thinkingMessage: "Construindo estratégia de marca...",
  },
  creator_monetization: {
    label: "Monetização de criador de conteúdo",
    managerAgent: "generic",
    hasFinancialProjection: true,
    defaultTrack: "not_applicable",
    thinkingMessage: "Mapeando modelo de monetização para criador...",
  },
  upsell: {
    label: "Upsell / Cross-sell para clientes existentes",
    managerAgent: "generic",
    hasFinancialProjection: true,
    defaultTrack: "not_applicable",
    thinkingMessage: "Calculando sequência de upsell e revenue adicional...",
  },
  remarketing: {
    label: "Reativação de leads frios",
    managerAgent: "generic",
    hasFinancialProjection: true,
    defaultTrack: "not_applicable",
    thinkingMessage: "Desenhando sequência de reativação...",
  },
  affiliate: {
    label: "Campanha de afiliado",
    managerAgent: "launch_manager",
    hasFinancialProjection: true,
    defaultTrack: "six_digits",
    thinkingMessage: "Estruturando campanha de afiliado...",
  },
  scale: {
    label: "Escala de campanha existente",
    managerAgent: "generic",
    hasFinancialProjection: true,
    defaultTrack: "not_applicable",
    thinkingMessage: "Planejando estratégia de escala...",
  },
  regional_dominance: {
    label: "Dominância regional / local",
    managerAgent: "generic",
    hasFinancialProjection: true,
    defaultTrack: "not_applicable",
    thinkingMessage: "Mapeando estratégia de dominância regional...",
  },
};

// Prompt built dynamically to include calibrated credit estimates for the campaign type
function buildCommandSystemPrompt(type: string, hasTraffic: boolean): string {
  const estimate = getCampaignCreditEstimate(type);
  const contentNote = hasTraffic
    ? "com budget de tráfego (targeting + media_buyer ativos)"
    : "sem budget de tráfego declarado";
  const monitoringEstimate = Math.max(0, estimate.typical - 45 - 150 - 37);
  const fence = "```";
  return (
    `Você é o Command Agent da NexOS AI — o orquestrador central de toda execução de campanha.\n` +
    `\n` +
    `Você recebe o tipo de campanha, o intake e decide:\n` +
    `1. Se o intake está completo o suficiente para avançar\n` +
    `2. Ajustes estratégicos que os outros agentes devem considerar\n` +
    `3. Estimativa CALIBRADA de créditos que serão consumidos\n` +
    `\n` +
    `## Custos reais desta campanha (${estimate.label}, ${contentNote}):\n` +
    `  Estratégia: 45 cr (command + profile_builder + strategy + offer + launch_manager + financial_projector)\n` +
    `  Conteúdo: 145-161 cr (16 agentes; critique loop 3 turnos em copywriter/ad_copy/landing_page/compliance)\n` +
    `  Sequência: 37 cr (sequence_builder=7 + 15 itens x item_copy=2)\n` +
    `  Monitoramento: 75-190 cr (WhatsApp AI 2cr/msg + optimization trigger 3cr/ciclo)\n` +
    `\n` +
    `  FAIXA ESTIMADA PARA ESTE TIPO ("${estimate.label}"):\n` +
    `    Minimo: ${estimate.min} créditos (sem tráfego pago, volume WhatsApp baixo)\n` +
    `    Tipico: ${estimate.typical} créditos (operação normal de lançamento)\n` +
    `    Maximo: ${estimate.max} créditos (tráfego pago + WhatsApp intenso + múltiplas otimizações)\n` +
    `\n` +
    `**Retorne APENAS JSON valido (sem texto antes ou depois):**\n` +
    `\n` +
    fence + `json\n` +
    `{\n` +
    `  "readinessScore": 0,\n` +
    `  "readinessVerdict": "ready|needs_info|blocked",\n` +
    `  "missingCriticalInfo": ["string"],\n` +
    `  "specialInstructions": {\n` +
    `    "strategy": "string ou null",\n` +
    `    "offer": "string ou null",\n` +
    `    "manager": "string ou null",\n` +
    `    "financial_projector": "string ou null"\n` +
    `  },\n` +
    `  "campaignComplexity": "standard|complex|enterprise",\n` +
    `  "estimatedCredits": ${estimate.typical},\n` +
    `  "creditBreakdown": {\n` +
    `    "strategy": 45,\n` +
    `    "content": 150,\n` +
    `    "sequence": 37,\n` +
    `    "monitoring": ${monitoringEstimate}\n` +
    `  },\n` +
    `  "commandNotes": "string — observações criticas para o cliente sobre esta campanha"\n` +
    `}\n` +
    fence
  );
}

export async function orchestrateCampaign(
  campaignId: string,
  workspaceId: string,
  log: Logger,
): Promise<OrchestrationResult> {
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

  // PIPELINE_KERNEL: single source of truth — STRATEGY_PHASE_ENTRY_STATUSES from campaigns.service
  if (!(STRATEGY_PHASE_ENTRY_STATUSES as readonly string[]).includes(campaign.status)) {
    throw new ValidationError(
      `Campaign is in status '${campaign.status}' and cannot be orchestrated`,
    );
  }

  const type = (campaign.type ?? "launch") as CampaignType;
  const track = (campaign.track ?? "six_digits") as CampaignTrack;
  const intakeData = (campaign.intakeData ?? {}) as Record<string, unknown>;
  const typeConfig = CAMPAIGN_TYPE_CONFIG[type] ?? CAMPAIGN_TYPE_CONFIG.launch;
  const hasTraffic = Boolean(
    intakeData["campaign.trafficBudget"] || intakeData["campaign.paidTraffic"],
  );

  const { valid, missingRequired } = validateIntakeCompleteness(
    type,
    track,
    intakeData,
  );

  emitCampaignEvent({
    campaignId,
    type: "phase_changed",
    message: `Command Agent ativado — ${typeConfig.label}`,
    data: { campaignType: type, track, intakeFields: Object.keys(intakeData).length },
    timestamp: new Date().toISOString(),
  });

  // Only transition if not already in analyzing (intake finalize already sets analyzing)
  if (campaign.status !== "analyzing") {
    await transitionCampaign(campaignId, workspaceId, "analyzing", "command agent activated — orchestration started", log);
  }

  try {
    await db.insert(auditLogsTable).values({
      workspaceId,
      campaignId,
      action: "campaign.orchestration.started",
      actor: "system",
      data: { type, track, intakeComplete: valid, missingRequired },
    });
  } catch (auditErr: unknown) {
    const code = (auditErr as { cause?: { code?: string } })?.cause?.code;
    if (code !== "23503") throw auditErr;
    log.warn({ workspaceId, campaignId }, "audit_log FK violation — workspace deleted during agent run (ignored)");
  }

  // Command agent assesses readiness and provides special instructions
  const commandResult = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "command",
    systemPrompt: buildCommandSystemPrompt(type, hasTraffic),
    messages: [
      {
        role: "user",
        content: `Avalie a prontidão desta campanha e forneça instruções especiais.

**Tipo:** ${type} — ${typeConfig.label}
**Track:** ${track}
**Intake completo:** ${valid ? "SIM" : "NÃO"}
**Campos faltando:** ${missingRequired.join(", ") || "nenhum"}
**Produto físico:** ${intakeData["product.deliveryMethod"] !== "100_online" ? "SIM" : "NÃO"}

**Dados de Intake:**
\`\`\`json
${JSON.stringify(intakeData, null, 2)}
\`\`\`

Retorne o JSON de avaliação.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: [
      "O Comandante está avaliando a operação — tipo, modelo e arquétipo da campanha...",
      typeConfig.thinkingMessage,
      "Verificando completude do briefing e gaps críticos de inteligência...",
      "Avaliando viabilidade, estimando recursos e mapeando riscos operacionais...",
    ],
  });

  const commandPlan = parseAgentJSON(commandResult.content, {
    readinessScore: 70,
    readinessVerdict: "ready",
    missingCriticalInfo: missingRequired,
    specialInstructions: {},
    campaignComplexity: "standard",
    estimatedCredits: 200,
    commandNotes: "",
  });

  if (commandPlan.readinessVerdict === "blocked") {
    await transitionCampaign(campaignId, workspaceId, "intake", "command agent blocked — intake incomplete, returning to intake", log);

    return {
      campaignId,
      type,
      track,
      agentsRun: ["command"],
      checkpointsPending: [],
      status: "intake",
    };
  }

  const agentsRun: string[] = ["command"];
  const checkpointsPending: string[] = [];
  let profile: ProfileBuilderOutput | undefined;
  let strategy: Record<string, unknown> | undefined;
  let strategicBrief: StrategicBrief | undefined;
  let campaignMemory: CampaignMemory | undefined;
  let memoryContext: string | undefined;
  let doctrine: DoctrineOutput | undefined;
  let offerAnalysis: Record<string, unknown> | undefined;
  let launchPlan: Record<string, unknown> | undefined;
  let financialProjection: Record<string, unknown> | undefined;
  let trafficPlan: TrafficIntelligenceOutput | undefined;
  let executionPlan: ExecutionPlan | undefined;
  let biOutput: BusinessIntelligenceOutput | undefined;

  // ── 0b. Execution Governor ─────────────────────────────────────────────────
  // Decides executionMode (quick/standard/premium), classifies agents,
  // and produces the execution plan the pipeline respects.
  // Runs immediately after Command validates readiness — before all other agents.
  try {
    emitCampaignEvent({
      campaignId,
      type: "agent_thinking",
      agentType: "command",
      message: "Execution Governor analisando complexidade e otimizando pipeline...",
      timestamp: new Date().toISOString(),
    });
    executionPlan = await runExecutionGovernor(
      campaignId,
      workspaceId,
      type,
      track,
      intakeData,
      hasTraffic,
      commandPlan.campaignComplexity ?? "standard",
      500,
      log,
    );
    agentsRun.push("execution_governor");
    log.info({
      campaignId,
      executionMode: executionPlan.executionMode,
      skippedAgents: executionPlan.skippedAgents,
      estimatedCost: executionPlan.estimatedCost,
      operationalRisk: executionPlan.operationalRisk,
      estimatedComplexity: executionPlan.estimatedComplexity,
      confidenceScore: executionPlan.confidenceScore,
    }, "Execution Governor plan established");
    emitCampaignEvent({
      campaignId,
      type: "agent_thinking",
      agentType: "command",
      message: `Pipeline: modo ${executionPlan.executionMode.toUpperCase()} | ${executionPlan.activeAgents.length} agentes | ${executionPlan.skippedAgents.length} pulados | risco ${executionPlan.operationalRisk}`,
      timestamp: new Date().toISOString(),
    });
  } catch (govErr) {
    log.warn({ govErr, campaignId }, "Execution Governor failed — using default execution plan (all agents run)");
  }

  // Helper: check if an agent was skipped by the Execution Governor
  const isSkippedByGovernor = (agentId: string): boolean =>
    executionPlan?.skippedAgents?.includes(agentId) ?? false;

  // ── 0c. Cross-Campaign Intelligence ────────────────────────────────────────
  // Extracts patterns from past campaigns of this workspace and vertical learnings.
  // Runs non-blocking — result is prepended to memoryContext when it's built.
  // This is what makes each new campaign smarter than the last.
  let crossCampaignContext = "";
  try {
    crossCampaignContext = await buildCrossCampaignIntelligence(
      workspaceId,
      campaignId,
      intakeData,
      log,
    );
    if (crossCampaignContext) {
      log.info({ campaignId }, "Cross-campaign intelligence loaded — historical patterns active");
    }
  } catch (crossErr) {
    log.warn({ crossErr, campaignId }, "Cross-campaign intelligence unavailable (non-fatal)");
  }

  // ── 1. Profile Builder Agent (all campaign types — runs first) ─────────────
  // Builds deep product, avatar, segmentation and market intelligence.
  // Its output feeds every downstream agent as enriched context.
  try {
    emitCampaignEvent({
      campaignId,
      type: "agent_started",
      agentType: "profile_builder",
      message: "Construindo inteligência de perfil — produto, avatar e mercado...",
      timestamp: new Date().toISOString(),
    });

    const result = await runProfileBuilderAgent(
      campaignId,
      workspaceId,
      intakeData,
      type,
      log,
    );
    profile = result;
    agentsRun.push("profile_builder");

    // Save to audienceData (avatar + segments) and targetingData (market + positioning)
    await db
      .update(campaignsTable)
      .set({
        audienceData: {
          primaryAvatar: result.primaryAvatar,
          secondaryAvatars: result.secondaryAvatars,
          segments: result.segments,
          profileScore: result.profileScore,
          validationWarnings: result.validationWarnings,
          criticalInsights: result.criticalInsights,
          profileStrengths: result.profileStrengths,
        } as any,
        targetingData: {
          product: result.product,
          marketIntelligence: result.marketIntelligence,
          positioning: result.positioning,
        } as any,
      })
      .where(eq(campaignsTable.id, campaignId));

    log.info({ campaignId, profileScore: result.profileScore }, "Profile builder completed");
  } catch (err) {
    log.error({ err, campaignId }, "Profile builder failed — continuing without profile");
    emitAgentError(campaignId, "profile_builder", err);
  }

  // ── 2. Strategic Core Briefing (after Profile Builder — before all other agents) ──
  // Produces the Global Strategic Brief that every downstream agent references.
  // Runs on Profile Builder output + intake data — BEFORE Strategy.
  // Strategy agent then receives this brief as its foundation.
  try {
    emitCampaignEvent({
      campaignId,
      type: "agent_thinking",
      agentType: "strategy",
      message: "NEXOS Strategic Core definindo identidade estratégica global da campanha...",
      timestamp: new Date().toISOString(),
    });
    strategicBrief = await runStrategicCoreBriefing(
      campaignId,
      workspaceId,
      profile ?? null,
      intakeData,
      log,
    );
    agentsRun.push("strategic_core");
    log.info({
      campaignId,
      consistencyScore: strategicBrief.consistencyScore,
      riskScore: strategicBrief.riskScore,
      confidenceScore: strategicBrief.confidenceScore,
      requiresHumanReview: strategicBrief.requiresHumanReview,
      warnings: strategicBrief.coreWarnings.length,
      prohibitedPromises: strategicBrief.prohibitedPromises.length,
    }, "Strategic Core brief generated");

    // ── Campaign Memory Layer — initialize from Strategic Brief ──────────────
    // The brief becomes the source of truth. Every downstream agent gets the
    // assembled context block so no agent contradicts the approved positioning.
    try {
      campaignMemory = await initializeCampaignMemory(
        campaignId,
        intakeData,
        strategicBrief,
        log,
      );
      // Prepend cross-campaign intelligence so every agent has historical context
      // from past campaigns BEFORE the current campaign's assembled context.
      const baseContext = assembleCampaignContext(campaignMemory);
      memoryContext = crossCampaignContext
        ? crossCampaignContext + "\n" + baseContext
        : baseContext;
      agentsRun.push("campaign_memory");
      log.info({ campaignId, memoryVersion: campaignMemory.version, hasCrossContext: !!crossCampaignContext }, "Campaign memory initialized");
    } catch (memErr) {
      log.warn({ memErr, campaignId }, "Campaign memory init failed — agents will run without memory context");
    }
  } catch (err) {
    log.warn({ err, campaignId }, "Strategic Core briefing failed — continuing without brief");
  }

  // ── 2b. Strategic Doctrine Engine (after memory init — enriches context for all agents) ──
  // Diagnoses consciousness stage, market sophistication, lead temperature.
  // Produces Campaign Doctrine, Launch Logic, Emotional Sequence, Strategic Warnings.
  // Doctrine is stored in memory and injected into every downstream agent.
  // Skipped by Execution Governor for simple campaigns (flash_sale, quick mode).
  // Runs BEFORE Strategy — strategy agent receives doctrine context via memoryContext.
  if (strategicBrief && campaignMemory && !isSkippedByGovernor("strategic_doctrine")) {
    try {
      emitCampaignEvent({
        campaignId,
        type: "agent_thinking",
        agentType: "strategy",
        message: "Strategic Doctrine Engine aplicando frameworks de Walker, Hormozi, Schwartz e Cialdini...",
        timestamp: new Date().toISOString(),
      });
      doctrine = await runStrategicDoctrineEngine(
        campaignId,
        workspaceId,
        intakeData,
        null,
        strategicBrief,
        log,
        profile,
        memoryContext,
      );
      agentsRun.push("strategic_doctrine");
      // Persist doctrine into memory — downstream agents get it via memoryContext
      await setDoctrine(campaignId, doctrine, log);
      // Rebuild memoryContext with the enriched doctrine block so
      // all downstream agents see consciousness stage, launch logic, warnings, etc.
      const refreshedMemory = await getCampaignMemory(campaignId);
      if (refreshedMemory) memoryContext = assembleCampaignContext(refreshedMemory);

      // Inject approved Creative Direction into memoryContext (if user approved one)
      // This transparently propagates the approved direction to ALL downstream agents.
      try {
        const creativeIntent = await getCreativeIntent(campaignId, workspaceId);
        const directionCtx = getApprovedDirectionContext(creativeIntent);
        if (directionCtx && memoryContext) {
          memoryContext = memoryContext + "\n\n" + directionCtx;
          log.info({ campaignId }, "Approved creative direction injected into agent context");
        } else if (directionCtx) {
          memoryContext = directionCtx;
        }
      } catch {
        // Creative intent is optional — never block execution if not found
      }

      log.info({
        campaignId,
        consciousnessStage: doctrine.audienceConsciousnessStage,
        marketSophistication: doctrine.marketSophistication,
        leadTemperature: doctrine.leadTemperature,
        urgencyLevel: doctrine.urgencyLevel,
        launchLogicCount: doctrine.launchLogic.length,
        emotionalPhases: doctrine.emotionalSequence.length,
        warnings: doctrine.strategicWarnings.length,
        confidenceScore: doctrine.confidenceScore,
      }, "Strategic Doctrine Engine completed");
    } catch (docErr) {
      log.warn({ docErr, campaignId }, "Strategic Doctrine Engine failed — agents proceed without doctrine");
    }
  }

  // ── 3. Strategy Agent (all campaign types) ──────────────────────────────────
  // Runs AFTER Strategic Core + Doctrine — uses the brief as its foundation.
  // MemoryContext already contains doctrine enrichment when available.
  try {
    const result = await runStrategyAgent(
      campaignId,
      workspaceId,
      intakeData,
      track,
      log,
      profile,
      strategicBrief ?? undefined,
    );
    strategy = result as unknown as Record<string, unknown>;
    agentsRun.push("strategy");
    checkpointsPending.push("strategy_approval");

    await transitionCampaign(campaignId, workspaceId, "strategy_ready", "strategy agent completed", log, {
      strategyData: result as any,
    });

    // Doctrine Gate + Self-Critique (fire-and-forget — never block pipeline)
    setImmediate(() => {
      const strategySnapshot = strategy ?? {};
      getCampaignBrain(campaignId).then(brainSnap => {
        if (brainSnap?.offer) {
          checkDoctrineAsync(campaignId, workspaceId, "strategy", strategySnapshot, brainSnap, log);
        }
      }).catch(() => {});
      runSelfCritique(campaignId, workspaceId, "strategy", strategySnapshot, log).catch(() => {});
    });
  } catch (err) {
    log.error({ err, campaignId }, "Strategy agent failed");
    emitAgentError(campaignId, "strategy", err);
  }

  // ── 3. Offer Agent (all types with a product for sale) ─────────────────────
  const typesWithOfferAnalysis: CampaignType[] = [
    "launch",
    "perpetual_launch",
    "flash_sale",
    "live_sale",
    "continuous_sales",
    "subscription_growth",
    "upsell",
    "affiliate",
  ];

  if (typesWithOfferAnalysis.includes(type)) {
    try {
      const result = await runOfferAgent(campaignId, workspaceId, intakeData, log, memoryContext);
      offerAnalysis = result as unknown as Record<string, unknown>;
      agentsRun.push("offer");
      // Log offer output summary to memory + Doctrine Gate + Self-Critique (all fire-and-forget)
      setImmediate(() => {
        if (campaignMemory) {
          addMemoryEntry(campaignId, "agent_output_summary",
            `Oferta: ${result.offerName} | Preço: R$${result.offerStructure?.anchoringLogic?.strategicPrice ?? ""} | Garantia: ${result.offerStructure?.guarantee?.type ?? ""}`,
            "offer_agent", { uniqueMechanism: result.uniqueMechanism?.name }, log,
          ).catch(() => {});
        }
        const offerSnapshot = offerAnalysis ?? {};
        getCampaignBrain(campaignId).then(brainForOffer => {
          if (brainForOffer?.offer) {
            checkDoctrineAsync(campaignId, workspaceId, "offer", offerSnapshot, brainForOffer, log);
          }
        }).catch(() => {});
        runSelfCritique(campaignId, workspaceId, "offer", offerSnapshot, log).catch(() => {});
      });
    } catch (err) {
      log.error({ err, campaignId }, "Offer agent failed");
      emitAgentError(campaignId, "offer", err);
    }
  }

  // ── 4. Type-specific Manager Agent ─────────────────────────────────────────
  if (strategy) {
    try {
      if (typeConfig.managerAgent === "launch_manager") {
        const result = await runLaunchManagerAgent(
          campaignId,
          workspaceId,
          intakeData,
          strategy as any,
          track,
          log,
          memoryContext,
        );
        launchPlan = result as unknown as Record<string, unknown>;
        agentsRun.push("launch_manager");
        checkpointsPending.push("launch_plan_approval");

        await db
          .update(campaignsTable)
          .set({ timelineData: result as any })
          .where(eq(campaignsTable.id, campaignId));
      } else if (typeConfig.managerAgent === "continuous_sales_manager") {
        const result = await runContinuousSalesManagerAgent(
          campaignId,
          workspaceId,
          intakeData,
          strategy as any,
          log,
          memoryContext,
        );
        launchPlan = result as unknown as Record<string, unknown>;
        agentsRun.push("continuous_sales_manager");
        checkpointsPending.push("launch_plan_approval");

        await db
          .update(campaignsTable)
          .set({ timelineData: result as any })
          .where(eq(campaignsTable.id, campaignId));
      } else if (typeConfig.managerAgent === "perpetual_launch_manager") {
        const result = await runPerpetualLaunchManagerAgent(
          campaignId,
          workspaceId,
          intakeData,
          strategy as any,
          log,
          memoryContext,
        );
        launchPlan = result as unknown as Record<string, unknown>;
        agentsRun.push("perpetual_launch_manager");
        checkpointsPending.push("launch_plan_approval");

        await db
          .update(campaignsTable)
          .set({ timelineData: result as any })
          .where(eq(campaignsTable.id, campaignId));
      }
      // "generic" types: strategy + offer is sufficient for now
    } catch (err) {
      log.error({ err, campaignId, managerAgent: typeConfig.managerAgent }, "Manager agent failed");
      emitAgentError(campaignId, typeConfig.managerAgent, err);
    }
  }

  // ── 5. Financial Projector (types with financial model) ────────────────────
  if (typeConfig.hasFinancialProjection && strategy && launchPlan) {
    try {
      const result = await runFinancialProjectorAgent(
        campaignId,
        workspaceId,
        intakeData,
        strategy as any,
        launchPlan as any,
        log,
        memoryContext,
      );
      financialProjection = result as unknown as Record<string, unknown>;
      agentsRun.push("financial_projector");
      checkpointsPending.push("budget_approval");

      await db
        .update(campaignsTable)
        .set({ offerData: { financialProjection: result } as any })
        .where(eq(campaignsTable.id, campaignId));
    } catch (err) {
      log.error({ err, campaignId }, "Financial projector failed");
      emitAgentError(campaignId, "financial_projector", err);
    }
  }

  // ── 5b. Business Intelligence Layer (after Financial Projector — fire-and-forget) ──
  // Analyzes campaign viability: CAC, LTV, ROAS, margin, sustainability, monetization.
  // Passive agent — never blocks the pipeline. Stores result for dashboard use.
  if (financialProjection && strategy && !isSkippedByGovernor("business_intelligence")) {
    try {
      biOutput = await runBusinessIntelligenceAgent(
        campaignId,
        workspaceId,
        intakeData,
        financialProjection as any,
        strategy,
        log,
        memoryContext,
      );
      agentsRun.push("business_intelligence");
      log.info({
        campaignId,
        sustainabilityScore: biOutput.sustainabilityScore,
        sustainabilityVerdict: biOutput.sustainabilityVerdict,
        businessRisk: biOutput.businessRisk,
        ltvCacRatio: biOutput.ltvCacRatio,
        alertCount: biOutput.businessAlerts.length,
        monetizationOps: biOutput.monetizationOpportunities.length,
      }, "Business Intelligence Layer completed");

      // Critical alerts get emitted as campaign events so the frontend can surface them
      const criticalAlerts = biOutput.businessAlerts.filter((a) => a.severity === "critical");
      if (criticalAlerts.length > 0) {
        emitCampaignEvent({
          campaignId,
          type: "agent_completed",
          agentType: "business_intelligence",
          message: `Business Intelligence: ${criticalAlerts.length} alerta(s) crítico(s) — ${biOutput.sustainabilityVerdict} | Score ${biOutput.sustainabilityScore}/100`,
          data: { criticalAlerts, sustainabilityScore: biOutput.sustainabilityScore },
          timestamp: new Date().toISOString(),
        });
      }

      // Store BI output alongside financial projection
      setImmediate(() => {
        db.update(campaignsTable)
          .set({ offerData: { financialProjection, businessIntelligence: biOutput } as any })
          .where(eq(campaignsTable.id, campaignId))
          .catch((e: unknown) => log.warn({ e, campaignId }, "Failed to persist BI output"));
      });
    } catch (biErr) {
      log.warn({ biErr, campaignId }, "Business Intelligence Layer failed — continuing without BI analysis");
    }
  }

  // ── 6. Traffic Intelligence Agent (only when hasTraffic) ──────────────────
  // Plans paid traffic across Meta, TikTok, Google and YouTube.
  // Conservative, technical, auditable — requires ad_set_approval checkpoint.
  // NEVER publishes autonomously. Every budget change requires human sign-off.
  if (hasTraffic && strategy && !isSkippedByGovernor("traffic_intelligence")) {
    try {
      emitCampaignEvent({
        campaignId,
        type: "agent_thinking",
        agentType: "media_buyer",
        message: "Traffic Intelligence Agent planejando campanhas pagas — pré-validação, estrutura, públicos, benchmarks...",
        timestamp: new Date().toISOString(),
      });

      trafficPlan = await runTrafficIntelligenceAgent(
        campaignId,
        workspaceId,
        intakeData,
        strategy,
        offerAnalysis,
        financialProjection,
        log,
        memoryContext,
      );
      agentsRun.push("traffic_intelligence");
      checkpointsPending.push("ad_set_approval");

      // Merge traffic plan into targetingData
      await db
        .update(campaignsTable)
        .set({
          targetingData: {
            trafficPlan: trafficPlan as any,
          } as any,
        })
        .where(eq(campaignsTable.id, campaignId));

      // Log to campaign memory
      setImmediate(() => {
        if (campaignMemory) {
          addMemoryEntry(campaignId, "agent_output_summary",
            `Tráfego: ${trafficPlan?.campaignStructure?.platforms?.map((p) => p.platform).join(", ") ?? ""} | Budget total: R$${trafficPlan?.campaignStructure?.totalBudgetBrl ?? 0} | Clearance: ${trafficPlan?.prePublishValidation?.overallClearance ?? ""}`,
            "traffic_intelligence_agent",
            {
              platforms: trafficPlan?.campaignStructure?.platforms?.length,
              overallClearance: trafficPlan?.prePublishValidation?.overallClearance,
              readinessScore: trafficPlan?.campaignReadinessScore,
            },
            log,
          ).catch(() => {});
        }
      });

      log.info(
        {
          campaignId,
          platforms: trafficPlan.campaignStructure?.platforms?.map((p) => p.platform),
          overallClearance: trafficPlan.prePublishValidation.overallClearance,
          blockers: trafficPlan.prePublishValidation.blockers.length,
          campaignReadinessScore: trafficPlan.campaignReadinessScore,
        },
        "Traffic Intelligence Agent completed",
      );
    } catch (err) {
      log.error({ err, campaignId }, "Traffic Intelligence Agent failed");
      emitAgentError(campaignId, "traffic_intelligence", err);
    }
  }

  const finalStatus =
    checkpointsPending.length > 0 ? "awaiting_approval" : "generating";

  await transitionCampaign(
    campaignId,
    workspaceId,
    finalStatus,
    `command agent pipeline completed — ${checkpointsPending.length} checkpoints pending`,
    log,
  );

  try {
    await db.insert(auditLogsTable).values({
      workspaceId,
      campaignId,
      action: "campaign.orchestration.completed",
      actor: "system",
      data: {
        type,
        agentsRun,
        checkpointsPending,
        finalStatus,
        executionMode: executionPlan?.executionMode ?? "standard",
        skippedAgents: executionPlan?.skippedAgents ?? [],
        biSustainabilityScore: biOutput?.sustainabilityScore,
        biVerdict: biOutput?.sustainabilityVerdict,
      },
    });
  } catch (auditErr: unknown) {
    const code = (auditErr as { cause?: { code?: string } })?.cause?.code;
    if (code !== "23503") throw auditErr;
    log.warn({ workspaceId, campaignId }, "audit_log FK violation — workspace deleted during agent run (ignored)");
  }

  emitCampaignEvent({
    campaignId,
    type: "phase_changed",
    message: `Orquestração concluída — ${agentsRun.length} agentes executados | modo ${executionPlan?.executionMode ?? "standard"}`,
    data: { agentsRun, checkpointsPending, status: finalStatus },
    timestamp: new Date().toISOString(),
  });

  // ── 7. UX Simplification Engine (fire-and-forget — post-pipeline) ──────────
  // Analyzes perceived complexity of the generated campaign results.
  // Output informs the frontend how to present info with minimal cognitive load.
  setImmediate(() => {
    const offerScore = (offerAnalysis as any)?.overallScore ?? (offerAnalysis as any)?.launchReadinessScore;
    const strategyPhases = (strategy as any)?.phases?.length ?? (strategy as any)?.prelaunchPhase ? 4 : undefined;
    runUXSimplificationEngine(
      campaignId,
      workspaceId,
      {
        agentsRun,
        checkpointsPending,
        campaignType: type,
        campaignTrack: track,
        hasTraffic,
        offerScore,
        financialScenariosCount: financialProjection ? 3 : 0,
        strategyPhases,
      },
      log,
    ).then((uxResult) => {
      log.info({
        campaignId,
        uxComplexityScore: uxResult.uxComplexityScore,
        cognitiveLoadScore: uxResult.cognitiveLoadScore,
        uxVerdict: uxResult.uxVerdict,
        frictionPoints: uxResult.frictionPoints.length,
        criticalFixes: uxResult.criticalFixes.length,
      }, "UX Simplification Engine completed");
    }).catch((uxErr: unknown) => {
      log.warn({ uxErr, campaignId }, "UX Simplification Engine failed");
    });
  });

  // ── 8. Memory Compression (fire-and-forget — only if entries exceed threshold) ──
  // Keeps memory lean, segmented and relevant for future agents.
  setImmediate(() => {
    runMemoryCompression(campaignId, workspaceId, log)
      .then((comprResult) => {
        if (comprResult) {
          log.info({
            campaignId,
            compressionRatio: comprResult.compressionRatio,
            memoryHealth: comprResult.memoryHealth,
          }, "Memory Compression completed");
        }
      })
      .catch((comprErr: unknown) => {
        log.warn({ comprErr, campaignId }, "Memory Compression failed");
      });
  });

  // ── 9. Campaign Brain Build + Strategic Alignment Engine (fire-and-forget) ──
  // Assembles canonical truth from all agent outputs. Detects misalignments and
  // contradictions between agents BEFORE they reach the launch phase.
  setImmediate(() => {
    buildCampaignBrain(campaignId, log)
      .then((brain) => {
        if (!brain) return;
        return runStrategicAlignmentEngine(campaignId, brain, log)
          .then(async (report) => {
            await updateBrainSection(campaignId, "alignment", {
              score: report.alignmentScore,
              criticalConflicts: report.criticalConflicts,
              warnings: report.warnings,
              dimensions: report.dimensions,
              isMisaligned: report.isMisaligned,
              checkedAt: report.checkedAt,
            }, log);
            await updateBrainSection(campaignId, "contradictions", report.contradictions, log);
            if (report.isMisaligned) {
              log.warn({
                campaignId,
                alignmentScore: report.alignmentScore,
                criticalConflicts: report.criticalConflicts.length,
                contradictions: report.contradictions.length,
              }, "Campaign Brain: strategic misalignment detected");
            }
          });
      })
      .catch((brainErr: unknown) => {
        log.warn({ brainErr, campaignId }, "Campaign Brain + Alignment Engine failed — non-blocking");
      });
  });

  return {
    campaignId,
    type,
    track,
    agentsRun,
    profile: profile as unknown as Record<string, unknown> | undefined,
    strategy,
    offerAnalysis,
    launchPlan,
    financialProjection,
    trafficPlan: trafficPlan as unknown as Record<string, unknown> | undefined,
    executionPlan,
    businessIntelligence: biOutput,
    checkpointsPending,
    status: finalStatus,
  };
}

function emitAgentError(
  campaignId: string,
  agentType: string,
  err: unknown,
): void {
  emitCampaignEvent({
    campaignId,
    type: "agent_failed",
    agentType,
    message: `${agentType} falhou: ${err instanceof Error ? err.message : String(err)}`,
    timestamp: new Date().toISOString(),
  });
}
