DO $$ BEGIN CREATE TYPE "paid_media_event_delivery_status" AS ENUM ('pending','sent','failed','capability_blocked','consent_withheld'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "paid_media_event_receipts" ADD COLUMN IF NOT EXISTS "delivery_status" "paid_media_event_delivery_status" NOT NULL DEFAULT 'pending';
ALTER TABLE "paid_media_event_receipts" ADD COLUMN IF NOT EXISTS "provider_attempted_at" timestamp with time zone;
ALTER TABLE "paid_media_event_receipts" ADD COLUMN IF NOT EXISTS "provider_response" jsonb;
ALTER TABLE "paid_media_event_receipts" ADD COLUMN IF NOT EXISTS "provider_error_code" text;
ALTER TABLE "paid_media_event_receipts" ADD COLUMN IF NOT EXISTS "provider_error_message" text;
CREATE INDEX IF NOT EXISTS "paid_media_event_receipts_dataset_delivery_idx" ON "paid_media_event_receipts" ("dataset_id","delivery_status");