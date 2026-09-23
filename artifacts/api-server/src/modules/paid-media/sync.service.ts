import { and, eq, inArray } from "drizzle-orm";
import {
  db, paidMediaAccountsTable, paidMediaEntitiesTable, paidMediaInsightsTable,
  paidMediaSyncCursorsTable, paidMediaBudgetStrategiesTable,
} from "@workspace/db";
import { paidMediaProvider, type PaidMediaEntityKind, type PaidMediaProviderName } from "./providers.js";

const ENTITY_TYPES: PaidMediaEntityKind[] = ["campaign", "ad_set", "ad"];

/** Sync one advertiser independently, so a failed provider/account cannot poison other jobs. */
export async function syncPaidMediaAccount(workspaceId: string, accountId: string, since: string, until: string) {
  const [account] = await db.select().from(paidMediaAccountsTable).where(and(
    eq(paidMediaAccountsTable.id, accountId), eq(paidMediaAccountsTable.workspaceId, workspaceId),
  )).limit(1);
  if (!account) throw new Error("Paid-media account not found in workspace.");
  const provider = paidMediaProvider(account.provider as PaidMediaProviderName);
  let entitiesUpserted = 0;
  let insightsUpserted = 0;
  const errors: Array<{ entityType: string; message: string }> = [];
  for (const entityType of ENTITY_TYPES) {
    try {
      const entities = await provider.listEntities(workspaceId, account.providerAccountId, entityType);
      for (const entity of entities) {
        await db.insert(paidMediaEntitiesTable).values({
          workspaceId, accountId: account.id, provider: account.provider,
          providerEntityId: entity.providerEntityId, entityType,
          parentProviderEntityId: entity.parentProviderEntityId, name: entity.name,
          status: entity.status, version: entity.version, currency: account.currency,
          timezone: account.timezone, providerData: entity.data, lastSyncedAt: new Date(),
        }).onConflictDoUpdate({
          target: [paidMediaEntitiesTable.accountId, paidMediaEntitiesTable.providerEntityId, paidMediaEntitiesTable.entityType],
          set: { parentProviderEntityId: entity.parentProviderEntityId, name: entity.name, status: entity.status, version: entity.version, providerData: entity.data, lastSyncedAt: new Date(), updatedAt: new Date() },
        });
        // This is observed provider state, not a budget mutation or campaign
        // creation. Meta exposes CBO explicitly; an absent/false value is ABO.
        if (entityType === "campaign" && account.provider === "meta_ads"
          && typeof entity.data["campaign_budget_optimization"] === "boolean") {
          await db.insert(paidMediaBudgetStrategiesTable).values({
            workspaceId, accountId: account.id,
            campaignEntityId: (await db.select({ id: paidMediaEntitiesTable.id }).from(paidMediaEntitiesTable).where(and(
              eq(paidMediaEntitiesTable.accountId, account.id),
              eq(paidMediaEntitiesTable.providerEntityId, entity.providerEntityId),
              eq(paidMediaEntitiesTable.entityType, "campaign"),
            )).limit(1))[0]!.id,
            strategy: entity.data["campaign_budget_optimization"] ? "cbo" : "abo",
            providerData: entity.data,
          }).onConflictDoUpdate({
            target: [paidMediaBudgetStrategiesTable.campaignEntityId],
            set: { strategy: entity.data["campaign_budget_optimization"] ? "cbo" : "abo", providerData: entity.data, observedAt: new Date(), updatedAt: new Date() },
          });
        }
        entitiesUpserted++;
      }
      const entityRows = await db.select({ id: paidMediaEntitiesTable.id, providerEntityId: paidMediaEntitiesTable.providerEntityId })
        .from(paidMediaEntitiesTable).where(and(eq(paidMediaEntitiesTable.workspaceId, workspaceId), eq(paidMediaEntitiesTable.accountId, account.id), eq(paidMediaEntitiesTable.entityType, entityType)));
      const ids = new Map(entityRows.map((value) => [value.providerEntityId, value.id]));
      const insights = await provider.fetchInsights(workspaceId, account.providerAccountId, entityType, since, until);
      for (const insight of insights) {
        const entityId = ids.get(insight.providerEntityId);
        if (!entityId) continue; // provider returned a deleted/unavailable entity; never fabricate one.
        await db.insert(paidMediaInsightsTable).values({
          workspaceId, accountId: account.id, entityId, provider: account.provider,
          providerInsightId: insight.providerInsightId, metricDate: insight.metricDate,
          attributionWindow: insight.attributionWindow ?? "provider_default",
          currency: insight.currency || account.currency, timezone: insight.timezone || account.timezone,
          impressions: insight.impressions, clicks: insight.clicks, spend: insight.spend,
          conversions: insight.conversions, conversionValue: insight.conversionValue,
          rawMetrics: insight.rawMetrics,
        }).onConflictDoUpdate({
          target: [paidMediaInsightsTable.entityId, paidMediaInsightsTable.metricDate, paidMediaInsightsTable.dateGrain, paidMediaInsightsTable.attributionWindow],
          set: { providerInsightId: insight.providerInsightId, impressions: insight.impressions, clicks: insight.clicks, spend: insight.spend, conversions: insight.conversions, conversionValue: insight.conversionValue, rawMetrics: insight.rawMetrics, syncedAt: new Date(), updatedAt: new Date() },
        });
        insightsUpserted++;
      }
      await db.insert(paidMediaSyncCursorsTable).values({ workspaceId, accountId: account.id, entityType, syncedThrough: new Date() })
        .onConflictDoUpdate({ target: [paidMediaSyncCursorsTable.accountId, paidMediaSyncCursorsTable.entityType], set: { syncedThrough: new Date(), claimedAt: null, claimToken: null, lastError: null, updatedAt: new Date() } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Provider sync failed.";
      errors.push({ entityType, message });
      await db.insert(paidMediaSyncCursorsTable).values({ workspaceId, accountId: account.id, entityType, lastError: message })
        .onConflictDoUpdate({ target: [paidMediaSyncCursorsTable.accountId, paidMediaSyncCursorsTable.entityType], set: { lastError: message, claimedAt: null, claimToken: null, updatedAt: new Date() } });
    }
  }
  if (errors.length === 0 && entitiesUpserted > 0) {
    await db.update(paidMediaAccountsTable).set({ operationalHealth: true, healthCheckedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(paidMediaAccountsTable.id, account.id), eq(paidMediaAccountsTable.workspaceId, workspaceId)));
  }
  if (errors.length > 0) {
    await db.update(paidMediaAccountsTable).set({ operationalHealth: false, healthCheckedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(paidMediaAccountsTable.id, account.id), eq(paidMediaAccountsTable.workspaceId, workspaceId)));
  }
  return { accountId: account.id, entitiesUpserted, insightsUpserted, errors };
}

export async function syncSelectedPaidMedia(workspaceId: string, since: string, until: string) {
  const accounts = await db.select({ id: paidMediaAccountsTable.id }).from(paidMediaAccountsTable)
    .where(and(eq(paidMediaAccountsTable.workspaceId, workspaceId), eq(paidMediaAccountsTable.isSelected, true)));
  return Promise.all(accounts.map((account) => syncPaidMediaAccount(workspaceId, account.id, since, until)));
}