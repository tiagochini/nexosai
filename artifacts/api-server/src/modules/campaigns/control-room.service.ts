import { and, count, desc, eq, sql } from "drizzle-orm";
import {
  approvalCheckpointsTable,
  campaignsTable,
  contentPiecesTable,
  db,
  executionEvidenceTable,
  masterplanVersionsTable,
  socialPostsTable,
  workspaceIntegrationsTable,
} from "@workspace/db";
import { NotFoundError } from "../../lib/errors.js";

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function safeCheckpointData(data: unknown) {
  const source = object(data);
  const dueAt = stringValue(source["dueAt"] ?? source["due_at"]);
  const masterplanVersionId = stringValue(source["masterplanVersionId"] ?? source["masterplan_version_id"]);
  const contextFingerprint = stringValue(source["contextFingerprint"] ?? source["context_fingerprint"]);
  return { dueAt, masterplanVersionId, contextFingerprint };
}

const MAX_PUBLIC_EVIDENCE_DEPTH = 12;
const MAX_PUBLIC_EVIDENCE_NODES = 2_000;
const MAX_PUBLIC_EVIDENCE_ITEMS = 2_000;
const MAX_PUBLIC_EVIDENCE_KEYS = 2_000;
const MAX_PUBLIC_EVIDENCE_STRING = 4_096;
const SENSITIVE_EVIDENCE_KEY = /(?:token|secret|password|authorization|cookie|credential|private[\s_-]*key|session|signature|signed[\s_-]*url|(?:api|access|refresh)[\s_-]*key)/i;
const BEARER_VALUE = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const JWT_VALUE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const PEM_PRIVATE_KEY = /-----BEGIN[^\n-]*(?:PRIVATE|ENCRYPTED)[^\n-]*-----[\s\S]*?-----END[^\n-]*(?:PRIVATE|ENCRYPTED)[^\n-]*-----/gi;
const HTTP_URL_VALUE = /\bhttps?:\/\/[^\s"'<>]+/gi;

function stripPublicUrlCredentials(value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return value;
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return value;
  }
}

function sanitizePublicEvidenceString(value: string): string {
  const hasSecretPattern = (pattern: RegExp): boolean => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  };
  const containsSecret = hasSecretPattern(PEM_PRIVATE_KEY)
    || hasSecretPattern(BEARER_VALUE)
    || hasSecretPattern(JWT_VALUE);
  let safe = value;
  const replacePattern = (pattern: RegExp, replacement: string) => {
    pattern.lastIndex = 0;
    safe = safe.replace(pattern, replacement);
  };
  replacePattern(PEM_PRIVATE_KEY, "[REDACTED_PRIVATE_KEY]");
  replacePattern(BEARER_VALUE, "Bearer [REDACTED]");
  replacePattern(JWT_VALUE, "[REDACTED_JWT]");
  safe = safe.replace(HTTP_URL_VALUE, stripPublicUrlCredentials);
  if (containsSecret) return "[REDACTED_SECRET_VALUE]";
  if (safe.length > MAX_PUBLIC_EVIDENCE_STRING) return "[REDACTED_EVIDENCE_STRING_LIMIT]";
  return safe;
}

type PublicEvidenceState = { count: number; truncated: boolean };

function redactPublicEvidence(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
  state: PublicEvidenceState = { count: 0, truncated: false },
): unknown {
  if (state.truncated) return undefined;
  if (state.count++ >= MAX_PUBLIC_EVIDENCE_NODES) {
    state.truncated = true;
    return "[REDACTED_EVIDENCE_LIMIT]";
  }
  if (depth > MAX_PUBLIC_EVIDENCE_DEPTH) return "[REDACTED_EVIDENCE_DEPTH]";
  if (typeof value === "string") return sanitizePublicEvidenceString(value);
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[REDACTED_EVIDENCE_CYCLE]";
  seen.add(value);

  if (Array.isArray(value)) {
    const result: unknown[] = [];
    for (let index = 0; index < value.length && index < MAX_PUBLIC_EVIDENCE_ITEMS; index += 1) {
      const item = redactPublicEvidence(value[index], depth + 1, seen, state);
      if (item !== undefined) result.push(item);
      if (state.truncated) break;
    }
    if (!state.truncated && value.length > MAX_PUBLIC_EVIDENCE_ITEMS) {
      state.truncated = true;
      result.push("[REDACTED_EVIDENCE_LIMIT]");
    }
    seen.delete(value);
    return result;
  }

  const result: JsonObject = {};
  const entries = Object.entries(value as JsonObject);
  for (let index = 0; index < entries.length && index < MAX_PUBLIC_EVIDENCE_KEYS; index += 1) {
    const [key, item] = entries[index]!;
    if (SENSITIVE_EVIDENCE_KEY.test(key)) continue;
    const sanitized = redactPublicEvidence(item, depth + 1, seen, state);
    if (sanitized !== undefined) result[key] = sanitized;
    if (state.truncated) break;
  }
  if (!state.truncated && entries.length > MAX_PUBLIC_EVIDENCE_KEYS) {
    state.truncated = true;
    result["__redacted_truncation"] = "[REDACTED_EVIDENCE_LIMIT]";
  }
  seen.delete(value);
  return result;
}

