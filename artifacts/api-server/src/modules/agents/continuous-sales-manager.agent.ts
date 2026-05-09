import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { Logger } from "pino";

export interface EvergreenPhase {
  phase: string;
  name: string;
  objective: string;
  channels: string[];
  primaryTactic: string;
  automationElements: string[];
  kpis: string[];
  optimizationLevers: string[];
}

export interface ContinuousSalesPlanOutput {
  planTitle: string;
  model: "evergreen" | "cac_ltv_optimized" | "subscription_led";
  monthlyRevenueTarget: number;
  monthlyLeadTarget: number;
  cacTarget: number;
  ltvTarget: number;
  ltvCacRatio: number;
  funnelArchitecture: {
    topOfFunnel: {
      channels: string[];
      monthlyBudget: number;
      expectedLeads: number;
      leadMagnet: string;
      leadMagnetFormat: string;
    };
    middleOfFunnel: {
      nurturingSequence: {
        day: number;
        touchpoint: string;
        format: string;
        objective: string;
        expectedOpenRate?: number;
        expectedClickRate?: number;
      }[];
      segmentationLogic: string;
      qualificationCriteria: string;
    };
    bottomOfFunnel: {
      conversionTriggers: string[];
      offerPresentation: string;
      urgencyMechanism: string;
      objectionHandling: string[];
      checkoutOptimization: string[];
    };
    postSale: {
      onboarding: string;
      upsellSequence: string[];
      retentionTactics: string[];
      referralProgram: string;
    };
  };
  phases: EvergreenPhase[];
  abTestingPlan: {
    element: string;
    variantA: string;
    variantB: string;
    successMetric: string;
    duration: string;
  }[];
  monthlyOperationalCalendar: {
    week: number;
    focus: string;
    activities: string[];
    reviewMetrics: string[];
  }[];
  scalingTriggers: {
    trigger: string;
    condition: string;
    action: string;
  }[];
  pauseTriggers: {
    metric: string;
    threshold: string;
    action: string;
  }[];
  managerNotes: string;
}

const CONTINUOUS_SALES_PROMPT = `Você é o Agente de Vendas Contínuas da NexOS AI — especialista em funnels evergreen, otimização de CAC/LTV e crescimento previsível e sustentável.

Diferente de um lançamento, aqui não há "dia D". O carrinho está sempre aberto. O desafio é criar um sistema que converta de forma consistente todo dia, todo mês, sem depender de eventos.

## DIFERENÇAS CRÍTICAS DO MODELO CONTÍNUO

**Lançamento**: Pico de atenção → conversão em janela curta → silêncio
**Contínuo**: Fluxo constante de leads → nurturing → conversão distribuída → retenção

**O que importa aqui:**
- CAC (Custo por Aquisição) — quanto você paga para trazer cada cliente
- LTV (Lifetime Value) — quanto cada cliente vale ao longo do tempo
- Razão LTV:CAC — meta mínima de 3:1, ideal 5:1+
- Churn — a morte silenciosa do negócio contínuo
- Tempo até conversão — quantos dias do opt-in até a compra

## SUAS DIRETRIZES

**Construa para consistência, não para pico.** Um bom funil evergreen converte 1-3% dos leads e é lucrativo mesmo em dias ruins.

**Automação é o coração do modelo.** Cada toque manual que não está automatizado é um gargalo.

**Segmentação salva dinheiro.** Leads frios, mornos e quentes precisam de mensagens diferentes.

**Otimização contínua é obrigatória.** Defina pelo menos 3 testes A/B ativos em todo momento.

**Retorne APENAS JSON válido** no formato exato abaixo.

\`\`\`json
{
  "planTitle": "string",
  "model": "evergreen|cac_ltv_optimized|subscription_led",
  "monthlyRevenueTarget": 0,
  "monthlyLeadTarget": 0,
  "cacTarget": 0,
  "ltvTarget": 0,
  "ltvCacRatio": 0,
  "funnelArchitecture": {
    "topOfFunnel": {
      "channels": ["string"],
      "monthlyBudget": 0,
      "expectedLeads": 0,
      "leadMagnet": "string — o que você entrega em troca do contato",
      "leadMagnetFormat": "ebook|video|challenge|quiz|webinar|template|checklist|mini-course"
    },
    "middleOfFunnel": {
      "nurturingSequence": [
        {
          "day": 0,
          "touchpoint": "string — email/whatsapp/retargeting",
          "format": "string",
          "objective": "string",
          "expectedOpenRate": 0,
          "expectedClickRate": 0
        }
      ],
      "segmentationLogic": "string — como segmentar leads por interesse/comportamento",
      "qualificationCriteria": "string — o que define um lead pronto para comprar"
    },
    "bottomOfFunnel": {
      "conversionTriggers": ["string — o que empurra o lead para a decisão"],
      "offerPresentation": "string — como a oferta é apresentada",
      "urgencyMechanism": "string — urgência real sem manipulação (ex: preço muda, bônus expira)",
      "objectionHandling": ["string"],
      "checkoutOptimization": ["string — táticas para reduzir abandono no checkout"]
    },
    "postSale": {
      "onboarding": "string — sequência de boas-vindas e ativação",
      "upsellSequence": ["string"],
      "retentionTactics": ["string"],
      "referralProgram": "string"
    }
  },
  "phases": [
    {
      "phase": "string",
      "name": "string",
      "objective": "string",
      "channels": ["string"],
      "primaryTactic": "string",
      "automationElements": ["string"],
      "kpis": ["string"],
      "optimizationLevers": ["string"]
    }
  ],
  "abTestingPlan": [
    {
      "element": "string — o que está sendo testado",
      "variantA": "string",
      "variantB": "string",
      "successMetric": "string",
      "duration": "string"
    }
  ],
  "monthlyOperationalCalendar": [
    {
      "week": 0,
      "focus": "string",
      "activities": ["string"],
      "reviewMetrics": ["string"]
    }
  ],
  "scalingTriggers": [
    {
      "trigger": "string — condição para escalar",
      "condition": "string — número específico",
      "action": "string — o que fazer"
    }
  ],
  "pauseTriggers": [
    {
      "metric": "string",
      "threshold": "string",
      "action": "string"
    }
  ],
  "managerNotes": "string"
}
\`\`\``;

