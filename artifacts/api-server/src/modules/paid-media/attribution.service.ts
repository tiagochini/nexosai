import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import {
  db, paidMediaAccountsTable, paidMediaAttributionTouchpointsTable,
  paidMediaConversionsTable, paidMediaDatasetsTable, paidMediaEntitiesTable,
  paidMediaEventReceiptsTable, paidMediaInsightsTable,
} from "@workspace/db";
import { paidMediaProvider, paidMediaProviderCapabilities, normalizeMetaCapiEvent } from "./providers.js";

import { capiRetryEnvelope, finishCapiAttempt } from "./capi-retry.service.js";

function finiteNumber(value: unknown, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative number.`);
  return parsed;
}

export async function recordDatasetEvent(
  dataset: { id: string; workspaceId: string; accountId: string; provider: "meta_ads" | "tiktok_ads" | "google_ads"; providerDatasetId: string },
  input: { source: "browser" | "server"; eventId: string; eventName: string; occurredAt: string; matchKeys?: Record<string, unknown>; payload?: Record<string, unknown> },
) {
  const occurredAt = new Date(input.occurredAt);
  if (Number.isNaN(occurredAt.getTime()) || !input.eventId || !input.eventName) throw new Error("eventId, eventName and a valid occurredAt are required.");
  const consented = input.payload?.["marketingConsent"] === true;
  const normalized = normalizeMetaCapiEvent({ ...input, matchKeys: consented ? input.matchKeys : {} });
  const { client_ip_address: _ip, client_user_agent: _userAgent, ...safeKeys } = normalized.userData;
  const safePayload = { ...normalized.customData, marketingConsent: consented };
  const queued = input.source === "server" && consented && dataset.provider === "meta_ads" && dataset.providerDatasetId && Object.keys(normalized.userData).length
    ? { ...capiRetryEnvelope(dataset, normalized), deliveryAttempts: 0, retryAt: new Date() } : {};
  const inserted = await db.insert(paidMediaEventReceiptsTable).values({
    workspaceId: dataset.workspaceId, datasetId: dataset.id, source: input.source,
    eventId: input.eventId, eventName: input.eventName, occurredAt,
    eventMatchKeys: safeKeys, payload: safePayload, ...queued,
  }).onConflictDoNothing().returning({ id: paidMediaEventReceiptsTable.id, deliveryStatus: paidMediaEventReceiptsTable.deliveryStatus, eventName: paidMediaEventReceiptsTable.eventName, occurredAt: paidMediaEventReceiptsTable.occurredAt });
  const [existing] = inserted[0] ? inserted : await db.select({ id: paidMediaEventReceiptsTable.id, deliveryStatus: paidMediaEventReceiptsTable.deliveryStatus, eventName: paidMediaEventReceiptsTable.eventName, occurredAt: paidMediaEventReceiptsTable.occurredAt })
    .from(paidMediaEventReceiptsTable).where(and(eq(paidMediaEventReceiptsTable.datasetId, dataset.id), eq(paidMediaEventReceiptsTable.eventId, input.eventId))).limit(1);
  if (!existing) throw new Error("Event receipt could not be persisted.");
  if (existing.eventName !== input.eventName) throw new Error("eventId já pertence a outro eventName; use um identificador único por conversão.");
  if (inserted[0]) await db.update(paidMediaDatasetsTable).set({ lastEventAt: occurredAt }).where(eq(paidMediaDatasetsTable.id, dataset.id));
  // Browser receipts are retained for browser/server event_id dedupe. Only a
  // consented server receipt is allowed to cross the CAPI provider boundary.
  if (input.source !== "server") return { accepted: true, duplicate: !inserted[0], receiptId: existing.id, deliveryStatus: inserted[0] ? "pending" : existing.deliveryStatus };
  if (existing.deliveryStatus !== "pending") return { accepted: true, duplicate: true, receiptId: existing.id, deliveryStatus: existing.deliveryStatus };
  const capability = paidMediaProviderCapabilities(dataset.provider).conversionsApi;
  if (!consented || capability !== "supported" || !dataset.providerDatasetId) {
    const deliveryStatus = consented ? "capability_blocked" as const : "consent_withheld" as const;
    await db.update(paidMediaEventReceiptsTable).set({
      deliveryStatus, retryPayload: null, retryAt: null, providerErrorCode: consented ? "CAPABILITY_BLOCKED" : "CONSENT_WITHHELD",
      providerErrorMessage: consented ? "Provider conversion transport or dataset external ID is unavailable." : "Marketing consent was not supplied; no provider event was sent.",
    }).where(and(eq(paidMediaEventReceiptsTable.id, existing.id), eq(paidMediaEventReceiptsTable.deliveryStatus, "pending"), isNull(paidMediaEventReceiptsTable.providerAttemptedAt)));
    return { accepted: true, duplicate: !inserted[0], receiptId: existing.id, deliveryStatus };
  }
  let capiEvent;
  try {
    capiEvent = normalizeMetaCapiEvent({ eventName: input.eventName, eventId: input.eventId, occurredAt: existing.occurredAt.toISOString(), matchKeys: input.matchKeys, payload: input.payload });
    if (!Object.keys(capiEvent.userData).length) {
      await db.update(paidMediaEventReceiptsTable).set({ deliveryStatus: "capability_blocked", retryPayload: null, retryAt: null, providerErrorCode: "MISSING_MATCH_KEYS", providerErrorMessage: "No consented Meta match key was supplied; no provider event was sent." })
        .where(and(eq(paidMediaEventReceiptsTable.id, existing.id), eq(paidMediaEventReceiptsTable.deliveryStatus, "pending"), isNull(paidMediaEventReceiptsTable.providerAttemptedAt)));
      return { accepted: true, duplicate: !inserted[0], receiptId: existing.id, deliveryStatus: "capability_blocked" as const };
    }
  } catch (error) {
    await db.update(paidMediaEventReceiptsTable).set({ deliveryStatus: "failed", retryPayload: null, retryAt: null, providerErrorCode: "INVALID_CAPI_EVENT", providerErrorMessage: "Invalid Meta conversion event." })
      .where(and(eq(paidMediaEventReceiptsTable.id, existing.id), eq(paidMediaEventReceiptsTable.deliveryStatus, "pending"), isNull(paidMediaEventReceiptsTable.providerAttemptedAt)));
    return { accepted: true, duplicate: !inserted[0], receiptId: existing.id, deliveryStatus: "failed" as const };
  }
  // Claim pending receipt atomically. Concurrent delivery of the same event_id
  // observes the same receipt but cannot create a second provider request.
  const attemptedAt = new Date();
  const envelope = capiRetryEnvelope(dataset, capiEvent, attemptedAt);
  const [claimed] = await db.update(paidMediaEventReceiptsTable).set({ ...envelope, providerAttemptedAt: attemptedAt, source: "server", eventMatchKeys: safeKeys, payload: safePayload })
    .where(and(eq(paidMediaEventReceiptsTable.id, existing.id), eq(paidMediaEventReceiptsTable.deliveryStatus, "pending"), isNull(paidMediaEventReceiptsTable.providerAttemptedAt))).returning({ id: paidMediaEventReceiptsTable.id });
  if (!claimed) return { accepted: true, duplicate: true, receiptId: existing.id, deliveryStatus: existing.deliveryStatus };
  try {
    const result = await paidMediaProvider(dataset.provider).sendConversionEvent(
      dataset.workspaceId, dataset.accountId, dataset.providerDatasetId,
      capiEvent,
    );
    await finishCapiAttempt(existing.id, attemptedAt, 1, envelope.retryExpiresAt, result);
    return { accepted: true, duplicate: !inserted[0], receiptId: existing.id, deliveryStatus: "sent" as const };
  } catch (error) {
    const deliveryStatus = await finishCapiAttempt(existing.id, attemptedAt, 1, envelope.retryExpiresAt, undefined, error);
    return { accepted: true, duplicate: !inserted[0], receiptId: existing.id, deliveryStatus };
  }
}

export async function datasetDiagnostics(workspaceId: string, datasetId: string) {
  const [dataset] = await db.select().from(paidMediaDatasetsTable).where(and(eq(paidMediaDatasetsTable.id, datasetId), eq(paidMediaDatasetsTable.workspaceId, workspaceId))).limit(1);
  if (!dataset) throw new Error("Dataset not found.");
  const [stats] = await db.select({
    events: sql<number>`count(*)::int`,
    matched: sql<number>`count(*) filter (where ${paidMediaEventReceiptsTable.eventMatchKeys} <> '{}'::jsonb)::int`,
    sent: sql<number>`count(*) filter (where ${paidMediaEventReceiptsTable.deliveryStatus} = 'sent')::int`,
    blocked: sql<number>`count(*) filter (where ${paidMediaEventReceiptsTable.deliveryStatus} = 'capability_blocked')::int`,
    queued: sql<number>`count(*) filter (where ${paidMediaEventReceiptsTable.retryAt} is not null)::int`,
    failed: sql<number>`count(*) filter (where ${paidMediaEventReceiptsTable.deliveryStatus} = 'failed')::int`,
  }).from(paidMediaEventReceiptsTable).where(eq(paidMediaEventReceiptsTable.datasetId, dataset.id));
  await db.update(paidMediaDatasetsTable).set({ lastDiagnosticAt: new Date() }).where(eq(paidMediaDatasetsTable.id, dataset.id));
  const events = stats?.events ?? 0;
  return { datasetId: dataset.id, lastEventAt: dataset.lastEventAt, eventCount: events, matchKeyEventCount: stats?.matched ?? 0, matchRate: events ? (stats?.matched ?? 0) / events : 0, localMatchKeyCoverage: events ? (stats?.matched ?? 0) / events : 0, measurementSource: "local_receipts", metaEventMatchQuality: null, browserServerDeduplication: "not_verified", testEvents: "unsupported", providerDelivery: { queued: stats?.queued ?? 0, sent: stats?.sent ?? 0, capabilityBlocked: stats?.blocked ?? 0, failed: stats?.failed ?? 0 }, status: events ? "receiving" : "no_events" };
}

export async function upsertTouchpoint(workspaceId: string, input: { externalTouchpointId: string; accountId?: string; entityId?: string; provider?: "meta_ads" | "tiktok_ads" | "google_ads"; clickId?: string; utmSource?: string; utmCampaign?: string; occurredAt: string; metadata?: Record<string, unknown> }) {
  const occurredAt = new Date(input.occurredAt);
  if (!input.externalTouchpointId || Number.isNaN(occurredAt.getTime())) throw new Error("externalTouchpointId and valid occurredAt are required.");
  if (input.accountId) {
    const [account] = await db.select({ id: paidMediaAccountsTable.id, provider: paidMediaAccountsTable.provider }).from(paidMediaAccountsTable).where(and(eq(paidMediaAccountsTable.id, input.accountId), eq(paidMediaAccountsTable.workspaceId, workspaceId))).limit(1);
    if (!account || (input.provider && account.provider !== input.provider)) throw new Error("Touchpoint account is not owned by this workspace.");
  }
  if (input.entityId) {
    const [entity] = await db.select({ id: paidMediaEntitiesTable.id, accountId: paidMediaEntitiesTable.accountId }).from(paidMediaEntitiesTable).where(and(eq(paidMediaEntitiesTable.id, input.entityId), eq(paidMediaEntitiesTable.workspaceId, workspaceId))).limit(1);
    if (!entity || (input.accountId && entity.accountId !== input.accountId)) throw new Error("Touchpoint entity is not owned by this workspace account.");
  }
  const [row] = await db.insert(paidMediaAttributionTouchpointsTable).values({ workspaceId, ...input, occurredAt, metadata: input.metadata ?? {} }).onConflictDoUpdate({
    target: [paidMediaAttributionTouchpointsTable.workspaceId, paidMediaAttributionTouchpointsTable.externalTouchpointId],
    set: { accountId: input.accountId, entityId: input.entityId, provider: input.provider, clickId: input.clickId, utmSource: input.utmSource, utmCampaign: input.utmCampaign, occurredAt, metadata: input.metadata ?? {} },
  }).returning();
  return row;
}

export async function upsertConversion(workspaceId: string, input: { externalConversionId: string; touchpointExternalId?: string; occurredAt: string; currency: string; value: unknown; metadata?: Record<string, unknown> }) {
  const occurredAt = new Date(input.occurredAt);
  if (!input.externalConversionId || !input.currency || Number.isNaN(occurredAt.getTime())) throw new Error("externalConversionId, currency and valid occurredAt are required.");
  if (!/^[A-Za-z]{3}$/.test(input.currency)) throw new Error("Informe a moeda com três letras, como BRL ou USD.");
  input = { ...input, currency: input.currency.toUpperCase() };
  const [touchpoint] = input.touchpointExternalId ? await db.select().from(paidMediaAttributionTouchpointsTable).where(and(eq(paidMediaAttributionTouchpointsTable.workspaceId, workspaceId), eq(paidMediaAttributionTouchpointsTable.externalTouchpointId, input.touchpointExternalId))).limit(1) : [];
  if (input.touchpointExternalId && !touchpoint) throw new Error("Touchpoint not found in this workspace.");
  const status = touchpoint ? "reconciled" as const : "unattributed" as const;
  const [row] = await db.insert(paidMediaConversionsTable).values({ workspaceId, touchpointId: touchpoint?.id, externalConversionId: input.externalConversionId, occurredAt, currency: input.currency, value: String(finiteNumber(input.value, "value")), reconciliationStatus: status, metadata: input.metadata ?? {} }).onConflictDoUpdate({
    target: [paidMediaConversionsTable.workspaceId, paidMediaConversionsTable.externalConversionId],
    set: { touchpointId: touchpoint?.id, occurredAt, currency: input.currency, value: String(finiteNumber(input.value, "value")), reconciliationStatus: status, metadata: input.metadata ?? {} },
  }).returning();
  return row;
}

export async function reconciliationSummary(workspaceId: string, since: string, until: string, accountId?: string) {
  const { z } = await import("zod/v4");
  const range = z.object({ since: z.iso.date(), until: z.iso.date(), accountId: z.string().uuid().optional() }).parse({ since, until, accountId });
  const from = new Date(`${range.since}T00:00:00.000Z`), to = new Date(`${range.until}T23:59:59.999Z`);
  if (from > to || to.getTime() - from.getTime() > 367 * 86400000) throw new Error("Informe um período de até 366 dias, em ordem.");
  const media = await db.select({ accountId: paidMediaInsightsTable.accountId, currency: paidMediaInsightsTable.currency, entityId: paidMediaInsightsTable.entityId,
    metricDate: paidMediaInsightsTable.metricDate, dateGrain: paidMediaInsightsTable.dateGrain, entityType: paidMediaEntitiesTable.entityType, attributionWindow: paidMediaInsightsTable.attributionWindow,
    spend: paidMediaInsightsTable.spend, impressions: paidMediaInsightsTable.impressions, clicks: paidMediaInsightsTable.clicks, syncedAt: paidMediaInsightsTable.syncedAt })
    .from(paidMediaInsightsTable).innerJoin(paidMediaEntitiesTable, and(eq(paidMediaEntitiesTable.id, paidMediaInsightsTable.entityId), eq(paidMediaEntitiesTable.workspaceId, workspaceId), eq(paidMediaEntitiesTable.accountId, paidMediaInsightsTable.accountId)))
    .where(and(eq(paidMediaInsightsTable.workspaceId, workspaceId), accountId ? eq(paidMediaInsightsTable.accountId, accountId) : undefined, gte(paidMediaInsightsTable.metricDate, since), lte(paidMediaInsightsTable.metricDate, until)));
  const crm = await db.select({ currency: paidMediaConversionsTable.currency, value: paidMediaConversionsTable.value, reconciliationStatus: paidMediaConversionsTable.reconciliationStatus,
    accountId: sql<string | null>`coalesce(${paidMediaAttributionTouchpointsTable.accountId}, ${paidMediaEntitiesTable.accountId})`, occurredAt: paidMediaConversionsTable.occurredAt, touchpointAt: paidMediaAttributionTouchpointsTable.occurredAt })
    .from(paidMediaConversionsTable).leftJoin(paidMediaAttributionTouchpointsTable, and(eq(paidMediaConversionsTable.touchpointId, paidMediaAttributionTouchpointsTable.id), eq(paidMediaAttributionTouchpointsTable.workspaceId, workspaceId)))
    .leftJoin(paidMediaEntitiesTable, and(eq(paidMediaEntitiesTable.id, paidMediaAttributionTouchpointsTable.entityId), eq(paidMediaEntitiesTable.workspaceId, workspaceId)))
    .where(and(eq(paidMediaConversionsTable.workspaceId, workspaceId), accountId ? sql`coalesce(${paidMediaAttributionTouchpointsTable.accountId}, ${paidMediaEntitiesTable.accountId}) = ${accountId}` : undefined, gte(paidMediaConversionsTable.occurredAt, from), lte(paidMediaConversionsTable.occurredAt, to)));
  const { summarizeCrmReconciliation } = await import("./crm-reconciliation.domain.js");
  return { since, until, accountId: accountId ?? null, ...summarizeCrmReconciliation(media, crm) };
}
