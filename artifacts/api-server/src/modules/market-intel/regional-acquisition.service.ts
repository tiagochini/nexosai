import OpenAI from "openai";
import { and, desc, eq, inArray } from "drizzle-orm";
import { campaignsTable, db, regionalCompetitorsTable, regionalMonitorRunsTable, regionalProfilesTable } from "@workspace/db";
import { env } from "../../lib/env.js";
import { logger } from "../../lib/logger.js";
import { getSchedulerHealth, registerScheduler, runSchedulerTick } from "../operations/scheduler-health.registry.js";
import { campaignOwned, createCompetitor, createVerifiedEvidence, normalizePublicUrl, recordObservation, startMonitorRun, finishMonitorRun } from "./regional-intelligence.service.js";
import { getRadarEntitlement, RadarEntitlementError, radarScheduledMode, reserveRadarUsage } from "./radar-entitlements.service.js";

type Json = Record<string, unknown>;
export type AcquisitionMode = "lightweight" | "detailed";
/** citationUrl is mandatory even for injected providers: it is the persistence trust boundary. */
export type AcquisitionCandidate = { name: string; kind: "direct" | "indirect" | "substitute"; url: string; citationUrl: string; title?: string; snippet?: string; claim?: string; confidence?: number };
export interface RegionalAcquisitionProvider { acquire(input: { queries: string[]; mode: AcquisitionMode }): Promise<AcquisitionCandidate[]>; }

const timeoutMs = 45_000;
const allowedKinds = new Set(["direct", "indirect", "substitute"]);
const bounded = (s: unknown, limit: number) => typeof s === "string" ? s.trim().slice(0, limit) : "";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const inFlightRuns = new Set<string>();

/** OpenAI's Responses web search is intentionally native-key only: proxy support is not assumed. */
export class OpenAIWebSearchProvider implements RegionalAcquisitionProvider {
  private client: OpenAI;
  constructor(apiKey = env.NEXOS_OPENAI || env.OPENAI_API_KEY) {
    if (!apiKey) throw new Error("Regional acquisition unavailable: OpenAI Responses web_search requires NEXOS_OPENAI or OPENAI_API_KEY.");
    this.client = new OpenAI({ apiKey, timeout: timeoutMs, maxRetries: 2 });
  }
  async acquire({ queries, mode }: { queries: string[]; mode: AcquisitionMode }): Promise<AcquisitionCandidate[]> {
    const prompt = `Search the public web for these market queries:\n${queries.map((q) => `- ${q}`).join("\n")}\nReturn only JSON array candidates: [{"name":"","kind":"direct|indirect|substitute","url":"","title":"","snippet":"","claim":"","confidence":0}]. Every candidate MUST use a URL from a web-search citation. No contacts, private data, or inferred social identity. ${mode === "lightweight" ? "Maximum 5 candidates." : "Maximum 15 candidates."}`;
    const response = await (this.client.responses as any).create({
      model: "gpt-5-mini",
      tools: [{ type: "web_search" }],
      input: prompt,
      max_output_tokens: mode === "lightweight" ? 1200 : 3000,
    });
    const citations = new Set<string>();
    for (const item of response.output ?? []) for (const content of item.content ?? []) {
      for (const annotation of content.annotations ?? []) {
        const url = annotation.url ?? annotation.url_citation?.url;
        if (typeof url === "string") try { citations.add(normalizePublicUrl(url)); } catch { /* reject non-public citations */ }
      }
    }
    if (!citations.size) throw new Error("Regional acquisition rejected: Responses web_search returned no URL citations.");
    const text = String(response.output_text ?? "");
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("Regional acquisition rejected: cited search response has no candidate JSON.");
    let parsed: unknown;
    try { parsed = JSON.parse(match[0]); } catch { throw new Error("Regional acquisition rejected: invalid candidate JSON."); }
    if (!Array.isArray(parsed)) throw new Error("Regional acquisition rejected: candidate payload must be an array.");
    return parsed.flatMap((raw): AcquisitionCandidate[] => {
      if (!raw || typeof raw !== "object") return [];
      const x = raw as Json; let url: string;
      try { url = normalizePublicUrl(String(x["url"] ?? "")); } catch { return []; }
      // Citation is a hard persistence gate, never trust uncited model URLs.
      if (!citations.has(url)) return [];
      const kind = String(x["kind"] ?? "");
      const name = bounded(x["name"], 500);
      if (!name || !allowedKinds.has(kind)) return [];
      return [{ name, kind: kind as AcquisitionCandidate["kind"], url, citationUrl: url, title: bounded(x["title"], 1000), snippet: bounded(x["snippet"], 500), claim: bounded(x["claim"], 2000), confidence: Math.max(0, Math.min(100, Number(x["confidence"]) || 50)) }];
    });
  }
}

