import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../../lib/env.js";
import {
  db,
  aiProviderLogsTable,
  calculateCostUsd,
  calculateCreditsFromCost,
} from "@workspace/db";
import type { Logger } from "pino";

export type AgentRole =
  | "command"
  | "strategy"
  | "offer"
  | "copywriter"
  | "creative_director"
  | "video"
  | "video_strategy"
  | "media_buyer"
  | "targeting"
  | "landing_page"
  | "analytics"
  | "optimization"
  | "creator_growth"
  | "product_builder"
  | "compliance"
  | "affiliate_campaign"
  | "launch_manager"
  | "perpetual_launch_manager"
  | "ad_copy"
  | "social_media"
  | "stories_sequence"
  | "media_brief"
  | "vsl_script"
  | "cpl_script"
  | "webinar_script"
  | "live_script"
  | "financial_projector"
  | "launch_sequence_builder"
  | "continuous_sales_manager"
  | "whatsapp_response"
  // ── New ReAct-capable specialized agents ──────────────────────────────────
  | "hook_factory"
  | "objection_killer"
  | "scarcity_engineer"
  | "email_architect"
  | "pricing_psychologist"
  | "ad_critic"
  | "reengagement"
  | "upsell_architect"
  | "crisis_response"
  | "launch_debriefing"
  | "content_calendar"
  | "video_hook"
  | "market_intel"
  | "ab_test_designer"
  | "testimonial_curator";

// ─── Model selection ──────────────────────────────────────────────────────────
// Integration path (no native key): use Replit-provisioned models
// Native key path: keep provider-original names for backward compat

const ANTHROPIC_NATIVE_MODEL = "claude-3-5-sonnet-20241022";
const ANTHROPIC_INTEGRATION_MODEL = "claude-sonnet-4-6";

const OPENAI_NATIVE_MODEL = "gpt-4o";
const OPENAI_INTEGRATION_MODEL = "gpt-5.4";

const GEMINI_NATIVE_MODEL = "gemini-1.5-pro";
const GEMINI_FLASH_NATIVE = "gemini-1.5-flash";

const AGENT_PROVIDER_MAP: Record<
  AgentRole,
  { provider: "anthropic" | "openai" | "gemini"; model: string }
