import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { ProfileBuilderOutput } from "./profile-builder.agent.js";
import type { Logger } from "pino";

export interface DailyBudgetAllocation {
  day: number;
  phase: string;
  totalBudget: number;
  metaBudget: number;
  googleBudget: number;
  tiktokBudget: number;
  objective: string;
  expectedReach: string;
  expectedLeads: number;
  expectedCPL: number;
  bidStrategy: string;
  notes: string;
}

export interface CreativeTestPlan {
  testId: string;
  phase: string;
  hypothesis: string;
  variableBeingTested: string;
  variants: string[];
  sampleSize: string;
  duration: string;
  successMetric: string;
  killCriteria: string;
}

export interface MediaBuyerOutput {
  campaignTitle: string;
  totalBudget: number;
  budgetByPlatform: { platform: string; allocation: number; percentage: number; rationale: string }[];
  campaignStructure: {
    meta: {
      accountStructure: string;
      campaigns: { name: string; objective: string; budget: number; targeting: string; creatives: string }[];
    };
    google: {
      accountStructure: string;
      campaigns: { name: string; type: string; budget: number; targeting: string }[];
    };
    tiktok: {
      accountStructure: string;
      campaigns: { name: string; objective: string; budget: number; targeting: string }[];
    };
  };
  dailyAllocations: DailyBudgetAllocation[];
  scalingRules: {
    trigger: string;
    action: string;
    maxScalePercentage: number;
    cooldownPeriod: string;
  }[];
  killCriteria: {
    metric: string;
    threshold: string;
    action: string;
    timeframe: string;
  }[];
  creativeTestingPlan: CreativeTestPlan[];
  retargetingStrategy: {
    audience: string;
    windowDays: number;
    channel: string;
    budget: number;
    creative: string;
    frequency: string;
  }[];
  kpiTargets: {
    phase: string;
    cpl: number;
    cpa: number;
    roas: number;
    ctr: number;
    conversionRate: number;
  }[];
  mediaBuyerNotes: string;
}

const MEDIA_BUYER_PROMPT = `Você é o Agente de Media Buyer da NexOS AI — especialista em tráfego pago para lançamentos digitais.

Você cria o plano de veiculação estratégico: como distribuir o budget, como estruturar as campanhas nas plataformas, quando escalar, quando pausar e como testar criativos.

## FILOSOFIA DE MEDIA BUYING PARA LANÇAMENTOS

**O erro mais comum:** gastar todo o budget na abertura do carrinho.

**A estratégia certa:**
- Fase de captura: CPL baixo, volume alto — listas precisam ser grandes antes do lançamento
- Fase de aquecimento: frequência aumenta para lista já captada
- Abertura: agressivo, budget máximo, todas as plataformas
- Fechamento: retargeting puro, budget concentrado, ROAS máximo

**KPIs por fase:**
- Captura: CPL < R$8 (infoprodutos), CTR > 2%
- Aquecimento: frequência 3-5x na semana pré-lançamento
- Abertura: CPA < 10% do preço do produto, ROAS mínimo 3x
- Fechamento: retargeting ROAS > 8x

**Regras de escala:**
- Nunca escale mais de 30% ao dia
- Escale em duplicações de conjunto de anúncio, não aumento de budget
- Antes de escalar: CPL estável por 3+ dias, frequência abaixo de 2.5

**Regras de corte:**
- CPL 3x acima da meta por 48h: pause
- CTR abaixo de 0.8%: pause o criativo
- Frequência acima de 4 sem conversão: pause o público

**Retorne APENAS JSON válido** no formato abaixo.

\`\`\`json
{
  "campaignTitle": "string",
  "totalBudget": 0,
  "budgetByPlatform": [
    {
      "platform": "string",
      "allocation": 0,
      "percentage": 0,
      "rationale": "string — por que essa divisão"
    }
  ],
  "campaignStructure": {
    "meta": {
      "accountStructure": "string — como organizar campanhas/conjuntos/anúncios",
      "campaigns": [
        {
          "name": "string",
          "objective": "string",
          "budget": 0,
          "targeting": "string",
          "creatives": "string"
        }
      ]
    },
    "google": {
      "accountStructure": "string",
      "campaigns": [
        {
          "name": "string",
          "type": "string",
          "budget": 0,
          "targeting": "string"
        }
      ]
    },
    "tiktok": {
      "accountStructure": "string",
      "campaigns": [
        {
          "name": "string",
          "objective": "string",
          "budget": 0,
          "targeting": "string"
        }
      ]
    }
  },
  "dailyAllocations": [
    {
      "day": 1,
      "phase": "string",
      "totalBudget": 0,
      "metaBudget": 0,
      "googleBudget": 0,
      "tiktokBudget": 0,
      "objective": "string",
      "expectedReach": "string",
      "expectedLeads": 0,
      "expectedCPL": 0,
      "bidStrategy": "string",
      "notes": "string"
    }
  ],
  "scalingRules": [
    {
      "trigger": "string — condição que dispara a escala",
      "action": "string — o que fazer exatamente",
      "maxScalePercentage": 30,
      "cooldownPeriod": "string"
    }
  ],
  "killCriteria": [
    {
      "metric": "string",
      "threshold": "string",
      "action": "string",
      "timeframe": "string"
    }
  ],
  "creativeTestingPlan": [
    {
      "testId": "string",
      "phase": "string",
      "hypothesis": "string",
      "variableBeingTested": "string",
      "variants": ["string"],
      "sampleSize": "string",
      "duration": "string",
      "successMetric": "string",
      "killCriteria": "string"
    }
  ],
  "retargetingStrategy": [
    {
      "audience": "string",
      "windowDays": 0,
      "channel": "string",
      "budget": 0,
      "creative": "string",
      "frequency": "string"
    }
  ],
  "kpiTargets": [
    {
      "phase": "string",
      "cpl": 0,
      "cpa": 0,
      "roas": 0,
      "ctr": 0,
      "conversionRate": 0
    }
  ],
  "mediaBuyerNotes": "string — observações estratégicas para quem vai operar o tráfego"
}
\`\`\``;

