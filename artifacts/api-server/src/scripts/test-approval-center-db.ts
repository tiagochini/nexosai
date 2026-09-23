import assert from "node:assert/strict";
import { and, eq, inArray } from "drizzle-orm";
import {
  approvalCheckpointsTable, approvalDecisionsTable, auditLogsTable, campaignsTable, contentPiecesTable,
  db, masterplanVersionsTable,
} from "@workspace/db";
import {
  GetCampaignControlRoomApprovalsResponse,
  DecideCampaignControlRoomApprovalBody,
  ApprovalDecisionResponseSchema,
  GetCampaignControlRoomApprovalsQueryParams,
} from "@workspace/api-zod";
import { getCampaignApprovals, decideCampaignApproval } from "../modules/approval-center/approval-center.service.js";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";

if (process.env.NODE_ENV !== "test") throw new Error("Run with NODE_ENV=test");
const marker = markerFromSuffix(`approval-center-${process.pid}`);
const fixtures = await seedE2eFixtures(marker);
const workspaceId = fixtures.workspaces[0]!;
const foreignWorkspaceId = fixtures.workspaces[1]!;
const actor = fixtures.users[0]!;
const foreignActor = fixtures.users[1]!;
let campaignId = "";
const expectCode = async (promise: Promise<unknown>, code: string) => {
  await assert.rejects(promise, (error: any) => error?.code === code);
};
const databaseError = (error: any) => error?.cause ?? error;

