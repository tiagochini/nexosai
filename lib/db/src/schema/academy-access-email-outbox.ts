import { sql } from "drizzle-orm";
import { pgTable, uuid, varchar, text, integer, timestamp, uniqueIndex, index, check } from "drizzle-orm/pg-core";
import { academyPurchasesTable } from "./academy-purchases";

export type AcademyAccessEmailStatus = "scheduled" | "sending" | "sent" | "failed" | "skipped";
export const academyAccessEmailOutboxTable = pgTable("academy_access_email_outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  purchaseId: uuid("purchase_id").notNull().references(() => academyPurchasesTable.id, { onDelete: "cascade" }),
  deliveryKey: text("delivery_key").notNull(),
  purpose: varchar("purpose", { length: 30 }).notNull().default("initial"),
  status: varchar("status", { length: 20 }).$type<AcademyAccessEmailStatus>().notNull().default("scheduled"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  providerId: varchar("provider_id", { length: 100 }),
  errorCode: varchar("error_code", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("academy_access_email_key_uidx").on(table.deliveryKey),
  uniqueIndex("academy_access_email_active_uidx").on(table.purchaseId).where(sql`${table.status} in ('scheduled', 'sending')`),
  index("academy_access_email_due_idx").on(table.nextAttemptAt, table.id).where(sql`${table.status} = 'scheduled'`),
  check("academy_access_email_outbox_status_check", sql`${table.status} in ('scheduled', 'sending', 'sent', 'failed', 'skipped')`),
  check("academy_access_email_outbox_attempts_check", sql`${table.attempts} >= 0`),
]);

export const academyAccessDeliveryRequestsTable = pgTable("academy_access_delivery_requests", {
  requestKey: text("request_key").primaryKey(),
  purchaseId: uuid("purchase_id").notNull().references(() => academyPurchasesTable.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").notNull().references(() => academyAccessEmailOutboxTable.id, { onDelete: "cascade" }),
  requestHash: text("request_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
