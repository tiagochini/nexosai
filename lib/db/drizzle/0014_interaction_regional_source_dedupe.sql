-- Links an interaction proposal to the aggregate Regional Radar opportunity and
-- makes repeated/concurrent preparation idempotent per connected account/action.
ALTER TABLE "interaction_opportunities" ADD COLUMN IF NOT EXISTS "source_audience_opportunity_id" uuid REFERENCES "regional_audience_opportunities"("id") ON DELETE set null;
CREATE UNIQUE INDEX IF NOT EXISTS "interaction_opportunity_source_integration_action_uidx" ON "interaction_opportunities" ("source_audience_opportunity_id","integration_id","action");