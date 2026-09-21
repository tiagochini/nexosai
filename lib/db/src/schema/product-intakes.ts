import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgEnum, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { commercialProductsTable } from "./commercial-entitlements";
import { campaignsTable } from "./campaigns";
import { usersTable } from "./users";

export const productIntakeEntryPointEnum = pgEnum("product_intake_entry_point", ["launch", "market_intel", "social_media", "paid_media"]);
export const productIntakeStatusEnum = pgEnum("product_intake_status", ["draft", "approved", "locked", "superseded"]);

/** Canonical, provider-neutral product briefing. Each row is an immutable version once approved. */
export const productIntakesTable = pgTable("product_intakes", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  commercialProductId: uuid("commercial_product_id").notNull().references(() => commercialProductsTable.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  status: productIntakeStatusEnum("status").notNull().default("draft"),
  snapshot: jsonb("snapshot").notNull().default({}),
  entryPoint: productIntakeEntryPointEnum("entry_point").notNull(),
  sourceCampaignId: uuid("source_campaign_id").references(() => campaignsTable.id, { onDelete: "set null" }),
  createdByUserId: uuid("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  approvedByUserId: uuid("approved_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("product_intakes_workspace_product_version_uidx").on(table.workspaceId, table.commercialProductId, table.version),
  uniqueIndex("product_intakes_one_draft_per_product_uidx").on(table.workspaceId, table.commercialProductId).where(sql`${table.status} = 'draft'`),
  index("product_intakes_workspace_product_status_idx").on(table.workspaceId, table.commercialProductId, table.status),
]);

export type ProductIntake = typeof productIntakesTable.$inferSelect;