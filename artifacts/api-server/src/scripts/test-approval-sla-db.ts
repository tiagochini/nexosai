import assert from "node:assert/strict";
import { db, campaignsTable, masterplanVersionsTable, approvalSlaObligationsTable, approvalSlaEventsTable, auditLogsTable, contentPiecesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";
import { scheduleApprovalSla, processApprovalSla } from "../modules/approval-center/approval-sla.service.js";
import { getCampaignApprovals, decideCampaignApproval } from "../modules/approval-center/approval-center.service.js";
import { GetCampaignControlRoomApprovalsResponse } from "@workspace/api-zod";

if (process.env.NODE_ENV !== "test") throw new Error("Run with NODE_ENV=test");
const marker = markerFromSuffix(`approval-sla-${process.pid}`);
const fixtures = await seedE2eFixtures(marker);
const workspaceId = fixtures.workspaces[0]!;
const actor = fixtures.users[0]!;
let campaignId = "";
try {
  const [campaign] = await db.insert(campaignsTable).values({ workspaceId, title: `${marker} SLA`, status: "awaiting_approval", intakeData: { marker } }).returning({ id: campaignsTable.id });
  campaignId = campaign!.id;
  const [plan] = await db.insert(masterplanVersionsTable).values({ workspaceId, campaignId, version: 1, status: "pending_approval", snapshot: { marker }, contentHash: "sla", contextFingerprint: "sla", readinessScore: 100, readinessStatus: "ready", readinessBlockers: [], autonomyContract: {}, allowedActions: [], requiredApprovals: [] }).returning();
  const catalog = await getCampaignApprovals(campaignId, workspaceId);
  const hash = catalog.pendingItems.find((item) => item.subjectId === plan!.id)!.snapshotHash;
  const now = Date.now();
  const input = { subjectType: "masterplan" as const, subjectId: plan!.id, subjectSnapshotHash: hash, dueAt: new Date(now - 1_000).toISOString(), escalationAt: new Date(now + 1_000).toISOString(), expiresAt: new Date(now + 2_000).toISOString(), idempotencyKey: `${marker}-1` };
  const created = await scheduleApprovalSla(workspaceId, campaignId, actor, input);
  const replay = await scheduleApprovalSla(workspaceId, campaignId, actor, input);
  assert.equal(replay.id, created.id);
  const replayWithNewKey = await scheduleApprovalSla(workspaceId, campaignId, actor, { ...input, idempotencyKey: `${marker}-same-subject-new-key` });
  assert.equal(replayWithNewKey.id, created.id);
  await assert.rejects(
    () => scheduleApprovalSla(workspaceId, campaignId, actor, { ...input, escalationAt: new Date(now + 1_500).toISOString(), idempotencyKey: `${marker}-different-window` }),
    (error: any) => error.code === "SLA_ALREADY_SCHEDULED",
  );
  await assert.rejects(() => scheduleApprovalSla(workspaceId, campaignId, actor, { ...input, dueAt: new Date(now).toISOString() }), (error: any) => error.code === "IDEMPOTENCY_CONFLICT");
  await assert.rejects(() => scheduleApprovalSla(fixtures.workspaces[1]!, campaignId, fixtures.users[1]!, input), (error: any) => error.code === "NOT_FOUND");
  await assert.rejects(() => scheduleApprovalSla(workspaceId, campaignId, fixtures.users[1]!, { ...input, idempotencyKey: `${marker}-foreign-actor` }), (error: any) => error.code === "FORBIDDEN");
  const before = await getCampaignApprovals(campaignId, workspaceId);
  assert.equal(GetCampaignControlRoomApprovalsResponse.safeParse(before).success, true);
  assert.equal((before.pendingItems.find((item) => item.subjectId === plan!.id) as any).sla.status, "overdue");
  assert.equal(before.counts.slaOverdue >= 1, true);
  const [stalePlan] = await db.insert(masterplanVersionsTable).values({ workspaceId, campaignId, version: 3, status: "pending_approval", snapshot: { marker, stale: false }, contentHash: "stale", contextFingerprint: "stale", readinessScore: 100, readinessStatus: "ready", readinessBlockers: [], autonomyContract: {}, allowedActions: [], requiredApprovals: [] }).returning();
  const staleCatalog = await getCampaignApprovals(campaignId, workspaceId);
  const staleHash = staleCatalog.pendingItems.find((item) => item.subjectId === stalePlan!.id)!.snapshotHash;
  await db.update(masterplanVersionsTable).set({ snapshot: { marker, stale: true } }).where(eq(masterplanVersionsTable.id, stalePlan!.id));
  await assert.rejects(() => scheduleApprovalSla(workspaceId, campaignId, actor, { ...input, subjectId: stalePlan!.id, subjectSnapshotHash: staleHash, idempotencyKey: `${marker}-stale` }), (error: any) => error.code === "STALE_APPROVAL");
  await assert.rejects(() => db.update(approvalSlaObligationsTable).set({ dueAt: new Date() }).where(eq(approvalSlaObligationsTable.id, created.id)));
  const result = await processApprovalSla(new Date(now));
  assert.ok(result.delivered >= 2);
  const events = await db.select().from(approvalSlaEventsTable).where(eq(approvalSlaEventsTable.obligationId, created.id));
  const audits = await db.select().from(auditLogsTable).where(eq(auditLogsTable.action, "approval_sla_reminder_delivered"));
  assert.equal(events.length, 2);
  assert.ok(audits.some((audit) => (audit.data as any).obligationId === created.id));
  const concurrent = await Promise.all([processApprovalSla(new Date(now)), processApprovalSla(new Date(now))]);
  assert.equal((await db.select().from(approvalSlaEventsTable).where(eq(approvalSlaEventsTable.obligationId, created.id))).length, 2);
  assert.equal(concurrent.every((item) => item.delivered === 0), true);
  await assert.rejects(() => db.update(approvalSlaEventsTable).set({ receipt: { tampered: true } }).where(eq(approvalSlaEventsTable.obligationId, created.id)));
  await assert.rejects(() => db.delete(approvalSlaEventsTable).where(eq(approvalSlaEventsTable.obligationId, created.id)));
  const [expiredPlan] = await db.insert(masterplanVersionsTable).values({ workspaceId, campaignId, version: 2, status: "pending_approval", snapshot: { marker, expired: true }, contentHash: "expired", contextFingerprint: "expired", readinessScore: 100, readinessStatus: "ready", readinessBlockers: [], autonomyContract: {}, allowedActions: [], requiredApprovals: [] }).returning();
  const expiredCatalog = await getCampaignApprovals(campaignId, workspaceId);
  const expiredHash = expiredCatalog.pendingItems.find((item) => item.subjectId === expiredPlan!.id)!.snapshotHash;
  const past = new Date(now - 10_000).toISOString();
  const expired = await scheduleApprovalSla(workspaceId, campaignId, actor, { subjectType: "masterplan", subjectId: expiredPlan!.id, subjectSnapshotHash: expiredHash, dueAt: new Date(now - 30_000).toISOString(), escalationAt: new Date(now - 20_000).toISOString(), expiresAt: past, idempotencyKey: `${marker}-expired` });
  await assert.rejects(() => decideCampaignApproval(workspaceId, campaignId, "masterplan", expiredPlan!.id, actor, { decision: "approved", expectedSnapshotHash: expiredHash, idempotencyKey: `${marker}-expired-decision` }), (error: any) => error.code === "APPROVAL_EXPIRED");
  await processApprovalSla(new Date(now));
  const afterPersistedExpiration = await getCampaignApprovals(campaignId, workspaceId);
  assert.equal(afterPersistedExpiration.counts.slaExpired >= 1, true);
  const resolved = await decideCampaignApproval(workspaceId, campaignId, "masterplan", plan!.id, actor, { decision: "approved", expectedSnapshotHash: hash, idempotencyKey: `${marker}-resolve` });
  assert.equal(resolved.decision, "approved");
  const [badPiece] = await db.insert(contentPiecesTable).values({ workspaceId, campaignId, title: `${marker} bad`, type: "social_post", status: "pending_approval", content: { marker } }).returning();
  await assert.rejects(() => db.insert(approvalSlaObligationsTable).values({ workspaceId, campaignId, subjectType: "content_piece", subjectId: badPiece!.id, masterplanVersionId: plan!.id, contentPieceId: null, checkpointId: null, subjectSnapshotHash: "bad", idempotencyKey: `${marker}-bad-check`, commandFingerprint: "bad", dueAt: new Date(now + 2_000), warningAt: new Date(now + 1_000), escalationAt: new Date(now + 3_000), expiresAt: new Date(now + 4_000), createdBy: actor }));
  console.log("approval SLA DB tests passed", { events: events.length, audits: audits.length });
} finally {
  if (campaignId) await db.delete(campaignsTable).where(eq(campaignsTable.id, campaignId));
  await cleanupE2eFixtures(fixtures);
}