CREATE TABLE IF NOT EXISTS academy_student_accounts (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  session_hash text,
  session_expires_at timestamptz,
  reset_hash text,
  reset_expires_at timestamptz,
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE academy_purchases
  ADD COLUMN IF NOT EXISTS claimed_by_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
CREATE INDEX IF NOT EXISTS academy_purchases_claimed_user_idx ON academy_purchases(claimed_by_user_id);
