import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import {
  db,
  campaignsTable,
  campaignGroupsTable,
  workspaceIntegrationsTable,
} from "@workspace/db";
import {
  getMetaE2eGraphCalls,
  resetMetaE2eGraphCalls,
} from "../lib/meta-graph.transport.js";
import { checkWhatsAppGroupsEligibility, createWhatsAppCampaignGroup } from "../modules/whatsapp/whatsapp-groups.service.js";
import { createWhatsAppDispatch, handleWhatsAppWebhook } from "../modules/whatsapp/whatsapp.service.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";

if (process.env["META_E2E_TEST_MODE"] !== "true" || process.env["NODE_ENV"] === "production") {
  throw new Error("Run with NODE_ENV=test META_E2E_TEST_MODE=true");
}

const marker = markerFromSuffix(`whatsapp-groups-${process.pid}`);
const manifest = await seedE2eFixtures(marker);
const workspaceId = manifest.workspaces[0]!;
const foreignWorkspaceId = manifest.workspaces[1]!;
let campaignIds: string[] = [];
let groupId: string | null = null;

try {
  const [integration] = await db.insert(workspaceIntegrationsTable).values({
    workspaceId,
    provider: "whatsapp_business",
    status: "connected",
    accountId: `${marker}_phone_id`,
    accountName: `${marker} phone`,
    accessToken: "E2E_DUMMY_WHATSAPP_TOKEN",
    metadata: { e2eMarker: marker },
  }).returning();
  assert.ok(integration);

  const campaigns = await db.insert(campaignsTable).values([
    { workspaceId, title: `${marker} campaign A` },
    { workspaceId: foreignWorkspaceId, title: `${marker} campaign B` },
  ]).returning({ id: campaignsTable.id });
  campaignIds = campaigns.map((campaign) => campaign.id);
  const [campaignA, campaignB] = campaigns;
  assert.ok(campaignA && campaignB);

  resetMetaE2eGraphCalls();
  const eligibility = await checkWhatsAppGroupsEligibility(workspaceId);
  assert.equal(eligibility.groupsApiReadAccess, true);
  assert.equal(getMetaE2eGraphCalls()[0]?.method, "GET");
  assert.match(getMetaE2eGraphCalls()[0]?.path ?? "", /_phone_id\/groups$/);

  const created = await createWhatsAppCampaignGroup(workspaceId, {
    campaignId: campaignA.id,
    groupName: `${marker} official group`,
    description: "Automated integration test",
  });
  groupId = created.group.id;
  assert.equal(created.group.integrationId, integration.id);
  assert.match(created.group.groupId ?? "", /^e2e_graph_/);
  assert.equal(created.group.groupLink, "https://chat.whatsapp.com/e2e-test-invite");
  assert.equal(created.group.metadata.provider, "meta_whatsapp_groups_api");
  assert.equal(created.group.lifecycleStatus, "active");
  assert.equal(getMetaE2eGraphCalls()[1]?.method, "POST");
  assert.deepEqual(getMetaE2eGraphCalls()[1]?.body, {
    subject: `${marker} official group`,
    description: "Automated integration test",
    approval_required: true,
  });
  assert.doesNotMatch(JSON.stringify(getMetaE2eGraphCalls()), /E2E_DUMMY_WHATSAPP_TOKEN/);

  await assert.rejects(
    createWhatsAppCampaignGroup(workspaceId, { campaignId: campaignB.id, groupName: "foreign campaign" }),
    (error: unknown) => error instanceof NotFoundError,
  );

  const [manualGroup] = await db.insert(campaignGroupsTable).values({
    campaignId: campaignA.id,
    workspaceId,
    platform: "whatsapp",
    groupName: `${marker} manual group`,
    groupLink: "https://chat.whatsapp.com/e2e-manual",
  }).returning();
  assert.ok(manualGroup);
  await assert.rejects(
    createWhatsAppDispatch(workspaceId, {
      campaignId: campaignA.id,
      type: "group",
      recipients: ["manual_group_id"],
      message: "must not go to a manually registered group",
    }),
    (error: unknown) => error instanceof ValidationError,
  );

  const webhookResult = await handleWhatsAppWebhook({
    entry: [{
      changes: [{
        field: "group_lifecycle_update",
        value: {
          metadata: { phone_number_id: `${marker}_phone_id` },
          groups: [{ group_id: created.group.groupId, type: "group_deleted" }],
        },
      }],
    }],
  });
  assert.equal(webhookResult.processed, 1);
  const [updatedGroup] = await db.select().from(campaignGroupsTable).where(and(
    eq(campaignGroupsTable.id, groupId),
    eq(campaignGroupsTable.workspaceId, workspaceId),
  ));
  assert.equal(updatedGroup?.lifecycleStatus, "deleted");
  assert.equal(updatedGroup?.status, "archived");

  console.log("WhatsApp Groups API integration checks passed (Meta transport mocked; no live group created)");
} finally {
  if (campaignIds.length) await db.delete(campaignsTable).where(eq(campaignsTable.workspaceId, workspaceId));
  await cleanupE2eFixtures(manifest);
}
