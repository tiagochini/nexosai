import { pgTable, text, integer, numeric, boolean, uuid, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/** Admin-managed catalog for the fixed credit packs shown in billing. */
export const creditPackPricingTable = pgTable("credit_pack_pricing", {
  id: text("id").primaryKey(),
  credits: integer("credits").notNull(),
  priceBrl: numeric("price_brl", { precision: 10, scale: 2 }).notNull(),
  label: text("label").notNull(),
  description: text("description").notNull(),
  highlight: boolean("highlight").notNull().default(false),
  updatedBy: uuid("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
