import { and, count, desc, eq, sql, or, lt, inArray, type SQL } from "drizzle-orm";
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
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { env } from "../../lib/env.js";
import { createHmac, timingSafeEqual } from "node:crypto";

type JsonObject = Record<string, unknown>;

export const CONTROL_ROOM_EVIDENCE_SUBJECT_TYPES = [
  "social_post", "paid_media_attempt", "paid_media_launch_plan",
  "paid_media_proposal", "product_sale", "revenue_event",
] as const;
export const CONTROL_ROOM_EVIDENCE_STATES = ["planned", "attempted", "provider_confirmed", "artifact_qc"] as const;
export type ControlRoomEvidenceFilters = {
  limit: number; cursor?: string; state?: typeof CONTROL_ROOM_EVIDENCE_STATES[number];
  subjectType?: typeof CONTROL_ROOM_EVIDENCE_SUBJECT_TYPES[number]; subjectId?: string;
  from?: string; to?: string;
};

function cursorSecret() { return env.SESSION_SECRET; }
function encodeEvidenceCursor(payload: object) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", cursorSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function decodeEvidenceCursor(value: string, campaignId: string, workspaceId: string, filters: ControlRoomEvidenceFilters) {
  try {
    const [body, signature] = value.split(".");
    if (!body || !signature) throw new Error();
    const expected = createHmac("sha256", cursorSecret()).update(body).digest("base64url");
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error();
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString()) as JsonObject;
    const filterBinding = JSON.stringify({ campaignId, workspaceId, limit: filters.limit, state: filters.state ?? null, subjectType: filters.subjectType ?? null, subjectId: filters.subjectId ?? null, from: filters.from ?? null, to: filters.to ?? null });
    const createdAt = new Date(parsed["createdAt"] as string);
    const invalidExpiry = parsed["exp"] !== undefined
      && (!Number.isFinite(Number(parsed["exp"])) || Number(parsed["exp"]) < Date.now());
    const invalidPayload = parsed["binding"] !== filterBinding
      || typeof parsed["createdAt"] !== "string"
      || Number.isNaN(createdAt.getTime())
      || typeof parsed["id"] !== "string";
    if (invalidExpiry || invalidPayload) throw new Error();
    return { createdAt, id: parsed["id"] as string };
  } catch { throw new ValidationError("Invalid evidence cursor"); }
}

function evidenceConditions(campaignId: string, workspaceId: string, filters: ControlRoomEvidenceFilters) {
  const conditions = [
    eq(executionEvidenceTable.workspaceId, workspaceId), eq(executionEvidenceTable.campaignId, campaignId),
    filters.state ? eq(executionEvidenceTable.state, filters.state) : undefined,
    filters.subjectType ? eq(executionEvidenceTable.subjectType, filters.subjectType) : undefined,
    filters.subjectId ? eq(executionEvidenceTable.subjectId, filters.subjectId) : undefined,
    filters.from ? sql`${executionEvidenceTable.createdAt} >= ${new Date(filters.from)}` : undefined,
    filters.to ? sql`${executionEvidenceTable.createdAt} < ${new Date(filters.to)}` : undefined,
  ].filter((condition): condition is SQL => condition !== undefined);
  return conditions as SQL[];
}

