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

export const insertContractVersionSchema = createInsertSchema(contractVersionsTable).omit({ id: true, createdAt: true });
export const insertContractAcceptanceSchema = createInsertSchema(contractAcceptancesTable).omit({ id: true, createdAt: true, acceptedAt: true, revokedAt: true, revokedByUserId: true, revocationReason: true });
export type InsertContractVersion = z.infer<typeof insertContractVersionSchema>;
export type ContractVersion = typeof contractVersionsTable.$inferSelect;
export type InsertContractAcceptance = z.infer<typeof insertContractAcceptanceSchema>;
export type ContractAcceptance = typeof contractAcceptancesTable.$inferSelect;