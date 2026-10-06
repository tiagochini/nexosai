import type { getSchedulerHealth } from "./scheduler-health.registry.js";

export type Backlog = { waiting: number; active: number; delayed: number; failed: number };
export type OperationalHealthInput = {
  dbOk: boolean;
  dbLatencyMs: number;
  redisOk: boolean;
  redisLatencyMs: number;
  backlogs: Record<string, Backlog> | null;
  orchestrationWorkerRunning: boolean;
  schedulers: ReturnType<typeof getSchedulerHealth>;
};

/**
 * Pure response builder used by the route and focused tests. It intentionally
 * accepts only booleans, timing, counts, and scheduler lifecycle values, making
 * it impossible for probe errors, connection URLs, credentials, or job data to
 * enter the operational response.
 */
export function buildOperationalHealth(input: OperationalHealthInput): {
  status: "ok" | "degraded";
  statusCode: number;
  services: {
    database: { ok: boolean; latencyMs: number };
    redis: { ok: boolean; latencyMs: number };
    queue: { ok: boolean; backlogs: Record<string, Backlog> | null; workers: { orchestration: boolean } };
  };
  schedulers: ReturnType<typeof getSchedulerHealth>;
} {
  const staleScheduler = Object.values(input.schedulers).some((scheduler) => scheduler.stale);
  const queueHealthy = input.redisOk && input.backlogs !== null;
  return {
    status: input.dbOk && queueHealthy && !staleScheduler ? "ok" : "degraded",
    // Only DB is critical. Redis and schedulers have direct/retry fallbacks.
    statusCode: input.dbOk ? 200 : 503,
    services: {
      database: { ok: input.dbOk, latencyMs: input.dbLatencyMs },
      redis: { ok: input.redisOk, latencyMs: input.redisLatencyMs },
      queue: {
        ok: queueHealthy,
        backlogs: input.backlogs,
        workers: { orchestration: input.orchestrationWorkerRunning },
      },
    },
    schedulers: input.schedulers,
  };
}

