-- Publish stage 2.
--
-- The parent UNIQUE (workspace_id, id) constraint is now live in production.
-- Restore the database-level tenant pairing invariant for every project-owned
-- audiovisual and native-media row.

ALTER TABLE "production_manifests" DROP CONSTRAINT IF EXISTS "production_manifests_project_workspace_fkey";
ALTER TABLE "production_manifests" ADD CONSTRAINT "production_manifests_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "production_assets" DROP CONSTRAINT IF EXISTS "production_assets_project_workspace_fkey";
ALTER TABLE "production_assets" ADD CONSTRAINT "production_assets_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "timeline_tracks" DROP CONSTRAINT IF EXISTS "timeline_tracks_project_workspace_fkey";
ALTER TABLE "timeline_tracks" ADD CONSTRAINT "timeline_tracks_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "timeline_items" DROP CONSTRAINT IF EXISTS "timeline_items_project_workspace_fkey";
ALTER TABLE "timeline_items" ADD CONSTRAINT "timeline_items_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "render_jobs" DROP CONSTRAINT IF EXISTS "render_jobs_project_workspace_fkey";
ALTER TABLE "render_jobs" ADD CONSTRAINT "render_jobs_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "video_media_purges" DROP CONSTRAINT IF EXISTS "video_media_purges_project_workspace_fkey";
ALTER TABLE "video_media_purges" ADD CONSTRAINT "video_media_purges_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "qc_reports" DROP CONSTRAINT IF EXISTS "qc_reports_project_workspace_fkey";
ALTER TABLE "qc_reports" ADD CONSTRAINT "qc_reports_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "qc_issues" DROP CONSTRAINT IF EXISTS "qc_issues_project_workspace_fkey";
ALTER TABLE "qc_issues" ADD CONSTRAINT "qc_issues_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "production_revisions" DROP CONSTRAINT IF EXISTS "production_revisions_project_workspace_fkey";
ALTER TABLE "production_revisions" ADD CONSTRAINT "production_revisions_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "correction_loops" DROP CONSTRAINT IF EXISTS "correction_loops_project_workspace_fkey";
ALTER TABLE "correction_loops" ADD CONSTRAINT "correction_loops_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "native_media_jobs" DROP CONSTRAINT IF EXISTS "native_media_jobs_project_workspace_fkey";
ALTER TABLE "native_media_jobs" ADD CONSTRAINT "native_media_jobs_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "native_media_job_events" DROP CONSTRAINT IF EXISTS "native_media_job_events_project_workspace_fkey";
ALTER TABLE "native_media_job_events" ADD CONSTRAINT "native_media_job_events_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "native_media_provenance" DROP CONSTRAINT IF EXISTS "native_media_provenance_project_workspace_fkey";
ALTER TABLE "native_media_provenance" ADD CONSTRAINT "native_media_provenance_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "native_media_usage" DROP CONSTRAINT IF EXISTS "native_media_usage_project_workspace_fkey";
ALTER TABLE "native_media_usage" ADD CONSTRAINT "native_media_usage_project_workspace_fkey" FOREIGN KEY ("workspace_id", "video_project_id") REFERENCES "public"."video_projects"("workspace_id", "id") ON DELETE cascade ON UPDATE no action;