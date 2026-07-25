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
  | "scene_director"
  // ── Suporte / Integrações ────────────────────────────────────────────────
  | "integrations_specialist"
  // ── Presença Social Always-On ────────────────────────────────────────────
  | "presence_planner"
  | "bio_optimizer"
  // ── Avaliação Mercadológica ───────────────────────────────────────────────
  | "market_validator"
  | "offer_price_validator"
  | "brand_validator";

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
  // ── Suporte / Integrações ──────────────────────────────────────────────────
  integrations_specialist: { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  // ── Presença Social Always-On ─────────────────────────────────────────────
  presence_planner: { provider: "openai", model: OPENAI_NATIVE_MODEL },
  bio_optimizer:    { provider: "openai", model: OPENAI_NATIVE_MODEL },
  // ── Avaliação Mercadológica ───────────────────────────────────────────
  market_validator:      { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  offer_price_validator: { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
  brand_validator:       { provider: "anthropic", model: ANTHROPIC_NATIVE_MODEL },
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
  usedFallback?: boolean;
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

export function hasOpenAIIntegration(): boolean {
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
      openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: LLM_CALL_TIMEOUT_MS });
      openaiClientIsNative = true;
    } else if (hasOpenAIIntegration()) {
      openaiClient = new OpenAI({
        apiKey: env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        timeout: LLM_CALL_TIMEOUT_MS,
      });
      openaiClientIsNative = false;
    } else {
      openaiClient = new OpenAI({ apiKey: "missing", timeout: LLM_CALL_TIMEOUT_MS });
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

// Background workers have NO HTTP timeout — the only ceiling is the LLM_CALL_TIMEOUT_MS
// below (30 min). Never lower it: a productive LLM call must never be interrupted mid-output.

// ── LLM call timeout ──────────────────────────────────────────────────────────
// Background workers have no HTTP timeout. LLM calls on deep strategy agents
// can legitimately take 10-20 min for large outputs (copywriter, command, VSL).
// 30 min is the hard ceiling — enough for any realistic output size.
// IMPORTANT: do NOT lower this. A productive LLM call must never be interrupted.
const LLM_CALL_TIMEOUT_MS = 30 * 60 * 1000;

function withLLMTimeout(signal?: AbortSignal, timeoutMs: number = LLM_CALL_TIMEOUT_MS): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("LLM_CALL_TIMEOUT")), timeoutMs);
  // Chain caller's signal if provided
  if (signal) {
    signal.addEventListener("abort", () => { clearTimeout(timer); controller.abort(signal.reason); });
  }
  // Clean up timer when the request finishes naturally
  controller.signal.addEventListener("abort", () => clearTimeout(timer));
  return controller.signal;
}

// ── Retry with exponential backoff ────────────────────────────────────────────
// Only retries transient failures (network errors, 502/504, our own timeout
// abort). Never retries 4xx errors (bad request, context length exceeded,
// auth, etc.) — those are deterministic and retrying just burns tokens/credits.
const RETRYABLE_STATUS_CODES = new Set([502, 504]);
const RETRYABLE_ERROR_CODES = new Set(["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EPIPE", "EAI_AGAIN"]);
const RETRYABLE_MESSAGE_PATTERN = /LLM_CALL_TIMEOUT|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EPIPE|fetch failed|network error|socket hang up/i;

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const anyErr = err as { status?: number; code?: string; name?: string };
  if (typeof anyErr.status === "number" && RETRYABLE_STATUS_CODES.has(anyErr.status)) return true;
  if (anyErr.code && RETRYABLE_ERROR_CODES.has(anyErr.code)) return true;
  if (anyErr.name === "AbortError") return true;
  if (RETRYABLE_MESSAGE_PATTERN.test(err.message)) return true;
  return false;
}

const noopLogger = { warn: () => {}, info: () => {}, error: () => {}, debug: () => {} } as unknown as Logger;

async function withRetry<T>(fn: () => Promise<T>, log: Logger, label: string, maxRetries = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retryable = isRetryableError(err);
      if (attempt === maxRetries || !retryable) {
        if (attempt > 0) {
          log.warn({ label, attempt, retryable, err: String(err) }, "[withRetry] giving up");
        }
        throw err;
      }
      const backoffMs = 500 * 2 ** attempt; // 500ms, 1000ms, 2000ms
      log.warn({ label, attempt, backoffMs, err: String(err) }, "[withRetry] transient error — retrying");
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  throw lastErr;
}

