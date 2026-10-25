CREATE TABLE IF NOT EXISTS paid_media_optimization_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES paid_media_accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  schedule_minutes integer NOT NULL DEFAULT 60 CHECK (schedule_minutes BETWEEN 15 AND 1440),
  configuration jsonb NOT NULL,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_run_at timestamptz,
  last_error text,
  created_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS paid_media_optimization_rules_due_idx ON paid_media_optimization_rules(enabled, next_run_at);
CREATE INDEX IF NOT EXISTS paid_media_optimization_rules_workspace_idx ON paid_media_optimization_rules(workspace_id, updated_at);

CREATE TABLE IF NOT EXISTS paid_media_optimization_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES paid_media_optimization_rules(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES paid_media_entities(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paid_media_optimization_alerts_fingerprint_uidx UNIQUE(rule_id, entity_id, fingerprint)
);
CREATE INDEX IF NOT EXISTS paid_media_optimization_alerts_workspace_created_idx ON paid_media_optimization_alerts(workspace_id, created_at DESC);
