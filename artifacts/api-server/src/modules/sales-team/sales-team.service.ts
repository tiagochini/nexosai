import { eq, and, desc, sql, count } from "drizzle-orm";
import {
  db,
  salesConversationsTable,
  salesMessagesTable,
  workspacesTable,
} from "@workspace/db";
import { completeWithAgent, type AgentRole } from "../ai-gateway/ai-gateway.service.js";
import { logger } from "../../lib/logger.js";
import type { Logger } from "pino";
import { COGNITIVE_IDENTITY_SALES_TEAM } from "../agents/cognitive-identity-system.js";

export type SalesFunnelStage = "warming" | "desire" | "scarcity" | "objection" | "post_sale";
export type SalesConversationStatus = "active" | "converted" | "lost" | "paused";

const STAGE_TO_AGENT: Record<SalesFunnelStage, AgentRole> = {
  warming: "sales_warmer",
  desire: "sales_desire",
  scarcity: "sales_closer",
  objection: "sales_objection",
  post_sale: "sales_consultant",
};

export async function getSalesConversations(workspaceId: string, filters?: {
  status?: string;
  funnelStage?: string;
  channel?: string;
}) {
  let whereClause = eq(salesConversationsTable.workspaceId, workspaceId);
  if (filters?.status && filters.status !== "all") {
    whereClause = and(whereClause, eq(salesConversationsTable.status, filters.status)) as typeof whereClause;
  }
  if (filters?.funnelStage && filters.funnelStage !== "all") {
    whereClause = and(whereClause, eq(salesConversationsTable.funnelStage, filters.funnelStage)) as typeof whereClause;
  }
  if (filters?.channel && filters.channel !== "all") {
    whereClause = and(whereClause, eq(salesConversationsTable.channel, filters.channel)) as typeof whereClause;
  }

  const conversations = await db
    .select()
    .from(salesConversationsTable)
    .where(whereClause)
    .orderBy(desc(salesConversationsTable.updatedAt))
    .limit(100);

  const convIds = conversations.map(c => c.id);
  const messageCounts = convIds.length > 0
    ? await db
        .select({
          conversationId: salesMessagesTable.conversationId,
          count: count(),
        })
        .from(salesMessagesTable)
        .where(sql`${salesMessagesTable.conversationId} = ANY(ARRAY[${sql.join(convIds.map(id => sql`${id}::uuid`), sql`, `)}])`)
        .groupBy(salesMessagesTable.conversationId)
    : [];

  const countMap = Object.fromEntries(messageCounts.map(r => [r.conversationId, r.count]));

  return conversations.map(c => ({
    ...c,
    messageCount: Number(countMap[c.id] ?? 0),
  }));
}

export async function createSalesConversation(workspaceId: string, data: {
  contactName: string;
  contactHandle?: string;
  channel?: string;
  funnelStage?: string;
  campaignId?: string;
  notes?: string;
}) {
  const [conv] = await db
    .insert(salesConversationsTable)
    .values({
      workspaceId,
      campaignId: data.campaignId ?? null,
      contactName: data.contactName,
      contactHandle: data.contactHandle ?? "",
      channel: data.channel ?? "whatsapp",
      funnelStage: data.funnelStage ?? "warming",
      assignedAgent: STAGE_TO_AGENT[(data.funnelStage as SalesFunnelStage) ?? "warming"],
      notes: data.notes ?? "",
    })
    .returning();
  return conv;
}

export async function getSalesConversationWithMessages(id: string, workspaceId: string) {
  const [conv] = await db
    .select()
    .from(salesConversationsTable)
    .where(and(
      eq(salesConversationsTable.id, id),
      eq(salesConversationsTable.workspaceId, workspaceId),
    ));

  if (!conv) return null;

  const messages = await db
    .select()
    .from(salesMessagesTable)
    .where(eq(salesMessagesTable.conversationId, id))
    .orderBy(salesMessagesTable.createdAt);

  return { ...conv, messages };
}

