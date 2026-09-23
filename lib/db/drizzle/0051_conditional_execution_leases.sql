ALTER TABLE paid_media_accounts
  ADD COLUMN IF NOT EXISTS health_checked_at timestamptz;
ALTER TABLE conditional_execution_attempts
  ADD COLUMN IF NOT EXISTS lease_owner text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS apply_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS conditional_actions_workspace_policy_id_uidx
  ON conditional_execution_policy_actions(workspace_id, policy_id, id);
DO $$ BEGIN
  ALTER TABLE conditional_execution_intents
    ADD CONSTRAINT conditional_intents_action_policy_scope_fk
    FOREIGN KEY(workspace_id, policy_id, policy_action_id)
    REFERENCES conditional_execution_policy_actions(workspace_id, policy_id, id)
    ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;