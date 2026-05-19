import { pgTable, uuid, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { workspacesTable } from "./workspaces";

export const inviteCodesTable = pgTable("invite_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 20 }).unique().notNull(),
  planSlug: varchar("plan_slug", { length: 20 }).notNull().default("agency"),
  label: varchar("label", { length: 200 }),
  used: boolean("used").notNull().default(false),
  usedByEmail: varchar("used_by_email", { length: 255 }),
  usedByUserId: uuid("used_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  usedByWorkspaceId: uuid("used_by_workspace_id").references(() => workspacesTable.id, { onDelete: "set null" }),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InviteCode = typeof inviteCodesTable.$inferSelect;
export type NewInviteCode = typeof inviteCodesTable.$inferInsert;
