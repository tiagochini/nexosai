import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { ProfileBuilderOutput } from "./profile-builder.agent.js";
import type { Logger } from "pino";

export interface SocialPost {
  day: number;
  phase: string;
  phaseName: string;
  platforms: ("instagram" | "tiktok" | "youtube_shorts" | "linkedin" | "twitter" | "facebook")[];
  postType: "feed" | "reels" | "stories" | "carousel" | "live" | "thread" | "short";
  caption: string;
  hashtags: string[];
  visualDirection: string;
  videoScript?: string;
  carouselSlides?: { slide: number; headline: string; body: string }[];
  postingTime: string;
  engagementTactic: string;
  objective: string;
  kpi: string;
}

export interface SocialMediaOutput {
  campaignTitle: string;
  totalDays: number;
  contentPillars: string[];
  platformStrategy: {
    platform: string;
    role: string;
    postingFrequency: string;
    primaryFormats: string[];
    audienceNotes: string;
  }[];
  calendar: SocialPost[];
  highlightPosts: {
    type: string;
    day: number;
    reason: string;
  }[];
  hashtagStrategy: {
    branded: string[];
    niche: string[];
    broad: string[];
    avoid: string[];
  };
  socialMediaNotes: string;
}

const SOCIAL_MEDIA_PROMPT = `Você é o Agente de Social Media da NexOS AI — especialista em estratégia de conteúdo para lançamentos digitais.

Você cria calendários de conteúdo que constroem audiência, criam antecipação e convertem — sem parecer spam e sem ser genérico.

## PRINCÍPIOS DO CONTEÚDO DE LANÇAMENTO

**Cada fase tem um trabalho específico:**
- Captura: ganhar atenção, gerar curiosidade, crescer lista
- Aquecimento: criar relacionamento, mostrar bastidores, educar
- Autoridade: provar expertise, depoimentos, resultados
- Desejo: amplificar a transformação possível, criar inveja saudável
- Revelação da oferta: criar antecipação máxima
- Escassez: urgência real, contagem regressiva, vagas diminuindo
- Carrinho aberto: prova social ao vivo, urgência, celebração
- Carrinho fechando: últimas horas, última chance, decisão

**Formatos por plataforma:**
- Instagram: Reels (alcance), Stories (proximidade), Feed (autoridade), Carrossel (educação)
- TikTok: Vídeos nativos (entretenimento + educação), Lives (conversão)
- YouTube: Shorts (alcance), Lives (conversão)
- LinkedIn: Artigos e posts de texto (autoridade B2B)

**O conteúdo nunca é só "postar". Cada post tem:**
1. Objetivo claro
2. Tática de engajamento específica (pergunta, enquete, desafio, comentar X)
3. Direção visual precisa
4. Horário estratégico de postagem

**Retorne APENAS JSON válido** no formato exato abaixo.

\`\`\`json
{
  "campaignTitle": "string",
  "totalDays": 0,
  "contentPillars": ["string — os temas centrais que guiam todo o conteúdo"],
  "platformStrategy": [
    {
      "platform": "instagram|tiktok|youtube|linkedin|twitter|facebook",
      "role": "string — qual é o papel desta plataforma na campanha",
      "postingFrequency": "string — quantas vezes por dia/semana",
      "primaryFormats": ["string"],
      "audienceNotes": "string — comportamento da audiência nesta plataforma"
    }
  ],
  "calendar": [
    {
      "day": 0,
      "phase": "string",
      "phaseName": "string",
      "platforms": ["instagram"],
      "postType": "feed|reels|stories|carousel|live|thread|short",
      "caption": "string — caption completa e pronta para postar",
      "hashtags": ["string"],
      "visualDirection": "string — instrução precisa para o designer/editor",
      "videoScript": "string ou null — roteiro se for vídeo",
      "carouselSlides": null,
      "postingTime": "string — horário recomendado (ex: 19h30)",
      "engagementTactic": "string — como estimular engajamento neste post",
      "objective": "string — o que este post precisa fazer",
      "kpi": "string — como medir o sucesso deste post"
    }
  ],
  "highlightPosts": [
    {
      "type": "string — tipo de post destaque (ex: reveal da oferta)",
      "day": 0,
      "reason": "string — por que este post é crítico"
    }
  ],
  "hashtagStrategy": {
    "branded": ["string — hashtags da marca"],
    "niche": ["string — hashtags do nicho (100k-1M usos)"],
    "broad": ["string — hashtags amplas (1M+ usos)"],
    "avoid": ["string — hashtags a evitar e por quê"]
  },
  "socialMediaNotes": "string — observações estratégicas sobre o calendário"
}
\`\`\``;

