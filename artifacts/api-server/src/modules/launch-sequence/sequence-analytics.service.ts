import { eq, and, count, sql } from "drizzle-orm";
import {
  db,
  launchSequencesTable,
  launchSequenceItemsTable,
  sequenceContactsTable,
  sequenceEngagementTable,
} from "@workspace/db";
import { runAgent, parseAgentJSON } from "../agents/agent.runner.js";
import { logger } from "../../lib/logger.js";

export interface ItemAnalytics {
  itemId: string;
  name: string;
  phase: string;
  dayIndex: number;
  channel: string[];
  dispatched: number;
  opens: number;
  clicks: number;
  conversions: number;
  openRate: number;
  clickRate: number;
  status: string;
}

export interface UtmSource {
  source: string;
  count: number;
  openRate: number;
  clickRate: number;
  converted: number;
}

export interface SendTimeInsight {
  preferredHour: number;
  preferredHourLabel: string;
  topHours: { hour: number; label: string; opens: number }[];
}

export interface SequenceAnalytics {
  sequenceId: string;
  sequenceName: string;
  totalContacts: number;
  segments: {
    hot: number;
    warm: number;
    cold: number;
    converted: number;
    unsubscribed: number;
  };
  overallOpenRate: number;
  overallClickRate: number;
  overallConversionRate: number;
  engagementTrend: "rising" | "stable" | "declining";
  byItem: ItemAnalytics[];
  adaptiveSuggestions: string[];
  healthScore: number;
  utmBreakdown: UtmSource[];
  referralStats: { totalReferrals: number; topReferrers: { name: string; count: number }[] };
  sendTimeInsight: SendTimeInsight | null;
}

