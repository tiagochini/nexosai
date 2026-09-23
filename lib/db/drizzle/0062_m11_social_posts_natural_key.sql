DO $$
DECLARE
  duplicate_key record;
BEGIN
  SELECT workspace_id, content_piece_id, integration_id, count(*) AS row_count
    INTO duplicate_key
    FROM social_posts
   WHERE content_piece_id IS NOT NULL
   GROUP BY workspace_id, content_piece_id, integration_id
  HAVING count(*) > 1
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Cannot create M11 social post natural key: duplicate workspace_id %, content_piece_id %, integration_id % (% rows). Reconcile these real posts explicitly before rerunning migration.',
      duplicate_key.workspace_id, duplicate_key.content_piece_id,
      duplicate_key.integration_id, duplicate_key.row_count;
  END IF;
END $$;

CREATE UNIQUE INDEX "social_posts_workspace_content_piece_integration_uidx"
  ON "social_posts" ("workspace_id", "content_piece_id", "integration_id")
  WHERE "content_piece_id" IS NOT NULL;