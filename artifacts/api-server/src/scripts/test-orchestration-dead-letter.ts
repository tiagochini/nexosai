import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import {
  campaignsTable,
  db,
  orchestrationDeadLettersTable,
  plansTable,
  usersTable,
  workspacesTable,
} from "@workspace/db";
import { isAdminEmail } from "../modules/admin/admin-access.js";
import {
  captureTerminalOrchestrationFailure,
  getDeadLetter,
  listDeadLetters,
  replayDeadLetter,
  type DeadLetterQueue,
} from "../modules/orchestration/dead-letter.service.js";

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `dlq-test-${suffix}@example.invalid`;
let userId = "";
let workspaceId = "";
let campaignId = "";

const queued: Array<{ name: string; jobId: string; deadLetterId?: string }> = [];
const queue: DeadLetterQueue = {
  async add(name, data, options) {
    queued.push({ name, jobId: options.jobId, deadLetterId: data.deadLetterId });
    return { id: options.jobId };
  },
};

try {
  const [plan] = await db.select({ id: plansTable.id }).from(plansTable).limit(1);
  assert.ok(plan, "a seeded plan is required for the isolated workspace fixture");
  [{ id: userId }] = await db.insert(usersTable).values({
    email,
    passwordHash: "test-only-not-a-real-password",
    name: "DLQ Test",
  }).returning({ id: usersTable.id });
  [{ id: workspaceId }] = await db.insert(workspacesTable).values({
    ownerId: userId,
    planId: plan.id,
    name: `DLQ Test ${suffix}`,
    slug: `dlq-test-${suffix}`,
  }).returning({ id: workspacesTable.id });
  [{ id: campaignId }] = await db.insert(campaignsTable).values({
    workspaceId,
    title: "Dead letter regression fixture",
    status: "analyzing",
  }).returning({ id: campaignsTable.id });

  // This is the same persistence boundary reached by both terminal worker
  // failures and the no-Redis direct fallback.  The error deliberately carries
  // credentials and a request body to prove neither reaches the database.
  await captureTerminalOrchestrationFailure(
    { campaignId, workspaceId, action: "run_strategy" },
    {
      jobId: `${campaignId}-run_strategy`,
      attemptsMade: 1,
      source: "direct_fallback",
      error: new Error('timeout Authorization: Bearer super-secret-token {"prompt":"customer payload","api_key":"also-secret"}'),
    },
  );
  const records = await db.select().from(orchestrationDeadLettersTable)
    .where(eq(orchestrationDeadLettersTable.campaignId, campaignId));
  assert.equal(records.length, 1, "a terminal direct/worker failure must create exactly one DLQ record");
  const original = records[0]!;
  assert.equal(original.classification, "retryable");
  assert.equal(original.jobId, `${campaignId}-run_strategy`);
  assert.ok(!original.errorSummary.includes("super-secret-token"));
  assert.ok(!original.errorSummary.includes("customer payload"));
  assert.ok(!original.errorSummary.includes("also-secret"));

  // Route handlers use this shared gate before any DLQ read/mutation. A user in
  // another workspace is not an administrator and therefore cannot enumerate,
  // view, or replay this cross-tenant operational evidence.
  assert.equal(isAdminEmail("foreign-workspace-user@example.invalid"), false);
  assert.equal(isAdminEmail("admin@nexos.ai"), true);
  assert.ok((await listDeadLetters()).some((record) => record.id === original.id), "admin list sees record");
  assert.equal((await getDeadLetter(original.id))?.id, original.id, "admin detail sees record");

  const [first, second] = await Promise.all([
    replayDeadLetter(original.id, "admin@nexos.ai", queue),
    replayDeadLetter(original.id, "admin@nexos.ai", queue),
  ]);
  assert.equal([first, second].filter((result) => result.accepted).length, 1, "concurrent replays claim once");
  assert.equal(queued.length, 1, "only the winning replay enqueues once");
  assert.equal(queued[0]!.jobId, `dlq-${original.id}`, "replay queue id is deterministic");
  assert.equal(queued[0]!.deadLetterId, original.id);

  // A replay failure is an outcome on the original immutable evidence, not a
  // destructive replacement of its original error/job/correlation fields.
  await captureTerminalOrchestrationFailure(
    { campaignId, workspaceId, action: "run_strategy", deadLetterId: original.id },
    { jobId: `dlq-${original.id}`, attemptsMade: 1, error: new Error("replay failed token=another-secret") },
  );
  const afterReplayFailure = await getDeadLetter(original.id);
  assert.equal(afterReplayFailure?.replayStatus, "failed");
  assert.ok(!afterReplayFailure?.replayErrorSummary?.includes("another-secret"));
  assert.equal(afterReplayFailure?.errorSummary, original.errorSummary, "original failure evidence is preserved");
  assert.equal(afterReplayFailure?.correlationId, original.correlationId);

  console.log("orchestration dead-letter regression passed");
} finally {
  // Cascades clean the campaign record, but delete explicitly so this test is
  // safe even if future FK policies become more restrictive.
  if (campaignId) await db.delete(orchestrationDeadLettersTable).where(eq(orchestrationDeadLettersTable.campaignId, campaignId));
  if (workspaceId) await db.delete(workspacesTable).where(eq(workspacesTable.id, workspaceId));
  if (userId) await db.delete(usersTable).where(eq(usersTable.id, userId));
}