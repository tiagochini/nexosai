import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  check,
  foreignKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { campaignsTable } from "./campaigns";
import { contentPiecesTable } from "./content";
import { approvalCheckpointsTable } from "./approval-checkpoints";
import { masterplanVersionsTable } from "./masterplan-versions";
import { usersTable } from "./users";
import { workspacesTable } from "./workspaces";
import { PUBLISH_STAGE_ONE } from "./publish-staging";

export const approvalSubjectTypeEnum = pgEnum("approval_subject_type", [
  "masterplan",
  "content_piece",
  "checkpoint",
]);

export const approvalDecisionEnum = pgEnum("approval_decision", [
  "approved",
  "rejected",
  "revision_requested",
]);

/**
 * Immutable record of an approval-center command. There intentionally are no
 * update/delete helpers for this table: the decision log is append-only.
 */
export const approvalDecisionsTable = pgTable(
  "approval_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaignsTable.id, { onDelete: "cascade" }),
    subjectType: approvalSubjectTypeEnum("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    subjectVersion: integer("subject_version"),
    decision: approvalDecisionEnum("decision").notNull(),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "restrict" }),
    decisionReason: text("decision_reason"),
    expectedSnapshotHash: text("expected_snapshot_hash").notNull(),
    resolvedSnapshotHash: text("resolved_snapshot_hash").notNull(),
    masterplanVersionId: uuid("masterplan_version_id"),
    contextFingerprint: text("context_fingerprint"),
    idempotencyKey: text("idempotency_key").notNull(),
    commandFingerprint: text("command_fingerprint").notNull(),
    contentPieceId: uuid("content_piece_id"),
    checkpointId: uuid("checkpoint_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("approval_decisions_workspace_idempotency_uidx").on(
      table.workspaceId,
      table.idempotencyKey,
    ),
    uniqueIndex("approval_decisions_workspace_subject_snapshot_uidx").on(
      table.workspaceId,
      table.subjectType,
      table.subjectId,
      table.resolvedSnapshotHash,
    ),
    uniqueIndex("approval_decisions_workspace_command_fingerprint_uidx").on(
      table.workspaceId,
      table.commandFingerprint,
    ),
    index("approval_decisions_campaign_subject_idx").on(
      table.workspaceId,
      table.campaignId,
      table.subjectType,
      table.subjectId,
    ),
    index("approval_decisions_actor_idx").on(table.workspaceId, table.actorUserId),
    check(
      "approval_decisions_reason_required_check",
      sql`("decision" = 'approved' AND "decision_reason" IS NULL) OR ("decision" <> 'approved' AND length(trim("decision_reason")) > 0)`,
    ),
    check(
      "approval_decisions_snapshot_hash_match_check",
      sql`"expected_snapshot_hash" = "resolved_snapshot_hash"`,
    ),
    check(
      "approval_decisions_subject_typed_check",
      sql`(
        ("subject_type" = 'masterplan' AND "masterplan_version_id"::text = "subject_id" AND "content_piece_id" IS NULL AND "checkpoint_id" IS NULL)
        OR ("subject_type" = 'content_piece' AND "content_piece_id"::text = "subject_id" AND "masterplan_version_id" IS NULL AND "checkpoint_id" IS NULL)
        OR ("subject_type" = 'checkpoint' AND "checkpoint_id"::text = "subject_id" AND "content_piece_id" IS NULL)
      )`,
    ),
    ...(PUBLISH_STAGE_ONE ? [] : [
      foreignKey({
        columns: [table.workspaceId, table.campaignId],
        foreignColumns: [campaignsTable.workspaceId, campaignsTable.id],
        name: "approval_decisions_campaign_workspace_fk",
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.workspaceId, table.actorUserId],
        foreignColumns: [workspacesTable.id, workspacesTable.ownerId],
        name: "approval_decisions_workspace_actor_fk",
      }).onDelete("restrict"),
      foreignKey({
        columns: [table.workspaceId, table.campaignId, table.masterplanVersionId],
        foreignColumns: [masterplanVersionsTable.workspaceId, masterplanVersionsTable.campaignId, masterplanVersionsTable.id],
        name: "approval_decisions_masterplan_scope_fk",
      }).onDelete("restrict"),
      foreignKey({
        columns: [table.workspaceId, table.campaignId, table.contentPieceId],
        foreignColumns: [contentPiecesTable.workspaceId, contentPiecesTable.campaignId, contentPiecesTable.id],
        name: "approval_decisions_content_piece_scope_fk",
      }).onDelete("restrict"),
      foreignKey({
        columns: [table.campaignId, table.checkpointId],
        foreignColumns: [approvalCheckpointsTable.campaignId, approvalCheckpointsTable.id],
        name: "approval_decisions_checkpoint_scope_fk",
      }).onDelete("restrict"),
    ]),
  ],
);

export const insertApprovalDecisionSchema = createInsertSchema(
  approvalDecisionsTable,
).omit({ id: true, createdAt: true });

export type InsertApprovalDecision = z.infer<
  typeof insertApprovalDecisionSchema
>;
export type ApprovalDecision = typeof approvalDecisionsTable.$inferSelect;