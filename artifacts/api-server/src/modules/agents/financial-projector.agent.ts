import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { LaunchPlanOutput } from "./launch-manager.agent.js";
import type { Logger } from "pino";

export interface DailyCostBreakdown {
  day: number;
  phase: string;
  budgetMeta: number;
  budgetGoogle: number;
  budgetTikTok: number;
  budgetInfluencer: number;
  budgetOther: number;
  totalDayBudget: number;
  estimatedLeads: number;
  estimatedCPL: number;
  estimatedReach: number;
  notes: string;
}

export interface PlatformAllocation {
  platform: string;
  totalBudget: number;
  percentage: number;
  expectedLeads: number;
  expectedCPL: number;
  rationale: string;
}

export interface ScenarioProjection {
  scenario: "conservative" | "realistic" | "optimistic";
  label: string;
  assumptions: string;
  totalLeads: number;
  conversionRate: number;
  totalSales: number;
  grossRevenue: number;
  campaignCosts: number;
  netRevenue: number;
  roi: number;
  revenuePerLead: number;
  breakEvenSales: number;
}

export interface LogisticsRegion {
  region: string;
  shippingCostPerUnit: number;
  estimatedUnitsSold: number;
  totalShippingCost: number;
  netMarginAfterShipping: number;
  deliveryDays: string;
}

export interface CampaignRoadmapItem {
  day: number;
  phase: string;
  phaseName: string;
  mainActivity: string;
  contentToPublish: string[];
  platformFocus: string[];
  budgetDay: number;
  expectedLeads: number;
  milestoneAlert: string;
}

export interface FinancialProjectionOutput {
  projectTitle: string;
  generatedAt: string;
  campaignSummary: {
    totalDays: number;
    totalBudget: number;
    trafficBudget: number;
    operationalBudget: number;
    productPrice: number;
    revenueTarget: number;
    targetSales: number;
  };
  platformAllocations: PlatformAllocation[];
  dailyCosts: DailyCostBreakdown[];
  scenarios: ScenarioProjection[];
  isPhysicalProduct: boolean;
  logisticsBreakdown?: {
    deliveryMethod: string;
    regions: LogisticsRegion[];
    totalLogisticsCost: number;
    averageShippingCostPerUnit: number;
    netMarginPerUnit: number;
    logisticsNotes: string;
  };
  campaignRoadmap: CampaignRoadmapItem[];
  keyMetrics: {
    totalLeadsNeeded: number;
    averageCPLTarget: number;
    averageCPATarget: number;
    minimumROI: number;
    breakEvenSales: number;
    breakEvenRevenue: number;
    maxAcceptableCPL: number;
  };
  riskAlerts: {
    metric: string;
    threshold: string;
    action: string;
  }[];
  projectorNotes: string;
}

