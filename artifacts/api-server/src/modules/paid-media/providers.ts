import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import {
  db,
  paidMediaAccountsTable,
  workspaceIntegrationsTable,
} from "@workspace/db";
import { env } from "../../lib/env.js";
import { metaGraphFetch } from "../../lib/meta-graph.transport.js";
import {
  normalizeMetaAccounts,
  normalizeMetaInsights,
  normalizeTikTokAccounts,
  normalizeTikTokInsights,
  rollbackActionFromSnapshot,
  tikTokRefreshPersistence,
  verifyActionSnapshot,
} from "./paid-media.domain.js";
import { isPaidMediaIntegration } from "../integrations/integration-purpose.js";

export type PaidMediaProviderName = "meta_ads" | "tiktok_ads" | "google_ads";
export type PaidMediaEntityKind = "campaign" | "ad_set" | "ad" | "creative";

export type ProviderAccount = {
  providerAccountId: string;
  name: string;
  currency: string;
  timezone: string;
  testAccount?: boolean;
};

export type ProviderEntity = {
  providerEntityId: string;
  entityType: PaidMediaEntityKind;
  parentProviderEntityId?: string;
  name?: string;
  status?: string;
  version?: string;
  data: Record<string, unknown>;
};

export type ProviderInsight = {
  providerInsightId?: string;
  providerEntityId: string;
  metricDate: string;
  attributionWindow?: string;
  currency: string;
  timezone: string;
  impressions: number;
  clicks: number;
  spend: string;
  conversions: string;
  conversionValue: string;
  rawMetrics: Record<string, unknown>;
};

export type ProviderAction = {
  type: "pause" | "resume" | "update_daily_budget" | "update_bid" | "update_creative_status" | "update_creative_rotation";
  entityId: string;
  entityType: PaidMediaEntityKind;
  expectedVersion?: string;
  changes: Record<string, unknown>;
  idempotencyKey: string;
};

export type ProviderActionResult = {
  providerRequestId?: string;
  evidence: Record<string, unknown>;
};
export type LaunchCreateResult = { providerEntityId: string; entityType: PaidMediaEntityKind; parentProviderEntityId?: string; evidence: Record<string, unknown> };
export type MetaLaunchTransport = (path: string, payload: Record<string, unknown>, idempotencyKey: string) => Promise<Record<string, unknown>>;

/** Provider-free deterministic executor seam used by the Meta adapter and tests. */
export async function executeMetaLaunchTree(
  accountId: string, tree: Record<string, unknown>, transport: MetaLaunchTransport,
): Promise<LaunchCreateResult[]> {
  const created: LaunchCreateResult[] = [];
  const create = async (path: string, payload: Record<string, unknown>, key: string, entityType: PaidMediaEntityKind, parentProviderEntityId?: string) => {
    const body = await transport(path, { ...payload, status: "PAUSED" }, key);
    const id = String(body["id"] ?? "");
    if (!id || String(body["status"] ?? "PAUSED") !== "PAUSED") throw new PaidMediaProviderError("Meta create readback verification failed.", "PROVIDER_ERROR", 502);
    const result = { providerEntityId: id, entityType, parentProviderEntityId, evidence: body };
    created.push(result); return result;
  };
  const campaign = (tree["campaign"] ?? {}) as Record<string, unknown>;
  const key = String(tree["idempotencyKey"] ?? createHash("sha256").update(JSON.stringify(tree)).digest("hex"));
  try {
    const campaignResult = await create(`${accountId}/campaigns`, { name: campaign["name"], objective: campaign["objective"], special_ad_categories: [] }, `${key}:campaign`, "campaign");
    for (const group of ((tree["adGroups"] ?? []) as Array<Record<string, unknown>>)) {
      const groupResult = await create(`${accountId}/adsets`, { name: group["key"], campaign_id: campaignResult.providerEntityId, billing_event: "IMPRESSIONS", optimization_goal: "LINK_CLICKS", daily_budget: campaign["budget"], targeting: group["targeting"] ?? {} }, `${key}:${group["key"]}`, "ad_set", campaignResult.providerEntityId);
      for (const ad of ((group["ads"] ?? []) as Array<Record<string, unknown>>)) {
        const creative = (ad["creative"] ?? {}) as Record<string, unknown>;
        const creativeResult = await create(`${accountId}/adcreatives`, { name: ad["key"], object_story_spec: creative["object_story_spec"] ?? {} }, `${key}:${ad["key"]}:creative`, "creative", groupResult.providerEntityId);
        await create(`${accountId}/ads`, { name: ad["key"], adset_id: groupResult.providerEntityId, creative: { creative_id: creativeResult.providerEntityId } }, `${key}:${ad["key"]}:ad`, "ad", groupResult.providerEntityId);
      }
    }
    return created;
  } catch (error) {
    for (const item of [...created].reverse()) {
      try { await transport(item.providerEntityId, { __delete: true }, `${key}:rollback:${item.providerEntityId}`); } catch { /* preserve original error */ }
    }
    throw error;
  }
}

export type PaidMediaProviderCapabilities = {
  launchTreeCreation: "supported" | "unsupported";
  creativePause: "supported" | "unsupported";
  pixelDatasetDiagnostics: "supported" | "unsupported";
  cboAboObservation: "supported" | "unsupported";
  conversionsApi: "supported" | "unsupported";
  operations?: Partial<Record<"campaign" | "adGroup" | "ad" | "audience" | "conversion", "supported" | "unsupported">>;
  reason?: string;
};
export type MetaCapiEvent = {
  eventName: string;
  eventId: string;
  eventTime: Date;
  userData: Record<string, string>;
  customData: Record<string, unknown>;
};
export type ProviderConversionResult = { providerRequestId?: string; evidence: Record<string, unknown> };
export type ProviderHttpTransport = (url: string, init: RequestInit) => Promise<Response>;
export type MetaCapiTransport = ProviderHttpTransport;

export class PaidMediaProviderError extends Error {
  constructor(
    message: string,
    public readonly code: "AUTH" | "RATE_LIMITED" | "UNSUPPORTED" | "PRECONDITION_FAILED" | "PROVIDER_ERROR",
    public readonly status?: number,
  ) {
    super(message);
    this.name = "PaidMediaProviderError";
  }
}

