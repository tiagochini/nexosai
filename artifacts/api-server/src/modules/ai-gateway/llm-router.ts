/**
 * NexOS LLM Router
 *
 * Central routing layer for all LLM calls.
 * Selects the optimal provider per task type, retries with automatic fallback
 * on failure (timeout, auth error, rate limit, any exception), and logs every
 * routing decision with structured tags for observability.
 *
 * Task types:
 *   strategic_deep_copy  → Claude primary, GPT fallback
 *   structured_json      → GPT primary, Claude fallback
 *   summarization        → Gemini primary, GPT fallback
 *   validation           → GPT primary, Claude fallback
 *   long_context         → Gemini primary, GPT fallback
 *   emergency_recovery   → Gemini → GPT → Claude (cheapest stable chain)
 *
 * Usage: call routedComplete() instead of completeWithAgent() directly.
 * All pipeline agents in command.agent.ts must go through this.
 */
import type { Logger } from "pino";
import {
  completeWithAgent,
  type AgentRole,
  type AIMessage,
  type AICompletionResult,
} from "./ai-gateway.service.js";

// ── Task type classification ──────────────────────────────────────────────────
export type LLMTaskType =
  | "strategic_deep_copy"
  | "structured_json"
  | "summarization"
  | "validation"
  | "long_context"
  | "emergency_recovery";

// Provider call chain per task type — tried left-to-right until success
const TASK_PROVIDER_CHAINS: Record<
  LLMTaskType,
  ("anthropic" | "openai" | "gemini")[]
> = {
  strategic_deep_copy: ["anthropic", "openai"],
  structured_json:     ["openai",    "anthropic"],
  summarization:       ["gemini",    "openai"],
  validation:          ["openai",    "anthropic"],
  long_context:        ["gemini",    "openai"],
  emergency_recovery:  ["gemini",    "openai", "anthropic"],
};

// Max output tokens guidance per task type.
// strategic_deep_copy and long_context use 16000 to support large campaign outputs
// (email sequences, content calendars, VSL scripts) without truncation.
// structured_json uses 16000 — enough for the largest chunked targeting/media-buyer
// JSON schemas without risking provider-side rejection.
// These values are further clamped to PROVIDER_MAX_OUTPUT_TOKENS before each call.
export const TASK_MAX_OUTPUT_TOKENS: Record<LLMTaskType, number> = {
  strategic_deep_copy: 16000,
  structured_json:     16000,
  summarization:       4096,
  validation:          2048,
  long_context:        16000,
  emergency_recovery:  4096,
};

// Hard per-provider output token caps. Values come from the models active in
// ai-gateway.service.ts: claude-sonnet-4-6 (Anthropic), gpt-5.5 (OpenAI), gemini-3-flash-preview (Gemini).
// effectiveMaxTokens is clamped to min(requested, provider_cap) before every call so
// task-type defaults can never exceed what the provider actually supports.
const PROVIDER_MAX_OUTPUT_TOKENS: Record<"anthropic" | "openai" | "gemini", number> = {
  anthropic: 16000, // claude-sonnet-4-6 safe cap (extended-output beta not enabled)
  openai:    16384, // gpt-5.5 max output tokens
  gemini:     8192, // gemini-3-flash-preview output limit
};

