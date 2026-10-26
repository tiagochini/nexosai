/**
 * Canonical Meta Ads setup guidance shared with the Traffic Intelligence Agent.
 * Strategy ranges in the source training are treated as heuristics, never as
 * verified Meta requirements or automatic execution rules.
 */
export const META_ADS_SETUP_ARCHITECT_GUIDANCE = `
## Meta Ads setup architect — canonical planning guidance

Use this guidance when planning Meta campaigns. It extends the NexOS Traffic
Intelligence role and never grants execution authority. Keep human approval,
workspace scope, provider capability checks, dry-run, paused creation, audit,
and idempotency requirements intact.

### Required diagnosis before a final setup

Record these seven client-specific inputs, with their source and confidence:
1. Actual optimization conversions per week over the most recent 14–30 days.
2. Pixel and Conversions API state, event coverage, shared event_id and
   deduplication evidence, and comparison with backend orders/leads.
3. Realistic new creative production capacity per week.
4. Approved monthly and daily budget.
5. Business model and sales-cycle length.
6. Account maturity or current phase (new, testing, scaling, mature, recovery).
7. Legal, brand, geographic, placement, and positioning restrictions.

Do not infer missing values. Ask focused follow-up questions for missing
critical inputs and label any initial analysis preliminary/incomplete. A final
setup must not be marked ready when a required answer is missing. Preserve the
actual evidence source and confidence; do not treat a model estimate as client
data.

### Evidence and decisions

- Adapt campaign and ad-set concentration, ABO/CBO, testing, scaling,
  remarketing, retention, and Advantage+ recommendations to the evidence,
  business model, budget, sales cycle, and creative capacity. Give a reason,
  assumption, risk, and viable alternative for each material choice.
- Treat conversion-volume ranges and learning guidance as adjustable media
  heuristics. Do not present them as Meta rules, guarantee statistical
  significance, or make them execution blockers by themselves.
- Treat tracking as a readiness gate for aggressive scaling. Distinguish
  observed Pixel/CAPI/event_id/deduplication evidence from unknowns. Report
  Event Match Quality as “not verified” unless a trustworthy Meta source is
  supplied; never relabel an internal score as Meta EMQ.
- Explain the plan at Campaign → Ad Set → Ad level when the available contract
  supports those settings. Mark unavailable or unsupported settings clearly;
  do not claim Advantage+, audience, placement, brand-safety, or creative
  options were configured unless provider readback confirms them.
- Creative tests must name the hypothesis, one primary variable, metric,
  observation window, sample/decision limit, and a cautious decision rule.
  State when volume is too low to call a winner. Any automatic rule must be
  conservative, auditable, authorized, and subject to existing approvals.
- Keep recommendations separate from actions. Never publish, activate, spend,
  upload personal data, or alter Meta assets from this planning step.

### Required final plan: ten sections

Return an executive summary; diagnosis of the seven questions; recommended
campaign architecture; Campaign → Ad Set → Ad configuration; audience and
exclusion policy; selective Advantage+ Creative settings; optimization and
learning guidance; implementation checklist; risks; and next steps for days 7
and 14. Explain why any section does not apply. When diagnosis is incomplete,
return a preliminary plan with explicit missing fields and questions, and do
not describe it as a final setup.
`;

export type EvidenceConfidence = "high" | "medium" | "low" | "unknown";
export type DiagnosticAnswerStatus = "provided" | "derived" | "missing";

export interface MetaSetupDiagnosticAnswer {
  question: string;
  value: unknown;
  source: string | null;
  confidence: EvidenceConfidence;
  status: DiagnosticAnswerStatus;
}

export interface MetaSetupDiagnostic {
  status: "complete" | "incomplete";
  answers: MetaSetupDiagnosticAnswer[];
  missingFields: string[];
  clarifyingQuestions: string[];
  trackingStatus: "strong" | "weak" | "unknown";
  emq: { value: number | null; status: "verified" | "not_verified"; source: string | null };
}

type IntakeCandidate = { field: string; aliases: string[]; required: boolean; question: string };

