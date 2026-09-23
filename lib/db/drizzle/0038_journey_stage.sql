DO $$ BEGIN
  CREATE TYPE "journey_stage" AS ENUM ('awareness','consideration','qualification','objection_handling','closing','converted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE "sequence_contacts" ADD COLUMN IF NOT EXISTS "journey_stage" "journey_stage" NOT NULL DEFAULT 'awareness';