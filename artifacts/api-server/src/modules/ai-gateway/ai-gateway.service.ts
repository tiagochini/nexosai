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
  | "testimonial_curator"
  // ── Governance & Intelligence Layer ───────────────────────────────────────
  | "execution_governor"
  | "memory_compression"
  | "business_intelligence"
  | "ux_simplification"
  | "organic_traffic"
  // ── Mentalidade & Identidade ──────────────────────────────────────────────
  | "mental_frequency_coach"
  | "identity_architect"
  | "obstinacy_trainer"
  // ── Time de Vendas / Atendimento ─────────────────────────────────────────
  | "sales_warmer"
  | "sales_desire"
  | "sales_closer"
  | "sales_objection"
  | "sales_consultant"
  // ── DOMINO CORE ──────────────────────────────────────────────────────────
  | "domino"
  // ── Validação, Onboarding & Lançamento Semente ────────────────────────────
  | "buyer_onboarding"
  | "semente_launch"
  | "product_validator"
  // ── Vídeo Production ─────────────────────────────────────────────────────
  | "scene_director";

// ─── Model selection ──────────────────────────────────────────────────────────
// Integration path (no native key): use Replit-provisioned models
// Native key path: keep provider-original names for backward compat

const ANTHROPIC_NATIVE_MODEL = "claude-opus-4-5";
const ANTHROPIC_INTEGRATION_MODEL = "claude-sonnet-4-6";

const OPENAI_NATIVE_MODEL = "gpt-5.5";
const OPENAI_INTEGRATION_MODEL = "gpt-5.5";

const GEMINI_NATIVE_MODEL = "gemini-2.5-flash";
const GEMINI_FLASH_NATIVE = "gemini-2.5-flash";

// ── Retry fallback mode ───────────────────────────────────────────────────────
// When active, heavy models are swapped for lighter/faster alternatives.
// Activated by content.service.ts when retryCount >= 2 to prevent infinite loops
// on deterministic errors (context overflow, safety blocks, etc.).
let _fallbackMode = false;
export function setFallbackMode(active: boolean): void { _fallbackMode = active; }

