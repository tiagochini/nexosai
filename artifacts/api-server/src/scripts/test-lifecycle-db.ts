import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import {
  buyerOnboardingInstancesTable, cartRecoveryActionsTable, db, lifecycleContactsTable, lifecycleEventsTable,
  productSalesTable, productsTable, purchaserReferralAttributionsTable, purchaserReferralsTable, referralRewardsTable,
  upsellActionsTable, upsellOffersTable,
} from "@workspace/db";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";
import { findOrCreateLifecycleContact, processExpiredCarts, queueEligibleUpsells, recordCheckoutStarted, recordPaidSale, recordRefundedSale, repairProductSaleLifecycle } from "../modules/lifecycle/lifecycle.service.js";

assert.equal(process.env.LIFECYCLE_DB_TESTS, "true", "Set LIFECYCLE_DB_TESTS=true only for a migrated disposable DB.");
assert.equal(process.env.NODE_ENV, "test", "Lifecycle DB tests require NODE_ENV=test.");
const fixtures = await seedE2eFixtures(markerFromSuffix(`lifecycle-${process.pid}`));
const workspaceId = fixtures.workspaces[0]!;
try {
  const [product, target, foreignProduct] = await db.insert(productsTable).values([
    { workspaceId, name: "Lifecycle source", priceCents: 10_000 },
    { workspaceId, name: "Lifecycle upsell", priceCents: 5_000 },
    { workspaceId: fixtures.workspaces[1]!, name: "Foreign lifecycle source", priceCents: 10_000 },
  ]).returning();
  // A status commit can be durable while the projection transaction is lost.
  // Repair is workspace-scoped for callers and remains idempotent under races.
  const [repairSale] = await db.insert(productSalesTable).values({
    workspaceId, productId: product!.id, buyerName: "Repair buyer",
    buyerEmail: `repair-${process.pid}@e2e.invalid`, amountCents: 2_000,
    method: "pix", status: "paid", paidAt: new Date(),
  }).returning();
  const [foreignRepairSale] = await db.insert(productSalesTable).values({
    workspaceId: fixtures.workspaces[1]!, productId: foreignProduct!.id, buyerName: "Foreign repair",
    buyerEmail: `foreign-repair-${process.pid}@e2e.invalid`, amountCents: 2_000,
    method: "pix", status: "paid", paidAt: new Date(),
  }).returning();
  await Promise.all([
    repairProductSaleLifecycle(100, workspaceId),
    repairProductSaleLifecycle(100, workspaceId),
  ]);
  const repairEvents = await db.select().from(lifecycleEventsTable).where(and(
    eq(lifecycleEventsTable.workspaceId, workspaceId),
    eq(lifecycleEventsTable.eventKey, `paid:${repairSale!.id}`),
  ));
  assert.equal(repairEvents.length, 1, "concurrent repair inserts one paid event");
  const repairContact = await findOrCreateLifecycleContact({ workspaceId, email: repairSale!.buyerEmail });
  assert.equal(repairContact!.lifetimeValueCents, 2_000, "repair applies LTV once");
  assert.equal((await db.select().from(buyerOnboardingInstancesTable).where(eq(buyerOnboardingInstancesTable.saleId, repairSale!.id))).length, 1, "repair creates one onboarding instance");
  assert.equal((await db.select().from(lifecycleEventsTable).where(and(
    eq(lifecycleEventsTable.workspaceId, fixtures.workspaces[1]!),
    eq(lifecycleEventsTable.eventKey, `paid:${foreignRepairSale!.id}`),
  ))).length, 0, "fixture scope does not touch foreign projection");
  const [repairOffer] = await db.insert(upsellOffersTable).values({
    workspaceId, productId: product!.id, targetProductId: target!.id, approved: true, minimumActivationHours: 8760,
  }).returning();
  await db.insert(upsellActionsTable).values({
    workspaceId, offerId: repairOffer!.id, contactId: repairContact!.id, sourceSaleId: repairSale!.id,
  });
  const [refundedRepair] = await db.update(productSalesTable).set({ status: "refunded", updatedAt: new Date() })
    .where(and(eq(productSalesTable.id, repairSale!.id), eq(productSalesTable.status, "paid"))).returning();
  assert.ok(refundedRepair);
  await recordPaidSale(repairSale!); // stale paid snapshot must not resurrect projection
  await Promise.all([
    repairProductSaleLifecycle(100, workspaceId),
    repairProductSaleLifecycle(100, workspaceId),
  ]);
  assert.equal((await db.select().from(lifecycleEventsTable).where(eq(lifecycleEventsTable.eventKey, `refunded:${repairSale!.id}`))).length, 1, "concurrent refund repair inserts one event");
  const repairedAfterRefund = await findOrCreateLifecycleContact({ workspaceId, email: repairSale!.buyerEmail });
  assert.equal(repairedAfterRefund!.lifetimeValueCents, 0, "refund repair reverses repaired LTV once");
  assert.equal((await db.select().from(buyerOnboardingInstancesTable).where(and(eq(buyerOnboardingInstancesTable.saleId, repairSale!.id), eq(buyerOnboardingInstancesTable.status, "suppressed")))).length, 1, "refund suppresses pending onboarding");
  assert.equal((await db.select().from(upsellActionsTable).where(and(eq(upsellActionsTable.sourceSaleId, repairSale!.id), eq(upsellActionsTable.status, "suppressed")))).length, 1, "refund suppresses pending upsell");
  const referrer = await findOrCreateLifecycleContact({ workspaceId, email: `referrer-${process.pid}@e2e.invalid`, name: "Referrer" });
  assert.ok(referrer);
  await db.update(lifecycleContactsTable).set({ stage: "customer" }).where(eq(lifecycleContactsTable.id, referrer!.id));
  const [referral] = await db.insert(purchaserReferralsTable).values({ workspaceId, referrerContactId: referrer!.id, code: "LIFECYCLE-REF" }).returning();
  const [sale] = await db.insert(productSalesTable).values({
    workspaceId, productId: product!.id, buyerName: "Buyer", buyerEmail: `buyer-${process.pid}@e2e.invalid`,
    amountCents: 10_000, method: "pix", status: "pending", expiresAt: new Date(Date.now() - 1000),
    metadata: { purchaserReferralCode: referral!.code },
  }).returning();
  await recordCheckoutStarted(sale!);
  await recordCheckoutStarted(sale!);
  assert.equal((await db.select().from(lifecycleEventsTable).where(and(eq(lifecycleEventsTable.workspaceId, workspaceId), eq(lifecycleEventsTable.eventKey, `checkout_started:${sale!.id}`)))).length, 1, "checkout ledger dedupes");
  await processExpiredCarts();
  assert.equal((await db.select().from(productSalesTable).where(eq(productSalesTable.id, sale!.id)))[0]!.status, "expired");
  const expiredActions = await db.select().from(cartRecoveryActionsTable).where(eq(cartRecoveryActionsTable.saleId, sale!.id));
  assert.equal(expiredActions[0]!.status, "suppressed", "no consent never fabricates dispatch");
  const [paid] = await db.update(productSalesTable).set({ status: "paid", paidAt: new Date() }).where(eq(productSalesTable.id, sale!.id)).returning();
  await recordPaidSale(paid!); await recordPaidSale(paid!);
  const buyer = await findOrCreateLifecycleContact({ workspaceId, email: sale!.buyerEmail });
  assert.equal(buyer!.lifetimeValueCents, 10_000, "paid ledger adjusts LTV once");
  assert.equal((await db.select().from(buyerOnboardingInstancesTable).where(eq(buyerOnboardingInstancesTable.saleId, sale!.id))).length, 1, "onboarding idempotent");
  assert.equal((await db.select().from(purchaserReferralAttributionsTable).where(eq(purchaserReferralAttributionsTable.saleId, sale!.id))).length, 1, "non-self referral attributed");
  assert.equal((await db.select().from(referralRewardsTable).where(eq(referralRewardsTable.workspaceId, workspaceId)))[0]!.status, "pending");
  const [selfSale] = await db.insert(productSalesTable).values({ workspaceId, productId: product!.id, buyerName: "Referrer", buyerEmail: referrer!.email!, amountCents: 10_000, method: "pix", status: "paid", paidAt: new Date(), metadata: { purchaserReferralCode: referral!.code } }).returning();
  await recordPaidSale(selfSale!);
  assert.equal((await db.select().from(purchaserReferralAttributionsTable).where(eq(purchaserReferralAttributionsTable.workspaceId, workspaceId))).length, 1, "self referral is rejected");
  const [offer] = await db.insert(upsellOffersTable).values({ workspaceId, productId: product!.id, targetProductId: target!.id, approved: true, minimumActivationHours: 1 }).returning();
  await db.update(buyerOnboardingInstancesTable).set({ status: "completed", activatedAt: new Date() }).where(eq(buyerOnboardingInstancesTable.saleId, sale!.id));
  assert.equal(await queueEligibleUpsells(sale!.id, workspaceId), 0, "timing suppresses upsell");
  await db.update(upsellOffersTable).set({ minimumActivationHours: 0 }).where(eq(upsellOffersTable.id, offer!.id));
  await queueEligibleUpsells(sale!.id, workspaceId); await queueEligibleUpsells(sale!.id, workspaceId);
  assert.equal((await db.select().from(upsellActionsTable).where(eq(upsellActionsTable.offerId, offer!.id))).length, 1, "approved upsell action dedupes");
  const [refunded] = await db.update(productSalesTable).set({ status: "refunded", updatedAt: new Date() })
    .where(and(eq(productSalesTable.id, sale!.id), eq(productSalesTable.status, "paid"))).returning();
  assert.ok(refunded, "refund test must win the authoritative sale CAS");
  await recordRefundedSale(refunded!);
  const afterRefund = await findOrCreateLifecycleContact({ workspaceId, email: sale!.buyerEmail });
  assert.equal(afterRefund!.lifetimeValueCents, 0, "refund reverses LTV");
  assert.equal((await db.select().from(referralRewardsTable).where(eq(referralRewardsTable.workspaceId, workspaceId)))[0]!.status, "reversed", "refund reverses pending reward");
  console.log("lifecycle DB dedupe/race/onboarding/LTV/upsell/referral tests passed");
} finally {
  await cleanupE2eFixtures(fixtures);
}