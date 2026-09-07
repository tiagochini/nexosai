import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import {
  db, campaignsTable, regionalAlertsTable, regionalChangeEventsTable,
  radarSubscriptionsTable,
} from "@workspace/db";
import {
  aggregateAudienceSegment, createCompetitor, createVerifiedEvidence, getRegionalProfile,
  listAudienceOpportunities, listAudienceSegments, listCompetitors, listPublicInteractionSignals,
  promoteSignalToAudienceOpportunity, recordObservation, startMonitorRun, transitionAudienceOpportunity,
  upsertPublicInteractionSignal, upsertRegionalProfile,
} from "../modules/market-intel/regional-intelligence.service.js";
import { acquireCampaignRegionalIntel, buildRegionalQueries, type RegionalAcquisitionProvider } from "../modules/market-intel/regional-acquisition.service.js";
import { RADAR_CATALOG, activateRadarEntitlement } from "../modules/market-intel/radar-entitlements.service.js";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";

assert.equal(process.env.REGIONAL_INTEL_DB_TESTS, "true", "Set REGIONAL_INTEL_DB_TESTS=true only for a migrated disposable development DB.");
assert.equal(process.env.NODE_ENV, "test", "Regional intelligence DB tests require NODE_ENV=test.");

const fixtures = await seedE2eFixtures(markerFromSuffix(`regional-intel-${process.pid}`));
const [workspaceId, foreignWorkspaceId] = fixtures.workspaces;
let campaignId: string | undefined;
try {
  const [campaign] = await db.insert(campaignsTable).values({ workspaceId: workspaceId!, title: "Regional intelligence DB test" }).returning();
  campaignId = campaign!.id;
  // Acquisition and monitoring must exercise the production Radar gate with
  // a real active entitlement; do not bypass the gate in this DB test. This
  // fixture alone disables cadence so distinct synchronous acquisition cases
  // can run; every other RADAR_PRO limit remains production-accurate.
  const entitlement = await activateRadarEntitlement(workspaceId!, "RADAR_PRO", "BRL");
  await db.update(radarSubscriptionsTable).set({
    limitsSnapshot: { ...RADAR_CATALOG.RADAR_PRO.limits, scanCadenceMinutes: 0 },
  }).where(eq(radarSubscriptionsTable.id, entitlement.id));
  const observedAt = new Date("2026-01-02T10:00:00.000Z");

  const profile = await upsertRegionalProfile(workspaceId!, campaignId, "São Paulo, BR", "pt-BR", { radiusKm: 30, referralGeography: { origin: { countryCode: "BR" }, destination: { countryCode: "DE" } } }, { countryCode: "BR", subdivision: "SP", city: "São Paulo", postalCode: "01000-000", address: { line1: "Av. Paulista 1", countryCode: "BR" }, timezone: "America/Sao_Paulo", languages: ["pt-BR"], operatingRegions: [{ countryCode: "BR" }, { countryCode: "DE" }], residenceRegion: { countryCode: "BR" }, serviceRegion: { countryCode: "DE" }, geoProvenance: { source: "declared" }, geoConfidence: 100 });
  assert.equal((await getRegionalProfile(workspaceId!, campaignId))?.id, profile.id);
  assert.equal(profile.countryCode, "BR"); assert.deepEqual(profile.serviceRegion, { countryCode: "DE" });
  const globalQueries = buildRegionalQueries(profile, { title: "Curso global de idiomas", intakeData: { product: "Curso de inglês" } }, "detailed");
  assert.ok(globalQueries.some((query) => query.includes("Curso de inglês") && query.includes("BR") && query.includes("pt-BR")), "queries carry product, country and language");
  assert.ok(globalQueries.some((query) => query.includes("substitute")), "detailed queries include substitute competitors");
  await assert.rejects(() => getRegionalProfile(foreignWorkspaceId!, campaignId!), /não encontrada/);
  await assert.rejects(() => upsertRegionalProfile(foreignWorkspaceId!, campaignId!, "Rio", "pt-BR", {}), /não encontrada/);

  const competitor = await createCompetitor(workspaceId!, campaignId, { name: "Concorrente E2E", kind: "direct", websiteUrl: "https://Example.test/oferta/?utm_source=test" });
  assert.equal((await listCompetitors(workspaceId!, campaignId)).length, 1);
  await assert.rejects(() => listCompetitors(foreignWorkspaceId!, campaignId!), /não encontrada/);

  let fakeCalls = 0;
  const citedFake: RegionalAcquisitionProvider = { acquire: async () => {
    fakeCalls++;
    return [{ name: "Concorrente E2E", kind: "direct", url: "https://example.test/oferta", citationUrl: "https://example.test/oferta", title: "Oferta pública", snippet: "Preço público", claim: "Oferta pública", confidence: 90 }];
  }};
  const acquired = await acquireCampaignRegionalIntel(workspaceId!, campaignId, "lightweight", "regional-acquisition-cited-001", citedFake);
  assert.equal(acquired.persisted, 1, "a matching citation permits persistence");
  const repeatedAcquisition = await acquireCampaignRegionalIntel(workspaceId!, campaignId, "lightweight", "regional-acquisition-cited-001", citedFake);
  assert.equal(repeatedAcquisition.deduplicated, true, "run idempotency prevents another provider call");
  assert.equal(fakeCalls, 1);
  const uncitedFake: RegionalAcquisitionProvider = { acquire: async () => [{ name: "Não persistir", kind: "direct", url: "https://uncited.example/page", citationUrl: "https://different.example/page" }] };
  const uncited = await acquireCampaignRegionalIntel(workspaceId!, campaignId, "lightweight", "regional-acquisition-uncited-001", uncitedFake);
  assert.equal(uncited.persisted, 0, "uncited candidate is never persisted");
  assert.equal((await listCompetitors(workspaceId!, campaignId)).length, 1, "uncited candidate created no competitor");
  const countBeforeFailure = (await listCompetitors(workspaceId!, campaignId)).length;
  const failingFake: RegionalAcquisitionProvider = { acquire: async () => { throw new Error("fake provider unavailable"); } };
  await assert.rejects(() => acquireCampaignRegionalIntel(workspaceId!, campaignId!, "lightweight", "regional-acquisition-failed-001", failingFake), /fake provider unavailable/);
  assert.equal((await listCompetitors(workspaceId!, campaignId)).length, countBeforeFailure, "provider failure has no persistence");
  await assert.rejects(() => acquireCampaignRegionalIntel(foreignWorkspaceId!, campaignId!, "lightweight", "regional-acquisition-tenant-001", citedFake), /não encontrada/, "foreign workspace cannot acquire campaign data");
  assert.equal(fakeCalls, 1, "foreign acquisition never invokes the provider");
  let releaseOverlap!: () => void;
  // The second call races an in-flight acquisition rather than a completed run.
  let enter!: () => void;
  const entered = new Promise<void>((resolve) => { enter = resolve; });
  const overlapFake: RegionalAcquisitionProvider = { acquire: async () => { enter(); await new Promise<void>((resolve) => { releaseOverlap = resolve; }); return []; } };
  const overlapFirst = acquireCampaignRegionalIntel(workspaceId!, campaignId!, "lightweight", "regional-acquisition-overlap-002", overlapFake);
  await entered;
  await assert.rejects(() => acquireCampaignRegionalIntel(workspaceId!, campaignId!, "lightweight", "regional-acquisition-overlap-002", overlapFake), /already running/);
  releaseOverlap();
  await overlapFirst;

  const evidenceInput = { competitorId: competitor.id, url: "https://example.test/oferta/?utm_source=test", claim: "Oferta pública confirmada", payload: { price: 99 }, observedAt };
  const firstEvidence = await createVerifiedEvidence(workspaceId!, campaignId, evidenceInput);
  const repeatedEvidence = await createVerifiedEvidence(workspaceId!, campaignId, evidenceInput);
  assert.equal(repeatedEvidence.deduplicated, true);
  assert.equal(repeatedEvidence.evidence.id, firstEvidence.evidence.id);
  await assert.rejects(() => createVerifiedEvidence(foreignWorkspaceId!, campaignId!, evidenceInput), /não encontrada/);

  const firstObservation = await recordObservation(workspaceId!, campaignId, { competitorId: competitor.id, evidenceId: firstEvidence.evidence.id, facts: { price: 99 }, observedAt });
  assert.ok(firstObservation.changeEvent, "collector observation participates in existing change-alert gate");
  const secondObservation = await recordObservation(workspaceId!, campaignId, { competitorId: competitor.id, evidenceId: firstEvidence.evidence.id, facts: { price: 129 }, observedAt: new Date("2026-01-03T10:00:00.000Z") });
  assert.ok(secondObservation.changeEvent, "a material fact diff creates a change event");
  const repeatedObservation = await recordObservation(workspaceId!, campaignId, { competitorId: competitor.id, evidenceId: firstEvidence.evidence.id, facts: { price: 129 }, observedAt: new Date("2026-01-03T10:00:00.000Z") });
  assert.equal(repeatedObservation.deduplicated, true);
  const changes = await db.select().from(regionalChangeEventsTable).where(and(eq(regionalChangeEventsTable.workspaceId, workspaceId!), eq(regionalChangeEventsTable.campaignId, campaignId)));
  const alerts = await db.select().from(regionalAlertsTable).where(and(eq(regionalAlertsTable.workspaceId, workspaceId!), eq(regionalAlertsTable.campaignId, campaignId)));
  assert.equal(changes.length, 2); assert.equal(alerts.length, 2);

  const run = await startMonitorRun(workspaceId!, campaignId, "regional-db-test-run-001");
  assert.equal((await startMonitorRun(workspaceId!, campaignId, "regional-db-test-run-001")).id, run.id);

  const signalInput = { platform: "instagram", publicAccountRef: "public_user", sourceUrl: "https://instagram.com/p/public-post/?utm_source=x", postRef: "post-1", interactionType: "comment", publicTextExcerpt: "Quero comprar! Meu email test@example.com e telefone +55 11 99999-9999", occurredAt: observedAt, intent: "quero comprar", sentiment: "positive", confidence: 90, regionInference: "São Paulo", regionProvenance: { source: "public_post" }, lawfulBasisStatus: "permitted" as const, sensitiveDataExcluded: true as const };
  const firstSignal = await upsertPublicInteractionSignal(workspaceId!, campaignId, signalInput);
  assert.equal((await upsertPublicInteractionSignal(workspaceId!, campaignId, signalInput)).deduplicated, true);
  assert.match(firstSignal.signal.publicTextExcerpt ?? "", /\[redacted-email\]/);
  assert.match(firstSignal.signal.publicTextExcerpt ?? "", /\[redacted-phone\]/);
  assert.ok((firstSignal.signal.publicTextExcerpt?.length ?? 0) <= 500);
  await assert.rejects(() => listPublicInteractionSignals(foreignWorkspaceId!, campaignId!), /não encontrada/);

  const promoted = await promoteSignalToAudienceOpportunity(workspaceId!, campaignId, firstSignal.signal.id, "purchase_interest", "Interesse público comprovado", {}, { interestTopic: "oferta", competitorId: competitor.id });
  assert.equal(promoted.opportunity.heatBand, "hot");
  const optedOutSignal = await upsertPublicInteractionSignal(workspaceId!, campaignId, { ...signalInput, sourceUrl: "https://instagram.com/p/public-post-2/", postRef: "post-2", occurredAt: new Date("2026-01-02T11:00:00.000Z"), lawfulBasisStatus: "opted_out" });
  const recalculated = await promoteSignalToAudienceOpportunity(workspaceId!, campaignId, optedOutSignal.signal.id, "purchase_interest", "Interesse público comprovado");
  assert.equal(recalculated.opportunity.id, promoted.opportunity.id, "safe public identity hint deduplicates opportunities");
  assert.equal(recalculated.opportunity.contactPermission, "opted_out");
  assert.equal((await listAudienceOpportunities(workspaceId!, campaignId)).length, 1);
  await assert.rejects(() => transitionAudienceOpportunity(workspaceId!, promoted.opportunity.id, "ready_for_activation"), /permissão/);
  await assert.rejects(() => transitionAudienceOpportunity(workspaceId!, promoted.opportunity.id, "activated"), /permissão/);

  const segment = await aggregateAudienceSegment(workspaceId!, campaignId, "Comentários Instagram", { platform: "instagram" });
  assert.equal(segment.signalCount, 2);
  assert.equal((await listAudienceSegments(workspaceId!, campaignId)).length, 1);
  console.log("regional intelligence DB tenant/dedupe/change/radar/lifecycle tests passed");
} finally {
  if (campaignId) await db.delete(campaignsTable).where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.workspaceId, workspaceId!)));
  await cleanupE2eFixtures(fixtures);
}