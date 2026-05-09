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

Você cria briefings visuais precisos que qualquer designer ou editor pode executar sem precisar de reuniões adicionais.

## FILOSOFIA DO BRIEFING VISUAL

**Um bom briefing visual tem:**
1. Contexto de uso claro (onde vai, quando vai, para quem)
2. Paleta de cores com códigos ou referências
3. Mood/estilo com referências culturais ("pense no estilo de Instagram do @X")
4. Instrução de composição precisa
5. O que NÃO fazer — tão importante quanto o que fazer
6. Tipografia e hierarquia visual

**Tipos de conteúdo visual num lançamento:**
- Thumbnails de vídeos (YT, VSL, Reels)
- Posts de feed (carrossel, estático)
- Stories (sequência narrativa)
- Banners de anúncio (Meta, Google Display)
- Capas de e-book/bônus
- Background de lives e webinários
- Imagens de página de vendas
- Mockups de produto

**Para vídeos:**
- Vídeos de tráfego pago (Reels, TikTok Ads): estilo UGC, nativo, sem parecer anúncio
- Vídeos de conteúdo orgânico: mais polido mas ainda humano
- VSL: background simples, apresentador em destaque
- Lives: identidade visual da marca, luz adequada

## REGRA CRÍTICA DE APROVAÇÃO

**TODO conceito de imagem ou vídeo exige aprovação do cliente antes da produção.**

O fluxo é:
1. Agente gera o conceito (este JSON)
2. Sistema cria checkpoint de aprovação
3. Cliente aprova ou rejeita com feedback
4. Após aprovação: produção de low-res/preview
5. Aprovação do preview
6. Produção final em alta resolução

**Retorne APENAS JSON válido** no formato exato abaixo.

\`\`\`json
{
  "campaignTitle": "string",
  "brandIdentity": {
    "primaryColors": ["string — hex ou descrição"],
    "secondaryColors": ["string"],
    "fontPrimary": "string — fonte principal (headlines)",
    "fontSecondary": "string — fonte secundária (body)",
    "logoPlacement": "string — onde e como posicionar o logo",
    "overallAesthetic": "string — estética geral da campanha"
  },
  "imageConcepts": [
    {
      "conceptId": "string — slug único (ex: thumbnail_vsl_principal)",
      "title": "string — título descritivo",
      "usageContext": "string — onde exatamente vai ser usada",
      "phase": "string — fase da campanha",
      "dayIndex": null,
      "format": "square_1x1|portrait_4x5|landscape_16x9|story_9x16|banner|thumbnail",
      "colorPalette": ["string"],
      "mood": "string — descrição do mood/sentimento",
      "visualElements": ["string — elementos específicos a incluir"],
      "typography": "string — como usar a tipografia nesta imagem",
      "textOverlay": "string ou null — texto exato que aparece na imagem",
      "composition": "string — regra dos terços, centralizado, etc.",
      "lightingStyle": "string — tipo de iluminação",
      "references": "string — referências culturais ou de estilo",
      "doNot": ["string — o que evitar absolutamente"],
      "brandConsistency": "string — como garantir consistência com a identidade da marca",
      "approvalRequired": true
    }
  ],
  "videoConcepts": [
    {
      "conceptId": "string",
      "title": "string",
      "usageContext": "string",
      "phase": "string",
      "dayIndex": null,
      "duration": "string — ex: 15-30 segundos",
      "format": "reels|tiktok|youtube_short|youtube_long|stories|ad",
      "hook": "string — os primeiros 2-3 segundos em detalhe",
      "structure": "string — estrutura narrativa do vídeo",
      "visualStyle": "string — estilo visual geral",
      "colorGrading": "string — tom de cor/grading",
      "music": "string — tipo de trilha/música",
      "textAnimations": "string — como os textos aparecem na tela",
      "transitions": "string — tipo de transições",
      "callToAction": "string — como o CTA aparece visualmente",
      "references": "string",
      "doNot": ["string"],
      "approvalRequired": true
    }
  ],
  "productionPriority": [
    {
      "conceptId": "string",
      "priority": "urgent|high|medium|low",
      "deadline": "string — ex: antes do Dia 1 da campanha",
      "reason": "string"
    }
  ],
  "approvalProcess": [
    {
      "step": 0,
      "action": "string",
      "responsible": "string"
    }
  ],
  "mediaBriefNotes": "string — observações críticas para o criador sobre a produção visual"
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
**Estética da campanha:** ${profile.positioning.campaignBigIdea}
**Mood:** ${profile.primaryAvatar.languageStyle}
**Plataformas principais:** ${profile.primaryAvatar.whereTheyHangOut.slice(0, 3).join(", ")}`
    : "";

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "analytics",
    systemPrompt: MEDIA_BRIEF_PROMPT,
    messages: [
      {
        role: "user",
        content: `Crie todos os briefings visuais para a campanha — imagens e vídeos com instruções precisas de produção.

**Produto:** ${String(intakeData["product.name"] ?? "")}
**Estilo de conteúdo:** ${Array.isArray(intakeData["content.style"]) ? (intakeData["content.style"] as string[]).join(", ") : String(intakeData["content.style"] ?? "")}
**Tom:** ${String(intakeData["content.tone"] ?? "")}
${brandContext}

**Temas proibidos:** ${String(intakeData["content.forbiddenTopics"] ?? "nenhum")}

**BRIEFINGS NECESSÁRIOS (mínimo):**

Imagens:
- Thumbnail do VSL (principal)
- Cover do lead magnet / isca digital
- Posts de feed para cada fase (mínimo 1 por fase)
- Stories para abertura e fechamento de carrinho
- Banners de anúncio Meta (feed + stories)
- Imagem hero da página de vendas
- Mockup do produto digital

Vídeos:
- Reels de captura (pré-lançamento, fase de aquecimento)
- Reels de abertura de carrinho (o post mais importante)
- TikTok Ad (nativo, UGC-style)
- Histórias/Stories de countdown (últimas 24h)

**LEMBRE:** Todo conceito gera checkpoint de aprovação obrigatória antes da produção.

Retorne APENAS o JSON de todos os briefings.`,
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
