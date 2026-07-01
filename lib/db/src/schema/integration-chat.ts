import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";

export const INTEGRATION_CHAT_STATUSES = ["active", "ended"] as const;
export type IntegrationChatStatus = typeof INTEGRATION_CHAT_STATUSES[number];

export const INTEGRATION_CHAT_ROLES = ["user", "assistant"] as const;
export type IntegrationChatRole = typeof INTEGRATION_CHAT_ROLES[number];

export const integrationChatConversationsTable = pgTable("integration_chat_conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
}, (t) => [
  index("integration_chat_conversations_workspace_idx").on(t.workspaceId),
  index("integration_chat_conversations_status_idx").on(t.status),
]);

export const integrationChatMessagesTable = pgTable("integration_chat_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").notNull().references(() => integrationChatConversationsTable.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("integration_chat_messages_conv_idx").on(t.conversationId),
]);