// ── Continuation protocol ─────────────────────────────────────────────────────
// Detects truncated JSON outputs and automatically requests continuation chunks.
// Works by counting open vs closed braces; if unbalanced, requests PART N until
// balanced or MAX_CONTINUATION_PARTS is reached. Parts are concatenated in order.
const MAX_CONTINUATION_PARTS = 3;

function isJsonTruncated(text: string): boolean {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (const ch of text) {
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") depth--;
  }
  return depth > 0;
}

async function callAnthropic(
  model: string,
  systemPrompt: string,
  messages: AIMessage[],
  maxTokens = 16384,
  signal?: AbortSignal,
  timeoutMs?: number,
  log?: Logger,
): Promise<{ content: string; inputTokens: number; outputTokens: number; effectiveModel: string }> {
  const { client, isNative } = getAnthropic();
  const effectiveModel = isNative ? model : ANTHROPIC_INTEGRATION_MODEL;
  const effectiveSignal = withLLMTimeout(signal, timeoutMs);
  const response = await withRetry(
    () =>
      client.messages.create(
        {
          model: effectiveModel,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        },
        { signal: effectiveSignal },
      ),
    log ?? noopLogger,
    "callAnthropic",
  );

  let content =
    response.content[0]?.type === "text" ? response.content[0].text : "";
  let totalInputTokens = response.usage.input_tokens;
  let totalOutputTokens = response.usage.output_tokens;

  // Continuation assembly: if JSON is truncated, request continuation chunks.
  // Stop when JSON is balanced or MAX_CONTINUATION_PARTS is reached.
  let part = 2;
  while (isJsonTruncated(content) && part <= MAX_CONTINUATION_PARTS + 1) {
    const continuationMessages = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "assistant" as const, content },
      { role: "user" as const, content: `PART ${part}: Continue the JSON from exactly where you stopped. Do not repeat any previous content. Output only the continuation.` },
    ];
    const contResp = await client.messages.create(
      {
        model: effectiveModel,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: continuationMessages,
      },
      { signal: effectiveSignal },
    );
    const contContent = contResp.content[0]?.type === "text" ? contResp.content[0].text : "";
    content = content + contContent;
    totalInputTokens += contResp.usage.input_tokens;
    totalOutputTokens += contResp.usage.output_tokens;
    part++;
  }

  return {
    content,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    effectiveModel,
  };
}

