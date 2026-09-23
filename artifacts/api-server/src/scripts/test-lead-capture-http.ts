import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  db, pool, usersTable, plansTable, workspacesTable, campaignsTable,
  launchSequencesTable, sequenceContactsTable, auditLogsTable,
} from "@workspace/db";
import leadCaptureRouter from "../modules/launch-sequence/lead-capture.routes.js";

if (process.env.LEAD_CAPTURE_HTTP_TESTS !== "true") throw new Error("LEAD_CAPTURE_HTTP_TESTS=true is required");
const ids = { user: randomUUID(), workspace: randomUUID(), campaign: randomUUID(), sequence: randomUUID() };
const suffix = randomUUID();
let planId: string | undefined;
let createdPlan = false;

function request(port: number, body: Record<string, unknown>): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({ port, path: `/api/lead-capture/${ids.sequence}`, method: "POST", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } }, (res) => {
      let text = ""; res.setEncoding("utf8"); res.on("data", (chunk) => { text += chunk; }); res.on("end", () => resolve({ status: res.statusCode ?? 0, body: text ? JSON.parse(text) : {} }));
    });
    req.on("error", reject); req.write(payload); req.end();
  });
}

try {
  const [plan] = await db.select({ id: plansTable.id }).from(plansTable).where(eq(plansTable.slug, "solo")).limit(1);
  if (plan) planId = plan.id;
  else { planId = randomUUID(); createdPlan = true; await db.insert(plansTable).values({ id: planId, name: "HTTP test", slug: "agency", priceMonthly: "0", creditsMonthly: 1, maxCampaigns: 1 } as any); }
  await db.insert(usersTable).values({ id: ids.user, email: `http-${suffix}@example.test`, passwordHash: "test", name: "HTTP" });
  await db.insert(workspacesTable).values({ id: ids.workspace, ownerId: ids.user, planId, name: "HTTP", slug: `http-${suffix}` });
  await db.insert(campaignsTable).values({ id: ids.campaign, workspaceId: ids.workspace, title: "HTTP", strategyData: {} });
  await db.insert(launchSequencesTable).values({ id: ids.sequence, workspaceId: ids.workspace, campaignId: ids.campaign, name: "HTTP", status: "active", leadCaptureEnabled: true, config: {} });

  const app = express();
  app.use(express.json());
  app.use("/api/lead-capture", leadCaptureRouter);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(500).json({ error: error instanceof Error ? error.message : "internal error" }));
  const server = await new Promise<http.Server>((resolve) => { const value = app.listen(0, () => resolve(value)); });
  const port = (server.address() as import("node:net").AddressInfo).port;
  try {
    const first = await request(port, { phone: " +55 (11) 99999-1234 " });
    assert.equal(first.status, 201); assert.equal(first.body.captured, true); assert.equal(first.body.duplicate, false);
    assert.ok(first.body.contactId); assert.ok(first.body.referralCode);
    const countAfterFirst = (await db.select().from(sequenceContactsTable).where(eq(sequenceContactsTable.sequenceId, ids.sequence))).length;
    const auditAfterFirst = (await db.select().from(auditLogsTable).where(and(eq(auditLogsTable.workspaceId, ids.workspace), eq(auditLogsTable.action, "lead.captured")))).length;
    assert.equal(countAfterFirst, 1); assert.equal(auditAfterFirst, 1);
    const duplicate = await request(port, { phone: "5511999991234" });
    assert.equal(duplicate.status, 200); assert.equal(duplicate.body.duplicate, true); assert.equal(duplicate.body.contactId, first.body.contactId);
    assert.equal((await db.select().from(sequenceContactsTable).where(eq(sequenceContactsTable.sequenceId, ids.sequence))).length, countAfterFirst);
    assert.equal((await db.select().from(auditLogsTable).where(and(eq(auditLogsTable.workspaceId, ids.workspace), eq(auditLogsTable.action, "lead.captured")))).length, auditAfterFirst);
    await db.insert(sequenceContactsTable).values([
      { sequenceId: ids.sequence, workspaceId: ids.workspace, email: "split-a@example.test" },
      { sequenceId: ids.sequence, workspaceId: ids.workspace, phone: "5511888888888" },
    ]);
    const beforeConflictContacts = (await db.select().from(sequenceContactsTable).where(eq(sequenceContactsTable.sequenceId, ids.sequence))).length;
    const beforeConflictAudit = (await db.select().from(auditLogsTable).where(eq(auditLogsTable.workspaceId, ids.workspace))).length;
    const conflict = await request(port, { email: "split-a@example.test", phone: "+55 11 88888-8888" });
    assert.equal(conflict.status, 409); assert.equal(conflict.body.code, "IDENTITY_CONFLICT");
    assert.equal((await db.select().from(sequenceContactsTable).where(eq(sequenceContactsTable.sequenceId, ids.sequence))).length, beforeConflictContacts);
    assert.equal((await db.select().from(auditLogsTable).where(eq(auditLogsTable.workspaceId, ids.workspace))).length, beforeConflictAudit);
    (app.locals as { captureLead?: unknown }).captureLead = async () => { throw new Error("injected capture failure"); };
    const failed = await request(port, { phone: "5511777777777" });
    assert.equal(failed.status, 500); assert.match(String(failed.body.error), /injected capture failure/);
    assert.equal((await db.select().from(sequenceContactsTable).where(eq(sequenceContactsTable.sequenceId, ids.sequence))).length, beforeConflictContacts);
    console.log("lead-capture-http: new=201 duplicate=200 conflict=409 injected-error=500");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
} finally {
  await db.delete(auditLogsTable).where(eq(auditLogsTable.workspaceId, ids.workspace));
  await db.delete(sequenceContactsTable).where(eq(sequenceContactsTable.workspaceId, ids.workspace));
  await db.delete(launchSequencesTable).where(eq(launchSequencesTable.workspaceId, ids.workspace));
  await db.delete(campaignsTable).where(eq(campaignsTable.workspaceId, ids.workspace));
  await db.delete(workspacesTable).where(eq(workspacesTable.id, ids.workspace));
  await db.delete(usersTable).where(eq(usersTable.id, ids.user));
  if (planId && createdPlan) await db.delete(plansTable).where(eq(plansTable.id, planId));
  await pool.end();
}