import assert from "node:assert/strict";
import { test } from "node:test";
import { checkpointNeedsReview, checkpointType, type CampaignCheckpoint } from "./campaign-checkpoint";

const base = { id: "checkpoint", status: "pending", data: {}, createdAt: "2026-10-12" };

test("database checkpoint contract supports phase classification and review", () => {
  const checkpoint: CampaignCheckpoint = { ...base, checkpointType: "strategy_approval" };
  assert.equal(checkpointType(checkpoint).includes("strategy"), true);
  assert.equal(checkpointType(checkpoint).replace(/_/g, " "), "strategy approval");
  assert.equal(checkpointNeedsReview(checkpoint), true);
  assert.equal(checkpointNeedsReview({ ...checkpoint, status: "approved" }), false);
  assert.equal(checkpointNeedsReview({ ...checkpoint, status: "rejected" }), false);
});

test("cached legacy checkpoint and incomplete response do not crash", () => {
  assert.equal(checkpointType({ ...base, type: "creative_concept_approval" }), "creative_concept_approval");
  assert.equal(checkpointNeedsReview({ ...base, status: "awaiting_review" }), true);
  assert.equal(checkpointType(base).includes("strategy"), false);
  assert.equal(checkpointType(base).replace(/_/g, " "), "");
});
