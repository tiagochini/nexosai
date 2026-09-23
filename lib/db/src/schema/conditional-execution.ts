import { pgEnum, pgTable, uuid, text, boolean, integer, timestamp, jsonb, index, uniqueIndex, check, foreignKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspacesTable } from "./workspaces";
import { campaignsTable } from "./campaigns";
import { usersTable } from "./users";
import { masterplanVersionsTable } from "./masterplan-versions";
import { paidMediaAccountsTable, paidMediaEntitiesTable, paidMediaProposalsTable } from "./paid-media";

export const conditionalActionEnum = pgEnum("conditional_execution_action", ["paid_media_pause"]);
export const conditionalIntentStatusEnum = pgEnum("conditional_execution_intent_status", ["planned", "blocked", "eligible", "attempted", "confirmed", "ambiguous", "recovery_required"]);
export const conditionalAttemptStatusEnum = pgEnum("conditional_execution_attempt_status", ["attempted", "confirmed", "ambiguous", "recovery_required"]);

/** Versioned, campaign-scoped authorization. Identity columns are immutable in SQL. */
export const conditionalExecutionPoliciesTable = pgTable("conditional_execution_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  masterplanVersionId: uuid("masterplan_version_id").notNull().references(() => masterplanVersionsTable.id, { onDelete: "restrict" }),
  snapshotHash: text("snapshot_hash").notNull(),
  contextFingerprint: text("context_fingerprint").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ownerUserId: uuid("owner_user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  idempotencyKey: text("idempotency_key").notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedBy: uuid("revoked_by").references(() => usersTable.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("conditional_execution_policies_campaign_version_uidx").on(t.workspaceId, t.campaignId, t.version),
  uniqueIndex("conditional_execution_policies_idempotency_uidx").on(t.workspaceId, t.idempotencyKey),
  uniqueIndex("conditional_execution_policies_campaign_id_uidx").on(t.workspaceId, t.campaignId, t.id),
  index("conditional_execution_policies_current_idx").on(t.workspaceId, t.campaignId, t.enabled),
  foreignKey({ columns: [t.workspaceId, t.campaignId], foreignColumns: [campaignsTable.workspaceId, campaignsTable.id], name: "conditional_policies_campaign_scope_fk" }),
  foreignKey({ columns: [t.workspaceId, t.ownerUserId], foreignColumns: [workspacesTable.id, workspacesTable.ownerId], name: "conditional_policies_owner_fk" }),
  foreignKey({ columns: [t.workspaceId, t.campaignId, t.masterplanVersionId], foreignColumns: [masterplanVersionsTable.workspaceId, masterplanVersionsTable.campaignId, masterplanVersionsTable.id], name: "conditional_policies_masterplan_scope_fk" }),
  check("conditional_execution_policy_version_check", sql`${t.version} >= 1`),
]);

export const conditionalExecutionPolicyActionsTable = pgTable("conditional_execution_policy_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  policyId: uuid("policy_id").notNull().references(() => conditionalExecutionPoliciesTable.id, { onDelete: "restrict" }),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  actionType: conditionalActionEnum("action_type").notNull(),
  provider: text("provider").notNull(),
  accountId: uuid("account_id").notNull().references(() => paidMediaAccountsTable.id, { onDelete: "restrict" }),
  entityId: uuid("entity_id").notNull().references(() => paidMediaEntitiesTable.id, { onDelete: "restrict" }),
  maxActionsPerDay: integer("max_actions_per_day").notNull(),
}, (t) => [
  uniqueIndex("conditional_policy_actions_policy_target_uidx").on(t.policyId, t.provider, t.accountId, t.entityId, t.actionType),
    uniqueIndex("conditional_actions_workspace_policy_id_uidx").on(t.workspaceId, t.policyId, t.id),
    foreignKey({ columns: [t.workspaceId, t.policyId], foreignColumns: [conditionalExecutionPoliciesTable.workspaceId, conditionalExecutionPoliciesTable.id], name: "conditional_actions_policy_scope_fk" }),
    foreignKey({ columns: [t.workspaceId, t.accountId], foreignColumns: [paidMediaAccountsTable.workspaceId, paidMediaAccountsTable.id], name: "conditional_actions_account_scope_fk" }),
    foreignKey({ columns: [t.workspaceId, t.entityId], foreignColumns: [paidMediaEntitiesTable.workspaceId, paidMediaEntitiesTable.id], name: "conditional_actions_entity_scope_fk" }),
  check("conditional_policy_actions_ceiling_check", sql`${t.maxActionsPerDay} >= 1 AND ${t.maxActionsPerDay} <= 100`),
]);
export const conditionalExecutionPolicyEventsTable = pgTable("conditional_execution_policy_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  policyId: uuid("policy_id").notNull().references(() => conditionalExecutionPoliciesTable.id, { onDelete: "restrict" }),
  eventType: text("event_type").notNull(),
  actorUserId: uuid("actor_user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }, (t) => [
    index("conditional_policy_events_policy_idx").on(t.policyId, t.createdAt),
    foreignKey({ columns: [t.workspaceId, t.policyId], foreignColumns: [conditionalExecutionPoliciesTable.workspaceId, conditionalExecutionPoliciesTable.id], name: "conditional_policy_events_policy_scope_fk" }),
  ]);