async function callOpenAI(
  model: string,
  systemPrompt: string,
  messages: AIMessage[],
  maxTokens = 16384,
  signal?: AbortSignal,
  timeoutMs?: number,
  log?: Logger,
): Promise<{ content: string; inputTokens: number; outputTokens: number; effectiveModel?: string; usedFallback?: boolean }> {
  const usingIntegration = !env.OPENAI_API_KEY && hasOpenAIIntegration();
  const effectiveLog = log ?? noopLogger;

  if (!env.OPENAI_API_KEY && !hasOpenAIIntegration()) {
    if (hasAnthropicIntegration()) {
      return callAnthropic(ANTHROPIC_INTEGRATION_MODEL, systemPrompt, messages, maxTokens, signal, timeoutMs, log);
    }
  }

  const { client } = getOpenAI();
  const effectiveModel = usingIntegration ? OPENAI_INTEGRATION_MODEL : model;
  const effectiveSignal = withLLMTimeout(signal, timeoutMs);

  const isGpt5 = effectiveModel.startsWith("gpt-5") || effectiveModel.startsWith("o4") || effectiveModel.startsWith("o3");
  const completionParams = isGpt5
    ? { max_completion_tokens: maxTokens }
    : { max_tokens: maxTokens };

  try {
    const response = await withRetry(
      () =>
        client.chat.completions.create(
          {
            model: effectiveModel,
            messages: [
              { role: "system", content: systemPrompt },
              ...messages.map((m) => ({ role: m.role, content: m.content })),
            ],
            ...completionParams,
          },
          { signal: effectiveSignal },
        ),
      effectiveLog,
      "callOpenAI",
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

    const isModelAccessError =
      err instanceof Error &&
      ("status" in err && (err as { status?: number }).status === 403
        ? true
        : "code" in err && (err as { code?: string }).code === "model_not_found");

    // When native key is quota-exhausted or lacks access to the model, fall back to integration proxy or Anthropic
    if ((isQuotaError || isModelAccessError) && env.OPENAI_API_KEY) {
      if (hasOpenAIIntegration()) {
        const integrationClient = new OpenAI({
          apiKey: env.AI_INTEGRATIONS_OPENAI_API_KEY,
          baseURL: env.AI_INTEGRATIONS_OPENAI_BASE_URL,
          timeout: timeoutMs ?? LLM_CALL_TIMEOUT_MS,
        });
        const intModel = OPENAI_INTEGRATION_MODEL;
        const intIsGpt5 = intModel.startsWith("gpt-5") || intModel.startsWith("o4") || intModel.startsWith("o3");
        const intParams = intIsGpt5 ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens };
        const intResponse = await withRetry(
          () =>
            integrationClient.chat.completions.create(
              {
                model: intModel,
                messages: [
                  { role: "system", content: systemPrompt },
                  ...messages.map((m) => ({ role: m.role, content: m.content })),
                ],
                ...intParams,
              },
              { signal: effectiveSignal },
            ),
          effectiveLog,
          "callOpenAI-integrationFallback",
        );
        effectiveLog.warn({ intModel }, "[callOpenAI] FALLBACK: native key quota/access error — using Replit AI Integrations proxy");
        return {
          content: intResponse.choices[0]?.message?.content ?? "",
          inputTokens: intResponse.usage?.prompt_tokens ?? 0,
          outputTokens: intResponse.usage?.completion_tokens ?? 0,
          effectiveModel: intModel,
          usedFallback: true,
        };
      }
      // No integration either — fall back to Anthropic
      if (hasAnthropicIntegration()) {
        effectiveLog.warn({}, "[callOpenAI] FALLBACK: switching provider to Anthropic integration — no OpenAI integration available");
        const r = await callAnthropic(ANTHROPIC_INTEGRATION_MODEL, systemPrompt, messages, maxTokens, signal, timeoutMs, log);
        return { ...r, usedFallback: true };
      }
    }
    throw err;
  }
}

async function callGemini(
  model: string,
  systemPrompt: string,
  messages: AIMessage[],
  maxTokens = 16384,
  signal?: AbortSignal,
  timeoutMs?: number,
  log?: Logger,
): Promise<{ content: string; inputTokens: number; outputTokens: number; effectiveModel?: string; usedFallback?: boolean }> {
  const hasGeminiAccess = env.GEMINI_API_KEY || env.AI_INTEGRATIONS_GEMINI_API_KEY;
  const effectiveLog = log ?? noopLogger;

  if (!hasGeminiAccess) {
    effectiveLog.warn({}, "[callGemini] FALLBACK: no Gemini key configured — routing to Anthropic integration");
    const r = await callAnthropic(ANTHROPIC_INTEGRATION_MODEL, systemPrompt, messages, maxTokens, signal, timeoutMs, log);
    return { ...r, usedFallback: true };
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
    const effectiveSignal = withLLMTimeout(signal, timeoutMs);
    const result = await withRetry(
      () => chat.sendMessage(lastMessage?.content ?? "", { signal: effectiveSignal } as any),
      effectiveLog,
      "callGemini",
    );
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
      return callAnthropic(ANTHROPIC_INTEGRATION_MODEL, systemPrompt, messages, maxTokens, signal, timeoutMs, log);
    }
    throw geminiErr;
  }
}

// ── Vision support (images → Claude) ─────────────────────────────────────────

/**
 * OpenAI vision fallback used by callVisionChat() when Anthropic fails
 * (e.g. native key quota/credit exhaustion).
 */
