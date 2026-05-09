import {
  pgTable,
  text,
  uuid,
  timestamp,
  pgEnum,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";
import { campaignsTable } from "./campaigns";
import { domainsTable } from "./domains";

export const pageTypeEnum = pgEnum("page_type", [
  "landing",
  "sales",
  "capture",
  "thankyou",
  "funnel_step",
  "pwa",
]);

export const pageStatusEnum = pgEnum("page_status", [
  "draft",
  "preview",
  "published",
  "archived",
]);

export const pagesTable = pgTable("pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id, {
    onDelete: "set null",
  }),
  domainId: uuid("domain_id").references(() => domainsTable.id, {
    onDelete: "set null",
  }),
  type: pageTypeEnum("type").notNull().default("landing"),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  html: text("html"),
  metadata: jsonb("metadata").notNull().default({}),
  status: pageStatusEnum("status").notNull().default("draft"),
  publishedUrl: text("published_url"),
  isWhiteLabel: boolean("is_white_label").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertPageSchema = createInsertSchema(pagesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
});

export type InsertPage = z.infer<typeof insertPageSchema>;
export type Page = typeof pagesTable.$inferSelect;
