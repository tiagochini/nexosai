CREATE UNIQUE INDEX IF NOT EXISTS paid_media_accounts_workspace_id_uidx ON paid_media_accounts(workspace_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS paid_media_entities_workspace_id_uidx ON paid_media_entities(workspace_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS paid_media_proposals_workspace_id_uidx ON paid_media_proposals(workspace_id,id);
DO $$ BEGIN
  ALTER TABLE conditional_execution_policy_events ADD CONSTRAINT conditional_policy_events_policy_scope_fk
    FOREIGN KEY(workspace_id,policy_id) REFERENCES conditional_execution_policies(workspace_id,id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE conditional_execution_policy_actions ADD CONSTRAINT conditional_actions_account_scope_fk
    FOREIGN KEY(workspace_id,account_id) REFERENCES paid_media_accounts(workspace_id,id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE conditional_execution_policy_actions ADD CONSTRAINT conditional_actions_entity_scope_fk
    FOREIGN KEY(workspace_id,entity_id) REFERENCES paid_media_entities(workspace_id,id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE conditional_execution_intents ADD CONSTRAINT conditional_intents_proposal_scope_fk
    FOREIGN KEY(workspace_id,proposal_id) REFERENCES paid_media_proposals(workspace_id,id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;