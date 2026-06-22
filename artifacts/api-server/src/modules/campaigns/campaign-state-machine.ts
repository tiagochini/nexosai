/**
 * NEXOS AI — Campaign State Machine
 * ───────────────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH for all campaign status types, valid transitions,
 * and phase-entry constants. No DB imports — purely declarative.
 *
 * Level 3 enforcement is ACTIVE: isValidTransition() is the gate.
 * transitionCampaign() in campaigns.service.ts throws on any undeclared edge.
 *
 * To add a new status or edge: edit ONLY this file. All consumers
 * (workers, services, routes, agents) must import from here — never redeclare.
 */

// ─── Status Types ────────────────────────────────────────────────────────────

export type CampaignStatus =
  | "intake"
  | "analyzing"
  | "strategy_ready"
  | "generating"
  | "compliance_review"
  | "awaiting_approval"
  | "approved"
  | "executing"
  | "live"
  | "paused"
  | "completed"
  | "cancelled";

export type CampaignTrack = "six_digits" | "eight_digits" | "ten_digits";
export type CampaignType = "launch" | "evergreen" | "affiliate" | "live" | "plf" | "perpetual";

// ─── Transition Table ────────────────────────────────────────────────────────
//
// Visual map:
//
//  intake ──► analyzing ──► strategy_ready ──► generating ──► awaiting_approval ──► approved ──► executing ──► live ──► completed
//     ▲           │               │                                    │                │            │           │
//     │         intake         approved*                             generating        executing    paused      paused
//     │           │               │                                    │                │
//     └───────────┘           cancelled                             cancelled         cancelled
//
// * approved: pipeline auto-progression from previous campaign entering executing

export const VALID_STATUS_TRANSITIONS: Readonly<Record<CampaignStatus, CampaignStatus[]>> = {
  // "analyzing" is the normal first step.
  // "awaiting_approval"/"generating" are recovery skip-ahead paths:
  // command agent may complete while campaign is still in intake (race/restart).
  intake: ["analyzing", "awaiting_approval", "generating", "cancelled"],

  // command.agent can end in either awaiting_approval (checkpoints pending)
  // or generating (no checkpoints). Both are valid exits from analyzing.
  analyzing: ["strategy_ready", "intake", "awaiting_approval", "generating", "cancelled"],

  // pipeline auto-progression: next campaign → approved when previous → executing
  strategy_ready: ["generating", "analyzing", "approved", "cancelled"],

  // compliance_review: compliance gate found critical violations — pipeline paused for user
  generating: ["awaiting_approval", "compliance_review", "strategy_ready", "cancelled"],

  // compliance_review: user resolved (accept/custom/override) → awaiting_approval
  compliance_review: ["awaiting_approval", "generating", "cancelled"],

  awaiting_approval: ["approved", "generating", "analyzing", "cancelled"],

  approved: ["executing", "cancelled"],

  executing: ["live", "paused", "cancelled"],

  // "generating" allowed: re-generate content while live (refresh copy mid-launch)
  // "awaiting_approval" allowed: re-strategy cycle from live (e.g. next launch phase)
  live: ["paused", "completed", "cancelled", "generating", "awaiting_approval", "analyzing"],

  // RC-006: "executing" added — orchestration worker transitions paused through
  // paused → executing → live (processExecute).
  paused: ["executing", "live", "cancelled"],

  completed: [],
  cancelled: [],
};

// ─── Phase Entry Constants ───────────────────────────────────────────────────
// Import these everywhere instead of redeclaring inline arrays.

export const STRATEGY_PHASE_ENTRY_STATUSES = [
  "intake",
  "analyzing",
  "strategy_ready",
] as const satisfies CampaignStatus[];

export const CONTENT_PHASE_ENTRY_STATUSES = [
  "strategy_ready",
  "generating", // CHECKPOINT: allows resume after server restart (campaign stays generating, re-enqueued at boot)
  "compliance_review", // user resolved compliance → re-enter content flow to finalize
  "awaiting_approval",
  "approved",
  "live",
] as const satisfies CampaignStatus[];

export const LAUNCH_PHASE_ENTRY_STATUSES = [
  "approved",
  "paused",
] as const satisfies CampaignStatus[];

export const CREATIVE_INTENT_PHASE_ENTRY_STATUSES = [
  "strategy_ready",
  "generating",
  "awaiting_approval",
  "approved",
] as const satisfies CampaignStatus[];

export const TERMINAL_STATUSES: CampaignStatus[] = ["completed", "cancelled"];
export const ACTIVE_STATUSES: CampaignStatus[] = ["executing", "live", "paused"];
export const IN_PROGRESS_STATUSES: CampaignStatus[] = [
  "analyzing",
  "generating",
  "compliance_review",
  "awaiting_approval",
  "strategy_ready",
  "approved",
  "executing",
  "live",
  "paused",
];

// ─── Pure Guard Functions ────────────────────────────────────────────────────

export function isValidTransition(from: string, to: string): boolean {
  const allowed = (VALID_STATUS_TRANSITIONS as Record<string, string[]>)[from] ?? [];
  return allowed.includes(to);
}

export function getAllowedTransitions(from: string): string[] {
  return (VALID_STATUS_TRANSITIONS as Record<string, string[]>)[from] ?? [];
}

export function isCampaignStatus(value: unknown): value is CampaignStatus {
  return typeof value === "string" && value in VALID_STATUS_TRANSITIONS;
}

export function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.includes(status as CampaignStatus);
}

export function isActive(status: string): boolean {
  return ACTIVE_STATUSES.includes(status as CampaignStatus);
}

// ─── Labels ──────────────────────────────────────────────────────────────────

export const DIGIT_TRACK_LABELS: Readonly<Record<CampaignTrack, string>> = {
  six_digits:   "6 Digits (R$100k–R$999k em 7 dias)",
  eight_digits: "8 Digits (R$10M–R$99M em 7 dias)",
  ten_digits:   "10 Digits (R$100M+ em 7 dias)",
};

export const STATUS_LABELS: Readonly<Record<CampaignStatus, string>> = {
  intake:            "Briefing",
  analyzing:         "Analisando",
  strategy_ready:    "Estratégia Pronta",
  generating:        "Gerando Conteúdo",
  compliance_review: "Revisão de Compliance",
  awaiting_approval: "Aguardando Aprovação",
  approved:          "Aprovado",
  executing:         "Executando",
  live:              "Ao Vivo",
  paused:            "Pausado",
  completed:         "Concluído",
  cancelled:         "Cancelado",
};

export const STATUS_PHASE_LABELS: Readonly<Record<CampaignStatus, string>> = {
  intake:            "FASE 1 — BRIEFING",
  analyzing:         "FASE 2 — ESTRATÉGIA",
  strategy_ready:    "FASE 2 — ESTRATÉGIA PRONTA",
  generating:        "FASE 3 — CONTEÚDO",
  compliance_review: "FASE 3 — REVISÃO DE COMPLIANCE",
  awaiting_approval: "FASE 3 — APROVAÇÃO PENDENTE",
  approved:          "FASE 4 — PRONTO PARA LANÇAR",
  executing:         "FASE 4 — LANÇANDO",
  live:              "FASE 5 — AO VIVO",
  paused:            "FASE 5 — PAUSADO",
  completed:         "FASE 6 — CONCLUÍDO",
  cancelled:         "CANCELADO",
};
