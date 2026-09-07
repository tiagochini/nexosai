import {
  pgTable,
  text,
  uuid,
  timestamp,
  pgEnum,
  boolean,
  jsonb,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";

export const domainTypeEnum = pgEnum("domain_type", [
  "nexos_subdomain",
  "custom",
  "resold",
]);

export const domainSslStatusEnum = pgEnum("domain_ssl_status", [
  "pending",
  "active",
  "failed",
  "expired",
]);

export const domainLifecycleStatusEnum = pgEnum("domain_lifecycle_status", [
  "pending_payment", "registration_pending", "active", "renewal_due",
  "renewal_pending", "expired", "failed", "capability_blocked",
]);

export const domainOperationTypeEnum = pgEnum("domain_operation_type", [
  "availability", "register", "renew", "dns_upsert", "dns_delete",
]);

export const domainOperationStatusEnum = pgEnum("domain_operation_status", [
  "pending", "succeeded", "failed", "capability_blocked",
]);

export const domainsTable = pgTable("domains", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  domain: text("domain").notNull().unique(),
  type: domainTypeEnum("type").notNull().default("nexos_subdomain"),
  sslStatus: domainSslStatusEnum("ssl_status").notNull().default("pending"),
  isPrimary: boolean("is_primary").notNull().default(false),
  dnsVerified: boolean("dns_verified").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  lifecycleStatus: domainLifecycleStatusEnum("lifecycle_status").notNull().default("active"),
  registrarProvider: text("registrar_provider"),
  registrarDomainId: text("registrar_domain_id"),
  autoRenew: boolean("auto_renew").notNull().default(true),
  renewalAttempts: integer("renewal_attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** Provider calls are persisted before and after execution to make retries auditable. */
export const domainOperationsTable = pgTable("domain_operations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  domainId: uuid("domain_id").references(() => domainsTable.id, { onDelete: "cascade" }),
  operation: domainOperationTypeEnum("operation").notNull(),
  status: domainOperationStatusEnum("status").notNull().default("pending"),
  idempotencyKey: text("idempotency_key").notNull(),
  provider: text("provider"),
  providerOperationId: text("provider_operation_id"),
  request: jsonb("request").notNull().default({}),
  response: jsonb("response"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [uniqueIndex("domain_operations_workspace_idempotency_uq").on(table.workspaceId, table.idempotencyKey)]);

export const domainDnsRecordsTable = pgTable("domain_dns_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  domainId: uuid("domain_id").notNull().references(() => domainsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  name: text("name").notNull(),
  value: text("value").notNull(),
  ttl: integer("ttl").notNull().default(300),
  providerRecordId: text("provider_record_id"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [uniqueIndex("domain_dns_records_domain_record_uq").on(table.domainId, table.type, table.name)]);

export const insertDomainSchema = createInsertSchema(domainsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDomain = z.infer<typeof insertDomainSchema>;
export type Domain = typeof domainsTable.$inferSelect;
