import assert from "node:assert/strict";
import { isCreditPackPurchaseAllowed } from "../modules/billing/credit-pack-purchase.policy.js";

assert.equal(isCreditPackPurchaseAllowed(true), false, "active trial access cannot purchase credit packs");
assert.equal(isCreditPackPurchaseAllowed(false), true, "non-trial workspaces can purchase credit packs");

console.log("Trial credit pack policy: 2 scenarios passed.");
