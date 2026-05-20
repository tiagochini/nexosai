import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  createPipeline,
  listPipelines,
  getFullPipeline,
  updatePipeline,
  advancePipeline,
} from "./pipeline.service.js";

const router = Router();

router.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["draft", "active", "paused", "completed"]).optional(),
});

router.get("/", async (req, res, next) => {
  try {
    const pipelines = await listPipelines(req.auth.workspaceId);
    res.json({ pipelines });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const input = createSchema.parse(req.body);
    const pipeline = await createPipeline(req.auth.workspaceId, input);
    res.status(201).json({ pipeline });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const data = await getFullPipeline(req.params.id, req.auth.workspaceId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const patch = updateSchema.parse(req.body);
    const pipeline = await updatePipeline(req.params.id, req.auth.workspaceId, patch);
    res.json({ pipeline });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/advance", async (req, res, next) => {
  try {
    await advancePipeline(req.params.id, req.auth.workspaceId, req.log);
    const data = await getFullPipeline(req.params.id, req.auth.workspaceId);
    res.json({ ok: true, ...data });
  } catch (err) {
    next(err);
  }
});

export default router;
