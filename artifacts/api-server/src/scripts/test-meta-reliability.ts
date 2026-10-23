import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PgDialect } from "drizzle-orm/pg-core";
import { db, paidMediaEventReceiptsTable as receipts } from "@workspace/db";
import {
  capiRetryEnvelope,
  capiRetryTick,
  decodeCapiRetry,
  finishCapiAttempt,
  retryableCapiError,
  CAPI_MAX_ATTEMPTS,
} from "../modules/paid-media/capi-retry.service.js";
import {
  paidMediaProvider,
  normalizeMetaCapiEvent,
  PaidMediaProviderError,
} from "../modules/paid-media/providers.js";
import {
  summarizeCrmReconciliation,
  type ReconciliationMedia,
} from "../modules/paid-media/crm-reconciliation.domain.js";
import { assertRevisionSnapshot } from "../modules/landing-publication/landing-upgrade.service.js";

const oldKey = process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY"];
process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY"] = Buffer.alloc(32, 9).toString(
  "base64",
);
const original = { select: db.select, update: db.update };
const provider = paidMediaProvider("meta_ads"),
  originalSend = provider.sendConversionEvent;
const dialect = new PgDialect();
const dataset = {
  id: "dataset",
  workspaceId: "workspace",
  accountId: "account",
  provider: "meta_ads" as const,
  providerDatasetId: "1234",
};
const now = new Date();
const event = normalizeMetaCapiEvent({
  eventName: "Lead",
  eventId: "same-id",
  occurredAt: now.toISOString(),
  matchKeys: {
    email: "private@example.test",
    clientIpAddress: "127.0.0.1",
    clientUserAgent: "private-agent",
  },
  payload: { eventSourceUrl: "https://example.test/?private=discard" },
});
let row: any;
function seed(patch = {}) {
  row = {
    id: "receipt",
    eventId: event.eventId,
    eventName: event.eventName,
    occurredAt: event.eventTime,
    source: "server",
    payload: { marketingConsent: true },
    deliveryStatus: "pending",
    providerAttemptedAt: new Date(now.getTime() - 600_000),
    ...capiRetryEnvelope(dataset, event, new Date(now.getTime() - 600_000)),
    ...patch,
  };
}
try {
  seed();
  assert.equal(row.retryPayload.includes("127.0.0.1"), false);
  assert.equal(row.retryPayload.includes("private-agent"), false);
  assert.deepEqual(decodeCapiRetry(row.retryPayload, dataset, row), event);
  assert.throws(() =>
    decodeCapiRetry(
      row.retryPayload,
      { ...dataset, workspaceId: "other" },
      row,
    ),
  );
  assert.throws(() =>
    decodeCapiRetry(row.retryPayload, dataset, {
      ...row,
      eventName: "Purchase",
    }),
  );
  assert.throws(() =>
    decodeCapiRetry(row.retryPayload.slice(0, -4) + "AAAA", dataset, row),
  );
  for (const code of ["AUTH", "UNSUPPORTED", "PRECONDITION_FAILED"] as const)
    assert.equal(
      retryableCapiError(new PaidMediaProviderError("secret", code)),
      false,
    );
  assert.equal(
    retryableCapiError(
      new PaidMediaProviderError("secret", "PROVIDER_ERROR", 400),
    ),
    false,
  );
  assert.equal(
    retryableCapiError(
      new PaidMediaProviderError("secret", "PROVIDER_ERROR", 503),
    ),
    true,
  );
  assert.equal(retryableCapiError(new Error("network")), true);
  db.select = (() => ({
    from: () => ({
      innerJoin: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () =>
              row.deliveryStatus === "pending" &&
              row.retryPayload &&
              row.retryAt <= now
                ? [{ receipt: { ...row }, dataset: { ...dataset } }]
                : [],
          }),
        }),
      }),
    }),
  })) as any;
  db.update = ((table: unknown) => {
    assert.equal(table, receipts);
    return {
      set: (patch: any) => ({
        where: (condition: any) => {
          const { sql, params } = dialect.sqlToQuery(condition);
          const execute = () => {
            const expected = params.find((value) => typeof value === "number");
            if (row.deliveryAttempts !== expected) return [];
            if (
              sql.includes('"delivery_status" =') &&
              row.deliveryStatus !== "pending"
            )
              return [];
            if (
              sql.includes('"retry_at" <=') &&
              (!row.retryAt || row.retryAt > now)
            )
              return [];
            if (
              sql.includes('"provider_attempted_at" =') &&
              !params.some(
                (value) =>
                  (value instanceof Date
                    ? value.getTime()
                    : typeof value === "string"
                      ? Date.parse(value)
                      : NaN) === row.providerAttemptedAt.getTime(),
              )
            )
              return [];
            Object.assign(
              row,
              patch,
              patch.deliveryAttempts &&
                typeof patch.deliveryAttempts !== "number"
                ? { deliveryAttempts: row.deliveryAttempts + 1 }
                : {},
            );
            return [{ id: row.id }];
          };
          return {
            returning: async () => execute(),
            then: (resolve: (value: unknown) => void) => resolve(execute()),
          };
        },
      }),
    };
  }) as any;
  let calls = 0;
  provider.sendConversionEvent = async (workspace, account, pixel, replay) => {
    calls++;
    assert.deepEqual(
      [workspace, account, pixel],
      [dataset.workspaceId, dataset.accountId, dataset.providerDatasetId],
    );
    assert.deepEqual(
      replay,
      event,
      "retry preserves original time, identity, source URL and single hash",
    );
    return { evidence: { events_received: 1 } };
  };
  await Promise.all([capiRetryTick(() => now), capiRetryTick(() => now)]);
  assert.equal(calls, 1, "concurrent workers claim the durable row once");
  assert.equal(row.deliveryStatus, "sent");
  assert.equal(row.retryPayload, null);
  seed();
  provider.sendConversionEvent = async () => {
    calls++;
    throw new PaidMediaProviderError("secret-credential", "RATE_LIMITED", 429);
  };
  await capiRetryTick(() => now);
  assert.equal(row.deliveryStatus, "pending");
  assert.equal(row.deliveryAttempts, 2);
  assert.ok(row.retryAt > now);
  assert.ok(row.retryPayload);
  assert.equal(JSON.stringify(row).includes("secret-credential"), false);
  const latestAttempt = row.providerAttemptedAt;
  await finishCapiAttempt(
    row.id,
    new Date(latestAttempt.getTime() - 1),
    row.deliveryAttempts,
    row.retryExpiresAt,
    { evidence: { events_received: 1 } },
  );
  assert.equal(
    row.deliveryStatus,
    "pending",
    "late response from lost lease cannot overwrite retry",
  );
  seed({ deliveryAttempts: CAPI_MAX_ATTEMPTS });
  const beforeExpiry = calls;
  await capiRetryTick(() => now);
  assert.equal(calls, beforeExpiry);
  assert.equal(row.retryPayload, null);
  seed({ retryExpiresAt: new Date(now.getTime() - 1) });
  await capiRetryTick(() => now);
  assert.equal(calls, beforeExpiry);
  assert.equal(row.deliveryStatus, "failed");
  seed({ payload: { marketingConsent: false } });
  await capiRetryTick(() => now);
  assert.equal(calls, beforeExpiry);
  assert.equal(row.retryPayload, null);
  seed();
  provider.sendConversionEvent = async () => {
    calls++;
    throw new PaidMediaProviderError("secret", "AUTH", 401);
  };
  await capiRetryTick(() => now);
  assert.equal(row.deliveryStatus, "capability_blocked");
  assert.equal(row.retryPayload, null);
  seed({ deliveryAttempts: 0 });
  provider.sendConversionEvent = async () => {
    calls++;
    return { evidence: { events_received: 1 } };
  };
  await capiRetryTick(() => now);
  assert.equal(row.deliveryAttempts, 1);
  assert.equal(
    row.deliveryStatus,
    "sent",
    "crash before first provider claim recovers from persisted envelope",
  );

  const base: ReconciliationMedia = {
    accountId: "a",
    currency: "BRL",
    entityId: "ad1",
    metricDate: "2026-10-23",
    dateGrain: "daily",
    entityType: "ad",
    attributionWindow: null,
    spend: "100",
    impressions: 1000,
    clicks: 10,
    syncedAt: now,
  };
  const crm = {
    currency: "BRL",
    value: "250",
    reconciliationStatus: "reconciled",
    accountId: "a",
    occurredAt: now,
    touchpointAt: new Date(now.getTime() - 1000),
  };
  const report = summarizeCrmReconciliation(
    [
      base,
      { ...base, entityType: "campaign", spend: 999 },
      { ...base, entityType: "ad_set", spend: 999 },
      { ...base, spend: 50, syncedAt: new Date(now.getTime() - 1) },
      { ...base, attributionWindow: "7d_click", spend: 500 },
      { ...base, currency: "USD", spend: 20 },
      { ...base, accountId: "b", spend: 30 },
    ],
    [
      crm,
      { ...crm, reconciliationStatus: "unattributed", value: 900 },
      { ...crm, currency: "EUR", value: 500 },
      { ...crm, accountId: null },
      { ...crm, touchpointAt: new Date(now.getTime() + 1) },
    ],
  );
  assert.equal(report.groups.length, 3);
  const brl = report.groups.find(
    (group) => group.accountId === "a" && group.currency === "BRL",
  )!;
  assert.equal(brl.spend, 100);
  assert.equal(brl.crmConversions, 1);
  assert.equal(brl.crmRevenue, 250);
  assert.equal(brl.roas, 2.5);
  assert.equal(brl.cpa, 100);
  assert.deepEqual(brl.ignoredAttributionWindows, ["7d_click"]);
  assert.equal(
    report.excludedFromPaidMetrics.reduce(
      (sum, group) => sum + group.conversions,
      0,
    ),
    4,
  );
  assert.equal(
    report.groups.find((group) => group.currency === "USD")!.crmRevenue,
    0,
  );
  const sha = (value: string) =>
    createHash("sha256").update(value).digest("hex");
  const revision = { html: "preview", contentHash: sha("preview") };
  assertRevisionSnapshot(
    "live",
    revision,
    { baseHash: sha("live") },
    revision.contentHash,
  );
  assert.throws(() =>
    assertRevisionSnapshot(
      "changed",
      revision,
      { baseHash: sha("live") },
      revision.contentHash,
    ),
  );
  assert.throws(() =>
    assertRevisionSnapshot(
      "live",
      { ...revision, html: "tampered" },
      { baseHash: sha("live") },
      revision.contentHash,
    ),
  );
  assert.throws(() =>
    assertRevisionSnapshot(
      "live",
      revision,
      { baseHash: sha("live") },
      sha("other-preview"),
    ),
  );
  console.log(
    "PASS Meta reliability: encrypted durable retries, lease concurrency/fencing, expiration, consent, exact event replay, CRM grain/currency/linkage, revision integrity",
  );
} finally {
  Object.assign(db, original);
  provider.sendConversionEvent = originalSend;
  if (oldKey === undefined)
    delete process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY"];
  else process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY"] = oldKey;
}
