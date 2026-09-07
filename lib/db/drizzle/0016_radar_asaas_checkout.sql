-- Development-only migration. Production schema changes remain Publish-managed.
DO $$ BEGIN CREATE TYPE "radar_entitlement_source" AS ENUM ('subscription_included','asaas_purchase','admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "radar_order_status" AS ENUM ('pending','confirmed','fulfilled','overdue','expired','cancelled','refunded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE "radar_order_status" ADD VALUE IF NOT EXISTS 'initializing' BEFORE 'pending';
ALTER TABLE "radar_subscriptions" ADD COLUMN IF NOT EXISTS "entitlement_source" "radar_entitlement_source" NOT NULL DEFAULT 'admin';
ALTER TABLE "radar_subscriptions" ADD COLUMN IF NOT EXISTS "order_id" uuid;
ALTER TABLE "radar_subscriptions" ADD COLUMN IF NOT EXISTS "campaign_id" uuid;
CREATE TABLE IF NOT EXISTS "radar_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "requested_by_user_id" uuid, "campaign_id" uuid, "package" text NOT NULL, "currency" "radar_billing_currency" NOT NULL,
  "amount_cents" integer NOT NULL, "description" text NOT NULL, "limits_snapshot" jsonb, "method" text,
  "status" "radar_order_status" NOT NULL DEFAULT 'pending', "idempotency_key" text NOT NULL,
  "provider_payment_id" text, "provider_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "confirmed_at" timestamp with time zone, "fulfilled_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone, "refunded_at" timestamp with time zone,
  "expires_at" timestamp with time zone, "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "radar_orders_workspace_idempotency_uidx" ON "radar_orders" ("workspace_id","idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "radar_orders_provider_payment_uidx" ON "radar_orders" ("provider_payment_id") WHERE "provider_payment_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "radar_orders_workspace_status_idx" ON "radar_orders" ("workspace_id","status");
CREATE UNIQUE INDEX IF NOT EXISTS "radar_included_trial_workspace_uidx" ON "radar_subscriptions" ("workspace_id") WHERE "entitlement_source" = 'subscription_included';
CREATE UNIQUE INDEX IF NOT EXISTS "radar_subscription_order_uidx" ON "radar_subscriptions" ("order_id") WHERE "order_id" IS NOT NULL;