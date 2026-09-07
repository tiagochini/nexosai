import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db, plansTable, usersTable } from "@workspace/db";
import { createOwnedWorkspace, getWorkspaceOverview } from "../modules/auth/workspaces.service.js";
import { assertSocialAccountEntitlement } from "../modules/auth/workspace-entitlements.service.js";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";

const marker = markerFromSuffix(`workspace_entitlements_${process.pid}`);
const fixture = await seedE2eFixtures(marker);
const [ownerId, foreignUserId] = fixture.users;
const [ownerWorkspaceId, foreignWorkspaceId] = fixture.workspaces;
if (!ownerId || !foreignUserId || !ownerWorkspaceId || !foreignWorkspaceId) throw new Error("fixture incomplete");
const [plan] = await db.select().from(plansTable).limit(1);
if (!plan) throw new Error("a plan is required");
const [originalOwner] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, ownerId)).limit(1);
if (!originalOwner) throw new Error("fixture owner missing");

try {
  await db.update(usersTable).set({ email: `${marker}@nexos.ai` }).where(eq(usersTable.id, ownerId));
  await db.update(plansTable).set({
    maxWorkspaces: 2,
    allowedSocialNetworks: ["instagram", "facebook", "tiktok", "linkedin", "youtube"],
    maxAccountsPerNetwork: { instagram: 2, facebook: 1, tiktok: 1, linkedin: 1, youtube: 1 },
  }).where(eq(plansTable.id, plan.id));

  // Internal NexOS accounts temporarily bypass commercial workspace capacity.
  const concurrent = await Promise.allSettled([
    createOwnedWorkspace(ownerId, ownerWorkspaceId, `${marker} One`),
    createOwnedWorkspace(ownerId, ownerWorkspaceId, `${marker} Two`),
  ]);
  assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 2);

  await assert.rejects(
    () => getWorkspaceOverview(ownerId, foreignWorkspaceId),
    (error: unknown) => (error as { code?: string }).code === "FORBIDDEN",
    "an owner must not switch to another owner's workspace",
  );

  const overview = await getWorkspaceOverview(ownerId, ownerWorkspaceId);
  assert.equal(overview.entitlements.maxWorkspaces, 2);
  assert.equal(overview.workspaceCreation.internalAccess, true);
  assert.equal(overview.usage.workspacesUsed, 3);
  assert.equal(overview.usage.connectedAccountsByNetwork.instagram, 2);
  assert.deepEqual(overview.entitlements.maxAccountsPerNetwork.instagram, 2);

  // Existing external accounts remain reconnectable; a third is rejected.
  await assertSocialAccountEntitlement(ownerWorkspaceId, "instagram", `${marker}_ig_one`);
  await assert.rejects(
    () => assertSocialAccountEntitlement(ownerWorkspaceId, "instagram", `${marker}_ig_three`),
    (error: unknown) => (error as { code?: string }).code === "SOCIAL_ACCOUNT_LIMIT_REACHED",
  );
  await db.update(plansTable).set({ allowedSocialNetworks: [] }).where(eq(plansTable.id, plan.id));
  await assert.rejects(
    () => assertSocialAccountEntitlement(ownerWorkspaceId, "tiktok", `${marker}_tiktok`),
    (error: unknown) => (error as { code?: string }).code === "NETWORK_NOT_ALLOWED",
  );
} finally {
  await db.update(plansTable).set({
    maxWorkspaces: plan.maxWorkspaces,
    allowedSocialNetworks: plan.allowedSocialNetworks,
    maxAccountsPerNetwork: plan.maxAccountsPerNetwork,
  }).where(eq(plansTable.id, plan.id));
  await db.update(usersTable).set({ email: originalOwner.email }).where(eq(usersTable.id, ownerId));
  await cleanupE2eFixtures(fixture);
}

console.log("workspace entitlement regression test passed");