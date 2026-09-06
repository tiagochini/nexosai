import {
  agentExecutionLogsTable,
  campaignsTable,
  db,
  orchestrationDeadLettersTable,
  workspaceIntegrationsTable,
} from "@workspace/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { integrationPurpose } from "../integrations/integration-purpose.js";

export const EXPIRY_THRESHOLDS = {
  expiringWithin24HoursMs: 24 * 60 * 60 * 1000,
  expiringWithin7DaysMs: 7 * 24 * 60 * 60 * 1000,
  stuckCampaignMs: 30 * 60 * 1000,
} as const;

export type CredentialExpiry = "expired" | "expiring_24h" | "expiring_7d" | "healthy" | "unknown";

/** Classifies a known expiry without looking at, or returning, any credential. */
export function classifyCredentialExpiry(expiresAt: Date | string | null | undefined, now = Date.now()): CredentialExpiry {
  if (!expiresAt) return "unknown";
  const expiry = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiry)) return "unknown";
  const remaining = expiry - now;
  if (remaining <= 0) return "expired";
  if (remaining < EXPIRY_THRESHOLDS.expiringWithin24HoursMs) return "expiring_24h";
  if (remaining < EXPIRY_THRESHOLDS.expiringWithin7DaysMs) return "expiring_7d";
  return "healthy";
}

export function isStuckCampaign(
  campaign: { status: string; updatedAt: Date | string },
  now = Date.now(),
): boolean {
  return ["analyzing", "generating"].includes(campaign.status)
    && now - new Date(campaign.updatedAt).getTime() >= EXPIRY_THRESHOLDS.stuckCampaignMs;
}

export type OperationalFilters = {
  workspaceId?: string;
  campaignId?: string;
  provider?: string;
  correlationId?: string;
  limit?: number;
};

/**
 * Explicitly projects safe operational fields. This is intentionally not a
 * spread of database records: integrations contain access/refresh tokens and
 * metadata can contain provider credentials.
 */
export function sanitizeOperationalPayload<T>(payload: T): T {
  if (payload instanceof Date) return payload.toISOString() as T;
  if (Array.isArray(payload)) return payload.map(sanitizeOperationalPayload) as T;
  if (payload && typeof payload === "object") {
    return Object.fromEntries(Object.entries(payload as Record<string, unknown>)
      .filter(([key]) => !/token|secret|password|authorization|webhookurl/i.test(key))
      .map(([key, value]) => [key, sanitizeOperationalPayload(value)])) as T;
  }
  return payload;
}

