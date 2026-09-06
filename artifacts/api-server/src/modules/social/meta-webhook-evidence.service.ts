import { and, eq, lt, lte, or } from "drizzle-orm";
import { db, metaWebhookEventsTable, workspaceIntegrationsTable } from "@workspace/db";
import { isOrganicSocialIntegration } from "../integrations/integration-purpose.js";
import { metaGraphFetch } from "../../lib/meta-graph.transport.js";
import { logger } from "../../lib/logger.js";

const MAX_RETRIES = 3;
const META_RETRY_BASE_DELAY_MS = 10_000;
const secretKey = /token|secret|authorization|access_token/i;

export function redactMetaEvidence(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactMetaEvidence);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) =>
      [key, secretKey.test(key) ? "[REDACTED]" : redactMetaEvidence(entry)]));
  }
  return value;
}

function sanitizeMetaError(error: string): string {
  return error
    .replace(/((?:access_)?token|secret|authorization)\s*([=:])\s*["']?[^"'\s,&}]+/gi, "$1$2[REDACTED]")
    .replace(/bearer\s+[^,\s]+/gi, "Bearer [REDACTED]")
    .slice(0, 500);
}

export async function claimMetaWebhookEvent(input: {
  workspaceId?: string;
  integrationId?: string;
  accountId: string;
  providerEventId: string;
  eventType: "instagram_dm" | "instagram_comment" | "facebook_comment";
  actionKey?: string;
  ruleRef?: string;
}): Promise<{ claimed: boolean; id?: string }> {
  const rows = await db.insert(metaWebhookEventsTable).values({
    ...input,
    actionKey: input.actionKey ?? "initial_response",
    status: "claimed",
    claimedAt: new Date(),
  }).onConflictDoNothing().returning({ id: metaWebhookEventsTable.id });
  return rows[0] ? { claimed: true, id: rows[0].id } : { claimed: false };
}

export async function recordMetaSendStarted(id: string, endpoint: string, request: unknown): Promise<void> {
  await db.update(metaWebhookEventsTable).set({
    status: "sending", sendStartedAt: new Date(), outboundEndpoint: endpoint,
    outboundRequest: redactMetaEvidence(request) as Record<string, unknown>, updatedAt: new Date(),
  }).where(and(
    eq(metaWebhookEventsTable.id, id),
    or(
      eq(metaWebhookEventsTable.status, "claimed"),
      eq(metaWebhookEventsTable.status, "retry_claimed"),
    ),
  ));
}

export async function recordMetaSendResult(id: string, result: {
  providerResponse?: unknown; providerMessageId?: string; error?: string;
}): Promise<void> {
  const now = new Date();
  const event = await db.select({
    receivedAt: metaWebhookEventsTable.receivedAt,
    retryCount: metaWebhookEventsTable.retryCount,
  })
    .from(metaWebhookEventsTable).where(eq(metaWebhookEventsTable.id, id)).limit(1);
  const latencyMs = event[0] ? now.getTime() - event[0].receivedAt.getTime() : null;
  const failed = !!result.error;
  // retryCount is incremented atomically when a due event is claimed.  A failed
  // replay therefore keeps that count and only dead-letters after its final
  // Graph attempt, rather than before that attempt can be made.
  const dead = failed && (event[0]?.retryCount ?? 0) >= MAX_RETRIES;
  await db.update(metaWebhookEventsTable).set({
    status: failed ? (dead ? "dead_letter" : "failed") : "sent",
    sentAt: failed ? undefined : now,
    latencyMs,
    slaStatus: latencyMs === null ? null : latencyMs < 30_000 ? "under_30s" : "over_30s",
    providerResponse: redactMetaEvidence(result.providerResponse ?? {}) as Record<string, unknown>,
    providerMessageId: result.providerMessageId,
    error: result.error ? sanitizeMetaError(result.error) : undefined,
    deadLetterAt: dead ? now : null,
    nextRetryAt: failed && !dead
      ? new Date(now.getTime() + META_RETRY_BASE_DELAY_MS * 2 ** (event[0]?.retryCount ?? 0))
      : null,
    updatedAt: now,
  }).where(and(
    eq(metaWebhookEventsTable.id, id),
    // A retry without usable credentials does not start an HTTP request but is
    // still exclusively owned by this worker.
    or(
      eq(metaWebhookEventsTable.status, "sending"),
      eq(metaWebhookEventsTable.status, "retry_claimed"),
    ),
  ));
}

export async function listMetaEvidence(workspaceId: string, id?: string) {
  const where = id
    ? and(eq(metaWebhookEventsTable.workspaceId, workspaceId), eq(metaWebhookEventsTable.id, id))
    : eq(metaWebhookEventsTable.workspaceId, workspaceId);
  return db.select().from(metaWebhookEventsTable).where(where).orderBy(metaWebhookEventsTable.receivedAt);
}

/** Atomically claims due retries.  The status and retryCount CAS prevents two workers replaying one row. */
export async function claimDueMetaWebhookRetries(now = new Date()) {
  const due = await db.select().from(metaWebhookEventsTable).where(and(
    eq(metaWebhookEventsTable.status, "failed"),
    lte(metaWebhookEventsTable.nextRetryAt, now),
    lt(metaWebhookEventsTable.retryCount, MAX_RETRIES),
  )).limit(50);
  const claimed = [];
  for (const event of due) {
    const retryCount = event.retryCount + 1;
    const updated = await db.update(metaWebhookEventsTable).set({
      status: "retry_claimed",
      retryCount,
      nextRetryAt: null,
      updatedAt: now,
    }).where(and(
      eq(metaWebhookEventsTable.id, event.id),
      eq(metaWebhookEventsTable.status, "failed"),
      eq(metaWebhookEventsTable.retryCount, event.retryCount),
      lte(metaWebhookEventsTable.nextRetryAt, now),
    )).returning();
    if (updated[0]) claimed.push(updated[0]);
  }
  return claimed;
}

export async function replayDueMetaWebhookEvents(): Promise<void> {
  const events = await claimDueMetaWebhookRetries();
  let sent = 0;
  let failed = 0;
  for (const event of events) {
    try {
      if (!event.outboundEndpoint) throw new Error("Retry event has no outbound endpoint");
      const rows = await db.select().from(workspaceIntegrationsTable).where(and(
        eq(workspaceIntegrationsTable.accountId, event.accountId),
        eq(workspaceIntegrationsTable.status, "connected"),
      )).limit(1);
      const integration = rows.find((row) =>
        !!row.accessToken?.trim() && isOrganicSocialIntegration(row.metadata as Record<string, unknown> | null));
      if (!integration?.accessToken) {
        await recordMetaSendResult(event.id, { error: "Retry credential is disconnected, missing, or not organic social" });
        failed++;
        continue;
      }
      const payload = event.outboundRequest as Record<string, unknown>;
      await recordMetaSendStarted(event.id, event.outboundEndpoint, payload);
      const response = await metaGraphFetch(`https://graph.facebook.com/v22.0${event.outboundEndpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, access_token: integration.accessToken }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await response.json().catch(() => ({})) as { id?: string; error?: { message?: string } };
      if (!response.ok || data.error) throw new Error(data.error?.message ?? `Meta API ${response.status}`);
      await recordMetaSendResult(event.id, { providerResponse: data, providerMessageId: data.id });
      sent++;
    } catch (error) {
      failed++;
      try {
        await recordMetaSendResult(event.id, { error: error instanceof Error ? error.message : String(error) });
      } catch {
        // A persistence problem for one event must not prevent other accounts
        // from being replayed in this scheduler tick.
        logger.warn({ eventId: event.id, retryCount: event.retryCount }, "Meta webhook replay result could not be persisted");
      }
      // Do not log provider errors: they can echo credentials or request data.
      logger.warn({ eventId: event.id, retryCount: event.retryCount }, "Meta webhook replay failed; retry scheduled");
    }
  }
  if (events.length > 0) {
    logger.info({ claimed: events.length, sent, failed }, "Meta webhook retry scheduler tick completed");
  }
}