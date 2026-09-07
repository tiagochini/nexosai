-- This migration is deliberately repeat-safe: it is used by both existing
-- development databases and fresh environments that may have schema drift.
DO $$ BEGIN
  CREATE TYPE "domain_lifecycle_status" AS ENUM
    ('pending_payment','registration_pending','active','renewal_due','renewal_pending','expired','failed','capability_blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "domain_operation_type" AS ENUM ('availability','register','renew','dns_upsert','dns_delete');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "domain_operation_status" AS ENUM ('pending','succeeded','failed','capability_blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "landing_revision_status" AS ENUM ('generated','validated','published','superseded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "landing_deployment_status" AS ENUM ('pending','deploying','deployed','failed','capability_blocked','rolled_back');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "lifecycle_status" "domain_lifecycle_status" NOT NULL DEFAULT 'active';
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "registrar_provider" text;
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "registrar_domain_id" text;
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "auto_renew" boolean NOT NULL DEFAULT true;
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "renewal_attempts" integer NOT NULL DEFAULT 0;
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "lead_capture_sequence_id" uuid REFERENCES "launch_sequences"("id") ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS "domain_operations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "domain_id" uuid REFERENCES "domains"("id") ON DELETE CASCADE,
  "operation" "domain_operation_type" NOT NULL,
  "status" "domain_operation_status" NOT NULL DEFAULT 'pending',
  "idempotency_key" text NOT NULL,
  "provider" text, "provider_operation_id" text,
  "request" jsonb NOT NULL DEFAULT '{}'::jsonb, "response" jsonb, "error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "completed_at" timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS "domain_operations_workspace_idempotency_uq"
  ON "domain_operations" ("workspace_id","idempotency_key");

CREATE TABLE IF NOT EXISTS "domain_dns_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "domain_id" uuid NOT NULL REFERENCES "domains"("id") ON DELETE CASCADE,
  "type" text NOT NULL, "name" text NOT NULL, "value" text NOT NULL,
  "ttl" integer NOT NULL DEFAULT 300, "provider_record_id" text,
  "verified_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "domain_dns_records_domain_record_uq"
  ON "domain_dns_records" ("domain_id","type","name");

CREATE TABLE IF NOT EXISTS "landing_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "page_id" uuid NOT NULL REFERENCES "pages"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "revision" integer NOT NULL, "source" jsonb NOT NULL, "html" text NOT NULL,
  "content_hash" text NOT NULL,
  "status" "landing_revision_status" NOT NULL DEFAULT 'generated',
  "validation_errors" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "landing_revisions_page_revision_uq"
  ON "landing_revisions" ("page_id","revision");
-- Revision content is append-only. Status may advance after provider confirmation,
-- but generated source and the artifact can never be rewritten in place.
CREATE OR REPLACE FUNCTION prevent_landing_revision_content_mutation()
RETURNS trigger AS $$
BEGIN
  IF NEW."page_id" IS DISTINCT FROM OLD."page_id"
     OR NEW."workspace_id" IS DISTINCT FROM OLD."workspace_id"
     OR NEW."revision" IS DISTINCT FROM OLD."revision"
     OR NEW."source" IS DISTINCT FROM OLD."source"
     OR NEW."html" IS DISTINCT FROM OLD."html"
     OR NEW."content_hash" IS DISTINCT FROM OLD."content_hash" THEN
    RAISE EXCEPTION 'landing revisions are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "landing_revision_content_immutable" ON "landing_revisions";
CREATE TRIGGER "landing_revision_content_immutable"
  BEFORE UPDATE ON "landing_revisions"
  FOR EACH ROW EXECUTE FUNCTION prevent_landing_revision_content_mutation();

CREATE TABLE IF NOT EXISTS "landing_deployments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "page_id" uuid NOT NULL REFERENCES "pages"("id") ON DELETE CASCADE,
  "revision_id" uuid NOT NULL REFERENCES "landing_revisions"("id") ON DELETE CASCADE,
  "domain_id" uuid REFERENCES "domains"("id") ON DELETE SET NULL,
  "status" "landing_deployment_status" NOT NULL DEFAULT 'pending',
  "idempotency_key" text NOT NULL, "provider" text, "provider_deployment_id" text,
  "deployment_url" text, "logs" jsonb NOT NULL DEFAULT '[]'::jsonb, "error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "completed_at" timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS "landing_deployments_workspace_idempotency_uq"
  ON "landing_deployments" ("workspace_id","idempotency_key");