import { Queue, Worker, QueueEvents } from "bullmq";
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
  await queue.add(`campaign-${job.campaignId}-${job.action}`, job, {
    delay: opts?.delay,
    priority: opts?.priority,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
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
