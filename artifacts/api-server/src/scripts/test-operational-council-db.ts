/**
 * M10 adversarial integration contract.  This is intentionally a database-only
 * test: the council is allowed to observe realization, never to execute it.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import {
  db, campaignsTable, masterplanVersionsTable, paidMediaProposalsTable,
  paidMediaLaunchPlansTable, realizationContractsTable, realizationAttemptsTable,
  realizationEventsTable, councilCyclesTable, councilMinutesTable,
  councilDecisionsTable, councilActionsTable, councilOutcomesTable,
  commercialProductsTable, commercialSubscriptionsTable, productIntakesTable,
} from "@workspace/db";
import { seedE2eFixtures, cleanupE2eFixtures, markerFromSuffix } from "./e2e-fixtures.js";
import {
  createCycle, appendMinute, createDecision, linkAction, verify, detail,
} from "../modules/operational-council/council.service.js";

if (process.env.NODE_ENV !== "test") throw new Error("Run with NODE_ENV=test");
const marker = markerFromSuffix(`council-${process.pid}`);
const fixtures = await seedE2eFixtures(marker);
const workspaceId = fixtures.workspaces[0]!;
const foreignWorkspaceId = fixtures.workspaces[1]!;
const userId = fixtures.users[0]!;
const foreignUserId = fixtures.users[1]!;
const expectCode = (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (error: any) => error?.code === code);
let campaignId = "", planId = "", cycleId = "", minuteId = "", decisionId = "";
let productId = "", subscriptionId = "", intakeId = "";
let pauseContractId = "", launchContractId = "", pauseActionId = "";
const ids = () => ({ campaignId, planId, cycleId, minuteId, decisionId });

try {
  const [product] = await db.insert(commercialProductsTable).values({
    key: `${marker}:product`, name: marker, masterPlanKey: `${marker}:master`, status: "active",
  }).returning();
  productId = product!.id;
  const [subscription] = await db.insert(commercialSubscriptionsTable).values({
    workspaceId, productId, status: "active", startedAt: new Date(),
  }).returning();
  subscriptionId = subscription!.id;
  const [intake] = await db.insert(productIntakesTable).values({
    workspaceId, commercialProductId: productId, version: 1, status: "approved",
    snapshot: { marker }, entryPoint: "paid_media", createdByUserId: userId,
    approvedByUserId: userId, approvedAt: new Date(),
  }).returning();
  intakeId = intake!.id;
  const [campaign] = await db.insert(campaignsTable).values({
    workspaceId, title: `${marker} campaign`, type: "launch", status: "approved",
    commercialProductId: productId, commercialSubscriptionId: subscriptionId,
    productIntakeVersionId: intakeId,
  }).returning();
  campaignId = campaign!.id;
  const [plan] = await db.insert(masterplanVersionsTable).values({
    workspaceId, campaignId, version: 1, status: "approved",
    snapshot: { marker }, contentHash: `${marker}:hash`,
    contextFingerprint: `${marker}:context`, readinessScore: 100,
    readinessStatus: "ready", approvedByUserId: userId, approvedAt: new Date(),
    createdByUserId: userId, commercialProductId: productId,
    commercialSubscriptionId: subscriptionId, productIntakeVersionId: intakeId,
  }).returning();
  planId = plan!.id;
  // Both artifacts are real paid-media records, not synthetic council evidence.
  await db.insert(paidMediaProposalsTable).values({
    workspaceId, campaignId, masterplanVersionId: planId, provider: "meta_ads",
    accountId: fixtures.accountId, entityId: fixtures.entityId,
    actionType: "pause", status: "approved", idempotencyKey: `${marker}:proposal`,
    recommendation: "pause safely", expiresAt: new Date(Date.now() + 86400000),
  });
  await db.insert(paidMediaLaunchPlansTable).values({
    workspaceId, commercialProductId: productId, commercialSubscriptionId: subscriptionId,
    campaignId, masterplanVersionId: planId,
    contextFingerprint: `${marker}:context`, accountId: fixtures.accountId,
    productIntakeVersionId: intakeId, provider: "meta_ads",
    planHash: `${marker}:launch-plan`, tree: { marker }, launchStage: "approved",
    approvedByUserId: userId, approvedAt: new Date(), createdByUserId: userId,
  });
  const makeContract = async (action: "paid_media_pause" | "paid_media_launch", key: string) => {
    const [row] = await db.insert(realizationContractsTable).values({
      workspaceId, campaignId, masterplanVersionId: planId, action, state: "monitored",
      idempotencyKey: key, bindingHash: `${marker}:binding:${action}`,
      requestFingerprint: `${marker}:request:${action}`, contextFingerprint: `${marker}:context`,
      snapshotHash: `${marker}:hash`, subjectType: "campaign", subjectId: campaignId,
      binding: { marker, action }, createdByUserId: userId,
    }).returning();
    return row!.id;
  };
  pauseContractId = await makeContract("paid_media_pause", `${marker}:pause-contract`);
  launchContractId = await makeContract("paid_media_launch", `${marker}:launch-contract`);
  const cycleInput = {
    campaignId, masterplanVersionId: planId, contextFingerprint: `${marker}:context`,
    snapshotHash: `${marker}:hash`, idempotencyKey: `${marker}:cycle`,
  };
  const cycle = await createCycle(workspaceId, userId, cycleInput);
  cycleId = cycle.id;
  assert.equal((await createCycle(workspaceId, userId, cycleInput)).id, cycleId, "cycle is idempotent");
  const concurrentCycles = await Promise.all([createCycle(workspaceId, userId, { ...cycleInput, idempotencyKey: `${marker}:concurrent-cycle` }), createCycle(workspaceId, userId, { ...cycleInput, idempotencyKey: `${marker}:concurrent-cycle` })]);
  assert.equal(concurrentCycles[0]!.id, concurrentCycles[1]!.id, "concurrent cycle creation is idempotent");
  await expectCode(createCycle(workspaceId, userId, { ...cycleInput, snapshotHash: "wrong" }), "STALE_BINDING");
  await expectCode(createCycle(foreignWorkspaceId, foreignUserId, cycleInput), "STALE_BINDING");
  await expectCode(appendMinute(workspaceId, userId, cycleId, {
    summary: "foreign evidence", evidenceRefs: [{ type: "masterplan", id: randomUUID() }],
  }), "STALE_EVIDENCE");
  await expectCode(appendMinute(workspaceId, userId, cycleId, {
    summary: "too much evidence", evidenceRefs: Array.from({ length: 51 }, () => ({ type: "masterplan", id: planId })),
  }), "INVALID_EVIDENCE");
  const [otherPlan] = await db.insert(masterplanVersionsTable).values({
    workspaceId, campaignId, version: 2, status: "approved", snapshot: { marker, different: true },
    contentHash: `${marker}:other-hash`, contextFingerprint: `${marker}:other-context`,
    readinessScore: 100, readinessStatus: "ready", approvedByUserId: userId, approvedAt: new Date(),
    createdByUserId: userId, commercialProductId: productId,
    commercialSubscriptionId: subscriptionId, productIntakeVersionId: intakeId,
  }).returning();
  await expectCode(appendMinute(workspaceId, userId, cycleId, {
    summary: "different approved plan in same campaign", evidenceRefs: [{ type: "masterplan", id: otherPlan!.id }],
  }), "STALE_EVIDENCE");
  const [otherContract] = await db.insert(realizationContractsTable).values({
    workspaceId, campaignId, masterplanVersionId: otherPlan!.id, action: "paid_media_pause",
    state: "proposal", idempotencyKey: `${marker}:other-contract`,
    bindingHash: `${marker}:other-binding`, requestFingerprint: `${marker}:other-request`,
    contextFingerprint: `${marker}:other-context`, snapshotHash: `${marker}:other-hash`,
    subjectType: "campaign", subjectId: campaignId, binding: { marker }, createdByUserId: userId,
  }).returning();
  await expectCode(appendMinute(workspaceId, userId, cycleId, {
    summary: "different realization binding", evidenceRefs: [{ type: "realization_contract", id: otherContract!.id }],
  }), "STALE_EVIDENCE");
  const minute = await appendMinute(workspaceId, userId, cycleId, {
    summary: "bounded minutes", evidenceRefs: [{ type: "masterplan", id: planId }],
  });
  minuteId = minute.id;
  const decision = await createDecision(workspaceId, userId, cycleId, {
    rationaleSummary: "adversarial decision", target: { metric: "roas", value: 2 },
    baseline: { metric: "roas", value: 1 }, threshold: { operator: ">=", value: 2 },
    window: { unit: "day", count: 7 }, dueAt: new Date(Date.now() + 86400000).toISOString(),
    actionRequired: true, evidenceRefs: [{ type: "masterplan", id: planId }],
  });
  decisionId = decision.id;
  await expectCode(createDecision(workspaceId, userId, cycleId, {
    rationaleSummary: "invalid", target: {}, baseline: {}, threshold: {}, window: {},
    actionRequired: true, evidenceRefs: [],
  }), "INVALID_DECISION");
  const refusal = await createDecision(workspaceId, userId, cycleId, {
    rationaleSummary: "no action", target: { value: 1 }, baseline: { value: 0 },
    threshold: { value: 1 }, window: { days: 1 }, actionRequired: false, evidenceRefs: [],
    dueAt: new Date(Date.now() + 86400000).toISOString(),
  });
  await expectCode(linkAction(workspaceId, refusal.id, {
    family: "paid_media_pause", realizationContractId: pauseContractId, idempotencyKey: `${marker}:refused`,
  }), "ACTION_NOT_REQUIRED");
  const pauseAction = await linkAction(workspaceId, decisionId, {
    family: "paid_media_pause", realizationContractId: pauseContractId, idempotencyKey: `${marker}:pause-action`,
  });
  pauseActionId = pauseAction.id;
  const concurrentActions = await Promise.all([linkAction(workspaceId, decisionId, {
    family: "paid_media_pause", realizationContractId: pauseContractId, idempotencyKey: `${marker}:concurrent-action`,
  }), linkAction(workspaceId, decisionId, {
    family: "paid_media_pause", realizationContractId: pauseContractId, idempotencyKey: `${marker}:concurrent-action`,
  })]);
  assert.equal(concurrentActions[0]!.id, concurrentActions[1]!.id, "concurrent action links are idempotent");
  const launchAction = await linkAction(workspaceId, decisionId, {
    family: "paid_media_launch", realizationContractId: launchContractId, idempotencyKey: `${marker}:launch-action`,
  });
  assert.equal(launchAction.family, "paid_media_launch");
  await expectCode(linkAction(workspaceId, decisionId, {
    family: "unsupported", realizationContractId: pauseContractId, idempotencyKey: `${marker}:bad-family`,
  }), "UNSUPPORTED_ACTION");
  await expectCode(linkAction(foreignWorkspaceId, decisionId, {
    family: "paid_media_pause", realizationContractId: pauseContractId, idempotencyKey: `${marker}:foreign`,
  }), "NOT_FOUND");
  await expectCode(linkAction(workspaceId, decisionId, {
    family: "paid_media_pause", realizationContractId: launchContractId, idempotencyKey: `${marker}:wrong-contract`,
  }), "INVALID_CONTRACT");
  await expectCode(linkAction(workspaceId, decisionId, {
    family: "paid_media_pause", realizationContractId: otherContract!.id, idempotencyKey: `${marker}:wrong-plan-contract`,
  }), "INVALID_CONTRACT");
  await assert.rejects(db.insert(councilActionsTable).values({
    workspaceId, decisionId, family: "unsupported", realizationContractId: pauseContractId,
    idempotencyKey: `${marker}:direct-unsupported`,
  }), "database rejects unsupported action even when bypassing service");
  await assert.rejects(db.insert(councilActionsTable).values({
    workspaceId, decisionId, family: "paid_media_pause", realizationContractId: otherContract!.id,
    idempotencyKey: `${marker}:direct-wrong-plan`,
  }), "database rejects a contract from another exact plan");
  await expectCode(linkAction(workspaceId, decisionId, {
    family: "paid_media_launch", realizationContractId: launchContractId, idempotencyKey: `${marker}:pause-action`,
  }), "IDEMPOTENCY_CONFLICT");
  const nextCycle = await createCycle(workspaceId, userId, { ...cycleInput, idempotencyKey: `${marker}:next-cycle` });
  await expectCode(verify(workspaceId, pauseActionId, { nextCycleId: cycleId }), "INVALID_NEXT_CYCLE");
  await expectCode(verify(workspaceId, pauseActionId, { nextCycleId: nextCycle.id }), "NEXT_CYCLE_MINUTES_REQUIRED");
  await appendMinute(workspaceId, userId, nextCycle.id, {
    summary: "Next operational review of governed actions",
    evidenceRefs: [{ type: "masterplan", id: planId }, { type: "realization_contract", id: pauseContractId }, { type: "realization_contract", id: launchContractId }],
  });
  const [attempt] = await db.insert(realizationAttemptsTable).values({
    workspaceId, contractId: pauseContractId, number: 1, state: "confirmed",
    receipt: { receiptId: `${marker}:receipt`, token: "must-not-leak" },
    readback: { status: "PAUSED" }, qc: { passed: true },
  }).returning();
  await db.insert(realizationEventsTable).values([
    { workspaceId, contractId: pauseContractId, attemptId: attempt!.id, type: "qc", details: { passed: true } },
    { workspaceId, contractId: pauseContractId, attemptId: attempt!.id, type: "monitor", details: { attemptId: attempt!.id } },
  ]);
  const outcomes = await Promise.all([verify(workspaceId, pauseActionId, { nextCycleId: nextCycle.id }), verify(workspaceId, pauseActionId, { nextCycleId: nextCycle.id })]);
  assert.equal(new Set(outcomes.map((outcome) => outcome.id)).size, 1, "verification is exactly once");
  assert.equal(outcomes[0]!.status, "verified");
  assert.deepEqual((outcomes[0]!.verification as any).receipt, true);
  assert.notEqual(JSON.stringify(outcomes[0]), JSON.stringify({ token: "must-not-leak" }), "sanitized");
  const before = await db.select({ state: realizationContractsTable.state }).from(realizationContractsTable).where(eq(realizationContractsTable.id, pauseContractId));
  assert.equal(before[0]!.state, "monitored", "council does not execute contracts");
  assert.equal((await db.select().from(realizationAttemptsTable).where(eq(realizationAttemptsTable.contractId, pauseContractId))).length, 1, "council creates no attempts");
  await db.update(realizationContractsTable).set({ state: "recovery" }).where(eq(realizationContractsTable.id, launchContractId));
  const inconclusive = await verify(workspaceId, launchAction.id, { nextCycleId: nextCycle.id });
  assert.equal(inconclusive.status, "inconclusive", "recovery is inconclusive");
  const [launchAttempt] = await db.insert(realizationAttemptsTable).values({
    workspaceId, contractId: launchContractId, number: 1, state: "confirmed",
    receipt: { receiptId: `${marker}:launch-receipt` }, readback: { status: "ACTIVE" },
  }).returning();
  await db.insert(realizationEventsTable).values([
    { workspaceId, contractId: launchContractId, attemptId: launchAttempt!.id, type: "qc", details: { passed: true } },
    { workspaceId, contractId: launchContractId, attemptId: launchAttempt!.id, type: "monitor", details: { attemptId: launchAttempt!.id } },
  ]);
  await db.update(realizationContractsTable).set({ state: "monitored" }).where(eq(realizationContractsTable.id, launchContractId));
  const reverified = await verify(workspaceId, launchAction.id, { nextCycleId: nextCycle.id });
  assert.equal(reverified.status, "verified", "new evidence can verify a previously inconclusive action");
  assert.notEqual(reverified.id, inconclusive.id, "reverification appends a new outcome");
  assert.equal((await verify(workspaceId, launchAction.id, { nextCycleId: nextCycle.id })).id, reverified.id, "unchanged evidence is idempotent");
  assert.equal(reverified.nextCycleId, nextCycle.id, "outcome is bound to the reviewed next cycle");
  const tenantDetail = await detail(foreignWorkspaceId, cycleId).catch((error: any) => error);
  assert.equal(tenantDetail.code, "NOT_FOUND", "detail is tenant isolated");
  await assert.rejects(db.update(councilMinutesTable).set({ summary: "mutated" }).where(eq(councilMinutesTable.id, minuteId)), "minutes update rejected");
  await assert.rejects(db.delete(councilMinutesTable).where(eq(councilMinutesTable.id, minuteId)), "minutes delete rejected");
  await assert.rejects(db.update(councilDecisionsTable).set({ rationaleSummary: "mutated" }).where(eq(councilDecisionsTable.id, decisionId)), "decision update rejected");
  await assert.rejects(db.delete(councilDecisionsTable).where(eq(councilDecisionsTable.id, decisionId)), "decision delete rejected");
  await assert.rejects(db.update(councilActionsTable).set({ idempotencyKey: "mutated" }).where(eq(councilActionsTable.id, pauseActionId)), "action update rejected");
  await assert.rejects(db.delete(councilActionsTable).where(eq(councilActionsTable.id, pauseActionId)), "action delete rejected");
  await assert.rejects(db.update(councilOutcomesTable).set({ status: "exception" }).where(eq(councilOutcomesTable.id, outcomes[0]!.id)), "outcome update rejected");
  await assert.rejects(db.delete(councilOutcomesTable).where(eq(councilOutcomesTable.id, outcomes[0]!.id)), "outcome delete rejected");
  assert.deepEqual(ids(), { campaignId, planId, cycleId, minuteId, decisionId });
  console.log(`M10 adversarial council DB contract: PASS (${(await detail(workspaceId, cycleId)).outcomes.length} outcomes)`);
} finally {
  // Append-only triggers intentionally reject ordinary cascading cleanup.
  await db.execute(sql`set session_replication_role = 'replica'`);
  try {
    await db.delete(councilOutcomesTable).where(eq(councilOutcomesTable.workspaceId, workspaceId));
    await db.delete(councilActionsTable).where(eq(councilActionsTable.workspaceId, workspaceId));
    await db.delete(councilDecisionsTable).where(eq(councilDecisionsTable.workspaceId, workspaceId));
    await db.delete(councilMinutesTable).where(eq(councilMinutesTable.workspaceId, workspaceId));
    await db.delete(councilCyclesTable).where(eq(councilCyclesTable.workspaceId, workspaceId));
    await db.delete(realizationEventsTable).where(eq(realizationEventsTable.workspaceId, workspaceId));
    await db.delete(realizationAttemptsTable).where(eq(realizationAttemptsTable.workspaceId, workspaceId));
    await db.delete(realizationContractsTable).where(eq(realizationContractsTable.workspaceId, workspaceId));
    if (campaignId) await db.delete(paidMediaLaunchPlansTable).where(eq(paidMediaLaunchPlansTable.campaignId, campaignId));
    if (campaignId) await db.delete(paidMediaProposalsTable).where(eq(paidMediaProposalsTable.campaignId, campaignId));
    if (campaignId) await db.delete(masterplanVersionsTable).where(eq(masterplanVersionsTable.campaignId, campaignId));
    if (campaignId) await db.delete(campaignsTable).where(eq(campaignsTable.id, campaignId));
    if (intakeId) await db.delete(productIntakesTable).where(eq(productIntakesTable.id, intakeId));
    if (subscriptionId) await db.delete(commercialSubscriptionsTable).where(eq(commercialSubscriptionsTable.id, subscriptionId));
    if (productId) await db.delete(commercialProductsTable).where(eq(commercialProductsTable.id, productId));
    await cleanupE2eFixtures(fixtures);
  } finally {
    await db.execute(sql`set session_replication_role = 'origin'`);
    // The pool remains owned by the test runner, as in the other M-series tests.
  }
}