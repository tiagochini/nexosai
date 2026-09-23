CREATE UNIQUE INDEX IF NOT EXISTS "approval_decisions_workspace_subject_snapshot_uidx"
  ON "approval_decisions" ("workspace_id", "subject_type", "subject_id", "resolved_snapshot_hash");