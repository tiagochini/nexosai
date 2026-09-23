CREATE TABLE IF NOT EXISTS "m11_social_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "period_from" timestamptz NOT NULL,
  "period_to" timestamptz NOT NULL,
  "filters" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "aggregates" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "provenance" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "row_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "m11_social_reports_workspace_created_idx"
  ON "m11_social_reports" ("workspace_id", "created_at", "id");
CREATE OR REPLACE FUNCTION prevent_m11_social_report_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'm11 social reports are immutable';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS m11_social_reports_immutable ON "m11_social_reports";
CREATE TRIGGER m11_social_reports_immutable
  BEFORE UPDATE OR DELETE ON "m11_social_reports"
  FOR EACH ROW EXECUTE FUNCTION prevent_m11_social_report_mutation();