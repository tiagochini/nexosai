import type { Request, Response, NextFunction } from "express";
import { env } from "../../lib/env.js";

export const REFRESH_COOKIE_NAME = "nexos_refresh";
export const refreshCookieOptions = (production = env.NODE_ENV === "production") => ({ httpOnly: true, secure: production, sameSite: "strict" as const, path: "/api/auth" });

export function readRefreshCookie(req: Pick<Request, "headers">): string | null {
  const values = (req.headers.cookie ?? "").split(";").map((part) => part.trim()).filter((part) => part.startsWith(`${REFRESH_COOKIE_NAME}=`));
  if (values.length !== 1) return null;
  try { return decodeURIComponent(values[0]!.slice(REFRESH_COOKIE_NAME.length + 1)); } catch { return null; }
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
}

export function sendSessionTokens(res: Response, tokens: { accessToken: string; refreshToken: string; expiresIn: number; refreshExpiresAt: Date }) {
  res.setHeader("Cache-Control", "no-store");
  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, { ...refreshCookieOptions(), expires: tokens.refreshExpiresAt });
  return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
}

// CORS alone does not reject browser form submissions. Check the source of all
// requests which create, refresh, replace, or remove the browser session.
export function requireTrustedSessionOrigin(req: Request, res: Response, next: NextFunction): void {
  const origin = req.get("origin");
  const trusted = new Set([env.APP_URL, ...env.ALLOWED_ORIGINS.split(",")].filter(Boolean).map((value) => {
    try { return new URL(value.trim()).origin; } catch { return ""; }
  }));
  if ((origin && !trusted.has(origin)) || req.get("sec-fetch-site") === "cross-site") {
    res.status(403).json({ error: "Untrusted session request origin", code: "UNTRUSTED_ORIGIN" });
    return;
  }
  if (!origin && req.get("sec-fetch-site") !== "same-origin" && !req.is("application/json")) {
    res.status(403).json({ error: "Session requests require JSON or a trusted origin", code: "UNTRUSTED_ORIGIN" });
    return;
  }
  next();
}
