import assert from "node:assert/strict";
import { canonicalSocialNetworks, defaultMaxAccountsPerNetwork } from "@workspace/db";
import { canAddDistinctSocialAccount, canonicalNetworkForProvider } from "../modules/auth/workspace-entitlements.service.js";

for (const network of canonicalSocialNetworks) {
  assert.equal(defaultMaxAccountsPerNetwork[network], 5);
  const ids = [1, 2, 3, 4, 5].map((id) => `${network}-${id}`);
  assert.equal(canAddDistinctSocialAccount(ids, `${network}-6`, 5), false);
  assert.equal(canAddDistinctSocialAccount(ids, `${network}-3`, 5), true);
}
assert.equal(canonicalNetworkForProvider("instagram"), "instagram");
assert.equal(canonicalNetworkForProvider("meta_ads"), "facebook");
assert.equal(canonicalNetworkForProvider("instagram", { canonicalNetwork: "facebook" }), "facebook");
assert.equal(canonicalNetworkForProvider("facebook", { canonicalNetwork: "instagram" }), "instagram");
assert.equal(canAddDistinctSocialAccount(["a", "b"], "a", 2), true);
// Usage/cost values are reporting data and never participate in this gate.
assert.equal(canAddDistinctSocialAccount([], "new", 5), true);
console.log("commercial entitlement boundary tests passed");