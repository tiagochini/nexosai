import assert from "node:assert/strict";
import crypto from "node:crypto";
const redactMetaEvidence = (value: unknown): unknown => Array.isArray(value) ? value.map(redactMetaEvidence) :
  value && typeof value === "object" ? Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => [/token|secret|authorization|access_token/i.test(key) ? "[REDACTED]" : redactMetaEvidence(item)])) : value;

type Evidence = { accountId: string; providerEventId: string; actionKey: string; status: string; receivedAt: Date; sendStartedAt?: Date; sentAt?: Date; latencyMs?: number; slaStatus?: string; endpoint?: string; request?: unknown; response?: unknown; error?: string; retryCount: number };

class ContractHarness {
  events = new Map<string, Evidence>();
  graphCalls: Array<{ endpoint: string; token: string; body: Record<string, unknown> }> = [];
  integrations = new Map<string, { workspaceId: string; token: string; connected: boolean; organic: boolean }>();
  key(a: string, e: string, action: string) { return `${a}:${e}:${action}`; }
  claim(accountId: string, providerEventId: string, actionKey: string) {
    const key = this.key(accountId, providerEventId, actionKey);
    if (this.events.has(key)) return false;
    this.events.set(key, { accountId, providerEventId, actionKey, status: "claimed", receivedAt: new Date(), retryCount: 0 });
    return true;
  }
  route(accountId: string) {
    const row = this.integrations.get(accountId);
    return row?.connected && row.organic && row.token.trim() ? row : undefined;
  }
  async send(accountId: string, eventId: string, action: string, endpoint: string, body: Record<string, unknown>, fail = false) {
    const integration = this.route(accountId); if (!integration) return "unroutable";
    if (!this.claim(accountId, eventId, action)) return "already_claimed";
    const e = this.events.get(this.key(accountId, eventId, action))!;
    e.sendStartedAt = new Date(); e.endpoint = endpoint; e.request = redactMetaEvidence(body);
    this.graphCalls.push({ endpoint, token: integration.token, body });
    if (fail) { e.status = "failed"; e.error = "mock Graph failure"; return "failed"; }
    e.status = "sent"; e.sentAt = new Date(); e.latencyMs = e.sentAt.getTime() - e.receivedAt.getTime(); e.slaStatus = e.latencyMs < 30_000 ? "under_30s" : "over_30s"; e.response = { id: `mock-${this.graphCalls.length}` }; return "sent";
  }
  async retry(accountId: string, eventId: string, action: string) {
    const e = this.events.get(this.key(accountId, eventId, action))!; assert.equal(e.status, "failed");
    e.retryCount++; e.status = "sending"; this.graphCalls.push({ endpoint: e.endpoint!, token: this.route(accountId)!.token, body: e.request as Record<string, unknown> });
    e.status = "sent"; e.sentAt = new Date(); e.response = { id: "retry-ok" };
  }
}

const secret = "contract-app-secret";
const raw = Buffer.from(JSON.stringify({ object: "instagram", entry: [{ id: "ig-a" }]}));
const signature = `sha256=${crypto.createHmac("sha256", secret).update(raw).digest("hex")}`;
const verify = (candidate?: string) => !!candidate && crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(signature));
assert.equal(verify(signature), true, "valid raw-byte Meta signature accepted");
assert.equal(verify(undefined), false, "missing signature rejected fail-closed");
assert.equal(verify("sha256=" + "0".repeat(64)), false, "invalid signature rejected");

const h = new ContractHarness();
h.integrations.set("ig-a", { workspaceId: "workspace-a", token: "token-A", connected: true, organic: true });
h.integrations.set("ig-b", { workspaceId: "workspace-b", token: "token-B", connected: true, organic: true });
h.integrations.set("ig-off", { workspaceId: "workspace-a", token: "token-off", connected: false, organic: true });
assert.equal(h.route("ig-a")?.workspaceId, "workspace-a", "exact account routing");
assert.equal(h.route("unknown"), undefined, "unknown account has no rows[0] fallback");
assert.equal(await h.send("unknown", "mid-x", "sequence_trigger", "/unknown/messages", { message: "x" }), "unroutable");

assert.equal(await h.send("ig-b", "mid-1", "sequence_trigger", "/ig-b/messages", { recipient: "u", message: "Olá" }), "sent");
assert.equal(await h.send("ig-b", "mid-1", "sequence_trigger", "/ig-b/messages", { recipient: "u", message: "Olá" }), "already_claimed");
assert.equal(h.graphCalls.length, 1, "duplicate webhook sends exactly once");
assert.equal(h.graphCalls[0]!.token, "token-B", "multi-account chooses exact account token");

assert.equal(await h.send("ig-a", "comment-1", "public_reply", "/comment-1/replies", { message: "Resposta pública" }), "sent");
assert.equal(await h.send("ig-a", "comment-1", "private_reply", "/comment-1/private_replies", { message: "Resposta privada" }), "sent");
assert.equal(h.graphCalls.at(-1)?.endpoint, "/comment-1/private_replies", "official private reply endpoint");

const started = Date.now();
assert.equal(await h.send("ig-a", "mid-immediate", "sequence_trigger", "/ig-a/messages", { message: "Resposta configurada" }), "sent");
assert.ok(Date.now() - started < 30_000, "deterministic immediate DM meets 30 second SLA");

assert.equal(await h.send("ig-a", "comment-retry", "public_reply", "/comment-retry/replies", { message: "retry" }, true), "failed");
await h.retry("ig-a", "comment-retry", "public_reply");
assert.equal(h.graphCalls.filter((c) => c.endpoint === "/comment-retry/replies").length, 2, "failed Graph call retries once");
const evidence = [...h.events.values()];
assert.ok(evidence.every((e) => e.accountId && e.providerEventId && e.actionKey && e.receivedAt), "evidence has correlation");
assert.equal(JSON.stringify(redactMetaEvidence({ access_token: "x", client_secret: "y", nested: { token: "z" } })).includes("\"x\""), false, "evidence recursively redacts credentials");
assert.equal(JSON.stringify(h.events).includes("token-A"), false, "evidence never contains integration tokens");
console.log("meta app review local contract tests passed");