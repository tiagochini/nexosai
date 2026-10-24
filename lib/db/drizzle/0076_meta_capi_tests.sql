-- Diagnostic events are isolated from production receipts and retry queues.
CREATE TABLE IF NOT EXISTS meta_capi_tests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 account_id uuid NOT NULL REFERENCES paid_media_accounts(id) ON DELETE CASCADE,
 dataset_id uuid NOT NULL REFERENCES paid_media_datasets(id) ON DELETE CASCADE,
 request_hash text NOT NULL, encrypted_request text, summary jsonb NOT NULL,
 status text NOT NULL DEFAULT 'prepared', intent jsonb, evidence jsonb NOT NULL DEFAULT '{}',
 expires_at timestamptz NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS meta_capi_tests_workspace_idx ON meta_capi_tests(workspace_id,updated_at);
