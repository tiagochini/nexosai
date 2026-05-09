import { pgTable, text, uuid, timestamp, boolean } from "drizzle-orm/pg-core";

export const waitlistTable = pgTable("waitlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  whatsapp: text("whatsapp").notNull(),
  email: text("email"),
  segment: text("segment").notNull().default("individual"), // 'individual' | 'agency'
  source: text("source"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  notified: boolean("notified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
