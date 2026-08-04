import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  getConfig,
  upsertConfig,
  startGenerateWeek,
  isGeneratingWeek,
  listPosts,
  approvePost,
  updatePost,
  publishPostNow,
  publishTestPost,
  optimizeBio,
  getMetricsOverview,
  findActiveLaunchContext,
  findCampaignContextById,
  listWorkspaceCampaigns,
  currentPlanWeekStart,
} from "./social-presence.service.js";

const router = Router();
router.use(requireAuth);

const platformConfigSchema = z.object({
  platform: z.enum(["instagram", "facebook", "tiktok", "linkedin"]),
  enabled: z.boolean(),
  postsPerDay: z.number().int().min(1).max(5),
  autoPublish: z.boolean(),
  preferredTimes: z.array(z.string().regex(/^\d{2}:\d{2}$/)).max(5),
});

const configSchema = z.object({
  active: z.boolean().optional(),
  platforms: z.array(platformConfigSchema).max(4).optional(),
  contentPillars: z.array(z.string().min(1).max(120)).max(8).optional(),
  tone: z.string().max(300).optional(),
  businessContext: z.string().max(4000).optional(),
  alignedCampaignId: z.string().uuid().nullable().optional(),
});

const postPatchSchema = z.object({
  caption: z.string().max(4000).optional(),
  hashtags: z.array(z.string().max(80)).max(30).optional(),
  visualDirection: z.string().max(2000).optional(),
  videoScript: z.string().max(4000).nullable().optional(),
  mediaUrls: z.array(z.string().url()).max(10).optional(),
  postingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  scheduledFor: z.string().optional(),
  status: z.enum(["cancelled", "published", "draft"]).optional(),
});

// ─── Config ───────────────────────────────────────────────────────────────────

router.get("/config", async (req, res): Promise<void> => {
  const config = await getConfig(req.auth.workspaceId);

  // Resolve aligned campaign:
  // 1. If user explicitly chose a campaign → use it (even if not active)
  // 2. Otherwise → fall back to auto-detecting the active launch
  let alignedCampaign: { campaignId: string; title: string; status: string } | null = null;
  if (config?.alignedCampaignId) {
    const ctx = await findCampaignContextById(req.auth.workspaceId, config.alignedCampaignId).catch(() => null);
    if (ctx) {
      alignedCampaign = { campaignId: ctx.campaignId, title: ctx.context.campaignTitle, status: ctx.context.campaignStatus };
    }
  } else {
    const launch = await findActiveLaunchContext(req.auth.workspaceId).catch(() => null);
    if (launch) {
      alignedCampaign = { campaignId: launch.campaignId, title: launch.context.campaignTitle, status: launch.context.campaignStatus };
    }
  }

  res.json({
    config,
    generating: isGeneratingWeek(req.auth.workspaceId),
    currentWeekStart: currentPlanWeekStart().toISOString(),
    // activeLaunch kept for backwards compat — now carries the user-chosen or auto-detected campaign
    activeLaunch: alignedCampaign,
  });
});

router.put("/config", async (req, res): Promise<void> => {
  let parsed;
  try {
    parsed = configSchema.parse(req.body);
  } catch {
    res.status(400).json({ error: "Configuração inválida. Verifique plataformas, frequência e horários." });
    return;
  }
  const config = await upsertConfig(req.auth.workspaceId, parsed);
  res.json({ config });
});

// ─── Geração semanal ─────────────────────────────────────────────────────────

router.post("/generate-week", async (req, res): Promise<void> => {
  const force = Boolean((req.body as { force?: boolean })?.force);
  try {
    const result = await startGenerateWeek(req.auth.workspaceId, req.log, { force });
    if (!result.started) {
      res.status(409).json({ error: result.reason, weekStart: result.weekStart });
      return;
    }
    res.status(202).json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar plano semanal.";
    res.status(400).json({ error: msg });
  }
});

// ─── Posts ────────────────────────────────────────────────────────────────────

const listPostsQuerySchema = z.object({
  platform: z.enum(["instagram", "facebook", "tiktok", "linkedin"]).optional(),
  status: z
    .enum(["draft", "scheduled", "publishing", "published", "failed", "cancelled"])
    .optional(),
  weekStart: z.string().optional(),
});

router.get("/posts", async (req, res): Promise<void> => {
  const parsed = listPostsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Filtros inválidos. Verifique plataforma e status." });
    return;
  }
  const { platform, status, weekStart } = parsed.data;
  const posts = await listPosts(req.auth.workspaceId, { platform, status, weekStart });
  res.json({ posts, generating: isGeneratingWeek(req.auth.workspaceId) });
});

router.post("/posts/:id/approve", async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  try {
    const post = await approvePost(req.auth.workspaceId, id);
    if (!post) {
      res.status(404).json({ error: "Post não encontrado." });
      return;
    }
    res.json({ post });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao aprovar post.";
    res.status(409).json({ error: msg });
  }
});

router.post("/posts/:id/publish-now", async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  try {
    const post = await publishPostNow(req.auth.workspaceId, id);
    if (!post) {
      res.status(404).json({ error: "Post não encontrado." });
      return;
    }
    res.status(202).json({ post });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao publicar post.";
    res.status(409).json({ error: msg });
  }
});

router.patch("/posts/:id", async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  let parsed;
  try {
    parsed = postPatchSchema.parse(req.body);
  } catch {
    res.status(400).json({ error: "Dados inválidos." });
    return;
  }
  try {
    const post = await updatePost(req.auth.workspaceId, id, parsed);
    if (!post) {
      res.status(404).json({ error: "Post não encontrado." });
      return;
    }
    res.json({ post });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao editar post.";
    res.status(409).json({ error: msg });
  }
});

// ─── Campaigns list (for alignment dropdown) ─────────────────────────────────

router.get("/campaigns", async (req, res): Promise<void> => {
  const campaigns = await listWorkspaceCampaigns(req.auth.workspaceId);
  res.json({ campaigns });
});

// ─── Test post ────────────────────────────────────────────────────────────────

router.post("/test-post", async (req, res): Promise<void> => {
  const schema = z.object({
    platform: z.enum(["instagram", "facebook", "tiktok"]),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Plataforma inválida. Use instagram, facebook ou tiktok." });
    return;
  }
  const result = await publishTestPost(req.auth.workspaceId, parsed.data.platform);
  res.status(result.success ? 200 : 422).json(result);
});

// ─── Bio Optimizer ────────────────────────────────────────────────────────────

router.post("/bio/optimize", async (req, res): Promise<void> => {
  try {
    const suggestions = await optimizeBio(req.auth.workspaceId, req.log);
    res.json({ suggestions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao otimizar bio.";
    res.status(400).json({ error: msg });
  }
});

// ─── Métricas ─────────────────────────────────────────────────────────────────

router.get("/metrics", async (req, res): Promise<void> => {
  const overview = await getMetricsOverview(req.auth.workspaceId, req.log);
  res.json(overview);
});

export default router;
