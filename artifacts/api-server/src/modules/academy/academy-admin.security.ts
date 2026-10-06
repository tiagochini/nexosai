import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, workspacesTable, authRefreshSessionsTable, academyAdminAuditTable } from "@workspace/db";
import { verifyAccessToken } from "../auth/auth.service.js";
import { logger } from "../../lib/logger.js";

// No default password, no query-string credentials, and fail closed if unset.
export async function checkAcademyAdmin(req: Request, res: Response): Promise<boolean> {
  const authorization = req.headers.authorization;
  if (authorization) {
    try {
      if (!authorization.startsWith("Bearer ")) throw new Error("Invalid authorization");
      const auth = verifyAccessToken(authorization.slice(7));
      if (!auth.sessionId || !/^[a-f0-9-]{36}$/.test(auth.sessionId)) throw new Error("Session-bound token required");
      const owners = (process.env["ACADEMY_ADMIN_USER_IDS"] ?? "").split(",").map((id) => id.trim());
      if (!owners.includes(auth.userId)) { res.status(403).json({ error: "Forbidden" }); return false; }
      const [owner] = await db.select({ id: workspacesTable.id }).from(workspacesTable)
        .where(and(eq(workspacesTable.id, auth.workspaceId), eq(workspacesTable.ownerId, auth.userId), eq(workspacesTable.status, "active"))).limit(1);
      const [session] = await db.select({ id: authRefreshSessionsTable.id }).from(authRefreshSessionsTable)
        .where(and(eq(authRefreshSessionsTable.id, auth.sessionId), eq(authRefreshSessionsTable.userId, auth.userId), eq(authRefreshSessionsTable.workspaceId, auth.workspaceId),
          isNull(authRefreshSessionsTable.revokedAt), sql`${authRefreshSessionsTable.expiresAt} > now()`)).limit(1);
      if (!owner || !session) { res.status(401).json({ error: "Inactive owner session" }); return false; }
      req.auth = auth;
      res.setHeader("Cache-Control", "no-store");
      const [audit] = await db.insert(academyAdminAuditTable).values({ actorId: auth.userId, action: String(req.route?.path ?? "unknown"), method: req.method }).returning();
      res.once("finish", () => { void db.update(academyAdminAuditTable).set({ status: res.statusCode }).where(eq(academyAdminAuditTable.id, audit!.id))
        .catch((err) => logger.error({ err }, "academy: admin audit completion failed")); });
      return true;
    } catch (err) {
      // No credential or provider error details in authentication responses.
      res.status(401).json({ error: "Unauthorized" }); return false;
    }
  }
  // Explicit development-only compatibility. Never an alternative in production.
  if (process.env["NODE_ENV"] === "production" || process.env["ACADEMY_ALLOW_LEGACY_ADMIN_SECRET"] !== "true") {
    res.status(401).json({ error: "Unauthorized" }); return false;
  }
  const configured = process.env["ACADEMY_ADMIN_SECRET"];
  const supplied = req.headers["x-admin-secret"];
  if (typeof configured !== "string" || configured.trim() !== configured || configured.length < 32 || configured.length > 256 ||
      typeof supplied !== "string" || supplied.length > 256) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  const expected = Buffer.from(configured);
  const actual = Buffer.from(supplied);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}
