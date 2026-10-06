-- Restore procedural integrity omitted by the historical table-only bootstrap.
-- Forward-only repair for both fresh baselines and existing databases; no data rewrite.

-- Canonical definitions from 0019_domains_landing_publication.sql
CREATE OR REPLACE FUNCTION prevent_landing_revision_content_mutation()
RETURNS trigger AS $$
BEGIN
  IF NEW."page_id" IS DISTINCT FROM OLD."page_id"
     OR NEW."workspace_id" IS DISTINCT FROM OLD."workspace_id"
     OR NEW."revision" IS DISTINCT FROM OLD."revision"
     OR NEW."source" IS DISTINCT FROM OLD."source"
     OR NEW."html" IS DISTINCT FROM OLD."html"
     OR NEW."content_hash" IS DISTINCT FROM OLD."content_hash" THEN
    RAISE EXCEPTION 'landing revisions are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "landing_revision_content_immutable" ON "landing_revisions";
CREATE TRIGGER "landing_revision_content_immutable"
  BEFORE UPDATE ON "landing_revisions"
  FOR EACH ROW EXECUTE FUNCTION prevent_landing_revision_content_mutation();

-- Canonical definitions from 0042_approval_integrity.sql
CREATE OR REPLACE FUNCTION prevent_approval_decision_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN COALESCE(NEW, OLD); END IF;
  RAISE EXCEPTION 'approval_decisions is append-only' USING ERRCODE = '55006';
END $$;
DROP TRIGGER IF EXISTS approval_decisions_append_only ON "approval_decisions";
CREATE TRIGGER approval_decisions_append_only BEFORE UPDATE OR DELETE ON "approval_decisions"
FOR EACH ROW EXECUTE FUNCTION prevent_approval_decision_mutation();

-- Canonical definitions from 0045_approval_sla.sql
CREATE OR REPLACE FUNCTION prevent_approval_sla_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF pg_trigger_depth() > 1 THEN RETURN OLD; END IF; RAISE EXCEPTION 'approval_sla_events is append-only'; END; $$;
CREATE OR REPLACE FUNCTION protect_approval_sla_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.campaign_id IS DISTINCT FROM OLD.campaign_id
    OR NEW.subject_type IS DISTINCT FROM OLD.subject_type OR NEW.subject_id IS DISTINCT FROM OLD.subject_id
    OR NEW.subject_snapshot_hash IS DISTINCT FROM OLD.subject_snapshot_hash OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
    OR NEW.command_fingerprint IS DISTINCT FROM OLD.command_fingerprint OR NEW.warning_at IS DISTINCT FROM OLD.warning_at
    OR NEW.due_at IS DISTINCT FROM OLD.due_at OR NEW.escalation_at IS DISTINCT FROM OLD.escalation_at
    OR NEW.expires_at IS DISTINCT FROM OLD.expires_at OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.channel IS DISTINCT FROM OLD.channel THEN RAISE EXCEPTION 'approval_sla_obligations identity is immutable'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS approval_sla_events_append_only ON approval_sla_events;
CREATE TRIGGER approval_sla_events_append_only BEFORE UPDATE OR DELETE ON approval_sla_events FOR EACH ROW EXECUTE FUNCTION prevent_approval_sla_event_mutation();
DROP TRIGGER IF EXISTS approval_sla_identity_immutable ON approval_sla_obligations;
CREATE TRIGGER approval_sla_identity_immutable BEFORE UPDATE ON approval_sla_obligations FOR EACH ROW EXECUTE FUNCTION protect_approval_sla_identity();

-- Canonical definitions from 0046_conditional_execution.sql
CREATE OR REPLACE FUNCTION prevent_conditional_execution_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'conditional execution records are append-only'; END; $$;
DROP TRIGGER IF EXISTS conditional_policy_actions_append_only ON conditional_execution_policy_actions;
CREATE TRIGGER conditional_policy_actions_append_only BEFORE UPDATE OR DELETE ON conditional_execution_policy_actions FOR EACH ROW EXECUTE FUNCTION prevent_conditional_execution_mutation();
DROP TRIGGER IF EXISTS conditional_execution_events_append_only ON conditional_execution_events;
CREATE TRIGGER conditional_execution_events_append_only BEFORE UPDATE OR DELETE ON conditional_execution_events FOR EACH ROW EXECUTE FUNCTION prevent_conditional_execution_mutation();
DROP TRIGGER IF EXISTS conditional_policy_events_append_only ON conditional_execution_policy_events;
CREATE TRIGGER conditional_policy_events_append_only BEFORE UPDATE OR DELETE ON conditional_execution_policy_events FOR EACH ROW EXECUTE FUNCTION prevent_conditional_execution_mutation();

