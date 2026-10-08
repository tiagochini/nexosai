import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool, usersTable, workspacesTable, plansTable, subscriptionPaymentsTable as payments, creditTransactionsTable as credits, type SubscriptionPayment } from "@workspace/db";
import { confirmPaymentByExternalId, initiatePayment, initiatePackPayment, getSubscriptionStatus, markPaymentPaid } from "../modules/billing/billing.service.js";
import { reconcileBillingReversal } from "../modules/billing/billing-reversal.service.js";

assert.equal(process.env.NODE_ENV, "test");
globalThis.fetch = async () => { throw new Error("Provider calls forbidden in local regression"); };
const userId = randomUUID(), workspaceId = randomUUID(), otherId = randomUUID();
async function ws(id = workspaceId) { return (await db.select().from(workspacesTable).where(eq(workspacesTable.id, id)))[0]!; }
async function row(id: string) { return (await db.select().from(payments).where(eq(payments.id, id)))[0]!; }
const proof = (p: { externalId: string | null; amountCents: number }, status = "CONFIRMED") => ({
  id: p.externalId, value: p.amountCents / 100, billingType: "CREDIT_CARD", status,
  refunds: status === "REFUNDED" ? [{ status: "DONE", value: p.amountCents / 100 }] : null,
});
const approved: Parameters<typeof initiatePayment>[1] = async (_method, opts) => ({
  externalId: `fixture-${randomUUID()}`, chargedCents: opts.amountCents, expiresAt: new Date(),
  pixData: null, boletoData: null, cryptoData: null, bankTransferData: null,
  cardResult: { last4: "4444", brand: "VISA", status: "CONFIRMED", asaasId: "fixture" },
});
try {
  const plans = await db.select().from(plansTable);
  const solo = plans.find(p => p.slug === "solo")!, agency = plans.find(p => p.slug === "agency")!;
  assert.ok(solo && agency);
  await db.insert(usersTable).values({ id: userId, email: `billing-plan-${userId}@example.invalid`, name: "Plan fixture", passwordHash: "not-a-login-hash" });
  await db.insert(workspacesTable).values([workspaceId, otherId].map(id => ({ id, ownerId: userId, planId: solo.id, slug: `plan-${id}`, name: "Plan fixture", creditsBalance: 1000, settings: { retained: true } })));
  const opts = { workspaceId, userId, planId: agency.id, method: "credit_card" as const, userName: "Fixture", userEmail: "fixture@example.invalid" };
  const direct = await initiatePayment(opts, approved);
  assert.equal((await ws()).planId, agency.id);
  assert.equal((await ws()).creditsBalance, 1000 + agency.creditsMonthly);
  assert.equal(((await ws()).settings as Record<string, unknown>).retained, true);
  assert.equal((await ws(otherId)).creditsBalance, 1000);
  assert.equal((await ws(otherId)).planId, solo.id);
  await Promise.all(Array.from({ length: 12 }, () => confirmPaymentByExternalId(direct.externalId!, {}, async () => proof(direct))));
  assert.equal((await ws()).creditsBalance, 1000 + agency.creditsMonthly);
  assert.equal((await db.select().from(credits).where(eq(credits.idempotencyKey, `billing-payment:${direct.id}`))).length, 1);
  assert.equal((await getSubscriptionStatus(workspaceId)).planName, agency.name);
  // A credit pack must neither replace the paid plan nor make a subscription active.
  const pack = await initiatePackPayment({ ...opts, packId: "pack_500" }, approved);
  assert.equal((await getSubscriptionStatus(workspaceId)).lastPayment?.id, direct.id);
  await Promise.all(Array.from({ length: 8 }, () => reconcileBillingReversal(direct.externalId!, async () => proof(direct, "REFUNDED"))));
  assert.equal((await ws()).planId, solo.id);
  assert.equal((await ws()).creditsBalance, 1500);
  assert.equal((await getSubscriptionStatus(workspaceId)).isActive, false);
  await reconcileBillingReversal(pack.externalId!, async () => proof(pack, "REFUNDED"));
  assert.equal((await ws()).creditsBalance, 1000);
  console.log("PASS approved card activates Agency atomically, grants once, isolates workspace; full refund restores Solo and excludes packs from subscription status");

  const [pending] = await db.insert(payments).values({ workspaceId, userId, planId: agency.id, method: "credit_card", amountCents: 10000, externalId: `fixture-${randomUUID()}`, metadata: { type: "plan", planCredits: agency.creditsMonthly } }).returning();
  await assert.rejects(confirmPaymentByExternalId(pending!.externalId!, {}, async () => ({ ...proof(pending!), value: 1 })), /divergente/);
  assert.equal((await row(pending!.id)).status, "pending");
  assert.equal((await ws()).planId, solo.id);
  await assert.rejects(markPaymentPaid(otherId, pending!.id));
  await Promise.all(Array.from({ length: 12 }, () => confirmPaymentByExternalId(pending!.externalId!, {}, async () => proof(pending!))));
  assert.equal((await ws()).creditsBalance, 1000 + agency.creditsMonthly);
  assert.equal((await ws()).planId, agency.id);
  await db.update(payments).set({ paidAt: new Date("2020-01-01") }).where(eq(payments.id, pending!.id));
  assert.equal((await getSubscriptionStatus(workspaceId)).isActive, true, "Paid lifetime plans do not expire after 30 days");
  await reconcileBillingReversal(pending!.externalId!, async () => proof(pending!, "CHARGEBACK_REQUESTED"));
  assert.equal((await ws()).planId, solo.id); assert.equal((await ws()).creditsBalance, 1000);
  await reconcileBillingReversal(pending!.externalId!, async () => proof(pending!));
  assert.equal((await ws()).planId, agency.id); assert.equal((await ws()).creditsBalance, 1000 + agency.creditsMonthly);
  const newer = await initiatePayment({ ...opts, planId: solo.id }, approved);
  await reconcileBillingReversal(pending!.externalId!, async () => proof(pending!, "REFUNDED"));
  assert.equal((await ws()).planId, solo.id, "Older plan refund must preserve newer paid plan");
  assert.equal((await getSubscriptionStatus(workspaceId)).lastPayment?.id, newer.id);
  await reconcileBillingReversal(newer.externalId!, async () => proof(newer, "REFUNDED"));
  assert.equal((await ws()).planId, solo.id, "Never restore the refunded predecessor");
  assert.equal((await ws()).creditsBalance, 1000);
  console.log("PASS pending webhook confirmation, invalid binding, concurrent replay, lifetime access, chargeback recovery and refund ordering");

  const taxId = "12345678909";
  const pendingBuilder: Parameters<typeof initiatePayment>[1] = async (_method, input) => {
    assert.equal(input.cpfCnpj, taxId, "The payer document must reach the provider builder");
    return { externalId: `fixture-${randomUUID()}`, chargedCents: input.amountCents, expiresAt: new Date(),
      pixData: null, boletoData: null, cryptoData: null, bankTransferData: null };
  };
  for (const method of ["pix", "boleto"] as const) {
    const before = (await ws()).creditsBalance;
    const payment: SubscriptionPayment = method === "pix"
      ? await initiatePayment({ ...opts, method, cpfCnpj: taxId }, pendingBuilder)
      : await initiatePackPayment({ ...opts, packId: "pack_500", method, cpfCnpj: taxId }, pendingBuilder);
    assert.equal(payment.status, "pending");
    assert.equal((await ws()).creditsBalance, before);
    const received = { ...proof(payment), billingType: method === "pix" ? "PIX" : "BOLETO", status: "RECEIVED" };
    await confirmPaymentByExternalId(payment.externalId!, {}, async () => ({ ...received, status: "CONFIRMED" }));
    assert.equal((await row(payment.id)).status, "pending");
    assert.equal((await ws()).creditsBalance, before);
    await Promise.all(Array.from({ length: 6 }, () => confirmPaymentByExternalId(payment.externalId!, {}, async () => received)));
    assert.equal((await ws()).creditsBalance, before + (method === "pix" ? agency.creditsMonthly : 500));
    await reconcileBillingReversal(payment.externalId!, async () => ({ ...received, status: "REFUNDED", refunds: [{ status: "DONE", value: payment.amountCents / 100 }] }));
    assert.equal((await ws()).creditsBalance, before);
  }
  console.log("PASS PIX/boleto carry payer document, remain pending until RECEIVED, and grant benefits once under concurrent notifications");

  await db.update(workspacesTable).set({ creditsBalance: 2147483640 }).where(eq(workspacesTable.id, workspaceId));
  await assert.rejects(initiatePayment(opts, approved), /supported range/);
  assert.equal((await ws()).planId, solo.id); assert.equal((await ws()).creditsBalance, 2147483640);
  const all = await db.select().from(payments).where(eq(payments.workspaceId, workspaceId));
  assert.equal(all.length, 6, "Failed grant must roll back new payment and activation");
  console.log("PASS credit overflow rolls back the complete payment/plan/ledger transaction");
} finally { try { await db.delete(usersTable).where(eq(usersTable.id, userId)); } finally { await pool.end(); } }
