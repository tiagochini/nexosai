/**
 * M09 no-network database contract test.  Every provider operation below is a
 * local adapter call; credentials and HTTP clients are deliberately absent.
 */
import assert from "node:assert/strict";
import { and, eq, sql } from "drizzle-orm";
import {
  db, campaignsTable, masterplanVersionsTable, realizationContractsTable,
  realizationAttemptsTable, realizationEventsTable, executionEvidenceTable,
  paidMediaProposalsTable, paidMediaLaunchPlansTable, commercialProductsTable,
  commercialSubscriptionsTable, productIntakesTable,
} from "@workspace/db";
import { seedE2eFixtures, cleanupE2eFixtures, markerFromSuffix } from "./e2e-fixtures.js";
import {
  setRealizationTestAdapter, createRealizationContract, preflightRealization,
  executeRealization, qcRealization, monitorRealization, retryRealization,
  compensateRealization, getRealizationContract,
} from "../modules/realization/realization.service.js";

if (process.env.NODE_ENV !== "test") throw new Error("Run with NODE_ENV=test");
const marker = markerFromSuffix(`realization-${process.pid}`);
const fixtures = await seedE2eFixtures(marker);
const workspaceId = fixtures.workspaces[0]!;
const userId = fixtures.users[0]!;
const expectCode = (p: Promise<unknown>, code: string) => assert.rejects(p, (e: any) => e?.code === code);
let campaignId = "", planId = "", productId = "", subscriptionId = "", intakeId = "";
const contracts: string[] = [];
let applyCalls = 0, mode: "ok" | "blocked" | "mismatch" | "fail" = "ok";
let release!: () => void;
let started!: () => void;
const gate = new Promise<void>(r => { release = r; });
const startedGate = new Promise<void>(r => { started = r; });

const adapter = {
  preflight: async () => mode === "blocked" ? { eligible: false, blockers: ["fixture_blocked"] } : { eligible: true, blockers: [] },
  executeOrReconcile: async ({ readbackOnly }: { readbackOnly: boolean }) => {
    if (!readbackOnly) { applyCalls++; started(); await gate; }
    if (mode === "fail") return { retryable: true };
    if (mode === "mismatch") return { receipt: { id: "receipt", token: "secret" }, readback: undefined, ambiguous: true };
    return { receipt: { id: "receipt", nested: { cookie: "secret", harmlessKey: "safe" } }, readback: { status: "PAUSED", token: "secret" } };
  },
  qc: async () => ({ passed: mode !== "mismatch", report: { type: mode === "mismatch" ? "qc_failure" : "qc_pass" } }),
  monitor: async () => ({ state: mode === "mismatch" ? "recovery" as const : "monitored" as const, evidence: { observed: mode } }),
  compensate: async ({ binding }: { binding: any }) => ({ compensated: binding.action === "paid_media_launch", evidence: { fixture: true } }),
};

async function contract(action: "paid_media_pause" | "paid_media_launch", key: string, maxAttempts = 3) {
  const target = action === "paid_media_pause"
    ? { provider: "meta_ads", accountId: fixtures.accountId, entityId: fixtures.entityId, actionType: "pause", requestedChange: {} }
    : { provider: "meta_ads", accountId: fixtures.accountId, planHash: `${marker}:launch`, providerPayload: {} };
  const row = await createRealizationContract(workspaceId, userId, {
    action, campaignId, masterplanVersionId: planId,
    subjectId: action === "paid_media_pause" ? pauseId : launchId,
    contextFingerprint: `${marker}:context`, snapshotHash: `${marker}:content`,
    idempotencyKey: key, maxAttempts, target,
  });
  contracts.push(row.id);
  return row;
}
let pauseId = "", launchId = "";

