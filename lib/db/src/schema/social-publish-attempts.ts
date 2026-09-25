import { foreignKey, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { socialPostsTable } from "./social-posts";
import { PUBLISH_STAGE_ONE } from "./publish-staging";

export const socialPublishAttemptStateEnum = pgEnum("social_publish_attempt_state", [
  "executing", "ambiguous", "retryable", "confirmed", "terminal", "manual_recovery",
]);

export const socialPublishAttemptsTable = pgTable("social_publish_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  postId: uuid("post_id").notNull().references(() => socialPostsTable.id, { onDelete: "cascade" }),
  attemptKey: text("attempt_key").notNull(),
  contentFingerprint: text("content_fingerprint").notNull(),
  state: socialPublishAttemptStateEnum("state").notNull().default("executing"),
  leaseOwner: text("lease_owner"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  retryCount: integer("retry_count").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
  providerStage: text("provider_stage"),
  providerContainerId: text("provider_container_id"),
  providerPublishId: text("provider_publish_id"),
  receipt: jsonb("receipt").notNull().default({}),
  readback: jsonb("readback").notNull().default({}),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("social_publish_attempts_post_key_uidx").on(table.postId, table.attemptKey),
  index("social_publish_attempts_workspace_state_idx").on(table.workspaceId, table.state, table.nextAttemptAt),
  ...(PUBLISH_STAGE_ONE ? [] : [foreignKey({
    columns: [table.workspaceId, table.postId],
    foreignColumns: [socialPostsTable.workspaceId, socialPostsTable.id],
    name: "social_publish_attempts_workspace_post_fk",
  })]),
]);

export type SocialPublishAttempt = typeof socialPublishAttemptsTable.$inferSelect;