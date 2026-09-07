-- Additive dossier binding and evidence-state support for native execution.
ALTER TYPE "native_media_event_type" ADD VALUE IF NOT EXISTS 'planned';
--> statement-breakpoint
ALTER TYPE "native_media_event_type" ADD VALUE IF NOT EXISTS 'attempted';
--> statement-breakpoint
ALTER TYPE "native_media_event_type" ADD VALUE IF NOT EXISTS 'provider_confirmed';
--> statement-breakpoint
ALTER TYPE "native_media_event_type" ADD VALUE IF NOT EXISTS 'artifact_qc';
--> statement-breakpoint
ALTER TABLE "native_media_jobs" ADD COLUMN IF NOT EXISTS "masterplan_version_id" uuid;
--> statement-breakpoint
ALTER TABLE "native_media_jobs" ADD COLUMN IF NOT EXISTS "context_fingerprint" text;
--> statement-breakpoint
ALTER TABLE "native_media_jobs" ADD COLUMN IF NOT EXISTS "idempotency_key" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "native_media_jobs_workspace_project_idempotency_uidx"
  ON "native_media_jobs" ("workspace_id", "video_project_id", "idempotency_key");