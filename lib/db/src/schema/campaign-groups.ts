import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { campaignsTable } from "./campaigns";
import { workspacesTable } from "./workspaces";

export const groupPlatformEnum = pgEnum("group_platform", [
  "whatsapp",
  "telegram",
  "facebook",
]);

export const groupStatusEnum = pgEnum("group_status", [
  "active",
  "inactive",
  "archived",
]);

export const campaignGroupsTable = pgTable("campaign_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaignsTable.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  platform: groupPlatformEnum("platform").notNull(),
  groupName: text("group_name").notNull(),
  groupLink: text("group_link"),
  groupId: text("group_id"),
  description: text("description"),
  segment: text("segment"),
  memberCount: integer("member_count").default(0),
  status: groupStatusEnum("status").notNull().default("active"),
  metadata: jsonb("metadata").notNull().default({}).$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertCampaignGroupSchema = createInsertSchema(campaignGroupsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCampaignGroup = z.infer<typeof insertCampaignGroupSchema>;
export type CampaignGroup = typeof campaignGroupsTable.$inferSelect;
export type GroupPlatform = (typeof groupPlatformEnum.enumValues)[number];
export type GroupStatus = (typeof groupStatusEnum.enumValues)[number];
