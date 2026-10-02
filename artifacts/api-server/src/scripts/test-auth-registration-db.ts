import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pino from "pino";
import { and, eq } from "drizzle-orm";
import {
  db,
  pool,
  plansTable,
  usersTable,
  workspacesTable,
} from "@workspace/db";
import { ConflictError } from "../lib/errors.js";
import { loginUser, registerUser } from "../modules/auth/auth.service.js";

const marker = randomUUID();
const email = `auth-smoke-${marker}@example.invalid`;
const password = `Smoke-${marker}!`;
const log = pino({ level: "silent" });

try {
  const attempts = await Promise.allSettled([
    registerUser({ email, password, name: "Auth Smoke", planSlug: "solo" }, log),
    registerUser({ email, password, name: "Auth Smoke", planSlug: "solo" }, log),
  ]);
  const successful = attempts.filter((attempt) => attempt.status === "fulfilled");
  const rejected = attempts.filter((attempt) => attempt.status === "rejected");

  assert.equal(successful.length, 1, "exactly one concurrent registration must succeed");
  assert.equal(rejected.length, 1, "duplicate concurrent registration must fail");
  const rejection = rejected[0]?.status === "rejected" ? rejected[0].reason : undefined;
  assert.ok(
    rejection instanceof ConflictError,
    "duplicate registration must be reported as a conflict",
  );

  const users = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email));
  assert.equal(users.length, 1, "registration must leave exactly one user");

  const workspaces = await db
    .select({
      id: workspacesTable.id,
      creditsBalance: workspacesTable.creditsBalance,
      planSlug: plansTable.slug,
      planCredits: plansTable.creditsMonthly,
    })
    .from(workspacesTable)
    .innerJoin(plansTable, eq(plansTable.id, workspacesTable.planId))
    .where(eq(workspacesTable.ownerId, users[0]!.id));
  assert.equal(workspaces.length, 1, "registration must leave exactly one workspace");
  assert.equal(workspaces[0]!.planSlug, "solo");
  assert.equal(workspaces[0]!.creditsBalance, workspaces[0]!.planCredits);

  const tokens = await loginUser({ email, password }, log);
  assert.ok(tokens.accessToken, "login must return an access token");
  assert.ok(tokens.refreshToken, "login must return a refresh token");

  console.log("Auth registration smoke test passed.");
  console.log("Concurrent duplicate registration was rejected with no orphan records.");
} finally {
  const users = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email));
  for (const user of users) {
    await db
      .delete(workspacesTable)
      .where(
        and(
          eq(workspacesTable.ownerId, user.id),
          eq(workspacesTable.name, "Auth Smoke's Workspace"),
        ),
      );
    await db.delete(usersTable).where(eq(usersTable.id, user.id));
  }
  await pool.end();
}
