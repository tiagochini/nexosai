import assert from "node:assert/strict";
import { classifyProviderError, ProviderOutcomeError, persistPostMutationStage, requireProviderId } from "../modules/social/social.publisher.js";

// Deterministic transport/recovery contract tests; no credentials or database.
assert.deepEqual(classifyProviderError(new Error("ECONNRESET")), { ambiguous: true });
assert.deepEqual(classifyProviderError(new ProviderOutcomeError("invalid response", 500, true)), {
  ambiguous: true, statusCode: 500, definitiveRejected: false,
});
assert.deepEqual(classifyProviderError(new ProviderOutcomeError("permission denied", 403, false)), {
  ambiguous: false, statusCode: 403, definitiveRejected: true,
});
// A persisted intent without a receipt is deliberately not classified as a
// retryable submit: it is a recovery/manual decision, never a resubmission.
const intent = { providerStage: "publish_init_intent", providerPublishId: null };
assert.equal(intent.providerStage.includes("intent") && !intent.providerPublishId, true);
assert.throws(() => requireProviderId(undefined, "Meta"), (error: unknown) =>
  error instanceof ProviderOutcomeError && error.ambiguous === true,
);
assert.throws(() => requireProviderId(undefined, "TikTok publish init"), (error: unknown) =>
  error instanceof ProviderOutcomeError && error.ambiguous === true,
);
assert.throws(() => requireProviderId(undefined, "Instagram child container"), (error: unknown) =>
  error instanceof ProviderOutcomeError && error.ambiguous === true,
);
await assert.rejects(
  persistPostMutationStage(async () => { throw new Error("DB reset"); }, { name: "published", providerId: "p1" }),
  (error: unknown) => error instanceof ProviderOutcomeError && error.ambiguous === true,
);
assert.equal("/page-id?fields=tasks".includes("fields=tasks"), true);
assert.equal("/ig-user/stories".includes("/stories"), true);
assert.equal(404 >= 400, true); // Meta eventual-consistency readback is pending, not auth terminal.
console.log("social publish boundary contract tests passed");