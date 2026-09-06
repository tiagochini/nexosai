CREATE TYPE "public"."production_manifest_status" AS ENUM('draft', 'active', 'locked', 'archived');
CREATE TYPE "public"."production_asset_type" AS ENUM('video', 'audio', 'image', 'subtitle', 'graphic', 'font', 'document');
CREATE TYPE "public"."production_asset_status" AS ENUM('uploading', 'ready', 'processing', 'failed', 'archived');
CREATE TYPE "public"."timeline_track_type" AS ENUM('video', 'audio', 'voiceover', 'music', 'graphics', 'subtitles');
CREATE TYPE "public"."render_job_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'cancelled');
CREATE TYPE "public"."qc_report_status" AS ENUM('pending', 'passed', 'failed', 'needs_review');
CREATE TYPE "public"."qc_issue_severity" AS ENUM('info', 'warning', 'error', 'blocking');
CREATE TYPE "public"."qc_issue_status" AS ENUM('open', 'acknowledged', 'resolved', 'wont_fix');
CREATE TYPE "public"."production_revision_status" AS ENUM('draft', 'in_review', 'approved', 'superseded');
CREATE TYPE "public"."correction_loop_status" AS ENUM('open', 'in_progress', 'resolved', 'cancelled');

ALTER TABLE "video_projects"
  ADD CONSTRAINT "video_projects_workspace_id_id_unique"
  UNIQUE ("workspace_id", "id");

CREATE TABLE "production_manifests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "video_project_id" uuid NOT NULL,
  "name" text NOT NULL,
  "status" "production_manifest_status" DEFAULT 'draft' NOT NULL,
  "specification" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "production_manifests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade,
  CONSTRAINT "production_manifests_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade
);
CREATE UNIQUE INDEX "production_manifests_project_uidx" ON "production_manifests" USING btree ("video_project_id");
CREATE INDEX "production_manifests_workspace_idx" ON "production_manifests" USING btree ("workspace_id");

CREATE TABLE "production_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "video_project_id" uuid NOT NULL,
  "manifest_id" uuid,
  "asset_type" "production_asset_type" NOT NULL,
  "status" "production_asset_status" DEFAULT 'uploading' NOT NULL,
  "name" text NOT NULL,
  "uri" text NOT NULL,
  "mime_type" text,
  "byte_size" integer,
  "duration_ms" integer,
  "specification" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "production_assets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade,
  CONSTRAINT "production_assets_manifest_id_production_manifests_id_fk" FOREIGN KEY ("manifest_id") REFERENCES "public"."production_manifests"("id") ON DELETE set null,
  CONSTRAINT "production_assets_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade
);
CREATE INDEX "production_assets_project_idx" ON "production_assets" USING btree ("video_project_id", "created_at");
CREATE INDEX "production_assets_manifest_idx" ON "production_assets" USING btree ("manifest_id");

CREATE TABLE "timeline_tracks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "video_project_id" uuid NOT NULL,
  "manifest_id" uuid NOT NULL,
  "track_type" "timeline_track_type" NOT NULL,
  "name" text NOT NULL,
  "position" integer NOT NULL,
  "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "timeline_tracks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade,
  CONSTRAINT "timeline_tracks_manifest_id_production_manifests_id_fk" FOREIGN KEY ("manifest_id") REFERENCES "public"."production_manifests"("id") ON DELETE cascade,
  CONSTRAINT "timeline_tracks_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade
);
CREATE UNIQUE INDEX "timeline_tracks_manifest_position_uidx" ON "timeline_tracks" USING btree ("manifest_id", "position");
CREATE INDEX "timeline_tracks_project_idx" ON "timeline_tracks" USING btree ("video_project_id");

CREATE TABLE "timeline_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "video_project_id" uuid NOT NULL,
  "track_id" uuid NOT NULL,
  "asset_id" uuid,
  "position" integer NOT NULL,
  "start_ms" integer NOT NULL,
  "duration_ms" integer NOT NULL,
  "trim_start_ms" integer DEFAULT 0 NOT NULL,
  "trim_end_ms" integer DEFAULT 0 NOT NULL,
  "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "timeline_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade,
  CONSTRAINT "timeline_items_track_id_timeline_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."timeline_tracks"("id") ON DELETE cascade,
  CONSTRAINT "timeline_items_asset_id_production_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."production_assets"("id") ON DELETE set null,
  CONSTRAINT "timeline_items_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade
);
CREATE UNIQUE INDEX "timeline_items_track_position_uidx" ON "timeline_items" USING btree ("track_id", "position");
CREATE INDEX "timeline_items_project_idx" ON "timeline_items" USING btree ("video_project_id", "start_ms");

