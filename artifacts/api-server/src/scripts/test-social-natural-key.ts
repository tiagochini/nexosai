import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";

// Deployment preflight: the tracked migration deliberately refuses to delete
// real duplicates. Keep this check cheap and safe to run before production.
const duplicatesResult = await db.execute(sql`
  SELECT workspace_id, content_piece_id, integration_id, count(*)::int AS row_count
  FROM social_posts
  WHERE content_piece_id IS NOT NULL
  GROUP BY workspace_id, content_piece_id, integration_id
  HAVING count(*) > 1
`);
const duplicates = Array.isArray(duplicatesResult) ? duplicatesResult : (duplicatesResult as { rows?: unknown[] }).rows ?? [];
assert.equal(duplicates.length, 0, "social post natural-key duplicates require explicit reconciliation");

const indexesResult = await db.execute(sql`
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE tablename = 'social_posts'
    AND indexname = 'social_posts_workspace_content_piece_integration_uidx'
`);
const indexes = Array.isArray(indexesResult) ? indexesResult : (indexesResult as { rows?: unknown[] }).rows ?? [];
assert.equal(indexes.length, 1, "M11 social post natural-key index is not installed");
assert.match(String(indexes[0]?.indexdef), /content_piece_id.*integration_id/i);
assert.match(String(indexes[0]?.indexdef), /content_piece_id.*IS NOT NULL/i);

console.log("social post natural-key preflight passed");
await pool.end();