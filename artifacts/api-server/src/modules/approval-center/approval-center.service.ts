import { createHash } from "node:crypto";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import {
  approvalCheckpointsTable,
  approvalDecisionsTable,
  auditLogsTable,
  campaignsTable,
  contentPiecesTable,
  db,
  masterplanVersionsTable,
  approvalSlaObligationsTable,
  approvalSlaEventsTable,
} from "@workspace/db";
import { AppError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { sanitizePublicPreview } from "../campaigns/control-room.service.js";
import { transitionCampaignInTransaction } from "../campaigns/campaigns.service.js";

export type ApprovalSubjectType = "masterplan" | "content_piece" | "checkpoint";
export type ApprovalCommand = {
  decision: "approved" | "rejected" | "revision_requested";
  expectedSnapshotHash: string;
  expectedVersion?: number;
  reason?: string;
  idempotencyKey: string;
};

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
}
export function approvalSnapshotHash(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}
export function approvalSubjectSnapshot(type: ApprovalSubjectType, row: any): Record<string, unknown> {
  if (type === "masterplan") return { subjectType: type, id: row.id, campaignId: row.campaignId, workspaceId: row.workspaceId, version: row.version, status: row.status, snapshot: row.snapshot, contentHash: row.contentHash, contextFingerprint: row.contextFingerprint, readinessScore: row.readinessScore, readinessStatus: row.readinessStatus, readinessBlockers: row.readinessBlockers, autonomyContract: row.autonomyContract, allowedActions: row.allowedActions, requiredApprovals: row.requiredApprovals };
  if (type === "content_piece") return { subjectType: type, id: row.id, campaignId: row.campaignId, workspaceId: row.workspaceId, type: row.type, status: row.status, title: row.title, phase: row.phase, launchPhase: row.launchPhase, dayIndex: row.dayIndex, mentalTrigger: row.mentalTrigger, sequenceItemId: row.sequenceItemId, content: row.content, aiProvider: row.aiProvider, agentVersion: row.agentVersion };
  return { subjectType: type, id: row.id, campaignId: row.campaignId, assetId: row.assetId, checkpointType: row.checkpointType, status: row.status, data: row.data };
}
function publicDecision(d: any) {
  const bounded = (value: unknown, max: number) => String(value ?? "").slice(0, max);
  const optionalBounded = (value: unknown, max: number) => typeof value === "string" ? value.slice(0, max) : null;
  return {
    id: bounded(d.id, 36),
    subjectType: d.subjectType,
    subjectId: bounded(d.subjectId, 36),
    decision: d.decision,
    actorUserId: bounded(d.actorUserId, 36),
    decidedAt: d.createdAt,
    reason: optionalBounded(d.decisionReason, 4_000),
    subjectVersion: d.subjectVersion,
    expectedSnapshotHash: bounded(d.expectedSnapshotHash, 64),
    resolvedSnapshotHash: bounded(d.resolvedSnapshotHash, 64),
    contextFingerprint: optionalBounded(d.contextFingerprint, 256),
  };
}
function invalid(message: string, code = "VALIDATION_ERROR"): never {
  throw new AppError(400, message, code);
}
function requireReason(command: ApprovalCommand) {
  if (command.decision !== "approved" && !command.reason?.trim()) invalid("reason is required for rejected and revision_requested decisions");
  if (command.decision === "approved" && command.reason?.trim()) invalid("reason is only allowed for rejected and revision_requested decisions");
}
function commandFingerprint(workspaceId: string, campaignId: string, type: ApprovalSubjectType, subjectId: string, actor: string, c: ApprovalCommand) {
  return approvalSnapshotHash({ workspaceId, campaignId, type, subjectId, actor, decision: c.decision, reason: c.reason?.trim() ?? null, expectedSnapshotHash: c.expectedSnapshotHash, expectedVersion: c.expectedVersion ?? null });
}

async function ensureCampaign(campaignId: string, workspaceId: string) {
  const [campaign] = await db.select({ id: campaignsTable.id }).from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId))).limit(1);
  if (!campaign) throw new NotFoundError("Campaign");
}

