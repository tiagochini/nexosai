import {
  pgTable,
  text,
  uuid,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";

export const clientProfilesTable = pgTable("client_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  industry: text("industry"),
  productName: text("product_name"),
  targetAudience: text("target_audience"),
  brandVoice: text("brand_voice"),
  mainPain: text("main_pain"),
  transformation: text("transformation"),
  website: text("website"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertClientProfileSchema = createInsertSchema(
  clientProfilesTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertClientProfile = z.infer<typeof insertClientProfileSchema>;
export type ClientProfile = typeof clientProfilesTable.$inferSelect;
