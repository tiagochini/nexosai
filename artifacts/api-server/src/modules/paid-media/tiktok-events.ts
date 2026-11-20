import { PaidMediaProviderError, type MetaCapiEvent, type ProviderHttpTransport } from "./providers.js";

const eventNames: Record<string, string> = { PageView: "PageView", ViewContent: "ViewContent", Lead: "SubmitForm", CompleteRegistration: "CompleteRegistration", InitiateCheckout: "InitiateCheckout", Purchase: "Purchase", AddToCart: "AddToCart", SubmitForm: "SubmitForm" };
export function tikTokEventPayload(pixelCode: string, event: MetaCapiEvent) {
  const name = eventNames[event.eventName];
  if (!pixelCode || !name || !event.eventId || !Number.isFinite(event.eventTime.getTime())) throw new PaidMediaProviderError("TikTok: pixel, evento suportado, ID e data obrigatórios.", "PRECONDITION_FAILED", 422);
  const keys: Record<string, string> = { em: "email", ph: "phone", external_id: "external_id", client_ip_address: "ip", client_user_agent: "user_agent", ttclid: "ttclid", ttp: "ttp" };
  const user = Object.fromEntries(Object.entries(event.userData).filter(([key]) => keys[key]).map(([key, value]) => [keys[key], value]));
  if (!Object.keys(user).length) throw new PaidMediaProviderError("TikTok: identificador consentido obrigatório.", "PRECONDITION_FAILED", 422);
  return { event_source: "web", event_source_id: pixelCode, data: [{ event: name, event_id: event.eventId, event_time: Math.floor(event.eventTime.getTime() / 1000), user, ...(event.eventSourceUrl ? { page: { url: event.eventSourceUrl } } : {}), properties: event.customData }] };
}
export async function sendTikTokEvent(pixelCode: string, token: string, event: MetaCapiEvent, transport: ProviderHttpTransport = fetch) {
  const response = await transport("https://business-api.tiktok.com/open_api/v1.3/event/track/", { method: "POST", signal: AbortSignal.timeout(30_000), headers: { "Content-Type": "application/json", "Access-Token": token }, body: JSON.stringify(tikTokEventPayload(pixelCode, event)) });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || body.code !== 0 || typeof body.request_id !== "string" || !body.request_id) throw new PaidMediaProviderError("TikTok Events API não confirmou a aceitação do evento.", response.status === 429 ? "RATE_LIMITED" : response.status === 401 || response.status === 403 ? "AUTH" : "PROVIDER_ERROR", response.ok ? typeof body.code === "number" && body.code !== 0 ? 422 : 502 : response.status);
  return { providerRequestId: body.request_id, evidence: { code: 0, request_id: body.request_id, eventId: event.eventId, accepted: true, deliveryState: "provider_accepted" } };
}
