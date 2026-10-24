import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { paidMediaAccountsTable } from "./paid-media";
import { launchSequencesTable } from "./launch-sequences";
import { sequenceContactsTable } from "./sequence-contacts";
import { metaAudienceOperationsTable } from "./meta-audience-operations";
export const metaCrmConsentsTable = pgTable(
  "meta_crm_consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => sequenceContactsTable.id, { onDelete: "cascade" }),
    encryptedProof: text("encrypted_proof"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    actor: text("actor").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("meta_crm_consents_contact_unique").on(
      table.workspaceId,
      table.contactId,
    ),
  ],
);
export const metaCrmSyncsTable = pgTable(
  "meta_crm_syncs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => paidMediaAccountsTable.id, { onDelete: "cascade" }),
    sequenceId: uuid("sequence_id")
      .notNull()
      .references(() => launchSequencesTable.id, { onDelete: "cascade" }),
    seedOperationId: uuid("seed_operation_id")
      .notNull()
      .references(() => metaAudienceOperationsTable.id, {
        onDelete: "restrict",
      }),
    audienceId: text("audience_id").notNull(),
    configuration: jsonb("configuration").notNull(),
    configurationHash: text("configuration_hash").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    status: text("status").notNull().default("draft"),
    approvedBy: text("approved_by"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    nextRunAt: timestamp("next_run_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    stateCipher: text("state_cipher"),
    intent: jsonb("intent"),
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    evidence: jsonb("evidence").notNull().default({}),
    errorCode: text("error_code"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("meta_crm_sync_seed_unique").on(table.seedOperationId),
    index("meta_crm_sync_due_idx").on(table.enabled, table.nextRunAt),
  ],
);
export const metaExperimentsTable = pgTable(
  "meta_experiments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspacesTable.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => paidMediaAccountsTable.id, { onDelete: "cascade" }),
    configuration: jsonb("configuration").notNull(),
    configurationHash: text("configuration_hash").notNull(),
    status: text("status").notNull().default("draft"),
    approvedBy: text("approved_by"),
    providerStudyId: text("provider_study_id"),
    intent: jsonb("intent"),
    evidence: jsonb("evidence").notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("meta_experiments_workspace_idx").on(
      table.workspaceId,
      table.updatedAt,
    ),
  ],
);
