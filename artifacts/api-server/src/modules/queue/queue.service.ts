import { Queue, Worker, QueueEvents } from "bullmq";
import Redis from "ioredis";
import { env } from "../../lib/env.js";
import { logger } from "../../lib/logger.js";

const connection = {
  url: env.REDIS_URL,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy: (times: number) => {
    if (times > 3) return null;
    return Math.min(times * 1000, 5000);
  },
};

// Cache result for 10s to avoid hammering Redis on every enqueue
let _redisAvailableCache: { ok: boolean; at: number } | null = null;

export async function isRedisAvailable(): Promise<boolean> {
  const now = Date.now();
  if (_redisAvailableCache && now - _redisAvailableCache.at < 10_000) {
    return _redisAvailableCache.ok;
  }
  if (!env.REDIS_URL) {
    _redisAvailableCache = { ok: false, at: now };
    return false;
  }
  try {
    const probe = new Redis(env.REDIS_URL, {
      connectTimeout: 2000,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: false,
    });
    const reply = await Promise.race([
      probe.ping(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 2000)),
    ]);
    await probe.quit().catch(() => undefined);
    // Treat unexpected PING responses (e.g. Upstash rate-limit message) as unavailable
    if (typeof reply === "string" && reply !== "PONG") {
      logger.warn({ reply }, "Redis PING returned non-PONG — treating as unavailable");
      _redisAvailableCache = { ok: false, at: now };
      return false;
    }
    _redisAvailableCache = { ok: true, at: now };
    return true;
  } catch (err) {
    // Detect Upstash / Redis rate-limit errors — treat as unavailable so jobs
    // fall back to direct in-process execution instead of queuing.
    const msg = (err instanceof Error ? err.message : String(err)) ?? "";
    if (msg.includes("max requests limit") || msg.includes("WRONGPASS") || msg.includes("NOAUTH")) {
      logger.warn({ msg }, "Redis unavailable due to auth/rate-limit error");
    }
    _redisAvailableCache = { ok: false, at: now };
    return false;
  }
}

export const QUEUE_NAMES = {
  CAMPAIGN_ORCHESTRATION: "campaign-orchestration",
  AGENT_EXECUTION: "agent-execution",
  CONTENT_GENERATION: "content-generation",
  EXECUTION_ENGINE: "execution-engine",
  NURTURING: "nurturing",
  ANALYTICS: "analytics",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

const queues = new Map<string, Queue>();

export function getQueue(name: QueueName): Queue {
  if (!queues.has(name)) {
    const queue = new Queue(name, { connection });
    queues.set(name, queue);
    logger.info({ queue: name }, "Queue initialized");
  }
  return queues.get(name)!;
}

export interface CampaignOrchestrationJob {
  campaignId: string;
  workspaceId: string;
  action:
    | "start_intake"
    | "run_strategy"
    | "generate_content"
    | "request_approval"
    | "execute"
    | "monitor"
    | "complete";
}

export interface AgentExecutionJob {
  campaignId: string;
  workspaceId: string;
  agentType: string;
  input: Record<string, unknown>;
}

export async function enqueueCampaignOrchestration(
  job: CampaignOrchestrationJob,
  opts?: { delay?: number; priority?: number },
): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.CAMPAIGN_ORCHESTRATION);
  // attempts: 1 for generate_content — each agent call charges AI credits.
  // Silent retries would double/triple-charge the user on LLM errors.
  // All other actions (run_strategy, execute, monitor) also use attempts:1 to
  // avoid surprise credit charges. User retries explicitly via UI.
  await queue.add(`campaign-${job.campaignId}-${job.action}`, job, {
    delay: opts?.delay,
    priority: opts?.priority,
    attempts: 1,
  });
}

export async function enqueueAgentExecution(
  job: AgentExecutionJob,
): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.AGENT_EXECUTION);
  await queue.add(
    `agent-${job.campaignId}-${job.agentType}`,
    job,
    {
      attempts: 2,
      backoff: { type: "exponential", delay: 3000 },
    },
  );
}

export async function closeAllQueues(): Promise<void> {
  await Promise.all(
    Array.from(queues.values()).map((q) => q.close()),
  );
  queues.clear();
}

// ── Boot: drain orphaned jobs from a queue ────────────────────────────────────
// Called once at startup BEFORE the worker initializes, ensuring the BullMQ
// queue is in sync with the DB cleanup (which resets campaign statuses).
// Any "active", "waiting", or "delayed" jobs at boot time are orphaned — their
// worker process was killed by the server restart. Removing them prevents the
// dedup check from blocking new user-triggered executions.
export async function drainQueueAtBoot(name: QueueName): Promise<void> {
  if (!connection.url) return; // Redis not configured — nothing to drain
  try {
    const queue = getQueue(name);
    // clean(grace=0, limit=1000, type) removes all jobs of that type instantly
    const [active, waiting, delayed, failed] = await Promise.all([
      queue.clean(0, 1000, "active"),
      queue.clean(0, 1000, "wait"),
      queue.clean(0, 1000, "delayed"),
      queue.clean(0, 1000, "failed"),
    ]);
    const total = active.length + waiting.length + delayed.length + failed.length;
    if (total > 0) {
      logger.warn(
        { queue: name, active: active.length, waiting: waiting.length, delayed: delayed.length, failed: failed.length },
        "Boot cleanup: drained orphaned BullMQ jobs — queue is now clean",
      );
    }
  } catch (err) {
    // Non-fatal — if Redis is unavailable, jobs will be handled by direct-execution fallback
    logger.warn({ err, queue: name }, "Boot cleanup: could not drain queue (Redis may be unavailable)");
  }
}
