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
    | "Subscribe";
  eventId?: string;
  eventSourceUrl?: string;
  userData: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
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
        custom_data: event.customData,
      },
    ],
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${accessToken}`,
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
    ip?: string;
    userAgent?: string;
    ttclid?: string;
  };
  properties?: {
    currency?: string;
    value?: number;
    contentName?: string;
    contentId?: string;
    contentCategory?: string;
    quantity?: number;
    orderId?: string;
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
  userData: {
    email?: string;
    phone?: string;
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
    orderId?: string;
    eventSourceUrl?: string;
  },
): Promise<void> {
  const metaEventMap: Record<string, MetaEventData["eventName"]> = {
    Lead: "Lead",
    Purchase: "Purchase",
    PageView: "PageView",
    InitiateCheckout: "InitiateCheckout",
    Subscribe: "Subscribe",
    Registration: "CompleteRegistration",
  };

  const tikTokEventMap: Record<string, TikTokEventData["eventName"]> = {
    Lead: "SubmitForm",
    Purchase: "CompletePayment",
    PageView: "ViewContent",
    InitiateCheckout: "InitiateCheckout",
    Subscribe: "Subscribe",
    Registration: "Registration",
  };

  const metaEvent = metaEventMap[eventName];
  const tikTokEvent = tikTokEventMap[eventName];

  const results = await Promise.allSettled([
    metaEvent
      ? sendMetaCAPIEvent(workspaceId, {
          eventName: metaEvent,
          userData,
          eventSourceUrl: customData?.eventSourceUrl,
          customData: {
            currency: customData?.currency ?? "BRL",
            value: customData?.value,
            contentName: customData?.contentName,
            orderId: customData?.orderId,
          },
        })
      : Promise.resolve({ success: false, error: "No Meta mapping" }),
    tikTokEvent
      ? sendTikTokEvent(workspaceId, {
          eventName: tikTokEvent,
          pageUrl: customData?.eventSourceUrl,
          userData,
          properties: {
            currency: customData?.currency ?? "BRL",
            value: customData?.value,
            contentName: customData?.contentName,
            orderId: customData?.orderId,
          },
        })
      : Promise.resolve({ success: false, error: "No TikTok mapping" }),
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
