import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "./auth.service.js";
import { getWorkspaceTrial } from "./trial-access.service.js";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

export function isTrialRouteAllowed(method: string, path: string, briefingCampaignId?: string | null): boolean {
  if (method === "GET" && ["/auth/me", "/auth/workspaces", "/auth/platform-status", "/onboarding/status", "/campaigns"].includes(path)) return true;
  // Catalogs are public-to-authenticated-user read paths: trials need current
  // prices to evaluate an upgrade, while purchase actions remain separately gated.
  if (method === "GET" && ["/plans", "/billing/status", "/billing/history", "/billing/access", "/billing/offers", "/billing/packs"].includes(path)) return true;
  if (method === "GET" && new RegExp(`^/billing/payment/${UUID}$`, "i").test(path)) return true;
  // Trial users may connect a Facebook Page in read-only analysis mode only.
  if (method === "GET" && path === "/integrations/oauth/start/facebook_analysis") return true;
  // Trial users can run public profile analysis, but no other Social Presence tools.
  if (method === "POST" && path === "/presence/analyze-profile") return true;
  if (method === "POST" && path === "/billing/initiate") return true;
  if (method === "POST" && /^\/billing\/offers\/[0-9a-f-]+\/purchase$/i.test(path)) return true;
  if (method === "POST" && [
    "/auth/refresh", "/auth/logout", "/auth/onboarding/seen", "/onboarding/start", "/billing/redeem-code",
  ].includes(path)) return true;

  // A trial may generate and review the strategy for its single briefing
  // campaign. Keep these permissions scoped to that campaign; content,
  // launch, materialization, repair, and approval routes remain blocked.
  if (briefingCampaignId) {
    if (method === "POST" && path.toLowerCase() === `/campaigns/${briefingCampaignId.toLowerCase()}/schedule-preview/generate`) return true;
    const trialCampaignPath = new RegExp(`^/campaigns/(${UUID})(?:/social-diagnosis|/masterplan/(?:current|versions|paid-media-setup))?$`, "i");
    const campaignMatch = path.match(trialCampaignPath);
    if (campaignMatch?.[1]?.toLowerCase() === briefingCampaignId.toLowerCase() && method === "GET") return true;
    if (method === "POST" && path.toLowerCase() === `/campaigns/${briefingCampaignId.toLowerCase()}/social-diagnosis`) return true;
    if (method === "POST" && path.toLowerCase() === `/campaigns/${briefingCampaignId.toLowerCase()}/execute/strategy`) return true;
    if (method === "POST" && path.toLowerCase() === `/campaigns/${briefingCampaignId.toLowerCase()}/masterplan/materialize`) return true;
    if (method === "PUT" && path.toLowerCase() === `/campaigns/${briefingCampaignId.toLowerCase()}/masterplan/paid-media-setup`) return true;
    if (method === "PUT" && path.toLowerCase() === `/campaigns/${briefingCampaignId.toLowerCase()}/masterplan/reviews/approve-all`) return true;
    if (method === "PUT" && new RegExp(`^/campaigns/${briefingCampaignId}/masterplan/reviews/[A-Za-z][A-Za-z0-9]*$`, "i").test(path)) return true;
  }
  // The strategy page uses this read-only endpoint to label the downloadable
  // plan with the workspace identity.
  if (method === "GET" && path === "/workspaces/me") return true;
  // Read and prepare Meta ad settings locally; the trial cannot approve or
  // execute an ad plan.
  if (method === "GET" && ["/paid-media/accounts/meta_ads", "/paid-media/datasets"].includes(path)) return true;
  if (method === "POST" && path === "/paid-media/datasets") return true;

  if (briefingCampaignId) {
    const intakeAction = new RegExp(`^/intake/${briefingCampaignId}(?:/(?:questions|transcribe|extract|conversation|readiness|validate-revenue|recommend-track|simulate-budget|confirm-type))?$`, "i");
    if (intakeAction.test(path) && ["GET", "POST"].includes(method)) return true;
  }
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
    const trial = await getWorkspaceTrial(payload.workspaceId);
    if (!trial) { next(); return; }
    if (isTrialRouteAllowed(req.method.toUpperCase(), req.path, trial.briefingCampaignId)) { next(); return; }
    res.status(403).json({
      error: "O trial inclui um briefing e a análise de perfis públicos de redes sociais. Contrate um plano para liberar os demais recursos.",
      code: "TRIAL_SCOPE_RESTRICTED",
    });
  } catch (error) {
    next(error);
  }
}
