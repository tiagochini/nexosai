import assert from "node:assert/strict";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalRedisUrl = process.env.REDIS_URL;
delete process.env.DATABASE_URL;
delete process.env.REDIS_URL;
const { buildOperationalHealth } = await import("../modules/operations/operational-health.js");
const {
  getSchedulerHealth,
  registerScheduler,
  resetSchedulerHealthForTests,
  runSchedulerTick,
} = await import("../modules/operations/scheduler-health.registry.js");

const backlogs = { "test-queue": { waiting: 2, active: 1, delayed: 0, failed: 0 } };

function health(overrides: Partial<Parameters<typeof buildOperationalHealth>[0]> = {}) {
  return buildOperationalHealth({
    dbOk: true,
    dbLatencyMs: 4,
    redisOk: true,
    redisLatencyMs: 3,
    backlogs,
    orchestrationWorkerRunning: true,
    schedulers: {},
    ...overrides,
  });
}

try {
  // Healthy dependencies expose only operational primitives, not probe details.
  const healthy = health();
  assert.equal(healthy.status, "ok");
  assert.equal(healthy.statusCode, 200);
  assert.deepEqual(healthy.services.queue.backlogs, backlogs);
  assert.equal(JSON.stringify(healthy).includes("redis://"), false);
  assert.equal(JSON.stringify(healthy).includes("token"), false);

  // Redis is useful but non-critical: direct execution means availability stays 200.
  const redisDown = health({ redisOk: false, redisLatencyMs: 2, backlogs: null });
  assert.equal(redisDown.status, "degraded");
  assert.equal(redisDown.statusCode, 200);
  assert.equal(redisDown.services.queue.ok, false);

  // The primary DB is critical for every request.
  const dbDown = health({ dbOk: false });
  assert.equal(dbDown.status, "degraded");
  assert.equal(dbDown.statusCode, 503);

  // A stale heartbeat is visible and degrades operational status without 503.
  resetSchedulerHealthForTests();
  registerScheduler("stale-test", 10);
  const staleSchedulers = getSchedulerHealth(Date.now() + 11);
  assert.equal(staleSchedulers["stale-test"]?.stale, true);
  assert.equal(health({ schedulers: staleSchedulers }).status, "degraded");

  // Local timer callbacks must not overlap.
  resetSchedulerHealthForTests();
  registerScheduler("overlap-test", 1_000);
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  const first = runSchedulerTick("overlap-test", async () => {
    calls += 1;
    await blocked;
  });
  assert.equal(await runSchedulerTick("overlap-test", async () => { calls += 1; }), false);
  assert.equal(getSchedulerHealth()["overlap-test"]?.inFlight, true);
  release();
  assert.equal(await first, true);
  assert.equal(calls, 1);
  assert.equal(getSchedulerHealth()["overlap-test"]?.inFlight, false);

  console.log("operational health tests passed");
} finally {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalRedisUrl === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = originalRedisUrl;
}
