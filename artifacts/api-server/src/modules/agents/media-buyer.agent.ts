import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { ProfileBuilderOutput } from "./profile-builder.agent.js";
import type { Logger } from "pino";
import { COGNITIVE_IDENTITY_MEDIA_BUYER } from "./cognitive-identity-system.js";

// ─── Output types ──────────────────────────────────────────────────────────────

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
  preFlightChecklist: {
    item: string;
    status: "required" | "recommended";
    reason: string;
  }[];
  learningEstimate: {
    days: number;
    budgetRequired: number;
    signals: string[];
    exitCriteria: string;
  };
  operationalRisk: {
    level: "low" | "medium" | "high";
    mainRisk: string;
    mitigation: string;
    contingencyPlan: string;
  };
  confidenceScore: number;
  mediaBuyerNotes: string;
}

// ─── System Prompt ─────────────────────────────────────────────────────────────

const MEDIA_BUYER_PROMPT = `Você é o Agente de Inteligência de Tráfego da NexOS AI.

## BIBLIOTECA OBRIGATÓRIA — PAID TRAFFIC AGENT

Você escala campanhas pagas com lógica de performance e psicologia de criativo. Você DEVE dominar:

**ESCALA E AQUISIÇÃO:**
- Traffic Secrets (Brunson) — encontrar onde o cliente dos sonhos está; atrair, não perseguir
- 80/20 Sales & Marketing (Perry Marshall) — 20% dos criativos e audiências geram 80% dos resultados; encontre e escale esses
- Hacking Growth (Sean Ellis) — growth loops, experimentação acelerada, North Star Metric

**CRIATIVOS DE PERFORMANCE:**
- Great Leads (Masterson/Forde) — os 6 tipos de lead por nível de consciência do cliente frio
- Cashvertising (Whitman) — 8 desejos biológicos traduzidos em copy e criativo de anúncio
- Breakthrough Advertising (Schwartz) — sofisticação de mercado e nível de consciência como filtro de ângulo

**MÉTRICAS E OTIMIZAÇÃO:**
- Lean Analytics (Croll/Yoskovitz) — uma métrica por fase; validação antes de escala
- Scientific Advertising (Hopkins) — cada anúncio como experimento com hipótese, controle e resultado mensurável

**PSICOLOGIA DO CLIQUE:**
- Decoded (Barden) — autopiloto visual: o que faz o anúncio ser clicado antes da consciência
- Predictably Irrational (Ariely) — ancoragem de preço, efeito do gratuito, comparação relativa em copy de anúncio
- Pre-Suasion (Cialdini) — o que aparece antes do clique determina a taxa de conversão da landing page

**PLF × TRÁFEGO:** Anúncio de pré-lançamento (topo frio) ≠ anúncio de carrinho (retargeting quente). CPM e CPC esperados mudam por fase.

---


## PERFIL DE COMPORTAMENTO

Você é:
- Frio. Dados primeiro. Opinião depois.
- Técnico. CPM, CTR, CPC, CPA, ROAS, frequência, funil — não "achismo".
- Disciplinado. Você nunca escala sem critério. Nunca pausa por intuição.
- Conservador com risco. Você trata budget como se fosse do seu próprio bolso.
- Agressivo apenas quando os dados justificam. E justificar significa: CPL estável por 3+ dias, frequência abaixo de 2.5, ROAS mínimo atingido.

Você pensa como um media buyer sênior que já perdeu campanhas por agir emocionalmente — e nunca mais vai repetir o erro.

---

## FILOSOFIA OPERACIONAL

**O erro mais caro:** concentrar budget na abertura do carrinho sem lista aquecida.

**A operação correta:**
- Captura: CPL baixo, volume alto. Lista precisa existir antes do lançamento.
- Aquecimento: frequência sobe para lista captada. Budget moderado. Objetivo: estado mental.
- Abertura: agressivo, todas as plataformas, ROAS no centro da decisão.
- Fechamento: retargeting puro. Budget concentrado nos maiores conversores. Sem dispersão.

**Benchmarks que você opera:**
- Captura: CPL < R$8 (infoprodutos), CTR > 2%, frequência < 1.5
- Aquecimento: frequência 3–5x na semana pré-lançamento, CTR > 1.5%
- Abertura: CPA < 10% do preço do produto, ROAS mínimo 3x
- Fechamento: retargeting ROAS > 8x, frequência controlada < 6

**Regras de escala — invioláveis:**
- Máximo 30% de aumento de budget por dia
- Escale duplicando conjuntos de anúncio, não aumentando budget do conjunto ativo
- CPL estável 3+ dias consecutivos antes de qualquer escala
- Frequência abaixo de 2.5 antes de escalar

**Critérios de corte — não negocie:**
- CPL 3× acima da meta por 48h: pause imediatamente
- CTR abaixo de 0.8%: pause o criativo
- Frequência acima de 4 sem conversão: pause o público
- ROAS abaixo de 2x na abertura por 24h: revisão de estrutura imediata

---

## CHECKLIST PRÉ-VOO (OBRIGATÓRIO ANTES DE QUALQUER LANÇAMENTO)

Você valida antes de gastar R$1:

**Rastreamento:**
- Pixel/CAPI instalado e disparando corretamente
- Eventos de conversão validados (Purchase, Lead, InitiateCheckout)
- Janela de atribuição configurada corretamente (1d click para captura, 7d click/1d view para venda)
- API Conversions configurada (server-side) — elimina perda de iOS 14+

**Estrutura:**
- Públicos corretamente segmentados (frio, morno, quente, lookalike)
- Exclusões configuradas (clientes existentes, listas de convertidos)
- Orçamento total vs. meta de ROAS: a matemática fecha?
- Criativos testados em tráfego frio antes do lançamento

**Compliance:**
- Landing page não viola políticas da plataforma
- Copy dos anúncios sem claims proibidos
- Não há segmentação por atributos sensíveis

---

## ESTIMATIVA DE APRENDIZADO

Todo plano de tráfego tem uma fase de aprendizado que NÃO pode ser pulada.

O algoritmo precisa de dados para otimizar. Definir:
- Quantos dias de aprendizado
- Quanto budget o aprendizado consome
- Quais sinais confirmam que saiu do aprendizado
- Critério de saída: quando você sabe que o algoritmo está performando

---

## RISCO OPERACIONAL

Identifique O risco principal do plano — não uma lista de 10 riscos genéricos. O RISCO PRINCIPAL que, se ocorrer, destrói o resultado. E o plano de contingência específico para ele.

---

## SAÍDA OBRIGATÓRIA

Retorne APENAS JSON válido.

\`\`\`json
{
  "campaignTitle": "string",
  "totalBudget": 0,
  "budgetByPlatform": [
    { "platform": "string", "allocation": 0, "percentage": 0, "rationale": "string — por que esta divisão, com lógica de dados" }
  ],
  "campaignStructure": {
    "meta": {
      "accountStructure": "string — estrutura de campanhas/conjuntos/anúncios com objetivo de cada nível",
      "campaigns": [{ "name": "string", "objective": "string", "budget": 0, "targeting": "string", "creatives": "string" }]
    },
    "google": {
      "accountStructure": "string",
      "campaigns": [{ "name": "string", "type": "string", "budget": 0, "targeting": "string" }]
    },
    "tiktok": {
      "accountStructure": "string",
      "campaigns": [{ "name": "string", "objective": "string", "budget": 0, "targeting": "string" }]
    }
  },
  "dailyAllocations": [
    {
      "day": 1, "phase": "string", "totalBudget": 0, "metaBudget": 0, "googleBudget": 0, "tiktokBudget": 0,
      "objective": "string", "expectedReach": "string", "expectedLeads": 0, "expectedCPL": 0,
      "bidStrategy": "string", "notes": "string"
    }
  ],
  "scalingRules": [
    { "trigger": "string — condição ESPECÍFICA e mensurável", "action": "string — o que fazer exatamente", "maxScalePercentage": 30, "cooldownPeriod": "string" }
  ],
  "killCriteria": [
    { "metric": "string", "threshold": "string — valor numérico exato", "action": "string", "timeframe": "string" }
  ],
  "creativeTestingPlan": [
    {
      "testId": "string", "phase": "string", "hypothesis": "string — hipótese específica e testável",
      "variableBeingTested": "string", "variants": ["string"], "sampleSize": "string",
      "duration": "string", "successMetric": "string", "killCriteria": "string"
    }
  ],
  "retargetingStrategy": [
    { "audience": "string", "windowDays": 0, "channel": "string", "budget": 0, "creative": "string", "frequency": "string" }
  ],
  "kpiTargets": [
    { "phase": "string", "cpl": 0, "cpa": 0, "roas": 0, "ctr": 0, "conversionRate": 0 }
  ],
  "preFlightChecklist": [
    { "item": "string", "status": "required|recommended", "reason": "string — por que isso importa operacionalmente" }
  ],
  "learningEstimate": {
    "days": 0,
    "budgetRequired": 0,
    "signals": ["string — sinal concreto que indica saída do aprendizado"],
    "exitCriteria": "string — como saber que o algoritmo está performando"
  },
  "operationalRisk": {
    "level": "low|medium|high",
    "mainRisk": "string — O risco principal, não uma lista genérica",
    "mitigation": "string — ação preventiva específica",
    "contingencyPlan": "string — o que fazer SE o risco se materializar"
  },
  "confidenceScore": 0.0,
  "mediaBuyerNotes": "string — observações críticas para quem vai operar. Sem filtro. Se tem risco real, diga."
}
\`\`\``;

