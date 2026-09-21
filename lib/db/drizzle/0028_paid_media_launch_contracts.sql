DO $$ BEGIN ALTER TYPE "paid_media_launch_stage" ADD VALUE IF NOT EXISTS 'compensation_failed'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "paid_media_launch_plans_workspace_account_provider_idx" ON "paid_media_launch_plans" ("workspace_id","account_id","provider");
CREATE UNIQUE INDEX IF NOT EXISTS "paid_media_launch_plans_binding_uidx" ON "paid_media_launch_plans" ("workspace_id","campaign_id","masterplan_version_id","product_intake_version_id","account_id","provider");
ALTER TABLE "paid_media_launch_plans" ADD CONSTRAINT "paid_media_launch_plans_workspace_account_provider_ck"
 CHECK ("workspace_id" IS NOT NULL AND "account_id" IS NOT NULL AND "provider" IS NOT NULL);