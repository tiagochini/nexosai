/**
 * Presence Planner Agent — Gestão de Presença Social Always-On
 * Gera o plano semanal de posts por plataforma, distinguindo semana de
 * lançamento (narrativa da campanha ativa) de semana de autoridade
 * (crescimento de audiência e presença de marca).
 * Provider: GPT (copywriting social, formatos nativos por plataforma)
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";

export interface PresencePlannedPost {
  dayIndex: number; // 0=segunda … 6=domingo
  postingTime: string; // "HH:MM"
  format: string; // feed | reel | carousel | story | text | live
  pillar: string;
  caption: string;
  hashtags: string[];
  visualDirection: string;
  videoScript?: string;
  objective: string;
  launchPhase?: string;
}

export interface PresenceWeekPlanOutput {
  weekType: "launch" | "authority";
  posts: PresencePlannedPost[];
}

export interface PresenceInsightOutput {
  summary: string;
  wins: string[];
  losses: string[];
  adjustments: string[];
  winningFormats: string[];
}

export interface PresenceBioOutput {
  suggestions: {
    platform: string;
    bio: string;
    highlights: string[];
    keywords: string[];
  }[];
}

export interface PresenceLaunchContext {
  campaignTitle: string;
  campaignStatus: string;
  centralNarrative?: string;
  bigDomino?: string;
  forbiddenTopics?: string[];
  launchPhaseHint?: string;
}

export interface PresencePlannerInput {
  platform: "instagram" | "facebook" | "tiktok" | "linkedin";
  postsPerDay: number;
  preferredTimes: string[];
  contentPillars: string[];
  tone: string;
  businessContext: string;
  weekStartISO: string; // segunda-feira da semana planejada (YYYY-MM-DD)
  launchContext?: PresenceLaunchContext | null;
  insight?: PresenceInsightOutput | null;
}

const PLANNER_PROMPT = `Você é o Agente de Presença Social do NexOS AI — estrategista de conteúdo orgânico que mantém a marca do usuário viva TODOS os dias, com ou sem lançamento ativo.

## DOIS MODOS DE OPERAÇÃO

**SEMANA DE AUTORIDADE (sem lançamento ativo):**
- Objetivo: construir autoridade, crescer audiência, gerar demanda futura
- Mix: 40% valor prático (ensina algo aplicável), 25% autoridade/prova (bastidores, resultados, opinião forte), 20% conexão (história pessoal, humanização), 15% engajamento (pergunta, enquete, polêmica saudável)
- NUNCA vender diretamente — no máximo CTA suave para seguir/salvar/comentar

**SEMANA DE LANÇAMENTO (campanha ativa):**
- Objetivo: aquecer e converter usando a narrativa central do lançamento
- Mix: teaser/antecipação, conteúdo de aquecimento alinhado ao Big Domino, prova social, urgência (apenas se fase de carrinho)
- Todo post deve reforçar a narrativa central — nunca contradizê-la
- Respeite tópicos proibidos da campanha

## REGRAS DE FORMATO POR PLATAFORMA
- **instagram**: reel (prioridade), carousel (salvamentos), feed, story
- **facebook**: feed com texto mais longo, vídeo nativo
- **tiktok**: reel curto com gancho nos primeiros 2s, trends adaptadas ao nicho
- **linkedin**: text (texto longo com gancho na 1ª linha), carousel documento

## REGRAS DE QUALIDADE
- Cada caption completa e pronta para publicar (não "escreva aqui...")
- Gancho forte na primeira linha — a primeira frase decide se o resto é lido
- Hashtags: 5–10 para instagram/tiktok (mix volume alto + nicho), 3–5 facebook, 3 linkedin
- visualDirection: direção clara para foto/arte/vídeo (o usuário ou o módulo de vídeo produz)
- videoScript: apenas para reel/vídeo — roteiro com gancho, desenvolvimento, CTA (máx 150 palavras)
- Captions em PT-BR, no tom configurado pelo usuário
- Varie formatos ao longo da semana — nunca 7 dias do mesmo formato

**Retorne APENAS JSON válido:**

\`\`\`json
{
  "weekType": "launch|authority",
  "posts": [
    {
      "dayIndex": 0,
      "postingTime": "19:30",
      "format": "reel|carousel|feed|story|text|live",
      "pillar": "string — pilar de conteúdo deste post",
      "caption": "string — caption completa pronta para publicar",
      "hashtags": ["string sem #"],
      "visualDirection": "string — direção visual clara",
      "videoScript": "string — apenas se formato de vídeo",
      "objective": "string — o que este post deve causar",
      "launchPhase": "string — apenas em semana de lançamento (teaser|aquecimento|carrinho)"
    }
  ]
}
\`\`\``;

export async function runPresencePlannerAgent(
  workspaceId: string,
  input: PresencePlannerInput,
  log: Logger,
  opts?: { idempotencyKeyOverride?: string },
): Promise<PresenceWeekPlanOutput> {
  const totalPosts = Math.min(input.postsPerDay, 5) * 7;

  const launchBlock = input.launchContext
    ? `**MODO: SEMANA DE LANÇAMENTO**
Campanha ativa: ${input.launchContext.campaignTitle} (status: ${input.launchContext.campaignStatus})
Narrativa central: ${input.launchContext.centralNarrative || "não definida — use o contexto do negócio"}
Big Domino: ${input.launchContext.bigDomino || "não definido"}
${input.launchContext.forbiddenTopics?.length ? `Tópicos PROIBIDOS: ${input.launchContext.forbiddenTopics.join("; ")}` : ""}
${input.launchContext.launchPhaseHint ? `Fase atual do lançamento: ${input.launchContext.launchPhaseHint}` : ""}`
    : `**MODO: SEMANA DE AUTORIDADE** — sem lançamento ativo. Foque em autoridade, audiência e presença de marca.`;

  const insightBlock = input.insight
    ? `**APRENDIZADO DA SEMANA ANTERIOR (aplique nos formatos e ângulos):**
Resumo: ${input.insight.summary}
Formatos vencedores: ${input.insight.winningFormats.join(", ") || "—"}
Ajustes recomendados: ${input.insight.adjustments.join("; ") || "—"}`
    : "";

  const result = await runAgent({
    campaignId: null,
    workspaceId,
    agentRole: "presence_planner",
    systemPrompt: PLANNER_PROMPT,
    maxTokens: 20000,
    idempotencyKeyOverride: opts?.idempotencyKeyOverride,
    messages: [
      {
        role: "user",
        content: `Gere o plano semanal de posts para UMA plataforma.

**Plataforma:** ${input.platform}
**Posts por dia:** ${Math.min(input.postsPerDay, 5)} (total da semana: ${totalPosts})
**Horários preferidos:** ${input.preferredTimes.join(", ") || "escolha os melhores para a plataforma"}
**Pilares de conteúdo:** ${input.contentPillars.join(", ") || "defina a partir do contexto do negócio"}
**Tom de voz:** ${input.tone || "profissional e direto"}
**Semana começando em (segunda-feira):** ${input.weekStartISO}

**CONTEXTO DO NEGÓCIO:**
${input.businessContext || "não informado — gere conteúdo de autoridade genérico para empreendedor digital"}

${launchBlock}

${insightBlock}

Gere exatamente ${totalPosts} posts (${Math.min(input.postsPerDay, 5)}/dia × 7 dias, dayIndex 0 a 6). Distribua os horários preferidos. Retorne APENAS JSON.`,
      },
    ],
    log,
    thinkingMessages: [
      "Analisando pilares e contexto do negócio...",
      "Definindo mix de formatos da semana...",
      "Escrevendo captions e roteiros...",
    ],
  });

  const parsed = parseAgentJSON<PresenceWeekPlanOutput>(result.content, {
    weekType: input.launchContext ? "launch" : "authority",
    posts: [],
  });

  // Sanitiza: dayIndex 0-6, postingTime válido, formatos conhecidos
  parsed.posts = (parsed.posts || [])
    .filter((p) => p && typeof p.caption === "string" && p.caption.length > 0)
    .map((p) => ({
      ...p,
      dayIndex: Math.min(Math.max(Number(p.dayIndex) || 0, 0), 6),
      postingTime: /^\d{2}:\d{2}$/.test(p.postingTime || "") ? p.postingTime : "09:00",
      format: p.format || "feed",
      pillar: p.pillar || "",
      hashtags: Array.isArray(p.hashtags) ? p.hashtags.map((h) => String(h).replace(/^#/, "")) : [],
      visualDirection: p.visualDirection || "",
      objective: p.objective || "",
    }));

  return parsed;
}

const INSIGHT_PROMPT = `Você é o analista de performance de presença social do NexOS AI. Analise os resultados da semana anterior e produza o "Insight da Semana" — o que funcionou, o que não funcionou, e como ajustar a próxima semana.

Seja específico e acionável. "Postar mais reels" é fraco; "Reels com gancho de contraste (antes/depois) tiveram 3× o alcance — dobrar esse formato e abandonar carrosséis técnicos" é forte.

**Retorne APENAS JSON válido:**

\`\`\`json
{
  "summary": "string — 2-3 frases: o veredito da semana",
  "wins": ["string — o que funcionou e por quê"],
  "losses": ["string — o que não funcionou e por quê"],
  "adjustments": ["string — mudança concreta para a próxima semana"],
  "winningFormats": ["string — formatos/ângulos a repetir"]
}
\`\`\``;

export async function runPresenceInsightAgent(
  workspaceId: string,
  prevWeekSummary: string,
  log: Logger,
  opts?: { idempotencyKeyOverride?: string },
): Promise<PresenceInsightOutput> {
  const result = await runAgent({
    campaignId: null,
    workspaceId,
    agentRole: "presence_planner",
    systemPrompt: INSIGHT_PROMPT,
    idempotencyKeyOverride: opts?.idempotencyKeyOverride,
    messages: [
      {
        role: "user",
        content: `Analise a performance da semana anterior e gere o Insight da Semana.

${prevWeekSummary}

Retorne APENAS JSON.`,
      },
    ],
    log,
  });

  return parseAgentJSON<PresenceInsightOutput>(result.content, {
    summary: "",
    wins: [],
    losses: [],
    adjustments: [],
    winningFormats: [],
  });
}

const BIO_PROMPT = `Você é o especialista em otimização de perfil social do NexOS AI. Gere bios otimizadas para conversão de visitante em seguidor, com base nos pilares do negócio.

## REGRAS POR PLATAFORMA
- **instagram**: máx 150 caracteres, estrutura: quem ajuda + resultado + CTA. Sugira 4-6 destaques (highlights) nomeados.
- **facebook**: descrição da página, até 255 caracteres, foco em credibilidade.
- **tiktok**: máx 80 caracteres, direto e magnético, 1 CTA.
- **linkedin**: headline de até 220 caracteres, orientada a autoridade B2B. "highlights" = seções em destaque sugeridas.

Inclua palavras-chave de SEO social que a audiência busca (campo keywords).

**Retorne APENAS JSON válido:**

\`\`\`json
{
  "suggestions": [
    {
      "platform": "instagram|facebook|tiktok|linkedin",
      "bio": "string — bio pronta para colar",
      "highlights": ["string — nome do destaque/seção"],
      "keywords": ["string — termos de busca que a bio cobre"]
    }
  ]
}
\`\`\``;

export async function runBioOptimizerAgent(
  workspaceId: string,
  input: {
    platforms: string[];
    contentPillars: string[];
    tone: string;
    businessContext: string;
  },
  log: Logger,
): Promise<PresenceBioOutput> {
  const result = await runAgent({
    campaignId: null,
    workspaceId,
    agentRole: "bio_optimizer",
    systemPrompt: BIO_PROMPT,
    messages: [
      {
        role: "user",
        content: `Gere bios otimizadas para as plataformas: ${input.platforms.join(", ")}.

**Pilares de conteúdo:** ${input.contentPillars.join(", ") || "não definidos"}
**Tom de voz:** ${input.tone || "profissional e direto"}

**CONTEXTO DO NEGÓCIO:**
${input.businessContext || "não informado"}

Retorne APENAS JSON.`,
      },
    ],
    log,
  });

  const parsed = parseAgentJSON<PresenceBioOutput>(result.content, {
    suggestions: [],
  });
  parsed.suggestions = (parsed.suggestions || []).filter(
    (s) => s && typeof s.bio === "string" && s.bio.length > 0,
  );
  return parsed;
}
