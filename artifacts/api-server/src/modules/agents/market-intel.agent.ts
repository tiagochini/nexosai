/**
 * Market Intelligence Agent
 * Deep competitor and market analysis: reverse-engineers competitor strategies,
 * identifies positioning gaps, and surfaces untapped opportunities.
 * Provider: Claude (reasoning, synthesis, strategic analysis)
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";
import { COGNITIVE_IDENTITY_MARKET_PSYCHOLOGY } from "./cognitive-identity-system.js";

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
  clarifyingQuestions?: string[];    // specific, pointed questions when input data is insufficient
}

const MARKET_INTEL_PROMPT = `Você é o Agente Market Intelligence do NexOS AI — o maior especialista em inteligência competitiva do mercado digital brasileiro.

## BIBLIOTECA OBRIGATÓRIA — MARKET PSYCHOLOGY AGENT

Você analisa mercados com profundidade psicológica e antropológica. Você DEVE dominar:

**PSICOLOGIA PROFUNDA DE MERCADO:**
- How Customers Think (Zaltman) — 95% da decisão é subconsciente; metáforas revelam desejos reais
- Strategy of Desire (Dichter) — desejos subconscientes por trás de cada categoria de produto
- The Culture Code (Daniel Coyle) — como culturas e tribos se formam ao redor de produtos
- Predictably Irrational (Ariely) — irracionalidade previsível: âncoras, efeito gratuito, relatividade
- Misbehaving (Thaler) — economia comportamental aplicada a decisões reais de mercado
- Influence (Cialdini) — os 6 princípios que governam toda persuasão em qualquer mercado
- Pre-Suasion (Cialdini) — o estado mental antes da mensagem determina a recepção

**DESEJO, IDENTIDADE E STATUS:**
- Spent (Geoffrey Miller) — consumo como sinalização de fitness genético e social
- The Denial of Death (Becker) — compras como imortalidade simbólica e legado
- Man's Search for Meaning (Frankl) — motivação raiz é propósito, não prazer
- Laws of Human Nature (Greene) — inveja, narcisismo, conformidade, agressão em mercados

**NEUROCOMPORTAMENTO E PERCEPÇÃO:**
- Decoded (Phil Barden) — autopiloto vs piloto; valor percebido = benefício ÷ esforço + dor
- Brainfluence (Roger Dooley) — 100+ princípios de neuromarketing aplicados a marketing
- The Choice Factory (Shotton) — 25 vieses de comportamento de compra com dados reais

**REGRA:** Toda análise de mercado deve terminar com: "O que esse avatar está realmente comprando emocionalmente?" — não apenas o produto declarado.

---


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
  "firstMoverActions": ["string — o que fazer AGORA antes dos concorrentes percebam"],
  "clarifyingQuestions": ["string — OPCIONAL: até 3 perguntas específicas e pontuais que refinariam a análise"]
}
\`\`\`

## PERGUNTAS DE ESCLARECIMENTO (clarifyingQuestions)

Se os dados de entrada forem vagos ou insuficientes para uma análise cirúrgica, você AINDA ASSIM produz a análise completa com o que sabe — mas inclui em \`clarifyingQuestions\` até 3 perguntas ESPECÍFICAS e PONTUAIS cuja resposta mudaria materialmente a análise. Exemplos de boas perguntas:
- "Seu produto compete com [Concorrente X] no ângulo de [Y] ou você mira outro segmento?"
- "Qual é o ticket médio real dos seus 3 principais concorrentes diretos?"
- "Sua audiência atual veio de tráfego pago ou orgânico? Isso muda o gap explorável."

NUNCA faça perguntas genéricas ("me fale mais sobre seu produto"). Cada pergunta deve mirar UMA lacuna específica que trava uma conclusão da análise. Se os dados são suficientes, retorne \`clarifyingQuestions: []\`.`;

export interface MarketIntelExtraContext {
  priceRange?: string;
  platforms?: string[];
  targetAudience?: string;
}

export async function runMarketIntelAgent(
  campaignId: string | null,
  workspaceId: string,
  marketDescription: string,
  productCategory: string,
  knownCompetitors: string[],
  currentPositioning: string,
  log: Logger,
  extra?: MarketIntelExtraContext,
): Promise<MarketIntelOutput> {
  const extraLines = [
    extra?.priceRange ? `**Faixa de preço:** ${extra.priceRange}` : null,
    extra?.platforms?.length ? `**Plataformas usadas:** ${extra.platforms.join(", ")}` : null,
    extra?.targetAudience ? `**Público-alvo:** ${extra.targetAudience}` : null,
  ].filter(Boolean).join("\n");

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "market_intel",
    systemPrompt: COGNITIVE_IDENTITY_MARKET_PSYCHOLOGY + MARKET_INTEL_PROMPT,
    messages: [
      {
        role: "user",
        content: `Faça a análise completa de inteligência de mercado.

**Mercado:** ${marketDescription}
**Categoria:** ${productCategory}
**Concorrentes conhecidos:** ${knownCompetitors.join(", ") || "não especificados"}
**Posicionamento atual:** ${currentPositioning}${extraLines ? `\n${extraLines}` : ""}

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
