import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import express from "express";

process.env.DATABASE_URL ??= "postgresql://127.0.0.1:1/unused";
const { default: products } = await import("../modules/product-checkout/product-checkout.routes.js");
const { createAcademyPaymentWebhook } = await import("../modules/academy/academy-payment-webhook.js");
const { pool } = await import("@workspace/db");
const keys = ["ASAAS_PRODUCT_WEBHOOK_TOKEN", "ASAAS_ACADEMY_WEBHOOK_TOKEN", "ASAAS_WEBHOOK_TOKEN"] as const;
const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const product = randomBytes(32).toString("hex"), academy = randomBytes(32).toString("hex"), shared = randomBytes(32).toString("hex");
const app = express();
app.use(express.json());
app.use("/products", products);
app.post("/academy", createAcademyPaymentWebhook());
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
assert.ok(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}`;
async function post(path: string, token?: string) {
  return fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json",
    ...(token ? { "asaas-access-token": token } : {}) }, body: JSON.stringify({ event: "OFFLINE_IGNORED_EVENT" }) });
}
try {
  process.env.ASAAS_PRODUCT_WEBHOOK_TOKEN = product;
  process.env.ASAAS_ACADEMY_WEBHOOK_TOKEN = academy;
  process.env.ASAAS_WEBHOOK_TOKEN = shared;
  for (const [path, expected, foreign] of [["/products/webhooks/asaas", product, academy], ["/academy", academy, product]]) {
    assert.equal((await post(path!, expected)).status, 200);
    for (const wrong of [foreign, shared, undefined]) assert.equal((await post(path!, wrong)).status, 401);
  }
  for (const key of keys.slice(0, 2)) delete process.env[key];
  for (const path of ["/products/webhooks/asaas", "/academy"]) assert.equal((await post(path, shared)).status, 200);
  process.env.ASAAS_PRODUCT_WEBHOOK_TOKEN = "";
  process.env.ASAAS_ACADEMY_WEBHOOK_TOKEN = "";
  for (const path of ["/products/webhooks/asaas", "/academy"]) assert.equal((await post(path, shared)).status, 401);
  console.log("PASS Asaas HTTP token isolation: own token accepted; cross-token, shared override and missing token denied; absent override fallback and empty override fail-closed verified; no DB/provider/payment writes");
} finally {
  for (const key of keys) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  await pool.end();
}
