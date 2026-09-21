DO $$ BEGIN
  CREATE TYPE "product_intake_entry_point" AS ENUM ('launch', 'market_intel', 'social_media', 'paid_media');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "product_intake_status" AS ENUM ('draft', 'approved', 'locked', 'superseded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE TABLE IF NOT EXISTS "product_intakes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "commercial_product_id" uuid NOT NULL REFERENCES "commercial_products"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "status" "product_intake_status" NOT NULL DEFAULT 'draft',
  "snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "entry_point" "product_intake_entry_point" NOT NULL,
  "source_campaign_id" uuid REFERENCES "campaigns"("id") ON DELETE SET NULL,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "approved_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "approved_at" timestamptz,
  "locked_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "product_intakes_workspace_product_version_uidx" ON "product_intakes" ("workspace_id", "commercial_product_id", "version");
CREATE UNIQUE INDEX IF NOT EXISTS "product_intakes_one_draft_per_product_uidx" ON "product_intakes" ("workspace_id", "commercial_product_id") WHERE "status" = 'draft';
CREATE INDEX IF NOT EXISTS "product_intakes_workspace_product_status_idx" ON "product_intakes" ("workspace_id", "commercial_product_id", "status");
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "product_intake_version_id" uuid;
ALTER TABLE "masterplan_versions" ADD COLUMN IF NOT EXISTS "product_intake_version_id" uuid;