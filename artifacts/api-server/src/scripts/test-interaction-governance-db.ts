import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { db, interactionExecutionsTable, interactionOpportunitiesTable, interactionRecipientsTable, workspaceIntegrationsTable } from "@workspace/db";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";
import { createInteractionOpportunity, decideInteractionDraft, getInteractionOpportunity, governOpportunity, markInteractionOperatorExecuted, proposeInteractionDraft, recordInteractionOutcome, registerInteractionCapability, runInteractionCouncil, upsertInteractionPolicy } from "../modules/market-intel/interaction-governance.service.js";
import { activateRadarEntitlement } from "../modules/market-intel/radar-entitlements.service.js";

assert.equal(process.env.INTERACTION_GOVERNANCE_DB_TESTS, "true", "Set INTERACTION_GOVERNANCE_DB_TESTS=true only for a disposable migrated DB.");
assert.equal(process.env.NODE_ENV, "test", "Interaction governance DB tests require NODE_ENV=test.");
const fixtures = await seedE2eFixtures(markerFromSuffix(`interaction-governance-${process.pid}`));
const [workspaceId, foreignWorkspaceId] = fixtures.workspaces;
const policy = { enabled: true, windowMinutes: 60, workspaceCeiling: 1, accountCeiling: 10, competitorCeiling: 10, postCeiling: 10, recipientCeiling: 10, recipientCooldownMinutes: 60, maximumRiskScore: 50, requireApproval: true, purpose: "test", jurisdictionCodes: ["BR"], retentionDays: 1 };
let integrationIds: string[] = [];
try {
  // Council runs are Radar-gated. Seed a genuine entitlement rather than
  // weakening the production gate for this disposable DB fixture.
  await activateRadarEntitlement(workspaceId!, "RADAR_PRO", "BRL");
  await upsertInteractionPolicy(workspaceId!, policy);
  await upsertInteractionPolicy(foreignWorkspaceId!, policy);
  const integrations = await db.insert(workspaceIntegrationsTable).values([
    { workspaceId: workspaceId!, provider: "instagram", status: "connected", accountId: `ig-a-${process.pid}` },
    { workspaceId: workspaceId!, provider: "instagram", status: "connected", accountId: `ig-b-${process.pid}` },
  ]).returning();
  integrationIds = integrations.map((row) => row.id);
  for (const integration of integrations) await registerInteractionCapability(workspaceId!, { integrationId: integration.id, platform: "instagram", action: "public_comment", officialAdapter: true, enabled: true, allowsAutomaticExecution: false, requiresOwnedAsset: true });
  const input = (integrationId: string, recipientFingerprint: string, postRef: string) => ({ integrationId, platform: "instagram", action: "public_comment" as const, recipientFingerprint, postRef, evidence: { source: "verified" }, context: { topic: "context" }, lawfulBasis: "permitted", contactable: true, assetOwned: true, riskScore: 10 });
  const councilJson = JSON.stringify({ observerSummary: "observed", intentScore: 80, affinityScore: 70, contactability: "public", riskAssessment: "low", recommendedAction: "public_comment", ctaLevel: 5, draft: "Resposta contextual original", reasoning: "evidence", confidence: 80 });
  const councilOpp = await createInteractionOpportunity(workspaceId!, { ...input(integrationIds[0]!, "council-recipient", "council"), assetOwned: false });
  const councils = await Promise.all([runInteractionCouncil(workspaceId!, councilOpp.id, async () => councilJson), runInteractionCouncil(workspaceId!, councilOpp.id, async () => councilJson)]);
  assert.equal(councils[0].draft?.ctaLevel, 2, "governor caps third-party first contact CTA");
  assert.equal((await getInteractionOpportunity(workspaceId!, councilOpp.id))?.drafts.length, 1, "concurrent council calls persist at most one draft");
  const blockedCouncil = await createInteractionOpportunity(workspaceId!, { ...input(integrationIds[0]!, "blocked-council", "blocked"), riskScore: 99 });
  const blocked = await runInteractionCouncil(workspaceId!, blockedCouncil.id, async () => councilJson);
  assert.equal(blocked.draft, null);
  assert.equal((await getInteractionOpportunity(workspaceId!, blockedCouncil.id))?.drafts.length, 0, "blocked council creates no draft");
  const one = await createInteractionOpportunity(workspaceId!, input(integrationIds[0]!, "recipient-cross-account", "p1"));
  const two = await createInteractionOpportunity(workspaceId!, input(integrationIds[1]!, "recipient-cross-account", "p2"));
  assert.equal(one.recipientId, two.recipientId, "recipient fingerprint dedupes across accounts");
  await assert.rejects(() => createInteractionOpportunity(foreignWorkspaceId!, input(integrationIds[0]!, "bad", "p")), /Conta conectada/, "tenant isolation rejects foreign integration");
  assert.equal((await governOpportunity(workspaceId!, one.id)).decision, "requires_approval");
  const unsafeEditOpportunity = await createInteractionOpportunity(workspaceId!, input(integrationIds[0]!, "unsafe-edit-recipient", "unsafe-edit"));
  const unsafeEditDraft = await proposeInteractionDraft(workspaceId!, unsafeEditOpportunity.id, "Uma observação contextual específica e respeitosa", 1);
  await assert.rejects(
    () => decideInteractionDraft(workspaceId!, unsafeEditDraft.id, true, undefined, "Clique no link https://example.test agora!!!"),
    /links externos/,
    "modified approval content must pass the same deterministic safety validation",
  );
  assert.equal((await getInteractionOpportunity(workspaceId!, unsafeEditOpportunity.id))?.opportunity.state, "awaiting_approval", "blocked edit must not approve the opportunity");
  const draft = await proposeInteractionDraft(workspaceId!, one.id, "Resposta original e contextual", 1);
  await decideInteractionDraft(workspaceId!, draft.id, true, undefined, "Resposta modificada");
  const ready = await getInteractionOpportunity(workspaceId!, one.id);
  assert.equal(ready?.opportunity.state, "approved");
  assert.equal(ready?.drafts[0]?.content, "Resposta modificada", "approval persists modified content");
  const [execution] = await Promise.all([markInteractionOperatorExecuted(workspaceId!, one.id, draft.id, { operatorUrl: "https://example.test/evidence" })]);
  assert.equal(execution.state, "executing");
  const outcome = await recordInteractionOutcome(workspaceId!, execution.id, { replied: true }, { code: "operator_note" });
  assert.equal(outcome.state, "failed", "incidents are retained as failed feedback");
  assert.match((await governOpportunity(workspaceId!, two.id)).reasons.join(","), /cooldown/, "cooldown is workspace-wide across accounts");
  await db.update(interactionRecipientsTable).set({ optedOut: true }).where(and(eq(interactionRecipientsTable.id, two.recipientId), eq(interactionRecipientsTable.workspaceId, workspaceId!)));
  assert.match((await governOpportunity(workspaceId!, two.id)).reasons.join(","), /opted_out/, "opt-out is global");

  // Two already-approved recipients race against one global workspace reservation.
  const raceA = await createInteractionOpportunity(workspaceId!, input(integrationIds[0]!, "race-a", "r1"));
  const raceB = await createInteractionOpportunity(workspaceId!, input(integrationIds[1]!, "race-b", "r2"));
  // Remove the earlier fixture reservation, then race against a single global slot.
  await db.delete(interactionExecutionsTable).where(eq(interactionExecutionsTable.id, execution.id));
  await db.update(interactionOpportunitiesTable).set({ state: "approved" }).where(eq(interactionOpportunitiesTable.id, raceA.id));
  await db.update(interactionOpportunitiesTable).set({ state: "approved" }).where(eq(interactionOpportunitiesTable.id, raceB.id));
  const raced = await Promise.allSettled([markInteractionOperatorExecuted(workspaceId!, raceA.id, undefined, { ok: true }), markInteractionOperatorExecuted(workspaceId!, raceB.id, undefined, { ok: true })]);
  assert.equal(raced.filter((r) => r.status === "fulfilled").length, 1, "advisory-lock reservation is atomic");
  console.log("interaction governance DB tenant/quota/cooldown/approval/outcome tests passed");
} finally {
  await cleanupE2eFixtures(fixtures);
}