async function callVisionChatOpenAI(
  systemPrompt: string,
  messages: AIMessage[],
  imageDataUrls: string[],
  workspaceId: string,
  log: Logger,
): Promise<AICompletionResult> {
  const { client } = getOpenAI();
  const usingIntegration = !env.OPENAI_API_KEY && hasOpenAIIntegration();
  const effectiveModel = usingIntegration ? OPENAI_INTEGRATION_MODEL : "gpt-5.5";
  const startTime = Date.now();

  const historyMessages = messages.slice(0, -1).map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  const lastMsg = messages[messages.length - 1];
  const lastContent = [
    { type: "text" as const, text: lastMsg?.content ?? "" },
    ...imageDataUrls.map(url => ({ type: "image_url" as const, image_url: { url } })),
  ];

  const buildParams = (model: string) => {
    const isGpt5 = model.startsWith("gpt-5") || model.startsWith("o4") || model.startsWith("o3");
    return isGpt5 ? { max_completion_tokens: 8192 } : { max_tokens: 8192 };
  };

  let response;
  let actualModel = effectiveModel;
  try {
    response = await client.chat.completions.create({
      model: effectiveModel,
      messages: [
        { role: "system", content: systemPrompt },
        ...historyMessages,
        { role: "user", content: lastContent },
      ],
      ...buildParams(effectiveModel),
    });
  } catch (err: unknown) {
    const isModelAccessError =
      err instanceof Error &&
      (("status" in err && (err as { status?: number }).status === 403) ||
        ("code" in err && (err as { code?: string }).code === "model_not_found"));
    if (!isModelAccessError) throw err;
    log.warn({ model: effectiveModel, err: String(err) }, "[callVisionChatOpenAI] model not accessible — retrying with gpt-4o");
    try {
      actualModel = "gpt-4o";
      response = await client.chat.completions.create({
        model: actualModel,
        messages: [
          { role: "system", content: systemPrompt },
          ...historyMessages,
          { role: "user", content: lastContent },
        ],
        ...buildParams(actualModel),
      });
    } catch (err2: unknown) {
      if (!hasOpenAIIntegration()) throw err2;
      log.warn({ err: String(err2) }, "[callVisionChatOpenAI] gpt-4o not accessible either — retrying via Replit AI Integrations proxy");
      const integrationClient = new OpenAI({
        apiKey: env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        timeout: LLM_CALL_TIMEOUT_MS,
      });
      actualModel = OPENAI_INTEGRATION_MODEL;
      response = await integrationClient.chat.completions.create({
        model: actualModel,
        messages: [
          { role: "system", content: systemPrompt },
          ...historyMessages,
          { role: "user", content: lastContent },
        ],
        ...buildParams(actualModel),
      });
    }
  }

  const content = response.choices[0]?.message?.content ?? "";
  const inputTokens = response.usage?.prompt_tokens ?? 0;
  const outputTokens = response.usage?.completion_tokens ?? 0;
  const latencyMs = Date.now() - startTime;
  const costUsd = calculateCostUsd("openai", actualModel, inputTokens, outputTokens);
  const creditsCharged = calculateCreditsFromCost(costUsd, env.CREDIT_MARGIN_MULTIPLIER);

  try {
    await db.insert(aiProviderLogsTable).values({
      workspaceId,
      campaignId: null,
      agentType: "vision_chat" as AgentRole,
      provider: "openai",
      model: effectiveModel,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      costUsd: costUsd.toString(),
      creditsCharged,
      latencyMs,
    });
  } catch (logErr) {
    log.warn({ err: logErr, workspaceId }, "ai_provider_logs insert failed (non-fatal) — workspace may have been deleted");
  }

  log.info({ provider: "openai", model: effectiveModel, costUsd, latencyMs, images: imageDataUrls.length }, "Vision completion (OpenAI fallback)");

  return {
    content,
    provider: "openai",
    model: effectiveModel,
    inputTokens,
    outputTokens,
    costUsd,
    creditsCharged,
  };
}

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

  let response;
  try {
    response = await client.messages.create({
      model: effectiveModel,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        ...historyMessages,
        { role: "user", content: lastContent },
      ],
    });
  } catch (anthropicErr) {
    log.warn(
      { model: effectiveModel, err: String(anthropicErr) },
      "[callVisionChat] Anthropic failed — falling back to OpenAI vision",
    );
    return callVisionChatOpenAI(systemPrompt, messages, imageDataUrls, workspaceId, log);
  }

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
  timeoutMs?: number,
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
  // No AbortSignal by default — background workers must never be killed by timeout.
  // Deep agents can legitimately take 3–10+ min per LLM call. Callers that need a
  // short-lived ceiling (e.g. interactive intake/briefing chat) can pass timeoutMs
  // explicitly; this never changes the default (LLM_CALL_TIMEOUT_MS) for other callers.

  let result: { content: string; inputTokens: number; outputTokens: number; effectiveModel?: string; usedFallback?: boolean };
  let internalFallback = false;

  const effectiveMaxTokens = maxTokens ?? 16384;
  switch (provider) {
    case "anthropic":
      try {
        result = await callAnthropic(model, effectiveSystem, messages, effectiveMaxTokens, undefined, timeoutMs, log);
      } catch (anthropicErr) {
        log.warn(
          { agentRole, model, err: String(anthropicErr) },
          "[completeWithAgent] FALLBACK: Anthropic failed — routing to OpenAI",
        );
        // Fallback gets its own (longer) timeout — the caller's ceiling applied to the primary only.
        result = await callOpenAI(
          getDefaultModelForProvider("openai"),
          effectiveSystem,
          messages,
          effectiveMaxTokens,
          undefined,
          undefined, // no caller timeout — fallback must complete
          log,
        );
        internalFallback = true;
      }
      break;
    case "openai":
      result = await callOpenAI(model, effectiveSystem, messages, effectiveMaxTokens, undefined, timeoutMs, log);
      if (result.usedFallback) internalFallback = true;
      break;
    case "gemini":
      try {
        result = await callGemini(model, effectiveSystem, messages, effectiveMaxTokens, undefined, timeoutMs, log);
        if (result.usedFallback) internalFallback = true;
      } catch (geminiErr) {
        log.warn(
          { agentRole, model, err: String(geminiErr) },
          "[completeWithAgent] FALLBACK: Gemini failed — routing to OpenAI",
        );
        // Fallback gets its own (longer) timeout — the caller's ceiling applied to the primary only.
        result = await callOpenAI(
          getDefaultModelForProvider("openai"),
          effectiveSystem,
          messages,
          effectiveMaxTokens,
          undefined,
          undefined, // no caller timeout — fallback must complete
          log,
        );
        internalFallback = true;
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
    usedFallback: internalFallback,
  };
}

