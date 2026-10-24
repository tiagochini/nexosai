/**
 * Server-side events bridge — mirrors client events to ad platform APIs.
 * Supports: Meta CAPI, TikTok Events API.
 * Called after lead capture, purchase webhooks, and page-view tracking.
 */
import crypto from "node:crypto";
import { db, workspaceIntegrationsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "../../lib/logger.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value.toLowerCase().trim()).digest("hex");
}

function nowEpoch(): number {
  return Math.floor(Date.now() / 1000);
}

async function getWorkspaceIntegration(
  workspaceId: string,
  provider: "meta_ads" | "tiktok_ads" | "google_ads",
): Promise<{ accessToken: string | null; accountId: string | null } | null> {
  const [row] = await db
    .select({ accessToken: workspaceIntegrationsTable.accessToken, accountId: workspaceIntegrationsTable.accountId })
    .from(workspaceIntegrationsTable)
    .where(
      and(
        eq(workspaceIntegrationsTable.workspaceId, workspaceId),
        eq(workspaceIntegrationsTable.provider, provider),
        eq(workspaceIntegrationsTable.status, "connected"),
      ),
    )
    .limit(1);
  return row ?? null;
}

// ── Meta Conversions API (CAPI) ───────────────────────────────────────────────

export interface MetaEventData {
  eventName:
    | "PageView"
    | "ViewContent"
    | "Lead"
    | "InitiateCheckout"
    | "AddToCart"
    | "Purchase"
    | "CompleteRegistration"
    | "Subscribe"
    | "Schedule"
    | "Contact";
  eventId?: string;
  eventSourceUrl?: string;
  userData: {
    email?: string;
    phone?: string;
    externalId?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    clientIpAddress?: string;
    clientUserAgent?: string;
    fbp?: string;
    fbc?: string;
  };
  customData?: {
    currency?: string;
    value?: number;
    contentName?: string;
    contentCategory?: string;
    contentIds?: string[];
    contentType?: "product" | "product_group";
    numItems?: number;
    orderId?: string;
  };
}

export async function sendMetaCAPIEvent(
  workspaceId: string,
  event: MetaEventData,
): Promise<{ success: boolean; error?: string }> {
  const integration = await getWorkspaceIntegration(workspaceId, "meta_ads");
  if (!integration?.accessToken || !integration.accountId) {
    return { success: false, error: "Meta Ads integration not connected" };
  }

  const pixelId = integration.accountId;
  const accessToken = integration.accessToken;

  // Hash PII fields
  const userData: Record<string, string> = {};
  if (event.userData.email) userData["em"] = sha256(event.userData.email);
  if (event.userData.phone) userData["ph"] = sha256(event.userData.phone.replace(/\D/g, ""));
  if (event.userData.firstName) userData["fn"] = sha256(event.userData.firstName);
  if (event.userData.lastName) userData["ln"] = sha256(event.userData.lastName);
  if (event.userData.externalId) userData["external_id"] = sha256(event.userData.externalId);
  const city = event.userData.city?.trim().toLowerCase().replace(/[0-9.\s\-()]/g, "");
  const state = event.userData.state?.trim().toLowerCase().replace(/[0-9.\s\-()]/g, "");
  const postalCode = event.userData.postalCode?.trim().toLowerCase().replace(/\s/g, "").split("-")[0];
  const country = event.userData.country?.trim().toLowerCase();
  if (city) userData["ct"] = sha256(city);
  if (state) userData["st"] = sha256(state);
  if (postalCode) userData["zp"] = sha256(postalCode);
  if (country && /^[a-z]{2}$/.test(country)) userData["country"] = sha256(country);
  if (event.userData.clientIpAddress) userData["client_ip_address"] = event.userData.clientIpAddress;
  if (event.userData.clientUserAgent) userData["client_user_agent"] = event.userData.clientUserAgent;
  if (event.userData.fbp) userData["fbp"] = event.userData.fbp;
  if (event.userData.fbc) userData["fbc"] = event.userData.fbc;

  const payload = {
    data: [
      {
        event_name: event.eventName,
        event_time: nowEpoch(),
        event_id: event.eventId ?? crypto.randomUUID(),
        event_source_url: event.eventSourceUrl,
        action_source: "website",
        user_data: userData,
        custom_data: event.customData ? {
          ...(event.customData.currency ? { currency: event.customData.currency } : {}),
          ...(event.customData.value !== undefined ? { value: event.customData.value } : {}),
          ...(event.customData.contentName ? { content_name: event.customData.contentName } : {}),
          ...(event.customData.contentCategory ? { content_category: event.customData.contentCategory } : {}),
          ...(event.customData.contentIds ? { content_ids: event.customData.contentIds } : {}),
          ...(event.customData.contentType ? { content_type: event.customData.contentType } : {}),
          ...(event.customData.numItems !== undefined ? { num_items: event.customData.numItems } : {}),
          ...(event.customData.orderId ? { order_id: event.customData.orderId } : {}),
        } : undefined,
      },
    ],
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v26.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const json = (await res.json()) as { events_received?: number; error?: { message: string } };
    if (!res.ok || json.error) {
      logger.warn({ event: event.eventName, error: json.error?.message }, "Meta CAPI event failed");
      return { success: false, error: json.error?.message ?? "Meta API error" };
    }
    logger.info({ event: event.eventName, eventsReceived: json.events_received }, "Meta CAPI event sent");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ err: msg }, "Meta CAPI request failed");
    return { success: false, error: msg };
  }
}

