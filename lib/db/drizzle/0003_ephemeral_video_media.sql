CREATE TYPE "public"."video_project_retention_policy" AS ENUM('archive', 'ephemeral');
CREATE TYPE "public"."video_media_purge_status" AS ENUM('requested', 'in_progress', 'purge_failed', 'purged');

ALTER TABLE "video_projects"
  ADD COLUMN "retention_policy" "video_project_retention_policy" DEFAULT 'archive' NOT NULL,
  ADD COLUMN "media_purged_at" timestamp with time zone;

CREATE TABLE "video_media_purges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "public"."workspaces"("id") ON DELETE cascade,
  "video_project_id" uuid NOT NULL,
  "render_job_id" uuid NOT NULL REFERENCES "public"."render_jobs"("id") ON DELETE restrict,
  "status" "video_media_purge_status" DEFAULT 'requested' NOT NULL,
  "acknowledged_checksum" text NOT NULL,
  "confirmation_text" text NOT NULL,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "started_at" timestamp with time zone,
  "purged_at" timestamp with time zone,
  "object_count" integer DEFAULT 0 NOT NULL,
  "deleted_object_count" integer DEFAULT 0 NOT NULL,
  "byte_count" integer DEFAULT 0 NOT NULL,
  "deleted_byte_count" integer DEFAULT 0 NOT NULL,
  "errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "video_media_purges_project_workspace_fkey"
    FOREIGN KEY ("workspace_id", "video_project_id")
    REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade
);
CREATE INDEX "video_media_purges_project_status_idx"
  ON "video_media_purges" USING btree ("workspace_id", "video_project_id", "status", "created_at");