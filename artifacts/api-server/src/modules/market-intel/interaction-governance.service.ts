import { createHash } from "node:crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import {
  db, interactionApprovalsTable, interactionDecisionsTable, interactionDraftsTable, interactionExecutionsTable,
  interactionGovernancePoliciesTable, interactionOpportunitiesTable, interactionPlatformCapabilitiesTable,
  interactionRecipientsTable, workspaceIntegrationsTable,
  regionalAudienceOpportunitiesTable, regionalSocialSignalsTable, regionalCompetitorsTable,
} from "@workspace/db";
import { completeWithAgentSafe } from "../ai-gateway/ai-gateway.service.js";
import { logger } from "../../lib/logger.js";

type Action = "public_comment" | "private_message" | "reply" | "follow_up";
type Json = Record<string, unknown>;
const hash = (text: string) => createHash("sha256").update(text.trim().toLowerCase().replace(/\s+/g, " ")).digest("hex");
export const boundInteractionPayload = (value: Json, max = 20) => Object.fromEntries(Object.entries(value).slice(0, Math.min(Math.max(max, 1), 20)));
const bounded = boundInteractionPayload;
const privateAction = (action: Action) => action === "private_message" || action === "follow_up";
const councilInflight = new Map<string, Promise<{ assessment: Json; draft: typeof interactionDraftsTable.$inferSelect | null; gate: GateResult }>>();
export function validateInteractionDraft(content: string, ctaLevel: number, history: string[]) {
  if (ctaLevel < 0 || ctaLevel > 5 || !content.trim()) throw new Error("Rascunho ou CTA inválido.");
  const normalized = content.trim().toLowerCase().replace(/\s+/g, " ");
  const tokens = new Set(normalized.split(/[^\p{L}\p{N}]+/u).filter((x) => x.length > 2));
  const similar = history.some((item) => {
    const candidate = item.trim().toLowerCase().replace(/\s+/g, " ");
    if (candidate === normalized) return true;
    const other = new Set(candidate.split(/[^\p{L}\p{N}]+/u).filter((x) => x.length > 2));
    const shared = [...tokens].filter((token) => other.has(token)).length;
    return tokens.size >= 4 && other.size >= 4 && shared / Math.max(tokens.size, other.size) >= 0.8;
  });
  if (similar) throw new Error("Rascunho bloqueado por similaridade com histórico do workspace.");
}

export type GateResult = { decision: "allowed" | "blocked" | "requires_approval"; reasons: string[] };

/** Pure deterministic governor. LLM output is intentionally not an input to permission. */
export function evaluateInteractionGate(input: {
  policy: { enabled: boolean; maximumRiskScore: number; requireApproval: boolean };
  capability?: { officialAdapter: boolean; enabled: boolean; allowsAutomaticExecution: boolean; requiresOwnedAsset: boolean };
  integrationHealthy: boolean; action: Action; evidence: Json; context: Json; riskScore: number;
  optedOut: boolean; duplicate: boolean; cooldown: boolean; lawfulBasis: string; contactable: boolean;
  assetOwned: boolean; conversationOwned: boolean; automatic: boolean;
}): GateResult {
  const reasons: string[] = [];
  if (!input.policy.enabled) reasons.push("interaction_governance_disabled");
  if (!input.capability?.officialAdapter || !input.capability.enabled) reasons.push("official_adapter_capability_missing");
  if (!input.integrationHealthy) reasons.push("connection_unhealthy");
  if (!Object.keys(input.evidence).length || !Object.keys(input.context).length) reasons.push("evidence_or_context_missing");
  if (input.riskScore > input.policy.maximumRiskScore) reasons.push("risk_threshold_exceeded");
  if (input.optedOut) reasons.push("recipient_opted_out");
  if (input.duplicate) reasons.push("duplicate_recipient");
  if (input.cooldown) reasons.push("recipient_cooldown");
  if (privateAction(input.action) && (input.lawfulBasis !== "permitted" || !input.contactable)) reasons.push("private_action_requires_lawful_basis_and_contactability");
  if (input.capability?.requiresOwnedAsset && input.automatic && !input.assetOwned && !input.conversationOwned) reasons.push("asset_or_conversation_not_owned");
  if (input.automatic && (!input.capability?.allowsAutomaticExecution || (input.action === "public_comment" && !input.assetOwned && !input.conversationOwned))) reasons.push("automatic_execution_not_officially_supported_or_owned");
  return reasons.length ? { decision: "blocked", reasons } : { decision: input.policy.requireApproval ? "requires_approval" : "allowed", reasons: [] };
}