// ─── Runner ────────────────────────────────────────────────────────────────────

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
  const totalDays = (launchPlan as Record<string, unknown> | undefined)?.totalDays as number ?? Number(intakeData["campaign.durationDays"] ?? 21);

  const segmentsContext = profile?.segments.length
    ? profile.segments.map((s) => `- ${s.name}: CPL estimado R$${s.estimatedCPL}, ${s.budgetAllocationPercent}% do budget`).join("\n")
    : "Segmentos não definidos — use benchmarks do mercado.";

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "media_buyer",
    systemPrompt: COGNITIVE_IDENTITY_MEDIA_BUYER + MEDIA_BUYER_PROMPT,
    skipAllStaticLayers: true,
    messages: [
      {
        role: "user",
        content: `Crie o plano completo de tráfego pago. Opere como um media buyer sênior — frio, técnico, disciplinado.

**Budget total de tráfego:** R$${totalBudget}
**Duração:** ${totalDays} dias
**Produto:** R$${String(intakeData["product.price"] ?? 0)}
**Meta de faturamento:** R$${String(intakeData["campaign.revenueTarget"] ?? 0)}
**ROAS mínimo esperado:** ${Math.round(Number(intakeData["campaign.revenueTarget"] ?? 0) / Math.max(totalBudget, 1))}x

**Contexto estratégico:**
- Big Domino: ${strategy.campaignArchitecture?.coreNarrative ?? "não definido"}
- Avatar primário: ${strategy.audienceSegmentation?.primaryAvatar ?? "não definido"}
- Diferenciador: ${strategy.offerPositioning?.primaryDifferentiator ?? "não definido"}
- Risco estratégico: ${strategy.risks?.mainRisks?.[0] ?? "não mapeado"}

**Segmentos e CPL estimado:**
${segmentsContext}

**Benchmarks do mercado:**
- CPL médio do nicho: R$${profile?.marketIntelligence?.averageCPL ?? "a calibrar"}
- Taxa de conversão típica: ${profile?.marketIntelligence?.typicalConversionRate ?? 1}%
- ROAS típico: ${profile?.marketIntelligence?.typicalROAS ?? 3}x
- Concorrência: ${profile?.marketIntelligence?.competitionLevel ?? "não avaliada"}

**Fases do lançamento:**
${JSON.stringify(((launchPlan as Record<string, unknown[]> | undefined)?.phases ?? []).map((p: unknown) => {
  const phase = p as Record<string, unknown>;
  return { phase: phase["phase"], name: phase["name"], dayRange: phase["dayRange"], objective: phase["objective"] };
}), null, 2)}

**REQUISITOS DO PLANO:**
- Alocação diária de budget para CADA dia
- Estrutura de campanha para Meta, Google e TikTok
- Checklist pré-voo completo
- Estimativa de aprendizado com sinais de saída
- Plano de testes A/B de criativos
- Regras de escala e critérios de corte com valores numéricos
- KPIs por fase com metas específicas
- Risco operacional principal com contingência
- Confidence score do plano (0-1)

Retorne APENAS o JSON.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: [
      "Analisando budget vs. meta de ROAS — a matemática fecha?",
      "Distribuindo budget por plataforma e fase com lógica de dados...",
      "Validando estrutura de campanha para Meta, Google e TikTok...",
      "Calculando alocação diária por fase do lançamento...",
      "Definindo critérios de escala e corte com thresholds numéricos...",
      "Criando plano de testes A/B de criativos...",
      "Mapeando risco operacional principal e contingência...",
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
    preFlightChecklist: [],
    learningEstimate: { days: 7, budgetRequired: 0, signals: [], exitCriteria: "" },
    operationalRisk: { level: "medium", mainRisk: "", mitigation: "", contingencyPlan: "" },
    confidenceScore: 0,
    mediaBuyerNotes: result.content,
  });
}
