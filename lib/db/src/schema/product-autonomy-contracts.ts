import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { campaignsTable } from "./campaigns";
import { usersTable } from "./users";
import { workspacesTable } from "./workspaces";

export const contractAcceptanceTypeEnum = pgEnum("contract_acceptance_type", [
  "autonomy",
  "regulated_activity",
  "asset_rights",
]);
export const mandatoryPauseClassEnum = pgEnum("mandatory_pause_class", [
  "probable_illegality", "fraud", "rights_violation", "severe_account_ban_risk", "overspend", "severe_reputational_crisis",
]);
export const mandatoryPauseStatusEnum = pgEnum("mandatory_pause_status", ["active", "resolved"]);
export const mandatoryPauseSourceTypeEnum = pgEnum("mandatory_pause_source_type", ["user", "automated"]);

export const contractVersionsTable = pgTable(
  "contract_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractKey: text("contract_key").notNull(),
    version: text("version").notNull(),
    contentHash: text("content_hash").notNull(),
    contentSnapshot: text("content_snapshot").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("contract_versions_key_version_unique").on(table.contractKey, table.version),
    uniqueIndex("contract_versions_key_hash_unique").on(table.contractKey, table.contentHash),
  ],
);

export const contractAcceptancesTable = pgTable(
  "contract_acceptances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
    campaignId: uuid("campaign_id").references(() => campaignsTable.id, { onDelete: "cascade" }),
    contractKey: text("contract_key").notNull(),
    contractVersion: text("contract_version").notNull(),
    contractHash: text("contract_hash").notNull(),
    acceptanceType: contractAcceptanceTypeEnum("acceptance_type").notNull(),
    evidenceSnapshot: jsonb("evidence_snapshot").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    idempotencyKey: text("idempotency_key").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByUserId: uuid("revoked_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    revocationReason: text("revocation_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("contract_acceptances_workspace_idempotency_unique").on(table.workspaceId, table.idempotencyKey),
    index("contract_acceptances_workspace_campaign_type_idx").on(table.workspaceId, table.campaignId, table.acceptanceType),
    index("contract_acceptances_contract_idx").on(table.contractKey, table.contractVersion, table.contractHash),
  ],
);

/** Immutable safety findings. Resolution annotates a finding; it is never deleted. */
export const mandatoryPausesTable = pgTable(
  "mandatory_pauses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => campaignsTable.id, { onDelete: "cascade" }),
    channel: text("channel"),
    action: text("action"),
    pauseClass: mandatoryPauseClassEnum("pause_class").notNull(),
    severity: text("severity").notNull(),
    status: mandatoryPauseStatusEnum("status").notNull().default("active"),
    reason: text("reason").notNull(),
    evidenceSummary: text("evidence_summary").notNull(),
    sourceActor: text("source_actor").notNull(),
    sourceType: mandatoryPauseSourceTypeEnum("source_type").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    resolutionReason: text("resolution_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("mandatory_pauses_workspace_idempotency_unique").on(table.workspaceId, table.idempotencyKey),
    index("mandatory_pauses_workspace_status_scope_idx").on(table.workspaceId, table.status, table.campaignId, table.channel, table.action),
  ],
);

export const insertContractVersionSchema = createInsertSchema(contractVersionsTable).omit({ id: true, createdAt: true });
export const insertContractAcceptanceSchema = createInsertSchema(contractAcceptancesTable).omit({ id: true, createdAt: true, acceptedAt: true, revokedAt: true, revokedByUserId: true, revocationReason: true });
export type InsertContractVersion = z.infer<typeof insertContractVersionSchema>;
export type ContractVersion = typeof contractVersionsTable.$inferSelect;
export type InsertContractAcceptance = z.infer<typeof insertContractAcceptanceSchema>;
export type ContractAcceptance = typeof contractAcceptancesTable.$inferSelect;
export const insertMandatoryPauseSchema = createInsertSchema(mandatoryPausesTable).omit({ id: true, createdAt: true, updatedAt: true, resolvedAt: true, resolvedByUserId: true, resolutionReason: true });
export type MandatoryPause = typeof mandatoryPausesTable.$inferSelect;