import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { createReport, getReport, inbox, isOwner, listReports } from "./m11-social-intelligence.service.js";

const router = Router();
router.use(requireAuth);
router.get("/inbox", async (req, res): Promise<void> => {
  try { res.json(await inbox(req.auth.workspaceId, req.query as Record<string, unknown>)); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Invalid request" }); }
});
router.get("/reports", async (req, res): Promise<void> => { res.json({ reports: await listReports(req.auth.workspaceId) }); });
router.get("/reports/:id", async (req, res): Promise<void> => {
  const report = await getReport(req.auth.workspaceId, req.params.id as string);
  if (!report) { res.status(404).json({ error: "Report not found" }); return; }
  res.json(report);
});
router.post("/reports", async (req, res): Promise<void> => {
  if (!(await isOwner(req.auth.workspaceId, req.auth.userId))) { res.status(403).json({ error: "Workspace owner required" }); return; }
  try { res.status(201).json(await createReport(req.auth.workspaceId, req.auth.userId, { ...(req.body ?? {}), ...req.query })); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Invalid request" }); }
});
export default router;