export async function upsertInteractionPolicy(workspaceId: string, values: Omit<typeof interactionGovernancePoliciesTable.$inferInsert, "id" | "workspaceId" | "createdAt" | "updatedAt">) {
  const [existing] = await db.select().from(interactionGovernancePoliciesTable).where(eq(interactionGovernancePoliciesTable.workspaceId, workspaceId)).limit(1);
  if (existing) return (await db.update(interactionGovernancePoliciesTable).set({ ...values, updatedAt: new Date() }).where(eq(interactionGovernancePoliciesTable.id, existing.id)).returning())[0]!;
  return (await db.insert(interactionGovernancePoliciesTable).values({ workspaceId, ...values }).returning())[0]!;
}

export async function registerInteractionCapability(workspaceId: string, input: { integrationId: string; platform: string; action: Action; officialAdapter: boolean; enabled: boolean; allowsAutomaticExecution: boolean; requiresOwnedAsset: boolean }) {
  const [integration] = await db.select({ id: workspaceIntegrationsTable.id }).from(workspaceIntegrationsTable).where(and(eq(workspaceIntegrationsTable.id, input.integrationId), eq(workspaceIntegrationsTable.workspaceId, workspaceId))).limit(1);
  if (!integration) throw new Error("Conta conectada não encontrada neste workspace.");
  const [existing] = await db.select().from(interactionPlatformCapabilitiesTable).where(and(eq(interactionPlatformCapabilitiesTable.integrationId, input.integrationId), eq(interactionPlatformCapabilitiesTable.action, input.action))).limit(1);
  if (existing) return (await db.update(interactionPlatformCapabilitiesTable).set({ ...input, workspaceId, updatedAt: new Date() }).where(eq(interactionPlatformCapabilitiesTable.id, existing.id)).returning())[0]!;
  return (await db.insert(interactionPlatformCapabilitiesTable).values({ workspaceId, ...input }).returning())[0]!;
}

export async function createInteractionOpportunity(workspaceId: string, input: { campaignId?: string; integrationId: string; platform: string; action: Action; recipientFingerprint: string; competitorRef?: string; postRef?: string; evidence: Json; context: Json; lawfulBasis?: string; contactable?: boolean; assetOwned?: boolean; conversationOwned?: boolean; riskScore: number; purpose?: string; jurisdictionCodes?: string[]; retentionUntil?: Date }) {
  const [integration] = await db.select().from(workspaceIntegrationsTable).where(and(eq(workspaceIntegrationsTable.id, input.integrationId), eq(workspaceIntegrationsTable.workspaceId, workspaceId))).limit(1);
  if (!integration) throw new Error("Conta conectada não encontrada neste workspace.");
  let [recipient] = await db.select().from(interactionRecipientsTable).where(and(eq(interactionRecipientsTable.workspaceId, workspaceId), eq(interactionRecipientsTable.fingerprint, input.recipientFingerprint))).limit(1);
  if (!recipient) [recipient] = await db.insert(interactionRecipientsTable).values({ workspaceId, fingerprint: input.recipientFingerprint, purpose: input.purpose ?? "public engagement", jurisdictionCodes: input.jurisdictionCodes ?? [], retentionUntil: input.retentionUntil ?? null }).returning();
  const [opportunity] = await db.insert(interactionOpportunitiesTable).values({
    workspaceId, campaignId: input.campaignId ?? null, recipientId: recipient!.id, integrationId: input.integrationId,
    platform: input.platform, action: input.action, competitorRef: input.competitorRef ?? null, postRef: input.postRef ?? null,
    evidence: bounded(input.evidence), context: bounded(input.context), lawfulBasis: input.lawfulBasis ?? "unknown",
    contactable: input.contactable ?? false, assetOwned: input.assetOwned ?? false, conversationOwned: input.conversationOwned ?? false, riskScore: input.riskScore,
  }).returning();
  return opportunity!;
}

