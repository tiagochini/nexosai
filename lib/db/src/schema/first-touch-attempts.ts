import { foreignKey, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { launchSequencesTable, launchSequenceItemsTable } from "./launch-sequences";
import { sequenceContactsTable } from "./sequence-contacts";
import { PUBLISH_STAGE_ONE } from "./publish-staging";

export const firstTouchAttemptStateEnum = pgEnum("first_touch_attempt_state", [
  "executing", "retryable", "ambiguous", "confirmed", "terminal",
]);

export const firstTouchAttemptsTable = pgTable("first_touch_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  sequenceId: uuid("sequence_id").notNull(),
  contactId: uuid("contact_id").notNull(),
  itemId: uuid("item_id").notNull(),
  channel: text("channel").notNull(),
  version: text("version").notNull(),
  attemptKey: text("attempt_key").notNull(),
  state: firstTouchAttemptStateEnum("state").notNull().default("executing"),
  leaseOwner: text("lease_owner"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  retryCount: integer("retry_count").notNull().default(0),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
  receipt: jsonb("receipt").notNull().default({}),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("first_touch_attempts_key_uidx").on(table.workspaceId, table.attemptKey),
  index("first_touch_attempts_due_idx").on(table.workspaceId, table.state, table.nextAttemptAt),
  ...(PUBLISH_STAGE_ONE ? [] : [
    foreignKey({ columns: [table.workspaceId, table.sequenceId], foreignColumns: [launchSequencesTable.workspaceId, launchSequencesTable.id], name: "first_touch_workspace_sequence_fk" }),
    foreignKey({ columns: [table.workspaceId, table.contactId], foreignColumns: [sequenceContactsTable.workspaceId, sequenceContactsTable.id], name: "first_touch_workspace_contact_fk" }),
    foreignKey({ columns: [table.workspaceId, table.itemId], foreignColumns: [launchSequenceItemsTable.workspaceId, launchSequenceItemsTable.id], name: "first_touch_workspace_item_fk" }),
  ]),
]);

export type FirstTouchAttempt = typeof firstTouchAttemptsTable.$inferSelect;