function item(type: ApprovalSubjectType, row: any) {
  const rawPreview = type === "masterplan" ? row.snapshot : type === "content_piece" ? row.content : row.data;
  const sanitized = sanitizePublicPreview(rawPreview, { maxBytes: 8_192, maxNodes: 750, maxItems: 300 });
  const checkpointData = type === "checkpoint" && row.data && typeof row.data === "object"
    ? row.data as Record<string, unknown>
    : {};
  return {
    subjectType: type, subjectId: row.id, subjectVersion: type === "masterplan" ? row.version : null,
    status: row.status, snapshotHash: approvalSnapshotHash(approvalSubjectSnapshot(type, row)),
    contextFingerprint: row.contextFingerprint ?? (typeof checkpointData.contextFingerprint === "string" ? checkpointData.contextFingerprint : null),
    title: row.title ?? row.checkpointType ?? `Masterplan v${row.version}`,
    preview: sanitized.value,
    previewTruncated: sanitized.truncated,
    previewWarnings: sanitized.warnings,
  };
}

const MAX_CATALOG_ITEMS = 25;
const MAX_APPROVAL_RESPONSE_BYTES = 192_000;

export async function getCampaignApprovals(campaignId: string, workspaceId: string, limit = MAX_CATALOG_ITEMS) {
  await ensureCampaign(campaignId, workspaceId);
  const boundedLimit = Math.max(1, Math.min(MAX_CATALOG_ITEMS, limit));
  const [plans, pieces, checkpoints, decisions, planCount, pieceCount, checkpointCount] = await Promise.all([
    db.select().from(masterplanVersionsTable).where(and(eq(masterplanVersionsTable.workspaceId, workspaceId), eq(masterplanVersionsTable.campaignId, campaignId), eq(masterplanVersionsTable.status, "pending_approval"))).orderBy(desc(masterplanVersionsTable.version)).limit(boundedLimit + 1),
    db.select().from(contentPiecesTable).where(and(eq(contentPiecesTable.workspaceId, workspaceId), eq(contentPiecesTable.campaignId, campaignId), eq(contentPiecesTable.status, "pending_approval"))).orderBy(desc(contentPiecesTable.createdAt), desc(contentPiecesTable.id)).limit(boundedLimit + 1),
    db.select().from(approvalCheckpointsTable).where(and(eq(approvalCheckpointsTable.campaignId, campaignId), eq(approvalCheckpointsTable.status, "pending"))).orderBy(desc(approvalCheckpointsTable.createdAt), desc(approvalCheckpointsTable.id)).limit(boundedLimit + 1),
    db.select().from(approvalDecisionsTable).where(and(eq(approvalDecisionsTable.workspaceId, workspaceId), eq(approvalDecisionsTable.campaignId, campaignId))).orderBy(desc(approvalDecisionsTable.createdAt)).limit(50),
    db.select({ value: count() }).from(masterplanVersionsTable).where(and(eq(masterplanVersionsTable.workspaceId, workspaceId), eq(masterplanVersionsTable.campaignId, campaignId), eq(masterplanVersionsTable.status, "pending_approval"))),
    db.select({ value: count() }).from(contentPiecesTable).where(and(eq(contentPiecesTable.workspaceId, workspaceId), eq(contentPiecesTable.campaignId, campaignId), eq(contentPiecesTable.status, "pending_approval"))),
    db.select({ value: count() }).from(approvalCheckpointsTable).where(and(eq(approvalCheckpointsTable.campaignId, campaignId), eq(approvalCheckpointsTable.status, "pending"))),
  ]);
  const total = Number(planCount[0]?.value ?? 0) + Number(pieceCount[0]?.value ?? 0) + Number(checkpointCount[0]?.value ?? 0);
  const candidates = [
    ...plans.map(p => item("masterplan", p)),
    ...pieces.map(p => item("content_piece", p)),
    ...checkpoints.map(p => item("checkpoint", p)),
  ];
  const now = new Date();
  const [slaAggregate] = await db.select({
    scheduled: sql<number>`count(*) filter (where status = 'open' and warning_at > ${now})`,
    dueSoon: sql<number>`count(*) filter (where status = 'open' and warning_at <= ${now} and due_at > ${now})`,
    overdue: sql<number>`count(*) filter (where status = 'open' and due_at <= ${now} and expires_at > ${now})`,
    expired: sql<number>`count(*) filter (where status = 'expired' or (status = 'open' and expires_at <= ${now}))`,
  }).from(approvalSlaObligationsTable).where(and(eq(approvalSlaObligationsTable.workspaceId, workspaceId), eq(approvalSlaObligationsTable.campaignId, campaignId)));
  const slaCounts = { scheduled: Number(slaAggregate?.scheduled ?? 0), dueSoon: Number(slaAggregate?.dueSoon ?? 0), overdue: Number(slaAggregate?.overdue ?? 0), expired: Number(slaAggregate?.expired ?? 0) };
  const candidateIds = candidates.map((candidate) => candidate.subjectId);
  const slaRows = candidateIds.length ? await db.select().from(approvalSlaObligationsTable).where(and(eq(approvalSlaObligationsTable.workspaceId, workspaceId), eq(approvalSlaObligationsTable.campaignId, campaignId), inArray(approvalSlaObligationsTable.subjectId, candidateIds))) : [];
  const obligationIds = slaRows.map((row) => row.id);
  const slaEvents = obligationIds.length ? await db.select().from(approvalSlaEventsTable).where(inArray(approvalSlaEventsTable.obligationId, obligationIds)).orderBy(desc(approvalSlaEventsTable.createdAt), desc(approvalSlaEventsTable.id)) : [];
  for (const candidate of candidates) {
    const obligation = slaRows.find((row) => row.subjectType === candidate.subjectType && row.subjectId === candidate.subjectId && row.subjectSnapshotHash === candidate.snapshotHash);
    if (!obligation) continue;
    const events = slaEvents.filter((event) => event.obligationId === obligation.id).slice(0, 25).reverse().map((event) => ({ kind: event.eventKind, deliveredAt: event.deliveredAt, channel: event.channel }));
    const next = (["warning", "due", "escalation", "expired"] as const).find((kind) => !events.some((event) => event.kind === kind));
    const derivedStatus = obligation.status === "resolved" ? "resolved" : now >= obligation.expiresAt ? "expired" : now >= obligation.dueAt ? "overdue" : now >= obligation.warningAt ? "due_soon" : "scheduled";
    Object.assign(candidate, { sla: { status: derivedStatus, dueAt: obligation.dueAt, warningAt: obligation.warningAt, escalationAt: obligation.escalationAt, expiresAt: obligation.expiresAt, deliveredEvents: events, nextEvent: next } });
  }
  const pending = candidates.slice(0, boundedLimit);
  const response = {
    counts: { pending: total, masterplan: Number(planCount[0]?.value ?? 0), contentPiece: Number(pieceCount[0]?.value ?? 0), checkpoint: Number(checkpointCount[0]?.value ?? 0), recentDecisions: decisions.length, slaScheduled: slaCounts.scheduled, slaDueSoon: slaCounts.dueSoon, slaOverdue: slaCounts.overdue, slaExpired: slaCounts.expired },
    total, catalogTruncated: pending.length < total, catalogWarnings: pending.length < total ? ["catalog_item_limit"] : [] as string[],
    pendingItems: pending,
    recentDecisions: decisions.map(publicDecision),
    unavailableSources: [
      { source: "page", status: "adapter_not_governed" },
      { source: "social", status: "adapter_not_governed" },
      { source: "creative", status: "adapter_not_governed" },
      { source: "video", status: "adapter_not_governed" },
    ],
  };
  while (response.pendingItems.length > 0 && Buffer.byteLength(JSON.stringify(response), "utf8") > MAX_APPROVAL_RESPONSE_BYTES) {
    response.pendingItems.pop();
    response.catalogTruncated = true;
    if (!response.catalogWarnings.includes("catalog_byte_limit")) response.catalogWarnings.push("catalog_byte_limit");
  }
  while (response.recentDecisions.length > 0 && Buffer.byteLength(JSON.stringify(response), "utf8") > MAX_APPROVAL_RESPONSE_BYTES) {
    response.recentDecisions.pop();
    if (!response.catalogWarnings.includes("recent_decisions_byte_limit")) response.catalogWarnings.push("recent_decisions_byte_limit");
  }
  if (Buffer.byteLength(JSON.stringify(response), "utf8") > MAX_APPROVAL_RESPONSE_BYTES) {
    throw new AppError(500, "Approval catalog exceeded its safe response budget", "APPROVAL_RESPONSE_LIMIT");
  }
  return response;
}

