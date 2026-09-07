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

export type PaidMediaProviderName = "meta_ads" | "tiktok_ads";
export type PaidMediaEntityKind = "campaign" | "ad_set" | "ad" | "creative";

export type ProviderAccount = {
  providerAccountId: string;
  name: string;
  currency: string;
  timezone: string;
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

export type PaidMediaProviderCapabilities = {
  creativePause: "supported" | "unsupported";
  pixelDatasetDiagnostics: "supported" | "unsupported";
  cboAboObservation: "supported" | "unsupported";
  conversionsApi: "supported" | "unsupported";
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
export type MetaCapiTransport = (url: string, init: RequestInit) => Promise<Response>;

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
  listEntities(workspaceId: string, accountId: string, type: PaidMediaEntityKind): Promise<ProviderEntity[]>;
  fetchInsights(workspaceId: string, accountId: string, type: PaidMediaEntityKind, since: string, until: string): Promise<ProviderInsight[]>;
  getEntitySnapshot(workspaceId: string, accountId: string, entityId: string, type: PaidMediaEntityKind): Promise<ProviderEntity>;
  applyAction(workspaceId: string, accountId: string, action: ProviderAction): Promise<ProviderActionResult>;
  verifyAction(workspaceId: string, accountId: string, action: ProviderAction): Promise<{ verified: boolean; evidence: Record<string, unknown> }>;
  rollbackAction(workspaceId: string, accountId: string, action: ProviderAction, before: ProviderEntity): Promise<ProviderActionResult>;
  refreshCredential(workspaceId: string): Promise<void>;
  capabilities(): PaidMediaProviderCapabilities;
  sendConversionEvent(workspaceId: string, accountId: string, datasetId: string, event: MetaCapiEvent): Promise<ProviderConversionResult>;
}

type Credential = { integrationId: string; accessToken: string; refreshToken: string | null; expiresAt: Date | null };

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
  };
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
      creativePause: "unsupported",
      pixelDatasetDiagnostics: "supported",
      cboAboObservation: "supported",
      conversionsApi: "supported",
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

  private async token(workspaceId: string): Promise<string> {
    return (await credential(workspaceId, this.provider)).accessToken;
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

  async getEntitySnapshot(workspaceId: string, _accountId: string, entityId: string, type: PaidMediaEntityKind): Promise<ProviderEntity> {
    const token = await this.token(workspaceId);
    const data = await request(this.url(entityId, token, { fields: "id,name,status,daily_budget,bid_amount,updated_time" }), {}, token);
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
      creativePause: "unsupported",
      pixelDatasetDiagnostics: "supported",
      cboAboObservation: "supported",
      conversionsApi: "unsupported",
      reason: "TikTok creative-level status mutation is not available through this executor.",
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

const adapters: Record<PaidMediaProviderName, PaidMediaProviderAdapter> = {
  meta_ads: new MetaAdsAdapter(),
  tiktok_ads: new TikTokAdsAdapter(),
};

export function paidMediaProvider(provider: PaidMediaProviderName): PaidMediaProviderAdapter {
  return adapters[provider];
}

export function paidMediaProviderCapabilities(provider: PaidMediaProviderName): PaidMediaProviderCapabilities {
  return adapters[provider].capabilities();
}