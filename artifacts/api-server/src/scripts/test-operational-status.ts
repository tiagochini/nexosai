import assert from "node:assert/strict";
import {
  EXPIRY_THRESHOLDS,
  classifyCredentialExpiry,
  isStuckCampaign,
  sanitizeOperationalPayload,
} from "../modules/operations/operational-status.service.js";
import { isAdminEmail } from "../modules/admin/admin-access.js";

const now = Date.parse("2026-01-01T12:00:00.000Z");
assert.equal(classifyCredentialExpiry(new Date(now - 1), now), "expired");
assert.equal(classifyCredentialExpiry(new Date(now + EXPIRY_THRESHOLDS.expiringWithin24HoursMs - 1), now), "expiring_24h");
assert.equal(classifyCredentialExpiry(new Date(now + EXPIRY_THRESHOLDS.expiringWithin7DaysMs - 1), now), "expiring_7d");
assert.equal(classifyCredentialExpiry(new Date(now + EXPIRY_THRESHOLDS.expiringWithin7DaysMs), now), "healthy");
assert.equal(classifyCredentialExpiry(null, now), "unknown");

assert.equal(isAdminEmail("founder@agencianexos.vip"), true);
assert.equal(isAdminEmail("workspace-user@example.com"), false);

assert.equal(isStuckCampaign({ status: "generating", updatedAt: new Date(now - EXPIRY_THRESHOLDS.stuckCampaignMs) }, now), true);
assert.equal(isStuckCampaign({ status: "approved", updatedAt: new Date(now - EXPIRY_THRESHOLDS.stuckCampaignMs * 2) }, now), false);

const clean = sanitizeOperationalPayload({
  accessToken: "must-not-leak",
  nested: { refreshToken: "must-not-leak", accountLabel: "safe" },
  rows: [{ provider: "instagram", authorization: "must-not-leak" }],
  timestamp: new Date(now),
});
assert.deepEqual(clean, {
  nested: { accountLabel: "safe" },
  rows: [{ provider: "instagram" }],
  timestamp: new Date(now).toISOString(),
});
console.log("operational status tests passed");