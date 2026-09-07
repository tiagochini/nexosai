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

/**
 * Social provider identifiers accepted by entitlement checks. Keep these
 * separate from integration providers (for example, `meta_ads`) so plan
 * capabilities remain product-level and stable.
 */
export const canonicalSocialNetworks = [
  "instagram",
  "facebook",
  "tiktok",
  "linkedin",
  "youtube",
] as const;

export type CanonicalSocialNetwork = (typeof canonicalSocialNetworks)[number];

export const defaultAllowedSocialNetworks: CanonicalSocialNetwork[] = [
  ...canonicalSocialNetworks,
];

export const defaultMaxAccountsPerNetwork: Record<CanonicalSocialNetwork, number> = {
  instagram: 1,
  facebook: 1,
  tiktok: 1,
  linkedin: 1,
  youtube: 1,
};

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
  // Defaults deliberately preserve the existing single-workspace product
  // behavior until a plan is explicitly granted a larger capability.
  maxWorkspaces: integer("max_workspaces").notNull().default(1),
  allowedSocialNetworks: jsonb("allowed_social_networks")
    .$type<CanonicalSocialNetwork[]>()
    .notNull()
    .default(defaultAllowedSocialNetworks),
  maxAccountsPerNetwork: jsonb("max_accounts_per_network")
    .$type<Record<CanonicalSocialNetwork, number>>()
    .notNull()
    .default(defaultMaxAccountsPerNetwork),
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
