import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import { approveProductIntake, getProductIntake, listProductIntakeVersions, previewProductIntakeImpact, startProductIntake, updateProductIntake } from "./product-intake.service.js";
import { AppError } from "../../lib/errors.js";

const router = Router();
router.use(requireAuth);
const entryPoint = z.enum(["launch", "market_intel", "social_media", "paid_media"]);
router.post("/start", async (req, res) => {
  const p = z.object({ commercialProductId: z.string().uuid(), entryPoint, sourceCampaignId: z.string().uuid().optional() }).safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.message, code: "VALIDATION_ERROR" }); return; }
  try { res.json(await startProductIntake(req.auth.workspaceId, p.data.commercialProductId, p.data.entryPoint, req.auth.userId, p.data.sourceCampaignId, req.log)); }
  catch (e) { const err = e instanceof AppError ? e : new AppError(500, "Unable to start intake", "INTAKE_ERROR"); res.status(err.statusCode).json({ error: err.message, code: err.code }); }
});
router.get("/:productId", async (req, res) => {
  try { res.json(await getProductIntake(req.auth.workspaceId, req.params.productId)); } catch (e) { const err = e as AppError; res.status(err.statusCode ?? 500).json({ error: err.message, code: err.code }); }
});
router.get("/:productId/versions", async (req, res) => { try { res.json({ versions: await listProductIntakeVersions(req.auth.workspaceId, req.params.productId) }); } catch (e) { const err = e as AppError; res.status(err.statusCode ?? 500).json({ error: err.message, code: err.code }); } });
router.patch("/:intakeId", async (req, res) => {
  const p = z.object({ snapshot: z.record(z.string(), z.unknown()) }).safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.message, code: "VALIDATION_ERROR" }); return; }
  try { res.json(await updateProductIntake(req.auth.workspaceId, req.params.intakeId, p.data.snapshot, req.auth.userId, req.log)); } catch (e) { const err = e as AppError; res.status(err.statusCode ?? 500).json({ error: err.message, code: err.code }); }
});
router.post("/:intakeId/approve", async (req, res) => { try { res.json(await approveProductIntake(req.auth.workspaceId, req.params.intakeId, req.auth.userId)); } catch (e) { const err = e as AppError; res.status(err.statusCode ?? 500).json({ error: err.message, code: err.code }); } });
router.get("/:intakeId/impact-preview", async (req, res) => { try { res.json(await previewProductIntakeImpact(req.auth.workspaceId, req.params.intakeId)); } catch (e) { const err = e as AppError; res.status(err.statusCode ?? 500).json({ error: err.message, code: err.code }); } });
export default router;