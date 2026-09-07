import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db, radarSubscriptionsTable } from "@workspace/db";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";
import { RADAR_CATALOG, RadarEntitlementError, activateRadarEntitlement, getRadarEntitlement, radarScheduledMode, reserveRadarUsage } from "../modules/market-intel/radar-entitlements.service.js";

assert.equal(process.env.RADAR_ENTITLEMENT_DB_TESTS, "true", "Set RADAR_ENTITLEMENT_DB_TESTS=true only for a disposable migrated DB.");
assert.equal(process.env.NODE_ENV, "test", "Radar entitlement DB tests require NODE_ENV=test.");
assert.equal(RADAR_CATALOG.RADAR_ESSENTIAL.prices.BRL, 49700);
assert.equal(RADAR_CATALOG.WAR_ROOM.limits.scanCadenceMinutes, 15);
assert.equal(radarScheduledMode(RADAR_CATALOG.RADAR_ESSENTIAL.limits), "lightweight");
assert.equal(radarScheduledMode(RADAR_CATALOG.RADAR_PRO.limits), "detailed");

const fixtures = await seedE2eFixtures(markerFromSuffix(`radar-${process.pid}`));
const [workspaceId, foreignWorkspaceId] = fixtures.workspaces;
try {
  const active = await activateRadarEntitlement(workspaceId!, "RADAR_ESSENTIAL", "BRL");
  const first = await reserveRadarUsage({ workspaceId: workspaceId!, dimension: "council_run", idempotencyKey: "same-key" });
  const duplicate = await reserveRadarUsage({ workspaceId: workspaceId!, dimension: "council_run", idempotencyKey: "same-key" });
  assert.equal(first.ledger.id, duplicate.ledger.id, "idempotency returns the original reservation");
  await activateRadarEntitlement(foreignWorkspaceId!, "RADAR_ESSENTIAL", "BRL");
  const foreign = await reserveRadarUsage({ workspaceId: foreignWorkspaceId!, dimension: "council_run", idempotencyKey: "same-key" });
  assert.notEqual(first.ledger.id, foreign.ledger.id, "same idempotency key is isolated per tenant");
  await Promise.all(Array.from({ length: 19 }, (_, i) => reserveRadarUsage({ workspaceId: workspaceId!, dimension: "council_run", idempotencyKey: `quota-${i}` })));
  await assert.rejects(() => reserveRadarUsage({ workspaceId: workspaceId!, dimension: "council_run", idempotencyKey: "over-quota" }), (error: unknown) => error instanceof RadarEntitlementError && error.statusCode === 429);
  await db.update(radarSubscriptionsTable).set({ periodEndsAt: new Date(Date.now() - 1) }).where(eq(radarSubscriptionsTable.id, active.id));
  assert.equal((await getRadarEntitlement(workspaceId!)).active, false, "expired entitlement is inactive");
  await assert.rejects(() => reserveRadarUsage({ workspaceId: workspaceId!, dimension: "light_scan", idempotencyKey: "expired" }), (error: unknown) => error instanceof RadarEntitlementError && error.statusCode === 402);
  const war = await activateRadarEntitlement(workspaceId!, "WAR_ROOM", "BRL");
  await db.update(radarSubscriptionsTable).set({ windowEndsAt: new Date(Date.now() - 1) }).where(eq(radarSubscriptionsTable.id, war.id));
  await assert.rejects(() => reserveRadarUsage({ workspaceId: workspaceId!, dimension: "council_run", idempotencyKey: "window-expired" }), (error: unknown) => error instanceof RadarEntitlementError && error.statusCode === 402);
  console.log("radar catalog, tenant isolation, idempotency, quota, expiry and War Room tests passed");
} finally {
  await cleanupE2eFixtures(fixtures);
}