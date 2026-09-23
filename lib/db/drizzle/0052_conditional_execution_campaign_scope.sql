-- Bind every durable intent to the same campaign as its authorization policy.
CREATE UNIQUE INDEX IF NOT EXISTS conditional_execution_policies_campaign_id_uidx
  ON conditional_execution_policies(workspace_id, campaign_id, id);

DO $$ BEGIN
  ALTER TABLE conditional_execution_intents
    ADD CONSTRAINT conditional_intents_policy_campaign_fk
    FOREIGN KEY(workspace_id, campaign_id, policy_id)
    REFERENCES conditional_execution_policies(workspace_id, campaign_id, id)
    ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;