function integrationHealth(
  status: string,
  tokenExpiresAt: Date | null,
  accountId: string | null,
  hasCredential: boolean,
) {
  if (status === "expired" || (status === "connected" && tokenExpiresAt && tokenExpiresAt.getTime() <= Date.now())) {
    return { state: "expired", reason: "expired" };
  }
  if (status === "error") return { state: "error", reason: "error" };
  if (status === "disconnected") return { state: "disconnected", reason: "disconnected" };
  if (status === "pending_approval") return { state: "pending", reason: "pending_approval" };
  if (!hasCredential) return { state: "blocked", reason: "missing_credential" };
  if (!accountId?.trim()) return { state: "blocked", reason: "missing_account" };
  if (status === "connected") return { state: "healthy", reason: "connected" };
  return { state: "blocked", reason: "error" };
}

export async function getCampaignControlRoom(campaignId: string, workspaceId: string) {
  const [campaign] = await db
    .select({
      id: campaignsTable.id,
      title: campaignsTable.title,
      status: campaignsTable.status,
      currentPhase: campaignsTable.currentPhase,
      createdAt: campaignsTable.createdAt,
      updatedAt: campaignsTable.updatedAt,
      executionStartedAt: campaignsTable.executionStartedAt,
      completedAt: campaignsTable.completedAt,
    })
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId)))
    .limit(1);

  if (!campaign) throw new NotFoundError("Campaign");

  const [masterplan, checkpoints, contentGroups, socialGroups, contentPreview, socialPreview, integrations, evidence] =
    await Promise.all([
      db.select({
        id: masterplanVersionsTable.id,
        version: masterplanVersionsTable.version,
        status: masterplanVersionsTable.status,
        snapshot: masterplanVersionsTable.snapshot,
        contentHash: masterplanVersionsTable.contentHash,
        contextFingerprint: masterplanVersionsTable.contextFingerprint,
        approvedAt: masterplanVersionsTable.approvedAt,
      }).from(masterplanVersionsTable).where(and(
        eq(masterplanVersionsTable.workspaceId, workspaceId),
        eq(masterplanVersionsTable.campaignId, campaignId),
        eq(masterplanVersionsTable.status, "approved"),
      )).orderBy(desc(masterplanVersionsTable.version)).limit(1),
      db.select({
        id: approvalCheckpointsTable.id,
        assetId: approvalCheckpointsTable.assetId,
        checkpointType: approvalCheckpointsTable.checkpointType,
        status: approvalCheckpointsTable.status,
        data: approvalCheckpointsTable.data,
        approvedAt: approvalCheckpointsTable.approvedAt,
        createdAt: approvalCheckpointsTable.createdAt,
      }).from(approvalCheckpointsTable).where(and(
        eq(approvalCheckpointsTable.campaignId, campaignId),
        eq(approvalCheckpointsTable.status, "pending"),
      )).orderBy(desc(approvalCheckpointsTable.createdAt)).limit(100),
      db.select({
        status: contentPiecesTable.status,
        type: contentPiecesTable.type,
        total: count(),
      }).from(contentPiecesTable).where(and(
        eq(contentPiecesTable.workspaceId, workspaceId),
        eq(contentPiecesTable.campaignId, campaignId),
      )).groupBy(contentPiecesTable.status, contentPiecesTable.type),
      db.select({
        status: socialPostsTable.status,
        type: socialPostsTable.postType,
        platform: socialPostsTable.platform,
        total: count(),
      }).from(socialPostsTable).where(and(
        eq(socialPostsTable.workspaceId, workspaceId),
        eq(socialPostsTable.campaignId, campaignId),
      )).groupBy(socialPostsTable.status, socialPostsTable.postType, socialPostsTable.platform),
      db.select({ total: count() }).from(contentPiecesTable).where(and(
        eq(contentPiecesTable.workspaceId, workspaceId),
        eq(contentPiecesTable.campaignId, campaignId),
        sql`${contentPiecesTable.content} <> '{}'::jsonb`,
      )),
      db.select({ total: count() }).from(socialPostsTable).where(and(
        eq(socialPostsTable.workspaceId, workspaceId),
        eq(socialPostsTable.campaignId, campaignId),
        sql`(
          jsonb_array_length(${socialPostsTable.mediaUrls}) > 0
          OR NULLIF(TRIM(COALESCE(${socialPostsTable.caption}, '')), '') IS NOT NULL
          OR NULLIF(TRIM(COALESCE(${socialPostsTable.reelScript}, '')), '') IS NOT NULL
          OR NULLIF(TRIM(COALESCE(${socialPostsTable.platformUrl}, '')), '') IS NOT NULL
        )`,
      )),
      db.select({
        provider: workspaceIntegrationsTable.provider,
        accountId: workspaceIntegrationsTable.accountId,
        accountName: workspaceIntegrationsTable.accountName,
        status: workspaceIntegrationsTable.status,
        tokenExpiresAt: workspaceIntegrationsTable.tokenExpiresAt,
        updatedAt: workspaceIntegrationsTable.updatedAt,
        hasCredential: sql<boolean>`NULLIF(BTRIM(COALESCE(${workspaceIntegrationsTable.accessToken}, '')), '') IS NOT NULL`,
      }).from(workspaceIntegrationsTable).where(and(
        eq(workspaceIntegrationsTable.workspaceId, workspaceId),
        sql`${workspaceIntegrationsTable.provider} IN ('instagram', 'facebook', 'meta_ads', 'tiktok_ads', 'linkedin_ads')`,
      )).orderBy(desc(workspaceIntegrationsTable.updatedAt)).limit(50),
      db.select({
        id: executionEvidenceTable.id,
        subjectType: executionEvidenceTable.subjectType,
        subjectId: executionEvidenceTable.subjectId,
        state: executionEvidenceTable.state,
        createdAt: executionEvidenceTable.createdAt,
        masterplanVersionId: executionEvidenceTable.masterplanVersionId,
        contextFingerprint: executionEvidenceTable.contextFingerprint,
        details: executionEvidenceTable.details,
      }).from(executionEvidenceTable).where(and(
        eq(executionEvidenceTable.workspaceId, workspaceId),
        eq(executionEvidenceTable.campaignId, campaignId),
      )).orderBy(desc(executionEvidenceTable.createdAt)).limit(25),
    ]);

  const approvedMasterplan = masterplan[0];
  const snapshot = object(approvedMasterplan?.snapshot);
  const snapshotCampaign = object(snapshot["campaign"]);
  const snapshotStrategy = object(snapshot["strategy"]);
  const masterplanSection = approvedMasterplan
    ? {
        available: true,
        id: approvedMasterplan.id,
        version: approvedMasterplan.version,
        status: approvedMasterplan.status,
        approvedAt: approvedMasterplan.approvedAt,
        contentHash: approvedMasterplan.contentHash,
        contextFingerprint: approvedMasterplan.contextFingerprint,
        title: stringValue(snapshotCampaign["title"]) ?? stringValue(snapshot["title"]),
        objective: stringValue(snapshotStrategy["objective"]) ?? stringValue(snapshot["objective"]),
      }
    : { available: false, reason: "no_approved_masterplan" };

  const contentRecords = contentGroups.map((row) => ({
    kind: "content_piece" as const,
    status: row.status,
    type: row.type,
    platform: null,
    total: Number(row.total),
  }));
  const socialRecords = socialGroups.map((row) => ({
    kind: "social_post" as const,
    status: row.status,
    type: row.type,
    platform: row.platform,
    total: Number(row.total),
  }));
  const deliverableRecords = [...contentRecords, ...socialRecords];
  const totalDeliverables = deliverableRecords.reduce((sum, row) => sum + row.total, 0);
  const pendingCheckpoints = checkpoints.map((checkpoint) => ({
    id: checkpoint.id,
    assetId: checkpoint.assetId,
    checkpointType: checkpoint.checkpointType,
    status: checkpoint.status,
    createdAt: checkpoint.createdAt,
    approvedAt: checkpoint.approvedAt,
    ...safeCheckpointData(checkpoint.data),
  }));
  const credentialRecords = integrations.map((integration) => ({
    provider: integration.provider,
    accountId: integration.accountId,
    accountName: integration.accountName,
    status: integration.status,
    tokenExpiresAt: integration.tokenExpiresAt,
    updatedAt: integration.updatedAt,
    health: integrationHealth(
      integration.status,
      integration.tokenExpiresAt,
      integration.accountId,
      integration.hasCredential,
    ),
  }));
  const evidenceRecords = evidence.map((row) => ({
    id: row.id,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    state: row.state,
    createdAt: row.createdAt,
    masterplanVersionId: row.masterplanVersionId,
    contextFingerprint: row.contextFingerprint,
    details: redactPublicEvidence(row.details),
  }));

  return {
    campaign,
    masterplan: masterplanSection,
    pendingCheckpoints: {
      available: pendingCheckpoints.length > 0,
      reason: pendingCheckpoints.length > 0 ? null : "no_pending_checkpoints",
      records: pendingCheckpoints,
    },
    deliverables: {
      available: totalDeliverables > 0,
      reason: totalDeliverables > 0 ? null : "no_deliverables",
      total: totalDeliverables,
      previewReady: Number(contentPreview[0]?.total ?? 0) + Number(socialPreview[0]?.total ?? 0),
      records: deliverableRecords,
    },
    credentials: {
      available: credentialRecords.length > 0,
      reason: credentialRecords.length > 0 ? null : "no_social_integrations",
      records: credentialRecords,
    },
    executionEvidence: {
      available: evidenceRecords.length > 0,
      reason: evidenceRecords.length > 0 ? null : "no_execution_evidence",
      records: evidenceRecords,
    },
    sections: {
      masterplan: { available: Boolean(approvedMasterplan) },
      pendingCheckpoints: { available: pendingCheckpoints.length > 0 },
      deliverables: { available: totalDeliverables > 0 },
      credentials: { available: credentialRecords.length > 0 },
      executionEvidence: { available: evidenceRecords.length > 0 },
    },
  };
}