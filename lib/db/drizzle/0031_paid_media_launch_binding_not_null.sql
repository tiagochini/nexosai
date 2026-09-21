DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "paid_media_launch_plans" WHERE "commercial_product_id" IS NULL OR "commercial_subscription_id" IS NULL) THEN
    RAISE EXCEPTION 'Cannot make paid media launch commercial bindings NOT NULL: legacy null rows exist';
  END IF;
END $$;
ALTER TABLE "paid_media_launch_plans"
  ALTER COLUMN "commercial_product_id" SET NOT NULL,
  ALTER COLUMN "commercial_subscription_id" SET NOT NULL;