CREATE TABLE "render_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "video_project_id" uuid NOT NULL,
  "manifest_id" uuid,
  "status" "render_job_status" DEFAULT 'queued' NOT NULL,
  "output_uri" text,
  "output_mime_type" text,
  "error_message" text,
  "specification" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "queued_at" timestamp with time zone DEFAULT now() NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "render_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade,
  CONSTRAINT "render_jobs_manifest_id_production_manifests_id_fk" FOREIGN KEY ("manifest_id") REFERENCES "public"."production_manifests"("id") ON DELETE set null,
  CONSTRAINT "render_jobs_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade
);
CREATE INDEX "render_jobs_project_status_idx" ON "render_jobs" USING btree ("video_project_id", "status", "created_at");
CREATE INDEX "render_jobs_manifest_idx" ON "render_jobs" USING btree ("manifest_id");

CREATE TABLE "qc_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "video_project_id" uuid NOT NULL,
  "render_job_id" uuid,
  "status" "qc_report_status" DEFAULT 'pending' NOT NULL,
  "summary" text,
  "specification" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "qc_reports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade,
  CONSTRAINT "qc_reports_render_job_id_render_jobs_id_fk" FOREIGN KEY ("render_job_id") REFERENCES "public"."render_jobs"("id") ON DELETE set null,
  CONSTRAINT "qc_reports_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade
);
CREATE INDEX "qc_reports_project_status_idx" ON "qc_reports" USING btree ("video_project_id", "status", "created_at");
CREATE INDEX "qc_reports_render_job_idx" ON "qc_reports" USING btree ("render_job_id");

CREATE TABLE "qc_issues" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "video_project_id" uuid NOT NULL,
  "qc_report_id" uuid NOT NULL,
  "severity" "qc_issue_severity" DEFAULT 'warning' NOT NULL,
  "status" "qc_issue_status" DEFAULT 'open' NOT NULL,
  "code" text NOT NULL,
  "message" text NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "qc_issues_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade,
  CONSTRAINT "qc_issues_qc_report_id_qc_reports_id_fk" FOREIGN KEY ("qc_report_id") REFERENCES "public"."qc_reports"("id") ON DELETE cascade,
  CONSTRAINT "qc_issues_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade
);
CREATE INDEX "qc_issues_report_status_idx" ON "qc_issues" USING btree ("qc_report_id", "status");
CREATE INDEX "qc_issues_project_status_idx" ON "qc_issues" USING btree ("video_project_id", "status");

CREATE TABLE "production_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "video_project_id" uuid NOT NULL,
  "manifest_id" uuid,
  "parent_revision_id" uuid,
  "revision_number" integer NOT NULL,
  "status" "production_revision_status" DEFAULT 'draft' NOT NULL,
  "note" text,
  "specification" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "production_revisions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade,
  CONSTRAINT "production_revisions_manifest_id_production_manifests_id_fk" FOREIGN KEY ("manifest_id") REFERENCES "public"."production_manifests"("id") ON DELETE set null,
  CONSTRAINT "production_revisions_parent_fkey" FOREIGN KEY ("parent_revision_id") REFERENCES "public"."production_revisions"("id") ON DELETE set null,
  CONSTRAINT "production_revisions_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade
);
CREATE UNIQUE INDEX "production_revisions_project_number_uidx" ON "production_revisions" USING btree ("video_project_id", "revision_number");
CREATE INDEX "production_revisions_manifest_idx" ON "production_revisions" USING btree ("manifest_id");

CREATE TABLE "correction_loops" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "video_project_id" uuid NOT NULL,
  "revision_id" uuid NOT NULL,
  "qc_issue_id" uuid,
  "status" "correction_loop_status" DEFAULT 'open' NOT NULL,
  "instruction" text NOT NULL,
  "resolution" text,
  "specification" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "correction_loops_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade,
  CONSTRAINT "correction_loops_revision_id_production_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."production_revisions"("id") ON DELETE cascade,
  CONSTRAINT "correction_loops_qc_issue_id_qc_issues_id_fk" FOREIGN KEY ("qc_issue_id") REFERENCES "public"."qc_issues"("id") ON DELETE set null,
  CONSTRAINT "correction_loops_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade
);
CREATE INDEX "correction_loops_revision_status_idx" ON "correction_loops" USING btree ("revision_id", "status");
CREATE INDEX "correction_loops_project_status_idx" ON "correction_loops" USING btree ("video_project_id", "status");