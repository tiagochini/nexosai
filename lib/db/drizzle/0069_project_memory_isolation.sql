-- Preserve invalid legacy entries as unlinked, inaccessible history.
UPDATE workspace_memory m SET campaign_id = NULL
WHERE campaign_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM campaigns c WHERE c.id = m.campaign_id AND c.workspace_id = m.workspace_id
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_memory_project_scope_fk' AND conrelid = 'workspace_memory'::regclass) THEN
    ALTER TABLE "workspace_memory" ADD CONSTRAINT "workspace_memory_project_scope_fk" FOREIGN KEY ("workspace_id", "campaign_id") REFERENCES "campaigns" ("workspace_id", "id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS workspace_memory_project_scope_idx ON workspace_memory (workspace_id, campaign_id, agent_role);

CREATE OR REPLACE FUNCTION prevent_project_memory_scope_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.campaign_id IS DISTINCT FROM OLD.campaign_id THEN
    RAISE EXCEPTION 'project memory scope is immutable';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS workspace_memory_scope_immutable ON workspace_memory;
CREATE TRIGGER workspace_memory_scope_immutable BEFORE UPDATE ON workspace_memory
FOR EACH ROW EXECUTE FUNCTION prevent_project_memory_scope_mutation();