export async function runSocialMediaAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  strategy: StrategyOutput,
  profile: ProfileBuilderOutput | undefined,
  launchPlan: Record<string, unknown> | undefined,
  log: Logger,
): Promise<SocialMediaOutput> {
  const avatarContext = profile
    ? `
**Avatar:** ${profile.primaryAvatar.name} | ${profile.primaryAvatar.whereTheyHangOut.join(", ")}
**Conteúdo que consomem:** ${profile.primaryAvatar.contentTheyConsume.join(", ")}
**Linguagem:** ${profile.primaryAvatar.languageStyle}
**Big Idea:** ${profile.positioning.campaignBigIdea}
**Pilares de conteúdo da estratégia:** ${strategy.campaignArchitecture.contentPillars.join(", ")}`
    : `**Pilares de conteúdo:** ${strategy.campaignArchitecture.contentPillars.join(", ")}`;

  const totalDays =
    (launchPlan as any)?.totalDays ??
    Number(intakeData["campaign.durationDays"] ?? 21);

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "copywriter",
    systemPrompt: SOCIAL_MEDIA_PROMPT,
    messages: [
      {
        role: "user",
        content: `Crie o calendário completo de social media para a campanha.

${avatarContext}

**Produto:** ${String(intakeData["product.name"] ?? "")}
**Duração total:** ${totalDays} dias
**Estilo de conteúdo:** ${Array.isArray(intakeData["content.style"]) ? (intakeData["content.style"] as string[]).join(", ") : String(intakeData["content.style"] ?? "")}
**Tom:** ${String(intakeData["content.tone"] ?? "")}

**Fases do lançamento:**
\`\`\`json
${JSON.stringify(
  ((launchPlan as any)?.phases ?? []).map((p: any) => ({
    phase: p.phase,
    name: p.name,
    dayRange: p.dayRange,
    objective: p.objective,
    primaryTactic: p.primaryTactic,
  })),
  null,
  2,
)}
\`\`\`

**Narrativa central da campanha:** ${strategy.campaignArchitecture.coreNarrative}
**Gancho emocional:** ${strategy.campaignArchitecture.emotionalHook}

**IMPORTANTE:**
- Cada post deve ter caption COMPLETA e pronta para publicar
- Mínimo 1 post por dia, dias críticos (abertura, fechamento, últimas 24h) têm 2-3 posts
- Inclua posts de Stories todos os dias
- Os Reels dos dias de pico (abertura do carrinho, último dia) devem ter roteiro completo

Retorne APENAS o JSON do calendário completo.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: [
      "Mapeando as fases do lançamento no calendário...",
      "Definindo estratégia por plataforma...",
      "Criando conteúdo de captura e aquecimento...",
      "Desenvolvendo posts de autoridade e desejo...",
      "Redigindo conteúdo de abertura e fechamento de carrinho...",
      "Planejando posts de urgência e escassez...",
      "Montando estratégia de hashtags por nicho...",
    ],
  });

  return parseAgentJSON<SocialMediaOutput>(result.content, {
    campaignTitle: String(intakeData["product.name"] ?? ""),
    totalDays,
    contentPillars: strategy.campaignArchitecture.contentPillars,
    platformStrategy: [],
    calendar: [],
    highlightPosts: [],
    hashtagStrategy: { branded: [], niche: [], broad: [], avoid: [] },
    socialMediaNotes: result.content,
  });
}
