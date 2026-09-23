import { and, eq, lte, sql, asc } from "drizzle-orm";
import { AppError } from "../../lib/errors.js";
import { db, approvalSlaEventsTable, approvalSlaObligationsTable, auditLogsTable, approvalCheckpointsTable, contentPiecesTable, masterplanVersionsTable, campaignsTable, workspacesTable } from "@workspace/db";
import { approvalSnapshotHash, approvalSubjectSnapshot } from "./approval-center.service.js";
import { registerScheduler, runSchedulerTick } from "../operations/scheduler-health.registry.js";

export type SlaSchedule = {
  subjectType: "masterplan" | "content_piece" | "checkpoint";
  subjectId: string;
  subjectSnapshotHash: string;
  dueAt: string;
  warningAt?: string;
  escalationAt: string;
  expiresAt: string;
  channel?: "in_app";
  idempotencyKey: string;
};

export function publicSlaObligation(row: any) {
  return {
    id: row.id, subjectType: row.subjectType, subjectId: row.subjectId,
    subjectSnapshotHash: row.subjectSnapshotHash, status: row.status, channel: row.channel,
    warningAt: row.warningAt, dueAt: row.dueAt, escalationAt: row.escalationAt,
    expiresAt: row.expiresAt, createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

function dates(input: SlaSchedule) {
  const due = new Date(input.dueAt);
  const warning = new Date(input.warningAt ?? due.getTime() - 60 * 60 * 1000);
  const escalation = new Date(input.escalationAt);
  const expires = new Date(input.expiresAt);
  if ([due, warning, escalation, expires].some((d) => Number.isNaN(d.getTime())) || !(warning < due && due < escalation && escalation <= expires)) {
    throw new AppError(400, "SLA timestamps must satisfy warningAt < dueAt < escalationAt <= expiresAt", "INVALID_SLA_WINDOW");
  }
  if (warning.getTime() !== due.getTime() - 60 * 60 * 1000) throw new AppError(400, "warningAt must be exactly 60 minutes before dueAt", "INVALID_SLA_WINDOW");
  return { due, warning, escalation, expires };
}

export async function scheduleApprovalSla(workspaceId: string, campaignId: string, createdBy: string, input: SlaSchedule) {
  if (input.channel && input.channel !== "in_app") throw new AppError(400, "Only in_app SLA reminders are supported", "UNSUPPORTED_SLA_CHANNEL");
  if (!input.subjectSnapshotHash || !input.idempotencyKey) throw new AppError(400, "subjectSnapshotHash and idempotencyKey are required", "VALIDATION_ERROR");
  const { due, warning, escalation, expires } = dates(input);
  const fingerprint = approvalSnapshotHash({ workspaceId, campaignId, createdBy, subjectType: input.subjectType, subjectId: input.subjectId, subjectSnapshotHash: input.subjectSnapshotHash, warningAt: warning.toISOString(), dueAt: due.toISOString(), escalationAt: escalation.toISOString(), expiresAt: expires.toISOString(), channel: "in_app" });
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${workspaceId + ":sla:" + input.idempotencyKey}, 0))`);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${workspaceId + ":" + campaignId + ":" + input.subjectType + ":" + input.subjectId}, 0))`);
    const [campaign] = await tx.select({ id: campaignsTable.id }).from(campaignsTable).where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId))).limit(1);
    if (!campaign) throw new AppError(404, "Campaign not found", "NOT_FOUND");
    const [authorizedCreator] = await tx.select({ id: workspacesTable.id }).from(workspacesTable).where(and(eq(workspacesTable.id, workspaceId), eq(workspacesTable.ownerId, createdBy))).limit(1);
    if (!authorizedCreator) throw new AppError(403, "Only the workspace owner can schedule approval SLAs", "FORBIDDEN");
    const [existing] = await tx.select().from(approvalSlaObligationsTable).where(and(eq(approvalSlaObligationsTable.workspaceId, workspaceId), eq(approvalSlaObligationsTable.idempotencyKey, input.idempotencyKey))).limit(1);
    if (existing) {
      if (existing.commandFingerprint !== fingerprint) throw new AppError(409, "Conflicting SLA replay", "IDEMPOTENCY_CONFLICT");
      return existing;
    }
    const [existingSubjectSla] = await tx.select().from(approvalSlaObligationsTable).where(and(
      eq(approvalSlaObligationsTable.workspaceId, workspaceId),
      eq(approvalSlaObligationsTable.campaignId, campaignId),
      eq(approvalSlaObligationsTable.subjectType, input.subjectType),
      eq(approvalSlaObligationsTable.subjectId, input.subjectId),
      eq(approvalSlaObligationsTable.subjectSnapshotHash, input.subjectSnapshotHash),
    )).limit(1);
    if (existingSubjectSla) {
      if (existingSubjectSla.commandFingerprint === fingerprint) return existingSubjectSla;
      throw new AppError(409, "An SLA is already scheduled for this exact approval snapshot", "SLA_ALREADY_SCHEDULED");
    }
    const [row] = input.subjectType === "masterplan"
      ? await tx.select().from(masterplanVersionsTable).where(and(eq(masterplanVersionsTable.id, input.subjectId), eq(masterplanVersionsTable.workspaceId, workspaceId), eq(masterplanVersionsTable.campaignId, campaignId))).limit(1)
      : input.subjectType === "content_piece"
        ? await tx.select().from(contentPiecesTable).where(and(eq(contentPiecesTable.id, input.subjectId), eq(contentPiecesTable.workspaceId, workspaceId), eq(contentPiecesTable.campaignId, campaignId))).limit(1)
        : await tx.select().from(approvalCheckpointsTable).where(and(eq(approvalCheckpointsTable.id, input.subjectId), eq(approvalCheckpointsTable.campaignId, campaignId))).limit(1);
    if (!row) throw new AppError(404, "Approval subject not found", "NOT_FOUND");
    const actionable = (input.subjectType === "masterplan" && row.status === "pending_approval" && (row as any).readinessStatus !== "blocked") || (input.subjectType === "content_piece" && row.status === "pending_approval") || (input.subjectType === "checkpoint" && row.status === "pending");
    const actualHash = approvalSnapshotHash(approvalSubjectSnapshot(input.subjectType, row));
    if (!actionable || actualHash !== input.subjectSnapshotHash) throw new AppError(409, "Approval subject is stale or no longer actionable", "STALE_APPROVAL");
    const [created] = await tx.insert(approvalSlaObligationsTable).values({
      workspaceId, campaignId, createdBy, subjectType: input.subjectType, subjectId: input.subjectId,
      subjectSnapshotHash: input.subjectSnapshotHash, idempotencyKey: input.idempotencyKey, commandFingerprint: fingerprint, dueAt: due, warningAt: warning, escalationAt: escalation, expiresAt: expires,
      channel: "in_app",
      masterplanVersionId: input.subjectType === "masterplan" ? input.subjectId : null,
      contentPieceId: input.subjectType === "content_piece" ? input.subjectId : null,
      checkpointId: input.subjectType === "checkpoint" ? input.subjectId : null,
    }).returning();
    return created;
  });
  return publicSlaObligation(result);
}

