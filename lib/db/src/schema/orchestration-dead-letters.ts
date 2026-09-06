import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { campaignsTable } from "./campaigns";
import { workspacesTable } from "./workspaces";

export const deadLetterClassificationEnum = pgEnum("dead_letter_classification", [
  "retryable",
  "terminal",
  "manual",
]);

export const deadLetterReplayStatusEnum = pgEnum("dead_letter_replay_status", [
  "none",
  "claimed",
  "queued",
  "succeeded",
  "failed",
]);

/**
 * Intentionally contains operational metadata only.  Inputs, job payloads,
 * provider responses and stack traces do not belong in a durable DLQ record.
 */
export const orchestrationDeadLettersTable = pgTable("orchestration_dead_letters", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").notNull().references(() => campaignsTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  jobId: text("job_id").notNull(),
  correlationId: text("correlation_id").notNull(),
  attemptCount: integer("attempt_count").notNull(),
  classification: deadLetterClassificationEnum("classification").notNull(),
  errorSummary: text("error_summary").notNull(),
  source: text("source").notNull().default("worker"),
  firstFailedAt: timestamp("first_failed_at", { withTimezone: true }).notNull().defaultNow(),
  lastFailedAt: timestamp("last_failed_at", { withTimezone: true }).notNull().defaultNow(),
  replayStatus: deadLetterReplayStatusEnum("replay_status").notNull().default("none"),
  replayJobId: text("replay_job_id"),
  replayedBy: text("replayed_by"),
  replayedAt: timestamp("replayed_at", { withTimezone: true }),
  replayFinishedAt: timestamp("replay_finished_at", { withTimezone: true }),
  replayErrorSummary: text("replay_error_summary"),
}, (table) => [
  index("orchestration_dead_letters_workspace_idx").on(table.workspaceId, table.lastFailedAt),
  index("orchestration_dead_letters_campaign_idx").on(table.campaignId, table.lastFailedAt),
  index("orchestration_dead_letters_job_idx").on(table.jobId),
]);