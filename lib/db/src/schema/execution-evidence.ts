import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { campaignsTable } from "./campaigns";
import { masterplanVersionsTable } from "./masterplan-versions";
import { workspacesTable } from "./workspaces";

/** Append-only facts at a real provider mutation boundary. */
export const executionEvidenceStateEnum = pgEnum("execution_evidence_state", [
  "planned", "attempted", "provider_confirmed", "artifact_qc",
]);

export const executionEvidenceTable = pgTable("execution_evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  campaignId: uuid("campaign_id").references(() => campaignsTable.id, { onDelete: "set null" }),
  masterplanVersionId: uuid("masterplan_version_id").references(() => masterplanVersionsTable.id, { onDelete: "restrict" }),
  contextFingerprint: text("context_fingerprint"),
  subjectType: text("subject_type").notNull(),
  subjectId: uuid("subject_id").notNull(),
  state: executionEvidenceStateEnum("state").notNull(),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("execution_evidence_workspace_subject_idx").on(table.workspaceId, table.subjectType, table.subjectId, table.createdAt),
  index("execution_evidence_workspace_campaign_idx").on(table.workspaceId, table.campaignId, table.createdAt),
  index("execution_evidence_workspace_campaign_created_id_idx").on(table.workspaceId, table.campaignId, table.createdAt, table.id),
]);