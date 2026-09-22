CREATE UNIQUE INDEX IF NOT EXISTS "social_posts_workspace_id_uidx" ON "social_posts" ("workspace_id","id");
ALTER TABLE "social_publish_attempts"
  ADD CONSTRAINT "social_publish_attempts_workspace_post_fk"
  FOREIGN KEY ("workspace_id","post_id") REFERENCES "social_posts" ("workspace_id","id") ON DELETE CASCADE;