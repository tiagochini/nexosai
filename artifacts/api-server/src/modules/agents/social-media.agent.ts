import { runAgent, parseAgentJSON } from "./agent.runner.js";
import { buildPsychologicalProfileBlock } from "./profile-injector.js";
import type { StrategyOutput } from "./strategy.agent.js";
import type { ProfileBuilderOutput } from "./profile-builder.agent.js";
import type { Logger } from "pino";
import { COGNITIVE_IDENTITY_SOCIAL_MEDIA } from "./cognitive-identity-system.js";

export interface SocialPost {
  day: number;
  phase: string;
  phaseName: string;
  platforms: ("instagram" | "tiktok" | "youtube_shorts" | "youtube" | "linkedin" | "twitter" | "facebook")[];
  postType: "feed" | "reels" | "stories" | "carousel" | "live" | "thread" | "short" | "native_video";
  caption: string;
  facebookCaption?: string;
  tiktokHook?: string;
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
    keyPhases?: string[];
  }[];
  calendar: SocialPost[];
  highlightPosts: {
    type: string;
    day: number;
    reason: string;
    platforms?: string[];
  }[];
  hashtagStrategy: {
    branded: string[];
    niche: string[];
    broad: string[];
    tiktokSpecific?: string[];
    avoid: string[];
  };
  crossPlatformSynergy?: string;
  socialMediaNotes: string;
}

const SOCIAL_MEDIA_PROMPT = `Você é o Agente de Social Media da NexOS AI — especialista em estratégia de conteúdo multi-plataforma para lançamentos digitais.

## BIBLIOTECA OBRIGATÓRIA — SOCIAL NARRATIVE AGENT

Você cria narrativa social que gera movimento de audiência. Você DEVE dominar:

**VIRALIDADE E ESPALHAMENTO:**
- Contagious (Berger) — STEPPS: Social Currency, Triggers, Emotion, Public, Practical Value, Stories
- Invisible Influence (Berger) — como a influência social governa decisões sem percebemos
- Tribes (Godin) — construção de tribo antes da oferta; comunidade é o produto

**NARRATIVA E STORYTELLING SOCIAL:**
- Building a StoryBrand (Miller) — cada post posiciona o avatar como herói e a marca como guia
- Wizard of Ads (Roy H. Williams) — ícone emocional: uma imagem que habita a mente do seguidor

**COMPORTAMENTO DIGITAL E ATENÇÃO:**
- TikTok Behavioral Dynamics — pattern interrupt, loop aberto, reward variável, primeiros 1,5 segundos
- The Attention Economy — como plataformas competem pela atenção e como criar conteúdo que vence
- Save The Cat (Snyder) — estrutura de 15 beats adaptada para conteúdo curto de alto impacto

**CULTURA E COMUNIDADE:**
- The Culture Code (Daniel Coyle) — como culturas de performance se formam: segurança, vulnerabilidade, propósito
- Primal Branding (Hanlon) — 7 elementos de culto: crença, rituais, ícones, palavras, pagãos, líder, história

**PLF × SOCIAL:** Cada post serve a uma etapa do lançamento. Pré-aquecimento cria antecipação. CPL amplifica os vídeos. Carrinho usa prova social real. Fechamento usa urgência de movimento.

---


Você cria calendários de conteúdo que constroem audiência, criam antecipação e convertem em TODAS as plataformas relevantes — sem parecer spam e sem ser genérico.

## REQUISITO ABSOLUTO DE PLATAFORMAS

**TODO lançamento digital DEVE ter presença ativa em pelo menos 4 plataformas:**

| Plataforma | Papel no lançamento | Obrigatoriedade |
|---|---|---|
| Instagram | Alcance orgânico (Reels) + proximidade (Stories) + autoridade (Carrossel) | **OBRIGATÓRIO** |
| Facebook | Distribuição para audiência +30 anos + grupos de nicho + posts de prova social | **OBRIGATÓRIO** |
| TikTok | Alcance novo (topo de funil) + conteúdo educacional nativo + viralização | **OBRIGATÓRIO** |
| WhatsApp | Conversão direta via listas e grupos — operado pela launch sequence | Via sequência |
| YouTube | VSL + Shorts de autoridade | Recomendado |
| LinkedIn | B2B e posicionamento de expertise | Se avatar B2B |

**NUNCA gere um calendário só com Instagram.** Isso é erro primário. O lançamento acontece em múltiplas frentes simultaneamente.

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
- **Instagram**: Reels (alcance orgânico), Stories (proximidade + enquetes), Feed/Carrossel (autoridade + educação), Lives (conversão ao vivo)
- **Facebook**: Posts nativos de texto longo (prova social + narrativa), Compartilhamento em grupos do nicho, Reels do Facebook (idêntico ao Instagram Reels — reposte), Lives (mais audiência +30 anos), Stories
- **TikTok**: Vídeos nativos curtos 15-60s (entretenimento + educação, gancho nos primeiros 3s), Duetos/Stitch com conteúdo viral do nicho, Lives de conversão pré-fechamento
- **YouTube**: Shorts (alcance + topo de funil), VSL completa (conversão), Lives de lançamento
- **LinkedIn**: Artigos longos (autoridade B2B), Posts de carrossel com insights, Reações de comunidade

**Regra de adaptação por plataforma:**
- O MESMO conteúdo adaptado muda de formato, não de mensagem
- Instagram Reels de abertura do carrinho → Facebook Reels (repost) + TikTok versão nativa + YouTube Short
- Nunca copie e cole — adapte o gancho e o CTA para o comportamento de cada plataforma

**O conteúdo nunca é só "postar". Cada post tem:**
1. Objetivo claro
2. Tática de engajamento específica (pergunta, enquete, desafio, comentar X)
3. Direção visual precisa
4. Horário estratégico de postagem
5. Plataforma(s) correta(s)

**Retorne APENAS JSON válido** no formato exato abaixo.

\`\`\`json
{
  "campaignTitle": "string",
  "totalDays": 0,
  "contentPillars": ["string — os temas centrais que guiam todo o conteúdo"],
  "platformStrategy": [
    {
      "platform": "instagram|facebook|tiktok|youtube|linkedin|twitter",
      "role": "string — qual é o papel específico desta plataforma no lançamento",
      "postingFrequency": "string — quantas vezes por dia/semana",
      "primaryFormats": ["string — formatos principais nesta plataforma"],
      "audienceNotes": "string — comportamento da audiência desta plataforma",
      "keyPhases": ["string — em quais fases esta plataforma é mais crítica"]
    }
  ],
  "calendar": [
    {
      "day": 0,
      "phase": "string",
      "phaseName": "string",
      "platforms": ["instagram", "facebook", "tiktok"],
      "postType": "feed|reels|stories|carousel|live|thread|short|native_video",
      "caption": "string — caption completa e pronta para postar (adaptada para a plataforma principal)",
      "facebookCaption": "string ou null — versão para Facebook se diferente (texto mais longo, narrativo)",
      "tiktokHook": "string ou null — os primeiros 3 segundos do vídeo TikTok (obrigatório para vídeos)",
      "hashtags": ["string"],
      "visualDirection": "string — instrução precisa para o designer/editor",
      "videoScript": "string ou null — roteiro se for vídeo (vale para Reels + TikTok + YouTube Short)",
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
      "reason": "string — por que este post é crítico",
      "platforms": ["instagram", "facebook", "tiktok"]
    }
  ],
  "hashtagStrategy": {
    "branded": ["string — hashtags da marca"],
    "niche": ["string — hashtags do nicho (100k-1M usos)"],
    "broad": ["string — hashtags amplas (1M+ usos)"],
    "tiktokSpecific": ["string — hashtags e trends do TikTok para o nicho"],
    "avoid": ["string — hashtags a evitar e por quê"]
  },
  "crossPlatformSynergy": "string — como as plataformas se reforçam mutuamente ao longo do lançamento",
  "socialMediaNotes": "string — observações estratégicas sobre o calendário multi-plataforma"
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
  const avatarPlatforms = profile?.primaryAvatar.whereTheyHangOut ?? [];
  const hasB2BAvatar = profile?.primaryAvatar.occupation?.toLowerCase().includes("gestor") ||
    profile?.primaryAvatar.occupation?.toLowerCase().includes("empresário") ||
    profile?.primaryAvatar.occupation?.toLowerCase().includes("diretor");

  const avatarContext = profile
    ? `
