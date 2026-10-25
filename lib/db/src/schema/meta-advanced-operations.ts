import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  boolean,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { paidMediaAccountsTable, paidMediaEntitiesTable } from "./paid-media";
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

/** Workspace-scoped saved monitoring rule; evaluation is read-only and alerts require review. */
export const paidMediaOptimizationRulesTable = pgTable(
  "paid_media_optimization_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").notNull().references(() => paidMediaAccountsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    scheduleMinutes: integer("schedule_minutes").notNull().default(60),
    configuration: jsonb("configuration").notNull(),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull().defaultNow(),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdBy: text("created_by").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [index("paid_media_optimization_rules_due_idx").on(table.enabled, table.nextRunAt), index("paid_media_optimization_rules_workspace_idx").on(table.workspaceId, table.updatedAt)],
);

/** Durable in-app alerts generated by scheduled optimization rules. */
export const paidMediaOptimizationAlertsTable = pgTable(
  "paid_media_optimization_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
    ruleId: uuid("rule_id").notNull().references(() => paidMediaOptimizationRulesTable.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id").notNull().references(() => paidMediaEntitiesTable.id, { onDelete: "cascade" }),
    fingerprint: text("fingerprint").notNull(),
    severity: text("severity").notNull().default("info"),
    message: text("message").notNull(),
    metrics: jsonb("metrics").notNull().default({}),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("paid_media_optimization_alerts_fingerprint_uidx").on(table.ruleId, table.entityId, table.fingerprint), index("paid_media_optimization_alerts_workspace_created_idx").on(table.workspaceId, table.createdAt)],
);
