-- Additive international geography and compliance metadata; no outreach capability is introduced.
DO $$ BEGIN CREATE TYPE "regional_deletion_state" AS ENUM ('active', 'opted_out', 'pending_deletion', 'deleted'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TABLE "regional_profiles" ADD COLUMN IF NOT EXISTS "country_code" text;
ALTER TABLE "regional_profiles" ADD COLUMN IF NOT EXISTS "subdivision" text;
ALTER TABLE "regional_profiles" ADD COLUMN IF NOT EXISTS "city" text;
ALTER TABLE "regional_profiles" ADD COLUMN IF NOT EXISTS "postal_code" text;
ALTER TABLE "regional_profiles" ADD COLUMN IF NOT EXISTS "address" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "regional_profiles" ADD COLUMN IF NOT EXISTS "timezone" text;
ALTER TABLE "regional_profiles" ADD COLUMN IF NOT EXISTS "languages" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "regional_profiles" ADD COLUMN IF NOT EXISTS "operating_regions" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "regional_profiles" ADD COLUMN IF NOT EXISTS "residence_region" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "regional_profiles" ADD COLUMN IF NOT EXISTS "service_region" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "regional_profiles" ADD COLUMN IF NOT EXISTS "geo_provenance" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "regional_profiles" ADD COLUMN IF NOT EXISTS "geo_confidence" integer;
--> statement-breakpoint
ALTER TABLE "regional_audience_opportunities" ADD COLUMN IF NOT EXISTS "contact_phone_e164" text;
ALTER TABLE "regional_audience_opportunities" ADD COLUMN IF NOT EXISTS "processing_purpose" text;
ALTER TABLE "regional_audience_opportunities" ADD COLUMN IF NOT EXISTS "lawful_basis" "regional_lawful_basis_status" NOT NULL DEFAULT 'unknown';
ALTER TABLE "regional_audience_opportunities" ADD COLUMN IF NOT EXISTS "consent_source" text;
ALTER TABLE "regional_audience_opportunities" ADD COLUMN IF NOT EXISTS "consented_at" timestamp with time zone;
ALTER TABLE "regional_audience_opportunities" ADD COLUMN IF NOT EXISTS "jurisdiction_codes" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "regional_audience_opportunities" ADD COLUMN IF NOT EXISTS "retention_until" timestamp with time zone;
ALTER TABLE "regional_audience_opportunities" ADD COLUMN IF NOT EXISTS "deletion_state" "regional_deletion_state" NOT NULL DEFAULT 'active';