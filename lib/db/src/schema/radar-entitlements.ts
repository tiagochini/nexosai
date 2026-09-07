import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";

export const radarPackageEnum = pgEnum("radar_package", ["RADAR_ESSENTIAL", "RADAR_PRO", "RADAR_SCALE", "WAR_ROOM"]);
export const radarSubscriptionStatusEnum = pgEnum("radar_subscription_status", ["pending", "active", "cancelled", "expired"]);
export const radarCurrencyEnum = pgEnum("radar_billing_currency", ["BRL", "USD"]);
export const radarUsageDimensionEnum = pgEnum("radar_usage_dimension", ["light_scan", "detailed_scan", "council_run", "monitored_campaign", "competitor", "region"]);
export const radarPurchaseRequestStatusEnum = pgEnum("radar_purchase_request_status", ["pending_sales", "cancelled", "activated"]);
export const radarEntitlementSourceEnum = pgEnum("radar_entitlement_source", ["subscription_included", "asaas_purchase", "admin"]);
export const radarOrderStatusEnum = pgEnum("radar_order_status", ["initializing", "pending", "confirmed", "fulfilled", "overdue", "expired", "cancelled", "refunded"]);

/** A package's limits are snapshotted at activation so future catalog edits do not rewrite a contract. */
export const radarSubscriptionsTable = pgTable("radar_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  package: radarPackageEnum("package").notNull(),
  currency: radarCurrencyEnum("currency").notNull(),
  status: radarSubscriptionStatusEnum("status").notNull().default("pending"),
  periodStartsAt: timestamp("period_starts_at", { withTimezone: true }).notNull(),
  periodEndsAt: timestamp("period_ends_at", { withTimezone: true }).notNull(),
  windowStartsAt: timestamp("window_starts_at", { withTimezone: true }),
  windowEndsAt: timestamp("window_ends_at", { withTimezone: true }),
  limitsSnapshot: jsonb("limits_snapshot").notNull(),
  entitlementSource: radarEntitlementSourceEnum("entitlement_source").notNull().default("admin"),
  orderId: uuid("order_id"),
  campaignId: uuid("campaign_id"),
  activatedByUserId: uuid("activated_by_user_id"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("radar_subscriptions_workspace_status_idx").on(t.workspaceId, t.status, t.periodEndsAt),
  index("radar_subscriptions_workspace_window_idx").on(t.workspaceId, t.windowEndsAt),
]);

/** Immutable commercial record. Prices and package terms are never recalculated
 * after checkout; provider IDs and workspace/key constraints make fulfillment safe. */
export const radarOrdersTable = pgTable("radar_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  requestedByUserId: uuid("requested_by_user_id"),
  campaignId: uuid("campaign_id"),
  package: text("package").notNull(), // includes NO_RADAR customer preference
  currency: radarCurrencyEnum("currency").notNull(),
  amountCents: integer("amount_cents").notNull(),
  description: text("description").notNull(),
  limitsSnapshot: jsonb("limits_snapshot"),
  method: text("method"),
  status: radarOrderStatusEnum("status").notNull().default("pending"),
  idempotencyKey: text("idempotency_key").notNull(),
  providerPaymentId: text("provider_payment_id"),
  providerData: jsonb("provider_data").notNull().default({}),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex("radar_orders_workspace_idempotency_uidx").on(t.workspaceId, t.idempotencyKey),
  uniqueIndex("radar_orders_provider_payment_uidx").on(t.providerPaymentId),
  index("radar_orders_workspace_status_idx").on(t.workspaceId, t.status),
]);

/** Immutable, tenant-scoped reservations; a unique key makes retries safe and auditable. */
export const radarUsageLedgerTable = pgTable("radar_usage_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  subscriptionId: uuid("subscription_id").references(() => radarSubscriptionsTable.id, { onDelete: "set null" }),
  dimension: radarUsageDimensionEnum("dimension").notNull(),
  quantity: integer("quantity").notNull().default(1),
  campaignId: uuid("campaign_id"),
  idempotencyKey: text("idempotency_key").notNull(),
  periodStartsAt: timestamp("period_starts_at", { withTimezone: true }).notNull(),
  periodEndsAt: timestamp("period_ends_at", { withTimezone: true }).notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("radar_usage_workspace_idempotency_uidx").on(t.workspaceId, t.idempotencyKey),
  index("radar_usage_workspace_dimension_period_idx").on(t.workspaceId, t.dimension, t.periodStartsAt),
]);

/** Billing deliberately creates a sales request until a supported provider can activate it. */
export const radarPurchaseRequestsTable = pgTable("radar_purchase_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  package: radarPackageEnum("package").notNull(),
  currency: radarCurrencyEnum("currency").notNull(),
  status: radarPurchaseRequestStatusEnum("status").notNull().default("pending_sales"),
  requestedByUserId: uuid("requested_by_user_id"),
  notes: text("notes"),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [uniqueIndex("radar_purchase_request_workspace_key_uidx").on(t.workspaceId, t.idempotencyKey), index("radar_purchase_request_workspace_status_idx").on(t.workspaceId, t.status)]);