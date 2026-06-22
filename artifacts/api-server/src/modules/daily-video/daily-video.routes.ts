import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import { generateDailyVideo } from "./daily-video.service.js";
import { AppError } from "../../lib/errors.js";

const router = Router();
router.use(requireAuth);

const generateSchema = z.object({
  topic: z.string().min(3).max(300),
  format: z.enum(["reels", "tiktok", "shorts", "stories", "youtube", "long_form"]),
  style: z.enum(["clone", "no_face"]),
  tone: z.string().max(100).optional(),
  campaignContext: z.string().max(500).optional(),
  targetAudience: z.string().max(300).optional(),
  productName: z.string().max(200).optional(),
  goal: z.enum(["awareness", "engagement", "sales", "lead_capture"]).optional(),
});

// POST /api/daily-video/generate
router.post("/generate", async (req, res): Promise<void> => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { workspaceId } = req.auth!;

  try {
    const script = await generateDailyVideo(workspaceId, parsed.data, req.log);
    res.status(201).json({ script });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    req.log.error({ err }, "Daily video generation failed");
    res.status(500).json({ error: "Erro ao gerar roteiro de vídeo." });
  }
});

export default router;
