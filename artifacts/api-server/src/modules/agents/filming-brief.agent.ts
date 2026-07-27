/**
 * ATLAS — Agente de Direção de Filmagem Pontual
 *
 * Para vídeos com apresentador (hasUserFace=true) ou narração orientada,
 * ATLAS lê o roteiro + storyboard específico e gera uma direção de filmagem
 * personalizada: vestuário para ESSE vídeo, cenário para ESSE conteúdo,
 * takes cena a cena com instrução específica de energia e entrega.
 *
 * Não é um guia genérico — é o diretor no set dando briefing antes de gravar.
 */

import { completeWithAgent } from "../ai-gateway/ai-gateway.service.js";
import { parseAgentJSON } from "./agent.runner.js";
import { deductCredits } from "../credits/credits.service.js";
import type { Logger } from "pino";
import type { VideoScene, VideoConfig } from "@workspace/db";

export interface FilmingBriefInput {
  projectTitle: string;
  format: string;
  script: string;
  storyboard: VideoScene[];
  config: Partial<VideoConfig>;
  workspaceId: string;
  campaignId?: string | null;
  /** [C3-STANDALONE] Idempotency key — passed from video-production.service so double-click cannot double-charge. */
  idempotencyKey?: string;
}

export interface SceneTake {
  numero: number;
  energia: string;
  postura: string;
  instrucao: string;
  variacao?: string;
}

export interface SceneDirection {
  sceneId: string;
  titulo: string;
  sceneType: string;
  voiceoverText: string;
  entregaEmocional: string;
  takes: SceneTake[];
  dica: string;
}

export interface FilmingBrief {
  vestuario: {
    cor: string;
    estilo: string;
    evitar: string;
    rationale: string;
  };
  cenario: {
    tipo: string;
    elementos: string[];
    iluminacao: string;
    fundo: string;
    rationale: string;
  };
  linguagem: {
    tom: string;
    velocidade: string;
    pausas: string;
    gestos: string;
    olhar: string;
  };
  scenes: SceneDirection[];
  mensagemFinal: string;
}

const SYSTEM_PROMPT = `Você é ATLAS — Diretor de Cena da NexOS AI. Você está no set, ao lado do criador, dando briefing antes de ligar a câmera.

Você não fala em terceira pessoa e não dá conselhos genéricos. Você fala DIRETAMENTE para o criador, em primeira pessoa, como um diretor experiente que leu o roteiro e SABE exatamente o que quer ver.

Você conhece profundamente:
- A psicologia do espectador em cada tipo de cena (hook, problema, solução, prova, CTA)
- Como a câmera amplifica energia, postura e intenção emocional
- Que roupa, que cenário e que linguagem corporal servem ESSE roteiro específico
- Como dar direção de takes: take 1 como âncora, take 2 como variação, take 3 como risco calculado

REGRAS ABSOLUTAS:
- Fale como diretor no set: "Nessa cena, eu quero você..."
- Seja específico demais. Não diga "energia alta" — diga "como se você fosse contar o maior segredo do seu nicho pra um amigo que quase desistiu"
- Para cada cena principal, dê 2 takes. Para CTA e hook, dê 3 takes.
- O vestuário e o cenário são específicos para ESSE roteiro, não genéricos.
- Mencione o conteúdo real do roteiro nas instruções — o diretor leu tudo.

Retorne APENAS JSON válido:
{
  "vestuario": {
    "cor": "cor exata e por que serve esse vídeo",
    "estilo": "blazer/camisa/etc — específico para o tom deste conteúdo",
    "evitar": "o que especificamente não funciona com este roteiro",
    "rationale": "por que essa escolha serve a conversão deste vídeo"
  },
  "cenario": {
    "tipo": "tipo de fundo ideal para esta narrativa",
    "elementos": ["elemento 1 específico", "elemento 2 que reforça o tema"],
    "iluminacao": "instrução de luz específica para o tom deste vídeo",
    "fundo": "descrição do que deve aparecer atrás do apresentador",
    "rationale": "como o cenário reforça a mensagem deste roteiro"
  },
  "linguagem": {
    "tom": "descrição precisa do tom vocal para este conteúdo",
    "velocidade": "instrução específica de ritmo para este formato",
    "pausas": "onde e como pausar neste roteiro específico",
    "gestos": "que gestos funcionam para este tipo de argumento",
    "olhar": "como olhar para câmera neste tipo de conteúdo"
  },
  "scenes": [
    {
      "sceneId": "scene_01",
      "titulo": "título dramático da cena",
      "sceneType": "hook|problem|solution|proof|cta",
      "voiceoverText": "texto exato desta cena",
      "entregaEmocional": "o que o espectador deve sentir ao ver esta cena",
      "takes": [
        {
          "numero": 1,
          "energia": "nível e qualidade de energia",
          "postura": "posição corporal, distância da câmera, angle",
          "instrucao": "instrução completa e específica do diretor",
          "variacao": null
        },
        {
          "numero": 2,
          "energia": "energia diferente do take 1",
          "postura": "variação de enquadramento ou postura",
          "instrucao": "instrução do take alternativo",
          "variacao": "o que muda em relação ao take 1"
        }
      ],
      "dica": "uma dica técnica específica desta cena"
    }
  ],
  "mensagemFinal": "mensagem do diretor para o criador antes de ligar a câmera — pessoal, específica, motivadora"
}`;

