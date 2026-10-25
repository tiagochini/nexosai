import assert from "node:assert/strict";
import { evaluateOptimizationThresholds } from "../modules/paid-media/optimization-rules.domain.js";

const belowThreshold = evaluateOptimizationThresholds({ spend: 120, conversions: 2, conversionValue: 300, impressions: 1000, clicks: 10 }, { minSpend: 200, maxCpa: 40, minRoas: 3, minCtr: 2 });
assert.equal(belowThreshold.eligible, false);
assert.equal(belowThreshold.breaches.length, 3);
assert.equal(belowThreshold.cpa, 60);
assert.equal(belowThreshold.roas, 2.5);
assert.equal(belowThreshold.ctr, 1);

const noConversions = evaluateOptimizationThresholds({ spend: 50, conversions: 0, conversionValue: 0, impressions: 0, clicks: 0 }, { maxCpa: 10, minRoas: 2, minCtr: 1 });
assert.equal(noConversions.eligible, true);
assert.equal(noConversions.breaches.length, 3, "missing denominator must produce a visible breach");
assert.equal(noConversions.cpa, null);

const healthy = evaluateOptimizationThresholds({ spend: 50, conversions: 5, conversionValue: 200, impressions: 1000, clicks: 20 }, { maxCpa: 20, minRoas: 3, minCtr: 1 });
assert.equal(healthy.breaches.length, 0);
console.log("PASS optimization rules: schedule thresholds, missing samples, minimum spend and healthy metrics");
