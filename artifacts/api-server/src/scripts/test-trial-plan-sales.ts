import assert from "node:assert/strict";
import { isTrialSaleBlocked } from "../modules/billing/trial-plan-sales.policy.js";
for (const kind of ["fixed", "editable"]) {
  assert.equal(isTrialSaleBlocked(true, [kind], kind), true);
  assert.equal(isTrialSaleBlocked(false, [kind], kind), false);
  assert.equal(isTrialSaleBlocked(true, [kind], "other"), false);
  assert.equal(isTrialSaleBlocked(true, [], kind), false);
}
console.log("Trial plan sales: 8 scenarios passed (blocked, non-trial, independent items, re-enabled).");
