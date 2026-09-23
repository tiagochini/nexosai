-- M08 integrity hardening.  This is deliberately a new migration: previous
-- conditional-execution migrations are already applied in deployed databases.
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
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key THEN
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
DROP TRIGGER IF EXISTS conditional_policy_immutable ON conditional_execution_policies;
CREATE TRIGGER conditional_policy_immutable BEFORE UPDATE ON conditional_execution_policies
FOR EACH ROW EXECUTE FUNCTION prevent_conditional_policy_mutation();

CREATE OR REPLACE FUNCTION prevent_execution_evidence_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'execution evidence is append-only'; END $$;
DROP TRIGGER IF EXISTS execution_evidence_append_only ON execution_evidence;
CREATE TRIGGER execution_evidence_append_only BEFORE UPDATE OR DELETE ON execution_evidence
FOR EACH ROW EXECUTE FUNCTION prevent_execution_evidence_mutation();