/** Claims due reminder events with a unique constraint, making concurrent ticks safe. */
export async function processApprovalSla(now = new Date()) {
  const obligations = await db.select().from(approvalSlaObligationsTable).where(and(
    eq(approvalSlaObligationsTable.status, "open"),
    sql`(
      ("warning_at" <= ${now} AND NOT EXISTS (SELECT 1 FROM approval_sla_events e WHERE e.obligation_id = approval_sla_obligations.id AND e.event_kind = 'warning'))
      OR ("due_at" <= ${now} AND NOT EXISTS (SELECT 1 FROM approval_sla_events e WHERE e.obligation_id = approval_sla_obligations.id AND e.event_kind = 'due'))
      OR ("escalation_at" <= ${now} AND NOT EXISTS (SELECT 1 FROM approval_sla_events e WHERE e.obligation_id = approval_sla_obligations.id AND e.event_kind = 'escalation'))
      OR ("expires_at" <= ${now} AND NOT EXISTS (SELECT 1 FROM approval_sla_events e WHERE e.obligation_id = approval_sla_obligations.id AND e.event_kind = 'expired'))
    )`,
  )).orderBy(asc(approvalSlaObligationsTable.dueAt), asc(approvalSlaObligationsTable.id)).limit(250);
  let delivered = 0;
  for (let obligation of obligations) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${obligation.workspaceId + ":" + obligation.campaignId + ":" + obligation.subjectType + ":" + obligation.subjectId}, 0))`);
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${obligation.id + ":sla-events"}, 0))`);
      const [current] = await tx.select().from(approvalSlaObligationsTable).where(eq(approvalSlaObligationsTable.id, obligation.id)).limit(1);
      if (!current || current.status !== "open") return;
      obligation = current;
      const events: Array<"warning" | "due" | "escalation" | "expired"> = [];
      if (now >= obligation.warningAt) events.push("warning");
      if (now >= obligation.dueAt) events.push("due");
      if (now >= obligation.escalationAt) events.push("escalation");
      if (now >= obligation.expiresAt) events.push("expired");
      for (const eventKind of events) {
        const inserted = await tx.insert(approvalSlaEventsTable).values({
          workspaceId: obligation.workspaceId, obligationId: obligation.id, eventKind, channel: "in_app",
          receipt: { kind: eventKind, deliveredAt: now.toISOString() },
        }).onConflictDoNothing().returning({ id: approvalSlaEventsTable.id });
        if (inserted.length) {
          await tx.insert(auditLogsTable).values({
            workspaceId: obligation.workspaceId,
            campaignId: obligation.campaignId,
            action: "approval_sla_reminder_delivered",
            actor: "system",
            data: { obligationId: obligation.id, subjectType: obligation.subjectType, subjectId: obligation.subjectId.slice(0, 128), subjectSnapshotHash: obligation.subjectSnapshotHash.slice(0, 128), eventKind, channel: "in_app", receipt: { deliveredAt: now.toISOString() } },
          });
        }
        delivered += inserted.length;
      }
      if (now >= obligation.expiresAt) {
        await tx.update(approvalSlaObligationsTable).set({ status: "expired", updatedAt: now }).where(and(eq(approvalSlaObligationsTable.id, obligation.id), eq(approvalSlaObligationsTable.status, "open")));
      }
    });
  }
  return { examined: obligations.length, delivered };
}

let slaTimer: NodeJS.Timeout | undefined;
export function startApprovalSlaScheduler(): void {
  if (slaTimer) return;
  registerScheduler("approval-sla", 180_000);
  slaTimer = setInterval(() => {
    void runSchedulerTick("approval-sla", async () => { await processApprovalSla(); }).catch(() => undefined);
  }, 60_000);
  slaTimer.unref();
}
export function stopApprovalSlaScheduler(): void {
  if (slaTimer) clearInterval(slaTimer);
  slaTimer = undefined;
}