import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
export const academyGiftBatchesTable = pgTable("academy_gift_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestKey: text("request_key").notNull().unique(),
  requestHash: text("request_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
