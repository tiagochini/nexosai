import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  jsonb,
  real,
} from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { campaignsTable } from "./campaigns";

export const critiqueLogsTable = pgTable("critique_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaignsTable.id, { onDelete: "cascade" }),
  agentRole: text("agent_role").notNull(),
  iteration: integer("iteration").notNull().default(1),
  rawOutput: text("raw_output").notNull(),
  critiqueText: text("critique_text").notNull(),
  refinedOutput: text("refined_output").notNull(),
  selfScoreBefore: real("self_score_before"),
  selfScoreAfter: real("self_score_after"),
  improvementDelta: real("improvement_delta"),
  issues: jsonb("issues").notNull().default([]),
  tokensUsed: integer("tokens_used").notNull().default(0),
  creditsCharged: integer("credits_charged").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type CritiqueLog = typeof critiqueLogsTable.$inferSelect;
