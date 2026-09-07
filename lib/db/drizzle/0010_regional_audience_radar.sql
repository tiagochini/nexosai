-- Additive public-audience radar. No contact, private-message, or sensitive-data columns are introduced.
DO $$ BEGIN CREATE TYPE "regional_lawful_basis_status" AS ENUM ('unknown', 'not_permitted', 'permitted', 'opted_out'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "regional_social_signals" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade, "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE cascade, "platform" text NOT NULL, "public_account_ref" text, "display_name" text, "source_url" text NOT NULL, "normalized_source_url" text NOT NULL, "post_ref" text, "interaction_type" text NOT NULL, "public_text_excerpt" text, "occurred_at" timestamp with time zone NOT NULL, "sentiment" text, "intent" text, "confidence" integer, "region_inference" text, "region_provenance" jsonb DEFAULT '{}'::jsonb NOT NULL, "lawful_basis_status" "regional_lawful_basis_status" DEFAULT 'unknown' NOT NULL, "sensitive_data_excluded" boolean DEFAULT true NOT NULL, "fingerprint" text NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "regional_social_signals_workspace_fingerprint_uidx" ON "regional_social_signals" ("workspace_id", "fingerprint");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "regional_social_signals_workspace_campaign_time_idx" ON "regional_social_signals" ("workspace_id", "campaign_id", "occurred_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "regional_audience_opportunities" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade, "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE cascade, "signal_id" uuid NOT NULL REFERENCES "regional_social_signals"("id") ON DELETE cascade, "opportunity_type" text NOT NULL, "summary" text NOT NULL, "attributes" jsonb DEFAULT '{}'::jsonb NOT NULL, "status" text DEFAULT 'open' NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "regional_audience_opportunities_signal_uidx" ON "regional_audience_opportunities" ("signal_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "regional_audience_opportunities_workspace_campaign_idx" ON "regional_audience_opportunities" ("workspace_id", "campaign_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "regional_audience_segments" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade, "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE cascade, "fingerprint" text NOT NULL, "label" text NOT NULL, "dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL, "signal_count" integer DEFAULT 0 NOT NULL, "opportunity_count" integer DEFAULT 0 NOT NULL, "last_observed_at" timestamp with time zone, "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "regional_audience_segments_workspace_fingerprint_uidx" ON "regional_audience_segments" ("workspace_id", "fingerprint");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "regional_audience_segments_workspace_campaign_idx" ON "regional_audience_segments" ("workspace_id", "campaign_id", "updated_at");