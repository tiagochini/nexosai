/**
 * Exports the configured OpenAI client for use by non-agent modules
 * (e.g. DALL-E image generation in creatives.service.ts).
 * Uses the same env-priority logic as ai-gateway.service.ts.
 */
import OpenAI from "openai";
import { env } from "../../lib/env.js";

function hasOpenAIIntegration(): boolean {
  return !!(env.AI_INTEGRATIONS_OPENAI_BASE_URL && env.AI_INTEGRATIONS_OPENAI_API_KEY);
}

let _openaiClient: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!_openaiClient) {
    if (env.OPENAI_API_KEY) {
      _openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    } else if (hasOpenAIIntegration()) {
      _openaiClient = new OpenAI({
        apiKey: env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
    } else {
      _openaiClient = new OpenAI({ apiKey: "missing" });
    }
  }
  return _openaiClient;
}
