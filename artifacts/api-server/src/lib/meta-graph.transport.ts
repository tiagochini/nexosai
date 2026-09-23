import { createHash } from "node:crypto";
import { env } from "./env.js";

/**
 * The sole outbound seam for Graph requests used by product send paths.
 * E2E mode is deliberately process-local: it cannot persist credentials and it
 * never calls fetch.  Keep this module free of database dependencies so it is
 * safe to use while the database is unavailable during harness startup.
 */
export type SanitizedMetaGraphCall = {
  method: string;
  path: string;
  query: Record<string, string>;
  body?: unknown;
};

type MetaE2eLedger = {
  calls: SanitizedMetaGraphCall[];
  failOnceConsumed: boolean;
  publicationOwners: Record<string, string>;
};

// tsx can load the same TypeScript source through distinct resolved specifiers
// (for example an emitted ".js" import and a source import). Keep the E2E
// transport's deliberately process-local state on globalThis so all callers in
// this process observe one ledger. It remains isolated per Node process and is
// never used outside META_E2E_TEST_MODE.
const ledger = (() => {
  const globals = globalThis as typeof globalThis & {
    __nexosMetaE2eGraphLedger?: MetaE2eLedger;
  };
  return globals.__nexosMetaE2eGraphLedger ??= { calls: [], failOnceConsumed: false, publicationOwners: {} };
})();

export function isMetaE2eTestMode(): boolean {
  return env.META_E2E_TEST_MODE;
}

export function getMetaE2eGraphCalls(): readonly SanitizedMetaGraphCall[] {
  return ledger.calls.map((call) => structuredClone(call));
}

export function resetMetaE2eGraphCalls(): void {
  ledger.calls.length = 0;
  ledger.failOnceConsumed = false;
  ledger.publicationOwners = {};
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      /token|secret|authorization/i.test(key) ? "[REDACTED]" : redact(item),
    ]));
  }
  return value;
}

function fakeId(call: SanitizedMetaGraphCall): string {
  const digest = createHash("sha256")
    .update(`${call.method}:${call.path}:${JSON.stringify(call.query)}:${JSON.stringify(call.body)}`)
    .digest("hex")
    .slice(0, 16);
  return `e2e_graph_${digest}`;
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function sanitizedCall(input: string | URL | Request, init?: RequestInit): Promise<SanitizedMetaGraphCall> {
  const url = new URL(input instanceof Request ? input.url : input.toString());
  let body: unknown;
  const rawBody = init?.body;
  if (typeof rawBody === "string") {
    try { body = redact(JSON.parse(rawBody)); } catch { body = "[REDACTED_NON_JSON_BODY]"; }
  } else if (rawBody instanceof URLSearchParams) {
    body = redact(Object.fromEntries(rawBody.entries()));
  } else if (rawBody) {
    body = "[REDACTED_BINARY_BODY]";
  }
  return {
    method: (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase(),
    path: url.pathname,
    query: Object.fromEntries([...url.searchParams.entries()].map(([key, value]) => [
      key,
      /token|secret/i.test(key) ? "[REDACTED]" : value,
    ])),
    ...(body === undefined ? {} : { body }),
  };
}

function fakeBody(call: SanitizedMetaGraphCall): Record<string, unknown> {
  // These shapes cover publishing, comment replies, DMs, and the paid-media
  // adapter while remaining deterministic and intentionally non-production.
  if (call.path.endsWith("/insights")) return { data: [] };
  if (process.env["META_E2E_READBACK_SIMULATION"] === "true") {
    const accountFeed = call.path.match(/^\/v\d+(?:\.\d+)?\/([^/]+)\/feed$/);
    if (call.method === "POST" && accountFeed) {
      const id = fakeId(call);
      ledger.publicationOwners[id] = accountFeed[1]!;
      return { id };
    }
    const objectId = call.path.match(/^\/v\d+(?:\.\d+)?\/([^/]+)$/);
    if (call.method === "GET" && objectId && call.query.fields === "tasks") return { id: objectId[1], tasks: ["CREATE_CONTENT", "MANAGE"] };
    if (call.method === "GET" && objectId && ledger.publicationOwners[objectId[1]!]) {
      return { id: objectId[1], from: { id: ledger.publicationOwners[objectId[1]!] }, permalink_url: `https://example.invalid/${objectId[1]}` };
    }
    if (call.method === "GET" && objectId) return { id: objectId[1] };
  }
  if (call.path.endsWith("/comments")) return { data: [] };
  if (call.path.endsWith("/messages")) {
    const id = fakeId(call);
    return { id, recipient_id: "e2e_recipient", message_id: id };
  }
  if (call.path.endsWith("/me/adaccounts")) {
    return { data: [{ id: "act_e2e_graph_account", name: "E2E Graph Account", currency: "USD", timezone_name: "UTC" }] };
  }
  if (/\/(campaigns|adsets|ads|adcreatives)$/.test(call.path)) return { data: [] };
  if (call.method === "GET" && /\/e2e_graph_/.test(call.path)) {
    return { id: call.path.split("/").at(-1), status: "ACTIVE", status_code: "FINISHED", updated_time: "e2e-v1" };
  }
  return { id: fakeId(call) };
}

/** Fetch Graph normally, or return a deterministic in-memory fake in E2E mode. */
export async function metaGraphFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  if (!isMetaE2eTestMode()) return fetch(input, init);
  const call = await sanitizedCall(input, init);
  ledger.calls.push(call);
  const trigger = process.env["META_E2E_FAIL_ONCE"];
  if (!ledger.failOnceConsumed && trigger && (trigger === "*" || call.path.includes(trigger))) {
    ledger.failOnceConsumed = true;
    return response({ error: { message: "E2E Graph fail-once trigger" } }, 500);
  }
  return response(fakeBody(call));
}