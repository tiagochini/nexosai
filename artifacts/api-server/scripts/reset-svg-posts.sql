-- One-time DATA repair for social presence after the image-provider deployment.
-- Run only on the production writer, AFTER the SVG publication guard is deployed.
-- The agent's production SQL connection is READ-ONLY and cannot execute this file.
--
-- Before running: export a restricted backup of the matching rows (including
-- media_urls and storyboard_urls) through the operator's production DB console.
-- This script intentionally does not change schema or delete posts.
--
-- Preflight (run separately and compare with the output from this script):
-- SELECT status, count(*) FROM social_presence_posts
-- WHERE media_urls::text ILIKE '%svg%' GROUP BY status;
-- SELECT count(*) FROM social_posts WHERE media_urls::text ILIKE '%svg%';
--
-- Production observed on 2026-09-24: 12 failed + 7 scheduled eligible;
-- 3 published historical posts are intentionally excluded to prevent reposting.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Fail instead of sweeping a materially different population without review.
DO $$
DECLARE candidate_count integer;
BEGIN
  SELECT count(*) INTO candidate_count
  FROM social_presence_posts
  WHERE status IN ('scheduled', 'failed')
    AND media_urls::text ILIKE '%svg%'
    AND published_at IS NULL
    AND platform_post_id IS NULL;
  IF candidate_count > 100 THEN
    RAISE EXCEPTION 'SVG reset candidate count (%) exceeds reviewed limit 100', candidate_count;
  END IF;
END $$;

-- Clearing storyboard_urls is essential: the overdue-draft worker otherwise
-- copies an old SVG storyboard straight back into media_urls.
-- Keep scheduled_for/caption/workspace/account unchanged. "Awaiting" is honest:
-- a real image has NOT yet been generated at this point.
WITH candidates AS MATERIALIZED (
  SELECT id
  FROM social_presence_posts
  WHERE status IN ('scheduled', 'failed')
    AND media_urls::text ILIKE '%svg%'
    AND published_at IS NULL
    AND platform_post_id IS NULL
  FOR UPDATE
),
reset AS (
  UPDATE social_presence_posts AS post
  SET status = 'draft',
      media_urls = '[]'::jsonb,
      storyboard_urls = '[]'::jsonb,
      media_gen_status = NULL,
      media_job_id = NULL,
      media_job_provider = NULL,
      retry_count = 0,
      error_message = 'SVG placeholder removido; aguardando geração de imagem real antes de publicar.',
      updated_at = now()
  FROM candidates
  WHERE post.id = candidates.id
    AND post.status IN ('scheduled', 'failed')
    AND post.media_urls::text ILIKE '%svg%'
    AND post.published_at IS NULL
    AND post.platform_post_id IS NULL
  RETURNING post.id
)
SELECT count(*) AS reset_count FROM reset;

-- Expected after reset: only the three historical published presence rows may
-- remain with SVG references. social_posts is a different table and was zero.
SELECT status, count(*) AS remaining_svg
FROM social_presence_posts
WHERE media_urls::text ILIKE '%svg%'
GROUP BY status
ORDER BY status;
SELECT count(*) AS social_posts_svg
FROM social_posts
WHERE media_urls::text ILIKE '%svg%';

COMMIT;