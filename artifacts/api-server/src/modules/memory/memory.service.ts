import { eq, and, desc, inArray, isNull, or } from "drizzle-orm";
import {
  db,
  workspaceMemoryTable,
  contentPiecesTable,
  type InsertWorkspaceMemory,
} from "@workspace/db";
import type { AgentRole } from "../ai-gateway/ai-gateway.service.js";
import type { Logger } from "pino";

// ── Agent → memory type mapping ───────────────────────────────────────────────

const AGENT_MEMORY_TYPE: Record<string, string> = {
  copywriter:       "approved_copy",
  ad_copy:          "approved_ads",
  vsl_script:       "approved_vsl",
  cpl_script:       "approved_vsl",
  webinar_script:   "approved_vsl",
  live_script:      "approved_vsl",
  social_media:     "approved_social",
  stories_sequence: "approved_social",
  creative_director:"approved_creative",
  landing_page:     "approved_landing_page",
  strategy:         "approved_strategy",
  offer:            "approved_offer",
  targeting:        "approved_strategy",
  media_buyer:      "approved_strategy",
  compliance:       "performance_insight",
  optimization:     "performance_insight",
};

// ── Critique checklist per agent ──────────────────────────────────────────────

export const AGENT_CRITIQUE_CHECKLIST: Record<string, string[]> = {
  copywriter: [
    "O headline principal captura a atenção em menos de 3 segundos?",
    "A copy usa as palavras exatas do avatar (idioma do cliente)?",
    "O mecanismo único está explicado de forma específica e crível?",
    "Há pelo menos 3 gatilhos de urgência/escassez funcionais?",
    "A sequência de emails tem progressão lógica de temperatura (frio → quente → urgência)?",
    "O carrinho tem objeção → resposta → proof em cada email?",
    "Existe prova social específica (não genérica) em pelo menos 2 pontos?",
    "O CTA está claro, único e repetido no mínimo 3 vezes na página de vendas?",
    "A copy evita promessas não comprováveis que violam CONAR?",
    "O estilo de linguagem bate com o perfil do avatar (formal/informal/técnico)?",
  ],
  vsl_script: [
    "O hook dos primeiros 15 segundos é específico e surpreendente?",
    "A estrutura segue: hook → problema → amplificação → solução → prova → oferta → CTA?",
    "O mecanismo único é demonstrável (não apenas descrito)?",
    "Há pattern interrupt no minuto 3 para reter audiência?",
    "A transição para a oferta é suave — não abrupta?",
    "O preço é revelado apenas após o valor ter sido construído completamente?",
    "Existe uma âncora de preço antes de revelar o preço real?",
    "O CTA de fechamento tem urgência específica (não genérica)?",
    "A duração total é adequada para o preço do produto?",
    "O roteiro é falado — soa natural quando lido em voz alta?",
  ],
  landing_page: [
    "O above-the-fold captura o benefício central sem scroll?",
    "Há pelo menos 6 seções de prova social distribuídas ao longo da página?",
    "As objeções mais comuns são respondidas antes do preço?",
    "A hierarquia visual guia o olho: headline → subheadline → benefícios → CTA?",
    "O botão de CTA repete pelo menos 3 vezes ao longo da página?",
    "A seção de garantia está posicionada logo após o preço?",
    "Existe urgência visual (timer, vagas, data limite) comunicada graficamente?",
    "O mobile-first está sendo considerado nas instruções de layout?",
    "A página tem um único objetivo (converter) sem distrações de saída?",
    "A velocidade de carregamento foi considerada (sem elementos pesados desnecessários)?",
  ],
  ad_copy: [
    "Cada anúncio tem um único ângulo de ataque (não múltiplos)?",
    "O hook do criativo para a rolagem em 1-3 palavras?",
    "Os criativos de topo de funil educam, não vendem diretamente?",
    "Há variações para cada estágio do funil (TOFU/MOFU/BOFU)?",
    "Os anúncios de remarketing usam prova social ou urgência — não o mesmo ângulo do cold?",
    "Os CTAs são específicos ('Garanta sua vaga' vs 'Clique aqui')?",
    "As headlines do Google seguem as regras de character count (30/30/30)?",
    "Os anúncios de TikTok têm linguagem nativa da plataforma?",
    "Há testes A/B com variáveis isoladas (hook diferente, mesma oferta)?",
    "Os anúncios evitam palavras bloqueadas pelas políticas de plataforma?",
  ],
  strategy: [
    "O posicionamento é específico o suficiente para eliminar concorrentes diretos?",
    "O mecanismo único é realmente único — não é um clichê de nicho?",
    "Os segmentos de audiência são distintos entre si e acionáveis?",
    "Os riscos identificados têm mitigação concreta proposta?",
    "A arquitetura de campanha tem progressão lógica entre fases?",
    "As projeções de receita são realistas para o tamanho atual da audiência?",
    "O timing de campanha leva em conta sazonalidade e agenda do mercado?",
    "A estratégia de preço é defensável (não apenas 'preço de mercado')?",
  ],
  compliance: [
    "Todas as promessas de resultado têm qualificação obrigatória (resultados não típicos)?",
    "Nenhuma afirmação viola o Art. 37 do CDC (publicidade enganosa)?",
    "Os testemunhos usados têm autorização e são verificáveis?",
    "Afirmações de 'aprovado por especialistas' têm fonte citável?",
    "A oferta de garantia é legalmente cumprível pelo negócio?",
    "Não há promessas de renda específica sem base em resultados reais?",
    "A política de privacidade e LGPD está contemplada nos formulários de captura?",
    "Os anúncios de tráfego pago seguem as políticas da plataforma?",
  ],
};

