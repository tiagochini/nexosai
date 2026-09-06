import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
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

export const nativeMediaOperationEnum = pgEnum("native_media_operation", [
  "text_to_video", "image_to_video", "avatar_animation", "voice_clone", "tts",
  "lip_sync", "upscale", "timeline_render", "qc_extract",
]);
export const nativeMediaJobStatusEnum = pgEnum("native_media_job_status", [
  "queued", "leased", "running", "succeeded", "failed", "cancelled",
]);
export const nativeMediaEventTypeEnum = pgEnum("native_media_event_type", [
  "submitted", "leased", "acknowledged", "progress", "completed", "failed",
  "cancelled", "lease_expired", "retry_scheduled",
]);
export const nativeMediaConsentTypeEnum = pgEnum("native_media_consent_type", [
  "voice_clone", "voice_synthesis", "likeness", "avatar_animation", "lip_sync",
]);

const projectWorkspaceForeignKey = (table: { workspaceId: unknown; videoProjectId: unknown }, name: string) =>
  // Publish stage 1: reference the globally unique project id so Replit can
  // create the parent (workspace_id,id) unique constraint in the same schema
  // migration. Restore the composite columns after that constraint is live.
  foreignKey({
    columns: [table.videoProjectId as any],
    foreignColumns: [videoProjectsTable.id],
    name,
  }).onDelete("cascade");

/** Only opaque private object keys and content hashes are persisted in this control plane. */
export const nativeMediaJobsTable = pgTable("native_media_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  videoProjectId: uuid("video_project_id").notNull(),
  operation: nativeMediaOperationEnum("operation").notNull(),
  status: nativeMediaJobStatusEnum("status").notNull().default("queued"),
  requestedModelId: text("requested_model_id"),
  requestedModelRevision: text("requested_model_revision"),
  requiredLicense: text("required_license"),
  consentId: uuid("consent_id"),
  request: jsonb("request").notNull().default({}), // prompt/settings; never media bytes or URLs
  inputObjects: jsonb("input_objects").notNull().default([]), // [{key,sha256,mimeType}]
  outputObjects: jsonb("output_objects").notNull().default([]), // worker-claimed then server-verified
  attempt: integer("attempt").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  leaseToken: uuid("lease_token"),
  leasedWorkerId: uuid("leased_worker_id"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  cancelRequestedAt: timestamp("cancel_requested_at", { withTimezone: true }),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  projectWorkspaceForeignKey(table, "native_media_jobs_project_workspace_fkey"),
  index("native_media_jobs_queue_idx").on(table.status, table.operation, table.submittedAt),
  index("native_media_jobs_project_idx").on(table.workspaceId, table.videoProjectId, table.createdAt),
  index("native_media_jobs_lease_idx").on(table.leaseExpiresAt),
]);

export const nativeMediaWorkersTable = pgTable("native_media_workers", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  workerName: text("worker_name").notNull(),
  credentialHash: text("credential_hash").notNull(),
  capabilities: jsonb("capabilities").notNull().default([]), // operation/model/revision/license/resolution/fps/duration/vram
  gpuInfo: jsonb("gpu_info").notNull().default({}),
  runtimeInfo: jsonb("runtime_info").notNull().default({}),
  lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }).notNull().defaultNow(),
  healthy: boolean("healthy").notNull().default(false),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("native_media_workers_workspace_name_uidx").on(table.workspaceId, table.workerName),
  index("native_media_workers_health_idx").on(table.workspaceId, table.healthy, table.lastHeartbeatAt),
]);

/** Replay protection is durable so it works across API instances. */
export const nativeMediaWorkerNoncesTable = pgTable("native_media_worker_nonces", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  workerId: uuid("worker_id").notNull().references(() => nativeMediaWorkersTable.id, { onDelete: "cascade" }),
  nonce: text("nonce").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("native_media_worker_nonces_worker_nonce_uidx").on(table.workerId, table.nonce),
  index("native_media_worker_nonces_expiry_idx").on(table.expiresAt),
]);

