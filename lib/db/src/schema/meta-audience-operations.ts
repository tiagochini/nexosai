import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { paidMediaAccountsTable } from "./paid-media";

/** Immutable audience requests; intents prevent replay of ambiguous Graph mutations. */
export const metaAudienceOperationsTable = pgTable(
  "meta_audience_operations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => paidMediaAccountsTable.id, { onDelete: "cascade" }),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    encryptedRequest: text("encrypted_request"),
    summary: jsonb("summary").notNull(),
    status: text("status").notNull().default("draft"),
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    intent: jsonb("intent"),
    providerAudienceId: text("provider_audience_id"),
    evidence: jsonb("evidence").notNull().default({}),
    errorCode: text("error_code"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("meta_audience_operation_key_unique").on(
      table.workspaceId,
      table.idempotencyKey,
    ),
    index("meta_audience_operations_workspace_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
  ],
);
