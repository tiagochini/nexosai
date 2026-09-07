CREATE TABLE IF NOT EXISTS "recording_folders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "system_type" text,
  "is_system" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "recording_folders_workspace_slug_uidx" ON "recording_folders" USING btree ("workspace_id","slug");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "recording_folders_workspace_system_type_uidx" ON "recording_folders" USING btree ("workspace_id","system_type") WHERE "is_system" = true AND "system_type" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "launch_recordings" ADD COLUMN IF NOT EXISTS "folder_id" uuid;
--> statement-breakpoint
ALTER TABLE "launch_recordings" ADD COLUMN IF NOT EXISTS "recording_mode" text DEFAULT 'manual' NOT NULL;
--> statement-breakpoint
ALTER TABLE "launch_recordings" ADD COLUMN IF NOT EXISTS "finalized_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "launch_recordings" ADD COLUMN IF NOT EXISTS "finalization_status" text DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE "launch_recordings" ADD COLUMN IF NOT EXISTS "finalization_error" text;
--> statement-breakpoint
ALTER TABLE "launch_recordings" ADD COLUMN IF NOT EXISTS "video_mime_type" text;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "launch_recordings" ADD CONSTRAINT "launch_recordings_folder_id_recording_folders_id_fk"
    FOREIGN KEY ("folder_id") REFERENCES "recording_folders"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "recording_folders" ADD CONSTRAINT "recording_folders_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "recording_folders" ADD CONSTRAINT "recording_folders_system_type_check"
    CHECK ("system_type" IS NULL OR "system_type" IN ('automatic', 'manual')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "recording_folders" ADD CONSTRAINT "recording_folders_system_consistency_check"
    CHECK (("is_system" = true AND "system_type" IS NOT NULL) OR ("is_system" = false AND "system_type" IS NULL)) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "launch_recordings" ADD CONSTRAINT "launch_recordings_recording_mode_check"
    CHECK ("recording_mode" IN ('manual', 'automatic')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "launch_recordings" ADD CONSTRAINT "launch_recordings_finalization_status_check"
    CHECK ("finalization_status" IN ('pending', 'processing', 'ready', 'failed')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
-- Backfill is deliberately repeatable: unique indexes make default-folder inserts no-ops
-- on subsequent runs, and assignments only touch legacy rows with no folder.
INSERT INTO "recording_folders" ("workspace_id", "name", "slug", "system_type", "is_system")
SELECT w."id", defaults."name", defaults."slug", defaults."system_type", true
FROM "workspaces" AS w
CROSS JOIN (
  VALUES
    ('Gravações automáticas'::text, 'gravacoes-automaticas'::text, 'automatic'::text),
    ('Uploads manuais'::text, 'uploads-manuais'::text, 'manual'::text)
) AS defaults("name", "slug", "system_type")
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "launch_recordings" AS recording
SET "folder_id" = folder."id"
FROM "recording_folders" AS folder
WHERE recording."folder_id" IS NULL
  AND folder."workspace_id" = recording."workspace_id"
  AND folder."is_system" = true
  AND folder."system_type" = recording."recording_mode";
--> statement-breakpoint
UPDATE "launch_recordings"
SET
  "finalization_status" = 'ready',
  "finalized_at" = COALESCE("finalized_at", "video_uploaded_at", "stopped_at", "created_at"),
  "video_mime_type" = COALESCE("video_mime_type", 'video/webm')
WHERE "video_path" IS NOT NULL;