export async function runContinuousSalesManagerAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  strategy: StrategyOutput,
  log: Logger,
): Promise<ContinuousSalesPlanOutput> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "launch_manager",
    systemPrompt: CONTINUOUS_SALES_PROMPT,
    messages: [
      {
        role: "user",
        content: `Construa o plano de vendas contínuas (evergreen) completo.

**Dados de Intake:**
\`\`\`json
${JSON.stringify(
  {
    "product.name": intakeData["product.name"],
    "product.price": intakeData["product.price"],
    "product.category": intakeData["product.category"],
    "product.pricingModel": intakeData["product.pricingModel"],
    "audience.sophisticationLevel": intakeData["audience.sophisticationLevel"],
    "campaign.revenueTarget": intakeData["campaign.revenueTarget"],
    "campaign.budget.total": intakeData["campaign.budget.total"],
    "campaign.budget.traffic": intakeData["campaign.budget.traffic"],
    "campaign.salesChannel": intakeData["campaign.salesChannel"],
    "content.style": intakeData["content.style"],
    "risk.tolerance": intakeData["risk.tolerance"],
    // continuous-specific
    "evergreen.monthlyLeadTarget": intakeData["evergreen.monthlyLeadTarget"],
    "evergreen.cacTarget": intakeData["evergreen.cacTarget"],
    "evergreen.funnelType": intakeData["evergreen.funnelType"],
    "evergreen.automationPlatform": intakeData["evergreen.automationPlatform"],
    "evergreen.nurturingChannel": intakeData["evergreen.nurturingChannel"],
    "evergreen.ltvTarget": intakeData["evergreen.ltvTarget"],
  },
  null,
  2,
)}
\`\`\`

**Estratégia aprovada:**
\`\`\`json
${JSON.stringify(
  {
    successMetrics: strategy.successMetrics,
    audienceSegmentation: strategy.audienceSegmentation,
    offerPositioning: strategy.offerPositioning,
  },
  null,
  2,
)}
\`\`\`

Retorne APENAS o JSON do plano evergreen. Foco em consistência, automação e otimização de CAC/LTV.`,
      },
    ],
    log,
    requiresApproval: true,
    checkpointType: "launch_plan_approval",
    thinkingMessages: [
      "Analisando modelo de receita contínua...",
      "Calculando CAC target e ratio LTV/CAC ideal...",
      "Estruturando funil top → middle → bottom of funnel...",
      "Desenhando sequência de nurturing automatizada...",
      "Mapeando triggers de conversão e urgência evergreen...",
      "Criando plano de retenção e upsell pós-venda...",
      "Definindo testes A/B e calendário operacional mensal...",
    ],
  });

  return parseAgentJSON<ContinuousSalesPlanOutput>(result.content, {
    planTitle: `Plano Evergreen — ${String(intakeData["product.name"] ?? "")}`,
    model: "evergreen",
    monthlyRevenueTarget: Number(intakeData["campaign.revenueTarget"] ?? 0) / 12,
    monthlyLeadTarget: 0,
    cacTarget: 0,
    ltvTarget: 0,
    ltvCacRatio: 3,
    funnelArchitecture: {
      topOfFunnel: {
        channels: [],
        monthlyBudget: 0,
        expectedLeads: 0,
        leadMagnet: "",
        leadMagnetFormat: "ebook",
      },
      middleOfFunnel: {
        nurturingSequence: [],
        segmentationLogic: "",
        qualificationCriteria: "",
      },
      bottomOfFunnel: {
        conversionTriggers: [],
        offerPresentation: "",
        urgencyMechanism: "",
        objectionHandling: [],
        checkoutOptimization: [],
      },
      postSale: {
        onboarding: "",
        upsellSequence: [],
        retentionTactics: [],
        referralProgram: "",
      },
    },
    phases: [],
    abTestingPlan: [],
    monthlyOperationalCalendar: [],
    scalingTriggers: [],
    pauseTriggers: [],
    managerNotes: result.content,
  });
}
