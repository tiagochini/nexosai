ALTER TABLE platform_feature_settings ADD COLUMN trial_blocked_plans jsonb NOT NULL DEFAULT '[]'::jsonb, ADD COLUMN trial_blocked_offers jsonb NOT NULL DEFAULT '[]'::jsonb;
