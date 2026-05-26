import { completeWithAgent } from "../ai-gateway/ai-gateway.service.js";
import { parseAgentJSON } from "./agent.runner.js";
import { deductCredits } from "../credits/credits.service.js";
import type { Logger } from "pino";
import type { VideoScene, VideoConfig } from "@workspace/db";

export interface StoryboardInput {
  productName: string;
  productDescription: string;
  targetAudience: string;
  format: string;
  script: string;
  config: Partial<VideoConfig>;
  campaignId?: string | null;
  workspaceId: string;
}

const SCENE_TYPES = ["hook", "problem", "solution", "proof", "cta", "bridge", "transition"] as const;

const SYSTEM_PROMPT = `Você é o Diretor de Cena da NexOS AI — especialista em transformar roteiros em storyboards cena a cena otimizados para conversão no mercado digital brasileiro.

Você analisa o roteiro fornecido e divide em cenas individuais (máximo 12 cenas, mínimo 4), cada uma com:
- Duração adequada (4 a 8 segundos por cena — limite técnico do gerador de vídeo)
- Descrição visual cinematográfica ultra-detalhada (para geração automática)
- Narração/locução precisa para aquela cena
- Paleta de cores, estilo visual, transição e mood

Você entende ritmo persuasivo: hook forte nos primeiros 3s, escalada de tensão no problema, alívio na solução, prova social, e CTA urgente.

REGRA CRÍTICA: O campo "videoPrompt" deve estar em inglês, ultra-detalhado, estilo cinematográfico profissional, e NÃO pode conter texto ou legendas visíveis na cena (texto é sobreposto depois).

Retorne APENAS JSON válido sem texto extra:
{
  "scenes": [
    {
      "id": "scene_01",
      "order": 1,
      "title": "nome curto da cena",
      "durationSeconds": 6,
      "voiceoverText": "exato texto de locução para esta cena",
      "visualDescription": "descrição visual em PT-BR — o que acontece na cena",
      "sceneType": "hook|problem|solution|proof|cta|bridge|transition",
      "style": "cinematográfico moderno|minimalista|dinâmico|aspiracional",
      "palette": ["#hex1", "#hex2", "#hex3"],
      "transition": "cut|fade|dissolve|zoom_in|pan_right",
      "mood": "urgente|inspiracional|empático|energético|sofisticado",
      "hasAvatar": false,
      "videoPrompt": "detailed cinematic video prompt in English, NO text or subtitles visible"
    }
  ],
  "totalDurationSeconds": 42,
  "phaseSummary": "Hook (6s) → Problema (12s) → Solução (12s) → Prova (6s) → CTA (6s)",
  "directorNotes": "observações sobre ritmo, estilo e escolhas narrativas"
}`;

export async function runSceneDirectorAgent(
  input: StoryboardInput,
  log: Logger,
): Promise<{ scenes: VideoScene[]; totalDurationSeconds: number; phaseSummary: string; directorNotes: string }> {
  await deductCredits(input.workspaceId, "video_storyboard", log, input.campaignId ?? undefined);

  const hasAvatar = input.config.hasUserFace ?? false;
  const voiceStyle = input.config.voiceStyle ?? "narrator";
  const aspectRatio = input.config.aspectRatio ?? "16:9";
  const rhythm = input.config.rhythm ?? "medium";
  const tone = input.config.tone ?? "inspirational";

  const userContent = `Produto: ${input.productName}
${input.productDescription ? `Descrição: ${input.productDescription}` : ""}
Público-alvo: ${input.targetAudience}
Formato de vídeo: ${input.format.replace(/_/g, " ").toUpperCase()}
Proporção: ${aspectRatio} | Ritmo: ${rhythm} | Tom: ${tone}
${hasAvatar ? "⚠️ O APRESENTADOR APARECERÁ no vídeo — inclua cenas de talking-head (hasAvatar: true) nos momentos-chave" : "Vídeo sem apresentador visível — use cenários, animações, imagens de produto e B-roll"}
Estilo de voz: ${voiceStyle}
${input.config.styleKeywords?.length ? `Estilo visual desejado: ${input.config.styleKeywords.join(", ")}` : ""}
${input.config.palette?.length ? `Paleta de cores preferida: ${input.config.palette.join(", ")}` : ""}

ROTEIRO COMPLETO:
${input.script}

Crie o storyboard cena a cena. Cada cena deve ter exatamente entre 4 e 8 segundos.`;

  const result = await completeWithAgent(
    "scene_director",
    SYSTEM_PROMPT,
    [{ role: "user", content: userContent }],
    input.workspaceId,
    log,
    input.campaignId ?? undefined,
  );

  const parsed = parseAgentJSON<{
    scenes: VideoScene[];
    totalDurationSeconds: number;
    phaseSummary: string;
    directorNotes: string;
  }>(result.content, { scenes: [], totalDurationSeconds: 0, phaseSummary: "", directorNotes: "" });

  if (!parsed.scenes?.length) {
    throw new Error("Scene Director retornou storyboard vazio — resposta inválida da IA");
  }

  const scenes: VideoScene[] = parsed.scenes.map((s, i) => ({
    id: s.id ?? `scene_${String(i + 1).padStart(2, "0")}`,
    order: s.order ?? i + 1,
    title: s.title ?? `Cena ${i + 1}`,
    durationSeconds: Math.min(8, Math.max(4, s.durationSeconds ?? 6)),
    voiceoverText: s.voiceoverText ?? "",
    visualDescription: s.visualDescription ?? "",
    sceneType: SCENE_TYPES.includes(s.sceneType as (typeof SCENE_TYPES)[number])
      ? (s.sceneType as VideoScene["sceneType"])
      : "bridge",
    style: s.style ?? "cinematographic",
    palette: Array.isArray(s.palette) ? s.palette : [],
    transition: s.transition ?? "cut",
    mood: s.mood ?? "inspirational",
    hasAvatar: Boolean(s.hasAvatar),
    videoPrompt: s.videoPrompt ?? s.visualDescription ?? "",
    clipStatus: "pending" as const,
  }));

  return {
    scenes,
    totalDurationSeconds: parsed.totalDurationSeconds ?? scenes.reduce((a, s) => a + s.durationSeconds, 0),
    phaseSummary: parsed.phaseSummary ?? "",
    directorNotes: parsed.directorNotes ?? "",
  };
}
