import { eq, and } from "drizzle-orm";
import { db, campaignsTable, auditLogsTable } from "@workspace/db";
import { runAgent, parseAgentJSON } from "./agent.runner.js";
import { runStrategyAgent } from "./strategy.agent.js";
import { runOfferAgent } from "./offer.agent.js";
import { runLaunchManagerAgent } from "./launch-manager.agent.js";
import { runContinuousSalesManagerAgent } from "./continuous-sales-manager.agent.js";
import { runPerpetualLaunchManagerAgent } from "./perpetual-launch-manager.agent.js";
import { runFinancialProjectorAgent } from "./financial-projector.agent.js";
import { emitCampaignEvent } from "../realtime/realtime.service.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { validateIntakeCompleteness, type CampaignType, type CampaignTrack } from "../intake/intake.service.js";
import type { Logger } from "pino";

export interface OrchestrationResult {
  campaignId: string;
  type: string;
  track: string;
  agentsRun: string[];
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

const COMMAND_SYSTEM_PROMPT = `Você é o Command Agent da NexOS AI — o orquestrador central de toda execução de campanha.

Você recebe o tipo de campanha, o intake e decide:
1. Se o intake está completo o suficiente para avançar
2. Ajustes estratégicos que os outros agentes devem considerar
3. Estimativa de créditos que serão consumidos

Você NÃO decide a sequência de agentes — o sistema já define isso por tipo de campanha.
Você avalia a prontidão e dá instruções especiais para os agentes que vão rodar.

**Retorne APENAS JSON válido:**

\`\`\`json
{
  "readinessScore": 0,
  "readinessVerdict": "ready|needs_info|blocked",
  "missingCriticalInfo": ["string"],
  "specialInstructions": {
    "strategy": "string ou null",
    "offer": "string ou null",
    "manager": "string ou null",
    "financial_projector": "string ou null"
  },
  "campaignComplexity": "standard|complex|enterprise",
  "estimatedCredits": 0,
  "commandNotes": "string — observações críticas para o cliente sobre esta campanha"
}
\`\`\``;

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
    systemPrompt: COMMAND_SYSTEM_PROMPT,
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
  let strategy: Record<string, unknown> | undefined;
  let offerAnalysis: Record<string, unknown> | undefined;
  let launchPlan: Record<string, unknown> | undefined;
  let financialProjection: Record<string, unknown> | undefined;

  // ── 1. Strategy Agent (all campaign types) ──────────────────────────────────
  try {
    const result = await runStrategyAgent(
      campaignId,
      workspaceId,
      intakeData,
      track,
      log,
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

  // ── 2. Offer Agent (all types with a product for sale) ─────────────────────
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

  // ── 3. Type-specific Manager Agent ─────────────────────────────────────────
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

  // ── 4. Financial Projector (types with financial model) ────────────────────
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
