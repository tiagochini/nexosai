import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { db, campaignsTable, masterplanVersionsTable } from "@workspace/db";
import { approveMasterplan, getCurrentMasterplan, listMasterplanVersions, materializeMasterplan } from "../modules/masterplan/masterplan.service.js";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";

if (process.env["MASTERPLAN_DB_TESTS"] !== "true") {
  throw new Error("Refusing DB mutation: run only after explicitly applying 0008 with MASTERPLAN_DB_TESTS=true.");
}
const fixtures = await seedE2eFixtures(markerFromSuffix(`masterplan-${process.pid}`));
const [workspaceId, foreignWorkspaceId] = fixtures.workspaces;
let campaignId: string | undefined;
try {
  const [campaign] = await db.insert(campaignsTable).values({ workspaceId: workspaceId!, title: "Masterplan test", strategyData: {} }).returning();
  campaignId = campaign!.id;
  const first = await materializeMasterplan(workspaceId!, campaignId);
  assert.equal(first!.readinessStatus, "blocked");
  assert.equal((await materializeMasterplan(workspaceId!, campaignId))!.id, first!.id, "unchanged materialization is idempotent");
  assert.equal(await getCurrentMasterplan(foreignWorkspaceId!, campaignId), undefined, "foreign tenant cannot read plan");
  assert.deepEqual(await listMasterplanVersions(foreignWorkspaceId!, campaignId), [], "foreign tenant cannot list plans");
  await assert.rejects(() => approveMasterplan(workspaceId!, campaignId!, first!.version, fixtures.users[0]!), { code: "MASTERPLAN_NOT_READY" });
  await db.update(campaignsTable).set({ strategyData: { objective: "validated" } }).where(eq(campaignsTable.id, campaignId));
  const second = await materializeMasterplan(workspaceId!, campaignId, fixtures.users[0]!);
  const approved = await approveMasterplan(workspaceId!, campaignId, second!.version, fixtures.users[0]!);
  assert.equal((await approveMasterplan(workspaceId!, campaignId, second!.version, fixtures.users[0]!)).id, approved.id, "approval is idempotent");
  await db.update(campaignsTable).set({ strategyData: { objective: "revised" } }).where(eq(campaignsTable.id, campaignId));
  const third = await materializeMasterplan(workspaceId!, campaignId, fixtures.users[0]!);
  await approveMasterplan(workspaceId!, campaignId, third!.version, fixtures.users[0]!);
  const versions = await listMasterplanVersions(workspaceId!, campaignId);
  assert.equal(versions.find((row) => row.id === second!.id)?.status, "superseded");
  assert.equal(versions.find((row) => row.id === third!.id)?.status, "approved");
  console.log("masterplan DB isolation/materialize/approval/supersede tests passed");
} finally {
  if (campaignId) await db.delete(masterplanVersionsTable).where(and(eq(masterplanVersionsTable.workspaceId, workspaceId!), eq(masterplanVersionsTable.campaignId, campaignId)));
  if (campaignId) await db.delete(campaignsTable).where(eq(campaignsTable.id, campaignId));
  await cleanupE2eFixtures(fixtures);
}