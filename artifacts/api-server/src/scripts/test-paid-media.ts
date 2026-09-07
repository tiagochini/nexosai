import assert from "node:assert/strict";
import {
  normalizeMetaAccounts,
  normalizeMetaInsights,
  normalizeTikTokAccounts,
  normalizeTikTokInsights,
  hasConsistentRollbackOwnership,
  policyAllows,
  requiresHumanApproval,
  rollbackActionFromSnapshot,
  tikTokRefreshPersistence,
  verifyActionSnapshot,
} from "../modules/paid-media/paid-media.domain.js";
import type { ProviderAction, ProviderEntity } from "../modules/paid-media/providers.js";
import { normalizeMetaCapiEvent, selectPaidMediaCredential, sendMetaCapiRequest } from "../modules/paid-media/providers.js";
import { isOrganicSocialIntegration, metadataForPurpose } from "../modules/integrations/integration-purpose.js";

const action: ProviderAction = {
  type: "update_daily_budget", entityId: "entity-1", entityType: "campaign",
  changes: { dailyBudget: 125, dailyBudgetDeltaPercent: 25 }, idempotencyKey: "proposal-1",
};

function entity(data: Record<string, unknown>, status = "ACTIVE"): ProviderEntity {
  return { providerEntityId: "entity-1", entityType: "campaign", status, version: "v1", data };
}

// An intentionally small in-memory seam models the service's persistence
// invariants without connecting to production's Drizzle database.
class InMemoryExecutor {
  private readonly attempts = new Map<string, { workspaceId: string; before: ProviderEntity; action: ProviderAction }>();
  public paused = false;
  public calls = 0;

  execute(workspaceId: string, proposed: ProviderAction, before: ProviderEntity) {
    if (this.paused) throw new Error("mandatory pause");
    const key = `${workspaceId}:${proposed.idempotencyKey}`;
    const existing = this.attempts.get(key);
    if (existing) {
      return existing;
    }
    this.calls++;
    const attempt = { workspaceId, before, action: proposed };
    this.attempts.set(key, attempt);
    return attempt;
  }

  get(workspaceId: string, key: string) {
    const attempt = this.attempts.get(`${workspaceId}:${key}`);
    return attempt?.workspaceId === workspaceId ? attempt : undefined;
  }
}

class InMemoryRollback {
  public providerMutations = 0;
  public statusWrites = 0;

  rollback(workspaceId: string, attempt: { workspaceId: string; proposalId: string }, proposal: { id: string; workspaceId: string; accountId: string | null; entityId: string | null; provider: string }, account: { id: string; workspaceId: string; provider: string }, target: { id: string; workspaceId: string; accountId: string; provider: string }) {
    if (!hasConsistentRollbackOwnership(workspaceId, attempt, proposal, account, target)) {
      throw new Error("Rollback context ownership mismatch.");
    }
    this.providerMutations++;
    this.statusWrites += 2;
  }
}

// Account mappings are provider-shaped and never require a live credential.
assert.deepEqual(normalizeMetaAccounts([{ id: "123", name: "Meta", currency: "BRL", timezone_name: "America/Sao_Paulo" }])[0],
  { providerAccountId: "act_123", name: "Meta", currency: "BRL", timezone: "America/Sao_Paulo" });
assert.equal(normalizeMetaAccounts([{ id: "act_456" }])[0]?.providerAccountId, "act_456");
assert.deepEqual(normalizeTikTokAccounts([{ advertiser_id: 99, advertiser_name: "TikTok", currency: "USD", timezone: "UTC" }])[0],
  { providerAccountId: "99", name: "TikTok", currency: "USD", timezone: "UTC" });

const refreshed = tikTokRefreshPersistence({ refreshToken: "old-refresh" }, { access_token: "new-access", expires_in: 3600 }, 1_000);
assert.deepEqual(refreshed, { accessToken: "new-access", refreshToken: "old-refresh", tokenExpiresAt: new Date(3_601_000), status: "connected" });

const metaInsight = normalizeMetaInsights([{ id: "ad-1", date_start: "2025-01-01", impressions: "10", clicks: "2", spend: "4.5", actions: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "3" }], action_values: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: "19.99" }] }])[0]!;
assert.equal(metaInsight.conversions, "3");
assert.equal(metaInsight.conversionValue, "19.99");
assert.equal(metaInsight.impressions, 10);
assert.deepEqual(normalizeTikTokInsights([{ campaign_id: "c1", stat_time_day: "2025-01-01", spend: 2, conversion: 1 }], "campaign")[0]?.providerEntityId, "c1");

const policy = { enabled: true, accepted: true, mandatoryPause: false, minimumSampleSize: 100, minimumDataQualityScore: .8, maxDailyBudgetChangePercent: 25, maxBidChangePercent: 10 };
assert.equal(policyAllows(policy, action, 100, .8), true, "boundary policy thresholds are safe inclusively");
assert.equal(policyAllows(policy, { ...action, changes: { dailyBudgetDeltaPercent: 25.01 } }, 100, .8), false);
assert.equal(requiresHumanApproval({ changes: { targetProvider: "tiktok_ads" } }, "meta_ads"), true);
assert.equal(policyAllows(policy, { ...action, changes: { dailyBudgetDeltaPercent: 1, targetProvider: "tiktok_ads" } }, 1000, 1), false);

