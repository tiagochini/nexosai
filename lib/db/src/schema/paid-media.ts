import {
  boolean,
  date,
  decimal,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { workspaceIntegrationsTable } from "./workspace-integrations";
import { workspacesTable } from "./workspaces";

/** Providers that have an executable paid-media adapter. */
export const paidMediaProviderEnum = pgEnum("paid_media_provider", [
  "meta_ads",
  "tiktok_ads",
]);

export const paidMediaEntityTypeEnum = pgEnum("paid_media_entity_type", [
  "campaign",
  "ad_set",
  "ad",
  "creative",
]);

export const paidMediaDateGrainEnum = pgEnum("paid_media_date_grain", [
  "daily",
  "hourly",
  "lifetime",
]);

export const paidMediaProposalStatusEnum = pgEnum("paid_media_proposal_status", [
  "pending_approval",
  "approved",
  "rejected",
  "expired",
  "executing",
  "verified",
  "failed",
  "rolled_back",
]);

export const paidMediaActionTypeEnum = pgEnum("paid_media_action_type", [
  "pause",
  "resume",
  "update_daily_budget",
  "update_bid",
  "update_creative_status",
  "update_creative_rotation",
  "cross_platform_budget_move",
]);

export const paidMediaAttemptStatusEnum = pgEnum("paid_media_attempt_status", [
  "pending",
  "executing",
  "succeeded",
  "failed",
  "verification_failed",
  "rolled_back",
]);

// A selected advertiser account. OAuth credentials remain solely in
// workspace_integrations; this table deliberately contains no credentials.
export const paidMediaAccountsTable = pgTable(
  "paid_media_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    integrationId: uuid("integration_id")
      .notNull()
      .references(() => workspaceIntegrationsTable.id, { onDelete: "cascade" }),
    provider: paidMediaProviderEnum("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    accountName: text("account_name"),
    currency: text("currency").notNull(),
    timezone: text("timezone").notNull(),
    isSelected: boolean("is_selected").notNull().default(false),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
    selectedAt: timestamp("selected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("paid_media_accounts_provider_account_unique").on(
      table.workspaceId,
      table.provider,
      table.providerAccountId,
    ),
    index("paid_media_accounts_workspace_provider_idx").on(table.workspaceId, table.provider),
  ],
);

export const paidMediaEntitiesTable = pgTable(
  "paid_media_entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => paidMediaAccountsTable.id, { onDelete: "cascade" }),
    provider: paidMediaProviderEnum("provider").notNull(),
    providerEntityId: text("provider_entity_id").notNull(),
    entityType: paidMediaEntityTypeEnum("entity_type").notNull(),
    parentProviderEntityId: text("parent_provider_entity_id"),
    name: text("name"),
    status: text("status"),
    version: text("version"),
    currency: text("currency").notNull(),
    timezone: text("timezone").notNull(),
    providerData: jsonb("provider_data").notNull().default({}),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("paid_media_entities_account_entity_unique").on(
      table.accountId,
      table.providerEntityId,
      table.entityType,
    ),
    index("paid_media_entities_workspace_account_idx").on(table.workspaceId, table.accountId),
  ],
);

export const paidMediaSyncCursorsTable = pgTable(
  "paid_media_sync_cursors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => paidMediaAccountsTable.id, { onDelete: "cascade" }),
    entityType: paidMediaEntityTypeEnum("entity_type").notNull(),
    cursor: text("cursor"),
    syncedThrough: timestamp("synced_through", { withTimezone: true }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    claimToken: uuid("claim_token"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("paid_media_sync_cursors_account_entity_unique").on(table.accountId, table.entityType),
    index("paid_media_sync_cursors_claim_idx").on(table.claimedAt),
  ],
);

export const paidMediaInsightsTable = pgTable(
  "paid_media_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => paidMediaAccountsTable.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => paidMediaEntitiesTable.id, { onDelete: "cascade" }),
    provider: paidMediaProviderEnum("provider").notNull(),
    providerInsightId: text("provider_insight_id"),
    metricDate: date("metric_date").notNull(),
    dateGrain: paidMediaDateGrainEnum("date_grain").notNull().default("daily"),
    attributionWindow: text("attribution_window"),
    currency: text("currency").notNull(),
    timezone: text("timezone").notNull(),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    spend: decimal("spend", { precision: 18, scale: 6 }).notNull().default("0"),
    conversions: decimal("conversions", { precision: 18, scale: 6 }).notNull().default("0"),
    conversionValue: decimal("conversion_value", { precision: 18, scale: 6 }).notNull().default("0"),
    rawMetrics: jsonb("raw_metrics").notNull().default({}),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("paid_media_insights_idempotency_unique").on(
      table.entityId,
      table.metricDate,
      table.dateGrain,
      table.attributionWindow,
    ),
    index("paid_media_insights_workspace_date_idx").on(table.workspaceId, table.metricDate),
  ],
);