export const conditionalExecutionIntentsTable = pgTable("conditional_execution_intents", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  policyId: uuid("policy_id").notNull().references(() => conditionalExecutionPoliciesTable.id, { onDelete: "restrict" }),
  policyActionId: uuid("policy_action_id").notNull().references(() => conditionalExecutionPolicyActionsTable.id, { onDelete: "restrict" }),
  proposalId: uuid("proposal_id").notNull().references(() => paidMediaProposalsTable.id, { onDelete: "restrict" }),
  intentKey: text("intent_key").notNull(),
  status: conditionalIntentStatusEnum("status").notNull().default("planned"),
  blockCode: text("block_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
 }, (t) => [
   uniqueIndex("conditional_execution_intents_key_uidx").on(t.workspaceId, t.intentKey),
   index("conditional_execution_intents_campaign_idx").on(t.workspaceId, t.campaignId, t.createdAt),
   foreignKey({ columns: [t.workspaceId, t.proposalId], foreignColumns: [paidMediaProposalsTable.workspaceId, paidMediaProposalsTable.id], name: "conditional_intents_proposal_scope_fk" }),
   foreignKey({ columns: [t.workspaceId, t.campaignId, t.policyId], foreignColumns: [conditionalExecutionPoliciesTable.workspaceId, conditionalExecutionPoliciesTable.campaignId, conditionalExecutionPoliciesTable.id], name: "conditional_intents_policy_campaign_fk" }),
   foreignKey({ columns: [t.workspaceId, t.policyId, t.policyActionId], foreignColumns: [conditionalExecutionPolicyActionsTable.workspaceId, conditionalExecutionPolicyActionsTable.policyId, conditionalExecutionPolicyActionsTable.id], name: "conditional_intents_action_policy_scope_fk" }),
 ]);

export const conditionalExecutionAttemptsTable = pgTable("conditional_execution_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  intentId: uuid("intent_id").notNull().references(() => conditionalExecutionIntentsTable.id, { onDelete: "restrict" }),
  attemptKey: text("attempt_key").notNull(),
  status: conditionalAttemptStatusEnum("status").notNull().default("attempted"),
  providerReceipt: jsonb("provider_receipt"),
  readback: jsonb("readback"),
  errorCode: text("error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  leaseOwner: text("lease_owner"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  applyStartedAt: timestamp("apply_started_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [uniqueIndex("conditional_execution_attempts_key_uidx").on(t.workspaceId, t.attemptKey)]);

export const conditionalExecutionEventsTable = pgTable("conditional_execution_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  intentId: uuid("intent_id").notNull().references(() => conditionalExecutionIntentsTable.id, { onDelete: "restrict" }),
  eventType: text("event_type").notNull(),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("conditional_execution_events_intent_idx").on(t.intentId, t.createdAt)]);

export type ConditionalExecutionPolicy = typeof conditionalExecutionPoliciesTable.$inferSelect;