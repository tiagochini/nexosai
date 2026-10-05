import assert from "node:assert/strict";
import { sendAccessEmail } from "../modules/academy/academy.service.js";
import { deliverFunnelMessage } from "../modules/academy/academy-funnel-delivery.js";

const opts = { email: "access-fixture@example.invalid", name: "<fixture>", token: "OFFLINE-FIXTURE", productName: "Curso", portalUrl: "https://example.invalid/portal" };
let gmailCalls = 0;
let resendCalls = 0;
const dependencies = {
  fetch: (async () => { resendCalls++; return new Response(JSON.stringify({ id: "offline-resend" })); }) as typeof fetch,
  sendGmail: async () => { gmailCalls++; return { accepted: [opts.email], messageId: "offline-gmail" }; },
};
for (const provider of ["none", "gmail", "resend"] as const) {
  const result = await sendAccessEmail(opts, async (message) => {
    assert.equal(message.to, opts.email);
    assert.ok(message.html.includes("&lt;fixture&gt;"));
    assert.ok(message.html.includes(opts.token));
    return deliverFunnelMessage(message, {
      resendFrom: "fixture@example.invalid",
      ...(provider === "gmail" ? { gmailUser: "fixture", gmailPassword: "fixture" } : {}),
      ...(provider === "resend" ? { resendKey: "fixture" } : {}),
    }, dependencies);
  });
  assert.equal(result.status, provider === "none" ? "scheduled" : "sent");
}
assert.equal(gmailCalls, 1);
assert.equal(resendCalls, 1);
for (const result of [
  { status: "failed", errorCode: "RESEND_HTTP_429" },
  { status: "sending", errorCode: "RESEND_TRANSPORT_ERROR" },
] as const) {
  assert.deepEqual(await sendAccessEmail(opts, async () => result), result);
}
console.log("PASS Academy access email: real service wiring for Gmail/Resend, missing provider, safe HTML and non-success results (offline)");
