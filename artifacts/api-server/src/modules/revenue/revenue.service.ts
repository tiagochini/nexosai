import { eq, and, desc, gte, sql } from "drizzle-orm";
import {
  db,
  revenueEventsTable,
  webhookConfigsTable,
  type RevenuePlatform,
  type WebhookConfig,
} from "@workspace/db";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import crypto from "crypto";
import { env } from "../../lib/env.js";

// ─── Webhook config management ────────────────────────────────────────────────

export async function createWebhookConfig(
  workspaceId: string,
  platform: RevenuePlatform,
  opts: { hottok?: string; signingSecret?: string } = {}
): Promise<WebhookConfig & { webhookUrl: string }> {
  const existing = await db
    .select()
    .from(webhookConfigsTable)
    .where(
      and(
        eq(webhookConfigsTable.workspaceId, workspaceId),
        eq(webhookConfigsTable.platform, platform)
      )
    )
    .limit(1);

  if (existing[0]) {
    return {
      ...existing[0],
      webhookUrl: buildWebhookUrl(platform, existing[0].webhookToken),
    };
  }

  const webhookToken = crypto.randomBytes(24).toString("hex");
  const signingSecret = opts.signingSecret ?? crypto.randomBytes(32).toString("hex");

  const [config] = await db
    .insert(webhookConfigsTable)
    .values({
      workspaceId,
      platform,
      webhookToken,
      signingSecret,
      isActive: true,
      metadata: opts.hottok ? { hottok: opts.hottok } : {},
    })
    .returning();

  if (!config) throw new AppError(500, "Falha ao criar webhook config", "DB_ERROR");

  logger.info({ workspaceId, platform }, "Webhook config created");
  return {
    ...config,
    webhookUrl: buildWebhookUrl(platform, webhookToken),
  };
}

export async function getWebhookConfigs(
  workspaceId: string
): Promise<Array<WebhookConfig & { webhookUrl: string }>> {
  const configs = await db
    .select()
    .from(webhookConfigsTable)
    .where(eq(webhookConfigsTable.workspaceId, workspaceId))
    .orderBy(webhookConfigsTable.platform);

  return configs.map((c) => ({
    ...c,
    webhookUrl: buildWebhookUrl(c.platform, c.webhookToken),
  }));
}

export async function deleteWebhookConfig(
  workspaceId: string,
  configId: string
): Promise<void> {
  const [config] = await db
    .select()
    .from(webhookConfigsTable)
    .where(
      and(
        eq(webhookConfigsTable.id, configId),
        eq(webhookConfigsTable.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!config) throw new NotFoundError("Webhook config não encontrado");

  await db
    .delete(webhookConfigsTable)
    .where(eq(webhookConfigsTable.id, configId));
}

// ─── Revenue analytics ────────────────────────────────────────────────────────

export async function getRevenueSummary(
  workspaceId: string,
  daysBack = 30
): Promise<{
  totalGross: number;
  totalNet: number;
  totalSales: number;
  totalRefunds: number;
  refundRate: number;
  byPlatform: Record<string, { gross: number; net: number; sales: number }>;
  byCampaign: Array<{ campaignId: string; gross: number; net: number; sales: number }>;
  dailyRevenue: Array<{ date: string; gross: number; net: number; sales: number }>;
}> {
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  const events = await db
    .select()
    .from(revenueEventsTable)
    .where(
      and(
        eq(revenueEventsTable.workspaceId, workspaceId),
        gte(revenueEventsTable.createdAt, since)
      )
    )
    .orderBy(desc(revenueEventsTable.createdAt));

  let totalGross = 0;
  let totalNet = 0;
  let totalSales = 0;
  let totalRefunds = 0;
  const byPlatform: Record<string, { gross: number; net: number; sales: number }> = {};
  const byCampaign: Record<string, { gross: number; net: number; sales: number }> = {};
  const byDate: Record<string, { gross: number; net: number; sales: number }> = {};

  for (const e of events) {
    const isRefund = e.eventType === "refund" || e.eventType === "chargeback";
    const isSale = e.eventType === "sale" || e.eventType === "upsell" || e.eventType === "order_bump" || e.eventType === "subscription_renewal";

    if (isSale && e.status === "confirmed") {
      totalGross += e.grossAmountCents;
      totalNet += e.netAmountCents;
      totalSales++;
    }
    if (isRefund) totalRefunds++;

    // By platform
    if (!byPlatform[e.platform]) byPlatform[e.platform] = { gross: 0, net: 0, sales: 0 };
    if (isSale && e.status === "confirmed") {
      byPlatform[e.platform]!.gross += e.grossAmountCents;
      byPlatform[e.platform]!.net += e.netAmountCents;
      byPlatform[e.platform]!.sales++;
    }

    // By campaign
    if (e.campaignId) {
      if (!byCampaign[e.campaignId]) byCampaign[e.campaignId] = { gross: 0, net: 0, sales: 0 };
      if (isSale && e.status === "confirmed") {
        byCampaign[e.campaignId]!.gross += e.grossAmountCents;
        byCampaign[e.campaignId]!.net += e.netAmountCents;
        byCampaign[e.campaignId]!.sales++;
      }
    }

    // By date
    const dateKey = e.createdAt.toISOString().split("T")[0]!;
    if (!byDate[dateKey]) byDate[dateKey] = { gross: 0, net: 0, sales: 0 };
    if (isSale && e.status === "confirmed") {
      byDate[dateKey]!.gross += e.grossAmountCents;
      byDate[dateKey]!.net += e.netAmountCents;
      byDate[dateKey]!.sales++;
    }
  }

  return {
    totalGross,
    totalNet,
    totalSales,
    totalRefunds,
    refundRate: totalSales > 0 ? (totalRefunds / totalSales) * 100 : 0,
    byPlatform,
    byCampaign: Object.entries(byCampaign).map(([campaignId, v]) => ({ campaignId, ...v })),
    dailyRevenue: Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v })),
  };
}

export async function getRevenueEvents(
  workspaceId: string,
  opts: {
    platform?: string;
    campaignId?: string;
    eventType?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  const conditions = [eq(revenueEventsTable.workspaceId, workspaceId)];

  const events = await db
    .select()
    .from(revenueEventsTable)
    .where(and(...conditions))
    .orderBy(desc(revenueEventsTable.createdAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);

  return events;
}

export async function linkEventToCampaign(
  workspaceId: string,
  eventId: string,
  campaignId: string
): Promise<void> {
  const [event] = await db
    .select()
    .from(revenueEventsTable)
    .where(
      and(
        eq(revenueEventsTable.id, eventId),
        eq(revenueEventsTable.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!event) throw new NotFoundError("Revenue event não encontrado");

  await db
    .update(revenueEventsTable)
    .set({ campaignId })
    .where(eq(revenueEventsTable.id, eventId));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildWebhookUrl(platform: RevenuePlatform, token: string): string {
  return `${env.APP_URL}/api/revenue/webhooks/${platform}?token=${token}`;
}