// ── Safe wrapper for interactive callers ──────────────────────────────────────
// completeWithAgent() throws on failure, which is correct for background
// agents (the orchestration worker/pipeline catches and handles it). Interactive
// callers (e.g. the intake/briefing chat) need a non-throwing contract so a
// timeout or provider error becomes a graceful in-band result instead of an
// unhandled rejection that hangs the HTTP request or crashes the process.
export type CompleteWithAgentSafeResult =
  | ({ success: true } & AICompletionResult)
  | { success: false; error: "TIMEOUT" | "PROVIDER_ERROR"; message: string };

export async function completeWithAgentSafe(
  agentRole: AgentRole,
  systemPrompt: string,
  messages: AIMessage[],
  workspaceId: string,
  log: Logger,
  campaignId?: string,
  locale?: string,
  providerOverride?: "anthropic" | "openai" | "gemini",
  maxTokens?: number,
  timeoutMs?: number,
): Promise<CompleteWithAgentSafeResult> {
  try {
    const result = await completeWithAgent(
      agentRole,
      systemPrompt,
      messages,
      workspaceId,
      log,
      campaignId,
      locale,
      providerOverride,
      maxTokens,
      timeoutMs,
    );
    return { success: true, ...result };
  } catch (err) {
    const isTimeout =
      err instanceof Error &&
      (err.name === "AbortError" || /LLM_CALL_TIMEOUT|ETIMEDOUT/i.test(err.message));
    const message = err instanceof Error ? err.message : String(err);
    log.warn(
      { agentRole, workspaceId, campaignId, err: message, isTimeout },
      "[completeWithAgentSafe] call failed — returning structured error instead of throwing",
    );
    return {
      success: false,
      error: isTimeout ? "TIMEOUT" : "PROVIDER_ERROR",
      message,
    };
  }
}

export function getAgentConfig(
  role: AgentRole,
): { provider: string; model: string } {
  return AGENT_PROVIDER_MAP[role];
}
