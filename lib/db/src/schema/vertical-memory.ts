import { pgTable, uuid, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";

export const verticalMemoryTable = pgTable("vertical_memory", {
  id: uuid("id").primaryKey().defaultRandom(),
  verticalKey: text("vertical_key").notNull(),
  workspaceId: uuid("workspace_id").references(() => workspacesTable.id, { onDelete: "set null" }),
  campaignType: text("campaign_type"),
  track: text("track"),
  sampleCount: integer("sample_count").notNull().default(0),
  avgHealthScore: integer("avg_health_score"),
  learnings: jsonb("learnings").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type VerticalMemory = typeof verticalMemoryTable.$inferSelect;
export type InsertVerticalMemory = typeof verticalMemoryTable.$inferInsert;
