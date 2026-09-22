-- Fail closed: operators must reconcile ambiguous historical identities.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM sequence_contacts WHERE email IS NOT NULL
    GROUP BY workspace_id, sequence_id, lower(trim(email)) HAVING count(*) > 1)
  OR EXISTS (SELECT 1 FROM sequence_contacts WHERE phone IS NOT NULL
    GROUP BY workspace_id, sequence_id, regexp_replace(phone, '[^0-9]', '', 'g') HAVING count(*) > 1)
  OR EXISTS (SELECT 1 FROM launch_sequences WHERE campaign_id IS NOT NULL
    GROUP BY workspace_id, campaign_id HAVING count(*) > 1)
  THEN RAISE EXCEPTION 'first-touch migration aborted: duplicate normalized identities or campaign sequences require explicit reconciliation'; END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS launch_sequences_workspace_campaign_uidx
  ON launch_sequences (workspace_id, campaign_id) WHERE campaign_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sequence_contacts_workspace_sequence_email_uidx
  ON sequence_contacts (workspace_id, sequence_id, lower(trim(email))) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sequence_contacts_workspace_sequence_phone_uidx
  ON sequence_contacts (workspace_id, sequence_id, regexp_replace(phone, '[^0-9]', '', 'g')) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS launch_sequences_workspace_id_uidx ON launch_sequences(workspace_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS launch_sequence_items_workspace_id_uidx ON launch_sequence_items(workspace_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS sequence_contacts_workspace_id_uidx ON sequence_contacts(workspace_id,id);
DO $$ BEGIN CREATE TYPE first_touch_attempt_state AS ENUM ('executing','retryable','ambiguous','confirmed','terminal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS first_touch_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 sequence_id uuid NOT NULL, contact_id uuid NOT NULL, item_id uuid NOT NULL,
 channel text NOT NULL, version text NOT NULL, attempt_key text NOT NULL,
 state first_touch_attempt_state NOT NULL DEFAULT 'executing', lease_owner text, lease_expires_at timestamptz,
 retry_count integer NOT NULL DEFAULT 0, next_attempt_at timestamptz, receipt jsonb NOT NULL DEFAULT '{}', error text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT first_touch_attempts_key_uidx UNIQUE(workspace_id,attempt_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS sequence_engagement_first_touch_uidx
 ON sequence_engagement(workspace_id,sequence_id,contact_id,item_id,channel,event)
 WHERE contact_id IS NOT NULL AND item_id IS NOT NULL AND channel IS NOT NULL;