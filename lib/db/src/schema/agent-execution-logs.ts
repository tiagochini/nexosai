import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  boolean,
  real,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";
import { campaignsTable } from "./campaigns";
import { usersTable } from "./users";

export const agentExecutionStatusEnum = pgEnum("agent_execution_status", [
  "started",
  "completed",
  "failed",
  "skipped",
  "dry_run",
]);

export const agentApprovalStatusEnum = pgEnum("agent_approval_status", [
  "not_required",
  "pending",
  "approved",
  "rejected",
]);

export const agentExecutionLogsTable = pgTable("agent_execution_logs", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Context
  campaignId: uuid("campaign_id").references(() => campaignsTable.id, { onDelete: "set null" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),

  // Agent identity
  agentName: text("agent_name").notNull(),
  actionType: text("action_type").notNull(),

  // Content summaries (not full input/output — keeps table lean)
  inputSummary: text("input_summary"),
  outputSummary: text("output_summary"),

  // Scores extracted from agent JSON output
  confidenceScore: real("confidence_score"),
  riskScore: real("risk_score"),

  // Approval
  approvalRequired: boolean("approval_required").notNull().default(false),
  approvalStatus: agentApprovalStatusEnum("approval_status")
    .notNull()
    .default("not_required"),

  // Execution
  executionStatus: agentExecutionStatusEnum("execution_status")
    .notNull()
    .default("started"),
  errorMessage: text("error_message"),

  // Provider / cost
  providerUsed: text("provider_used"),
  modelUsed: text("model_used"),
  tokensUsed: integer("tokens_used"),
  estimatedCostUsd: real("estimated_cost_usd"),

  // Dry-run flag
  isDryRun: boolean("is_dry_run").notNull().default(false),

  // Timing
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertAgentExecutionLogSchema = createInsertSchema(
  agentExecutionLogsTable,
).omit({ id: true });

export type InsertAgentExecutionLog = z.infer<typeof insertAgentExecutionLogSchema>;
export type AgentExecutionLog = typeof agentExecutionLogsTable.$inferSelect;
