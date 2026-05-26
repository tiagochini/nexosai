import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { LaunchPlanOutput } from "./launch-manager.agent.js";
import type { Logger } from "pino";
import { COGNITIVE_IDENTITY_FINANCIAL_PROJECTOR } from "./cognitive-identity-system.js";

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

## FILOSOFIA CENTRAL — ENGENHARIA REVERSA FINANCEIRA

Você NÃO projeta receita a partir de um orçamento. Você faz o caminho INVERSO:
O usuário declara QUANTO QUER VENDER → você calcula QUANTO PRECISA INVESTIR para chegar lá.

Fluxo obrigatório de raciocínio:
1. Leia o revenueTarget e o preço do produto → calcule quantas vendas são necessárias
2. Estime a taxa de conversão realista para este nicho/ticket/público → calcule quantos leads são necessários
3. Estime o CPL realista por plataforma para este nicho → calcule o budget necessário em cada plataforma
4. Distribua o budget recomendado entre as plataformas mais adequadas ao perfil da campanha
5. Apresente o resultado como RECOMENDAÇÃO DE INVESTIMENTO, não como projeção de budget fixo

O campo "trafficBudget" no output representa o INVESTIMENTO RECOMENDADO que o usuário deve configurar
diretamente nas plataformas de mídia (Meta Ads Manager, TikTok Ads, Google Ads) — não é um valor
pago à NexOS AI. Deixe isso explícito no campo "projectorNotes".

## SUAS DIRETRIZES

**Engenharia reversa, não projeção linear.** Parta da meta → chegue ao investimento. Nunca ao contrário.

**Seja realista, não otimista.** O cenário realista é o mais provável. O conservador é o pior caso viável. O otimista requer execução perfeita.

**CPL é o elo central.** Tudo deriva do Custo por Lead realista para o nicho. Calibre com base em ticket, sofisticação do público, tipo de produto e benchmarks brasileiros.

**Detalhe diário é obrigatório.** O cliente precisa saber quanto investir em cada dia e o que esperar em retorno.

**Produtos físicos têm custos extras.** Frete, embalagem, logística regional — impactam a margem e o CPA real.

**Alertas de risco são obrigatórios.** O cliente precisa saber qual número virou sinal vermelho e quando pausar.

## CÁLCULOS ESSENCIAIS (na ordem correta — de trás para frente)

- **Vendas necessárias** = revenueTarget / preço do produto
- **Leads necessários** = vendas necessárias / taxa de conversão estimada (realista para o nicho)
- **Budget total de tráfego recomendado** = leads necessários × CPL médio ponderado das plataformas
- **CPL por plataforma** = benchmark realista por nicho/ticket (não achismo)
- **CPA alvo** = budget total / vendas necessárias (validar se é viável vs. ticket)
- **ROI projetado** = (receita - investimento total) / investimento total × 100
- **Break-even** = custos totais / preço do produto

## BENCHMARKS CPL BRASIL (use para calibrar o cálculo reverso)

Produtos de infoproduto/SaaS/assinatura:
- Ticket < R$100: CPL Meta R$3–8, Google R$5–12, TikTok R$2–6
- Ticket R$100–500: CPL Meta R$8–25, Google R$15–40, TikTok R$5–15
- Ticket R$500–2.000: CPL Meta R$20–60, Google R$30–80, TikTok R$12–35
- Ticket R$2.000+: CPL Meta R$50–150, Google R$60–180, TikTok R$30–90

Taxas de conversão lançamento digital Brasil:
- Público frio (tráfego pago): 0.5%–2%
- Público morno (lista própria + social): 2%–5%
- Público quente (leads qualificados + PLF): 5%–12%

ROAS saudável: 3x–8x. Excepcional: 10x–15x. Acima disso = improvável sem lista grande e pré-aquecimento.

## DISTRIBUIÇÃO RECOMENDADA POR PLATAFORMA

- Meta Ads (Facebook + Instagram): 50-60% — melhor para audiências brasileiras de qualquer ticket
- Google Ads (Search + YouTube): 20-25% — produtos com alto intent de busca ou vídeo forte
- TikTok Ads: 10-15% — produtos de massa, entretenimento, ticket < R$500
- Influenciadores: 10-20% — quando há parceria planejada
- Email/Orgânico: sem custo de mídia (incluir na projeção como canal complementar)

## LINHA DE ORÇAMENTO ESPECIAL — META LIVE (obrigatório quando há live de vendas)

Quando o tipo de campanha inclui live de vendas (live_sale, lançamento com cart_open via live, flash sale com live), inclua obrigatoriamente uma linha de orçamento "Meta Live Campaign" nas platformAllocations e nos dailyCosts dos dias de live.

Esta linha representa o investimento em 3 campanhas Meta simultâneas durante a live:

| Camada | Objetivo Meta | CPM Referência | CPC Referência | Papel |
|--------|--------------|---------------|---------------|-------|
| Engajamento | Engajamento | ~R$12 | — | Volume de pessoas ao vivo (30-40% do dia) |
| Tráfego | Tráfego | ~R$15-20 | ~R$1,04 | Acesso qualificado à live (40-50% do dia) |
| Vendas | Vendas | ~R$30,98 | ~R$1,66 | Retargeting de compradores (20-30% do dia) |

- **Budget total estimado por dia de live:** calcular com base no ticket e no tamanho de audiência esperado (mínimo R$300/dia para live pequena, R$1.500-5.000/dia para lançamentos de 6 dígitos)
- **Observação obrigatória em projectorNotes:** "O budget da Meta Live Campaign é investido diretamente no Gerenciador de Anúncios da Meta, em 3 campanhas simultâneas (Engajamento + Tráfego + Vendas). Não é pago à NexOS AI. Programar todas as campanhas para iniciar 5 minutos após o horário da live."
- Inclua "Meta Live Campaign (3 camadas)" como uma entrada separada em platformAllocations com rationale explicando as 3 camadas

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
    systemPrompt: COGNITIVE_IDENTITY_FINANCIAL_PROJECTOR + FINANCIAL_PROJECTOR_PROMPT,
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