// Agent role → task type mapping (governs which provider chain to use).
// Only includes valid AgentRole values — see ai-gateway.service.ts for the full type.
const AGENT_TASK_MAP: Partial<Record<AgentRole, LLMTaskType>> = {
  // Claude-first: strategic depth, persuasion, copy, identity
  command:                  "strategic_deep_copy",
  strategy:                 "strategic_deep_copy",
  launch_manager:           "strategic_deep_copy",
  perpetual_launch_manager: "strategic_deep_copy",
  continuous_sales_manager: "strategic_deep_copy",
  offer:                    "strategic_deep_copy",
  market_intel:             "strategic_deep_copy",
  product_builder:          "strategic_deep_copy",
  video_strategy:           "strategic_deep_copy",
  copywriter:               "strategic_deep_copy",
  creative_director:        "strategic_deep_copy",
  email_architect:          "strategic_deep_copy",
  pricing_psychologist:     "strategic_deep_copy",
  scarcity_engineer:        "strategic_deep_copy",
  objection_killer:         "strategic_deep_copy",
  reengagement:             "strategic_deep_copy",
  upsell_architect:         "strategic_deep_copy",
  crisis_response:          "strategic_deep_copy",
  sales_warmer:             "strategic_deep_copy",
  sales_desire:             "strategic_deep_copy",
  sales_closer:             "strategic_deep_copy",
  sales_objection:          "strategic_deep_copy",
  sales_consultant:         "strategic_deep_copy",
  mental_frequency_coach:   "strategic_deep_copy",
  identity_architect:       "strategic_deep_copy",
  obstinacy_trainer:        "strategic_deep_copy",
  domino:                   "strategic_deep_copy",
  whatsapp_response:        "strategic_deep_copy",
  testimonial_curator:      "strategic_deep_copy",
  // GPT-first: JSON schemas, structured output, audits, targeting
  execution_governor:       "structured_json",
  financial_projector:      "structured_json",
  launch_sequence_builder:  "structured_json",
  media_buyer:              "structured_json",
  targeting:                "structured_json",
  ab_test_designer:         "structured_json",
  content_calendar:         "structured_json",
  hook_factory:             "structured_json",
  // Validation & compliance
  compliance:               "validation",
  ad_critic:                "validation",
  product_validator:        "validation",
  // Gemini-first: summarization, analytics, debriefs
  analytics:                "summarization",
  optimization:             "summarization",
  memory_compression:       "summarization",
  launch_debriefing:        "summarization",
  business_intelligence:    "summarization",
  // Social presence — structured JSON weekly plans & bio suggestions
  presence_planner:         "structured_json",
  bio_optimizer:            "structured_json",
  // Long context video/creator tasks
  video:                    "long_context",
  creator_growth:           "long_context",
  scene_director:           "long_context",
};

export function getTaskType(role: AgentRole): LLMTaskType {
  return AGENT_TASK_MAP[role] ?? "strategic_deep_copy";
}

export interface RouterResult extends AICompletionResult {
  taskType: LLMTaskType;
  attemptCount: number;
  usedFallback: boolean;
}

/**
 * Route an LLM call through the optimal provider chain.
 *
 * On any error (timeout, rate limit, auth, network), automatically retries
 * with the next provider in the chain. If all providers fail, rethrows the
 * last error so the pipeline can handle it gracefully.
 *
 * All pipeline agents must call this instead of completeWithAgent() directly.
 */
export async function routedComplete(
  agentRole: AgentRole,
  systemPrompt: string,
  messages: AIMessage[],
  workspaceId: string,
  log: Logger,
  campaignId?: string,
  locale?: string,
  maxTokensOverride?: number,
): Promise<RouterResult> {
  const taskType = getTaskType(agentRole);
  const chain = TASK_PROVIDER_CHAINS[taskType];

  let lastError: unknown;
  let attemptCount = 0;

  for (const providerOverride of chain) {
    attemptCount++;
    const t0 = Date.now();
    try {
      log.info(
        { campaignId, agentRole, taskType, providerOverride, attempt: attemptCount },
        "[LLM_ROUTER] Attempting provider",
      );
      // Clamp to the lower of: task-type default (or caller override) vs hard provider cap.
      // This ensures no call ever requests more tokens than the active model supports.
      const requested = maxTokensOverride && maxTokensOverride > TASK_MAX_OUTPUT_TOKENS[taskType]
        ? maxTokensOverride
        : TASK_MAX_OUTPUT_TOKENS[taskType];
      const effectiveMaxTokens = Math.min(requested, PROVIDER_MAX_OUTPUT_TOKENS[providerOverride]);
      const result = await completeWithAgent(
        agentRole,
        systemPrompt,
        messages,
        workspaceId,
        log,
        campaignId,
        locale,
        providerOverride,
        effectiveMaxTokens,
      );
      log.info(
        {
          campaignId,
          agentRole,
          taskType,
          provider: result.provider,
          model: result.model,
          latencyMs: Date.now() - t0,
          usedFallback: attemptCount > 1,
        },
        "[LLM_ROUTER] Provider succeeded",
      );
      return {
        ...result,
        taskType,
        attemptCount,
        usedFallback: attemptCount > 1,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      lastError = err;
      log.warn(
        {
          campaignId,
          agentRole,
          taskType,
          providerOverride,
          attempt: attemptCount,
          latencyMs: Date.now() - t0,
          error: errMsg,
        },
        "[LLM_ROUTER] Provider failed — trying next in chain",
      );
    }
  }

  log.error(
    { campaignId, agentRole, taskType, totalAttempts: attemptCount },
    "[LLM_ROUTER] All providers exhausted — pipeline step will fail",
  );
  throw lastError ?? new Error(`LLM router: all providers exhausted for ${agentRole}`);
}
