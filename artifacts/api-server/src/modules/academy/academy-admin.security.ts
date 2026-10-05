import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

// No default password, no query-string credentials, and fail closed if unset.
export function checkAcademyAdmin(req: Request, res: Response): boolean {
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
