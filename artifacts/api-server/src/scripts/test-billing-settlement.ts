import assert from "node:assert/strict";
import { fetchAsaasSettlement, parseAsaasSettlement, matchesBillingSettlement } from "../modules/billing/billing-settlement.js";

const payment = { externalId: "pay_fixture", amountCents: 12990, currency: "BRL" as const, method: "pix" as const };
const proof = { id: "pay_fixture", status: "RECEIVED", value: 129.9, billingType: "PIX" };
assert.equal(matchesBillingSettlement(payment, proof), true);
for (const status of ["PENDING", "OVERDUE", "REFUNDED", "CONFIRMED", "CHARGEBACK_REQUESTED", "UNKNOWN"]) {
  assert.equal(matchesBillingSettlement(payment, { ...proof, status }), false);
}
assert.equal(matchesBillingSettlement({ ...payment, method: "credit_card" }, { ...proof, billingType: "CREDIT_CARD", status: "CONFIRMED" }), true);
assert.equal(matchesBillingSettlement({ ...payment, method: "boleto" }, { ...proof, billingType: "BOLETO", status: "CONFIRMED" }), false);
for (const changed of [{ id: "pay_other" }, { value: 1 }, { value: 129.901 }, { billingType: "CREDIT_CARD" }, { deleted: true }]) {
  assert.throws(() => matchesBillingSettlement(payment, { ...proof, ...changed }), /divergente/);
}
assert.throws(() => matchesBillingSettlement({ ...payment, currency: "USD" }, proof), /divergente/);
assert.throws(() => matchesBillingSettlement({ ...payment, method: "manual" }, proof), /divergente/);
for (const malformed of [null, {}, { ...proof, value: "129.90" }, { ...proof, value: Number.NaN }, { ...proof, value: -1 }, { ...proof, deleted: "false" }]) {
  assert.throws(() => parseAsaasSettlement(malformed), /inválida/);
}
assert.deepEqual(parseAsaasSettlement({ ...proof, customer: "private", creditCard: { token: "private" } }), { ...proof, deleted: undefined });
const previousKey = process.env.ASAAS_API_KEY;
const previousEnv = process.env.ASAAS_ENV;
try {
  delete process.env.ASAAS_API_KEY;
  await assert.rejects(fetchAsaasSettlement("pay_fixture", async () => { throw new Error("Must not call without configuration"); }), /não configurado/);
  process.env.ASAAS_API_KEY = "offline-fixture-key";
  for (const mode of ["sandbox", "production"]) {
    process.env.ASAAS_ENV = mode;
    const result = await fetchAsaasSettlement("pay_fixture/a?b", async (url, options) => {
      assert.equal(String(url), `${mode === "production" ? "https://api.asaas.com" : "https://api-sandbox.asaas.com"}/v3/payments/pay_fixture%2Fa%3Fb`);
      assert.equal(options?.method, "GET");
      assert.ok(options?.signal instanceof AbortSignal);
      assert.equal((options?.headers as Record<string, string>).access_token, "offline-fixture-key");
      return new Response(JSON.stringify({ ...proof, customer: "not-retained" }), { status: 200 });
    });
    assert.deepEqual(result, { ...proof, deleted: undefined });
  }
  for (const status of [401, 404, 429, 500, 503]) {
    await assert.rejects(fetchAsaasSettlement("pay_fixture", async () => new Response("private-provider-body", { status })), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /verificar/);
      assert.ok(!error.message.includes("private-provider-body"));
      return true;
    });
  }
  await assert.rejects(fetchAsaasSettlement("pay_fixture", async () => { throw new DOMException("private-network-detail", "TimeoutError"); }), /verificar/);
  await assert.rejects(fetchAsaasSettlement("pay_fixture", async () => new Response("not-json")), /verificar/);
  await assert.rejects(fetchAsaasSettlement("pay_fixture", async () => new Response("{}")), /inválida/);
} finally {
  if (previousKey === undefined) delete process.env.ASAAS_API_KEY; else process.env.ASAAS_API_KEY = previousKey;
  if (previousEnv === undefined) delete process.env.ASAAS_ENV; else process.env.ASAAS_ENV = previousEnv;
}
console.log("PASS: canonical binding/status policy, bounded provider GET, malformed responses and outages; no real provider calls");
