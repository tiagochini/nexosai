import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { env } from "../lib/env.js";

const router: IRouter = Router();

const startedAt = new Date().toISOString();

router.get("/healthz", async (_req, res): Promise<void> => {
  let dbOk = false;
  let dbLatencyMs = 0;

  try {
    const t0 = Date.now();
    await db.execute(sql`SELECT 1`);
    dbLatencyMs = Date.now() - t0;
    dbOk = true;
  } catch (err) {
    logger.warn({ err }, "Health check: DB ping failed");
  }

  const status = dbOk ? "ok" : "degraded";
  const statusCode = dbOk ? 200 : 503;

  res.status(statusCode).json({
    status,
    version: process.env["npm_package_version"] ?? "1.0.0",
    env: env.NODE_ENV,
    startedAt,
    uptime: Math.floor(process.uptime()),
    services: {
      database: { ok: dbOk, latencyMs: dbLatencyMs },
      redis: { ok: false, note: "status checked via queue health" },
    },
  });
});

export default router;
