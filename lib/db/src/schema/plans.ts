import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  boolean,
  pgEnum,
  jsonb,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const planSlugEnum = pgEnum("plan_slug", ["solo", "agency"]);

export const plansTable = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: planSlugEnum("slug").notNull().unique(),
  priceMonthly: numeric("price_monthly", { precision: 10, scale: 2 }).notNull(),
  priceOnboarding: numeric("price_onboarding", {
    precision: 10,
    scale: 2,
  }).notNull().default("0"),
  creditsMonthly: integer("credits_monthly").notNull(),
  maxCampaigns: integer("max_campaigns").notNull(),
  maxVideosPerCampaign: integer("max_videos_per_campaign").notNull().default(5),
  maxDomains: integer("max_domains").notNull().default(1),
  whiteLabel: boolean("white_label").notNull().default(false),
  multiNurturingChannels: boolean("multi_nurturing_channels")
    .notNull()
    .default(false),
  features: jsonb("features").notNull().default([]),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertPlanSchema = createInsertSchema(plansTable).omit({
  id: true,
  createdAt: true,
});

export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plansTable.$inferSelect;
