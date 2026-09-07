import {
  pgTable,
  text,
  uuid,
  timestamp,
  pgEnum,
  jsonb,
  boolean,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";
import { campaignsTable } from "./campaigns";
import { domainsTable } from "./domains";
import { launchSequencesTable } from "./launch-sequences";

export const pageTypeEnum = pgEnum("page_type", [
  "landing",
  "sales",
  "capture",
  "thankyou",
  "funnel_step",
  "pwa",
]);

export const pageStatusEnum = pgEnum("page_status", [
  "draft",
  "preview",
  "published",
  "archived",
]);

export const pagesTable = pgTable("pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id, {
    onDelete: "set null",
  }),
  domainId: uuid("domain_id").references(() => domainsTable.id, {
    onDelete: "set null",
  }),
  type: pageTypeEnum("type").notNull().default("landing"),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  html: text("html"),
  metadata: jsonb("metadata").notNull().default({}),
  status: pageStatusEnum("status").notNull().default("draft"),
  publishedUrl: text("published_url"),
  isWhiteLabel: boolean("is_white_label").notNull().default(false),
  leadCaptureSequenceId: uuid("lead_capture_sequence_id").references(() => launchSequencesTable.id, { onDelete: "set null" }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const landingRevisionStatusEnum = pgEnum("landing_revision_status", ["generated", "validated", "published", "superseded"]);
export const landingDeploymentStatusEnum = pgEnum("landing_deployment_status", ["pending", "deploying", "deployed", "failed", "capability_blocked", "rolled_back"]);

/** Generated source is immutable: publishing always points to a numbered revision. */
export const landingRevisionsTable = pgTable("landing_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  pageId: uuid("page_id").notNull().references(() => pagesTable.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull(),
  source: jsonb("source").notNull(),
  html: text("html").notNull(),
  contentHash: text("content_hash").notNull(),
  status: landingRevisionStatusEnum("status").notNull().default("generated"),
  validationErrors: jsonb("validation_errors").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("landing_revisions_page_revision_uq").on(table.pageId, table.revision)]);

export const landingDeploymentsTable = pgTable("landing_deployments", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  pageId: uuid("page_id").notNull().references(() => pagesTable.id, { onDelete: "cascade" }),
  revisionId: uuid("revision_id").notNull().references(() => landingRevisionsTable.id, { onDelete: "cascade" }),
  domainId: uuid("domain_id").references(() => domainsTable.id, { onDelete: "set null" }),
  status: landingDeploymentStatusEnum("status").notNull().default("pending"),
  idempotencyKey: text("idempotency_key").notNull(),
  provider: text("provider"),
  providerDeploymentId: text("provider_deployment_id"),
  deploymentUrl: text("deployment_url"),
  logs: jsonb("logs").notNull().default([]),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [uniqueIndex("landing_deployments_workspace_idempotency_uq").on(table.workspaceId, table.idempotencyKey)]);

export const insertPageSchema = createInsertSchema(pagesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
});

export type InsertPage = z.infer<typeof insertPageSchema>;
export type Page = typeof pagesTable.$inferSelect;
