DO $$ BEGIN
  CREATE TYPE "paid_media_launch_stage" AS ENUM ('compiled','simulated','approved','activating','active','failed','rolled_back');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE TABLE IF NOT EXISTS "paid_media_launch_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "commercial_product_id" uuid REFERENCES "commercial_products"("id") ON DELETE RESTRICT,
  "commercial_subscription_id" uuid REFERENCES "commercial_subscriptions"("id") ON DELETE RESTRICT,
  "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE RESTRICT,
  "masterplan_version_id" uuid NOT NULL REFERENCES "masterplan_versions"("id") ON DELETE RESTRICT,
  "context_fingerprint" text NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "paid_media_accounts"("id") ON DELETE RESTRICT,
  "product_intake_version_id" uuid NOT NULL,
  "provider" "paid_media_provider" NOT NULL,
  "launch_stage" "paid_media_launch_stage" NOT NULL DEFAULT 'compiled',
  "plan_hash" text NOT NULL,
  "tree" jsonb NOT NULL,
  "provider_payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "readiness" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "approval_snapshot" jsonb,
  "approved_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "approved_at" timestamptz,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "paid_media_launch_plans_workspace_hash_uidx" ON "paid_media_launch_plans" ("workspace_id","plan_hash");
CREATE INDEX IF NOT EXISTS "paid_media_launch_plans_workspace_campaign_idx" ON "paid_media_launch_plans" ("workspace_id","campaign_id");