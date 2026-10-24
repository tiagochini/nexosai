CREATE TABLE IF NOT EXISTS meta_crm_consents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 contact_id uuid NOT NULL REFERENCES sequence_contacts(id) ON DELETE CASCADE, encrypted_proof text, revoked_at timestamptz, actor text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS meta_crm_consents_contact_unique ON meta_crm_consents(workspace_id,contact_id);
CREATE TABLE IF NOT EXISTS meta_crm_syncs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 account_id uuid NOT NULL REFERENCES paid_media_accounts(id) ON DELETE CASCADE, sequence_id uuid NOT NULL REFERENCES launch_sequences(id) ON DELETE CASCADE,
 seed_operation_id uuid NOT NULL REFERENCES meta_audience_operations(id) ON DELETE RESTRICT, audience_id text NOT NULL,
 configuration jsonb NOT NULL, configuration_hash text NOT NULL, enabled boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'draft', approved_by text, expires_at timestamptz NOT NULL, next_run_at timestamptz NOT NULL DEFAULT now(),
 state_cipher text, intent jsonb, lease_owner text, lease_expires_at timestamptz, evidence jsonb NOT NULL DEFAULT '{}', error_code text, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS meta_crm_sync_seed_unique ON meta_crm_syncs(seed_operation_id);
CREATE INDEX IF NOT EXISTS meta_crm_sync_due_idx ON meta_crm_syncs(enabled,next_run_at);
CREATE TABLE IF NOT EXISTS meta_experiments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 account_id uuid NOT NULL REFERENCES paid_media_accounts(id) ON DELETE CASCADE, configuration jsonb NOT NULL, configuration_hash text NOT NULL,
 status text NOT NULL DEFAULT 'draft', approved_by text, provider_study_id text, intent jsonb, evidence jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS meta_experiments_workspace_idx ON meta_experiments(workspace_id,updated_at);
