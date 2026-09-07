import { and, desc, eq, gt, lte, sql } from "drizzle-orm";
import { db, radarOrdersTable, radarPurchaseRequestsTable, radarSubscriptionsTable, radarUsageLedgerTable, regionalMonitorRunsTable, subscriptionPaymentsTable } from "@workspace/db";
import { AppError, ConflictError } from "../../lib/errors.js";
import { createAsaasBoleto, createAsaasPix, getAsaasPaymentStatus, isAsaasPaidStatus, isAsaasReversalStatus } from "../billing/billing.service.js";

export type RadarPackage = "RADAR_ESSENTIAL" | "RADAR_PRO" | "RADAR_SCALE" | "WAR_ROOM";
export type RadarCurrency = "BRL" | "USD";
export type RadarUsageDimension = "light_scan" | "detailed_scan" | "council_run" | "monitored_campaign" | "competitor" | "region";
export type RadarLimits = {
  monitoredCampaigns: number; competitors: number; regions: number; councilRuns: number;
  retentionDays: number; scanCadenceMinutes: number; interactionCenter: boolean; executiveIntelligence: boolean;
};
export type RadarChoice = RadarPackage | "NO_RADAR";
const DAY = 86_400_000;
/** Central, deployment-configurable launch date. Do not use a customer's first
 * login: legacy paid accounts start no earlier than the commercial launch. */
export const RADAR_COMMERCIAL_LAUNCH_DATE = new Date(process.env["RADAR_COMMERCIAL_LAUNCH_DATE"] ?? "2026-09-08T00:00:00.000Z");
const plusCalendarDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};
export function includedRadarTrialWindow(paidSubscriptionStartsAt: Date, launchDate = RADAR_COMMERCIAL_LAUNCH_DATE) {
  const startsAt = new Date(Math.max(paidSubscriptionStartsAt.getTime(), launchDate.getTime()));
  return { startsAt, endsAt: plusCalendarDays(startsAt, 90) };
}
export function isTerminalRadarPaymentStatus(status: string | undefined): boolean {
  return status === "fulfilled" || status === "overdue" || status === "expired" || status === "cancelled" || status === "refunded";
}
export function isConfirmedNexosSubscriptionPayment(payment: { status: string; paidAt: Date | null; metadata: unknown }): boolean {
  return payment.status === "paid" && !!payment.paidAt && (payment.metadata as { type?: string } | null)?.type !== "pack";
}
export function resolveRadarSubscription<T extends { package: string; campaignId: string | null; windowStartsAt: Date | null; windowEndsAt: Date | null }>(rows: T[], now: Date, campaignId?: string): T | null {
  const warRoom = campaignId ? rows.find((row) => row.package === "WAR_ROOM" && row.campaignId === campaignId && !!row.windowStartsAt && !!row.windowEndsAt && row.windowStartsAt <= now && row.windowEndsAt > now) : null;
  return warRoom ?? rows.find((row) => row.package !== "WAR_ROOM") ?? null;
}

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

