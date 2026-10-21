import assert from "node:assert/strict";
import { calculateCostUsd, calculateCreditsFromCost } from "../src/schema/ai-provider-logs.ts";
import { calculateRequiredCampaignCredits } from "../src/schema/credits.ts";

// Business rule: one NexOS credit represents US$0.01 of face value, and AI
// usage is charged at 3x provider cost. Thus US$0.10 costs 30 NexOS credits.
assert.equal(calculateCreditsFromCost(0.1, 3), 30);
assert.equal(calculateCreditsFromCost(0.1), 30, "default multiplier follows the 3x policy");
assert.equal(calculateCreditsFromCost(0, 3), 0);
assert.equal(calculateCreditsFromCost(0.000001, 3), 1, "fractional credit charges round up");

const cost = calculateCostUsd("openai", "gpt-4o-mini", 1_000_000, 1_000_000);
assert.equal(cost, 0.75);
assert.equal(calculateCreditsFromCost(cost, 3), 225);
assert.equal(calculateRequiredCampaignCredits(320, 0, "start"), 320);
assert.equal(calculateRequiredCampaignCredits(320, 45, "content"), 275);
assert.equal(calculateRequiredCampaignCredits(320, 300, "launch"), 37, "launch retains its phase minimum");

console.log("AI credit pricing passed: $0.10 provider cost = 30 NexOS credits at 3x.");
