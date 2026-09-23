import bcrypt from "bcryptjs";
import { inArray } from "drizzle-orm";
import {
  db, plansTable, usersTable, workspacesTable, workspaceIntegrationsTable,
  paidMediaAccountsTable, paidMediaEntitiesTable, paidMediaInsightsTable,
  paidMediaPoliciesTable, paidMediaProposalsTable, paidMediaApprovalsTable,
  paidMediaActionAttemptsTable, metaWebhookEventsTable, instagramDmSequencesTable,
  socialPresencePostsTable, radarOrdersTable, radarPurchaseRequestsTable,
  radarSubscriptionsTable, radarUsageLedgerTable,
} from "@workspace/db";

export type E2eManifest = {
  marker: string; users: string[]; workspaces: string[]; integrations: string[];
  accountId: string; entityId: string; proposalIds: string[]; attemptId: string;
  loginEmail: string;
};

export function markerFromSuffix(suffix: string): string {
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(suffix)) throw new Error("suffix must be 3-64 safe characters");
  return `E2E_${suffix}`;
}

/** Deterministic test-only password. It is never logged or put in a manifest. */
export function e2eFixturePassword(marker: string): string {
  if (!/^E2E_[A-Za-z0-9_-]{3,64}$/.test(marker)) throw new Error("strict E2E_ marker required");
  return `E2E-${marker}-Only!`;
}

