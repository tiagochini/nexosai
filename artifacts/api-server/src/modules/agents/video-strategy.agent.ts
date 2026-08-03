import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { ProfileBuilderOutput } from "./profile-builder.agent.js";
import type { Logger } from "pino";

export interface VideoSeriesEpisode {
  episodeNumber: number;
  title: string;
  hook: string;
  mainAngle: string;
  keyMessage: string;
  cta: string;
  thumbnailConcept: string;
  estimatedDuration: string;
  seoKeyword: string;
  publishDate: string;
}

export interface VideoStrategyOutput {
  campaignTitle: string;
  channelStrategy: {
    primaryPlatform: string;
    secondaryPlatforms: string[];
    channelPositioning: string;
    uploadFrequency: string;
    bestTimeToPost: string[];
    contentMix: { type: string; percentage: number; rationale: string }[];
  };
  seriesPlanning: {
    seriesName: string;
    seriesHook: string;
    totalEpisodes: number;
    episodeFrequency: string;
    episodes: VideoSeriesEpisode[];
  };
  youtubeOptimization: {
    channelDescription: string;
    channelKeywords: string[];
    playlistStrategy: { name: string; description: string; videos: string[] }[];
    thumbnailStyle: string;
    endScreenStrategy: string;
    cardStrategy: string;
    communityTabStrategy: string;
  };
  shortFormStrategy: {
    platform: string;
    frequency: string;
    formats: string[];
    repurposing: string;
    hooks: string[];
  }[];
  seoStrategy: {
    primaryKeywords: string[];
    longTailKeywords: string[];
    titleFormulas: string[];
    descriptionTemplate: string;
    tagGroups: string[];
    chapterStrategy: string;
  };
  monetizationPath: {
    phase: string;
    strategy: string;
    requirement: string;
  }[];
  growthProjection: {
    month: number;
    expectedSubscribers: number;
    expectedMonthlyViews: number;
    milestone: string;
  }[];
  videoStrategyNotes: string;
}

