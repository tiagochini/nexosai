import { pgTable, smallint, numeric, uuid, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/** Singleton configuration for the platform-wide AI cost-to-credit conversion. */
export const aiCreditSettingsTable = pgTable("ai_credit_settings", {
  id: smallint("id").primaryKey().default(1),
  marginMultiplier: numeric("margin_multiplier", { precision: 8, scale: 4 }).notNull().default("3"),
  updatedBy: uuid("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