try {
  const [product] = await db.insert(commercialProductsTable).values({ key: `${marker}:product`, name: marker, masterPlanKey: `${marker}:master`, status: "active" }).returning();
  productId = product!.id;
  const [subscription] = await db.insert(commercialSubscriptionsTable).values({ workspaceId, productId, status: "active", startedAt: new Date() }).returning();
  subscriptionId = subscription!.id;
  const [intake] = await db.insert(productIntakesTable).values({ workspaceId, commercialProductId: productId, version: 1, status: "approved", snapshot: { marker }, entryPoint: "paid_media", createdByUserId: userId, approvedByUserId: userId, approvedAt: new Date() }).returning();
  intakeId = intake!.id;
  const [campaign] = await db.insert(campaignsTable).values({ workspaceId, title: marker, status: "approved", commercialProductId: productId, commercialSubscriptionId: subscriptionId, productIntakeVersionId: intakeId, intakeData: { marker } }).returning();
  campaignId = campaign!.id;
  const [plan] = await db.insert(masterplanVersionsTable).values({ workspaceId, campaignId, version: 1, status: "approved", snapshot: { marker }, contentHash: `${marker}:content`, contextFingerprint: `${marker}:context`, readinessScore: 100, readinessStatus: "ready", readinessBlockers: [], autonomyContract: {}, allowedActions: ["paid_media_pause", "paid_media_launch"], requiredApprovals: [], commercialProductId: productId, commercialSubscriptionId: subscriptionId, productIntakeVersionId: intakeId }).returning();
  planId = plan!.id;
  const common = { workspaceId, campaignId, masterplanVersionId: planId, contextFingerprint: `${marker}:context`, provider: "meta_ads" as const, accountId: fixtures.accountId, entityId: fixtures.entityId, recommendation: marker, expiresAt: new Date(Date.now() + 86400000), requestedChange: {} };
  const [proposal] = await db.insert(paidMediaProposalsTable).values({ ...common, actionType: "pause", status: "approved", idempotencyKey: `${marker}:proposal` }).returning();
  pauseId = proposal!.id;
  const [launch] = await db.insert(paidMediaLaunchPlansTable).values({ workspaceId, commercialProductId: productId, commercialSubscriptionId: subscriptionId, campaignId, masterplanVersionId: planId, contextFingerprint: `${marker}:context`, accountId: fixtures.accountId, productIntakeVersionId: intakeId, provider: "meta_ads", launchStage: "approved", planHash: `${marker}:launch`, tree: {}, providerPayload: {}, readiness: {}, approvedByUserId: userId, approvedAt: new Date(), createdByUserId: userId }).returning();
  launchId = launch!.id;
  setRealizationTestAdapter("paid_media_pause", adapter);
  setRealizationTestAdapter("paid_media_launch", adapter);

  const pause = await contract("paid_media_pause", `${marker}:idempotent`, 3);
  assert.equal((await contract("paid_media_pause", `${marker}:idempotent`)).id, pause.id);
  await expectCode(contract("paid_media_pause", `${marker}:idempotent`, 2), "IDEMPOTENCY_CONFLICT");
  await expectCode(createRealizationContract(workspaceId, userId, {
    action: "paid_media_pause", campaignId, masterplanVersionId: planId, subjectId: pauseId,
    contextFingerprint: `${marker}:context`, snapshotHash: `${marker}:content`,
    idempotencyKey: `${marker}:forged-target`, target: { provider: "evil", entityId: "forged" },
  }), "STALE_BINDING");
  await expectCode(createRealizationContract(workspaceId, userId, { action: "paid_media_pause", campaignId, masterplanVersionId: planId, subjectId: pauseId, contextFingerprint: "stale", snapshotHash: `${marker}:content`, idempotencyKey: `${marker}:stale` }), "STALE_BINDING");
  await expectCode(createRealizationContract(fixtures.workspaces[1]!, fixtures.users[1]!, { action: "paid_media_pause", campaignId, masterplanVersionId: planId, subjectId: pauseId, contextFingerprint: `${marker}:context`, snapshotHash: `${marker}:content`, idempotencyKey: `${marker}:foreign` }), "STALE_BINDING");
  assert.equal((await preflightRealization(workspaceId, pause.id)).state, "preflight");

  const blocked = await contract("paid_media_pause", `${marker}:blocked`);
  mode = "blocked"; assert.equal((await preflightRealization(workspaceId, blocked.id)).state, "blocked"); mode = "ok";
  const launchContract = await contract("paid_media_launch", `${marker}:launch`);
  assert.equal((await preflightRealization(workspaceId, launchContract.id)).state, "preflight");
  const race = await contract("paid_media_pause", `${marker}:race`);
  await preflightRealization(workspaceId, race.id);
  const first = executeRealization(workspaceId, race.id); await startedGate;
  const second = executeRealization(workspaceId, race.id); await new Promise(r => setTimeout(r, 20));
  assert.equal(applyCalls, 1); release(); const results = await Promise.all([first, second]); assert.ok(results.some(r => r.readbackOnly));
  const read = await getRealizationContract(workspaceId, race.id);
  assert.equal(read.attempts.length, 1); assert.doesNotMatch(JSON.stringify(read), /secret/); assert.match(JSON.stringify(read), /PAUSED/);
  await qcRealization(workspaceId, race.id); await monitorRealization(workspaceId, race.id);

  const failed = await contract("paid_media_pause", `${marker}:qc-fail`);
  await preflightRealization(workspaceId, failed.id); mode = "mismatch"; await executeRealization(workspaceId, failed.id).catch(() => {}); await assert.rejects(qcRealization(workspaceId, failed.id)); mode = "ok";
  const retry = await contract("paid_media_pause", `${marker}:retry`, 1); await preflightRealization(workspaceId, retry.id); mode = "fail"; await assert.rejects(executeRealization(workspaceId, retry.id)); mode = "ok"; await expectCode(retryRealization(workspaceId, retry.id), "RETRY_EXHAUSTED");
  const pauseRecovery = await contract("paid_media_pause", `${marker}:compensate`); await preflightRealization(workspaceId, pauseRecovery.id); mode = "mismatch"; await executeRealization(workspaceId, pauseRecovery.id).catch(() => {}); await compensateRealization(workspaceId, pauseRecovery.id).catch(() => {}); mode = "ok";
  const launchComp = await contract("paid_media_launch", `${marker}:launch-comp`); await preflightRealization(workspaceId, launchComp.id); const launchResult = await executeRealization(workspaceId, launchComp.id); assert.equal(launchResult.state, "provider_confirmed");
  assert.ok((await db.select().from(executionEvidenceTable).where(eq(executionEvidenceTable.workspaceId, workspaceId))).length >= 5);
  const [event] = await db.select().from(realizationEventsTable).where(eq(realizationEventsTable.contractId, race.id)).limit(1);
  await assert.rejects(db.update(realizationEventsTable).set({ details: { changed: true } }).where(eq(realizationEventsTable.id, event!.id)));
  await assert.rejects(db.update(realizationContractsTable).set({ binding: { changed: true } }).where(eq(realizationContractsTable.id, race.id)));
  console.log("realization contract M09 adversarial DB tests passed");
} finally {
  setRealizationTestAdapter("paid_media_pause"); setRealizationTestAdapter("paid_media_launch");
  await db.transaction(async tx => {
    await tx.execute(sql`set local session_replication_role = replica`);
    await tx.delete(realizationEventsTable).where(eq(realizationEventsTable.workspaceId, workspaceId));
    await tx.delete(executionEvidenceTable).where(eq(executionEvidenceTable.workspaceId, workspaceId));
    await tx.delete(realizationAttemptsTable).where(eq(realizationAttemptsTable.workspaceId, workspaceId));
    await tx.delete(realizationContractsTable).where(eq(realizationContractsTable.workspaceId, workspaceId));
    if (launchId) await tx.delete(paidMediaLaunchPlansTable).where(eq(paidMediaLaunchPlansTable.id, launchId));
    if (campaignId) await tx.delete(campaignsTable).where(eq(campaignsTable.id, campaignId));
    if (intakeId) await tx.delete(productIntakesTable).where(eq(productIntakesTable.id, intakeId));
    if (subscriptionId) await tx.delete(commercialSubscriptionsTable).where(eq(commercialSubscriptionsTable.id, subscriptionId));
    if (productId) await tx.delete(commercialProductsTable).where(eq(commercialProductsTable.id, productId));
  });
  await cleanupE2eFixtures(fixtures);
}