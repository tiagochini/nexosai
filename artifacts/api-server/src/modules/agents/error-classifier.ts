/**
 * Pipeline Error Classifier
 *
 * Classifies a raw error message into one of three categories so the
 * autocorrection layer can route to the right remediation workflow.
 */

export type PipelineErrorType =
  | "COMPLIANCE_VIOLATION"
  | "INVALID_INPUT_CONTEXT"
  | "INFRASTRUCTURE_OR_TIMEOUT";

const COMPLIANCE_PATTERNS = [
  "safety",
  "content_filter",
  "content filter",
  "policy",
  "moderation",
  "filtered",
  "harmful",
  "unsafe",
  "violat",
  "prohibited",
  "blocked by",
  "not allowed",
  "flagged",
  "inappropriate",
  "conar",
  "restricted",
  "terms of service",
];

const INVALID_INPUT_PATTERNS = [
  "bad_request",
  "bad request",
  "validation",
  "missing_property",
  "missing property",
  "invalid",
  "context_length",
  "context length",
  "token_limit",
  "token limit",
  "parse error",
  "json parse",
  "unexpected token",
  "schema",
  "required field",
  "cannot read",
  "undefined is not",
  "null is not",
  "type error",
  "syntaxerror",
];

export function classifyPipelineError(errorMessage: string): PipelineErrorType {
  const lower = errorMessage.toLowerCase();

  if (COMPLIANCE_PATTERNS.some(p => lower.includes(p))) {
    return "COMPLIANCE_VIOLATION";
  }
  if (INVALID_INPUT_PATTERNS.some(p => lower.includes(p))) {
    return "INVALID_INPUT_CONTEXT";
  }
  return "INFRASTRUCTURE_OR_TIMEOUT";
}

export function errorTypeLabel(type: PipelineErrorType): string {
  switch (type) {
    case "COMPLIANCE_VIOLATION":
      return "Filtro de conformidade (Meta Ads / CONAR)";
    case "INVALID_INPUT_CONTEXT":
      return "Dados do briefing insuficientes";
    case "INFRASTRUCTURE_OR_TIMEOUT":
      return "Falha de infraestrutura / timeout";
  }
}

export function errorTypeEmoji(type: PipelineErrorType): string {
  switch (type) {
    case "COMPLIANCE_VIOLATION":   return "🛡️";
    case "INVALID_INPUT_CONTEXT":  return "📋";
    case "INFRASTRUCTURE_OR_TIMEOUT": return "⚡";
  }
}