const VIDEO_STRATEGY_PROMPT = `Você é o Agente de Estratégia de Vídeo da NexOS AI — especialista em crescimento e monetização via conteúdo em vídeo.

## BIBLIOTECA OBRIGATÓRIA — VIDEO CAMPAIGN AGENT

Você cria estratégias de vídeo que convertem dentro da estrutura de lançamento. Você DEVE dominar:

**ESTRUTURA CINEMATOGRÁFICA DE PERSUASÃO:**
- Story (Robert McKee) — conflito dramático, tensão, virada — o vídeo que não tem conflito não tem retenção
- Save The Cat (Blake Snyder) — os 15 beats: abertura impactante, fun & games, dark night, break into three — qualquer vídeo funciona melhor com essa estrutura
- Building a StoryBrand (Miller) — avatar como herói, marca como guia — nunca o contrário
- Hero With a Thousand Faces (Campbell) — jornada de transformação como estrutura emocional universal

**RETENÇÃO E THUMBSTOP:**
- TikTok Retention Frameworks — primeiros 1,5 segundos são sobrevivência; loop aberto; reward variável
- Curiosity Gap (Loewenstein) — criar a pergunta antes de dar a resposta; nunca responda no título
- Pattern Interrupt — quebrar o padrão de scroll; o inesperado é o que para o polegar
- Save The Cat — o "save the cat moment": mostrar algo que faz o espectador torcer pelo protagonista nos primeiros 10 segundos

**INTENSIDADE EMOCIONAL:**
- State Aiming (Frank Kern) — identificar o estado desejado do espectador e puxá-lo para lá com o vídeo
- Alchemy (Sutherland) — o irracional converte mais; percepção > lógica no vídeo
- Wizard of Ads (Roy H. Williams) — ícone emocional: um vídeo que planta uma imagem na mente que não sai

**FECHAMENTO E CONVERSÃO:**
- $100M Offers (Hormozi) — o vídeo de vendas deve mostrar valor percebido > preço ANTES de revelar preço
- Risk Reversal (Jay Abraham) — garantia no vídeo elimina o último obstáculo
- Pre-Suasion (Cialdini) — o estado mental do espectador nos primeiros segundos determina toda a recepção

**PLF × VÍDEO:** CPL ≠ VSL ≠ Stories de carrinho. Cada tipo de vídeo tem objetivo, duração e tom diferentes.

---


Você cria estratégias de canal que constroem audiência qualificada e se tornam ativos de médio e longo prazo para o criador.

## ESTRATÉGIA DE VÍDEO PARA PRODUTORES DIGITAIS

**O conteúdo em vídeo tem dois papéis em um lançamento:**
1. **Curto prazo:** CPL orgânico — conteúdo que atrai leads qualificados sem pagar por eles
2. **Longo prazo:** ativo de autoridade — cada vídeo continua trazendo resultado por meses/anos

**Hierarquia de plataformas para infoprodutores:**
- YouTube: ativo permanente, SEO de longo prazo, audiência qualificada
- Instagram Reels: alcance rápido, muito engajamento, ciclo curto
- TikTok: alcance viral, audiência mais jovem, menor conversão direta
- YouTube Shorts: alcance crescente, leva ao canal principal

**O que faz um canal converter (além de vídeos):**
- Playlist estratégica que leva do topo ao fundo do funil
- Descrições com CTA para isca digital / lista de espera
- Cards e telas finais guiando para vídeos de maior intenção
- Community tab para engajamento e coleta de feedback
- Lives mensais para aprofundar relacionamento

**SEO de YouTube:**
- Keyword research: volume x concorrência
- Títulos: keyword principal nos primeiros 50 caracteres
- Descrições: 2 primeiras linhas aparecem no resultado de busca
- Capítulos: aumentam tempo de visualização e aparecem no Google
- Tags: não são ranking factor mas ajudam na descoberta por associação

**Retorne APENAS JSON válido** no formato abaixo.

\`\`\`json
{
  "campaignTitle": "string",
  "channelStrategy": {
    "primaryPlatform": "string",
    "secondaryPlatforms": ["string"],
    "channelPositioning": "string — o posicionamento do canal em 1-2 frases",
    "uploadFrequency": "string",
    "bestTimeToPost": ["string — horários por plataforma"],
    "contentMix": [
      { "type": "string", "percentage": 0, "rationale": "string" }
    ]
  },
  "seriesPlanning": {
    "seriesName": "string",
    "seriesHook": "string — por que assistir esta série completa",
    "totalEpisodes": 0,
    "episodeFrequency": "string",
    "episodes": [
      {
        "episodeNumber": 1,
        "title": "string — título SEO-otimizado",
        "hook": "string — os primeiros 15 segundos",
        "mainAngle": "string — ângulo principal do episódio",
        "keyMessage": "string — a mensagem que o espectador deve levar",
        "cta": "string — call to action deste episódio",
        "thumbnailConcept": "string — instrução para a thumbnail",
        "estimatedDuration": "string",
        "seoKeyword": "string — keyword principal",
        "publishDate": "string — ex: Semana 1 do pré-lançamento"
      }
    ]
  },
  "youtubeOptimization": {
    "channelDescription": "string — descrição completa do canal",
    "channelKeywords": ["string"],
    "playlistStrategy": [
      {
        "name": "string",
        "description": "string",
        "videos": ["string — títulos dos vídeos da playlist"]
      }
    ],
    "thumbnailStyle": "string",
    "endScreenStrategy": "string",
    "cardStrategy": "string",
    "communityTabStrategy": "string"
  },
  "shortFormStrategy": [
    {
      "platform": "string",
      "frequency": "string",
      "formats": ["string"],
      "repurposing": "string — como reaproveitar conteúdo longo",
      "hooks": ["string — hooks de abertura para short-form"]
    }
  ],
  "seoStrategy": {
    "primaryKeywords": ["string"],
    "longTailKeywords": ["string"],
    "titleFormulas": ["string — fórmulas de título que performam bem no nicho"],
    "descriptionTemplate": "string — template de descrição com placeholders",
    "tagGroups": ["string — grupos de tags por tema"],
    "chapterStrategy": "string — como estruturar capítulos para SEO"
  },
  "monetizationPath": [
    {
      "phase": "string",
      "strategy": "string",
      "requirement": "string — o que é necessário para esta fase"
    }
  ],
  "growthProjection": [
    {
      "month": 1,
      "expectedSubscribers": 0,
      "expectedMonthlyViews": 0,
      "milestone": "string"
    }
  ],
  "videoStrategyNotes": "string — observações estratégicas para o criador"
}
\`\`\``;

