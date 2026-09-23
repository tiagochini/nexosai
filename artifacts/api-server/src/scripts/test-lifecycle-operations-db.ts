import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db, lifecycleContactsTable, retentionActionsTable } from "@workspace/db";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";
import { getLifecycleOverview, listLifecycleActions, parsePage, toLifecycleContactDto } from "../modules/lifecycle/lifecycle-operations.service.js";

assert.equal(process.env.LIFECYCLE_DB_TESTS, "true", "Set LIFECYCLE_DB_TESTS=true only for a migrated disposable DB.");
assert.equal(process.env.NODE_ENV, "test", "Lifecycle operations DB tests require NODE_ENV=test.");

const fixtures = await seedE2eFixtures(markerFromSuffix(`lifecycle-operations-${process.pid}`));
const [workspaceId, foreignWorkspaceId] = fixtures.workspaces;
try {
  const [first, second] = await db.insert(lifecycleContactsTable).values([
    { workspaceId, name: "Operations one", lifetimeValueCents: 1200 },
    { workspaceId, name: "Operations two", lifetimeValueCents: 3400, stage: "customer" },
  ]).returning();
  await db.insert(lifecycleContactsTable).values({ workspaceId: foreignWorkspaceId!, name: "Foreign", lifetimeValueCents: 99999 }).returning();
  await db.insert(retentionActionsTable).values(Array.from({ length: 105 }, (_, index) => ({
    workspaceId, contactId: index % 2 ? second!.id : first!.id, riskScore: 70, reason: `bounded-${index}`,
    createdAt: new Date(Date.now() + index * 1000),
  })));

  const overview = await getLifecycleOverview(workspaceId!);
  assert.equal(overview.contactStages.lead, 1);
  assert.equal(overview.contactStages.customer, 1);
  assert.equal(overview.ltv.recordedLifetimeValueCents, 4600);
  assert.equal(overview.ltv.attribution, "recorded_local_ledger_not_externally_attributed_kpi");

  const firstPage = await listLifecycleActions(workspaceId!, undefined, "retention", 1, 0);
  assert.equal(firstPage.actions.length, 1);
  assert.equal(firstPage.pagination.total, 105);
  assert.equal(firstPage.pagination.limit, 1);
  assert.equal((firstPage.actions[0] as Record<string, unknown>).reason, "bounded-104");
  assert.ok(!("contactId" in firstPage.actions[0]!));
  const secondPage = await listLifecycleActions(workspaceId!, undefined, "retention", 1, 1);
  assert.equal(secondPage.actions.length, 1);
  assert.notEqual((firstPage.actions[0] as Record<string, unknown>).id, (secondPage.actions[0] as Record<string, unknown>).id);
  assert.equal((await db.select().from(retentionActionsTable).where(eq(retentionActionsTable.workspaceId, foreignWorkspaceId!))).length, 0);
  const redacted = toLifecycleContactDto({
    id: first!.id, email: "private.person@example.com", stage: "lead", churnRisk: 12, lastActivityAt: null,
  });
  const serialized = JSON.stringify(redacted);
  assert.ok(!serialized.includes("private.person@example.com"));
  assert.ok(!serialized.includes("Operations one"));
  assert.ok(serialized.includes("p***@example.com"));
  assert.equal(parsePage("10001", 0), null);
  assert.equal(parsePage("-1", 0), null);
  assert.equal(parsePage("not-a-number", 0), null);
  assert.equal(parsePage("100", 25, 100), 100);
  console.log("lifecycle operations DB tenant/count/pagination tests passed");
} finally {
  await cleanupE2eFixtures(fixtures);
}