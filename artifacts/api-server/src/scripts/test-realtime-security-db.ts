import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import jwt from "jsonwebtoken";
import { io as client, type Socket } from "socket.io-client";
import { eq } from "drizzle-orm";
import { db, pool, usersTable, workspacesTable, plansTable, campaignsTable } from "@workspace/db";
import { env } from "../lib/env.js";
import { signAccess, type TokenPayload } from "../modules/auth/auth.service.js";
import { initRealtime, emitCampaignEvent, isRealtimeOriginAllowed, authorizeRealtimeCampaign } from "../modules/realtime/realtime.service.js";

const marker = randomUUID();
const origin = new URL(env.APP_URL).origin;
const server = createServer();
let authorizationGate: Promise<void> | null = null;
let failAuthorization = false;
const io = initRealtime(server, async (auth, id) => {
  if (authorizationGate) await authorizationGate;
  if (failAuthorization) throw new Error("Simulated dependency failure");
  return authorizeRealtimeCampaign(auth, id);
});
const sockets: Socket[] = [];
const userIds: string[] = [];
type Reply = { ok: boolean; code?: string };
let base = "";

function socketFor(token: unknown, transport: "websocket" | "polling", source = origin) {
  const socket = client(base, { path: "/api/socket.io", auth: { token }, transports: [transport],
    extraHeaders: { Origin: source }, reconnection: false, forceNew: true, autoConnect: false, timeout: 2000 });
  sockets.push(socket);
  return socket;
}

async function connect(socket: Socket, accepted: boolean) {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Connection test timed out")), 3000);
    const finish = (connected: boolean) => {
      clearTimeout(timer);
      socket.removeAllListeners("connect");
      socket.removeAllListeners("connect_error");
      try { assert.equal(connected, accepted); resolve(); } catch (error) { reject(error); }
    };
    socket.once("connect", () => finish(true));
    socket.once("connect_error", () => finish(false));
    socket.connect();
  });
}

async function fixture(index: number) {
  const [user] = await db.insert(usersTable).values({ email: `realtime-${marker}-${index}@example.invalid`,
    name: "Realtime security fixture", passwordHash: "not-a-login-credential" }).returning();
  assert(user); userIds.push(user.id);
  const [plan] = await db.select().from(plansTable).limit(1); assert(plan);
  const [workspace] = await db.insert(workspacesTable).values({ ownerId: user.id, planId: plan.id,
    name: "Realtime security fixture", slug: `realtime-${marker}-${index}` }).returning();
  assert(workspace);
  const [campaign] = await db.insert(campaignsTable).values({ workspaceId: workspace.id,
    title: "Realtime security fixture" }).returning();
  assert(campaign);
  const auth: TokenPayload = { userId: user.id, workspaceId: workspace.id, email: user.email };
  return { user, workspace, campaign, auth, token: signAccess(auth) };
}

try {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert(address && typeof address !== "string");
  base = `http://127.0.0.1:${address.port}`;
  const a = await fixture(1); const b = await fixture(2);
  assert.equal(isRealtimeOriginAllowed("https://untrusted.example.invalid"), false);
  assert.equal(isRealtimeOriginAllowed(undefined), true);
  for (const transport of ["websocket", "polling"] as const) {
    const own = socketFor(a.token, transport); const foreign = socketFor(b.token, transport);
    await connect(own, true); await connect(foreign, true);
    const join = await own.timeout(2000).emitWithAck("join:campaign", a.campaign.id) as Reply;
    assert.equal(join.ok, true);
    const denied = await foreign.timeout(2000).emitWithAck("join:campaign", a.campaign.id) as Reply;
    const missing = await foreign.timeout(2000).emitWithAck("join:campaign", randomUUID()) as Reply;
    assert.deepEqual(denied, { ok: false, code: "CAMPAIGN_NOT_FOUND" });
    assert.deepEqual(missing, denied);
    for (const input of ["not-a-uuid", null, {}, [a.campaign.id], 42]) {
      assert.deepEqual(await foreign.timeout(2000).emitWithAck("join:campaign", input),
        { ok: false, code: "INVALID_CAMPAIGN_ID" });
    }
    assert(!io.sockets.sockets.get(foreign.id!)?.rooms.has(`campaign:${a.campaign.id}`));
    const leaked: unknown[] = [];
    foreign.on("campaign:event", (event) => leaked.push(event));
    const received = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Authorized event not delivered")), 2000);
      own.once("campaign:event", (event) => { clearTimeout(timer); assert.equal(event.campaignId, a.campaign.id); resolve(); });
    });
    emitCampaignEvent({ campaignId: a.campaign.id, type: "execution_update", timestamp: new Date().toISOString() });
    await received;
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(leaked.length, 0);
    await own.timeout(2000).emitWithAck("leave:campaign", a.campaign.id);
    assert(!io.sockets.sockets.get(own.id!)?.rooms.has(`campaign:${a.campaign.id}`));
    // A leave while the DB lookup is pending must cancel the subscription.
    let release!: () => void;
    authorizationGate = new Promise<void>((resolve) => { release = resolve; });
    const pending = own.timeout(2000).emitWithAck("join:campaign", a.campaign.id);
    await own.timeout(2000).emitWithAck("leave:campaign", a.campaign.id);
    authorizationGate = null; release();
    assert.deepEqual(await pending, { ok: false, code: "JOIN_CANCELLED" });
    assert(!io.sockets.sockets.get(own.id!)?.rooms.has(`campaign:${a.campaign.id}`));
    failAuthorization = true;
    assert.deepEqual(await own.timeout(2000).emitWithAck("join:campaign", a.campaign.id),
      { ok: false, code: "REALTIME_UNAVAILABLE" });
    assert(!io.sockets.sockets.get(own.id!)?.rooms.has(`campaign:${a.campaign.id}`));
    failAuthorization = false;
    assert.equal((await own.timeout(2000).emitWithAck("join:campaign", a.campaign.id)).ok, true);
    await connect(socketFor(a.token, transport, "https://untrusted.example.invalid"), false);
    await connect(socketFor({}, transport), false);
    await connect(socketFor("invalid-token", transport), false);
    await connect(socketFor(signAccess({ ...a.auth, workspaceId: b.workspace.id }), transport), false);
    await connect(socketFor(jwt.sign(a.auth, env.JWT_SECRET, { expiresIn: -1 }), transport), false);
    own.disconnect(); foreign.disconnect();
  }
  const expiring = socketFor(jwt.sign(a.auth, env.JWT_SECRET, { expiresIn: 2 }), "websocket");
  await connect(expiring, true);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Expired socket remained connected")), 3500);
    expiring.once("disconnect", () => { clearTimeout(timer); resolve(); });
  });
  await db.update(workspacesTable).set({ status: "suspended" }).where(eq(workspacesTable.id, a.workspace.id));
  await connect(socketFor(a.token, "websocket"), false);
  console.log("Realtime security passed: tenant isolation, malformed inputs, event delivery, leave race, origins, credentials and expiry (WebSocket + polling)");
} finally {
  for (const socket of sockets) socket.disconnect();
  await new Promise<void>((resolve) => io.close(() => resolve()));
  for (const userId of userIds) await db.delete(usersTable).where(eq(usersTable.id, userId));
  await pool.end();
}