// ── Retrieve relevant memories for a given agent ─────────────────────────────

export interface MemoryContext {
  positiveExamples: string;
  negativeExamples: string;
  performanceInsights: string;
  publicReferences: string;
  hasContext: boolean;
}

export async function getMemoryContext(
  workspaceId: string,
  agentRole: string,
  productNiche?: string,
): Promise<MemoryContext> {
  const memType = AGENT_MEMORY_TYPE[agentRole];

  // Fetch approved examples from this workspace (up to 3 most recent)
  const positiveMemories = memType
    ? await db
        .select()
        .from(workspaceMemoryTable)
        .where(
          and(
            eq(workspaceMemoryTable.workspaceId, workspaceId),
            eq(workspaceMemoryTable.isNegative, false),
            eq(workspaceMemoryTable.isPublicReference, false),
            eq(workspaceMemoryTable.agentRole, agentRole),
          ),
        )
        .orderBy(desc(workspaceMemoryTable.usageCount), desc(workspaceMemoryTable.createdAt))
        .limit(3)
    : [];

  // Fetch rejection/negative memories from this workspace (up to 3)
  const negativeMemories = await db
    .select()
    .from(workspaceMemoryTable)
    .where(
      and(
        eq(workspaceMemoryTable.workspaceId, workspaceId),
        eq(workspaceMemoryTable.isNegative, true),
        eq(workspaceMemoryTable.agentRole, agentRole),
      ),
    )
    .orderBy(desc(workspaceMemoryTable.createdAt))
    .limit(3);

  // Fetch public reference launches (niche-matched first, then generic)
  const publicRefs = await db
    .select()
    .from(workspaceMemoryTable)
    .where(
      and(
        eq(workspaceMemoryTable.isPublicReference, true),
        eq(workspaceMemoryTable.agentRole, agentRole),
        or(
          productNiche ? eq(workspaceMemoryTable.productNiche, productNiche) : isNull(workspaceMemoryTable.id),
          isNull(workspaceMemoryTable.productNiche),
        ),
      ),
    )
    .orderBy(desc(workspaceMemoryTable.qualityScore))
    .limit(2);

  // Fetch performance insights
  const insights = await db
    .select()
    .from(workspaceMemoryTable)
    .where(
      and(
        eq(workspaceMemoryTable.workspaceId, workspaceId),
        eq(workspaceMemoryTable.memoryType, "performance_insight"),
      ),
    )
    .orderBy(desc(workspaceMemoryTable.createdAt))
    .limit(2);

  const positiveExamples = positiveMemories.length > 0
    ? positiveMemories
        .map((m, i) => `**Exemplo aprovado ${i + 1} — ${m.title}:**\n${m.summary}`)
        .join("\n\n")
    : "";

  const negativeExamples = negativeMemories.length > 0
    ? negativeMemories
        .map((m) => `**Evitar (rejeitado pelo cliente):** ${m.summary}`)
        .join("\n")
    : "";

  const publicReferences = publicRefs.length > 0
    ? publicRefs
        .map((m) => `**Referência de lançamento real — ${m.title}:**\n${m.summary}`)
        .join("\n\n")
    : "";

  const performanceInsights = insights.length > 0
    ? insights
        .map((m) => `**Insight de performance:** ${m.summary}`)
        .join("\n")
    : "";

  // Update usage count for retrieved memories
  const allIds = [...positiveMemories, ...negativeMemories, ...publicRefs].map((m) => m.id);
  if (allIds.length > 0) {
    await db
      .update(workspaceMemoryTable)
      .set({ lastUsedAt: new Date() })
      .where(inArray(workspaceMemoryTable.id, allIds));
  }

  const hasContext =
    positiveExamples.length > 0 ||
    negativeExamples.length > 0 ||
    publicReferences.length > 0 ||
    performanceInsights.length > 0;

  return { positiveExamples, negativeExamples, performanceInsights, publicReferences, hasContext };
}

