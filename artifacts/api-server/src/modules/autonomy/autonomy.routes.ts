import { Router, type Request } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import { acceptContract, createMandatoryPause, getAutonomyStatus, listAutonomyEvidence, listMandatoryPauses, MANDATORY_PAUSE_ACTIONS, MANDATORY_PAUSE_CHANNELS, MANDATORY_PAUSE_CLASSES, resolveMandatoryPause, revokeAcceptance } from "./autonomy.service.js";
import { AppError } from "../../lib/errors.js";

const router = Router();
router.use(requireAuth);
const querySchema = z.object({ campaignId: z.string().uuid().optional() });
const acceptSchema = z.object({ campaignId: z.string().uuid().optional(), acceptanceTypes: z.array(z.enum(["autonomy", "regulated_activity", "asset_rights"])).min(1), idempotencyKey: z.string().min(8).max(200) });
const revokeSchema = z.object({ reason: z.string().max(1000).optional() });
const paramSchema = z.object({ acceptanceId: z.string().uuid() });
const pauseParamSchema = z.object({ pauseId: z.string().uuid() });
const pausesQuerySchema = z.object({ campaignId: z.string().uuid().optional(), activeOnly: z.enum(["true", "false"]).optional() });
const pauseSchema = z.object({
  campaignId: z.string().uuid().optional(), channel: z.enum(MANDATORY_PAUSE_CHANNELS).optional(),
  action: z.enum(MANDATORY_PAUSE_ACTIONS).optional(), pauseClass: z.enum(MANDATORY_PAUSE_CLASSES),
  severity: z.string().trim().min(1).max(32), reason: z.string().trim().min(1).max(2000),
  evidenceSummary: z.string().trim().min(1).max(2000).refine((v) => !/(data:|-----begin|access[_ -]?token|api[_ -]?key|password)/i.test(v), "Evidence summary must not contain secrets or raw assets."),
  idempotencyKey: z.string().min(8).max(200),
});
const resolvePauseSchema = z.object({ reason: z.string().trim().min(1).max(2000) });
function clientIp(req: Request): string | undefined { return req.ip || undefined; }

router.get("/status", async (req, res): Promise<void> => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" }); return; }
  try { res.json(await getAutonomyStatus(req.auth.workspaceId, parsed.data.campaignId)); } catch (err) { if (err instanceof AppError) { res.status(err.statusCode).json({ error: err.message, code: err.code }); return; } throw err; }
});
router.post("/acceptances", async (req, res): Promise<void> => {
  const parsed = acceptSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" }); return; }
  try { res.status(201).json(await acceptContract(req.auth.workspaceId, req.auth.userId, { ...parsed.data, ipAddress: clientIp(req), userAgent: req.get("user-agent") || undefined })); } catch (err) { if (err instanceof AppError) { res.status(err.statusCode).json({ error: err.message, code: err.code }); return; } throw err; }
});
router.post("/acceptances/:acceptanceId/revoke", async (req, res): Promise<void> => {
  const params = paramSchema.safeParse(req.params); const body = revokeSchema.safeParse(req.body);
  if (!params.success) { res.status(400).json({ error: params.error.message, code: "VALIDATION_ERROR" }); return; }
  if (!body.success) { res.status(400).json({ error: body.error.message, code: "VALIDATION_ERROR" }); return; }
  try { res.json({ acceptance: await revokeAcceptance(req.auth.workspaceId, req.auth.userId, params.data.acceptanceId, body.data.reason) }); } catch (err) { if (err instanceof AppError) { res.status(err.statusCode).json({ error: err.message, code: err.code }); return; } throw err; }
});
router.get("/evidence", async (req, res): Promise<void> => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" }); return; }
  try { res.json({ acceptances: await listAutonomyEvidence(req.auth.workspaceId, parsed.data.campaignId) }); } catch (err) { if (err instanceof AppError) { res.status(err.statusCode).json({ error: err.message, code: err.code }); return; } throw err; }
});
router.get("/pauses", async (req, res): Promise<void> => {
  const parsed = pausesQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" }); return; }
  try { res.json({ pauses: await listMandatoryPauses(req.auth.workspaceId, parsed.data.activeOnly === "true", parsed.data.campaignId) }); } catch (err) { if (err instanceof AppError) { res.status(err.statusCode).json({ error: err.message, code: err.code, data: err.data }); return; } throw err; }
});
router.post("/pauses", async (req, res): Promise<void> => {
  const parsed = pauseSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" }); return; }
  try { res.status(201).json({ pause: await createMandatoryPause(req.auth.workspaceId, req.auth.userId, parsed.data) }); } catch (err) { if (err instanceof AppError) { res.status(err.statusCode).json({ error: err.message, code: err.code, data: err.data }); return; } throw err; }
});
router.post("/pauses/:pauseId/resolve", async (req, res): Promise<void> => {
  const params = pauseParamSchema.safeParse(req.params); const body = resolvePauseSchema.safeParse(req.body);
  if (!params.success) { res.status(400).json({ error: params.error.message, code: "VALIDATION_ERROR" }); return; }
  if (!body.success) { res.status(400).json({ error: body.error.message, code: "VALIDATION_ERROR" }); return; }
  try { res.json({ pause: await resolveMandatoryPause(req.auth.workspaceId, req.auth.userId, params.data.pauseId, body.data.reason) }); } catch (err) { if (err instanceof AppError) { res.status(err.statusCode).json({ error: err.message, code: err.code, data: err.data }); return; } throw err; }
});
export default router;