CREATE TYPE "public"."commercial_offer_contract_status" AS ENUM('pending', 'active', 'paused', 'cancelled', 'expired');
CREATE TABLE "commercial_offer_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"offer_id" uuid REFERENCES "commercial_sales_offers"("id") ON DELETE SET NULL,
	"offer_snapshot" jsonb NOT NULL,
	"provider_subscription_id" text,
	"status" "commercial_offer_contract_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"current_period_ends_at" timestamp with time zone,
	"fulfilled_payment_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "commercial_offer_contracts_provider_subscription_uidx" ON "commercial_offer_contracts" USING btree ("provider_subscription_id") WHERE "provider_subscription_id" IS NOT NULL;
