import { Router, type IRouter } from "express";
import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { env } from "../lib/env.js";
import { getQueue, isRedisAvailable, QUEUE_NAMES } from "../modules/queue/queue.service.js";
import { getSchedulerHealth } from "../modules/operations/scheduler-health.registry.js";
import { isOrchestrationWorkerRunning } from "../modules/orchestration/orchestration.worker.js";

const router: IRouter = Router();

const startedAt = new Date().toISOString();
const PROBE_TIMEOUT_MS = 2_000;

function within<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([operation, new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('probe timeout')), PROBE_TIMEOUT_MS);
  })]).finally(() => clearTimeout(timer));
}

type Backlog = { waiting: number; active: number; delayed: number; failed: number };
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

async function queueBacklogs(): Promise<Record<string, Backlog> | null> {
  try {
    const entries = await within(Promise.all(Object.values(QUEUE_NAMES).map(async (name) => {
      const counts = await getQueue(name).getJobCounts("waiting", "active", "delayed", "failed");
      return [name, {
        waiting: counts["waiting"] ?? 0,
        active: counts["active"] ?? 0,
        delayed: counts["delayed"] ?? 0,
        failed: counts["failed"] ?? 0,
      }] as const;
    })));
    return Object.fromEntries(entries);
  } catch {
    return null;
  }
}

export async function collectOperationalHealth() {
  let dbOk = false;
  let dbLatencyMs = 0;

  try {
    const t0 = Date.now();
    await within(db.execute(sql`SELECT 1`));
    dbLatencyMs = Date.now() - t0;
    dbOk = true;
  } catch (err) {
    logger.warn({ err }, "Health check: DB ping failed");
  }

  const redisStarted = Date.now();
  let redisOk = false;
  try {
    redisOk = await within(isRedisAvailable({ fresh: true }));
  } catch {
    // Redis has a direct-execution fallback; report it below without error detail.
  }
  const redisLatencyMs = Date.now() - redisStarted;
  const backlogs = redisOk ? await queueBacklogs() : null;
  const health = buildOperationalHealth({
    dbOk,
    dbLatencyMs,
    redisOk,
    redisLatencyMs,
    backlogs,
    orchestrationWorkerRunning: isOrchestrationWorkerRunning(),
    schedulers: getSchedulerHealth(),
  });

  /*
   * HTTP 503 is reserved for dependencies that make every API request unsafe:
   * currently the primary database. Redis/queue and timer schedulers have
   * intentional direct-execution or retry fallbacks, so their impairment is
   * visible as `degraded` but remains HTTP 200 for load-balancer availability.
   * The response contains only counts and lifecycle timestamps, never URLs,
   * errors, credentials, job payloads, or provider data.
   */
  return {
    status: health.status,
    statusCode: health.statusCode,
    version: process.env["npm_package_version"] ?? "1.0.0",
    env: env.NODE_ENV,
    startedAt,
    uptime: Math.floor(process.uptime()),
    services: { ...health.services, database: { ...health.services.database,
      pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount, max: pool.options.max } } },
    schedulers: health.schedulers,
  };
}

router.get("/livez", (_req, res): void => {
  res.status(200).json({
    status: "alive",
    startedAt,
    uptime: Math.floor(process.uptime()),
  });
});

router.get("/readyz", async (_req, res): Promise<void> => {
  const health = await collectOperationalHealth();
  // Redis backs security quotas; optional job fallbacks do not make protected
  // requests ready when that dependency is unavailable.
  const ready = health.statusCode < 500 && health.services.redis.ok;
  res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not_ready" });
});

router.get("/healthz", async (_req, res): Promise<void> => {
  const health = await collectOperationalHealth();
  const { statusCode, ...body } = health;
  res.status(statusCode).json(body);
});

export default router;
