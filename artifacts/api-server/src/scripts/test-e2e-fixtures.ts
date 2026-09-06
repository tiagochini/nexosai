import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { cleanupE2eFixtures, e2eFixturePassword, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";

assert.equal(markerFromSuffix("run_123"), "E2E_run_123");
assert.equal(e2eFixturePassword(markerFromSuffix("run_123")), "E2E-E2E_run_123-Only!");
assert.throws(() => markerFromSuffix("../not-safe"), /suffix/);
assert.throws(() => e2eFixturePassword("not-e2e"), /marker/);
// The guard is evaluated before any database work, so this proves a malformed
// cleanup invocation cannot turn into a broad delete.
await assert.rejects(
  () => cleanupE2eFixtures({ marker: "not-e2e", users: [], workspaces: [], integrations: [] }),
  /Refusing cleanup/,
);
const marker = markerFromSuffix(`rollback_${process.pid}`);
await assert.rejects(() => seedE2eFixtures(marker, { failAfterInsert: true }), /rollback probe/);
const safe = marker.toLowerCase().replace(/[^a-z0-9]/g, "");
const orphan = await db.select({ id: usersTable.id }).from(usersTable)
  .where(eq(usersTable.email, `${safe}.owner@e2e.invalid`));
assert.equal(orphan.length, 0, "failed seed must roll back all fixture users");
console.log("e2e fixture guard self-test passed");