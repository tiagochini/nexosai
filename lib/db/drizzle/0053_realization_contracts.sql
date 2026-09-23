CREATE TYPE realization_action AS ENUM ('paid_media_pause','paid_media_launch');
CREATE TYPE realization_state AS ENUM ('proposal','planned','approval_binding','preflight','blocked','attempted','provider_confirmed','artifact_qc','monitored','retryable','failed','recovery','compensated','exception');
CREATE TYPE realization_attempt_state AS ENUM ('claimed','in_flight','readback','confirmed','retryable','failed','ambiguous','compensated','compensation_failed');
CREATE TYPE realization_event_type AS ENUM ('created','preflighted','claimed','provider_receipt','readback','qc','retry','monitor','compensate','state_changed','exception');
CREATE TABLE realization_contracts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE, masterplan_version_id uuid NOT NULL REFERENCES masterplan_versions(id) ON DELETE RESTRICT,
 action realization_action NOT NULL, state realization_state NOT NULL DEFAULT 'proposal', idempotency_key text NOT NULL,
 binding_hash text NOT NULL, request_fingerprint text NOT NULL, context_fingerprint text NOT NULL, snapshot_hash text NOT NULL,
 subject_type text NOT NULL, subject_id uuid NOT NULL, binding jsonb NOT NULL, max_attempts integer NOT NULL DEFAULT 3, attempts_used integer NOT NULL DEFAULT 0,
 created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT realization_contracts_campaign_scope_fk FOREIGN KEY(workspace_id,campaign_id) REFERENCES campaigns(workspace_id,id),
 CONSTRAINT realization_contracts_masterplan_scope_fk FOREIGN KEY(workspace_id,campaign_id,masterplan_version_id) REFERENCES masterplan_versions(workspace_id,campaign_id,id),
 CONSTRAINT realization_contracts_max_attempts_check CHECK(max_attempts between 1 and 10)
);
CREATE UNIQUE INDEX realization_contracts_workspace_idempotency_uidx ON realization_contracts(workspace_id,idempotency_key);
CREATE UNIQUE INDEX realization_contracts_workspace_id_uidx ON realization_contracts(workspace_id,id);
CREATE TABLE realization_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contract_id uuid NOT NULL REFERENCES realization_contracts(id) ON DELETE RESTRICT,
 workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, number integer NOT NULL, state realization_attempt_state NOT NULL DEFAULT 'claimed',
 receipt jsonb, readback jsonb, error jsonb, qc jsonb, retry jsonb, recovery jsonb, compensation jsonb,
 claimed_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, lease_owner text, lease_expires_at timestamptz,
 UNIQUE(contract_id,number), FOREIGN KEY(workspace_id,contract_id) REFERENCES realization_contracts(workspace_id,id),
 CONSTRAINT realization_attempts_number_check CHECK(number between 1 and 10)
);
CREATE INDEX realization_attempts_workspace_idx ON realization_attempts(workspace_id,claimed_at);
CREATE TABLE realization_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contract_id uuid NOT NULL REFERENCES realization_contracts(id) ON DELETE RESTRICT,
 attempt_id uuid REFERENCES realization_attempts(id) ON DELETE RESTRICT, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 type realization_event_type NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX realization_events_contract_created_idx ON realization_events(contract_id,created_at);
ALTER TABLE realization_events ADD CONSTRAINT realization_events_contract_scope_fk FOREIGN KEY(workspace_id,contract_id) REFERENCES realization_contracts(workspace_id,id);
CREATE OR REPLACE FUNCTION realization_events_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'realization_events is append-only'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER realization_events_append_only_trigger BEFORE UPDATE OR DELETE ON realization_events FOR EACH ROW EXECUTE FUNCTION realization_events_append_only();
CREATE OR REPLACE FUNCTION realization_contract_binding_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.workspace_id<>OLD.workspace_id OR NEW.campaign_id<>OLD.campaign_id OR NEW.masterplan_version_id<>OLD.masterplan_version_id OR NEW.action<>OLD.action OR NEW.idempotency_key<>OLD.idempotency_key OR NEW.binding_hash<>OLD.binding_hash OR NEW.binding<>OLD.binding THEN RAISE EXCEPTION 'realization binding is immutable'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER realization_contract_binding_immutable_trigger BEFORE UPDATE ON realization_contracts FOR EACH ROW EXECUTE FUNCTION realization_contract_binding_immutable();
ALTER TYPE execution_evidence_state ADD VALUE IF NOT EXISTS 'monitored';
ALTER TYPE execution_evidence_state ADD VALUE IF NOT EXISTS 'retryable';
ALTER TYPE execution_evidence_state ADD VALUE IF NOT EXISTS 'failed';
ALTER TYPE execution_evidence_state ADD VALUE IF NOT EXISTS 'recovery';
ALTER TYPE execution_evidence_state ADD VALUE IF NOT EXISTS 'compensated';
ALTER TYPE execution_evidence_state ADD VALUE IF NOT EXISTS 'exception';