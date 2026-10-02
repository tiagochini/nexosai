import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { eq, inArray, sql } from "drizzle-orm";
import {
  approvalCheckpointsTable,
  campaignsTable,
  contentPiecesTable,
  db,
  executionEvidenceTable,
  masterplanVersionsTable,
  pool,
  socialPostsTable,
  workspaceIntegrationsTable,
} from "@workspace/db";
import campaignsRouter from "../modules/campaigns/campaigns.routes.js";
import { signAccess } from "../modules/auth/auth.service.js";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";

if (process.env["NODE_ENV"] !== "test") throw new Error("Run with NODE_ENV=test");

const marker = markerFromSuffix(`control-room-${process.pid}`);
const fixtures = await seedE2eFixtures(marker);
const ownerWorkspaceId = fixtures.workspaces[0]!;
const foreignWorkspaceId = fixtures.workspaces[1]!;
const ownerToken = signAccess({
  userId: fixtures.users[0]!,
  workspaceId: ownerWorkspaceId,
  email: `${marker.toLowerCase()}@e2e.invalid`,
});
let server: http.Server | undefined;
let campaignId: string | undefined;
let otherCampaignId: string | undefined;
let foreignCampaignId: string | undefined;

try {
  const [campaign] = await db.insert(campaignsTable).values({
    workspaceId: ownerWorkspaceId,
    title: `${marker} Control Room`,
    status: "awaiting_approval",
    currentPhase: "warmup",
  }).returning({ id: campaignsTable.id });
  const [otherCampaign] = await db.insert(campaignsTable).values({
    workspaceId: ownerWorkspaceId,
    title: `${marker} Other Campaign`,
  }).returning({ id: campaignsTable.id });
  const [foreignCampaign] = await db.insert(campaignsTable).values({
    workspaceId: foreignWorkspaceId,
    title: `${marker} Foreign Campaign`,
  }).returning({ id: campaignsTable.id });
  campaignId = campaign!.id;
  otherCampaignId = otherCampaign!.id;
  foreignCampaignId = foreignCampaign!.id;
  const longPem = `-----BEGIN ${"PRIVATE KEY-----"}LONGPEMSECRETPREFIX_${"x".repeat(5_000)}-----END PRIVATE KEY-----`;
  const longBearer = `Bearer LONGBEARERSECRETPREFIX_${"x".repeat(5_000)}`;
  const longJwt = `eyJLONGJWTSECRETPREFIX${"a".repeat(4_100)}.${"b".repeat(4_100)}.${"c".repeat(4_100)}`;
  const wideArray = Array.from({ length: 2_105 }, (_, index) => `wide-array-${index}`);
  const wideObject = Object.fromEntries(
    Array.from({ length: 2_105 }, (_, index) => [`wide-key-${index}`, `wide-value-${index}`]),
  );

  const [masterplan] = await db.insert(masterplanVersionsTable).values({
    workspaceId: ownerWorkspaceId,
    campaignId: campaignId!,
    version: 3,
    status: "approved",
    snapshot: { campaign: { title: `${marker} Snapshot`, objective: "wrong location" }, strategy: { objective: `${marker} Objective` } },
    contentHash: `${marker}_content_hash`,
    contextFingerprint: `${marker}_fingerprint`,
    readinessScore: 100,
    readinessStatus: "ready",
  }).returning({ id: masterplanVersionsTable.id });
  await db.insert(approvalCheckpointsTable).values([
    { campaignId: campaignId!, checkpointType: "budget_approval", status: "pending", data: { dueAt: "2026-12-01T00:00:00.000Z", masterplanVersionId: masterplan!.id } },
    { campaignId: campaignId!, checkpointType: "strategy_approval", status: "approved", data: {} },
  ]);
  await db.insert(contentPiecesTable).values([
    { workspaceId: ownerWorkspaceId, campaignId: campaignId!, type: "sales_page", status: "pending_approval", title: `${marker} Content`, content: { body: `${marker} real preview` } },
    { workspaceId: ownerWorkspaceId, campaignId: campaignId!, type: "email_sequence", status: "draft", title: `${marker} Empty`, content: {} },
  ]);
  await db.insert(socialPostsTable).values([
    { workspaceId: ownerWorkspaceId, campaignId: campaignId!, integrationId: fixtures.integrations[0]!, platform: "instagram", postType: "feed_image", status: "published", caption: `${marker} social`, mediaUrls: ["https://example.invalid/real.png"] },
    { workspaceId: ownerWorkspaceId, campaignId: campaignId!, integrationId: fixtures.integrations[0]!, platform: "instagram", postType: "text", status: "failed", caption: `${marker} failed`, mediaUrls: [] },
  ]);
  await db.insert(executionEvidenceTable).values([
    {
      workspaceId: ownerWorkspaceId,
      campaignId: campaignId!,
      masterplanVersionId: masterplan!.id,
      contextFingerprint: `${marker}_fingerprint`,
      subjectType: "social_post",
      subjectId: randomUUID(),
      state: "provider_confirmed",
      details: {
        receipt: { providerId: `${marker}_receipt` },
        accessToken: "MUST_NOT_LEAK",
        nested: {
          credential: "MUST_NOT_LEAK_CREDENTIAL",
          privateKey: "MUST_NOT_LEAK_PRIVATE_KEY",
          session: "MUST_NOT_LEAK_SESSION",
          signature: "MUST_NOT_LEAK_SIGNATURE",
          signedUrl: "https://example.invalid/download?X-Amz-Signature=MUST_NOT_LEAK_URL&token=MUST_NOT_LEAK_URL_TOKEN#fragment",
          innocuousBearer: "Bearer MUST_NOT_LEAK_BEARER",
          innocuousJwt: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.MUST_NOT_LEAK_JWT",
          innocuousPem: "-----BEGIN " + "PRIVATE KEY-----MUST_NOT_LEAK_PEM-----END PRIVATE KEY-----",
          longPem,
          longBearer,
          longJwt,
          wideArray,
          wideObject,
          preserved: { status: "provider_confirmed", path: "https://example.invalid/evidence/receipt" },
        },
      },
    },
    { workspaceId: ownerWorkspaceId, campaignId: otherCampaignId!, subjectType: "other_campaign", subjectId: randomUUID(), state: "provider_confirmed", details: { marker: "MUST_NOT_LEAK_OTHER_CAMPAIGN" } },
  ]);
  await db.insert(executionEvidenceTable).values({
    workspaceId: foreignWorkspaceId,
    campaignId: foreignCampaignId!,
    subjectType: "foreign",
    subjectId: randomUUID(),
    state: "provider_confirmed",
    details: { marker: "MUST_NOT_LEAK_FOREIGN_WORKSPACE" },
  });
  await db.insert(workspaceIntegrationsTable).values([
    {
      workspaceId: ownerWorkspaceId,
      provider: "facebook",
      status: "connected",
      accountId: `${marker}_missing_token`,
      accountName: `${marker} Missing Token`,
      accessToken: null,
    },
    {
      workspaceId: ownerWorkspaceId,
      provider: "linkedin_ads",
      status: "connected",
      accountId: null,
      accountName: `${marker} Missing Account`,
      accessToken: `${marker}_safe_test_token`,
    },
  ]);

  const app = express();
  app.use("/campaigns", campaignsRouter);
  server = http.createServer(app);
  await new Promise<void>((resolve, reject) => {
    server!.once("error", reject);
    server!.listen(0, "127.0.0.1", resolve);
  });
  const port = (server.address() as AddressInfo).port;
  const request = (id: string) => fetch(`http://127.0.0.1:${port}/campaigns/${id}/control-room`, {
    headers: { authorization: `Bearer ${ownerToken}` },
  });

  const response = await request(campaignId!);
  assert.equal(response.status, 200);
  const body = await response.json() as any;
  assert.equal(body.campaign.title, `${marker} Control Room`);
  assert.equal(body.campaign.currentPhase, "warmup");
  assert.equal(body.masterplan.available, true);
  assert.equal(body.masterplan.version, 3);
  assert.equal(body.masterplan.objective, `${marker} Objective`);
  assert.equal(body.pendingCheckpoints.records.length, 1);
  assert.equal(body.pendingCheckpoints.records[0].checkpointType, "budget_approval");
  assert.equal(body.deliverables.total, 4);
  assert.equal(body.deliverables.previewReady, 3);
  assert.equal(body.credentials.available, true);
  assert.equal(body.executionEvidence.records.length, 1);
  const serialized = JSON.stringify(body);
  assert.doesNotMatch(serialized, /E2E_DUMMY|MUST_NOT_LEAK|accessToken|refreshToken|authorization/i);
  assert.doesNotMatch(serialized, /"credential"|"privateKey"|"session"|"signature"|"signedUrl"/i);
  assert.doesNotMatch(serialized, /Bearer MUST_NOT_LEAK|eyJ MUST_NOT_LEAK|BEGIN PRIVATE KEY|X-Amz-Signature|token=MUST_NOT_LEAK/);
  assert.doesNotMatch(serialized, /LONGPEMSECRETPREFIX|LONGBEARERSECRETPREFIX|LONGJWTSECRETPREFIX/);
  assert.equal((serialized.match(/REDACTED_EVIDENCE_LIMIT/g) ?? []).length, 1);
  assert.ok(serialized.length < 100_000, "evidence response must remain bounded");
  assert.match(serialized, /https:\/\/example\.invalid\/evidence\/receipt/);
  assert.doesNotMatch(serialized, /https:\/\/example\.invalid\/download\?/);
  const missingToken = body.credentials.records.find((row: any) => row.accountId === `${marker}_missing_token`);
  const missingAccount = body.credentials.records.find((row: any) => row.accountName === `${marker} Missing Account`);
  assert.deepEqual(missingToken.health, { state: "blocked", reason: "missing_credential" });
  assert.deepEqual(missingAccount.health, { state: "blocked", reason: "missing_account" });
  assert.doesNotMatch(serialized, /MUST_NOT_LEAK_OTHER_CAMPAIGN|MUST_NOT_LEAK_FOREIGN_WORKSPACE/);

  const foreignResponse = await request(foreignCampaignId!);
  assert.equal(foreignResponse.status, 404);
  const missingResponse = await request(randomUUID());
  assert.equal(missingResponse.status, 404);

  const [emptyCampaign] = await db.insert(campaignsTable).values({
    workspaceId: ownerWorkspaceId,
    title: `${marker} Empty Campaign`,
  }).returning({ id: campaignsTable.id });
  const emptyResponse = await request(emptyCampaign!.id);
  assert.equal(emptyResponse.status, 200);
  const emptyBody = await emptyResponse.json() as any;
  assert.equal(emptyBody.masterplan.available, false);
  assert.equal(emptyBody.pendingCheckpoints.available, false);
  assert.equal(emptyBody.deliverables.available, false);
  assert.equal(emptyBody.executionEvidence.available, false);
  await db.delete(campaignsTable).where(eq(campaignsTable.id, emptyCampaign!.id));

  console.log("campaign control room ownership, truthfulness and sanitization tests passed");
} finally {
  if (server) await new Promise<void>((resolve, reject) => server!.close((err) => err ? reject(err) : resolve()));
  const campaignIds = [campaignId, otherCampaignId, foreignCampaignId].filter((id): id is string => Boolean(id));
  if (campaignIds.length) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`set local session_replication_role = replica`);
      await tx.delete(executionEvidenceTable).where(inArray(executionEvidenceTable.campaignId, campaignIds));
    });
    await db.delete(socialPostsTable).where(inArray(socialPostsTable.campaignId, campaignIds));
    await db.delete(campaignsTable).where(inArray(campaignsTable.id, campaignIds));
  }
  await cleanupE2eFixtures(fixtures);
  await pool.end();
}
