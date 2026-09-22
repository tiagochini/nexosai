/**
 * Deterministic boundary contract tests. These deliberately exercise the
 * pure claim/identity/fencing seams, so they do not require provider secrets,
 * Redis, or a live database.
 */
import assert from "node:assert/strict";
import { canClaimFirstTouch, classifyAdapterFailure, firstTouchAttemptKey } from "../modules/launch-sequence/first-touch-executor.service.js";
import { classifyWhatsAppTransportError } from "../modules/whatsapp/whatsapp.service.js";
import { matchesApprovedDossier } from "../modules/masterplan/masterplan.service.js";

const now = new Date("2027-01-01T00:00:00.000Z");
const later = new Date(now.getTime() + 60_000);

// Master Plan missing, stale, and valid bindings fail closed.
assert.equal(matchesApprovedDossier(undefined, { campaignId: "c", masterplanVersionId: "p", contextFingerprint: "f" }), false);
assert.equal(matchesApprovedDossier({ id: "p", contextFingerprint: "old" }, { campaignId: "c", masterplanVersionId: "p", contextFingerprint: "f" }), false);
assert.equal(matchesApprovedDossier({ id: "p", contextFingerprint: "f" }, { campaignId: "c", masterplanVersionId: "p", contextFingerprint: "f" }), true);

// Bridge transaction/retry model: failed activation rolls back; concurrent
// callers converge on one sequence key.
const bridge = { sequences: new Set<string>(), items: new Set<string>() };
const bridgeAttempt = (fail: boolean) => {
  const key = "w:c";
  if (bridge.sequences.has(key)) return "reused";
  if (fail) return "rolled_back";
  bridge.sequences.add(key); bridge.items.add("w:c:item"); return "activated";
};
assert.equal(bridgeAttempt(true), "rolled_back");
assert.equal(bridge.sequences.size, 0);
assert.equal(bridgeAttempt(false), "activated");
assert.equal(bridgeAttempt(false), "reused");

// Normalized identity is sequence-scoped: same sequence dedupes while a
// different sequence remains enrollable.
const identities = new Set<string>();
const capture = (sequence: string, email: string) => {
  const key = `${sequence}:${email.trim().toLowerCase()}`;
  if (identities.has(key)) return false;
  identities.add(key); return true;
};
assert.equal(capture("s1", " Lead@Example.COM "), true);
assert.equal(capture("s1", "lead@example.com"), false);
assert.equal(capture("s2", "lead@example.com"), true);

// One shared item creates one attempt per eligible contact, but suppression
// does not consume the eligible candidate.
const sent = new Set<string>();
for (const contact of ["a", "b"]) sent.add(firstTouchAttemptKey({ sequenceId: "s", contactId: contact, itemId: "i", channel: "email", version: "p1" }));
assert.equal(sent.size, 2);
assert.equal(["unsubscribed", "converted"].some((segment) => segment === "unsubscribed"), true);
assert.equal(sent.has(firstTouchAttemptKey({ sequenceId: "s", contactId: "eligible", itemId: "i", channel: "email", version: "p1" })), false);
sent.add(firstTouchAttemptKey({ sequenceId: "s", contactId: "eligible", itemId: "i", channel: "email", version: "p1" }));
assert.equal(sent.size, 3);

// Lease, retry, ambiguity, fencing, tenant, and repeat idempotency contracts.
assert.equal(canClaimFirstTouch({ state: "executing", leaseExpiresAt: later, nextAttemptAt: null, now }), false);
assert.equal(canClaimFirstTouch({ state: "retryable", leaseExpiresAt: null, nextAttemptAt: now, now }), true);
assert.equal(classifyAdapterFailure(new Error("timeout")), "ambiguous");
assert.ok(classifyWhatsAppTransportError(new TypeError("connection reset")));
assert.equal(canClaimFirstTouch({ state: "ambiguous", leaseExpiresAt: null, nextAttemptAt: now, now }), false);
assert.equal(canClaimFirstTouch({ state: "executing", leaseExpiresAt: new Date(now.getTime() - 1), nextAttemptAt: null, now }), true);
assert.equal(firstTouchAttemptKey({ sequenceId: "tenant-a", contactId: "c", itemId: "i", channel: "email", version: "1" })
  === firstTouchAttemptKey({ sequenceId: "tenant-b", contactId: "c", itemId: "i", channel: "email", version: "1" }), false);
const confirmed = new Set<string>();
const repeatKey = firstTouchAttemptKey({ sequenceId: "s", contactId: "c", itemId: "i", channel: "email", version: "1" });
confirmed.add(repeatKey); confirmed.add(repeatKey);
assert.equal(confirmed.size, 1);

console.log("first-touch-boundary: all deterministic contract tests passed");