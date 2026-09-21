-- Owner tuples make cross-workspace and cross-provider launch bindings impossible.
CREATE UNIQUE INDEX IF NOT EXISTS "campaigns_workspace_product_id_uidx"
  ON "campaigns" ("workspace_id","commercial_product_id","id");
CREATE UNIQUE INDEX IF NOT EXISTS "masterplans_workspace_product_id_uidx"
  ON "masterplan_versions" ("workspace_id","commercial_product_id","id");
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_workspace_product_id_uidx"
  ON "commercial_subscriptions" ("workspace_id","product_id","id");
CREATE UNIQUE INDEX IF NOT EXISTS "intakes_workspace_product_id_uidx"
  ON "product_intakes" ("workspace_id","commercial_product_id","id");
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_workspace_provider_id_uidx"
  ON "paid_media_accounts" ("workspace_id","provider","id");

ALTER TABLE "paid_media_launch_plans"
  ADD CONSTRAINT "launch_plans_workspace_product_campaign_fk" FOREIGN KEY
    ("workspace_id","commercial_product_id","campaign_id")
    REFERENCES "campaigns" ("workspace_id","commercial_product_id","id") NOT VALID,
  ADD CONSTRAINT "launch_plans_workspace_product_masterplan_fk" FOREIGN KEY
    ("workspace_id","commercial_product_id","masterplan_version_id")
    REFERENCES "masterplan_versions" ("workspace_id","commercial_product_id","id") NOT VALID,
  ADD CONSTRAINT "launch_plans_workspace_product_subscription_fk" FOREIGN KEY
    ("workspace_id","commercial_product_id","commercial_subscription_id")
    REFERENCES "commercial_subscriptions" ("workspace_id","product_id","id") NOT VALID,
  ADD CONSTRAINT "launch_plans_workspace_product_intake_fk" FOREIGN KEY
    ("workspace_id","commercial_product_id","product_intake_version_id")
    REFERENCES "product_intakes" ("workspace_id","commercial_product_id","id") NOT VALID,
  ADD CONSTRAINT "launch_plans_workspace_provider_account_fk" FOREIGN KEY
    ("workspace_id","provider","account_id")
    REFERENCES "paid_media_accounts" ("workspace_id","provider","id") NOT VALID;

ALTER TABLE "paid_media_launch_plans"
  VALIDATE CONSTRAINT "launch_plans_workspace_product_campaign_fk",
  VALIDATE CONSTRAINT "launch_plans_workspace_product_masterplan_fk",
  VALIDATE CONSTRAINT "launch_plans_workspace_product_subscription_fk",
  VALIDATE CONSTRAINT "launch_plans_workspace_product_intake_fk",
  VALIDATE CONSTRAINT "launch_plans_workspace_provider_account_fk";