try {
  const [campaign] = await db.insert(campaignsTable).values({
    workspaceId, title: `${marker} approval campaign`, status: "awaiting_approval",
    intakeData: { marker },
  }).returning({ id: campaignsTable.id });
  campaignId = campaign!.id;
  const [foreignCampaign] = await db.insert(campaignsTable).values({
    workspaceId: foreignWorkspaceId, title: `${marker} foreign campaign`,
  }).returning({ id: campaignsTable.id });
  const [plan] = await db.insert(masterplanVersionsTable).values({
    workspaceId, campaignId, version: 7, status: "pending_approval", snapshot: { marker, goal: "test" },
    contentHash: "source-hash", contextFingerprint: "ctx-7", readinessScore: 100,
    readinessStatus: "ready", readinessBlockers: [], autonomyContract: {}, allowedActions: [],
    requiredApprovals: [],
  }).returning();
  const [piece] = await db.insert(contentPiecesTable).values({
    workspaceId, campaignId, title: `${marker} content`, type: "social_post",
    status: "pending_approval", content: { marker, body: "safe preview" },
  }).returning();
  const [piece2] = await db.insert(contentPiecesTable).values({
    workspaceId, campaignId, title: `${marker} reject`, type: "social_post",
    status: "pending_approval", content: { marker, body: "reject me" },
  }).returning();
  const [checkpoint] = await db.insert(approvalCheckpointsTable).values({
    campaignId, checkpointType: "strategy_approval", status: "pending",
    data: { marker, masterplanVersionId: plan!.id, contextFingerprint: "ctx-7" },
  }).returning();
  const [checkpoint2] = await db.insert(approvalCheckpointsTable).values({
    campaignId, checkpointType: "timeline_approval", status: "pending",
    data: { marker, masterplan_version_id: plan!.id, context_fingerprint: "ctx-7" },
  }).returning();

  const catalog = await getCampaignApprovals(campaignId, workspaceId);
  assert.equal(GetCampaignControlRoomApprovalsResponse.safeParse(catalog).success, true);
  assert.equal(GetCampaignControlRoomApprovalsQueryParams.safeParse({ limit: 25 }).success, true);
  assert.equal(GetCampaignControlRoomApprovalsQueryParams.safeParse({ limit: 26 }).success, false);
  assert.equal(DecideCampaignControlRoomApprovalBody.safeParse({ decision: "approved", expectedSnapshotHash: "x", idempotencyKey: "k" }).success, true);
  assert.equal(DecideCampaignControlRoomApprovalBody.safeParse({ decision: "nope", expectedSnapshotHash: "", idempotencyKey: "" }).success, false);
  assert.equal(catalog.counts.pending, 5);
  const hash = (type: string, id: string) => catalog.pendingItems.find(i => i.subjectType === type && i.subjectId === id)!.snapshotHash;
  assert.ok(hash("masterplan", plan!.id)); assert.ok(hash("content_piece", piece!.id)); assert.ok(hash("checkpoint", checkpoint!.id));
  assert.equal((await getCampaignApprovals(campaignId, foreignWorkspaceId).catch(e => e.code)), "NOT_FOUND");

  const approved = await decideCampaignApproval(workspaceId, campaignId, "content_piece", piece!.id, actor, {
    decision: "approved", expectedSnapshotHash: hash("content_piece", piece!.id), idempotencyKey: `${marker}:content`,
  });
  assert.equal(ApprovalDecisionResponseSchema.safeParse({ decision: approved }).success, true);
  await assert.rejects(decideCampaignApproval(workspaceId, campaignId, "content_piece", piece!.id, actor, {
    decision: "approved", expectedSnapshotHash: approved.expectedSnapshotHash, reason: "not allowed", idempotencyKey: `${marker}:approved-reason`,
  }), /reason is only allowed/);
  assert.equal(approved.actorUserId, actor); assert.equal(approved.reason, null);
  assert.equal(approved.subjectVersion, null); assert.equal(approved.contextFingerprint, null);
  assert.equal((await db.select().from(contentPiecesTable).where(eq(contentPiecesTable.id, piece!.id)))[0]!.status, "approved");
  assert.deepEqual(await decideCampaignApproval(workspaceId, campaignId, "content_piece", piece!.id, actor, {
    decision: "approved", expectedSnapshotHash: hash("content_piece", piece!.id), idempotencyKey: `${marker}:content`,
  }), approved);
  await assert.rejects(
    db.update(approvalDecisionsTable).set({ decisionReason: "tamper" }).where(eq(approvalDecisionsTable.id, approved.id)),
    (error: any) => databaseError(error)?.code === "55006",
  );
  await assert.rejects(
    db.delete(approvalDecisionsTable).where(eq(approvalDecisionsTable.id, approved.id)),
    (error: any) => databaseError(error)?.code === "55006",
  );
  await expectCode(decideCampaignApproval(workspaceId, campaignId, "content_piece", piece!.id, actor, {
    decision: "rejected", expectedSnapshotHash: hash("content_piece", piece!.id), reason: "conflict", idempotencyKey: `${marker}:content`,
  }), "IDEMPOTENCY_CONFLICT");
  await expectCode(decideCampaignApproval(workspaceId, campaignId, "content_piece", piece!.id, actor, {
    decision: "approved", expectedSnapshotHash: approved.expectedSnapshotHash, idempotencyKey: `${marker}:late`,
  }), "STALE_APPROVAL");

  await assert.rejects(decideCampaignApproval(workspaceId, campaignId, "content_piece", piece2!.id, actor, {
    decision: "rejected", expectedSnapshotHash: hash("content_piece", piece2!.id), idempotencyKey: `${marker}:missing-reason`,
  }), /reason is required/);
  const rejected = await decideCampaignApproval(workspaceId, campaignId, "content_piece", piece2!.id, actor, {
    decision: "rejected", expectedSnapshotHash: hash("content_piece", piece2!.id), reason: "needs a new angle", idempotencyKey: `${marker}:reject`,
  });
  assert.equal(rejected.reason, "needs a new angle");
  const [revisionPiece] = await db.insert(contentPiecesTable).values({
    workspaceId, campaignId, title: `${marker} revision`, type: "social_post", status: "pending_approval",
    content: {
      marker,
      authorization: "Bearer SHOULD_NOT_LEAK",
      privateKey: "-----BEGIN PRIVATE KEY-----",
      url: "https://user:pass@example.test/x?token=secret",
      providerSecrets: "ghp_abcdefghijklmnopqrstuvwxyz xoxb-12345678901234567890 whsec_abcdefghijklmnopqrstuv",
      oversized: "x".repeat(30_000),
    },
  }).returning();
  const revisionCatalog = await getCampaignApprovals(campaignId, workspaceId);
  const revisionHash = revisionCatalog.pendingItems.find(i => i.subjectId === revisionPiece!.id)!.snapshotHash;
  const revisionItem = revisionCatalog.pendingItems.find(i => i.subjectId === revisionPiece!.id)!;
  assert.equal(revisionItem.previewTruncated, true);
  assert.ok(revisionItem.previewWarnings.length > 0);
  assert.ok(Buffer.byteLength(JSON.stringify(revisionItem.preview)) < 24_001);
  assert.doesNotMatch(JSON.stringify(revisionItem.preview), /Bearer SHOULD_NOT_LEAK|BEGIN PRIVATE|secret|user:pass|ghp_|xoxb-|whsec_/);
  await db.update(contentPiecesTable).set({ content: { marker, hidden: "changed" } }).where(eq(contentPiecesTable.id, revisionPiece!.id));
  await expectCode(decideCampaignApproval(workspaceId, campaignId, "content_piece", revisionPiece!.id, actor, {
    decision: "revision_requested", expectedSnapshotHash: revisionHash, reason: "rewrite", idempotencyKey: `${marker}:revision`,
  }), "STALE_APPROVAL");
  const freshRevision = await getCampaignApprovals(campaignId, workspaceId);
  const freshRevisionHash = freshRevision.pendingItems.find(i => i.subjectId === revisionPiece!.id)!.snapshotHash;
  const revisionDecision = await decideCampaignApproval(workspaceId, campaignId, "content_piece", revisionPiece!.id, actor, {
    decision: "revision_requested", expectedSnapshotHash: freshRevisionHash, reason: "rewrite", idempotencyKey: `${marker}:revision`,
  });
  assert.equal(revisionDecision.decision, "revision_requested");
  assert.equal((await db.select().from(contentPiecesTable).where(eq(contentPiecesTable.id, revisionPiece!.id)))[0]!.status, "revision_requested");
  await expectCode(decideCampaignApproval(workspaceId, campaignId, "content_piece", revisionPiece!.id, actor, {
    decision: "approved", expectedSnapshotHash: freshRevisionHash, idempotencyKey: `${marker}:revision-again`,
  }), "STALE_APPROVAL");

  const planHash = hash("masterplan", plan!.id);
  const planDecision = await decideCampaignApproval(workspaceId, campaignId, "masterplan", plan!.id, actor, {
    decision: "approved", expectedSnapshotHash: planHash, expectedVersion: 7, idempotencyKey: `${marker}:plan`,
  });
  assert.equal(planDecision.subjectVersion, 7); assert.equal(planDecision.contextFingerprint, "ctx-7");
  await expectCode(decideCampaignApproval(workspaceId, campaignId, "masterplan", plan!.id, actor, {
    decision: "approved", expectedSnapshotHash: planHash, expectedVersion: 6, idempotencyKey: `${marker}:stale-version`,
  }), "STALE_APPROVAL");
  await expectCode(decideCampaignApproval(foreignWorkspaceId, campaignId, "masterplan", plan!.id, foreignActor, {
    decision: "approved", expectedSnapshotHash: planHash, idempotencyKey: `${marker}:idor`,
  }), "NOT_FOUND");
  await expectCode(decideCampaignApproval(workspaceId, foreignCampaign!.id, "masterplan", plan!.id, actor, {
    decision: "approved", expectedSnapshotHash: planHash, idempotencyKey: `${marker}:idor2`,
  }), "NOT_FOUND");

  // Both races serialize on the same transaction-scoped advisory lock.
  const [raceA, raceB] = await db.insert(contentPiecesTable).values([
    { workspaceId, campaignId, title: `${marker} race A`, type: "social_post", status: "pending_approval", content: { marker, race: "a" } },
    { workspaceId, campaignId, title: `${marker} race B`, type: "social_post", status: "pending_approval", content: { marker, race: "b" } },
  ]).returning();
  const current = await getCampaignApprovals(campaignId, workspaceId);
  const raceHash = (id: string) => current.pendingItems.find(i => i.subjectId === id)!.snapshotHash;
  const results = await Promise.allSettled([
    decideCampaignApproval(workspaceId, campaignId, "content_piece", raceA!.id, actor, { decision: "approved", expectedSnapshotHash: raceHash(raceA!.id), idempotencyKey: `${marker}:race-a` }),
    decideCampaignApproval(workspaceId, campaignId, "content_piece", raceA!.id, actor, { decision: "rejected", expectedSnapshotHash: raceHash(raceA!.id), reason: "race", idempotencyKey: `${marker}:race-b` }),
    decideCampaignApproval(workspaceId, campaignId, "content_piece", raceB!.id, actor, { decision: "approved", expectedSnapshotHash: raceHash(raceB!.id), idempotencyKey: `${marker}:race-c` }),
    decideCampaignApproval(workspaceId, campaignId, "content_piece", raceB!.id, actor, { decision: "approved", expectedSnapshotHash: raceHash(raceB!.id), idempotencyKey: `${marker}:race-d` }),
  ]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 2);
  for (const rejectedResult of results.filter((r): r is PromiseRejectedResult => r.status === "rejected")) {
    assert.ok(["STALE_APPROVAL", "ALREADY_DECIDED"].includes(rejectedResult.reason?.code));
  }
  assert.equal((await db.select().from(approvalDecisionsTable).where(and(eq(approvalDecisionsTable.campaignId, campaignId), inArray(approvalDecisionsTable.subjectId, [raceA!.id, raceB!.id])))).length, 2);
  assert.equal((await db.select().from(approvalDecisionsTable).where(eq(approvalDecisionsTable.campaignId, campaignId))).length, 6);

  const checkpointHash = (await getCampaignApprovals(campaignId, workspaceId)).pendingItems.find(i => i.subjectId === checkpoint!.id)!.snapshotHash;
  await decideCampaignApproval(workspaceId, campaignId, "checkpoint", checkpoint!.id, actor, { decision: "approved", expectedSnapshotHash: checkpointHash, idempotencyKey: `${marker}:checkpoint` });
  const checkpointHash2 = (await getCampaignApprovals(campaignId, workspaceId)).pendingItems.find(i => i.subjectId === checkpoint2!.id)!.snapshotHash;
  await decideCampaignApproval(workspaceId, campaignId, "checkpoint", checkpoint2!.id, actor, { decision: "approved", expectedSnapshotHash: checkpointHash2, idempotencyKey: `${marker}:checkpoint2` });
  assert.equal((await db.select({ status: campaignsTable.status }).from(campaignsTable).where(eq(campaignsTable.id, campaignId)))[0]!.status, "approved");
  assert.equal((await db.select().from(approvalDecisionsTable).where(and(eq(approvalDecisionsTable.campaignId, campaignId), eq(approvalDecisionsTable.subjectType, "checkpoint")))).length, 2);
  const checkpointDecisions = await db.select().from(approvalDecisionsTable).where(and(
    eq(approvalDecisionsTable.campaignId, campaignId),
    eq(approvalDecisionsTable.subjectType, "checkpoint"),
  ));
  assert.ok(checkpointDecisions.every(row => row.masterplanVersionId === plan!.id && row.contextFingerprint === "ctx-7"));
  assert.equal((await db.select().from(auditLogsTable).where(and(
    eq(auditLogsTable.campaignId, campaignId),
    eq(auditLogsTable.action, "campaign.status.transition"),
  ))).length, 1);

  const [scopePiece] = await db.insert(contentPiecesTable).values({
    workspaceId,
    campaignId,
    title: `${marker} scope`,
    type: "social_post",
    status: "pending_approval",
    content: { marker },
  }).returning();
  await assert.rejects(
    db.insert(approvalDecisionsTable).values({
      workspaceId: foreignWorkspaceId,
      campaignId: foreignCampaign!.id,
      subjectType: "content_piece",
      subjectId: scopePiece!.id,
      decision: "approved",
      actorUserId: foreignActor,
      expectedSnapshotHash: "scope-hash",
      resolvedSnapshotHash: "scope-hash",
      idempotencyKey: `${marker}:cross-scope`,
      commandFingerprint: `${marker}:cross-scope`,
      contentPieceId: scopePiece!.id,
    }),
    (error: any) => databaseError(error)?.code === "23503" && databaseError(error)?.constraint === "approval_decisions_content_piece_scope_fk",
  );
  await assert.rejects(
    db.insert(approvalDecisionsTable).values({
      workspaceId,
      campaignId,
      subjectType: "content_piece",
      subjectId: scopePiece!.id,
      decision: "approved",
      actorUserId: foreignActor,
      expectedSnapshotHash: "actor-hash",
      resolvedSnapshotHash: "actor-hash",
      idempotencyKey: `${marker}:cross-actor`,
      commandFingerprint: `${marker}:cross-actor`,
      contentPieceId: scopePiece!.id,
    }),
    (error: any) => databaseError(error)?.code === "23503" && databaseError(error)?.constraint === "approval_decisions_workspace_actor_fk",
  );

  const boundedPieces = await db.insert(contentPiecesTable).values(Array.from({ length: 30 }, (_, index) => ({
    workspaceId,
    campaignId,
    title: `${marker} bounded ${index}`,
    type: "social_post" as const,
    status: "pending_approval" as const,
    content: { marker, index, bodyA: "x".repeat(3_900), bodyB: "y".repeat(3_900) },
  }))).returning({ id: contentPiecesTable.id });
  const boundedCatalog = await getCampaignApprovals(campaignId, workspaceId, 25);
  assert.ok(boundedCatalog.pendingItems.length < 25);
  assert.ok(boundedCatalog.total > boundedCatalog.pendingItems.length);
  assert.equal(boundedCatalog.catalogTruncated, true);
  assert.ok(boundedCatalog.catalogWarnings.includes("catalog_byte_limit"));
  assert.ok(Buffer.byteLength(JSON.stringify(boundedCatalog), "utf8") <= 192_000);

  await db.update(contentPiecesTable).set({ status: "archived" }).where(inArray(
    contentPiecesTable.id,
    [...boundedPieces.map(row => row.id), scopePiece!.id],
  ));
  const decisionPieces = await db.insert(contentPiecesTable).values(Array.from({ length: 50 }, (_, index) => ({
    workspaceId,
    campaignId,
    title: `${marker} decision bound ${index}`,
    type: "social_post" as const,
    status: "rejected" as const,
    content: { marker, index },
  }))).returning({ id: contentPiecesTable.id });
  await db.insert(approvalDecisionsTable).values(decisionPieces.map((row, index) => ({
    workspaceId,
    campaignId,
    subjectType: "content_piece" as const,
    subjectId: row.id,
    decision: "rejected" as const,
    actorUserId: actor,
    decisionReason: `${index}: ${"r".repeat(3_890)}`,
    expectedSnapshotHash: `decision-hash-${index}`,
    resolvedSnapshotHash: `decision-hash-${index}`,
    idempotencyKey: `${marker}:bounded-decision:${index}`,
    commandFingerprint: `${marker}:bounded-command:${index}`,
    contentPieceId: row.id,
    contextFingerprint: "c".repeat(256),
  })));
  const decisionBoundedCatalog = await getCampaignApprovals(campaignId, workspaceId, 25);
  assert.equal(decisionBoundedCatalog.pendingItems.length, 0);
  assert.ok(decisionBoundedCatalog.recentDecisions.length < 50);
  assert.ok(decisionBoundedCatalog.catalogWarnings.includes("recent_decisions_byte_limit"));
  assert.ok(Buffer.byteLength(JSON.stringify(decisionBoundedCatalog), "utf8") <= 192_000);
  console.log("approval center DB/race/idempotency/IDOR test passed");
} finally {
  if (campaignId) await db.delete(campaignsTable).where(eq(campaignsTable.id, campaignId));
  await db.delete(campaignsTable).where(eq(campaignsTable.title, `${marker} foreign campaign`));
  await cleanupE2eFixtures(fixtures);
}