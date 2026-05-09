import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { plansTable } from "./plans";

export const workspaceStatusEnum = pgEnum("workspace_status", [
  "active",
  "suspended",
  "cancelled",
]);

export const workspacesTable = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plansTable.id),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: workspaceStatusEnum("status").notNull().default("active"),
  creditsBalance: integer("credits_balance").notNull().default(0),
  creditsLastReset: timestamp("credits_last_reset", { withTimezone: true })
    .notNull()
    .defaultNow(),
  activeCampaigns: integer("active_campaigns").notNull().default(0),
  logoUrl: text("logo_url"),
  brandName: text("brand_name"),
  customDomain: text("custom_domain"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertWorkspaceSchema = createInsertSchema(workspacesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  creditsBalance: true,
  creditsLastReset: true,
  activeCampaigns: true,
});

export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
export type Workspace = typeof workspacesTable.$inferSelect;
