/**
 * Video Hook Agent
 * Specializes in the first 3 seconds of video content.
 * Generates platform-calibrated hooks: pattern interrupt, visual, verbal, and audio hooks.
 * Provider: GPT-4o (creative, pattern-matching, fast generation)
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";

export interface VideoHookVariant {
  id: string;
  platform: "tiktok" | "instagram_reels" | "youtube_shorts" | "youtube" | "facebook_video";
  hookType: "pattern_interrupt" | "direct_benefit" | "curiosity_gap" | "controversy" | "story_start" | "data_shock" | "relatable_pain" | "identity";
  openingFrameDescription: string;  // visual: what happens in frame 0-0.5s
  vocalHook: string;                 // exact words spoken in seconds 0-3
  textOverlay?: string;              // text on screen (crucial for TikTok)
  visualConcept: string;             // what to film/show
  emotionTriggered: string;          // what emotion fires in first 3 seconds
  whyItWorks: string;                // psychological mechanism
  estimatedStopRate: "low" | "medium" | "high" | "very_high"; // % who stop scrolling
  followThrough: string;             // seconds 3-10: what comes next to keep them watching
}

export interface VideoHookOutput {
  contentTopic: string;
  avatar: string;
  hooks: VideoHookVariant[];
  platformWinners: Record<string, string>;  // platform → best hook ID
  aTestPairs: { hookA: string; hookB: string; rationale: string }[];
  thumbnailGuidance: {
    platform: string;
    concept: string;
    textOverlay: string;
    emotionalExpression: string;
    avoidList: string[];
  }[];
  firstFramePrinciples: string[];  // universal rules for any video hook
  hookCalibrationByAudience: string; // how this avatar's scroll behavior is different
}

const VIDEO_HOOK_PROMPT = `Você é o Agente Video Hook do NexOS AI — o especialista mais avançado nos primeiros 3 segundos de vídeo do mercado digital brasileiro.

Sua especialidade única: você pensa como o algoritmo E como o avatar simultaneamente. O algoritmo quer tempo de visualização. O avatar quer parar de rolar quando vê algo inesperado. Você entrega os dois.

## ANATOMIA DOS PRIMEIROS 3 SEGUNDOS

### FRAME 0 (primeiros 0.5 segundos — o mais importante)
O algoritmo do TikTok/Instagram decide a distribuição baseado nos primeiros 0-0.5 segundos. O avatar decide se continua ou rola nos primeiros 1-2 segundos.

**O frame zero deve ser:**
- Inesperado (contra-intuitivo ao que vem antes no feed)
- Visualmente claro (uma coisa, não várias)
- Emocionalmente imediato (não precisa de contexto para sentir)

**Erros mais comuns no frame zero:**
- Logo da empresa (ninguém se importa)
- Fade in ou transição do nada (perde atenção antes de ganhar)
- Múltiplos elementos visuais (confusão = rolar)
- Texto longo para ler (demora demais)

### SEGUNDOS 1-3 (o gancho verbal + visual)
Enquanto o frame zero para o scroll, o gancho verbal cria a lacuna cognitiva que força continuidade.

**Estrutura de gancho verbal em 3 segundos:**
- 0-1s: Setup (contexto ultra-comprimido)
- 1-2s: Tensão (o inesperado, a contradição, a promessa)
- 2-3s: Loop aberto (a promessa de que a resposta vem)

**Exemplos de loops abertos:**
- "...e o que eu descobri me deixou completamente sem palavras."
- "...a razão que ninguém te conta."
- "...e você também está fazendo isso."

### PLATAFORMAS × PADRÕES DE HOOK

**TikTok:** 
- Primeiro frame visual DEVE parar o scroll sozinho (sem áudio)
- Text overlay nos primeiros 2 segundos (50% assiste sem som)
- Hook verbal deve funcionar mesmo sem contexto

**Instagram Reels:**
- Audiência levemente mais velha e orientada a conteúdo educativo/aspiracional
- Gancho de identidade funciona bem: "Se você [descrição específica]..."
- Thumbnail importa mais que no TikTok

**YouTube Shorts:**
- Maior tolerância para contexto (2-3 segundos de setup antes do gancho)
- Pattern interrupt visual é crítico (thumbnail + primeiros frames)
- Loop aberto mais aceito ("fica até o final porque...")

**YouTube Longo:**
- Regra dos 30 segundos: os primeiros 30 segundos decidem se fica ou sai
- Estabeleça credibilidade + crie curiosidade + prometa o resultado específico

**Retorne APENAS JSON válido.**

\`\`\`json
{
  "contentTopic": "string",
  "avatar": "string",
  "hooks": [
    {
      "id": "vh01",
      "platform": "tiktok|instagram_reels|youtube_shorts|youtube|facebook_video",
      "hookType": "pattern_interrupt|direct_benefit|curiosity_gap|controversy|story_start|data_shock|relatable_pain|identity",
      "openingFrameDescription": "string — o que aparece visualmente nos primeiros 0.5s",
      "vocalHook": "string — palavras exatas nos primeiros 3 segundos",
      "textOverlay": "string — texto na tela (importante para TikTok)",
      "visualConcept": "string — o que filmar",
      "emotionTriggered": "string — emoção disparada nos primeiros 3s",
      "whyItWorks": "string — mecanismo psicológico",
      "estimatedStopRate": "low|medium|high|very_high",
      "followThrough": "string — o que vem nos segundos 3-10 para manter a atenção"
    }
  ],
  "platformWinners": { "tiktok": "vh01", "instagram_reels": "vh02" },
  "aTestPairs": [
    {
      "hookA": "vh01",
      "hookB": "vh02",
      "rationale": "string — por que testar exatamente estes dois"
    }
  ],
  "thumbnailGuidance": [
    {
      "platform": "string",
      "concept": "string — conceito visual da thumbnail",
      "textOverlay": "string — texto na thumbnail",
      "emotionalExpression": "string — expressão facial ou visual dominante",
      "avoidList": ["string — o que NÃO fazer na thumbnail"]
    }
  ],
  "firstFramePrinciples": ["string — regra universal de primeiro frame para qualquer vídeo"],
  "hookCalibrationByAudience": "string — como o comportamento de scroll deste avatar é diferente"
}
\`\`\``;

export async function runVideoHookAgent(
  campaignId: string | null,
  workspaceId: string,
  contentTopic: string,
  avatarDescription: string,
  platforms: string[],
  contentGoal: string,
  log: Logger,
): Promise<VideoHookOutput> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "video_hook",
    systemPrompt: VIDEO_HOOK_PROMPT,
    messages: [
      {
        role: "user",
        content: `Gere hooks de vídeo de alta performance para este conteúdo.

**Tópico:** ${contentTopic}
**Avatar:** ${avatarDescription}
**Plataformas:** ${platforms.join(", ")}
**Objetivo do conteúdo:** ${contentGoal}

**PROCESSO:**
1. Para cada plataforma, gere 3-4 variantes de hook
2. Inclua: frame zero visual, gancho verbal, texto na tela (quando aplicável) e conceito de filmagem
3. Para cada hook, explique o mecanismo psicológico
4. Selecione os pares de A/B test mais estratégicos
5. Adicione orientações de thumbnail por plataforma

Gere pelo menos 15 hooks. Seja específico — não "mostre você mesmo" mas "você olha diretamente para câmera com expressão de surpresa enquanto faz X".
Retorne APENAS JSON.`,
      },
    ],
    log,
    thinkingMessages: [
      "Analisando comportamento de scroll deste avatar...",
      "Desenvolvendo hooks por plataforma e tipo...",
      "Calibrando frame zero e gancho verbal...",
      "Selecionando pares de A/B test...",
      "Gerando orientações de thumbnail...",
    ],
  });

  return parseAgentJSON<VideoHookOutput>(result.content, {
    contentTopic,
    avatar: avatarDescription,
    hooks: [],
    platformWinners: {},
    aTestPairs: [],
    thumbnailGuidance: [],
    firstFramePrinciples: [],
    hookCalibrationByAudience: "",
  });
}
