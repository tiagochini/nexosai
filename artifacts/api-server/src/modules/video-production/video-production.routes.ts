import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { AppError } from "../../lib/errors.js";
import { z } from "zod/v4";
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
  generateFilmingBrief,
  presentVideoProject,
} from "./video-production.service.js";
import type { VideoScene } from "@workspace/db";
import { createGCSObjectStream, getGCSObjectMeta } from "../../lib/gcs-recordings.js";

const router = Router();

router.use(requireAuth);

// Serve generated clips from controlled storage after validating project/workspace ownership.
router.get("/video-projects/:id/media/:sceneId/:variant", async (req, res, next): Promise<void> => {
  try {
    const variant = z.enum(["preview", "final"]).parse(req.params["variant"]);
    const project = await getVideoProject(req.auth.workspaceId, req.params["id"]!);
    const scene = (project.storyboard as VideoScene[]).find((item) => item.id === req.params["sceneId"]);
    const key = variant === "final" ? scene?.clipUrlHd : scene?.clipUrl;
    const allowedKey = key?.startsWith(`video-projects/${req.auth.workspaceId}/${project.id}/`)
      || (project.campaignId && key?.startsWith(`campaigns/${req.auth.workspaceId}/${project.campaignId}/video-projects/${project.id}/`))
      || key?.startsWith(`native-media/${req.auth.workspaceId}/${project.id}/`);
    if (!key || !allowedKey) { res.status(404).json({ error: "Vídeo não encontrado" }); return; }

    const metadata = await getGCSObjectMeta(key);
    if (!metadata.contentType.startsWith("video/")) { res.status(404).json({ error: "Vídeo não encontrado" }); return; }
    const rangeHeader = req.header("range");
    let start: number | undefined;
    let end: number | undefined;
    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
      if (!match || (!match[1] && !match[2])) {
        res.status(416).setHeader("Content-Range", `bytes */${metadata.size}`).end();
        return;
      }
      if (!match[1]) {
        const suffixLength = Number(match[2]);
        if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) { res.status(416).setHeader("Content-Range", `bytes */${metadata.size}`).end(); return; }
        start = Math.max(0, metadata.size - suffixLength);
        end = metadata.size - 1;
      } else {
        start = Number(match[1]);
        end = match[2] ? Number(match[2]) : metadata.size - 1;
      }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start! < 0 || end! < start! || start! >= metadata.size) {
        res.status(416).setHeader("Content-Range", `bytes */${metadata.size}`).end();
        return;
      }
      end = Math.min(end!, metadata.size - 1);
    }
    res.setHeader("Content-Type", metadata.contentType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (start !== undefined && end !== undefined) {
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${metadata.size}`);
      res.setHeader("Content-Length", String(end - start + 1));
      createGCSObjectStream(key, { start, end }).on("error", () => res.destroy()).pipe(res);
      return;
    }
    res.setHeader("Content-Length", String(metadata.size));
    createGCSObjectStream(key).on("error", () => res.destroy()).pipe(res);
  } catch (error) { next(error); }
});

const withMediaUrls = (project: Awaited<ReturnType<typeof getVideoProject>>) => presentVideoProject(project);

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
    res.json({ projects: projects.map(presentVideoProject) });
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
    res.status(201).json({ project: withMediaUrls(project) });
  } catch (err) {
    next(err);
  }
});

// ─── Get ─────────────────────────────────────────────────────────────────────
router.get("/video-projects/:id", async (req, res, next) => {
  try {
    const project = await getVideoProject(req.auth.workspaceId, req.params["id"]!);
    res.json({ project: withMediaUrls(project) });
  } catch (err) {
    next(err);
  }
});

// ─── Poll clip jobs ──────────────────────────────────────────────────────────
router.post("/video-projects/:id/poll", async (req, res, next) => {
  try {
    const project = await pollClipJobs(req.auth.workspaceId, req.params["id"]!);
    res.json({ project: withMediaUrls(project) });
  } catch (err) {
    next(err);
  }
});

// ─── Step 1: Generate Script ─────────────────────────────────────────────────
router.post("/video-projects/:id/generate-script", async (req, res, next) => {
  try {
    const project = await generateScript(req.auth.workspaceId, req.params["id"]!, req.log);
    res.json({ project: withMediaUrls(project) });
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
    res.json({ project: withMediaUrls(project) });
  } catch (err) {
    next(err);
  }
});

// ─── Step 3: Generate Storyboard ────────────────────────────────────────────
router.post("/video-projects/:id/generate-storyboard", async (req, res, next) => {
  try {
    const project = await generateStoryboard(req.auth.workspaceId, req.params["id"]!, req.log);
    res.json({ project: withMediaUrls(project) });
  } catch (err) {
    next(err);
  }
});

// ─── Step 4: Approve Storyboard ─────────────────────────────────────────────
router.post("/video-projects/:id/approve-storyboard", async (req, res, next) => {
  try {
    const scenes = (req.body as any)["scenes"] as VideoScene[] | undefined;
    const project = await approveStoryboard(req.auth.workspaceId, req.params["id"]!, scenes);
    res.json({ project: withMediaUrls(project) });
  } catch (err) {
    next(err);
  }
});

// ─── Step 5: Generate Preview ────────────────────────────────────────────────
router.post("/video-projects/:id/generate-preview", async (req, res, next) => {
  try {
    const project = await generatePreviewClips(req.auth.workspaceId, req.params["id"]!, req.log);
    res.json({ project: withMediaUrls(project) });
  } catch (err) {
    next(err);
  }
});

// ─── Step 6: Approve Preview ─────────────────────────────────────────────────
router.post("/video-projects/:id/approve-preview", async (req, res, next) => {
  try {
    const adjustments = (req.body as any)["sceneAdjustments"] as Partial<VideoScene>[] | undefined;
    const project = await approvePreview(req.auth.workspaceId, req.params["id"]!, adjustments);
    res.json({ project: withMediaUrls(project) });
  } catch (err) {
    next(err);
  }
});

// ─── Step 7: Generate Final HD ──────────────────────────────────────────────
router.post("/video-projects/:id/generate-final", async (req, res, next) => {
  try {
    const project = await generateFinalClips(req.auth.workspaceId, req.params["id"]!, req.log);
    res.json({ project: withMediaUrls(project) });
  } catch (err) {
    next(err);
  }
});

// ─── ATLAS Filming Brief — on-set direction for this video ───────────────────
router.post("/video-projects/:id/filming-brief", async (req, res, next) => {
  try {
    const project = await generateFilmingBrief(req.auth.workspaceId, req.params["id"]!, req.log);
    res.json({ project: withMediaUrls(project) });
  } catch (err) {
    next(err);
  }
});

export default router;
