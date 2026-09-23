import { and, desc, eq, gte, lte, lt, or, sql } from "drizzle-orm";
import {
  db, campaignsTable, m11SocialReportsTable, socialCommentActionsTable,
  socialConversationTurnsTable, workspaceIntegrationsTable, workspacesTable,
} from "@workspace/db";

const MAX_DAYS = 366;
const iso = (value: unknown, fallback: Date) => {
  if (typeof value !== "string") return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  return date;
};
function windowOf(query: Record<string, unknown>) {
  const to = iso(query.to, new Date());
  const from = iso(query.from, new Date(to.getTime() - 30 * 86400000));
  if (from > to || to.getTime() - from.getTime() > MAX_DAYS * 86400000) throw new Error("Date range must be valid and at most 366 days");
  return { from, to };
}
function cursorOf(value: unknown): { at: Date; id: string } | undefined {
  if (typeof value !== "string") return undefined;
  try { const parsed = JSON.parse(Buffer.from(value, "base64url").toString()); const at = new Date(parsed.at); if (!parsed.id || Number.isNaN(at.getTime())) throw new Error(); return { at, id: parsed.id }; } catch { throw new Error("Invalid cursor"); }
}
export function encodeCursor(at: Date, id: string) { return Buffer.from(JSON.stringify({ at: at.toISOString(), id })).toString("base64url"); }

async function scopedCampaign(workspaceId: string, campaignId?: string) {
  if (!campaignId) return undefined;
  const [campaign] = await db.select({ id: campaignsTable.id }).from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId))).limit(1);
  if (!campaign) throw new Error("Campaign not found in workspace");
  return campaign.id;
}

export async function inbox(workspaceId: string, query: Record<string, unknown>) {
  const { from, to } = windowOf(query);
  const campaignId = await scopedCampaign(workspaceId, typeof query.campaignId === "string" ? query.campaignId : undefined);
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100);
  const cursor = cursorOf(query.cursor);
  const base = [eq(socialCommentActionsTable.workspaceId, workspaceId), gte(socialCommentActionsTable.createdAt, from), lte(socialCommentActionsTable.createdAt, to)];
  if (campaignId) base.push(eq(socialCommentActionsTable.campaignId, campaignId));
  if (cursor) base.push(or(lt(socialCommentActionsTable.createdAt, cursor.at), and(eq(socialCommentActionsTable.createdAt, cursor.at), lt(socialCommentActionsTable.id, cursor.id)))!);
  const comments = await db.select().from(socialCommentActionsTable).where(and(...base)).orderBy(desc(socialCommentActionsTable.createdAt), desc(socialCommentActionsTable.id)).limit(limit + 1);
  const turnBase = [eq(socialConversationTurnsTable.workspaceId, workspaceId), eq(workspaceIntegrationsTable.workspaceId, workspaceId), gte(socialConversationTurnsTable.createdAt, from), lte(socialConversationTurnsTable.createdAt, to)];
  if (campaignId) turnBase.push(eq(socialConversationTurnsTable.campaignId, campaignId));
  if (cursor) turnBase.push(or(lt(socialConversationTurnsTable.createdAt, cursor.at), and(eq(socialConversationTurnsTable.createdAt, cursor.at), lt(socialConversationTurnsTable.id, cursor.id)))!);
  const turns = await db.select({ turn: socialConversationTurnsTable }).from(socialConversationTurnsTable)
    .innerJoin(workspaceIntegrationsTable, eq(workspaceIntegrationsTable.id, socialConversationTurnsTable.integrationId))
    .where(and(...turnBase)).orderBy(desc(socialConversationTurnsTable.createdAt), desc(socialConversationTurnsTable.id)).limit(limit + 1);
  const rows = [
    ...comments.map((row) => ({ id: row.id, at: row.createdAt, kind: "comment", campaignId: row.campaignId, platform: row.platform, status: row.action, deliveryStatus: row.platformReplyId ? "historically_sent" : "not_sent", data: row })),
    ...turns.map(({ turn: row }) => ({ id: row.id, at: row.createdAt, kind: "conversation", campaignId: row.campaignId, platform: row.channel, status: row.decision ?? "recorded", deliveryStatus: row.sentAt ? "historically_sent" : "not_sent", data: row })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime() || b.id.localeCompare(a.id));
  const filtered = cursor ? rows.filter((r) => r.at < cursor.at || (r.at.getTime() === cursor.at.getTime() && r.id < cursor.id)) : rows;
  const page = filtered.slice(0, limit);
  const items = page.map((row) => ({
    id: row.id, at: row.at, kind: row.kind, campaignId: row.campaignId,
    platform: row.platform, status: row.status, deliveryStatus: row.deliveryStatus,
    ...(row.kind === "comment"
      ? { postId: (row.data as Record<string, unknown>).postId, commentId: (row.data as Record<string, unknown>).commentId, authorName: (row.data as Record<string, unknown>).authorName, commentText: (row.data as Record<string, unknown>).commentText, classification: (row.data as Record<string, unknown>).classification }
      : { channel: (row.data as Record<string, unknown>).channel, direction: (row.data as Record<string, unknown>).direction, intent: (row.data as Record<string, unknown>).intent, needsHuman: (row.data as Record<string, unknown>).needsHuman, inputText: (row.data as Record<string, unknown>).inputText, replyText: (row.data as Record<string, unknown>).replyText }),
  }));
  return { items, nextCursor: page.length === limit ? encodeCursor(page[page.length - 1]!.at, page[page.length - 1]!.id) : null, period: { from, to }, filters: { campaignId: campaignId ?? null } };
}

