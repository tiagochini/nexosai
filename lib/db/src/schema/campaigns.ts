import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  pgEnum,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";

export const campaignTypeEnum = pgEnum("campaign_type", [
  "launch",
  "branding",
  "authority",
  "audience_growth",
  "continuous_sales",
  "regional_dominance",
  "upsell",
  "remarketing",
  "creator_monetization",
  "scale",
  "affiliate",
]);

export const campaignTrackEnum = pgEnum("campaign_track", [
  "six_digits",
  "eight_digits",
  "ten_digits",
]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "intake",
  "analyzing",
  "strategy_ready",
  "generating",
  "awaiting_approval",
  "approved",
  "executing",
  "live",
  "paused",
  "completed",
  "cancelled",
]);

export const campaignPhaseEnum = pgEnum("campaign_phase", [
  "capture",
  "warmup",
  "authority",
  "desire",
  "offer_reveal",
  "scarcity",
  "cart_open",
  "cart_close",
  "remarketing",
  "proof",
  "next_prep",
]);

export const campaignsTable = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: campaignTypeEnum("type").notNull().default("launch"),
  track: campaignTrackEnum("track").notNull().default("six_digits"),
  status: campaignStatusEnum("status").notNull().default("intake"),
  currentPhase: campaignPhaseEnum("current_phase"),
  intakeData: jsonb("intake_data").notNull().default({}),
  strategyData: jsonb("strategy_data").notNull().default({}),
  timelineData: jsonb("timeline_data").notNull().default({}),
  offerData: jsonb("offer_data").notNull().default({}),
  targetingData: jsonb("targeting_data").notNull().default({}),
  audienceData: jsonb("audience_data").notNull().default({}),
  durationDays: integer("duration_days"),
  budgetTotal: integer("budget_total"),
  revenueTarget: text("revenue_target"),
  locale: text("locale").notNull().default("pt-BR"),
  creditsCost: integer("credits_cost").notNull().default(0),
  executionStartedAt: timestamp("execution_started_at", {
    withTimezone: true,
  }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  creditsCost: true,
  executionStartedAt: true,
  completedAt: true,
});

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaignsTable.$inferSelect;