export async function getSequenceAnalytics(
  workspaceId: string,
  sequenceId: string,
): Promise<SequenceAnalytics> {
  const [sequence] = await db
    .select()
    .from(launchSequencesTable)
    .where(
      and(
        eq(launchSequencesTable.id, sequenceId),
        eq(launchSequencesTable.workspaceId, workspaceId),
      ),
    );

  if (!sequence) throw new Error("Sequence not found");

  const items = await db
    .select()
    .from(launchSequenceItemsTable)
    .where(eq(launchSequenceItemsTable.sequenceId, sequenceId))
    .orderBy(launchSequenceItemsTable.dayIndex);

  const contacts = await db
    .select({
      id: sequenceContactsTable.id,
      name: sequenceContactsTable.name,
      segment: sequenceContactsTable.segment,
      metadata: sequenceContactsTable.metadata,
    })
    .from(sequenceContactsTable)
    .where(eq(sequenceContactsTable.sequenceId, sequenceId));

  const totalContacts = contacts.length;
  const segments = {
    hot: contacts.filter((c) => c.segment === "hot").length,
    warm: contacts.filter((c) => c.segment === "warm").length,
    cold: contacts.filter((c) => c.segment === "cold").length,
    converted: contacts.filter((c) => c.segment === "converted").length,
    unsubscribed: contacts.filter((c) => c.segment === "unsubscribed").length,
  };

  const engagementRows = await db
    .select({
      itemId: sequenceEngagementTable.itemId,
      event: sequenceEngagementTable.event,
      cnt: count(),
    })
    .from(sequenceEngagementTable)
    .where(eq(sequenceEngagementTable.sequenceId, sequenceId))
    .groupBy(sequenceEngagementTable.itemId, sequenceEngagementTable.event);

  const engagementByItem = new Map<
    string,
    { opens: number; clicks: number; conversions: number; delivered: number }
  >();

  for (const row of engagementRows) {
    const id = row.itemId ?? "__global";
    if (!engagementByItem.has(id)) {
      engagementByItem.set(id, { opens: 0, clicks: 0, conversions: 0, delivered: 0 });
    }
    const e = engagementByItem.get(id)!;
    const n = Number(row.cnt);
    if (row.event === "open") e.opens += n;
    else if (row.event === "click") e.clicks += n;
    else if (row.event === "convert") e.conversions += n;
    else if (row.event === "delivered") e.delivered += n;
  }

  const byItem: ItemAnalytics[] = items.map((item) => {
    const eng = engagementByItem.get(item.id) ?? { opens: 0, clicks: 0, conversions: 0, delivered: 0 };
    const dispatched = eng.delivered || (item.status === "dispatched" ? totalContacts : 0);
    const openRate = dispatched > 0 ? eng.opens / dispatched : 0;
    const clickRate = eng.opens > 0 ? eng.clicks / eng.opens : 0;

    return {
      itemId: item.id,
      name: item.name,
      phase: item.phase,
      dayIndex: item.dayIndex,
      channel: (item.deliveryChannels as string[]) ?? [],
      dispatched,
      opens: eng.opens,
      clicks: eng.clicks,
      conversions: eng.conversions,
      openRate: Math.round(openRate * 1000) / 10,
      clickRate: Math.round(clickRate * 1000) / 10,
      status: item.status,
    };
  });

  const dispatchedItems = byItem.filter((i) => i.dispatched > 0);
  const totalDispatched = dispatchedItems.reduce((a, b) => a + b.dispatched, 0);
  const totalOpens = dispatchedItems.reduce((a, b) => a + b.opens, 0);
  const totalClicks = dispatchedItems.reduce((a, b) => a + b.clicks, 0);
  const totalConversions = dispatchedItems.reduce((a, b) => a + b.conversions, 0);

  const overallOpenRate = totalDispatched > 0 ? Math.round((totalOpens / totalDispatched) * 1000) / 10 : 0;
  const overallClickRate = totalOpens > 0 ? Math.round((totalClicks / totalOpens) * 1000) / 10 : 0;
  const overallConversionRate = totalDispatched > 0 ? Math.round((totalConversions / totalDispatched) * 1000) / 10 : 0;

  const recentItems = dispatchedItems.slice(-5);
  const olderItems = dispatchedItems.slice(0, -5);
  const recentAvg = recentItems.length > 0 ? recentItems.reduce((a, b) => a + b.openRate, 0) / recentItems.length : 0;
  const olderAvg = olderItems.length > 0 ? olderItems.reduce((a, b) => a + b.openRate, 0) / olderItems.length : recentAvg;
  const engagementTrend: "rising" | "stable" | "declining" =
    recentAvg > olderAvg + 5 ? "rising" : recentAvg < olderAvg - 5 ? "declining" : "stable";

  const healthScore = Math.min(
    100,
    Math.round(
      overallOpenRate * 0.4 +
      overallClickRate * 0.3 +
      overallConversionRate * 0.2 +
      (segments.hot / Math.max(1, totalContacts)) * 100 * 0.1,
    ),
  );

  const adaptiveSuggestions = await generateAdaptiveSuggestions(
    sequence.name,
    overallOpenRate,
    overallClickRate,
    engagementTrend,
    byItem,
  );

  // ── UTM Breakdown ──────────────────────────────────────────────────────────
  const utmMap = new Map<string, { count: number; contactIds: string[] }>();
  for (const c of contacts) {
    const meta = (c.metadata as Record<string, unknown>) ?? {};
    const utmObj = meta["utm"] as Record<string, string> | undefined;
    const src = utmObj?.["utm_source"] ?? (meta["utm_source"] as string | undefined) ?? "direct";
    if (!utmMap.has(src)) utmMap.set(src, { count: 0, contactIds: [] });
    const entry = utmMap.get(src)!;
    entry.count++;
    entry.contactIds.push(c.id);
  }

  const utmBreakdown: UtmSource[] = [];
  for (const [source, { count, contactIds }] of utmMap.entries()) {
    const idSet = new Set(contactIds);
    const srcConverted = contacts.filter((c) => idSet.has(c.id) && c.segment === "converted").length;
    utmBreakdown.push({
      source,
      count,
      openRate: overallOpenRate, // approximation without per-contact engagement joins
      clickRate: overallClickRate,
      converted: srcConverted,
    });
  }
  utmBreakdown.sort((a, b) => b.count - a.count);

  // ── Referral Stats ─────────────────────────────────────────────────────────
  const referrerCounts = new Map<string, { name: string; count: number }>();
  for (const c of contacts) {
    const meta = (c.metadata as Record<string, unknown>) ?? {};
    const code = meta["referralCode"] as string | undefined;
    const count = Number(meta["referralCount"] ?? 0);
    if (code && count > 0) {
      referrerCounts.set(code, { name: c.name ?? "Participante", count });
    }
  }
  const totalReferrals = contacts.filter((c) => {
    const meta = (c.metadata as Record<string, unknown>) ?? {};
    return !!meta["referredBy"];
  }).length;
  const topReferrers = Array.from(referrerCounts.values()).sort((a, b) => b.count - a.count).slice(0, 10);

  // ── Send Time Insight ──────────────────────────────────────────────────────
  const hourCounts = new Map<number, number>();
  for (const c of contacts) {
    const meta = (c.metadata as Record<string, unknown>) ?? {};
    const hours = meta["engagementHours"] as number[] | undefined;
    if (hours) {
      for (const h of hours) hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1);
    }
  }

  let sendTimeInsight: SendTimeInsight | null = null;
  if (hourCounts.size > 0) {
    const sorted = Array.from(hourCounts.entries()).sort((a, b) => b[1] - a[1]);
    const [bestHour] = sorted[0]!;
    const hourLabel = (h: number) =>
      `${String(h).padStart(2, "0")}:00–${String((h + 1) % 24).padStart(2, "0")}:00`;
    sendTimeInsight = {
      preferredHour: bestHour,
      preferredHourLabel: hourLabel(bestHour),
      topHours: sorted.slice(0, 5).map(([hour, opens]) => ({ hour, label: hourLabel(hour), opens })),
    };
  }

  return {
    sequenceId,
    sequenceName: sequence.name,
    totalContacts,
    segments,
    overallOpenRate,
    overallClickRate,
    overallConversionRate,
    engagementTrend,
    byItem,
    adaptiveSuggestions,
    healthScore,
    utmBreakdown,
    referralStats: { totalReferrals, topReferrers },
    sendTimeInsight,
  };
}

