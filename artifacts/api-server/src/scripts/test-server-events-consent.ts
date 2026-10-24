import assert from "node:assert/strict";
import { createServerEventsRouter } from "../modules/server-events/server-events.routes.js";

const calls: Array<{ workspaceId: string; eventName: string; eventId: string; customData?: unknown }> = [];
const router = createServerEventsRouter(async (workspaceId, eventName, eventId, _userData, customData) => {
  calls.push({ workspaceId, eventName, eventId, customData });
});
type RouteHandler = (req: unknown, res: unknown) => Promise<void>;
const layers = (router as unknown as { stack: Array<{ route?: { path: string; stack: Array<{ handle: RouteHandler }> } }> }).stack;
const routeHandler = (path: string) => {
  const route = layers.find((layer) => layer.route?.path === path)?.route;
  assert.ok(route, `route ${path} must exist`);
  return route.stack[0]!.handle;
};
const direct = routeHandler("/:workspaceId/track");
const bySequence = routeHandler("/sequence/:sequenceId/track");
function request(body: unknown, params: Record<string, string> = {}) {
  return { body, params, headers: {}, ip: "127.0.0.1", get: () => undefined };
}
function response() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(value: unknown) { this.body = value; return this; },
  };
}

  const withheld = response();
  await direct(request({ eventName: "Lead", eventId: "lead:stable-1", marketingConsent: false }, { workspaceId: "workspace-id" }), withheld);
  assert.equal(withheld.statusCode, 202);
  assert.deepEqual(withheld.body, { tracked: false, eventName: "Lead", reason: "consent_withheld" });
  assert.equal(calls.length, 0, "withheld consent must not dispatch to any provider");

  const sequenceWithheld = response();
  await bySequence(request({ eventName: "Purchase", eventId: "purchase:1", marketingConsent: false }, { sequenceId: "sequence-id" }), sequenceWithheld);
  assert.equal(sequenceWithheld.statusCode, 202, "withheld consent is handled before sequence lookup");
  assert.equal(calls.length, 0);

  const dataWithoutConsent = response();
  await direct(request({ eventName: "Lead", eventId: "lead:stable-2", marketingConsent: false, userData: { email: "person@example.test" } }, { workspaceId: "workspace-id" }), dataWithoutConsent);
  assert.equal(dataWithoutConsent.statusCode, 400, "personal event data must be omitted without consent");
  assert.equal(calls.length, 0);

  const missingEventId = response();
  await direct(request({ eventName: "Lead", marketingConsent: true }, { workspaceId: "workspace-id" }), missingEventId);
  assert.equal(missingEventId.statusCode, 400, "stable event_id is required for cross-channel dedupe");

  const accepted = response();
  const cartData = { currency: "BRL", value: 120, contentIds: ["sku-1"], contentType: "product", numItems: 2 };
  await direct(request({ eventName: "AddToCart", eventId: "cart:stable-3", marketingConsent: true, customData: cartData }, { workspaceId: "workspace-id" }), accepted);
  assert.equal(accepted.statusCode, 200);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(calls, [{ workspaceId: "workspace-id", eventName: "AddToCart", eventId: "cart:stable-3", customData: cartData }]);
  console.log("Server events consent boundary: PASS (explicit consent, no-consent dispatch blocked, stable event ID and AddToCart data forwarded)");
