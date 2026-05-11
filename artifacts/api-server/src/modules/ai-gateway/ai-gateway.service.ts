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
  | "media_buyer"
  | "targeting"
  | "landing_page"
  | "analytics"
  | "optimization"
  | "creator_growth"
  | "product_builder"
  | "compliance"
  | "affiliate_campaign"
  | "launch_manager";

const AGENT_PROVIDER_MAP: Record<
  AgentRole,
  { provider: "anthropic" | "openai" | "gemini"; model: string }
> = {
  command: { provider: "anthropic", model: "claude-3-5-sonnet-20241022" },
  strategy: { provider: "anthropic", model: "claude-3-5-sonnet-20241022" },
  launch_manager: { provider: "anthropic", model: "claude-3-5-sonnet-20241022" },
  offer: { provider: "anthropic", model: "claude-3-5-sonnet-20241022" },
  compliance: { provider: "anthropic", model: "claude-3-5-sonnet-20241022" },
  product_builder: { provider: "anthropic", model: "claude-3-5-sonnet-20241022" },
  copywriter: { provider: "openai", model: "gpt-4o" },
  creative_director: { provider: "openai", model: "gpt-4o" },
  media_buyer: { provider: "openai", model: "gpt-4o" },
  targeting: { provider: "openai", model: "gpt-4o" },
  landing_page: { provider: "openai", model: "gpt-4o" },
  affiliate_campaign: { provider: "openai", model: "gpt-4o" },
  analytics: { provider: "gemini", model: "gemini-1.5-pro" },
  optimization: { provider: "gemini", model: "gemini-1.5-pro" },
  video: { provider: "gemini", model: "gemini-1.5-pro" },
  creator_growth: { provider: "gemini", model: "gemini-1.5-flash" },
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

// ─── Integration key fallback ─────────────────────────────────────────────────
// When native provider keys are absent, route everything through the
// Replit-managed Anthropic proxy (claude-sonnet-4-6 as universal fallback).

const INTEGRATION_ANTHROPIC_MODEL = "claude-opus-4-5";

function hasIntegrationKey(): boolean {
  return !!(env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL && env.AI_INTEGRATIONS_ANTHROPIC_API_KEY);
}

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    if (env.ANTHROPIC_API_KEY) {
      anthropicClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    } else if (hasIntegrationKey()) {
      anthropicClient = new Anthropic({
        apiKey: env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
        baseURL: env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
      });
    } else {
      anthropicClient = new Anthropic({ apiKey: "" });
    }
  }
  return anthropicClient;
}

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return openaiClient;
}

function getGemini(): GoogleGenerativeAI {
  if (!geminiClient) {
    geminiClient = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }
  return geminiClient;
}

async function callAnthropic(
  model: string,
  systemPrompt: string,
  messages: AIMessage[],
  maxTokens = 4096,
): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const client = getAnthropic();
  // Use integration model when falling back to integration proxy
  const effectiveModel = env.ANTHROPIC_API_KEY ? model : INTEGRATION_ANTHROPIC_MODEL;
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
  // Fall back to Anthropic integration when OpenAI key is absent
  if (!env.OPENAI_API_KEY && hasIntegrationKey()) {
    return callAnthropic(INTEGRATION_ANTHROPIC_MODEL, systemPrompt, messages);
  }

  const client = getOpenAI();
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    max_tokens: 4096,
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
  // Fall back to Anthropic integration when Gemini key is absent
  if (!env.GEMINI_API_KEY && hasIntegrationKey()) {
    return callAnthropic(INTEGRATION_ANTHROPIC_MODEL, systemPrompt, messages);
  }

  const client = getGemini();
  const geminiModel = client.getGenerativeModel({
    model,
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
