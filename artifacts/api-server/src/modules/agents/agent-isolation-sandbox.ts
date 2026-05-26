/**
 * NEXOS AI — Agent Isolation Sandbox
 * ───────────────────────────────────────────────────────────────────────────
 * Wraps runAgent() with:
 *   - Structured result union (never throws — always returns ok/fail)
 *   - Input contract validation (required fields before calling AI)
 *   - Output contract enforcement (required JSON fields, not silent null)
 *   - Dry-run mode (skips AI call, returns mock result)
 *   - Structured audit trail per invocation
 *
 * Usage:
 *   const result = await runIsolatedAgent<MyOutput>(input, fallback);
 *   if (!result.ok) { log.warn(result.error); return; }
 *   // result.data is guaranteed to have requiredOutputFields
 */

import { runAgent, parseAgentJSON, type RunAgentOptions, type RunAgentResult } from "./agent.runner.js";
import type { AgentRole, AIMessage } from "../ai-gateway/ai-gateway.service.js";
import type { Logger } from "pino";

// ─── Input ────────────────────────────────────────────────────────────────────

export interface AgentSandboxInput {
  campaignId: string | null | undefined;
  workspaceId: string;
  agentRole: AgentRole;
  systemPrompt: string;
  messages: AIMessage[];
  log: Logger;
  requiresApproval?: boolean;
  checkpointType?: string;
  thinkingMessages?: string[];
  memoryContext?: string;

  /** Sandbox-specific options */
  dryRun?: boolean;
  contract?: {
    /** JSON output fields that must be present and non-null. Fails gracefully if missing. */
    requiredOutputFields?: string[];
    /** Max characters in the raw LLM response. Truncation is logged as warning. */
    maxOutputLength?: number;
  };
}

// ─── Result ───────────────────────────────────────────────────────────────────

export type AgentSandboxResult<T = Record<string, unknown>> =
  | {
      ok: true;
      data: T;
      raw: string;
      creditsCharged: number;
      durationMs: number;
      agentRole: AgentRole;
      checkpointId?: string;
    }
  | {
      ok: false;
      error: string;
      errorCode:
        | "INPUT_VALIDATION_FAILED"
        | "AI_CALL_FAILED"
        | "OUTPUT_PARSE_FAILED"
        | "OUTPUT_CONTRACT_FAILED"
        | "DRY_RUN";
      raw?: string;
      creditsCharged: number;
      durationMs: number;
      agentRole: AgentRole;
    };

// ─── Input Validation ─────────────────────────────────────────────────────────

function validateInput(input: AgentSandboxInput): string | null {
  if (!input.workspaceId) return "workspaceId is required";
  if (!input.agentRole) return "agentRole is required";
  if (!input.systemPrompt || input.systemPrompt.trim().length < 10)
    return "systemPrompt must be at least 10 characters";
  if (!Array.isArray(input.messages) || input.messages.length === 0)
    return "messages array must have at least 1 message";
  for (const msg of input.messages) {
    if (!msg.role || !msg.content) return `invalid message: missing role or content`;
  }
  return null;
}

// ─── Output Contract Check ────────────────────────────────────────────────────

function checkOutputContract(
  data: Record<string, unknown>,
  requiredFields: string[],
): string | null {
  for (const field of requiredFields) {
    const keys = field.split(".");
    let cursor: unknown = data;
    for (const key of keys) {
      if (cursor === null || cursor === undefined || typeof cursor !== "object") {
        return `required output field "${field}" is missing or null`;
      }
      cursor = (cursor as Record<string, unknown>)[key];
    }
    if (cursor === null || cursor === undefined) {
      return `required output field "${field}" is null or undefined`;
    }
  }
  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runIsolatedAgent<T extends Record<string, unknown> = Record<string, unknown>>(
  input: AgentSandboxInput,
  fallback: T,
): Promise<AgentSandboxResult<T>> {
  const start = Date.now();
  const { log, agentRole, contract, dryRun } = input;

  // 1 — Input validation
  const inputError = validateInput(input);
  if (inputError) {
    log.warn({ agentRole, error: inputError }, "AgentSandbox: input validation failed");
    return {
      ok: false,
      error: inputError,
      errorCode: "INPUT_VALIDATION_FAILED",
      creditsCharged: 0,
      durationMs: Date.now() - start,
      agentRole,
    };
  }

  // 2 — Dry-run mode
  if (dryRun) {
    log.info({ agentRole }, "AgentSandbox: dry-run mode — skipping AI call");
    return {
      ok: false,
      error: "dry-run mode active",
      errorCode: "DRY_RUN",
      creditsCharged: 0,
      durationMs: Date.now() - start,
      agentRole,
    };
  }

  // 3 — AI call (fully isolated)
  let agentResult: RunAgentResult;
  try {
    const opts: RunAgentOptions = {
      campaignId: input.campaignId,
      workspaceId: input.workspaceId,
      agentRole,
      systemPrompt: input.systemPrompt,
      messages: input.messages,
      log,
      requiresApproval: input.requiresApproval,
      checkpointType: input.checkpointType,
      thinkingMessages: input.thinkingMessages,
      memoryContext: input.memoryContext,
    };
    agentResult = await runAgent(opts);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log.error({ agentRole, err }, "AgentSandbox: AI call failed");
    return {
      ok: false,
      error,
      errorCode: "AI_CALL_FAILED",
      creditsCharged: 0,
      durationMs: Date.now() - start,
      agentRole,
    };
  }

  const raw = agentResult.content;

  // 4 — Output length warning
  if (contract?.maxOutputLength && raw.length > contract.maxOutputLength) {
    log.warn(
      { agentRole, rawLength: raw.length, maxOutputLength: contract.maxOutputLength },
      "AgentSandbox: output exceeds maxOutputLength — possible truncation",
    );
  }

  // 5 — JSON parse
  const parsed = parseAgentJSON<T>(raw, fallback);
  if (!parsed || parsed === fallback) {
    log.warn({ agentRole, rawPreview: raw.slice(0, 200) }, "AgentSandbox: output parse failed — using fallback");
    return {
      ok: false,
      error: "failed to parse agent JSON output",
      errorCode: "OUTPUT_PARSE_FAILED",
      raw,
      creditsCharged: agentResult.creditsCharged,
      durationMs: Date.now() - start,
      agentRole,
    };
  }

  // 6 — Output contract enforcement
  if (contract?.requiredOutputFields?.length) {
    const contractError = checkOutputContract(parsed as Record<string, unknown>, contract.requiredOutputFields);
    if (contractError) {
      log.warn({ agentRole, contractError }, "AgentSandbox: output contract failed");
      return {
        ok: false,
        error: contractError,
        errorCode: "OUTPUT_CONTRACT_FAILED",
        raw,
        creditsCharged: agentResult.creditsCharged,
        durationMs: Date.now() - start,
        agentRole,
      };
    }
  }

  log.info(
    { agentRole, creditsCharged: agentResult.creditsCharged, durationMs: Date.now() - start },
    "AgentSandbox: completed",
  );

  return {
    ok: true,
    data: parsed,
    raw,
    creditsCharged: agentResult.creditsCharged,
    durationMs: Date.now() - start,
    agentRole,
    checkpointId: agentResult.checkpointId,
  };
}