export interface PaidMediaProviderAdapter {
  readonly provider: PaidMediaProviderName;
  listAccounts(workspaceId: string): Promise<ProviderAccount[]>;
  listAccountsForIntegration?(workspaceId: string, integrationId: string): Promise<ProviderAccount[]>;
  listEntities(workspaceId: string, accountId: string, type: PaidMediaEntityKind): Promise<ProviderEntity[]>;
  fetchInsights(workspaceId: string, accountId: string, type: PaidMediaEntityKind, since: string, until: string): Promise<ProviderInsight[]>;
  getEntitySnapshot(workspaceId: string, accountId: string, entityId: string, type: PaidMediaEntityKind): Promise<ProviderEntity>;
  applyAction(workspaceId: string, accountId: string, action: ProviderAction): Promise<ProviderActionResult>;
  verifyAction(workspaceId: string, accountId: string, action: ProviderAction): Promise<{ verified: boolean; evidence: Record<string, unknown> }>;
  rollbackAction(workspaceId: string, accountId: string, action: ProviderAction, before: ProviderEntity): Promise<ProviderActionResult>;
  refreshCredential(workspaceId: string): Promise<void>;
  capabilities(): PaidMediaProviderCapabilities;
  sendConversionEvent(workspaceId: string, accountId: string, datasetId: string, event: MetaCapiEvent): Promise<ProviderConversionResult>;
  /** @deprecated Launch orchestration uses the ordered single-step methods below. */
  createLaunchTree?(workspaceId: string, accountId: string, tree: Record<string, unknown>, idempotencyKey: string): Promise<LaunchCreateResult[]>;
  createLaunchEntity?(workspaceId: string, accountId: string, type: PaidMediaEntityKind, payload: Record<string, unknown>, idempotencyKey: string): Promise<LaunchCreateResult>;
  readLaunchEntity?(workspaceId: string, accountId: string, type: PaidMediaEntityKind, entityId: string): Promise<ProviderEntity>;
  verifyLaunchEntityAbsence?(workspaceId: string, accountId: string, type: PaidMediaEntityKind, entityId: string): Promise<{ absent: boolean; evidence: Record<string, unknown> }>;
  deleteEntity?(workspaceId: string, accountId: string, entityId: string, idempotencyKey: string): Promise<ProviderActionResult>;
}

type Credential = { integrationId: string; accessToken: string; refreshToken: string | null; expiresAt: Date | null; metadata: Record<string, unknown> };

export function selectPaidMediaCredential<Row extends { metadata: unknown }>(rows: Row[]): Row | undefined {
  return rows.find((row) => isPaidMediaIntegration(row.metadata as Record<string, unknown>));
}

function redact(value: string): string {
  return value
    .replace(/access_token=[^&\s]+/gi, "access_token=[REDACTED]")
    .replace(/("?(?:access_)?token"?\s*[:=]\s*"?)[^",\s}]+/gi, "$1[REDACTED]");
}

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/** Builds the narrow, consent-safe payload accepted by Meta's /{pixel}/events endpoint. */
export function normalizeMetaCapiEvent(input: {
  eventName: unknown; eventId: unknown; occurredAt: unknown;
  matchKeys?: Record<string, unknown>; payload?: Record<string, unknown>;
}): MetaCapiEvent {
  if (typeof input.eventName !== "string" || !/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(input.eventName)
    || typeof input.eventId !== "string" || !input.eventId) throw new PaidMediaProviderError("Meta event name and event_id are invalid.", "PRECONDITION_FAILED", 400);
  const eventTime = new Date(String(input.occurredAt));
  if (Number.isNaN(eventTime.getTime())) throw new PaidMediaProviderError("Meta event time is invalid.", "PRECONDITION_FAILED", 400);
  const match = input.matchKeys ?? {};
  const raw = (key: string) => typeof match[key] === "string" && match[key].trim() ? String(match[key]) : undefined;
  const userData: Record<string, string> = {};
  const email = raw("email"); if (email) userData["em"] = sha256(email);
  const phone = raw("phone"); if (phone) userData["ph"] = sha256(phone.replace(/\D/g, ""));
  const externalId = raw("externalId"); if (externalId) userData["external_id"] = sha256(externalId);
  for (const key of ["fbp", "fbc"] as const) { const value = raw(key); if (value) userData[key] = value; }
  const payload = input.payload ?? {};
  const customData: Record<string, unknown> = {};
  if (typeof payload["currency"] === "string" && /^[A-Z]{3}$/.test(payload["currency"])) customData["currency"] = payload["currency"];
  if (typeof payload["value"] === "number" && Number.isFinite(payload["value"]) && payload["value"] >= 0) customData["value"] = payload["value"];
  if (typeof payload["orderId"] === "string") customData["order_id"] = payload["orderId"];
  if (Array.isArray(payload["contentIds"]) && payload["contentIds"].every((item) => typeof item === "string")) customData["content_ids"] = payload["contentIds"];
  if (typeof payload["contentType"] === "string") customData["content_type"] = payload["contentType"];
  return { eventName: input.eventName, eventId: input.eventId, eventTime, userData, customData };
}

/** Exported adapter seam: tests can supply a fake transport without touching global fetch. */
export async function sendMetaCapiRequest(
  pixelId: string, token: string, event: MetaCapiEvent, transport: MetaCapiTransport = metaGraphFetch,
): Promise<ProviderConversionResult> {
  if (!pixelId) throw new PaidMediaProviderError("Meta pixel/dataset external ID is required.", "PRECONDITION_FAILED", 409);
  const response = await transport(`https://graph.facebook.com/v20.0/${encodeURIComponent(pixelId)}/events`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-NexOS-Idempotency-Key": event.eventId },
    body: JSON.stringify({ data: [{ event_name: event.eventName, event_time: Math.floor(event.eventTime.getTime() / 1000), event_id: event.eventId, action_source: "website", user_data: event.userData, ...(Object.keys(event.customData).length ? { custom_data: event.customData } : {}) }], access_token: token }),
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const raw = redact(JSON.stringify(body));
    if (response.status === 401 || response.status === 403) throw new PaidMediaProviderError(`Meta Conversions API credential or scope was rejected: ${raw}`, "AUTH", response.status);
    if (response.status === 429) throw new PaidMediaProviderError("Meta Conversions API rate limit exceeded.", "RATE_LIMITED", response.status);
    throw new PaidMediaProviderError(`Meta Conversions API returned HTTP ${response.status}: ${raw}`, "PROVIDER_ERROR", response.status);
  }
  if (typeof body["events_received"] !== "number" || body["events_received"] < 1) {
    throw new PaidMediaProviderError("Meta Conversions API did not provide a receipt for the submitted event.", "PROVIDER_ERROR", 502);
  }
  return { providerRequestId: typeof body["trace_id"] === "string" ? body["trace_id"] : undefined, evidence: body };
}

