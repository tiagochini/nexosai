import {
  pgTable,
  text,
  uuid,
  timestamp,
  pgEnum,
  boolean,
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
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertDomainSchema = createInsertSchema(domainsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDomain = z.infer<typeof insertDomainSchema>;
export type Domain = typeof domainsTable.$inferSelect;