// ── Build context block injected into agent prompts ───────────────────────────

export function buildMemoryContextBlock(ctx: MemoryContext): string {
  if (!ctx.hasContext) return "";

  const parts: string[] = [
    "## MEMÓRIA DO SISTEMA — USE COMO CALIBRAÇÃO DE QUALIDADE",
    "",
  ];

  if (ctx.publicReferences) {
    parts.push("### Referências de Lançamentos Reais (Alta Performance)");
    parts.push(ctx.publicReferences);
    parts.push("");
  }

  if (ctx.positiveExamples) {
    parts.push("### Conteúdo Aprovado Anteriormente por Este Cliente");
    parts.push("Use como referência de tom, estilo e profundidade esperados:");
    parts.push(ctx.positiveExamples);
    parts.push("");
  }

  if (ctx.negativeExamples) {
    parts.push("### REJEIÇÕES — O Que NÃO Fazer");
    parts.push("Estes padrões foram rejeitados pelo cliente. Evite-os completamente:");
    parts.push(ctx.negativeExamples);
    parts.push("");
  }

  if (ctx.performanceInsights) {
    parts.push("### Insights de Performance de Campanhas Anteriores");
    parts.push(ctx.performanceInsights);
    parts.push("");
  }

  parts.push("---");
  parts.push("INSTRUÇÃO: Incorpore este conhecimento. Não mencione explicitamente que está usando memória — apenas entregue um output mais calibrado.");
  parts.push("");

  return parts.join("\n");
}

// ── Save approved content to workspace memory ─────────────────────────────────

export async function saveApprovedToMemory(
  workspaceId: string,
  campaignId: string,
  agentRole: string,
  title: string,
  summary: string,
  content: Record<string, unknown>,
  productNiche?: string,
  qualityScore?: number,
): Promise<void> {
  const memType = AGENT_MEMORY_TYPE[agentRole] ?? "approved_copy";

  await db.insert(workspaceMemoryTable).values({
    workspaceId,
    campaignId,
    memoryType: memType as any,
    agentRole,
    title,
    summary: summary.slice(0, 1000),
    content,
    isNegative: false,
    isPublicReference: false,
    productNiche,
    qualityScore,
    usageCount: 0,
  });
}

// ── Save rejection feedback to workspace memory ───────────────────────────────

export async function saveRejectionToMemory(
  workspaceId: string,
  campaignId: string,
  agentRole: string,
  contentTitle: string,
  rejectionReason: string,
  contentSummary: string,
): Promise<void> {
  const summary = `Conteúdo rejeitado: "${contentTitle}". Motivo: ${rejectionReason}. Padrão a evitar: ${contentSummary.slice(0, 300)}`;

  await db.insert(workspaceMemoryTable).values({
    workspaceId,
    campaignId,
    memoryType: "rejection_feedback",
    agentRole,
    title: `[REJEIÇÃO] ${contentTitle}`,
    summary: summary.slice(0, 1000),
    content: { rejectionReason, contentSummary },
    isNegative: true,
    isPublicReference: false,
    usageCount: 0,
  });
}

// ── Save performance insight from optimization/compliance ─────────────────────

export async function savePerformanceInsight(
  workspaceId: string,
  campaignId: string,
  insight: string,
  score: number,
): Promise<void> {
  await db.insert(workspaceMemoryTable).values({
    workspaceId,
    campaignId,
    memoryType: "performance_insight",
    agentRole: "optimization",
    title: `Insight de performance — score ${score}/100`,
    summary: insight.slice(0, 1000),
    content: { insight, score },
    isNegative: false,
    isPublicReference: false,
    qualityScore: score,
    usageCount: 0,
  });
}

// ── Auto-capture approval/rejection from content piece updates ────────────────

