import { eq, and } from "drizzle-orm";
import { db, campaignsTable, auditLogsTable } from "@workspace/db";
import { runAgent, parseAgentJSON } from "./agent.runner.js";
import { runProfileBuilderAgent, type ProfileBuilderOutput } from "./profile-builder.agent.js";
import { runStrategyAgent } from "./strategy.agent.js";
import { runOfferAgent } from "./offer.agent.js";
import { runLaunchManagerAgent } from "./launch-manager.agent.js";
import { runContinuousSalesManagerAgent } from "./continuous-sales-manager.agent.js";
import { runPerpetualLaunchManagerAgent } from "./perpetual-launch-manager.agent.js";
import { runFinancialProjectorAgent } from "./financial-projector.agent.js";
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

  const allowedStatuses = ["intake", "analyzing", "strategy_ready"];
  if (!allowedStatuses.includes(campaign.status)) {
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

  await db
    .update(campaignsTable)
    .set({ status: "analyzing" })
    .where(eq(campaignsTable.id, campaignId));

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "campaign.orchestration.started",
    actor: "system",
    data: { type, track, intakeComplete: valid, missingRequired },
  });

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
      "Identificando tipo e arquétipo da campanha...",
      typeConfig.thinkingMessage,
      "Avaliando completude do intake...",
      "Verificando viabilidade e estimando recursos...",
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
    await db
      .update(campaignsTable)
      .set({ status: "intake" })
      .where(eq(campaignsTable.id, campaignId));

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
  let offerAnalysis: Record<string, unknown> | undefined;
  let launchPlan: Record<string, unknown> | undefined;
  let financialProjection: Record<string, unknown> | undefined;

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

  // ── 2. Strategy Agent (all campaign types) ──────────────────────────────────
  try {
    const result = await runStrategyAgent(
      campaignId,
      workspaceId,
      intakeData,
      track,
      log,
      profile, // pass profile as context — makes strategy much richer
    );
    strategy = result as unknown as Record<string, unknown>;
    agentsRun.push("strategy");
    checkpointsPending.push("strategy_approval");

    await db
      .update(campaignsTable)
      .set({ status: "strategy_ready", strategyData: result as any })
      .where(eq(campaignsTable.id, campaignId));
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
      const result = await runOfferAgent(campaignId, workspaceId, intakeData, log);
      offerAnalysis = result as unknown as Record<string, unknown>;
      agentsRun.push("offer");
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

  const finalStatus =
    checkpointsPending.length > 0 ? "awaiting_approval" : "generating";

  await db
    .update(campaignsTable)
    .set({ status: finalStatus as any })
    .where(eq(campaignsTable.id, campaignId));

  await db.insert(auditLogsTable).values({
    workspaceId,
    campaignId,
    action: "campaign.orchestration.completed",
    actor: "system",
    data: { type, agentsRun, checkpointsPending, finalStatus },
  });

  emitCampaignEvent({
    campaignId,
    type: "phase_changed",
    message: `Orquestração concluída — ${agentsRun.length} agentes executados`,
    data: { agentsRun, checkpointsPending, status: finalStatus },
    timestamp: new Date().toISOString(),
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
