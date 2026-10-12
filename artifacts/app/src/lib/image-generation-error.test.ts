import assert from "node:assert/strict";
import { test } from "node:test";
import { imageGenerationErrorMessage } from "./image-generation-error";

test("429 without provider credits is billing, not missing credentials or rate limiting", () => {
  const result = imageGenerationErrorMessage("429 You have no credits remaining. Add credits to continue using the API");
  assert.match(result[0], /sem saldo/);
  assert.match(result[0], /NexOS são separados/);
  assert.doesNotMatch(result.join(" "), /DALL-E|chave|Aguarde/);
  assert.match(imageGenerationErrorMessage("429 Rate limit exceeded")[0], /Aguarde/);
});

test("access, configuration and unknown errors have safe distinct messages", () => {
  assert.match(imageGenerationErrorMessage("403 Your organization must be verified")[0], /verificação/);
  assert.match(imageGenerationErrorMessage("401 invalid_api_key")[0], /credencial/i);
  assert.match(imageGenerationErrorMessage(undefined)[0], /conceito foi preservado/);
  assert.doesNotMatch(imageGenerationErrorMessage("raw private account data").join(" "), /private account/);
});