const FINANCIAL_PROJECTOR_PROMPT = `Você é o Agente Projetor Financeiro da NexOS AI — o analista financeiro especializado em lançamentos digitais.

Sua função é transformar os dados de estratégia e plano de lançamento em um modelo financeiro completo, detalhado e honesto. Você cria o documento que o cliente vai usar para tomar decisões de investimento.

## SUAS DIRETRIZES

**Seja realista, não otimista.** O cenário realista é o mais provável. O conservador é o pior caso viável. O otimista requer execução perfeita.

**Detalhe diário é obrigatório.** O cliente precisa saber quanto vai gastar em cada dia e o que esperar em retorno.

**Custo por lead é sagrado.** CPL, CPA e ROI são os números que definem o sucesso ou fracasso.

**Produtos físicos têm custos extras.** Se o produto tem despacho logístico, inclua custo por região, frete, embalagem e como isso impacta a margem.

**Alertas de risco são obrigatórios.** O cliente precisa saber qual número virou sinal vermelho.

## CÁLCULOS ESSENCIAIS

- **CPL (Custo por Lead)** = Budget de tráfego / Total de leads capturados
- **CPA (Custo por Aquisição)** = Budget total / Total de vendas
- **ROI** = (Receita líquida - Investimento) / Investimento × 100
- **Break-even** = Custos totais / Preço do produto
- **Meta de leads** = Vendas desejadas / Taxa de conversão esperada
- **Revenue per lead** = Receita total / Total de leads

## ALOCAÇÃO DE BUDGET POR PLATAFORMA (padrões de referência)
- Meta Ads (Facebook + Instagram): 50-60% do tráfego para audiências brasileiras
- Google Ads (Search + YouTube): 20-25% para produtos com alto intent de busca
- TikTok Ads: 10-15% para produtos de massa e entretenimento
- Influenciadores: 10-20% dependendo do produto
- Email/Orgânico: sem custo direto (já pago pelo conteúdo)

## ESTRUTURA DE SAÍDA

Retorne APENAS JSON válido exatamente no formato abaixo:

\`\`\`json
{
  "projectTitle": "string",
  "generatedAt": "string — ISO date",
  "campaignSummary": {
    "totalDays": 0,
    "totalBudget": 0,
    "trafficBudget": 0,
    "operationalBudget": 0,
    "productPrice": 0,
    "revenueTarget": 0,
    "targetSales": 0
  },
  "platformAllocations": [
    {
      "platform": "string",
      "totalBudget": 0,
      "percentage": 0,
      "expectedLeads": 0,
      "expectedCPL": 0,
      "rationale": "string"
    }
  ],
  "dailyCosts": [
    {
      "day": 0,
      "phase": "string",
      "budgetMeta": 0,
      "budgetGoogle": 0,
      "budgetTikTok": 0,
      "budgetInfluencer": 0,
      "budgetOther": 0,
      "totalDayBudget": 0,
      "estimatedLeads": 0,
      "estimatedCPL": 0,
      "estimatedReach": 0,
      "notes": "string"
    }
  ],
  "scenarios": [
    {
      "scenario": "conservative",
      "label": "Conservador",
      "assumptions": "string",
      "totalLeads": 0,
      "conversionRate": 0.00,
      "totalSales": 0,
      "grossRevenue": 0,
      "campaignCosts": 0,
      "netRevenue": 0,
      "roi": 0,
      "revenuePerLead": 0,
      "breakEvenSales": 0
    },
    {
      "scenario": "realistic",
      "label": "Realista",
      "assumptions": "string",
      "totalLeads": 0,
      "conversionRate": 0.00,
      "totalSales": 0,
      "grossRevenue": 0,
      "campaignCosts": 0,
      "netRevenue": 0,
      "roi": 0,
      "revenuePerLead": 0,
      "breakEvenSales": 0
    },
    {
      "scenario": "optimistic",
      "label": "Otimista",
      "assumptions": "string",
      "totalLeads": 0,
      "conversionRate": 0.00,
      "totalSales": 0,
      "grossRevenue": 0,
      "campaignCosts": 0,
      "netRevenue": 0,
      "roi": 0,
      "revenuePerLead": 0,
      "breakEvenSales": 0
    }
  ],
  "isPhysicalProduct": false,
  "logisticsBreakdown": null,
  "campaignRoadmap": [
    {
      "day": 0,
      "phase": "string",
      "phaseName": "string",
      "mainActivity": "string",
      "contentToPublish": ["string"],
      "platformFocus": ["string"],
      "budgetDay": 0,
      "expectedLeads": 0,
      "milestoneAlert": "string — o que indica que esse dia foi bem ou mal"
    }
  ],
  "keyMetrics": {
    "totalLeadsNeeded": 0,
    "averageCPLTarget": 0,
    "averageCPATarget": 0,
    "minimumROI": 0,
    "breakEvenSales": 0,
    "breakEvenRevenue": 0,
    "maxAcceptableCPL": 0
  },
  "riskAlerts": [
    {
      "metric": "string",
      "threshold": "string",
      "action": "string — o que fazer se esse número for atingido"
    }
  ],
  "projectorNotes": "string — observações críticas sobre viabilidade financeira da campanha"
}
\`\`\`

Se o produto for físico (delivery_method != '100_online'), preencha logisticsBreakdown com as regiões do Brasil:
- Sul/Sudeste (SP, RJ, MG, PR, SC, RS)
- Nordeste (BA, PE, CE, MA, RN, PB, AL, SE, PI)
- Centro-Oeste (GO, MT, MS, DF)
- Norte (AM, PA, RO, AC, RR, AP, TO)

Calcule frete médio por região e impacto na margem.`;