-- Canonical definitions from 0049_conditional_execution_integrity.sql
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
CREATE OR REPLACE FUNCTION prevent_execution_evidence_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'execution evidence is append-only'; END $$;
DROP TRIGGER IF EXISTS conditional_policy_immutable ON conditional_execution_policies;
CREATE TRIGGER conditional_policy_immutable BEFORE UPDATE ON conditional_execution_policies
FOR EACH ROW EXECUTE FUNCTION prevent_conditional_policy_mutation();
DROP TRIGGER IF EXISTS execution_evidence_append_only ON execution_evidence;
CREATE TRIGGER execution_evidence_append_only BEFORE UPDATE OR DELETE ON execution_evidence
FOR EACH ROW EXECUTE FUNCTION prevent_execution_evidence_mutation();

-- Canonical definitions from 0054_realization_contract_hardening.sql
CREATE OR REPLACE FUNCTION realization_events_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'realization_events is append-only';
END $$;
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
DROP TRIGGER IF EXISTS realization_events_append_only_trigger ON realization_events;
CREATE TRIGGER realization_events_append_only_trigger
  BEFORE UPDATE OR DELETE ON realization_events FOR EACH ROW
  EXECUTE FUNCTION realization_events_append_only();
DROP TRIGGER IF EXISTS realization_contract_binding_immutable_trigger ON realization_contracts;
CREATE TRIGGER realization_contract_binding_immutable_trigger
  BEFORE UPDATE ON realization_contracts FOR EACH ROW
  EXECUTE FUNCTION realization_binding_immutable();
DROP TRIGGER IF EXISTS realization_attempt_terminal_immutable_trigger ON realization_attempts;
CREATE TRIGGER realization_attempt_terminal_immutable_trigger
  BEFORE UPDATE ON realization_attempts FOR EACH ROW
  EXECUTE FUNCTION realization_terminal_evidence_immutable();

-- Canonical definitions from 0055_operational_council.sql
CREATE OR REPLACE FUNCTION council_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'council records are append-only'; END $$;
DROP TRIGGER IF EXISTS council_minutes_append_only ON council_minutes;
CREATE TRIGGER council_minutes_append_only BEFORE UPDATE OR DELETE ON council_minutes FOR EACH ROW EXECUTE FUNCTION council_append_only();
DROP TRIGGER IF EXISTS council_decisions_append_only ON council_decisions;
CREATE TRIGGER council_decisions_append_only BEFORE UPDATE OR DELETE ON council_decisions FOR EACH ROW EXECUTE FUNCTION council_append_only();
DROP TRIGGER IF EXISTS council_actions_append_only ON council_actions;
CREATE TRIGGER council_actions_append_only BEFORE UPDATE OR DELETE ON council_actions FOR EACH ROW EXECUTE FUNCTION council_append_only();
DROP TRIGGER IF EXISTS council_outcomes_append_only ON council_outcomes;
CREATE TRIGGER council_outcomes_append_only BEFORE UPDATE OR DELETE ON council_outcomes FOR EACH ROW EXECUTE FUNCTION council_append_only();

-- Canonical definitions from 0059_operational_council_action_integrity.sql
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
DROP TRIGGER IF EXISTS council_actions_binding_guard ON council_actions;
CREATE TRIGGER council_actions_binding_guard BEFORE INSERT OR UPDATE ON council_actions FOR EACH ROW EXECUTE FUNCTION council_action_binding_guard();

-- Canonical definitions from 0061_m11_social_intelligence.sql
CREATE OR REPLACE FUNCTION prevent_m11_social_report_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'm11 social reports are immutable';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS m11_social_reports_immutable ON "m11_social_reports";
CREATE TRIGGER m11_social_reports_immutable
  BEFORE UPDATE OR DELETE ON "m11_social_reports"
  FOR EACH ROW EXECUTE FUNCTION prevent_m11_social_report_mutation();