async function credential(workspaceId: string, provider: PaidMediaProviderName, expectedIntegrationId?: string): Promise<Credential> {
  const rows = await db.select({
    integrationId: workspaceIntegrationsTable.id,
    accessToken: workspaceIntegrationsTable.accessToken,
    refreshToken: workspaceIntegrationsTable.refreshToken,
    expiresAt: workspaceIntegrationsTable.tokenExpiresAt,
    metadata: workspaceIntegrationsTable.metadata,
  }).from(workspaceIntegrationsTable).where(and(
    eq(workspaceIntegrationsTable.workspaceId, workspaceId),
    eq(workspaceIntegrationsTable.provider, provider),
    eq(workspaceIntegrationsTable.status, "connected"),
  ));
  // Do not use provider-only lookup: legacy Facebook Page rows use meta_ads.
  // integrationPurpose is required for new rows; isPaidMediaIntegration only
  // accepts the old paidMedia=true/no-pageId shape as migration compatibility.
  const row = expectedIntegrationId
    ? rows.find((candidate) => candidate.integrationId === expectedIntegrationId && isPaidMediaIntegration(candidate.metadata as Record<string, unknown>))
    : selectPaidMediaCredential(rows);
  if (!row?.accessToken) throw new PaidMediaProviderError("Paid-media integration is not connected.", "AUTH");
  return {
    integrationId: row.integrationId,
    accessToken: row.accessToken,
    refreshToken: row.refreshToken,
    expiresAt: row.expiresAt,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  };
}

