import { Router, type Response } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import { AppError } from "../../lib/errors.js";
import { approveMasterplan, getCurrentMasterplan, listMasterplanVersions, materializeMasterplan } from "./masterplan.service.js";

const router = Router();
router.use(requireAuth);
const materializeSchema = z.object({ requestApproval: z.boolean().optional().default(false) });
const approveSchema = z.object({ version: z.number().int().positive() });

function handle(err: unknown, res: Response): void {
  if (err instanceof AppError) res.status(err.statusCode).json({ error: err.message, code: err.code, data: err.data });
  else throw err;
}
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
router.post("/:campaignId/masterplan/materialize", async (req, res) => {
  const parsed = materializeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" }); return; }
  try {
    const masterplan = await materializeMasterplan(req.auth.workspaceId, req.params["campaignId"] as string, req.auth.userId, parsed.data.requestApproval);
    res.status(201).json({ masterplan });
  } catch (err) { handle(err, res); }
});
router.post("/:campaignId/masterplan/approve", async (req, res) => {
  const parsed = approveSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" }); return; }
  try { res.json({ masterplan: await approveMasterplan(req.auth.workspaceId, req.params["campaignId"] as string, parsed.data.version, req.auth.userId) }); }
  catch (err) { handle(err, res); }
});
export default router;