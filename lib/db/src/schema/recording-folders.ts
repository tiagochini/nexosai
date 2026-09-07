import { pgTable, text, timestamp, uuid, boolean, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workspacesTable } from "./workspaces";

export type RecordingFolderSystemType = "automatic" | "manual";

export const recordingFoldersTable = pgTable("recording_folders", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  systemType: text("system_type"), // RecordingFolderSystemType, null for user folders
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("recording_folders_workspace_slug_uidx").on(table.workspaceId, table.slug),
  uniqueIndex("recording_folders_workspace_system_type_uidx")
    .on(table.workspaceId, table.systemType)
    .where(sql`${table.isSystem} = true and ${table.systemType} is not null`),
  check(
    "recording_folders_system_type_check",
    sql`${table.systemType} is null or ${table.systemType} in ('automatic', 'manual')`,
  ),
  check(
    "recording_folders_system_consistency_check",
    sql`(${table.isSystem} = true and ${table.systemType} is not null) or (${table.isSystem} = false and ${table.systemType} is null)`,
  ),
]);