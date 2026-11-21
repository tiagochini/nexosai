import { boolean, jsonb, pgTable, smallint, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/** Singleton platform-level switches controlled by platform administrators. */
export const platformFeatureSettingsTable = pgTable("platform_feature_settings", {
  id: smallint("id").primaryKey().default(1),
  trialSocialMediaSalesEnabled: boolean("trial_social_media_sales_enabled").notNull().default(false),
  trialBlockedPlans: jsonb("trial_blocked_plans").$type<string[]>().notNull().default([]),
  trialBlockedOffers: jsonb("trial_blocked_offers").$type<string[]>().notNull().default([]),
  updatedBy: uuid("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
