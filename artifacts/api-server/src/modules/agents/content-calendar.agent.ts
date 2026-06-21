/**
 * Content Calendar Agent
 * Generates complete 30-day content calendar with post-by-post specifics
 * for every platform: Instagram, TikTok, YouTube, Facebook, WhatsApp.
 * Provider: GPT-4o (creative, systematic, fast content generation)
 */

import { runAgent, parseAgentJSON } from "./agent.runner.js";
import type { Logger } from "pino";

export interface ContentPost {
  day: number;
  date?: string;             // ISO date if start date is known
  platform: "instagram_feed" | "instagram_stories" | "instagram_reels" | "tiktok" | "youtube" | "facebook" | "whatsapp_broadcast";
  launchPhase: "pre_launch" | "cart_open" | "mid_cart" | "urgency" | "post_launch" | "evergreen";
  contentType: "educational" | "authority" | "social_proof" | "offer" | "behind_scenes" | "objection" | "entertainment" | "engagement";
  hook: string;              // first 3 seconds / opening line
  caption: string;           // full caption/text
  cta: string;               // call to action
  hashtags?: string[];       // only for Instagram/TikTok
  visualConcept: string;     // what to film/design
  primaryObjective: string;  // what this post should accomplish
  psychologicalTrigger: string;
  estimatedReach: "low" | "medium" | "high" | "viral_potential";
}

export interface ContentCalendarOutput {
  product: string;
  startDate: string;
  totalPosts: number;
  totalDays: number;
  postsByPlatform: Record<string, number>;
  narrativeArc: string;      // the story the 30 days tell, start to finish
  contentPillars: string[];  // the 4-5 recurring content themes
  posts: ContentPost[];
  productionSchedule: {
    day: number;
    toCreate: string[];      // what to film/design on this day
    forPublishOn: number;    // publish on this day
  }[];
  kpiTargets: {
    platform: string;
    metric: string;
    target: string;
  }[];
  engagementStrategy: string; // how to actively engage comments and DMs
  repurposingGuide: string;   // how to turn one piece into 5
}

const CONTENT_CALENDAR_PROMPT = `Você é o Agente Content Calendar do NexOS AI — especialista em estratégia e planejamento de conteúdo de lançamento.

Você não cria calendários genéricos de "poste 3x por semana". Você cria arquiteturas narrativas precisas onde cada post tem um papel específico na jornada do lead, em cada fase da campanha.

## PRINCÍPIOS DO CONTENT CALENDAR DE LANÇAMENTO

### ETAPA 1 — A NARRATIVA EM 30 DIAS
O calendário conta uma história. O lead começa ignorante e termina convicto. Cada post é um capítulo:
- Dias 1-7 (Pré-lançamento fase 1): Ampliar consciência do problema. O avatar se vê descrito.
- Dias 8-14 (Pré-lançamento fase 2): O mecanismo único. "Por que o que tentaram antes não funciona."
- Dias 15-21 (Aquecimento): Autoridade + prova social. "Quem sou eu para dizer isso."
- Dias 22-25 (Antecipação): Pré-lançamento da solução. "Algo está chegando."
- Dias 26-30 (Carrinho): Abertura → meio → fechamento com escassez real.

### ETAPA 2 — PILARES DE CONTEÚDO
Conteúdo eficaz de lançamento orbita 4-5 temas fixos. O avatar associa você a esses temas e espera seus posts sobre eles:
- Educação: "Insight inesperado sobre [tema do produto]"
- Autoridade: "Porque sou credenciado para falar sobre isso"
- Transformação: "História de alguém que chegou onde você quer chegar"
- Bastidores: "O que está acontecendo por trás das câmeras"
- Entretenimento: "Conteúdo leve que faz o algoritmo te distribuir"

### ETAPA 3 — PLATAFORMA × OBJETIVO
Cada plataforma tem uma função específica no lançamento:
- **TikTok/Reels**: Descoberta + implantar o Big Domino (audiência fria)
- **Instagram Stories**: Relacionamento diário + bastidores + engajamento direto
- **Instagram Feed**: Autoridade permanente + prova social
- **YouTube**: Educação profunda + long-form authority
- **Facebook**: Long-form copy + grupos de nicho
- **WhatsApp Broadcast**: Conversão final (canal de menor tolerância a conteúdo fraco)

### ETAPA 4 — PRODUÇÃO INTELIGENTE
Um dia de produção pode gerar 5-7 dias de conteúdo se planejado corretamente. O calendário de produção deve ser separado do calendário de publicação.

**Retorne APENAS JSON válido.**

\`\`\`json
{
  "product": "string",
  "startDate": "string",
  "totalPosts": 0,
  "totalDays": 30,
  "postsByPlatform": { "instagram_reels": 0, "tiktok": 0, "instagram_stories": 0 },
  "narrativeArc": "string — o arco narrativo dos 30 dias (como o lead muda)",
  "contentPillars": ["string — pilar 1", "string — pilar 2"],
  "posts": [
    {
      "day": 1,
      "platform": "instagram_reels|tiktok|instagram_stories|instagram_feed|youtube|facebook|whatsapp_broadcast",
      "launchPhase": "pre_launch|cart_open|mid_cart|urgency|post_launch|evergreen",
      "contentType": "educational|authority|social_proof|offer|behind_scenes|objection|entertainment|engagement",
      "hook": "string — gancho específico (primeiros 3 segundos ou primeira linha)",
      "caption": "string — caption/texto completo pronto para usar",
      "cta": "string",
      "hashtags": ["string"],
      "visualConcept": "string — o que filmar ou criar",
      "primaryObjective": "string — o que este post deve realizar",
      "psychologicalTrigger": "string",
      "estimatedReach": "low|medium|high|viral_potential"
    }
  ],
  "productionSchedule": [
    {
      "day": 1,
      "toCreate": ["string — o que produzir neste dia"],
      "forPublishOn": 3
    }
  ],
  "kpiTargets": [
    {
      "platform": "string",
      "metric": "string",
      "target": "string"
    }
  ],
  "engagementStrategy": "string — como responder comentários e DMs de forma estratégica",
  "repurposingGuide": "string — como transformar 1 conteúdo em 5 formatos"
}
\`\`\``;

