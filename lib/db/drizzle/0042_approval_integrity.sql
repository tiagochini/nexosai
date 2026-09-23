ALTER TYPE "content_status" ADD VALUE IF NOT EXISTS 'revision_requested';

ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_workspace_id_id_uidx" UNIQUE ("workspace_id", "id");
ALTER TABLE "approval_decisions"
  ADD COLUMN IF NOT EXISTS "command_fingerprint" text,
  ADD COLUMN IF NOT EXISTS "content_piece_id" uuid,
  ADD COLUMN IF NOT EXISTS "checkpoint_id" uuid;

UPDATE "approval_decisions"
SET "command_fingerprint" = md5(concat_ws('|', workspace_id, campaign_id, subject_type, subject_id, actor_user_id, decision, coalesce(decision_reason,''), expected_snapshot_hash, coalesce(subject_version::text,''), idempotency_key))
WHERE "command_fingerprint" IS NULL;
ALTER TABLE "approval_decisions" ALTER COLUMN "command_fingerprint" SET NOT NULL;
UPDATE "approval_decisions" SET "content_piece_id" = subject_id::uuid WHERE subject_type = 'content_piece';
UPDATE "approval_decisions" SET "checkpoint_id" = subject_id::uuid WHERE subject_type = 'checkpoint';
ALTER TABLE "approval_decisions"
  ADD CONSTRAINT "approval_decisions_campaign_workspace_fk"
  FOREIGN KEY ("workspace_id", "campaign_id") REFERENCES "campaigns" ("workspace_id", "id") ON DELETE CASCADE,
  ADD CONSTRAINT "approval_decisions_content_piece_fk"
  FOREIGN KEY ("content_piece_id") REFERENCES "content_pieces" ("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "approval_decisions_checkpoint_fk"
  FOREIGN KEY ("checkpoint_id") REFERENCES "approval_checkpoints" ("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "approval_decisions_subject_typed_check"
  CHECK (
    (subject_type = 'masterplan' AND content_piece_id IS NULL AND checkpoint_id IS NULL)
    OR (subject_type = 'content_piece' AND content_piece_id::text = subject_id AND checkpoint_id IS NULL)
    OR (subject_type = 'checkpoint' AND checkpoint_id::text = subject_id AND content_piece_id IS NULL)
  );
CREATE UNIQUE INDEX IF NOT EXISTS "approval_decisions_workspace_command_fingerprint_uidx"
  ON "approval_decisions" ("workspace_id", "command_fingerprint");

CREATE OR REPLACE FUNCTION prevent_approval_decision_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN COALESCE(NEW, OLD); END IF;
  RAISE EXCEPTION 'approval_decisions is append-only' USING ERRCODE = '55006';
END $$;
DROP TRIGGER IF EXISTS approval_decisions_append_only ON "approval_decisions";
CREATE TRIGGER approval_decisions_append_only BEFORE UPDATE OR DELETE ON "approval_decisions"
FOR EACH ROW EXECUTE FUNCTION prevent_approval_decision_mutation();