CREATE INDEX IF NOT EXISTS "execution_evidence_workspace_campaign_created_id_idx"
  ON "execution_evidence" ("workspace_id", "campaign_id", "created_at", "id");