const FALLBACK_MODEL_MAP: Record<string, string> = {
  "claude-opus-4-5":   "claude-haiku-3-5",
  "claude-sonnet-4-6": "claude-haiku-3-5",
  "gpt-5.5":           "gpt-4o-mini",
  "gpt-5.4":           "gpt-4o-mini",
};

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
  // ── Governance & Intelligence Layer ──────────────────────────────────────
  execution_governor:   { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  memory_compression:   { provider: "gemini",    model: GEMINI_FLASH_NATIVE },
  business_intelligence:{ provider: "gemini",    model: GEMINI_NATIVE_MODEL },
  ux_simplification:    { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  organic_traffic:         { provider: "openai",    model: OPENAI_NATIVE_MODEL },
  // ── Mentalidade & Identidade ──────────────────────────────────────────────
  mental_frequency_coach:  { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  identity_architect:      { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  obstinacy_trainer:       { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  // ── Time de Vendas / Atendimento ─────────────────────────────────────────
  sales_warmer:     { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  sales_desire:     { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  sales_closer:     { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  sales_objection:  { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  sales_consultant: { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  // ── DOMINO CORE ──────────────────────────────────────────────────────────
  domino:           { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  // ── Validação, Onboarding & Lançamento Semente ────────────────────────────
  buyer_onboarding:   { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  semente_launch:     { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  // ── Vídeo Production ─────────────────────────────────────────────────────
  scene_director:     { provider: "gemini",    model: GEMINI_NATIVE_MODEL },
  product_validator:  { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
};

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Whisper audio transcription ───────────────────────────────────────────────
export async function transcribeAudio(
  audioBase64: string,
  mimeType = "audio/webm",
  log: Logger,
): Promise<string> {
  const { client: openaiAudioClient } = getOpenAI();
  const base64Data = audioBase64.includes(",") ? audioBase64.split(",")[1]! : audioBase64;
  const buffer = Buffer.from(base64Data, "base64");
  const ext = mimeType.includes("mp4") ? "mp4"
    : mimeType.includes("mpeg") || mimeType.includes("mp3") ? "mp3"
    : mimeType.includes("wav") ? "wav"
    : mimeType.includes("ogg") ? "ogg"
    : mimeType.includes("m4a") ? "m4a"
    : "webm";

  const { toFile } = await import("openai");
  const file = await toFile(buffer, `audio.${ext}`, { type: mimeType });

  const transcription = await openaiAudioClient.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "pt",
    response_format: "text",
  });

  log.info({ mimeType, ext, bytes: buffer.length }, "Audio transcribed via Whisper");
  return typeof transcription === "string" ? transcription : String(transcription);
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

// Track whether each client was initialized with a native key (true) or integration proxy (false)
let anthropicClientIsNative = false;
let openaiClientIsNative = false;

// ─── Integration helpers ──────────────────────────────────────────────────────

function hasAnthropicIntegration(): boolean {
  return !!(env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL && env.AI_INTEGRATIONS_ANTHROPIC_API_KEY);
}

function hasOpenAIIntegration(): boolean {
  return !!(env.AI_INTEGRATIONS_OPENAI_BASE_URL && env.AI_INTEGRATIONS_OPENAI_API_KEY);
}

export function getAnthropic(): { client: Anthropic; isNative: boolean } {
  if (!anthropicClient) {
    if (env.ANTHROPIC_API_KEY) {
      anthropicClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
      anthropicClientIsNative = true;
    } else if (hasAnthropicIntegration()) {
      anthropicClient = new Anthropic({
        apiKey: env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
        baseURL: env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
      });
      anthropicClientIsNative = false;
    } else {
      anthropicClient = new Anthropic({ apiKey: "missing" });
      anthropicClientIsNative = false;
    }
  }
  return { client: anthropicClient, isNative: anthropicClientIsNative };
}

export function getOpenAI(): { client: OpenAI; isNative: boolean } {
  if (!openaiClient) {
    if (env.OPENAI_API_KEY) {
      openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
      openaiClientIsNative = true;
    } else if (hasOpenAIIntegration()) {
      openaiClient = new OpenAI({
        apiKey: env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      openaiClientIsNative = false;
    } else {
      openaiClient = new OpenAI({ apiKey: "missing" });
      openaiClientIsNative = false;
    }
  }
  return { client: openaiClient, isNative: openaiClientIsNative };
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

// Background workers have NO timeout — LLM calls on deep agents can legitimately take 3-10 min.
// HTTP-facing callers that need a timeout must pass their own AbortSignal explicitly.

async function callAnthropic(
  model: string,
  systemPrompt: string,
  messages: AIMessage[],
  maxTokens = 8192,
  signal?: AbortSignal,
): Promise<{ content: string; inputTokens: number; outputTokens: number; effectiveModel: string }> {
  const { client, isNative } = getAnthropic();
  const effectiveModel = isNative ? model : ANTHROPIC_INTEGRATION_MODEL;
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
    effectiveModel,
  };
}

async function callOpenAI(
  model: string,
  systemPrompt: string,
  messages: AIMessage[],
  maxTokens = 8192,
  signal?: AbortSignal,
): Promise<{ content: string; inputTokens: number; outputTokens: number; effectiveModel?: string }> {
  const usingIntegration = !env.OPENAI_API_KEY && hasOpenAIIntegration();

  if (!env.OPENAI_API_KEY && !hasOpenAIIntegration()) {
    if (hasAnthropicIntegration()) {
      return callAnthropic(ANTHROPIC_INTEGRATION_MODEL, systemPrompt, messages, maxTokens, signal);
    }
  }

  const { client } = getOpenAI();
  const effectiveModel = usingIntegration ? OPENAI_INTEGRATION_MODEL : model;

  const isGpt5 = effectiveModel.startsWith("gpt-5") || effectiveModel.startsWith("o4") || effectiveModel.startsWith("o3");
  const completionParams = isGpt5
    ? { max_completion_tokens: maxTokens }
    : { max_tokens: maxTokens };

  try {
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
      effectiveModel,
    };
  } catch (err: unknown) {
    const isQuotaError =
      err instanceof Error &&
      ("status" in err
        ? (err as { status?: number }).status === 429
        : err.message.includes("429") || err.message.includes("quota"));

    // When native key is quota-exhausted, fall back to integration proxy or Anthropic
    if (isQuotaError && env.OPENAI_API_KEY) {
      if (hasOpenAIIntegration()) {
        const integrationClient = new OpenAI({
          apiKey: env.AI_INTEGRATIONS_OPENAI_API_KEY,
          baseURL: env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        });
        const intModel = OPENAI_INTEGRATION_MODEL;
        const intIsGpt5 = intModel.startsWith("gpt-5") || intModel.startsWith("o4") || intModel.startsWith("o3");
        const intParams = intIsGpt5 ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens };
        const intResponse = await integrationClient.chat.completions.create(
          {
            model: intModel,
            messages: [
              { role: "system", content: systemPrompt },
              ...messages.map((m) => ({ role: m.role, content: m.content })),
            ],
            ...intParams,
          },
          { signal },
        );
        return {
          content: intResponse.choices[0]?.message?.content ?? "",
          inputTokens: intResponse.usage?.prompt_tokens ?? 0,
          outputTokens: intResponse.usage?.completion_tokens ?? 0,
          effectiveModel: intModel,
        };
      }
      // No integration either — fall back to Anthropic
      if (hasAnthropicIntegration()) {
        return callAnthropic(ANTHROPIC_INTEGRATION_MODEL, systemPrompt, messages, 8192, signal);
      }
    }
    throw err;
  }
}

async function callGemini(
  model: string,
  systemPrompt: string,
  messages: AIMessage[],
  maxTokens = 8192,
  signal?: AbortSignal,
): Promise<{ content: string; inputTokens: number; outputTokens: number; effectiveModel?: string }> {
  const hasGeminiAccess = env.GEMINI_API_KEY || env.AI_INTEGRATIONS_GEMINI_API_KEY;

  if (!hasGeminiAccess) {
    return callAnthropic(ANTHROPIC_INTEGRATION_MODEL, systemPrompt, messages, maxTokens, signal);
  }

  try {
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
      effectiveModel,
    };
  } catch (geminiErr) {
    // Gemini unavailable or quota exceeded — fall back to Anthropic integration
    if (hasAnthropicIntegration()) {
      return callAnthropic(ANTHROPIC_INTEGRATION_MODEL, systemPrompt, messages, 8192, signal);
    }
    throw geminiErr;
  }
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
  const { client, isNative } = getAnthropic();
  const effectiveModel = isNative ? ANTHROPIC_NATIVE_MODEL : ANTHROPIC_INTEGRATION_MODEL;
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
  });

  const content = response.content[0]?.type === "text" ? response.content[0].text : "";
  const latencyMs = Date.now() - startTime;
  const costUsd = calculateCostUsd("anthropic", effectiveModel, response.usage.input_tokens, response.usage.output_tokens);
  const creditsCharged = calculateCreditsFromCost(costUsd, env.CREDIT_MARGIN_MULTIPLIER);

  try {
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
  } catch (logErr) {
    log.warn({ err: logErr, workspaceId }, "ai_provider_logs insert failed (non-fatal) — workspace may have been deleted");
  }

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

function getDefaultModelForProvider(
  provider: "anthropic" | "openai" | "gemini",
): string {
  switch (provider) {
    case "anthropic":
      return hasAnthropicIntegration() ? ANTHROPIC_INTEGRATION_MODEL : ANTHROPIC_NATIVE_MODEL;
    case "openai":
      return hasOpenAIIntegration() ? OPENAI_INTEGRATION_MODEL : OPENAI_NATIVE_MODEL;
    case "gemini":
      return GEMINI_FLASH_NATIVE;
  }
}

export async function completeWithAgent(
  agentRole: AgentRole,
  systemPrompt: string,
  messages: AIMessage[],
  workspaceId: string,
  log: Logger,
  campaignId?: string,
  locale?: string,
  providerOverride?: "anthropic" | "openai" | "gemini",
  maxTokens?: number,
): Promise<AICompletionResult> {
  const agentConfig = AGENT_PROVIDER_MAP[agentRole];
  const provider = providerOverride ?? agentConfig.provider;
  const baseModel = providerOverride
    ? getDefaultModelForProvider(providerOverride)
    : agentConfig.model;
  // On retry fallback mode, swap heavy models for lighter/faster alternatives
  // to break deterministic failure loops (safety blocks, context overflow, etc.)
  const model = _fallbackMode && FALLBACK_MODEL_MAP[baseModel] ? FALLBACK_MODEL_MAP[baseModel] : baseModel;
  const effectiveSystem = systemPrompt + buildLocaleInstruction(locale);
  const startTime = Date.now();
  // No AbortSignal — background workers must never be killed by timeout.
  // Deep agents can legitimately take 3–10+ min per LLM call.

  let result: { content: string; inputTokens: number; outputTokens: number; effectiveModel?: string };

  const effectiveMaxTokens = maxTokens ?? 8192;
  switch (provider) {
    case "anthropic":
      try {
        result = await callAnthropic(model, effectiveSystem, messages, effectiveMaxTokens);
      } catch (anthropicErr) {
        log.warn(
          { agentRole, model, err: String(anthropicErr) },
          "[completeWithAgent] Anthropic failed — falling back to OpenAI",
        );
        result = await callOpenAI(
          getDefaultModelForProvider("openai"),
          effectiveSystem,
          messages,
          effectiveMaxTokens,
        );
      }
      break;
    case "openai":
      result = await callOpenAI(model, effectiveSystem, messages, effectiveMaxTokens);
      break;
    case "gemini":
      try {
        result = await callGemini(model, effectiveSystem, messages, effectiveMaxTokens);
      } catch (geminiErr) {
        log.warn(
          { agentRole, model, err: String(geminiErr) },
          "[completeWithAgent] Gemini failed — falling back to OpenAI",
        );
        result = await callOpenAI(
          getDefaultModelForProvider("openai"),
          effectiveSystem,
          messages,
          effectiveMaxTokens,
        );
      }
      break;
  }

  // Use the actual model that was called (may differ from requested model when using integration proxy)
  const actualModel = result.effectiveModel ?? model;

  const latencyMs = Date.now() - startTime;
  const costUsd = calculateCostUsd(
    provider,
    actualModel,
    result.inputTokens,
    result.outputTokens,
  );
  const creditsCharged = calculateCreditsFromCost(
    costUsd,
    env.CREDIT_MARGIN_MULTIPLIER,
  );

  try {
    await db.insert(aiProviderLogsTable).values({
      workspaceId,
      campaignId,
      agentType: agentRole,
      provider: provider as any,
      model: actualModel,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      totalTokens: result.inputTokens + result.outputTokens,
      costUsd: costUsd.toString(),
      creditsCharged,
      latencyMs,
    });
  } catch (logErr) {
    log.warn({ err: logErr, workspaceId, campaignId, agentRole }, "ai_provider_logs insert failed (non-fatal) — workspace may have been deleted");
  }

  log.info(
    { agentRole, provider, model: actualModel, requestedModel: model, costUsd, creditsCharged, latencyMs },
    "AI completion",
  );

  return {
    content: result.content,
    provider,
    model: actualModel,
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
