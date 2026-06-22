import { runAgent, parseAgentJSON } from "../agents/agent.runner.js";
import { deductCredits } from "../credits/credits.service.js";
import { CREDIT_COSTS } from "@workspace/db";
import type { Logger } from "pino";

export type VideoFormat = "reels" | "tiktok" | "shorts" | "stories" | "youtube" | "long_form";
export type VideoStyle = "clone" | "no_face";

export interface DailyVideoRequest {
  topic: string;
  format: VideoFormat;
  style: VideoStyle;
  tone?: string;
  campaignContext?: string;
  targetAudience?: string;
  productName?: string;
  goal?: "awareness" | "engagement" | "sales" | "lead_capture";
}

export interface DailyVideoScript {
  title: string;
  format: VideoFormat;
  style: VideoStyle;
  durationEstimate: string;
  creditsCost: number;
  hook: {
    openingLine: string;
    patternInterrupt: string;
  };
  script: string;
  sections: Array<{
    name: string;
    duration: string;
    script: string;
    visualDirection: string;
    toneNote: string;
  }>;
  captions: string[];
  cta: string;
  hashtags: string[];
  thumbnailDirection: string;
  uploadInstructions: {
    bestPlatforms: string[];
    bestTime: string;
    captionSuggestion: string;
    firstComment: string;
  };
  productionNotes: string;
}

const FORMAT_DURATION: Record<VideoFormat, string> = {
  reels: "15–60 segundos",
  tiktok: "15–60 segundos",
  shorts: "até 60 segundos",
  stories: "4–6 frames de 15s",
  youtube: "5–15 minutos",
  long_form: "10–20 minutos",
};

const FORMAT_CREDIT_KEY: Record<VideoFormat, string> = {
  reels: "daily_video_short",
  tiktok: "daily_video_short",
  shorts: "daily_video_short",
  stories: "daily_video_story",
  youtube: "daily_video_long",
  long_form: "daily_video_long",
};

const DAILY_VIDEO_PROMPT = `Você é o Agente de Vídeo Diário do NexOS — especialista em criar roteiros de vídeo curto de alta conversão para lançadores e criadores de conteúdo digital brasileiros.

## SUA MISSÃO
Gerar um roteiro COMPLETO e PRONTO PARA GRAVAR para o formato solicitado. O criador vai pegar esse roteiro, gravar sozinho (ou delegar a um editor), e publicar onde quiser.

## REGRAS DE OURO

**HOOK (primeiros 3 segundos):**
- É a única coisa que importa no começo — ou o usuário não assiste
- Deve criar uma lacuna cognitiva IMEDIATA que o cérebro não consegue ignorar
- Pattern interrupt: comece com algo inesperado, uma afirmação que quebra expectativa, ou uma pergunta que o avatar não consegue responder sozinho

**PARA VÍDEO "SEM FACE" (no_face):**
- Script escrito para narração em off — o criador narra sem aparecer na câmera
- VisualDirection: screen recording / texto animado / B-roll / infográfico / imagens
- Tom: mais direto, objetivo, educativo ou revelador
- Nunca instrua "olhe para a câmera" — fale como se fosse uma voz narrativa

**PARA VÍDEO "COM CLONE" (clone):**
- Script escrito para presença direta — o criador fala para a câmera
- VisualDirection: criador na tela + b-roll intercalado / texto sobreposto
- Tom: mais pessoal, intimidade, "estou te contando um segredo"
- Instrua expressões, gestos, olhar, pausas dramáticas

**CAPTIONS:**
- Máximo 4–6 palavras por caption
- Em MAIÚSCULAS nos momentos de pico
- Posicionadas para tela mobile (terço inferior)

**CTA:**
- Uma ação só — nunca dois CTAs
- Orientado ao resultado: "Salva isso pra você não esquecer" > "Curte o vídeo"

Retorne APENAS JSON válido no formato exato abaixo.

\`\`\`json
{
  "title": "string — título interno do roteiro",
  "format": "string",
  "style": "clone|no_face",
  "durationEstimate": "string — ex: 45 segundos",
  "hook": {
    "openingLine": "string — a primeira frase exata a ser dita/narrada",
    "patternInterrupt": "string — o que acontece nos primeiros 3s que prende atenção"
  },
  "script": "string — roteiro completo e contínuo, pronto para ler/narrar",
  "sections": [
    {
      "name": "string — nome da seção (Hook, Problema, Revelação, CTA...)",
      "duration": "string — ex: 0s–8s",
      "script": "string — fala exata desta seção",
      "visualDirection": "string — o que aparece na tela",
      "toneNote": "string — como entregar esta parte (energia, ritmo, emoção)"
    }
  ],
  "captions": ["string", "string"],
  "cta": "string — call-to-action final exato",
  "hashtags": ["string"],
  "thumbnailDirection": "string — instrução para thumbnail/capa",
  "uploadInstructions": {
    "bestPlatforms": ["string"],
    "bestTime": "string — melhor horário de publicação para o nicho",
    "captionSuggestion": "string — legenda/descrição pronta para publicar",
    "firstComment": "string — primeiro comentário para engajamento"
  },
  "productionNotes": "string — observações finais: armadilhas a evitar, dicas de gravação, adaptações"
}
\`\`\``;

