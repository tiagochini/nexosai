ALTER TABLE council_outcomes ADD COLUMN IF NOT EXISTS next_cycle_id uuid;
ALTER TABLE council_outcomes ADD CONSTRAINT council_outcomes_next_cycle_scope_fk
  FOREIGN KEY (workspace_id, next_cycle_id) REFERENCES council_cycles(workspace_id, id);
ALTER TABLE council_outcomes ADD CONSTRAINT council_outcomes_next_cycle_required
  CHECK (next_cycle_id IS NOT NULL) NOT VALID;
DROP INDEX IF EXISTS council_outcomes_action_evidence_uidx;
CREATE UNIQUE INDEX council_outcomes_action_evidence_uidx
  ON council_outcomes(workspace_id, action_id, next_cycle_id, verification_fingerprint);