import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { AppError } from "../../lib/errors.js";
import {
  createVideoProject,
  listVideoProjects,
  getVideoProject,
  generateScript,
  approveScript,
  generateStoryboard,
  approveStoryboard,
  generatePreviewClips,
  approvePreview,
  generateFinalClips,
  pollClipJobs,
  getVideoProviderStatus,
} from "./video-production.service.js";
import type { VideoScene } from "@workspace/db";

const router = Router();

router.use(requireAuth);

// ─── Provider status ─────────────────────────────────────────────────────────
router.get("/video-projects/provider-status", (_req, res) => {
  res.json(getVideoProviderStatus());
});

// ─── List ────────────────────────────────────────────────────────────────────
router.get("/video-projects", async (req, res, next) => {
  try {
    const projects = await listVideoProjects(
      req.auth.workspaceId,
      req.query["campaignId"] as string | undefined,
    );
    res.json({ projects });
  } catch (err) {
    next(err);
  }
});

// ─── Create ──────────────────────────────────────────────────────────────────
router.post("/video-projects", async (req, res, next) => {
  try {
    const { title, format, campaignId, vslId, config } = req.body as {
      title: string;
      format?: string;
      campaignId?: string;
      vslId?: string;
      config?: Record<string, unknown>;
    };
    if (!title) throw new AppError(400, "title é obrigatório", "VALIDATION_ERROR");
    const project = await createVideoProject(req.auth.workspaceId, {
      title,
      format: (format ?? "vsl") as any,
      campaignId,
      vslId,
      config: config ?? {},
    });
    res.status(201).json({ project });
  } catch (err) {
    next(err);
  }
});

// ─── Get ─────────────────────────────────────────────────────────────────────
router.get("/video-projects/:id", async (req, res, next) => {
  try {
    const project = await getVideoProject(req.auth.workspaceId, req.params["id"]!);
    res.json({ project });
  } catch (err) {
    next(err);
  }
});

// ─── Poll clip jobs ──────────────────────────────────────────────────────────
router.post("/video-projects/:id/poll", async (req, res, next) => {
  try {
    const project = await pollClipJobs(req.auth.workspaceId, req.params["id"]!);
    res.json({ project });
  } catch (err) {
    next(err);
  }
});

// ─── Step 1: Generate Script ─────────────────────────────────────────────────
router.post("/video-projects/:id/generate-script", async (req, res, next) => {
  try {
    const project = await generateScript(req.auth.workspaceId, req.params["id"]!, req.log);
    res.json({ project });
  } catch (err) {
    next(err);
  }
});

// ─── Step 2: Approve Script ──────────────────────────────────────────────────
router.post("/video-projects/:id/approve-script", async (req, res, next) => {
  try {
    const project = await approveScript(
      req.auth.workspaceId,
      req.params["id"]!,
      (req.body as any)["script"] as string | undefined,
    );
    res.json({ project });
  } catch (err) {
    next(err);
  }
});

// ─── Step 3: Generate Storyboard ────────────────────────────────────────────
router.post("/video-projects/:id/generate-storyboard", async (req, res, next) => {
  try {
    const project = await generateStoryboard(req.auth.workspaceId, req.params["id"]!, req.log);
    res.json({ project });
  } catch (err) {
    next(err);
  }
});

// ─── Step 4: Approve Storyboard ─────────────────────────────────────────────
router.post("/video-projects/:id/approve-storyboard", async (req, res, next) => {
  try {
    const scenes = (req.body as any)["scenes"] as VideoScene[] | undefined;
    const project = await approveStoryboard(req.auth.workspaceId, req.params["id"]!, scenes);
    res.json({ project });
  } catch (err) {
    next(err);
  }
});

// ─── Step 5: Generate Preview ────────────────────────────────────────────────
router.post("/video-projects/:id/generate-preview", async (req, res, next) => {
  try {
    const project = await generatePreviewClips(req.auth.workspaceId, req.params["id"]!, req.log);
    res.json({ project });
  } catch (err) {
    next(err);
  }
});

// ─── Step 6: Approve Preview ─────────────────────────────────────────────────
router.post("/video-projects/:id/approve-preview", async (req, res, next) => {
  try {
    const adjustments = (req.body as any)["sceneAdjustments"] as Partial<VideoScene>[] | undefined;
    const project = await approvePreview(req.auth.workspaceId, req.params["id"]!, adjustments);
    res.json({ project });
  } catch (err) {
    next(err);
  }
});

// ─── Step 7: Generate Final HD ──────────────────────────────────────────────
router.post("/video-projects/:id/generate-final", async (req, res, next) => {
  try {
    const project = await generateFinalClips(req.auth.workspaceId, req.params["id"]!, req.log);
    res.json({ project });
  } catch (err) {
    next(err);
  }
});

export default router;
