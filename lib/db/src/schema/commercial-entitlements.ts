import { index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { usersTable } from "./users";

/** Provider-neutral commercial catalog. Prices intentionally do not live here. */
export const commercialProductStatusEnum = pgEnum("commercial_product_status", ["active", "retired"]);
export const commercialSubscriptionStatusEnum = pgEnum("commercial_subscription_status", ["pending", "active", "paused", "cancelled", "expired"]);
export const entitlementGrantSourceEnum = pgEnum("entitlement_grant_source", ["subscription", "admin", "migration"]);

export const commercialProductsTable = pgTable("commercial_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  masterPlanKey: text("master_plan_key").notNull(),
  status: commercialProductStatusEnum("status").notNull().default("active"),
  capabilities: jsonb("capabilities").notNull().default({}),
  usagePolicy: jsonb("usage_policy").notNull().default({}),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const commercialSubscriptionsTable = pgTable("commercial_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => commercialProductsTable.id),
  status: commercialSubscriptionStatusEnum("status").notNull().default("pending"),
  providerMetadata: jsonb("provider_metadata").notNull().default({}),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("commercial_subscriptions_workspace_status_idx").on(table.workspaceId, table.status),
]);

/** A grant is the immutable, auditable entitlement snapshot used by the resolver. */
export const entitlementGrantsTable = pgTable("entitlement_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  subscriptionId: uuid("subscription_id").notNull().references(() => commercialSubscriptionsTable.id, { onDelete: "cascade" }),
  capability: text("capability").notNull(),
  value: jsonb("value").notNull(),
  source: entitlementGrantSourceEnum("source").notNull().default("subscription"),
  grantedByUserId: uuid("granted_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("entitlement_grants_subscription_capability_uidx").on(table.subscriptionId, table.capability),
  index("entitlement_grants_workspace_idx").on(table.workspaceId),
]);

export type CommercialProduct = typeof commercialProductsTable.$inferSelect;
export type CommercialSubscription = typeof commercialSubscriptionsTable.$inferSelect;
export type EntitlementGrant = typeof entitlementGrantsTable.$inferSelect;