-- Capability defaults are intentionally conservative and preserve existing
-- plans as single-workspace plans. The UPDATE makes the migration safe for
-- databases where plans already exist before NOT NULL is applied.
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "max_workspaces" integer;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "allowed_social_networks" jsonb;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "max_accounts_per_network" jsonb;

UPDATE "plans"
SET
  "max_workspaces" = COALESCE("max_workspaces", 1),
  "allowed_social_networks" = COALESCE(
    "allowed_social_networks",
    '["instagram","facebook","tiktok","linkedin","youtube"]'::jsonb
  ),
  "max_accounts_per_network" = COALESCE(
    "max_accounts_per_network",
    '{"instagram":1,"facebook":1,"tiktok":1,"linkedin":1,"youtube":1}'::jsonb
  );

ALTER TABLE "plans"
  ALTER COLUMN "max_workspaces" SET DEFAULT 1,
  ALTER COLUMN "max_workspaces" SET NOT NULL,
  ALTER COLUMN "allowed_social_networks" SET DEFAULT '["instagram","facebook","tiktok","linkedin","youtube"]'::jsonb,
  ALTER COLUMN "allowed_social_networks" SET NOT NULL,
  ALTER COLUMN "max_accounts_per_network" SET DEFAULT '{"instagram":1,"facebook":1,"tiktok":1,"linkedin":1,"youtube":1}'::jsonb,
  ALTER COLUMN "max_accounts_per_network" SET NOT NULL;