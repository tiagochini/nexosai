import assert from "node:assert/strict";
import { test } from "node:test";
import { campaignAgentRole } from "./campaign-agent";

test("actual API agentType populates agent tree and legacy responses remain readable", () => {
  assert.equal(campaignAgentRole({ agentType: "strategy" }), "strategy");
  assert.equal(campaignAgentRole({ agentRole: "copywriter" }), "copywriter");
  assert.equal(campaignAgentRole({ agentType: "analytics", agentRole: "wrong" }), "analytics");
  assert.equal(campaignAgentRole({}), "unknown");
});
