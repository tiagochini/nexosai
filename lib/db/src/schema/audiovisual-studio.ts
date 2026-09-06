import {
  foreignKey,
  index,
  integer,
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
import { videoProjectsTable } from "./video-projects";
import { workspacesTable } from "./workspaces";

export const productionManifestStatusEnum = pgEnum("production_manifest_status", [
  "draft",
  "active",
  "locked",
  "archived",
]);

export const productionAssetTypeEnum = pgEnum("production_asset_type", [
  "video",
  "audio",
  "image",
  "subtitle",
  "graphic",
  "font",
  "document",
]);

export const productionAssetStatusEnum = pgEnum("production_asset_status", [
  "uploading",
  "ready",
  "processing",
  "failed",
  "archived",
]);

export const timelineTrackTypeEnum = pgEnum("timeline_track_type", [
  "video",
  "audio",
  "voiceover",
  "music",
  "graphics",
  "subtitles",
]);

export const renderJobStatusEnum = pgEnum("render_job_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

/** Durable state for an explicitly requested ephemeral-media destruction. */
export const videoMediaPurgeStatusEnum = pgEnum("video_media_purge_status", [
  "requested",
  "in_progress",
  "purge_failed",
  "purged",
]);

export const qcReportStatusEnum = pgEnum("qc_report_status", [
  "pending",
  "passed",
  "failed",
  "needs_review",
]);

export const qcIssueSeverityEnum = pgEnum("qc_issue_severity", [
  "info",
  "warning",
  "error",
  "blocking",
]);

export const qcIssueStatusEnum = pgEnum("qc_issue_status", [
  "open",
  "acknowledged",
  "resolved",
  "wont_fix",
]);

export const productionRevisionStatusEnum = pgEnum("production_revision_status", [
  "draft",
  "in_review",
  "approved",
  "superseded",
]);

export const correctionLoopStatusEnum = pgEnum("correction_loop_status", [
  "open",
  "in_progress",
  "resolved",
  "cancelled",
]);

const projectWorkspaceForeignKey = (
  table: { workspaceId: unknown; videoProjectId: unknown },
  name: string,
) =>
  foreignKey({
    columns: [table.workspaceId as any, table.videoProjectId as any],
    foreignColumns: [videoProjectsTable.workspaceId, videoProjectsTable.id],
    name,
  }).onDelete("cascade");

export const productionManifestsTable = pgTable("production_manifests", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  videoProjectId: uuid("video_project_id").notNull(),
  name: text("name").notNull(),
  status: productionManifestStatusEnum("status").notNull().default("draft"),
  specification: jsonb("specification").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  projectWorkspaceForeignKey(table, "production_manifests_project_workspace_fkey"),
  uniqueIndex("production_manifests_project_uidx").on(table.videoProjectId),
  index("production_manifests_workspace_idx").on(table.workspaceId),
]);

export const productionAssetsTable = pgTable("production_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  videoProjectId: uuid("video_project_id").notNull(),
  manifestId: uuid("manifest_id").references(() => productionManifestsTable.id, { onDelete: "set null" }),
  assetType: productionAssetTypeEnum("asset_type").notNull(),
  status: productionAssetStatusEnum("status").notNull().default("uploading"),
  name: text("name").notNull(),
  uri: text("uri").notNull(),
  mimeType: text("mime_type"),
  byteSize: integer("byte_size"),
  durationMs: integer("duration_ms"),
  specification: jsonb("specification").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  projectWorkspaceForeignKey(table, "production_assets_project_workspace_fkey"),
  index("production_assets_project_idx").on(table.videoProjectId, table.createdAt),
  index("production_assets_manifest_idx").on(table.manifestId),
]);

export const timelineTracksTable = pgTable("timeline_tracks", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  videoProjectId: uuid("video_project_id").notNull(),
  manifestId: uuid("manifest_id").notNull().references(() => productionManifestsTable.id, { onDelete: "cascade" }),
  trackType: timelineTrackTypeEnum("track_type").notNull(),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  settings: jsonb("settings").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  projectWorkspaceForeignKey(table, "timeline_tracks_project_workspace_fkey"),
  uniqueIndex("timeline_tracks_manifest_position_uidx").on(table.manifestId, table.position),
  index("timeline_tracks_project_idx").on(table.videoProjectId),
]);

