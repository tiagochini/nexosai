import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";
import { campaignsTable } from "./campaigns";

export const marketIntelStatusEnum = pgEnum("market_intel_status", [
  "running",
  "ready",
  "failed",
]);

export const marketIntelReportsTable = pgTable("market_intel_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id, {
    onDelete: "set null",
  }),
  productName: text("product_name").notNull(),
  market: text("market").notNull(),
  status: marketIntelStatusEnum("status").notNull().default("running"),
  input: jsonb("input").notNull().default({}),
  output: jsonb("output"),
  error: text("error"),
  source: text("source").notNull().default("manual"), // "manual" | "intake"
  // Deep-dive chat — persisted so the conversation survives page reloads
  chatHistory: jsonb("chat_history"), // Array<{ role: "user"|"assistant", content: string, ts: string }>
  // Synthesized insights from the deep-dive conversation — injected into social
  // presence planner and launch agents so all teams benefit from the dialogue
  deepdiveInsights: text("deepdive_insights"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertMarketIntelReportSchema = createInsertSchema(
  marketIntelReportsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertMarketIntelReport = z.infer<
  typeof insertMarketIntelReportSchema
>;
export type MarketIntelReport = typeof marketIntelReportsTable.$inferSelect;
