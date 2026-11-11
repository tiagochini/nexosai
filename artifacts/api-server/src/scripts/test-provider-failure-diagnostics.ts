import assert from "node:assert/strict";
import { providerFailureDiagnostics } from "../lib/provider-failure-diagnostics.js";
assert.equal(providerFailureDiagnostics(new Error("insufficient_quota sk-secret-value")).failureCategory, "billing_or_quota");
assert.equal(providerFailureDiagnostics({ status: 401 }).failureCategory, "authentication");
assert.equal(providerFailureDiagnostics({ status: 429 }).failureCategory, "rate_limit");
assert.equal(providerFailureDiagnostics(new Error("request timeout")).failureCategory, "timeout");
assert.equal(JSON.stringify(providerFailureDiagnostics(new Error("invalid api key sk-sensitive"))).includes("sk-sensitive"), false);
console.log("Safe provider failure categories passed");
