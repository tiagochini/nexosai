import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import {
  auditLogsTable, campaignsTable, commercialProductsTable, commercialSubscriptionsTable,
  db, plansTable, pool, productIntakesTable, usersTable, workspacesTable,
} from "@workspace/db";
import { AppError } from "../lib/errors.js";
import { adoptCampaignBriefingToProduct, getCampaignBriefingAdoptionOptions } from "../modules/product-intake/product-intake.service.js";
import { assertIsolationTestDatabase } from "./helpers/test-database-target.js";

await assertIsolationTestDatabase(pool);
const marker = `${process.pid}-${Date.now()}`;
const ids = { user: "", workspace: "", campaign: "", incompleteCampaign: "", mismatchCampaign: "", product: "", otherProduct: "", subscription: "", otherSubscription: "" };

try {
  const [plan] = await db.select().from(plansTable).limit(1);
  assert.ok(plan, "a plan is required for isolated fixtures");
  const [user] = await db.insert(usersTable).values({
    email: `briefing-adoption-${marker}@example.invalid`, name: "Briefing adoption fixture", passwordHash: "inert",
  }).returning();
  ids.user = user!.id;
  const [workspace] = await db.insert(workspacesTable).values({
    ownerId: user!.id, planId: plan!.id, name: `Briefing adoption ${marker}`, slug: `briefing-adoption-${marker}`,
  }).returning();
  ids.workspace = workspace!.id;
  const [product, otherProduct] = await db.insert(commercialProductsTable).values([
    { key: `briefing-adoption-${marker}`, name: "Curso de Lançamento", masterPlanKey: "launch", status: "active" },
    { key: `briefing-adoption-other-${marker}`, name: "Outro produto", masterPlanKey: "launch", status: "active" },
  ]).returning();
  ids.product = product!.id;
  ids.otherProduct = otherProduct!.id;
  const [subscription, otherSubscription] = await db.insert(commercialSubscriptionsTable).values([
    { workspaceId: workspace!.id, productId: product!.id, status: "active", startedAt: new Date() },
    { workspaceId: workspace!.id, productId: otherProduct!.id, status: "active", startedAt: new Date() },
  ]).returning();
  ids.subscription = subscription!.id;
  ids.otherSubscription = otherSubscription!.id;

  const briefing = {
    "product.name": "Curso de Lancamento",
    "audience.pain": "Não consegue executar o que aprende",
    "product.price": 997,
    _conversationHistory: [{ role: "user", content: "contexto preservado" }],
  };
  const [campaign] = await db.insert(campaignsTable).values({
    workspaceId: workspace!.id, title: `Legacy ${marker}`, status: "strategy_ready", intakeData: briefing,
  }).returning();
  ids.campaign = campaign!.id;
  const [incomplete] = await db.insert(campaignsTable).values({
    workspaceId: workspace!.id, title: `Incomplete ${marker}`, status: "intake", intakeData: { "product.name": "Curso" },
  }).returning();
  ids.incompleteCampaign = incomplete!.id;
  const [mismatch] = await db.insert(campaignsTable).values({
    workspaceId: workspace!.id, title: `Mismatch ${marker}`, status: "strategy_ready", commercialProductId: otherProduct!.id, intakeData: briefing,
  }).returning();
  ids.mismatchCampaign = mismatch!.id;

  const options = await getCampaignBriefingAdoptionOptions(workspace!.id, campaign!.id);
  assert.equal(options.briefingAnswerCount, 3);
  assert.equal(options.briefingProductName, "Curso de Lancamento");
  assert.equal(options.candidates.length, 2);
  assert.equal(options.candidates.find((candidate) => candidate.subscriptionId === subscription!.id)?.suggested, true, "accent-insensitive product match should be suggested");

  await assert.rejects(
    adoptCampaignBriefingToProduct(workspace!.id, incomplete!.id, subscription!.id, user!.id),
    (error: unknown) => error instanceof AppError && error.code === "CAMPAIGN_BRIEFING_INCOMPLETE",
  );
  await assert.rejects(
    adoptCampaignBriefingToProduct(workspace!.id, mismatch!.id, subscription!.id, user!.id),
    (error: unknown) => error instanceof AppError && error.code === "CAMPAIGN_PRODUCT_MISMATCH",
  );

  const adopted = await adoptCampaignBriefingToProduct(workspace!.id, campaign!.id, subscription!.id, user!.id);
  assert.equal(adopted.productId, product!.id);
  assert.equal(adopted.subscriptionId, subscription!.id);
  assert.equal(adopted.intakeStatus, "approved");
  const [savedCampaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, campaign!.id)).limit(1);
  assert.equal(savedCampaign!.commercialProductId, product!.id);
  assert.equal(savedCampaign!.commercialSubscriptionId, subscription!.id);
  assert.equal(savedCampaign!.productIntakeVersionId, adopted.intakeId);
  const [intake] = await db.select().from(productIntakesTable).where(eq(productIntakesTable.id, adopted.intakeId)).limit(1);
  assert.equal(intake!.status, "approved");
  assert.deepEqual(intake!.snapshot, briefing, "adoption preserves the saved briefing fields and conversation context");
  assert.ok((await db.select().from(auditLogsTable).where(and(
    eq(auditLogsTable.workspaceId, workspace!.id), eq(auditLogsTable.action, "campaign.briefing_adopted_as_product_intake"),
  ))).length > 0);

  console.log("PASS briefing adoption: suggested matching product, rejects incomplete/mismatched selection, preserves snapshot, approves canonical intake and records campaign binding/audit");
} finally {
  if (ids.workspace) {
    await db.delete(auditLogsTable).where(eq(auditLogsTable.workspaceId, ids.workspace));
    await db.update(campaignsTable).set({ productIntakeVersionId: null }).where(eq(campaignsTable.workspaceId, ids.workspace));
    await db.delete(productIntakesTable).where(eq(productIntakesTable.workspaceId, ids.workspace));
    await db.delete(campaignsTable).where(eq(campaignsTable.workspaceId, ids.workspace));
    await db.delete(commercialSubscriptionsTable).where(eq(commercialSubscriptionsTable.workspaceId, ids.workspace));
    await db.delete(workspacesTable).where(eq(workspacesTable.id, ids.workspace));
  }
  if (ids.product) await db.delete(commercialProductsTable).where(eq(commercialProductsTable.id, ids.product));
  if (ids.otherProduct) await db.delete(commercialProductsTable).where(eq(commercialProductsTable.id, ids.otherProduct));
  if (ids.user) await db.delete(usersTable).where(eq(usersTable.id, ids.user));
  await pool.end();
}