export async function runVideoStrategyAgent(
  campaignId: string,
  workspaceId: string,
  intakeData: Record<string, unknown>,
  profile: ProfileBuilderOutput | undefined,
  log: Logger,
): Promise<VideoStrategyOutput> {
  const avatarContext = profile
    ? `Avatar: ${profile.primaryAvatar?.name ?? "Avatar principal"} | Plataformas: ${(profile.primaryAvatar?.whereTheyHangOut ?? []).join(", ")} | Conteúdo: ${(profile.primaryAvatar?.contentTheyConsume ?? []).join(", ")}`
    : "";

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "video_strategy",
    systemPrompt: VIDEO_STRATEGY_PROMPT,
    messages: [
      {
        role: "user",
        content: `Crie a estratégia completa de conteúdo em vídeo para o lançamento.

**Produto:** ${String(intakeData["product.name"] ?? "")} — categoria: ${String(intakeData["product.category"] ?? "")}
**Criador:** ${String(intakeData["creator.name"] ?? "")} — posicionamento: ${String(intakeData["creator.positioning"] ?? "")}
**Ângulo único:** ${String(intakeData["creator.uniqueAngle"] ?? "")}
${avatarContext}

**Período de pré-lançamento:** ${String(intakeData["campaign.durationDays"] ?? 21)} dias no total

**ENTREGÁVEIS:**
- Série de vídeos de pré-lançamento (mínimo 5 episódios com títulos e roteiro sumário)
- Estratégia de YouTube SEO completa
- Estratégia de short-form para Reels/TikTok/Shorts
- Projeção de crescimento de canal nos próximos 6 meses
- Plano de monetização progressivo

Retorne APENAS o JSON da estratégia de vídeo.`,
      },
    ],
    log,
    requiresApproval: false,
    thinkingMessages: [
      "Definindo posicionamento e mix de conteúdo do canal...",
      "Planejando série de vídeos de pré-lançamento...",
      "Otimizando estratégia de SEO para YouTube...",
      "Criando plano de short-form para Reels e TikTok...",
      "Projetando crescimento e monetização progressiva...",
    ],
  });

  return parseAgentJSON<VideoStrategyOutput>(result.content, {
    campaignTitle: String(intakeData["product.name"] ?? ""),
    channelStrategy: {
      primaryPlatform: "YouTube",
      secondaryPlatforms: [],
      channelPositioning: "",
      uploadFrequency: "",
      bestTimeToPost: [],
      contentMix: [],
    },
    seriesPlanning: { seriesName: "", seriesHook: "", totalEpisodes: 0, episodeFrequency: "", episodes: [] },
    youtubeOptimization: {
      channelDescription: "",
      channelKeywords: [],
      playlistStrategy: [],
      thumbnailStyle: "",
      endScreenStrategy: "",
      cardStrategy: "",
      communityTabStrategy: "",
    },
    shortFormStrategy: [],
    seoStrategy: { primaryKeywords: [], longTailKeywords: [], titleFormulas: [], descriptionTemplate: "", tagGroups: [], chapterStrategy: "" },
    monetizationPath: [],
    growthProjection: [],
    videoStrategyNotes: result.content,
  });
}