const diagnosticCandidates: IntakeCandidate[] = [
  {
    field: "weeklyOptimizationConversions",
    aliases: ["meta.conversionsPerWeek", "meta.weeklyConversions", "campaign.metaConversionsPerWeek", "paidMedia.weeklyConversions"],
    required: true,
    question: "Quantas conversões do evento de otimização ocorreram por semana nos últimos 14–30 dias? Qual evento e fonte do número?",
  },
  {
    field: "trackingEvidence",
    aliases: ["meta.trackingEvidence", "meta.pixelCapiStatus", "paidMedia.tracking", "campaign.trackingStatus"],
    required: true,
    question: "Qual é o estado do Pixel e da CAPI? Há evidência de event_id compartilhado e deduplicação, e como os eventos se comparam aos registros do backend?",
  },
  {
    field: "weeklyCreativeCapacity",
    aliases: ["meta.creativesPerWeek", "paidMedia.creativesPerWeek", "campaign.creativeCapacityPerWeek"],
    required: true,
    question: "Quantos criativos novos e aprováveis a equipe consegue produzir por semana?",
  },
  {
    field: "budget",
    aliases: ["campaign.budget.monthly", "campaign.budget.daily"],
    required: true,
    question: "Qual é o orçamento mensal e o limite diário aprovado para Meta Ads?",
  },
  {
    field: "businessModelAndSalesCycle",
    aliases: ["campaign.businessModel", "product.businessModel", "campaign.salesCycle"],
    required: true,
    question: "Qual é o tipo de negócio e quanto tempo costuma levar da primeira interação à venda?",
  },
  {
    field: "accountPhase",
    aliases: ["meta.accountPhase", "paidMedia.accountMaturity", "campaign.accountPhase"],
    required: true,
    question: "A conta Meta é nova, está em teste, escala, maturidade ou recuperação? Que evidência sustenta essa fase?",
  },
  {
    field: "restrictions",
    aliases: ["campaign.brandRestrictions", "campaign.legalRestrictions", "meta.brandSafety", "paidMedia.restrictions"],
    required: true,
    question: "Quais restrições legais, de marca, região, posicionamento e placements devem limitar a campanha?",
  },
];

function readPath(source: Record<string, unknown>, path: string): unknown {
  const direct = source[path];
  if (direct !== undefined && direct !== null && direct !== "") return direct;
  let current: unknown = source;
  for (const part of path.split(".")) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current === "" ? undefined : current;
}

export function buildMetaSetupDiagnostic(intake: Record<string, unknown>): MetaSetupDiagnostic {
  const answers = diagnosticCandidates.map((candidate): MetaSetupDiagnosticAnswer => {
    if (candidate.field === "budget") {
      const monthly = readPath(intake, "campaign.budget.monthly");
      const daily = readPath(intake, "campaign.budget.daily");
      const legacyBudget = readPath(intake, "campaign.budget.traffic") ?? readPath(intake, "campaign.budget.total") ?? readPath(intake, "campaign.trafficBudget");
      const complete = typeof monthly === "number" && typeof daily === "number";
      const sources = [
        monthly !== undefined ? "intake:campaign.budget.monthly" : undefined,
        daily !== undefined ? "intake:campaign.budget.daily" : undefined,
        monthly === undefined && daily === undefined && legacyBudget !== undefined ? "intake:campaign.budget.traffic (período/limite diário não especificados)" : undefined,
      ].filter(Boolean);
      return {
        question: candidate.question,
        value: { monthlyBrl: monthly ?? null, dailyBrl: daily ?? null, reportedBudgetWithoutPeriodBrl: legacyBudget ?? null },
        source: sources.length ? sources.join(", ") : null,
        confidence: complete ? "medium" : sources.length ? "low" : "unknown",
        status: complete ? "provided" : "missing",
      };
    }
    if (candidate.field === "businessModelAndSalesCycle") {
      const businessModel = readPath(intake, "campaign.businessModel") ?? readPath(intake, "product.businessModel");
      const salesCycle = readPath(intake, "campaign.salesCycle");
      const complete = businessModel !== undefined && salesCycle !== undefined;
      return {
        question: candidate.question,
        value: { businessModel: businessModel ?? null, salesCycle: salesCycle ?? null },
        source: [
          businessModel !== undefined ? "intake:campaign.businessModel/product.businessModel" : undefined,
          salesCycle !== undefined ? "intake:campaign.salesCycle" : undefined,
        ].filter(Boolean).join(" + ") || null,
        confidence: complete ? "medium" : businessModel !== undefined || salesCycle !== undefined ? "low" : "unknown",
        status: complete ? "provided" : "missing",
      };
    }
    if (candidate.field === "trackingEvidence") {
      const evidence = candidate.aliases
        .map((field) => ({ field, value: readPath(intake, field) }))
        .find(({ value }) => value !== undefined);
      const details = evidence?.value && typeof evidence.value === "object" && !Array.isArray(evidence.value)
        ? evidence.value as Record<string, unknown>
        : {};
      const checks = {
        pixel: details.pixel ?? details.pixelStatus,
        capi: details.capi ?? details.capiStatus,
        eventId: details.eventId ?? details.sharedEventId,
        deduplication: details.deduplication ?? details.deduplicationEvidence,
        backendComparison: details.backendComparison ?? details.backendReconciliation,
      };
      const complete = Object.values(checks).every((value) => value !== undefined && value !== null && value !== "");
      return {
        question: candidate.question,
        value: evidence ? { supplied: evidence.value, requiredEvidence: checks } : null,
        source: evidence ? `intake:${evidence.field}` : null,
        confidence: complete ? "medium" : evidence ? "low" : "unknown",
        status: complete ? "provided" : "missing",
      };
    }
    const match = candidate.aliases
      .map((field) => ({ field, value: readPath(intake, field) }))
      .find(({ value }) => value !== undefined);
    return {
      question: candidate.question,
      value: match?.value ?? null,
      source: match ? `intake:${match.field}` : null,
      confidence: match ? "medium" : "unknown",
      status: match ? "provided" : "missing",
    };
  });

  const missingFields = diagnosticCandidates
    .filter((candidate, index) => candidate.required && answers[index]?.status === "missing")
    .map((candidate) => candidate.field);
  const rawEmq = ["meta.eventMatchQuality", "meta.emq"].map((key) => readPath(intake, key)).find((value) => typeof value === "number");
  const emqSource = readPath(intake, "meta.emqSource");
  const verifiedEmq = typeof rawEmq === "number" && rawEmq >= 0 && rawEmq <= 10 && typeof emqSource === "string" && /events manager|meta/i.test(emqSource);
  const trackingAnswer = answers.find((answer) => answer.source?.startsWith("intake:") && answer.question === diagnosticCandidates[1]?.question);
  const trackingText = trackingAnswer ? JSON.stringify(trackingAnswer.value).toLowerCase() : "";
  const weakTracking = /inactive|not configured|not connected|missing|false|no pixel|sem pixel|sem capi|não configur|nao configur|fraco|weak|unknown|não deduplic|nao deduplic|unverified|not verified|não verificado|nao verificado/.test(trackingText);

  return {
    status: missingFields.length ? "incomplete" : "complete",
    answers,
    missingFields,
    clarifyingQuestions: diagnosticCandidates
      .filter((candidate) => missingFields.includes(candidate.field))
      .map((candidate) => candidate.question),
    trackingStatus: missingFields.includes("trackingEvidence") ? "unknown" : weakTracking ? "weak" : "strong",
    emq: {
      value: verifiedEmq ? rawEmq as number : null,
      status: verifiedEmq ? "verified" : "not_verified",
      source: verifiedEmq ? String(emqSource) : null,
    },
  };
}