export const paidMediaPoliciesTable = pgTable(
  "paid_media_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    provider: paidMediaProviderEnum("provider"),
    accountId: uuid("account_id").references(() => paidMediaAccountsTable.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(false),
    autoExecute: boolean("auto_execute").notNull().default(false),
    mandatoryPause: boolean("mandatory_pause").notNull().default(false),
    mandatoryPauseReason: text("mandatory_pause_reason"),
    minimumSampleSize: integer("minimum_sample_size").notNull().default(0),
    minimumDataQualityScore: decimal("minimum_data_quality_score", { precision: 5, scale: 4 })
      .notNull()
      .default("0"),
    maxDailyBudgetChangePercent: decimal("max_daily_budget_change_percent", { precision: 8, scale: 4 }),
    maxDailyBudgetChangeAbsolute: decimal("max_daily_budget_change_absolute", { precision: 18, scale: 6 }),
    maxBidChangePercent: decimal("max_bid_change_percent", { precision: 8, scale: 4 }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptanceExpiresAt: timestamp("acceptance_expires_at", { withTimezone: true }),
    acceptedBy: uuid("accepted_by").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("paid_media_policies_workspace_provider_idx").on(table.workspaceId, table.provider, table.accountId)],
);

export const paidMediaProposalsTable = pgTable(
  "paid_media_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => paidMediaAccountsTable.id, { onDelete: "set null" }),
    entityId: uuid("entity_id").references(() => paidMediaEntitiesTable.id, { onDelete: "set null" }),
    provider: paidMediaProviderEnum("provider").notNull(),
    actionType: paidMediaActionTypeEnum("action_type").notNull(),
    status: paidMediaProposalStatusEnum("status").notNull().default("pending_approval"),
    idempotencyKey: text("idempotency_key").notNull(),
    recommendation: text("recommendation").notNull(),
    metrics: jsonb("metrics").notNull().default({}),
    simulation: jsonb("simulation").notNull().default({}),
    beforeAllocation: jsonb("before_allocation").notNull().default({}),
    afterAllocation: jsonb("after_allocation").notNull().default({}),
    requestedChange: jsonb("requested_change").notNull().default({}),
    policyDecision: jsonb("policy_decision").notNull().default({}),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("paid_media_proposals_workspace_idempotency_unique").on(
      table.workspaceId,
      table.idempotencyKey,
    ),
    index("paid_media_proposals_workspace_status_idx").on(table.workspaceId, table.status),
  ],
);

export const paidMediaApprovalsTable = pgTable(
  "paid_media_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => paidMediaProposalsTable.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    decision: paidMediaProposalStatusEnum("decision").notNull(),
    approverId: uuid("approver_id").references(() => usersTable.id, { onDelete: "set null" }),
    evidence: jsonb("evidence").notNull().default({}),
    comment: text("comment"),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("paid_media_approvals_proposal_idx").on(table.proposalId)],
);

export const paidMediaActionAttemptsTable = pgTable(
  "paid_media_action_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => paidMediaProposalsTable.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull().default(1),
    status: paidMediaAttemptStatusEnum("status").notNull().default("pending"),
    idempotencyKey: text("idempotency_key").notNull(),
    beforeSnapshot: jsonb("before_snapshot").notNull(),
    providerResponse: jsonb("provider_response"),
    verificationEvidence: jsonb("verification_evidence"),
    afterSnapshot: jsonb("after_snapshot"),
    rollbackEvidence: jsonb("rollback_evidence"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("paid_media_action_attempts_proposal_attempt_unique").on(
      table.proposalId,
      table.attemptNumber,
    ),
    uniqueIndex("paid_media_action_attempts_idempotency_unique").on(table.idempotencyKey),
    index("paid_media_action_attempts_workspace_status_idx").on(table.workspaceId, table.status),
  ],
);

export const insertPaidMediaAccountSchema = createInsertSchema(paidMediaAccountsTable).omit({
  id: true, createdAt: true, updatedAt: true, discoveredAt: true,
});
export const insertPaidMediaEntitySchema = createInsertSchema(paidMediaEntitiesTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertPaidMediaProposalSchema = createInsertSchema(paidMediaProposalsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type PaidMediaAccount = typeof paidMediaAccountsTable.$inferSelect;
export type PaidMediaEntity = typeof paidMediaEntitiesTable.$inferSelect;
export type PaidMediaInsight = typeof paidMediaInsightsTable.$inferSelect;
export type PaidMediaPolicy = typeof paidMediaPoliciesTable.$inferSelect;
export type PaidMediaProposal = typeof paidMediaProposalsTable.$inferSelect;
export type PaidMediaActionAttempt = typeof paidMediaActionAttemptsTable.$inferSelect;
export type InsertPaidMediaAccount = z.infer<typeof insertPaidMediaAccountSchema>;
export type InsertPaidMediaEntity = z.infer<typeof insertPaidMediaEntitySchema>;
export type InsertPaidMediaProposal = z.infer<typeof insertPaidMediaProposalSchema>;