// ── TikTok Events API ─────────────────────────────────────────────────────────

export interface TikTokEventData {
  eventName:
    | "ViewContent"
    | "ClickButton"
    | "Search"
    | "AddToWishlist"
    | "AddToCart"
    | "InitiateCheckout"
    | "PlaceAnOrder"
    | "CompletePayment"
    | "Contact"
    | "Download"
    | "SubmitForm"
    | "Subscribe"
    | "Registration";
  eventId?: string;
  pageUrl?: string;
  userData: {
    email?: string;
    phone?: string;
    externalId?: string;
    firstName?: string;
    lastName?: string;
    ip?: string;
    userAgent?: string;
    ttclid?: string;
  };
  properties?: {
    currency?: string;
    value?: number;
    content_type?: "product" | "product_group";
    contents?: Array<{
      content_id: string;
      content_name?: string;
      content_category?: string;
      quantity?: number;
    }>;
    order_id?: string;
  };
}

export async function sendTikTokEvent(
  workspaceId: string,
  event: TikTokEventData,
): Promise<{ success: boolean; error?: string }> {
  const integration = await getWorkspaceIntegration(workspaceId, "tiktok_ads");
  if (!integration?.accessToken || !integration.accountId) {
    return { success: false, error: "TikTok Ads integration not connected" };
  }

  const pixelCode = integration.accountId;
  const accessToken = integration.accessToken;

  const context: Record<string, unknown> = {
    page: { url: event.pageUrl },
    user: {
      ...(event.userData.email ? { email: sha256(event.userData.email) } : {}),
      ...(event.userData.phone ? { phone_number: sha256(event.userData.phone.replace(/\D/g, "")) } : {}),
      ...(event.userData.externalId ? { external_id: sha256(event.userData.externalId) } : {}),
      ...(event.userData.firstName ? { first_name: sha256(event.userData.firstName) } : {}),
      ...(event.userData.lastName ? { last_name: sha256(event.userData.lastName) } : {}),
      ...(event.userData.ip ? { ip: event.userData.ip } : {}),
      ...(event.userData.userAgent ? { user_agent: event.userData.userAgent } : {}),
      ...(event.userData.ttclid ? { ttclid: event.userData.ttclid } : {}),
    },
  };

  const payload = {
    pixel_code: pixelCode,
    event: event.eventName,
    event_id: event.eventId ?? crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    context,
    properties: event.properties ?? {},
  };

  try {
    const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/pixel/track/", {
      method: "POST",
      headers: {
        "Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const json = (await res.json()) as { code?: number; message?: string };
    if (!res.ok || (json.code !== undefined && json.code !== 0)) {
      logger.warn({ event: event.eventName, error: json.message }, "TikTok Events API failed");
      return { success: false, error: json.message ?? "TikTok API error" };
    }
    logger.info({ event: event.eventName }, "TikTok server event sent");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ err: msg }, "TikTok Events API request failed");
    return { success: false, error: msg };
  }
}

