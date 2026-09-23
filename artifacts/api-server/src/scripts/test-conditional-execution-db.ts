/**
 * M08 is deliberately a database test, rather than a unit test of the tick
 * loop.  The provider below is a network tripwire: a successful test can only
 * have changed the fake provider.
 */
import assert from "node:assert/strict";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  db, campaignsTable, masterplanVersionsTable, paidMediaProposalsTable,
  conditionalExecutionPoliciesTable, conditionalExecutionPolicyActionsTable,
  conditionalExecutionPolicyEventsTable,
  conditionalExecutionIntentsTable, conditionalExecutionAttemptsTable,
  conditionalExecutionEventsTable, executionEvidenceTable, mandatoryPausesTable,
  workspaceIntegrationsTable, paidMediaAccountsTable, paidMediaEntitiesTable,
  approvalDecisionsTable,
} from "@workspace/db";
import { approvalSnapshotHash } from "../modules/approval-center/approval-center.service.js";
import { createExecutionPolicy, getConditionalExecutions, preflightConditionalExecution, conditionalExecutionTick, executeConditionalIntent, revokeExecutionPolicy } from "../modules/paid-media/conditional-execution.service.js";
import type { PaidMediaProviderAdapter, ProviderAction } from "../modules/paid-media/providers.js";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";

if (process.env.NODE_ENV !== "test") throw new Error("Run with NODE_ENV=test");
const marker = markerFromSuffix(`conditional-execution-${process.pid}`);
const fixtures = await seedE2eFixtures(marker);
const workspaceId = fixtures.workspaces[0]!;
const foreignWorkspaceId = fixtures.workspaces[1]!;
const owner = fixtures.users[0]!;
const foreignOwner = fixtures.users[1]!;
let campaignId = "";
let crossCampaignId = "";
let planId = "";
const expectCode = async (work: Promise<unknown>, code: string) =>
  assert.rejects(work, (error: any) => error?.code === code);

let applyCalls = 0;
let verifyCalls = 0;
let verifyMode: "ok" | "mismatch" | "throw" = "ok";
const fakeAdapter = {
  async getEntitySnapshot() { return { providerEntityId: "fake", entityType: "campaign", data: { status: "ACTIVE" } }; },
  async applyAction(_workspace: string, _account: string, action: ProviderAction) {
    assert.equal(action.type, "pause"); applyCalls++;
    if (verifyMode === "throw") throw new Error("provider tripwire");
    return { providerRequestId: "fake-receipt", evidence: { status: "PAUSED", token: "must-not-be-exposed" } };
  },
  async verifyAction() {
    verifyCalls++;
    if (verifyMode === "throw") throw new Error("readback tripwire");
    return { verified: verifyMode === "ok", evidence: { status: verifyMode === "ok" ? "PAUSED" : "ACTIVE" } };
  },
  async rollbackAction() { throw new Error("rollback is not part of M08"); },
} as unknown as PaidMediaProviderAdapter;