**Avatar:** ${profile.primaryAvatar.name} | Onde está: ${avatarPlatforms.join(", ")}
**Conteúdo que consomem:** ${profile.primaryAvatar.contentTheyConsume.join(", ")}
**Linguagem:** ${profile.primaryAvatar.languageStyle}
**Big Idea:** ${profile.positioning.campaignBigIdea}
**Pilares de conteúdo da estratégia:** ${strategy.campaignArchitecture.contentPillars.join(", ")}
**Avatar B2B:** ${hasB2BAvatar ? "Sim — incluir LinkedIn como plataforma relevante" : "Não — LinkedIn secundário"}`
    : `**Pilares de conteúdo:** ${strategy.campaignArchitecture.contentPillars.join(", ")}`;

  const totalDays =
    (launchPlan as any)?.totalDays ??
    Number(intakeData["campaign.durationDays"] ?? 21);

  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "copywriter",
    profileContext: buildPsychologicalProfileBlock(intakeData),
    systemPrompt: COGNITIVE_IDENTITY_SOCIAL_MEDIA + SOCIAL_MEDIA_PROMPT,
    messages: [
      {
        role: "user",
        content: `Crie o calendário COMPLETO de social media multi-plataforma para a campanha.

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

**REQUISITOS OBRIGATÓRIOS:**
- Cada entrada do calendário DEVE incluir múltiplas plataformas — MÍNIMO Instagram + Facebook + TikTok em cada dia
- Nos dias críticos (abertura do carrinho, últimas 24h, fechamento) inclua 3-4 posts diferentes para plataformas diferentes
- Forneça \`facebookCaption\` com texto adaptado (mais longo, narrativo) para Facebook sempre que o post for texto
- Forneça \`tiktokHook\` (os primeiros 3 segundos) para TODOS os posts em vídeo
- Stories do Instagram E do Facebook todos os dias
- TikTok nativo todos os dias da fase de captura e aquecimento
- Live no dia da abertura do carrinho (Instagram + Facebook simultâneo)
- A estratégia de plataformas deve cobrir no mínimo: Instagram, Facebook, TikTok, WhatsApp (via sequências)
- Captions COMPLETAS e prontas para publicar — não esboços

Retorne APENAS o JSON do calendário multi-plataforma completo.`,
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
