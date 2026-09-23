import { and, count, desc, eq, sql, or, lt, inArray, type SQL } from "drizzle-orm";
import {
  approvalCheckpointsTable,
  campaignsTable,
  contentPiecesTable,
  db,
  executionEvidenceTable,
  masterplanVersionsTable,
  socialPostsTable,
  mediaBriefsTable,
  campaignAssetsTable,
  campaignCreativesTable,
  pagesTable,
  landingRevisionsTable,
  videoProjectsTable,
  workspaceIntegrationsTable,
} from "@workspace/db";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { env } from "../../lib/env.js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createHash } from "node:crypto";

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

const PREVIEW_KINDS = ["content_piece", "media_brief", "creative", "social_post", "campaign_asset", "page", "video_project"] as const;
type PreviewKind = typeof PREVIEW_KINDS[number];
export type ControlRoomPreviewFilters = { limit: number; cursor?: string; kind?: PreviewKind; status?: string; updatedFrom?: string; updatedTo?: string };
type PreviewRow = { kind: PreviewKind; id: string; type: string; status: string; title: string; updatedAt: Date; data: unknown; available: boolean; href?: string };

function previewCursor(payload: object) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${createHmac("sha256", cursorSecret()).update(body).digest("base64url")}`;
}
function readPreviewCursor(value: string, campaignId: string, workspaceId: string, filters: ControlRoomPreviewFilters) {
  try {
    const [body, sig] = value.split(".");
    if (!body || !sig) throw new Error();
    const expected = createHmac("sha256", cursorSecret()).update(body).digest("base64url");
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new Error();
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as JsonObject;
    const binding = JSON.stringify({ campaignId, workspaceId, limit: filters.limit, kind: filters.kind ?? null, status: filters.status ?? null, updatedFrom: filters.updatedFrom ?? null, updatedTo: filters.updatedTo ?? null });
    if (p.binding !== binding || typeof p.exp !== "number" || p.exp < Date.now() || typeof p.id !== "string" || typeof p.kind !== "string" || typeof p.updatedAt !== "string") throw new Error();
    return { id: p.id, kind: p.kind as PreviewKind, updatedAt: new Date(p.updatedAt) };
  } catch { throw new ValidationError("Invalid preview cursor"); }
}
function previewContent(data: unknown) {
  return redactPaginatedEvidence(data);
}
function hasPreviewContent(value: unknown): boolean {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return false;
    const looksJson = trimmed === "null" || trimmed === "true" || trimmed === "false"
      || /^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|"(?:[^"\\]|\\.)*")$/.test(trimmed)
      || trimmed.startsWith("{") || trimmed.startsWith("[");
    if (!looksJson) return true;
    try { return hasPreviewContent(JSON.parse(trimmed)); } catch { return true; }
  }
  if (Array.isArray(value)) return value.some(hasPreviewContent);
  if (value && typeof value === "object") return Object.values(value).some(hasPreviewContent);
  return typeof value === "number" || typeof value === "boolean";
}
function safePreviewUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    if (value.startsWith("/")) return value.split(/[?#]/, 1)[0] || undefined;
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    parsed.username = ""; parsed.password = ""; parsed.search = ""; parsed.hash = "";
    return parsed.toString();
  } catch { return undefined; }
}
function safePreviewUrls(value: unknown): string[] {
  return Array.isArray(value) ? value.map(safePreviewUrl).filter((v): v is string => Boolean(v)) : [];
}
function previewRecord(row: PreviewRow) {
  const content = previewContent(row.data);
  const available = row.available && hasPreviewContent(content);
  const media = safePreviewUrls(content && typeof content === "object" ? (content as JsonObject).mediaUrls : undefined);
  const representation: "text" | "image" | "video" | "page" | "message" | "ad" | "structured" =
    row.kind === "page" ? "page" : row.kind === "social_post" && row.type.includes("message") ? "message" :
      row.kind === "social_post" && (row.type.includes("video") || row.type === "reel") && media.length ? "video" :
      (row.kind === "creative" || row.kind === "campaign_asset" || row.kind === "media_brief") &&
        safePreviewUrls(content && typeof content === "object" ? (content as JsonObject).mediaUrls : undefined).length ? "image" :
      row.type.includes("ad") ? "ad" : row.kind === "content_piece" ? "text" : "structured";
  return {
    source: { kind: row.kind, id: row.id, type: row.type, status: row.status, title: row.title.slice(0, 512), updatedAt: row.updatedAt },
    preview: { state: available ? "ready" as const : "unavailable" as const, representation, reason: available ? null : "no_safe_content", content: available ? content : null },
    ...(row.href ? { sourceLink: row.href } : {}),
  };
}

export async function getCampaignControlRoomPreviews(campaignId: string, workspaceId: string, filters: ControlRoomPreviewFilters) {
  const [campaign] = await db.select({ id: campaignsTable.id }).from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId))).limit(1);
  if (!campaign) throw new NotFoundError("Campaign");
  const from = filters.updatedFrom ? new Date(filters.updatedFrom) : undefined;
  const to = filters.updatedTo ? new Date(filters.updatedTo) : undefined;
  const seek = filters.cursor ? readPreviewCursor(filters.cursor, campaignId, workspaceId, filters) : undefined;
  const range = (column: any, idColumn: any, kind: PreviewKind) => and(
    from ? sql`${column} >= ${from}` : undefined, to ? sql`${column} < ${to}` : undefined,
    seek ? or(
      lt(column, seek.updatedAt),
      and(eq(column, seek.updatedAt), kind > seek.kind ? sql`true` : kind === seek.kind ? lt(idColumn, seek.id) : sql`false`),
    ) : undefined,
  );
  const candidateLimit = filters.limit + 1;
  const statusCondition = (column: any) => filters.status ? sql`${column}::text = ${filters.status}` : undefined;
  const rows: PreviewRow[] = [];
  const [content, media, social, creatives, assets, pages, videos] = await Promise.all([
    db.select().from(contentPiecesTable).where(and(eq(contentPiecesTable.workspaceId, workspaceId), eq(contentPiecesTable.campaignId, campaignId), statusCondition(contentPiecesTable.status), range(contentPiecesTable.updatedAt, contentPiecesTable.id, "content_piece"))).orderBy(desc(contentPiecesTable.updatedAt), desc(contentPiecesTable.id)).limit(candidateLimit),
    db.select().from(mediaBriefsTable).where(and(eq(mediaBriefsTable.workspaceId, workspaceId), eq(mediaBriefsTable.campaignId, campaignId), statusCondition(mediaBriefsTable.conceptStatus), range(mediaBriefsTable.updatedAt, mediaBriefsTable.id, "media_brief"))).orderBy(desc(mediaBriefsTable.updatedAt), desc(mediaBriefsTable.id)).limit(candidateLimit),
    db.select().from(socialPostsTable).where(and(eq(socialPostsTable.workspaceId, workspaceId), eq(socialPostsTable.campaignId, campaignId), statusCondition(socialPostsTable.status), range(socialPostsTable.updatedAt, socialPostsTable.id, "social_post"))).orderBy(desc(socialPostsTable.updatedAt), desc(socialPostsTable.id)).limit(candidateLimit),
    db.select().from(campaignCreativesTable).where(and(eq(campaignCreativesTable.workspaceId, workspaceId), eq(campaignCreativesTable.campaignId, campaignId), statusCondition(campaignCreativesTable.status), range(campaignCreativesTable.updatedAt, campaignCreativesTable.id, "creative"))).orderBy(desc(campaignCreativesTable.updatedAt), desc(campaignCreativesTable.id)).limit(candidateLimit),
    db.select().from(campaignAssetsTable).innerJoin(campaignsTable, eq(campaignAssetsTable.campaignId, campaignsTable.id)).where(and(eq(campaignAssetsTable.campaignId, campaignId), eq(campaignsTable.workspaceId, workspaceId), statusCondition(campaignAssetsTable.status), range(campaignAssetsTable.updatedAt, campaignAssetsTable.id, "campaign_asset"))).orderBy(desc(campaignAssetsTable.updatedAt), desc(campaignAssetsTable.id)).limit(candidateLimit),
    db.select().from(pagesTable).where(and(eq(pagesTable.workspaceId, workspaceId), eq(pagesTable.campaignId, campaignId), statusCondition(pagesTable.status), range(pagesTable.updatedAt, pagesTable.id, "page"))).orderBy(desc(pagesTable.updatedAt), desc(pagesTable.id)).limit(candidateLimit),
    db.select().from(videoProjectsTable).where(and(eq(videoProjectsTable.workspaceId, workspaceId), eq(videoProjectsTable.campaignId, campaignId), statusCondition(videoProjectsTable.status), range(videoProjectsTable.updatedAt, videoProjectsTable.id, "video_project"))).orderBy(desc(videoProjectsTable.updatedAt), desc(videoProjectsTable.id)).limit(candidateLimit),
  ]);
  for (const r of content) rows.push({ kind: "content_piece", id: r.id, type: r.type, status: r.status, title: r.title, updatedAt: r.updatedAt, available: hasPreviewContent(r.content), data: { content: r.content } });
  for (const r of media) { const mediaUrls = safePreviewUrls([r.lowResUrl, r.finalUrl]); rows.push({ kind: "media_brief", id: r.id, type: r.mediaType, status: r.conceptStatus, title: r.mediaType, updatedAt: r.updatedAt, available: hasPreviewContent(r.conceptData) || mediaUrls.length > 0, data: { concept: r.conceptData, mediaUrls } }); }
  for (const r of social) { const mediaUrls = safePreviewUrls(r.mediaUrls); rows.push({ kind: "social_post", id: r.id, type: r.postType, status: r.status, title: r.caption?.slice(0, 120) ?? r.postType, updatedAt: r.updatedAt, available: Boolean(r.caption || r.hashtags?.length || r.callToAction || r.reelScript || mediaUrls.length), href: `/campaigns/${campaignId}/content`, data: { caption: r.caption, hashtags: r.hashtags, callToAction: r.callToAction, mediaUrls, reelScript: r.reelScript } }); }
  for (const r of creatives) { const mediaUrls = safePreviewUrls([r.previewUrl, r.finalUrl]); rows.push({ kind: "creative", id: r.id, type: r.format, status: r.status, title: r.requestNote ?? r.format, updatedAt: r.updatedAt, available: Boolean(r.concept) || mediaUrls.length > 0, data: { concept: r.concept, format: r.format, platform: r.platform, mediaUrls } }); }
  for (const joined of assets) { const r = joined.campaign_assets; const mediaUrls = safePreviewUrls([r.previewUrl, r.finalUrl]); rows.push({ kind: "campaign_asset", id: r.id, type: r.assetType, status: r.status, title: r.title, updatedAt: r.updatedAt, available: Boolean(r.content) || mediaUrls.length > 0, data: { content: r.content, metadata: r.metadata, platform: r.platform, mediaUrls } }); }
  for (const r of pages) rows.push({ kind: "page", id: r.id, type: r.type, status: r.status, title: r.title, updatedAt: r.updatedAt, available: Boolean(r.html), data: { metadata: r.metadata, slug: r.slug, html: r.html } });
  for (const r of videos) rows.push({ kind: "video_project", id: r.id, type: r.format, status: r.status, title: r.title, updatedAt: r.updatedAt, available: Boolean(r.script || r.storyboard?.length), data: { script: r.script, storyboard: r.storyboard, config: r.config } });
  const filtered = rows.filter(r => (!filters.kind || r.kind === filters.kind) && (!filters.status || r.status === filters.status)).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || a.kind.localeCompare(b.kind) || b.id.localeCompare(a.id));
  const page = filtered.slice(0, filters.limit);
  const hasNextPage = filtered.length > filters.limit;
  const binding = JSON.stringify({ campaignId, workspaceId, limit: filters.limit, kind: filters.kind ?? null, status: filters.status ?? null, updatedFrom: filters.updatedFrom ?? null, updatedTo: filters.updatedTo ?? null });
  return { records: page.map(previewRecord), pageInfo: { nextCursor: hasNextPage ? previewCursor({ id: page.at(-1)!.id, kind: page.at(-1)!.kind, updatedAt: page.at(-1)!.updatedAt.toISOString(), exp: Date.now() + 86400000, binding }) : null, hasNextPage, limit: filters.limit }, appliedFilters: { kind: filters.kind ?? null, status: filters.status ?? null, updatedFrom: filters.updatedFrom ?? null, updatedTo: filters.updatedTo ?? null }, total: rows.filter(r => (!filters.kind || r.kind === filters.kind) && (!filters.status || r.status === filters.status)).length };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIFF_SENSITIVE = /(?:token|secret|password|authorization|cookie|credential|private[\s_-]*key|session|signature|signed[\s_-]*url|(?:api|access|refresh)[\s_-]*key)/i;
type DiffValue = null | boolean | number | string | DiffValue[] | { [key: string]: DiffValue };

type DiffBudget = { nodes: number; incomplete: boolean; sentinel: boolean; items: number; keys: number };
type RedactedDiff = { __redacted: true; fingerprint: string };
function safeDiffValue(value: unknown, depth = 0, state: DiffBudget = { nodes: 0, incomplete: false, sentinel: false, items: 0, keys: 0 }): DiffValue | RedactedDiff {
  if (++state.nodes > 3000 || state.items > 2000 || state.keys > 2000) {
    state.incomplete = true;
    if (!state.sentinel) { state.sentinel = true; return "[REDACTED_DIFF_LIMIT]"; }
    return undefined as unknown as DiffValue;
  }
  if (depth > 12) { state.incomplete = true; return "[REDACTED_DIFF_DEPTH]"; }
  if (typeof value === "string") {
    let safe = value.replace(PEM_PRIVATE_KEY, "[REDACTED_PRIVATE_KEY]").replace(BEARER_VALUE, "Bearer [REDACTED]").replace(JWT_VALUE, "[REDACTED_JWT]").replace(HTTP_URL_VALUE, stripPublicUrlCredentials);
    if (HTTP_URL_VALUE.test(value)) {
      HTTP_URL_VALUE.lastIndex = 0;
      const stripped = safe.replace(HTTP_URL_VALUE, stripPublicUrlCredentials);
      if (stripped !== value) return { __redacted: true, fingerprint: createHash("sha256").update(value).digest("hex").slice(0, 16) };
    }
    if (safe !== value || /\bBearer\s+|\beyJ[A-Za-z0-9_-]{8,}\.|-----BEGIN/i.test(value)) {
      return { __redacted: true, fingerprint: createHash("sha256").update(value).digest("hex").slice(0, 16) };
    }
    return safe;
  }
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (Array.isArray(value)) {
    const result: DiffValue[] = [];
    for (const item of value) {
      if (++state.items > 2000) { state.incomplete = true; if (!state.sentinel) { state.sentinel = true; result.push("[REDACTED_DIFF_LIMIT]"); } break; }
      result.push(safeDiffValue(item, depth + 1, state) as DiffValue);
    }
    return result;
  }
  if (typeof value === "object") {
    const out: Record<string, DiffValue> = {};
    for (const key of Object.keys(value as object).sort()) {
      if (++state.keys > 2000) { state.incomplete = true; if (!state.sentinel) { state.sentinel = true; out.__redacted_truncation = "[REDACTED_DIFF_LIMIT]"; } break; }
      const raw = (value as Record<string, unknown>)[key];
      if (DIFF_SENSITIVE.test(key)) {
        const serialized = JSON.stringify(raw) ?? String(raw);
        out[key] = { __redacted: true, fingerprint: createHash("sha256").update(serialized).digest("hex").slice(0, 16) } as unknown as DiffValue;
      } else out[key] = safeDiffValue(raw, depth + 1, state) as DiffValue;
    }
    return out;
  }
  return String(value).slice(0, 256);
}

function diffCategory(path: string, resource: "masterplan" | "page") {
  const segment = path.split("/").find(Boolean)?.toLowerCase() ?? "";
  if (/cta|call.?to.?action/.test(segment)) return "cta";
  if (/media|image|video|asset/.test(segment)) return "media";
  if (/rule|constraint|condition/.test(segment)) return "rules";
  if (/phase|stage/.test(segment)) return "phase";
  if (/text|title|copy|description|html|body/.test(segment)) return "text";
  return resource === "masterplan" ? "masterplan" : "structure";
}

function pointer(segment: string) { return segment.replace(/~/g, "~0").replace(/\//g, "~1"); }
function diffPreview(value: DiffValue | undefined): DiffValue | undefined {
  if (value && typeof value === "object" && !Array.isArray(value) && "__redacted" in value) return "[REDACTED_SECRET_VALUE]";
  if (typeof value === "string" && value.length > 4096) return `${value.slice(0, 4096)}[REDACTED_DIFF_STRING_LIMIT]`;
  if (Array.isArray(value)) return value.map(v => diffPreview(v)).filter((v): v is DiffValue => v !== undefined);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, diffPreview(v)]).filter(([, v]) => v !== undefined)) as DiffValue;
  return value;
}
function containsLongDiffString(value: DiffValue): boolean {
  if (typeof value === "string") return value.length > 4096;
  if (Array.isArray(value)) return value.some(containsLongDiffString);
  if (value && typeof value === "object") return Object.values(value).some(containsLongDiffString);
  return false;
}
function canonicalDiff(base: DiffValue, target: DiffValue, resource: "masterplan" | "page") {
  const changes: Array<{ kind: "added" | "removed" | "changed"; path: string; category: string; before?: DiffValue; after?: DiffValue }> = [];
  let unchanged = 0;
  const walk = (a: DiffValue | undefined, b: DiffValue | undefined, path: string) => {
    if (a === undefined && b !== undefined) { changes.push({ kind: "added", path, category: diffCategory(path, resource), after: diffPreview(b) }); return; }
    if (a !== undefined && b === undefined) { changes.push({ kind: "removed", path, category: diffCategory(path, resource), before: diffPreview(a) }); return; }
    if ((a && typeof a === "object" && !Array.isArray(a) && "__redacted" in a) || (b && typeof b === "object" && !Array.isArray(b) && "__redacted" in b)) {
      if (JSON.stringify(a) !== JSON.stringify(b)) changes.push({ kind: "changed", path, category: diffCategory(path, resource), before: diffPreview(a), after: diffPreview(b) });
      else unchanged++;
      return;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      const len = Math.max(a.length, b.length);
      for (let i = 0; i < len; i++) walk(a[i], b[i], `${path}/${i}`);
      return;
    }
    if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
      const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
      for (const key of keys) walk((a as Record<string, DiffValue>)[key], (b as Record<string, DiffValue>)[key], `${path}/${pointer(key)}`);
      return;
    }
    if (JSON.stringify(a) === JSON.stringify(b)) unchanged++;
    else changes.push({ kind: "changed", path, category: diffCategory(path, resource), before: diffPreview(a), after: diffPreview(b) });
  };
  walk(base, target, "");
  changes.sort((x, y) => x.path.localeCompare(y.path) || x.kind.localeCompare(y.kind));
  return { changes, unchanged };
}

function versionMetadata(row: any, resource: "masterplan" | "page") {
  return { id: row.id, [resource === "masterplan" ? "version" : "revision"]: resource === "masterplan" ? row.version : row.revision,
    label: `${resource === "masterplan" ? "v" : "r"}${resource === "masterplan" ? row.version : row.revision}`,
    status: row.status, createdAt: row.createdAt, contentHash: row.contentHash };
}

export async function getCampaignControlRoomVersionSources(campaignId: string, workspaceId: string) {
  const [campaign] = await db.select({ id: campaignsTable.id }).from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId))).limit(1);
  if (!campaign) throw new NotFoundError("Campaign");
  const [masters, masterCountRows, pages] = await Promise.all([
    db.select({ id: masterplanVersionsTable.id, version: masterplanVersionsTable.version, status: masterplanVersionsTable.status, createdAt: masterplanVersionsTable.createdAt, contentHash: masterplanVersionsTable.contentHash })
      .from(masterplanVersionsTable).where(and(eq(masterplanVersionsTable.workspaceId, workspaceId), eq(masterplanVersionsTable.campaignId, campaignId))).orderBy(desc(masterplanVersionsTable.version)).limit(100),
    db.select({ total: count() }).from(masterplanVersionsTable).where(and(eq(masterplanVersionsTable.workspaceId, workspaceId), eq(masterplanVersionsTable.campaignId, campaignId))),
    db.select({ id: pagesTable.id, title: pagesTable.title, type: pagesTable.type, status: pagesTable.status, updatedAt: pagesTable.updatedAt })
      .from(pagesTable).where(and(eq(pagesTable.workspaceId, workspaceId), eq(pagesTable.campaignId, campaignId))).orderBy(pagesTable.id).limit(100),
  ]);
  const pageSources = await Promise.all(pages.map(async page => {
    const [revisions, revisionCountRows] = await Promise.all([db.select({ id: landingRevisionsTable.id, revision: landingRevisionsTable.revision, status: landingRevisionsTable.status, createdAt: landingRevisionsTable.createdAt, contentHash: landingRevisionsTable.contentHash })
      .from(landingRevisionsTable).where(and(eq(landingRevisionsTable.workspaceId, workspaceId), eq(landingRevisionsTable.pageId, page.id))).orderBy(desc(landingRevisionsTable.revision)).limit(100),
      db.select({ total: count() }).from(landingRevisionsTable).where(and(eq(landingRevisionsTable.workspaceId, workspaceId), eq(landingRevisionsTable.pageId, page.id)))]);
    const versionCount = Number(revisionCountRows[0]?.total ?? 0);
    return { id: page.id, kind: "page", label: page.title.slice(0, 512), historyAvailable: versionCount > 0, comparable: versionCount >= 2, versionCount, catalogTruncated: versionCount > revisions.length, ...(revisions.length ? { versions: revisions.map(r => versionMetadata(r, "page")) } : { reason: "history_not_persisted" }), current: { id: page.id, status: page.status, updatedAt: page.updatedAt } };
  }));
  const masterVersionCount = Number(masterCountRows[0]?.total ?? 0);
  return { schemaVersion: 1, sources: [
    { id: "masterplan", kind: "masterplan", label: "Masterplan", historyAvailable: masterVersionCount > 0, comparable: masterVersionCount >= 2, versionCount: masterVersionCount, catalogTruncated: masterVersionCount > masters.length, ...(masters.length ? { versions: masters.map(r => versionMetadata(r, "masterplan")) } : { reason: "history_not_persisted" }) },
    ...pageSources,
    ...(["content_piece", "media_brief", "creative", "social_post", "campaign_asset", "video_project"].map(kind => ({ id: kind, kind, label: kind, historyAvailable: false, comparable: false, versionCount: 0, catalogTruncated: false, reason: "history_not_persisted" }))),
  ] };
}

export async function getCampaignControlRoomVersionDiff(campaignId: string, workspaceId: string, input: { resource: "masterplan" | "page"; sourceId?: string; baseId: string; targetId: string; maxChanges: number }) {
  if (!UUID.test(campaignId) || !UUID.test(input.baseId) || !UUID.test(input.targetId) || (input.sourceId && !UUID.test(input.sourceId))) throw new ValidationError("Invalid version identifiers");
  if (input.baseId === input.targetId || (input.resource === "page" && !input.sourceId) || (input.resource === "masterplan" && input.sourceId)) throw new ValidationError("Invalid diff combination");
  const [campaign] = await db.select({ id: campaignsTable.id }).from(campaignsTable).where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId))).limit(1);
  if (!campaign) throw new NotFoundError("Campaign");
  if (input.resource === "masterplan") {
    const rows = await db.select().from(masterplanVersionsTable).where(and(eq(masterplanVersionsTable.workspaceId, workspaceId), eq(masterplanVersionsTable.campaignId, campaignId), inArray(masterplanVersionsTable.id, [input.baseId, input.targetId]))).limit(2);
    if (rows.length !== 2) throw new NotFoundError("Version");
    const base = rows.find(r => r.id === input.baseId)!; const target = rows.find(r => r.id === input.targetId)!;
    return buildDiffResponse("masterplan", undefined, base, target, input.maxChanges);
  }
  const [page] = await db.select({ id: pagesTable.id }).from(pagesTable).where(and(eq(pagesTable.id, input.sourceId!), eq(pagesTable.workspaceId, workspaceId), eq(pagesTable.campaignId, campaignId))).limit(1);
  if (!page) throw new NotFoundError("Page");
  const rows = await db.select().from(landingRevisionsTable).where(and(eq(landingRevisionsTable.workspaceId, workspaceId), eq(landingRevisionsTable.pageId, page.id), inArray(landingRevisionsTable.id, [input.baseId, input.targetId]))).limit(2);
  if (rows.length !== 2) throw new NotFoundError("Revision");
  return buildDiffResponse("page", page.id, rows.find(r => r.id === input.baseId)!, rows.find(r => r.id === input.targetId)!, input.maxChanges);
}

function buildDiffResponse(resource: "masterplan" | "page", sourceId: string | undefined, base: any, target: any, maxChanges: number) {
  const state: DiffBudget = { nodes: 0, incomplete: false, sentinel: false, items: 0, keys: 0 };
  const canonical = (row: any): DiffValue => resource === "masterplan" ? safeDiffValue(row.snapshot, 0, state) as DiffValue : safeDiffValue({ source: row.source, html: row.html }, 0, state) as DiffValue;
  const baseSafe = canonical(base);
  const targetSafe = canonical(target);
  const result = canonicalDiff(baseSafe, targetSafe, resource);
  const truncated = result.changes.length > maxChanges || state.incomplete;
  const summary = { added: result.changes.filter(c => c.kind === "added").length, removed: result.changes.filter(c => c.kind === "removed").length, changed: result.changes.filter(c => c.kind === "changed").length, unchanged: result.unchanged, truncated };
  const warnings = [];
  if (state.incomplete) warnings.push("comparison_incomplete_due_to_limits");
  if (containsLongDiffString(baseSafe) || containsLongDiffString(targetSafe)) warnings.push("values_truncated_to_preview_limit");
  if (result.changes.length > maxChanges) warnings.push("changes_truncated_to_maxChanges");
  const changes = result.changes.slice(0, maxChanges);
  while (changes.length && Buffer.byteLength(JSON.stringify(changes), "utf8") > 256_000) changes.pop();
  if (changes.length < Math.min(result.changes.length, maxChanges) && !warnings.includes("response_output_truncated_to_byte_limit")) warnings.push("response_output_truncated_to_byte_limit");
  return { schemaVersion: 1, available: true, resource, source: sourceId ? { id: sourceId } : { id: "masterplan" }, base: versionMetadata(base, resource), target: versionMetadata(target, resource), summary: { ...summary, truncated: summary.truncated || changes.length < Math.min(result.changes.length, maxChanges) }, changes, warnings };
}