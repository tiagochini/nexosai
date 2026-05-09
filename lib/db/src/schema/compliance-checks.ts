import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspaces";
import { campaignsTable } from "./campaigns";
import { contentPiecesTable } from "./content";
import { usersTable } from "./users";

export const complianceSeverityEnum = pgEnum("compliance_severity", [
  "none",
  "low",
  "medium",
  "high",
  "critical",
]);

export const complianceStatusEnum = pgEnum("compliance_status", [
  "pending",
  "passed",
  "warning",
  "failed",
  "overridden",
]);

export const compliancePlatformEnum = pgEnum("compliance_platform", [
  "meta_ads",
  "google_ads",
  "tiktok",
  "conar",
  "cvm",
  "anvisa",
  "generic",
]);

export const reviewActionEnum = pgEnum("review_action", [
  "approved",
  "rejected",
  "modified",
]);

export type ComplianceViolation = {
  rule: string;
  severity: "low" | "medium" | "high" | "critical";
  excerpt: string;
  description: string;
  suggestion: string;
  platform?: string;
};

export const complianceChecksTable = pgTable("compliance_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id, {
    onDelete: "set null",
  }),
  contentId: uuid("content_id").references(() => contentPiecesTable.id, {
    onDelete: "set null",
  }),
  contentTitle: text("content_title").notNull(),
  contentType: text("content_type").notNull(),
  contentText: text("content_text").notNull(),
  platform: compliancePlatformEnum("platform").notNull().default("generic"),
  status: complianceStatusEnum("status").notNull().default("pending"),
  overallSeverity: complianceSeverityEnum("overall_severity")
    .notNull()
    .default("none"),
  complianceScore: integer("compliance_score").notNull().default(100),
  violations: jsonb("violations")
    .notNull()
    .$type<ComplianceViolation[]>()
    .default([]),
  suggestions: jsonb("suggestions")
    .notNull()
    .$type<string[]>()
    .default([]),
  checkedBy: text("checked_by").notNull().default("claude-3-5-sonnet-20241022"),
  traceId: text("trace_id").notNull(),
  reviewedBy: uuid("reviewed_by").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  reviewAction: reviewActionEnum("review_action"),
  reviewNote: text("review_note"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  autoBlocked: integer("auto_blocked").notNull().default(0),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertComplianceCheckSchema = createInsertSchema(
  complianceChecksTable
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertComplianceCheck = z.infer<typeof insertComplianceCheckSchema>;
export type ComplianceCheck = typeof complianceChecksTable.$inferSelect;
export type ComplianceSeverity =
  (typeof complianceSeverityEnum.enumValues)[number];
export type ComplianceStatus =
  (typeof complianceStatusEnum.enumValues)[number];
export type CompliancePlatform =
  (typeof compliancePlatformEnum.enumValues)[number];