-- Restore tenant-scoped foreign keys omitted by temporary publish stage one.
-- Parent composite unique indexes were also absent from the table snapshot.
CREATE UNIQUE INDEX IF NOT EXISTS paid_media_accounts_workspace_id_uidx ON paid_media_accounts(workspace_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS paid_media_entities_workspace_id_uidx ON paid_media_entities(workspace_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS paid_media_proposals_workspace_id_uidx ON paid_media_proposals(workspace_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS conditional_execution_policies_workspace_id_uidx ON conditional_execution_policies(workspace_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS conditional_policy_actions_workspace_id_uidx ON conditional_execution_policy_actions(workspace_id,id);
DO $$ BEGIN
  ALTER TABLE "academy_purchases" ADD CONSTRAINT "academy_purchases_gift_batch_id_academy_gift_batches_id_fk" FOREIGN KEY ("gift_batch_id") REFERENCES "academy_gift_batches" ("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_campaign_workspace_fk" FOREIGN KEY ("workspace_id", "campaign_id") REFERENCES "campaigns" ("workspace_id", "id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_workspace_actor_fk" FOREIGN KEY ("workspace_id", "actor_user_id") REFERENCES "workspaces" ("id", "owner_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_masterplan_scope_fk" FOREIGN KEY ("workspace_id", "campaign_id", "masterplan_version_id") REFERENCES "masterplan_versions" ("workspace_id", "campaign_id", "id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_content_piece_scope_fk" FOREIGN KEY ("workspace_id", "campaign_id", "content_piece_id") REFERENCES "content_pieces" ("workspace_id", "campaign_id", "id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_checkpoint_scope_fk" FOREIGN KEY ("campaign_id", "checkpoint_id") REFERENCES "approval_checkpoints" ("campaign_id", "id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "approval_sla_events" ADD CONSTRAINT "approval_sla_events_scope_fk" FOREIGN KEY ("workspace_id", "obligation_id") REFERENCES "approval_sla_obligations" ("workspace_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "approval_sla_obligations" ADD CONSTRAINT "approval_sla_workspace_creator_fk" FOREIGN KEY ("workspace_id", "created_by") REFERENCES "workspaces" ("id", "owner_id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "approval_sla_obligations" ADD CONSTRAINT "approval_sla_masterplan_scope_fk" FOREIGN KEY ("workspace_id", "campaign_id", "masterplan_version_id") REFERENCES "masterplan_versions" ("workspace_id", "campaign_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "approval_sla_obligations" ADD CONSTRAINT "approval_sla_content_scope_fk" FOREIGN KEY ("workspace_id", "campaign_id", "content_piece_id") REFERENCES "content_pieces" ("workspace_id", "campaign_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "approval_sla_obligations" ADD CONSTRAINT "approval_sla_checkpoint_scope_fk" FOREIGN KEY ("campaign_id", "checkpoint_id") REFERENCES "approval_checkpoints" ("campaign_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "conditional_execution_intents" ADD CONSTRAINT "conditional_intents_proposal_scope_fk" FOREIGN KEY ("workspace_id", "proposal_id") REFERENCES "paid_media_proposals" ("workspace_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "conditional_execution_intents" ADD CONSTRAINT "conditional_intents_policy_campaign_fk" FOREIGN KEY ("workspace_id", "campaign_id", "policy_id") REFERENCES "conditional_execution_policies" ("workspace_id", "campaign_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "conditional_execution_intents" ADD CONSTRAINT "conditional_intents_action_policy_scope_fk" FOREIGN KEY ("workspace_id", "policy_id", "policy_action_id") REFERENCES "conditional_execution_policy_actions" ("workspace_id", "policy_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "conditional_execution_policies" ADD CONSTRAINT "conditional_policies_campaign_scope_fk" FOREIGN KEY ("workspace_id", "campaign_id") REFERENCES "campaigns" ("workspace_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "conditional_execution_policies" ADD CONSTRAINT "conditional_policies_owner_fk" FOREIGN KEY ("workspace_id", "owner_user_id") REFERENCES "workspaces" ("id", "owner_id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "conditional_execution_policies" ADD CONSTRAINT "conditional_policies_masterplan_scope_fk" FOREIGN KEY ("workspace_id", "campaign_id", "masterplan_version_id") REFERENCES "masterplan_versions" ("workspace_id", "campaign_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "conditional_execution_policy_actions" ADD CONSTRAINT "conditional_actions_policy_scope_fk" FOREIGN KEY ("workspace_id", "policy_id") REFERENCES "conditional_execution_policies" ("workspace_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "conditional_execution_policy_actions" ADD CONSTRAINT "conditional_actions_account_scope_fk" FOREIGN KEY ("workspace_id", "account_id") REFERENCES "paid_media_accounts" ("workspace_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "conditional_execution_policy_actions" ADD CONSTRAINT "conditional_actions_entity_scope_fk" FOREIGN KEY ("workspace_id", "entity_id") REFERENCES "paid_media_entities" ("workspace_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "conditional_execution_policy_events" ADD CONSTRAINT "conditional_policy_events_policy_scope_fk" FOREIGN KEY ("workspace_id", "policy_id") REFERENCES "conditional_execution_policies" ("workspace_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "council_actions" ADD CONSTRAINT "council_actions_decision_scope_fk" FOREIGN KEY ("workspace_id", "decision_id") REFERENCES "council_decisions" ("workspace_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "council_cycles" ADD CONSTRAINT "council_cycle_plan_scope_fk" FOREIGN KEY ("workspace_id", "campaign_id", "masterplan_version_id") REFERENCES "masterplan_versions" ("workspace_id", "campaign_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "council_decisions" ADD CONSTRAINT "council_decisions_cycle_scope_fk" FOREIGN KEY ("workspace_id", "cycle_id") REFERENCES "council_cycles" ("workspace_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "council_minutes" ADD CONSTRAINT "council_minutes_cycle_scope_fk" FOREIGN KEY ("workspace_id", "cycle_id") REFERENCES "council_cycles" ("workspace_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "council_outcomes" ADD CONSTRAINT "council_outcomes_decision_scope_fk" FOREIGN KEY ("workspace_id", "decision_id") REFERENCES "council_decisions" ("workspace_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "council_outcomes" ADD CONSTRAINT "council_outcomes_action_scope_fk" FOREIGN KEY ("workspace_id", "action_id") REFERENCES "council_actions" ("workspace_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "council_outcomes" ADD CONSTRAINT "council_outcomes_next_cycle_scope_fk" FOREIGN KEY ("workspace_id", "next_cycle_id") REFERENCES "council_cycles" ("workspace_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "first_touch_attempts" ADD CONSTRAINT "first_touch_workspace_sequence_fk" FOREIGN KEY ("workspace_id", "sequence_id") REFERENCES "launch_sequences" ("workspace_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "first_touch_attempts" ADD CONSTRAINT "first_touch_workspace_contact_fk" FOREIGN KEY ("workspace_id", "contact_id") REFERENCES "sequence_contacts" ("workspace_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "first_touch_attempts" ADD CONSTRAINT "first_touch_workspace_item_fk" FOREIGN KEY ("workspace_id", "item_id") REFERENCES "launch_sequence_items" ("workspace_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "realization_attempts" ADD CONSTRAINT "realization_attempts_contract_scope_fk" FOREIGN KEY ("workspace_id", "contract_id") REFERENCES "realization_contracts" ("workspace_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "realization_contracts" ADD CONSTRAINT "realization_contracts_campaign_scope_fk" FOREIGN KEY ("workspace_id", "campaign_id") REFERENCES "campaigns" ("workspace_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "realization_contracts" ADD CONSTRAINT "realization_contracts_masterplan_scope_fk" FOREIGN KEY ("workspace_id", "campaign_id", "masterplan_version_id") REFERENCES "masterplan_versions" ("workspace_id", "campaign_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "realization_events" ADD CONSTRAINT "realization_events_contract_scope_fk" FOREIGN KEY ("workspace_id", "contract_id") REFERENCES "realization_contracts" ("workspace_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "realization_events" ADD CONSTRAINT "realization_events_attempt_scope_fk" FOREIGN KEY ("workspace_id", "contract_id", "attempt_id") REFERENCES "realization_attempts" ("workspace_id", "contract_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "social_publish_attempts" ADD CONSTRAINT "social_publish_attempts_workspace_post_fk" FOREIGN KEY ("workspace_id", "post_id") REFERENCES "social_posts" ("workspace_id", "id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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
