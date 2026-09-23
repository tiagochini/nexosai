import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import {
  cartRecoveryActionsTable, db, lifecycleContactsTable, lifecycleEventsTable,
  productSalesTable, productsTable,
} from "@workspace/db";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";
import {
  findOrCreateLifecycleContact,
  reconcilePendingCartRecoveryActions,
} from "../modules/lifecycle/lifecycle.service.js";

assert.equal(process.env.LIFECYCLE_DB_TESTS, "true", "Set LIFECYCLE_DB_TESTS=true only for a migrated disposable DB.");
assert.equal(process.env.NODE_ENV, "test", "Lifecycle DB tests require NODE_ENV=test.");

const fixtures = await seedE2eFixtures(markerFromSuffix(`lifecycle-reconcile-${process.pid}`));
const workspaceId = fixtures.workspaces[0]!;
const foreignWorkspaceId = fixtures.workspaces[1]!;
const now = new Date();
try {
  const [{ id: productId }, { id: foreignProductId }] = await db.insert(productsTable).values([
    { workspaceId, name: "Reconciliation source", priceCents: 1000 },
    { workspaceId: foreignWorkspaceId, name: "Foreign source", priceCents: 1000 },
  ]).returning({ id: productsTable.id });
  const contact = await findOrCreateLifecycleContact({
    workspaceId, email: `reconcile-${process.pid}@e2e.invalid`, emailConsent: true,
  });
  assert.ok(contact);
  const eligibleContact = await findOrCreateLifecycleContact({
    workspaceId, email: `eligible-reconcile-${process.pid}@e2e.invalid`, emailConsent: true,
  });
  assert.ok(eligibleContact);
  const foreignContact = await findOrCreateLifecycleContact({
    workspaceId: foreignWorkspaceId, email: `foreign-reconcile-${process.pid}@e2e.invalid`, emailConsent: true,
  });
  assert.ok(foreignContact);

  const [paidSale, consentSale, eligibleSale, foreignSale] = await db.insert(productSalesTable).values([
    { workspaceId, productId, buyerName: "Buyer", buyerEmail: contact!.email!, amountCents: 1000, method: "pix", status: "paid", paidAt: now, expiresAt: new Date(now.getTime() - 1000) },
    { workspaceId, productId, buyerName: "Buyer", buyerEmail: contact!.email!, amountCents: 1000, method: "pix", status: "expired", expiresAt: new Date(now.getTime() - 1000) },
    { workspaceId, productId, buyerName: "Eligible", buyerEmail: eligibleContact!.email!, amountCents: 1000, method: "pix", status: "expired", expiresAt: new Date(now.getTime() - 1000) },
    { workspaceId: foreignWorkspaceId, productId: foreignProductId, buyerName: "Foreign", buyerEmail: foreignContact!.email!, amountCents: 1000, method: "pix", status: "paid", paidAt: now, expiresAt: new Date(now.getTime() - 1000) },
  ]).returning();
  const [{ id: paidActionId }, { id: consentActionId }, { id: eligibleActionId }, { id: foreignActionId }] =
    await db.insert(cartRecoveryActionsTable).values([
      { workspaceId, saleId: paidSale!.id, contactId: contact!.id, channel: "email" },
      { workspaceId, saleId: consentSale!.id, contactId: contact!.id, channel: "email" },
      { workspaceId, saleId: eligibleSale!.id, contactId: eligibleContact!.id, channel: "email" },
      { workspaceId: foreignWorkspaceId, saleId: foreignSale!.id, contactId: foreignContact!.id, channel: "email" },
    ]).returning({ id: cartRecoveryActionsTable.id });

  await db.update(lifecycleContactsTable).set({ emailConsent: false }).where(eq(lifecycleContactsTable.id, contact!.id));
  // The eligible action uses the same contact, so restore consent after testing
  // the revocation action below.
  await reconcilePendingCartRecoveryActions(workspaceId, now);
  const first = await db.select().from(cartRecoveryActionsTable).where(and(
    eq(cartRecoveryActionsTable.workspaceId, workspaceId),
    eq(cartRecoveryActionsTable.id, consentActionId!),
  ));
  assert.equal(first[0]!.status, "suppressed");
  assert.equal(first[0]!.reason, "marketing_consent_revoked");

  await db.update(lifecycleContactsTable).set({ emailConsent: true }).where(eq(lifecycleContactsTable.id, contact!.id));
  const [foreignBefore] = await db.select().from(cartRecoveryActionsTable).where(eq(cartRecoveryActionsTable.id, foreignActionId!));
  await Promise.all([
    reconcilePendingCartRecoveryActions(workspaceId, now),
    reconcilePendingCartRecoveryActions(workspaceId, now),
  ]);
  const rows = await db.select().from(cartRecoveryActionsTable).where(eq(cartRecoveryActionsTable.workspaceId, workspaceId));
  assert.equal(rows.find((row) => row.id === paidActionId)!.reason, "payment_confirmed");
  assert.equal(rows.find((row) => row.id === eligibleActionId)!.status, "pending", "eligible intents are never sent or completed");
  const audits = await db.select().from(lifecycleEventsTable).where(and(
    eq(lifecycleEventsTable.workspaceId, workspaceId),
    eq(lifecycleEventsTable.subjectType, "cart_recovery_action"),
  ));
  assert.equal(audits.filter((event) => event.subjectId === paidActionId).length, 1, "CAS winner appends one audit event");
  const [foreignAfter] = await db.select().from(cartRecoveryActionsTable).where(eq(cartRecoveryActionsTable.id, foreignActionId!));
  assert.equal(foreignAfter!.status, foreignBefore!.status, "workspace scope prevents foreign reconciliation");
  console.log("lifecycle reconciliation race/consent/concurrency/isolation tests passed");
} finally {
  await cleanupE2eFixtures(fixtures);
}