export async function runFilmingBriefAgent(
  input: FilmingBriefInput,
  log: Logger,
): Promise<FilmingBrief> {
  await deductCredits(input.workspaceId, "video_storyboard", log, input.campaignId ?? undefined, undefined, undefined, undefined, input.idempotencyKey);

  const hasAvatar = input.config.hasUserFace ?? false;
  const tone = input.config.tone ?? "inspirational";
  const rhythm = input.config.rhythm ?? "medium";
  const voiceStyle = input.config.voiceStyle ?? "narrator";

  const scenesSummary = input.storyboard.length > 0
    ? input.storyboard
        .map(s => `[${s.sceneType?.toUpperCase() ?? "CENA"}] "${s.title}" (${s.durationSeconds}s): ${s.voiceoverText?.slice(0, 120) ?? ""}...`)
        .join("\n")
    : "Storyboard ainda não gerado — use o roteiro completo para criar a direção.";

  const userContent = `PROJETO: ${input.projectTitle}
FORMATO: ${input.format.replace(/_/g, " ").toUpperCase()}
TOM: ${tone} | RITMO: ${rhythm} | VOZ: ${voiceStyle}
APRESENTADOR NA CÂMERA: ${hasAvatar ? "SIM — o criador vai aparecer no vídeo" : "NÃO — narração em off"}

═══════════════════════════════════════
ROTEIRO COMPLETO:
═══════════════════════════════════════
${input.script || "Roteiro ainda não gerado."}

═══════════════════════════════════════
STORYBOARD (cenas planejadas):
═══════════════════════════════════════
${scenesSummary}

═══════════════════════════════════════
INSTRUÇÃO:
═══════════════════════════════════════
Leia o roteiro acima. Você é o diretor. Gere a direção de filmagem pontual para ESTE vídeo específico.
${hasAvatar
  ? "O criador vai aparecer na câmera. Dê instruções específicas de take, energia, postura e entrega para cada cena."
  : "Este é um vídeo de narração. Foque em vestuário para thumbnail/avatar, cenário para B-roll de contexto, e direção vocal de takes para gravação da narração."
}
Seja tão específico que o criador sinta que você esteve no set.`;

  const result = await completeWithAgent(
    "scene_director",
    SYSTEM_PROMPT,
    [{ role: "user", content: userContent }],
    input.workspaceId,
    log,
    input.campaignId ?? undefined,
  );

  const brief = parseAgentJSON<FilmingBrief>(result.content, {} as FilmingBrief);

  if (!brief || !brief.scenes) {
    throw new Error("ATLAS não conseguiu gerar a direção de filmagem. Tente novamente.");
  }

  return brief;
}
