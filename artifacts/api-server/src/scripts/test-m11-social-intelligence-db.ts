import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { inArray } from "drizzle-orm";
import { db, m11SocialReportsTable, usersTable, workspacesTable, workspaceIntegrationsTable, socialCommentActionsTable, socialConversationTurnsTable } from "@workspace/db";
import { createReport, getReport, inbox } from "../modules/m11-social-intelligence/m11-social-intelligence.service.js";

if (process.env.M11_SOCIAL_DB_TESTS !== "true") {
  console.log("Set M11_SOCIAL_DB_TESTS=true to run the integration test");
  process.exit(0);
}
const migration = await readFile(new URL("../../../../lib/db/drizzle/0061_m11_social_intelligence.sql", import.meta.url), "utf8");
await db.execute(sql.raw(migration));
const [workspace] = await db.select({ id: workspacesTable.id, ownerId: workspacesTable.ownerId }).from(workspacesTable).limit(1);
assert(workspace, "test database needs a workspace");
const [owner] = await db.select({ id: usersTable.id }).from(usersTable).where(sql`${usersTable.id} = ${workspace.ownerId}`).limit(1);
assert(owner, "workspace owner must exist");
const [integration] = await db.insert(workspaceIntegrationsTable).values({ workspaceId: workspace.id, provider: "instagram", status: "disconnected", accountId: `m11-test-account-${Date.now()}` }).returning({ id: workspaceIntegrationsTable.id, accountId: workspaceIntegrationsTable.accountId });
assert(integration, "could not create isolated workspace integration");
const fixtureAt = new Date();
const commentFixtureIds: string[] = [];
for (let i = 0; i < 101; i++) {
  const [row] = await db.insert(socialCommentActionsTable).values({ workspaceId: workspace.id, platform: "instagram", postId: "m11-test-post", commentId: `m11-test-comment-${Date.now()}-${i}`, commentText: `m11 fixture ${i}`, action: "pending", createdAt: fixtureAt }).returning({ id: socialCommentActionsTable.id });
  commentFixtureIds.push(row!.id);
}
const turnFixtureIds: string[] = [];
for (let i = 0; i < 101; i++) {
  const [row] = await db.insert(socialConversationTurnsTable).values({ workspaceId: workspace.id, integrationId: integration.id, accountId: integration.accountId ?? "m11-test-account", providerEventId: `m11-test-event-${Date.now()}-${i}`, channel: "instagram", direction: "inbound", inputText: `m11 fixture ${i}`, receivedAt: fixtureAt, createdAt: fixtureAt }).returning({ id: socialConversationTurnsTable.id });
  turnFixtureIds.push(row!.id);
}
const reportFrom = new Date(fixtureAt.getTime() - 1000);
const completeReport = await createReport(workspace.id, owner.id, { from: reportFrom.toISOString(), to: new Date(fixtureAt.getTime() + 1000).toISOString() });
assert.equal((completeReport.aggregates as { comments: number }).comments >= 101, true);
assert.equal((completeReport.aggregates as { conversations: number }).conversations >= 101, true);
const firstPage = await inbox(workspace.id, { from: reportFrom.toISOString(), to: new Date(fixtureAt.getTime() + 1000).toISOString(), limit: 100 });
assert.equal(firstPage.items.length, 100);
assert(firstPage.nextCursor, "expected stable cursor for second page");
const secondPage = await inbox(workspace.id, { from: reportFrom.toISOString(), to: new Date(fixtureAt.getTime() + 1000).toISOString(), limit: 100, cursor: firstPage.nextCursor });
assert(secondPage.items.length > 0);
const otherWorkspace = await db.select({ id: workspacesTable.id }).from(workspacesTable).where(sql`${workspacesTable.id} <> ${workspace.id}`).limit(1);
if (otherWorkspace[0]) assert.equal(await getReport(otherWorkspace[0].id, completeReport.id), undefined, "workspace B must not read workspace A report");
await db.delete(socialCommentActionsTable).where(inArray(socialCommentActionsTable.id, commentFixtureIds));
await db.delete(socialConversationTurnsTable).where(inArray(socialConversationTurnsTable.id, turnFixtureIds));
await db.delete(workspaceIntegrationsTable).where(sql`${workspaceIntegrationsTable.id} = ${integration.id}`);
const [report] = await db.insert(m11SocialReportsTable).values({
  workspaceId: workspace.id, createdBy: owner.id, periodFrom: new Date("2020-01-01"), periodTo: new Date("2020-01-31"),
  filters: { campaignId: null }, aggregates: { totalItems: 101, byStatus: { recorded: 101 } },
  provenance: { sources: ["social_conversation_turns", "social_comment_actions"] }, rowCount: 101,
}).returning();
assert.equal(report!.rowCount, 101, "report must represent rows beyond the inbox preview limit");
await assert.rejects(
  db.execute(sql`UPDATE "m11_social_reports" SET "row_count" = 1 WHERE "id" = ${report!.id}`),
  (error: unknown) => {
    let current: unknown = error;
    for (let i = 0; i < 4 && current; i++) {
      if (String((current as { message?: unknown }).message ?? current).includes("immutable")) return true;
      current = (current as { cause?: unknown }).cause;
    }
    return false;
  },
);
assert.equal((await db.select().from(m11SocialReportsTable).where(sql`${m11SocialReportsTable.workspaceId} = ${workspace.id}`)).some((r) => r.id === report!.id), true);
console.log("M11 migration, workspace ownership, >100 aggregate, and immutability checks passed");