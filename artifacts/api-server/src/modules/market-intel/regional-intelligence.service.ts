import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  campaignsTable, db, regionalAlertsTable, regionalChangeEventsTable, regionalCompetitorsTable,
  regionalEvidenceTable, regionalMonitorRunsTable, regionalObservationsTable, regionalProfilesTable,
  regionalPublicSourcesTable, regionalSocialSignalsTable, regionalAudienceOpportunitiesTable,
  regionalAudienceSegmentsTable,
} from "@workspace/db";
import { calculateDeterministicHeat } from "./regional-audience-scoring.js";
import { reserveRadarUsage } from "./radar-entitlements.service.js";
export { calculateDeterministicHeat, type DeterministicHeatInput } from "./regional-audience-scoring.js";

type Json = Record<string, unknown>;
const object = (value: unknown): Json => value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value as Json).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)])) : value;
const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
const PUBLIC_EXCERPT_LIMIT = 500;
const redactPublicExcerpt = (value: string | undefined) => value?.trim()
  .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[redacted-email]")
  .replace(/(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,3}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}\b/g, "[redacted-phone]")
  .slice(0, PUBLIC_EXCERPT_LIMIT) || null;
export function normalizeCountryCode(value: string) {
  const code = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new Error("countryCode deve ser ISO 3166-1 alpha-2.");
  return code;
}
export function normalizeE164(value: string) {
  const phone = value.trim().replace(/[\s().-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error("Telefone deve estar no formato E.164.");
  return phone;
}
export function validateIanaTimezone(value: string) {
  try { Intl.DateTimeFormat(undefined, { timeZone: value }); return value; } catch { throw new Error("timezone deve ser um identificador IANA válido."); }
}

/** Normalizes only absolute http(s) public URLs; acquisition is intentionally out of scope. */
export function normalizePublicUrl(value: string): string {
  const url = new URL(value.trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("A URL pública precisa usar HTTP ou HTTPS.");
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = "";
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  return url.toString();
}
export async function campaignOwned(workspaceId: string, campaignId: string) {
  const [row] = await db.select({ id: campaignsTable.id }).from(campaignsTable).where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId))).limit(1);
  return Boolean(row);
}
async function requireCampaign(workspaceId: string, campaignId: string) {
  if (!await campaignOwned(workspaceId, campaignId)) throw new Error("Campanha não encontrada neste workspace.");
}

