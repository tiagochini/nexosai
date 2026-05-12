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
  | "whatsapp_response";

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

async function callAnthropic(
  model: string,
  systemPrompt: string,
  messages: AIMessage[],
  maxTokens = 8192,
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const client = getAnthropic();
  // Use integration-compatible model when using integration proxy
  const effectiveModel = env.ANTHROPIC_API_KEY ? model : ANTHROPIC_INTEGRATION_MODEL;
  const response = await client.messages.create({
    model: effectiveModel,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

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
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const usingIntegration = !env.OPENAI_API_KEY && hasOpenAIIntegration();

  // If no OpenAI access at all, fall back to Anthropic integration
  if (!env.OPENAI_API_KEY && !hasOpenAIIntegration()) {
    if (hasAnthropicIntegration()) {
      return callAnthropic(ANTHROPIC_INTEGRATION_MODEL, systemPrompt, messages);
    }
  }

  const client = getOpenAI();
  const effectiveModel = usingIntegration ? OPENAI_INTEGRATION_MODEL : model;

  // gpt-5.x family uses max_completion_tokens; older models use max_tokens
  const isGpt5 = effectiveModel.startsWith("gpt-5") || effectiveModel.startsWith("o4") || effectiveModel.startsWith("o3");
  const completionParams = isGpt5
    ? { max_completion_tokens: 8192 }
    : { max_tokens: 4096 };

  const response = await client.chat.completions.create({
    model: effectiveModel,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    ...completionParams,
  });

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
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const hasGeminiAccess = env.GEMINI_API_KEY || env.AI_INTEGRATIONS_GEMINI_API_KEY;

  // No Gemini access: fall back to Anthropic (already handles integration)
  if (!hasGeminiAccess) {
    return callAnthropic(ANTHROPIC_INTEGRATION_MODEL, systemPrompt, messages);
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
  const result = await chat.sendMessage(lastMessage?.content ?? "");
  const response = await result.response;

  return {
    content: response.text(),
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

export async function completeWithAgent(
  agentRole: AgentRole,
  systemPrompt: string,
  messages: AIMessage[],
  workspaceId: string,
  log: Logger,
  campaignId?: string,
): Promise<AICompletionResult> {
  const { provider, model } = AGENT_PROVIDER_MAP[agentRole];
  const startTime = Date.now();

  let result: { content: string; inputTokens: number; outputTokens: number };

  switch (provider) {
    case "anthropic":
      result = await callAnthropic(model, systemPrompt, messages);
      break;
    case "openai":
      result = await callOpenAI(model, systemPrompt, messages);
      break;
    case "gemini":
      result = await callGemini(model, systemPrompt, messages);
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