export async function addSalesMessage(conversationId: string, workspaceId: string, data: {
  role: "contact" | "agent" | "note";
  content: string;
  agentRole?: string;
  isAiGenerated?: boolean;
}) {
  const [conv] = await db
    .select({ id: salesConversationsTable.id })
    .from(salesConversationsTable)
    .where(and(
      eq(salesConversationsTable.id, conversationId),
      eq(salesConversationsTable.workspaceId, workspaceId),
    ));

  if (!conv) return null;

  const [msg] = await db
    .insert(salesMessagesTable)
    .values({
      conversationId,
      role: data.role,
      content: data.content,
      agentRole: data.agentRole,
      isAiGenerated: data.isAiGenerated ?? false,
    })
    .returning();

  await db
    .update(salesConversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(salesConversationsTable.id, conversationId));

  return msg;
}

const SALES_SYSTEM_PROMPTS: Record<SalesFunnelStage, string> = {
  warming: `Você é Marco, especialista em aquecimento do Time de Vendas NexOS. Use protocolo PLF + Daniel Godri: crie rapport, agite o problema, plante curiosidade. NUNCA mencione preço ou urgência. Máximo 3 parágrafos curtos. Formato WhatsApp/DM. PT-BR.`,
  desire: `Você é Renata, especialista em criação de desejo do Time de Vendas NexOS. Use Dale Carnegie: espelhe os sonhos do lead com as palavras dele, conecte cada funcionalidade ao problema específico dele. Crie ancoragem de valor antes de qualquer oferta. Máximo 3 parágrafos. PT-BR.`,
  scarcity: `Você é Vitor, especialista em fechamento do Time de Vendas NexOS. Use protocolo PLF de carrinho: custo de inação como alavanca, urgência real, próximo passo sempre claro. Máximo 3 parágrafos. PT-BR.`,
  objection: `Você é Clara, especialista em quebra de objeções do Time de Vendas NexOS. Use framework ACR (Acknowledge → Challenge → Redirect). Identifique a objeção real, valide, redirecione. Máximo 3 parágrafos. PT-BR.`,
  post_sale: `Você é Alex, consultor NexOS AI. Conheça tudo sobre o produto: 34 agentes de IA, planos Solo e Agency, trilhas 6/8/10 dígitos, todas as integrações. Responda com precisão e entusiasmo. PT-BR.`,
};

export async function suggestSalesReply(conversationId: string, workspaceId: string, log: Logger): Promise<{
  suggestion: string;
  agentRole: AgentRole;
  funnelStage: string;
}> {
  const conv = await getSalesConversationWithMessages(conversationId, workspaceId);
  if (!conv) throw new Error("Conversa não encontrada");

  const stage = conv.funnelStage as SalesFunnelStage;
  const agentRole = STAGE_TO_AGENT[stage] ?? "sales_consultant";
  const systemPrompt = COGNITIVE_IDENTITY_SALES_TEAM + (SALES_SYSTEM_PROMPTS[stage] ?? SALES_SYSTEM_PROMPTS.post_sale);

  const messages = conv.messages ?? [];
  const historyText = messages.slice(-10).map(m => {
    const roleLabel = m.role === "contact" ? conv.contactName || "Lead" : "Atendente";
    return `${roleLabel}: ${m.content}`;
  }).join("\n");

  const contextNote = `
DADOS DO LEAD:
- Nome: ${conv.contactName || "Não informado"}
- Canal: ${conv.channel}
- Etapa do funil: ${stage}
- Notas: ${conv.notes || "Nenhuma"}

HISTÓRICO RECENTE DA CONVERSA:
${historyText || "(sem mensagens ainda — inicie a abordagem)"}

PRODUTO: NexOS AI — sistema completo de automação de lançamentos digitais com 34 agentes de IA.
Plano Solo: acesso completo por ticket único. Plano Agency: multi-workspace + white-label.

Gere a PRÓXIMA mensagem ideal para o atendente enviar ao lead, seguindo exatamente o protocolo da etapa "${stage}".
A mensagem deve ser prática, no formato de app de mensagens (WhatsApp/DM), sem formatação de e-mail.
Máximo 3 parágrafos curtos. Use o nome do lead quando souber.
`.trim();

  const result = await completeWithAgent(
    agentRole,
    systemPrompt,
    [{ role: "user", content: contextNote }],
    workspaceId,
    log,
    conv.campaignId ?? undefined,
  );

  log.info({ conversationId, agentRole, stage }, "sales-team: reply suggestion generated");

  return { suggestion: result.content, agentRole, funnelStage: stage };
}

