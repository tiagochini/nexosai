import {
  pgTable,
  foreignKey,
  index,
  text,
  uuid,
  timestamp,
  integer,
  pgEnum,
  jsonb,
  boolean,
  real,
} from "drizzle-orm/pg-core";
import { campaignsTable } from "./campaigns";
import { workspacesTable } from "./workspaces";

export const memoryTypeEnum = pgEnum("memory_type", [
  "approved_copy",
  "approved_strategy",
  "approved_offer",
  "approved_creative",
  "approved_ads",
  "approved_landing_page",
  "approved_vsl",
  "approved_social",
  "rejection_feedback",
  "performance_insight",
  "public_launch_reference",
]);

export const workspaceMemoryTable = pgTable("workspace_memory", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id"),
  memoryType: memoryTypeEnum("memory_type").notNull(),
  agentRole: text("agent_role").notNull(),
  contentType: text("content_type"),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  content: jsonb("content").notNull().default({}),
  tags: text("tags").array().default([]),
  qualityScore: real("quality_score"),
  isNegative: boolean("is_negative").notNull().default(false),
  isPublicReference: boolean("is_public_reference").notNull().default(false),
  productNiche: text("product_niche"),
  revenueRange: text("revenue_range"),
  usageCount: integer("usage_count").notNull().default(0),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  foreignKey({ name: "workspace_memory_project_scope_fk", columns: [table.workspaceId, table.campaignId], foreignColumns: [campaignsTable.workspaceId, campaignsTable.id] }).onDelete("cascade"),
  index("workspace_memory_project_scope_idx").on(table.workspaceId, table.campaignId, table.agentRole),
]);

export type WorkspaceMemory = typeof workspaceMemoryTable.$inferSelect;
export type InsertWorkspaceMemory = typeof workspaceMemoryTable.$inferInsert;