export async function upsertRegionalProfile(workspaceId: string, campaignId: string, region: string, locale: string, config: Json, geo: { countryCode?: string; subdivision?: string; city?: string; postalCode?: string; address?: Json; timezone?: string; languages?: string[]; operatingRegions?: Json[]; residenceRegion?: Json; serviceRegion?: Json; geoProvenance?: Json; geoConfidence?: number } = {}) {
  await requireCampaign(workspaceId, campaignId);
  const values = { region, locale, config, countryCode: geo.countryCode ? normalizeCountryCode(geo.countryCode) : null, subdivision: geo.subdivision?.trim() || null, city: geo.city?.trim() || null, postalCode: geo.postalCode?.trim() || null, address: geo.address ?? {}, timezone: geo.timezone ? validateIanaTimezone(geo.timezone) : null, languages: geo.languages ?? [], operatingRegions: geo.operatingRegions ?? [], residenceRegion: geo.residenceRegion ?? {}, serviceRegion: geo.serviceRegion ?? {}, geoProvenance: geo.geoProvenance ?? {}, geoConfidence: geo.geoConfidence ?? null, updatedAt: new Date() };
  const [existing] = await db.select().from(regionalProfilesTable).where(and(eq(regionalProfilesTable.workspaceId, workspaceId), eq(regionalProfilesTable.campaignId, campaignId))).limit(1);
  if (existing) {
    // A profile is one monitored campaign. Region/language capacity only grows
    // when new language targets are added, so repeated saves never double charge.
    const before = new Set((Array.isArray(existing.languages) ? existing.languages : []).filter((x): x is string => typeof x === "string"));
    const added = (geo.languages ?? []).filter((language) => !before.has(language));
    if (added.length) await reserveRadarUsage({ workspaceId, campaignId, dimension: "region", quantity: added.length, idempotencyKey: `region:${campaignId}:${added.sort().join(",")}`, metadata: { targets: added } });
    const [updated] = await db.update(regionalProfilesTable).set(values).where(eq(regionalProfilesTable.id, existing.id)).returning();
    return updated!;
  }
  const targets = [...new Set((geo.languages ?? []).map((language) => language.trim()).filter(Boolean))];
  await reserveRadarUsage({ workspaceId, campaignId, dimension: "monitored_campaign", idempotencyKey: `monitored-campaign:${campaignId}` });
  await reserveRadarUsage({ workspaceId, campaignId, dimension: "region", quantity: Math.max(1, targets.length), idempotencyKey: `region:${campaignId}:${targets.sort().join(",") || region.trim().toLowerCase()}`, metadata: { region, targets } });
  const [created] = await db.insert(regionalProfilesTable).values({ workspaceId, campaignId, ...values }).returning();
  return created!;
}
export async function getRegionalProfile(workspaceId: string, campaignId: string) {
  await requireCampaign(workspaceId, campaignId);
  const [row] = await db.select().from(regionalProfilesTable).where(and(eq(regionalProfilesTable.workspaceId, workspaceId), eq(regionalProfilesTable.campaignId, campaignId))).limit(1);
  return row ?? null;
}
export async function createCompetitor(workspaceId: string, campaignId: string, input: { name: string; kind: "direct" | "indirect" | "substitute" | "aspirational" | "emerging"; websiteUrl?: string; notes?: string }) {
  await requireCampaign(workspaceId, campaignId);
  const normalizedWebsiteUrl = input.websiteUrl ? normalizePublicUrl(input.websiteUrl) : null;
  if (normalizedWebsiteUrl) {
    const [existing] = await db.select({ id: regionalCompetitorsTable.id }).from(regionalCompetitorsTable).where(and(eq(regionalCompetitorsTable.workspaceId, workspaceId), eq(regionalCompetitorsTable.campaignId, campaignId), eq(regionalCompetitorsTable.normalizedWebsiteUrl, normalizedWebsiteUrl))).limit(1);
    if (existing) throw new Error("Concorrente com esta URL já existe na campanha.");
  }
  if (!normalizedWebsiteUrl) {
    const existingNames = await db.select({ id: regionalCompetitorsTable.id, name: regionalCompetitorsTable.name }).from(regionalCompetitorsTable).where(and(eq(regionalCompetitorsTable.workspaceId, workspaceId), eq(regionalCompetitorsTable.campaignId, campaignId)));
    if (existingNames.some((row) => row.name.trim().toLowerCase() === input.name.trim().toLowerCase())) throw new Error("Concorrente com este nome já existe na campanha.");
  }
  // URL is the stable identity; name-only entries use a deterministic normalized
  // name and are still protected from accidental repeat submissions.
  const identity = normalizedWebsiteUrl ?? `name:${input.name.trim().toLowerCase()}`;
  await reserveRadarUsage({ workspaceId, campaignId, dimension: "competitor", idempotencyKey: `competitor:${campaignId}:${identity}`, metadata: { identity } });
  const [row] = await db.insert(regionalCompetitorsTable).values({ workspaceId, campaignId, name: input.name.trim(), kind: input.kind, websiteUrl: input.websiteUrl?.trim() ?? null, normalizedWebsiteUrl, notes: input.notes?.trim() ?? null }).onConflictDoNothing().returning();
  if (!row) throw new Error("Concorrente com esta URL já existe na campanha.");
  return row;
}
export async function listCompetitors(workspaceId: string, campaignId: string) {
  await requireCampaign(workspaceId, campaignId);
  return db.select().from(regionalCompetitorsTable).where(and(eq(regionalCompetitorsTable.workspaceId, workspaceId), eq(regionalCompetitorsTable.campaignId, campaignId))).orderBy(desc(regionalCompetitorsTable.createdAt));
}
export async function createVerifiedEvidence(workspaceId: string, campaignId: string, input: { competitorId?: string; url: string; title?: string; sourceType?: string; claim: string; payload?: Json; observedAt: Date }) {
  await requireCampaign(workspaceId, campaignId);
  const normalizedUrl = normalizePublicUrl(input.url);
  if (input.competitorId) {
    const [competitor] = await db.select({ id: regionalCompetitorsTable.id }).from(regionalCompetitorsTable).where(and(eq(regionalCompetitorsTable.id, input.competitorId), eq(regionalCompetitorsTable.workspaceId, workspaceId), eq(regionalCompetitorsTable.campaignId, campaignId))).limit(1);
    if (!competitor) throw new Error("Concorrente não encontrado nesta campanha.");
  }
  let [source] = await db.select().from(regionalPublicSourcesTable).where(and(eq(regionalPublicSourcesTable.workspaceId, workspaceId), eq(regionalPublicSourcesTable.campaignId, campaignId), eq(regionalPublicSourcesTable.normalizedUrl, normalizedUrl))).limit(1);
  if (!source) [source] = await db.insert(regionalPublicSourcesTable).values({ workspaceId, campaignId, competitorId: input.competitorId ?? null, url: input.url.trim(), normalizedUrl, title: input.title?.trim() ?? null, sourceType: input.sourceType?.trim() || "public_web", verifiedAt: input.observedAt }).returning();
  const evidenceFingerprint = fingerprint({ normalizedUrl, claim: input.claim.trim(), payload: input.payload ?? {}, observedAt: input.observedAt.toISOString() });
  const [existing] = await db.select().from(regionalEvidenceTable).where(and(eq(regionalEvidenceTable.workspaceId, workspaceId), eq(regionalEvidenceTable.fingerprint, evidenceFingerprint))).limit(1);
  if (existing) return { evidence: existing, deduplicated: true };
  const [evidence] = await db.insert(regionalEvidenceTable).values({ workspaceId, campaignId, sourceId: source!.id, fingerprint: evidenceFingerprint, claim: input.claim.trim(), payload: input.payload ?? {}, observedAt: input.observedAt }).returning();
  return { evidence: evidence!, deduplicated: false };
}
export async function listVerifiedEvidence(workspaceId: string, campaignId: string, limit = 50) {
  await requireCampaign(workspaceId, campaignId);
  return db.select().from(regionalEvidenceTable).where(and(
    eq(regionalEvidenceTable.workspaceId, workspaceId), eq(regionalEvidenceTable.campaignId, campaignId),
  )).orderBy(desc(regionalEvidenceTable.observedAt)).limit(Math.min(Math.max(limit, 1), 100));
}
function diffFacts(before: Json, after: Json): Json {
  const changed: Json = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) if (JSON.stringify(stable(before[key])) !== JSON.stringify(stable(after[key]))) changed[key] = { before: before[key] ?? null, after: after[key] ?? null };
  return changed;
}
export async function recordObservation(workspaceId: string, campaignId: string, input: { competitorId: string; evidenceId: string; facts: Json; observedAt: Date }) {
  await requireCampaign(workspaceId, campaignId);
  const [competitor] = await db.select({ id: regionalCompetitorsTable.id }).from(regionalCompetitorsTable).where(and(eq(regionalCompetitorsTable.id, input.competitorId), eq(regionalCompetitorsTable.workspaceId, workspaceId), eq(regionalCompetitorsTable.campaignId, campaignId))).limit(1);
  const [evidence] = await db.select({ id: regionalEvidenceTable.id }).from(regionalEvidenceTable).where(and(eq(regionalEvidenceTable.id, input.evidenceId), eq(regionalEvidenceTable.workspaceId, workspaceId), eq(regionalEvidenceTable.campaignId, campaignId))).limit(1);
  if (!competitor || !evidence) throw new Error("Concorrente ou evidência não pertencem à campanha.");
  const observationFingerprint = fingerprint({ competitorId: input.competitorId, evidenceId: input.evidenceId, facts: input.facts, observedAt: input.observedAt.toISOString() });
  const [already] = await db.select().from(regionalObservationsTable).where(and(eq(regionalObservationsTable.workspaceId, workspaceId), eq(regionalObservationsTable.fingerprint, observationFingerprint))).limit(1);
  if (already) return { observation: already, changeEvent: null, deduplicated: true };
  const [previous] = await db.select().from(regionalObservationsTable).where(and(eq(regionalObservationsTable.workspaceId, workspaceId), eq(regionalObservationsTable.campaignId, campaignId), eq(regionalObservationsTable.competitorId, input.competitorId))).orderBy(desc(regionalObservationsTable.observedAt)).limit(1);
  const [observation] = await db.insert(regionalObservationsTable).values({ workspaceId, campaignId, competitorId: input.competitorId, evidenceId: input.evidenceId, fingerprint: observationFingerprint, facts: input.facts, observedAt: input.observedAt }).returning();
  const changes = previous ? diffFacts(object(previous.facts), input.facts) : {};
  if (!previous || Object.keys(changes).length === 0) return { observation: observation!, changeEvent: null, deduplicated: false };
  const [changeEvent] = await db.insert(regionalChangeEventsTable).values({ workspaceId, campaignId, competitorId: input.competitorId, observationId: observation!.id, previousObservationId: previous.id, changes, material: "true" }).returning();
  await db.insert(regionalAlertsTable).values({ workspaceId, campaignId, changeEventId: changeEvent!.id });
  return { observation: observation!, changeEvent: changeEvent!, deduplicated: false };
}
export async function listObservations(workspaceId: string, campaignId: string, limit = 50) {
  await requireCampaign(workspaceId, campaignId);
  return db.select().from(regionalObservationsTable).where(and(
    eq(regionalObservationsTable.workspaceId, workspaceId), eq(regionalObservationsTable.campaignId, campaignId),
  )).orderBy(desc(regionalObservationsTable.observedAt)).limit(Math.min(Math.max(limit, 1), 100));
}
export async function startMonitorRun(workspaceId: string, campaignId: string, idempotencyKey: string) {
  await requireCampaign(workspaceId, campaignId);
  const [existing] = await db.select().from(regionalMonitorRunsTable).where(and(eq(regionalMonitorRunsTable.workspaceId, workspaceId), eq(regionalMonitorRunsTable.campaignId, campaignId), eq(regionalMonitorRunsTable.idempotencyKey, idempotencyKey))).limit(1);
  if (existing) return existing;
  const [run] = await db.insert(regionalMonitorRunsTable).values({ workspaceId, campaignId, idempotencyKey, status: "running", startedAt: new Date() }).returning();
  return run!;
}
export async function finishMonitorRun(workspaceId: string, runId: string, status: "completed" | "failed", summary: Json, error?: string) {
  const [run] = await db.update(regionalMonitorRunsTable).set({ status, summary, error: error ?? null, completedAt: new Date() }).where(and(eq(regionalMonitorRunsTable.id, runId), eq(regionalMonitorRunsTable.workspaceId, workspaceId))).returning();
  return run ?? null;
}
export async function listMonitorRuns(workspaceId: string, campaignId: string, limit = 50) {
  await requireCampaign(workspaceId, campaignId);
  return db.select().from(regionalMonitorRunsTable).where(and(
    eq(regionalMonitorRunsTable.workspaceId, workspaceId), eq(regionalMonitorRunsTable.campaignId, campaignId),
  )).orderBy(desc(regionalMonitorRunsTable.createdAt)).limit(Math.min(Math.max(limit, 1), 100));
}
export async function listAlerts(workspaceId: string, campaignId: string) {
  await requireCampaign(workspaceId, campaignId);
  return db.select().from(regionalAlertsTable).where(and(eq(regionalAlertsTable.workspaceId, workspaceId), eq(regionalAlertsTable.campaignId, campaignId))).orderBy(desc(regionalAlertsTable.createdAt)).limit(100);
}
export async function acknowledgeAlert(workspaceId: string, alertId: string, userId?: string) {
  const [alert] = await db.update(regionalAlertsTable).set({ status: "acknowledged", acknowledgedAt: new Date(), acknowledgedByUserId: userId ?? null }).where(and(eq(regionalAlertsTable.id, alertId), eq(regionalAlertsTable.workspaceId, workspaceId))).returning();
  return alert ?? null;
}
export interface PublicInteractionSignalInput {
  platform: string; publicAccountRef?: string; displayName?: string; sourceUrl: string; postRef?: string;
  interactionType: string; publicTextExcerpt?: string; occurredAt: Date; sentiment?: string; intent?: string;
  confidence?: number; regionInference?: string; regionProvenance?: Json;
  lawfulBasisStatus?: "unknown" | "not_permitted" | "permitted" | "opted_out";
  sensitiveDataExcluded: true;
}
export type OpportunityLifecycle = "observed" | "qualified" | "ready_for_activation" | "activated" | "converted" | "discarded";
export function safeIdentityHintFingerprint(platform: string, publicAccountRef?: string | null, crossPlatformHint?: string | null) {
  const hint = crossPlatformHint?.trim() || publicAccountRef?.trim();
  return hint ? fingerprint({ namespace: "regional-public-identity/v1", platform: crossPlatformHint ? "cross-platform" : platform.toLowerCase(), hint: hint.toLowerCase() }) : null;
}

