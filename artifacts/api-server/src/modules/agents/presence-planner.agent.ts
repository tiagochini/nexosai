/**
 * Presence Planner Agent — Gestão de Presença Social Always-On
 * Gera o plano semanal de posts por plataforma, distinguindo semana de
 * lançamento (narrativa da campanha ativa) de semana de autoridade
 * (crescimento de audiência e presença de marca).
 * Provider: GPT (copywriting social, formatos nativos por plataforma)
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";

export interface DmResponseStep {
  delayMinutes: number; // 0 = imediato
  message: string;
}

export interface DmResponseFlow {
  triggerKeyword: string;       // ex: "QUERO"
  triggerInstructions: string;  // texto que vai na caption: "Mande QUERO no DM"
  steps: DmResponseStep[];
}

export interface PresencePlannedPost {
  dayIndex: number; // 0=segunda … 6=domingo
  postingTime: string; // "HH:MM"
  format: string; // feed | reel | carousel | story | text | live
  pillar: string;
  caption: string;
  hashtags: string[];
  atMentions?: string[]; // usernames sem @ mencionados inline na caption
  visualDirection: string;
  videoScript?: string;
  reelScript?: string;   // roteiro específico para reel (hook 3s + corpo + CTA)
  highlightName?: string; // para stories: nome do Destaque que deve receber este story
  dmResponseFlow?: DmResponseFlow | null; // fluxo DM planejado (quando CTA induz DM)
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

export interface LifestylePreferences {
  hobbies?: string;
  gastronomy?: string;
  vehicles?: string;
  scenarios?: string;
  accessories?: string;
  countries?: string;
  other?: string;
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
  lifestylePreferences?: LifestylePreferences | null;
}

const PLANNER_PROMPT = `Você é o Agente de Presença Social do NexOS AI — estrategista de conteúdo orgânico que mantém a marca do usuário viva TODOS os dias, com ou sem lançamento ativo.

⚠️ REGRA ABSOLUTA DE IDENTIDADE — LEIA ANTES DE QUALQUER COISA:
Você é uma ferramenta NexOS usada POR um cliente para gerir o perfil social DELE.
TODO o conteúdo que você gera fala sobre o NEGÓCIO DO CLIENTE descrito em "CONTEXTO DO NEGÓCIO".
JAMAIS gere posts sobre NexOS AI, sobre a plataforma NexOS, sobre IA em geral ou sobre si mesmo como ferramenta.
Se o contexto do negócio for vago ou não informado, gere conteúdo de autoridade sobre o NICHO do cliente — nunca sobre tecnologia de IA ou sobre NexOS.
A única exceção é quando o próprio cliente vende produtos de IA/tecnologia e seu intake deixa isso explícito.

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
- Hashtags: 5–10 para instagram/tiktok (mix volume alto + nicho), 3–5 facebook, 3 linkedin — coloque NO CAMPO hashtags (sem #), NÃO inline na caption
- @mentions: use inline na caption quando contextualmente relevante. NÃO invente perfis que não existem.
- Captions em PT-BR, no tom configurado pelo usuário
- Varie formatos ao longo da semana — nunca 7 dias do mesmo formato

**REELS (reel):**
- São o formato de maior alcance — inclua pelo menos 1 reel por dia quando possível
- caption: legenda curta e magnética (o vídeo faz o trabalho pesado)
- visualDirection: estilo visual detalhado — iluminação (natural/estúdio/golden hour), enquadramento (close, plano médio, plano aberto), cenário, ambientação, ritmo de corte (rápido/respirado), cores dominantes, mood geral
- reelScript: ROTEIRO CINEMATOGRÁFICO COMPLETO — não escreva esboços nem frases soltas. Este roteiro será lido por um ator/apresentador e enviado diretamente para produção de vídeo com IA. Exija:

  📍 HOOK (0–3 segundos): frase de abertura exata que PARA O SCROLL — surpreendente, controversa ou que faz uma promessa irrecusável. Escreva a frase palavra por palavra como será dita na câmera.

  🎬 SET & FIGURINO: onde a pessoa está (cenário concreto — ex: "escritório minimalista com luz natural lateral, mesa branca, notebook visível ao fundo"), o que veste (ex: "blazer preto casual sem gravata, cabelo arrumado mas não formal"), qual é a energia corporal (ex: "de pé, gesticulando com leveza, tom confidente sem ser arrogante").

  🗣️ CORPO (15–45 segundos): narração COMPLETA, frase por frase, como será falada. Inclua:
  - O argumento principal dividido em 3–5 beats curtos
  - Momentos de pausa para corte (indicados como [CORTE])
  - Sugestões de B-roll onde cabe inserir (ex: "[B-ROLL: tela do celular mostrando resultado, 2s]")
  - Tom e ritmo para cada trecho (ex: "[devagar, com peso]" ou "[animado, acelerando]")

  🎵 TRILHA/MOOD: estilo de música de fundo que amplifica a mensagem (ex: "lo-fi beats calmos com piano, sem letra, 90 BPM" ou "silêncio total — deixa a voz liderar").

  ✅ CTA (últimos 3–5 segundos): frase exata de encerramento + ação que o usuário deve tomar (seguir, comentar, salvar, clicar no link da bio). Específico e urgente.

  EXEMPLO de nível esperado:
  HOOK: "Você está desperdiçando dinheiro em anúncios sem saber o porquê — e eu vou te provar agora."
  SET: Escritório clean, luz de janela lateral, sentado à mesa com notebook, camisa branca sem estampa, gesticulando ao falar.
  [CORPO]
  "Todo mundo faz campanhas. Mas 80% dos empresários..." [CORTE] "[B-ROLL: dashboard de anúncios com CPC alto, 2s]" "...não sabem que o problema não é o anúncio." [pausa 1s, levemente inclinado para a câmera] "É a OFERTA. Se a oferta não encaixa na dor, nenhum criativo salva." [CORTE] "Eu vi isso destruir R$50 mil em três semanas numa empresa que fatura milhões." [tom mais baixo, sério] [B-ROLL: gráfico caindo, 1.5s] "Quer saber como diagnosticar isso em 10 minutos?"
  TRILHA: lo-fi minimalista, piano suave, sem letra.
  CTA: "Salva esse vídeo e comenta DIAGNÓSTICO — te mando o checklist gratuito."

**STORIES (story):**
- caption: texto do sticker/overlay que o usuário colará manualmente — frase curta e impactante (máx 2 linhas). A API do Instagram não exibe caption em stories automaticamente.
- highlightName: SEMPRE defina o nome do Destaque onde este story deve ser arquivado após expirar (ex: "Resultados", "Bastidores", "Ofertas", "Dicas", "Depoimentos"). Isso garante que o story viva além das 24h.

**DM FLOW (quando aplicável):**
- Se o post tiver uma CTA que induz resposta no DM (ex: "mande X no DM", "responda QUERO", "comente e te mando no DM") → preencha dmResponseFlow com a sequência de respostas automáticas planejadas
- A triggerKeyword deve ser simples (1 palavra, maiúscula)
- steps: mínimo 2 passos — o imediato (delayMinutes: 0) e um follow-up (ex: 60 min depois)
- Se o post não tem CTA de DM → dmResponseFlow: null

**Retorne APENAS JSON válido:**

\`\`\`json
{
  "weekType": "launch|authority",
  "posts": [
    {
      "dayIndex": 0,
      "postingTime": "19:30",
      "format": "reel|carousel|feed|story|text|live",
      "pillar": "string — pilar de conteúdo",
      "caption": "string — caption completa pronta para publicar",
      "hashtags": ["string sem #"],
      "atMentions": ["username sem @"],
      "visualDirection": "string — direção visual clara",
      "reelScript": "string — APENAS para reels: roteiro cinematográfico completo com HOOK (frase exata 0–3s), SET & FIGURINO, CORPO (narração linha por linha com [CORTE] e [B-ROLL]), TRILHA/MOOD e CTA (frase exata). Mínimo 200 palavras. Nunca escreva esboço.",
      "videoScript": "string — mesmo conteúdo que reelScript (mantido por compatibilidade)",
      "highlightName": "string — APENAS para stories: nome do Destaque alvo",
      "dmResponseFlow": {
        "triggerKeyword": "QUERO",
        "triggerInstructions": "Mande QUERO no DM e te envio o link",
        "steps": [
          { "delayMinutes": 0, "message": "Olá! Aqui está o link prometido: ..." },
          { "delayMinutes": 60, "message": "Conseguiu acessar? Me conta o que achou!" }
        ]
      },
      "objective": "string — o que este post deve causar",
      "launchPhase": "string — apenas em semana de lançamento"
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

  const lp = input.lifestylePreferences;
  const lifestyleBlock = lp && Object.values(lp).some(v => v?.trim())
    ? `**LIFESTYLE E PREFERÊNCIAS PESSOAIS DO APRESENTADOR:**
Use esses elementos para enriquecer a direção visual (visualDirection) e os roteiros (reelScript/videoScript) — mencione adereços, cenários, veículos, gastronomia e hobbies de forma natural e contextual. NUNCA force — incorpore quando fizer sentido para o post.
${lp.hobbies     ? `- Hobbies: ${lp.hobbies}` : ""}
${lp.gastronomy  ? `- Gastronomia favorita: ${lp.gastronomy}` : ""}
${lp.vehicles    ? `- Veículos: ${lp.vehicles}` : ""}
${lp.scenarios   ? `- Cenários favoritos: ${lp.scenarios}` : ""}
${lp.accessories ? `- Adereços/acessórios: ${lp.accessories}` : ""}
${lp.countries   ? `- Países/destinos: ${lp.countries}` : ""}
${lp.other       ? `- Outros: ${lp.other}` : ""}`
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

${lifestyleBlock}

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
      atMentions: Array.isArray(p.atMentions) ? p.atMentions.map((m) => String(m).replace(/^@/, "")) : [],
      visualDirection: p.visualDirection || "",
      reelScript: p.reelScript || p.videoScript || undefined,
      videoScript: p.videoScript || p.reelScript || undefined,
      highlightName: typeof p.highlightName === "string" && p.highlightName.trim() ? p.highlightName.trim() : undefined,
      dmResponseFlow: p.dmResponseFlow ?? null,
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
