import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import pino from "pino";
import { eq } from "drizzle-orm";
import { db, pool, plansTable, usersTable, workspacesTable, subscriptionPaymentsTable } from "@workspace/db";
import billingRouter from "../modules/billing/billing.routes.js";
import { signAccess } from "../modules/auth/auth.service.js";
import { assertIsolationTestDatabase } from "./helpers/test-database-target.js";
await assertIsolationTestDatabase(pool);
const marker = randomUUID(); let userId: string | undefined;
let server: ReturnType<typeof express.application.listen> | undefined;
try {
  const [plan] = await db.select().from(plansTable).limit(1); assert.ok(plan);
  const [user] = await db.insert(usersTable).values({ email: `access-${marker}@example.invalid`, name: "Access fixture", passwordHash: "inert" }).returning(); userId = user!.id;
  const [ws] = await db.insert(workspacesTable).values({ ownerId: userId, planId: plan.id, name: "Access fixture", slug: marker, creditsBalance: 100 }).returning();
  const [payment] = await db.insert(subscriptionPaymentsTable).values({ workspaceId: ws!.id, userId, planId: plan.id, amountCents: 100, method: "pix", status: "pending" }).returning();
  const app = express(); app.use(express.json()); const log = pino({ level: "silent" });
  app.use((req, _res, next) => { req.log = log; next(); }); app.use("/billing", billingRouter);
  server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server!.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const token = signAccess({ userId, workspaceId: ws!.id, email: user!.email });
  const reason = async () => {
    const response = await fetch(`http://127.0.0.1:${address.port}/billing/access`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200); return (await response.json() as { reason: string }).reason;
  };
  for (const status of ["pending", "processing", "failed", "refunded", "cancelled", "expired"] as const) {
    await db.update(subscriptionPaymentsTable).set({ status }).where(eq(subscriptionPaymentsTable.id, payment!.id));
    assert.notEqual(await reason(), "paid", "An unpaid/reversed record must not be presented as paid access");
  }
  await db.update(subscriptionPaymentsTable).set({ status: "paid" }).where(eq(subscriptionPaymentsTable.id, payment!.id));
  assert.equal(await reason(), "paid");
  console.log("PASS live billing HTTP distinguishes paid proof from pending, failed and reversed records; preserves plan-assigned access policy");
} finally {
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  if (userId) await db.delete(usersTable).where(eq(usersTable.id, userId));
  await pool.end();
}
