import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import { db, paidMediaDatasetsTable, paidMediaEventReceiptsTable, pagesTable } from "@workspace/db";
import { trackCapturedLandingLead, trackLandingPageView } from "../modules/landing-publication/landing-tracking.service.js";
import { recordDatasetEvent } from "../modules/paid-media/attribution.service.js";
import { paidMediaProvider } from "../modules/paid-media/providers.js";

// Exercise the real service and its SQL predicates against a memory store.
// No network, credential or database connection is used.
const original = { insert: db.insert, select: db.select, update: db.update };
const oldKey = process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY"];
process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY"] = Buffer.alloc(32, 7).toString("base64");
const adapter = paidMediaProvider("meta_ads"), send = adapter.sendConversionEvent;
const rows = new Map<string, any>();
const dialect = new PgDialect();
let providerCalls = 0, claimPredicates = 0;
let release: (() => void) | undefined;
const gate = new Promise<void>(resolve => { release = resolve; });
const dataset = { id: "dataset", workspaceId: "workspace", accountId: "account", provider: "meta_ads" as const, providerDatasetId: "12345" };
const event = { source: "server" as const, eventName: "Lead", eventId: "lead-1", occurredAt: "2026-10-23T12:00:00Z", matchKeys: { email: "person@example.test", phone: "+55 11 99999-0000", firstName: "ConsentedNameFixture", country: "BR", secret: "discard" }, payload: { marketingConsent: true, privateNote: "discard" } };

try {
  db.insert = ((table: unknown) => {
    assert.equal(table, paidMediaEventReceiptsTable);
    return { values: (values: any) => ({ onConflictDoNothing: () => ({ returning: async () => {
      if (rows.has(values.eventId)) return [];
      const row = { ...values, id: `receipt-${rows.size}`, deliveryStatus: "pending", providerAttemptedAt: null };
      rows.set(values.eventId, row); return [{ ...row }];
    } }) }) };
  }) as any;
  db.select = (() => ({ from: (table: unknown) => ({ where: (condition: any) => ({ limit: async () => {
    const query = dialect.sqlToQuery(condition);
    if (table === pagesTable) return [{ id: "page", workspaceId: "workspace", status: "published", publishedUrl: "https://example.test/", leadCaptureSequenceId: "sequence", metadata: { implementation: { tracking: { metaEventKey: "a".repeat(64), metaDatasetId: "dataset" } } } }];
    if (table === paidMediaDatasetsTable) return [dataset];
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
    assert.equal(value.userData.fn?.length, 64);
    assert.equal(value.userData.country?.length, 64);
    assert.equal(value.eventTime.toISOString(), new Date(Date.parse(event.occurredAt) - 1000).toISOString(), "browser-first timestamp remains immutable for server retries");
    await gate;
    return { evidence: { events_received: 1 } };
  };
  await recordDatasetEvent(dataset, { ...event, source: "browser", occurredAt: new Date(Date.parse(event.occurredAt) - 1000).toISOString() });
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
  assert.equal(JSON.stringify([...rows.values()]).includes("ConsentedNameFixture"), false);
  assert.equal(rows.get(event.eventId).eventMatchKeys.fn.length, 64);
  const denied = await recordDatasetEvent(dataset, { ...event, eventId: "no-consent", payload: { marketingConsent: false } });
  assert.equal(denied.deliveryStatus, "consent_withheld");
  assert.deepEqual(rows.get("no-consent").eventMatchKeys, {});
  assert.equal(providerCalls, 1);
  const noKeys = await recordDatasetEvent(dataset, { ...event, eventId: "no-keys", matchKeys: {} });
  assert.equal(noKeys.deliveryStatus, "capability_blocked");
  assert.equal(providerCalls, 1);
  adapter.sendConversionEvent = async () => { throw new Error("secret echoed by upstream"); };
  assert.equal((await recordDatasetEvent(dataset, { ...event, eventId: "provider-failure" })).deliveryStatus, "pending");
  assert.ok(rows.get("provider-failure").retryAt);
  assert.ok(rows.get("provider-failure").retryPayload);
  assert.equal(JSON.stringify(rows.get("provider-failure")).includes("secret echoed"), false);
  await assert.rejects(() => recordDatasetEvent(dataset, { ...event, eventName: "Purchase" }), /outro eventName/);
  assert.equal(providerCalls, 1);
  const trackingInput = { pageId: "page", eventKey: "a".repeat(64), marketingConsent: true };
  let sentLandingEvent: any;
  adapter.sendConversionEvent = async (_workspace, _account, _pixel, value) => { sentLandingEvent = value; providerCalls++; return { evidence: { events_received: 1 } }; };
  const beforeLanding = providerCalls;
  const tracked = await trackCapturedLandingLead(trackingInput, { origin: "https://example.test", ip: "127.0.0.1", userAgent: "private-agent" }, { contactId: "contact", duplicate: false, sequenceId: "sequence", email: "person@example.test" });
  assert.equal(tracked.deliveryStatus, "sent");
  assert.equal(tracked.eventId, sentLandingEvent.eventId);
  assert.equal(sentLandingEvent.eventSourceUrl, "https://example.test/");
  assert.equal(sentLandingEvent.userData.client_ip_address, "127.0.0.1");
  assert.equal(JSON.stringify([...rows.values()]).includes("127.0.0.1"), false);
  assert.equal(JSON.stringify([...rows.values()]).includes("private-agent"), false);
  assert.equal((await trackCapturedLandingLead(trackingInput, { origin: "https://example.test" }, { contactId: "contact", duplicate: true, sequenceId: "sequence" })).eventId, tracked.eventId);
  assert.equal(providerCalls, beforeLanding + 1);
  const pageView = await trackLandingPageView({ ...trackingInput, eventId: "visit" }, { origin: "https://example.test", ip: "127.0.0.1", userAgent: "private-agent" });
  assert.equal(pageView.deliveryStatus, "sent");
  assert.equal(sentLandingEvent.eventId, "pageview:page:visit");
  console.log("Meta receipt service: PASS (consent, hashed persistence, browser/server ordering, concurrent claim, replay, event identity)");
} finally {
  if (oldKey === undefined) delete process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY"]; else process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY"] = oldKey;
  Object.assign(db, original);
  adapter.sendConversionEvent = send;
  release?.();
}
