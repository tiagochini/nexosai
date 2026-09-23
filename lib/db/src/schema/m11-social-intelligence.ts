import { pgTable, uuid, text, timestamp, jsonb, integer, index } from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { usersTable } from "./users";

/** Immutable, auditable snapshot of the read-only social intelligence report. */
export const m11SocialReportsTable = pgTable("m11_social_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").notNull().references(() => usersTable.id),
  periodFrom: timestamp("period_from", { withTimezone: true }).notNull(),
  periodTo: timestamp("period_to", { withTimezone: true }).notNull(),
  filters: jsonb("filters").notNull().default({}),
  aggregates: jsonb("aggregates").notNull().default({}),
  provenance: jsonb("provenance").notNull().default({}),
  rowCount: integer("row_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("m11_social_reports_workspace_created_idx").on(table.workspaceId, table.createdAt, table.id),
]);

export type M11SocialReport = typeof m11SocialReportsTable.$inferSelect;