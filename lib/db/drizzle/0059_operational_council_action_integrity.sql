ALTER TABLE council_actions ADD CONSTRAINT council_actions_supported_family_check CHECK (family <> 'unsupported');
CREATE OR REPLACE FUNCTION council_action_binding_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d record; c record;
BEGIN
  SELECT cycle_id INTO d FROM council_decisions WHERE workspace_id=NEW.workspace_id AND id=NEW.decision_id;
  IF d IS NULL THEN RAISE EXCEPTION 'council decision scope mismatch'; END IF;
  SELECT campaign_id,masterplan_version_id,context_fingerprint,snapshot_hash INTO d FROM council_cycles WHERE workspace_id=NEW.workspace_id AND id=d.cycle_id;
  SELECT action,campaign_id,masterplan_version_id,context_fingerprint,snapshot_hash INTO c FROM realization_contracts WHERE workspace_id=NEW.workspace_id AND id=NEW.realization_contract_id;
  IF c IS NULL OR c.action::text <> NEW.family::text OR row(c.campaign_id,c.masterplan_version_id,c.context_fingerprint,c.snapshot_hash) IS DISTINCT FROM row(d.campaign_id,d.masterplan_version_id,d.context_fingerprint,d.snapshot_hash)
    THEN RAISE EXCEPTION 'council action realization binding mismatch'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER council_actions_binding_guard BEFORE INSERT OR UPDATE ON council_actions FOR EACH ROW EXECUTE FUNCTION council_action_binding_guard();