export async function seedE2eFixtures(marker: string, options: { failAfterInsert?: boolean } = {}): Promise<E2eManifest> {
  if (!/^E2E_[A-Za-z0-9_-]{3,64}$/.test(marker)) throw new Error("strict E2E_ marker required");
  const plan = await db.select({ id: plansTable.id }).from(plansTable).limit(1).then((rows) => rows[0]);
  if (!plan) throw new Error("A plan is required before E2E fixtures can be seeded");
  const safe = marker.toLowerCase().replace(/[^a-z0-9]/g, "");
  const password = e2eFixturePassword(marker);
  const passwordHash = await bcrypt.hash(password, 10);
  return db.transaction(async (tx) => {
    const users = await tx.insert(usersTable).values([
      { email: `${safe}.owner@e2e.invalid`, name: `${marker} Owner`, passwordHash, emailVerified: true },
      { email: `${safe}.second@e2e.invalid`, name: `${marker} Second`, passwordHash, emailVerified: true },
    ]).returning({ id: usersTable.id, email: usersTable.email });
    const workspaces = await tx.insert(workspacesTable).values([
      { ownerId: users[0]!.id, planId: plan.id, name: `${marker} Primary`, slug: `${safe}-primary`, settings: { socialModerationConfig: { immediateKeywordReplies: { MAPA: `${marker} reply` }, enableInstagramPrivateReplies: true } } },
      { ownerId: users[1]!.id, planId: plan.id, name: `${marker} Secondary`, slug: `${safe}-secondary`, settings: {} },
    ]).returning({ id: workspacesTable.id });
    const primary = workspaces[0]!.id;
    const integrations = await tx.insert(workspaceIntegrationsTable).values([
      { workspaceId: primary, provider: "instagram", status: "connected", accountId: `${marker}_ig_one`, accountName: `${marker} IG One`, accessToken: "E2E_DUMMY_IG_TOKEN_ONE", metadata: { integrationPurpose: "organic_social", pageId: `${marker}_page_one` } },
      { workspaceId: primary, provider: "instagram", status: "connected", accountId: `${marker}_ig_two`, accountName: `${marker} IG Two`, accessToken: "E2E_DUMMY_IG_TOKEN_TWO", metadata: { integrationPurpose: "organic_social", pageId: `${marker}_page_two` } },
      // Legacy organic Meta Page row: intentionally no paidMedia marker.
      { workspaceId: primary, provider: "meta_ads", status: "connected", accountId: `${marker}_legacy_page`, accountName: `${marker} Legacy Page`, accessToken: "E2E_DUMMY_LEGACY_PAGE_TOKEN", metadata: { pageId: `${marker}_legacy_page` } },
      { workspaceId: primary, provider: "meta_ads", status: "connected", accountId: `act_${marker}`, accountName: `${marker} Paid`, accessToken: "E2E_DUMMY_PAID_MEDIA_TOKEN", tokenExpiresAt: new Date(Date.now() + 86_400_000), metadata: { integrationPurpose: "paid_media", paidMedia: true } },
    ]).returning({ id: workspaceIntegrationsTable.id });
    const paidIntegrationId = integrations[3]!.id;
    await tx.insert(socialPresencePostsTable).values({
      workspaceId: primary, platform: "instagram", status: "published", weekStart: new Date(),
      caption: `${marker} MAPA DM flow`, publishedAt: new Date(), platformPostId: `${marker}_post`,
      dmResponseFlow: {
        triggerKeyword: "MAPA",
        triggerInstructions: `Comente MAPA para receber ${marker}`,
        steps: [{ message: `${marker} DM reply`, delayMinutes: 0 }],
      },
    });
    const [account] = await tx.insert(paidMediaAccountsTable).values({
      workspaceId: primary, integrationId: paidIntegrationId, provider: "meta_ads", providerAccountId: `act_${marker}`,
      accountName: `${marker} Paid Account`, currency: "USD", timezone: "UTC", isSelected: true, operationalHealth: true, healthCheckedAt: new Date(), selectedAt: new Date(),
    }).returning({ id: paidMediaAccountsTable.id });
    const [entity] = await tx.insert(paidMediaEntitiesTable).values({
      workspaceId: primary, accountId: account!.id, provider: "meta_ads", providerEntityId: `${marker}_campaign`,
      entityType: "campaign", name: `${marker} Campaign`, status: "ACTIVE", version: "e2e-v1", currency: "USD", timezone: "UTC",
      providerData: { e2eMarker: marker, daily_budget: "1000", operational: true }, lastSyncedAt: new Date(),
    }).returning({ id: paidMediaEntitiesTable.id });
    await tx.insert(paidMediaInsightsTable).values({
      workspaceId: primary, accountId: account!.id, entityId: entity!.id, provider: "meta_ads", providerInsightId: `${marker}_insight`,
      metricDate: "2026-01-01", currency: "USD", timezone: "UTC", impressions: 1000, clicks: 25, spend: "10", conversions: "2", conversionValue: "20", rawMetrics: { e2eMarker: marker },
    });
    await tx.insert(paidMediaPoliciesTable).values({
      workspaceId: primary, provider: "meta_ads", accountId: account!.id, enabled: true, autoExecute: false,
      mandatoryPause: true, mandatoryPauseReason: `${marker} mandatory pause`, minimumSampleSize: 1, minimumDataQualityScore: "0.5", acceptedAt: new Date(), acceptedBy: users[0]!.id,
    });
    const expiresAt = new Date(Date.now() + 86_400_000);
    const common = { workspaceId: primary, accountId: account!.id, entityId: entity!.id, provider: "meta_ads" as const, recommendation: `${marker} fixture`, metrics: { e2eMarker: marker }, simulation: {}, beforeAllocation: {}, afterAllocation: {}, requestedChange: { dailyBudget: 900 }, policyDecision: { e2eMarker: marker }, expiresAt };
    const proposals = await tx.insert(paidMediaProposalsTable).values([
      { ...common, actionType: "update_daily_budget", status: "approved", idempotencyKey: `${marker}:approved` },
      { ...common, actionType: "cross_platform_budget_move", status: "pending_approval", idempotencyKey: `${marker}:interplatform` },
      { ...common, actionType: "pause", status: "verified", idempotencyKey: `${marker}:verified` },
    ]).returning({ id: paidMediaProposalsTable.id });
    await tx.insert(paidMediaApprovalsTable).values({ proposalId: proposals[0]!.id, workspaceId: primary, decision: "approved", approverId: users[0]!.id, evidence: { e2eMarker: marker } });
    const [attempt] = await tx.insert(paidMediaActionAttemptsTable).values({
      proposalId: proposals[2]!.id, workspaceId: primary, attemptNumber: 1, status: "rolled_back", idempotencyKey: `${marker}:attempt`,
      beforeSnapshot: { id: `${marker}_campaign`, status: "ACTIVE", version: "e2e-v1" }, providerResponse: { id: `${marker}_graph_id` },
      verificationEvidence: { verified: true }, afterSnapshot: { status: "PAUSED" }, rollbackEvidence: { status: "ACTIVE" }, startedAt: new Date(), completedAt: new Date(),
    }).returning({ id: paidMediaActionAttemptsTable.id });
    await tx.insert(metaWebhookEventsTable).values({
      workspaceId: primary, integrationId: integrations[0]!.id, accountId: `${marker}_ig_one`, providerEventId: `${marker}_comment`,
      eventType: "instagram_comment", status: "sent", outboundEndpoint: `/${marker}_comment/replies`,
      outboundRequest: { message: `${marker} reply` }, providerResponse: { id: `${marker}_graph_id` }, providerMessageId: `${marker}_graph_id`, sentAt: new Date(),
    });
    // Test-only fault injection validates that every preceding fixture write is
    // rolled back by the same transaction. It is never set by the seed CLI.
    if (options.failAfterInsert) throw new Error("E2E fixture rollback probe");
    // The password is a recognizable dummy derived from the caller-provided
    // marker, but is intentionally not included in the persisted JSON manifest.
    return { marker, users: users.map((x) => x.id), workspaces: workspaces.map((x) => x.id), integrations: integrations.map((x) => x.id), accountId: account!.id, entityId: entity!.id, proposalIds: proposals.map((x) => x.id), attemptId: attempt!.id, loginEmail: users[0]!.email };
  });
}

