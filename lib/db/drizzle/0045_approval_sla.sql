DO $$ BEGIN CREATE TYPE "approval_sla_status" AS ENUM ('open','resolved','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "approval_sla_event_kind" AS ENUM ('warning','due','escalation','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "approval_sla_channel" AS ENUM ('in_app'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "approval_sla_obligations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "subject_type" text NOT NULL,
  "subject_id" text NOT NULL,
  "masterplan_version_id" uuid,
  "content_piece_id" uuid,
  "checkpoint_id" uuid,
  "subject_snapshot_hash" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "command_fingerprint" text NOT NULL,
  "due_at" timestamptz NOT NULL,
  "warning_at" timestamptz NOT NULL,
  "escalation_at" timestamptz NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "status" "approval_sla_status" NOT NULL DEFAULT 'open',
  "channel" "approval_sla_channel" NOT NULL DEFAULT 'in_app',
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "resolved_decision_id" uuid REFERENCES "approval_decisions"("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "approval_sla_obligations_window_check" CHECK ("warning_at" < "due_at" AND "due_at" < "escalation_at" AND "escalation_at" <= "expires_at")
  ,CONSTRAINT "approval_sla_obligations_subject_typed_check" CHECK (
    ("subject_type" = 'masterplan' AND "masterplan_version_id"::text = "subject_id" AND "content_piece_id" IS NULL AND "checkpoint_id" IS NULL)
    OR ("subject_type" = 'content_piece' AND "content_piece_id"::text = "subject_id" AND "masterplan_version_id" IS NULL AND "checkpoint_id" IS NULL)
    OR ("subject_type" = 'checkpoint' AND "checkpoint_id"::text = "subject_id" AND "masterplan_version_id" IS NULL AND "content_piece_id" IS NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS "approval_sla_obligations_subject_uidx" ON "approval_sla_obligations" ("workspace_id","campaign_id","subject_type","subject_id","subject_snapshot_hash");
CREATE UNIQUE INDEX IF NOT EXISTS "approval_sla_obligations_idempotency_uidx" ON "approval_sla_obligations" ("workspace_id","idempotency_key");
CREATE INDEX IF NOT EXISTS "approval_sla_obligations_due_idx" ON "approval_sla_obligations" ("status","due_at");
DO $$ BEGIN ALTER TABLE "approval_sla_obligations" ADD CONSTRAINT "approval_sla_workspace_creator_fk" FOREIGN KEY ("workspace_id","created_by") REFERENCES "workspaces" ("id","owner_id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "approval_sla_obligations" ADD CONSTRAINT "approval_sla_masterplan_scope_fk" FOREIGN KEY ("workspace_id","campaign_id","masterplan_version_id") REFERENCES "masterplan_versions" ("workspace_id","campaign_id","id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "approval_sla_obligations" ADD CONSTRAINT "approval_sla_content_scope_fk" FOREIGN KEY ("workspace_id","campaign_id","content_piece_id") REFERENCES "content_pieces" ("workspace_id","campaign_id","id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "approval_sla_obligations" ADD CONSTRAINT "approval_sla_checkpoint_scope_fk" FOREIGN KEY ("campaign_id","checkpoint_id") REFERENCES "approval_checkpoints" ("campaign_id","id") ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "approval_sla_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "obligation_id" uuid NOT NULL REFERENCES "approval_sla_obligations"("id") ON DELETE CASCADE,
  "event_kind" "approval_sla_event_kind" NOT NULL,
  "channel" "approval_sla_channel" NOT NULL DEFAULT 'in_app',
  "delivered_at" timestamptz NOT NULL DEFAULT now(),
  "receipt" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "approval_sla_events_obligation_kind_channel_uidx" ON "approval_sla_events" ("obligation_id","event_kind","channel");
CREATE UNIQUE INDEX IF NOT EXISTS "approval_sla_obligations_workspace_id_uidx" ON "approval_sla_obligations" ("workspace_id","id");
DO $$ BEGIN ALTER TABLE "approval_sla_events" ADD CONSTRAINT "approval_sla_events_scope_fk" FOREIGN KEY ("workspace_id","obligation_id") REFERENCES "approval_sla_obligations" ("workspace_id","id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "approval_sla_events_workspace_idx" ON "approval_sla_events" ("workspace_id","created_at");
CREATE OR REPLACE FUNCTION prevent_approval_sla_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF pg_trigger_depth() > 1 THEN RETURN OLD; END IF; RAISE EXCEPTION 'approval_sla_events is append-only'; END; $$;
DROP TRIGGER IF EXISTS approval_sla_events_append_only ON approval_sla_events;
CREATE TRIGGER approval_sla_events_append_only BEFORE UPDATE OR DELETE ON approval_sla_events FOR EACH ROW EXECUTE FUNCTION prevent_approval_sla_event_mutation();
CREATE OR REPLACE FUNCTION protect_approval_sla_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.campaign_id IS DISTINCT FROM OLD.campaign_id
    OR NEW.subject_type IS DISTINCT FROM OLD.subject_type OR NEW.subject_id IS DISTINCT FROM OLD.subject_id
    OR NEW.subject_snapshot_hash IS DISTINCT FROM OLD.subject_snapshot_hash OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
    OR NEW.command_fingerprint IS DISTINCT FROM OLD.command_fingerprint OR NEW.warning_at IS DISTINCT FROM OLD.warning_at
    OR NEW.due_at IS DISTINCT FROM OLD.due_at OR NEW.escalation_at IS DISTINCT FROM OLD.escalation_at
    OR NEW.expires_at IS DISTINCT FROM OLD.expires_at OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.channel IS DISTINCT FROM OLD.channel THEN RAISE EXCEPTION 'approval_sla_obligations identity is immutable'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS approval_sla_identity_immutable ON approval_sla_obligations;
CREATE TRIGGER approval_sla_identity_immutable BEFORE UPDATE ON approval_sla_obligations FOR EACH ROW EXECUTE FUNCTION protect_approval_sla_identity();