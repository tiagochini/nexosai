import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { campaignsTable } from "./campaigns";

export const FUNNEL_STAGES = ["warming", "desire", "scarcity", "objection", "post_sale"] as const;
export type FunnelStage = typeof FUNNEL_STAGES[number];

export const CONVERSATION_CHANNELS = ["whatsapp", "telegram", "facebook", "instagram", "landing", "manual"] as const;
export type ConversationChannel = typeof CONVERSATION_CHANNELS[number];

export const CONVERSATION_STATUSES = ["active", "converted", "lost", "paused"] as const;
export type ConversationStatus = typeof CONVERSATION_STATUSES[number];

export const salesConversationsTable = pgTable("sales_conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id, { onDelete: "set null" }),
  contactName: varchar("contact_name", { length: 200 }).default("").notNull(),
  contactHandle: varchar("contact_handle", { length: 300 }).default("").notNull(),
  channel: varchar("channel", { length: 50 }).default("whatsapp").notNull(),
  funnelStage: varchar("funnel_stage", { length: 50 }).default("warming").notNull(),
  status: varchar("status", { length: 50 }).default("active").notNull(),
  assignedAgent: varchar("assigned_agent", { length: 100 }).default("sales_warmer").notNull(),
  notes: text("notes").default("").notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
}, (t) => [
  index("sales_conversations_workspace_idx").on(t.workspaceId),
  index("sales_conversations_status_idx").on(t.status),
  index("sales_conversations_stage_idx").on(t.funnelStage),
]);

export const salesMessagesTable = pgTable("sales_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").notNull().references(() => salesConversationsTable.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  agentRole: varchar("agent_role", { length: 100 }),
  isAiGenerated: boolean("is_ai_generated").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("sales_messages_conv_idx").on(t.conversationId),
]);
