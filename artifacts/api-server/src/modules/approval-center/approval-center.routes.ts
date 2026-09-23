import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import { decideCampaignApproval, getCampaignApprovals } from "./approval-center.service.js";
import { scheduleApprovalSla } from "./approval-sla.service.js";
import { AppError } from "../../lib/errors.js";

const router = Router();
router.use(requireAuth);

export const approvalDecisionCommandSchema = z.object({
  decision: z.enum(["approved", "rejected", "revision_requested"]),
  expectedSnapshotHash: z.string().min(1),
  expectedVersion: z.number().int().positive().optional(),
  reason: z.string().max(4_000).optional(),
  idempotencyKey: z.string().min(1).max(255),
});

router.get("/:campaignId/control-room/approvals", async (req, res, next) => {
  try {
    const raw = req.query.limit;
    const limit = raw === undefined ? 25 : Number(raw);
    if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw new AppError(400, "limit must be an integer between 1 and 25", "VALIDATION_ERROR");
    res.json(await getCampaignApprovals(req.params["campaignId"] as string, req.auth.workspaceId, limit));
  } catch (error) { next(error); }
});

router.post("/:campaignId/control-room/approvals/:subjectType/:subjectId/decision", async (req, res, next) => {
  try {
    const parsed = approvalDecisionCommandSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.message, "VALIDATION_ERROR");
    const subject = z.enum(["masterplan", "content_piece", "checkpoint"]).safeParse(req.params["subjectType"]);
    if (!subject.success) throw new AppError(400, "Unsupported approval subject type", "VALIDATION_ERROR");
    const decision = await decideCampaignApproval(req.auth.workspaceId, req.params["campaignId"] as string, subject.data, req.params["subjectId"] as string, req.auth.userId, parsed.data);
    res.status(201).json({ decision });
  } catch (error) { next(error); }
});

router.post("/:campaignId/control-room/approvals/:subjectType/:subjectId/sla", async (req, res, next) => {
  try {
    const subject = z.enum(["masterplan", "content_piece", "checkpoint"]).safeParse(req.params["subjectType"]);
    if (!subject.success) throw new AppError(400, "Unsupported approval subject type", "VALIDATION_ERROR");
    const parsed = z.object({
      subjectSnapshotHash: z.string().min(1).max(128),
      dueAt: z.string().datetime(),
      warningAt: z.string().datetime().optional(),
      escalationAt: z.string().datetime(),
      expiresAt: z.string().datetime(),
      channel: z.literal("in_app").optional(),
      idempotencyKey: z.string().min(1).max(255),
    }).safeParse(req.body);
    if (!parsed.success) throw new AppError(400, parsed.error.message, "VALIDATION_ERROR");
    const obligation = await scheduleApprovalSla(req.auth.workspaceId, req.params["campaignId"] as string, req.auth.userId, {
      ...parsed.data, subjectType: subject.data, subjectId: req.params["subjectId"] as string,
    });
    res.status(201).json({ obligation });
  } catch (error) { next(error); }
});

export default router;