export async function runMediaBuyerAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  strategy: StrategyOutput,
  profile: ProfileBuilderOutput | undefined,
  launchPlan: Record<string, unknown> | undefined,
  log: Logger,
): Promise<MediaBuyerOutput> {
  const totalBudget = Number(intakeData["campaign.budget.traffic"] ?? intakeData["campaign.budget.total"] ?? 0);
  const totalDays = (launchPlan as any)?.totalDays ?? Number(intakeData["campaign.durationDays"] ?? 21);

  const segmentsContext = profile?.segments.length
    ? profile.segments.map((s) => `- ${s.name}: CPL estimado R$${s.estimatedCPL}, ${s.budgetAllocationPercent}% do budget`).join("\n")
    : "";

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "media_buyer",
    systemPrompt: MEDIA_BUYER_PROMPT,
    messages: [
      {
        role: "user",
        content: `Crie o plano completo de media buying para a campanha.

**Budget total de tráfego:** R$${totalBudget}
**Duração:** ${totalDays} dias
**Produto:** R$${String(intakeData["product.price"] ?? 0)}
**Meta de faturamento:** R$${String(intakeData["campaign.revenueTarget"] ?? 0)}
**ROAS mínimo esperado:** ${Math.round(Number(intakeData["campaign.revenueTarget"] ?? 0) / totalBudget)}x

**Segmentos identificados:**
${segmentsContext}

**Benchmarks do mercado:**
- CPL médio do nicho: R$${profile?.marketIntelligence?.averageCPL ?? "a definir"}
- Taxa de conversão típica: ${profile?.marketIntelligence?.typicalConversionRate ?? 1}%
- ROAS típico: ${profile?.marketIntelligence?.typicalROAS ?? 3}x

**Fases do lançamento:**
${JSON.stringify(((launchPlan as any)?.phases ?? []).map((p: any) => ({
  phase: p.phase,
  name: p.name,
  dayRange: p.dayRange,
  objective: p.objective,
})), null, 2)}

**REQUISITOS:**
- Budget diário especificado para CADA dia da campanha
- Estrutura de campanhas para Meta, Google e TikTok
- Plano de testes A/B de criativos
- Regras claras de escala e corte
- KPIs por fase com metas numéricas específicas

Retorne APENAS o JSON do plano de media buying.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: [
      "Analisando budget e objetivos da campanha...",
      "Distribuindo budget por plataforma e fase...",
      "Estruturando campanhas no Meta, Google e TikTok...",
      "Calculando alocação diária de budget...",
      "Definindo regras de escala e critérios de corte...",
      "Criando plano de testes de criativos...",
      "Estabelecendo KPIs e metas por fase...",
    ],
  });

  return parseAgentJSON<MediaBuyerOutput>(result.content, {
    campaignTitle: String(intakeData["product.name"] ?? ""),
    totalBudget,
    budgetByPlatform: [],
    campaignStructure: {
      meta: { accountStructure: "", campaigns: [] },
      google: { accountStructure: "", campaigns: [] },
      tiktok: { accountStructure: "", campaigns: [] },
    },
    dailyAllocations: [],
    scalingRules: [],
    killCriteria: [],
    creativeTestingPlan: [],
    retargetingStrategy: [],
    kpiTargets: [],
    mediaBuyerNotes: result.content,
  });
}
