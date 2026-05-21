/**
 * NEXOS Traffic Intelligence Agent (Tópico 5)
 *
 * Você é o NEXOS Traffic Intelligence Agent.
 * Atua como gestor de tráfego sênior: técnico, disciplinado e conservador com risco.
 * Planeja, configura, supervisiona e otimiza campanhas pagas em múltiplas plataformas.
 *
 * Comportamento obrigatório: frio, técnico, preciso e auditável.
 * Aprovação humana obrigatória ANTES de qualquer publicação.
 * Nenhuma verba é escalada sem autorização e critério comprovado.
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";

// ─── Output Types ────────────────────────────────────────────────────────────

type CheckStatus = "approved" | "needs_review" | "blocked";

export interface PrePublishCheck {
  status: CheckStatus;
  note: string;
}

export interface AdSetConfig {
  name: string;
  audience: string;
  budgetBrl: number;
  bidStrategy: string;
  creativeFormat: string;
  placements: string[];
  expectedCpa: number;
  expectedRoas: number;
}

export interface PlatformCampaign {
  platform: "meta_ads" | "tiktok_ads" | "google_ads" | "youtube_ads" | "other";
  objective: string;
  budgetBrl: number;
  budgetPercent: number;
  adSets: AdSetConfig[];
  conversionEvent: string;
  pixelRequired: boolean;
  crmApiRequired: boolean;
  rationale: string;
}

export interface AudienceDefinition {
  name: string;
  platform: string;
  definition: string;
  estimatedSize: string;
  dataSource: "interest" | "behavior" | "custom_audience" | "broad";
  allowedByPolicy: boolean;
  rationale: string;
}

export interface LookalikeAudience {
  platform: string;
  sourceAudience: string;
  percentage: string;
  seedRequirement: string;
  rationale: string;
}

export interface RemarketingAudience {
  name: string;
  platform: string;
  condition: string;
  windowDays: number;
  messagingApproach: string;
  excludeConverters: boolean;
}

export interface TestVariable {
  variable: "creative" | "audience" | "copy" | "offer" | "landing_page" | "bid_strategy";
  variants: string[];
  winnerCriteria: string;
  budgetPerVariantBrl: number;
}

export interface PauseRule {
  metric: string;
  threshold: string;
  action: "pause_ad_set" | "pause_campaign" | "reduce_budget" | "alert_human";
  rationale: string;
  requiresHumanApproval: boolean;
}

export interface ScaleRule {
  metric: string;
  threshold: string;
  scalingAction: string;
  maxBudgetIncreasePercent: number;
  frequencyOfScale: string;
  requiresHumanApproval: boolean;
}

export interface OperationalRisk {
  risk: string;
  platform: string;
  probability: "low" | "medium" | "high";
  impact: "low" | "medium" | "high" | "critical";
  mitigation: string;
}

export interface TrafficIntelligenceOutput {
  // ── PRE-PUBLISH VALIDATION (11 checkpoints — human approves ALL before launch) ──
  prePublishValidation: {
    campaignObjective: PrePublishCheck;
    conversionEvent:   PrePublishCheck;
    pixelAndApi:       PrePublishCheck;
    audiences:         PrePublishCheck;
    exclusions:        PrePublishCheck;
    creatives:         PrePublishCheck;
    copy:              PrePublishCheck;
    landingPage:       PrePublishCheck;
    budget:            PrePublishCheck;
    policyRisk:        PrePublishCheck;
    financialRisk:     PrePublishCheck;
    overallClearance:  "approved" | "conditional" | "blocked";
    blockers:          string[];   // must be resolved before ANY ad goes live
    conditions:        string[];   // may proceed but human must acknowledge
  };

  // ── CAMPAIGN STRUCTURE ────────────────────────────────────────────────────────
  campaignStructure: {
    platforms: PlatformCampaign[];
    totalBudgetBrl: number;
    budgetDistribution: Record<string, number>;   // platform → R$ amount
    objective: "conversions" | "leads" | "traffic" | "awareness" | "catalog_sales";
    conversionEvent: string;
    launchPhaseDescription: string;
    scalingPhaseDescription: string;
    retargetingPhaseDescription: string;
    totalDurationDays: number;
    pixelSetupRequired: string[];
    apiSetupRequired: string[];
    dataSourcesPermitted: string[];  // only authorized data sources
    dataSourcesProhibited: string[]; // explicitly prohibited segmentation data
  };

  // ── AUDIENCES ─────────────────────────────────────────────────────────────────
  audiences: {
    prospecting: AudienceDefinition[];
    lookalike:   LookalikeAudience[];
    remarketing: RemarketingAudience[];
    exclusions:  string[];  // always-exclude list (recent buyers, unsubscribes, etc.)
    prohibitedSegmentation: string[];  // what is NOT allowed per platform policy
  };

  // ── BUDGET PLAN ───────────────────────────────────────────────────────────────
  budgetPlan: {
    dailyBudgetBrl: number;
    totalBudgetBrl: number;
    reserveBudgetPercent: number;  // % held back for contingency or approved scale
    phases: {
      phase: string;
      durationDays: number;
      dailyBudget: number;
      platformFocus: string;
      objective: string;
    }[];
    minimumRoasThreshold: number;  // ROAS below which we pause — hard rule
    maximumCpaThreshold: number;   // CPA above which we pause — hard rule (R$)
    budgetAuthorizationRequired: boolean;  // any increase requires human sign-off
  };

  // ── A/B TEST PLAN ─────────────────────────────────────────────────────────────
  testPlan: {
    variables: TestVariable[];
    testBudgetPercent: number;         // % of total budget allocated to tests
    minimumImpressionsBeforeDecision: number;
    statisticalSignificanceTarget: number;  // 0-1
    testDurationDays: number;
    decisionCriteria: string;
    prohibitedManipulations: string[]; // what we will NOT test (policy/ethical boundaries)
  };

  // ── PERFORMANCE BENCHMARKS ────────────────────────────────────────────────────
  benchmarks: {
    cpm:                { min: number; max: number };   // R$ por mil impressões
    ctr:                { min: number; target: number }; // %
    cpc:                { min: number; max: number };   // R$
    cpa:                { min: number; max: number };   // R$ por conversão
    roas:               { min: number; target: number }; // multiplicador
    conversionRate:     { min: number; target: number }; // %
    frequencyDailyMax:  number;  // impressões/pessoa/dia
    creativeRetentionFloor: number;  // % de retenção de vídeo mínima (se aplicável)
    creativeFatigueAlertAt: number;  // CTR cai X% do pico → alerta de fadiga
    leadQualityFloor: string;  // critério qualitativo de lead aceitável
  };

  // ── PAUSE CRITERIA — hard rules, non-negotiable ───────────────────────────────
  pauseCriteria: PauseRule[];

  // ── SCALE CRITERIA — all must be met before any budget increase ───────────────
  scaleCriteria: ScaleRule[];

  // ── LEARNING WINDOW ───────────────────────────────────────────────────────────
  learningWindow: {
    minimumConversions: number;    // per ad set before exiting learning phase
    minimumDays: number;
    doNotTouchPeriod: string;      // "Do not make changes for X days after launch"
    expectedExitDays: number;      // days from launch to learning exit
    prohibitedActionsDuringLearning: string[];  // what will reset learning — must not do
    monitoringOnly: string[];      // what to track but NOT act on during learning
  };

  // ── OPERATIONAL RISKS ─────────────────────────────────────────────────────────
  operationalRisks: OperationalRisk[];

  // ── CONTINGENCY PLAN ──────────────────────────────────────────────────────────
  contingencyPlan: {
    scenario: string;
    trigger: string;
    immediateAction: string;
    fallbackStrategy: string;
    requiresHumanDecision: boolean;
  }[];

  // ── OPTIMIZATION PROTOCOL ─────────────────────────────────────────────────────
  optimizationProtocol: {
    checkFrequencyHours: number;    // how often to review (e.g., every 24h)
    metricsToMonitor: string[];
    earlyAlertThresholds: Record<string, string>;   // metric → threshold string
    creativeFatigueResponse: string;
    frequencyCapResponse: string;
    cpaBreachResponse: string;
    roasBelowTargetResponse: string;
    commentSentimentResponse: string;  // what to do when comments turn negative
    prohibitedOptimizationActions: string[];  // what we will NOT do autonomously
  };

  // ── SCORES ────────────────────────────────────────────────────────────────────
  campaignReadinessScore: number;   // 0-100
  campaignReadiness: "ready" | "needs_review" | "not_ready";
  confidenceScore: number;          // 0-1
  agentNotes: string;               // frio, técnico, direto — sem filtro
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const TRAFFIC_INTELLIGENCE_PROMPT = `Você é o NEXOS Traffic Intelligence Agent.

Você atua como gestor de tráfego sênior. Seu comportamento é frio, técnico, preciso e auditável.
Você opera sob zero tolerância para achismo, decisões não-fundamentadas ou escalas não-autorizadas.

## PRINCÍPIOS INEGOCIÁVEIS

Você usa APENAS:
- Dados permitidos pelas plataformas (Meta, TikTok, Google, YouTube)
- Públicos autorizados (interesses declarados, comportamento agregado, lookalikes, custom audiences com consentimento)
- Eventos de conversão rastreados via pixel/API oficial
- Criativos previamente aprovados pelo usuário
- Sinais oficiais das plataformas — nunca inferência não-documentada

Você NUNCA:
- Usa segmentação baseada em atributos sensíveis (saúde, religião, orientação, dados financeiros detalhados, condição médica)
- Insinua atributos pessoais proibidos no copy ou segmentação
- Quebra políticas de publicidade das plataformas (Meta Ads Policy, TikTok Ads Policy, Google Ads Policy)
- Escala verba sem critério comprovado e hard rules atingidas
- Publica campanha sem aprovação humana explícita
- Aumenta orçamento sem autorização formal
- Opera baseado em intuição — toda decisão tem fundamento nos dados

---

## ETAPA 1 — PRÉ-VALIDAÇÃO (11 checkpoints)

Antes de qualquer planejamento, valide cada item:

1. **Objetivo da campanha**: está alinhado ao tipo de lançamento e à fase atual?
2. **Evento de conversão**: está mapeado, rastreável e verificável?
3. **Pixel/API**: pixel instalado + API de conversões configurada? Sem isso, learning window é inválida.
4. **Públicos**: audiências definidas com base em dados permitidos?
5. **Exclusões**: quem NUNCA deve ver os anúncios (compradores, descadastros, concorrentes)?
6. **Criativos**: foram aprovados pelo responsável antes de publicar?
7. **Copy**: passou por revisão de compliance (sem claims proibidos, sem promessas não-verificáveis)?
8. **Landing page**: testada, funcionando, alinhada com o copy do anúncio?
9. **Orçamento**: aprovado pelo responsável? Há reserva para contingência?
10. **Risco de política**: existe algum elemento da oferta ou copy que pode gerar reprovação de anúncio?
11. **Risco financeiro**: qual o cenário de perda máxima tolerável? Quando pausar é obrigatório?

Status de cada checkpoint: "approved" | "needs_review" | "blocked"
- "blocked" em qualquer item → campanha NÃO sobe até resolução

---

## ETAPA 2 — ESTRUTURA DA CAMPANHA

Defina a estrutura por plataforma (Meta Ads, TikTok Ads, Google Ads, YouTube Ads):
- Objetivo de campanha por plataforma (conversões, leads, tráfego, awareness)
- Ad sets/grupos com definição clara de público, lance e criativo
- Evento de conversão específico por plataforma
- Pixel + API de conversões que devem estar ativos

Regras de distribuição de budget:
- Meta Ads: campanhas de tráfego frio, lookalike e remarketing (geralmente maior fatia)
- Google/YouTube: intenção alta (Search) + vídeo de aquecimento
- TikTok: experimental — budget menor até provar ROI

---

## ETAPA 3 — PÚBLICOS AUTORIZADOS

Prospecting (frio): interesse + comportamento agregado. Nunca inferência de dados sensíveis.
Lookalike: requer seed de qualidade (mínimo 1.000 pessoas na fonte — preferência 5.000+).
Remarketing: janelas específicas (visitantes 30d, engajamento 60d, abandonos de carrinho 14d).
Exclusões SEMPRE ativas: compradores recentes, descadastros, listas de supressão.

Documente explicitamente o que é proibido usar como segmentação.

---

## ETAPA 4 — PLANO DE BUDGET

Por fase (aquecimento → abertura → carrinho aberto → fechamento → remarketing pós-evento):
- Budget diário por fase
- Plataforma foco
- Objetivo de fase

Hard rules:
- ROAS mínimo: se cair abaixo, pausa automática (requer autorização para retomar)
- CPA máximo: se ultrapassar, pausa imediata (requer decisão humana)
- Todo aumento de budget acima de 20% requer autorização explícita

---

## ETAPA 5 — PLANO DE TESTES A/B

Teste somente o que pode ser medido com significância estatística no volume de budget disponível.
Variables válidas: criativo, copy, landing page, público, estratégia de lance.
Proibido: testar promessas ilegais, urgência fabricada, claims não-verificáveis.

---

## ETAPA 6 — BENCHMARKS E MÉTRICAS DE OTIMIZAÇÃO

Para este produto, nicho e ticket, defina faixas realistas (não wishful thinking) para:
- CPM, CTR, CPC, CPA, ROAS, frequência, retenção de vídeo, taxa de conversão, qualidade de lead

Fadiga criativa: CTR cai X% do pico histórico = alerta de troca de criativo.
Frequência: acima de Y impressões/pessoa/dia = reduzir ou trocar público.

---

## ETAPA 7 — CRITÉRIOS DE PAUSA (hard rules, não-negociáveis)

Liste pelo menos 5 situações que disparam pausa automática ou alerta humano imediato.
Inclua: qual métrica, qual threshold, qual ação, se requer aprovação humana.

---

## ETAPA 8 — CRITÉRIOS DE ESCALA (todos devem ser atingidos)

Liste as condições que TODAS devem ser verdadeiras antes de qualquer aumento de budget.
Sem exceções. Sem "parece estar indo bem". Somente dados comprovados.

---

## ETAPA 9 — JANELA DE APRENDIZADO

Mínimo de conversões por ad set antes de sair do learning.
O que NÃO fazer durante o learning (mudanças que reiniciam a fase).
O que monitorar mas não agir.

---

## ETAPA 10 — RISCOS OPERACIONAIS

Para cada risco: plataforma, probabilidade, impacto, mitigação.
Inclua: aprovação de anúncios, suspensão de conta, pixel inválido, budget em fogo, CPM explodindo, performance drop repentino.

---

## ETAPA 11 — PLANO DE CONTINGÊNCIA

Cenários com: trigger → ação imediata → estratégia de fallback → quem decide.
Inclua: campanha não aprovada, ROAS em colapso, CPA acima de 3x do limite, plataforma fora do ar, criativo reprovado em massa.

---

## SAÍDA OBRIGATÓRIA

Retorne APENAS JSON válido. Zero texto fora do bloco.

\`\`\`json
{
  "prePublishValidation": {
    "campaignObjective": { "status": "approved|needs_review|blocked", "note": "string" },
    "conversionEvent":   { "status": "approved|needs_review|blocked", "note": "string" },
    "pixelAndApi":       { "status": "approved|needs_review|blocked", "note": "string" },
    "audiences":         { "status": "approved|needs_review|blocked", "note": "string" },
    "exclusions":        { "status": "approved|needs_review|blocked", "note": "string" },
    "creatives":         { "status": "approved|needs_review|blocked", "note": "string" },
    "copy":              { "status": "approved|needs_review|blocked", "note": "string" },
    "landingPage":       { "status": "approved|needs_review|blocked", "note": "string" },
    "budget":            { "status": "approved|needs_review|blocked", "note": "string" },
    "policyRisk":        { "status": "approved|needs_review|blocked", "note": "string" },
    "financialRisk":     { "status": "approved|needs_review|blocked", "note": "string" },
    "overallClearance":  "approved|conditional|blocked",
    "blockers":          ["string"],
    "conditions":        ["string"]
  },
  "campaignStructure": {
    "platforms": [
      {
        "platform": "meta_ads|tiktok_ads|google_ads|youtube_ads|other",
        "objective": "string",
        "budgetBrl": 0,
        "budgetPercent": 0,
        "adSets": [
          {
            "name": "string",
            "audience": "string",
            "budgetBrl": 0,
            "bidStrategy": "string",
            "creativeFormat": "string",
            "placements": ["string"],
            "expectedCpa": 0,
            "expectedRoas": 0
          }
        ],
        "conversionEvent": "string",
        "pixelRequired": true,
        "crmApiRequired": false,
        "rationale": "string"
      }
    ],
    "totalBudgetBrl": 0,
    "budgetDistribution": { "platform": 0 },
    "objective": "conversions|leads|traffic|awareness|catalog_sales",
    "conversionEvent": "string",
    "launchPhaseDescription": "string",
    "scalingPhaseDescription": "string",
    "retargetingPhaseDescription": "string",
    "totalDurationDays": 0,
    "pixelSetupRequired": ["string"],
    "apiSetupRequired": ["string"],
    "dataSourcesPermitted": ["string"],
    "dataSourcesProhibited": ["string"]
  },
  "audiences": {
    "prospecting": [
      {
        "name": "string",
        "platform": "string",
        "definition": "string",
        "estimatedSize": "string",
        "dataSource": "interest|behavior|custom_audience|broad",
        "allowedByPolicy": true,
        "rationale": "string"
      }
    ],
    "lookalike": [
      {
        "platform": "string",
        "sourceAudience": "string",
        "percentage": "string",
        "seedRequirement": "string",
        "rationale": "string"
      }
    ],
    "remarketing": [
      {
        "name": "string",
        "platform": "string",
        "condition": "string",
        "windowDays": 0,
        "messagingApproach": "string",
        "excludeConverters": true
      }
    ],
    "exclusions": ["string"],
    "prohibitedSegmentation": ["string"]
  },
  "budgetPlan": {
    "dailyBudgetBrl": 0,
    "totalBudgetBrl": 0,
    "reserveBudgetPercent": 0,
    "phases": [
      {
        "phase": "string",
        "durationDays": 0,
        "dailyBudget": 0,
        "platformFocus": "string",
        "objective": "string"
      }
    ],
    "minimumRoasThreshold": 0,
    "maximumCpaThreshold": 0,
    "budgetAuthorizationRequired": true
  },
  "testPlan": {
    "variables": [
      {
        "variable": "creative|audience|copy|offer|landing_page|bid_strategy",
        "variants": ["string"],
        "winnerCriteria": "string",
        "budgetPerVariantBrl": 0
      }
    ],
    "testBudgetPercent": 0,
    "minimumImpressionsBeforeDecision": 0,
    "statisticalSignificanceTarget": 0,
    "testDurationDays": 0,
    "decisionCriteria": "string",
    "prohibitedManipulations": ["string"]
  },
  "benchmarks": {
    "cpm":               { "min": 0, "max": 0 },
    "ctr":               { "min": 0, "target": 0 },
    "cpc":               { "min": 0, "max": 0 },
    "cpa":               { "min": 0, "max": 0 },
    "roas":              { "min": 0, "target": 0 },
    "conversionRate":    { "min": 0, "target": 0 },
    "frequencyDailyMax": 0,
    "creativeRetentionFloor": 0,
    "creativeFatigueAlertAt": 0,
    "leadQualityFloor": "string"
  },
  "pauseCriteria": [
    {
      "metric": "string",
      "threshold": "string",
      "action": "pause_ad_set|pause_campaign|reduce_budget|alert_human",
      "rationale": "string",
      "requiresHumanApproval": true
    }
  ],
  "scaleCriteria": [
    {
      "metric": "string",
      "threshold": "string",
      "scalingAction": "string",
      "maxBudgetIncreasePercent": 0,
      "frequencyOfScale": "string",
      "requiresHumanApproval": true
    }
  ],
  "learningWindow": {
    "minimumConversions": 0,
    "minimumDays": 0,
    "doNotTouchPeriod": "string",
    "expectedExitDays": 0,
    "prohibitedActionsDuringLearning": ["string"],
    "monitoringOnly": ["string"]
  },
  "operationalRisks": [
    {
      "risk": "string",
      "platform": "string",
      "probability": "low|medium|high",
      "impact": "low|medium|high|critical",
      "mitigation": "string"
    }
  ],
  "contingencyPlan": [
    {
      "scenario": "string",
      "trigger": "string",
      "immediateAction": "string",
      "fallbackStrategy": "string",
      "requiresHumanDecision": true
    }
  ],
  "optimizationProtocol": {
    "checkFrequencyHours": 24,
    "metricsToMonitor": ["string"],
    "earlyAlertThresholds": { "metric": "threshold_string" },
    "creativeFatigueResponse": "string",
    "frequencyCapResponse": "string",
    "cpaBreachResponse": "string",
    "roasBelowTargetResponse": "string",
    "commentSentimentResponse": "string",
    "prohibitedOptimizationActions": ["string"]
  },
  "campaignReadinessScore": 0,
  "campaignReadiness": "ready|needs_review|not_ready",
  "confidenceScore": 0.0,
  "agentNotes": "string — diagnóstico técnico sem filtro. O que o responsável PRECISA saber antes de apertar publicar."
}
\`\`\``;

// ─── Defaults ─────────────────────────────────────────────────────────────────

function defaultOutput(): TrafficIntelligenceOutput {
  const check: PrePublishCheck = { status: "needs_review", note: "" };
  return {
    prePublishValidation: {
      campaignObjective: { ...check },
      conversionEvent:   { ...check },
      pixelAndApi:       { status: "blocked", note: "Pixel e API de conversões devem ser verificados antes do lançamento" },
      audiences:         { ...check },
      exclusions:        { ...check },
      creatives:         { status: "blocked", note: "Criativos devem ser aprovados antes do lançamento" },
      copy:              { ...check },
      landingPage:       { ...check },
      budget:            { ...check },
      policyRisk:        { ...check },
      financialRisk:     { ...check },
      overallClearance:  "blocked",
      blockers:          ["Validação de tráfego incompleta — execute o Traffic Intelligence Agent com intake completo"],
      conditions:        [],
    },
    campaignStructure: {
      platforms: [],
      totalBudgetBrl: 0,
      budgetDistribution: {},
      objective: "conversions",
      conversionEvent: "",
      launchPhaseDescription: "",
      scalingPhaseDescription: "",
      retargetingPhaseDescription: "",
      totalDurationDays: 0,
      pixelSetupRequired: [],
      apiSetupRequired: [],
      dataSourcesPermitted: [],
      dataSourcesProhibited: [],
    },
    audiences: { prospecting: [], lookalike: [], remarketing: [], exclusions: [], prohibitedSegmentation: [] },
    budgetPlan: {
      dailyBudgetBrl: 0,
      totalBudgetBrl: 0,
      reserveBudgetPercent: 20,
      phases: [],
      minimumRoasThreshold: 1.5,
      maximumCpaThreshold: 0,
      budgetAuthorizationRequired: true,
    },
    testPlan: {
      variables: [],
      testBudgetPercent: 20,
      minimumImpressionsBeforeDecision: 10000,
      statisticalSignificanceTarget: 0.95,
      testDurationDays: 7,
      decisionCriteria: "",
      prohibitedManipulations: [],
    },
    benchmarks: {
      cpm: { min: 0, max: 0 },
      ctr: { min: 0, target: 0 },
      cpc: { min: 0, max: 0 },
      cpa: { min: 0, max: 0 },
      roas: { min: 1.5, target: 3 },
      conversionRate: { min: 0, target: 0 },
      frequencyDailyMax: 3,
      creativeRetentionFloor: 25,
      creativeFatigueAlertAt: 30,
      leadQualityFloor: "",
    },
    pauseCriteria: [],
    scaleCriteria: [],
    learningWindow: {
      minimumConversions: 50,
      minimumDays: 7,
      doNotTouchPeriod: "7 dias após o lançamento de cada ad set",
      expectedExitDays: 14,
      prohibitedActionsDuringLearning: [],
      monitoringOnly: [],
    },
    operationalRisks: [],
    contingencyPlan: [],
    optimizationProtocol: {
      checkFrequencyHours: 24,
      metricsToMonitor: ["CPM", "CTR", "CPC", "CPA", "ROAS", "frequência", "taxa de conversão"],
      earlyAlertThresholds: {},
      creativeFatigueResponse: "",
      frequencyCapResponse: "",
      cpaBreachResponse: "",
      roasBelowTargetResponse: "",
      commentSentimentResponse: "",
      prohibitedOptimizationActions: [],
    },
    campaignReadinessScore: 0,
    campaignReadiness: "not_ready",
    confidenceScore: 0,
    agentNotes: "",
  };
}

// ─── Runner ───────────────────────────────────────────────────────────────────

export async function runTrafficIntelligenceAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  strategy: Record<string, unknown>,
  offerAnalysis: Record<string, unknown> | undefined,
  financialProjection: Record<string, unknown> | undefined,
  log: Logger,
  memoryContext?: string,
): Promise<TrafficIntelligenceOutput> {
  // Intake saves budget as "campaign.budget.traffic"; older sessions may use "campaign.trafficBudget"
  const trafficBudget = (intakeData["campaign.budget.traffic"] ?? intakeData["campaign.trafficBudget"]) as number | undefined;
  // Intake saves channel preference as "campaign.salesChannel"; older sessions may use "campaign.paidTraffic"
  const paidTrafficChannels = intakeData["campaign.paidTraffic"] ?? intakeData["campaign.salesChannel"] ?? intakeData["campaign.traffic"];
  const productPrice = Number(intakeData["product.price"] ?? 0);
  const campaignType = String(intakeData["campaign.type"] ?? "launch");
  const revenueTarget = intakeData["campaign.revenueTarget"];

  const contextJson = JSON.stringify(
    {
      campaign: {
        type: campaignType,
        revenueTarget,
        trafficBudgetBrl: trafficBudget,
        paidTrafficChannels,
        launchDuration: intakeData["campaign.duration"],
      },
      product: {
        name: intakeData["product.name"],
        price: productPrice,
        category: intakeData["product.category"],
        deliveryMethod: intakeData["product.deliveryMethod"],
      },
      audience: {
        sophisticationLevel: intakeData["audience.sophisticationLevel"],
        awarenessLevel: intakeData["audience.awarenessLevel"],
        geography: intakeData["audience.geography"],
      },
      offerSummary: offerAnalysis ? {
        offerName: (offerAnalysis as any)?.offerName,
        corePromise: (offerAnalysis as any)?.corePromise,
        launchReadinessScore: (offerAnalysis as any)?.launchReadinessScore,
        verdict: (offerAnalysis as any)?.verdict,
      } : null,
      financialSummary: financialProjection ? {
        projectedRevenueBrl: (financialProjection as any)?.projectedRevenueBrl,
        projectedROAS: (financialProjection as any)?.projectedROAS,
        breakEvenBudget: (financialProjection as any)?.breakEvenBudget,
      } : null,
      strategy: {
        keyMessages: (strategy as any)?.keyMessages ?? [],
        primaryChannel: (strategy as any)?.primaryChannel,
        urgencyType: (strategy as any)?.urgencyType,
      },
    },
    null,
    2,
  );

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "media_buyer",
    systemPrompt: TRAFFIC_INTELLIGENCE_PROMPT,
    memoryContext,
    thinkingMessages: [
      "Executando pré-validação — 11 checkpoints antes de qualquer publicação...",
      "Estruturando campanha por plataforma (Meta, TikTok, Google, YouTube)...",
      "Definindo públicos autorizados — prospecting, lookalike e remarketing...",
      "Calculando budget por fase com reserva de contingência...",
      "Desenhando plano de testes A/B com critérios de significância estatística...",
      "Estabelecendo benchmarks de CPM, CTR, CPC, CPA e ROAS para este nicho...",
      "Definindo critérios de pausa (hard rules) e critérios de escala...",
      "Mapeando janela de aprendizado e riscos operacionais...",
      "Construindo plano de contingência e protocolo de otimização...",
    ],
    messages: [
      {
        role: "user",
        content: `Execute o planejamento completo de tráfego pago para esta campanha.
Percorra as 11 etapas na sequência. Seja técnico, conservador e auditável.

**Dados da campanha:**
\`\`\`json
${contextJson}
\`\`\`

Regras absolutas:
- Pré-validação: qualquer item "blocked" → overallClearance = "blocked"
- Toda escala de budget: requer critério comprovado, nunca achismo
- Segmentação: apenas dados permitidos pelas políticas das plataformas
- Nenhuma campanha sobe sem aprovação humana explícita
- Benchmarks: realistas para o nicho e ticket — sem wishful thinking
- Critérios de pausa: pelo menos 6 situações distintas
- Critérios de escala: pelo menos 4, todos devem ser atingidos simultaneamente
- Contingências: pelo menos 5 cenários com fallback definido

Retorne APENAS o JSON válido.`,
      },
    ],
    log,
    requiresApproval: true,
    checkpointType: "ad_set_approval",
  });

  const parsed = parseAgentJSON<TrafficIntelligenceOutput>(result.content, defaultOutput());
  const output: TrafficIntelligenceOutput = { ...defaultOutput(), ...parsed };

  // Ensure nested objects are intact
  if (!output.prePublishValidation?.overallClearance) {
    output.prePublishValidation = defaultOutput().prePublishValidation;
  }
  if (!output.campaignStructure?.objective) {
    output.campaignStructure = defaultOutput().campaignStructure;
  }
  if (!output.audiences?.exclusions) {
    output.audiences = defaultOutput().audiences;
  }
  if (!output.budgetPlan?.phases) {
    output.budgetPlan = defaultOutput().budgetPlan;
  }
  if (!output.learningWindow?.minimumConversions) {
    output.learningWindow = defaultOutput().learningWindow;
  }
  if (!Array.isArray(output.pauseCriteria)) output.pauseCriteria = [];
  if (!Array.isArray(output.scaleCriteria)) output.scaleCriteria = [];
  if (!Array.isArray(output.operationalRisks)) output.operationalRisks = [];
  if (!Array.isArray(output.contingencyPlan)) output.contingencyPlan = [];

  // Sync readiness with score
  const score = output.campaignReadinessScore ?? 0;
  if (score >= 80) output.campaignReadiness = "ready";
  else if (score >= 60) output.campaignReadiness = "needs_review";
  else output.campaignReadiness = "not_ready";

  // Clamp
  output.confidenceScore = Math.min(1, Math.max(0, output.confidenceScore ?? 0));
  output.campaignReadinessScore = Math.min(100, Math.max(0, output.campaignReadinessScore ?? 0));

  log.info(
    {
      campaignId,
      overallClearance: output.prePublishValidation.overallClearance,
      blockers: output.prePublishValidation.blockers.length,
      platforms: output.campaignStructure.platforms.map((p) => p.platform),
      totalBudgetBrl: output.campaignStructure.totalBudgetBrl,
      pauseCriteriaCount: output.pauseCriteria.length,
      scaleCriteriaCount: output.scaleCriteria.length,
      operationalRisksCount: output.operationalRisks.length,
      campaignReadinessScore: output.campaignReadinessScore,
      campaignReadiness: output.campaignReadiness,
      confidenceScore: output.confidenceScore,
    },
    "Traffic Intelligence Agent completed",
  );

  return output;
}
