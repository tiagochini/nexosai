-- Binding integrity is staged after 0025: indexes are created first so the
-- composite references can be added safely to existing nullable legacy rows.
CREATE UNIQUE INDEX IF NOT EXISTS "commercial_subscriptions_workspace_product_id_uidx"
  ON "commercial_subscriptions" ("workspace_id", "product_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "product_intakes_workspace_product_id_uidx"
  ON "product_intakes" ("workspace_id", "commercial_product_id", "id");

DO $$ BEGIN
  ALTER TABLE "campaigns"
    ADD CONSTRAINT "campaigns_product_intake_version_fk"
    FOREIGN KEY ("product_intake_version_id") REFERENCES "product_intakes"("id") ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "masterplan_versions"
    ADD CONSTRAINT "masterplan_product_intake_version_fk"
    FOREIGN KEY ("product_intake_version_id") REFERENCES "product_intakes"("id") ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "campaigns"
    ADD CONSTRAINT "campaigns_product_subscription_binding_fk"
    FOREIGN KEY ("workspace_id", "commercial_product_id", "commercial_subscription_id")
    REFERENCES "commercial_subscriptions"("workspace_id", "product_id", "id") ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "masterplan_versions"
    ADD CONSTRAINT "masterplan_product_subscription_binding_fk"
    FOREIGN KEY ("workspace_id", "commercial_product_id", "commercial_subscription_id")
    REFERENCES "commercial_subscriptions"("workspace_id", "product_id", "id") ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "campaigns"
    ADD CONSTRAINT "campaigns_product_intake_binding_fk"
    FOREIGN KEY ("workspace_id", "commercial_product_id", "product_intake_version_id")
    REFERENCES "product_intakes"("workspace_id", "commercial_product_id", "id") ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "masterplan_versions"
    ADD CONSTRAINT "masterplan_product_intake_binding_fk"
    FOREIGN KEY ("workspace_id", "commercial_product_id", "product_intake_version_id")
    REFERENCES "product_intakes"("workspace_id", "commercial_product_id", "id") ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;