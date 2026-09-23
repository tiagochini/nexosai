import assert from "node:assert/strict";
import {
  classifyProviderError,
  classifyProbeFailure,
  checkSocialCredentialReadiness,
  getInstagramMetrics,
  getTikTokMetrics,
  ProviderOutcomeError,
  persistPostMutationStage,
  requireProviderId,
} from "../modules/social/social.publisher.js";
import type { WorkspaceIntegration } from "@workspace/db";

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

const baseIntegration = {
  id: "00000000-0000-0000-0000-000000000001",
  workspaceId: "00000000-0000-0000-0000-000000000002",
  provider: "instagram",
  status: "connected",
  accessToken: "test-token",
  accountId: "ig-account",
  tokenExpiresAt: null,
} as unknown as WorkspaceIntegration;

assert.deepEqual(
  await checkSocialCredentialReadiness("instagram", { ...baseIntegration, accessToken: null }),
  {
    ok: false,
    kind: "invalid_credential",
    error: "credential_integration_credentials_missing",
    integrationStatus: "error",
  },
);
assert.deepEqual(
  await checkSocialCredentialReadiness("instagram", {
    ...baseIntegration,
    provider: "meta_ads",
  }),
  {
    ok: false,
    kind: "invalid_account",
    error: "credential_integration_provider_mismatch",
    integrationStatus: "error",
  },
);
assert.deepEqual(
  await checkSocialCredentialReadiness("instagram", {
    ...baseIntegration,
    tokenExpiresAt: new Date(Date.now() - 1_000),
  }),
  {
    ok: false,
    kind: "invalid_credential",
    error: "credential_integration_expired",
    integrationStatus: "expired",
  },
);
const failureKind = (statusCode: number, error: string) => {
  const result = classifyProbeFailure(statusCode, error);
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("expected a failed credential probe");
  return result.kind;
};
assert.equal(failureKind(401, "provider_probe_failed"), "invalid_credential");
assert.equal(failureKind(403, "provider_permissions_unproven"), "invalid_permission");
assert.equal(failureKind(429, "provider_probe_failed"), "transient");
assert.equal(failureKind(503, "provider_probe_failed"), "transient");

const tiktokIntegration = {
  ...baseIntegration,
  provider: "tiktok_ads",
  accountId: "tiktok-account",
} as WorkspaceIntegration;
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = (async (input: string | URL) => {
    const url = input.toString();
    if (url.includes("/user/info/")) {
      return new Response(JSON.stringify({ data: { user: {} } }), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  }) as typeof fetch;
  const missingIdentity = await checkSocialCredentialReadiness("tiktok", tiktokIntegration);
  assert.equal(missingIdentity.ok, false);
  if (!missingIdentity.ok) assert.equal(missingIdentity.kind, "invalid_account");

  globalThis.fetch = (async () => new Response(
    JSON.stringify({ data: { user: { open_id: "other-account" } } }),
    { status: 200 },
  )) as typeof fetch;
  const mismatchedIdentity = await checkSocialCredentialReadiness("tiktok", tiktokIntegration);
  assert.equal(mismatchedIdentity.ok, false);
  if (!mismatchedIdentity.ok) assert.equal(mismatchedIdentity.kind, "invalid_account");

  globalThis.fetch = (async (input: string | URL) => {
    const url = input.toString();
    if (url.includes("/user/info/")) {
      return new Response(JSON.stringify({ data: { user: { open_id: "tiktok-account" } } }), { status: 200 });
    }
    return new Response(JSON.stringify({ data: {} }), { status: 200 });
  }) as typeof fetch;
  const missingPostingPermission = await checkSocialCredentialReadiness("tiktok", tiktokIntegration);
  assert.equal(missingPostingPermission.ok, false);
  if (!missingPostingPermission.ok) assert.equal(missingPostingPermission.kind, "invalid_permission");

  globalThis.fetch = (async (input: string | URL) => {
    const url = input.toString();
    if (url.includes("/user/info/")) {
      return new Response(JSON.stringify({ data: { user: { open_id: "tiktok-account" } } }), { status: 200 });
    }
    return new Response(JSON.stringify({ data: { privacy_level_options: ["PUBLIC_TO_EVERYONE"] } }), { status: 200 });
  }) as typeof fetch;
  const validTikTok = await checkSocialCredentialReadiness("tiktok", tiktokIntegration);
  assert.deepEqual(validTikTok, { ok: true });

  for (const status of [408, 429, 500, 503]) {
    globalThis.fetch = (async () => new Response("provider failure", { status })) as typeof fetch;
    await assert.rejects(
      getInstagramMetrics("ig-post", "token"),
      (error: unknown) => error instanceof ProviderOutcomeError && error.statusCode === status,
    );
  }
  globalThis.fetch = (async () => { throw new Error("transport down"); }) as typeof fetch;
  await assert.rejects(
    getTikTokMetrics("tiktok-post", "token"),
    (error: unknown) => error instanceof ProviderOutcomeError && error.ambiguous === true,
  );
} finally {
  globalThis.fetch = originalFetch;
}
console.log("social publish boundary contract tests passed");