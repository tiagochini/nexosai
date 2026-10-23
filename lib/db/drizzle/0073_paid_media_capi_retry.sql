-- No historic receipts are replayed. Only new, consented server events opt in.
ALTER TABLE paid_media_event_receipts ADD COLUMN IF NOT EXISTS retry_payload text;
ALTER TABLE paid_media_event_receipts ADD COLUMN IF NOT EXISTS delivery_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE paid_media_event_receipts ADD COLUMN IF NOT EXISTS retry_at timestamptz;
ALTER TABLE paid_media_event_receipts ADD COLUMN IF NOT EXISTS retry_expires_at timestamptz;
CREATE INDEX IF NOT EXISTS paid_media_event_receipts_retry_idx ON paid_media_event_receipts (retry_at) WHERE retry_at IS NOT NULL;
