DO $$ BEGIN CREATE TYPE conditional_execution_action AS ENUM ('paid_media_pause'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE conditional_execution_intent_status AS ENUM ('planned','blocked','eligible','attempted','confirmed','ambiguous','recovery_required'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE conditional_execution_attempt_status AS ENUM ('attempted','confirmed','ambiguous','recovery_required'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS conditional_execution_policies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE, version integer NOT NULL, enabled boolean NOT NULL DEFAULT false,
 masterplan_version_id uuid NOT NULL REFERENCES masterplan_versions(id) ON DELETE RESTRICT, snapshot_hash text NOT NULL,
 context_fingerprint text NOT NULL, expires_at timestamptz NOT NULL, owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 revoked_at timestamptz, revoked_by uuid REFERENCES users(id) ON DELETE RESTRICT, idempotency_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT conditional_execution_policy_version_check CHECK (version >= 1),
 CONSTRAINT conditional_policies_campaign_scope_fk FOREIGN KEY(workspace_id,campaign_id) REFERENCES campaigns(workspace_id,id),
 CONSTRAINT conditional_policies_owner_fk FOREIGN KEY(workspace_id,owner_user_id) REFERENCES workspaces(id,owner_id),
 CONSTRAINT conditional_policies_masterplan_scope_fk FOREIGN KEY(workspace_id,campaign_id,masterplan_version_id) REFERENCES masterplan_versions(workspace_id,campaign_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS conditional_execution_policies_campaign_version_uidx ON conditional_execution_policies(workspace_id,campaign_id,version);
CREATE UNIQUE INDEX IF NOT EXISTS conditional_execution_policies_idempotency_uidx ON conditional_execution_policies(workspace_id,idempotency_key);
CREATE INDEX IF NOT EXISTS conditional_execution_policies_current_idx ON conditional_execution_policies(workspace_id,campaign_id,enabled);
CREATE TABLE IF NOT EXISTS conditional_execution_policy_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), policy_id uuid NOT NULL REFERENCES conditional_execution_policies(id) ON DELETE RESTRICT,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, action_type conditional_execution_action NOT NULL,
 provider text NOT NULL, account_id uuid NOT NULL REFERENCES paid_media_accounts(id) ON DELETE RESTRICT,
 entity_id uuid NOT NULL REFERENCES paid_media_entities(id) ON DELETE RESTRICT, max_actions_per_day integer NOT NULL,
 CONSTRAINT conditional_policy_actions_ceiling_check CHECK (max_actions_per_day BETWEEN 1 AND 100)
);
CREATE UNIQUE INDEX IF NOT EXISTS conditional_policy_actions_policy_target_uidx ON conditional_execution_policy_actions(policy_id,provider,account_id,entity_id,action_type);
CREATE TABLE IF NOT EXISTS conditional_execution_policy_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 policy_id uuid NOT NULL REFERENCES conditional_execution_policies(id) ON DELETE RESTRICT,
 event_type text NOT NULL, actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conditional_policy_events_policy_idx ON conditional_execution_policy_events(policy_id,created_at);
CREATE TABLE IF NOT EXISTS conditional_execution_intents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE, policy_id uuid NOT NULL REFERENCES conditional_execution_policies(id) ON DELETE RESTRICT,
 policy_action_id uuid NOT NULL REFERENCES conditional_execution_policy_actions(id) ON DELETE RESTRICT, proposal_id uuid NOT NULL REFERENCES paid_media_proposals(id) ON DELETE RESTRICT,
 intent_key text NOT NULL, status conditional_execution_intent_status NOT NULL DEFAULT 'planned', block_code text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS conditional_execution_intents_key_uidx ON conditional_execution_intents(workspace_id,intent_key);
CREATE INDEX IF NOT EXISTS conditional_execution_intents_campaign_idx ON conditional_execution_intents(workspace_id,campaign_id,created_at);
CREATE TABLE IF NOT EXISTS conditional_execution_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 intent_id uuid NOT NULL REFERENCES conditional_execution_intents(id) ON DELETE RESTRICT, attempt_key text NOT NULL,
 status conditional_execution_attempt_status NOT NULL DEFAULT 'attempted', provider_receipt jsonb, readback jsonb, error_code text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS conditional_execution_attempts_key_uidx ON conditional_execution_attempts(workspace_id,attempt_key);
CREATE TABLE IF NOT EXISTS conditional_execution_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 intent_id uuid NOT NULL REFERENCES conditional_execution_intents(id) ON DELETE RESTRICT, event_type text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conditional_execution_events_intent_idx ON conditional_execution_events(intent_id,created_at);
CREATE OR REPLACE FUNCTION prevent_conditional_execution_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'conditional execution records are append-only'; END; $$;
DROP TRIGGER IF EXISTS conditional_policy_actions_append_only ON conditional_execution_policy_actions;
CREATE TRIGGER conditional_policy_actions_append_only BEFORE UPDATE OR DELETE ON conditional_execution_policy_actions FOR EACH ROW EXECUTE FUNCTION prevent_conditional_execution_mutation();
DROP TRIGGER IF EXISTS conditional_execution_events_append_only ON conditional_execution_events;
CREATE TRIGGER conditional_execution_events_append_only BEFORE UPDATE OR DELETE ON conditional_execution_events FOR EACH ROW EXECUTE FUNCTION prevent_conditional_execution_mutation();
DROP TRIGGER IF EXISTS conditional_policy_events_append_only ON conditional_execution_policy_events;
CREATE TRIGGER conditional_policy_events_append_only BEFORE UPDATE OR DELETE ON conditional_execution_policy_events FOR EACH ROW EXECUTE FUNCTION prevent_conditional_execution_mutation();