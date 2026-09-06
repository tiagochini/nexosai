import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import type { Logger } from "pino";
import { CREDIT_COSTS, creditTransactionsTable, db, workspacesTable } from "@workspace/db";
import { deductCredits } from "../modules/credits/credits.service.js";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";

const marker = markerFromSuffix(`credit_concurrency_${process.pid}`);
const manifest = await seedE2eFixtures(marker);
const workspaceId = manifest.workspaces[0]!;
const action = "strategy_generation";
const cost = CREDIT_COSTS[action]!;
const initialBalance = cost * 4;
const logger = {
  info: () => undefined,
  warn: () => undefined,
} as unknown as Logger;

try {
  await db.update(workspacesTable)
    .set({ creditsBalance: initialBalance })
    .where(eq(workspacesTable.id, workspaceId));

  const firstKey = `${marker}:first`;
  const secondKey = `${marker}:second`;
  const [first, second] = await Promise.all([
    deductCredits(workspaceId, action, logger, undefined, undefined, undefined, undefined, firstKey),
    deductCredits(workspaceId, action, logger, undefined, undefined, undefined, undefined, secondKey),
  ]);

  const [afterConcurrentCharges] = await db.select({ creditsBalance: workspacesTable.creditsBalance })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId));
  assert.equal(afterConcurrentCharges!.creditsBalance, initialBalance - (cost * 2),
    "distinct simultaneous charge keys must both debit the balance");

  const duplicate = await deductCredits(
    workspaceId, action, logger, undefined, undefined, undefined, undefined, firstKey,
  );
  assert.equal(duplicate.id, first.id, "a duplicate key must return its original ledger entry");

  const [afterDuplicate] = await db.select({ creditsBalance: workspacesTable.creditsBalance })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId));
  assert.equal(afterDuplicate!.creditsBalance, initialBalance - (cost * 2),
    "a duplicate charge key must not debit again");

  const charges = await db.select()
    .from(creditTransactionsTable)
    .where(eq(creditTransactionsTable.workspaceId, workspaceId));
  assert.equal(charges.length, 2, "two distinct keys must create exactly two debit entries");
  assert.deepEqual(
    new Set(charges.map((charge) => charge.idempotencyKey)),
    new Set([firstKey, secondKey]),
  );
  assert.deepEqual(
    charges
      .map((charge) => [charge.balanceBefore, charge.balanceAfter])
      .sort((a, b) => b[0] - a[0]),
    [
      [initialBalance, initialBalance - cost],
      [initialBalance - cost, initialBalance - (cost * 2)],
    ],
    "ledger balances must form one serialized debit chain",
  );
} finally {
  await cleanupE2eFixtures(manifest);
}

console.log("credit concurrency regression test passed");