export const timelineItemsTable = pgTable("timeline_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  videoProjectId: uuid("video_project_id").notNull(),
  trackId: uuid("track_id").notNull().references(() => timelineTracksTable.id, { onDelete: "cascade" }),
  assetId: uuid("asset_id").references(() => productionAssetsTable.id, { onDelete: "set null" }),
  position: integer("position").notNull(),
  startMs: integer("start_ms").notNull(),
  durationMs: integer("duration_ms").notNull(),
  trimStartMs: integer("trim_start_ms").notNull().default(0),
  trimEndMs: integer("trim_end_ms").notNull().default(0),
  settings: jsonb("settings").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  projectWorkspaceForeignKey(table, "timeline_items_project_workspace_fkey"),
  uniqueIndex("timeline_items_track_position_uidx").on(table.trackId, table.position),
  index("timeline_items_project_idx").on(table.videoProjectId, table.startMs),
]);

export const renderJobsTable = pgTable("render_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  videoProjectId: uuid("video_project_id").notNull(),
  manifestId: uuid("manifest_id").references(() => productionManifestsTable.id, { onDelete: "set null" }),
  status: renderJobStatusEnum("status").notNull().default("queued"),
  outputUri: text("output_uri"),
  outputMimeType: text("output_mime_type"),
  errorMessage: text("error_message"),
  specification: jsonb("specification").notNull().default({}),
  queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  projectWorkspaceForeignKey(table, "render_jobs_project_workspace_fkey"),
  index("render_jobs_project_status_idx").on(table.videoProjectId, table.status, table.createdAt),
  index("render_jobs_manifest_idx").on(table.manifestId),
]);

/**
 * This is an audit/control-plane record only. It intentionally holds object
 * identifiers, checksums and deletion accounting—not media bytes or URLs.
 * A failed attempt is retained so an operator/user can safely retry it.
 */
export const videoMediaPurgesTable = pgTable("video_media_purges", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  videoProjectId: uuid("video_project_id").notNull(),
  renderJobId: uuid("render_job_id").notNull().references(() => renderJobsTable.id, { onDelete: "restrict" }),
  status: videoMediaPurgeStatusEnum("status").notNull().default("requested"),
  /** SHA-256 supplied by the user after the server-issued download handoff. */
  acknowledgedChecksum: text("acknowledged_checksum").notNull(),
  confirmationText: text("confirmation_text").notNull(),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  purgedAt: timestamp("purged_at", { withTimezone: true }),
  objectCount: integer("object_count").notNull().default(0),
  deletedObjectCount: integer("deleted_object_count").notNull().default(0),
  byteCount: integer("byte_count").notNull().default(0),
  deletedByteCount: integer("deleted_byte_count").notNull().default(0),
  errors: jsonb("errors").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  projectWorkspaceForeignKey(table, "video_media_purges_project_workspace_fkey"),
  index("video_media_purges_project_status_idx").on(table.workspaceId, table.videoProjectId, table.status, table.createdAt),
]);

export const qcReportsTable = pgTable("qc_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  videoProjectId: uuid("video_project_id").notNull(),
  renderJobId: uuid("render_job_id").references(() => renderJobsTable.id, { onDelete: "set null" }),
  status: qcReportStatusEnum("status").notNull().default("pending"),
  summary: text("summary"),
  specification: jsonb("specification").notNull().default({}),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  projectWorkspaceForeignKey(table, "qc_reports_project_workspace_fkey"),
  index("qc_reports_project_status_idx").on(table.videoProjectId, table.status, table.createdAt),
  index("qc_reports_render_job_idx").on(table.renderJobId),
]);

export const qcIssuesTable = pgTable("qc_issues", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  videoProjectId: uuid("video_project_id").notNull(),
  qcReportId: uuid("qc_report_id").notNull().references(() => qcReportsTable.id, { onDelete: "cascade" }),
  severity: qcIssueSeverityEnum("severity").notNull().default("warning"),
  status: qcIssueStatusEnum("status").notNull().default("open"),
  code: text("code").notNull(),
  message: text("message").notNull(),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  projectWorkspaceForeignKey(table, "qc_issues_project_workspace_fkey"),
  index("qc_issues_report_status_idx").on(table.qcReportId, table.status),
  index("qc_issues_project_status_idx").on(table.videoProjectId, table.status),
]);

