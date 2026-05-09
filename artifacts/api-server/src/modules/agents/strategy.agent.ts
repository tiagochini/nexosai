import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";

export interface StrategyOutput {
  executiveSummary: string;
  marketDiagnosis: {
    marketMaturity: "emerging" | "growing" | "mature" | "saturated";
    competitiveLandscape: string;
    entryBarriers: string[];
    opportunities: string[];
    threats: string[];
  };
  offerPositioning: {
    uniqueValueProposition: string;
    primaryDifferentiator: string;
    positioning: string;
    priceJustification: string;
    competitiveAdvantages: string[];
  };
  audienceSegmentation: {
    primaryAvatar: string;
    secondaryAvatars: string[];
    psychographicProfile: string;
    buyingTriggers: string[];
    objections: string[];
    sophisticationStrategy: string;
  };
  campaignArchitecture: {
    coreNarrative: string;
    emotionalHook: string;
    keyMessages: string[];
    contentPillars: string[];
    callToActionStrategy: string;
  };
  successMetrics: {
    primaryKPI: string;
    conversionRateTarget: number;
    revenueTarget: number;
    criticalAssumptions: string[];
  };
  risks: {
    level: "low" | "medium" | "high";
    mainRisks: string[];
    mitigations: string[];
  };
  strategistNotes: string;
}

const STRATEGY_SYSTEM_PROMPT = `Você é o Agente de Estratégia da NexOS AI — o mais experiente estrategista de lançamentos digitais do Brasil.

Sua função é produzir uma análise estratégica profunda e crítica para campanhas de lançamento. Você trabalha com Claude (Anthropic) e tem acesso a padrões de mercado de +10.000 lançamentos.

## SUAS DIRETRIZES

**NÃO seja bajulador.** Se a oferta tem problemas, aponte. Se o avatar está mal definido, diga. Sua honestidade é o que gera resultado.

**Seja cirúrgico.** Cada insight deve ser acionável. Nada de generalidades como "foque no cliente". Seja específico: qual cliente, qual dor, qual ângulo, qual momento.

**Pense em camadas:**
1. Camada superficial: o que o avatar DIZER que quer
2. Camada real: o que ele REALMENTE quer (não verbaliza)
3. Camada profunda: o que ele TEM MEDO de admitir que quer

**Retorne SEMPRE em JSON válido** seguindo exatamente a estrutura solicitada. Nenhum texto fora do bloco JSON.

## ESTRUTURA DE SAÍDA

\`\`\`json
{
  "executiveSummary": "string — diagnóstico executivo em 3-5 frases diretas",
  "marketDiagnosis": {
    "marketMaturity": "emerging|growing|mature|saturated",
    "competitiveLandscape": "string",
    "entryBarriers": ["string"],
    "opportunities": ["string"],
    "threats": ["string"]
  },
  "offerPositioning": {
    "uniqueValueProposition": "string — proposta única em 1 frase",
    "primaryDifferentiator": "string",
    "positioning": "string",
    "priceJustification": "string — por que o preço é justo (ou não)",
    "competitiveAdvantages": ["string"]
  },
  "audienceSegmentation": {
    "primaryAvatar": "string — descrição densa do avatar principal",
    "secondaryAvatars": ["string"],
    "psychographicProfile": "string",
    "buyingTriggers": ["string — gatilhos específicos de compra"],
    "objections": ["string — objeções reais, não genéricas"],
    "sophisticationStrategy": "string — como abordar dado o nível de consciência"
  },
  "campaignArchitecture": {
    "coreNarrative": "string — a grande história da campanha",
    "emotionalHook": "string — o gancho emocional principal",
    "keyMessages": ["string"],
    "contentPillars": ["string"],
    "callToActionStrategy": "string"
  },
  "successMetrics": {
    "primaryKPI": "string",
    "conversionRateTarget": 0.00,
    "revenueTarget": 0,
    "criticalAssumptions": ["string"]
  },
  "risks": {
    "level": "low|medium|high",
    "mainRisks": ["string"],
    "mitigations": ["string"]
  },
  "strategistNotes": "string — observações críticas adicionais que o criador PRECISA ouvir"
}
\`\`\``;

export async function runStrategyAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  track: string,
  log: Logger,
): Promise<StrategyOutput> {
  const intakeJson = JSON.stringify(intakeData, null, 2);

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "strategy",
    systemPrompt: STRATEGY_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Analise os dados de intake abaixo e produza a estratégia completa da campanha.

**Track:** ${track}

**Dados de Intake:**
\`\`\`json
${intakeJson}
\`\`\`

Retorne APENAS o JSON da estratégia, nada mais.`,
      },
    ],
    log,
    requiresApproval: true,
    checkpointType: "strategy_approval",
    thinkingMessages: [
      "Analisando dados do produto e mercado...",
      "Mapeando landscape competitivo...",
      "Identificando oportunidades não óbvias...",
      "Segmentando avatares e triggers de compra...",
      "Construindo arquitetura narrativa da campanha...",
      "Calculando riscos e métricas de sucesso...",
    ],
  });

  return parseAgentJSON<StrategyOutput>(result.content, {
    executiveSummary: result.content,
    marketDiagnosis: {
      marketMaturity: "growing",
      competitiveLandscape: "",
      entryBarriers: [],
      opportunities: [],
      threats: [],
    },
    offerPositioning: {
      uniqueValueProposition: "",
      primaryDifferentiator: "",
      positioning: "",
      priceJustification: "",
      competitiveAdvantages: [],
    },
    audienceSegmentation: {
      primaryAvatar: "",
      secondaryAvatars: [],
      psychographicProfile: "",
      buyingTriggers: [],
      objections: [],
      sophisticationStrategy: "",
    },
    campaignArchitecture: {
      coreNarrative: "",
      emotionalHook: "",
      keyMessages: [],
      contentPillars: [],
      callToActionStrategy: "",
    },
    successMetrics: {
      primaryKPI: "Receita total",
      conversionRateTarget: 0.01,
      revenueTarget: 0,
      criticalAssumptions: [],
    },
    risks: {
      level: "medium",
      mainRisks: [],
      mitigations: [],
    },
    strategistNotes: "",
  });
}