/** Converts only already-redacted Regional Radar evidence; no identity hint is exposed or copied. */
export async function prepareRegionalAudienceInteraction(workspaceId: string, audienceOpportunityId: string, integrationId: string, action: Action) {
  const [audience] = await db.select().from(regionalAudienceOpportunitiesTable).where(and(eq(regionalAudienceOpportunitiesTable.id, audienceOpportunityId), eq(regionalAudienceOpportunitiesTable.workspaceId, workspaceId))).limit(1);
  if (!audience?.identityHintFingerprint) throw new Error("Oportunidade regional não contém fingerprint seguro para interação.");
  const [signal] = await db.select().from(regionalSocialSignalsTable).where(and(eq(regionalSocialSignalsTable.id, audience.signalId), eq(regionalSocialSignalsTable.workspaceId, workspaceId))).limit(1);
  const [integration] = await db.select().from(workspaceIntegrationsTable).where(and(eq(workspaceIntegrationsTable.id, integrationId), eq(workspaceIntegrationsTable.workspaceId, workspaceId))).limit(1);
  if (!signal || !integration) throw new Error("Sinal ou integração não pertencem ao workspace.");
  if (integration.provider !== signal.platform) throw new Error("A plataforma da integração não corresponde ao sinal regional.");
  const [competitor] = audience.competitorId ? await db.select({ id: regionalCompetitorsTable.id, name: regionalCompetitorsTable.name }).from(regionalCompetitorsTable).where(and(eq(regionalCompetitorsTable.id, audience.competitorId), eq(regionalCompetitorsTable.workspaceId, workspaceId))).limit(1) : [undefined];
  let [recipient] = await db.select().from(interactionRecipientsTable).where(and(eq(interactionRecipientsTable.workspaceId, workspaceId), eq(interactionRecipientsTable.fingerprint, audience.identityHintFingerprint))).limit(1);
  if (!recipient) [recipient] = await db.insert(interactionRecipientsTable).values({ workspaceId, fingerprint: audience.identityHintFingerprint, purpose: audience.processingPurpose ?? "public engagement", jurisdictionCodes: audience.jurisdictionCodes, retentionUntil: audience.retentionUntil }).onConflictDoNothing().returning();
  if (!recipient) [recipient] = await db.select().from(interactionRecipientsTable).where(and(eq(interactionRecipientsTable.workspaceId, workspaceId), eq(interactionRecipientsTable.fingerprint, audience.identityHintFingerprint))).limit(1);
  const privateAllowed = audience.contactPermission === "permitted" && audience.lawfulBasis === "permitted";
  const [created] = await db.insert(interactionOpportunitiesTable).values({
    workspaceId, campaignId: audience.campaignId, sourceAudienceOpportunityId: audience.id, recipientId: recipient!.id, integrationId,
    platform: signal.platform, action, competitorRef: competitor?.name ?? null, postRef: signal.postRef,
    evidence: bounded({ sourceOpportunityId: audience.id, sourceUrl: signal.normalizedSourceUrl, postRef: signal.postRef, publicExcerpt: signal.publicTextExcerpt }),
    context: bounded({ heatScore: audience.heatScore, heatBand: audience.heatBand, heatReasons: audience.scoreReasons, region: audience.inferredRegion, competitor: competitor?.name }),
    lawfulBasis: action === "public_comment" ? "unknown" : audience.lawfulBasis, contactable: action === "public_comment" ? false : privateAllowed,
    assetOwned: false, conversationOwned: false, riskScore: action === "private_message" ? 100 : Math.max(0, 100 - audience.heatScore),
  }).onConflictDoNothing().returning();
  if (created) return { opportunity: created, deduplicated: false };
  const [existing] = await db.select().from(interactionOpportunitiesTable).where(and(eq(interactionOpportunitiesTable.sourceAudienceOpportunityId, audience.id), eq(interactionOpportunitiesTable.integrationId, integrationId), eq(interactionOpportunitiesTable.action, action))).limit(1);
  return { opportunity: existing!, deduplicated: true };
}

