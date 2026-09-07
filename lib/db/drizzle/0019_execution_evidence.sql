-- Provider execution evidence is additive and intentionally append-only.
DO $$ BEGIN
  CREATE TYPE "execution_evidence_state" AS ENUM ('planned', 'attempted', 'provider_confirmed', 'artifact_qc');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "execution_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "campaign_id" uuid REFERENCES "campaigns"("id") ON DELETE SET NULL,
  "masterplan_version_id" uuid REFERENCES "masterplan_versions"("id") ON DELETE RESTRICT,
  "context_fingerprint" text,
  "subject_type" text NOT NULL,
  "subject_id" uuid NOT NULL,
  "state" "execution_evidence_state" NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_evidence_workspace_subject_idx" ON "execution_evidence" ("workspace_id", "subject_type", "subject_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "execution_evidence_workspace_campaign_idx" ON "execution_evidence" ("workspace_id", "campaign_id", "created_at");
--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "masterplan_version_id" uuid REFERENCES "masterplan_versions"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "context_fingerprint" text;
--> statement-breakpoint
ALTER TABLE "paid_media_proposals" ADD COLUMN IF NOT EXISTS "campaign_id" uuid REFERENCES "campaigns"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "paid_media_proposals" ADD COLUMN IF NOT EXISTS "masterplan_version_id" uuid REFERENCES "masterplan_versions"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "paid_media_proposals" ADD COLUMN IF NOT EXISTS "context_fingerprint" text;