export async function updateSalesConversation(id: string, workspaceId: string, data: {
  contactName?: string;
  contactHandle?: string;
  channel?: string;
  funnelStage?: string;
  status?: string;
  campaignId?: string | null;
  notes?: string;
}) {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (data.contactName !== undefined) updateData.contactName = data.contactName;
  if (data.contactHandle !== undefined) updateData.contactHandle = data.contactHandle;
  if (data.channel !== undefined) updateData.channel = data.channel;
  if (data.funnelStage !== undefined) {
    updateData.funnelStage = data.funnelStage;
    updateData.assignedAgent = STAGE_TO_AGENT[(data.funnelStage as SalesFunnelStage) ?? "warming"];
  }
  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === "converted" || data.status === "lost") {
      updateData.closedAt = new Date();
    }
  }
  if ("campaignId" in data) updateData.campaignId = data.campaignId;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const [updated] = await db
    .update(salesConversationsTable)
    .set(updateData)
    .where(and(
      eq(salesConversationsTable.id, id),
      eq(salesConversationsTable.workspaceId, workspaceId),
    ))
    .returning();

  return updated;
}

export async function deleteSalesConversation(id: string, workspaceId: string) {
  await db
    .delete(salesConversationsTable)
    .where(and(
      eq(salesConversationsTable.id, id),
      eq(salesConversationsTable.workspaceId, workspaceId),
    ));
}

export async function getSalesAnalytics(workspaceId: string) {
  const all = await db
    .select()
    .from(salesConversationsTable)
    .where(eq(salesConversationsTable.workspaceId, workspaceId));

  const total = all.length;
  const active = all.filter(c => c.status === "active").length;
  const converted = all.filter(c => c.status === "converted").length;
  const lost = all.filter(c => c.status === "lost").length;
  const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;

  const byStage = {
    warming: all.filter(c => c.funnelStage === "warming").length,
    desire: all.filter(c => c.funnelStage === "desire").length,
    scarcity: all.filter(c => c.funnelStage === "scarcity").length,
    objection: all.filter(c => c.funnelStage === "objection").length,
    post_sale: all.filter(c => c.funnelStage === "post_sale").length,
  };

  const byChannel = {
    whatsapp: all.filter(c => c.channel === "whatsapp").length,
    telegram: all.filter(c => c.channel === "telegram").length,
    facebook: all.filter(c => c.channel === "facebook").length,
    instagram: all.filter(c => c.channel === "instagram").length,
    landing: all.filter(c => c.channel === "landing").length,
    manual: all.filter(c => c.channel === "manual").length,
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayConversions = all.filter(c =>
    c.status === "converted" && c.closedAt && c.closedAt >= today
  ).length;

  const thisWeek = new Date();
  thisWeek.setDate(thisWeek.getDate() - 7);
  const weekConversions = all.filter(c =>
    c.status === "converted" && c.closedAt && c.closedAt >= thisWeek
  ).length;

  return {
    total,
    active,
    converted,
    lost,
    conversionRate,
    todayConversions,
    weekConversions,
    byStage,
    byChannel,
  };
}
