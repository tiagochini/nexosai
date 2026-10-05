import assert from "node:assert/strict";
import { deliverFunnelMessage, funnelDeliveryPatch } from "../modules/academy/academy-funnel-delivery.js";

const message = { to: "fixture@example.invalid", subject: "Fixture", html: "<p>Fixture</p>" };
const config = { resendFrom: "fixture@example.invalid" };
let requests = 0;
let gmailRequests = 0;
const dependencies = {
  fetch: (async () => { requests++; return new Response(JSON.stringify({ id: "receipt-fixture" })); }) as typeof fetch,
  sendGmail: async () => { gmailRequests++; return { accepted: [message.to], messageId: "gmail-fixture" }; },
};

for (const partial of [{}, { gmailUser: "fixture" }, { gmailPassword: "fixture" }]) {
  const result = await deliverFunnelMessage(message, { ...config, ...partial }, dependencies);
  assert.deepEqual(result, { status: "scheduled", errorCode: "EMAIL_PROVIDER_NOT_CONFIGURED" });
  assert.deepEqual(funnelDeliveryPatch(result), {
    status: "scheduled", sentAt: null, resendId: null, errorMessage: "EMAIL_PROVIDER_NOT_CONFIGURED",
  });
}
assert.equal(requests + gmailRequests, 0, "missing configuration must not invoke any transport");
const resendConfig = { ...config, resendKey: "fixture", gmailUser: "fixture", gmailPassword: "fixture" };
const success = await deliverFunnelMessage(message, resendConfig, dependencies);
assert.deepEqual(success, { status: "sent", providerId: "receipt-fixture" });
assert.equal(gmailRequests, 0, "Resend takes precedence");
const now = new Date();
assert.deepEqual(funnelDeliveryPatch(success, now), {
  status: "sent", sentAt: now, resendId: "receipt-fixture", errorMessage: null,
});
const gmailConfig = { ...config, gmailUser: "fixture", gmailPassword: "fixture" };
assert.deepEqual(await deliverFunnelMessage(message, gmailConfig, dependencies), {
  status: "sent", providerId: "gmail-fixture",
});
for (const receipt of [{ accepted: [], messageId: "fixture" }, { accepted: ["other@example.invalid"], messageId: "fixture" }, { accepted: [message.to] }]) {
  const result = await deliverFunnelMessage(message, gmailConfig, {
    ...dependencies, sendGmail: async () => receipt,
  });
  assert.equal(result.status, receipt.messageId ? "failed" : "sending");
  assert.equal(funnelDeliveryPatch(result).sentAt, null);
}
for (const body of [{}, { id: "" }, { id: 5 }, { id: "x".repeat(101) }]) {
  assert.deepEqual(await deliverFunnelMessage(message, resendConfig, {
    ...dependencies, fetch: (async () => new Response(JSON.stringify(body))) as typeof fetch,
  }), { status: "sending", errorCode: "RESEND_INVALID_RECEIPT" });
}
assert.deepEqual(await deliverFunnelMessage(message, resendConfig, {
  ...dependencies, fetch: (async () => new Response("private-provider-body", { status: 429 })) as typeof fetch,
}), { status: "failed", errorCode: "RESEND_HTTP_429" });
assert.deepEqual(await deliverFunnelMessage(message, resendConfig, {
  ...dependencies, fetch: (async () => new Response("private-provider-body", { status: 503 })) as typeof fetch,
}), { status: "sending", errorCode: "RESEND_HTTP_503" });
for (const providerConfig of [resendConfig, gmailConfig]) {
  const result = await deliverFunnelMessage(message, providerConfig, {
    fetch: (async () => { throw new Error("private-secret"); }) as typeof fetch,
    sendGmail: async () => { throw new Error("private-secret"); },
  });
  assert.equal(result.status, "sending");
  assert.ok(!JSON.stringify(result).includes("private-secret"));
}
assert.equal(gmailRequests, 1, "Resend failure must not fall back and risk duplicate delivery");
console.log("PASS Academy delivery: no-provider, partial config, Gmail, Resend, rejection and safe failure states (offline)");
