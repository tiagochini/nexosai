import assert from "node:assert/strict";
import { calculateDeterministicHeat } from "../modules/market-intel/regional-audience-scoring.js";

const now = new Date("2026-01-02T12:00:00.000Z");
const hot = calculateDeterministicHeat({ intent: "quero comprar, qual o preço?", sentiment: "positive", confidence: 90, interactionType: "comment", frequency: 2, occurredAt: new Date("2026-01-02T11:00:00.000Z"), now });
assert.equal(hot.heatBand, "hot");
assert.ok(hot.heatScore >= 70);
const cold = calculateDeterministicHeat({ occurredAt: new Date("2025-12-01T12:00:00.000Z"), now });
assert.equal(cold.heatBand, "cold");
console.log("regional audience deterministic scoring: ok");