// ── Convenience: fire all connected platforms ─────────────────────────────────

export async function fireServerEvent(
  workspaceId: string,
  eventName: string,
  eventId: string,
  userData: {
    email?: string;
    phone?: string;
    externalId?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    ip?: string;
    userAgent?: string;
    fbp?: string;
    fbc?: string;
    ttclid?: string;
  },
  customData?: {
    currency?: string;
    value?: number;
    contentName?: string;
    contentCategory?: string;
    contentIds?: string[];
    contentType?: "product" | "product_group";
    numItems?: number;
    orderId?: string;
    eventSourceUrl?: string;
  },
): Promise<void> {
  const metaEventMap: Record<string, MetaEventData["eventName"]> = {
    Lead: "Lead",
    Purchase: "Purchase",
    PageView: "PageView",
    InitiateCheckout: "InitiateCheckout",
    AddToCart: "AddToCart",
    Subscribe: "Subscribe",
    Registration: "CompleteRegistration",
    CompleteRegistration: "CompleteRegistration",
    ViewContent: "ViewContent",
    Schedule: "Schedule",
    Contact: "Contact",
  };

  const tikTokEventMap: Record<string, TikTokEventData["eventName"]> = {
    Lead: "SubmitForm",
    Purchase: "CompletePayment",
    PageView: "ViewContent",
    InitiateCheckout: "InitiateCheckout",
    AddToCart: "AddToCart",
    Subscribe: "Subscribe",
    Registration: "Registration",
    CompleteRegistration: "Registration",
    ViewContent: "ViewContent",
    Contact: "Contact",
  };

  const metaEvent = metaEventMap[eventName];
  const tikTokEvent = tikTokEventMap[eventName];

  const results = await Promise.allSettled([
    metaEvent
      ? sendMetaCAPIEvent(workspaceId, {
          eventName: metaEvent,
          eventId,
          userData,
          eventSourceUrl: customData?.eventSourceUrl,
          customData: {
            currency: customData?.currency ?? "BRL",
            value: customData?.value,
            contentName: customData?.contentName,
            contentCategory: customData?.contentCategory,
            contentIds: customData?.contentIds,
            contentType: customData?.contentType,
            numItems: customData?.numItems,
            orderId: customData?.orderId,
          },
        })
      : Promise.resolve({ success: false, skipped: true as const }),
    tikTokEvent
      ? sendTikTokEvent(workspaceId, {
          eventName: tikTokEvent,
          eventId,
          pageUrl: customData?.eventSourceUrl,
          userData,
          properties: {
            currency: customData?.currency ?? "BRL",
            value: customData?.value,
            content_type: customData?.contentType,
            ...(customData?.contentIds?.length ? {
              contents: customData.contentIds.map((contentId) => ({
                content_id: contentId,
                ...(customData.contentName ? { content_name: customData.contentName } : {}),
                ...(customData.contentCategory ? { content_category: customData.contentCategory } : {}),
                ...(customData.contentIds!.length === 1 && customData.numItems !== undefined ? { quantity: customData.numItems } : {}),
              })),
            } : {}),
            order_id: customData?.orderId,
          },
        })
      : Promise.resolve({ success: false, skipped: true as const }),
  ]);

  const [metaResult, tikTokResult] = results;
  logger.info(
    {
      eventName,
      meta: metaResult.status === "fulfilled" ? metaResult.value : { success: false, error: String(metaResult.reason) },
      tiktok: tikTokResult.status === "fulfilled" ? tikTokResult.value : { success: false, error: String(tikTokResult.reason) },
    },
    "Server-side event fired",
  );
}
