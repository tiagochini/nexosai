ALTER TABLE email_dispatches ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE whatsapp_dispatches ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS email_dispatches_workspace_idempotency_uidx
  ON email_dispatches(workspace_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_dispatches_workspace_idempotency_uidx
  ON whatsapp_dispatches(workspace_id,idempotency_key) WHERE idempotency_key IS NOT NULL;