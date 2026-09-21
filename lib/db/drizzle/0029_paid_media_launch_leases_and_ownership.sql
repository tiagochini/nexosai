ALTER TABLE "paid_media_launch_attempts"
  ADD COLUMN IF NOT EXISTS "lease_owner" text,
  ADD COLUMN IF NOT EXISTS "lease_expires_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "heartbeat_at" timestamptz;
ALTER TABLE "paid_media_launch_steps"
  ADD COLUMN IF NOT EXISTS "sequence" integer NOT NULL DEFAULT 0;

-- Add owner-scoped uniqueness before validating the staged composite bindings.
CREATE UNIQUE INDEX IF NOT EXISTS "campaigns_workspace_id_uidx" ON "campaigns" ("workspace_id","id");
CREATE UNIQUE INDEX IF NOT EXISTS "masterplan_versions_workspace_id_uidx" ON "masterplan_versions" ("workspace_id","id");
CREATE UNIQUE INDEX IF NOT EXISTS "commercial_subscriptions_workspace_id_uidx" ON "commercial_subscriptions" ("workspace_id","id");
CREATE UNIQUE INDEX IF NOT EXISTS "product_intakes_workspace_id_uidx" ON "product_intakes" ("workspace_id","id");
CREATE UNIQUE INDEX IF NOT EXISTS "paid_media_accounts_workspace_id_uidx" ON "paid_media_accounts" ("workspace_id","id");

ALTER TABLE "paid_media_launch_plans"
  ADD CONSTRAINT "launch_plans_workspace_campaign_fk" FOREIGN KEY ("workspace_id","campaign_id")
    REFERENCES "campaigns" ("workspace_id","id") NOT VALID,
  ADD CONSTRAINT "launch_plans_workspace_masterplan_fk" FOREIGN KEY ("workspace_id","masterplan_version_id")
    REFERENCES "masterplan_versions" ("workspace_id","id") NOT VALID,
  ADD CONSTRAINT "launch_plans_workspace_subscription_fk" FOREIGN KEY ("workspace_id","commercial_subscription_id")
    REFERENCES "commercial_subscriptions" ("workspace_id","id") NOT VALID,
  ADD CONSTRAINT "launch_plans_workspace_intake_fk" FOREIGN KEY ("workspace_id","product_intake_version_id")
    REFERENCES "product_intakes" ("workspace_id","id") NOT VALID,
  ADD CONSTRAINT "launch_plans_workspace_account_fk" FOREIGN KEY ("workspace_id","account_id")
    REFERENCES "paid_media_accounts" ("workspace_id","id") NOT VALID;
ALTER TABLE "paid_media_launch_plans"
  VALIDATE CONSTRAINT "launch_plans_workspace_campaign_fk",
  VALIDATE CONSTRAINT "launch_plans_workspace_masterplan_fk",
  VALIDATE CONSTRAINT "launch_plans_workspace_subscription_fk",
  VALIDATE CONSTRAINT "launch_plans_workspace_intake_fk",
  VALIDATE CONSTRAINT "launch_plans_workspace_account_fk";