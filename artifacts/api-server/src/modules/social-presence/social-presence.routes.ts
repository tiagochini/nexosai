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
  publishBio,
  getMetricsOverview,
  findActiveLaunchContext,
  findCampaignContextById,
  listWorkspaceCampaigns,
  currentPlanWeekStart,
  generatePostStoryboard,
  redirectToPresenceMedia,
  streamPresenceMediaByToken,
  approveStoryboardGenerateVideo,
  approveStoryboardAsImage,
  pollPostMediaJob,
  attachUploadedMedia,
  confirmVideoAttachment,
  uploadTestMedia,
} from "./social-presence.service.js";

const router = Router();

// ─── Rotas públicas (sem auth) — serving de mídia para publicação nas redes ──
// Registradas ANTES do requireAuth para Instagram/TikTok poderem baixar a mídia.

// Ponto de entrada: valida ownership + emite redirect 302 para URL com TTL 30 min.
router.get("/media/serve", async (req, res): Promise<void> => {
  const key = (req.query as { key?: string }).key ?? "";
  await redirectToPresenceMedia(key, res);
});

// Stream endpoint: só chamado via redirect de /media/serve; valida o JWT curto.
router.get("/media/stream", async (req, res): Promise<void> => {
  const tok = (req.query as { tok?: string }).tok ?? "";
  await streamPresenceMediaByToken(tok, res);
});

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

// ─── Media Production Pipeline ───────────────────────────────────────────────

// POST /api/presence/posts/:id/media/generate-storyboard
// Salva eventuais edições de direção/roteiro e inicia geração do storyboard.
router.post("/posts/:id/media/generate-storyboard", async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  const schema = z.object({
    visualDirection: z.string().max(2000).optional(),
    videoScript: z.string().max(4000).nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  // Salvar edições se fornecidas
  if (parsed.success && (parsed.data.visualDirection !== undefined || parsed.data.videoScript !== undefined)) {
    await updatePost(req.auth.workspaceId, id, {
      visualDirection: parsed.data.visualDirection,
      videoScript: parsed.data.videoScript,
    }).catch(() => {});
  }
  const post = await generatePostStoryboard(req.auth.workspaceId, id, req.log);
  if (!post) { res.status(404).json({ error: "Post não encontrado." }); return; }
  res.status(202).json({ post });
});

// POST /api/presence/posts/:id/media/approve-image — aprova storyboard como imagem final (feed_image / feed_carousel)
router.post("/posts/:id/media/approve-image", async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  try {
    const post = await approveStoryboardAsImage(req.auth.workspaceId, id, req.log);
    if (!post) { res.status(404).json({ error: "Post não encontrado." }); return; }
    res.json({ post });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao aprovar imagem.";
    res.status(409).json({ error: msg });
  }
});

// POST /api/presence/posts/:id/media/generate-video — inicia geração do vídeo após aprovar storyboard
router.post("/posts/:id/media/generate-video", async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  try {
    const post = await approveStoryboardGenerateVideo(req.auth.workspaceId, id, req.log);
    if (!post) { res.status(404).json({ error: "Post não encontrado." }); return; }
    res.status(202).json({ post });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao iniciar geração de vídeo.";
    res.status(409).json({ error: msg });
  }
});

// GET /api/presence/posts/:id/media/poll — verifica status do job de vídeo
router.get("/posts/:id/media/poll", async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  const post = await pollPostMediaJob(req.auth.workspaceId, id, req.log);
  if (!post) { res.status(404).json({ error: "Post não encontrado." }); return; }
  res.json({ post });
});

// POST /api/presence/posts/:id/media/confirm-video — confirma o vídeo gerado e limpa estado temporário
router.post("/posts/:id/media/confirm-video", async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  try {
    const post = await confirmVideoAttachment(req.auth.workspaceId, id);
    if (!post) { res.status(404).json({ error: "Post não encontrado." }); return; }
    res.json({ post });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao confirmar vídeo.";
    res.status(409).json({ error: msg });
  }
});

// POST /api/presence/posts/:id/media/upload — recebe arquivo binário e salva no GCS
// Client: fetch(url, { method: 'POST', body: file, headers: { 'Content-Type': file.type, 'X-Filename': file.name } })
router.post("/posts/:id/media/upload", async (req, res): Promise<void> => {
  const { id } = req.params as { id: string };
  const contentType = (req.headers["content-type"] ?? "application/octet-stream").split(";")[0].trim();
  const filename = (req.headers["x-filename"] as string | undefined) ?? `upload.${contentType.split("/")[1] ?? "bin"}`;

  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  await new Promise<void>((resolve, reject) => {
    req.on("end", resolve);
    req.on("error", reject);
  });
  const buffer = Buffer.concat(chunks);

  if (buffer.length === 0) {
    res.status(400).json({ error: "Arquivo vazio." });
    return;
  }
  if (buffer.length > 200 * 1024 * 1024) { // 200 MB máx
    res.status(413).json({ error: "Arquivo muito grande (máx 200 MB)." });
    return;
  }

  try {
    const post = await attachUploadedMedia(req.auth.workspaceId, id, buffer, contentType, filename, req.log);
    if (!post) { res.status(404).json({ error: "Post não encontrado." }); return; }
    res.json({ post });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao fazer upload.";
    res.status(500).json({ error: msg });
  }
});

// ─── Test post ────────────────────────────────────────────────────────────────

// POST /api/presence/test-media-upload — upload temporário para usar no post de teste
// (sem vínculo a post; salvo em presence-media/test/{workspaceId}/)
router.post("/test-media-upload", async (req, res): Promise<void> => {
  const contentType = (req.headers["content-type"] ?? "application/octet-stream").split(";")[0].trim();
  const filename = (req.headers["x-filename"] as string | undefined) ?? `test.${contentType.split("/")[1] ?? "bin"}`;
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  await new Promise<void>((resolve, reject) => { req.on("end", resolve); req.on("error", reject); });
  const buffer = Buffer.concat(chunks);
  if (buffer.length === 0) { res.status(400).json({ error: "Arquivo vazio." }); return; }
  if (buffer.length > 50 * 1024 * 1024) { res.status(413).json({ error: "Arquivo muito grande (máx 50 MB para teste)." }); return; }
  try {
    const url = await uploadTestMedia(req.auth.workspaceId, buffer, contentType, filename, req.log);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Erro ao fazer upload." });
  }
});

router.post("/test-post", async (req, res): Promise<void> => {
  const schema = z.object({
    platform: z.enum(["instagram", "facebook", "tiktok"]),
    imageUrl: z.string().url().optional(),
    caption: z.string().max(2200).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Plataforma inválida. Use instagram, facebook ou tiktok." });
    return;
  }
  const result = await publishTestPost(req.auth.workspaceId, parsed.data.platform, parsed.data.imageUrl, parsed.data.caption);
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

router.post("/bio/publish", async (req, res): Promise<void> => {
  try {
    const { platform, bio } = req.body as { platform: "instagram" | "facebook"; bio: string };
    if (!platform || !bio?.trim()) {
      res.status(400).json({ error: "platform e bio são obrigatórios." });
      return;
    }
    const result = await publishBio(req.auth.workspaceId, platform, bio.trim(), req.log);
    if (!result.success) {
      res.status(422).json({ error: result.error });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao publicar bio.";
    res.status(500).json({ error: msg });
  }
});

// ─── Métricas ─────────────────────────────────────────────────────────────────

router.get("/metrics", async (req, res): Promise<void> => {
  const overview = await getMetricsOverview(req.auth.workspaceId, req.log);
  res.json(overview);
});

export default router;
