/**
 * NEXOS Strategic Doctrine Engine (Tópico 3)
 *
 * ARQUITETURA SOBERANA: FÓRMULA DE LANÇAMENTO / PLF
 * Toda doutrina estratégica existe para servir às etapas do lançamento.
 * Nenhuma literatura cria estrutura paralela ao PLF.
 *
 * Você é o NEXOS Strategic Doctrine Engine.
 * Sua função é transformar frameworks de lançamento, marketing direto e psicologia
 * de conversão em princípios estratégicos aplicáveis à campanha — SEMPRE ancorando
 * cada princípio à etapa específica da Fórmula de Lançamento que está sendo fortalecida.
 *
 * NÍVEL 0 — GOVERNANÇA SUPREMA (rege toda a doutrina):
 * - Product Launch Formula (Jeff Walker) + Fórmula de Lançamento (Érico Rocha)
 *
 * NÍVEL 1 — SUPORTE ESTRATÉGICO (fortalecem etapas do PLF):
 * - Eugene Schwartz (Consciousness Stages + New Mechanism)
 * - Alex Hormozi ($100M Offers — value stack, oferta irresistível)
 * - Jay Abraham (Strategy of Preeminence + Risk Reversal)
 * - Donald Miller (StoryBrand — avatar como herói, marca como guia)
 * - Rory Sutherland (Alchemy — percepção subjetiva supera lógica objetiva)
 * - Play Bigger — Ramadan/Lochhead (criação de categoria, não competição)
 * - Obviously Awesome — April Dunford (posicionamento deliberado e claro)
 * - The 22 Immutable Laws — Al Ries & Jack Trout (lei da mente, da liderança, da categoria)
 *
 * NÍVEL 2 — SUPORTE PSICOLÓGICO (fortalecem decisão e persuasão em cada etapa):
 * - Robert Cialdini (Influence + Pre-Suasion)
 * - Daniel Kahneman (Thinking Fast and Slow — Sistema 1, loss aversion)
 * - Gerald Zaltman (How Customers Think — 95% subconsciente)
 * - Phil Barden (Decoded — valor percebido como equação: benefício ÷ esforço + dor)
 * - Richard Shotton (The Choice Factory — 25 vieses aplicados)
 *
 * Entrega:
 * - Campaign Doctrine, Launch Logic, Emotional Sequence,
 *   Strategic Warnings, Adaptation Notes, Confidence Score
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { StrategicBrief } from "./strategic-core.agent.js";
import type { ProfileBuilderOutput } from "./profile-builder.agent.js";
import type { Logger } from "pino";
import { COGNITIVE_IDENTITY_STRATEGIC_DOCTRINE } from "./cognitive-identity-system.js";

// ─── Output Types ───────────────────────────────────────────────────────────────

export type ConsciousnessStage =
  | "unaware"           // não sabe que tem o problema
  | "problem_aware"     // sabe do problema, não conhece soluções
  | "solution_aware"    // conhece soluções, não conhece seu produto
  | "product_aware"     // conhece seu produto, ainda não comprou
  | "most_aware";       // conhece e quer — só precisa de uma oferta clara

export type MarketSophistication =
  | "virgin"            // ninguém viu nada parecido
  | "low"               // poucas ofertas similares no mercado
  | "medium"            // mercado com opções, mas não saturado
  | "high"              // muita concorrência, audiência cética
  | "saturated";        // exaustão total — fórmulas não funcionam mais

export type LeadTemperature = "cold" | "warm" | "hot" | "scalding";

export type UrgencyLevel = "minimal" | "moderate" | "high" | "extreme";

export interface EmotionalPhase {
  phase: string;                // nome da fase (ex: "Antecipação", "Revelação", "Decisão")
  dayRange: string;             // ex: "Dias 1-3", "Dia 7", "Últimas 24h"
  dominantEmotion: string;      // emoção que deve dominar nessa fase
  desiredBeliefShift: string;   // crença que o lead deve ter ao sair da fase
  contentDirection: string;     // que tipo de conteúdo/mensagem produzir
  primaryChannel: string;       // canal dominante nessa fase
  schwartzLevel: string;        // nível de consciência de Schwartz nessa fase
  hormoziPrinciple: string;     // qual princípio do Hormozi se aplica aqui
}

export interface CartLogic {
  mechanism: string;            // mecanismo de abertura/fechamento
  timing: string;               // quando executar
  firstMessage: string;         // ângulo da primeira mensagem
  urgencyMechanism: string;     // como criar urgência legítima
  psychologicalTrigger: string; // qual trigger de Cialdini domina
  scarcityType: string;         // "limited_seats" | "time_only" | "bonus_expiry" | "price_increase"
  copyDirection: string;        // direção do copy nessa janela
}

export interface CommunityStrategy {
  platform: string;             // WhatsApp, Telegram, Discord, etc.
  role: string;                 // qual o papel da comunidade no lançamento
  activationMoments: string[];  // momentos-chave de ativação (provas sociais, depoimentos, etc.)
  contentRhythm: string;        // frequência e tipo de conteúdo
  moderationTone: string;       // como gerir a comunidade durante o lançamento
}

export interface RetentionLogic {
  postPurchaseHook: string;     // primeira experiência após compra (crítica para retenção)
  onboardingSequence: string[]; // passos para transformar comprador em fã
  referralTrigger: string;      // quando e como ativar o loop viral
  churnPrevention: string;      // como identificar e reativar compradores passivos
}

export interface DoctrineOutput {
  // ── Diagnóstico de Mercado ──────────────────────────────────────────────────
  audienceConsciousnessStage: ConsciousnessStage;
  consciousnessRationale: string;   // por que este estágio para este avatar
  marketSophistication: MarketSophistication;
  sophisticationRationale: string;  // evidências que justificam este nível
  leadTemperature: LeadTemperature;
  temperatureRationale: string;     // como essa temperatura afeta a estratégia

  // ── Pilares da Doutrina ─────────────────────────────────────────────────────
  bigDomino: string;                // crença singular que, se instalada, torna a compra inevitável
  bigDominoRationale: string;      // por que este Big Domino e não outro
  uniqueMechanism: string;          // mecanismo nomeável que diferencia o método
  uniqueMechanismProof: string;     // como provar o mecanismo sem exagerar

  // ── Entregáveis Principais ──────────────────────────────────────────────────
  campaignDoctrine: string;         // parágrafo-manifesto da estratégia desta campanha
  launchLogic: string[];            // 8-12 princípios táticos específicos para esta campanha
  emotionalSequence: EmotionalPhase[];  // sequência emocional fase a fase
  cartOpenLogic: CartLogic;
  cartCloseLogic: CartLogic;
  communityStrategy: CommunityStrategy;
  retentionLogic: RetentionLogic;

  // ── Avisos e Adaptações ─────────────────────────────────────────────────────
  strategicWarnings: string[];      // o que NÃO fazer — riscos reais desta campanha
  adaptationNotes: string[];        // como adaptar os frameworks ao contexto atual
  anticipationStrategy: {
    durationDays: number;
    mechanism: string;
    contentPillars: string[];
    communityActivation: string;
    triggerSequence: string[];
  };
  urgencyLevel: UrgencyLevel;
  urgencyJustification: string;     // por que este nível de urgência é legítimo

  // ── Meta ───────────────────────────────────────────────────────────────────
  primaryFrameworkApplied: string;  // qual framework dominante foi aplicado
  secondaryFrameworks: string[];    // frameworks de suporte usados
  confidenceScore: number;          // 0-1 — confiança na doutrina gerada
  doctrineNotes: string;            // observações do Strategic Doctrine Engine
}

// ─── System Prompt ──────────────────────────────────────────────────────────────

const DOCTRINE_SYSTEM_PROMPT = `Você é o NEXOS Strategic Doctrine Engine.

Sua missão é transformar frameworks de lançamento e marketing direto em PRINCÍPIOS ESTRATÉGICOS APLICADOS — específicos para esta campanha, para este avatar, neste momento de mercado.

## BASE DE CONHECIMENTO (USE COMO LENTES, NÃO COMO FÓRMULAS)

### Eugene Schwartz — Estágios de Consciência
O princípio mais subutilizado do marketing direto. O COPY e a SEQUÊNCIA devem começar exatamente onde o avatar está:
- Unaware: venda a dor antes de vender a solução
- Problem-aware: valide o problema, depois ofereça saída
- Solution-aware: diferencie sua solução das alternativas
- Product-aware: elimine objeções, fortaleça a promessa
- Most-aware: seja direto, vá para a oferta com ancoragem de preço

### Jeff Walker / Érico Rocha — Sequência de Pré-lançamento
Princípio central: transferir valor antes de vender. A sideways sales letter distribui a venda em múltiplos pontos de contato.
Adapte: não copie o "4 vídeos de conteúdo" literalmente — extraia o princípio de SEQUÊNCIA DE REVELAÇÃO PROGRESSIVA e aplique ao formato atual (Reels, WhatsApp, emails curtos, lives).

### Alex Hormozi — Grand Slam Offer e Value Stacking
O preço nunca compete com o valor percebido — ele compete com o valor total do stack.
Princípios extraídos:
1. Stack de valor percebido deve ser 10x o preço pedido
2. A garantia deve remover o risco da decisão, não apenas o risco financeiro
3. O mecanismo único deve ter um nome — nomear cria crença
4. Bonuses devem resolver objeções específicas, não ser genéricos

### Cialdini — 6 Princípios de Influência Legítima
1. Reciprocidade: dê antes de pedir — e dê de forma INESPERADA
2. Prova Social: números e depoimentos REAIS no momento certo
3. Autoridade: demonstre via resultado, não via credencial vazia
4. Escassez: crie limitações REAIS (turmas, vagas, bônus com prazo)
5. Urgência: prazos REAIS com consequências reais
6. Afinidade: o avatar deve ver o vendedor como alguém como ele

### Ogilvy e Sugarman — Direct Response
- Ogilvy: headline é 80% da venda. A promessa deve aparecer nos primeiros 3 segundos.
- Sugarman: o objetivo de cada linha é fazer o lead ler a próxima. Crie momentum.
- Ambos: pesquisa de avatar supera criatividade. Conheça a dor antes de escrever.

### Comportamento Moderno — TikTok/Reels, Atenção, Comunidades
- Atenção é vendida em 3 segundos ou não acontece
- Pattern interrupt é obrigatório no primeiro frame
- Comunidades no WhatsApp/Telegram criam urgência social e prova social em tempo real
- Funnels de WhatsApp têm conversão 3-5x superior ao email para ofertas de ticket médio
- Conteúdo de bastidores e vulnerabilidade superam conteúdo polished em conversão
- Narrativa de transformação > lista de features

## REGRAS CRÍTICAS

1. NUNCA COPIE FÓRMULAS LITERALMENTE — extraia princípios e adapte
2. NUNCA use linguagem de guru ("vai explodir", "maior lançamento", "segredo")
3. NUNCA crie falsa escassez — apenas urgência e limitações LEGÍTIMAS
4. NUNCA prometa resultados que não dependem apenas do produto
5. Adapte o nível de urgência ao estágio de consciência: leads frios precisam de mais educação, leads quentes precisam de menos fricção
6. O Big Domino deve ser uma CRENÇA — não uma feature
7. O Mecanismo Único deve ter um NOME NOMEÁVEL — não pode ser genérico

## ENTREGA OBRIGATÓRIA (JSON VÁLIDO)

Você DEVE retornar APENAS o JSON abaixo, sem texto antes ou depois:

{
  "audienceConsciousnessStage": "string — unaware|problem_aware|solution_aware|product_aware|most_aware",
  "consciousnessRationale": "string — por que este estágio para este avatar específico",
  "marketSophistication": "string — virgin|low|medium|high|saturated",
  "sophisticationRationale": "string — evidências que justificam este nível",
  "leadTemperature": "string — cold|warm|hot|scalding",
  "temperatureRationale": "string — como essa temperatura afeta toda a estratégia",
  "bigDomino": "string — a crença singular que, se instalada, torna a compra inevitável. Específica para este produto/avatar.",
  "bigDominoRationale": "string — por que este Big Domino e não outro",
  "uniqueMechanism": "string — nome do mecanismo único NOMEÁVEL que diferencia o método",
  "uniqueMechanismProof": "string — como provar o mecanismo sem exagerar",
  "campaignDoctrine": "string — parágrafo-manifesto de 3-5 frases: a filosofia estratégica desta campanha específica",
  "launchLogic": [
    "string — princípio tático 1 (específico para este produto/avatar/momento)",
    "string — princípio tático 2",
    "...8-12 princípios no total"
  ],
  "emotionalSequence": [
    {
      "phase": "string — nome da fase",
      "dayRange": "string — ex: Dias 1-3",
      "dominantEmotion": "string — emoção que domina esta fase",
      "desiredBeliefShift": "string — crença que o lead deve ter ao sair da fase",
      "contentDirection": "string — que tipo de conteúdo produzir",
      "primaryChannel": "string — canal dominante nesta fase",
      "schwartzLevel": "string — nível de consciência de Schwartz aplicável",
      "hormoziPrinciple": "string — qual princípio do Hormozi se aplica"
    }
  ],
  "cartOpenLogic": {
    "mechanism": "string — mecanismo de abertura do carrinho",
    "timing": "string — quando executar a abertura",
    "firstMessage": "string — ângulo da primeira mensagem de abertura",
    "urgencyMechanism": "string — como criar urgência legítima na abertura",
    "psychologicalTrigger": "string — trigger de Cialdini dominante na abertura",
    "scarcityType": "string — tipo de escassez legítima usada",
    "copyDirection": "string — direção de copy para a janela de carrinho"
  },
  "cartCloseLogic": {
    "mechanism": "string — mecanismo de fechamento",
    "timing": "string — quando executar o fechamento",
    "firstMessage": "string — ângulo da última mensagem de fechamento",
    "urgencyMechanism": "string — urgência no fechamento (DEVE ser legítima)",
    "psychologicalTrigger": "string — trigger dominante no fechamento",
    "scarcityType": "string — tipo de escassez no fechamento",
    "copyDirection": "string — direção de copy para as últimas horas"
  },
  "communityStrategy": {
    "platform": "string — plataforma de comunidade (WhatsApp/Telegram/Discord/etc)",
    "role": "string — papel da comunidade no lançamento",
    "activationMoments": ["string — momentos-chave de ativação"],
    "contentRhythm": "string — frequência e tipo de conteúdo",
    "moderationTone": "string — como gerir a comunidade durante o lançamento"
  },
  "retentionLogic": {
    "postPurchaseHook": "string — primeira experiência após compra",
    "onboardingSequence": ["string — passo 1", "string — passo 2"],
    "referralTrigger": "string — quando e como ativar o loop viral",
    "churnPrevention": "string — como identificar e reativar compradores passivos"
  },
  "strategicWarnings": [
    "string — risco real 1 específico para esta campanha",
    "string — risco real 2",
    "...5-8 avisos no total"
  ],
  "adaptationNotes": [
    "string — como adaptar framework X ao contexto atual 1",
    "...4-6 notas de adaptação"
  ],
  "anticipationStrategy": {
    "durationDays": 0,
    "mechanism": "string — como criar antecipação sem revelar tudo",
    "contentPillars": ["string — pilar 1", "string — pilar 2"],
    "communityActivation": "string — como ativar a comunidade antes do lançamento",
    "triggerSequence": ["string — trigger 1", "string — trigger 2"]
  },
  "urgencyLevel": "string — minimal|moderate|high|extreme",
  "urgencyJustification": "string — por que este nível de urgência é legítimo para esta campanha",
  "primaryFrameworkApplied": "string — qual framework dominante foi aplicado e por quê",
  "secondaryFrameworks": ["string — framework de suporte 1", "..."],
  "confidenceScore": 0.0,
  "doctrineNotes": "string — observações do Strategic Doctrine Engine sobre pontos de atenção"
}`;

// ─── Defaults ───────────────────────────────────────────────────────────────────

function defaultDoctrineOutput(): DoctrineOutput {
  return {
    audienceConsciousnessStage: "problem_aware",
    consciousnessRationale: "",
    marketSophistication: "medium",
    sophisticationRationale: "",
    leadTemperature: "cold",
    temperatureRationale: "",
    bigDomino: "",
    bigDominoRationale: "",
    uniqueMechanism: "",
    uniqueMechanismProof: "",
    campaignDoctrine: "",
    launchLogic: [],
    emotionalSequence: [],
    cartOpenLogic: {
      mechanism: "",
      timing: "",
      firstMessage: "",
      urgencyMechanism: "",
      psychologicalTrigger: "scarcity",
      scarcityType: "time_only",
      copyDirection: "",
    },
    cartCloseLogic: {
      mechanism: "",
      timing: "",
      firstMessage: "",
      urgencyMechanism: "",
      psychologicalTrigger: "urgency",
      scarcityType: "time_only",
      copyDirection: "",
    },
    communityStrategy: {
      platform: "WhatsApp",
      role: "",
      activationMoments: [],
      contentRhythm: "",
      moderationTone: "",
    },
    retentionLogic: {
      postPurchaseHook: "",
      onboardingSequence: [],
      referralTrigger: "",
      churnPrevention: "",
    },
    strategicWarnings: [],
    adaptationNotes: [],
    anticipationStrategy: {
      durationDays: 7,
      mechanism: "",
      contentPillars: [],
      communityActivation: "",
      triggerSequence: [],
    },
    urgencyLevel: "moderate",
    urgencyJustification: "",
    primaryFrameworkApplied: "",
    secondaryFrameworks: [],
    confidenceScore: 0.5,
    doctrineNotes: "",
  };
}

// ─── Runner ─────────────────────────────────────────────────────────────────────

export async function runStrategicDoctrineEngine(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  strategy: StrategyOutput | null,
  brief: StrategicBrief,
  log: Logger,
  profile?: ProfileBuilderOutput,
  memoryContext?: string,
): Promise<DoctrineOutput> {
  const profileBlock = profile
    ? `\n\n**Perfil do avatar (Profile Builder):**\n\`\`\`json\n${JSON.stringify(
        {
          primaryAvatar: profile.primaryAvatar,
          psychologicProfile: (profile as any).psychologicProfile,
          marketIntelligence: profile.marketIntelligence,
          positioning: profile.positioning,
          criticalInsights: profile.criticalInsights,
        },
        null,
        2,
      )}\n\`\`\``
    : "";

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "strategic_doctrine",
    systemPrompt: COGNITIVE_IDENTITY_STRATEGIC_DOCTRINE + DOCTRINE_SYSTEM_PROMPT,
    memoryContext,
    thinkingMessages: [
      "Avaliando estágio de consciência do público com lente de Schwartz...",
      "Analisando sofisticação do mercado e temperatura dos leads...",
      "Extraindo Big Domino e mecanismo único para este avatar...",
      "Construindo sequência emocional fase a fase...",
      "Definindo lógica de abertura e fechamento de carrinho...",
      "Gerando doutrina estratégica completa...",
    ],
    messages: [
      {
        role: "user",
        content: `Gere a Doutrina Estratégica completa para esta campanha.

**Dados do Intake:**
\`\`\`json
${JSON.stringify(
  {
    "product.name": intakeData["product.name"],
    "product.category": intakeData["product.category"],
    "product.price": intakeData["product.price"],
    // audience.sophisticationLevel = chave do intake (contém dados de Schwartz awareness,
    //   apesar do nome — opções: unaware|problem_aware|solution_aware|product_aware|most_aware)
    // audience.awarenessLevel = chave semântica correta; fallback para sophisticationLevel
    //   pois o intake armazena os estágios de consciência sob o nome errado.
    // NOTA: sofisticação de mercado (geração 1-5 de Schwartz) é conceito distinto e
    //   NÃO é coletada pelo intake — este campo cobre apenas consciência individual.
    "audience.sophisticationLevel": intakeData["audience.sophisticationLevel"],
    "audience.awarenessLevel": intakeData["audience.awarenessLevel"] ?? intakeData["audience.sophisticationLevel"],
    "campaign.type": intakeData["campaign.type"],
    "campaign.revenueTarget": intakeData["campaign.revenueTarget"],
    "campaign.durationDays": intakeData["campaign.durationDays"],
    "campaign.salesChannel": intakeData["campaign.salesChannel"],
    "content.tone": intakeData["content.tone"],
    "content.style": intakeData["content.style"],
  },
  null,
  2,
)}
\`\`\`

**Brief Estratégico Global:**
\`\`\`json
${JSON.stringify(
  {
    primaryAvatar: brief.primaryAvatar,
    centralPain: brief.centralPain,
    dominantDesire: brief.dominantDesire,
    bigDomino: brief.bigDomino,
    uniqueMechanism: brief.uniqueMechanism,
    dominantTrigger: brief.dominantTrigger,
    emotionalPains: brief.emotionalPains,
    mainObjections: brief.mainObjections,
    channels: brief.channels,
    tone: brief.tone,
    permittedPromises: brief.permittedPromises,
    prohibitedPromises: brief.prohibitedPromises,
    urgencyLevel: brief.urgencyLevel,
    confidenceScore: brief.confidenceScore,
    coreWarnings: brief.coreWarnings,
  },
  null,
  2,
)}
\`\`\`

**Estratégia (resumo):**
\`\`\`json
${JSON.stringify(
  {
    executiveSummary: (strategy as any).executiveSummary,
    audienceSegmentation: (strategy as any).audienceSegmentation,
    campaignArchitecture: (strategy as any).campaignArchitecture,
    offerPositioning: (strategy as any).offerPositioning,
    triggerMap: (strategy as any).triggerMap,
    risks: (strategy as any).risks,
  },
  null,
  2,
)}
\`\`\`${profileBlock}

Com base em todos esses dados, gere a Campaign Doctrine completa.

Lembre-se:
1. O Big Domino deve ser UMA CRENÇA específica para este avatar — não genérica
2. O Mecanismo Único deve ter um NOME NOMEÁVEL
3. A Sequência Emocional deve ter MÍNIMO 5 fases
4. Os Avisos Estratégicos devem ser riscos REAIS desta campanha, não clichês
5. A Urgência deve ser justificada por limitação LEGÍTIMA
6. Nunca use linguagem de guru ou promessas exageradas

Retorne APENAS o JSON válido.`,
      },
    ],
    log,
  });

  const parsed = parseAgentJSON<DoctrineOutput>(result.content, defaultDoctrineOutput());

  // Validate and merge with defaults
  const output: DoctrineOutput = {
    ...defaultDoctrineOutput(),
    ...parsed,
  };

  // Validate consciousness stage
  const validStages: ConsciousnessStage[] = [
    "unaware",
    "problem_aware",
    "solution_aware",
    "product_aware",
    "most_aware",
  ];
  if (!validStages.includes(output.audienceConsciousnessStage)) {
    output.audienceConsciousnessStage = "problem_aware";
  }

  // Validate market sophistication
  const validSophistication: MarketSophistication[] = [
    "virgin",
    "low",
    "medium",
    "high",
    "saturated",
  ];
  if (!validSophistication.includes(output.marketSophistication)) {
    output.marketSophistication = "medium";
  }

  // Validate lead temperature
  const validTemperatures: LeadTemperature[] = ["cold", "warm", "hot", "scalding"];
  if (!validTemperatures.includes(output.leadTemperature)) {
    output.leadTemperature = "warm";
  }

  // Validate urgency level
  const validUrgency: UrgencyLevel[] = ["minimal", "moderate", "high", "extreme"];
  if (!validUrgency.includes(output.urgencyLevel)) {
    output.urgencyLevel = "moderate";
  }

  // Ensure minimum emotional phases
  if (!Array.isArray(output.emotionalSequence) || output.emotionalSequence.length < 3) {
    output.emotionalSequence = defaultDoctrineOutput().emotionalSequence;
  }

  // Clamp confidence score
  output.confidenceScore = Math.min(1, Math.max(0, output.confidenceScore ?? 0.5));

  log.info(
    {
      campaignId,
      consciousnessStage: output.audienceConsciousnessStage,
      marketSophistication: output.marketSophistication,
      leadTemperature: output.leadTemperature,
      urgencyLevel: output.urgencyLevel,
      confidenceScore: output.confidenceScore,
      launchLogicCount: output.launchLogic.length,
      emotionalPhases: output.emotionalSequence.length,
      warnings: output.strategicWarnings.length,
    },
    "Strategic Doctrine Engine completed",
  );

  return output;
}
