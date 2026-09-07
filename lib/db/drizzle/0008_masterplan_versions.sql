-- Additive and repeatable: no existing campaign data is changed or deleted.
DO $$ BEGIN
  CREATE TYPE "masterplan_version_status" AS ENUM ('draft', 'pending_approval', 'approved', 'superseded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "masterplan_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "status" "masterplan_version_status" DEFAULT 'draft' NOT NULL,
  "snapshot" jsonb NOT NULL,
  "content_hash" text NOT NULL,
  "context_fingerprint" text NOT NULL,
  "readiness_score" integer NOT NULL,
  "readiness_status" text NOT NULL,
  "readiness_blockers" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "autonomy_contract" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "allowed_actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "required_approvals" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "approved_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "approved_at" timestamp with time zone,
  "superseded_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "masterplan_versions_workspace_campaign_version_uidx" ON "masterplan_versions" ("workspace_id", "campaign_id", "version");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "masterplan_versions_workspace_campaign_status_idx" ON "masterplan_versions" ("workspace_id", "campaign_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "masterplan_versions_workspace_campaign_created_idx" ON "masterplan_versions" ("workspace_id", "campaign_id", "created_at");