export async function createReport(workspaceId: string, userId: string, query: Record<string, unknown>) {
  const { from, to } = windowOf(query);
  const campaignId = await scopedCampaign(workspaceId, typeof query.campaignId === "string" ? query.campaignId : undefined);
  const commentConditions = [eq(socialCommentActionsTable.workspaceId, workspaceId), gte(socialCommentActionsTable.createdAt, from), lte(socialCommentActionsTable.createdAt, to)];
  const turnConditions = [eq(socialConversationTurnsTable.workspaceId, workspaceId), eq(workspaceIntegrationsTable.workspaceId, workspaceId), gte(socialConversationTurnsTable.createdAt, from), lte(socialConversationTurnsTable.createdAt, to)];
  if (campaignId) { commentConditions.push(eq(socialCommentActionsTable.campaignId, campaignId)); turnConditions.push(eq(socialConversationTurnsTable.campaignId, campaignId)); }
  const [{ count: commentCount }] = await db.select({ count: sql<number>`count(*)::int` }).from(socialCommentActionsTable).where(and(...commentConditions));
  const [{ count: turnCount }] = await db.select({ count: sql<number>`count(*)::int` }).from(socialConversationTurnsTable).innerJoin(workspaceIntegrationsTable, eq(workspaceIntegrationsTable.id, socialConversationTurnsTable.integrationId)).where(and(...turnConditions));
  const totalCount = Number(commentCount) + Number(turnCount);
  const commentStatuses = await db.select({ status: socialCommentActionsTable.action, count: sql<number>`count(*)::int` }).from(socialCommentActionsTable).where(and(...commentConditions)).groupBy(socialCommentActionsTable.action);
  const turnStatuses = await db.select({ status: socialConversationTurnsTable.decision, count: sql<number>`count(*)::int` }).from(socialConversationTurnsTable).innerJoin(workspaceIntegrationsTable, eq(workspaceIntegrationsTable.id, socialConversationTurnsTable.integrationId)).where(and(...turnConditions)).groupBy(socialConversationTurnsTable.decision);
  const byStatus: Record<string, number> = {};
  for (const row of [...commentStatuses, ...turnStatuses]) byStatus[row.status ?? "unknown"] = (byStatus[row.status ?? "unknown"] ?? 0) + Number(row.count);
  const aggregates = {
    totalItems: totalCount,
    comments: Number(commentCount),
    conversations: Number(turnCount),
    byStatus,
    campaignKpis: { status: "omitted", reason: "Campaign KPI source is not reliably attributable to this social period/filter." },
  };
  const [report] = await db.insert(m11SocialReportsTable).values({
    workspaceId, createdBy: userId, periodFrom: from, periodTo: to,
    filters: { campaignId: campaignId ?? null }, aggregates, rowCount: totalCount,
    provenance: { sources: ["social_conversation_turns", "social_comment_actions"], limitations: ["Historical provider state is not evidence of a current send; no provider calls performed.", "Aggregate counts are complete; inbox preview is bounded to 100 rows."] },
  }).returning();
  return report;
}
export async function listReports(workspaceId: string) {
  return db.select().from(m11SocialReportsTable).where(eq(m11SocialReportsTable.workspaceId, workspaceId))
    .orderBy(desc(m11SocialReportsTable.createdAt), desc(m11SocialReportsTable.id)).limit(100);
}
export async function getReport(workspaceId: string, id: string) {
  const [report] = await db.select().from(m11SocialReportsTable).where(and(eq(m11SocialReportsTable.workspaceId, workspaceId), eq(m11SocialReportsTable.id, id))).limit(1);
  return report;
}
export async function isOwner(workspaceId: string, userId: string) {
  const [row] = await db.select({ id: workspacesTable.id }).from(workspacesTable).where(and(eq(workspacesTable.id, workspaceId), eq(workspacesTable.ownerId, userId))).limit(1);
  return Boolean(row);
}