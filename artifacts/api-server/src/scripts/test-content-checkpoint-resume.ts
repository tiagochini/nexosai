import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import type { Logger } from "pino";
import {
  campaignsTable,
  contentPiecesTable,
  creditTransactionsTable,
  db,
  pool,
  workspacesTable,
} from "@workspace/db";
import { deductCredits } from "../modules/credits/credits.service.js";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";

/**
 * DB-backed checkpoint regression.  The deterministic workers below model the
 * content service's durable boundary: persist one canonical piece, then charge
 * with that campaign+agent's stable key.  A test-only interruption is thrown
 * only after the insert has committed.  This deliberately has no LLM/provider
 * dependency.
 */
const marker = markerFromSuffix(`content_checkpoint_${process.pid}`);
const manifest = await seedE2eFixtures(marker);
const workspaceId = manifest.workspaces[0]!;
// Fixtures intentionally inherit whatever balance their plan provides. This
// regression charges real ledger rows, so provision an explicit safe balance
// using the canonical workspace field rather than relying on plan defaults.
await db.update(workspacesTable)
  .set({ creditsBalance: 10_000 })
  .where(eq(workspacesTable.id, workspaceId));
const log = { info: () => undefined, warn: () => undefined } as unknown as Logger;
const steps = [
  { type: "creative_direction", agent: "creative_director" },
  { type: "email_sequence", agent: "copywriter" },
  { type: "content_calendar", agent: "social_media" },
] as const;

let campaignId: string | undefined;

async function resume(failAfter?: number): Promise<string[]> {
  assert.ok(campaignId);
  const client = await pool.connect();
  try {
    const lock = await client.query(
      "SELECT pg_try_advisory_lock(hashtext($1)) AS acquired",
      [campaignId],
    );
    if (lock.rows[0]?.acquired !== true) return [];

    const completed: string[] = [];
    for (const [index, step] of steps.entries()) {
      const [existing] = await db.select({ id: contentPiecesTable.id })
        .from(contentPiecesTable)
        .where(and(eq(contentPiecesTable.campaignId, campaignId), eq(contentPiecesTable.type, step.type)))
        .limit(1);
      if (existing) continue;

      const [piece] = await db.insert(contentPiecesTable).values({
        campaignId,
        workspaceId,
        type: step.type,
        status: "pending_approval",
        title: `${marker} ${step.agent}`,
        content: { deterministic: true, step: index, marker },
        creditsUsed: 0,
      }).returning({ id: contentPiecesTable.id });
      assert.ok(piece, "content checkpoint must persist before the failpoint");
      completed.push(step.agent);

      // Same stable per-step key used by runAgent's campaign pipeline path.
      await deductCredits(workspaceId, "strategy_generation", log, campaignId,
        "test", undefined, undefined, `${campaignId}:${step.agent}`);

      if (failAfter === completed.length) {
        throw new Error("[TEST_ONLY_CONTENT_CHECKPOINT_INTERRUPT] persisted checkpoint");
      }
    }
    await db.update(campaignsTable).set({ status: "awaiting_approval" })
      .where(eq(campaignsTable.id, campaignId));
    return completed;
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", [campaignId]).catch(() => undefined);
    client.release();
  }
}

try {
  const [campaign] = await db.insert(campaignsTable).values({
    workspaceId,
    title: `${marker} checkpoint campaign`,
    type: "audience_growth",
    status: "generating",
    intakeData: { fixture: marker },
  }).returning({ id: campaignsTable.id });
  campaignId = campaign!.id;

  await assert.rejects(() => resume(1), /TEST_ONLY_CONTENT_CHECKPOINT_INTERRUPT/);
  const [checkpoint] = await db.select().from(contentPiecesTable)
    .where(and(eq(contentPiecesTable.campaignId, campaignId), eq(contentPiecesTable.type, "creative_direction")));
  assert.ok(checkpoint);
  const checkpointId = checkpoint.id;
  const checkpointContent = checkpoint.content;

  const [firstResume, concurrentResume] = await Promise.all([resume(), resume()]);
  assert.deepEqual(new Set([...firstResume, ...concurrentResume]), new Set(["copywriter", "social_media"]),
    "only missing agents may execute after the checkpoint; concurrent resume must converge");

  const pieces = await db.select().from(contentPiecesTable)
    .where(eq(contentPiecesTable.campaignId, campaignId));
  assert.equal(pieces.length, steps.length, "each canonical content step has exactly one persisted piece");
  const persistedCheckpoint = pieces.find((piece) => piece.type === "creative_direction")!;
  assert.equal(persistedCheckpoint.id, checkpointId, "resume must never overwrite a completed piece");
  assert.deepEqual(persistedCheckpoint.content, checkpointContent, "completed content must remain unchanged");

  const charges = await db.select({ idempotencyKey: creditTransactionsTable.idempotencyKey })
    .from(creditTransactionsTable)
    .where(eq(creditTransactionsTable.campaignId, campaignId));
  assert.equal(charges.length, steps.length, "each persisted content step is charged exactly once");
  assert.deepEqual(new Set(charges.map((row) => row.idempotencyKey)),
    new Set(steps.map((step) => `${campaignId}:${step.agent}`)));

  const [finalCampaign] = await db.select({ status: campaignsTable.status }).from(campaignsTable)
    .where(eq(campaignsTable.id, campaignId));
  assert.equal(finalCampaign!.status, "awaiting_approval", "successful resume reaches final content state");
} finally {
  if (campaignId) {
    await db.delete(campaignsTable).where(eq(campaignsTable.id, campaignId));
  }
  await cleanupE2eFixtures(manifest);
}

console.log("content checkpoint/resume regression passed");