CREATE TABLE IF NOT EXISTS platform_feature_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  trial_social_media_sales_enabled boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_feature_settings_singleton CHECK (id = 1)
);

INSERT INTO platform_feature_settings (id, trial_social_media_sales_enabled)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;