export const productionRevisionsTable = pgTable("production_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  videoProjectId: uuid("video_project_id").notNull(),
  manifestId: uuid("manifest_id").references(() => productionManifestsTable.id, { onDelete: "set null" }),
  parentRevisionId: uuid("parent_revision_id"),
  revisionNumber: integer("revision_number").notNull(),
  status: productionRevisionStatusEnum("status").notNull().default("draft"),
  note: text("note"),
  specification: jsonb("specification").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  projectWorkspaceForeignKey(table, "production_revisions_project_workspace_fkey"),
  foreignKey({ columns: [table.parentRevisionId], foreignColumns: [table.id], name: "production_revisions_parent_fkey" }).onDelete("set null"),
  uniqueIndex("production_revisions_project_number_uidx").on(table.videoProjectId, table.revisionNumber),
  index("production_revisions_manifest_idx").on(table.manifestId),
]);

export const correctionLoopsTable = pgTable("correction_loops", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  videoProjectId: uuid("video_project_id").notNull(),
  revisionId: uuid("revision_id").notNull().references(() => productionRevisionsTable.id, { onDelete: "cascade" }),
  qcIssueId: uuid("qc_issue_id").references(() => qcIssuesTable.id, { onDelete: "set null" }),
  status: correctionLoopStatusEnum("status").notNull().default("open"),
  instruction: text("instruction").notNull(),
  resolution: text("resolution"),
  specification: jsonb("specification").notNull().default({}),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  projectWorkspaceForeignKey(table, "correction_loops_project_workspace_fkey"),
  index("correction_loops_revision_status_idx").on(table.revisionId, table.status),
  index("correction_loops_project_status_idx").on(table.videoProjectId, table.status),
]);

export const insertProductionManifestSchema = createInsertSchema(productionManifestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductionAssetSchema = createInsertSchema(productionAssetsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTimelineTrackSchema = createInsertSchema(timelineTracksTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTimelineItemSchema = createInsertSchema(timelineItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRenderJobSchema = createInsertSchema(renderJobsTable).omit({ id: true, createdAt: true, updatedAt: true, queuedAt: true, startedAt: true, completedAt: true });
export const insertVideoMediaPurgeSchema = createInsertSchema(videoMediaPurgesTable).omit({ id: true, createdAt: true, updatedAt: true, requestedAt: true, startedAt: true, purgedAt: true });
export const insertQcReportSchema = createInsertSchema(qcReportsTable).omit({ id: true, createdAt: true, updatedAt: true, completedAt: true });
export const insertQcIssueSchema = createInsertSchema(qcIssuesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductionRevisionSchema = createInsertSchema(productionRevisionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCorrectionLoopSchema = createInsertSchema(correctionLoopsTable).omit({ id: true, createdAt: true, updatedAt: true, resolvedAt: true });

export type InsertProductionManifest = z.infer<typeof insertProductionManifestSchema>;
export type ProductionManifest = typeof productionManifestsTable.$inferSelect;
export type InsertProductionAsset = z.infer<typeof insertProductionAssetSchema>;
export type ProductionAsset = typeof productionAssetsTable.$inferSelect;
export type InsertTimelineTrack = z.infer<typeof insertTimelineTrackSchema>;
export type TimelineTrack = typeof timelineTracksTable.$inferSelect;
export type InsertTimelineItem = z.infer<typeof insertTimelineItemSchema>;
export type TimelineItem = typeof timelineItemsTable.$inferSelect;
export type InsertRenderJob = z.infer<typeof insertRenderJobSchema>;
export type RenderJob = typeof renderJobsTable.$inferSelect;
export type InsertVideoMediaPurge = z.infer<typeof insertVideoMediaPurgeSchema>;
export type VideoMediaPurge = typeof videoMediaPurgesTable.$inferSelect;
export type InsertQcReport = z.infer<typeof insertQcReportSchema>;
export type QcReport = typeof qcReportsTable.$inferSelect;
export type InsertQcIssue = z.infer<typeof insertQcIssueSchema>;
export type QcIssue = typeof qcIssuesTable.$inferSelect;
export type InsertProductionRevision = z.infer<typeof insertProductionRevisionSchema>;
export type ProductionRevision = typeof productionRevisionsTable.$inferSelect;
export type InsertCorrectionLoop = z.infer<typeof insertCorrectionLoopSchema>;
export type CorrectionLoop = typeof correctionLoopsTable.$inferSelect;