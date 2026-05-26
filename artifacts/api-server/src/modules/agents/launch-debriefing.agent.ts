/**
 * Launch Debriefing Agent
 * Post-launch analysis: what worked, what didn't, why, and what to do next.
 * Transforms raw launch data into institutional knowledge for future campaigns.
 * Provider: Gemini (analytics, pattern recognition, data synthesis)
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";
import { COGNITIVE_IDENTITY_LAUNCH_DEBRIEFING } from "./cognitive-identity-system.js";

export interface LaunchLearning {
  category: "funnel" | "copy" | "traffic" | "offer" | "timing" | "audience" | "ops";
  finding: string;           // what we discovered
  evidence: string;          // the data that proves it
  impact: "positive" | "negative" | "neutral";
  magnitude: "low" | "medium" | "high" | "game_changer";
  actionForNext: string;     // what to do differently next launch
  priorityForNext: number;   // 1-5 (5 = must implement)
}

export interface LaunchDebriefOutput {
  launchName: string;
  launchDates: string;
  result: {
    totalRevenue: number;
    salesCount: number;
    conversionRate: number;
    totalLeads: number;
    roas: number;
    vsGoal: string;          // "127% of goal", "43% of goal", etc.
  };
  executiveSummary: string;  // 3-paragraph honest assessment
  winnerAnalysis: {
    topPerformer: string;    // what worked best (specific)
    scalableInsight: string; // the insight that can be systematized
  };
  failureAnalysis: {
    biggestMiss: string;     // what failed most (specific, no sugarcoating)
    rootCause: string;       // WHY it failed (not just what)
    avoidableQuestion: string; // "Could this have been prevented? How?"
  };
  learnings: LaunchLearning[];
  nextLaunchPlan: {
    keepExactly: string[];   // what to replicate exactly
    changeFirst: string[];   // highest priority changes
    testHypothesis: string[]; // A/B tests to run next time
    revenueOpportunity: string; // the biggest untapped opportunity
  };
  benchmarkComparison: string; // how this compares to market standards
  teamFeedback: string;      // what the team experienced (operational lessons)
  institutionalMemory: string; // the single most important insight to never forget
}

const LAUNCH_DEBRIEFING_PROMPT = `Você é o Agente Launch Debriefing do NexOS AI — especialista em análise pós-lançamento e transformação de dados em aprendizados institucionais.

Sua filosofia: o lançamento mais valioso é o que foi completamente analisado depois. Sem debriefing, cada lançamento começa do zero. Com debriefing, cada lançamento começa mais inteligente do que o último.

## FRAMEWORK DE ANÁLISE PÓS-LANÇAMENTO

### ETAPA 1 — VERDADE DOS NÚMEROS
Antes de qualquer análise qualitativa, os números contam a história objetiva:
- Comparar resultado vs meta (% de atingimento)
- ROAS global (receita / investimento total em tráfego)
- Taxa de conversão da lista (vendas / leads total)
- Taxa de conversão de anúncio (leads / alcance)
- Ticket médio (se havia múltiplas opções)
- Custo por lead e custo por venda

### ETAPA 2 — ANATOMIA DO FUNIL
Onde as pessoas saíram? Em que etapa houve maior vazamento?
- Anúncio → captura: CTR e custo por lead
- Captura → presença (webinar/CPL): taxa de comparecimento
- Presença → página de vendas: taxa de clique
- Página → checkout: taxa de abertura de checkout
- Checkout → venda: taxa de compra
- Venda → entrega: reembolsos e cancelamentos

Cada vazamento tem uma causa diagnosticável.

### ETAPA 3 — O VEREDICTO HONESTO
Dois erros comuns no debriefing:
1. **Celebration bias**: quando o resultado foi bom, atribuímos ao que fizemos. Pode ser apenas mercado favorável.
2. **Blame bias**: quando foi mal, buscamos culpados. A causa real geralmente é sistêmica.

O bom debriefing separa: o que controlamos × o que não controlamos × o que podemos aprender independente do resultado.

### ETAPA 4 — APRENDIZADOS INSTITUCIONALIZÁVEIS
Um aprendizado só é valioso se for documentado de forma que outra pessoa (ou o mesmo criador 12 meses depois) possa aplicar sem precisar reaprender.

Formato: "Quando [contexto específico], [ação específica] produz [resultado], porque [mecanismo]."

**Retorne APENAS JSON válido.**

\`\`\`json
{
  "launchName": "string",
  "launchDates": "string",
  "result": {
    "totalRevenue": 0,
    "salesCount": 0,
    "conversionRate": 0.0,
    "totalLeads": 0,
    "roas": 0.0,
    "vsGoal": "string — % do objetivo atingido"
  },
  "executiveSummary": "string — 3 parágrafos: o que foi, o que funcionou, o que não funcionou",
  "winnerAnalysis": {
    "topPerformer": "string — o que funcionou melhor (específico, com dado)",
    "scalableInsight": "string — o insight que pode ser sistematizado"
  },
  "failureAnalysis": {
    "biggestMiss": "string — o que falhou mais (específico, sem suavizar)",
    "rootCause": "string — POR QUE falhou (não apenas o que)",
    "avoidableQuestion": "string — poderia ter sido evitado? Como?"
  },
  "learnings": [
    {
      "category": "funnel|copy|traffic|offer|timing|audience|ops",
      "finding": "string — o que descobrimos",
      "evidence": "string — dado que prova",
      "impact": "positive|negative|neutral",
      "magnitude": "low|medium|high|game_changer",
      "actionForNext": "string — o que fazer diferente",
      "priorityForNext": 5
    }
  ],
  "nextLaunchPlan": {
    "keepExactly": ["string — o que replicar exatamente"],
    "changeFirst": ["string — prioridade máxima de mudança"],
    "testHypothesis": ["string — hipótese de A/B test para o próximo"],
    "revenueOpportunity": "string — maior oportunidade não explorada"
  },
  "benchmarkComparison": "string — como compara com padrões do mercado (médias de taxa de conv, ROAS, etc.)",
  "teamFeedback": "string — lições operacionais do processo",
  "institutionalMemory": "string — o insight mais importante que nunca deve ser esquecido"
}
\`\`\``;

export async function runLaunchDebriefingAgent(
  campaignId: string | null,
  workspaceId: string,
  launchData: {
    name: string;
    dates: string;
    revenue: number;
    sales: number;
    leads: number;
    adSpend: number;
    goal: number;
    platformMetrics?: Record<string, unknown>;
  },
  log: Logger,
): Promise<LaunchDebriefOutput> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "launch_debriefing",
    systemPrompt: COGNITIVE_IDENTITY_LAUNCH_DEBRIEFING + LAUNCH_DEBRIEFING_PROMPT,
    messages: [
      {
        role: "user",
        content: `Faça o debriefing completo e honesto deste lançamento.

**Nome:** ${launchData.name}
**Período:** ${launchData.dates}
**Meta:** R$${launchData.goal.toLocaleString("pt-BR")}
**Receita real:** R$${launchData.revenue.toLocaleString("pt-BR")} (${Math.round((launchData.revenue / launchData.goal) * 100)}% da meta)
**Vendas:** ${launchData.sales}
**Leads capturados:** ${launchData.leads}
**Investimento em tráfego:** R$${launchData.adSpend.toLocaleString("pt-BR")}
**ROAS calculado:** ${(launchData.revenue / launchData.adSpend).toFixed(2)}x
**Dados adicionais:** ${launchData.platformMetrics ? JSON.stringify(launchData.platformMetrics, null, 2) : "não fornecido"}

**PROCESSO:**
1. Analise a anatomia completa do funil com os dados disponíveis
2. Identifique o maior sucesso e o maior fracasso (com causa raiz)
3. Gere aprendizados institucionalizáveis (pelo menos 6)
4. Crie o plano de ação para o próximo lançamento
5. Compare com benchmarks do mercado brasileiro

Seja brutalmente honesto — um debriefing suavizado é inútil.
Retorne APENAS JSON.`,
      },
    ],
    log,
    thinkingMessages: [
      "Analisando números absolutos e % de meta...",
      "Mapeando anatomia do funil e pontos de vazamento...",
      "Identificando maiores sucessos e fracassos...",
      "Gerando aprendizados institucionalizáveis...",
      "Comparando com benchmarks do mercado...",
    ],
  });

  return parseAgentJSON<LaunchDebriefOutput>(result.content, {
    launchName: launchData.name,
    launchDates: launchData.dates,
    result: {
      totalRevenue: launchData.revenue,
      salesCount: launchData.sales,
      conversionRate: launchData.leads > 0 ? launchData.sales / launchData.leads : 0,
      totalLeads: launchData.leads,
      roas: launchData.adSpend > 0 ? launchData.revenue / launchData.adSpend : 0,
      vsGoal: `${Math.round((launchData.revenue / launchData.goal) * 100)}% da meta`,
    },
    executiveSummary: "",
    winnerAnalysis: { topPerformer: "", scalableInsight: "" },
    failureAnalysis: { biggestMiss: "", rootCause: "", avoidableQuestion: "" },
    learnings: [],
    nextLaunchPlan: { keepExactly: [], changeFirst: [], testHypothesis: [], revenueOpportunity: "" },
    benchmarkComparison: "",
    teamFeedback: "",
    institutionalMemory: "",
  });
}
