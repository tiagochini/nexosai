CREATE TYPE "public"."native_media_operation" AS ENUM('text_to_video', 'image_to_video', 'avatar_animation', 'voice_clone', 'tts', 'lip_sync', 'upscale', 'timeline_render', 'qc_extract');
CREATE TYPE "public"."native_media_job_status" AS ENUM('queued', 'leased', 'running', 'succeeded', 'failed', 'cancelled');
CREATE TYPE "public"."native_media_event_type" AS ENUM('submitted', 'leased', 'acknowledged', 'progress', 'completed', 'failed', 'cancelled', 'lease_expired', 'retry_scheduled');
CREATE TYPE "public"."native_media_consent_type" AS ENUM('voice_clone', 'voice_synthesis', 'likeness', 'avatar_animation', 'lip_sync');

CREATE TABLE "native_media_workers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "public"."workspaces"("id") ON DELETE cascade,
  "worker_name" text NOT NULL,
  "capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "gpu_info" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "runtime_info" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "last_heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL,
  "healthy" boolean DEFAULT false NOT NULL,
  "disabled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "native_media_workers_workspace_name_uidx" ON "native_media_workers" ("workspace_id", "worker_name");
CREATE INDEX "native_media_workers_health_idx" ON "native_media_workers" ("workspace_id", "healthy", "last_heartbeat_at");

CREATE TABLE "native_media_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "public"."workspaces"("id") ON DELETE cascade,
  "video_project_id" uuid NOT NULL,
  "operation" "native_media_operation" NOT NULL,
  "status" "native_media_job_status" DEFAULT 'queued' NOT NULL,
  "requested_model_id" text,
  "requested_model_revision" text,
  "required_license" text,
  "request" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "input_objects" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "output_objects" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "attempt" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 3 NOT NULL,
  "lease_token" uuid,
  "leased_worker_id" uuid REFERENCES "native_media_workers"("id") ON DELETE set null,
  "lease_expires_at" timestamp with time zone,
  "cancel_requested_at" timestamp with time zone,
  "error_code" text,
  "error_message" text,
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "native_media_jobs_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade
);
CREATE INDEX "native_media_jobs_queue_idx" ON "native_media_jobs" ("status", "operation", "submitted_at");
CREATE INDEX "native_media_jobs_project_idx" ON "native_media_jobs" ("workspace_id", "video_project_id", "created_at");
CREATE INDEX "native_media_jobs_lease_idx" ON "native_media_jobs" ("lease_expires_at");

CREATE TABLE "native_media_job_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "public"."workspaces"("id") ON DELETE cascade,
  "video_project_id" uuid NOT NULL,
  "job_id" uuid NOT NULL REFERENCES "native_media_jobs"("id") ON DELETE cascade,
  "worker_id" uuid REFERENCES "native_media_workers"("id") ON DELETE set null,
  "event_type" "native_media_event_type" NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "native_media_job_events_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade
);
CREATE INDEX "native_media_job_events_job_idx" ON "native_media_job_events" ("job_id", "created_at");

CREATE TABLE "native_media_provenance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "public"."workspaces"("id") ON DELETE cascade,
  "video_project_id" uuid NOT NULL,
  "job_id" uuid NOT NULL REFERENCES "native_media_jobs"("id") ON DELETE cascade,
  "output_object_key" text NOT NULL,
  "output_sha256" text NOT NULL,
  "model_id" text NOT NULL,
  "model_revision" text,
  "model_license" text,
  "worker_id" uuid REFERENCES "native_media_workers"("id") ON DELETE set null,
  "gpu" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "runtime" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "source_inputs" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "native_media_provenance_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade
);
CREATE UNIQUE INDEX "native_media_provenance_output_uidx" ON "native_media_provenance" ("workspace_id", "output_object_key");
CREATE INDEX "native_media_provenance_job_idx" ON "native_media_provenance" ("job_id");

CREATE TABLE "native_media_usage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "public"."workspaces"("id") ON DELETE cascade,
  "video_project_id" uuid NOT NULL,
  "job_id" uuid NOT NULL REFERENCES "native_media_jobs"("id") ON DELETE cascade,
  "worker_id" uuid REFERENCES "native_media_workers"("id") ON DELETE set null,
  "model_id" text,
  "gpu_seconds" numeric(14, 3) DEFAULT '0' NOT NULL,
  "estimated_gpu_cost" numeric(14, 6) DEFAULT '0' NOT NULL,
  "actual_gpu_cost" numeric(14, 6),
  "telemetry" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "native_media_usage_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade
);
CREATE INDEX "native_media_usage_project_idx" ON "native_media_usage" ("workspace_id", "video_project_id", "created_at");

CREATE TABLE "native_media_consents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "public"."workspaces"("id") ON DELETE cascade,
  "subject_reference" text NOT NULL,
  "consent_type" "native_media_consent_type" NOT NULL,
  "evidence_object_key" text NOT NULL,
  "evidence_sha256" text NOT NULL,
  "granted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "native_media_consents_lookup_idx" ON "native_media_consents" ("workspace_id", "subject_reference", "consent_type", "revoked_at");