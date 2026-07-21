/**
 * PRE-LAUNCH WARMING AGENT — Micro-Conviction Installation
 *
 * Generates day-by-day warming content for 7-14 days before CPL 1.
 * Each day installs ONE micro-conviction that supports the Big Domino.
 * Format: organic post + WhatsApp message + email per day.
 *
 * Goal: When CPL 1 drops, the audience is already primed — not cold.
 * Provider: Claude (psychological depth + PLF sequencing)
 */

import { runAgentWithCritique } from "./critique.runner.js";
import { parseAgentJSON } from "./agent.runner.js";
import { COGNITIVE_IDENTITY_COPYWRITER } from "./cognitive-identity-system.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { ProfileBuilderOutput } from "./profile-builder.agent.js";
import type { Logger } from "pino";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WarmingDayContent {
  dayIndex: number;
  microConviction: string;
  convictionCategory: "authority" | "curiosity" | "problem_awareness" | "social_proof" | "identity";
  organicPost: {
    platform: "instagram" | "tiktok" | "youtube_shorts";
    hook: string;
    caption: string;
    overlayTexts: string[];
    hashtags: string[];
    callToAction: string;
    postingTime: string;
  };
  whatsapp: {
    message: string;
    sendTime: string;
    emoji: boolean;
  };
  email: {
    subject: string;
    previewText: string;
    body: string;
    cta: string;
  };
}