/** Narrow transport seam for Google Ads contract tests and live receipts. */
export async function sendGoogleAdsRequest(
  path: string, token: string, developerToken: string, init: RequestInit,
  options: { loginCustomerId?: string; transport?: ProviderHttpTransport } = {},
): Promise<{ body: Record<string, unknown>; requestId?: string }> {
  if (!developerToken) throw new PaidMediaProviderError("Google Ads developer token is not configured.", "PRECONDITION_FAILED", 409);
  const response = await (options.transport ?? fetch)(`https://googleads.googleapis.com/v18/${path.replace(/^\//, "")}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "developer-token": developerToken,
      ...(options.loginCustomerId ? { "login-customer-id": options.loginCustomerId.replace(/\D/g, "") } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const details = redact(JSON.stringify(body));
    if (response.status === 401 || response.status === 403) throw new PaidMediaProviderError(`Google Ads authorization or developer-token access was rejected: ${details}`, "AUTH", response.status);
    if (response.status === 429) throw new PaidMediaProviderError("Google Ads rate limit exceeded.", "RATE_LIMITED", response.status);
    throw new PaidMediaProviderError(`Google Ads returned HTTP ${response.status}: ${details}`, "PROVIDER_ERROR", response.status);
  }
  return { body, requestId: response.headers.get("request-id") ?? undefined };
}

async function request(url: string, init: RequestInit, token?: string): Promise<Record<string, unknown>> {
  let response: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await (url.startsWith("https://graph.facebook.com/")
        ? metaGraphFetch(url, { ...init, signal: AbortSignal.timeout(15_000) })
        : fetch(url, { ...init, signal: AbortSignal.timeout(15_000) }));
      if (response.status !== 429 && response.status < 500) break;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** attempt)));
    } catch (error) {
      if (attempt === 2) throw new PaidMediaProviderError(`Provider request failed: ${redact(error instanceof Error ? error.message : String(error))}`, "PROVIDER_ERROR");
    }
  }
  if (!response) throw new PaidMediaProviderError("Provider request did not receive a response.", "PROVIDER_ERROR");
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const raw = typeof body["error"] === "object" ? JSON.stringify(body["error"]) : JSON.stringify(body);
    if (response.status === 401 || response.status === 403) throw new PaidMediaProviderError("Provider credential was rejected.", "AUTH", response.status);
    if (response.status === 429) throw new PaidMediaProviderError("Provider rate limit exceeded.", "RATE_LIMITED", response.status);
    throw new PaidMediaProviderError(`Provider returned HTTP ${response.status}: ${redact(raw)}`, "PROVIDER_ERROR", response.status);
  }
  // token is an argument only to make accidental future error interpolation harder.
  void token;
  return body;
}

function entityPath(type: PaidMediaEntityKind): string {
  if (type === "ad_set") return "adsets";
  if (type === "creative") return "adcreatives";
  return `${type}s`;
}

class MetaAdsAdapter implements PaidMediaProviderAdapter {
  readonly provider = "meta_ads" as const;
  private readonly base = "https://graph.facebook.com/v20.0";
  capabilities(): PaidMediaProviderCapabilities {
    return {
      launchTreeCreation: "supported",
      creativePause: "unsupported",
      pixelDatasetDiagnostics: "supported",
      cboAboObservation: "supported",
      conversionsApi: "supported",
      operations: { campaign: "supported", adGroup: "supported", ad: "supported" },
      reason: "Creative status mutation requires a provider-specific creative executor and is not sent by this adapter.",
    };
  }

  async refreshCredential(_workspaceId: string): Promise<void> {
    // Meta long-lived tokens are renewed by exchanging the current token. There
    // is no refresh_token; callers must reconnect if Meta rejects the exchange.
    throw new PaidMediaProviderError("Meta Ads credentials do not support refresh tokens; reconnect the integration.", "AUTH");
  }
  async sendConversionEvent(workspaceId: string, accountId: string, datasetId: string, event: MetaCapiEvent): Promise<ProviderConversionResult> {
    const [account] = await db.select({ integrationId: paidMediaAccountsTable.integrationId, provider: paidMediaAccountsTable.provider })
      .from(paidMediaAccountsTable).where(and(eq(paidMediaAccountsTable.id, accountId), eq(paidMediaAccountsTable.workspaceId, workspaceId))).limit(1);
    if (!account || account.provider !== this.provider) throw new PaidMediaProviderError("Dataset account ownership could not be verified.", "PRECONDITION_FAILED", 409);
    return sendMetaCapiRequest(datasetId, (await credential(workspaceId, this.provider, account.integrationId)).accessToken, event);
  }
  async createLaunchTree(workspaceId: string, accountId: string, tree: Record<string, unknown>, idempotencyKey: string): Promise<LaunchCreateResult[]> {
    const [account] = await db.select({ integrationId: paidMediaAccountsTable.integrationId, providerAccountId: paidMediaAccountsTable.providerAccountId }).from(paidMediaAccountsTable).where(and(eq(paidMediaAccountsTable.id, accountId), eq(paidMediaAccountsTable.workspaceId, workspaceId), eq(paidMediaAccountsTable.provider, this.provider))).limit(1);
    if (!account) throw new PaidMediaProviderError("Selected advertiser account is not owned by this workspace.", "PRECONDITION_FAILED", 409);
    const token = await this.token(workspaceId, account.integrationId);
    const advertiserId = account.providerAccountId;
    const campaign = (tree["campaign"] ?? {}) as Record<string, unknown>;
    const created: LaunchCreateResult[] = [];
    const post = async (path: string, payload: Record<string, unknown>, key: string, entityType: PaidMediaEntityKind, parentProviderEntityId?: string) => {
      const body = await request(this.url(path, token), { method: "POST", headers: { "Content-Type": "application/json", "X-NexOS-Idempotency-Key": key }, body: JSON.stringify({ ...payload, status: "PAUSED", access_token: token }) }, token);
      const id = String(body["id"] ?? "");
      if (!id) throw new PaidMediaProviderError("Meta did not return a created entity id.", "PROVIDER_ERROR", 502);
      const readback = await request(this.url(id, token, { fields: "id,status,name,updated_time" }), {}, token);
      if (String(readback["id"] ?? "") !== id || String(readback["status"] ?? "PAUSED") !== "PAUSED") throw new PaidMediaProviderError("Meta create readback verification failed.", "PROVIDER_ERROR", 502);
      const result = { providerEntityId: id, entityType, parentProviderEntityId, evidence: body };
      created.push(result); return result;
    };
    try {
      const campaignResult = await post(`${advertiserId}/campaigns`, { name: campaign["name"], objective: campaign["objective"], special_ad_categories: [] }, `${idempotencyKey}:campaign`, "campaign");
      for (const group of ((tree["adGroups"] ?? []) as Array<Record<string, unknown>>)) {
        const groupResult = await post(`${advertiserId}/adsets`, { name: group["key"], campaign_id: campaignResult.providerEntityId, billing_event: "IMPRESSIONS", optimization_goal: "LINK_CLICKS", ...(campaign["budgetKind"] === "daily" ? { daily_budget: group["budget"] } : {}), targeting: group["targeting"] ?? {} }, `${idempotencyKey}:${group["key"]}`, "ad_set", campaignResult.providerEntityId);
        for (const ad of ((group["ads"] ?? []) as Array<Record<string, unknown>>)) {
          const creative = (ad["creative"] ?? {}) as Record<string, unknown>;
          const creativeResult = await post(`${advertiserId}/adcreatives`, { name: ad["key"], object_story_spec: creative["object_story_spec"] ?? {} }, `${idempotencyKey}:${ad["key"]}:creative`, "creative", groupResult.providerEntityId);
          await post(`${advertiserId}/ads`, { name: ad["key"], adset_id: groupResult.providerEntityId, creative: { creative_id: creativeResult.providerEntityId } }, `${idempotencyKey}:${ad["key"]}:ad`, "ad", groupResult.providerEntityId);
        }
      }
    } catch (error) {
      for (const item of [...created].reverse()) {
        try { await this.deleteEntity(workspaceId, accountId, item.providerEntityId, `${idempotencyKey}:rollback:${item.providerEntityId}`); } catch { /* preserve original provider error */ }
      }
      throw error;
    }
    return created;
  }
  async deleteEntity(workspaceId: string, accountId: string, entityId: string, idempotencyKey: string): Promise<ProviderActionResult> {
    const [account] = await db.select({ integrationId: paidMediaAccountsTable.integrationId }).from(paidMediaAccountsTable).where(and(eq(paidMediaAccountsTable.id, accountId), eq(paidMediaAccountsTable.workspaceId, workspaceId), eq(paidMediaAccountsTable.provider, this.provider))).limit(1);
    if (!account) throw new PaidMediaProviderError("Selected advertiser account is not owned by this workspace.", "PRECONDITION_FAILED", 409);
    const token = await this.token(workspaceId, account.integrationId);
    const body = await request(this.url(entityId, token), { method: "DELETE", headers: { "X-NexOS-Idempotency-Key": idempotencyKey } }, token);
    return { providerRequestId: entityId, evidence: body };
  }
  async createLaunchEntity(workspaceId: string, accountId: string, type: PaidMediaEntityKind, payload: Record<string, unknown>, idempotencyKey: string): Promise<LaunchCreateResult> {
    const [account] = await db.select({ integrationId: paidMediaAccountsTable.integrationId, providerAccountId: paidMediaAccountsTable.providerAccountId }).from(paidMediaAccountsTable).where(and(eq(paidMediaAccountsTable.id, accountId), eq(paidMediaAccountsTable.workspaceId, workspaceId), eq(paidMediaAccountsTable.provider, this.provider))).limit(1);
    if (!account) throw new PaidMediaProviderError("Selected advertiser account is not owned by this workspace.", "PRECONDITION_FAILED", 409);
    const token = await this.token(workspaceId, account.integrationId);
    const body = await request(this.url(`${account.providerAccountId}/${entityPath(type)}`, token), { method: "POST", headers: { "Content-Type": "application/json", "X-NexOS-Idempotency-Key": idempotencyKey }, body: JSON.stringify({ ...payload, status: "PAUSED", access_token: token }) }, token);
    const id = String(body["id"] ?? "");
    if (!id) throw new PaidMediaProviderError("Meta did not return a created entity id.", "PROVIDER_ERROR", 502);
    return { providerEntityId: id, entityType: type, parentProviderEntityId: typeof payload["campaign_id"] === "string" ? payload["campaign_id"] : typeof payload["adset_id"] === "string" ? payload["adset_id"] : undefined, evidence: body };
  }
  async readLaunchEntity(workspaceId: string, accountId: string, type: PaidMediaEntityKind, entityId: string): Promise<ProviderEntity> {
    const entity = await this.getEntitySnapshot(workspaceId, accountId, entityId, type);
    if (!entity.providerEntityId) throw new PaidMediaProviderError("Meta launch readback did not return an id.", "PROVIDER_ERROR", 502);
    return entity;
  }
  async verifyLaunchEntityAbsence(workspaceId: string, accountId: string, type: PaidMediaEntityKind, entityId: string) {
    try {
      await this.readLaunchEntity(workspaceId, accountId, type, entityId);
      return { absent: false, evidence: { id: entityId } };
    } catch (error) {
      if (error instanceof PaidMediaProviderError && error.status === 404) return { absent: true, evidence: { status: 404, id: entityId } };
      throw error;
    }
  }

  private async token(workspaceId: string, integrationId?: string): Promise<string> {
    return (await credential(workspaceId, this.provider, integrationId)).accessToken;
  }
  private url(path: string, token: string, params: Record<string, string> = {}): string {
    const query = new URLSearchParams({ ...params, access_token: token });
    return `${this.base}/${path}?${query}`;
  }

  async listAccounts(workspaceId: string): Promise<ProviderAccount[]> {
    const token = await this.token(workspaceId);
    const data = await request(this.url("me/adaccounts", token, { fields: "id,name,currency,timezone_name", limit: "500" }), {}, token);
    const rows = Array.isArray(data["data"]) ? data["data"] as Array<Record<string, unknown>> : [];
    return normalizeMetaAccounts(rows);
  }
  async listAccountsForIntegration(workspaceId: string, integrationId: string): Promise<ProviderAccount[]> {
    const token = await this.token(workspaceId, integrationId);
    const data = await request(this.url("me/adaccounts", token, { fields: "id,name,currency,timezone_name", limit: "500" }), {}, token);
    const rows = Array.isArray(data["data"]) ? data["data"] as Array<Record<string, unknown>> : [];
    return normalizeMetaAccounts(rows);
  }

  async listEntities(workspaceId: string, accountId: string, type: PaidMediaEntityKind): Promise<ProviderEntity[]> {
    const token = await this.token(workspaceId);
    const fields = "id,name,status,updated_time,campaign_id,adset_id,daily_budget,bid_amount,campaign_budget_optimization";
    const data = await request(this.url(`${accountId}/${entityPath(type)}`, token, { fields, limit: "500" }), {}, token);
    const rows = Array.isArray(data["data"]) ? data["data"] as Array<Record<string, unknown>> : [];
    return rows.map((row) => ({
      providerEntityId: String(row["id"]),
      entityType: type,
      parentProviderEntityId: String(row[type === "ad" ? "adset_id" : type === "ad_set" ? "campaign_id" : ""] ?? "") || undefined,
      name: typeof row["name"] === "string" ? row["name"] : undefined,
      status: typeof row["status"] === "string" ? row["status"] : undefined,
      version: typeof row["updated_time"] === "string" ? row["updated_time"] : undefined,
      data: row,
    }));
  }

  async fetchInsights(workspaceId: string, accountId: string, type: PaidMediaEntityKind, since: string, until: string): Promise<ProviderInsight[]> {
    const token = await this.token(workspaceId);
    const level = type === "ad_set" ? "adset" : type;
    const data = await request(this.url(`${accountId}/insights`, token, {
      level, time_range: JSON.stringify({ since, until }), time_increment: "1",
      fields: "id,date_start,impressions,clicks,spend,actions,action_values,account_currency",
    }), {}, token);
    const rows = Array.isArray(data["data"]) ? data["data"] as Array<Record<string, unknown>> : [];
    return normalizeMetaInsights(rows);
  }

  async getEntitySnapshot(workspaceId: string, accountId: string, entityId: string, type: PaidMediaEntityKind): Promise<ProviderEntity> {
    const [account] = await db.select({ integrationId: paidMediaAccountsTable.integrationId }).from(paidMediaAccountsTable).where(and(eq(paidMediaAccountsTable.id, accountId), eq(paidMediaAccountsTable.workspaceId, workspaceId), eq(paidMediaAccountsTable.provider, this.provider))).limit(1);
    if (!account) throw new PaidMediaProviderError("Selected advertiser account is not owned by this workspace.", "PRECONDITION_FAILED", 409);
    const token = await this.token(workspaceId, account.integrationId);
    const data = await request(this.url(entityId, token, { fields: "id,name,status,daily_budget,lifetime_budget,start_time,end_time,campaign_id,adset_id,bid_amount,updated_time" }), {}, token);
    return { providerEntityId: String(data["id"]), entityType: type, name: data["name"] as string | undefined, status: data["status"] as string | undefined, version: data["updated_time"] as string | undefined, data };
  }

  async applyAction(workspaceId: string, _accountId: string, action: ProviderAction): Promise<ProviderActionResult> {
    const token = await this.token(workspaceId);
    const snapshot = await this.getEntitySnapshot(workspaceId, _accountId, action.entityId, action.entityType);
    if (action.expectedVersion && snapshot.version !== action.expectedVersion) throw new PaidMediaProviderError("Entity changed since proposal creation.", "PRECONDITION_FAILED", 409);
    const payload: Record<string, string> = { access_token: token };
    if (action.type === "pause") payload["status"] = "PAUSED";
    else if (action.type === "resume") payload["status"] = "ACTIVE";
    else if (action.type === "update_daily_budget") payload["daily_budget"] = String(action.changes["dailyBudget"]);
    else if (action.type === "update_bid") payload["bid_amount"] = String(action.changes["bidAmount"]);
    else throw new PaidMediaProviderError(`Meta does not support ${action.type} through this executor.`, "UNSUPPORTED");
    const body = await request(`${this.base}/${action.entityId}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-NexOS-Idempotency-Key": action.idempotencyKey }, body: new URLSearchParams(payload) }, token);
    return { providerRequestId: String(body["id"] ?? ""), evidence: body };
  }

  async verifyAction(workspaceId: string, accountId: string, action: ProviderAction) {
    const after = await this.getEntitySnapshot(workspaceId, accountId, action.entityId, action.entityType);
    return { verified: verifyActionSnapshot(action, after), evidence: after.data };
  }

  async rollbackAction(workspaceId: string, accountId: string, action: ProviderAction, before: ProviderEntity) {
    return this.applyAction(workspaceId, accountId, rollbackActionFromSnapshot(action, before));
  }
}