async function generateAdaptiveSuggestions(
  sequenceName: string,
  openRate: number,
  clickRate: number,
  trend: string,
  byItem: ItemAnalytics[],
): Promise<string[]> {
  const lowOpenItems = byItem.filter((i) => i.dispatched > 0 && i.openRate < 20);
  const lowClickItems = byItem.filter((i) => i.opens > 10 && i.clickRate < 5);

  if (lowOpenItems.length === 0 && lowClickItems.length === 0 && openRate >= 20) {
    return [];
  }

  const log = logger.child({ component: "sequence-adaptive-ai" });

  const prompt = `Você é um especialista em email marketing e lançamentos digitais PT-BR.

Analise os dados de engajamento desta sequência e gere sugestões concretas de melhoria.

**Sequência:** ${sequenceName}
**Taxa de abertura geral:** ${openRate}%
**Taxa de clique geral:** ${clickRate}%
**Tendência:** ${trend}
**Itens com baixa abertura (<20%):** ${lowOpenItems.map((i) => `"${i.name}" (${i.openRate}%)`).join(", ") || "nenhum"}
**Itens com baixo clique (<5% dos abertos):** ${lowClickItems.map((i) => `"${i.name}" (${i.clickRate}%)`).join(", ") || "nenhum"}

Gere exatamente 3-5 sugestões práticas e específicas. Retorne JSON:
{"suggestions": ["sugestão 1", "sugestão 2", ...]}`;

  try {
    const result = await runAgent({
      campaignId: `analytics-${sequenceName}`,
      workspaceId: "analytics",
      agentRole: "analytics",
      systemPrompt: "Você é especialista em otimização de sequências de email marketing para lançamentos digitais no Brasil.",
      messages: [{ role: "user", content: prompt }],
      log,
    });

    const parsed = parseAgentJSON<{ suggestions: string[] }>(result.content, { suggestions: [] });
    return parsed.suggestions ?? [];
  } catch {
    return [
      "Teste novos assuntos de email com curiosidade ou urgência nos itens com abertura abaixo de 20%",
      "Adicione prova social (screenshots, depoimentos) nos emails com baixo CTR",
      "Envie um WhatsApp de reforço 2h após cada email crítico (PLC1, PLC2, abertura do carrinho)",
    ];
  }
}

