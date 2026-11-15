import { Router, type Response } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import { isTrialBriefingCampaign } from "../credits/credits.service.js";
import { AppError } from "../../lib/errors.js";
import { approveMasterplan, getCurrentMasterplan, listMasterplanVersions, materializeMasterplan, repairMasterplanTriggerMap } from "./masterplan.service.js";
import { adoptCampaignBriefingToProduct, getCampaignBriefingAdoptionOptions } from "../product-intake/product-intake.service.js";

import { getPaidMediaSetup, savePaidMediaSetup } from "../paid-media/paid-media-setup.service.js";

const router = Router();
router.use(requireAuth);
const materializeSchema = z.object({ requestApproval: z.boolean().optional().default(false) });
const approveSchema = z.object({ version: z.number().int().positive() });
const adoptBriefingSchema = z.object({ subscriptionId: z.string().uuid() });

function handle(err: unknown, res: Response): void {
  if (err instanceof AppError) res.status(err.statusCode).json({ error: err.message, code: err.code, data: err.data });
  else throw err;
}
router.get("/:campaignId/masterplan/paid-media-setup", async (req, res) => {
  try { res.json(await getPaidMediaSetup(req.auth.workspaceId, req.params["campaignId"] as string)); } catch (err) { handle(err, res); }
});
router.put("/:campaignId/masterplan/paid-media-setup", async (req, res) => {
  try { res.json(await savePaidMediaSetup(req.auth.workspaceId, req.params["campaignId"] as string, req.auth.userId, req.body)); } catch (err) { handle(err, res); }
});
router.get("/:campaignId/masterplan/current", async (req, res) => {
  try {
    const masterplan = await getCurrentMasterplan(req.auth.workspaceId, req.params["campaignId"] as string);
    res.json({ masterplan: masterplan ?? null });
  } catch (err) { handle(err, res); }
});
router.get("/:campaignId/masterplan/versions", async (req, res) => {
  try { res.json({ versions: await listMasterplanVersions(req.auth.workspaceId, req.params["campaignId"] as string) }); }
  catch (err) { handle(err, res); }
});
router.get("/:campaignId/masterplan/briefing-adoption-options", async (req, res) => {
  try { res.json(await getCampaignBriefingAdoptionOptions(req.auth.workspaceId, req.params["campaignId"] as string)); }
  catch (err) { handle(err, res); }
});
router.post("/:campaignId/masterplan/adopt-briefing", async (req, res) => {
  const parsed = adoptBriefingSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" }); return; }
  try {
    res.json(await adoptCampaignBriefingToProduct(req.auth.workspaceId, req.params["campaignId"] as string, parsed.data.subscriptionId, req.auth.userId));
  } catch (err) { handle(err, res); }
});
router.post("/:campaignId/masterplan/materialize", async (req, res) => {
  const parsed = materializeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" }); return; }
  if (parsed.data.requestApproval && await isTrialBriefingCampaign(req.auth.workspaceId, req.params["campaignId"] as string)) {
    res.status(403).json({ error: "Solicitar aprovação oficial do Master Plan exige uma licença NexOS ativa.", code: "TRIAL_MASTERPLAN_APPROVAL_BLOCKED" });
    return;
  }
  try {
    const masterplan = await materializeMasterplan(req.auth.workspaceId, req.params["campaignId"] as string, req.auth.userId, parsed.data.requestApproval);
    res.status(201).json({ masterplan });
  } catch (err) { handle(err, res); }
});
const repairMasterplan = async (req: any, res: Response) => {
  try {
    const result = await repairMasterplanTriggerMap(req.auth.workspaceId, req.params["campaignId"] as string, req.auth.userId, req.log);
    res.json(result);
  } catch (err) { handle(err, res); }
};
router.post("/:campaignId/masterplan/repair-sections", repairMasterplan);
// Backwards-compatible alias for clients deployed before the repair covered M08-M09.
router.post("/:campaignId/masterplan/repair-trigger-map", repairMasterplan);
router.post("/:campaignId/masterplan/approve", async (req, res) => {
  if (await isTrialBriefingCampaign(req.auth.workspaceId, req.params["campaignId"] as string)) {
    res.status(403).json({ error: "A aprovação oficial e a geração de conteúdo exigem uma licença NexOS ativa.", code: "TRIAL_MASTERPLAN_APPROVAL_BLOCKED" });
    return;
  }
  const parsed = approveSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" }); return; }
  try { res.json({ masterplan: await approveMasterplan(req.auth.workspaceId, req.params["campaignId"] as string, parsed.data.version, req.auth.userId) }); }
  catch (err) { handle(err, res); }
});
export default router;