class TikTokAdsAdapter implements PaidMediaProviderAdapter {
  readonly provider = "tiktok_ads" as const;
  private readonly base = "https://business-api.tiktok.com/open_api/v1.3";
  capabilities(): PaidMediaProviderCapabilities {
    return {
      launchTreeCreation: "unsupported",
      creativePause: "unsupported",
      pixelDatasetDiagnostics: "unsupported",
      cboAboObservation: "supported",
      conversionsApi: "unsupported",
      reason: "TikTok creative-level mutation and Events API delivery are not enabled by this adapter; receipt delivery remains fail-closed.",
    };
  }
  async refreshCredential(workspaceId: string): Promise<void> {
    const cred = await credential(workspaceId, this.provider);
    if (!cred.refreshToken || !env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) throw new PaidMediaProviderError("TikTok Ads refresh token is unavailable; reconnect the integration.", "AUTH");
    const body = await request(`${this.base}/oauth2/refresh_token/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ app_id: env.TIKTOK_CLIENT_KEY, secret: env.TIKTOK_CLIENT_SECRET, grant_type: "refresh_token", refresh_token: cred.refreshToken }) });
    const data = body["data"] as Record<string, unknown> | undefined;
    if (!data?.["access_token"]) throw new PaidMediaProviderError("TikTok Ads did not return a refreshed credential.", "AUTH");
    await db.update(workspaceIntegrationsTable).set(tikTokRefreshPersistence(cred, data)).where(eq(workspaceIntegrationsTable.id, cred.integrationId));
  }
  async sendConversionEvent(_workspaceId: string, _accountId: string, _datasetId: string, _event: MetaCapiEvent): Promise<ProviderConversionResult> {
    throw new PaidMediaProviderError("TikTok Events API transport is not implemented by this adapter.", "UNSUPPORTED", 409);
  }
  private async token(workspaceId: string): Promise<string> {
    const cred = await credential(workspaceId, this.provider);
    if (cred.expiresAt && cred.expiresAt.getTime() < Date.now() + 60_000) { await this.refreshCredential(workspaceId); return (await credential(workspaceId, this.provider)).accessToken; }
    return cred.accessToken;
  }
  private async call(workspaceId: string, path: string, body: Record<string, unknown>) {
    const token = await this.token(workspaceId);
    const response = await request(`${this.base}${path}`, { method: "POST", headers: { "Content-Type": "application/json", "Access-Token": token }, body: JSON.stringify(body) }, token);
    const code = response["code"];
    if (code !== undefined && Number(code) !== 0) throw new PaidMediaProviderError(String(response["message"] ?? "TikTok Marketing API rejected the request."), Number(code) === 401 ? "AUTH" : "PROVIDER_ERROR");
    return response["data"] as Record<string, unknown> ?? {};
  }
  async listAccounts(workspaceId: string): Promise<ProviderAccount[]> {
    const data = await this.call(workspaceId, "/advertiser/info/", {});
    const rows = (data["list"] ?? data["data"] ?? []) as Array<Record<string, unknown>>;
    return normalizeTikTokAccounts(rows);
  }
  async listEntities(workspaceId: string, accountId: string, type: PaidMediaEntityKind): Promise<ProviderEntity[]> {
    const endpoint = type === "ad_set" ? "/adgroup/get/" : `/${type}/get/`;
    if (type === "creative") throw new PaidMediaProviderError("TikTok creative listing is not supported by this adapter.", "UNSUPPORTED");
    const data = await this.call(workspaceId, endpoint, { advertiser_id: accountId, page: 1, page_size: 100 });
    const rows = (data["list"] ?? []) as Array<Record<string, unknown>>;
    const idKey = type === "ad_set" ? "adgroup_id" : `${type}_id`;
    return rows.map((row) => ({ providerEntityId: String(row[idKey]), entityType: type, parentProviderEntityId: String(row[type === "ad" ? "adgroup_id" : type === "ad_set" ? "campaign_id" : ""] ?? "") || undefined, name: row["campaign_name"] as string | undefined, status: row["operation_status"] as string | undefined, version: row["modify_time"] as string | undefined, data: row }));
  }
  async fetchInsights(workspaceId: string, accountId: string, type: PaidMediaEntityKind, since: string, until: string): Promise<ProviderInsight[]> {
    const data = await this.call(workspaceId, "/report/integrated/get/", { advertiser_id: accountId, service_type: "AUCTION", report_type: "BASIC", data_level: type === "ad_set" ? "AUCTION_ADGROUP" : `AUCTION_${type.toUpperCase()}`, dimensions: ["stat_time_day"], metrics: ["spend", "impressions", "clicks", "conversion", "total_purchase_value"], start_date: since, end_date: until, page: 1, page_size: 1000 });
    const rows = (data["list"] ?? []) as Array<Record<string, unknown>>;
    return normalizeTikTokInsights(rows, type);
  }
  async getEntitySnapshot(workspaceId: string, accountId: string, entityId: string, type: PaidMediaEntityKind): Promise<ProviderEntity> {
    const entities = await this.listEntities(workspaceId, accountId, type);
    const entity = entities.find((value) => value.providerEntityId === entityId);
    if (!entity) throw new PaidMediaProviderError("TikTok entity was not found.", "PRECONDITION_FAILED", 404);
    return entity;
  }
  async applyAction(workspaceId: string, accountId: string, action: ProviderAction): Promise<ProviderActionResult> {
    if (!["pause", "resume", "update_daily_budget", "update_bid"].includes(action.type)) throw new PaidMediaProviderError(`TikTok does not support ${action.type} through this executor.`, "UNSUPPORTED");
    const before = await this.getEntitySnapshot(workspaceId, accountId, action.entityId, action.entityType);
    if (action.expectedVersion && before.version !== action.expectedVersion) throw new PaidMediaProviderError("Entity changed since proposal creation.", "PRECONDITION_FAILED", 409);
    const endpoint = action.entityType === "ad_set" ? "/adgroup/update/" : `/${action.entityType}/update/`;
    const idKey = action.entityType === "ad_set" ? "adgroup_id" : `${action.entityType}_id`;
    const patch = action.type === "pause" ? { operation_status: "DISABLE" } : action.type === "resume" ? { operation_status: "ENABLE" } : action.type === "update_daily_budget" ? { budget: action.changes["dailyBudget"], budget_mode: "BUDGET_MODE_DAY" } : { bid_price: action.changes["bidAmount"] };
    const data = await this.call(workspaceId, endpoint, { advertiser_id: accountId, [idKey]: action.entityId, ...patch });
    return { providerRequestId: String(data["request_id"] ?? ""), evidence: data };
  }
  async verifyAction(workspaceId: string, accountId: string, action: ProviderAction) {
    const after = await this.getEntitySnapshot(workspaceId, accountId, action.entityId, action.entityType);
    return { verified: verifyActionSnapshot(action, after), evidence: after.data };
  }
  async rollbackAction(workspaceId: string, accountId: string, action: ProviderAction, before: ProviderEntity) {
    return this.applyAction(workspaceId, accountId, rollbackActionFromSnapshot(action, before));
  }
}

class GoogleAdsAdapter implements PaidMediaProviderAdapter {
  readonly provider = "google_ads" as const;
  capabilities(): PaidMediaProviderCapabilities {
    return {
      launchTreeCreation: "unsupported",
      creativePause: "unsupported", pixelDatasetDiagnostics: "unsupported",
      cboAboObservation: "supported", conversionsApi: "unsupported",
      operations: { campaign: "supported", adGroup: "supported", ad: "supported", audience: "unsupported", conversion: "unsupported" },
      reason: "Google Ads API access is verified per customer with the configured developer token. Conversion imports and audience creation require separately reviewed Google Ads API features.",
    };
  }
  async refreshCredential(workspaceId: string): Promise<void> {
    const cred = await credential(workspaceId, this.provider);
    if (!cred.refreshToken || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new PaidMediaProviderError("Google Ads refresh token is unavailable; reconnect with offline access.", "AUTH");
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: cred.refreshToken, grant_type: "refresh_token" }),
    });
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok || typeof body["access_token"] !== "string") throw new PaidMediaProviderError("Google OAuth refresh was rejected; reconnect the integration.", "AUTH", response.status);
    await db.update(workspaceIntegrationsTable).set({
      accessToken: body["access_token"], tokenExpiresAt: typeof body["expires_in"] === "number" ? new Date(Date.now() + body["expires_in"] * 1000) : null,
    }).where(eq(workspaceIntegrationsTable.id, cred.integrationId));
  }
  async sendConversionEvent(): Promise<ProviderConversionResult> {
    throw new PaidMediaProviderError("Google Ads conversion imports are not enabled by this adapter.", "UNSUPPORTED", 409);
  }
  private async auth(workspaceId: string) {
    let cred = await credential(workspaceId, this.provider);
    if (cred.expiresAt && cred.expiresAt.getTime() < Date.now() + 60_000) { await this.refreshCredential(workspaceId); cred = await credential(workspaceId, this.provider); }
    return cred;
  }
  private async call(workspaceId: string, path: string, body: Record<string, unknown>) {
    const cred = await this.auth(workspaceId);
    return sendGoogleAdsRequest(path, cred.accessToken, env.GOOGLE_ADS_DEVELOPER_TOKEN, { method: "POST", body: JSON.stringify(body) }, {
      loginCustomerId: typeof cred.metadata["loginCustomerId"] === "string" ? cred.metadata["loginCustomerId"] : undefined,
    });
  }
  private async search(workspaceId: string, customerId: string, query: string) {
    return (await this.call(workspaceId, `customers/${customerId.replace(/\D/g, "")}/googleAds:searchStream`, { query })).body;
  }
  async listAccounts(workspaceId: string): Promise<ProviderAccount[]> {
    const accessible = (await this.call(workspaceId, "customers:listAccessibleCustomers", {})).body;
    const names = Array.isArray(accessible["resourceNames"]) ? accessible["resourceNames"].filter((value): value is string => typeof value === "string") : [];
    const accounts: ProviderAccount[] = [];
    for (const name of names) {
      const customerId = name.replace(/^customers\//, "").replace(/\D/g, "");
      if (!customerId) continue;
      const pages = await this.search(workspaceId, customerId, "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.test_account FROM customer LIMIT 1");
      const row = (Array.isArray(pages) ? pages : []).flatMap((page) => Array.isArray((page as Record<string, unknown>)["results"]) ? (page as Record<string, unknown>)["results"] as Array<Record<string, unknown>> : [])[0];
      const customer = row?.["customer"] as Record<string, unknown> | undefined;
      if (customer?.["id"]) accounts.push({ providerAccountId: String(customer["id"]), name: String(customer["descriptiveName"] ?? customer["id"]), currency: String(customer["currencyCode"] ?? "USD"), timezone: String(customer["timeZone"] ?? "UTC"), testAccount: customer["testAccount"] === true });
    }
    return accounts;
  }
  async listEntities(workspaceId: string, accountId: string, type: PaidMediaEntityKind): Promise<ProviderEntity[]> {
    if (type === "creative") throw new PaidMediaProviderError("Google Ads creative assets are not exposed as mutable paid-media creative entities.", "UNSUPPORTED");
    const resource = type === "ad_set" ? "ad_group" : type === "ad" ? "ad_group_ad" : "campaign";
    const fields = resource === "ad_group_ad" ? "ad_group_ad.ad.id, ad_group_ad.status, ad_group_ad.ad.name, ad_group_ad.resource_name" : resource === "ad_group" ? "ad_group.id, ad_group.name, ad_group.status, ad_group.cpc_bid_micros, ad_group.resource_name" : `${resource}.id, ${resource}.name, ${resource}.status, ${resource}.resource_name`;
    const pages = await this.search(workspaceId, accountId, `SELECT ${fields} FROM ${resource} LIMIT 10000`);
    const rows = (Array.isArray(pages) ? pages : []).flatMap((page) => Array.isArray((page as Record<string, unknown>)["results"]) ? (page as Record<string, unknown>)["results"] as Array<Record<string, unknown>> : []);
    return rows.map((row) => {
      const item = row[resource] as Record<string, unknown>;
      const ad = item?.["ad"] as Record<string, unknown> | undefined;
      const status = item?.["status"] === "ENABLED" ? "ENABLE" : String(item?.["status"] ?? "");
      const data = { ...row, bid_price: resource === "ad_group" && typeof item?.["cpcBidMicros"] === "string" ? String(Number(item["cpcBidMicros"]) / 1_000_000) : undefined };
      return { providerEntityId: String(ad?.["id"] ?? item?.["id"]), entityType: type, name: String(ad?.["name"] ?? item?.["name"] ?? ""), status, version: String(item?.["resourceName"] ?? ""), data };
    });
  }
  async fetchInsights(workspaceId: string, accountId: string, type: PaidMediaEntityKind, since: string, until: string): Promise<ProviderInsight[]> {
    if (type === "creative") throw new PaidMediaProviderError("Google Ads creative insights are unavailable.", "UNSUPPORTED");
    const resource = type === "ad_set" ? "ad_group" : type === "ad" ? "ad_group_ad" : "campaign";
    const id = resource === "ad_group_ad" ? "ad_group_ad.ad.id" : `${resource}.id`;
    const pages = await this.search(workspaceId, accountId, `SELECT ${id}, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM ${resource} WHERE segments.date BETWEEN '${since}' AND '${until}' LIMIT 100000`);
    return (Array.isArray(pages) ? pages : []).flatMap((page) => Array.isArray((page as Record<string, unknown>)["results"]) ? (page as Record<string, unknown>)["results"] as Array<Record<string, unknown>> : []).map((row) => {
      const item = row[resource] as Record<string, unknown>; const ad = item?.["ad"] as Record<string, unknown> | undefined; const metrics = row["metrics"] as Record<string, unknown> ?? {}; const segments = row["segments"] as Record<string, unknown> ?? {};
      return { providerEntityId: String(ad?.["id"] ?? item?.["id"]), metricDate: String(segments["date"]), currency: "USD", timezone: "UTC", impressions: Number(metrics["impressions"] ?? 0), clicks: Number(metrics["clicks"] ?? 0), spend: String(Number(metrics["costMicros"] ?? 0) / 1_000_000), conversions: String(metrics["conversions"] ?? 0), conversionValue: String(metrics["conversionsValue"] ?? 0), rawMetrics: row };
    });
  }
  async getEntitySnapshot(workspaceId: string, accountId: string, entityId: string, type: PaidMediaEntityKind) {
    const entity = (await this.listEntities(workspaceId, accountId, type)).find((value) => value.providerEntityId === entityId);
    if (!entity) throw new PaidMediaProviderError("Google Ads entity was not found.", "PRECONDITION_FAILED", 404);
    return entity;
  }
  async applyAction(workspaceId: string, accountId: string, action: ProviderAction): Promise<ProviderActionResult> {
    if (!["pause", "resume", "update_daily_budget", "update_bid"].includes(action.type) || action.entityType === "creative" || (action.type === "update_bid" && action.entityType !== "ad_set")) throw new PaidMediaProviderError(`Google Ads does not support ${action.type} for this entity.`, "UNSUPPORTED");
    const before = await this.getEntitySnapshot(workspaceId, accountId, action.entityId, action.entityType);
    if (action.expectedVersion && action.expectedVersion !== before.version) throw new PaidMediaProviderError("Entity changed since proposal creation.", "PRECONDITION_FAILED", 409);
    const resource = action.entityType === "ad_set" ? "adGroups" : action.entityType === "ad" ? "adGroupAds" : "campaigns";
    const resourceName = `customers/${accountId.replace(/\D/g, "")}/${resource}/${action.entityId}`;
    const field = action.type === "pause" || action.type === "resume" ? "status" : action.type === "update_bid" ? "cpc_bid_micros" : "campaign_budget";
    if (field === "campaign_budget") throw new PaidMediaProviderError("Google campaign budgets require an explicit budget resource and are not inferred from a campaign mutation.", "UNSUPPORTED");
    const value = field === "status" ? (action.type === "pause" ? "PAUSED" : "ENABLED") : Math.round(Number(action.changes["bidAmount"]) * 1_000_000);
    const { body, requestId } = await this.call(workspaceId, `customers/${accountId.replace(/\D/g, "")}/${resource}:mutate`, { operations: [{ update: { resourceName, [field]: value }, updateMask: field }], partialFailure: false, validateOnly: false });
    return { providerRequestId: requestId, evidence: body };
  }
  async verifyAction(workspaceId: string, accountId: string, action: ProviderAction) { const after = await this.getEntitySnapshot(workspaceId, accountId, action.entityId, action.entityType); return { verified: verifyActionSnapshot(action, after), evidence: after.data }; }
  async rollbackAction(workspaceId: string, accountId: string, action: ProviderAction, before: ProviderEntity) { return this.applyAction(workspaceId, accountId, rollbackActionFromSnapshot(action, before)); }
}

const adapters: Record<PaidMediaProviderName, PaidMediaProviderAdapter> = {
  meta_ads: new MetaAdsAdapter(),
  tiktok_ads: new TikTokAdsAdapter(),
  google_ads: new GoogleAdsAdapter(),
};

export function paidMediaProvider(provider: PaidMediaProviderName): PaidMediaProviderAdapter {
  return adapters[provider];
}

export function paidMediaProviderCapabilities(provider: PaidMediaProviderName): PaidMediaProviderCapabilities {
  return adapters[provider].capabilities();
}