/** Accepts only authorized public evidence. It deliberately has no contact identity or outreach fields. */
export async function upsertPublicInteractionSignal(workspaceId: string, campaignId: string, input: PublicInteractionSignalInput) {
  await requireCampaign(workspaceId, campaignId);
  const normalizedSourceUrl = normalizePublicUrl(input.sourceUrl);
  const safeExcerpt = redactPublicExcerpt(input.publicTextExcerpt);
  const key = fingerprint({
    campaignId, platform: input.platform.trim().toLowerCase(), normalizedSourceUrl, postRef: input.postRef?.trim() ?? null,
    interactionType: input.interactionType.trim().toLowerCase(), occurredAt: input.occurredAt.toISOString(), excerpt: safeExcerpt,
  });
  const [existing] = await db.select().from(regionalSocialSignalsTable).where(and(
    eq(regionalSocialSignalsTable.workspaceId, workspaceId), eq(regionalSocialSignalsTable.fingerprint, key),
  )).limit(1);
  if (existing) return { signal: existing, deduplicated: true };
  const [signal] = await db.insert(regionalSocialSignalsTable).values({
    workspaceId, campaignId, platform: input.platform.trim().toLowerCase(),
    publicAccountRef: input.publicAccountRef?.trim().slice(0, 300) || null,
    displayName: input.displayName?.trim().slice(0, 300) || null, sourceUrl: input.sourceUrl.trim(), normalizedSourceUrl,
    postRef: input.postRef?.trim().slice(0, 500) || null, interactionType: input.interactionType.trim().toLowerCase(),
    publicTextExcerpt: safeExcerpt, occurredAt: input.occurredAt, sentiment: input.sentiment?.trim().slice(0, 100) || null,
    intent: input.intent?.trim().slice(0, 100) || null, confidence: input.confidence ?? null,
    regionInference: input.regionInference?.trim().slice(0, 500) || null, regionProvenance: input.regionProvenance ?? {},
    lawfulBasisStatus: input.lawfulBasisStatus ?? "unknown", sensitiveDataExcluded: true, fingerprint: key,
  }).returning();
  return { signal: signal!, deduplicated: false };
}

