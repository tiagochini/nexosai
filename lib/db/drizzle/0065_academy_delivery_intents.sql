ALTER TABLE academy_access_email_outbox DROP CONSTRAINT academy_access_email_purchase_uidx;
ALTER TABLE academy_access_email_outbox ADD COLUMN delivery_key text;
UPDATE academy_access_email_outbox SET delivery_key = 'initial:' || purchase_id::text;
ALTER TABLE academy_access_email_outbox ALTER COLUMN delivery_key SET NOT NULL;
ALTER TABLE academy_access_email_outbox ADD COLUMN purpose varchar(30) NOT NULL DEFAULT 'initial';
CREATE UNIQUE INDEX academy_access_email_key_uidx ON academy_access_email_outbox(delivery_key);
CREATE UNIQUE INDEX academy_access_email_active_uidx ON academy_access_email_outbox(purchase_id)
  WHERE status IN ('scheduled', 'sending');
CREATE TABLE academy_access_delivery_requests (
  request_key text PRIMARY KEY,
  purchase_id uuid NOT NULL REFERENCES academy_purchases(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES academy_access_email_outbox(id) ON DELETE CASCADE,
  request_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE academy_gift_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_key text NOT NULL UNIQUE,
  request_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE academy_purchases ADD COLUMN gift_batch_id uuid REFERENCES academy_gift_batches(id) ON DELETE CASCADE;
ALTER TABLE academy_purchases ADD COLUMN revoked_at timestamptz;
ALTER TABLE academy_purchases ADD COLUMN refunded_amount_cents integer NOT NULL DEFAULT 0;
ALTER TABLE academy_purchases ADD COLUMN financial_hold varchar(30);
