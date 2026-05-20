import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";

export const launchPipelinesTable = pgTable("launch_pipelines", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"),
  currentPosition: integer("current_position").notNull().default(0),
  capturePosition: integer("capture_position").notNull().default(-1),
  totalCampaigns: integer("total_campaigns").notNull().default(0),
  config: jsonb("config").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type LaunchPipeline = typeof launchPipelinesTable.$inferSelect;
export type InsertLaunchPipeline = typeof launchPipelinesTable.$inferInsert;
