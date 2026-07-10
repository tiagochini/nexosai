/**
 * Exports the configured OpenAI client for use by non-agent modules
 * (e.g. DALL-E image generation in creatives.service.ts).
 * Uses the same env-priority logic as ai-gateway.service.ts.
 *
 * NOTE: as of this audit, no module in the codebase imports from this file —
 * creatives.service.ts and the intake/briefing chat both construct their own
 * clients (creatives.service.ts imports "openai" directly; the intake chat
 * goes through ai-gateway.service.ts's getAnthropic()/getOpenAI()). The
 * timeout below is kept short (90s) because any real future non-agent caller
 * here is expected to be a single short call (transcription/image), not a
 * long-running deep-agent completion — do NOT reuse this client for agent
 * completions, which need the much longer ceiling in ai-gateway.service.ts.
 */
import OpenAI from "openai";
import { env } from "../../lib/env.js";

// Short timeout: this client is for single-shot, non-agent calls only (see note above).
const NON_AGENT_CALL_TIMEOUT_MS = 90 * 1000;

function hasOpenAIIntegration(): boolean {
  return !!(env.AI_INTEGRATIONS_OPENAI_BASE_URL && env.AI_INTEGRATIONS_OPENAI_API_KEY);
}

let _openaiClient: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!_openaiClient) {
    if (env.OPENAI_API_KEY) {
      _openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: NON_AGENT_CALL_TIMEOUT_MS });
    } else if (hasOpenAIIntegration()) {
      _openaiClient = new OpenAI({
        apiKey: env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        timeout: NON_AGENT_CALL_TIMEOUT_MS,
      });
    } else {
      _openaiClient = new OpenAI({ apiKey: "missing", timeout: NON_AGENT_CALL_TIMEOUT_MS });
    }
  }
  return _openaiClient;
}