export async function getOperationalStatus(filters: OperationalFilters = {}, now = Date.now()) {
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);
  const integrationConditions = [
    ...(filters.workspaceId ? [eq(workspaceIntegrationsTable.workspaceId, filters.workspaceId)] : []),
    ...(filters.provider ? [sql`${workspaceIntegrationsTable.provider}::text = ${filters.provider}`] : []),
  ];
  const integrations = await db.select({
    id: workspaceIntegrationsTable.id,
    workspaceId: workspaceIntegrationsTable.workspaceId,
    provider: workspaceIntegrationsTable.provider,
    status: workspaceIntegrationsTable.status,
    tokenExpiresAt: workspaceIntegrationsTable.tokenExpiresAt,
    accountName: workspaceIntegrationsTable.accountName,
    metadata: workspaceIntegrationsTable.metadata,
    updatedAt: workspaceIntegrationsTable.updatedAt,
  }).from(workspaceIntegrationsTable)
    .where(integrationConditions.length ? and(...integrationConditions) : undefined)
    .orderBy(desc(workspaceIntegrationsTable.updatedAt))
    .limit(limit);

  const campaignConditions = [
    inArray(campaignsTable.status, ["analyzing", "generating"]),
    ...(filters.workspaceId ? [eq(campaignsTable.workspaceId, filters.workspaceId)] : []),
    ...(filters.campaignId ? [eq(campaignsTable.id, filters.campaignId)] : []),
  ];
  const candidateCampaigns = await db.select({
    id: campaignsTable.id,
    workspaceId: campaignsTable.workspaceId,
    title: campaignsTable.title,
    status: campaignsTable.status,
    updatedAt: campaignsTable.updatedAt,
  }).from(campaignsTable)
    .where(and(...campaignConditions))
    .orderBy(desc(campaignsTable.updatedAt))
    .limit(limit);
  const stuckCampaigns = candidateCampaigns.filter((campaign) => isStuckCampaign(campaign, now)).map((campaign) => ({
    ...campaign,
    ageMs: now - new Date(campaign.updatedAt).getTime(),
  }));

  const failureConditions = [
    eq(agentExecutionLogsTable.executionStatus, "failed"),
    ...(filters.workspaceId ? [eq(agentExecutionLogsTable.workspaceId, filters.workspaceId)] : []),
    ...(filters.campaignId ? [eq(agentExecutionLogsTable.campaignId, filters.campaignId)] : []),
  ];
  const failures = await db.select({
    id: agentExecutionLogsTable.id,
    workspaceId: agentExecutionLogsTable.workspaceId,
    campaignId: agentExecutionLogsTable.campaignId,
    agentName: agentExecutionLogsTable.agentName,
    actionType: agentExecutionLogsTable.actionType,
    occurredAt: agentExecutionLogsTable.completedAt,
  }).from(agentExecutionLogsTable)
    .where(and(...failureConditions))
    .orderBy(desc(agentExecutionLogsTable.completedAt))
    .limit(limit);

  // The DLQ schema is optional during rolling deploys. It is only imported from
  // the shared schema after it exists, and only safe correlation metadata is
  // projected below (never error summaries or job payloads).
  const deadLetterConditions = [
    ...(filters.workspaceId ? [eq(orchestrationDeadLettersTable.workspaceId, filters.workspaceId)] : []),
    ...(filters.campaignId ? [eq(orchestrationDeadLettersTable.campaignId, filters.campaignId)] : []),
    ...(filters.correlationId ? [eq(orchestrationDeadLettersTable.correlationId, filters.correlationId)] : []),
  ];
  const deadLetters = await db.select({
    id: orchestrationDeadLettersTable.id,
    workspaceId: orchestrationDeadLettersTable.workspaceId,
    campaignId: orchestrationDeadLettersTable.campaignId,
    action: orchestrationDeadLettersTable.action,
    jobId: orchestrationDeadLettersTable.jobId,
    correlationId: orchestrationDeadLettersTable.correlationId,
    attemptCount: orchestrationDeadLettersTable.attemptCount,
    classification: orchestrationDeadLettersTable.classification,
    replayStatus: orchestrationDeadLettersTable.replayStatus,
    lastFailedAt: orchestrationDeadLettersTable.lastFailedAt,
  }).from(orchestrationDeadLettersTable)
    .where(deadLetterConditions.length ? and(...deadLetterConditions) : undefined)
    .orderBy(desc(orchestrationDeadLettersTable.lastFailedAt))
    .limit(limit)
    .catch((error: unknown) => {
      // Schema can arrive after API code in a rolling deployment. Do not make
      // the entire visibility endpoint unavailable while that migration lands.
      if ((error as { code?: string }).code === "42P01") return null;
      throw error;
    });

  const safeIntegrations = integrations.map((integration) => ({
    id: integration.id,
    workspaceId: integration.workspaceId,
    provider: integration.provider,
    purpose: integrationPurpose(integration.metadata as Record<string, unknown>),
    accountLabel: integration.accountName ?? null,
    connectionHealth: integration.status === "connected" ? "connected" : integration.status,
    expiry: classifyCredentialExpiry(integration.tokenExpiresAt, now),
    expiresAt: integration.tokenExpiresAt?.toISOString() ?? null,
    updatedAt: integration.updatedAt.toISOString(),
  }));
  const expiryCounts = safeIntegrations.reduce<Record<CredentialExpiry, number>>(
    (counts, integration) => ({ ...counts, [integration.expiry]: counts[integration.expiry] + 1 }),
    { expired: 0, expiring_24h: 0, expiring_7d: 0, healthy: 0, unknown: 0 },
  );

  return sanitizeOperationalPayload({
    generatedAt: new Date(now).toISOString(),
    thresholds: {
      expiry: {
        expired: "<= 0",
        expiring_24h: "< 24h",
        expiring_7d: "< 7d",
        healthy: ">= 7d",
        unknown: "no valid expiry supplied",
      },
      stuckCampaignAfterMs: EXPIRY_THRESHOLDS.stuckCampaignMs,
    },
    correlation: {
      workspaceId: filters.workspaceId ?? null,
      campaignId: filters.campaignId ?? null,
      provider: filters.provider ?? null,
      correlationId: filters.correlationId ?? null,
    },
    summary: {
      integrationsReturned: safeIntegrations.length,
      credentialExpiry: expiryCounts,
      stuckCampaignsReturned: stuckCampaigns.length,
      recentFailuresReturned: failures.length,
      deadLettersReturned: deadLetters?.length ?? 0,
    },
    integrations: safeIntegrations,
    stuckCampaigns,
    recentFailures: failures,
    deadLetters: {
      available: deadLetters !== null,
      entries: deadLetters ?? [],
    },
  });
}