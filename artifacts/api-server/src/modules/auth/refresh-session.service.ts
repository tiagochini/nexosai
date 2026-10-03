import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, authRefreshSessionsTable } from "@workspace/db";
import { UnauthorizedError } from "../../lib/errors.js";

const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = (id: string) => `${id}.${randomBytes(32).toString("base64url")}`;

function sessionId(token: string): string | null {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.[A-Za-z0-9_-]{43}$/.test(token)
    ? token.split(".")[0]!
    : null;
}

export async function createRefreshSession(userId: string, workspaceId: string) {
  const id = randomUUID();
  const refreshToken = newToken(id);
  const refreshExpiresAt = new Date(Date.now() + TTL_MS);
  await db.insert(authRefreshSessionsTable).values({ id, userId, workspaceId, tokenHash: tokenHash(refreshToken), expiresAt: refreshExpiresAt });
  return { refreshToken, refreshExpiresAt };
}

export async function readRefreshSession(token: string) {
  const id = sessionId(token);
  if (!id) throw new UnauthorizedError("Invalid refresh session");
  const [session] = await db.select().from(authRefreshSessionsTable).where(and(
    eq(authRefreshSessionsTable.id, id), eq(authRefreshSessionsTable.tokenHash, tokenHash(token)),
    isNull(authRefreshSessionsTable.revokedAt), gt(authRefreshSessionsTable.expiresAt, new Date()),
  )).limit(1);
  if (!session) throw new UnauthorizedError("Expired, revoked, or already rotated refresh session");
  return session;
}

export async function rotateRefreshSession(token: string) {
  const id = sessionId(token);
  if (!id) throw new UnauthorizedError("Invalid refresh session");
  const refreshToken = newToken(id);
  // Compare-and-swap makes concurrent reuse fail, including across API replicas.
  const [rotated] = await db.update(authRefreshSessionsTable).set({ tokenHash: tokenHash(refreshToken), updatedAt: new Date() }).where(and(
    eq(authRefreshSessionsTable.id, id), eq(authRefreshSessionsTable.tokenHash, tokenHash(token)),
    isNull(authRefreshSessionsTable.revokedAt), gt(authRefreshSessionsTable.expiresAt, new Date()),
  )).returning({ refreshExpiresAt: authRefreshSessionsTable.expiresAt });
  if (!rotated) throw new UnauthorizedError("Refresh session has already been rotated or revoked");
  return { refreshToken, ...rotated };
}

export async function revokeRefreshSession(token: string): Promise<void> {
  const id = sessionId(token);
  if (!id) return;
  await db.update(authRefreshSessionsTable).set({ revokedAt: new Date(), updatedAt: new Date() }).where(and(
    eq(authRefreshSessionsTable.id, id), eq(authRefreshSessionsTable.tokenHash, tokenHash(token)),
  ));
}
