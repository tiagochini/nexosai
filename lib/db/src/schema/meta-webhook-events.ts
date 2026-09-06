import { pgTable, uuid, text, timestamp, integer, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { workspaceIntegrationsTable } from "./workspace-integrations";

export const metaWebhookEventsTable = pgTable("meta_webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").references(() => workspacesTable.id, { onDelete: "set null" }),
  integrationId: uuid("integration_id").references(() => workspaceIntegrationsTable.id, { onDelete: "set null" }),
  accountId: text("account_id").notNull(),
  providerEventId: text("provider_event_id").notNull(),
  actionKey: text("action_key").notNull().default("initial_response"),
  eventType: text("event_type").notNull(),
  status: text("status").notNull().default("received"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  sendStartedAt: timestamp("send_started_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  latencyMs: integer("latency_ms"),
  slaStatus: text("sla_status"),
  retryCount: integer("retry_count").notNull().default(0),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  deadLetterAt: timestamp("dead_letter_at", { withTimezone: true }),
  ruleRef: text("rule_ref"),
  sequenceId: uuid("sequence_id"),
  commentActionId: uuid("comment_action_id"),
  outboundEndpoint: text("outbound_endpoint"),
  outboundRequest: jsonb("outbound_request").notNull().default({}),
  providerResponse: jsonb("provider_response").notNull().default({}),
  providerMessageId: text("provider_message_id"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("meta_webhook_event_action_unique").on(table.accountId, table.providerEventId, table.actionKey),
  index("meta_webhook_events_retry_idx").on(table.status, table.nextRetryAt),
  index("meta_webhook_events_workspace_idx").on(table.workspaceId, table.receivedAt),
]);

export type MetaWebhookEvent = typeof metaWebhookEventsTable.$inferSelect;