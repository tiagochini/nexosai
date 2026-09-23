ALTER TABLE paid_media_accounts
  ADD COLUMN IF NOT EXISTS operational_health boolean NOT NULL DEFAULT false;

-- Discovery is the only trusted source for this flag; callers must explicitly
-- mark an account healthy after a successful provider read.
CREATE OR REPLACE FUNCTION prevent_conditional_policy_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.campaign_id IS DISTINCT FROM OLD.campaign_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.masterplan_version_id IS DISTINCT FROM OLD.masterplan_version_id
     OR NEW.snapshot_hash IS DISTINCT FROM OLD.snapshot_hash
     OR NEW.context_fingerprint IS DISTINCT FROM OLD.context_fingerprint
     OR NEW.enabled IS DISTINCT FROM OLD.enabled
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'conditional execution policy binding is immutable';
  END IF;
  IF OLD.revoked_at IS NOT NULL OR OLD.revoked_by IS NOT NULL
     OR NEW.revoked_at IS NULL OR NEW.revoked_by IS NULL THEN
    IF NEW.revoked_at IS DISTINCT FROM OLD.revoked_at OR NEW.revoked_by IS DISTINCT FROM OLD.revoked_by THEN
      RAISE EXCEPTION 'conditional execution policy may only be revoked once';
    END IF;
  END IF;
  RETURN NEW;
END $$;