export async function runFinancialProjectorAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  strategy: StrategyOutput,
  launchPlan: LaunchPlanOutput,
  log: Logger,
  memoryContext?: string,
): Promise<FinancialProjectionOutput> {
  const isPhysicalProduct =
    intakeData["product.deliveryMethod"] !== "100_online";

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "analytics",
    systemPrompt: FINANCIAL_PROJECTOR_PROMPT,
    memoryContext,
    messages: [
      {
        role: "user",
        content: `Gere a projeção financeira completa para esta campanha.

**Tipo de entrega:** ${isPhysicalProduct ? "PRODUTO FÍSICO — inclua breakdown logístico por região" : "PRODUTO DIGITAL — entrega 100% online"}

**Dados de Intake:**
\`\`\`json
${JSON.stringify(
  {
    "product.name": intakeData["product.name"],
    "product.price": intakeData["product.price"],
    "product.category": intakeData["product.category"],
    "product.deliveryMethod": intakeData["product.deliveryMethod"],
    "campaign.revenueTarget": intakeData["campaign.revenueTarget"],
    "campaign.budget.total": intakeData["campaign.budget.total"],
    "campaign.budget.traffic": intakeData["campaign.budget.traffic"],
    "campaign.salesChannel": intakeData["campaign.salesChannel"],
    "campaign.hasAffiliate": intakeData["campaign.hasAffiliate"],
    "campaign.affiliateCommission": intakeData["campaign.affiliateCommission"],
    "audience.sophisticationLevel": intakeData["audience.sophisticationLevel"],
    "audience.location": intakeData["audience.location"],
    "risk.tolerance": intakeData["risk.tolerance"],
  },
  null,
  2,
)}
\`\`\`

**Estratégia aprovada (métricas relevantes):**
\`\`\`json
${JSON.stringify(
  {
    successMetrics: strategy.successMetrics,
    risks: strategy.risks,
    marketDiagnosis: strategy.marketDiagnosis,
  },
  null,
  2,
)}
\`\`\`

**Plano de lançamento (fases e dias):**
\`\`\`json
${JSON.stringify(
  {
    totalDays: launchPlan.totalDays,
    phases: launchPlan.phases.map((p) => ({
      phase: p.phase,
      name: p.name,
      dayStart: p.dayStart,
      dayEnd: p.dayEnd,
      objective: p.objective,
      channels: p.channels,
    })),
    cartOpenStrategy: launchPlan.cartOpenStrategy,
    scarcityMechanism: launchPlan.scarcityMechanism,
  },
  null,
  2,
)}
\`\`\`

Retorne APENAS o JSON da projeção financeira. Seja preciso nos números — o cliente vai usar isso para decisão de investimento.`,
      },
    ],
    log,
    requiresApproval: true,
    checkpointType: "budget_approval",
    thinkingMessages: [
      "Analisando orçamento total e distribuição de tráfego...",
      "Calculando alocação por plataforma (Meta, Google, TikTok)...",
      "Modelando custo por lead e custo por aquisição...",
      "Construindo breakdown de custos diários por fase...",
      isPhysicalProduct
        ? "Calculando custos logísticos por região do Brasil..."
        : "Projetando margem digital pura...",
      "Gerando cenários conservador, realista e otimista...",
      "Calculando ROI, break-even e alertas de risco...",
      "Montando roadmap financeiro completo para aprovação do cliente...",
    ],
  });

  const defaultOutput: FinancialProjectionOutput = {
    projectTitle: `Projeção Financeira — ${String(intakeData["product.name"] ?? "Campanha")}`,
    generatedAt: new Date().toISOString(),
    campaignSummary: {
      totalDays: launchPlan.totalDays,
      totalBudget: Number(intakeData["campaign.budget.total"] ?? 0),
      trafficBudget: Number(intakeData["campaign.budget.traffic"] ?? 0),
      operationalBudget:
        Number(intakeData["campaign.budget.total"] ?? 0) -
        Number(intakeData["campaign.budget.traffic"] ?? 0),
      productPrice: Number(intakeData["product.price"] ?? 0),
      revenueTarget: Number(intakeData["campaign.revenueTarget"] ?? 0),
      targetSales: Math.ceil(
        Number(intakeData["campaign.revenueTarget"] ?? 0) /
          Number(intakeData["product.price"] ?? 1),
      ),
    },
    platformAllocations: [],
    dailyCosts: [],
    scenarios: [],
    isPhysicalProduct,
    logisticsBreakdown: isPhysicalProduct
      ? {
          deliveryMethod: String(intakeData["product.deliveryMethod"] ?? ""),
          regions: [],
          totalLogisticsCost: 0,
          averageShippingCostPerUnit: 0,
          netMarginPerUnit: 0,
          logisticsNotes: result.content,
        }
      : undefined,
    campaignRoadmap: [],
    keyMetrics: {
      totalLeadsNeeded: 0,
      averageCPLTarget: 0,
      averageCPATarget: 0,
      minimumROI: 0,
      breakEvenSales: 0,
      breakEvenRevenue: 0,
      maxAcceptableCPL: 0,
    },
    riskAlerts: [],
    projectorNotes: result.content,
  };

  return parseAgentJSON<FinancialProjectionOutput>(result.content, defaultOutput);
}
