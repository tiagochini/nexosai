DO $$ BEGIN CREATE TYPE "paid_media_launch_attempt_status" AS ENUM ('executing','succeeded','failed','compensation_failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "paid_media_launch_step_status" AS ENUM ('pending','created','verified','compensated','compensation_failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS "paid_media_launch_attempts" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
 "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
 "launch_plan_id" uuid NOT NULL REFERENCES "paid_media_launch_plans"("id") ON DELETE CASCADE,
 "attempt_key" text NOT NULL, "status" "paid_media_launch_attempt_status" NOT NULL DEFAULT 'executing',
 "error" text, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "paid_media_launch_attempts_plan_key_uidx" ON "paid_media_launch_attempts" ("launch_plan_id","attempt_key");
CREATE TABLE IF NOT EXISTS "paid_media_launch_steps" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
 "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
 "attempt_id" uuid NOT NULL REFERENCES "paid_media_launch_attempts"("id") ON DELETE CASCADE,
 "step_key" text NOT NULL, "entity_type" "paid_media_entity_type" NOT NULL,
 "provider_entity_id" text, "status" "paid_media_launch_step_status" NOT NULL DEFAULT 'pending',
 "provider_response" jsonb NOT NULL DEFAULT '{}'::jsonb, "readback" jsonb NOT NULL DEFAULT '{}'::jsonb,
 "compensation" jsonb NOT NULL DEFAULT '{}'::jsonb, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "paid_media_launch_steps_attempt_key_uidx" ON "paid_media_launch_steps" ("attempt_id","step_key");