export interface PrelaunchWarmingOutput {
  campaignTitle: string;
  warmingDuration: number;
  overallObjective: string;
  convictionSequence: string[];
  days: WarmingDayContent[];
  productionNotes: {
    toneSummary: string;
    topicsToAvoid: string[];
    keyPhrases: string[];
    audienceMindsetOnDay1: string;
    audienceMindsetOnFinalDay: string;
  };
  warmingNotes: string;
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const PRELAUNCH_WARMING_PROMPT = `Você é o Arquiteto de Pré-Lançamento da NexOS AI — especialista em preparar audiências para receber CPLs com máximo impacto.

## O QUE É AQUECIMENTO DE PRÉ-LANÇAMENTO

Aquecimento não é conteúdo de valor genérico. É instalação cirúrgica de crenças.

Cada peça de conteúdo do aquecimento remove UMA barreira específica que impediria o avatar de acreditar no mecanismo único quando o CPL 1 chegar.

A sequência correta:
1. **Dias 1-3:** Autoridade silenciosa — sem vender, prove que você entende o problema melhor que ninguém
2. **Dias 4-6:** Plantio de curiosidade — faça perguntas que o avatar ainda não sabe responder
3. **Dias 7-9:** Consciência do problema — amplifique a dor sem oferecer solução ainda
4. **Dias 10-12:** Prova social indireta — histórias de transformação sem mencionar produto
5. **Dias 13-14:** Identidade — "pessoas como você fazem X diferente"

## PRINCÍPIOS INEGOCIÁVEIS

**1. UMA MICRO-CONVICÇÃO POR DIA**
Cada peça instala UMA crença. Se você tenta instalar duas, não instala nenhuma.
Defina antes de escrever: "Ao terminar este post, o avatar vai acreditar que ___."

**2. PROIBIDO VENDER OU TEASER DO PRODUTO**
O aquecimento não faz teaser do produto, do lançamento, ou de qualquer novidade futura.
A única antecipação permitida: "Amanhã vou falar sobre algo que vai mudar sua perspectiva sobre X."
Sem: "Em X dias, algo especial está chegando." Sem contagem regressiva.

**3. CONTEÚDO QUE PROVOCA, NÃO QUE ENSINA**
O aquecimento não é aula. É provocação cognitiva.
"Você sabia que 83% dos lançadores cometem esse erro?" → provoca
"Os 5 passos para um lançamento perfeito" → é aula (proibido no aquecimento)

**4. LINGUAGEM DO AVATAR, NÃO DO ESPECIALISTA**
Se o post soa como um especialista explicando algo, reescreva.
Deve soar como alguém que passou pelo mesmo problema e quer compartilhar.

**5. POSTS DE SOCIAL COM STOP POWER**
As primeiras 2 linhas decidem se o avatar vai ler.
Use: paradoxo, número contraintuitivo, pergunta que dói, afirmação polêmica.
❌ "Hoje quero falar sobre lançamentos"
✅ "Passei 3 anos fazendo lançamentos do jeito certo. Faturei muito menos do que quando parei de fazer tudo certo."

## ESTRUTURA DO EMAIL DE AQUECIMENTO

Cada email tem um único objetivo: fazer o avatar querer o próximo.
- Assunto: 5-8 palavras que provocam uma emoção
- Abertura: virada imediata, sem apresentação
- Corpo: história ou insight em 150-300 palavras
- Final: lacuna de informação para o próximo email
- Sem CTA de clique — o CTA é "espere meu próximo email"

## OUTPUT OBRIGATÓRIO

Retorne APENAS o JSON. Para cada dia, forneça conteúdo COMPLETO — não esboços.`;

// ─── Schema ───────────────────────────────────────────────────────────────────

const WARMING_JSON_SCHEMA = `\`\`\`json
{
  "campaignTitle": "string",
  "warmingDuration": 7,
  "overallObjective": "string — estado mental do avatar no fim do aquecimento",
  "convictionSequence": ["string — micro-convicção de cada dia, em ordem"],
  "days": [
    {
      "dayIndex": 1,
      "microConviction": "string — crença específica a instalar hoje",
      "convictionCategory": "authority|curiosity|problem_awareness|social_proof|identity",
      "organicPost": {
        "platform": "instagram|tiktok|youtube_shorts",
        "hook": "string — primeiras 2 linhas que param o scroll",
        "caption": "string — texto completo do post",
        "overlayTexts": ["string — textos de overlay para Reels/TikTok"],
        "hashtags": ["string"],
        "callToAction": "string — ação pedida (comentar, salvar, marcar alguém)",
        "postingTime": "string — horário recomendado"
      },
      "whatsapp": {
        "message": "string — mensagem completa, máx 180 chars",
        "sendTime": "string",
        "emoji": true
      },
      "email": {
        "subject": "string — assunto que provoca emoção",
        "previewText": "string — continua o assunto",
        "body": "string — corpo completo em HTML simples",
        "cta": "string — sem link de compra, só engajamento"
      }
    }
  ],
  "productionNotes": {
    "toneSummary": "string — tom geral da sequência de aquecimento",
    "topicsToAvoid": ["string — tópicos que quebrariam o aquecimento"],
    "keyPhrases": ["string — frases âncora a usar na sequência"],
    "audienceMindsetOnDay1": "string — estado mental do avatar no dia 1",
    "audienceMindsetOnFinalDay": "string — estado mental do avatar no último dia"
  },
  "warmingNotes": "string — observações críticas para o criador"
}
\`\`\``;

// ─── Runner ───────────────────────────────────────────────────────────────────

export async function runPrelaunchWarmingAgent(
  campaignId: string,
  workspaceId: string,
  strategy: StrategyOutput,
  profile: ProfileBuilderOutput | undefined,
  intakeData: Record<string, unknown>,
  durationDays: 7 | 14,
  log: Logger,
): Promise<PrelaunchWarmingOutput> {
  const avatarBlock = profile ? `
**Avatar:** ${profile.primaryAvatar?.name ?? ""} — ${profile.primaryAvatar?.age ?? ""}, ${profile.primaryAvatar?.occupation ?? ""}
**Dores diárias:** ${(profile.primaryAvatar?.dailyPains ?? []).slice(0, 4).join("; ")}
**Desejo mais profundo:** ${profile.primaryAvatar?.deepestDesire ?? ""}
**Palavras que usa:** ${(profile.primaryAvatar?.keywordsTheyUse ?? []).slice(0, 8).join(", ")}
**Tom de linguagem:** ${profile.primaryAvatar?.languageStyle ?? ""}
**Objeções típicas:** ${(profile.primaryAvatar?.typicalObjections ?? []).slice(0, 4).join("; ")}
**Nível de consciência:** ${profile.primaryAvatar?.awarenessLevel ?? ""}
**Big Idea:** ${profile.positioning?.campaignBigIdea ?? ""}
**Mecanismo único:** ${profile.positioning?.uniqueMechanism ?? ""}` : "";

  const bigDomino = (strategy as any).triggerMap
    ? `**BIG DOMINO a instalar:** ${(strategy as any).triggerMap?.dominantTrigger}
**Sequência de gatilhos:** ${((strategy as any).triggerMap?.triggerStackSequence ?? []).join(" → ")}
**Ângulos anti-requisito:** ${((strategy as any).triggerMap?.antiRequisiteAngles ?? []).join(" | ")}
**Transformação prometida:** ${(strategy as any).triggerMap?.transformationBridge ?? ""}`
    : `**Narrativa central:** ${strategy.campaignArchitecture?.coreNarrative ?? ""}`;

  const userMessage = `Crie a sequência de aquecimento de ${durationDays} dias antes do CPL 1.

**Produto:** ${String(intakeData["product.name"] ?? "")} — R$${String(intakeData["product.price"] ?? "")}
**Criador:** ${String(intakeData["creator.name"] ?? "")}
**Posicionamento:** ${String(intakeData["creator.positioning"] ?? "")}
**Ângulo único:** ${String(intakeData["creator.uniqueAngle"] ?? "")}
**Nicho:** ${String(intakeData["product.category"] ?? "")}
${avatarBlock}

${bigDomino}

**OBJETIVO FINAL:** No dia ${durationDays + 1}, o CPL 1 será publicado. O avatar precisa estar com a crença central já parcialmente instalada — não completamente, mas inclinada. Cada dia desta sequência remove UMA barreira específica.

**DURAÇÃO:** ${durationDays} dias — forneça conteúdo COMPLETO para todos os ${durationDays} dias.

${WARMING_JSON_SCHEMA}

Retorne APENAS o JSON. Conteúdo real, não esboços.`;

  const critique = await runAgentWithCritique({
    campaignId,
    workspaceId,
    agentRole: "social_media",
    systemPrompt: COGNITIVE_IDENTITY_COPYWRITER + PRELAUNCH_WARMING_PROMPT,
    userMessage,
    log,
  });

  const parsed = parseAgentJSON<PrelaunchWarmingOutput & { _qualityScore?: number }>(critique.refinedOutput, {
    campaignTitle: String(intakeData["product.name"] ?? ""),
    warmingDuration: durationDays,
    overallObjective: "",
    convictionSequence: [],
    days: [],
    productionNotes: {
      toneSummary: "",
      topicsToAvoid: [],
      keyPhrases: [],
      audienceMindsetOnDay1: "",
      audienceMindsetOnFinalDay: "",
    },
    warmingNotes: critique.refinedOutput,
  });
  parsed._qualityScore = critique.qualityScore;
  return parsed;
}
