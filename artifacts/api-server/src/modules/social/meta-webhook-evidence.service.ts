import { and, eq, lte, or } from "drizzle-orm";
import { db, metaWebhookEventsTable, workspaceIntegrationsTable } from "@workspace/db";
import { isOrganicSocialIntegration } from "../integrations/integration-purpose.js";

const MAX_RETRIES = 3;
const secretKey = /token|secret|authorization|access_token/i;

export function redactMetaEvidence(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactMetaEvidence);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) =>
      [key, secretKey.test(key) ? "[REDACTED]" : redactMetaEvidence(entry)]));
  }
  return value;
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
  }).where(eq(metaWebhookEventsTable.id, id));
}

export async function recordMetaSendResult(id: string, result: {
  providerResponse?: unknown; providerMessageId?: string; error?: string;
}): Promise<void> {
  const now = new Date();
  const event = await db.select({ receivedAt: metaWebhookEventsTable.receivedAt })
    .from(metaWebhookEventsTable).where(eq(metaWebhookEventsTable.id, id)).limit(1);
  const latencyMs = event[0] ? now.getTime() - event[0].receivedAt.getTime() : null;
  const failed = !!result.error;
  await db.update(metaWebhookEventsTable).set({
    status: failed ? "failed" : "sent",
    sentAt: failed ? undefined : now,
    latencyMs,
    slaStatus: latencyMs === null ? null : latencyMs < 30_000 ? "under_30s" : "over_30s",
    providerResponse: redactMetaEvidence(result.providerResponse ?? {}) as Record<string, unknown>,
    providerMessageId: result.providerMessageId,
    error: result.error,
    nextRetryAt: failed ? new Date(now.getTime() + 60_000) : null,
    updatedAt: now,
  }).where(eq(metaWebhookEventsTable.id, id));
}

export async function listMetaEvidence(workspaceId: string, id?: string) {
  const where = id
    ? and(eq(metaWebhookEventsTable.workspaceId, workspaceId), eq(metaWebhookEventsTable.id, id))
    : eq(metaWebhookEventsTable.workspaceId, workspaceId);
  return db.select().from(metaWebhookEventsTable).where(where).orderBy(metaWebhookEventsTable.receivedAt);
}

/** Claims a retry once; sending is deliberately performed by the original handler's retry integration. */
export async function claimDueMetaWebhookRetries(now = new Date()) {
  const due = await db.select().from(metaWebhookEventsTable).where(and(
    eq(metaWebhookEventsTable.status, "failed"),
    lte(metaWebhookEventsTable.nextRetryAt, now),
  )).limit(50);
  const claimed = [];
  for (const event of due) {
    const retryCount = event.retryCount + 1;
    const dead = retryCount >= MAX_RETRIES;
    const updated = await db.update(metaWebhookEventsTable).set({
      status: dead ? "dead_letter" : "retry_claimed",
      retryCount,
      deadLetterAt: dead ? now : null,
      nextRetryAt: dead ? null : new Date(now.getTime() + 60_000 * 2 ** retryCount),
      updatedAt: now,
    }).where(and(eq(metaWebhookEventsTable.id, event.id), eq(metaWebhookEventsTable.status, "failed"))).returning();
    if (updated[0]) claimed.push(updated[0]);
  }
  return claimed;
}

export async function replayDueMetaWebhookEvents(): Promise<void> {
  const events = await claimDueMetaWebhookRetries();
  for (const event of events) {
    if (event.status === "dead_letter" || !event.outboundEndpoint) continue;
    try {
      const rows = await db.select().from(workspaceIntegrationsTable).where(and(
        eq(workspaceIntegrationsTable.accountId, event.accountId),
        eq(workspaceIntegrationsTable.status, "connected"),
      )).limit(1);
      const integration = rows.find((row) =>
        !!row.accessToken?.trim() && isOrganicSocialIntegration(row.metadata as Record<string, unknown> | null));
      if (!integration?.accessToken) {
        await recordMetaSendResult(event.id, { error: "Retry credential is disconnected, missing, or not organic social" });
        continue;
      }
      const payload = event.outboundRequest as Record<string, unknown>;
      await recordMetaSendStarted(event.id, event.outboundEndpoint, payload);
      const response = await fetch(`https://graph.facebook.com/v22.0${event.outboundEndpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, access_token: integration.accessToken }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await response.json().catch(() => ({})) as { id?: string; error?: { message?: string } };
      if (!response.ok || data.error) throw new Error(data.error?.message ?? `Meta API ${response.status}`);
      await recordMetaSendResult(event.id, { providerResponse: data, providerMessageId: data.id });
    } catch (error) {
      await recordMetaSendResult(event.id, { error: error instanceof Error ? error.message : String(error) });
    }
  }
}