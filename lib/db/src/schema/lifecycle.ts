import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { productSalesTable } from "./product-sales";
import { productsTable } from "./products";
import { workspacesTable } from "./workspaces";

export const lifecycleStageEnum = pgEnum("lifecycle_stage", ["lead", "qualified", "checkout_started", "customer", "at_risk", "churned"]);
export const lifecycleEventTypeEnum = pgEnum("lifecycle_event_type", ["lead", "checkout_started", "payment_pending", "payment_expired", "paid", "refunded", "activation", "renewal", "message_opened", "message_clicked"]);
export const lifecycleEventStatusEnum = pgEnum("lifecycle_event_status", ["accepted", "processed", "failed"]);
export const lifecycleActionStatusEnum = pgEnum("lifecycle_action_status", ["pending", "claimed", "completed", "failed", "suppressed"]);
export const referralRewardStatusEnum = pgEnum("referral_reward_status", ["pending", "earned", "fulfilled", "reversed", "rejected"]);

/** Workspace-scoped canonical identity. Never look up an identity without workspaceId. */
export const lifecycleContactsTable = pgTable("lifecycle_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  email: text("email"),
  phone: text("phone"),
  name: text("name"),
  emailConsent: boolean("email_consent").notNull().default(false),
  whatsappConsent: boolean("whatsapp_consent").notNull().default(false),
  stage: lifecycleStageEnum("stage").notNull().default("lead"),
  temperature: integer("temperature").notNull().default(0),
  purchaseProbability: integer("purchase_probability").notNull().default(0),
  lifetimeValueCents: integer("lifetime_value_cents").notNull().default(0),
  churnRisk: integer("churn_risk").notNull().default(0),
  source: text("source"),
  profile: jsonb("profile").notNull().default({}),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("lifecycle_contacts_workspace_email_unique").on(table.workspaceId, table.email),
  uniqueIndex("lifecycle_contacts_workspace_phone_unique").on(table.workspaceId, table.phone),
]);

/** Immutable dedupe ledger. provider event ids or deterministic domain keys belong in eventKey. */
export const lifecycleEventsTable = pgTable("lifecycle_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").references(() => lifecycleContactsTable.id, { onDelete: "set null" }),
  eventKey: text("event_key").notNull(),
  type: lifecycleEventTypeEnum("type").notNull(),
  status: lifecycleEventStatusEnum("status").notNull().default("accepted"),
  subjectType: text("subject_type"),
  subjectId: text("subject_id"),
  payload: jsonb("payload").notNull().default({}),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("lifecycle_events_workspace_key_unique").on(table.workspaceId, table.eventKey)]);

export const cartRecoveryActionsTable = pgTable("cart_recovery_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  saleId: uuid("sale_id").notNull().references(() => productSalesTable.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").references(() => lifecycleContactsTable.id, { onDelete: "set null" }),
  status: lifecycleActionStatusEnum("status").notNull().default("pending"),
  channel: text("channel").notNull(),
  providerDispatchId: uuid("provider_dispatch_id"),
  reason: text("reason"),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("cart_recovery_sale_channel_unique").on(table.saleId, table.channel)]);

export const buyerOnboardingInstancesTable = pgTable("buyer_onboarding_instances", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  saleId: uuid("sale_id").notNull().references(() => productSalesTable.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").references(() => lifecycleContactsTable.id, { onDelete: "set null" }),
  productId: uuid("product_id").notNull().references(() => productsTable.id),
  status: lifecycleActionStatusEnum("status").notNull().default("pending"),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [uniqueIndex("buyer_onboarding_sale_unique").on(table.saleId)]);

export const retentionActionsTable = pgTable("retention_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").notNull().references(() => lifecycleContactsTable.id, { onDelete: "cascade" }),
  status: lifecycleActionStatusEnum("status").notNull().default("pending"),
  riskScore: integer("risk_score").notNull(),
  reason: text("reason").notNull(),
  providerDispatchId: uuid("provider_dispatch_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [uniqueIndex("retention_contact_reason_unique").on(table.contactId, table.reason)]);

export const upsellOffersTable = pgTable("upsell_offers", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  targetProductId: uuid("target_product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  approved: boolean("approved").notNull().default(false),
  minimumActivationHours: integer("minimum_activation_hours").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const upsellActionsTable = pgTable("upsell_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  offerId: uuid("offer_id").notNull().references(() => upsellOffersTable.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").notNull().references(() => lifecycleContactsTable.id, { onDelete: "cascade" }),
  sourceSaleId: uuid("source_sale_id").notNull().references(() => productSalesTable.id, { onDelete: "cascade" }),
  convertedSaleId: uuid("converted_sale_id").references(() => productSalesTable.id, { onDelete: "set null" }),
  status: lifecycleActionStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("upsell_action_offer_source_sale_unique").on(table.offerId, table.sourceSaleId)]);

export const purchaserReferralsTable = pgTable("purchaser_referrals", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  referrerContactId: uuid("referrer_contact_id").notNull().references(() => lifecycleContactsTable.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("purchaser_referrals_workspace_code_unique").on(table.workspaceId, table.code), uniqueIndex("purchaser_referrals_referrer_unique").on(table.referrerContactId)]);

export const purchaserReferralAttributionsTable = pgTable("purchaser_referral_attributions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  referralId: uuid("referral_id").notNull().references(() => purchaserReferralsTable.id, { onDelete: "cascade" }),
  referredContactId: uuid("referred_contact_id").notNull().references(() => lifecycleContactsTable.id, { onDelete: "cascade" }),
  saleId: uuid("sale_id").notNull().references(() => productSalesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("purchaser_referral_attribution_sale_unique").on(table.saleId)]);

export const referralRewardsTable = pgTable("referral_rewards", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  attributionId: uuid("attribution_id").notNull().references(() => purchaserReferralAttributionsTable.id, { onDelete: "cascade" }),
  status: referralRewardStatusEnum("status").notNull().default("pending"),
  amountCents: integer("amount_cents").notNull().default(0),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reversedAt: timestamp("reversed_at", { withTimezone: true }),
}, (table) => [uniqueIndex("referral_reward_attribution_unique").on(table.attributionId)]);

export const insertLifecycleContactSchema = createInsertSchema(lifecycleContactsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type LifecycleContact = typeof lifecycleContactsTable.$inferSelect;
export type LifecycleEvent = typeof lifecycleEventsTable.$inferSelect;
export type InsertLifecycleContact = z.infer<typeof insertLifecycleContactSchema>;