export async function listPublicInteractionSignals(workspaceId: string, campaignId: string, limit = 50) {
  await requireCampaign(workspaceId, campaignId);
  return db.select().from(regionalSocialSignalsTable).where(and(
    eq(regionalSocialSignalsTable.workspaceId, workspaceId), eq(regionalSocialSignalsTable.campaignId, campaignId),
  )).orderBy(desc(regionalSocialSignalsTable.occurredAt)).limit(Math.min(Math.max(limit, 1), 100));
}

/** Promotion creates an aggregate opportunity only; it never creates a lead/contact or permits outreach. */
export async function promoteSignalToAudienceOpportunity(workspaceId: string, campaignId: string, signalId: string, opportunityType: string, summary: string, attributes: Json = {}, options: { interestTopic?: string; competitorId?: string; crossPlatformIdentityHint?: string; contactPhoneE164?: string; processingPurpose?: string; lawfulBasis?: "unknown" | "not_permitted" | "permitted" | "opted_out"; consentSource?: string; consentedAt?: Date; jurisdictionCodes?: string[]; retentionUntil?: Date; deletionState?: "active" | "opted_out" | "pending_deletion" | "deleted" } = {}) {
  await requireCampaign(workspaceId, campaignId);
  const [signal] = await db.select().from(regionalSocialSignalsTable).where(and(
    eq(regionalSocialSignalsTable.id, signalId), eq(regionalSocialSignalsTable.workspaceId, workspaceId),
    eq(regionalSocialSignalsTable.campaignId, campaignId),
  )).limit(1);
  if (!signal) throw new Error("Sinal público não encontrado nesta campanha.");
  const identityHintFingerprint = safeIdentityHintFingerprint(signal.platform, signal.publicAccountRef, options.crossPlatformIdentityHint);
  const lawfulBasis = options.lawfulBasis ?? signal.lawfulBasisStatus;
  if (options.contactPhoneE164 && lawfulBasis !== "permitted") throw new Error("Telefone só pode ser armazenado com base legal explícita.");
  const contactPhoneE164 = options.contactPhoneE164 ? normalizeE164(options.contactPhoneE164) : null;
  const [existing] = await db.select().from(regionalAudienceOpportunitiesTable).where(and(
    eq(regionalAudienceOpportunitiesTable.workspaceId, workspaceId),
    eq(regionalAudienceOpportunitiesTable.campaignId, campaignId),
    identityHintFingerprint ? eq(regionalAudienceOpportunitiesTable.identityHintFingerprint, identityHintFingerprint) : eq(regionalAudienceOpportunitiesTable.signalId, signalId),
  )).limit(1);
  const frequency = (existing?.interactionFrequency ?? 0) + 1;
  const heat = calculateDeterministicHeat({ intent: signal.intent, sentiment: signal.sentiment, confidence: signal.confidence, occurredAt: signal.occurredAt, interactionType: signal.interactionType, frequency });
  const evidenceRefs = [...new Set([...(Array.isArray(existing?.evidenceRefs) ? existing!.evidenceRefs as string[] : []), signal.normalizedSourceUrl, signal.postRef].filter(Boolean))].slice(-20);
  if (existing) {
    const [updated] = await db.update(regionalAudienceOpportunitiesTable).set({
      heatScore: heat.heatScore, heatBand: heat.heatBand, scoreReasons: heat.reasons, evidenceRefs,
      interactionRecencyHours: heat.recencyHours, interactionFrequency: frequency,
      contactPermission: existing.contactPermission === "opted_out" ? "opted_out" : signal.lawfulBasisStatus, updatedAt: new Date(),
    }).where(and(eq(regionalAudienceOpportunitiesTable.id, existing.id), eq(regionalAudienceOpportunitiesTable.workspaceId, workspaceId))).returning();
    return { opportunity: updated!, deduplicated: true };
  }
  if (options.competitorId) {
    const [competitor] = await db.select({ id: regionalCompetitorsTable.id }).from(regionalCompetitorsTable).where(and(eq(regionalCompetitorsTable.id, options.competitorId), eq(regionalCompetitorsTable.workspaceId, workspaceId), eq(regionalCompetitorsTable.campaignId, campaignId))).limit(1);
    if (!competitor) throw new Error("Concorrente não encontrado nesta campanha.");
  }
  const [opportunity] = await db.insert(regionalAudienceOpportunitiesTable).values({
    workspaceId, campaignId, signalId, competitorId: options.competitorId ?? null, identityHintFingerprint, opportunityType: opportunityType.trim(), summary: summary.trim().slice(0, 2000), attributes,
    heatScore: heat.heatScore, heatBand: heat.heatBand, scoreReasons: heat.reasons, evidenceRefs, observedIntent: signal.intent,
    interestTopic: options.interestTopic?.trim().slice(0, 300) || null, inferredRegion: signal.regionInference, regionProvenance: signal.regionProvenance,
    interactionRecencyHours: heat.recencyHours, interactionFrequency: frequency, contactPermission: signal.lawfulBasisStatus,
    contactPhoneE164, processingPurpose: options.processingPurpose?.trim().slice(0, 300) || null, lawfulBasis,
    consentSource: options.consentSource?.trim().slice(0, 300) || null, consentedAt: options.consentedAt ?? null,
    jurisdictionCodes: (options.jurisdictionCodes ?? []).map(normalizeCountryCode), retentionUntil: options.retentionUntil ?? null,
    deletionState: options.deletionState ?? (lawfulBasis === "opted_out" ? "opted_out" : "active"),
  }).returning();
  return { opportunity: opportunity!, deduplicated: false };
}
export async function transitionAudienceOpportunity(workspaceId: string, opportunityId: string, lifecycle: OpportunityLifecycle) {
  const [existing] = await db.select().from(regionalAudienceOpportunitiesTable).where(and(eq(regionalAudienceOpportunitiesTable.id, opportunityId), eq(regionalAudienceOpportunitiesTable.workspaceId, workspaceId))).limit(1);
  if (!existing) return null;
  if ((lifecycle === "ready_for_activation" || lifecycle === "activated") && (existing.contactPermission !== "permitted" || existing.lawfulBasis !== "permitted" || existing.deletionState !== "active")) {
    throw new Error("Ativação bloqueada: base legal, permissão explícita e estado ativo são obrigatórios.");
  }
  // This delivery has no sending mechanism; activated remains a future-contract state only.
  const [updated] = await db.update(regionalAudienceOpportunitiesTable).set({ lifecycle, updatedAt: new Date() }).where(and(eq(regionalAudienceOpportunitiesTable.id, opportunityId), eq(regionalAudienceOpportunitiesTable.workspaceId, workspaceId))).returning();
  return updated ?? null;
}

