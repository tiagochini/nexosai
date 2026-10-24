CREATE TABLE IF NOT EXISTS meta_audience_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES paid_media_accounts(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL, request_hash text NOT NULL, encrypted_request text,
  summary jsonb NOT NULL, status text NOT NULL DEFAULT 'draft',
  approved_by text, approved_at timestamptz, intent jsonb, provider_audience_id text,
  evidence jsonb NOT NULL DEFAULT '{}', error_code text,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_audience_operation_status CHECK (status IN ('draft','approved','executing','ready','failed','manual_recovery','rolling_back','rolled_back','expired'))
);
CREATE UNIQUE INDEX IF NOT EXISTS meta_audience_operation_key_unique ON meta_audience_operations (workspace_id, idempotency_key);
CREATE INDEX IF NOT EXISTS meta_audience_operations_workspace_idx ON meta_audience_operations (workspace_id, created_at);
