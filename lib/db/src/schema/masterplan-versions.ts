import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { campaignsTable } from "./campaigns";
import { usersTable } from "./users";
import { workspacesTable } from "./workspaces";
import { commercialProductsTable, commercialSubscriptionsTable } from "./commercial-entitlements";

export const masterplanVersionStatusEnum = pgEnum("masterplan_version_status", [
  "draft", "pending_approval", "approved", "superseded",
]);

/** Immutable, tenant-scoped materialization of the campaign's operational truth. */
export const masterplanVersionsTable = pgTable("masterplan_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  status: masterplanVersionStatusEnum("status").notNull().default("draft"),
  snapshot: jsonb("snapshot").notNull(),
  contentHash: text("content_hash").notNull(),
  contextFingerprint: text("context_fingerprint").notNull(),
  readinessScore: integer("readiness_score").notNull(),
  readinessStatus: text("readiness_status").notNull(),
  readinessBlockers: jsonb("readiness_blockers").notNull().default([]),
  autonomyContract: jsonb("autonomy_contract").notNull().default({}),
  allowedActions: jsonb("allowed_actions").notNull().default([]),
  requiredApprovals: jsonb("required_approvals").notNull().default([]),
  commercialProductId: uuid("commercial_product_id").references(() => commercialProductsTable.id, { onDelete: "set null" }),
  commercialSubscriptionId: uuid("commercial_subscription_id").references(() => commercialSubscriptionsTable.id, { onDelete: "set null" }),
  productIntakeVersionId: uuid("product_intake_version_id"),
  createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  approvedByUserId: uuid("approved_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  supersededAt: timestamp("superseded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("masterplan_versions_workspace_campaign_version_uidx").on(table.workspaceId, table.campaignId, table.version),
  index("masterplan_versions_workspace_campaign_status_idx").on(table.workspaceId, table.campaignId, table.status),
  index("masterplan_versions_workspace_campaign_created_idx").on(table.workspaceId, table.campaignId, table.createdAt),
]);

export type MasterplanVersion = typeof masterplanVersionsTable.$inferSelect;