export function buildRegionalQueries(profile: { region: string; countryCode: string | null; languages: unknown; operatingRegions: unknown; config: unknown }, campaign: { title: string; intakeData: unknown }, mode: AcquisitionMode): string[] {
  const config = (profile.config && typeof profile.config === "object" ? profile.config : {}) as Json;
  const intake = (campaign.intakeData && typeof campaign.intakeData === "object" ? campaign.intakeData : {}) as Json;
  const products = [config["product"], config["products"], intake["product"], intake["productName"], campaign.title].flatMap((v) => Array.isArray(v) ? v : [v]).filter((v): v is string => typeof v === "string" && v.trim().length > 1).slice(0, 4);
  const languages = Array.isArray(profile.languages) ? profile.languages.filter((x): x is string => typeof x === "string") : [];
  const operating = Array.isArray(profile.operatingRegions) ? profile.operatingRegions.map((x) => typeof x === "string" ? x : JSON.stringify(x)).slice(0, 4) : [];
  const geo = [profile.region, profile.countryCode, ...operating, ...languages].filter(Boolean).join(" ");
  const kinds = mode === "lightweight" ? ["direct"] : ["direct", "indirect", "substitute"];
  return products.flatMap((product) => kinds.map((kind) => `${product} ${kind} competitor alternatives ${geo}`)).slice(0, mode === "lightweight" ? 4 : 12);
}

async function retry<T>(fn: () => Promise<T>): Promise<T> {
  let error: unknown;
  for (let attempt = 0; attempt < 3; attempt++) try { return await fn(); } catch (e) { error = e; if (attempt < 2) await sleep(500 * 2 ** attempt); }
  throw error;
}

export async function acquireCampaignRegionalIntel(workspaceId: string, campaignId: string, mode: AcquisitionMode, idempotencyKey: string, provider: RegionalAcquisitionProvider = new OpenAIWebSearchProvider()) {
  // Ownership must be resolved before any entitlement, cadence, run-state, or
  // provider work so a foreign tenant cannot probe or consume this campaign.
  if (!await campaignOwned(workspaceId, campaignId)) throw new Error("Campanha não encontrada neste workspace.");
  const lockKey = `${workspaceId}:${campaignId}:${idempotencyKey}`;
  if (inFlightRuns.has(lockKey)) throw new Error("Regional acquisition already running for this idempotency key.");
  // Check before startMonitorRun because its legacy return contract deliberately
  // returns an existing row rather than an inserted/not-inserted discriminator.
  const [previous] = await db.select({ id: regionalMonitorRunsTable.id }).from(regionalMonitorRunsTable).where(and(
    eq(regionalMonitorRunsTable.workspaceId, workspaceId), eq(regionalMonitorRunsTable.campaignId, campaignId),
    eq(regionalMonitorRunsTable.idempotencyKey, idempotencyKey),
  )).limit(1);
  if (previous) return { run: await startMonitorRun(workspaceId, campaignId, idempotencyKey), deduplicated: true, persisted: 0 };
  inFlightRuns.add(lockKey);
  let run: Awaited<ReturnType<typeof startMonitorRun>> | null = null;
  try {
    const entitlement = await getRadarEntitlement(workspaceId, new Date(), campaignId);
    if (!entitlement.active || !entitlement.limits) throw new RadarEntitlementError(402, "RADAR_ENTITLEMENT_REQUIRED", "Uma assinatura Radar ativa é necessária para iniciar uma nova aquisição.");
    if (mode === "detailed" && entitlement.limits.scanCadenceMinutes >= 10080) throw new RadarEntitlementError(409, "RADAR_SCAN_MODE_NOT_INCLUDED", "O pacote Radar atual permite somente a varredura semanal.");
    const [lastRun] = await db.select({ startedAt: regionalMonitorRunsTable.startedAt }).from(regionalMonitorRunsTable).where(and(
      eq(regionalMonitorRunsTable.workspaceId, workspaceId), eq(regionalMonitorRunsTable.campaignId, campaignId),
    )).orderBy(desc(regionalMonitorRunsTable.startedAt)).limit(1);
    const elapsed = lastRun?.startedAt ? Date.now() - lastRun.startedAt.getTime() : Number.POSITIVE_INFINITY;
    if (elapsed < entitlement.limits.scanCadenceMinutes * 60_000) throw new RadarEntitlementError(429, "RADAR_SCAN_NOT_DUE", `A próxima varredura estará disponível após a cadência de ${entitlement.limits.scanCadenceMinutes} minutos.`, { nextEligibleAt: new Date(lastRun!.startedAt!.getTime() + entitlement.limits.scanCadenceMinutes * 60_000) });
    await reserveRadarUsage({ workspaceId, campaignId, dimension: mode === "lightweight" ? "light_scan" : "detailed_scan", idempotencyKey: `scan:${idempotencyKey}`, metadata: { mode } });
    run = await startMonitorRun(workspaceId, campaignId, idempotencyKey);
    const [profile] = await db.select().from(regionalProfilesTable).where(and(eq(regionalProfilesTable.workspaceId, workspaceId), eq(regionalProfilesTable.campaignId, campaignId))).limit(1);
    const [campaign] = await db.select().from(campaignsTable).where(and(eq(campaignsTable.workspaceId, workspaceId), eq(campaignsTable.id, campaignId))).limit(1);
    if (!profile || !campaign) throw new Error("Active regional profile/campaign not found.");
    const candidates = await retry(() => provider.acquire({ queries: buildRegionalQueries(profile, campaign, mode), mode }));
    let persisted = 0; const observedAt = new Date();
    for (const candidate of candidates) {
      try {
        const normalized = normalizePublicUrl(candidate.url);
        if (normalizePublicUrl(candidate.citationUrl) !== normalized) throw new Error("Candidate rejected: public URL has no matching citation.");
        let [competitor] = await db.select().from(regionalCompetitorsTable).where(and(eq(regionalCompetitorsTable.workspaceId, workspaceId), eq(regionalCompetitorsTable.campaignId, campaignId), eq(regionalCompetitorsTable.normalizedWebsiteUrl, normalized))).limit(1);
        if (!competitor) competitor = await createCompetitor(workspaceId, campaignId, { name: candidate.name, kind: candidate.kind, websiteUrl: normalized, notes: "Discovered via cited public web search." });
        const evidence = await createVerifiedEvidence(workspaceId, campaignId, { competitorId: competitor.id, url: normalized, title: candidate.title, sourceType: "openai_web_search", claim: candidate.claim || candidate.snippet || `Public page for ${candidate.name}`, payload: { snippet: candidate.snippet, confidence: candidate.confidence, provenance: "openai_responses_web_search", citationUrl: normalized }, observedAt });
        await recordObservation(workspaceId, campaignId, { competitorId: competitor.id, evidenceId: evidence.evidence.id, facts: { name: candidate.name, kind: candidate.kind, url: normalized, title: candidate.title, snippet: candidate.snippet, confidence: candidate.confidence, provenance: "openai_responses_web_search" }, observedAt });
        persisted++;
      } catch (error) { logger.warn({ campaignId, err: error }, "Regional acquisition candidate isolated"); }
    }
    const completed = await finishMonitorRun(workspaceId, run.id, "completed", { mode, candidates: candidates.length, persisted });
    return { run: completed ?? run, deduplicated: false, persisted };
  } catch (error) {
    if (run) await finishMonitorRun(workspaceId, run.id, "failed", { mode }, error instanceof Error ? error.message.slice(0, 2000) : "Acquisition failed");
    throw error;
  } finally {
    inFlightRuns.delete(lockKey);
  }
}

