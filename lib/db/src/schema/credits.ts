import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  pgEnum,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";

export const creditActionEnum = pgEnum("credit_action", [
  "strategy_generation",
  "copy_generation",
  "creative_brief",
  "timeline_generation",
  "video_concept",
  "video_low_res",
  "video_high_res",
  "landing_page_generation",
  "campaign_execution",
  "ad_creation",
  "remarketing_setup",
  "nurturing_message",
  "analytics_report",
  "monthly_reset",
  "purchase",
  "admin_grant",
]);

export const creditTransactionTypeEnum = pgEnum("credit_transaction_type", [
  "debit",
  "credit",
]);

export const creditTransactionsTable = pgTable("credit_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id"),
  type: creditTransactionTypeEnum("type").notNull(),
  action: creditActionEnum("action").notNull(),
  amount: integer("amount").notNull(),
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  aiProvider: text("ai_provider"),
  tokensUsed: integer("tokens_used"),
  costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertCreditTransactionSchema = createInsertSchema(
  creditTransactionsTable,
).omit({ id: true, createdAt: true });

export type InsertCreditTransaction = z.infer<
  typeof insertCreditTransactionSchema
>;
export type CreditTransaction = typeof creditTransactionsTable.$inferSelect;

export const CREDIT_COSTS: Record<string, number> = {
  strategy_generation: 15,
  copy_generation: 20,
  creative_brief: 8,
  timeline_generation: 10,
  video_concept: 3,
  video_low_res: 50,
  video_high_res: 150,
  landing_page_generation: 30,
  campaign_execution: 10,
  ad_creation: 12,
  remarketing_setup: 8,
  nurturing_message: 2,
  analytics_report: 5,
};
