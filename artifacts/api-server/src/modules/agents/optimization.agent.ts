import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";

export interface OptimizationRecommendation {
  priority: "critical" | "high" | "medium" | "low";
  category: string;
  area: string;
  currentState: string;
  problem: string;
  recommendation: string;
  expectedImpact: string;
  implementationSteps: string[];
  estimatedTimeToImpact: string;
  effort: "low" | "medium" | "high";
}

export interface OptimizationOutput {
  campaignTitle: string;
  analysisDate: string;
  overallHealthScore: number;
  healthTrend: "improving" | "stable" | "declining" | "critical";
  executiveSummary: string;
  criticalAlerts: string[];
  recommendations: OptimizationRecommendation[];
  funnelAnalysis: {
    stage: string;
    currentMetric: string;
    benchmark: string;
    gap: string;
    bottleneck: boolean;
    action: string;
  }[];
  budgetReallocation: {
    from: string;
    to: string;
    amount: number;
    reason: string;
  }[];
  creativeRotation: {
    pause: string[];
    scale: string[];
    test: string[];
  };
  projectedImpact: {
    currentRevenue: number;
    projectedRevenue: number;
    upliftPercentage: number;
    confidence: "low" | "medium" | "high";
  };
  nextReviewDate: string;
  optimizationNotes: string;
}

const OPTIMIZATION_PROMPT = `Você é o Agente de Otimização da NexOS AI — especialista em análise de performance e otimização de campanhas em execução.

Você recebe métricas reais de uma campanha em andamento e entrega um plano de ação preciso para maximizar resultados.

## SEU FRAMEWORK DE ANÁLISE

**1. Diagnóstico de funil:**
Cada etapa tem um benchmark. Se está abaixo do benchmark, é um gargalo.
- CTR de anúncio: benchmark 1.5-3% (bom), 3%+ (excelente)
- Taxa de opt-in: 30-45% (boa), 45%+ (excelente)  
- Comparecimento ao webinar: 40-55% (bom)
- Taxa de conversão página de vendas: 1-3% (boa), 3%+ (excelente)
- Taxa de recuperação de carrinho: 15-25% (boa)

**2. Onde está o dinheiro sendo desperdiçado:**
- Anúncios com CTR < 0.8%: criativo ruim → pausar
- Públicos com CPL > 3x benchmark: público ruim → pausar
- Horários de baixa performance → lances menores
- Dispositivos com CPA alto → excluir

**3. O que está funcionando e pode ser escalado:**
- Anúncio com CPL < meta por 3+ dias → duplicar conjunto
- Público com ROAS > 4x → aumentar budget 20-30%
- Horário de pico de conversão → concentrar budget

**4. Otimizações rápidas (alto impacto, baixo esforço):**
- Mudança de headline do e-mail (impacto em horas)
- Reordenação de seções da página (impacto em dias)
- Ajuste de CTA de anúncio (impacto em 24-48h)
- Renegociação de lance no Google (impacto imediato)

**Retorne APENAS JSON válido** no formato abaixo.

\`\`\`json
{
  "campaignTitle": "string",
  "analysisDate": "string",
  "overallHealthScore": 0,
  "healthTrend": "improving|stable|declining|critical",
  "executiveSummary": "string — resumo executivo em 3-4 frases do estado da campanha",
  "criticalAlerts": ["string — alertas que exigem ação imediata"],
  "recommendations": [
    {
      "priority": "critical|high|medium|low",
      "category": "string — ex: paid_traffic, email, conversion, copy",
      "area": "string — área específica",
      "currentState": "string — o que os dados mostram agora",
      "problem": "string — qual é o problema identificado",
      "recommendation": "string — o que fazer especificamente",
      "expectedImpact": "string — impacto esperado com número estimado",
      "implementationSteps": ["string — passo a passo"],
      "estimatedTimeToImpact": "string",
      "effort": "low|medium|high"
    }
  ],
  "funnelAnalysis": [
    {
      "stage": "string — etapa do funil",
      "currentMetric": "string — métrica atual com valor",
      "benchmark": "string — referência do mercado",
      "gap": "string — diferença",
      "bottleneck": false,
      "action": "string — ação recomendada"
    }
  ],
  "budgetReallocation": [
    {
      "from": "string — de onde tirar budget",
      "to": "string — para onde mover",
      "amount": 0,
      "reason": "string"
    }
  ],
  "creativeRotation": {
    "pause": ["string — criativos a pausar e por quê"],
    "scale": ["string — criativos a escalar e por quê"],
    "test": ["string — novos criativos a testar"]
  },
  "projectedImpact": {
    "currentRevenue": 0,
    "projectedRevenue": 0,
    "upliftPercentage": 0,
    "confidence": "low|medium|high"
  },
  "nextReviewDate": "string",
  "optimizationNotes": "string — contexto adicional e próximos passos"
}
\`\`\``;

export async function runOptimizationAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  currentMetrics: Record<string, unknown>,
  log: Logger,
): Promise<OptimizationOutput> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "optimization",
    systemPrompt: OPTIMIZATION_PROMPT,
    messages: [
      {
        role: "user",
        content: `Analise a performance atual da campanha e entregue o plano de otimização.

**Produto:** ${String(intakeData["product.name"] ?? "")} — R$${String(intakeData["product.price"] ?? "")}
**Meta de faturamento:** R$${String(intakeData["campaign.revenueTarget"] ?? 0)}
**Budget total:** R$${String(intakeData["campaign.budget.total"] ?? 0)}

**Métricas atuais da campanha:**
\`\`\`json
${JSON.stringify(currentMetrics, null, 2)}
\`\`\`

**ANÁLISE NECESSÁRIA:**
1. Onde está o maior gargalo no funil?
2. Quais públicos/criativos pausar imediatamente?
3. O que está funcionando e pode ser escalado?
4. Qual realocação de budget geraria mais impacto?
5. Quais otimizações têm resultado em menos de 48h?

Priorize ações por impacto e urgência. Retorne APENAS o JSON.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: [
      "Analisando métricas de performance do funil completo...",
      "Identificando gargalos e pontos de vazamento...",
      "Comparando com benchmarks do mercado...",
      "Identificando o que pausar e o que escalar...",
      "Calculando realocação ótima de budget...",
      "Gerando plano de ação priorizado por impacto...",
    ],
  });

  return parseAgentJSON<OptimizationOutput>(result.content, {
    campaignTitle: String(intakeData["product.name"] ?? ""),
    analysisDate: new Date().toISOString(),
    overallHealthScore: 0,
    healthTrend: "stable",
    executiveSummary: "",
    criticalAlerts: [],
    recommendations: [],
    funnelAnalysis: [],
    budgetReallocation: [],
    creativeRotation: { pause: [], scale: [], test: [] },
    projectedImpact: { currentRevenue: 0, projectedRevenue: 0, upliftPercentage: 0, confidence: "low" },
    nextReviewDate: "",
    optimizationNotes: result.content,
  });
}