export async function recordEngagementEvent(params: {
  sequenceId: string;
  workspaceId: string;
  itemId?: string;
  contactId?: string;
  event: "delivered" | "open" | "click" | "convert" | "reply" | "unsubscribe" | "bounced";
  channel?: string;
  externalRef?: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(sequenceEngagementTable).values({
    sequenceId: params.sequenceId,
    workspaceId: params.workspaceId,
    itemId: params.itemId ?? null,
    contactId: params.contactId ?? null,
    event: params.event,
    channel: params.channel ?? null,
    externalRef: params.externalRef ?? null,
    metadata: params.metadata ?? {},
  });

  if (params.contactId) {
    await updateContactSegment(params.contactId, params.event);
  }
}

async function updateContactSegment(
  contactId: string,
  latestEvent: string,
): Promise<void> {
  const [contact] = await db
    .select()
    .from(sequenceContactsTable)
    .where(eq(sequenceContactsTable.id, contactId));

  if (!contact) return;

  if (latestEvent === "unsubscribe") {
    await db
      .update(sequenceContactsTable)
      .set({ segment: "unsubscribed" })
      .where(eq(sequenceContactsTable.id, contactId));
    return;
  }

  if (latestEvent === "convert") {
    await db
      .update(sequenceContactsTable)
      .set({
        segment: "converted",
        conversions: sql`${sequenceContactsTable.conversions} + 1`,
      })
      .where(eq(sequenceContactsTable.id, contactId));
    return;
  }

  const updates: Record<string, unknown> = {};

  if (latestEvent === "open") {
    updates["itemsOpened"] = sql`${sequenceContactsTable.itemsOpened} + 1`;
    // ── Send time optimization: track engagement hour ──────────────────────
    const currentHour = new Date().getUTCHours();
    const existingMeta = (contact.metadata as Record<string, unknown>) ?? {};
    const prevHours = (existingMeta["engagementHours"] as number[] | undefined) ?? [];
    const updatedHours = [...prevHours, currentHour].slice(-20); // keep last 20 opens
    // Calculate preferred hour (mode)
    const hMap = new Map<number, number>();
    for (const h of updatedHours) hMap.set(h, (hMap.get(h) ?? 0) + 1);
    const preferredSendHour = [...hMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? currentHour;
    updates["metadata"] = { ...existingMeta, engagementHours: updatedHours, preferredSendHour };
  } else if (latestEvent === "click") {
    updates["itemsClicked"] = sql`${sequenceContactsTable.itemsClicked} + 1`;
  } else if (latestEvent === "delivered") {
    updates["itemsReceived"] = sql`${sequenceContactsTable.itemsReceived} + 1`;
  }

  const newOpened = contact.itemsOpened + (latestEvent === "open" ? 1 : 0);
  const newClicked = contact.itemsClicked + (latestEvent === "click" ? 1 : 0);
  const received = Math.max(1, contact.itemsReceived);

  const openRatio = newOpened / received;
  const clickRatio = newClicked / Math.max(1, newOpened);
  const score = Math.min(100, Math.round(openRatio * 50 + clickRatio * 50));

  let segment: "hot" | "warm" | "cold" = "cold";
  if (score >= 60) segment = "hot";
  else if (score >= 25) segment = "warm";

  updates["engagementScore"] = score;
  updates["segment"] = segment;

  await db
    .update(sequenceContactsTable)
    .set(updates as Parameters<typeof db.update>[0] extends infer T ? Record<string, unknown> : never)
    .where(eq(sequenceContactsTable.id, contactId));
}
