import { and, desc, eq, gt, lte, sql } from "drizzle-orm";
import { db, radarPurchaseRequestsTable, radarSubscriptionsTable, radarUsageLedgerTable, regionalMonitorRunsTable } from "@workspace/db";
import { AppError, ConflictError } from "../../lib/errors.js";

export type RadarPackage = "RADAR_ESSENTIAL" | "RADAR_PRO" | "RADAR_SCALE" | "WAR_ROOM";
export type RadarCurrency = "BRL" | "USD";
export type RadarUsageDimension = "light_scan" | "detailed_scan" | "council_run" | "monitored_campaign" | "competitor" | "region";
export type RadarLimits = {
  monitoredCampaigns: number; competitors: number; regions: number; councilRuns: number;
  retentionDays: number; scanCadenceMinutes: number; interactionCenter: boolean; executiveIntelligence: boolean;
};

/** The sole commercial source of truth. Prices are integer minor units to avoid float billing errors. */
export const RADAR_CATALOG: Record<RadarPackage, { package: RadarPackage; name: string; interval: "month" | "launch_window"; prices: Record<RadarCurrency, number>; limits: RadarLimits }> = {
  RADAR_ESSENTIAL: { package: "RADAR_ESSENTIAL", name: "Radar Essential", interval: "month", prices: { BRL: 49700, USD: 9900 }, limits: { monitoredCampaigns: 1, competitors: 3, regions: 1, councilRuns: 20, retentionDays: 30, scanCadenceMinutes: 10080, interactionCenter: false, executiveIntelligence: false } },
  RADAR_PRO: { package: "RADAR_PRO", name: "Radar Pro", interval: "month", prices: { BRL: 149700, USD: 29900 }, limits: { monitoredCampaigns: 3, competitors: 10, regions: 3, councilRuns: 100, retentionDays: 180, scanCadenceMinutes: 1440, interactionCenter: true, executiveIntelligence: false } },
  RADAR_SCALE: { package: "RADAR_SCALE", name: "Radar Scale", interval: "month", prices: { BRL: 499700, USD: 99900 }, limits: { monitoredCampaigns: 10, competitors: 40, regions: 10, councilRuns: 1000, retentionDays: 730, scanCadenceMinutes: 360, interactionCenter: true, executiveIntelligence: true } },
  WAR_ROOM: { package: "WAR_ROOM", name: "War Room", interval: "launch_window", prices: { BRL: 799700, USD: 159900 }, limits: { monitoredCampaigns: 1, competitors: 20, regions: 5, councilRuns: 500, retentionDays: 365, scanCadenceMinutes: 15, interactionCenter: true, executiveIntelligence: true } },
};

export class RadarEntitlementError extends AppError {
  constructor(statusCode: 402 | 409 | 429, code: string, message: string, data?: unknown) { super(statusCode, message, code, data); }
}
const capacityFor: Partial<Record<RadarUsageDimension, keyof Pick<RadarLimits, "monitoredCampaigns" | "competitors" | "regions" | "councilRuns">>> = {
  monitored_campaign: "monitoredCampaigns", competitor: "competitors", region: "regions", council_run: "councilRuns",
};
const parseLimits = (value: unknown): RadarLimits => value as RadarLimits;

export async function getRadarEntitlement(workspaceId: string, now = new Date()) {
  const rows = await db.select().from(radarSubscriptionsTable).where(and(
    eq(radarSubscriptionsTable.workspaceId, workspaceId), eq(radarSubscriptionsTable.status, "active"),
    lte(radarSubscriptionsTable.periodStartsAt, now), gt(radarSubscriptionsTable.periodEndsAt, now),
  )).orderBy(desc(radarSubscriptionsTable.createdAt));
  const subscription = rows.find((row) => row.package !== "WAR_ROOM" || (!!row.windowStartsAt && !!row.windowEndsAt && row.windowStartsAt <= now && row.windowEndsAt > now)) ?? null;
  return subscription ? { subscription, limits: parseLimits(subscription.limitsSnapshot), active: true } : { subscription: null, limits: null, active: false };
}

/** A pending request is intentionally not a payment confirmation or entitlement. */
export async function requestRadarPurchase(workspaceId: string, userId: string, pkg: RadarPackage, currency: RadarCurrency, idempotencyKey: string, notes?: string) {
  const [created] = await db.insert(radarPurchaseRequestsTable).values({
    workspaceId, requestedByUserId: userId, package: pkg, currency, idempotencyKey, notes: notes?.trim() || null,
  }).onConflictDoNothing().returning();
  if (created) return { request: created, deduplicated: false };
  const [existing] = await db.select().from(radarPurchaseRequestsTable).where(and(eq(radarPurchaseRequestsTable.workspaceId, workspaceId), eq(radarPurchaseRequestsTable.idempotencyKey, idempotencyKey))).limit(1);
  if (!existing) throw new ConflictError("A chave de idempotência já pertence a outro workspace.");
  return { request: existing, deduplicated: true };
}

export async function activateRadarEntitlement(workspaceId: string, pkg: RadarPackage, currency: RadarCurrency, activatedByUserId?: string, now = new Date()) {
  const catalog = RADAR_CATALOG[pkg];
  const end = new Date(now.getTime() + 30 * 24 * 60 * 60_000);
  const [subscription] = await db.insert(radarSubscriptionsTable).values({
    workspaceId, package: pkg, currency, status: "active", periodStartsAt: now, periodEndsAt: end,
    windowStartsAt: pkg === "WAR_ROOM" ? now : null, windowEndsAt: pkg === "WAR_ROOM" ? end : null,
    limitsSnapshot: catalog.limits, activatedByUserId: activatedByUserId ?? null,
  }).returning();
  return subscription!;
}