export const nativeMediaJobEventsTable = pgTable("native_media_job_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  videoProjectId: uuid("video_project_id").notNull(),
  jobId: uuid("job_id").notNull().references(() => nativeMediaJobsTable.id, { onDelete: "cascade" }),
  workerId: uuid("worker_id").references(() => nativeMediaWorkersTable.id, { onDelete: "set null" }),
  eventType: nativeMediaEventTypeEnum("event_type").notNull(),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  projectWorkspaceForeignKey(table, "native_media_job_events_project_workspace_fkey"),
  index("native_media_job_events_job_idx").on(table.jobId, table.createdAt),
]);

export const nativeMediaProvenanceTable = pgTable("native_media_provenance", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  videoProjectId: uuid("video_project_id").notNull(),
  jobId: uuid("job_id").notNull().references(() => nativeMediaJobsTable.id, { onDelete: "cascade" }),
  outputObjectKey: text("output_object_key").notNull(),
  outputSha256: text("output_sha256").notNull(),
  modelId: text("model_id").notNull(),
  modelRevision: text("model_revision"),
  modelLicense: text("model_license"),
  workerId: uuid("worker_id").references(() => nativeMediaWorkersTable.id, { onDelete: "set null" }),
  gpu: jsonb("gpu").notNull().default({}),
  runtime: jsonb("runtime").notNull().default({}),
  sourceInputs: jsonb("source_inputs").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  projectWorkspaceForeignKey(table, "native_media_provenance_project_workspace_fkey"),
  uniqueIndex("native_media_provenance_output_uidx").on(table.workspaceId, table.outputObjectKey),
  index("native_media_provenance_job_idx").on(table.jobId),
]);

export const nativeMediaUsageTable = pgTable("native_media_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  videoProjectId: uuid("video_project_id").notNull(),
  jobId: uuid("job_id").notNull().references(() => nativeMediaJobsTable.id, { onDelete: "cascade" }),
  workerId: uuid("worker_id").references(() => nativeMediaWorkersTable.id, { onDelete: "set null" }),
  modelId: text("model_id"),
  gpuSeconds: numeric("gpu_seconds", { precision: 14, scale: 3 }).notNull().default("0"),
  estimatedGpuCost: numeric("estimated_gpu_cost", { precision: 14, scale: 6 }).notNull().default("0"),
  actualGpuCost: numeric("actual_gpu_cost", { precision: 14, scale: 6 }),
  telemetry: jsonb("telemetry").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  projectWorkspaceForeignKey(table, "native_media_usage_project_workspace_fkey"),
  index("native_media_usage_project_idx").on(table.workspaceId, table.videoProjectId, table.createdAt),
]);

export const nativeMediaConsentsTable = pgTable("native_media_consents", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspacesTable.id, { onDelete: "cascade" }),
  subjectReference: text("subject_reference").notNull(),
  consentType: nativeMediaConsentTypeEnum("consent_type").notNull(),
  evidenceObjectKey: text("evidence_object_key").notNull(),
  evidenceSha256: text("evidence_sha256").notNull(),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("native_media_consents_lookup_idx").on(table.workspaceId, table.subjectReference, table.consentType, table.revokedAt),
]);

export const insertNativeMediaJobSchema = createInsertSchema(nativeMediaJobsTable).omit({ id: true, createdAt: true, updatedAt: true, submittedAt: true });
export const insertNativeMediaWorkerSchema = createInsertSchema(nativeMediaWorkersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertNativeMediaConsentSchema = createInsertSchema(nativeMediaConsentsTable).omit({ id: true, createdAt: true, updatedAt: true, grantedAt: true });
export type NativeMediaJob = typeof nativeMediaJobsTable.$inferSelect;
export type NativeMediaWorker = typeof nativeMediaWorkersTable.$inferSelect;
export type NativeMediaConsent = typeof nativeMediaConsentsTable.$inferSelect;