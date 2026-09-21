-- Provider-neutral commercial entitlement model. No prices or execution quotas.
DO $$ BEGIN CREATE TYPE "commercial_product_status" AS ENUM ('active','retired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "commercial_subscription_status" AS ENUM ('pending','active','paused','cancelled','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "entitlement_grant_source" AS ENUM ('subscription','admin','migration'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS "commercial_products" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "key" text NOT NULL UNIQUE,
 "name" text NOT NULL, "master_plan_key" text NOT NULL,
 "status" "commercial_product_status" NOT NULL DEFAULT 'active',
 "capabilities" jsonb NOT NULL DEFAULT '{}'::jsonb, "usage_policy" jsonb NOT NULL DEFAULT '{}'::jsonb,
 "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, "created_at" timestamptz NOT NULL DEFAULT now(),
 "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "commercial_subscriptions" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
 "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
 "product_id" uuid NOT NULL REFERENCES "commercial_products"("id"),
 "status" "commercial_subscription_status" NOT NULL DEFAULT 'pending',
 "provider_metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, "started_at" timestamptz, "ends_at" timestamptz,
 "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "commercial_subscriptions_workspace_status_idx" ON "commercial_subscriptions" ("workspace_id","status");
CREATE TABLE IF NOT EXISTS "entitlement_grants" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
 "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
 "subscription_id" uuid NOT NULL REFERENCES "commercial_subscriptions"("id") ON DELETE cascade,
 "capability" text NOT NULL, "value" jsonb NOT NULL,
 "source" "entitlement_grant_source" NOT NULL DEFAULT 'subscription',
 "granted_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null, "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "entitlement_grants_subscription_capability_uidx" ON "entitlement_grants" ("subscription_id","capability");
CREATE INDEX IF NOT EXISTS "entitlement_grants_workspace_idx" ON "entitlement_grants" ("workspace_id");
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "commercial_product_id" uuid REFERENCES "commercial_products"("id") ON DELETE set null;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "commercial_subscription_id" uuid REFERENCES "commercial_subscriptions"("id") ON DELETE set null;
ALTER TABLE "masterplan_versions" ADD COLUMN IF NOT EXISTS "commercial_product_id" uuid REFERENCES "commercial_products"("id") ON DELETE set null;
ALTER TABLE "masterplan_versions" ADD COLUMN IF NOT EXISTS "commercial_subscription_id" uuid REFERENCES "commercial_subscriptions"("id") ON DELETE set null;
ALTER TABLE "workspace_integrations" ADD COLUMN IF NOT EXISTS "canonical_network" text;