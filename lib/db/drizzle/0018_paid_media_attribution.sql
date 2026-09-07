DO $$ BEGIN CREATE TYPE "paid_media_budget_strategy" AS ENUM ('cbo','abo'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "paid_media_event_source" AS ENUM ('browser','server','crm'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "paid_media_reconciliation_status" AS ENUM ('reconciled','partial','unattributed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS "paid_media_datasets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "account_id" uuid NOT NULL REFERENCES "paid_media_accounts"("id") ON DELETE cascade,
  "provider" "paid_media_provider" NOT NULL, "provider_dataset_id" text NOT NULL,
  "name" text, "ingestion_key" text NOT NULL, "last_event_at" timestamp with time zone,
  "last_diagnostic_at" timestamp with time zone, "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "paid_media_datasets_account_provider_dataset_unique" ON "paid_media_datasets" ("account_id","provider","provider_dataset_id");
CREATE UNIQUE INDEX IF NOT EXISTS "paid_media_datasets_ingestion_key_unique" ON "paid_media_datasets" ("ingestion_key");
CREATE INDEX IF NOT EXISTS "paid_media_datasets_workspace_account_idx" ON "paid_media_datasets" ("workspace_id","account_id");
CREATE TABLE IF NOT EXISTS "paid_media_event_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "dataset_id" uuid NOT NULL REFERENCES "paid_media_datasets"("id") ON DELETE cascade,
  "source" "paid_media_event_source" NOT NULL, "event_id" text NOT NULL, "event_name" text NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL, "event_match_keys" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb, "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "paid_media_event_receipts_dataset_event_unique" ON "paid_media_event_receipts" ("dataset_id","event_id");
CREATE INDEX IF NOT EXISTS "paid_media_event_receipts_workspace_occurred_idx" ON "paid_media_event_receipts" ("workspace_id","occurred_at");
CREATE TABLE IF NOT EXISTS "paid_media_attribution_touchpoints" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "account_id" uuid REFERENCES "paid_media_accounts"("id") ON DELETE set null,
  "entity_id" uuid REFERENCES "paid_media_entities"("id") ON DELETE set null,
  "provider" "paid_media_provider", "external_touchpoint_id" text NOT NULL, "click_id" text,
  "utm_source" text, "utm_campaign" text, "occurred_at" timestamp with time zone NOT NULL,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "paid_media_touchpoints_workspace_external_unique" ON "paid_media_attribution_touchpoints" ("workspace_id","external_touchpoint_id");
CREATE INDEX IF NOT EXISTS "paid_media_touchpoints_workspace_click_idx" ON "paid_media_attribution_touchpoints" ("workspace_id","click_id");
CREATE TABLE IF NOT EXISTS "paid_media_conversions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "touchpoint_id" uuid REFERENCES "paid_media_attribution_touchpoints"("id") ON DELETE set null,
  "external_conversion_id" text NOT NULL, "occurred_at" timestamp with time zone NOT NULL,
  "currency" text NOT NULL, "value" numeric(18,6) NOT NULL DEFAULT '0',
  "reconciliation_status" "paid_media_reconciliation_status" NOT NULL DEFAULT 'unattributed',
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "paid_media_conversions_workspace_external_unique" ON "paid_media_conversions" ("workspace_id","external_conversion_id");
CREATE INDEX IF NOT EXISTS "paid_media_conversions_workspace_occurred_idx" ON "paid_media_conversions" ("workspace_id","occurred_at");
CREATE TABLE IF NOT EXISTS "paid_media_budget_strategies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "account_id" uuid NOT NULL REFERENCES "paid_media_accounts"("id") ON DELETE cascade,
  "campaign_entity_id" uuid NOT NULL REFERENCES "paid_media_entities"("id") ON DELETE cascade,
  "strategy" "paid_media_budget_strategy" NOT NULL, "observed_at" timestamp with time zone NOT NULL DEFAULT now(),
  "provider_data" jsonb NOT NULL DEFAULT '{}'::jsonb, "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "paid_media_budget_strategies_campaign_unique" ON "paid_media_budget_strategies" ("campaign_entity_id");
CREATE INDEX IF NOT EXISTS "paid_media_budget_strategies_workspace_account_idx" ON "paid_media_budget_strategies" ("workspace_id","account_id");