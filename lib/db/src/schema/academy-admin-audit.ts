import { pgTable, uuid, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { academyAccessEmailOutboxTable } from "./academy-access-email-outbox";
export const academyAdminAuditTable = pgTable("academy_admin_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(), method: varchar("method", { length: 10 }).notNull(),
  status: integer("status").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const academyDeliveryReconciliationsTable = pgTable("academy_delivery_reconciliations", {
  requestKey: text("request_key").primaryKey(),
  actorId: uuid("actor_id").notNull().references(() => usersTable.id),
  jobId: uuid("job_id").notNull().references(() => academyAccessEmailOutboxTable.id, { onDelete: "cascade" }),
  decision: varchar("decision", { length: 20 }).notNull(),
  evidenceHash: text("evidence_hash").notNull(), requestHash: text("request_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