const executor = new InMemoryExecutor();
const first = executor.execute("workspace-a", action, entity({ daily_budget: "100" }));
assert.strictEqual(executor.execute("workspace-a", action, entity({ daily_budget: "999" })), first);
assert.equal(executor.calls, 1, "execution is idempotent");
executor.paused = true;
assert.throws(() => executor.execute("workspace-a", { ...action, idempotencyKey: "new" }, entity({})), /mandatory pause/);
assert.equal(executor.get("workspace-b", action.idempotencyKey), undefined, "workspace data is isolated");
executor.paused = false;
assert.notStrictEqual(executor.execute("workspace-b", action, entity({ daily_budget: "100" })), first, "equal keys in separate workspaces do not share attempts");

assert.equal(verifyActionSnapshot(action, entity({ daily_budget: "124" })), false, "verification mismatch fails");
// CAPI contract tests inject HTTP only at the exported adapter boundary. No
// global fetch, credentials, or provider endpoint is used by this test.
const capiEvent = normalizeMetaCapiEvent({
  eventName: "Purchase", eventId: "evt-1", occurredAt: "2025-01-01T12:00:00.000Z",
  matchKeys: { email: "Customer@Example.test ", phone: "+55 (11) 99999-0000", fbp: "fb.1.x.y" },
  payload: { currency: "BRL", value: 19.9, orderId: "order-1", ignoredSensitiveField: "do-not-send" },
});
assert.equal(capiEvent.userData.em?.length, 64, "email is hashed before CAPI transport");
assert.equal(capiEvent.userData.ph?.length, 64, "phone is hashed before CAPI transport");
assert.equal((capiEvent.customData as Record<string, unknown>)["ignoredSensitiveField"], undefined, "custom data is allowlisted");
let capiRequest: { url: string; init: RequestInit } | undefined;
await sendMetaCapiRequest("pixel-123", "test-token", capiEvent, async (url, init) => {
  capiRequest = { url, init };
  return new Response(JSON.stringify({ events_received: 1, trace_id: "trace-1" }), { status: 200 });
});
assert.equal(capiRequest?.url, "https://graph.facebook.com/v20.0/pixel-123/events");
const capiBody = JSON.parse(String(capiRequest?.init.body)) as { data: Array<Record<string, unknown>>; access_token: string };
assert.equal(capiBody.data[0]?.["event_id"], "evt-1");
assert.equal(capiBody.data[0]?.["action_source"], "website");
assert.equal(capiBody.access_token, "test-token");
assert.equal(JSON.stringify(capiBody).includes("Customer@Example.test"), false, "raw identifiers never cross the CAPI adapter boundary");
const legacyPage = { id: "page", metadata: { pageId: "page-1" } };
const instagram = { id: "ig", metadata: metadataForPurpose("organic_social", { pageId: "page-1" }) };
const paid = { id: "ads", metadata: metadataForPurpose("paid_media", { paidMedia: true }) };
assert.equal(selectPaidMediaCredential([legacyPage, instagram, paid])?.id, "ads", "paid resolver ignores legacy Page token");
assert.equal(isOrganicSocialIntegration(paid.metadata), false, "social resolver excludes paid credential");
assert.equal(isOrganicSocialIntegration(legacyPage.metadata), true, "legacy Page remains organic");
const immutableBefore = entity({ daily_budget: "100" });
const rollback = rollbackActionFromSnapshot(action, immutableBefore);
immutableBefore.data["daily_budget"] = "999";
assert.deepEqual(rollback.changes, { dailyBudget: "100" }, "rollback uses persisted before snapshot, not current state");
assert.equal(rollback.idempotencyKey, "proposal-1:rollback");

// A denormalized cross-workspace relationship must fail before either the
// provider call or any status write. The matching graph still rolls back.
const rollbackService = new InMemoryRollback();
const rollbackAttempt = { workspaceId: "workspace-a", proposalId: "proposal-a" };
const rollbackProposal = { id: "proposal-a", workspaceId: "workspace-a", accountId: "account-a", entityId: "entity-a", provider: "meta_ads" };
const rollbackAccount = { id: "account-a", workspaceId: "workspace-a", provider: "meta_ads" };
const foreignEntity = { id: "entity-a", workspaceId: "workspace-b", accountId: "account-a", provider: "meta_ads" };
assert.throws(() => rollbackService.rollback("workspace-a", rollbackAttempt, rollbackProposal, rollbackAccount, foreignEntity), /ownership mismatch/);
assert.equal(rollbackService.providerMutations, 0, "ownership drift makes no provider mutation");
assert.equal(rollbackService.statusWrites, 0, "ownership drift makes no foreign DB status mutation");
rollbackService.rollback("workspace-a", rollbackAttempt, rollbackProposal, rollbackAccount, { ...foreignEntity, workspaceId: "workspace-a" });
assert.equal(rollbackService.providerMutations, 1, "valid ownership graph preserves rollback");
assert.equal(rollbackService.statusWrites, 2, "valid rollback updates its scoped statuses");

console.log("paid-media domain tests passed");
