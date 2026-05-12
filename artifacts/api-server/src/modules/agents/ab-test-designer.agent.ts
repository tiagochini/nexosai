/**
 * A/B Test Designer Agent
 * Designs structured, statistically sound A/B tests for any campaign element.
 * Produces hypotheses, sample sizes, success metrics, and analysis frameworks.
 * Provider: Gemini (analytics, systematic, data-driven)
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import { type AgentAction } from "./agent-brain.js";
import type { Logger } from "pino";

export interface ABTest {
  testId: string;
  element: string;             // what is being tested
  hypothesis: string;          // "If we change X, then Y will happen, because Z"
  variant_a: {
    description: string;
    rationale: string;         // why this is the control
  };
  variant_b: {
    description: string;
    rationale: string;         // why this is the challenger
    expectedUplift: string;    // "15-25% improvement in CTR"
  };
  successMetric: string;       // primary metric to declare a winner
  secondaryMetrics: string[];  // metrics to watch but not the decision criterion
  minimumSampleSize: number;   // per variant
  minimumDurationDays: number;
  statisticalSignificance: number; // target confidence level (usually 95%)
  stopConditions: string[];    // when to kill the test early
  analysisMethod: string;      // how to analyze results
  priority: "critical" | "high" | "medium" | "low";
  estimatedImpact: string;     // revenue/conversion impact if winner
  implementationEase: "easy" | "medium" | "hard";
}

export interface ABTestDesignerOutput {
  campaign: string;
  testingStrategy: string;     // overall philosophy for this campaign
  maxConcurrentTests: number;  // how many to run simultaneously
  tests: ABTest[];
  prioritizedQueue: string[];  // test IDs in order of priority
  iterationCadence: string;    // how often to review and iterate
  commonMistakes: string[];    // A/B testing errors to avoid in this context
  resultInterpretation: string; // how to read results correctly (avoid false positives)
  actions: AgentAction[];
}

const AB_TEST_DESIGNER_PROMPT = `Você é o Agente A/B Test Designer do NexOS AI — especialista em design de experimentos para campanhas de lançamento.

Você não faz A/B tests aleatórios. Cada teste que você projeta tem uma hipótese clara, tamanho de amostra calculado, métrica de sucesso definida e critério de parada. Você trata o marketing como ciência.

## PRINCÍPIOS DE DESIGN DE EXPERIMENTO

### 1. HIPÓTESE ANTES DE TUDO
Uma hipótese válida tem três partes:
- **Se** [mudança específica]
- **Então** [resultado específico e mensurável]
- **Porque** [mecanismo psicológico ou de negócio que explica a causalidade]

Hipótese ruim: "Vamos testar o subject line"
Hipótese boa: "Se mudarmos o subject de urgência para curiosidade, então a taxa de abertura aumentará 20%+, porque nossa audiência já está saturada de mensagens de urgência e respondem melhor a lacunas cognitivas"

### 2. MÉTRICAS CORRETAS
O erro mais comum: medir a métrica errada.
- Teste de anúncio: métrica = CPL (não CTR — CTR alto com CPL ruim = criativo clicável mas sem intenção)
- Teste de email subject: métrica = revenue per email sent (não apenas open rate)
- Teste de landing page: métrica = conversion rate (não tempo na página)
- Teste de oferta: métrica = LTV D30 (não conversão imediata)

### 3. TAMANHO DE AMOSTRA (critério para não ser enganado)
Para uma mudança de 20% ser detectável com 95% de confiança:
- Baseline conversion 1%: precisa de ~10.000 por variante
- Baseline conversion 3%: precisa de ~3.500 por variante
- Baseline conversion 10%: precisa de ~1.000 por variante

Regra prática: nunca declare vencedor com menos de 100 conversões por variante.

### 4. DURAÇÃO MÍNIMA
- Sempre rode por pelo menos 7 dias (captura ciclo semanal)
- Para anúncios: mínimo 7 dias, máximo 21 dias (audiência esgota)
- Para emails: 1 envio com amostra suficiente é definitivo

### 5. CRITÉRIOS DE PARADA ANTECIPADA
Quando parar antes do prazo:
- Variante B é 50%+ pior que A após 30% da amostra → kill
- Variante B é 50%+ melhor que A após 60% da amostra → scale early (cuidado com falsos positivos)
- Budget acabou → analisar o que tem

### 6. MÚLTIPLOS TESTES SIMULTÂNEOS
Máximo 2-3 variáveis diferentes rodando ao mesmo tempo em elementos independentes. Nunca teste duas coisas na mesma peça ao mesmo tempo.

## SOBRE AÇÕES DO SISTEMA
Para testes prioritários: emita A_B_TEST com parâmetros detalhados
Para resultados projetados de alto impacto: emita ALERT_HUMAN para acompanhamento

**Retorne APENAS JSON válido.**

\`\`\`json
{
  "campaign": "string",
  "testingStrategy": "string — filosofia geral de testes para esta campanha",
  "maxConcurrentTests": 0,
  "tests": [
    {
      "testId": "string",
      "element": "string — o que está sendo testado",
      "hypothesis": "string — Se X, então Y, porque Z",
      "variant_a": {
        "description": "string",
        "rationale": "string"
      },
      "variant_b": {
        "description": "string",
        "rationale": "string",
        "expectedUplift": "string"
      },
      "successMetric": "string — métrica principal (com benchmark)",
      "secondaryMetrics": ["string"],
      "minimumSampleSize": 0,
      "minimumDurationDays": 7,
      "statisticalSignificance": 95,
      "stopConditions": ["string"],
      "analysisMethod": "string",
      "priority": "critical|high|medium|low",
      "estimatedImpact": "string — impacto em receita/conversão",
      "implementationEase": "easy|medium|hard"
    }
  ],
  "prioritizedQueue": ["testId1", "testId2"],
  "iterationCadence": "string — com que frequência revisar e iterar",
  "commonMistakes": ["string — erros de A/B test a evitar neste contexto"],
  "resultInterpretation": "string — como ler resultados corretamente e evitar falsos positivos",
  "actions": [
    {
      "type": "A_B_TEST|ALERT_HUMAN",
      "confidence": 0.0,
      "urgency": "immediate|next_12h|next_24h|next_week",
      "rationale": "string",
      "params": { "testId": "string", "element": "string" },
      "requiresApproval": false,
      "estimatedImpact": "string"
    }
  ]
}
\`\`\``;

export async function runABTestDesignerAgent(
  campaignId: string | null,
  workspaceId: string,
  campaignDescription: string,
  currentMetrics: Record<string, unknown>,
  elementsToTest: string[],
  log: Logger,
): Promise<ABTestDesignerOutput> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "ab_test_designer",
    systemPrompt: AB_TEST_DESIGNER_PROMPT,
    messages: [
      {
        role: "user",
        content: `Projete o plano completo de A/B tests para esta campanha.

**Campanha:** ${campaignDescription}
**Métricas atuais:** ${JSON.stringify(currentMetrics, null, 2)}
**Elementos a testar:** ${elementsToTest.join(", ") || "identificar os mais impactantes"}

**PROCESSO:**
1. Identifique os 5-8 elementos com maior potencial de impacto para testar
2. Para cada teste, formule hipótese completa (Se... Então... Porque...)
3. Calcule tamanho de amostra mínimo e duração
4. Defina a métrica correta (não a mais fácil — a mais relevante)
5. Priorize os testes por impacto × facilidade de implementação

Para cada teste: descreva as variantes A e B com especificidade real.
Retorne APENAS JSON.`,
      },
    ],
    log,
    thinkingMessages: [
      "Identificando elementos com maior potencial de teste...",
      "Formulando hipóteses com mecanismos causais...",
      "Calculando tamanhos de amostra necessários...",
      "Priorizando testes por impacto × implementação...",
      "Gerando ações de sistema...",
    ],
  });

  return parseAgentJSON<ABTestDesignerOutput>(result.content, {
    campaign: campaignDescription,
    testingStrategy: "",
    maxConcurrentTests: 3,
    tests: [],
    prioritizedQueue: [],
    iterationCadence: "",
    commonMistakes: [],
    resultInterpretation: "",
    actions: [],
  });
}
