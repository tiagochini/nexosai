-- Additive lead-readiness contract. No dispatch or contact delivery is enabled by this migration.
DO $$ BEGIN CREATE TYPE "regional_audience_opportunity_lifecycle" AS ENUM ('observed', 'qualified', 'ready_for_activation', 'activated', 'converted', 'discarded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TABLE "regional_audience_opportunities" ADD COLUMN IF NOT EXISTS "competitor_id" uuid REFERENCES "regional_competitors"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "regional_audience_opportunities" ADD COLUMN IF NOT EXISTS "identity_hint_fingerprint" text;
--> statement-breakpoint
ALTER TABLE "regional_audience_opportunities" ADD COLUMN IF NOT EXISTS "heat_score" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "regional_audience_opportunities" ADD COLUMN IF NOT EXISTS "heat_band" text NOT NULL DEFAULT 'cold';
--> statement-breakpoint
ALTER TABLE "regional_audience_opportunities" ADD COLUMN IF NOT EXISTS "score_reasons" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "regional_audience_opportunities" ADD COLUMN IF NOT EXISTS "evidence_refs" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "regional_audience_opportunities" ADD COLUMN IF NOT EXISTS "observed_intent" text;
--> statement-breakpoint
ALTER TABLE "regional_audience_opportunities" ADD COLUMN IF NOT EXISTS "interest_topic" text;
--> statement-breakpoint
ALTER TABLE "regional_audience_opportunities" ADD COLUMN IF NOT EXISTS "inferred_region" text;
--> statement-breakpoint
ALTER TABLE "regional_audience_opportunities" ADD COLUMN IF NOT EXISTS "region_provenance" jsonb NOT NULL DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "regional_audience_opportunities" ADD COLUMN IF NOT EXISTS "interaction_recency_hours" integer;
--> statement-breakpoint
ALTER TABLE "regional_audience_opportunities" ADD COLUMN IF NOT EXISTS "interaction_frequency" integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE "regional_audience_opportunities" ADD COLUMN IF NOT EXISTS "lifecycle" "regional_audience_opportunity_lifecycle" NOT NULL DEFAULT 'observed';
--> statement-breakpoint
ALTER TABLE "regional_audience_opportunities" ADD COLUMN IF NOT EXISTS "contact_permission" "regional_lawful_basis_status" NOT NULL DEFAULT 'unknown';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "regional_audience_opportunities_workspace_identity_uidx" ON "regional_audience_opportunities" ("workspace_id", "campaign_id", "identity_hint_fingerprint") WHERE "identity_hint_fingerprint" IS NOT NULL;