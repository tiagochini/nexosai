import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool, usersTable, workspacesTable, plansTable, subscriptionPaymentsTable as payments, creditTransactionsTable as credits } from "@workspace/db";
import { markPaymentPaid } from "../modules/billing/billing.service.js";
import { reconcileBillingReversal } from "../modules/billing/billing-reversal.service.js";
import { deductCredits, grantCredits, resetMonthlyCredits, checkCredits } from "../modules/credits/credits.service.js";
import { logger } from "../lib/logger.js";
assert.equal(process.env.NODE_ENV, "test"); globalThis.fetch = async () => { throw new Error("External calls forbidden"); };
const userId = randomUUID(), workspaceId = randomUUID(); let planId: string;
async function balance() { const [row] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, workspaceId)); return row!.creditsBalance; }
async function createPayment() {
  const [row] = await db.insert(payments).values({ workspaceId, userId, planId, externalId: `pay_${randomUUID()}`, amountCents: 10000, method: "credit_card", metadata: { type: "pack", packCredits: 100 } }).returning();
  await markPaymentPaid(workspaceId, row!.id); return row!;
}
const proof = (id: string, status: string, refunds: { status: string; value: number }[] = []) => ({ id, status, value: 100, billingType: "CREDIT_CARD", refunds });
try {
  const [plan] = await db.select().from(plansTable).limit(1); assert.ok(plan); planId = plan.id;
  await db.insert(usersTable).values({ id: userId, email: `refund-${userId}@example.invalid`, name: "Refund fixture", passwordHash: "not-a-login-hash" });
  await db.insert(workspacesTable).values({ id: workspaceId, ownerId: userId, planId, name: "Refund fixture", slug: `refund-${workspaceId}`, creditsBalance: 0 });
  const p = await createPayment(); assert.equal(await balance(), 100);
  const partial = async () => proof(p.externalId!, "RECEIVED", [{ status: "DONE", value: 25 }, { status: "PENDING", value: 25 }]);
  await Promise.all(Array.from({ length: 16 }, () => reconcileBillingReversal(p.externalId!, partial)));
  assert.equal(await balance(), 75);
  await Promise.all(Array.from({ length: 4 }, () => deductCredits(workspaceId, "strategy_generation", logger)));
  assert.equal(await balance(), 15);
  const full = async () => proof(p.externalId!, "REFUNDED", [{ status: "DONE", value: 25 }, { status: "DONE", value: 75 }]);
  await Promise.all(Array.from({ length: 16 }, () => reconcileBillingReversal(p.externalId!, full)));
  assert.equal(await balance(), -60);
  await assert.rejects(deductCredits(workspaceId, "strategy_generation", logger));
  await db.update(workspacesTable).set({ settings: { unlimitedCredits: true } }).where(eq(workspacesTable.id, workspaceId));
  assert.equal((await checkCredits(workspaceId, "strategy_generation")).sufficient, false);
  await assert.rejects(deductCredits(workspaceId, "strategy_generation", logger));
  await db.update(workspacesTable).set({ settings: {} }).where(eq(workspacesTable.id, workspaceId));
  const reversals = await db.select().from(credits).where(eq(credits.action, "refund_reversal"));
  assert.equal(reversals.filter((r) => r.workspaceId === workspaceId).length, 2);
  await grantCredits(workspaceId, 100, "admin_grant", logger); assert.equal(await balance(), 40);
  await deductCredits(workspaceId, "strategy_generation", logger); assert.equal(await balance(), 25);
  console.log("PASS: cumulative completed partial/full refunds debit once, retain negative debt and block consumption until replenished");

  const held = await createPayment(); const beforeHold = await balance();
  await reconcileBillingReversal(held.externalId!, async () => proof(held.externalId!, "CHARGEBACK_REQUESTED"));
  assert.equal(await balance(), beforeHold - 100);
  await Promise.all(Array.from({ length: 12 }, () => reconcileBillingReversal(held.externalId!, async () => proof(held.externalId!, "CONFIRMED"))));
  assert.equal(await balance(), beforeHold);
  await reconcileBillingReversal(held.externalId!, async () => proof(held.externalId!, "CONFIRMED")); assert.equal(await balance(), beforeHold);
  await assert.rejects(reconcileBillingReversal(held.externalId!, async () => ({ ...proof(held.externalId!, "REFUNDED"), refunds: [{ status: "PENDING", value: 100 }] })), /comprovação/);
  await assert.rejects(reconcileBillingReversal(held.externalId!, async () => ({ ...proof(held.externalId!, "REFUNDED", [{ status: "DONE", value: 100 }]), id: "wrong" })), /divergente/);
  await assert.rejects(reconcileBillingReversal(held.externalId!, async () => { throw new Error("offline-outage"); }), /offline-outage/);
  assert.equal(await balance(), beforeHold);
  console.log("PASS: chargeback hold/release is idempotent; incomplete proof, mismatch and outage cannot mutate balance");

  const [legacy] = await db.insert(payments).values({ workspaceId, userId, planId, externalId: `pay_${randomUUID()}`, amountCents: 10000, method: "credit_card", status: "paid", metadata: { type: "pack", packCredits: 100 } }).returning();
  const review = await reconcileBillingReversal(legacy!.externalId!, async () => proof(legacy!.externalId!, "REFUNDED", [{ status: "DONE", value: 100 }]));
  assert.equal("review" in review ? review.review : null, "LEGACY_CREDIT_GRANT_UNVERIFIED");
  assert.equal(await balance(), beforeHold, "Unverified legacy grants must not debit unrelated credits");
  const [pending] = await db.insert(payments).values({ workspaceId, userId, planId, externalId: `pay_${randomUUID()}`, amountCents: 10000, method: "credit_card", metadata: { type: "pack", packCredits: 100 } }).returning();
  await reconcileBillingReversal(pending!.externalId!, async () => proof(pending!.externalId!, "CHARGEBACK_REQUESTED"));
  await reconcileBillingReversal(pending!.externalId!, async () => proof(pending!.externalId!, "CONFIRMED"));
  const [restored] = await db.select().from(payments).where(eq(payments.id, pending!.id));
  assert.equal(restored!.status, "pending"); assert.equal(await balance(), beforeHold);
  console.log("PASS: legacy grants are flagged for review without guessed debits; chargeback release never grants an unconfirmed pack");

  await db.update(workspacesTable).set({ creditsBalance: -2 * plan.creditsMonthly + 7 }).where(eq(workspacesTable.id, workspaceId));
  await Promise.all(Array.from({ length: 8 }, () => resetMonthlyCredits(workspaceId, logger)));
  assert.equal(await balance(), -plan.creditsMonthly + 7);
  console.log("PASS: monthly renewal repays rather than erases debt and cannot allocate twice concurrently");
} finally { try { await db.delete(usersTable).where(eq(usersTable.id, userId)); } finally { await pool.end(); } }
console.log("PASS: exact owned billing fixtures removed; no provider calls or financial transfers");
