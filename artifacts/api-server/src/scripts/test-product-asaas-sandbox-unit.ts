import assert from "node:assert/strict";
import { assertAsaasSandboxE2eEnvironment, fetchAsaasPayment, resolvePlatformAsaasEnvironment } from "../modules/product-checkout/product-checkout.service.js";
import { isValidAsaasWebhookToken } from "../modules/product-checkout/product-checkout.routes.js";

assert.deepEqual(resolvePlatformAsaasEnvironment({ ASAAS_SANDBOX: "true", ASAAS_SANDBOX_API_KEY: "sandbox-only", ASAAS_API_KEY: "live" }), {
  apiKey: "sandbox-only", base: "https://sandbox.asaas.com/api/v3", sandbox: true,
});
assert.throws(() => assertAsaasSandboxE2eEnvironment({ ASAAS_SANDBOX: "true" }), /ASAAS_SANDBOX_API_KEY/);
assert.throws(() => assertAsaasSandboxE2eEnvironment({ ASAAS_SANDBOX: "false", ASAAS_SANDBOX_API_KEY: "x" }), /ASAAS_SANDBOX=true/);
assert.equal(isValidAsaasWebhookToken("configured-token", "configured-token"), true);
assert.equal(isValidAsaasWebhookToken("wrong-token", "configured-token"), false);
assert.equal(isValidAsaasWebhookToken(undefined, "configured-token"), false);
const verified = await fetchAsaasPayment(
  "never-inspected",
  "https://sandbox.asaas.com/api/v3",
  "pay_sandbox",
  async (input, init) => {
    assert.equal(String(input), "https://sandbox.asaas.com/api/v3/payments/pay_sandbox");
    assert.equal((init?.headers as Record<string, string>)?.access_token, "never-inspected");
    return new Response(JSON.stringify({ id: "pay_sandbox", status: "CONFIRMED", netValue: 9.5 }), { status: 200 });
  },
);
assert.equal(verified.status, "CONFIRMED");
await assert.rejects(
  () => fetchAsaasPayment("unused", "https://sandbox.asaas.com/api/v3", "pay_wrong", async () =>
    new Response(JSON.stringify({ id: "another_payment", status: "CONFIRMED" }), { status: 200 })),
  /verificar o pagamento/,
);
console.log("Asaas sandbox guards passed");