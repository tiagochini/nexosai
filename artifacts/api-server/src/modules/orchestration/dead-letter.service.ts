import { and, desc, eq, inArray } from "drizzle-orm";
import { campaignsTable, db, orchestrationDeadLettersTable } from "@workspace/db";
import { getQueue, QUEUE_NAMES, type CampaignOrchestrationJob } from "../queue/queue.service.js";

type Classification = "retryable" | "terminal" | "manual";
export interface DeadLetterQueue {
  add(name: string, data: CampaignOrchestrationJob, options: {
    jobId: string;
    attempts: number;
    removeOnComplete: { age: number };
    removeOnFail: { age: number };
  }): Promise<unknown>;
}

const SECRET_PATTERN = /\b(?:authorization|bearer|api[_-]?key|token|secret|password|cookie|session)\b\s*[:=]?\s*(?:bearer\s+)?[^\s,;]+/gi;

/** Error text is useful to an operator, but credentials and request bodies are not. */
export function sanitizeOperationalError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "Unknown failure");
  return raw
    // SDKs frequently append a JSON request/response body to their Error
    // message. Keeping the fact it failed is enough for operations; retaining
    // that body risks persisting prompts, customer data or credentials.
    .replace(/[\[{][\s\S]{0,4000}[\]}]/g, "[redacted-payload]")
    .replace(SECRET_PATTERN, "[redacted]")
    .replace(/https?:\/\/[^\s?]+[?][^\s]+/gi, "[redacted-url]")
    .replace(/\s+/g, " ")
    .slice(0, 500) || "Unknown failure";
}

function classify(error: unknown): Classification {
  const message = sanitizeOperationalError(error).toLowerCase();
  if (message.includes("stalled") || message.includes("timeout") || message.includes("econn") || message.includes("rate limit")) return "retryable";
  if (message.includes("validation") || message.includes("not found") || message.includes("forbidden")) return "manual";
  return "terminal";
}

export async function captureTerminalOrchestrationFailure(
  job: CampaignOrchestrationJob,
  meta: { jobId?: string | null; attemptsMade?: number; error: unknown; source?: string },
): Promise<void> {
  const now = new Date();
  const jobId = String(meta.jobId ?? `${job.campaignId}-${job.action}`);
  const summary = sanitizeOperationalError(meta.error);
  if (job.deadLetterId) {
    // A replay changes the original evidence's replay outcome; it never deletes
    // or overwrites its original failure fields.
    await db.update(orchestrationDeadLettersTable).set({
      replayStatus: "failed",
      replayFinishedAt: now,
      replayErrorSummary: summary,
    }).where(eq(orchestrationDeadLettersTable.id, job.deadLetterId));
    return;
  }
  await db.insert(orchestrationDeadLettersTable).values({
    workspaceId: job.workspaceId,
    campaignId: job.campaignId,
    action: job.action,
    jobId,
    correlationId: jobId,
    attemptCount: Math.max(1, meta.attemptsMade ?? 1),
    classification: classify(meta.error),
    errorSummary: summary,
    source: meta.source ?? "worker",
    firstFailedAt: now,
    lastFailedAt: now,
  });
}

export async function markDeadLetterReplayCompleted(job: CampaignOrchestrationJob): Promise<void> {
  if (!job.deadLetterId) return;
  await db.update(orchestrationDeadLettersTable).set({
    replayStatus: "succeeded",
    replayFinishedAt: new Date(),
    replayErrorSummary: null,
  }).where(eq(orchestrationDeadLettersTable.id, job.deadLetterId));
}

export async function listDeadLetters(limit = 100) {
  return db.select().from(orchestrationDeadLettersTable)
    .orderBy(desc(orchestrationDeadLettersTable.lastFailedAt))
    .limit(Math.min(Math.max(limit, 1), 200));
}

export async function getDeadLetter(id: string) {
  const [record] = await db.select().from(orchestrationDeadLettersTable)
    .where(eq(orchestrationDeadLettersTable.id, id)).limit(1);
  return record;
}

const replayStatusClaimable = ["none", "failed"] as const;

/**
 * The conditional update is the cross-instance replay claim.  The fixed replay
 * ID makes queue delivery idempotent even after an HTTP response is lost.
 */
export async function replayDeadLetter(
  id: string,
  adminEmail: string,
  queue: DeadLetterQueue = getQueue(QUEUE_NAMES.CAMPAIGN_ORCHESTRATION),
): Promise<{ accepted: boolean; replayJobId?: string }> {
  const replayJobId = `dlq-${id}`;
  const claim = await db.update(orchestrationDeadLettersTable).set({
    replayStatus: "claimed",
    replayJobId,
    replayedBy: adminEmail,
    replayedAt: new Date(),
    replayFinishedAt: null,
    replayErrorSummary: null,
  }).where(and(
    eq(orchestrationDeadLettersTable.id, id),
    inArray(orchestrationDeadLettersTable.replayStatus, replayStatusClaimable),
  )).returning({
    campaignId: orchestrationDeadLettersTable.campaignId,
    workspaceId: orchestrationDeadLettersTable.workspaceId,
    action: orchestrationDeadLettersTable.action,
  });
  const record = claim[0];
  if (!record) return { accepted: false };

  const job: CampaignOrchestrationJob = {
    campaignId: record.campaignId,
    workspaceId: record.workspaceId,
    action: record.action as CampaignOrchestrationJob["action"],
    deadLetterId: id,
  };
  try {
    // Strategy failures intentionally leave campaigns in `analyzing` for the
    // customer retry UI. A DLQ replay is an explicit admin recovery action, so
    // return only that phase to its legal entry state before delivery. Other
    // actions already either reset themselves or accept their in-progress state.
    if (job.action === "run_strategy") {
      await db.update(campaignsTable).set({ status: "intake", updatedAt: new Date() })
        .where(and(
          eq(campaignsTable.id, job.campaignId),
          eq(campaignsTable.workspaceId, job.workspaceId),
          eq(campaignsTable.status, "analyzing"),
        ));
    }
    await queue.add(`dead-letter-replay-${id}`, job, {
      jobId: replayJobId,
      attempts: 1,
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400 },
    });
    await db.update(orchestrationDeadLettersTable).set({ replayStatus: "queued" })
      .where(and(eq(orchestrationDeadLettersTable.id, id), eq(orchestrationDeadLettersTable.replayStatus, "claimed")));
    return { accepted: true, replayJobId };
  } catch (error) {
    await db.update(orchestrationDeadLettersTable).set({
      replayStatus: "failed",
      replayFinishedAt: new Date(),
      replayErrorSummary: sanitizeOperationalError(error),
    }).where(eq(orchestrationDeadLettersTable.id, id));
    throw error;
  }
}