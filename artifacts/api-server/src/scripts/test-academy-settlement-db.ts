import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import express from "express";
import { eq, inArray } from "drizzle-orm";
import { db, pool, academyPurchasesTable, academyLeadsTable, type AcademyPurchase } from "@workspace/db";
import { createAcademyPaymentWebhook } from "../modules/academy/academy-payment-webhook.js";
import { confirmAcademyPayment, fetchAcademySettlement, type AcademySettlement } from "../modules/academy/academy-settlement.service.js";
import { generateAccessToken } from "../modules/academy/academy-access-code.js";
import { AppError } from "../lib/errors.js";

assert.equal(process.env.NODE_ENV, "test");
const localFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("External calls forbidden in this test"); };
const purchaseIds: string[] = [];
const leadIds: string[] = [];
const previousToken = process.env.ASAAS_WEBHOOK_TOKEN;
const secret = randomBytes(32).toString("hex");
process.env.ASAAS_WEBHOOK_TOKEN = secret;
const proofs = new Map<string, unknown>();
const delivered: string[] = [];
let lookupCalls = 0;
const app = express();
app.use(express.json());
app.post("/webhook", createAcademyPaymentWebhook({
  lookup: async (id) => { lookupCalls++; const proof = proofs.get(id); if (proof instanceof Error) throw proof; return proof; },
  sendAccess: async (opts) => { delivered.push(opts.token); return { status: "sent", providerId: "offline-fixture" }; },
}));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  assert.ok(error instanceof AppError);
  res.status(error.statusCode).json({ code: error.code });
});
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
assert.ok(address && typeof address !== "string");
const url = `http://127.0.0.1:${address.port}/webhook`;

