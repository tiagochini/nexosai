import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  pgEnum,
  jsonb,
  boolean,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";
import { launchPipelinesTable } from "./launch-pipelines";
import { commercialProductsTable, commercialSubscriptionsTable } from "./commercial-entitlements";

export const campaignTypeEnum = pgEnum("campaign_type", [
  // Closed-cart / event-driven
  "launch",
  "perpetual_launch",
  "flash_sale",
  "live_sale",
  // Always-open cart / evergreen
  "continuous_sales",
  "subscription_growth",
  // Relationship / authority
  "authority",
  "audience_growth",
  "branding",
  "creator_monetization",
  // Activation / reengagement
  "upsell",
  "remarketing",
  "affiliate",
  // Expansion
  "scale",
  "regional_dominance",
  // Seed / validation launch (sell before building)
  "semente_launch",
]);

export const campaignTrackEnum = pgEnum("campaign_track", [
  // Revenue tracks (launch campaigns)
  "six_digits",
  "eight_digits",
  "ten_digits",
  // Non-revenue tracks
  "not_applicable",
]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "intake",
  "analyzing",
  "strategy_ready",
  "generating",
  "compliance_review",
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
  memoryData: jsonb("memory_data").notNull().default({}),
  brainData: jsonb("brain_data").notNull().default({}),
  durationDays: integer("duration_days"),
  budgetTotal: integer("budget_total"),
  revenueTarget: text("revenue_target"),
  locale: text("locale").notNull().default("pt-BR"),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  creditsCost: integer("credits_cost").notNull().default(0),
  executionStartedAt: timestamp("execution_started_at", {
    withTimezone: true,
  }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  pipelineId: uuid("pipeline_id").references(() => launchPipelinesTable.id, {
    onDelete: "set null",
  }),
  pipelinePosition: integer("pipeline_position"),
  commercialProductId: uuid("commercial_product_id").references(() => commercialProductsTable.id, { onDelete: "set null" }),
  commercialSubscriptionId: uuid("commercial_subscription_id").references(() => commercialSubscriptionsTable.id, { onDelete: "set null" }),
  productIntakeVersionId: uuid("product_intake_version_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  unique("campaigns_workspace_id_id_uidx").on(table.workspaceId, table.id),
]);

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
