import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type TokenPayload } from "./auth.service.js";
import { UnauthorizedError } from "../../lib/errors.js";
import { db, workspacesTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      auth: TokenPayload;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authorization header required", code: "UNAUTHORIZED" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    req.auth = verifyAccessToken(token);
    const [workspace] = await db.select({ id: workspacesTable.id }).from(workspacesTable)
      .where(and(eq(workspacesTable.id, req.auth.workspaceId), eq(workspacesTable.ownerId, req.auth.userId))).limit(1);
    if (!workspace) {
      res.status(401).json({ error: "Invalid token", code: "UNAUTHORIZED" });
      return;
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      res.status(401).json({ error: err.message, code: err.code });
      return;
    }
    res.status(401).json({ error: "Invalid token", code: "UNAUTHORIZED" });
    return;
  }
  next();
}
