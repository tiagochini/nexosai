CREATE TYPE "public"."commercial_offer_interval" AS ENUM('one_time', 'monthly', 'yearly');
CREATE TABLE "commercial_sales_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price_cents" integer NOT NULL,
	"interval" "commercial_offer_interval" DEFAULT 'one_time' NOT NULL,
	"nexos_access_lifetime" boolean DEFAULT false NOT NULL,
	"campaigns_included" integer DEFAULT 0 NOT NULL,
	"social_media_days" integer DEFAULT 0 NOT NULL,
	"credits_included" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "commercial_sales_offers_key_uidx" ON "commercial_sales_offers" USING btree ("key");
ALTER TABLE "commercial_sales_offers" ADD CONSTRAINT "commercial_sales_offers_price_cents_check" CHECK ("price_cents" > 0);
ALTER TABLE "commercial_sales_offers" ADD CONSTRAINT "commercial_sales_offers_benefits_check" CHECK ("campaigns_included" >= 0 AND "social_media_days" >= 0 AND "credits_included" >= 0);
