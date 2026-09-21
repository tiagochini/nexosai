import { and, eq } from "drizzle-orm";
import {
  canonicalSocialNetworks,
  db,
  type CanonicalSocialNetwork,
  defaultAllowedSocialNetworks,
  defaultMaxAccountsPerNetwork,
  plansTable,
  workspacesTable,
  workspaceIntegrationsTable,
} from "@workspace/db";
import { AppError, ForbiddenError, NotFoundError } from "../../lib/errors.js";

export const SOCIAL_ENTITLEMENT_CODES = {
  workspaceLimit: "WORKSPACE_LIMIT_REACHED",
  networkNotAllowed: "NETWORK_NOT_ALLOWED",
  accountLimit: "SOCIAL_ACCOUNT_LIMIT_REACHED",
} as const;

/** Pure boundary predicate used by the DB-backed gate and concurrency tests. */
export function canAddDistinctSocialAccount(
  existingExternalIds: readonly (string | null | undefined)[],
  candidateExternalId: string | null | undefined,
  limit: number,
): boolean {
  if (candidateExternalId && existingExternalIds.includes(candidateExternalId)) return true;
  return new Set(existingExternalIds.filter(Boolean)).size < limit;
}

export function canonicalNetworkForProvider(provider: string, metadata?: unknown): CanonicalSocialNetwork | null {
  // New rows carry an explicit identity so legacy adapter/provider names cannot
  // merge Facebook and Instagram. This also permits future adapters to share storage.
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const value = (metadata as Record<string, unknown>).canonicalNetwork;
    if (typeof value === "string" && canonicalSocialNetworks.includes(value as CanonicalSocialNetwork)) {
      return value as CanonicalSocialNetwork;
    }
  }
  switch (provider) {
    case "instagram": return "instagram";
    // Legacy organic Meta connections are stored as meta_ads.
    case "facebook":
    case "meta_ads": return "facebook";
    case "tiktok":
    case "tiktok_ads": return "tiktok";
    case "linkedin":
    case "linkedin_ads": return "linkedin";
    case "youtube": return "youtube";
    default: return null;
  }
}

function entitlementNetworks(value: unknown): CanonicalSocialNetwork[] {
  if (!Array.isArray(value)) return defaultAllowedSocialNetworks;
  return value.filter((network): network is CanonicalSocialNetwork =>
    typeof network === "string" && canonicalSocialNetworks.includes(network as CanonicalSocialNetwork),
  );
}

function entitlementLimits(value: unknown): Record<CanonicalSocialNetwork, number> {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(canonicalSocialNetworks.map((network) => {
    const max = raw[network];
    return [network, typeof max === "number" && Number.isInteger(max) && max >= 0
      ? max : defaultMaxAccountsPerNetwork[network]];
  })) as Record<CanonicalSocialNetwork, number>;
}

export async function assertOwnedActiveWorkspace(userId: string, workspaceId: string) {
  const [workspace] = await db.select().from(workspacesTable).where(and(
    eq(workspacesTable.id, workspaceId),
    eq(workspacesTable.ownerId, userId),
    eq(workspacesTable.status, "active"),
  )).limit(1);
  if (!workspace) throw new ForbiddenError("Workspace is not owned by this user or is inactive");
  return workspace;
}

/**
 * Gate a social account before a new record is persisted. A matching external
 * account is always allowed first, making reconnects idempotent even if a plan
 * later changes. Tokens are never selected or returned here.
 */
export async function assertSocialAccountEntitlement(
  workspaceId: string,
  network: CanonicalSocialNetwork,
  externalAccountId: string | null | undefined,
): Promise<void> {
  const [workspace] = await db.select({ planId: workspacesTable.planId })
    .from(workspacesTable).where(eq(workspacesTable.id, workspaceId)).limit(1);
  if (!workspace) throw new NotFoundError("Workspace");
  const [plan] = await db.select({
    allowedSocialNetworks: plansTable.allowedSocialNetworks,
    maxAccountsPerNetwork: plansTable.maxAccountsPerNetwork,
  }).from(plansTable).where(eq(plansTable.id, workspace.planId)).limit(1);
  if (!plan) throw new NotFoundError("Plan");

  const rows = await db.select({
    provider: workspaceIntegrationsTable.provider,
    accountId: workspaceIntegrationsTable.accountId,
    status: workspaceIntegrationsTable.status,
    metadata: workspaceIntegrationsTable.metadata,
    canonicalNetwork: workspaceIntegrationsTable.canonicalNetwork,
  }).from(workspaceIntegrationsTable).where(eq(workspaceIntegrationsTable.workspaceId, workspaceId));
  const networkRows = rows.filter((row) => canonicalNetworkForProvider(row.provider, {
    ...(row.metadata as Record<string, unknown> ?? {}),
    canonicalNetwork: row.canonicalNetwork,
  }) === network);
  // A disconnected account remains a reconnection target, but does not consume
  // a current connected-account entitlement.
  const matchingRows = networkRows.filter((row) =>
    row.status === "connected" || row.status === "expired" || row.status === "error",
  );
  if (externalAccountId && networkRows.some((row) => row.accountId === externalAccountId)) return;
  if (!entitlementNetworks(plan.allowedSocialNetworks).includes(network)) {
    throw new AppError(403, `A rede ${network} não está incluída no seu plano`, SOCIAL_ENTITLEMENT_CODES.networkNotAllowed);
  }
  const limit = entitlementLimits(plan.maxAccountsPerNetwork)[network];
  if (canAddDistinctSocialAccount(matchingRows.map((row) => row.accountId), externalAccountId, limit)) return;
  // Count identities, not integration rows: adapters may retain multiple
  // records for one external account during a token rotation.
  const distinctAccountIds = new Set(matchingRows.map((row) => row.accountId).filter(Boolean));
  if (distinctAccountIds.size >= limit) {
    throw new AppError(403, `Limite de contas ${network} atingido`, SOCIAL_ENTITLEMENT_CODES.accountLimit);
  }
}

export { entitlementLimits, entitlementNetworks };