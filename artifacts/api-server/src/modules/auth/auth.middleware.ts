import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type TokenPayload } from "./auth.service.js";
import { UnauthorizedError } from "../../lib/errors.js";

declare global {
  namespace Express {
    interface Request {
      auth: TokenPayload;
    }
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authorization header required", code: "UNAUTHORIZED" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      res.status(401).json({ error: err.message, code: err.code });
      return;
    }
    res.status(401).json({ error: "Invalid token", code: "UNAUTHORIZED" });
  }
}
