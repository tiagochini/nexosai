import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PgDialect } from "drizzle-orm/pg-core";
import { db, workspaceIntegrationsTable } from "@workspace/db";
import { fireServerEvent } from "../modules/server-events/server-events.service.js";

const originalSelect = db.select;
const originalFetch = globalThis.fetch;
const dialect = new PgDialect();
const requests: Array<{ url: string; body: Record<string, any> }> = [];
const tokens = { meta_ads: "meta-secret-fixture", tiktok_ads: "tiktok-secret-fixture" };
const hash = (value: string) => createHash("sha256").update(value.toLowerCase().trim()).digest("hex");

try {
  db.select = ((fields?: unknown) => ({
    from: (table: unknown) => ({
      where: (condition: unknown) => ({
        limit: async () => {
          assert.equal(table, workspaceIntegrationsTable);
          const query = dialect.sqlToQuery(condition as never);
          const provider = query.params.find((value) => value === "meta_ads" || value === "tiktok_ads");
          assert.ok(provider, "integration lookup must specify a supported provider");
          assert.ok(query.params.includes("workspace"), "integration lookup must stay in the requested workspace");
          assert.ok(fields && typeof fields === "object");
          return [{ accessToken: tokens[provider], accountId: `${provider}-pixel` }];
        },
      }),
    }),
  })) as unknown as typeof db.select;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, any>;
    requests.push({ url, body });
    return new Response(JSON.stringify(url.includes("graph.facebook.com") ? { events_received: 1 } : { code: 0 }), { status: 200 });
  }) as typeof fetch;

  await fireServerEvent("workspace", "AddToCart", "cart:order-123", {
    email: "Person@Example.Test",
    phone: "+1 (555) 010-2000",
    externalId: "Customer-42",
    firstName: "Jane",
    lastName: "Doe",
    city: "San Francisco",
    state: "CA",
    postalCode: "94105-1234",
    country: "US",
  }, {
    currency: "BRL",
    value: 120,
    contentName: "Tênis",
    contentCategory: "Calçados",
    contentIds: ["sku-1"],
    contentType: "product",
    numItems: 2,
    orderId: "order-123",
  });

  assert.equal(requests.length, 2);
  const meta = requests.find((item) => item.url.includes("graph.facebook.com"));
  const tikTok = requests.find((item) => item.url.includes("tiktok.com"));
  assert.ok(meta && tikTok);
  const metaEvent = meta.body.data[0];
  assert.equal(metaEvent.event_name, "AddToCart");
  assert.equal(metaEvent.event_id, "cart:order-123");
  assert.deepEqual(metaEvent.custom_data, {
    currency: "BRL",
    value: 120,
    content_name: "Tênis",
    content_category: "Calçados",
    content_ids: ["sku-1"],
    content_type: "product",
    num_items: 2,
    order_id: "order-123",
  });
  assert.deepEqual(metaEvent.user_data, {
    em: hash("person@example.test"),
    ph: hash("15550102000"),
    fn: hash("jane"),
    ln: hash("doe"),
    external_id: hash("customer-42"),
    ct: hash("sanfrancisco"),
    st: hash("ca"),
    zp: hash("94105"),
    country: hash("us"),
  });
  assert.equal("contentName" in metaEvent.custom_data, false);
  assert.equal(tikTok.body.event, "AddToCart");
  assert.equal(tikTok.body.event_id, "cart:order-123");
  assert.deepEqual(tikTok.body.properties.contents, [{
    content_id: "sku-1",
    content_name: "Tênis",
    content_category: "Calçados",
    quantity: 2,
  }]);
  assert.deepEqual(tikTok.body.context.user, {
    email: hash("person@example.test"),
    phone_number: hash("15550102000"),
    external_id: hash("customer-42"),
    first_name: hash("jane"),
    last_name: hash("doe"),
  });
  for (const raw of ["person@example.test", "15550102000", "Jane", "San Francisco", "94105-1234", "Customer-42"])
    assert.equal(JSON.stringify(requests).includes(raw), false, `raw identifier leaked: ${raw}`);

  requests.length = 0;
  await fireServerEvent("workspace", "CompleteRegistration", "registration:123", {});
  const registrationMeta = requests.find((item) => item.url.includes("graph.facebook.com"))?.body.data[0];
  const registrationTikTok = requests.find((item) => item.url.includes("tiktok.com"))?.body;
  assert.equal(registrationMeta?.event_name, "CompleteRegistration");
  assert.equal(registrationMeta?.event_id, "registration:123");
  assert.equal(registrationTikTok?.event, "Registration");
  assert.equal(registrationTikTok?.event_id, "registration:123");
  console.log("Server event payloads: PASS (AddToCart and registration mappings, event_id sharing, standard fields, normalized and hashed identifiers)");
} finally {
  db.select = originalSelect;
  globalThis.fetch = originalFetch;
}
