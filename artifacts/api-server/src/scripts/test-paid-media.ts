import assert from "node:assert/strict";
import {
  normalizeMetaAccounts,
  normalizeMetaInsights,
  normalizeTikTokAccounts,
  normalizeTikTokInsights,
  policyAllows,
  requiresHumanApproval,
  rollbackActionFromSnapshot,
  tikTokRefreshPersistence,
  verifyActionSnapshot,
} from "../modules/paid-media/paid-media.domain.js";
import type { ProviderAction, ProviderEntity } from "../modules/paid-media/providers.js";
import { selectPaidMediaCredential } from "../modules/paid-media/providers.js";
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

console.log("paid-media domain tests passed");