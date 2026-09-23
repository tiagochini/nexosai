import { check, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, uniqueIndex, foreignKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { campaignsTable } from "./campaigns";
import { masterplanVersionsTable } from "./masterplan-versions";
import { workspacesTable } from "./workspaces";
import { usersTable } from "./users";

export const realizationActionEnum = pgEnum("realization_action", ["paid_media_pause", "paid_media_launch"]);
export const realizationStateEnum = pgEnum("realization_state", ["proposal", "planned", "approval_binding", "preflight", "blocked", "attempted", "provider_confirmed", "artifact_qc", "monitored", "retryable", "failed", "recovery", "compensated", "exception"]);
export const realizationAttemptStateEnum = pgEnum("realization_attempt_state", ["claimed", "in_flight", "readback", "confirmed", "retryable", "failed", "ambiguous", "compensated", "compensation_failed"]);
export const realizationEventTypeEnum = pgEnum("realization_event_type", ["created", "preflighted", "claimed", "provider_receipt", "readback", "qc", "retry", "monitor", "compensate", "state_changed", "exception"]);

/** Immutable authorization and target binding shared by real provider action families. */
export const realizationContractsTable = pgTable("realization_contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  masterplanVersionId: uuid("masterplan_version_id").notNull().references(() => masterplanVersionsTable.id, { onDelete: "restrict" }),
  action: realizationActionEnum("action").notNull(),
  state: realizationStateEnum("state").notNull().default("proposal"),
  idempotencyKey: text("idempotency_key").notNull(),
  bindingHash: text("binding_hash").notNull(),
  requestFingerprint: text("request_fingerprint").notNull(),
  contextFingerprint: text("context_fingerprint").notNull(),
  snapshotHash: text("snapshot_hash").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: uuid("subject_id").notNull(),
  binding: jsonb("binding").notNull(),
  maxAttempts: integer("max_attempts").notNull().default(3),
  attemptsUsed: integer("attempts_used").notNull().default(0),
  createdByUserId: uuid("created_by_user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex("realization_contracts_workspace_idempotency_uidx").on(t.workspaceId, t.idempotencyKey),
  uniqueIndex("realization_contracts_workspace_id_uidx").on(t.workspaceId, t.id),
  index("realization_contracts_workspace_campaign_idx").on(t.workspaceId, t.campaignId, t.createdAt),
  foreignKey({ columns: [t.workspaceId, t.campaignId], foreignColumns: [campaignsTable.workspaceId, campaignsTable.id], name: "realization_contracts_campaign_scope_fk" }),
  foreignKey({ columns: [t.workspaceId, t.campaignId, t.masterplanVersionId], foreignColumns: [masterplanVersionsTable.workspaceId, masterplanVersionsTable.campaignId, masterplanVersionsTable.id], name: "realization_contracts_masterplan_scope_fk" }),
  check("realization_contracts_max_attempts_check", sql`${t.maxAttempts} between 1 and 10`),
]);

export const realizationAttemptsTable = pgTable("realization_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contract_id").notNull().references(() => realizationContractsTable.id, { onDelete: "restrict" }),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  state: realizationAttemptStateEnum("state").notNull().default("claimed"),
  receipt: jsonb("receipt"),
  readback: jsonb("readback"),
  error: jsonb("error"),
  claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  leaseOwner: text("lease_owner"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  qc: jsonb("qc"),
  retry: jsonb("retry"),
  recovery: jsonb("recovery"),
  compensation: jsonb("compensation"),
}, (t) => [
  uniqueIndex("realization_attempts_contract_number_uidx").on(t.contractId, t.number),
  uniqueIndex("realization_attempts_workspace_contract_id_uidx").on(t.workspaceId, t.contractId, t.id),
  index("realization_attempts_workspace_idx").on(t.workspaceId, t.claimedAt),
  foreignKey({ columns: [t.workspaceId, t.contractId], foreignColumns: [realizationContractsTable.workspaceId, realizationContractsTable.id], name: "realization_attempts_contract_scope_fk" }),
  check("realization_attempts_number_check", sql`${t.number} between 1 and 10`),
]);

export const realizationEventsTable = pgTable("realization_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contract_id").notNull().references(() => realizationContractsTable.id, { onDelete: "restrict" }),
  attemptId: uuid("attempt_id").references(() => realizationAttemptsTable.id, { onDelete: "restrict" }),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  type: realizationEventTypeEnum("type").notNull(),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("realization_events_contract_created_idx").on(t.contractId, t.createdAt),
  foreignKey({ columns: [t.workspaceId, t.contractId], foreignColumns: [realizationContractsTable.workspaceId, realizationContractsTable.id], name: "realization_events_contract_scope_fk" }),
  foreignKey({ columns: [t.workspaceId, t.contractId, t.attemptId], foreignColumns: [realizationAttemptsTable.workspaceId, realizationAttemptsTable.contractId, realizationAttemptsTable.id], name: "realization_events_attempt_scope_fk" }),
]);