import { pgTable, uuid, text, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { campaignsTable } from "./campaigns";
import { workspacesTable } from "./workspaces";

export const agentClarificationRequestsTable = pgTable("agent_clarification_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  agentRole: text("agent_role").notNull(),
  question: text("question").notNull(),
  options: jsonb("options").$type<string[]>(),
  context: text("context"),
  isBriefingGap: boolean("is_briefing_gap").default(false),
  severity: text("severity").default("normal"),
  status: text("status").default("pending"),
  answer: text("answer"),
  answeredAt: timestamp("answered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AgentClarificationRequest = typeof agentClarificationRequestsTable.$inferSelect;
export type NewAgentClarificationRequest = typeof agentClarificationRequestsTable.$inferInsert;
