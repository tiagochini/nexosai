import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "./auth.service.js";
import { getWorkspaceTrial } from "./trial-access.service.js";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

export function isTrialRouteAllowed(method: string, path: string): boolean {
  if (method === "GET" && ["/auth/me", "/auth/workspaces", "/auth/platform-status", "/onboarding/status", "/campaigns"].includes(path)) return true;
  // Keep plan checkout and its status polling available to trial users. Credit
  // pack purchases and unrelated billing controls remain outside trial scope.
  if (method === "GET" && ["/billing/status", "/billing/history", "/billing/access", "/billing/offers"].includes(path)) return true;
  if (method === "GET" && new RegExp(`^/billing/payment/${UUID}$`, "i").test(path)) return true;
  if (method === "POST" && path === "/billing/initiate") return true;
  if (method === "POST" && /^\/billing\/offers\/[0-9a-f-]+\/purchase$/i.test(path)) return true;
  if (method === "POST" && [
    "/auth/refresh", "/auth/logout", "/auth/onboarding/seen", "/onboarding/start", "/billing/redeem-code",
  ].includes(path)) return true;

  const campaignPath = new RegExp(`^/campaigns/${UUID}(?:/social-diagnosis)?$`, "i");
  if (campaignPath.test(path) && method === "GET") return true;
  if (new RegExp(`^/campaigns/${UUID}/social-diagnosis$`, "i").test(path) && method === "POST") return true;
  if (method === "GET" && new RegExp(`^/campaigns/${UUID}/masterplan/versions$`, "i").test(path)) return true;

  const intakeAction = new RegExp(`^/intake/${UUID}(?:/(?:questions|transcribe|extract|conversation|readiness|validate-revenue|recommend-track|simulate-budget|confirm-type))?$`, "i");
  if (intakeAction.test(path) && ["GET", "POST"].includes(method)) return true;
  return false;
}

/** Trial workspaces may use only the briefing flow and one campaign social diagnosis. */
export async function enforceTrialScope(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) { next(); return; }

  let payload;
  try {
    payload = verifyAccessToken(header.slice(7));
  } catch {
    // Authentication middleware on protected routes returns the canonical 401.
    next();
    return;
  }

  try {
    if (!(await getWorkspaceTrial(payload.workspaceId))) { next(); return; }
    if (isTrialRouteAllowed(req.method.toUpperCase(), req.path)) { next(); return; }
    res.status(403).json({
      error: "O acesso trial inclui um briefing e uma análise de redes sociais. Contrate uma licença para liberar os demais recursos.",
      code: "TRIAL_SCOPE_RESTRICTED",
    });
  } catch (error) {
    next(error);
  }
}
