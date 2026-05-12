/**
 * Market Intelligence Agent
 * Deep competitor and market analysis: reverse-engineers competitor strategies,
 * identifies positioning gaps, and surfaces untapped opportunities.
 * Provider: Claude (reasoning, synthesis, strategic analysis)
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";

export interface CompetitorProfile {
  name: string;
  estimatedRevenue: string;    // "R$1M-5M/lançamento" — estimate
  marketShare: "dominant" | "major" | "significant" | "minor" | "niche";
  positioningAngle: string;    // their core positioning
  strengthsPerceived: string[]; // what their audience says they do well
  weaknessesExposed: string[]; // what their audience complains about
  pricingStrategy: string;
  trafficSources: string[];
  contentStrategy: string;
  biggestVulnerability: string; // the ONE thing you can attack
  reverseEngineeredStrategy: string; // what they're actually doing vs what they say
}

export interface MarketIntelOutput {
  market: string;
  analysisDate: string;
  marketSize: string;          // estimated BRL value of the market
  marketMaturity: "emerging" | "growing" | "mature" | "saturated" | "declining";
  totalAdressableAudience: string;
  competitors: CompetitorProfile[];
  positioningGaps: {
    gap: string;               // unoccupied position in the market
    opportunity: string;       // why this is a winning position
    entryBarrier: string;      // what makes it hard (and how to overcome)
    estimatedTAM: string;      // addressable audience for this gap
  }[];
  winningStrategyVsField: string;    // how to beat the field given this competitive landscape
  untappedSegments: string[];        // audience segments no one is targeting well
  keywordBattlefield: string;        // which terms are contested vs open
  contentArbitrage: string;          // content types competitors ignore that convert
  pricingArbitrage: string;          // pricing positions left unoccupied
  platformArbitrage: string;         // platforms competitors aren't using effectively
  entryRecommendation: string;       // the fastest path to a defensible position
  firstMoverActions: string[];       // what to do NOW before competitors catch on
}

const MARKET_INTEL_PROMPT = `Você é o Agente Market Intelligence do NexOS AI — o maior especialista em inteligência competitiva do mercado digital brasileiro.

Você pensa como um general estudando o campo de batalha antes de atacar. Você não lista concorrentes — você desmonta estratégias, encontra vulnerabilidades e identifica o ângulo de ataque que os outros não viram.

## FRAMEWORK DE INTELIGÊNCIA COMPETITIVA

### ETAPA 1 — MAPEAMENTO DO CAMPO
Não basta listar quem está no mercado. Você precisa entender:
- Quem domina a narrativa (quem "é dono" de um ângulo na cabeça da audiência)
- Quem compete no preço vs quem compete em posicionamento
- Quem tem mais audiência orgânica vs quem depende de tráfego pago
- Quem tem a lista mais engajada (indicador de lealdade real vs alcance)

### ETAPA 2 — ENGENHARIA REVERSA
A estratégia real de um concorrente não é o que ele diz — é o que ele faz:
- O que ele posta vs o que ele faz pagar
- Que anúncios roda (transparência do Meta Ads Library)
- Que afiliados usa e como os trata
- O que a audiência dele reclama nas avaliações e comentários

A vulnerabilidade está sempre entre o que ele promete e o que entrega.

### ETAPA 3 — MAPEAMENTO DE GAPS
Um gap de posicionamento é um ângulo que a audiência precisa mas nenhum player entrega bem:
- "Aprendi com todos eles mas nenhum resolve [problema específico]"
- "Eu queria algo mais [específico/simples/avançado/acessível]"
- "Por que ninguém fala sobre [aspecto ignorado]?"

Gaps de posicionamento geram categoia própria. Você para de competir.

### ETAPA 4 — OPORTUNIDADES DE ARBITRAGEM
Três tipos de arbitragem estratégica:
1. **Conteúdo**: formatos que seus concorrentes ignoram mas a audiência quer
2. **Plataforma**: canais onde a audiência está mas o mercado não foi (TikTok em nichos de +35, YouTube Shorts em nichos técnicos)
3. **Preço**: posições de preço não ocupadas (ultra-premium sem concorrência real, ou entrada acessível em mercado médio-alto)

**Retorne APENAS JSON válido.**

\`\`\`json
{
  "market": "string — o mercado específico analisado",
  "analysisDate": "string",
  "marketSize": "string — estimativa do valor de mercado em BRL/ano",
  "marketMaturity": "emerging|growing|mature|saturated|declining",
  "totalAdressableAudience": "string — estimativa de audiência total",
  "competitors": [
    {
      "name": "string",
      "estimatedRevenue": "string",
      "marketShare": "dominant|major|significant|minor|niche",
      "positioningAngle": "string — o ângulo central deles",
      "strengthsPerceived": ["string"],
      "weaknessesExposed": ["string — o que a audiência deles reclama"],
      "pricingStrategy": "string",
      "trafficSources": ["string"],
      "contentStrategy": "string",
      "biggestVulnerability": "string — a fraqueza explorável",
      "reverseEngineeredStrategy": "string — o que fazem vs o que dizem"
    }
  ],
  "positioningGaps": [
    {
      "gap": "string — posição não ocupada no mercado",
      "opportunity": "string — por que é uma posição vencedora",
      "entryBarrier": "string — o que dificulta (e como superar)",
      "estimatedTAM": "string"
    }
  ],
  "winningStrategyVsField": "string — como vencer dado este landscape específico",
  "untappedSegments": ["string — audiência não atendida bem"],
  "keywordBattlefield": "string — termos disputados vs abertos",
  "contentArbitrage": "string — formatos que concorrentes ignoram mas convertem",
  "pricingArbitrage": "string — posições de preço não ocupadas",
  "platformArbitrage": "string — plataformas não exploradas pelo mercado",
  "entryRecommendation": "string — o caminho mais rápido para uma posição defensável",
  "firstMoverActions": ["string — o que fazer AGORA antes dos concorrentes percebam"]
}
\`\`\``;

export async function runMarketIntelAgent(
  campaignId: string | null,
  workspaceId: string,
  marketDescription: string,
  productCategory: string,
  knownCompetitors: string[],
  currentPositioning: string,
  log: Logger,
): Promise<MarketIntelOutput> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "market_intel",
    systemPrompt: MARKET_INTEL_PROMPT,
    messages: [
      {
        role: "user",
        content: `Faça a análise completa de inteligência de mercado.

**Mercado:** ${marketDescription}
**Categoria:** ${productCategory}
**Concorrentes conhecidos:** ${knownCompetitors.join(", ") || "não especificados"}
**Posicionamento atual:** ${currentPositioning}

**PROCESSO:**
1. Mapeie os players principais e suas estratégias reais (não o que dizem, o que fazem)
2. Para cada concorrente, identifique a vulnerabilidade explorável
3. Mapeie gaps de posicionamento não ocupados
4. Identifique oportunidades de arbitragem (conteúdo, plataforma, preço)
5. Defina a estratégia de entrada com maior probabilidade de posição defensável

Seja específico sobre o mercado brasileiro — benchmarks, plataformas e dinâmicas locais.
Retorne APENAS JSON.`,
      },
    ],
    log,
    thinkingMessages: [
      "Mapeando players e estratégias do mercado...",
      "Fazendo engenharia reversa por concorrente...",
      "Identificando gaps de posicionamento...",
      "Encontrando oportunidades de arbitragem...",
      "Definindo estratégia de entrada mais defensável...",
    ],
  });

  return parseAgentJSON<MarketIntelOutput>(result.content, {
    market: marketDescription,
    analysisDate: new Date().toISOString(),
    marketSize: "",
    marketMaturity: "growing",
    totalAdressableAudience: "",
    competitors: [],
    positioningGaps: [],
    winningStrategyVsField: "",
    untappedSegments: [],
    keywordBattlefield: "",
    contentArbitrage: "",
    pricingArbitrage: "",
    platformArbitrage: "",
    entryRecommendation: "",
    firstMoverActions: [],
  });
}
