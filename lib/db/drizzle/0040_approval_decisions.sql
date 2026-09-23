DO $$ BEGIN
  CREATE TYPE "approval_subject_type" AS ENUM ('masterplan', 'content_piece', 'checkpoint');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "approval_decision" AS ENUM ('approved', 'rejected', 'revision_requested');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "approval_decisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "campaign_id" uuid NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "subject_type" "approval_subject_type" NOT NULL,
  "subject_id" text NOT NULL,
  "subject_version" integer,
  "decision" "approval_decision" NOT NULL,
  "actor_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "decision_reason" text,
  "expected_snapshot_hash" text NOT NULL,
  "resolved_snapshot_hash" text NOT NULL,
  "masterplan_version_id" uuid REFERENCES "masterplan_versions"("id") ON DELETE SET NULL,
  "context_fingerprint" text,
  "idempotency_key" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "approval_decisions_reason_required_check"
    CHECK (
      ("decision" = 'approved' AND "decision_reason" IS NULL)
      OR ("decision" <> 'approved' AND length(trim("decision_reason")) > 0)
    ),
  CONSTRAINT "approval_decisions_snapshot_hash_match_check"
    CHECK ("expected_snapshot_hash" = "resolved_snapshot_hash")
);

CREATE UNIQUE INDEX IF NOT EXISTS "approval_decisions_workspace_idempotency_uidx"
  ON "approval_decisions" ("workspace_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "approval_decisions_campaign_subject_idx"
  ON "approval_decisions" ("workspace_id", "campaign_id", "subject_type", "subject_id");
CREATE INDEX IF NOT EXISTS "approval_decisions_actor_idx"
  ON "approval_decisions" ("workspace_id", "actor_user_id");