export async function getCampaignControlRoomEvidence(campaignId: string, workspaceId: string, filters: ControlRoomEvidenceFilters) {
  const [campaign] = await db.select({ id: campaignsTable.id }).from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId))).limit(1);
  if (!campaign) throw new NotFoundError("Campaign");
  const base = evidenceConditions(campaignId, workspaceId, filters);
  let seek: { createdAt: Date; id: string } | undefined;
  if (filters.cursor) {
    seek = decodeEvidenceCursor(filters.cursor, campaignId, workspaceId, filters);
    base.push(or(
      lt(executionEvidenceTable.createdAt, seek.createdAt),
      and(eq(executionEvidenceTable.createdAt, seek.createdAt), lt(executionEvidenceTable.id, seek.id)),
    )!);
  }
  const rows = await db.select({
    id: executionEvidenceTable.id, subjectType: executionEvidenceTable.subjectType, subjectId: executionEvidenceTable.subjectId,
    state: executionEvidenceTable.state, createdAt: executionEvidenceTable.createdAt, masterplanVersionId: executionEvidenceTable.masterplanVersionId,
    contextFingerprint: executionEvidenceTable.contextFingerprint, details: executionEvidenceTable.details,
  }).from(executionEvidenceTable).where(and(...base)).orderBy(desc(executionEvidenceTable.createdAt), desc(executionEvidenceTable.id)).limit(filters.limit + 1);
  const hasNextPage = rows.length > filters.limit;
  const pageRows = rows.slice(0, filters.limit);
  const countRows = await db.select({ total: count() }).from(executionEvidenceTable).where(and(...evidenceConditions(campaignId, workspaceId, filters)));
  const [stateFacets, typeFacets] = await Promise.all([
    db.select({ value: executionEvidenceTable.state, count: count() }).from(executionEvidenceTable).where(and(...evidenceConditions(campaignId, workspaceId, filters))).groupBy(executionEvidenceTable.state),
    db.select({ value: executionEvidenceTable.subjectType, count: count() }).from(executionEvidenceTable).where(and(...evidenceConditions(campaignId, workspaceId, filters))).groupBy(executionEvidenceTable.subjectType),
  ]);
  const socialIds = pageRows.filter(r => r.subjectType === "social_post").map(r => r.subjectId);
  const social = socialIds.length ? await db.select({ id: socialPostsTable.id }).from(socialPostsTable).where(and(
    eq(socialPostsTable.workspaceId, workspaceId), eq(socialPostsTable.campaignId, campaignId), inArray(socialPostsTable.id, socialIds),
  )) : [];
  const ownedSocial = new Set(social.map(r => r.id));
  const records = pageRows.map(row => ({
    id: row.id, subjectType: row.subjectType, subjectId: row.subjectId, state: row.state, createdAt: row.createdAt,
    masterplanVersionId: row.masterplanVersionId, contextFingerprint: row.contextFingerprint ? row.contextFingerprint.slice(0, 12) : null,
    details: redactPaginatedEvidence(row.details),
    source: row.subjectType === "social_post" && ownedSocial.has(row.subjectId)
      ? { kind: "social_post", label: "Post social", href: `/campaigns/${campaignId}/content` } : null,
  }));
  const last = pageRows.at(-1);
  const binding = JSON.stringify({ campaignId, workspaceId, limit: filters.limit, state: filters.state ?? null, subjectType: filters.subjectType ?? null, subjectId: filters.subjectId ?? null, from: filters.from ?? null, to: filters.to ?? null });
  return {
    records, pageInfo: { nextCursor: hasNextPage && last ? encodeEvidenceCursor({ createdAt: last.createdAt.toISOString(), id: last.id, exp: Date.now() + 86400000, binding }) : null, hasNextPage, limit: filters.limit },
    appliedFilters: { state: filters.state ?? null, subjectType: filters.subjectType ?? null, subjectId: filters.subjectId ?? null, from: filters.from ?? null, to: filters.to ?? null },
    total: Number(countRows[0]?.total ?? 0),
    facets: { states: stateFacets.map(r => ({ value: r.value, count: Number(r.count) })), subjectTypes: typeFacets.map(r => ({ value: r.value, count: Number(r.count) })) },
  };
}

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
const MAX_PAGINATED_EVIDENCE_BYTES = 32_768;
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

function redactPaginatedEvidence(value: unknown): unknown {
  const redacted = redactPublicEvidence(value);
  if (Buffer.byteLength(JSON.stringify(redacted), "utf8") <= MAX_PAGINATED_EVIDENCE_BYTES) {
    return redacted;
  }
  return { __redacted_truncation: "[REDACTED_EVIDENCE_BYTE_LIMIT]" };
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