export async function decideCampaignApproval(workspaceId: string, campaignId: string, subjectType: ApprovalSubjectType, subjectId: string, actorUserId: string, command: ApprovalCommand) {
  requireReason(command);
  if (!command.expectedSnapshotHash || !command.idempotencyKey) invalid("expectedSnapshotHash and idempotencyKey are required");
  await ensureCampaign(campaignId, workspaceId);
  try {
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${workspaceId + ":approval-idempotency:" + command.idempotencyKey}, 0))`);
    if (subjectType === "checkpoint") {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${workspaceId + ":" + campaignId + ":checkpoint-completion"}, 0))`);
    }
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${workspaceId + ":" + campaignId + ":" + subjectType + ":" + subjectId}, 0))`);
    const fingerprint = commandFingerprint(workspaceId, campaignId, subjectType, subjectId, actorUserId, command);
    const [existing] = await tx.select().from(approvalDecisionsTable).where(and(eq(approvalDecisionsTable.workspaceId, workspaceId), eq(approvalDecisionsTable.idempotencyKey, command.idempotencyKey))).limit(1);
    if (existing) {
      if (existing.commandFingerprint !== fingerprint) throw new AppError(409, "Conflicting idempotency replay", "IDEMPOTENCY_CONFLICT");
      return publicDecision(existing);
    }
    let row: any;
    if (subjectType === "masterplan") [row] = await tx.select().from(masterplanVersionsTable).where(and(eq(masterplanVersionsTable.id, subjectId), eq(masterplanVersionsTable.workspaceId, workspaceId), eq(masterplanVersionsTable.campaignId, campaignId))).limit(1);
    else if (subjectType === "content_piece") [row] = await tx.select().from(contentPiecesTable).where(and(eq(contentPiecesTable.id, subjectId), eq(contentPiecesTable.workspaceId, workspaceId), eq(contentPiecesTable.campaignId, campaignId))).limit(1);
    else [row] = await tx.select().from(approvalCheckpointsTable).innerJoin(campaignsTable, eq(approvalCheckpointsTable.campaignId, campaignsTable.id)).where(and(eq(approvalCheckpointsTable.id, subjectId), eq(campaignsTable.workspaceId, workspaceId), eq(approvalCheckpointsTable.campaignId, campaignId))).limit(1).then(rows => rows.map(r => r.approval_checkpoints));
    if (!row) throw new NotFoundError("Approval subject");
    const actionable = (subjectType === "masterplan" && row.status === "pending_approval" && row.readinessStatus !== "blocked") || (subjectType === "content_piece" && row.status === "pending_approval") || (subjectType === "checkpoint" && row.status === "pending");
    const resolvedHash = approvalSnapshotHash(approvalSubjectSnapshot(subjectType, row));
    const [sameSubject] = await tx.select().from(approvalDecisionsTable).where(and(eq(approvalDecisionsTable.workspaceId, workspaceId), eq(approvalDecisionsTable.subjectType, subjectType), eq(approvalDecisionsTable.subjectId, subjectId), eq(approvalDecisionsTable.resolvedSnapshotHash, resolvedHash))).limit(1);
    if (sameSubject) throw new AppError(409, "Approval subject has already been decided", "ALREADY_DECIDED");
    const [sla] = await tx.select().from(approvalSlaObligationsTable).where(and(
      eq(approvalSlaObligationsTable.workspaceId, workspaceId),
      eq(approvalSlaObligationsTable.campaignId, campaignId),
      eq(approvalSlaObligationsTable.subjectType, subjectType),
      eq(approvalSlaObligationsTable.subjectId, subjectId),
      eq(approvalSlaObligationsTable.subjectSnapshotHash, resolvedHash),
    )).limit(1);
    if (sla && new Date() >= sla.expiresAt) throw new AppError(409, "Approval SLA has expired", "APPROVAL_EXPIRED");
    if (sla) await tx.execute(sql`select id from approval_sla_obligations where id = ${sla.id} for update`);
    if (!actionable || resolvedHash !== command.expectedSnapshotHash || (command.expectedVersion !== undefined && row.version !== command.expectedVersion)) throw new AppError(409, "Approval subject is stale or no longer actionable", "STALE_APPROVAL");
    if (subjectType === "masterplan") {
      if (command.decision === "approved") {
        await tx.update(masterplanVersionsTable).set({ status: "superseded", supersededAt: new Date() }).where(and(
          eq(masterplanVersionsTable.workspaceId, workspaceId),
          eq(masterplanVersionsTable.campaignId, campaignId),
          eq(masterplanVersionsTable.status, "approved"),
        ));
        await tx.update(masterplanVersionsTable).set({ status: "approved", approvedAt: new Date(), approvedByUserId: actorUserId }).where(eq(masterplanVersionsTable.id, row.id));
      } else await tx.update(masterplanVersionsTable).set({ status: "superseded", supersededAt: new Date() }).where(eq(masterplanVersionsTable.id, row.id));
    } else if (subjectType === "content_piece") {
      await tx.update(contentPiecesTable).set({ status: command.decision === "approved" ? "approved" : command.decision === "revision_requested" ? "revision_requested" : "rejected", rejectionReason: command.reason ?? null, ...(command.decision === "approved" ? { approvedAt: new Date() } : { rejectedAt: new Date() }) }).where(eq(contentPiecesTable.id, row.id));
    } else {
      await tx.update(approvalCheckpointsTable).set({ status: command.decision, userFeedback: command.reason ?? null, ...(command.decision === "approved" ? { approvedAt: new Date() } : {}) }).where(eq(approvalCheckpointsTable.id, row.id));
    }
    const checkpointData = subjectType === "checkpoint" && row.data && typeof row.data === "object" ? row.data as Record<string, unknown> : {};
    const checkpointMasterplanId = typeof checkpointData.masterplanVersionId === "string"
      ? checkpointData.masterplanVersionId
      : typeof checkpointData.masterplan_version_id === "string"
        ? checkpointData.masterplan_version_id
        : null;
    const checkpointContextFingerprint = typeof checkpointData.contextFingerprint === "string"
      ? checkpointData.contextFingerprint
      : typeof checkpointData.context_fingerprint === "string"
        ? checkpointData.context_fingerprint
        : null;
    const masterplanVersionId = subjectType === "masterplan" ? row.id : checkpointMasterplanId;
    const contextFingerprint = row.contextFingerprint ?? checkpointContextFingerprint;
    const [decision] = await tx.insert(approvalDecisionsTable).values({ workspaceId, campaignId, subjectType, subjectId, subjectVersion: row.version ?? null, decision: command.decision, actorUserId, decisionReason: command.reason ?? null, expectedSnapshotHash: command.expectedSnapshotHash, resolvedSnapshotHash: resolvedHash, masterplanVersionId, contextFingerprint, idempotencyKey: command.idempotencyKey, commandFingerprint: fingerprint, contentPieceId: subjectType === "content_piece" ? row.id : null, checkpointId: subjectType === "checkpoint" ? row.id : null }).returning();
    if (sla) {
      const resolved = await tx.execute(sql`update approval_sla_obligations set status = 'resolved', resolved_decision_id = ${decision.id}, updated_at = clock_timestamp() where id = ${sla.id} and status = 'open' and expires_at > clock_timestamp() returning id`);
      if (!resolved.rowCount) throw new AppError(409, "Approval SLA has expired", "APPROVAL_EXPIRED");
    }
    if (subjectType === "checkpoint" && command.decision === "approved") {
      const [{ pending }] = await tx.select({ pending: count() }).from(approvalCheckpointsTable).where(and(eq(approvalCheckpointsTable.campaignId, campaignId), eq(approvalCheckpointsTable.status, "pending")));
      if (Number(pending) === 0) {
        await transitionCampaignInTransaction(tx, campaignId, workspaceId, "approved", "all approval checkpoints approved", logger);
      }
    }
    return publicDecision(decision);
  });
  return result;
  } catch (error: any) {
    if (error?.code === "23505") {
      if (error?.constraint === "approval_decisions_workspace_idempotency_uidx") {
        throw new AppError(409, "Conflicting idempotency replay", "IDEMPOTENCY_CONFLICT");
      }
      if (error?.constraint === "approval_decisions_workspace_subject_snapshot_uidx"
        || error?.constraint === "approval_decisions_workspace_command_fingerprint_uidx") {
        throw new AppError(409, "Approval subject has already been decided", "ALREADY_DECIDED");
      }
    }
    throw error;
  }
}