let timer: ReturnType<typeof setInterval> | null = null;
const schedulerName = "regional-intelligence-acquisition";
export async function runRegionalAcquisitionSweep(_legacyMode?: AcquisitionMode, provider?: RegionalAcquisitionProvider) {
  if (process.env["REGIONAL_INTEL_ACQUISITION_PAUSED"] === "true") return;
  const active = await db.select({ workspaceId: regionalProfilesTable.workspaceId, campaignId: regionalProfilesTable.campaignId }).from(regionalProfilesTable).innerJoin(campaignsTable, eq(regionalProfilesTable.campaignId, campaignsTable.id)).where(inArray(campaignsTable.status, ["approved", "executing", "live"]));
  // Bounded batches prevent a large tenant set from fanning out provider calls.
  for (let offset = 0; offset < active.length; offset += 4) await Promise.all(active.slice(offset, offset + 4).map(async (row) => {
    const entitlement = await getRadarEntitlement(row.workspaceId, new Date(), row.campaignId);
    if (!entitlement.active || !entitlement.limits) return; // no active package, no provider call or reservation
    const mode = radarScheduledMode(entitlement.limits);
    const bucket = Math.floor(Date.now() / (entitlement.limits.scanCadenceMinutes * 60_000));
    await acquireCampaignRegionalIntel(row.workspaceId, row.campaignId, mode, `scheduled:${mode}:${bucket}`, provider).catch((error) => logger.warn({ campaignId: row.campaignId, err: error }, "Regional acquisition campaign failed"));
  }));
}
export function startRegionalAcquisitionScheduler() {
  if (timer) return;
  // Fifteen minutes is the shortest sellable cadence (War Room). Entitlement
  // checks above keep this inexpensive for all other workspaces.
  registerScheduler(schedulerName, 16 * 60_000);
  const tick = () => runSchedulerTick(schedulerName, async () => {
    await runRegionalAcquisitionSweep();
  }).catch(() => logger.error("Regional acquisition scheduler tick failed"));
  timer = setInterval(tick, Number(process.env["REGIONAL_INTEL_ACQUISITION_INTERVAL_MS"] ?? 15 * 60_000));
  setImmediate(tick);
}
export function stopRegionalAcquisitionScheduler() { if (timer) { clearInterval(timer); timer = null; } }
export function regionalAcquisitionHealth() { return getSchedulerHealth()[schedulerName] ?? null; }
/** Test-only seam for isolation; production callers cannot mutate scheduler state. */
export function resetRegionalAcquisitionForTests() {
  if (process.env["NODE_ENV"] !== "test") throw new Error("Regional acquisition reset is test-only.");
  stopRegionalAcquisitionScheduler();
  inFlightRuns.clear();
}