import { runAgent, parseAgentJSON } from "./agent.runner.js";
import { getMemoryContext, buildMemoryContextBlock } from "../memory/memory.service.js";
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
    platformDistributionStrategy?: string;
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
  triggerMap?: {
    preLaunch: { primaryTrigger: string; triggerStack: string[]; triggerLogic: string };
    cartOpen: { primaryTrigger: string; triggerStack: string[]; triggerLogic: string };
    cartClose: { primaryTrigger: string; triggerStack: string[]; triggerLogic: string };
    remarketing: { primaryTrigger: string; triggerStack: string[]; triggerLogic: string };
    dominantTrigger: string;
    dominantTriggerJustification: string;
    triggerStackSequence: string[];
    socialProofBlueprint: string;
    antiRequisiteAngles: string[];
    transformationBridge: string;
  };
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

**Pense em plataformas como canais de distribuição de narrativa:**
- Cada plataforma não é só onde "postar" — é onde um pedaço específico da narrativa vive
- Instagram: identidade + comunidade + bastidores
- Facebook: prova social + grupos de nicho + audiência madura
- TikTok: descoberta + educação rápida + alcance de novos avatares
- WhatsApp/Email: conversão + relacionamento direto
- A estratégia de conteúdo DEVE cobrir todas essas frentes — nunca só uma plataforma

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
    "contentPillars": ["string — inclua pilares específicos por plataforma: ex: 'TikTok: educação rápida sobre [tema]', 'Facebook: histórias de transformação de alunos', 'Instagram: bastidores e processo'"],
    "platformDistributionStrategy": "string — como a narrativa se distribui entre Instagram, Facebook, TikTok, WhatsApp e Email de forma sinérgica",
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
  "strategistNotes": "string — observações críticas adicionais que o criador PRECISA ouvir",
  "triggerMap": {
    "preLaunch": {
      "primaryTrigger": "autoridade|curiosidade|antecipacao|prova_social|reciprocidade|comunidade|transformacao",
      "triggerStack": ["string — gatilhos em ordem de ativação nesta fase"],
      "triggerLogic": "string — por que estes gatilhos nesta ordem para este produto/avatar"
    },
    "cartOpen": {
      "primaryTrigger": "string",
      "triggerStack": ["string"],
      "triggerLogic": "string"
    },
    "cartClose": {
      "primaryTrigger": "urgencia|medo_perda|escassez",
      "triggerStack": ["string"],
      "triggerLogic": "string"
    },
    "remarketing": {
      "primaryTrigger": "contraste|reciprocidade|curiosidade|medo_perda",
      "triggerStack": ["string"],
      "triggerLogic": "string"
    },
    "dominantTrigger": "string — o gatilho mais poderoso para este produto e avatar",
    "dominantTriggerJustification": "string — por que este é o mais poderoso dado o perfil psicográfico",
    "triggerStackSequence": ["string — sequência exata de ativação dos gatilhos do dia 1 ao fechamento"],
    "socialProofBlueprint": "string — instrução: que prova social coletar, que formato, que resultados mostrar, como torná-la irrefutável",
    "antiRequisiteAngles": ["string — ângulos mesmo-sem que quebram objeções antes de serem ditas"],
    "transformationBridge": "string — estado emocional exato do avatar antes vs depois do resultado"
  }
}
\`\`\``;

export async function runStrategyAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for signature compatibility
  track: string,
  log: Logger,
  profile?: import("./profile-builder.agent.js").ProfileBuilderOutput,
): Promise<StrategyOutput> {
  const memCtx = await getMemoryContext(workspaceId, "strategy", String(intakeData["product.category"] ?? ""));
  const memBlock = buildMemoryContextBlock(memCtx);

  const intakeJson = JSON.stringify(intakeData, null, 2);

  const profileContext = profile
    ? `
## INTELIGÊNCIA DE PERFIL (gerada pelo Profile Builder — use como base)

**Score product-market fit:** ${profile.profileScore}/100
**Avisos de validação:** ${profile.validationWarnings.join("; ") || "nenhum"}
**Insights críticos:** ${profile.criticalInsights.join("; ")}

**USP derivada pela IA:** ${profile.product.usp}
**Mecanismo único:** ${profile.positioning.uniqueMechanism}
**Big Idea da campanha:** ${profile.positioning.campaignBigIdea}
**Elevator pitch:** ${profile.positioning.elevatorPitch}

**Avatar primário — ${profile.primaryAvatar.name}:**
- Desejo mais profundo: ${profile.primaryAvatar.deepestDesire}
- Nível de consciência: ${profile.primaryAvatar.awarenessLevel}
- Sofisticação: ${profile.primaryAvatar.sophisticationLevel}
- Principais objeções: ${profile.primaryAvatar.typicalObjections.slice(0, 3).join("; ")}
- O que os faz confiar: ${profile.primaryAvatar.whatMakesThemTrust.slice(0, 2).join("; ")}
- Palavras-chave que usam: ${profile.primaryAvatar.keywordsTheyUse.slice(0, 5).join(", ")}

**Mercado:**
- Maturidade: ${profile.marketIntelligence.maturity}
- Concorrência: ${profile.marketIntelligence.competitionLevel}
- CPL médio do mercado: R$${profile.marketIntelligence.averageCPL}
- Taxa de conversão típica: ${(profile.marketIntelligence.typicalConversionRate * 100).toFixed(1)}%
- Oportunidades: ${profile.marketIntelligence.opportunities.slice(0, 3).join("; ")}
- Red flags: ${profile.marketIntelligence.redFlags.slice(0, 3).join("; ")}

**Segmentos identificados:**
${profile.segments.map((s) => `- ${s.name} [${s.priority}]: ${s.messageAngle} | CPL ~R$${s.estimatedCPL} | Conv ~${(s.estimatedConversionRate * 100).toFixed(1)}%`).join("\n")}

Use este perfil como base para aprofundar a estratégia. Não repita as mesmas informações — aprofunde, conecte e adicione dimensões que o Profile Builder não cobriu.`
    : "";

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "strategy",
    systemPrompt: memBlock + STRATEGY_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Analise os dados de intake abaixo e produza a estratégia completa da campanha.

**Track:** ${track}
${profileContext}

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
    triggerMap: undefined,
  });
}