export async function cleanupE2eFixtures(manifest: Pick<E2eManifest, "marker" | "users" | "workspaces" | "integrations">): Promise<void> {
  if (!/^E2E_[A-Za-z0-9_-]{3,64}$/.test(manifest.marker) || !manifest.workspaces.length || !manifest.users.length) throw new Error("Refusing cleanup without a strict E2E_ manifest");
  await db.transaction(async (tx) => {
    const verified = await tx.select({ id: workspacesTable.id, name: workspacesTable.name }).from(workspacesTable)
      .where(inArray(workspacesTable.id, manifest.workspaces));
    if (verified.length !== manifest.workspaces.length) throw new Error("Refusing cleanup: manifest workspace mismatch");
    // Every ID is verified against its immutable E2E name; IDs alone are never enough.
    const expectedNames = new Set([`${manifest.marker} Primary`, `${manifest.marker} Secondary`]);
    if (verified.some((workspace) => !expectedNames.has(workspace.name))) {
      throw new Error("Refusing cleanup: manifest includes a non-E2E workspace");
    }
    const fixtureUsers = await tx.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
      .from(usersTable).where(inArray(usersTable.id, manifest.users));
    if (fixtureUsers.length !== manifest.users.length || fixtureUsers.some((user) =>
      !user.email.endsWith("@e2e.invalid") || !user.name.startsWith(`${manifest.marker} `))) {
      throw new Error("Refusing cleanup: manifest includes a non-E2E user");
    }
    // These all have workspace-level cascade FKs, but deleting them explicitly
    // keeps fixture cleanup correct even if a disposable DB predates those FKs.
    await tx.delete(radarUsageLedgerTable).where(inArray(radarUsageLedgerTable.workspaceId, manifest.workspaces));
    await tx.delete(radarSubscriptionsTable).where(inArray(radarSubscriptionsTable.workspaceId, manifest.workspaces));
    await tx.delete(radarOrdersTable).where(inArray(radarOrdersTable.workspaceId, manifest.workspaces));
    await tx.delete(radarPurchaseRequestsTable).where(inArray(radarPurchaseRequestsTable.workspaceId, manifest.workspaces));
    await tx.delete(paidMediaActionAttemptsTable).where(inArray(paidMediaActionAttemptsTable.workspaceId, manifest.workspaces));
    await tx.delete(paidMediaApprovalsTable).where(inArray(paidMediaApprovalsTable.workspaceId, manifest.workspaces));
    await tx.delete(paidMediaProposalsTable).where(inArray(paidMediaProposalsTable.workspaceId, manifest.workspaces));
    await tx.delete(paidMediaInsightsTable).where(inArray(paidMediaInsightsTable.workspaceId, manifest.workspaces));
    await tx.delete(paidMediaEntitiesTable).where(inArray(paidMediaEntitiesTable.workspaceId, manifest.workspaces));
    await tx.delete(paidMediaPoliciesTable).where(inArray(paidMediaPoliciesTable.workspaceId, manifest.workspaces));
    await tx.delete(paidMediaAccountsTable).where(inArray(paidMediaAccountsTable.workspaceId, manifest.workspaces));
    await tx.delete(metaWebhookEventsTable).where(inArray(metaWebhookEventsTable.workspaceId, manifest.workspaces));
    await tx.delete(instagramDmSequencesTable).where(inArray(instagramDmSequencesTable.workspaceId, manifest.workspaces));
    await tx.delete(workspaceIntegrationsTable).where(inArray(workspaceIntegrationsTable.workspaceId, manifest.workspaces));
    await tx.delete(workspacesTable).where(inArray(workspacesTable.id, manifest.workspaces));
    await tx.delete(usersTable).where(inArray(usersTable.id, manifest.users));
  });
}