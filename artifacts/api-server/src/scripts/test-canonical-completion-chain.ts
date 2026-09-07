import assert from "node:assert/strict";
import {
  AICompletionAggregateError,
  AICompletionConfigurationError,
  executeCanonicalCompletionChain,
  getAgentConfig,
  planCanonicalCompletionChain,
} from "../modules/ai-gateway/ai-gateway.service.js";

const plan = planCanonicalCompletionChain();
const labels = plan.map(a => `${a.credentialMode}:${a.provider}`);
assert.deepEqual(labels, [
  "native:anthropic",
  "native:openai",
  "native:gemini",
  "replit:openai",
  "replit:anthropic",
  "replit:gemini",
]);
assert.equal(new Set(labels).size, labels.length, "chain must have no duplicate/cycle entries");

async function scenario(available: string[], successful: string) {
  const invoked: string[] = [];
  const result = await executeCanonicalCompletionChain(
    plan,
    a => available.includes(`${a.credentialMode}:${a.provider}`),
    async a => {
      const id = `${a.credentialMode}:${a.provider}`;
      invoked.push(id);
      if (id !== successful) throw new Error("planned failure");
      return id;
    },
  );
  return { invoked, result };
}

let test = await scenario(["native:anthropic", "native:openai", "native:gemini"], "native:anthropic");
assert.deepEqual(test.invoked, ["native:anthropic"]);
assert.equal(test.result.attemptCount, 1);
assert.equal(test.result.usedFallback, false);

test = await scenario(["native:anthropic", "native:openai", "native:gemini"], "native:openai");
assert.deepEqual(test.invoked, ["native:anthropic", "native:openai"]);
assert.equal(test.result.attemptCount, 2);
assert.equal(test.result.usedFallback, true);
assert.equal(test.result.attempt.credentialMode, "native");

test = await scenario(["native:anthropic", "native:openai", "native:gemini"], "native:gemini");
assert.deepEqual(test.invoked, ["native:anthropic", "native:openai", "native:gemini"]);
assert.equal(test.result.attempt.provider, "gemini");

test = await scenario(["native:anthropic", "native:openai", "native:gemini", "replit:openai"], "replit:openai");
assert.deepEqual(test.invoked, ["native:anthropic", "native:openai", "native:gemini", "replit:openai"]);
assert.equal(test.result.attempt.credentialMode, "replit");
assert.equal(test.result.usedFallback, true);

// Replit is a final phase: it never cycles back to native, and Gemini is the
// last compatible Replit completion endpoint.
test = await scenario(["replit:openai", "replit:anthropic", "replit:gemini"], "replit:gemini");
assert.deepEqual(test.invoked, ["replit:openai", "replit:anthropic", "replit:gemini"]);
assert.equal(test.result.attemptCount, 3, "skipped native credentials are not attempts");
assert.equal(test.result.attempt.provider, "gemini");

test = await scenario(["replit:anthropic"], "replit:anthropic");
assert.deepEqual(test.invoked, ["replit:anthropic"]);
assert.equal(test.result.attemptCount, 1, "only configured credentials count as attempts");
assert.equal(test.result.usedFallback, true, "a selected Replit phase is still a canonical fallback");

// Every credential matrix resolves to the first available configured endpoint.
for (let mask = 1; mask < 2 ** labels.length; mask++) {
  const available = labels.filter((_, index) => (mask & (1 << index)) !== 0);
  const expected = available[0]!;
  const matrix = await executeCanonicalCompletionChain(
    plan,
    attempt => available.includes(`${attempt.credentialMode}:${attempt.provider}`),
    async attempt => `${attempt.credentialMode}:${attempt.provider}`,
  );
  assert.equal(matrix.value, expected, `credential matrix ${mask} selected wrong provider`);
  assert.equal(matrix.attemptCount, 1, `credential matrix ${mask} invoked an unavailable provider`);
}

// Provider errors—including rate limiting, server failures and timeouts—must
// advance the deterministic chain. These are mocked errors; no SDK/network call
// or credentials are involved.
for (const error of [
  Object.assign(new Error("rate limited"), { status: 429 }),
  Object.assign(new Error("upstream unavailable"), { status: 503 }),
  Object.assign(new Error("LLM_CALL_TIMEOUT"), { name: "AbortError" }),
]) {
  const invoked: string[] = [];
  const execution = await executeCanonicalCompletionChain(
    plan,
    attempt => ["native:anthropic", "native:openai"].includes(`${attempt.credentialMode}:${attempt.provider}`),
    async attempt => {
      const id = `${attempt.credentialMode}:${attempt.provider}`;
      invoked.push(id);
      if (id === "native:anthropic") throw error;
      return id;
    },
  );
  assert.deepEqual(invoked, ["native:anthropic", "native:openai"]);
  assert.equal(execution.value, "native:openai");
  assert.equal(execution.failures.length, 1);
  assert.equal(execution.failures[0]?.provider, "anthropic");
}

let runners = 0;
await assert.rejects(
  () => executeCanonicalCompletionChain(plan, () => false, async () => { runners++; return "never"; }),
  AICompletionConfigurationError,
);
assert.equal(runners, 0, "credential skips must not invoke runners");

await assert.rejects(
  () => executeCanonicalCompletionChain(plan, () => true, async () => { throw new Error("fail"); }),
  AICompletionAggregateError,
);

// market_intel may specialize an Anthropic model but cannot alter the shared chain.
assert.equal(getAgentConfig("market_intel").provider, "anthropic");
assert.deepEqual(planCanonicalCompletionChain().map(a => a.provider), plan.map(a => a.provider));
console.log("canonical completion chain tests passed");