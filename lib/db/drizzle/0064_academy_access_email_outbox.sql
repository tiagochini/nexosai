CREATE TABLE academy_access_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES academy_purchases(id) ON DELETE CASCADE,
  status varchar(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'sending', 'sent', 'failed', 'skipped')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  provider_id varchar(100),
  error_code varchar(100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academy_access_email_purchase_uidx UNIQUE (purchase_id)
);
CREATE INDEX academy_access_email_due_idx ON academy_access_email_outbox(next_attempt_at, id)
  WHERE status = 'scheduled';
