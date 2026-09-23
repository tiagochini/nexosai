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
import { campaignsTable } from "./campaigns";
import { masterplanVersionsTable } from "./masterplan-versions";
import { commercialProductsTable, commercialSubscriptionsTable } from "./commercial-entitlements";

/** Providers that have an executable paid-media adapter. */
export const paidMediaProviderEnum = pgEnum("paid_media_provider", [
  "meta_ads",
  "tiktok_ads",
  "google_ads",
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

/** CBO budgets live at campaign level; ABO budgets live at ad-set level. */
export const paidMediaBudgetStrategyEnum = pgEnum("paid_media_budget_strategy", [
  "cbo",
  "abo",
]);

export const paidMediaEventSourceEnum = pgEnum("paid_media_event_source", [
  "browser",
  "server",
  "crm",
]);

export const paidMediaReconciliationStatusEnum = pgEnum("paid_media_reconciliation_status", [
  "reconciled",
  "partial",
  "unattributed",
]);
export const paidMediaEventDeliveryStatusEnum = pgEnum("paid_media_event_delivery_status", [
  "pending",
  "sent",
  "failed",
  "capability_blocked",
  "consent_withheld",
]);

/** A launch plan is an immutable, provider-neutral execution contract. */
export const paidMediaLaunchStageEnum = pgEnum("paid_media_launch_stage", [
  "compiled", "simulated", "approved", "activating", "active", "failed", "compensation_failed", "rolled_back",
]);
export const paidMediaLaunchAttemptStatusEnum = pgEnum("paid_media_launch_attempt_status", [
  "executing", "succeeded", "failed", "compensation_failed",
]);
export const paidMediaLaunchStepStatusEnum = pgEnum("paid_media_launch_step_status", [
  "pending", "created", "verified", "compensated", "compensation_failed",
]);
export const paidMediaLaunchPlansTable = pgTable(
  "paid_media_launch_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
    commercialProductId: uuid("commercial_product_id").notNull().references(() => commercialProductsTable.id, { onDelete: "restrict" }),
    commercialSubscriptionId: uuid("commercial_subscription_id").notNull().references(() => commercialSubscriptionsTable.id, { onDelete: "restrict" }),
    campaignId: uuid("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "restrict" }),
    masterplanVersionId: uuid("masterplan_version_id").notNull().references(() => masterplanVersionsTable.id, { onDelete: "restrict" }),
    contextFingerprint: text("context_fingerprint").notNull(),
    accountId: uuid("account_id").notNull().references(() => paidMediaAccountsTable.id, { onDelete: "restrict" }),
    productIntakeVersionId: uuid("product_intake_version_id").notNull(),
    provider: paidMediaProviderEnum("provider").notNull(),
    launchStage: paidMediaLaunchStageEnum("launch_stage").notNull().default("compiled"),
    planHash: text("plan_hash").notNull(),
    tree: jsonb("tree").notNull(),
    providerPayload: jsonb("provider_payload").notNull().default({}),
    readiness: jsonb("readiness").notNull().default({}),
    approvalSnapshot: jsonb("approval_snapshot"),
    approvedByUserId: uuid("approved_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("paid_media_launch_plans_workspace_hash_uidx").on(table.workspaceId, table.planHash),
    index("paid_media_launch_plans_workspace_campaign_idx").on(table.workspaceId, table.campaignId),
  ],
);
export const paidMediaLaunchAttemptsTable = pgTable("paid_media_launch_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  launchPlanId: uuid("launch_plan_id").notNull().references(() => paidMediaLaunchPlansTable.id, { onDelete: "cascade" }),
  attemptKey: text("attempt_key").notNull(),
  status: paidMediaLaunchAttemptStatusEnum("status").notNull().default("executing"),
  leaseOwner: text("lease_owner"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [uniqueIndex("paid_media_launch_attempts_plan_key_uidx").on(table.launchPlanId, table.attemptKey)]);
export const paidMediaLaunchStepsTable = pgTable("paid_media_launch_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  attemptId: uuid("attempt_id").notNull().references(() => paidMediaLaunchAttemptsTable.id, { onDelete: "cascade" }),
  stepKey: text("step_key").notNull(),
  sequence: integer("sequence").notNull().default(0),
  entityType: paidMediaEntityTypeEnum("entity_type").notNull(),
  providerEntityId: text("provider_entity_id"),
  status: paidMediaLaunchStepStatusEnum("status").notNull().default("pending"),
  providerResponse: jsonb("provider_response").notNull().default({}),
  readback: jsonb("readback").notNull().default({}),
  compensation: jsonb("compensation").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [uniqueIndex("paid_media_launch_steps_attempt_key_uidx").on(table.attemptId, table.stepKey)]);

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
    operationalHealth: boolean("operational_health").notNull().default(false),
    healthCheckedAt: timestamp("health_checked_at", { withTimezone: true }),
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
    campaignId: uuid("campaign_id").references(() => campaignsTable.id, { onDelete: "set null" }),
    masterplanVersionId: uuid("masterplan_version_id").references(() => masterplanVersionsTable.id, { onDelete: "restrict" }),
    contextFingerprint: text("context_fingerprint"),
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

// A provider pixel (Meta) or event dataset (TikTok).  This stores identifiers
// and diagnostics only; provider credentials remain in workspace_integrations.
export const paidMediaDatasetsTable = pgTable(
  "paid_media_datasets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").notNull().references(() => paidMediaAccountsTable.id, { onDelete: "cascade" }),
    provider: paidMediaProviderEnum("provider").notNull(),
    providerDatasetId: text("provider_dataset_id").notNull(),
    name: text("name"),
    // An opaque public identifier supplied by the customer integration. It is
    // intentionally not an Ads provider credential.
    ingestionKey: text("ingestion_key").notNull(),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
    lastDiagnosticAt: timestamp("last_diagnostic_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("paid_media_datasets_account_provider_dataset_unique").on(table.accountId, table.provider, table.providerDatasetId),
    uniqueIndex("paid_media_datasets_ingestion_key_unique").on(table.ingestionKey),
    index("paid_media_datasets_workspace_account_idx").on(table.workspaceId, table.accountId),
  ],
);

/** Immutable event receipts. The source event id is the cross-channel dedupe key. */
export const paidMediaEventReceiptsTable = pgTable(
  "paid_media_event_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
    datasetId: uuid("dataset_id").notNull().references(() => paidMediaDatasetsTable.id, { onDelete: "cascade" }),
    source: paidMediaEventSourceEnum("source").notNull(),
    eventId: text("event_id").notNull(),
    eventName: text("event_name").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    eventMatchKeys: jsonb("event_match_keys").notNull().default({}),
    payload: jsonb("payload").notNull().default({}),
    deliveryStatus: paidMediaEventDeliveryStatusEnum("delivery_status").notNull().default("pending"),
    providerAttemptedAt: timestamp("provider_attempted_at", { withTimezone: true }),
    providerResponse: jsonb("provider_response"),
    providerErrorCode: text("provider_error_code"),
    providerErrorMessage: text("provider_error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("paid_media_event_receipts_dataset_event_unique").on(table.datasetId, table.eventId),
    index("paid_media_event_receipts_workspace_occurred_idx").on(table.workspaceId, table.occurredAt),
  ],
);

export const paidMediaAttributionTouchpointsTable = pgTable(
  "paid_media_attribution_touchpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => paidMediaAccountsTable.id, { onDelete: "set null" }),
    entityId: uuid("entity_id").references(() => paidMediaEntitiesTable.id, { onDelete: "set null" }),
    provider: paidMediaProviderEnum("provider"),
    externalTouchpointId: text("external_touchpoint_id").notNull(),
    clickId: text("click_id"),
    utmSource: text("utm_source"),
    utmCampaign: text("utm_campaign"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("paid_media_touchpoints_workspace_external_unique").on(table.workspaceId, table.externalTouchpointId),
    index("paid_media_touchpoints_workspace_click_idx").on(table.workspaceId, table.clickId),
  ],
);

export const paidMediaConversionsTable = pgTable(
  "paid_media_conversions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
    touchpointId: uuid("touchpoint_id").references(() => paidMediaAttributionTouchpointsTable.id, { onDelete: "set null" }),
    externalConversionId: text("external_conversion_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    currency: text("currency").notNull(),
    value: decimal("value", { precision: 18, scale: 6 }).notNull().default("0"),
    reconciliationStatus: paidMediaReconciliationStatusEnum("reconciliation_status").notNull().default("unattributed"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("paid_media_conversions_workspace_external_unique").on(table.workspaceId, table.externalConversionId),
    index("paid_media_conversions_workspace_occurred_idx").on(table.workspaceId, table.occurredAt),
  ],
);

export const paidMediaBudgetStrategiesTable = pgTable(
  "paid_media_budget_strategies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").notNull().references(() => paidMediaAccountsTable.id, { onDelete: "cascade" }),
    campaignEntityId: uuid("campaign_entity_id").notNull().references(() => paidMediaEntitiesTable.id, { onDelete: "cascade" }),
    strategy: paidMediaBudgetStrategyEnum("strategy").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
    providerData: jsonb("provider_data").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("paid_media_budget_strategies_campaign_unique").on(table.campaignEntityId),
    index("paid_media_budget_strategies_workspace_account_idx").on(table.workspaceId, table.accountId),
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
export type PaidMediaDataset = typeof paidMediaDatasetsTable.$inferSelect;
export type PaidMediaEventReceipt = typeof paidMediaEventReceiptsTable.$inferSelect;
export type PaidMediaAttributionTouchpoint = typeof paidMediaAttributionTouchpointsTable.$inferSelect;
export type PaidMediaConversion = typeof paidMediaConversionsTable.$inferSelect;
export type PaidMediaLaunchPlan = typeof paidMediaLaunchPlansTable.$inferSelect;
export type InsertPaidMediaAccount = z.infer<typeof insertPaidMediaAccountSchema>;
export type InsertPaidMediaEntity = z.infer<typeof insertPaidMediaEntitySchema>;
export type InsertPaidMediaProposal = z.infer<typeof insertPaidMediaProposalSchema>;