export async function getRadarEntitlement(workspaceId: string, now = new Date(), campaignId?: string) {
  // This is the canonical resolver used by both UI and protected work. Never
  // make included capacity contingent on someone opening the Radar page.
  await ensureIncludedRadarTrial(workspaceId, now);
  const rows = await db.select().from(radarSubscriptionsTable).where(and(
    eq(radarSubscriptionsTable.workspaceId, workspaceId), eq(radarSubscriptionsTable.status, "active"),
    lte(radarSubscriptionsTable.periodStartsAt, now), gt(radarSubscriptionsTable.periodEndsAt, now),
  )).orderBy(desc(radarSubscriptionsTable.createdAt));
  const subscription = resolveRadarSubscription(rows, now, campaignId);
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

export async function activateRadarEntitlement(workspaceId: string, pkg: RadarPackage, currency: RadarCurrency, activatedByUserId?: string, now = new Date(), input?: { source?: "subscription_included" | "asaas_purchase" | "admin"; orderId?: string; campaignId?: string }) {
  if (input?.orderId) {
    const [existing] = await db.select().from(radarSubscriptionsTable).where(eq(radarSubscriptionsTable.orderId, input.orderId)).limit(1);
    if (existing) return existing;
  }
  const catalog = RADAR_CATALOG[pkg];
  const end = new Date(now.getTime() + 30 * 24 * 60 * 60_000);
  const [subscription] = await db.insert(radarSubscriptionsTable).values({
    workspaceId, package: pkg, currency, status: "active", periodStartsAt: now, periodEndsAt: end,
    windowStartsAt: pkg === "WAR_ROOM" ? now : null, windowEndsAt: pkg === "WAR_ROOM" ? end : null,
    limitsSnapshot: catalog.limits, activatedByUserId: activatedByUserId ?? null, entitlementSource: input?.source ?? "admin", orderId: input?.orderId ?? null, campaignId: input?.campaignId ?? null,
  }).returning();
  return subscription!;
}

export async function reserveRadarUsage(input: { workspaceId: string; dimension: RadarUsageDimension; idempotencyKey: string; campaignId?: string; quantity?: number; metadata?: Record<string, unknown>; now?: Date }) {
  const now = input.now ?? new Date();
  await ensureIncludedRadarTrial(input.workspaceId, now);
  const quantity = input.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1) throw new RadarEntitlementError(409, "INVALID_QUANTITY", "Quantidade de consumo inválida.");
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.workspaceId}))`);
    const [duplicate] = await tx.select().from(radarUsageLedgerTable).where(and(eq(radarUsageLedgerTable.workspaceId, input.workspaceId), eq(radarUsageLedgerTable.idempotencyKey, input.idempotencyKey))).limit(1);
    if (duplicate) return { ledger: duplicate, deduplicated: true };
    const eligible = await tx.select().from(radarSubscriptionsTable).where(and(eq(radarSubscriptionsTable.workspaceId, input.workspaceId), eq(radarSubscriptionsTable.status, "active"), lte(radarSubscriptionsTable.periodStartsAt, now), gt(radarSubscriptionsTable.periodEndsAt, now))).orderBy(desc(radarSubscriptionsTable.createdAt));
    const subscription = resolveRadarSubscription(eligible, now, input.campaignId);
    const windowActive = !!subscription;
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

/** Only a confirmed platform subscription is authoritative. Credit-pack payments,
 * workspace plan assignment, invites and unpaid invoices intentionally do not qualify. */
export async function ensureIncludedRadarTrial(workspaceId: string, now = new Date()) {
  const [existing] = await db.select().from(radarSubscriptionsTable).where(and(
    eq(radarSubscriptionsTable.workspaceId, workspaceId),
    eq(radarSubscriptionsTable.entitlementSource, "subscription_included"),
  )).limit(1);
  if (existing) return existing;
  const payments = await db.select().from(subscriptionPaymentsTable).where(and(
    eq(subscriptionPaymentsTable.workspaceId, workspaceId), eq(subscriptionPaymentsTable.status, "paid"),
  )).orderBy(desc(subscriptionPaymentsTable.paidAt));
  const paidSubscription = payments.find(isConfirmedNexosSubscriptionPayment);
  if (!paidSubscription?.paidAt) return null;
  const { startsAt: start, endsAt: end } = includedRadarTrialWindow(paidSubscription.paidAt);
  // Do not create an already-expired included contract. This preserves the
  // launch-date fairness policy for paid legacy accounts.
  if (end <= now) return null;
  const [created] = await db.insert(radarSubscriptionsTable).values({
    workspaceId, package: "RADAR_PRO", currency: "BRL", status: "active",
    periodStartsAt: start, periodEndsAt: end, limitsSnapshot: RADAR_CATALOG.RADAR_PRO.limits,
    entitlementSource: "subscription_included",
  }).onConflictDoNothing().returning();
  return created ?? (await db.select().from(radarSubscriptionsTable).where(and(eq(radarSubscriptionsTable.workspaceId, workspaceId), eq(radarSubscriptionsTable.entitlementSource, "subscription_included"))).limit(1))[0] ?? null;
}

export async function createRadarCheckout(input: { workspaceId: string; userId: string; userName: string; userEmail: string; pkg: RadarPackage; method: "pix" | "boleto"; idempotencyKey: string; campaignId?: string }) {
  const catalog = RADAR_CATALOG[input.pkg];
  const description = `NexOS Radar — ${catalog.name}${input.pkg === "WAR_ROOM" ? " (janela de 30 dias)" : " (30 dias)"}`;
  // Claim before contacting Asaas. The unique workspace/key index is the
  // concurrency boundary: duplicate requests observe initializing/pending and
  // never reach the provider.
  const [claim] = await db.insert(radarOrdersTable).values({
    workspaceId: input.workspaceId, requestedByUserId: input.userId, campaignId: input.campaignId ?? null, package: input.pkg, currency: "BRL",
    amountCents: catalog.prices.BRL, description, limitsSnapshot: catalog.limits, method: input.method,
    idempotencyKey: input.idempotencyKey, status: "initializing",
  }).onConflictDoNothing().returning();
  if (!claim) {
    const [existing] = await db.select().from(radarOrdersTable).where(and(eq(radarOrdersTable.workspaceId, input.workspaceId), eq(radarOrdersTable.idempotencyKey, input.idempotencyKey))).limit(1);
    if (!existing) throw new ConflictError("Não foi possível reservar o checkout; tente novamente.");
    return existing;
  }
  const dueDate = new Date(Date.now() + 3 * DAY).toISOString().slice(0, 10);
  // No fallback/manual instructions: a checkout endpoint either creates a real
  // Asaas payment or returns the provider error.
  let providerPaymentId: string;
  let providerData: Record<string, unknown>;
  let expiresAt: Date;
  try {
    if (input.method === "pix") {
      const provider = await createAsaasPix({ name: input.userName, email: input.userEmail, amountCents: catalog.prices.BRL, description, dueDate });
      providerPaymentId = provider.asaasId;
      providerData = { pixData: { qrCode: provider.qrCode, copiaECola: provider.copiaECola, expiresAt: provider.expiresAt, asaasId: provider.asaasId } };
      expiresAt = new Date(provider.expiresAt);
    } else {
      const provider = await createAsaasBoleto({ name: input.userName, email: input.userEmail, amountCents: catalog.prices.BRL, description, dueDate });
      providerPaymentId = provider.asaasId;
      providerData = { boletoData: { barcodeUrl: provider.bankSlipUrl, barcode: provider.barcode, dueDate, asaasId: provider.asaasId } };
      expiresAt = new Date(`${dueDate}T23:59:59.000Z`);
    }
    const [order] = await db.update(radarOrdersTable).set({ status: "pending", providerPaymentId, providerData, expiresAt })
      .where(and(eq(radarOrdersTable.id, claim.id), eq(radarOrdersTable.status, "initializing"))).returning();
    if (!order) throw new AppError(409, "Checkout está sendo inicializado; consulte o pagamento antes de tentar novamente.", "RADAR_CHECKOUT_INITIALIZING");
    return order;
  } catch (error) {
    // The provider never returned a payment ID, so releasing the claim permits
    // a safe retry with this same idempotency key.
    await db.delete(radarOrdersTable).where(and(eq(radarOrdersTable.id, claim.id), eq(radarOrdersTable.status, "initializing")));
    throw error;
  }
}

export async function selectNoRadar(workspaceId: string, userId: string, idempotencyKey: string) {
  const [existing] = await db.select().from(radarOrdersTable).where(and(eq(radarOrdersTable.workspaceId, workspaceId), eq(radarOrdersTable.idempotencyKey, idempotencyKey))).limit(1);
  if (existing) return existing;
  const [choice] = await db.insert(radarOrdersTable).values({
    workspaceId, requestedByUserId: userId, package: "NO_RADAR", currency: "BRL", amountCents: 0,
    description: "NexOS Radar — sem pacote", idempotencyKey, status: "fulfilled", fulfilledAt: new Date(),
  }).returning();
  return choice!;
}

export async function getRadarPayment(workspaceId: string, orderId: string) {
  const [order] = await db.select().from(radarOrdersTable).where(and(eq(radarOrdersTable.id, orderId), eq(radarOrdersTable.workspaceId, workspaceId))).limit(1);
  if (!order) return null;
  if (order.status === "pending" && order.expiresAt && order.expiresAt < new Date()) {
    const [expired] = await db.update(radarOrdersTable).set({ status: "expired" }).where(and(eq(radarOrdersTable.id, order.id), eq(radarOrdersTable.status, "pending"))).returning();
    return expired ?? order;
  }
  return order;
}

export async function processRadarAsaasEvent(providerPaymentId: string, event: string, providerPayload: unknown) {
  const [order] = await db.select().from(radarOrdersTable).where(eq(radarOrdersTable.providerPaymentId, providerPaymentId)).limit(1);
  if (!order) return;
  const now = new Date();
  if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
    if (order.status === "fulfilled") return;
    // A signed payload may still be stale or spoofed in deployments without a
    // configured webhook secret. Settlement is verified against Asaas itself.
    const providerStatus = await getAsaasPaymentStatus(providerPaymentId);
    if (!isAsaasPaidStatus(providerStatus)) return;
    // A real settlement wins over an optimistic local polling expiry. This
    // avoids retaining payment without capacity when Asaas settles near due time.
    if (order.status === "pending" || order.status === "expired" || order.status === "overdue") {
      const [claimed] = await db.update(radarOrdersTable).set({ status: "confirmed", confirmedAt: now, providerData: { ...(order.providerData as object), providerPayload } }).where(and(eq(radarOrdersTable.id, order.id), eq(radarOrdersTable.status, "pending"))).returning();
      if (!claimed && order.status === "pending") return;
      if (!claimed) await db.update(radarOrdersTable).set({ status: "confirmed", confirmedAt: now, providerData: { ...(order.providerData as object), providerPayload } }).where(eq(radarOrdersTable.id, order.id));
    } else if (order.status !== "confirmed") return;
    await activateRadarEntitlement(order.workspaceId, order.package as RadarPackage, "BRL", order.requestedByUserId ?? undefined, now, { source: "asaas_purchase", orderId: order.id, campaignId: order.campaignId ?? undefined });
    await db.update(radarOrdersTable).set({ status: "fulfilled", fulfilledAt: now }).where(eq(radarOrdersTable.id, order.id));
  } else if (["PAYMENT_OVERDUE", "PAYMENT_DELETED", "PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_CHARGEBACK_DISPUTE"].includes(event)) {
    const providerStatus = await getAsaasPaymentStatus(providerPaymentId);
    if (!isAsaasReversalStatus(event, providerStatus)) return;
    const status = event === "PAYMENT_OVERDUE" ? "overdue" : event === "PAYMENT_REFUNDED" ? "refunded" : "cancelled";
    await db.update(radarOrdersTable).set({ status: status as "overdue" | "refunded" | "cancelled", cancelledAt: status === "cancelled" ? now : null, refundedAt: status === "refunded" ? now : null }).where(eq(radarOrdersTable.id, order.id));
    await db.update(radarSubscriptionsTable).set({ status: "cancelled", cancelledAt: now }).where(eq(radarSubscriptionsTable.orderId, order.id));
  }
}

/** Pure scheduler policy: Essential is an economical weekly scan; all other packages use detailed acquisition. */
export function radarScheduledMode(limits: RadarLimits): "lightweight" | "detailed" {
  return limits.scanCadenceMinutes >= 10080 ? "lightweight" : "detailed";
}