export async function governOpportunity(workspaceId: string, opportunityId: string, automatic = false): Promise<GateResult> {
  const [opportunity] = await db.select().from(interactionOpportunitiesTable).where(and(eq(interactionOpportunitiesTable.id, opportunityId), eq(interactionOpportunitiesTable.workspaceId, workspaceId))).limit(1);
  if (!opportunity) throw new Error("Oportunidade não encontrada.");
  const [policy] = await db.select().from(interactionGovernancePoliciesTable).where(eq(interactionGovernancePoliciesTable.workspaceId, workspaceId)).limit(1);
  const [capability] = await db.select().from(interactionPlatformCapabilitiesTable).where(and(eq(interactionPlatformCapabilitiesTable.workspaceId, workspaceId), eq(interactionPlatformCapabilitiesTable.integrationId, opportunity.integrationId), eq(interactionPlatformCapabilitiesTable.action, opportunity.action))).limit(1);
  const [integration] = await db.select().from(workspaceIntegrationsTable).where(and(eq(workspaceIntegrationsTable.id, opportunity.integrationId), eq(workspaceIntegrationsTable.workspaceId, workspaceId))).limit(1);
  const [recipient] = await db.select().from(interactionRecipientsTable).where(and(eq(interactionRecipientsTable.id, opportunity.recipientId), eq(interactionRecipientsTable.workspaceId, workspaceId))).limit(1);
  if (!policy || !recipient) throw new Error("Política ou destinatário de interação não encontrado.");
  const since = new Date(Date.now() - policy.recipientCooldownMinutes * 60_000);
  const previous = await db.select({ id: interactionExecutionsTable.id }).from(interactionExecutionsTable).innerJoin(interactionOpportunitiesTable, eq(interactionExecutionsTable.opportunityId, interactionOpportunitiesTable.id)).where(and(eq(interactionExecutionsTable.workspaceId, workspaceId), eq(interactionOpportunitiesTable.recipientId, recipient.id), gte(interactionExecutionsTable.reservedAt, since))).limit(1);
  const result = evaluateInteractionGate({ policy, capability, integrationHealthy: integration?.status === "connected", action: opportunity.action, evidence: opportunity.evidence as Json, context: opportunity.context as Json, riskScore: opportunity.riskScore, optedOut: recipient.optedOut, duplicate: false, cooldown: previous.length > 0, lawfulBasis: opportunity.lawfulBasis, contactable: opportunity.contactable, assetOwned: opportunity.assetOwned, conversationOwned: opportunity.conversationOwned, automatic });
  await db.insert(interactionDecisionsTable).values({ workspaceId, opportunityId, decision: result.decision, reasons: result.reasons, governorSnapshot: { automatic } });
  await db.update(interactionOpportunitiesTable).set({ state: result.decision === "blocked" ? "blocked" : result.decision === "requires_approval" ? "awaiting_approval" : "approved", updatedAt: new Date() }).where(and(eq(interactionOpportunitiesTable.id, opportunityId), eq(interactionOpportunitiesTable.workspaceId, workspaceId)));
  return result;
}