export async function reserveRadarUsage(input: { workspaceId: string; dimension: RadarUsageDimension; idempotencyKey: string; campaignId?: string; quantity?: number; metadata?: Record<string, unknown>; now?: Date }) {
  const now = input.now ?? new Date();
  const quantity = input.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1) throw new RadarEntitlementError(409, "INVALID_QUANTITY", "Quantidade de consumo inválida.");
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.workspaceId}))`);
    const [duplicate] = await tx.select().from(radarUsageLedgerTable).where(and(eq(radarUsageLedgerTable.workspaceId, input.workspaceId), eq(radarUsageLedgerTable.idempotencyKey, input.idempotencyKey))).limit(1);
    if (duplicate) return { ledger: duplicate, deduplicated: true };
    const [subscription] = await tx.select().from(radarSubscriptionsTable).where(and(eq(radarSubscriptionsTable.workspaceId, input.workspaceId), eq(radarSubscriptionsTable.status, "active"), lte(radarSubscriptionsTable.periodStartsAt, now), gt(radarSubscriptionsTable.periodEndsAt, now))).orderBy(desc(radarSubscriptionsTable.createdAt)).limit(1);
    const windowActive = subscription && (subscription.package !== "WAR_ROOM" || (!!subscription.windowStartsAt && !!subscription.windowEndsAt && subscription.windowStartsAt <= now && subscription.windowEndsAt > now));
    if (!subscription || !windowActive) throw new RadarEntitlementError(402, "RADAR_ENTITLEMENT_REQUIRED", "Uma assinatura Radar ativa é necessária para esta operação.");
    const limits = parseLimits(subscription.limitsSnapshot);
    const key = capacityFor[input.dimension];
    if (key) {
      const [used] = await tx.select({ quantity: sql<number>`coalesce(sum(${radarUsageLedgerTable.quantity}), 0)` }).from(radarUsageLedgerTable).where(and(eq(radarUsageLedgerTable.workspaceId, input.workspaceId), eq(radarUsageLedgerTable.subscriptionId, subscription.id), eq(radarUsageLedgerTable.dimension, input.dimension)));
      const limit = limits[key];
      const usedQuantity = Number(used?.quantity ?? 0);
      if (usedQuantity + quantity > limit) throw new RadarEntitlementError(429, "RADAR_QUOTA_EXCEEDED", `Limite de ${input.dimension} do pacote Radar atingido.`, { limit, used: usedQuantity });
    }
    const [ledger] = await tx.insert(radarUsageLedgerTable).values({
      workspaceId: input.workspaceId, subscriptionId: subscription.id, dimension: input.dimension, quantity, campaignId: input.campaignId ?? null,
      idempotencyKey: input.idempotencyKey, periodStartsAt: subscription.package === "WAR_ROOM" ? subscription.windowStartsAt! : subscription.periodStartsAt,
      periodEndsAt: subscription.package === "WAR_ROOM" ? subscription.windowEndsAt! : subscription.periodEndsAt, metadata: input.metadata ?? {},
    }).returning();
    return { ledger: ledger!, deduplicated: false };
  });
}

export async function radarUsageSummary(workspaceId: string) {
  const entitlement = await getRadarEntitlement(workspaceId);
  const [pendingRequest] = await db.select().from(radarPurchaseRequestsTable).where(and(
    eq(radarPurchaseRequestsTable.workspaceId, workspaceId),
    eq(radarPurchaseRequestsTable.status, "pending_sales"),
  )).orderBy(desc(radarPurchaseRequestsTable.createdAt)).limit(1);
  if (!entitlement.subscription) return {
    entitlement,
    usage: {} as Record<string, number>,
    pendingRequest: pendingRequest ?? null,
    nextEligibleScanAt: null,
  };
  const rows = await db.select({ dimension: radarUsageLedgerTable.dimension, quantity: sql<number>`coalesce(sum(${radarUsageLedgerTable.quantity}), 0)` })
    .from(radarUsageLedgerTable).where(eq(radarUsageLedgerTable.subscriptionId, entitlement.subscription.id)).groupBy(radarUsageLedgerTable.dimension);
  const [latestRun] = await db.select({ startedAt: regionalMonitorRunsTable.startedAt }).from(regionalMonitorRunsTable)
    .where(eq(regionalMonitorRunsTable.workspaceId, workspaceId))
    .orderBy(desc(regionalMonitorRunsTable.startedAt)).limit(1);
  const nextEligibleScanAt = latestRun?.startedAt
    ? new Date(latestRun.startedAt.getTime() + entitlement.limits.scanCadenceMinutes * 60_000)
    : new Date();
  return {
    entitlement,
    usage: Object.fromEntries(rows.map((row) => [row.dimension, Number(row.quantity)])),
    pendingRequest: pendingRequest ?? null,
    nextEligibleScanAt,
  };
}

/** Pure scheduler policy: Essential is an economical weekly scan; all other packages use detailed acquisition. */
export function radarScheduledMode(limits: RadarLimits): "lightweight" | "detailed" {
  return limits.scanCadenceMinutes >= 10080 ? "lightweight" : "detailed";
}