export async function generateDailyVideo(
  workspaceId: string,
  request: DailyVideoRequest,
  log: Logger,
): Promise<DailyVideoScript> {
  const creditKey = FORMAT_CREDIT_KEY[request.format];
  const creditCost = CREDIT_COSTS[creditKey] ?? 12;

  await deductCredits(workspaceId, creditKey, log);

  const styleLabel = request.style === "clone"
    ? "COM CLONE (criador aparece na câmera — roteiro de presença direta)"
    : "SEM FACE (narração em off — criador não aparece — screen/animação)";

  const userMessage = `Crie um roteiro de vídeo diário completo.

**Tópico:** ${request.topic}
**Formato:** ${request.format} — duração: ${FORMAT_DURATION[request.format]}
**Estilo:** ${styleLabel}
**Tom:** ${request.tone ?? "natural, direto, brasileiro"}
**Objetivo:** ${request.goal ?? "engagement"}
${request.productName ? `**Produto/Serviço:** ${request.productName}` : ""}
${request.targetAudience ? `**Público-alvo:** ${request.targetAudience}` : ""}
${request.campaignContext ? `**Contexto da campanha:** ${request.campaignContext}` : ""}

**PROCESSO:**
1. Declare o pattern interrupt dos primeiros 3 segundos
2. Escreva o roteiro COMPLETO — cada seção com fala pronta para gravar
3. Para "${request.style === "no_face" ? "SEM FACE" : "COM CLONE"}": adapte todas as instruções visuais ao estilo correto
4. Captions em PT-BR coloquial, prontas para editor de vídeo
5. Upload instructions específicas para o público e formato

Retorne APENAS o JSON do roteiro.`;

  const result = await runAgent({
    campaignId: null,
    workspaceId,
    agentRole: "copywriter",
    messages: [{ role: "user", content: userMessage }],
    systemPrompt: DAILY_VIDEO_PROMPT,
    log,
  });

  const parsed = parseAgentJSON<DailyVideoScript>(result.content, {
    title: `Vídeo — ${request.topic}`,
    format: request.format,
    style: request.style,
    durationEstimate: FORMAT_DURATION[request.format],
    creditsCost: creditCost,
    hook: { openingLine: "", patternInterrupt: "" },
    script: result.content,
    sections: [],
    captions: [],
    cta: "",
    hashtags: [],
    thumbnailDirection: "",
    uploadInstructions: { bestPlatforms: [], bestTime: "", captionSuggestion: "", firstComment: "" },
    productionNotes: "",
  });

  return { ...parsed, creditsCost: creditCost };
}
