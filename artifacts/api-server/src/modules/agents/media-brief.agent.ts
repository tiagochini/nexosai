import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { ProfileBuilderOutput } from "./profile-builder.agent.js";
import type { Logger } from "pino";

export interface ImageConcept {
  conceptId: string;
  title: string;
  usageContext: string;
  phase: string;
  dayIndex?: number;
  format: "square_1x1" | "portrait_4x5" | "landscape_16x9" | "story_9x16" | "banner" | "thumbnail";
  colorPalette: string[];
  mood: string;
  visualElements: string[];
  typography: string;
  textOverlay?: string;
  composition: string;
  lightingStyle: string;
  references: string;
  doNot: string[];
  brandConsistency: string;
  approvalRequired: true;
}

export interface VideoConcept {
  conceptId: string;
  title: string;
  usageContext: string;
  phase: string;
  dayIndex?: number;
  duration: string;
  format: "reels" | "tiktok" | "youtube_short" | "youtube_long" | "stories" | "ad";
  hook: string;
  structure: string;
  visualStyle: string;
  colorGrading: string;
  music: string;
  textAnimations: string;
  transitions: string;
  callToAction: string;
  references: string;
  doNot: string[];
  approvalRequired: true;
}

export interface MediaBriefOutput {
  campaignTitle: string;
  brandIdentity: {
    primaryColors: string[];
    secondaryColors: string[];
    fontPrimary: string;
    fontSecondary: string;
    logoPlacement: string;
    overallAesthetic: string;
  };
  imageConcepts: ImageConcept[];
  videoConcepts: VideoConcept[];
  productionPriority: {
    conceptId: string;
    priority: "urgent" | "high" | "medium" | "low";
    deadline: string;
    reason: string;
  }[];
  approvalProcess: {
    step: number;
    action: string;
    responsible: string;
  }[];
  mediaBriefNotes: string;
}

const MEDIA_BRIEF_PROMPT = `Você é o Agente de Briefing de Mídia da NexOS AI — especialista em direção de arte para lançamentos digitais.

Crie briefings visuais precisos que qualquer designer pode executar sem reuniões adicionais.

Retorne APENAS JSON válido no formato abaixo. Seja conciso: máximo 5 imageConcepts e 3 videoConcepts.

\`\`\`json
{
  "campaignTitle": "string",
  "brandIdentity": {
    "primaryColors": ["#hex"],
    "secondaryColors": ["#hex"],
    "fontPrimary": "string",
    "fontSecondary": "string",
    "logoPlacement": "string",
    "overallAesthetic": "string — 1 frase"
  },
  "imageConcepts": [
    {
      "conceptId": "slug_unico",
      "title": "string",
      "usageContext": "string — onde e quando",
      "phase": "pre_launch|launch|cart_open|cart_close",
      "dayIndex": 0,
      "format": "square_1x1|portrait_4x5|landscape_16x9|story_9x16|banner|thumbnail",
      "colorPalette": ["#hex"],
      "mood": "string — 1 frase",
      "visualElements": ["elemento 1", "elemento 2"],
      "typography": "string",
      "textOverlay": "texto exato ou null",
      "composition": "string",
      "lightingStyle": "string",
      "references": "string",
      "doNot": ["item 1"],
      "brandConsistency": "string",
      "approvalRequired": true
    }
  ],
  "videoConcepts": [
    {
      "conceptId": "slug_unico",
      "title": "string",
      "usageContext": "string",
      "phase": "string",
      "dayIndex": 0,
      "duration": "15-30s",
      "format": "reels|tiktok|youtube_short|youtube_long|stories|ad",
      "hook": "string — primeiros 3 segundos",
      "structure": "string",
      "visualStyle": "string",
      "colorGrading": "string",
      "music": "string",
      "textAnimations": "string",
      "transitions": "string",
      "callToAction": "string",
      "references": "string",
      "doNot": ["item 1"],
      "approvalRequired": true
    }
  ],
  "productionPriority": [
    { "conceptId": "string", "priority": "urgent|high|medium|low", "deadline": "string", "reason": "string" }
  ],
  "approvalProcess": [
    { "step": 1, "action": "Revisar e aprovar conceitos", "responsible": "criador" },
    { "step": 2, "action": "Produzir preview low-res", "responsible": "designer" },
    { "step": 3, "action": "Aprovar e produzir final", "responsible": "criador + designer" }
  ],
  "mediaBriefNotes": "string — 2-3 observações críticas de produção"
}
\`\`\``;

export async function runMediaBriefAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  profile: ProfileBuilderOutput | undefined,
  socialCalendar: Record<string, unknown> | undefined,
  log: Logger,
): Promise<MediaBriefOutput> {
  const brandContext = profile
    ? `
**Estética da campanha:** ${profile.positioning?.campaignBigIdea ?? ""}
**Mood:** ${profile.primaryAvatar?.languageStyle ?? ""}
**Plataformas principais:** ${(profile.primaryAvatar?.whereTheyHangOut ?? []).slice(0, 3).join(", ")}`
    : "";

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "analytics",
    systemPrompt: MEDIA_BRIEF_PROMPT,
    messages: [
      {
        role: "user",
        content: `Crie os briefings visuais prioritários para o lançamento. Máximo 5 imagens + 3 vídeos.

**Produto:** ${String(intakeData["product.name"] ?? "")}
**Tom:** ${String(intakeData["content.tone"] ?? "")}
${brandContext}

Imagens obrigatórias (5): thumbnail VSL, hero da página de vendas, banner Meta feed, stories de abertura de carrinho, mockup do produto.
Vídeos obrigatórios (3): reel de captura (pré-lançamento), reel de abertura de carrinho, TikTok ad nativo.

Retorne APENAS o JSON.`,
      },
    ],
    log,
    requiresApproval: true,
    checkpointType: "media_concept_approval",
    thinkingMessages: [
      "Definindo identidade visual e paleta da campanha...",
      "Criando briefings de thumbnails e imagens estáticas...",
      "Desenvolvendo conceitos de Reels e TikTok nativos...",
      "Estruturando conteúdo visual para abertura de carrinho...",
      "Detalhando briefings de anúncios para Meta e Google...",
      "Priorizando produção por urgência e impacto...",
    ],
  });

  return parseAgentJSON<MediaBriefOutput>(result.content, {
    campaignTitle: String(intakeData["product.name"] ?? ""),
    brandIdentity: {
      primaryColors: [],
      secondaryColors: [],
      fontPrimary: "",
      fontSecondary: "",
      logoPlacement: "",
      overallAesthetic: "",
    },
    imageConcepts: [],
    videoConcepts: [],
    productionPriority: [],
    approvalProcess: [
      { step: 1, action: "Revisar conceitos gerados pela IA", responsible: "criador" },
      { step: 2, action: "Aprovar ou rejeitar cada conceito com feedback", responsible: "criador" },
      { step: 3, action: "Produzir preview low-res", responsible: "designer" },
      { step: 4, action: "Aprovação final do preview", responsible: "criador" },
      { step: 5, action: "Produção em alta resolução", responsible: "designer" },
    ],
    mediaBriefNotes: result.content,
  });
}