export async function processContentPieceApproval(
  workspaceId: string,
  campaignId: string,
  pieceId: string,
  agentRole: string,
  approved: boolean,
  rejectionReason?: string,
  log?: Logger,
): Promise<void> {
  try {
    const [piece] = await db
      .select()
      .from(contentPiecesTable)
      .where(eq(contentPiecesTable.id, pieceId))
      .limit(1);

    if (!piece) return;

    const contentObj = (piece.content ?? {}) as Record<string, unknown>;
    const campaignTitle = String(contentObj["campaignTitle"] ?? piece.title);

    if (approved) {
      const summary = extractContentSummary(agentRole, contentObj, piece.title);
      await saveApprovedToMemory(
        workspaceId,
        campaignId,
        agentRole,
        campaignTitle,
        summary,
        contentObj,
      );
      log?.info({ pieceId, agentRole }, "Approved content saved to workspace memory");
    } else if (rejectionReason) {
      const contentSummary = extractContentSummary(agentRole, contentObj, piece.title);
      await saveRejectionToMemory(
        workspaceId,
        campaignId,
        agentRole,
        piece.title,
        rejectionReason,
        contentSummary,
      );
      log?.info({ pieceId, agentRole }, "Rejection feedback saved to workspace memory");
    }
  } catch (err) {
    log?.error({ err, pieceId }, "Failed to process content piece for memory");
  }
}

// ── Extract a readable summary from agent output ──────────────────────────────

function extractContentSummary(
  agentRole: string,
  content: Record<string, unknown>,
  fallbackTitle: string,
): string {
  try {
    switch (agentRole) {
      case "copywriter": {
        const page = content["salesPage"] as any;
        const emails = content["emailSequence"] as any;
        return [
          `Headline: ${page?.sections?.[0]?.headline ?? ""}`,
          `Big Idea: ${(content["campaignBigIdea"] as string) ?? ""}`,
          `Total e-mails: ${(emails?.preLaunch?.length ?? 0) + (emails?.cartOpen?.length ?? 0) + (emails?.cartClose?.length ?? 0)}`,
          `Linha de assunto do email 1: ${emails?.preLaunch?.[0]?.subject ?? ""}`,
        ].filter(Boolean).join(" | ");
      }
      case "ad_copy": {
        const segments = (content["segments"] as any[]) ?? [];
        return `${segments.length} segmentos. Ângulos: ${segments.slice(0, 3).map((s: any) => s.angle ?? s.name).join(", ")}`;
      }
      case "vsl_script":
      case "cpl_script":
      case "webinar_script":
      case "live_script": {
        return `Título: ${content["title"] ?? fallbackTitle}. Duração: ${content["totalDuration"] ?? ""}. Seções: ${(content["sections"] as any[])?.length ?? 0}`;
      }
      case "landing_page": {
        const sections = (content["sections"] as any[]) ?? [];
        return `${sections.length} seções. Tipo: ${content["pageType"] ?? ""}. Headline: ${sections[0]?.content?.headline ?? ""}`;
      }
      case "strategy": {
        return `Posicionamento: ${content["offerPositioning"] ?? ""}. Big idea: ${(content["campaignBigIdea"] as string) ?? ""}`;
      }
      case "creative_director": {
        return `Título: ${content["campaignTitle"] ?? fallbackTitle}. Estilo visual: ${content["visualStyle"] ?? ""}`;
      }
      default:
        return `${fallbackTitle} — ${JSON.stringify(content).slice(0, 200)}`;
    }
  } catch {
    return fallbackTitle;
  }
}

// ── Get memory stats for workspace ────────────────────────────────────────────

export async function getWorkspaceMemoryStats(workspaceId: string) {
  const memories = await db
    .select()
    .from(workspaceMemoryTable)
    .where(eq(workspaceMemoryTable.workspaceId, workspaceId))
    .orderBy(desc(workspaceMemoryTable.createdAt));

  const byType = memories.reduce<Record<string, number>>((acc, m) => {
    acc[m.memoryType] = (acc[m.memoryType] ?? 0) + 1;
    return acc;
  }, {});

  return {
    total: memories.length,
    byType,
    positiveExamples: memories.filter((m) => !m.isNegative && !m.isPublicReference).length,
    negativeExamples: memories.filter((m) => m.isNegative).length,
    publicReferences: memories.filter((m) => m.isPublicReference).length,
    mostUsed: memories.sort((a, b) => b.usageCount - a.usageCount).slice(0, 5).map((m) => ({
      id: m.id,
      title: m.title,
      agentRole: m.agentRole,
      usageCount: m.usageCount,
    })),
  };
}
