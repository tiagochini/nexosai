import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { usersTable } from "./users";
import { planSlugEnum } from "./plans";

export const commercialOfferIntervalEnum = pgEnum("commercial_offer_interval", ["one_time", "monthly", "yearly"]);

/** Sellable NexOS packages. Benefits are explicit entitlements, not offer copy. */
export const commercialSalesOffersTable = pgTable("commercial_sales_offers", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  priceCents: integer("price_cents").notNull(),
  interval: commercialOfferIntervalEnum("interval").notNull().default("one_time"),
  planSlug: planSlugEnum("plan_slug"),
  nexosAccessLifetime: boolean("nexos_access_lifetime").notNull().default(false),
  campaignsIncluded: integer("campaigns_included").notNull().default(0),
  socialMediaDays: integer("social_media_days").notNull().default(0),
  creditsIncluded: integer("credits_included").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [uniqueIndex("commercial_sales_offers_key_uidx").on(table.key)]);

export type CommercialSalesOffer = typeof commercialSalesOffersTable.$inferSelect;

export const commercialOfferContractStatusEnum = pgEnum("commercial_offer_contract_status", ["pending", "active", "paused", "cancelled", "expired"]);

/** Customer purchase/subscription record; the offer snapshot preserves the terms sold. */
export const commercialOfferContractsTable = pgTable("commercial_offer_contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  offerId: uuid("offer_id").references(() => commercialSalesOffersTable.id, { onDelete: "set null" }),
  offerSnapshot: jsonb("offer_snapshot").notNull(),
  providerSubscriptionId: text("provider_subscription_id"),
  status: commercialOfferContractStatusEnum("status").notNull().default("pending"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  currentPeriodEndsAt: timestamp("current_period_ends_at", { withTimezone: true }),
  fulfilledPaymentIds: jsonb("fulfilled_payment_ids").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("commercial_offer_contracts_provider_subscription_uidx").on(table.providerSubscriptionId),
]);

export type CommercialOfferContract = typeof commercialOfferContractsTable.$inferSelect;
