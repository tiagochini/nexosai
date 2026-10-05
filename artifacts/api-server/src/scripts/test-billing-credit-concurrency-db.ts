import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool, usersTable, workspacesTable, plansTable, subscriptionPaymentsTable, creditTransactionsTable, CREDIT_COSTS } from "@workspace/db";
import { confirmPaymentByExternalId, markPaymentPaid, initiatePackPayment } from "../modules/billing/billing.service.js";
import { grantCredits, deductCredits } from "../modules/credits/credits.service.js";
import { logger } from "../lib/logger.js";

assert.equal(process.env.NODE_ENV, "test", "Run only with NODE_ENV=test");
// Never call a payment provider, even if private credentials exist in the environment.
globalThis.fetch = async () => { throw new Error("External network forbidden in this regression test"); };
const userId = randomUUID();
const workspaceId = randomUUID();
const otherWorkspaceId = randomUUID();
const marker = randomUUID();
let planId: string;
const received = async (id: string) => ({ id, status: "RECEIVED", value: 1, billingType: "PIX" });
async function payment(credits = 100, status: "pending" | "processing" | "refunded" | "paid" = "pending", externalId = `fixture-${randomUUID()}`) {
  const [row] = await db.insert(subscriptionPaymentsTable).values({
    workspaceId, userId, planId, amountCents: 100, method: "pix", status,
    externalId, description: "Billing regression fixture", metadata: { type: "pack", packCredits: credits },
  }).returning();
  return row!;
}
async function balance() {
  const [row] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, workspaceId));
  return row!.creditsBalance;
}
async function readPayment(id: string) {
  const [row] = await db.select().from(subscriptionPaymentsTable).where(eq(subscriptionPaymentsTable.id, id));
  return row!;
}
async function ledger(id: string) {
  return db.select().from(creditTransactionsTable).where(eq(creditTransactionsTable.idempotencyKey, `billing-payment:${id}`));
}
async function setBalance(value: number) {
  await db.update(workspacesTable).set({ creditsBalance: value }).where(eq(workspacesTable.id, workspaceId));
}

