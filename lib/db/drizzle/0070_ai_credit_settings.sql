CREATE TABLE ai_credit_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  margin_multiplier numeric(8, 4) NOT NULL DEFAULT 3 CHECK (margin_multiplier > 0 AND margin_multiplier <= 100),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO ai_credit_settings (id, margin_multiplier) VALUES (1, 3)
ON CONFLICT (id) DO NOTHING;