export async function runContentCalendarAgent(
  campaignId: string | null,
  workspaceId: string,
  productDescription: string,
  avatarDescription: string,
  platforms: string[],
  launchStartDate: string,
  launchDays: number,
  log: Logger,
): Promise<ContentCalendarOutput> {
  const result = await runAgent({
    campaignId,
    workspaceId,
    agentRole: "content_calendar",
    systemPrompt: CONTENT_CALENDAR_PROMPT,
    messages: [
      {
        role: "user",
        content: `Crie o calendário completo de conteúdo para este lançamento.

**Produto:** ${productDescription}
**Avatar:** ${avatarDescription}
**Plataformas:** ${platforms.join(", ")}
**Início:** ${launchStartDate}
**Duração do lançamento:** ${launchDays} dias

**PROCESSO:**
1. Defina o arco narrativo de 30 dias (como o avatar passa de indiferente a comprador)
2. Distribua os posts por plataforma e fase de lançamento
3. Para cada post: hook específico, caption completa, conceito visual e objetivo claro
4. Crie o calendário de produção (separado do de publicação)
5. Defina metas de KPI por plataforma

**PRIORIDADE ABSOLUTA:** Comece o JSON pelo array "posts" imediatamente — gere TODOS os posts primeiro antes de qualquer outro campo. O array "posts" é o entregável principal; campos como "narrativeArc", "contentPillars", "productionSchedule" são secundários e podem ser curtos se o budget de tokens apertar. Gere no mínimo 20 posts com captions completas — não esboços.
Retorne APENAS JSON.`,
      },
    ],
    log,
    thinkingMessages: [
      "Definindo arco narrativo dos 30 dias...",
      "Distribuindo posts por plataforma e fase...",
      "Escrevendo hooks e captions completas...",
      "Montando calendário de produção...",
      "Definindo metas de KPI...",
    ],
  });

  const defaults: ContentCalendarOutput = {
    product: productDescription,
    startDate: launchStartDate,
    totalPosts: 0,
    totalDays: launchDays,
    postsByPlatform: {},
    narrativeArc: "",
    contentPillars: [],
    posts: [],
    productionSchedule: [],
    kpiTargets: [],
    engagementStrategy: "",
    repurposingGuide: "",
  };

  const parsed = parseAgentJSON<Record<string, unknown>>(result.content, defaults as unknown as Record<string, unknown>);

  // Normalize: LLM sometimes deviates from schema and returns posts under a different key
  // (e.g. "calendar", "days", "schedule", "posts_list", "content")
  const postsRaw = (parsed.posts ?? parsed.calendar ?? parsed.days ?? parsed.schedule ?? parsed.posts_list ?? []) as ContentPost[];
  const postsByPlatform = (parsed.postsByPlatform ?? parsed.posts_by_platform ?? {}) as Record<string, number>;
  const productionSchedule = (parsed.productionSchedule ?? parsed.production_schedule ?? []) as ContentCalendarOutput["productionSchedule"];
  const kpiTargets = (parsed.kpiTargets ?? parsed.kpi_targets ?? parsed.kpis ?? []) as ContentCalendarOutput["kpiTargets"];

  return {
    product: (parsed.product as string) || productDescription,
    startDate: (parsed.startDate as string) || launchStartDate,
    totalPosts: postsRaw.length,
    totalDays: (parsed.totalDays as number) || launchDays,
    postsByPlatform,
    narrativeArc: (parsed.narrativeArc as string) || (parsed.narrative_arc as string) || "",
    contentPillars: (parsed.contentPillars ?? parsed.content_pillars ?? []) as string[],
    posts: postsRaw,
    productionSchedule,
    kpiTargets,
    engagementStrategy: (parsed.engagementStrategy as string) || (parsed.engagement_strategy as string) || "",
    repurposingGuide: (parsed.repurposingGuide as string) || (parsed.repurposing_guide as string) || "",
  };
}
