-- M09 forward hardening.  0053 already contains the canonical state enum and
-- binding columns; this migration must not rewrite existing state or evidence.
ALTER TABLE realization_contracts
  ADD CONSTRAINT realization_contracts_attempts_bound
  CHECK (attempts_used BETWEEN 0 AND max_attempts);

CREATE INDEX IF NOT EXISTS realization_contracts_subject_idx
  ON realization_contracts (workspace_id, subject_type, subject_id);
CREATE INDEX IF NOT EXISTS realization_attempts_contract_state_idx
  ON realization_attempts (workspace_id, contract_id, state);
CREATE UNIQUE INDEX IF NOT EXISTS realization_attempts_workspace_contract_id_uidx
  ON realization_attempts (workspace_id, contract_id, id);
CREATE INDEX IF NOT EXISTS realization_events_attempt_idx
  ON realization_events (workspace_id, contract_id, attempt_id, created_at);

-- Keep the parent scope on every event, including attempt-linked events.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'realization_events_attempt_scope_fk') THEN
    ALTER TABLE realization_events ADD CONSTRAINT realization_events_attempt_scope_fk
      FOREIGN KEY (workspace_id, contract_id, attempt_id)
      REFERENCES realization_attempts (workspace_id, contract_id, id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION realization_events_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'realization_events is append-only';
END $$;
DROP TRIGGER IF EXISTS realization_events_append_only_trigger ON realization_events;
CREATE TRIGGER realization_events_append_only_trigger
  BEFORE UPDATE OR DELETE ON realization_events FOR EACH ROW
  EXECUTE FUNCTION realization_events_append_only();

CREATE OR REPLACE FUNCTION realization_binding_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF row(NEW.workspace_id, NEW.campaign_id, NEW.masterplan_version_id,
         NEW.action, NEW.idempotency_key, NEW.binding_hash,
         NEW.request_fingerprint, NEW.context_fingerprint, NEW.snapshot_hash,
         NEW.subject_type, NEW.subject_id, NEW.binding)
     IS DISTINCT FROM
     row(OLD.workspace_id, OLD.campaign_id, OLD.masterplan_version_id,
         OLD.action, OLD.idempotency_key, OLD.binding_hash,
         OLD.request_fingerprint, OLD.context_fingerprint, OLD.snapshot_hash,
         OLD.subject_type, OLD.subject_id, OLD.binding)
  THEN RAISE EXCEPTION 'realization binding is immutable'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS realization_contract_binding_immutable_trigger ON realization_contracts;
CREATE TRIGGER realization_contract_binding_immutable_trigger
  BEFORE UPDATE ON realization_contracts FOR EACH ROW
  EXECUTE FUNCTION realization_binding_immutable();

-- A terminal attempt is evidence, not a mutable work queue row.  Operational
-- fields (lease and completion timestamps) remain mutable for fencing.
CREATE OR REPLACE FUNCTION realization_terminal_evidence_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state IN ('confirmed','failed','ambiguous','compensated','compensation_failed')
     AND (NEW.state, NEW.receipt, NEW.readback, NEW.error, NEW.qc,
          NEW.retry, NEW.recovery, NEW.compensation)
         IS DISTINCT FROM
         (OLD.state, OLD.receipt, OLD.readback, OLD.error, OLD.qc,
          OLD.retry, OLD.recovery, OLD.compensation)
  THEN RAISE EXCEPTION 'terminal realization attempt evidence is immutable'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS realization_attempt_terminal_immutable_trigger ON realization_attempts;
CREATE TRIGGER realization_attempt_terminal_immutable_trigger
  BEFORE UPDATE ON realization_attempts FOR EACH ROW
  EXECUTE FUNCTION realization_terminal_evidence_immutable();