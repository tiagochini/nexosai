import { asc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  db,
  type CanonicalSocialNetwork,
  plansTable,
  workspacesTable,
  workspaceIntegrationsTable,
} from "@workspace/db";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { assertOwnedActiveWorkspace, canonicalNetworkForProvider, entitlementLimits, entitlementNetworks, SOCIAL_ENTITLEMENT_CODES } from "./workspace-entitlements.service.js";

export async function getWorkspaceOverview(userId: string, activeWorkspaceId: string) {
  await assertOwnedActiveWorkspace(userId, activeWorkspaceId);
  const workspaces = await db.select({
    id: workspacesTable.id, name: workspacesTable.name, slug: workspacesTable.slug,
    status: workspacesTable.status, createdAt: workspacesTable.createdAt, planId: workspacesTable.planId,
  }).from(workspacesTable).where(eq(workspacesTable.ownerId, userId)).orderBy(asc(workspacesTable.createdAt), asc(workspacesTable.id));
  const active = workspaces.find((workspace) => workspace.id === activeWorkspaceId)!;
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, active.planId)).limit(1);
  if (!plan) throw new NotFoundError("Plan");
  const integrations = await db.select({
    provider: workspaceIntegrationsTable.provider, status: workspaceIntegrationsTable.status,
  }).from(workspaceIntegrationsTable).where(eq(workspaceIntegrationsTable.workspaceId, activeWorkspaceId));
  const connectedCounts = Object.fromEntries(["instagram", "facebook", "tiktok", "linkedin", "youtube"].map((network) => [network, 0])) as Record<CanonicalSocialNetwork, number>;
  for (const integration of integrations) {
    const network = canonicalNetworkForProvider(integration.provider);
    if (network && integration.status === "connected") connectedCounts[network]++;
  }
  return {
    workspaces,
    activeWorkspaceId,
    entitlements: {
      maxWorkspaces: plan.maxWorkspaces,
      allowedSocialNetworks: entitlementNetworks(plan.allowedSocialNetworks),
      maxAccountsPerNetwork: entitlementLimits(plan.maxAccountsPerNetwork),
    },
    usage: { workspacesUsed: workspaces.length, connectedAccountsByNetwork: connectedCounts },
  };
}

export async function createOwnedWorkspace(userId: string, currentWorkspaceId: string, name: string) {
  // The transaction-scoped lock serializes count + insert for one owner.
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
    const [current] = await tx.select().from(workspacesTable)
      .where(eq(workspacesTable.id, currentWorkspaceId)).limit(1);
    if (!current || current.ownerId !== userId || current.status !== "active") {
      throw new AppError(403, "Workspace is not owned by this user or is inactive", "FORBIDDEN");
    }
    const [plan] = await tx.select().from(plansTable).where(eq(plansTable.id, current.planId)).limit(1);
    if (!plan) throw new NotFoundError("Plan");
    const owned = await tx.select({ id: workspacesTable.id }).from(workspacesTable)
      .where(eq(workspacesTable.ownerId, userId));
    if (owned.length >= plan.maxWorkspaces) {
      throw new AppError(403, "Limite de workspaces atingido", SOCIAL_ENTITLEMENT_CODES.workspaceLimit);
    }
    const [workspace] = await tx.insert(workspacesTable).values({
      ownerId: userId,
      planId: current.planId,
      name,
      slug: `${name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace"}-${randomUUID().slice(0, 12)}`,
      // Credits are deliberately not copied; workspace creation must not mint
      // credits or make a billing decision.
      creditsBalance: 0,
      settings: {},
    }).returning();
    return workspace!;
  });
}