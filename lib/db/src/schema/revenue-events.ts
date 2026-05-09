import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  integer,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";
import { campaignsTable } from "./campaigns";

export const revenuePlatformEnum = pgEnum("revenue_platform", [
  "hotmart",
  "kiwify",
  "eduzz",
  "monetizze",
  "stripe",
  "pagarme",
  "asaas",
  "custom",
]);

export const revenueEventTypeEnum = pgEnum("revenue_event_type", [
  "sale",
  "refund",
  "chargeback",
  "subscription_renewal",
  "subscription_cancel",
  "abandoned_cart",
  "lead",
  "upsell",
  "order_bump",
]);

export const revenueEventStatusEnum = pgEnum("revenue_event_status", [
  "pending",
  "confirmed",
  "refunded",
  "cancelled",
]);

export const revenueEventsTable = pgTable("revenue_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id, {
    onDelete: "set null",
  }),
  platform: revenuePlatformEnum("platform").notNull(),
  eventType: revenueEventTypeEnum("event_type").notNull(),
  status: revenueEventStatusEnum("status").notNull().default("confirmed"),
  grossAmountCents: integer("gross_amount_cents").notNull(),
  netAmountCents: integer("net_amount_cents").notNull(),
  currency: text("currency").notNull().default("BRL"),
  productName: text("product_name"),
  productId: text("product_id"),
  customerEmail: text("customer_email"),
  customerName: text("customer_name"),
  transactionId: text("transaction_id"),
  commissionAmountCents: integer("commission_amount_cents").default(0),
  isRecurring: boolean("is_recurring").notNull().default(false),
  webhookPayload: jsonb("webhook_payload").notNull().default({}),
  processedAt: timestamp("processed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const webhookConfigsTable = pgTable("webhook_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  platform: revenuePlatformEnum("platform").notNull(),
  webhookToken: text("webhook_token").notNull(),
  signingSecret: text("signing_secret"),
  isActive: boolean("is_active").notNull().default(true),
  metadata: jsonb("metadata").notNull().default({}),
  lastReceivedAt: timestamp("last_received_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertRevenueEventSchema = createInsertSchema(
  revenueEventsTable
).omit({ id: true, createdAt: true, processedAt: true });

export const insertWebhookConfigSchema = createInsertSchema(
  webhookConfigsTable
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertRevenueEvent = z.infer<typeof insertRevenueEventSchema>;
export type RevenueEvent = typeof revenueEventsTable.$inferSelect;
export type WebhookConfig = typeof webhookConfigsTable.$inferSelect;
export type RevenuePlatform = (typeof revenuePlatformEnum.enumValues)[number];
export type RevenueEventType = (typeof revenueEventTypeEnum.enumValues)[number];
