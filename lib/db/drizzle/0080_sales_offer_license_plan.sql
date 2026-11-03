DO $$ BEGIN
  CREATE TYPE "public"."plan_slug" AS ENUM('solo', 'agency');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "commercial_sales_offers"
  ADD COLUMN "plan_slug" "plan_slug";

-- The founder explicitly assigned the existing R$ 3,999 lifetime offer to
-- the current Agency license. Keep the display name "Agency"; "Enterprise"
-- described the customer profile, not a new plan name.
UPDATE "commercial_sales_offers"
SET "plan_slug" = 'agency', "updated_at" = now()
WHERE "key" = 'lancamanento-2026';
