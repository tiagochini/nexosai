DO $$ BEGIN
  CREATE TYPE "social_publish_attempt_state" AS ENUM ('executing','ambiguous','retryable','confirmed','terminal','manual_recovery');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
CREATE TABLE IF NOT EXISTS "social_publish_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "post_id" uuid NOT NULL REFERENCES "social_posts"("id") ON DELETE CASCADE,
  "attempt_key" text NOT NULL,
  "content_fingerprint" text NOT NULL,
  "state" "social_publish_attempt_state" NOT NULL DEFAULT 'executing',
  "lease_owner" text,
  "lease_expires_at" timestamptz,
  "retry_count" integer NOT NULL DEFAULT 0,
  "next_attempt_at" timestamptz,
  "provider_stage" text,
  "provider_container_id" text,
  "provider_publish_id" text,
  "receipt" jsonb NOT NULL DEFAULT '{}',
  "readback" jsonb NOT NULL DEFAULT '{}',
  "error" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "social_publish_attempts_post_key_uidx" ON "social_publish_attempts" ("post_id","attempt_key");
CREATE INDEX IF NOT EXISTS "social_publish_attempts_workspace_state_idx" ON "social_publish_attempts" ("workspace_id","state","next_attempt_at");