import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { eq } from "drizzle-orm";
import { db, campaignsTable } from "@workspace/db";
import contentRouter from "../modules/content/content.routes.js";
import { signAccess } from "../modules/auth/auth.service.js";
import { cleanupE2eFixtures, markerFromSuffix, seedE2eFixtures } from "./e2e-fixtures.js";

if (process.env["NODE_ENV"] !== "test") {
  throw new Error("Run with NODE_ENV=test");
}

const marker = markerFromSuffix(`content-coherence-idor-${process.pid}`);
const fixtures = await seedE2eFixtures(marker);
const [requestingWorkspaceId, foreignWorkspaceId] = fixtures.workspaces;
const requestingUserId = fixtures.users[0]!;
const foreignReportMarker = "FOREIGN_COHERENCE_REPORT_MUST_NEVER_LEAK";
let server: http.Server | undefined;

try {
  const [ownedCampaign] = await db.insert(campaignsTable).values({
    workspaceId: requestingWorkspaceId!,
    title: `${marker} owned campaign`,
    brainData: { coherenceReport: { verdict: "coherent", marker: "OWNED_REPORT" } },
  }).returning({ id: campaignsTable.id });
  const [foreignCampaign] = await db.insert(campaignsTable).values({
    workspaceId: foreignWorkspaceId!,
    title: `${marker} foreign campaign`,
    brainData: {
      coherenceReport: {
        verdict: "needs_attention",
        marker: foreignReportMarker,
        confidentialRecommendation: foreignReportMarker,
      },
    },
  }).returning({ id: campaignsTable.id });

  const app = express();
  app.use(contentRouter);
  server = http.createServer(app);
  await new Promise<void>((resolve, reject) => {
    server!.once("error", reject);
    server!.listen(0, "127.0.0.1", resolve);
  });

  const { port } = server.address() as AddressInfo;
  const token = signAccess({
    userId: requestingUserId,
    workspaceId: requestingWorkspaceId!,
    email: `${marker.toLowerCase()}@e2e.invalid`,
  });
  const request = (campaignId: string, method = "GET") => fetch(
    `http://127.0.0.1:${port}/${campaignId}/content/coherence`,
    { method, headers: { authorization: `Bearer ${token}` } },
  );

  const ownedResponse = await request(ownedCampaign!.id);
  assert.equal(ownedResponse.status, 200);
  assert.deepEqual(await ownedResponse.json(), {
    report: { verdict: "coherent", marker: "OWNED_REPORT" },
  });

  const foreignResponse = await request(foreignCampaign!.id);
  const foreignBody = await foreignResponse.json();
  assert.equal(foreignResponse.status, 404);
  assert.deepEqual(foreignBody, { error: "Campaign not found", code: "NOT_FOUND" });
  assert.doesNotMatch(JSON.stringify(foreignBody), new RegExp(foreignReportMarker));

  const foreignTriggerResponse = await request(foreignCampaign!.id, "POST");
  assert.equal(foreignTriggerResponse.status, 404);
  assert.deepEqual(await foreignTriggerResponse.json(), {
    error: "Campaign not found",
    code: "NOT_FOUND",
  });

  console.log("content coherence cross-workspace IDOR regression test passed");
} finally {
  if (server) {
    await new Promise<void>((resolve, reject) => server!.close((err) => err ? reject(err) : resolve()));
  }
  await db.delete(campaignsTable).where(eq(campaignsTable.workspaceId, requestingWorkspaceId!));
  await db.delete(campaignsTable).where(eq(campaignsTable.workspaceId, foreignWorkspaceId!));
  await cleanupE2eFixtures(fixtures);
}