async function fixture(status = "pending", paymentId = `pay_fixture_${randomUUID()}`) {
  const id = randomUUID();
  purchaseIds.push(id);
  const email = `academy-settlement-${id}@example.invalid`;
  const [purchase] = await db.insert(academyPurchasesTable).values({
    id, accessToken: generateAccessToken(), customerEmail: email, customerName: "Regression fixture",
    productId: "mini-guide", amountCents: 9700, asaasPaymentId: paymentId,
    asaasCustomerId: `cus_${id}`, status,
  }).returning();
  const leadId = randomUUID();
  leadIds.push(leadId);
  await db.insert(academyLeadsTable).values({ id: leadId, email, source: "settlement-fixture" });
  proofs.set(paymentId, proofFor(purchase!));
  return purchase!;
}
function proofFor(purchase: AcademyPurchase): AcademySettlement {
  return { id: purchase.asaasPaymentId!, customer: purchase.asaasCustomerId!, externalReference: purchase.id, value: 97, billingType: "PIX", status: "RECEIVED" };
}
async function read(purchase: AcademyPurchase) {
  const [row] = await db.select().from(academyPurchasesTable).where(eq(academyPurchasesTable.id, purchase.id));
  return row!;
}
async function lead(purchase: AcademyPurchase) {
  const [row] = await db.select().from(academyLeadsTable).where(eq(academyLeadsTable.email, purchase.customerEmail));
  return row!;
}
async function notify(purchase: AcademyPurchase, event = "PAYMENT_CONFIRMED") {
  const response = await localFetch(url, {
    method: "POST", headers: { "Content-Type": "application/json", "asaas-access-token": secret },
    // All these notification fields are untrusted and deliberately false.
    body: JSON.stringify({ event, payment: { id: purchase.asaasPaymentId, externalReference: "not-a-purchase-uuid", value: 0, status: "RECEIVED" } }),
  });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

try {
  for (const body of [[], {}, { event: "PAYMENT_CONFIRMED", payment: {} }, { event: "PAYMENT_CONFIRMED", payment: { id: ["invalid"] } }]) {
    const response = await localFetch(url, { method: "POST", headers: { "Content-Type": "application/json", "asaas-access-token": secret }, body: JSON.stringify(body) });
    assert.equal(response.status, 400);
  }
  assert.equal(lookupCalls, 0);
  const first = await fixture();
  const responses = await Promise.all(Array.from({ length: 16 }, () => notify(first)));
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.ok(responses.every((r) => r.status === 200 && !("token" in r.body)));
  assert.equal(responses.filter((r) => r.body.alreadyConfirmed).length, 15);
  assert.equal(delivered.filter((token) => token === first.accessToken).length, 1);
  const confirmed = await read(first);
  assert.equal(confirmed.status, "confirmed");
  assert.deepEqual((await lead(first)).convertedAt, confirmed.confirmedAt);
  const calls = lookupCalls;
  await notify(first);
  assert.equal(lookupCalls, calls);
  assert.deepEqual(await read(first), confirmed);
  console.log("PASS: 16 concurrent HTTP notifications confirm once, schedule one mock email and convert lead atomically; replay discloses no token");

  const pending = await fixture();
  for (const status of ["PENDING", "CONFIRMED", "REFUNDED", "OVERDUE"]) {
    proofs.set(pending.asaasPaymentId!, { ...proofFor(pending), status });
    assert.equal((await notify(pending, "PAYMENT_APPROVED_BY_RISK_ANALYSIS")).status, 200);
    assert.equal((await read(pending)).status, "pending");
    assert.equal((await lead(pending)).convertedAt, null);
  }
  for (const changed of [{ id: "pay_wrong" }, { customer: "cus_wrong" }, { externalReference: randomUUID() }, { value: 1 }, { value: 97.001 }, { deleted: true }, { billingType: "UNDEFINED" }]) {
    proofs.set(pending.asaasPaymentId!, { ...proofFor(pending), ...changed });
    assert.equal((await notify(pending)).status, 409);
  }
  proofs.set(pending.asaasPaymentId!, {});
  assert.equal((await notify(pending)).status, 502);
  proofs.set(pending.asaasPaymentId!, new AppError(503, "Offline outage", "SETTLEMENT_VERIFICATION_UNAVAILABLE"));
  assert.equal((await notify(pending)).status, 503);
  await assert.rejects(confirmAcademyPayment(pending.asaasPaymentId!), (error: unknown) => {
    assert.equal((error as AppError).statusCode, 503); return true;
  });
  assert.equal((await read(pending)).status, "pending");
  assert.equal((await lead(pending)).convertedAt, null);
  assert.equal(delivered.length, 1);
  proofs.set(pending.asaasPaymentId!, proofFor(pending));
  assert.equal((await notify(pending)).status, 200);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal((await read(pending)).status, "confirmed");
  assert.equal(delivered.length, 2);
  console.log("PASS: risk approval/unsettled state, ID/customer/reference/amount mismatch, malformed response and outage cannot release access; retry succeeds");

  const changed = await fixture();
  await assert.rejects(confirmAcademyPayment(changed.asaasPaymentId!, async () => {
    await db.update(academyPurchasesTable).set({ amountCents: 10000 }).where(eq(academyPurchasesTable.id, changed.id));
    return proofFor(changed);
  }), /divergente/);
  assert.equal((await read(changed)).status, "pending");
  assert.equal((await lead(changed)).convertedAt, null);
  const cancelled = await fixture("cancelled");
  assert.equal((await notify(cancelled)).status, 409);
  const duplicateId = `pay_duplicate_${randomUUID()}`;
  const duplicate1 = await fixture("pending", duplicateId);
  const duplicate2 = await fixture("pending", duplicateId);
  assert.equal((await notify(duplicate1)).status, 409);
  for (const p of [duplicate1, duplicate2]) assert.equal((await read(p)).status, "pending");
  assert.deepEqual(await confirmAcademyPayment(`pay_missing_${randomUUID()}`, async () => { throw new Error("No provider lookup for unknown payment"); }), { status: "not_found" });
  console.log("PASS: locked binding recheck, terminal state, duplicate payment ID and unknown payment fail safely");

  const card = await fixture();
  proofs.set(card.asaasPaymentId!, { ...proofFor(card), billingType: "CREDIT_CARD", status: "CONFIRMED" });
  assert.equal((await notify(card)).status, 200);
  assert.equal((await read(card)).status, "confirmed");
  assert.ok((await lead(card)).convertedAt);
  const boleto = await fixture();
  proofs.set(boleto.asaasPaymentId!, { ...proofFor(boleto), billingType: "BOLETO" });
  assert.equal((await notify(boleto)).status, 200);
  assert.equal((await read(boleto)).status, "confirmed");
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(delivered.filter((token) => token === card.accessToken).length, 1);
  assert.equal(delivered.filter((token) => token === boleto.accessToken).length, 1);
  console.log("PASS: canonically confirmed card and received boleto release access; malformed notification never queries provider");

  const previousKey = process.env.ASAAS_API_KEY;
  const previousSandbox = process.env.ASAAS_SANDBOX;
  try {
    process.env.ASAAS_API_KEY = "offline-fixture";
    for (const sandbox of ["true", "false"]) {
      process.env.ASAAS_SANDBOX = sandbox;
      const proof = await fetchAcademySettlement("fixture/a?b", async (target, options) => {
        assert.equal(String(target), `${sandbox === "true" ? "https://api-sandbox.asaas.com" : "https://api.asaas.com"}/v3/payments/fixture%2Fa%3Fb`);
        assert.equal(options?.method, "GET");
        assert.ok(options?.signal instanceof AbortSignal);
        return new Response(JSON.stringify(proofFor(first)));
      });
      assert.equal(proof.customer, first.asaasCustomerId);
    }
    for (const status of [401, 404, 429, 500]) await assert.rejects(fetchAcademySettlement("fixture", async () => new Response("private-details", { status })), /verificar/);
    await assert.rejects(fetchAcademySettlement("fixture", async () => { throw new DOMException("private-details", "TimeoutError"); }), /verificar/);
    await assert.rejects(fetchAcademySettlement("fixture", async () => new Response("{}")), /inválida/);
  } finally {
    if (previousKey === undefined) delete process.env.ASAAS_API_KEY; else process.env.ASAAS_API_KEY = previousKey;
    if (previousSandbox === undefined) delete process.env.ASAAS_SANDBOX; else process.env.ASAAS_SANDBOX = previousSandbox;
  }
  console.log("PASS: Academy environment selection, bounded GET and provider failures using injected responses only");
} finally {
  if (previousToken === undefined) delete process.env.ASAAS_WEBHOOK_TOKEN; else process.env.ASAAS_WEBHOOK_TOKEN = previousToken;
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  try {
    if (purchaseIds.length) await db.delete(academyPurchasesTable).where(inArray(academyPurchasesTable.id, purchaseIds));
    if (leadIds.length) await db.delete(academyLeadsTable).where(inArray(academyLeadsTable.id, leadIds));
  } finally { await pool.end(); }
}
console.log("PASS: exact fixture UUIDs removed; no real provider or email calls");