export async function listAudienceOpportunities(workspaceId: string, campaignId: string, limit = 50) {
  await requireCampaign(workspaceId, campaignId);
  return db.select().from(regionalAudienceOpportunitiesTable).where(and(
    eq(regionalAudienceOpportunitiesTable.workspaceId, workspaceId), eq(regionalAudienceOpportunitiesTable.campaignId, campaignId),
  )).orderBy(desc(regionalAudienceOpportunitiesTable.createdAt)).limit(Math.min(Math.max(limit, 1), 100));
}

/** Deterministically materializes a campaign-local aggregate; no account identity is copied to the segment. */
export async function aggregateAudienceSegment(workspaceId: string, campaignId: string, label: string, dimensions: Json) {
  await requireCampaign(workspaceId, campaignId);
  const segmentFingerprint = fingerprint({ campaignId, dimensions });
  const allSignals = await db.select({
    id: regionalSocialSignalsTable.id, occurredAt: regionalSocialSignalsTable.occurredAt, platform: regionalSocialSignalsTable.platform,
    interactionType: regionalSocialSignalsTable.interactionType, sentiment: regionalSocialSignalsTable.sentiment,
    intent: regionalSocialSignalsTable.intent, regionInference: regionalSocialSignalsTable.regionInference,
  }).from(regionalSocialSignalsTable).where(and(
    eq(regionalSocialSignalsTable.workspaceId, workspaceId), eq(regionalSocialSignalsTable.campaignId, campaignId),
  ));
  // Supported dimensions map to non-identifying public signal attributes only.
  const signals = allSignals.filter((signal) => Object.entries(dimensions).every(([key, value]) =>
    ["platform", "interactionType", "sentiment", "intent", "regionInference"].includes(key) &&
    String(signal[key as keyof typeof signal] ?? "") === String(value),
  ));
  const opportunities = await db.select({ signalId: regionalAudienceOpportunitiesTable.signalId }).from(regionalAudienceOpportunitiesTable).where(and(
    eq(regionalAudienceOpportunitiesTable.workspaceId, workspaceId), eq(regionalAudienceOpportunitiesTable.campaignId, campaignId),
  ));
  const signalIds = new Set(signals.map((signal) => signal.id));
  const opportunityCount = opportunities.filter((opportunity) => signalIds.has(opportunity.signalId)).length;
  const lastObservedAt = signals.reduce<Date | null>((last, row) => !last || row.occurredAt > last ? row.occurredAt : last, null);
  const [existing] = await db.select().from(regionalAudienceSegmentsTable).where(and(
    eq(regionalAudienceSegmentsTable.workspaceId, workspaceId), eq(regionalAudienceSegmentsTable.fingerprint, segmentFingerprint),
  )).limit(1);
  const values = { label: label.trim().slice(0, 300), dimensions, signalCount: signals.length, opportunityCount, lastObservedAt, updatedAt: new Date() };
  if (existing) {
    const [updated] = await db.update(regionalAudienceSegmentsTable).set(values).where(and(eq(regionalAudienceSegmentsTable.id, existing.id), eq(regionalAudienceSegmentsTable.workspaceId, workspaceId))).returning();
    return updated!;
  }
  const [created] = await db.insert(regionalAudienceSegmentsTable).values({ workspaceId, campaignId, fingerprint: segmentFingerprint, ...values }).returning();
  return created!;
}
export async function listAudienceSegments(workspaceId: string, campaignId: string, limit = 50) {
  await requireCampaign(workspaceId, campaignId);
  return db.select().from(regionalAudienceSegmentsTable).where(and(
    eq(regionalAudienceSegmentsTable.workspaceId, workspaceId), eq(regionalAudienceSegmentsTable.campaignId, campaignId),
  )).orderBy(desc(regionalAudienceSegmentsTable.updatedAt)).limit(Math.min(Math.max(limit, 1), 100));
}
export async function latestRegionalIntelligenceSummary(workspaceId: string, campaignId: string): Promise<Json | null> {
  const [profile] = await db.select().from(regionalProfilesTable).where(and(eq(regionalProfilesTable.workspaceId, workspaceId), eq(regionalProfilesTable.campaignId, campaignId))).limit(1);
  if (!profile) return null;
  const competitors = await db.select({ name: regionalCompetitorsTable.name, kind: regionalCompetitorsTable.kind }).from(regionalCompetitorsTable).where(and(eq(regionalCompetitorsTable.workspaceId, workspaceId), eq(regionalCompetitorsTable.campaignId, campaignId))).limit(10);
  const alerts = await db.select({ id: regionalAlertsTable.id }).from(regionalAlertsTable).where(and(eq(regionalAlertsTable.workspaceId, workspaceId), eq(regionalAlertsTable.campaignId, campaignId), eq(regionalAlertsTable.status, "open"))).limit(10);
  const [signalCount] = await db.select({ id: regionalSocialSignalsTable.id }).from(regionalSocialSignalsTable).where(and(eq(regionalSocialSignalsTable.workspaceId, workspaceId), eq(regionalSocialSignalsTable.campaignId, campaignId))).limit(50);
  return { region: profile.region, locale: profile.locale, competitors, openAlertCount: alerts.length, audienceRadar: { available: Boolean(signalCount) } };
}