try {
  const [plan] = await db.select().from(plansTable).limit(1);
  assert.ok(plan, "Seed plans before running");
  planId = plan.id;
  await db.insert(usersTable).values({ id: userId, email: `billing-${marker}@example.invalid`, passwordHash: "not-a-login-hash", name: "Billing fixture" });
  await db.insert(workspacesTable).values([workspaceId, otherWorkspaceId].map((id) => ({
    id, ownerId: userId, planId, name: "Billing fixture", slug: `billing-${id}`, creditsBalance: 1000,
  })));

  const first = await payment();
  await Promise.all(Array.from({ length: 16 }, (_, i) => i % 2
    ? markPaymentPaid(workspaceId, first.id, "fixture")
    : confirmPaymentByExternalId(first.externalId!, { fixture: true }, received)));
  assert.equal(await balance(), 1100);
  assert.equal((await ledger(first.id)).length, 1);
  const settled = await readPayment(first.id);
  assert.equal(settled.status, "paid");
  await markPaymentPaid(workspaceId, first.id, "must not overwrite");
  assert.deepEqual(await readPayment(first.id), settled);
  console.log("PASS: 16 simultaneous manual/provider confirmations grant exactly once; replay preserves record");

  const payments = await Promise.all(Array.from({ length: 8 }, () => payment(25, "processing")));
  await Promise.all(payments.map((p) => markPaymentPaid(workspaceId, p.id)));
  assert.equal(await balance(), 1300);
  for (const p of payments) assert.equal((await ledger(p.id)).length, 1);
  const entries = await db.select().from(creditTransactionsTable).where(eq(creditTransactionsTable.workspaceId, workspaceId));
  const ordered = entries.sort((a, b) => a.balanceBefore - b.balanceBefore);
  assert.equal(ordered[0]!.balanceBefore, 1000);
  for (let i = 1; i < ordered.length; i++) assert.equal(ordered[i]!.balanceBefore, ordered[i - 1]!.balanceAfter);
  console.log("PASS: different payments serialize balance updates with a continuous ledger");

  const invalid = await payment(0);
  await assert.rejects(markPaymentPaid(workspaceId, invalid.id), /Invalid credit grant amount/);
  assert.equal((await readPayment(invalid.id)).status, "pending");
  assert.equal((await readPayment(invalid.id)).paidAt, null);
  assert.equal((await ledger(invalid.id)).length, 0);
  assert.equal(await balance(), 1300);
  await db.update(subscriptionPaymentsTable).set({ metadata: { type: "pack", packCredits: 10 } }).where(eq(subscriptionPaymentsTable.id, invalid.id));
  await markPaymentPaid(workspaceId, invalid.id);
  assert.equal(await balance(), 1310);

  const overflow = await payment(100);
  await setBalance(2147483640);
  await assert.rejects(markPaymentPaid(workspaceId, overflow.id), /supported range/);
  assert.equal((await readPayment(overflow.id)).status, "pending");
  assert.equal((await readPayment(overflow.id)).paidAt, null);
  assert.equal((await ledger(overflow.id)).length, 0);
  assert.equal(await balance(), 2147483640);
  await setBalance(1310);
  await markPaymentPaid(workspaceId, overflow.id);
  assert.equal(await balance(), 1410);
  console.log("PASS: invalid amount/overflow rolls back payment, balance and ledger; corrected retry succeeds");

  const pending = await payment();
  await assert.rejects(markPaymentPaid(otherWorkspaceId, pending.id));
  const refunded = await payment(100, "refunded");
  await assert.rejects(markPaymentPaid(workspaceId, refunded.id), /confirmado neste estado/);
  const duplicateId = `duplicate-${marker}`;
  const duplicates = await Promise.all([payment(100, "pending", duplicateId), payment(100, "pending", duplicateId)]);
  await assert.rejects(confirmPaymentByExternalId(duplicateId, {}), /ambíguo/);
  for (const p of [pending, refunded, ...duplicates]) {
    assert.equal((await readPayment(p.id)).status, p.status);
    assert.equal((await ledger(p.id)).length, 0);
  }
  const legacy = await payment(100, "paid");
  await markPaymentPaid(workspaceId, legacy.id);
  assert.equal((await ledger(legacy.id)).length, 0);
  assert.equal(await balance(), 1410);
  console.log("PASS: wrong workspace, terminal state, ambiguous provider ID and legacy replay cannot grant credits");

  await Promise.all(Array.from({ length: 12 }, () => grantCredits(workspaceId, 5, "admin_grant", logger)));
  assert.equal(await balance(), 1470);
  const key = `grant-${marker}`;
  await Promise.all(Array.from({ length: 10 }, () => grantCredits(workspaceId, 10, "admin_grant", logger, "fixture", key)));
  assert.equal(await balance(), 1480);
  await assert.rejects(grantCredits(otherWorkspaceId, 10, "admin_grant", logger, "fixture", key), /idempotency conflict/);
  for (const amount of [0, -1, 1.5, Number.NaN]) await assert.rejects(grantCredits(workspaceId, amount, "admin_grant", logger), /Invalid credit grant amount/);
  console.log("PASS: concurrent direct grants, stable keys, cross-workspace conflicts and invalid amounts");

  const cardExternalId = `card-${marker}`;
  const mockBuilder: NonNullable<Parameters<typeof initiatePackPayment>[1]> = async () => ({
    chargedCents: 8798, externalId: cardExternalId, expiresAt: null,
    pixData: null, boletoData: null, bankTransferData: null, cryptoData: null,
    cardResult: { last4: "0000", brand: "fixture", status: "CONFIRMED", asaasId: cardExternalId },
  });
  const opts = { workspaceId, userId, packId: "pack_500", method: "credit_card" as const, userName: "Fixture", userEmail: `billing-${marker}@example.invalid` };
  await setBalance(2147483640);
  await assert.rejects(initiatePackPayment(opts, mockBuilder), /supported range/);
  assert.equal((await db.select().from(subscriptionPaymentsTable).where(eq(subscriptionPaymentsTable.externalId, cardExternalId))).length, 0);
  assert.equal(await balance(), 2147483640);
  await setBalance(1480);
  const card = await initiatePackPayment(opts, mockBuilder);
  assert.equal(card.status, "paid");
  assert.equal(await balance(), 1980);
  assert.equal((await ledger(card.id)).length, 1);
  await confirmPaymentByExternalId(cardExternalId, {});
  assert.equal(await balance(), 1980);
  console.log("PASS: approved-card record and credits commit together; failure leaves neither; webhook replay is inert");

  const mixedStart = await balance();
  await Promise.all(Array.from({ length: 8 }, (_, i) => [
    grantCredits(workspaceId, 20, "admin_grant", logger),
    deductCredits(workspaceId, "strategy_generation", logger, undefined, undefined, undefined, undefined, `debit-${marker}-${i}`),
  ]).flat());
  assert.equal(await balance(), mixedStart + 8 * (20 - CREDIT_COSTS.strategy_generation));
  console.log("PASS: concurrent grants and deductions preserve the shared balance");

  const verificationStart = await balance();
  const verified = await payment();
  const notify = { event: "PAYMENT_CONFIRMED", payment: { id: verified.externalId, value: 999999, status: "RECEIVED" }, customer: "private-notification" };
  for (const status of ["PENDING", "CONFIRMED", "REFUNDED", "OVERDUE"]) {
    await confirmPaymentByExternalId(verified.externalId!, notify, async (id) => ({ ...await received(id), status }));
    assert.equal((await readPayment(verified.id)).status, "pending");
  }
  for (const changed of [{ id: "pay_wrong" }, { value: 2 }, { billingType: "CREDIT_CARD" }, { deleted: true }]) {
    await assert.rejects(confirmPaymentByExternalId(verified.externalId!, notify, async (id) => ({ ...await received(id), ...changed })), /divergente/);
  }
  await assert.rejects(confirmPaymentByExternalId(verified.externalId!, notify, async () => { throw new Error("offline-outage"); }), /offline-outage/);
  await assert.rejects(confirmPaymentByExternalId(verified.externalId!, notify, async () => ({})), /inválida/);
  // Default production boundary is also fail-closed. fetch is blocked above.
  await assert.rejects(confirmPaymentByExternalId(verified.externalId!, notify), (error: unknown) => {
    assert.equal((error as { statusCode: number }).statusCode, 503);
    return true;
  });
  assert.equal(await balance(), verificationStart);
  assert.equal((await ledger(verified.id)).length, 0);
  await confirmPaymentByExternalId(verified.externalId!, notify, received);
  assert.equal(await balance(), verificationStart + 100);
  const verifiedRow = await readPayment(verified.id);
  assert.equal(verifiedRow.status, "paid");
  assert.equal((await ledger(verified.id)).length, 1);
  assert.ok(!JSON.stringify(verifiedRow.metadata).includes("private-notification"));
  assert.ok(!("providerPayload" in (verifiedRow.metadata as object)));

  const changedDuringLookup = await payment();
  await assert.rejects(confirmPaymentByExternalId(changedDuringLookup.externalId!, {}, async (id) => {
    await db.update(subscriptionPaymentsTable).set({ amountCents: 200 }).where(eq(subscriptionPaymentsTable.id, changedDuringLookup.id));
    return received(id);
  }), /divergente/);
  assert.equal((await readPayment(changedDuringLookup.id)).status, "pending");
  assert.equal((await ledger(changedDuringLookup.id)).length, 0);
  assert.equal(await balance(), verificationStart + 100);
  console.log("PASS: provider state overrides spoofed notification; mismatches/outage cannot grant; retry and locked binding recheck");
} finally {
  // Exact owned UUID only; cascade removes this test's workspaces, payments and ledger.
  try { await db.delete(usersTable).where(eq(usersTable.id, userId)); }
  finally { await pool.end(); }
}
console.log("PASS: billing regression fixtures removed; no real provider calls");
