import { and, asc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  db,
  type CanonicalSocialNetwork,
  plansTable,
  usersTable,
  workspacesTable,
  workspaceIntegrationsTable,
  commercialSubscriptionsTable,
  commercialProductsTable,
} from "@workspace/db";
import { AppError, NotFoundError } from "../../lib/errors.js";
import { canCreateInternalWorkspace } from "../admin/admin-access.js";
import { assertOwnedActiveWorkspace, canonicalNetworkForProvider, entitlementLimits, entitlementNetworks } from "./workspace-entitlements.service.js";

export async function getWorkspaceOverview(userId: string, activeWorkspaceId: string) {
  await assertOwnedActiveWorkspace(userId, activeWorkspaceId);
  const [owner] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!owner) throw new NotFoundError("User");
  const internalWorkspaceAccess = canCreateInternalWorkspace(owner.email);
  const workspaces = await db.select({
    id: workspacesTable.id, name: workspacesTable.name, slug: workspacesTable.slug,
    status: workspacesTable.status, createdAt: workspacesTable.createdAt, planId: workspacesTable.planId,
  }).from(workspacesTable).where(eq(workspacesTable.ownerId, userId)).orderBy(asc(workspacesTable.createdAt), asc(workspacesTable.id));
  const active = workspaces.find((workspace) => workspace.id === activeWorkspaceId)!;
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, active.planId)).limit(1);
  if (!plan) throw new NotFoundError("Plan");
  const [subscription] = await db.select({
    id: commercialSubscriptionsTable.id,
    productId: commercialSubscriptionsTable.productId,
    productKey: commercialProductsTable.key,
    productName: commercialProductsTable.name,
    masterPlanKey: commercialProductsTable.masterPlanKey,
  }).from(commercialSubscriptionsTable)
    .innerJoin(commercialProductsTable, eq(commercialProductsTable.id, commercialSubscriptionsTable.productId))
    .where(and(eq(commercialSubscriptionsTable.workspaceId, activeWorkspaceId), eq(commercialSubscriptionsTable.status, "active")))
    .limit(1);
  const integrations = await db.select({
    provider: workspaceIntegrationsTable.provider, status: workspaceIntegrationsTable.status,
    metadata: workspaceIntegrationsTable.metadata,
    canonicalNetwork: workspaceIntegrationsTable.canonicalNetwork,
  }).from(workspaceIntegrationsTable).where(eq(workspaceIntegrationsTable.workspaceId, activeWorkspaceId));
  const connectedCounts = Object.fromEntries(["instagram", "facebook", "tiktok", "linkedin", "youtube"].map((network) => [network, 0])) as Record<CanonicalSocialNetwork, number>;
  for (const integration of integrations) {
    const network = canonicalNetworkForProvider(integration.provider, {
      ...(integration.metadata as Record<string, unknown> ?? {}),
      canonicalNetwork: integration.canonicalNetwork,
    });
    if (network && integration.status === "connected") connectedCounts[network]++;
  }
  return {
    workspaces,
    activeWorkspaceId,
    entitlements: {
      maxWorkspaces: plan.maxWorkspaces,
      allowedSocialNetworks: entitlementNetworks(plan.allowedSocialNetworks),
      maxAccountsPerNetwork: entitlementLimits(plan.maxAccountsPerNetwork),
      selectedSubscription: subscription ? {
        id: subscription.id,
        productId: subscription.productId,
        productKey: subscription.productKey,
        productName: subscription.productName,
        masterPlanKey: subscription.masterPlanKey,
      } : null,
    },
    workspaceCreation: {
      available: internalWorkspaceAccess,
      internalAccess: internalWorkspaceAccess,
      status: internalWorkspaceAccess ? "internal_access" : "coming_soon",
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
    const [owner] = await tx.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!owner || !canCreateInternalWorkspace(owner.email)) {
      throw new AppError(403, "Criação de novos workspaces ainda não está disponível para esta conta", "WORKSPACE_CREATION_NOT_AVAILABLE");
    }
    const [plan] = await tx.select().from(plansTable).where(eq(plansTable.id, current.planId)).limit(1);
    if (!plan) throw new NotFoundError("Plan");
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