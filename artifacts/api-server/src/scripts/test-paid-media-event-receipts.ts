import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import { db, paidMediaDatasetsTable, paidMediaEventReceiptsTable } from "@workspace/db";
import { recordDatasetEvent } from "../modules/paid-media/attribution.service.js";
import { paidMediaProvider } from "../modules/paid-media/providers.js";

// Exercise the real service and its SQL predicates against a memory store.
// No network, credential or database connection is used.
const original = { insert: db.insert, select: db.select, update: db.update };
const adapter = paidMediaProvider("meta_ads"), send = adapter.sendConversionEvent;
const rows = new Map<string, any>();
const dialect = new PgDialect();
let providerCalls = 0, claimPredicates = 0;
let release: (() => void) | undefined;
const gate = new Promise<void>(resolve => { release = resolve; });
const dataset = { id: "dataset", workspaceId: "workspace", accountId: "account", provider: "meta_ads" as const, providerDatasetId: "12345" };
const event = { source: "server" as const, eventName: "Lead", eventId: "lead-1", occurredAt: "2026-10-23T12:00:00Z", matchKeys: { email: "person@example.test", phone: "+55 11 99999-0000", secret: "discard" }, payload: { marketingConsent: true, privateNote: "discard" } };

try {
  db.insert = ((table: unknown) => {
    assert.equal(table, paidMediaEventReceiptsTable);
    return { values: (values: any) => ({ onConflictDoNothing: () => ({ returning: async () => {
      if (rows.has(values.eventId)) return [];
      const row = { ...values, id: `receipt-${rows.size}`, deliveryStatus: "pending", providerAttemptedAt: null };
      rows.set(values.eventId, row); return [{ ...row }];
    } }) }) };
  }) as any;
  db.select = (() => ({ from: () => ({ where: (condition: any) => ({ limit: async () => {
    const query = dialect.sqlToQuery(condition);
    const row = [...rows.values()].find(item => query.params.includes(item.eventId));
    return row ? [{ ...row }] : [];
  } }) }) })) as any;
  db.update = ((table: unknown) => ({ set: (patch: any) => ({ where: (condition: any) => {
    const query = dialect.sqlToQuery(condition);
    const execute = () => {
      if (table === paidMediaDatasetsTable) return [];
      const row = [...rows.values()].find(item => query.params.includes(item.id));
      if (!row) return [];
      if (patch.providerAttemptedAt) {
        assert.match(query.sql, /"provider_attempted_at" is null/, "claim must prevent concurrent CAPI deliveries");
        claimPredicates++;
      }
      if (query.sql.includes('"delivery_status" =') && row.deliveryStatus !== "pending") return [];
      if (query.sql.includes('"provider_attempted_at" is null') && row.providerAttemptedAt !== null) return [];
      Object.assign(row, patch); return [{ id: row.id }];
    };
    return { returning: async () => execute(), then: (resolve: (value: unknown) => void) => resolve(execute()) };
  } }) })) as any;
  adapter.sendConversionEvent = async (_workspace, _account, _pixel, value) => {
    providerCalls++;
    assert.equal(value.eventId, event.eventId);
    assert.equal(value.userData.em?.length, 64);
    await gate;
    return { evidence: { events_received: 1 } };
  };
  await recordDatasetEvent(dataset, { ...event, source: "browser" });
  assert.equal(providerCalls, 0);
  const deliveries = [recordDatasetEvent(dataset, event), recordDatasetEvent(dataset, event)];
  // Allow both requests to reach the pending provider response before releasing it.
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(providerCalls, 1, "browser-first and concurrent server copies send once");
  release!();
  const results = await Promise.all(deliveries);
  assert.ok(results.some(result => result.deliveryStatus === "sent"));
  assert.equal(claimPredicates, 2);
  await recordDatasetEvent(dataset, event);
  assert.equal(providerCalls, 1, "sent receipt cannot be replayed");
  assert.equal((await recordDatasetEvent(dataset, { ...event, payload: { marketingConsent: false } })).deliveryStatus, "sent", "duplicates report persisted delivery state");
  assert.equal(JSON.stringify([...rows.values()]).includes("person@example.test"), false);
  assert.equal(JSON.stringify([...rows.values()]).includes("+55"), false);
  assert.equal(JSON.stringify([...rows.values()]).includes("discard"), false);
  const denied = await recordDatasetEvent(dataset, { ...event, eventId: "no-consent", payload: { marketingConsent: false } });
  assert.equal(denied.deliveryStatus, "consent_withheld");
  assert.deepEqual(rows.get("no-consent").eventMatchKeys, {});
  assert.equal(providerCalls, 1);
  const noKeys = await recordDatasetEvent(dataset, { ...event, eventId: "no-keys", matchKeys: {} });
  assert.equal(noKeys.deliveryStatus, "capability_blocked");
  assert.equal(providerCalls, 1);
  adapter.sendConversionEvent = async () => { throw new Error("secret echoed by upstream"); };
  assert.equal((await recordDatasetEvent(dataset, { ...event, eventId: "provider-failure" })).deliveryStatus, "failed");
  assert.equal(JSON.stringify(rows.get("provider-failure")).includes("secret echoed"), false);
  await assert.rejects(() => recordDatasetEvent(dataset, { ...event, eventName: "Purchase" }), /outro eventName/);
  assert.equal(providerCalls, 1);
  console.log("Meta receipt service: PASS (consent, hashed persistence, browser/server ordering, concurrent claim, replay, event identity)");
} finally {
  Object.assign(db, original);
  adapter.sendConversionEvent = send;
  release?.();
}
