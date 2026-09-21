import { pgTable, uuid, text, timestamp, jsonb, numeric, uniqueIndex, index } from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { campaignsTable } from "./campaigns";
import { workspaceIntegrationsTable } from "./workspace-integrations";

/** Auditable, token-free record of every inbound/outbound social conversation decision. */
export const socialConversationTurnsTable = pgTable("social_conversation_turns", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  integrationId: uuid("integration_id").notNull().references(() => workspaceIntegrationsTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id, { onDelete: "set null" }),
  accountId: text("account_id").notNull(),
  providerUserId: text("provider_user_id"),
  providerEventId: text("provider_event_id").notNull(),
  providerMessageId: text("provider_message_id"),
  channel: text("channel").notNull(),
  direction: text("direction").notNull(),
  inputText: text("input_text"),
  replyText: text("reply_text"),
  masterplanVersion: text("masterplan_version"),
  masterplanFingerprint: text("masterplan_fingerprint"),
  contextFingerprint: text("context_fingerprint"),
  intent: text("intent"),
  salesStage: text("sales_stage"),
  decision: text("decision"),
  confidence: numeric("confidence", { precision: 4, scale: 3 }),
  needsHuman: text("needs_human"),
  safetyReason: text("safety_reason"),
  provenance: jsonb("provenance").notNull().default({}),
  providerResponseId: text("provider_response_id"),
  providerStatus: text("provider_status"),
  providerError: text("provider_error"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("social_conversation_turn_event_unique").on(table.workspaceId, table.integrationId, table.providerEventId, table.direction),
  index("social_conversation_turn_account_user_idx").on(table.workspaceId, table.accountId, table.providerUserId, table.createdAt),
]);

export type SocialConversationTurn = typeof socialConversationTurnsTable.$inferSelect;