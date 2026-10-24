import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { paidMediaAccountsTable, paidMediaDatasetsTable } from "./paid-media";
// Diagnostic records never enter production receipts, conversions or retry queues.
export const metaCapiTestsTable = pgTable(
  "meta_capi_tests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => paidMediaAccountsTable.id, { onDelete: "cascade" }),
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => paidMediaDatasetsTable.id, { onDelete: "cascade" }),
    requestHash: text("request_hash").notNull(),
    encryptedRequest: text("encrypted_request"),
    summary: jsonb("summary").notNull(),
    status: text("status").notNull().default("prepared"),
    intent: jsonb("intent"),
    evidence: jsonb("evidence").notNull().default({}),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("meta_capi_tests_workspace_idx").on(
      table.workspaceId,
      table.updatedAt,
    ),
  ],
);
