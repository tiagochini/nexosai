/**
 * Business Intelligence Layer
 *
 * Transforms campaign marketing data into business viability decisions.
 * Runs AFTER Financial Projector (step 5b) — fire-and-forget (passive).
 *
 * Analyzes: CAC, LTV, ROAS, payback period, margin, retention, scalability.
 * Alerts when business model is unsustainable BEFORE the campaign goes live.
 * Suggests monetization improvements and structural corrections.
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { FinancialProjectionOutput } from "./financial-projector.agent.js"; // eslint-disable-line @typescript-eslint/no-unused-vars
import type { Logger } from "pino";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MonetizationOpportunity {
  type:
    | "upsell"
    | "cross_sell"
    | "subscription"
    | "community"
    | "continuity"
    | "downsell"
    | "affiliate"
    | "licensing";
  title: string;
  description: string;
  estimatedRevenueImpact: string;   // e.g. "+20% LTV"
  implementationEffort: "low" | "medium" | "high";
  timeToImplement: string;          // e.g. "1 semana"
  priority: "critical" | "high" | "medium" | "low";
}

export interface BusinessAlert {
  type:
    | "cac_unsustainable"
    | "low_margin"
    | "ad_dependency"
    | "weak_offer"
    | "poor_retention"
    | "bad_payback"
    | "funnel_leak"
    | "scalability_ceiling"
    | "cash_flow_risk";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  detail: string;
  recommendation: string;
  urgency: "immediate" | "before_launch" | "post_launch";
}

export interface BIScenario {
  scenario: "conservative" | "realistic" | "optimistic";
  estimatedCAC: number;
  estimatedROAS: number;
  estimatedLTV: number;
  breakEvenPoint: string;          // e.g. "Dia 12 de campanha"
  breakEvenSales: number;
  operationalMargin: number;       // percentage
  paybackPeriodDays: number;
  cashFlowRisk: "low" | "medium" | "high";
}

export interface BusinessIntelligenceOutput {
  // Core metrics (realistic scenario)
  estimatedCAC: number;
  estimatedROAS: number;
  estimatedLTV: number;
  ltvCacRatio: number;             // LTV / CAC — target > 3:1
  breakEvenPoint: string;
  breakEvenSales: number;
  operationalMargin: number;
  paybackPeriodDays: number;

  // Scenarios
  scenarios: BIScenario[];

  // Scalability
  scalabilityPotential: "high" | "medium" | "low" | "limited";
  scalabilityCeiling: string;      // max revenue before model breaks
  scalabilityBlockers: string[];

  // Risk
  businessRisk: "low" | "medium" | "high" | "critical";
  businessRiskFactors: string[];
  adDependencyScore: number;       // 0-1, higher = more dependent on ads
  retentionRisk: "low" | "medium" | "high";

  // Opportunities
  monetizationOpportunities: MonetizationOpportunity[];

  // Alerts
  businessAlerts: BusinessAlert[];

  // Sustainability
  sustainabilityScore: number;     // 0-100
  sustainabilityVerdict: "sustainable" | "marginal" | "fragile" | "unsustainable";
  sustainabilityRationale: string;

  // Recommendations
  recommendation: string;
  topPriorityActions: string[];    // 3-5 immediate actions

  confidenceScore: number;
}

// ── System Prompt ─────────────────────────────────────────────────────────────

function buildBISystemPrompt(): string {
  const fence = "```";
  return (
    `Você é o NEXOS Business Intelligence Layer.\n` +
    `Sua função é transformar dados de marketing em decisões de negócio.\n` +
    `\n` +
    `## SUA PERSPECTIVA\n` +
    `Você NÃO pensa em tráfego, copy ou alcance. Você pensa em:\n` +
    `- Lucro operacional real\n` +
    `- Sustentabilidade financeira\n` +
    `- Capacidade de escala\n` +
    `- Retenção e LTV\n` +
    `- Riscos antes de qualquer investimento\n` +
    `\n` +
    `## MÉTRICAS-CHAVE\n` +
    `\n` +
    `**CAC sustentável:** CAC deve ser recuperado em ≤ 3 meses para produtos digitais.\n` +
    `**LTV:CAC saudável:** Mínimo 3:1. Abaixo disso = alerta. Abaixo de 1:1 = crítico.\n` +
    `**Margem operacional saudável:** ≥ 60% para produtos digitais, ≥ 30% para físicos.\n` +
    `**ROAS mínimo viável:** ≥ 2.0x (retorno mínimo para operar). Saudável: ≥ 3.5x.\n` +
    `**Dependência de ads:** > 80% receita via ads pago = risco crítico de concentração.\n` +
    `\n` +
    `## ALERTAS OBRIGATÓRIOS\n` +
    `\n` +
    `Gere alerta CRÍTICO quando:\n` +
    `- CAC > 30% do ticket médio (insustentável)\n` +
    `- Margem < 20%\n` +
    `- ROAS projetado < 1.5x\n` +
    `- Break-even > 85% do período de campanha (risco de prejuízo)\n` +
    `- LTV:CAC < 1.5:1\n` +
    `\n` +
    `Gere alerta ALTO quando:\n` +
    `- Payback > 6 meses\n` +
    `- Dependência > 80% de tráfego pago\n` +
    `- Sem estratégia de retenção / recorrência\n` +
    `- Oferta com única fonte de receita sem upsell\n` +
    `\n` +
    `## OPORTUNIDADES DE MONETIZAÇÃO\n` +
    `\n` +
    `Sempre identifique 2-5 oportunidades estruturais:\n` +
    `- Upsell imediato (pós-compra — maior impacto no ticket médio)\n` +
    `- Continuidade / assinatura (maior impacto no LTV)\n` +
    `- Downsell (recupera quem não compra principal)\n` +
    `- Afiliados (escala orgânica sem custo de mídia)\n` +
    `- Community / mastermind (premium tier para retenção)\n` +
    `\n` +
    `## ESCALABILIDADE\n` +
    `\n` +
    `Analise:\n` +
    `- Limite de audience total (TAM vs tráfego estimado)\n` +
    `- Ponto de saturação do anúncio (fatigue de criativo)\n` +
    `- Gargalos operacionais (suporte, entrega, onboarding)\n` +
    `- Ceiling natural do modelo atual\n` +
    `\n` +
    `## SUSTENTABILIDADE\n` +
    `\n` +
    `sustainable: negócio gera caixa, baixa dependência de ads, margens saudáveis\n` +
    `marginal: funciona mas frágil — qualquer variação coloca em risco\n` +
    `fragile: depende de tudo correr certo — múltiplos pontos de falha\n` +
    `unsustainable: modelo não fecha — recomende reestruturação antes de lançar\n` +
    `\n` +
    `**Retorne APENAS JSON válido:**\n` +
    fence + `json\n` +
    `{\n` +
    `  "estimatedCAC": 0,\n` +
    `  "estimatedROAS": 0,\n` +
    `  "estimatedLTV": 0,\n` +
    `  "ltvCacRatio": 0,\n` +
    `  "breakEvenPoint": "string",\n` +
    `  "breakEvenSales": 0,\n` +
    `  "operationalMargin": 0,\n` +
    `  "paybackPeriodDays": 0,\n` +
    `  "scenarios": [],\n` +
    `  "scalabilityPotential": "medium",\n` +
    `  "scalabilityCeiling": "string",\n` +
    `  "scalabilityBlockers": [],\n` +
    `  "businessRisk": "medium",\n` +
    `  "businessRiskFactors": [],\n` +
    `  "adDependencyScore": 0,\n` +
    `  "retentionRisk": "medium",\n` +
    `  "monetizationOpportunities": [],\n` +
    `  "businessAlerts": [],\n` +
    `  "sustainabilityScore": 70,\n` +
    `  "sustainabilityVerdict": "marginal",\n` +
    `  "sustainabilityRationale": "string",\n` +
    `  "recommendation": "string",\n` +
    `  "topPriorityActions": [],\n` +
    `  "confidenceScore": 0.8\n` +
    `}\n` +
    fence
  );
}

// ── Runner ────────────────────────────────────────────────────────────────────

export async function runBusinessIntelligenceAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  financialProjection: FinancialProjectionOutput,
  strategy: Record<string, unknown>,
  log: Logger,
  memoryContext?: string,
): Promise<BusinessIntelligenceOutput> {
  const ticket = Number(intakeData["product.price"] ?? intakeData["product.ticket"] ?? 0);
  const budget = Number(intakeData["campaign.trafficBudget"] ?? 0);
  const hasRecurrence = Boolean(intakeData["product.hasRecurrence"] ?? intakeData["product.subscription"]);

  const userContent =
    `Analise a viabilidade financeira desta campanha como estrategista de negócios.\n\n` +
    (memoryContext ? `**Contexto da campanha:**\n${memoryContext}\n\n` : "") +
    `**Ticket do produto:** R$${ticket.toLocaleString("pt-BR")}\n` +
    `**Budget de tráfego:** R$${budget.toLocaleString("pt-BR")}\n` +
    `**Tem recorrência:** ${hasRecurrence ? "SIM" : "NÃO"}\n\n` +
    `**Projeção financeira (Financial Projector):**\n` +
    `\`\`\`json\n${JSON.stringify({
      scenarios: financialProjection.scenarios,
      platformAllocations: financialProjection.platformAllocations,
      keyMetrics: financialProjection.keyMetrics,
      riskAlerts: financialProjection.riskAlerts,
      campaignSummary: financialProjection.campaignSummary,
    }, null, 2)}\n\`\`\`\n\n` +
    `**Estratégia (resumo):**\n` +
    `\`\`\`json\n${JSON.stringify({
      channels: (strategy as any).channels,
      phases: (strategy as any).phases,
      retentionStrategy: (strategy as any).retentionStrategy,
    }, null, 2)}\n\`\`\`\n\n` +
    `Produza a análise de Business Intelligence completa.`;

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "business_intelligence",
    systemPrompt: buildBISystemPrompt(),
    messages: [{ role: "user", content: userContent }],
    log,
    requiresApproval: false,
    thinkingMessages: [
      "Calculando CAC, LTV e ROAS estimados...",
      "Avaliando sustentabilidade do modelo de negócio...",
      "Identificando riscos financeiros e oportunidades de monetização...",
    ],
  });

  const defaultOutput: BusinessIntelligenceOutput = {
    estimatedCAC: 0,
    estimatedROAS: 0,
    estimatedLTV: ticket,
    ltvCacRatio: 0,
    breakEvenPoint: "Não calculado",
    breakEvenSales: 0,
    operationalMargin: 0,
    paybackPeriodDays: 0,
    scenarios: [],
    scalabilityPotential: "medium",
    scalabilityCeiling: "Não calculado",
    scalabilityBlockers: [],
    businessRisk: "medium",
    businessRiskFactors: [],
    adDependencyScore: 0.5,
    retentionRisk: "medium",
    monetizationOpportunities: [],
    businessAlerts: [],
    sustainabilityScore: 50,
    sustainabilityVerdict: "marginal",
    sustainabilityRationale: "Análise indisponível — fallback automático",
    recommendation: "Revise as projeções financeiras antes do lançamento",
    topPriorityActions: [],
    confidenceScore: 0.5,
  };

  return parseAgentJSON<BusinessIntelligenceOutput>(result.content, defaultOutput);
}
