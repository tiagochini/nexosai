import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { campaignsTable } from "./campaigns";
import { workspaceIntegrationsTable } from "./workspace-integrations";
import { regionalAudienceOpportunitiesTable } from "./regional-intelligence";

export const interactionLifecycleEnum = pgEnum("interaction_lifecycle", ["observed", "scored", "proposed", "awaiting_approval", "approved", "scheduled", "executing", "verified", "responded", "failed", "blocked", "cancelled"]);
export const interactionActionEnum = pgEnum("interaction_action", ["public_comment", "private_message", "reply", "follow_up"]);
export const interactionDecisionEnum = pgEnum("interaction_decision", ["allowed", "blocked", "requires_approval"]);

/** One row per workspace: limits are workspace-wide and are never multiplied by connected accounts. */
export const interactionGovernancePoliciesTable = pgTable("interaction_governance_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  windowMinutes: integer("window_minutes").notNull().default(1440),
  workspaceCeiling: integer("workspace_ceiling").notNull().default(0),
  accountCeiling: integer("account_ceiling").notNull().default(0),
  competitorCeiling: integer("competitor_ceiling").notNull().default(0),
  postCeiling: integer("post_ceiling").notNull().default(0),
  recipientCeiling: integer("recipient_ceiling").notNull().default(0),
  recipientCooldownMinutes: integer("recipient_cooldown_minutes").notNull().default(10080),
  maximumRiskScore: integer("maximum_risk_score").notNull().default(0),
  requireApproval: boolean("require_approval").notNull().default(true),
  purpose: text("purpose").notNull().default("public engagement"),
  jurisdictionCodes: jsonb("jurisdiction_codes").notNull().default([]),
  retentionDays: integer("retention_days").notNull().default(30),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [uniqueIndex("interaction_policy_workspace_uidx").on(t.workspaceId)]);

/** Explicit allow-list from an official adapter. An integration alone never grants execution. */
export const interactionPlatformCapabilitiesTable = pgTable("interaction_platform_capabilities", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  integrationId: uuid("integration_id").notNull().references(() => workspaceIntegrationsTable.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  action: interactionActionEnum("action").notNull(),
  officialAdapter: boolean("official_adapter").notNull().default(false),
  enabled: boolean("enabled").notNull().default(false),
  allowsAutomaticExecution: boolean("allows_automatic_execution").notNull().default(false),
  requiresOwnedAsset: boolean("requires_owned_asset").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [uniqueIndex("interaction_capability_integration_action_uidx").on(t.integrationId, t.action), index("interaction_capability_workspace_idx").on(t.workspaceId)]);

/** Hashed public/account identity only; display data remains on the source evidence, never here. */
export const interactionRecipientsTable = pgTable("interaction_recipients", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  fingerprint: text("fingerprint").notNull(),
  optedOut: boolean("opted_out").notNull().default(false),
  optedOutAt: timestamp("opted_out_at", { withTimezone: true }),
  purpose: text("purpose").notNull().default("public engagement"),
  jurisdictionCodes: jsonb("jurisdiction_codes").notNull().default([]),
  retentionUntil: timestamp("retention_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [uniqueIndex("interaction_recipient_workspace_fingerprint_uidx").on(t.workspaceId, t.fingerprint)]);

export const interactionOpportunitiesTable = pgTable("interaction_opportunities", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id, { onDelete: "set null" }),
  sourceAudienceOpportunityId: uuid("source_audience_opportunity_id").references(() => regionalAudienceOpportunitiesTable.id, { onDelete: "set null" }),
  recipientId: uuid("recipient_id").notNull().references(() => interactionRecipientsTable.id, { onDelete: "cascade" }),
  integrationId: uuid("integration_id").notNull().references(() => workspaceIntegrationsTable.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  action: interactionActionEnum("action").notNull(),
  competitorRef: text("competitor_ref"),
  postRef: text("post_ref"),
  evidence: jsonb("evidence").notNull().default({}),
  context: jsonb("context").notNull().default({}),
  lawfulBasis: text("lawful_basis").notNull().default("unknown"),
  contactable: boolean("contactable").notNull().default(false),
  assetOwned: boolean("asset_owned").notNull().default(false),
  conversationOwned: boolean("conversation_owned").notNull().default(false),
  riskScore: integer("risk_score").notNull().default(100),
  state: interactionLifecycleEnum("state").notNull().default("observed"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [uniqueIndex("interaction_opportunity_source_integration_action_uidx").on(t.sourceAudienceOpportunityId, t.integrationId, t.action), index("interaction_opportunity_workspace_state_idx").on(t.workspaceId, t.state, t.createdAt), index("interaction_opportunity_recipient_idx").on(t.workspaceId, t.recipientId, t.createdAt)]);

export const interactionDecisionsTable = pgTable("interaction_decisions", {
  id: uuid("id").primaryKey().defaultRandom(), workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  opportunityId: uuid("opportunity_id").notNull().references(() => interactionOpportunitiesTable.id, { onDelete: "cascade" }),
  decision: interactionDecisionEnum("decision").notNull(), reasons: jsonb("reasons").notNull().default([]), governorSnapshot: jsonb("governor_snapshot").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("interaction_decision_opportunity_idx").on(t.workspaceId, t.opportunityId, t.createdAt)]);

export const interactionDraftsTable = pgTable("interaction_drafts", {
  id: uuid("id").primaryKey().defaultRandom(), workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  opportunityId: uuid("opportunity_id").notNull().references(() => interactionOpportunitiesTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(), contentFingerprint: text("content_fingerprint").notNull(), ctaLevel: integer("cta_level").notNull().default(0),
  councilAssessment: jsonb("council_assessment").notNull().default({}), similarityScore: integer("similarity_score").notNull().default(0),
  state: interactionLifecycleEnum("state").notNull().default("proposed"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("interaction_draft_workspace_fingerprint_idx").on(t.workspaceId, t.contentFingerprint)]);

export const interactionApprovalsTable = pgTable("interaction_approvals", {
  id: uuid("id").primaryKey().defaultRandom(), workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  draftId: uuid("draft_id").notNull().references(() => interactionDraftsTable.id, { onDelete: "cascade" }), decision: text("decision").notNull(),
  modifiedContent: text("modified_content"), decidedByUserId: uuid("decided_by_user_id"), reason: text("reason"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("interaction_approval_draft_idx").on(t.workspaceId, t.draftId, t.createdAt)]);

export const interactionExecutionsTable = pgTable("interaction_executions", {
  id: uuid("id").primaryKey().defaultRandom(), workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  opportunityId: uuid("opportunity_id").notNull().references(() => interactionOpportunitiesTable.id, { onDelete: "cascade" }), draftId: uuid("draft_id").references(() => interactionDraftsTable.id, { onDelete: "set null" }),
  mode: text("mode").notNull(), state: interactionLifecycleEnum("state").notNull().default("scheduled"), evidence: jsonb("evidence").notNull().default({}),
  result: jsonb("result").notNull().default({}), incident: jsonb("incident"), reservedAt: timestamp("reserved_at", { withTimezone: true }).notNull().defaultNow(), completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => [index("interaction_execution_workspace_time_idx").on(t.workspaceId, t.reservedAt)]);