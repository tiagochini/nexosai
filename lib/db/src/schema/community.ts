import {
  pgTable, uuid, text, timestamp, pgEnum, jsonb, boolean, integer, uniqueIndex,
} from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { workspaceIntegrationsTable } from "./workspace-integrations";
import { campaignsTable } from "./campaigns";

export const communityChannelEnum = pgEnum("community_channel", ["whatsapp", "telegram", "instagram", "facebook"]);
export const communityMessageDirectionEnum = pgEnum("community_message_direction", ["inbound", "outbound"]);
export const communityMessageStatusEnum = pgEnum("community_message_status", ["received", "queued", "sent", "delivered", "failed", "capability_blocked"]);
export const communityDecisionEnum = pgEnum("community_decision", ["allow", "queue", "delete", "restrict", "ban", "respond", "capability_blocked"]);
export const communityAttemptStatusEnum = pgEnum("community_attempt_status", ["pending", "sent", "succeeded", "failed", "capability_blocked"]);

export const communityConversationsTable = pgTable("community_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  integrationId: uuid("integration_id").references(() => workspaceIntegrationsTable.id, { onDelete: "set null" }),
  channel: communityChannelEnum("channel").notNull(),
  providerConversationId: text("provider_conversation_id").notNull(),
  title: text("title"),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [uniqueIndex("community_conversation_provider_uidx").on(t.workspaceId, t.channel, t.providerConversationId)]);

export const communityParticipantsTable = pgTable("community_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id").notNull().references(() => communityConversationsTable.id, { onDelete: "cascade" }),
  providerParticipantId: text("provider_participant_id").notNull(),
  displayName: text("display_name"),
  role: text("role"),
  consentGranted: boolean("consent_granted").notNull().default(false),
  identityProvenance: text("identity_provenance").notNull().default("provider_event"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("community_participant_provider_uidx").on(t.conversationId, t.providerParticipantId)]);

export const communityMessagesTable = pgTable("community_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id").notNull().references(() => communityConversationsTable.id, { onDelete: "cascade" }),
  senderParticipantId: uuid("sender_participant_id").references(() => communityParticipantsTable.id, { onDelete: "set null" }),
  providerMessageId: text("provider_message_id").notNull(),
  direction: communityMessageDirectionEnum("direction").notNull(),
  body: text("body"),
  attachments: jsonb("attachments").notNull().default([]),
  status: communityMessageStatusEnum("status").notNull().default("received"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("community_message_provider_uidx").on(t.workspaceId, t.providerMessageId)]);

export const communityProviderEventsTable = pgTable("community_provider_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  channel: communityChannelEnum("channel").notNull(),
  providerEventId: text("provider_event_id").notNull(),
  payload: jsonb("payload").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("community_provider_event_uidx").on(t.workspaceId, t.channel, t.providerEventId)]);

export const communityModerationRulesTable = pgTable("community_moderation_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  channel: communityChannelEnum("channel"),
  name: text("name").notNull(), enabled: boolean("enabled").notNull().default(true),
  condition: jsonb("condition").notNull(), decision: communityDecisionEnum("decision").notNull(),
  requiresApproval: boolean("requires_approval").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const communityModerationDecisionsTable = pgTable("community_moderation_decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  messageId: uuid("message_id").notNull().references(() => communityMessagesTable.id, { onDelete: "cascade" }),
  ruleId: uuid("rule_id").references(() => communityModerationRulesTable.id, { onDelete: "set null" }),
  decision: communityDecisionEnum("decision").notNull(), reason: text("reason").notNull(),
  approvedBy: uuid("approved_by"), approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const communityActionAttemptsTable = pgTable("community_action_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  messageId: uuid("message_id").references(() => communityMessagesTable.id, { onDelete: "set null" }),
  integrationId: uuid("integration_id").references(() => workspaceIntegrationsTable.id, { onDelete: "set null" }),
  action: communityDecisionEnum("action").notNull(), idempotencyKey: text("idempotency_key").notNull(),
  status: communityAttemptStatusEnum("status").notNull().default("pending"),
  providerReceipt: jsonb("provider_receipt"), error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => [uniqueIndex("community_action_idempotency_uidx").on(t.workspaceId, t.idempotencyKey)]);

export const communityResponsePoliciesTable = pgTable("community_response_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id, { onDelete: "set null" }),
  channel: communityChannelEnum("channel").notNull(), enabled: boolean("enabled").notNull().default(false),
  requiresConsent: boolean("requires_consent").notNull().default(true),
  requiresApproval: boolean("requires_approval").notNull().default(true),
  dailyQuota: integer("daily_quota").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});