export type InteractionCouncilProvider = (input: { workspaceId: string; opportunity: Json }) => Promise<string>;
const defaultCouncilProvider: InteractionCouncilProvider = async ({ workspaceId, opportunity }) => {
  const result = await completeWithAgentSafe("social_media", "You are an interaction council. Return ONLY strict JSON with observerSummary,intentScore,affinityScore,contactability,riskAssessment,recommendedAction,ctaLevel,draft,reasoning,confidence. Scores integers 0-100; CTA integer 0-5; draft max 800 chars. Do not request or use private PII. Recommendation never grants permission.", [{ role: "user", content: JSON.stringify(opportunity) }], workspaceId, logger, undefined, "pt-BR", undefined, 700);
  if (!result.success) throw new Error(`Conselho indisponível: ${result.message}`);
  return result.content;
};
function parseCouncil(content: string): Json {
  if (content.length > 12_000) throw new Error("Resposta do conselho excede o limite.");
  let raw: unknown; try { raw = JSON.parse(content); } catch { throw new Error("Conselho retornou JSON inválido."); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Conselho retornou formato inválido.");
  const data = raw as Json;
  const required = ["observerSummary", "intentScore", "affinityScore", "contactability", "riskAssessment", "recommendedAction", "ctaLevel", "draft", "reasoning", "confidence"];
  if (required.some((key) => data[key] === undefined) || typeof data["draft"] !== "string" || typeof data["ctaLevel"] !== "number") throw new Error("Conselho retornou campos inválidos.");
  return boundInteractionPayload(data);
}
export async function runInteractionCouncil(workspaceId: string, opportunityId: string, provider: InteractionCouncilProvider = defaultCouncilProvider) {
  const key = `${workspaceId}:${opportunityId}`;
  const existing = councilInflight.get(key); if (existing) return existing;
  const run = (async () => {
    const gate = await governOpportunity(workspaceId, opportunityId, false);
    if (gate.decision === "blocked") return { assessment: {} as Json, draft: null, gate };
    const detail = await getInteractionOpportunity(workspaceId, opportunityId);
    if (!detail) throw new Error("Oportunidade não encontrada.");
    const opportunity = detail.opportunity;
    const assessment = parseCouncil(await provider({ workspaceId, opportunity: { action: opportunity.action, platform: opportunity.platform, evidence: bounded(opportunity.evidence as Json), context: bounded(opportunity.context as Json), riskScore: opportunity.riskScore, contactable: opportunity.contactable, assetOwned: opportunity.assetOwned, conversationOwned: opportunity.conversationOwned } }));
    const proposedCta = Number(assessment["ctaLevel"]);
    const cap = (!opportunity.assetOwned && !opportunity.conversationOwned) ? 2 : opportunity.riskScore > 25 ? 2 : 5;
    const ctaLevel = Math.min(Math.max(0, Math.floor(proposedCta)), cap);
    assessment["ctaLevel"] = ctaLevel;
    const draft = await proposeInteractionDraft(workspaceId, opportunityId, String(assessment["draft"]).slice(0, 800), ctaLevel, assessment);
    return { assessment, draft, gate };
  })();
  councilInflight.set(key, run);
  try { return await run; } finally { councilInflight.delete(key); }
}

export async function proposeInteractionDraft(workspaceId: string, opportunityId: string, content: string, ctaLevel: number, councilAssessment: Json = {}) {
  const drafts = await db.select({ content: interactionDraftsTable.content }).from(interactionDraftsTable).where(eq(interactionDraftsTable.workspaceId, workspaceId)).orderBy(desc(interactionDraftsTable.createdAt)).limit(100);
  validateInteractionDraft(content, ctaLevel, drafts.map((draft) => draft.content));
  const [draft] = await db.insert(interactionDraftsTable).values({ workspaceId, opportunityId, content: content.trim().slice(0, 4000), contentFingerprint: hash(content), ctaLevel, councilAssessment: bounded(councilAssessment), similarityScore: 0, state: "awaiting_approval" }).returning();
  return draft!;
}

export async function decideInteractionDraft(workspaceId: string, draftId: string, approved: boolean, userId?: string, modifiedContent?: string, reason?: string) {
  const [draft] = await db.select().from(interactionDraftsTable).where(and(eq(interactionDraftsTable.id, draftId), eq(interactionDraftsTable.workspaceId, workspaceId))).limit(1);
  if (!draft) throw new Error("Rascunho não encontrado.");
  await db.insert(interactionApprovalsTable).values({ workspaceId, draftId, decision: approved ? "approved" : "rejected", decidedByUserId: userId ?? null, modifiedContent: modifiedContent ?? null, reason: reason ?? null });
  await db.update(interactionDraftsTable).set({ state: approved ? "approved" : "cancelled", content: modifiedContent?.trim().slice(0, 4000) || draft.content }).where(eq(interactionDraftsTable.id, draftId));
  await db.update(interactionOpportunitiesTable).set({ state: approved ? "approved" : "cancelled", updatedAt: new Date() }).where(and(eq(interactionOpportunitiesTable.id, draft.opportunityId), eq(interactionOpportunitiesTable.workspaceId, workspaceId)));
}

export async function listInteractionOpportunities(workspaceId: string, limit = 50) {
  return db.select().from(interactionOpportunitiesTable).where(eq(interactionOpportunitiesTable.workspaceId, workspaceId)).orderBy(desc(interactionOpportunitiesTable.createdAt)).limit(Math.min(Math.max(limit, 1), 100));
}
export async function getInteractionOpportunity(workspaceId: string, opportunityId: string) {
  const [opportunity] = await db.select().from(interactionOpportunitiesTable).where(and(eq(interactionOpportunitiesTable.workspaceId, workspaceId), eq(interactionOpportunitiesTable.id, opportunityId))).limit(1);
  if (!opportunity) return null;
  const drafts = await db.select().from(interactionDraftsTable).where(and(eq(interactionDraftsTable.workspaceId, workspaceId), eq(interactionDraftsTable.opportunityId, opportunityId))).orderBy(desc(interactionDraftsTable.createdAt));
  const executions = await db.select().from(interactionExecutionsTable).where(and(eq(interactionExecutionsTable.workspaceId, workspaceId), eq(interactionExecutionsTable.opportunityId, opportunityId))).orderBy(desc(interactionExecutionsTable.reservedAt));
  return { opportunity, drafts, executions };
}
/** Operator evidence is the only execution recording endpoint. No adapter/API call occurs here. */
export async function markInteractionOperatorExecuted(workspaceId: string, opportunityId: string, draftId: string | undefined, evidence: Json) {
  if (!Object.keys(evidence).length) throw new Error("Evidência de execução do operador é obrigatória.");
  // Advisory lock makes rolling-window reservation atomic across every account in this workspace.
  // It deliberately serializes by workspace, rather than account, so connected accounts cannot multiply a quota.
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${workspaceId}))`);
    const [opportunity] = await tx.select().from(interactionOpportunitiesTable).where(and(eq(interactionOpportunitiesTable.id, opportunityId), eq(interactionOpportunitiesTable.workspaceId, workspaceId))).limit(1);
    const [policy] = await tx.select().from(interactionGovernancePoliciesTable).where(eq(interactionGovernancePoliciesTable.workspaceId, workspaceId)).limit(1);
    if (!opportunity || opportunity.state !== "approved" || !policy) throw new Error("Somente oportunidade aprovada com política pode ser registrada pelo operador.");
    const since = new Date(Date.now() - policy.windowMinutes * 60_000);
    const reserved = await tx.select({
      integrationId: interactionOpportunitiesTable.integrationId, competitorRef: interactionOpportunitiesTable.competitorRef,
      postRef: interactionOpportunitiesTable.postRef, recipientId: interactionOpportunitiesTable.recipientId,
    }).from(interactionExecutionsTable).innerJoin(interactionOpportunitiesTable, eq(interactionExecutionsTable.opportunityId, interactionOpportunitiesTable.id))
      .where(and(eq(interactionExecutionsTable.workspaceId, workspaceId), gte(interactionExecutionsTable.reservedAt, since)));
    const exceeds = (ceiling: number, count: number) => ceiling > 0 && count >= ceiling;
    if (exceeds(policy.workspaceCeiling, reserved.length) ||
      exceeds(policy.accountCeiling, reserved.filter((r) => r.integrationId === opportunity.integrationId).length) ||
      exceeds(policy.competitorCeiling, reserved.filter((r) => r.competitorRef && r.competitorRef === opportunity.competitorRef).length) ||
      exceeds(policy.postCeiling, reserved.filter((r) => r.postRef && r.postRef === opportunity.postRef).length) ||
      exceeds(policy.recipientCeiling, reserved.filter((r) => r.recipientId === opportunity.recipientId).length)) throw new Error("Quota de interação excedida na janela móvel.");
    const [execution] = await tx.insert(interactionExecutionsTable).values({ workspaceId, opportunityId, draftId: draftId ?? null, mode: "operator_assisted", state: "executing", evidence: bounded(evidence) }).returning();
    await tx.update(interactionOpportunitiesTable).set({ state: "executing", updatedAt: new Date() }).where(eq(interactionOpportunitiesTable.id, opportunityId));
    return execution!;
  });
}
export async function recordInteractionOutcome(workspaceId: string, executionId: string, result: Json, incident?: Json) {
  const [execution] = await db.select().from(interactionExecutionsTable).where(and(eq(interactionExecutionsTable.id, executionId), eq(interactionExecutionsTable.workspaceId, workspaceId))).limit(1);
  if (!execution) throw new Error("Execução não encontrada.");
  const state = incident && Object.keys(incident).length ? "failed" : "verified";
  const [updated] = await db.update(interactionExecutionsTable).set({ state, result: bounded(result), incident: incident ? bounded(incident) : null, completedAt: new Date() }).where(eq(interactionExecutionsTable.id, executionId)).returning();
  await db.update(interactionOpportunitiesTable).set({ state, updatedAt: new Date() }).where(and(eq(interactionOpportunitiesTable.id, execution.opportunityId), eq(interactionOpportunitiesTable.workspaceId, workspaceId)));
  return updated!;
}