export function applyMetaSetupReadinessGate<T extends {
  prePublishValidation: { overallClearance: "approved" | "conditional" | "blocked"; blockers: string[]; conditions: string[]; pixelAndApi: { status: "approved" | "needs_review" | "blocked"; note: string } };
  campaignReadiness: "ready" | "needs_review" | "not_ready";
  campaignReadinessScore: number;
}>(output: T, diagnostic: MetaSetupDiagnostic): T {
  if (diagnostic.status === "incomplete") {
    output.prePublishValidation.overallClearance = "blocked";
    output.prePublishValidation.blockers = [...new Set([
      ...output.prePublishValidation.blockers,
      `Diagnóstico Meta Ads incompleto: ${diagnostic.missingFields.join(", ")}`,
    ])];
    output.prePublishValidation.conditions = [...new Set([
      ...output.prePublishValidation.conditions,
      ...diagnostic.clarifyingQuestions,
    ])];
    if (diagnostic.missingFields.includes("trackingEvidence")) {
      output.prePublishValidation.pixelAndApi = {
        status: "blocked",
        note: "Pixel/CAPI, event_id, deduplicação e comparação com backend não foram comprovados.",
      };
    }
    output.campaignReadiness = "not_ready";
    output.campaignReadinessScore = Math.min(output.campaignReadinessScore, 59);
  }
  if (diagnostic.status === "complete" && diagnostic.trackingStatus === "weak") {
    output.prePublishValidation.overallClearance = output.prePublishValidation.overallClearance === "blocked" ? "blocked" : "conditional";
    output.prePublishValidation.conditions = [...new Set([
      ...output.prePublishValidation.conditions,
      "Tracking informado como fraco: corrigir e verificar antes de recomendar escala agressiva.",
    ])];
    output.prePublishValidation.pixelAndApi = {
      status: "needs_review",
      note: "A evidência informada indica tracking fraco; validar e corrigir antes de qualquer escala agressiva.",
    };
    if (output.campaignReadiness === "ready") output.campaignReadiness = "needs_review";
    output.campaignReadinessScore = Math.min(output.campaignReadinessScore, 79);
  }
  return output;
}
