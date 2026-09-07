/**
 * NexOS LLM Router
 *
 * Central routing layer for all LLM calls.
 * Applies task token guidance only. Provider selection and fallback are owned by
 * completeWithAgent so routed and direct callers share one canonical chain.
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

// Agent role → task type mapping (governs token guidance, never provider order).
// Only includes valid AgentRole values — see ai-gateway.service.ts for the full type.
const AGENT_TASK_MAP: Partial<Record<AgentRole, LLMTaskType>> = {
  // Claude-first: strategic depth, persuasion, copy, identity
  command:                  "strategic_deep_copy",
  strategy:                 "strategic_deep_copy",
  launch_manager:           "strategic_deep_copy",
  perpetual_launch_manager: "strategic_deep_copy",
  continuous_sales_manager: "strategic_deep_copy",
  offer:                    "strategic_deep_copy",
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
  // JSON schemas, structured output, audits, targeting
  market_intel:             "structured_json",
  execution_governor:       "structured_json",
  financial_projector:      "structured_json",
  launch_sequence_builder:  "structured_json",
  media_buyer:              "structured_json",
  targeting:                "structured_json",
  ab_test_designer:         "structured_json",
  content_calendar:         "structured_json",
  hook_factory:             "structured_json",
  // B1-4: social_media generates structured JSON (calendar array) — must use GPT-first chain.
  // Previously absent from this map → defaulted to strategic_deep_copy (Claude) which
  // generates calendar:[] silently. Now explicitly structured_json → OpenAI primary.
  social_media:             "structured_json",
  // Validation & compliance
  compliance:               "validation",
  ad_critic:                "validation",
  product_validator:        "validation",
  // Summarization, analytics, debriefs
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
  art_direction:            "structured_json",
  wardrobe_appearance:      "structured_json",
  performance_voice:        "structured_json",
  sound_design:             "structured_json",
  editor:                   "structured_json",
  color_continuity:         "validation",
  av_qc:                    "validation",
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
  const t0 = Date.now();
  const requested = maxTokensOverride && maxTokensOverride > TASK_MAX_OUTPUT_TOKENS[taskType]
    ? maxTokensOverride : TASK_MAX_OUTPUT_TOKENS[taskType];
  // Each provider is capped inside completeWithAgent after canonical selection;
  // do not globally truncate a 16k Anthropic/OpenAI request for Gemini.
  const result = await completeWithAgent(agentRole, systemPrompt, messages, workspaceId, log, campaignId, locale, undefined, requested);
  log.info({ campaignId, agentRole, taskType, provider: result.provider, model: result.model, latencyMs: Date.now() - t0, usedFallback: result.usedFallback === true }, "[LLM_ROUTER] Canonical completion succeeded");
  return { ...result, taskType, attemptCount: result.attemptCount ?? 1, usedFallback: result.usedFallback === true };
}
