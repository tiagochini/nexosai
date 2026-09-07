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
assert.deepEqual(labels, ["native:anthropic", "native:openai", "native:gemini", "replit:openai", "replit:anthropic"]);
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

// A failed Replit OpenAI attempt stays in the final Replit stage and never cycles native.
test = await scenario(["replit:openai", "replit:anthropic"], "replit:anthropic");
assert.deepEqual(test.invoked, ["replit:openai", "replit:anthropic"]);
assert.equal(test.result.attemptCount, 2, "skipped native credentials are not attempts");

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