> = {
  command:           { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  strategy:          { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  launch_manager:    { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  offer:             { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  compliance:        { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  product_builder:   { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  copywriter:        { provider: "openai",    model: OPENAI_NATIVE_MODEL },
  creative_director: { provider: "openai",    model: OPENAI_NATIVE_MODEL },
  media_buyer:       { provider: "openai",    model: OPENAI_NATIVE_MODEL },
  targeting:         { provider: "openai",    model: OPENAI_NATIVE_MODEL },
  landing_page:      { provider: "openai",    model: OPENAI_NATIVE_MODEL },
  affiliate_campaign:{ provider: "openai",    model: OPENAI_NATIVE_MODEL },
  analytics:                { provider: "gemini",    model: GEMINI_NATIVE_MODEL },
  optimization:             { provider: "gemini",    model: GEMINI_NATIVE_MODEL },
  video:                    { provider: "gemini",    model: GEMINI_NATIVE_MODEL },
  video_strategy:           { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  creator_growth:           { provider: "gemini",    model: GEMINI_FLASH_NATIVE },
  perpetual_launch_manager: { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  ad_copy:                  { provider: "openai",    model: OPENAI_NATIVE_MODEL },
  social_media:             { provider: "openai",    model: OPENAI_NATIVE_MODEL },
  stories_sequence:         { provider: "openai",    model: OPENAI_NATIVE_MODEL },
  media_brief:              { provider: "openai",    model: OPENAI_NATIVE_MODEL },
  vsl_script:               { provider: "openai",    model: OPENAI_NATIVE_MODEL },
  cpl_script:               { provider: "openai",    model: OPENAI_NATIVE_MODEL },
  webinar_script:           { provider: "openai",    model: OPENAI_NATIVE_MODEL },
  live_script:              { provider: "openai",    model: OPENAI_NATIVE_MODEL },
  financial_projector:      { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  launch_sequence_builder:  { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  continuous_sales_manager: { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  whatsapp_response:        { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  // ── New ReAct-capable specialized agents ──────────────────────────────────
  hook_factory:         { provider: "openai",    model: OPENAI_NATIVE_MODEL },
  objection_killer:     { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  scarcity_engineer:    { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  email_architect:      { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  pricing_psychologist: { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  ad_critic:            { provider: "openai",    model: OPENAI_NATIVE_MODEL },
  reengagement:         { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  upsell_architect:     { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  crisis_response:      { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  launch_debriefing:    { provider: "gemini",    model: GEMINI_NATIVE_MODEL },
  content_calendar:     { provider: "openai",    model: OPENAI_NATIVE_MODEL },
  video_hook:           { provider: "openai",    model: OPENAI_NATIVE_MODEL },
  market_intel:         { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  ab_test_designer:     { provider: "gemini",    model: GEMINI_NATIVE_MODEL },
  testimonial_curator:  { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
};

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AICompletionResult {
  content: string;
  provider: "anthropic" | "openai" | "gemini";
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  creditsCharged: number;
}

let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;
let geminiClient: GoogleGenerativeAI | null = null;

// ─── Integration helpers ──────────────────────────────────────────────────────

function hasAnthropicIntegration(): boolean {
  return !!(env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL && env.AI_INTEGRATIONS_ANTHROPIC_API_KEY);
}

function hasOpenAIIntegration(): boolean {
  return !!(env.AI_INTEGRATIONS_OPENAI_BASE_URL && env.AI_INTEGRATIONS_OPENAI_API_KEY);
}

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    if (env.ANTHROPIC_API_KEY) {
      anthropicClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    } else if (hasAnthropicIntegration()) {
      anthropicClient = new Anthropic({
        apiKey: env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
        baseURL: env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
      });
    } else {
      anthropicClient = new Anthropic({ apiKey: "missing" });
    }
  }
  return anthropicClient;
}

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    if (env.OPENAI_API_KEY) {
      openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    } else if (hasOpenAIIntegration()) {
      openaiClient = new OpenAI({
        apiKey: env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
    } else {
      openaiClient = new OpenAI({ apiKey: "missing" });
    }
  }
  return openaiClient;
}

function getGemini(): GoogleGenerativeAI {
  if (!geminiClient) {
    if (env.GEMINI_API_KEY) {
      geminiClient = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    } else if (env.AI_INTEGRATIONS_GEMINI_API_KEY) {
      // Use integration API key with default endpoint (proxy handles routing)
      geminiClient = new GoogleGenerativeAI(env.AI_INTEGRATIONS_GEMINI_API_KEY);
    } else {
      geminiClient = new GoogleGenerativeAI("missing");
    }
  }
  return geminiClient;
}

const SERVER_AI_TIMEOUT_MS = 90_000; // 90s — client-side is 110s, so server aborts first

async function callAnthropic(
  model: string,
  systemPrompt: string,
  messages: AIMessage[],
  maxTokens = 8192,
  signal?: AbortSignal,
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const client = getAnthropic();
  const effectiveModel = env.ANTHROPIC_API_KEY ? model : ANTHROPIC_INTEGRATION_MODEL;
  const response = await client.messages.create(
    {
      model: effectiveModel,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    },
    { signal },
  );

  const content =
    response.content[0]?.type === "text" ? response.content[0].text : "";

  return {
    content,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

async function callOpenAI(
  model: string,
  systemPrompt: string,
  messages: AIMessage[],
  signal?: AbortSignal,
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const usingIntegration = !env.OPENAI_API_KEY && hasOpenAIIntegration();

  if (!env.OPENAI_API_KEY && !hasOpenAIIntegration()) {
    if (hasAnthropicIntegration()) {
      return callAnthropic(ANTHROPIC_INTEGRATION_MODEL, systemPrompt, messages, 8192, signal);
    }
  }

  const client = getOpenAI();
  const effectiveModel = usingIntegration ? OPENAI_INTEGRATION_MODEL : model;

  const isGpt5 = effectiveModel.startsWith("gpt-5") || effectiveModel.startsWith("o4") || effectiveModel.startsWith("o3");
  const completionParams = isGpt5
    ? { max_completion_tokens: 8192 }
    : { max_tokens: 4096 };

  const response = await client.chat.completions.create(
    {
      model: effectiveModel,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      ...completionParams,
    },
    { signal },
  );

  return {
    content: response.choices[0]?.message?.content ?? "",
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  };
}

async function callGemini(
  model: string,
  systemPrompt: string,
  messages: AIMessage[],
  signal?: AbortSignal,
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const hasGeminiAccess = env.GEMINI_API_KEY || env.AI_INTEGRATIONS_GEMINI_API_KEY;

  if (!hasGeminiAccess) {
    return callAnthropic(ANTHROPIC_INTEGRATION_MODEL, systemPrompt, messages, 8192, signal);
  }

  const client = getGemini();
  const effectiveModel = env.GEMINI_API_KEY ? model : "gemini-3-flash-preview";
  const geminiModel = client.getGenerativeModel({
    model: effectiveModel,
    systemInstruction: systemPrompt,
  });

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const chat = geminiModel.startChat({ history });
  const lastMessage = messages[messages.length - 1];
  const result = await chat.sendMessage(lastMessage?.content ?? "", { signal } as any);
  const response = await result.response;

  return {
    content: response.text(),
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

// ── Vision support (images → Claude) ─────────────────────────────────────────

/**
 * Send a message with one or more images to Claude for analysis.
 * Images are base64 data-URLs ("data:image/png;base64,...").
 * Always routes through Anthropic because it has the best vision support.
 */
export async function callVisionChat(
  systemPrompt: string,
  messages: AIMessage[],
  imageDataUrls: string[],
  workspaceId: string,
  log: Logger,
): Promise<AICompletionResult> {
  const client = getAnthropic();
  const effectiveModel = env.ANTHROPIC_API_KEY ? ANTHROPIC_NATIVE_MODEL : ANTHROPIC_INTEGRATION_MODEL;
  const signal = AbortSignal.timeout(SERVER_AI_TIMEOUT_MS);
  const startTime = Date.now();

  // Build image blocks for Claude's multimodal API
  type ClaudeMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  const imageBlocks = imageDataUrls.map(dataUrl => {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    const mediaType = (match?.[1] ?? "image/jpeg") as ClaudeMediaType;
    const data = match?.[2] ?? "";
    return {
      type: "image" as const,
      source: { type: "base64" as const, media_type: mediaType, data },
    };
  });

  // History messages (text-only), last user message includes images + text
  const historyMessages = messages.slice(0, -1).map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  const lastMsg = messages[messages.length - 1];
  const lastContent = [
    ...imageBlocks,
    { type: "text" as const, text: lastMsg?.content ?? "" },
  ];

  const response = await client.messages.create({
    model: effectiveModel,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      ...historyMessages,
      { role: "user", content: lastContent },
    ],
  }, { signal });

  const content = response.content[0]?.type === "text" ? response.content[0].text : "";
  const latencyMs = Date.now() - startTime;
  const costUsd = calculateCostUsd("anthropic", effectiveModel, response.usage.input_tokens, response.usage.output_tokens);
  const creditsCharged = calculateCreditsFromCost(costUsd, env.CREDIT_MARGIN_MULTIPLIER);

  await db.insert(aiProviderLogsTable).values({
    workspaceId,
    campaignId: null,
    agentType: "vision_chat" as AgentRole,
    provider: "anthropic",
    model: effectiveModel,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    costUsd: costUsd.toString(),
    creditsCharged,
    latencyMs,
  });

  log.info({ provider: "anthropic", model: effectiveModel, costUsd, latencyMs, images: imageDataUrls.length }, "Vision completion");

  return {
    content,
    provider: "anthropic",
    model: effectiveModel,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    costUsd,
    creditsCharged,
  };
}

// ── Locale → language instruction ─────────────────────────────────────────────
const LOCALE_LANGUAGE_MAP: Record<string, string> = {
  "en-US": "English (US)",
  "en-AU": "English (AU)",
  "es-LA": "Spanish (Latin America)",
};

export function buildLocaleInstruction(locale: string | null | undefined): string {
  if (!locale || locale === "pt-BR") return "";
  const lang = LOCALE_LANGUAGE_MAP[locale];
  if (!lang) return "";
  return `\n\nLANGUAGE INSTRUCTION: You MUST respond exclusively in ${lang}. Every word of your output — analysis, copy, labels, JSON values, messages, recommendations — must be written in ${lang}. Do not mix languages.`;
}

export async function completeWithAgent(
  agentRole: AgentRole,
  systemPrompt: string,
  messages: AIMessage[],
  workspaceId: string,
  log: Logger,
  campaignId?: string,
  locale?: string,
): Promise<AICompletionResult> {
  const { provider, model } = AGENT_PROVIDER_MAP[agentRole];
  const effectiveSystem = systemPrompt + buildLocaleInstruction(locale);
  const startTime = Date.now();
  const signal = AbortSignal.timeout(SERVER_AI_TIMEOUT_MS);

  let result: { content: string; inputTokens: number; outputTokens: number };

  switch (provider) {
    case "anthropic":
      result = await callAnthropic(model, effectiveSystem, messages, 8192, signal);
      break;
    case "openai":
      result = await callOpenAI(model, effectiveSystem, messages, signal);
      break;
    case "gemini":
      result = await callGemini(model, effectiveSystem, messages, signal);
      break;
  }

  const latencyMs = Date.now() - startTime;
  const costUsd = calculateCostUsd(
    provider,
    model,
    result.inputTokens,
    result.outputTokens,
  );
  const creditsCharged = calculateCreditsFromCost(
    costUsd,
    env.CREDIT_MARGIN_MULTIPLIER,
  );

  await db.insert(aiProviderLogsTable).values({
    workspaceId,
    campaignId,
    agentType: agentRole,
    provider: provider as any,
    model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    totalTokens: result.inputTokens + result.outputTokens,
    costUsd: costUsd.toString(),
    creditsCharged,
    latencyMs,
  });

  log.info(
    { agentRole, provider, model, costUsd, creditsCharged, latencyMs },
    "AI completion",
  );

  return {
    content: result.content,
    provider,
    model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd,
    creditsCharged,
  };
}

export function getAgentConfig(
  role: AgentRole,
): { provider: string; model: string } {
  return AGENT_PROVIDER_MAP[role];
}
