ALTER TABLE ai_credit_settings
  ADD COLUMN IF NOT EXISTS provider_balance_snapshots jsonb NOT NULL DEFAULT '{}'::jsonb;
