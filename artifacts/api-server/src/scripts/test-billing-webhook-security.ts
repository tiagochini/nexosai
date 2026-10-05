import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import express from "express";
import jwt from "jsonwebtoken";
import { matchesAsaasWebhookToken } from "../lib/asaas-webhook-auth.js";

process.env.DATABASE_URL ??= "postgresql://fixture:fixture@127.0.0.1:1/unused";
const { default: router } = await import("../modules/billing/billing.routes.js");
const { pool } = await import("@workspace/db");
const { env } = await import("../lib/env.js");
const { checkBillingManualConfirmation } = await import("../modules/billing/billing.security.js");
const original = { legacy: process.env.ASAAS_WEBHOOK_SECRET, shared: process.env.ASAAS_WEBHOOK_TOKEN, manual: process.env.BILLING_MANUAL_CONFIRM_SECRET };
const secret = randomBytes(32).toString("hex");
const other = randomBytes(32).toString("hex");
for (const supplied of [undefined, "", [secret], {}, secret + "x", " "]) assert.equal(matchesAsaasWebhookToken(supplied, secret), false);
for (const configured of [undefined, "", " ", ` ${secret}`, "x".repeat(1025)]) assert.equal(matchesAsaasWebhookToken(secret, configured), false);
assert.equal(matchesAsaasWebhookToken(secret, secret), true);
const app = express();
app.use(express.json());
app.use("/api/billing", router);
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
assert.ok(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}/api/billing`;
const configure = (legacy: string | undefined, shared: string | undefined) => {
  if (legacy === undefined) delete process.env.ASAAS_WEBHOOK_SECRET; else process.env.ASAAS_WEBHOOK_SECRET = legacy;
  if (shared === undefined) delete process.env.ASAAS_WEBHOOK_TOKEN; else process.env.ASAAS_WEBHOOK_TOKEN = shared;
};
try {
  for (const [legacy, shared] of [[undefined, undefined], [undefined, ""], ["", secret], [" ", secret], [secret, other], [undefined, secret]] as const) {
    configure(legacy, shared);
    for (const supplied of [undefined, "wrong-fixture"]) {
      const response = await fetch(`${base}/webhooks/asaas?token=${encodeURIComponent(secret)}`, {
        method: "POST", headers: { "Content-Type": "application/json", ...(supplied ? { "asaas-access-token": supplied } : {}) },
        body: JSON.stringify({ event: "PAYMENT_CONFIRMED", payment: { id: "offline-must-not-be-queried" } }),
      });
      assert.equal(response.status, 401);
      assert.equal(((await response.json()) as { code: string }).code, "UNAUTHORIZED_WEBHOOK");
    }
  }
  for (const [legacy, shared, supplied, expected] of [
    [secret, other, secret, 200], [secret, other, other, 401], [undefined, secret, secret, 200], ["", secret, secret, 401],
  ] as const) {
    configure(legacy, shared);
    const response = await fetch(`${base}/webhooks/asaas`, {
      method: "POST", headers: { "Content-Type": "application/json", "asaas-access-token": supplied },
      body: JSON.stringify({ event: "OFFLINE_IGNORED_EVENT" }),
    });
    assert.equal(response.status, expected, "legacy override must take precedence; shared token is used only if override is absent");
    await response.json();
  }
  const bearer = jwt.sign({ userId: "00000000-0000-4000-8000-000000000001", workspaceId: "00000000-0000-4000-8000-000000000002", email: "fixture@example.invalid" }, env.JWT_SECRET, { expiresIn: "1m" });
  for (const configured of [undefined, "", "short", secret]) {
    if (configured === undefined) delete process.env.BILLING_MANUAL_CONFIRM_SECRET;
    else process.env.BILLING_MANUAL_CONFIRM_SECRET = configured;
    const response = await fetch(`${base}/confirm/00000000-0000-4000-8000-000000000003?secret=${encodeURIComponent(secret)}`, {
      method: "POST", headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json", "x-billing-admin-secret": "wrong-fixture" }, body: "{}",
    });
    assert.equal(response.status, 403, "authenticated user without administrative credentials must not confirm payment");
    assert.equal(((await response.json()) as { code: string }).code, "MANUAL_CONFIRMATION_FORBIDDEN");
  }
  process.env.BILLING_MANUAL_CONFIRM_SECRET = secret;
  // Test positive guard without executing the payment mutation.
  assert.equal(checkBillingManualConfirmation({ headers: { "x-billing-admin-secret": secret } }, {} as express.Response), true);
  console.log("PASS Billing HTTP: fail-closed webhook authentication, legacy/shared precedence and manual confirmation authorization (no DB/provider/payment writes)");
} finally {
  for (const [name, value] of [["ASAAS_WEBHOOK_SECRET", original.legacy], ["ASAAS_WEBHOOK_TOKEN", original.shared], ["BILLING_MANUAL_CONFIRM_SECRET", original.manual]] as const) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await pool.end();
}
