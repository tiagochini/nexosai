import type { Request, Response, NextFunction } from "express";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, authRefreshSessionsTable, workspacesTable } from "@workspace/db";
import type { TokenPayload } from "../auth/auth.service.js";
import { isPlatformAdmin } from "./admin-access.js";

export async function hasActivePlatformAdminSession(auth: TokenPayload): Promise<boolean> {
  if (!isPlatformAdmin(auth.userId) || !auth.sessionId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(auth.sessionId)) return false;
  const [session] = await db.select({ id: authRefreshSessionsTable.id }).from(authRefreshSessionsTable)
    .innerJoin(workspacesTable, eq(workspacesTable.id, authRefreshSessionsTable.workspaceId))
    .where(and(eq(authRefreshSessionsTable.id, auth.sessionId), eq(authRefreshSessionsTable.userId, auth.userId),
      eq(authRefreshSessionsTable.workspaceId, auth.workspaceId), isNull(authRefreshSessionsTable.revokedAt),
      sql`${authRefreshSessionsTable.expiresAt} > now()`, eq(workspacesTable.ownerId, auth.userId), eq(workspacesTable.status, "active"))).limit(1);
  return Boolean(session);
}

/** Must follow requireAuth; never accepts role, email or UUID from request input. */
export async function requirePlatformAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!isPlatformAdmin(req.auth.userId)) {
    res.status(403).json({ error: "Admin access required", code: "FORBIDDEN" }); return;
  }
  if (!await hasActivePlatformAdminSession(req.auth)) {
    res.status(401).json({ error: "Inactive admin session", code: "UNAUTHORIZED" }); return;
  }
  res.setHeader("Cache-Control", "no-store");
  next();
}
