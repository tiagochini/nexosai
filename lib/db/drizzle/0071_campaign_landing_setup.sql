ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS landing_setup_data jsonb NOT NULL DEFAULT '{}'::jsonb;
