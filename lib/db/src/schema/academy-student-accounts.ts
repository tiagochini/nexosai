import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// One row per user makes replacing the active session atomic across API workers.
export const academyStudentAccountsTable = pgTable("academy_student_accounts", {
  userId: uuid("user_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
  sessionHash: text("session_hash"),
  sessionExpiresAt: timestamp("session_expires_at", { withTimezone: true }),
  resetHash: text("reset_hash"),
  resetExpiresAt: timestamp("reset_expires_at", { withTimezone: true }),
  progress: jsonb("progress").$type<Record<string, boolean>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
