import { pgEnum, pgTable, uuid, text, timestamp, integer, jsonb, index, uniqueIndex, check, foreignKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { campaignsTable } from "./campaigns";
import { contentPiecesTable } from "./content";
import { masterplanVersionsTable } from "./masterplan-versions";
import { approvalCheckpointsTable } from "./approval-checkpoints";
import { workspacesTable } from "./workspaces";
import { approvalDecisionsTable } from "./approval-decisions";
import { usersTable } from "./users";
import { PUBLISH_STAGE_ONE } from "./publish-staging";

export const approvalSlaStatusEnum = pgEnum("approval_sla_status", ["open", "resolved", "expired"]);
export const approvalSlaEventKindEnum = pgEnum("approval_sla_event_kind", ["warning", "due", "escalation", "expired"]);
export const approvalSlaChannelEnum = pgEnum("approval_sla_channel", ["in_app"]);

export const approvalSlaObligationsTable = pgTable("approval_sla_obligations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  masterplanVersionId: uuid("masterplan_version_id"),
  contentPieceId: uuid("content_piece_id"),
  checkpointId: uuid("checkpoint_id"),
  subjectSnapshotHash: text("subject_snapshot_hash").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  commandFingerprint: text("command_fingerprint").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  warningAt: timestamp("warning_at", { withTimezone: true }).notNull(),
  escalationAt: timestamp("escalation_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  status: approvalSlaStatusEnum("status").notNull().default("open"),
  channel: approvalSlaChannelEnum("channel").notNull().default("in_app"),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  resolvedDecisionId: uuid("resolved_decision_id").references(() => approvalDecisionsTable.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("approval_sla_obligations_workspace_id_uidx").on(table.workspaceId, table.id),
  uniqueIndex("approval_sla_obligations_subject_uidx").on(table.workspaceId, table.campaignId, table.subjectType, table.subjectId, table.subjectSnapshotHash),
  uniqueIndex("approval_sla_obligations_idempotency_uidx").on(table.workspaceId, table.idempotencyKey),
  index("approval_sla_obligations_due_idx").on(table.status, table.dueAt),
  check("approval_sla_obligations_window_check", sql`${table.warningAt} < ${table.dueAt} AND ${table.dueAt} < ${table.escalationAt} AND ${table.escalationAt} <= ${table.expiresAt}`),
  check("approval_sla_obligations_subject_typed_check", sql`(
    ("subject_type" = 'masterplan' AND "masterplan_version_id"::text = "subject_id" AND "content_piece_id" IS NULL AND "checkpoint_id" IS NULL)
    OR ("subject_type" = 'content_piece' AND "content_piece_id"::text = "subject_id" AND "masterplan_version_id" IS NULL AND "checkpoint_id" IS NULL)
    OR ("subject_type" = 'checkpoint' AND "checkpoint_id"::text = "subject_id" AND "masterplan_version_id" IS NULL AND "content_piece_id" IS NULL)
  )`),
  ...(PUBLISH_STAGE_ONE ? [] : [
    foreignKey({ columns: [table.workspaceId, table.createdBy], foreignColumns: [workspacesTable.id, workspacesTable.ownerId], name: "approval_sla_workspace_creator_fk" }),
    foreignKey({ columns: [table.workspaceId, table.campaignId, table.masterplanVersionId], foreignColumns: [masterplanVersionsTable.workspaceId, masterplanVersionsTable.campaignId, masterplanVersionsTable.id], name: "approval_sla_masterplan_scope_fk" }),
    foreignKey({ columns: [table.workspaceId, table.campaignId, table.contentPieceId], foreignColumns: [contentPiecesTable.workspaceId, contentPiecesTable.campaignId, contentPiecesTable.id], name: "approval_sla_content_scope_fk" }),
    foreignKey({ columns: [table.campaignId, table.checkpointId], foreignColumns: [approvalCheckpointsTable.campaignId, approvalCheckpointsTable.id], name: "approval_sla_checkpoint_scope_fk" }),
  ]),
]);

export const approvalSlaEventsTable = pgTable("approval_sla_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  obligationId: uuid("obligation_id").notNull().references(() => approvalSlaObligationsTable.id, { onDelete: "cascade" }),
  eventKind: approvalSlaEventKindEnum("event_kind").notNull(),
  channel: approvalSlaChannelEnum("channel").notNull().default("in_app"),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }).notNull().defaultNow(),
  receipt: jsonb("receipt").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("approval_sla_events_obligation_kind_channel_uidx").on(table.obligationId, table.eventKind, table.channel),
  index("approval_sla_events_workspace_idx").on(table.workspaceId, table.createdAt),
  ...(PUBLISH_STAGE_ONE ? [] : [
    foreignKey({ columns: [table.workspaceId, table.obligationId], foreignColumns: [approvalSlaObligationsTable.workspaceId, approvalSlaObligationsTable.id], name: "approval_sla_events_scope_fk" }),
  ]),
]);