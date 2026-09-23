ALTER TABLE "approval_decisions"
  DROP CONSTRAINT IF EXISTS "approval_decisions_masterplan_version_id_fkey",
  DROP CONSTRAINT IF EXISTS "approval_decisions_subject_typed_check";

ALTER TABLE "approval_decisions"
  ADD CONSTRAINT "approval_decisions_masterplan_version_fk"
    FOREIGN KEY ("masterplan_version_id") REFERENCES "masterplan_versions"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "approval_decisions_subject_typed_check"
    CHECK (
      (subject_type = 'masterplan'
        AND masterplan_version_id::text = subject_id
        AND content_piece_id IS NULL
        AND checkpoint_id IS NULL)
      OR
      (subject_type = 'content_piece'
        AND content_piece_id::text = subject_id
        AND masterplan_version_id IS NULL
        AND checkpoint_id IS NULL)
      OR
      (subject_type = 'checkpoint'
        AND checkpoint_id::text = subject_id
        AND content_piece_id IS NULL)
    );