try {
  const [campaign] = await db.insert(campaignsTable).values({
    workspaceId, title: `${marker} campaign`, status: "approved", intakeData: { marker },
  }).returning({ id: campaignsTable.id });
  campaignId = campaign!.id;
  const [plan] = await db.insert(masterplanVersionsTable).values({
    workspaceId, campaignId, version: 8, status: "approved", snapshot: { marker, objective: "safe pause" },
    contentHash: `${marker}:content`, contextFingerprint: `${marker}:context`,
    readinessScore: 100, readinessStatus: "ready", readinessBlockers: [], autonomyContract: {},
    allowedActions: ["paid_media_pause"], requiredApprovals: [],
  }).returning();
  planId = plan!.id;
  const snapshotHash = approvalSnapshotHash({
    subjectType: "masterplan", id: plan!.id, campaignId, workspaceId, version: plan!.version,
    status: plan!.status, snapshot: plan!.snapshot, contentHash: plan!.contentHash,
    contextFingerprint: plan!.contextFingerprint, readinessScore: plan!.readinessScore,
    readinessStatus: plan!.readinessStatus, readinessBlockers: plan!.readinessBlockers,
    autonomyContract: plan!.autonomyContract, allowedActions: plan!.allowedActions,
    requiredApprovals: plan!.requiredApprovals,
  });
  // Approval evidence is a real row and binds the exact hash/context used below.
  await db.insert(approvalDecisionsTable).values({
    workspaceId, campaignId, subjectType: "masterplan", subjectId: plan!.id,
    decision: "approved", actorUserId: owner, expectedSnapshotHash: snapshotHash,
    resolvedSnapshotHash: snapshotHash, idempotencyKey: `${marker}:approval`,
    commandFingerprint: `${marker}:approval-command`, masterplanVersionId: plan!.id,
    subjectVersion: 8, contextFingerprint: plan!.contextFingerprint,
  });

  const account = fixtures.accountId;
  const entity = fixtures.entityId;
  const [accountRow] = await db.select().from(paidMediaAccountsTable).where(and(eq(paidMediaAccountsTable.id, account), eq(paidMediaAccountsTable.workspaceId, workspaceId))).limit(1);
  assert.ok(accountRow?.integrationId);
  await db.update(workspaceIntegrationsTable).set({
    status: "connected",
    blocksExecution: false,
    tokenExpiresAt: new Date(Date.now() + 86_400_000),
  }).where(and(eq(workspaceIntegrationsTable.id, accountRow!.integrationId), eq(workspaceIntegrationsTable.workspaceId, workspaceId)));
  const [pauseProposal] = await db.insert(paidMediaProposalsTable).values({
    workspaceId, campaignId, masterplanVersionId: plan!.id, contextFingerprint: plan!.contextFingerprint,
    accountId: account, entityId: entity, provider: "meta_ads", actionType: "pause", status: "approved",
    idempotencyKey: `${marker}:pause`, recommendation: "pause", requestedChange: { reason: "fixture" },
    expiresAt: new Date(Date.now() + 86_400_000),
  }).returning();
  assert.ok(pauseProposal);

  const base = {
    enabled: false, masterplanVersionId: plan!.id, snapshotHash, contextFingerprint: plan!.contextFingerprint,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    action: { actionType: "paid_media_pause", provider: "meta_ads", accountId: account, entityId: entity, maxActionsPerDay: 2 },
  };
  const disabled = await createExecutionPolicy(workspaceId, owner, campaignId, { ...base, idempotencyKey: `${marker}:disabled` });
  assert.equal(await conditionalExecutionTick(fakeAdapter), 0);
  assert.equal(applyCalls, 0);
  assert.equal((await db.select().from(conditionalExecutionIntentsTable).where(eq(conditionalExecutionIntentsTable.workspaceId, workspaceId))).length, 0);

  await expectCode(createExecutionPolicy(workspaceId, owner, campaignId, {
    ...base, enabled: true, idempotencyKey: `${marker}:disabled`, action: { ...base.action, maxActionsPerDay: 1 },
  }), "IDEMPOTENCY_CONFLICT");
  await expectCode(createExecutionPolicy(workspaceId, foreignOwner, campaignId, { ...base, enabled: true, idempotencyKey: `${marker}:owner` }), "OWNER_AUTHORIZATION_REQUIRED");
  await expectCode(createExecutionPolicy(workspaceId, owner, campaignId, { ...base, enabled: true, snapshotHash: "stale", idempotencyKey: `${marker}:stale` }), "STALE_SNAPSHOT_HASH");
  await expectCode(createExecutionPolicy(workspaceId, owner, campaignId, { ...base, enabled: true, action: { ...base.action, actionType: "resume" }, idempotencyKey: `${marker}:unsupported` }), "UNSUPPORTED_ACTION");
  await expectCode(createExecutionPolicy(foreignWorkspaceId, foreignOwner, campaignId, { ...base, enabled: true, idempotencyKey: `${marker}:tenant` }), "CAMPAIGN_NOT_FOUND");

  const enabled = await createExecutionPolicy(workspaceId, owner, campaignId, { ...base, enabled: true, idempotencyKey: `${marker}:enabled` });
  const preflight = await preflightConditionalExecution(workspaceId, enabled.policy.id, enabled.action.id, pauseProposal.id);
  assert.equal(preflight.eligible, true, `expected eligible preflight; code=${"code" in preflight ? preflight.code : "none"}`);
  const [intent] = await db.select().from(conditionalExecutionIntentsTable).where(eq(conditionalExecutionIntentsTable.workspaceId, workspaceId));
  assert.equal(intent, undefined);
  const [tickA, tickB] = await Promise.all([conditionalExecutionTick(fakeAdapter), conditionalExecutionTick(fakeAdapter)]);
  assert.ok(tickA >= 1 && tickB >= 0);
  assert.equal(applyCalls, 1);
  assert.ok(verifyCalls >= 1);
  const intents = await db.select().from(conditionalExecutionIntentsTable).where(eq(conditionalExecutionIntentsTable.policyId, enabled.policy.id));
  assert.equal(intents.length, 1);
  assert.equal(intents[0]!.status, "confirmed");
  assert.equal((await db.select().from(conditionalExecutionAttemptsTable).where(eq(conditionalExecutionAttemptsTable.intentId, intents[0]!.id))).length, 1);

  const apiRead = await getConditionalExecutions(workspaceId, campaignId);
  assert.equal(apiRead.counts.confirmed, 1);
  const policyPayload = apiRead.policy as { expiresAt?: unknown };
  assert.equal(typeof policyPayload.expiresAt, "string");
  assert.ok(Number.isFinite(new Date(policyPayload.expiresAt as string).getTime()));
  assert.ok(JSON.stringify(apiRead).length < 192_000);
  assert.doesNotMatch(JSON.stringify(apiRead), /must-not-be-exposed/);
  assert.ok(apiRead.approvedBinding);
  const bindingReplay = await createExecutionPolicy(workspaceId, owner, campaignId, {
    ...base, enabled: true, idempotencyKey: `${marker}:binding-replay`,
    masterplanVersionId: apiRead.approvedBinding!.masterplanVersionId,
    snapshotHash: apiRead.approvedBinding!.snapshotHash,
    contextFingerprint: apiRead.approvedBinding!.contextFingerprint,
  });
  assert.equal(bindingReplay.policy.masterplanVersionId, plan!.id);

  const addProposal = async (suffix: string, overrides: Record<string, unknown> = {}) => {
    const [row] = await db.insert(paidMediaProposalsTable).values({
      workspaceId, campaignId, masterplanVersionId: plan!.id, contextFingerprint: plan!.contextFingerprint,
      accountId: account, entityId: entity, provider: "meta_ads", actionType: "pause", status: "approved",
      idempotencyKey: `${marker}:${suffix}`, recommendation: "pause", requestedChange: {},
      expiresAt: new Date(Date.now() + 86_400_000), ...overrides,
    }).returning();
    return row!;
  };
  const addPolicy = async (suffix: string, version: number, maxActionsPerDay = 2, enabled = true) => {
    const [p] = await db.insert(conditionalExecutionPoliciesTable).values({
      workspaceId, campaignId, version, enabled, masterplanVersionId: plan!.id, snapshotHash,
      contextFingerprint: plan!.contextFingerprint, expiresAt: new Date(Date.now() + 86_400_000),
      ownerUserId: owner, idempotencyKey: `${marker}:${suffix}`,
    }).returning();
    const [a] = await db.insert(conditionalExecutionPolicyActionsTable).values({
      policyId: p!.id, workspaceId, actionType: "paid_media_pause", provider: "meta_ads",
      accountId: account, entityId: entity, maxActionsPerDay,
    }).returning();
    return { policy: p!, action: a! };
  };

  // A disabled successor suppresses the older enabled policy completely.
  const suppressed = await addPolicy("newer-disabled", 20, 2, false);
  const suppressedProposal = await addProposal("suppressed-proposal");
  const beforeSuppressed = applyCalls;
  await conditionalExecutionTick(fakeAdapter);
  assert.equal(applyCalls, beforeSuppressed);
  assert.equal((await db.select().from(conditionalExecutionIntentsTable).where(eq(conditionalExecutionIntentsTable.policyId, suppressed.policy.id))).length, 0);
  await db.transaction(async (tx) => {
    await tx.execute(sql`set local session_replication_role = replica`);
    await tx.delete(conditionalExecutionPoliciesTable).where(eq(conditionalExecutionPoliciesTable.id, suppressed.policy.id));
  });

  // Durable restart: eligible and attempted rows are swept rather than lost.
  const resumeProposal = await addProposal("resume-proposal");
  const resumeKey = `${bindingReplay.policy.id}:${bindingReplay.action.id}:${resumeProposal.id}`;
  const [resumeIntent] = await db.insert(conditionalExecutionIntentsTable).values({
    workspaceId, campaignId, policyId: bindingReplay.policy.id, policyActionId: bindingReplay.action.id,
    proposalId: resumeProposal.id, intentKey: resumeKey, status: "eligible",
  }).returning();
  await conditionalExecutionTick(fakeAdapter);
  assert.equal((await db.select().from(conditionalExecutionIntentsTable).where(eq(conditionalExecutionIntentsTable.id, resumeIntent!.id)))[0]!.status, "confirmed");
  const attemptedProposal = await addProposal("attempted-proposal");
  const attemptedKey = `${bindingReplay.policy.id}:${bindingReplay.action.id}:${attemptedProposal.id}`;
  const [attemptedIntent] = await db.insert(conditionalExecutionIntentsTable).values({
    workspaceId, campaignId, policyId: bindingReplay.policy.id, policyActionId: bindingReplay.action.id,
    proposalId: attemptedProposal.id, intentKey: attemptedKey, status: "attempted",
  }).returning();
  await db.insert(conditionalExecutionAttemptsTable).values({
    workspaceId, intentId: attemptedIntent!.id, attemptKey: `${marker}:persisted-attempt`,
    status: "attempted", providerReceipt: { receipt: "persisted" },
  });
  const beforeReadback = applyCalls;
  const beforeVerify = verifyCalls;
  await conditionalExecutionTick(fakeAdapter);
  assert.equal(applyCalls, beforeReadback);
  assert.equal(verifyCalls, beforeVerify + 1);

  // Distinct proposals reserve one daily slot under the same advisory lock.
  const ceiling = await addPolicy("ceiling", 21, 1);
  const ceilingProposals = await Promise.all([addProposal("ceiling-a"), addProposal("ceiling-b")]);
  await Promise.all([conditionalExecutionTick(fakeAdapter), conditionalExecutionTick(fakeAdapter)]);
  const ceilingIntents = await db.select().from(conditionalExecutionIntentsTable).where(eq(conditionalExecutionIntentsTable.policyId, ceiling.policy.id));
  assert.equal(ceilingIntents.filter((i) => i.status === "confirmed").length, 1);
  assert.equal(ceilingIntents.filter((i) => i.status === "blocked" && i.blockCode === "DAILY_CEILING").length, 1);

  for (const [suffix, changes] of [
    ["provider", { provider: "tiktok_ads" }],
    ["masterplan", { campaignId: null }],
    ["context", { contextFingerprint: "stale-context" }],
  ] as const) {
    const p = await addProposal(`stale-${suffix}`, changes);
    const result = await preflightConditionalExecution(workspaceId, ceiling.policy.id, ceiling.action.id, p.id);
    assert.equal(result.eligible, false);
    assert.equal(result.code, suffix === "context" || suffix === "masterplan" || suffix === "provider" ? "PROPOSAL_INVALID" : "");
  }

  // Credential and account/entity health are fail-closed, and recover after
  // the source state is restored.
  const healthPolicy = await addPolicy("health", 22, 100);
  const integrationId = accountRow!.integrationId!;
  const healthProposal = await addProposal("health-proposal");
  await db.update(workspaceIntegrationsTable).set({ accessToken: "fixture-token", tokenExpiresAt: new Date(Date.now() - 1000) }).where(eq(workspaceIntegrationsTable.id, integrationId));
  assert.equal((await preflightConditionalExecution(workspaceId, healthPolicy.policy.id, healthPolicy.action.id, healthProposal.id)).code, "CREDENTIAL_UNHEALTHY");
  await db.update(workspaceIntegrationsTable).set({ tokenExpiresAt: new Date(Date.now() + 86_400_000), blocksExecution: true }).where(eq(workspaceIntegrationsTable.id, integrationId));
  assert.equal((await preflightConditionalExecution(workspaceId, healthPolicy.policy.id, healthPolicy.action.id, healthProposal.id)).code, "CREDENTIAL_UNHEALTHY");
  await db.update(workspaceIntegrationsTable).set({ blocksExecution: false }).where(eq(workspaceIntegrationsTable.id, integrationId));
  await db.update(paidMediaEntitiesTable).set({ providerData: { operational: false } }).where(eq(paidMediaEntitiesTable.id, entity));
  assert.equal((await preflightConditionalExecution(workspaceId, healthPolicy.policy.id, healthPolicy.action.id, healthProposal.id)).code, "CREDENTIAL_UNHEALTHY");
  await db.update(paidMediaEntitiesTable).set({ providerData: {} }).where(eq(paidMediaEntitiesTable.id, entity));

  // A failed readback is terminal: restarting the scheduler never mutates twice.
  const [mismatchPolicy] = await db.insert(conditionalExecutionPoliciesTable).values({
    workspaceId, campaignId, version: 99, enabled: true, masterplanVersionId: plan!.id,
    snapshotHash, contextFingerprint: plan!.contextFingerprint, expiresAt: new Date(Date.now() + 86_400_000),
    ownerUserId: owner, idempotencyKey: `${marker}:mismatch`,
  }).returning();
  const [mismatchAction] = await db.insert(conditionalExecutionPolicyActionsTable).values({
    policyId: mismatchPolicy!.id, workspaceId, actionType: "paid_media_pause", provider: "meta_ads",
    accountId: account, entityId: entity, maxActionsPerDay: 2,
  }).returning();
  const [mismatchProposal] = await db.insert(paidMediaProposalsTable).values({
    workspaceId, campaignId, masterplanVersionId: plan!.id, contextFingerprint: plan!.contextFingerprint,
    accountId: account, entityId: entity, provider: "meta_ads", actionType: "pause", status: "approved",
    idempotencyKey: `${marker}:mismatch-proposal`, recommendation: "pause", requestedChange: {},
    expiresAt: new Date(Date.now() + 86_400_000),
  }).returning();
  verifyMode = "mismatch";
  const [mismatchIntent] = await db.insert(conditionalExecutionIntentsTable).values({
    workspaceId, campaignId, policyId: mismatchPolicy!.id, policyActionId: mismatchAction!.id,
    proposalId: mismatchProposal!.id, intentKey: `${marker}:mismatch-intent`, status: "eligible",
  }).returning();
  await executeConditionalIntent(workspaceId, mismatchIntent!.id, fakeAdapter);
  const [recoveredMismatchIntent] = await db.select().from(conditionalExecutionIntentsTable).where(eq(conditionalExecutionIntentsTable.id, mismatchIntent!.id));
  assert.equal(recoveredMismatchIntent!.status, "recovery_required", `unexpected mismatch terminal state; blockCode=${recoveredMismatchIntent!.blockCode ?? "none"}`);
  const callsAfterMismatch = applyCalls;
  assert.equal((await executeConditionalIntent(workspaceId, mismatchIntent!.id, fakeAdapter)).status, "recovery_required");
  assert.equal(applyCalls, callsAfterMismatch);

  const casPolicy = await addPolicy("cas-failure", 100, 2);
  const casProposal = await addProposal("cas-failure-proposal", { status: "executing" });
  const [casIntent] = await db.insert(conditionalExecutionIntentsTable).values({
    workspaceId, campaignId, policyId: casPolicy.policy.id, policyActionId: casPolicy.action.id,
    proposalId: casProposal.id, intentKey: `${marker}:cas-intent`, status: "eligible",
  }).returning();
  const beforeCas = applyCalls;
  await executeConditionalIntent(workspaceId, casIntent!.id, fakeAdapter);
  assert.equal(applyCalls, beforeCas);
  const [casBlockedIntent] = await db.select().from(conditionalExecutionIntentsTable).where(eq(conditionalExecutionIntentsTable.id, casIntent!.id));
  assert.equal(casBlockedIntent!.status, "blocked");
  assert.equal(casBlockedIntent!.blockCode, "PROPOSAL_INVALID");

  const concurrent = await Promise.all([1, 2, 3].map((n) => createExecutionPolicy(workspaceId, owner, campaignId, {
    ...base, enabled: true, idempotencyKey: `${marker}:concurrent-${n}`,
  })));
  assert.deepEqual(concurrent.map((r) => r.policy.version).sort((a, b) => a - b), [101, 102, 103]);
  const replay = await createExecutionPolicy(workspaceId, owner, campaignId, { ...base, enabled: true, idempotencyKey: `${marker}:concurrent-1` });
  assert.equal(replay.policy.id, concurrent[0]!.policy.id);
  await expectCode(createExecutionPolicy(workspaceId, owner, campaignId, {
    ...base, enabled: false, idempotencyKey: `${marker}:concurrent-1`,
  }), "IDEMPOTENCY_CONFLICT");

  // Database triggers protect the exact binding and audit append-only contract.
  await assert.rejects(db.update(conditionalExecutionPoliciesTable).set({ enabled: false }).where(eq(conditionalExecutionPoliciesTable.id, concurrent[0]!.policy.id)));
  const [triggerEvidence] = await db.insert(executionEvidenceTable).values({
    workspaceId, campaignId, masterplanVersionId: plan!.id, contextFingerprint: plan!.contextFingerprint,
    subjectType: "conditional_execution_intent", subjectId: casIntent!.id, state: "planned", details: { token: "secret" },
  }).returning();
  await assert.rejects(db.update(executionEvidenceTable).set({ details: { changed: true } }).where(eq(executionEvidenceTable.id, triggerEvidence!.id)));
  await assert.rejects(db.delete(executionEvidenceTable).where(eq(executionEvidenceTable.id, triggerEvidence!.id)));

  // Two independent service calls contend on the persisted provider-boundary
  // locks.  The delayed adapter makes the ordering observable: no loser may
  // read back or revoke while the owner is between apply and verify.
  const racePolicy = await addPolicy("delayed-race", 200, 2);
  const raceProposal = await addProposal("delayed-race-proposal");
  const [raceIntent] = await db.insert(conditionalExecutionIntentsTable).values({
    workspaceId, campaignId, policyId: racePolicy.policy.id, policyActionId: racePolicy.action.id,
    proposalId: raceProposal.id, intentKey: `${marker}:delayed-race-intent`, status: "eligible",
  }).returning();
  let releaseApply!: () => void;
  let signalApplyStarted!: () => void;
  const applyGate = new Promise<void>((resolve) => { releaseApply = resolve; });
  const applyStarted = new Promise<void>((resolve) => { signalApplyStarted = resolve; });
  let raceApplyCalls = 0;
  let raceVerifyCalls = 0;
  const delayedAdapter = {
    async getEntitySnapshot() { return { providerEntityId: "race", entityType: "campaign", data: {} }; },
    async applyAction(_workspace: string, _account: string, action: ProviderAction) {
      assert.equal(action.type, "pause");
      raceApplyCalls++;
      signalApplyStarted();
      await applyGate;
      return { providerRequestId: "race-receipt", evidence: { status: "PAUSED" } };
    },
    async verifyAction() {
      raceVerifyCalls++;
      return { verified: true, evidence: { status: "PAUSED" } };
    },
    async rollbackAction() { throw new Error("rollback is not part of M08"); },
  } as unknown as PaidMediaProviderAdapter;
  const raceA = executeConditionalIntent(workspaceId, raceIntent!.id, delayedAdapter);
  await applyStarted;
  const raceB = executeConditionalIntent(workspaceId, raceIntent!.id, delayedAdapter);
  const revokeInFlight = revokeExecutionPolicy(workspaceId, owner, campaignId, racePolicy.policy.version);
  const pendingFor = async (promise: Promise<unknown>) => Promise.race([
    promise.then(() => false),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 100)),
  ]);
  assert.equal(await pendingFor(raceB), true, "loser must remain blocked behind owner");
  assert.equal(await pendingFor(revokeInFlight), true, "revoke must remain behind provider boundary");
  assert.equal(raceApplyCalls, 1);
  assert.equal(raceVerifyCalls, 0);
  const releaseAt = new Date();
  releaseApply();
  const [raceResult, loserResult] = await Promise.all([raceA, raceB]);
  await revokeInFlight;
  assert.equal(raceResult.status, "confirmed");
  assert.notEqual(loserResult.status, "recovery_required");
  assert.equal(raceApplyCalls, 1);
  assert.equal(raceVerifyCalls, 1);
  const [raceFinal] = await db.select().from(conditionalExecutionIntentsTable).where(eq(conditionalExecutionIntentsTable.id, raceIntent!.id));
  assert.equal(raceFinal!.status, "confirmed");
  const [revokedRacePolicy] = await db.select().from(conditionalExecutionPoliciesTable).where(eq(conditionalExecutionPoliciesTable.id, racePolicy.policy.id));
  assert.ok(revokedRacePolicy!.revokedAt);
  assert.ok(revokedRacePolicy!.revokedAt!.getTime() >= releaseAt.getTime());

  // A newer disabled successor blocks an older eligible intent before any
  // provider boundary is crossed.
  const supersededOld = await addPolicy("superseded-old", 210, 2, true);
  const supersededProposal = await addProposal("superseded-proposal");
  const [supersededIntent] = await db.insert(conditionalExecutionIntentsTable).values({
    workspaceId, campaignId, policyId: supersededOld.policy.id, policyActionId: supersededOld.action.id,
    proposalId: supersededProposal.id, intentKey: `${marker}:superseded-intent`, status: "eligible",
  }).returning();
  await addPolicy("superseded-successor-disabled", 211, 2, false);
  const supersededBefore = applyCalls;
  const supersededResult = await executeConditionalIntent(workspaceId, supersededIntent!.id, fakeAdapter);
  assert.equal(supersededResult.status, "blocked");
  assert.equal((supersededResult as any).code, "SUPERSEDED_POLICY");
  assert.equal(applyCalls, supersededBefore);

  // The composite 0052 policy/action parent is enforced by the database,
  // rather than relying on application preflight.
  const malformedPolicy = await addPolicy("malformed-policy-a", 220, 2, true);
  const malformedOther = await addPolicy("malformed-policy-b", 221, 2, true);
  const malformedProposal = await addProposal("malformed-proposal");
  await assert.rejects(db.insert(conditionalExecutionIntentsTable).values({
    workspaceId, campaignId, policyId: malformedPolicy.policy.id, policyActionId: malformedOther.action.id,
    proposalId: malformedProposal.id, intentKey: `${marker}:malformed-intent`, status: "eligible",
  }));
  const [crossCampaign] = await db.insert(campaignsTable).values({
    workspaceId, title: `${marker} cross campaign`, status: "approved", intakeData: { marker },
  }).returning({ id: campaignsTable.id });
  crossCampaignId = crossCampaign!.id;
  const [crossPlan] = await db.insert(masterplanVersionsTable).values({
    workspaceId, campaignId: crossCampaignId, version: 1, status: "approved",
    snapshot: { marker }, contentHash: `${marker}:cross-content`,
    contextFingerprint: `${marker}:cross-context`, readinessScore: 100,
    readinessStatus: "ready", readinessBlockers: [], autonomyContract: {},
    allowedActions: ["paid_media_pause"], requiredApprovals: [],
  }).returning();
  const [crossPolicy] = await db.insert(conditionalExecutionPoliciesTable).values({
    workspaceId, campaignId: crossCampaignId, version: 1, enabled: true,
    masterplanVersionId: crossPlan!.id, snapshotHash: `${marker}:cross-hash`,
    contextFingerprint: crossPlan!.contextFingerprint, expiresAt: new Date(Date.now() + 86_400_000),
    ownerUserId: owner, idempotencyKey: `${marker}:cross-policy`,
  }).returning();
  const [crossAction] = await db.insert(conditionalExecutionPolicyActionsTable).values({
    policyId: crossPolicy!.id, workspaceId, actionType: "paid_media_pause",
    provider: "meta_ads", accountId: account, entityId: entity, maxActionsPerDay: 1,
  }).returning();
  await assert.rejects(db.insert(conditionalExecutionIntentsTable).values({
    workspaceId, campaignId, policyId: crossPolicy!.id, policyActionId: crossAction!.id,
    proposalId: malformedProposal.id, intentKey: `${marker}:cross-campaign-intent`, status: "eligible",
  }));

  const evidence = await db.select().from(executionEvidenceTable).where(eq(executionEvidenceTable.workspaceId, workspaceId));
  const events = await db.select().from(conditionalExecutionEventsTable).where(eq(conditionalExecutionEventsTable.workspaceId, workspaceId));
  assert.ok(evidence.length >= 2 && events.length >= 2);
  assert.ok((await db.select().from(conditionalExecutionPolicyActionsTable).where(inArray(conditionalExecutionPolicyActionsTable.policyId, [disabled.policy.id, enabled.policy.id, mismatchPolicy!.id]))).length === 3);
  console.log("conditional execution M08 adversarial DB tests passed");
} finally {
  // Append-only audit triggers are intentionally hostile to ordinary cleanup.
  // A local replication-role override is confined to this disposable fixture
  // transaction and prevents failed tests from leaking rows into later runs.
  await db.transaction(async (tx) => {
    await tx.execute(sql`set local session_replication_role = replica`);
    await tx.delete(conditionalExecutionEventsTable).where(eq(conditionalExecutionEventsTable.workspaceId, workspaceId));
    await tx.delete(conditionalExecutionPolicyEventsTable).where(eq(conditionalExecutionPolicyEventsTable.workspaceId, workspaceId));
    await tx.delete(executionEvidenceTable).where(eq(executionEvidenceTable.workspaceId, workspaceId));
    await tx.delete(conditionalExecutionAttemptsTable).where(eq(conditionalExecutionAttemptsTable.workspaceId, workspaceId));
    await tx.delete(conditionalExecutionIntentsTable).where(eq(conditionalExecutionIntentsTable.workspaceId, workspaceId));
    await tx.delete(conditionalExecutionPolicyActionsTable).where(eq(conditionalExecutionPolicyActionsTable.workspaceId, workspaceId));
    await tx.delete(conditionalExecutionPoliciesTable).where(eq(conditionalExecutionPoliciesTable.workspaceId, workspaceId));
    if (campaignId) await tx.delete(campaignsTable).where(eq(campaignsTable.id, campaignId));
    if (crossCampaignId) await tx.delete(campaignsTable).where(eq(campaignsTable.id, crossCampaignId));
  });
  await cleanupE2eFixtures(fixtures);
}