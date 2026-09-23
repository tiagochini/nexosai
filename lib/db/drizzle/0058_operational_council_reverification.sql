ALTER TABLE council_outcomes
  ADD COLUMN IF NOT EXISTS verification_fingerprint text;

UPDATE council_outcomes
SET verification_fingerprint = md5(coalesce(verification::text, '{}'))
WHERE verification_fingerprint IS NULL;

ALTER TABLE council_outcomes
  ALTER COLUMN verification_fingerprint SET NOT NULL;

DROP INDEX IF EXISTS council_outcomes_action_once_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS council_outcomes_action_evidence_uidx
  ON council_outcomes (workspace_id, action_id, verification_fingerprint);