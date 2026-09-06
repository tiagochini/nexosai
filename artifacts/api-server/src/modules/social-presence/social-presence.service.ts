/**
 * Gestão de Presença Social Always-On
 * Módulo autônomo de presença nas redes — opera independente de lançamentos.
 * Semana de autoridade quando não há campanha ativa; semana de lançamento
 * (narrativa injetada via Campaign Brain) quando há campanha executing/live.
 */

import { eq, and, or, desc, gte, gt, lt, lte, inArray, isNull } from "drizzle-orm";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Redis from "ioredis";
import {
  db,
  socialPresenceConfigTable,
  socialPresencePostsTable,
  instagramDmSequencesTable,
  campaignsTable,
  workspaceIntegrationsTable,
  workspacesTable,
} from "@workspace/db";
import jwt from "jsonwebtoken";
import {
  uploadBufferToGCS,
  presenceMediaObjectKey,
  presenceStoryboardObjectKey,
  createGCSObjectStream,
  getGCSObjectMeta,
  getPresenceMediaSignedUrl,
} from "../../lib/gcs-recordings.js";
import {
  generateVideoClip,
  generateAvatarVideo,
  fetchRandomStockHeygenAvatar,
  pollVideoJob,
} from "../video-production/video-generation.service.js";
import { env } from "../../lib/env.js";
import { metaGraphFetch } from "../../lib/meta-graph.transport.js";
import type {
  SocialPresenceConfig,
  SocialPresencePost,
  PresencePlatformConfig,
  PresenceWeeklyInsight,
  PresenceBioSuggestion,
} from "@workspace/db";
import type { Logger } from "pino";
import { logger } from "../../lib/logger.js";
import { isOrganicSocialIntegration } from "../integrations/integration-purpose.js";
import { claimMetaWebhookEvent, recordMetaSendResult, recordMetaSendStarted } from "../social/meta-webhook-evidence.service.js";
import {
  runPresencePlannerAgent,
  runPresenceInsightAgent,
  runBioOptimizerAgent,
  type PresenceLaunchContext,
  type PresenceInsightOutput,
} from "../agents/presence-planner.agent.js";
import { getCampaignBrain } from "../campaign-brain/campaign-brain.service.js";
import { emitWorkspaceAlert } from "../realtime/realtime.service.js";
import { buildSocialMarketIntelContext } from "../market-intel/market-intel.service.js";
import {
  publishToInstagram,
  publishToFacebook,
  publishToTikTok,
  getInstagramMetrics,
  getTikTokMetrics,
} from "../social/social.publisher.js";
import { enforceNoMandatoryPause } from "../autonomy/autonomy.service.js";

// ─── [C0.9] CONTENCAO — Redis-based kill-switch ──────────────────────────────
// Flag persistida em Redis: nexos:flag:disable_video_generation
// Alterável em <1ms via SET sem redeploy. Fail-safe: qualquer falha suprime.
// Fallback secundário: env var DISABLE_SCHEDULED_VIDEO_GENERATION (também fail-safe).
// NUNCA libera por ausência de dado — ausência = suprimir.

let _flagRedisClient: Redis | null = null;

function getFlagRedisClient(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (!_flagRedisClient || _flagRedisClient.status === "end" || _flagRedisClient.status === "close") {
    _flagRedisClient = new Redis(env.REDIS_URL, {
      connectTimeout: 1000,
      commandTimeout: 1000,
      maxRetriesPerRequest: 0,
      enableReadyCheck: false,
      lazyConnect: false,
    });
    // Suppress unhandled error events — errors handled in shouldSuppressVideoGeneration catch
    _flagRedisClient.on("error", () => undefined);
  }
  return _flagRedisClient;
}

async function shouldSuppressVideoGeneration(log?: Logger): Promise<boolean> {
  // FAIL-SAFE: qualquer caminho de erro suprime — nunca libera por padrão.
  try {
    const client = getFlagRedisClient();
    if (client) {
      const val = await Promise.race([
        client.get("nexos:flag:disable_video_generation"),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("redis_flag_timeout")), 3000)),
      ]);
      if (val === "false") return false; // único caminho explícito de liberação via Redis
      if (val === "true") return true;   // supressão explícita via Redis
      // val === null (chave ausente) → cair para env var abaixo
    }
  } catch (err) {
    // Redis inacessível, timeout ou erro inesperado → FAIL-SAFE: suprimir
    if (log) {
      log.warn({ err }, "[CONTENCAO] falha ao ler flag Redis — suprimindo por segurança (fail-safe)");
    }
    return true;
  }
  // Fallback: env var — também fail-safe (qualquer valor que não seja "false" suprime)
  return process.env["DISABLE_SCHEDULED_VIDEO_GENERATION"] !== "false";
}

// Maximum number of times an operator may manually trigger "Publish Now" on a
// failed post before it is permanently locked. Shared between publishPostNow()
// and publishDuePresencePosts() so the threshold is always consistent.
const MANUAL_RETRY_LIMIT = 3;

// Presence platform → DB integration provider
const PLATFORM_TO_PROVIDER: Record<string, string> = {
  instagram: "instagram",
  facebook: "meta_ads",
  tiktok: "tiktok_ads",
  // linkedin: sem publicação automática — publicação manual pelo usuário
};

// Horários são interpretados como America/Sao_Paulo (UTC-3)
const BR_UTC_OFFSET_HOURS = 3;

// ─── Config ───────────────────────────────────────────────────────────────────

export async function getConfig(
  workspaceId: string,
): Promise<SocialPresenceConfig | null> {
  const [config] = await db
    .select()
    .from(socialPresenceConfigTable)
    .where(eq(socialPresenceConfigTable.workspaceId, workspaceId))
    .limit(1);
  return config ?? null;
}

export interface ConfigPatch {
  active?: boolean;
  platforms?: PresencePlatformConfig[];
  contentPillars?: string[];
  tone?: string;
  businessContext?: string;
  /** Explicitly chosen campaign to align presence content with. null = no alignment. */
  alignedCampaignId?: string | null;
}

export async function upsertConfig(
  workspaceId: string,
  patch: ConfigPatch,
): Promise<SocialPresenceConfig> {
  const existing = await getConfig(workspaceId);
  // Build the set object so we can explicitly set alignedCampaignId to null
  const setData: Record<string, unknown> = {};
  if (patch.active !== undefined) setData.active = patch.active;
  if (patch.platforms !== undefined) setData.platforms = patch.platforms;
  if (patch.contentPillars !== undefined) setData.contentPillars = patch.contentPillars;
  if (patch.tone !== undefined) setData.tone = patch.tone;
  if (patch.businessContext !== undefined) setData.businessContext = patch.businessContext;
  if ("alignedCampaignId" in patch) setData.alignedCampaignId = patch.alignedCampaignId ?? null;

  if (existing) {
    const [updated] = await db
      .update(socialPresenceConfigTable)
      .set(setData)
      .where(eq(socialPresenceConfigTable.workspaceId, workspaceId))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(socialPresenceConfigTable)
    .values({
      workspaceId,
      active: patch.active ?? true,
      platforms: patch.platforms ?? [],
      contentPillars: patch.contentPillars ?? [],
      tone: patch.tone ?? "",
      businessContext: patch.businessContext ?? "",
      alignedCampaignId: patch.alignedCampaignId ?? null,
    })
    .returning();
  return created;
}

// ─── Contexto do negócio ─────────────────────────────────────────────────────

async function buildBusinessContext(
  workspaceId: string,
  config: SocialPresenceConfig,
): Promise<string> {
  // O boot cleanup (index.ts) já limpa business_context NexOS do banco em produção.
  // Aqui: usa apenas se preenchido com conteúdo real do cliente.
  const rawCtx = config.businessContext?.trim() ?? "";
  if (rawCtx.length > 0) {
    return rawCtx;
  }
  // Fallback: intake da campanha mais recente do workspace
  const [campaign] = await db
    .select({
      title: campaignsTable.title,
      intakeData: campaignsTable.intakeData,
    })
    .from(campaignsTable)
    .where(eq(campaignsTable.workspaceId, workspaceId))
    .orderBy(desc(campaignsTable.createdAt))
    .limit(1);

  if (!campaign) return "";

  const intake = (campaign.intakeData ?? {}) as Record<string, unknown>;
  const lines: string[] = [`Produto/Campanha mais recente: ${campaign.title}`];
  const FIELDS = [
    "productName", "productDescription", "niche", "market", "targetAudience",
    "audienceDescription", "mainPromise", "transformation", "uniqueMechanism",
    "priceRange", "ticket", "positioning", "avatarProfile",
  ];
  for (const key of FIELDS) {
    const v = intake[key];
    if (typeof v === "string" && v.trim()) lines.push(`${key}: ${v.slice(0, 400)}`);
  }
  return lines.join("\n").slice(0, 4000);
}

// ─── Alinhamento com lançamento ──────────────────────────────────────────────

export async function findActiveLaunchContext(
  workspaceId: string,
): Promise<{ campaignId: string; context: PresenceLaunchContext } | null> {
  const [campaign] = await db
    .select({
      id: campaignsTable.id,
      title: campaignsTable.title,
      status: campaignsTable.status,
    })
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.workspaceId, workspaceId),
        inArray(campaignsTable.status, ["executing", "live"] as never[]),
      ),
    )
    .orderBy(desc(campaignsTable.updatedAt))
    .limit(1);

  if (!campaign) return null;

  const brain = await getCampaignBrain(campaign.id).catch(() => null);
  const narrative = brain?.narrative;

  return {
    campaignId: campaign.id,
    context: {
      campaignTitle: campaign.title,
      campaignStatus: campaign.status,
      centralNarrative: narrative?.centralNarrative || undefined,
      bigDomino: narrative?.bigDomino || undefined,
      forbiddenTopics: narrative?.forbiddenTopics?.length
        ? narrative.forbiddenTopics
        : undefined,
      launchPhaseHint:
        campaign.status === "live"
          ? "carrinho aberto — urgência permitida"
          : "aquecimento — antecipação e crença, sem venda direta",
    },
  };
}

// ─── Alinhamento por campanha explícita ──────────────────────────────────────

/**
 * Like findActiveLaunchContext but for a specific campaign chosen by the user.
 * Returns null if the campaign doesn't exist or isn't accessible to the workspace.
 */
export async function findCampaignContextById(
  workspaceId: string,
  campaignId: string,
): Promise<{ campaignId: string; context: PresenceLaunchContext } | null> {
  const [campaign] = await db
    .select({
      id: campaignsTable.id,
      title: campaignsTable.title,
      status: campaignsTable.status,
    })
    .from(campaignsTable)
    .where(
      and(
        eq(campaignsTable.id, campaignId),
        eq(campaignsTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!campaign) return null;

  const brain = await getCampaignBrain(campaign.id).catch(() => null);
  const narrative = brain?.narrative;

  return {
    campaignId: campaign.id,
    context: {
      campaignTitle: campaign.title,
      campaignStatus: campaign.status,
      centralNarrative: narrative?.centralNarrative || undefined,
      bigDomino: narrative?.bigDomino || undefined,
      forbiddenTopics: narrative?.forbiddenTopics?.length
        ? narrative.forbiddenTopics
        : undefined,
      launchPhaseHint:
        campaign.status === "live"
          ? "carrinho aberto — urgência permitida"
          : campaign.status === "executing"
          ? "aquecimento — antecipação e crença, sem venda direta"
          : "campanha em elaboração — conteúdo de autoridade e posicionamento",
    },
  };
}

// ─── Listar campanhas do workspace (para seletor no modal) ───────────────────

export async function listWorkspaceCampaigns(
  workspaceId: string,
): Promise<{ id: string; title: string; status: string }[]> {
  return db
    .select({
      id: campaignsTable.id,
      title: campaignsTable.title,
      status: campaignsTable.status,
    })
    .from(campaignsTable)
    .where(eq(campaignsTable.workspaceId, workspaceId))
    .orderBy(desc(campaignsTable.updatedAt))
    .limit(50);
}

// ─── Publicação de teste ──────────────────────────────────────────────────────

export async function publishTestPost(
  workspaceId: string,
  platform: "instagram" | "facebook" | "tiktok",
  imageUrl?: string,
  customCaption?: string,
): Promise<{ success: boolean; platformUrl?: string; platformPostId?: string; error?: string }> {
  const log = logger.child({ component: "presence-test-post", workspaceId, platform });
  await enforceNoMandatoryPause(workspaceId, { channel: platform, action: "social_publish" });

  const provider = PLATFORM_TO_PROVIDER[platform];
  if (!provider) {
    return { success: false, error: `Plataforma ${platform} não suporta publicação automática.` };
  }

  const integrations = await db
    .select()
    .from(workspaceIntegrationsTable)
    .where(
      and(
        eq(workspaceIntegrationsTable.workspaceId, workspaceId),
        eq(workspaceIntegrationsTable.provider, provider as never),
        eq(workspaceIntegrationsTable.status, "connected"),
      ),
    );
  const integration = integrations.find((row) =>
    isOrganicSocialIntegration(row.metadata as Record<string, unknown>),
  );

  if (!integration) {
    return {
      success: false,
      error: `Integração com ${platform} não conectada. Vá em /integracoes e conecte.`,
    };
  }

  const now = new Date();
  const ts = now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const caption = customCaption?.trim()
    ? customCaption.trim()
    : `🧪 Post de teste NexOS — ${ts}\n\nEste é um post automático para verificar a integração. Pode apagar após confirmar que está funcionando! ✅`;

  // Imagem de teste pública e estável — usada apenas quando nenhuma mídia foi enviada.
  // Instagram exige image_url acessível publicamente para o Container API.
  const TEST_IMAGE_URL =
    "https://images.pexels.com/photos/1181244/pexels-photo-1181244.jpeg?auto=compress&cs=tinysrgb&w=1080";

  const mockPost = {
    id: `test-${Date.now()}`,
    workspaceId,
    campaignId: null,
    contentPieceId: null,
    integrationId: integration.id,
    platform: (platform === "facebook" ? "facebook_page" : platform) as never,
    postType: "feed_image" as never,
    status: "publishing" as never,
    caption,
    hashtags: ["#NexOS", "#Teste"],
    mediaUrls: [imageUrl ?? TEST_IMAGE_URL],
    callToAction: null,
    linkUrl: null,
    scheduledAt: now,
    publishedAt: null,
    platformPostId: null,
    platformUrl: null,
    metrics: { likes: 0, comments: 0, shares: 0, views: 0, reach: 0, impressions: 0, clicks: 0 },
    retryCount: 0,
    errorMessage: null,
    aiGenerated: true,
    createdAt: now,
    updatedAt: now,
  };

  try {
    let result;
    if (platform === "instagram") {
      result = await publishToInstagram(mockPost as never, integration);
    } else if (platform === "facebook") {
      result = await publishToFacebook(mockPost as never, integration);
    } else {
      result = await publishToTikTok(mockPost as never, integration);
    }

    if (result.success) {
      log.info({ platformPostId: result.platformPostId }, "presence: test post published");
      return {
        success: true,
        platformUrl: result.platformUrl ?? undefined,
        platformPostId: result.platformPostId ?? undefined,
      };
    } else {
      log.warn({ error: result.error }, "presence: test post failed");
      return { success: false, error: result.error ?? "Erro desconhecido ao publicar." };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn({ err }, "presence: test post exception");
    return { success: false, error: msg };
  }
}

// ─── Semana de planejamento ──────────────────────────────────────────────────

/** Segunda-feira 00:00 UTC da semana corrente (ou próxima, se hoje é domingo). */
export function currentPlanWeekStart(now = new Date()): Date {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const day = d.getUTCDay(); // 0=domingo, 1=segunda…
  const diff = day === 0 ? 1 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function computeScheduledFor(
  weekStart: Date,
  dayIndex: number,
  postingTime: string,
): Date {
  const [hh, mm] = postingTime.split(":").map((n) => parseInt(n, 10));
  const d = new Date(weekStart);
  d.setUTCDate(d.getUTCDate() + dayIndex);
  d.setUTCHours((isNaN(hh) ? 9 : hh) + BR_UTC_OFFSET_HOURS, isNaN(mm) ? 0 : mm, 0, 0);
  return d;
}

// In-flight guard — evita gerações concorrentes por workspace
const generating = new Set<string>();

export function isGeneratingWeek(workspaceId: string): boolean {
  return generating.has(workspaceId);
}

export interface GenerateWeekResult {
  weekStart: string;
  started: boolean;
  reason?: string;
}

/**
 * Dispara a geração do plano semanal em background (setImmediate).
 * Retorna imediatamente; frontend faz polling em GET /posts.
 */
export async function startGenerateWeek(
  workspaceId: string,
  log: Logger,
  opts: { force?: boolean } = {},
): Promise<GenerateWeekResult> {
  const config = await getConfig(workspaceId);
  if (!config) {
    throw new Error("Configuração de presença não encontrada. Configure primeiro.");
  }
  if (!config.active) {
    throw new Error("Presença social está pausada. Ative a configuração primeiro.");
  }
  const enabled = (config.platforms ?? []).filter((p) => p.enabled);
  if (enabled.length === 0) {
    throw new Error("Nenhuma plataforma habilitada na configuração.");
  }

  const weekStart = currentPlanWeekStart();

  if (generating.has(workspaceId)) {
    return { weekStart: weekStart.toISOString(), started: false, reason: "Geração já em andamento." };
  }

  const existing = await db
    .select({ id: socialPresencePostsTable.id })
    .from(socialPresencePostsTable)
    .where(
      and(
        eq(socialPresencePostsTable.workspaceId, workspaceId),
        eq(socialPresencePostsTable.weekStart, weekStart),
      ),
    )
    .limit(1);

  if (existing.length > 0 && !opts.force) {
    return {
      weekStart: weekStart.toISOString(),
      started: false,
      reason: "Plano desta semana já foi gerado. Use force para regenerar os rascunhos.",
    };
  }

  generating.add(workspaceId);
  setImmediate(() => {
    generateWeekNow(workspaceId, config, weekStart, log, opts)
      .catch((err) => log.error({ err, workspaceId }, "presence.generateWeek: background error"))
      .finally(() => generating.delete(workspaceId));
  });

  return { weekStart: weekStart.toISOString(), started: true };
}

async function generateWeekNow(
  workspaceId: string,
  config: SocialPresenceConfig,
  weekStart: Date,
  log: Logger,
  opts: { force?: boolean },
): Promise<void> {
  const weekStartISO = weekStart.toISOString().slice(0, 10); // YYYY-MM-DD

  // ── [#44 fix] Claim this week in the DB as the VERY FIRST operation ───────────
  // lastWeekGeneratedAt is stamped before any AI agent runs (including the insight
  // agent below). This means a restart sees this timestamp (>= weekStart) and skips
  // re-generation even if the crash occurred after the insight credit deduction but
  // before the planner ran. The completion update at the end overwrites it with the
  // final timestamp; both values are >= weekStart so the guard in
  // generateWeekForAllActiveConfigs works either way.
  // force=true: re-stamps intentionally (user explicitly asked for regeneration).
  await db
    .update(socialPresenceConfigTable)
    .set({ lastWeekGeneratedAt: new Date() })
    .where(eq(socialPresenceConfigTable.workspaceId, workspaceId));

  // Regeneração: descarta apenas rascunhos da semana (mantém aprovados/publicados)
  if (opts.force) {
    await db
      .delete(socialPresencePostsTable)
      .where(
        and(
          eq(socialPresencePostsTable.workspaceId, workspaceId),
          eq(socialPresencePostsTable.weekStart, weekStart),
          eq(socialPresencePostsTable.status, "draft"),
        ),
      );
  }

  // Pre-load occupied slots (non-draft posts) to avoid duplicate inserts on force regen.
  // Key: `${platform}|${dayIndex}|${postingTime}`
  const occupiedRows = await db
    .select({
      platform: socialPresencePostsTable.platform,
      dayIndex: socialPresencePostsTable.dayIndex,
      postingTime: socialPresencePostsTable.postingTime,
    })
    .from(socialPresencePostsTable)
    .where(
      and(
        eq(socialPresencePostsTable.workspaceId, workspaceId),
        eq(socialPresencePostsTable.weekStart, weekStart),
      ),
    );
  const occupiedSlots = new Set(
    occupiedRows.map((r) => `${r.platform}|${r.dayIndex}|${r.postingTime}`),
  );

  // 1. Realinhamento semanal — analisa semana anterior (se houve posts publicados)
  // Idempotency key is stable across restarts: same workspace + same prev-week date.
  const prevWeekISO = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const insight = await maybeGenerateWeeklyInsight(workspaceId, weekStart, log, {
    idempotencyKeyOverride: `presence_insight:${workspaceId}:${prevWeekISO}`,
  });

  // 2. Alinhamento com lançamento ativo
  const launch = await findActiveLaunchContext(workspaceId);

  // 3. Semana 1 de segurança: sem auto-publish nos primeiros 7 dias da config
  const configAgeMs = Date.now() - new Date(config.createdAt).getTime();
  const firstWeekSafety = configAgeMs < 7 * 24 * 60 * 60 * 1000;

  const businessContext = await buildBusinessContext(workspaceId, config);

  // 4. Inteligência de mercado — busca relatório vinculado à campanha ativa ou
  //    o mais recente do workspace (cobre relatórios existentes antes da integração).
  //    Fallback silencioso: se não houver relatório, segue sem market intel.
  const marketIntelCtx = await buildSocialMarketIntelContext(
    workspaceId,
    launch?.campaignId ?? null,
  ).catch(() => null);
  const enrichedBusinessContext = marketIntelCtx
    ? `${businessContext}\n\n${marketIntelCtx}`
    : businessContext;

  const enabled = (config.platforms ?? []).filter((p) => p.enabled);

  // Load lifestyle preferences once for this workspace (shared across all platforms)
  const lifestylePersona = await getWorkspacePersona(workspaceId);
  const lifestylePreferences = lifestylePersona.lifestylePreferences ?? null;

  for (const platform of enabled) {
    try {
      // Stable idempotency key: workspace + week + platform — survives process restarts.
      // If the server crashes after this platform's credit deduction, a restart rebuilds
      // the same key and the C3 guard in agent.runner.ts blocks the duplicate charge.
      const plannerIdempotencyKey = `presence:${workspaceId}:${weekStartISO}:${platform.platform}`;
      const plan = await runPresencePlannerAgent(
        workspaceId,
        {
          platform: platform.platform,
          postsPerDay: Math.min(Math.max(platform.postsPerDay || 1, 1), 5),
          preferredTimes: platform.preferredTimes ?? [],
          contentPillars: config.contentPillars ?? [],
          tone: config.tone ?? "",
          businessContext: enrichedBusinessContext,
          weekStartISO,
          launchContext: launch?.context ?? null,
          insight,
          lifestylePreferences,
        },
        log,
        { idempotencyKeyOverride: plannerIdempotencyKey },
      );

      const autoSchedule = platform.autoPublish && !firstWeekSafety;

      for (const post of plan.posts) {
        const slotKey = `${platform.platform}|${post.dayIndex}|${post.postingTime}`;
        if (occupiedSlots.has(slotKey)) {
          log.info(
            { workspaceId, platform: platform.platform, dayIndex: post.dayIndex, postingTime: post.postingTime },
            "presence.generateWeek: slot already occupied by non-draft post — skipping",
          );
          continue;
        }
        occupiedSlots.add(slotKey); // prevent intra-batch duplicates

        const scheduledFor = computeScheduledFor(weekStart, post.dayIndex, post.postingTime);
        await db.insert(socialPresencePostsTable).values({
          workspaceId,
          platform: platform.platform,
          status: autoSchedule ? "scheduled" : "draft",
          weekStart,
          dayIndex: post.dayIndex,
          postingTime: post.postingTime,
          scheduledFor,
          format: post.format,
          pillar: post.pillar,
          caption: post.caption,
          hashtags: post.hashtags,
          visualDirection: post.visualDirection,
          videoScript: post.videoScript ?? post.reelScript ?? null,
          objective: post.objective,
          launchAligned: Boolean(launch),
          campaignId: launch?.campaignId ?? null,
          launchPhase: post.launchPhase ?? null,
          highlightName: post.highlightName ?? null,
          dmResponseFlow: (post.dmResponseFlow as never) ?? null,
          aiGenerated: true,
        });
      }

      log.info(
        { workspaceId, platform: platform.platform, posts: plan.posts.length, weekType: plan.weekType },
        "presence.generateWeek: platform plan created",
      );
    } catch (err) {
      log.error(
        { err, workspaceId, platform: platform.platform },
        "presence.generateWeek: platform failed (continuing)",
      );
    }
  }

  // ── Salvar keywords de DM globais no workspace ────────────────────────────────
  // Qualquer post com dmResponseFlow.triggerKeyword é persistido em
  // workspace.settings.globalDmKeywords para que o trigger funcione
  // mesmo em posts antigos (que não têm dmResponseFlow no DB).
  try {
    // Re-collect dm flows from the posts we just inserted
    const newPosts = await db
      .select({ dmResponseFlow: socialPresencePostsTable.dmResponseFlow })
      .from(socialPresencePostsTable)
      .where(
        and(
          eq(socialPresencePostsTable.workspaceId, workspaceId),
          eq(socialPresencePostsTable.weekStart as any, weekStart),
        ),
      );
    const keywordMap = new Map<string, unknown>();
    for (const p of newPosts) {
      const flow = p.dmResponseFlow as { triggerKeyword?: string; steps?: unknown[] } | null;
      if (flow?.triggerKeyword && Array.isArray(flow.steps) && flow.steps.length > 0) {
        keywordMap.set(flow.triggerKeyword.toUpperCase(), flow);
      }
    }
    if (keywordMap.size > 0) {
      const [ws] = await db
        .select({ settings: workspacesTable.settings })
        .from(workspacesTable)
        .where(eq(workspacesTable.id, workspaceId))
        .limit(1);
      const existing = ((ws?.settings as Record<string, unknown> | null) ?? {});
      const existingKeywords = (
        existing.globalDmKeywords as Array<{
          keyword: string;
          flow: unknown;
          updatedAt?: string;
        }> | undefined
      ) ?? [];
      // Merge: manter keywords existentes, sobrescrever com as novas
      const mergedMap = new Map(existingKeywords.map((k) => [k.keyword, k]));
      for (const [kw, flow] of keywordMap.entries()) {
        mergedMap.set(kw, { keyword: kw, flow, updatedAt: new Date().toISOString() });
      }
      const globalDmKeywords = [...mergedMap.values()];
      await db
        .update(workspacesTable)
        .set({ settings: { ...existing, globalDmKeywords } as never })
        .where(eq(workspacesTable.id, workspaceId));
      log.info({ workspaceId, keywords: [...keywordMap.keys()] }, "presence.generateWeek: globalDmKeywords salvas no workspace");
    }
  } catch (dmSaveErr) {
    log.warn({ err: dmSaveErr }, "presence.generateWeek: falha ao salvar globalDmKeywords (não-fatal)");
  }

  await db
    .update(socialPresenceConfigTable)
    .set({ lastWeekGeneratedAt: new Date() })
    .where(eq(socialPresenceConfigTable.workspaceId, workspaceId));
}

// ─── Insight semanal (realinhamento) ─────────────────────────────────────────

async function maybeGenerateWeeklyInsight(
  workspaceId: string,
  weekStart: Date,
  log: Logger,
  opts?: { idempotencyKeyOverride?: string },
): Promise<PresenceInsightOutput | null> {
  try {
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7);

    const prevPosts = await db
      .select()
      .from(socialPresencePostsTable)
      .where(
        and(
          eq(socialPresencePostsTable.workspaceId, workspaceId),
          eq(socialPresencePostsTable.weekStart, prevWeekStart),
        ),
      );

    const published = prevPosts.filter((p) => p.status === "published");
    if (published.length === 0) return null;

    // Sincroniza métricas antes de analisar
    await syncMetricsForPosts(published, log).catch(() => {});

    const refreshed = await db
      .select()
      .from(socialPresencePostsTable)
      .where(
        and(
          eq(socialPresencePostsTable.workspaceId, workspaceId),
          eq(socialPresencePostsTable.weekStart, prevWeekStart),
          eq(socialPresencePostsTable.status, "published"),
        ),
      );

    const lines = refreshed.map((p) => {
      const m = p.metrics;
      return `- [${p.platform}/${p.format}] pilar "${p.pillar}" dia ${p.dayIndex}: alcance ${m.reach}, curtidas ${m.likes}, comentários ${m.comments}, compartilhamentos ${m.shares}, views ${m.views} | objetivo: ${p.objective}`;
    });
    const notPublished = prevPosts.length - refreshed.length;
    const summaryText = `**Posts publicados na semana anterior (${prevWeekStart.toISOString().slice(0, 10)}):**
${lines.join("\n")}
${notPublished > 0 ? `\n${notPublished} posts planejados não foram publicados (rascunho/cancelado/falha).` : ""}`;

    const insight = await runPresenceInsightAgent(workspaceId, summaryText, log, {
      idempotencyKeyOverride: opts?.idempotencyKeyOverride,
    });
    if (!insight.summary) return null;

    const weeklyInsight: PresenceWeeklyInsight = {
      weekStart: prevWeekStart.toISOString().slice(0, 10),
      summary: insight.summary,
      wins: insight.wins,
      losses: insight.losses,
      adjustments: insight.adjustments,
      winningFormats: insight.winningFormats,
      generatedAt: new Date().toISOString(),
    };

    await db
      .update(socialPresenceConfigTable)
      .set({ weeklyInsight })
      .where(eq(socialPresenceConfigTable.workspaceId, workspaceId));

    return insight;
  } catch (err) {
    log.warn({ err, workspaceId }, "presence.weeklyInsight: failed (non-fatal)");
    return null;
  }
}

// ─── Posts ────────────────────────────────────────────────────────────────────

export interface ListPostsFilters {
  platform?: string;
  status?: string;
  weekStart?: string; // ISO
}

export async function listPosts(
  workspaceId: string,
  filters: ListPostsFilters,
): Promise<SocialPresencePost[]> {
  const conds = [eq(socialPresencePostsTable.workspaceId, workspaceId)];
  if (filters.platform) {
    conds.push(eq(socialPresencePostsTable.platform, filters.platform as never));
  }
  if (filters.status) {
    conds.push(eq(socialPresencePostsTable.status, filters.status as never));
  }
  if (filters.weekStart) {
    const ws = new Date(filters.weekStart);
    if (!isNaN(ws.getTime())) {
      conds.push(eq(socialPresencePostsTable.weekStart, ws));
    }
  }
  return db
    .select()
    .from(socialPresencePostsTable)
    .where(and(...conds))
    .orderBy(socialPresencePostsTable.dayIndex, socialPresencePostsTable.scheduledFor)
    .limit(300);
}

export async function approvePost(
  workspaceId: string,
  postId: string,
  log: Logger,
): Promise<SocialPresencePost | null> {
  const [post] = await db
    .select()
    .from(socialPresencePostsTable)
    .where(
      and(
        eq(socialPresencePostsTable.id, postId),
        eq(socialPresencePostsTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!post) return null;
  if (post.status !== "draft") {
    throw new Error("Apenas rascunhos podem ser aprovados.");
  }

  // Se já tem storyboard gerado, roteia para o aprovador correto por formato
  const hasStoryboard = ["storyboard_ready", "storyboard_draft"].includes(post.mediaGenStatus ?? "");
  if (hasStoryboard) {
    const isVideoFormat =
      (post.format === "reel" || post.format === "feed_video" || post.format === "story") &&
      (post as Record<string, unknown>).storyMediaType !== "image";
    if (isVideoFormat) {
      // Dispara geração automática de vídeo com HeyGen (ou Runway fallback)
      return approveStoryboardGenerateVideo(workspaceId, postId, log);
    } else {
      // Imagem aprovada → vai direto para scheduled
      return approveStoryboardAsImage(workspaceId, postId, log);
    }
  }

  // Post sem storyboard (rascunho simples) → apenas agenda
  let scheduledFor = post.scheduledFor ?? new Date();
  if (scheduledFor.getTime() < Date.now()) {
    scheduledFor = new Date(Date.now() + 10 * 60 * 1000); // horário já passou → +10min
  }

  const [updated] = await db
    .update(socialPresencePostsTable)
    .set({ status: "scheduled", scheduledFor, errorMessage: null })
    .where(eq(socialPresencePostsTable.id, postId))
    .returning();
  return updated;
}

export interface PostPatch {
  caption?: string;
  hashtags?: string[];
  visualDirection?: string;
  videoScript?: string | null;
  mediaUrls?: string[];
  postingTime?: string;
  scheduledFor?: string;
  status?: "cancelled" | "published" | "draft";
  storyMediaType?: "image" | "video" | null;
}

export async function updatePost(
  workspaceId: string,
  postId: string,
  patch: PostPatch,
): Promise<SocialPresencePost | null> {
  const [post] = await db
    .select()
    .from(socialPresencePostsTable)
    .where(
      and(
        eq(socialPresencePostsTable.id, postId),
        eq(socialPresencePostsTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!post) return null;
  if (post.status === "published" || post.status === "publishing") {
    throw new Error("Posts publicados não podem ser editados.");
  }

  const set: Record<string, unknown> = {};
  if (patch.caption !== undefined) set.caption = patch.caption;
  if (patch.hashtags !== undefined) set.hashtags = patch.hashtags;
  if (patch.visualDirection !== undefined) set.visualDirection = patch.visualDirection;
  if (patch.videoScript !== undefined) set.videoScript = patch.videoScript;
  if (patch.mediaUrls !== undefined) set.mediaUrls = patch.mediaUrls;
  if (patch.postingTime !== undefined) {
    set.postingTime = patch.postingTime;
    set.scheduledFor = computeScheduledFor(
      new Date(post.weekStart),
      post.dayIndex,
      patch.postingTime,
    );
  }
  if (patch.scheduledFor !== undefined) {
    const d = new Date(patch.scheduledFor);
    if (!isNaN(d.getTime())) set.scheduledFor = d;
  }
  if (patch.status !== undefined) {
    if (patch.status === "cancelled") {
      set.status = "cancelled";
    } else if (patch.status === "draft") {
      // volta de scheduled para rascunho (despublicar da fila)
      set.status = "draft";
    } else if (patch.status === "published") {
      // marcação manual (ex.: LinkedIn ou publicação feita fora do NexOS)
      set.status = "published";
      set.publishedAt = new Date();
    }
  }
  if (patch.storyMediaType !== undefined) set.storyMediaType = patch.storyMediaType;

  if (Object.keys(set).length === 0) return post;

  const [updated] = await db
    .update(socialPresencePostsTable)
    .set(set)
    .where(eq(socialPresencePostsTable.id, postId))
    .returning();
  return updated;
}

// ─── Bio Publisher ────────────────────────────────────────────────────────────

export async function publishBio(
  workspaceId: string,
  platform: "instagram" | "facebook",
  bio: string,
  log: Logger,
): Promise<{ success: boolean; error?: string }> {
  const provider = PLATFORM_TO_PROVIDER[platform];
  if (!provider) {
    return { success: false, error: `Plataforma ${platform} não suporta publicação de bio.` };
  }

  const integrations = await db
    .select()
    .from(workspaceIntegrationsTable)
    .where(
      and(
        eq(workspaceIntegrationsTable.workspaceId, workspaceId),
        eq(workspaceIntegrationsTable.provider, provider as never),
        eq(workspaceIntegrationsTable.status, "connected"),
      ),
    );
  const integration = integrations.find((row) =>
    isOrganicSocialIntegration(row.metadata as Record<string, unknown>),
  );

  if (!integration?.accessToken || !integration?.accountId) {
    return {
      success: false,
      error: `Integração com ${platform} não conectada. Vá em /integracoes e conecte.`,
    };
  }

  const token = integration.accessToken;
  const accountId = integration.accountId;
  const GV = "v22.0";

  try {
    if (platform === "instagram") {
      // Instagram Graph API: update IG Business Account biography
      const url = `https://graph.facebook.com/${GV}/${accountId}`;
      const resp = await metaGraphFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ biography: bio, access_token: token }),
      });
      const data = (await resp.json()) as Record<string, unknown>;
      if (!resp.ok || data.error) {
        const msg = (data.error as Record<string, string>)?.message ?? JSON.stringify(data);
        log.error({ msg }, "presence: bio publish instagram error");
        return { success: false, error: `Instagram: ${msg}` };
      }
      log.info({ accountId }, "presence: bio published to instagram");
      return { success: true };
    }

    if (platform === "facebook") {
      // Facebook Graph API: update Page bio
      const url = `https://graph.facebook.com/${GV}/${accountId}`;
      const resp = await metaGraphFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio, access_token: token }),
      });
      const data = (await resp.json()) as Record<string, unknown>;
      if (!resp.ok || data.error) {
        const msg = (data.error as Record<string, string>)?.message ?? JSON.stringify(data);
        log.error({ msg }, "presence: bio publish facebook error");
        return { success: false, error: `Facebook: ${msg}` };
      }
      log.info({ accountId }, "presence: bio published to facebook");
      return { success: true };
    }

    return { success: false, error: "Plataforma não suportada." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ err: msg }, "presence: bio publish exception");
    return { success: false, error: msg };
  }
}

// ─── Bio Optimizer ────────────────────────────────────────────────────────────

export async function optimizeBio(
  workspaceId: string,
  log: Logger,
): Promise<PresenceBioSuggestion[]> {
  const config = await getConfig(workspaceId);
  if (!config) {
    throw new Error("Configuração de presença não encontrada. Configure primeiro.");
  }
  const enabled = (config.platforms ?? []).filter((p) => p.enabled);
  if (enabled.length === 0) {
    throw new Error("Nenhuma plataforma habilitada na configuração.");
  }

  const businessContext = await buildBusinessContext(workspaceId, config);
  const output = await runBioOptimizerAgent(
    workspaceId,
    {
      platforms: enabled.map((p) => p.platform),
      contentPillars: config.contentPillars ?? [],
      tone: config.tone ?? "",
      businessContext,
    },
    log,
  );

  const suggestions: PresenceBioSuggestion[] = output.suggestions.map((s) => ({
    platform: s.platform,
    bio: s.bio,
    highlights: s.highlights ?? [],
    keywords: s.keywords ?? [],
    generatedAt: new Date().toISOString(),
  }));

  if (suggestions.length > 0) {
    await db
      .update(socialPresenceConfigTable)
      .set({ bioSuggestions: suggestions })
      .where(eq(socialPresenceConfigTable.workspaceId, workspaceId));
  }

  return suggestions;
}

// ─── Métricas ─────────────────────────────────────────────────────────────────

async function syncMetricsForPosts(
  posts: SocialPresencePost[],
  log: Logger,
): Promise<void> {
  const candidates = posts.filter(
    (p) => p.status === "published" && p.platformPostId,
  );
  if (candidates.length === 0) return;

  const workspaceId = candidates[0].workspaceId;
  const integrations = (await db
    .select()
    .from(workspaceIntegrationsTable)
    .where(
      and(
        eq(workspaceIntegrationsTable.workspaceId, workspaceId),
        inArray(workspaceIntegrationsTable.provider, ["instagram", "meta_ads", "tiktok_ads"] as never[]),
        eq(workspaceIntegrationsTable.status, "connected"),
      ),
    )).filter((row) => isOrganicSocialIntegration(row.metadata as Record<string, unknown>));
  const byProvider = new Map(integrations.map((i) => [i.provider as string, i]));

  for (const post of candidates.slice(0, 20)) {
    try {
      const provider = PLATFORM_TO_PROVIDER[post.platform];
      const integration = provider ? byProvider.get(provider) : undefined;
      const token = integration?.accessToken;
      if (!token || !post.platformPostId) continue;

      const m =
        post.platform === "tiktok"
          ? await getTikTokMetrics(post.platformPostId, token)
          : await getInstagramMetrics(post.platformPostId, token);

      await db
        .update(socialPresencePostsTable)
        .set({
          metrics: {
            likes: m.likes,
            comments: m.comments,
            shares: m.shares,
            views: m.views,
            reach: m.reach,
            impressions: m.impressions,
          },
          metricsSyncedAt: new Date(),
        })
        .where(eq(socialPresencePostsTable.id, post.id));
    } catch (err) {
      log.warn({ err, postId: post.id }, "presence.syncMetrics: post failed (non-fatal)");
    }
  }
}

export interface PresenceMetricsOverview {
  totals: {
    published: number;
    scheduled: number;
    drafts: number;
    failed: number;
    reach: number;
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
  byPlatform: {
    platform: string;
    published: number;
    reach: number;
    likes: number;
    comments: number;
    engagementRate: number; // (likes+comments+shares) / reach
  }[];
  topPosts: SocialPresencePost[];
}

export async function getMetricsOverview(
  workspaceId: string,
  log: Logger,
): Promise<PresenceMetricsOverview> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const posts = await db
    .select()
    .from(socialPresencePostsTable)
    .where(
      and(
        eq(socialPresencePostsTable.workspaceId, workspaceId),
        gte(socialPresencePostsTable.createdAt, since),
      ),
    )
    .limit(500);

  // Lazy sync: posts publicados nos últimos 14 dias com métricas velhas (>6h)
  const staleCutoff = Date.now() - 6 * 60 * 60 * 1000;
  const fourteenDays = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const stale = posts.filter(
    (p) =>
      p.status === "published" &&
      p.platformPostId &&
      p.publishedAt &&
      new Date(p.publishedAt).getTime() > fourteenDays &&
      (!p.metricsSyncedAt || new Date(p.metricsSyncedAt).getTime() < staleCutoff),
  );
  if (stale.length > 0) {
    // fire-and-forget — próxima consulta verá métricas atualizadas
    setImmediate(() => {
      syncMetricsForPosts(stale, log).catch(() => {});
    });
  }

  const published = posts.filter((p) => p.status === "published");
  const totals = {
    published: published.length,
    scheduled: posts.filter((p) => p.status === "scheduled").length,
    drafts: posts.filter((p) => p.status === "draft").length,
    failed: posts.filter((p) => p.status === "failed").length,
    reach: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    views: 0,
  };

  const platMap = new Map<
    string,
    { published: number; reach: number; likes: number; comments: number; shares: number }
  >();

  for (const p of published) {
    const m = p.metrics;
    totals.reach += m.reach;
    totals.likes += m.likes;
    totals.comments += m.comments;
    totals.shares += m.shares;
    totals.views += m.views;
    const agg = platMap.get(p.platform) ?? {
      published: 0, reach: 0, likes: 0, comments: 0, shares: 0,
    };
    agg.published += 1;
    agg.reach += m.reach;
    agg.likes += m.likes;
    agg.comments += m.comments;
    agg.shares += m.shares;
    platMap.set(p.platform, agg);
  }

  const byPlatform = [...platMap.entries()].map(([platform, agg]) => ({
    platform,
    published: agg.published,
    reach: agg.reach,
    likes: agg.likes,
    comments: agg.comments,
    engagementRate:
      agg.reach > 0
        ? Math.round(((agg.likes + agg.comments + agg.shares) / agg.reach) * 1000) / 10
        : 0,
  }));

  const topPosts = [...published]
    .sort(
      (a, b) =>
        b.metrics.reach + b.metrics.likes * 3 - (a.metrics.reach + a.metrics.likes * 3),
    )
    .slice(0, 5);

  return { totals, byPlatform, topPosts };
}

// ─── Scheduler hooks (chamados pelo sequence-scheduler.worker) ───────────────

/**
 * Publica posts de presença agendados cujo horário chegou.
 * - linkedin: nunca auto-publica (marcação manual pelo usuário)
 * - instagram/tiktok sem mídia: aguarda (mantém scheduled com aviso)
 * - facebook: publica texto puro ou com mídia
 * Retry até 3× antes de marcar failed.
 */
// ─── Publish Now ─────────────────────────────────────────────────────────────
// Immediately triggers publication of a single post by setting scheduledFor=now
// and firing the scheduler. Works for draft OR scheduled posts.
export async function publishPostNow(
  workspaceId: string,
  postId: string,
): Promise<SocialPresencePost | null> {
  const log = logger.child({ component: "presence-publish-now", postId });

  const [post] = await db
    .select()
    .from(socialPresencePostsTable)
    .where(
      and(
        eq(socialPresencePostsTable.id, postId),
        eq(socialPresencePostsTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!post) return null;

  if (post.status === "published" || post.status === "cancelled") {
    throw new Error("Post já foi publicado ou cancelado.");
  }
  if (post.status === "publishing") {
    throw new Error("Post já está sendo publicado. Aguarde alguns instantes.");
  }

  const newManualRetryCount = (post.manualRetryCount ?? 0) + 1;

  // If the operator has already retried manually too many times, lock the post permanently.
  if (newManualRetryCount > MANUAL_RETRY_LIMIT) {
    const [locked] = await db
      .update(socialPresencePostsTable)
      .set({
        status: "failed",
        errorMessage: `Bloqueado após ${MANUAL_RETRY_LIMIT} retentativas manuais. Intervenção técnica necessária.`,
        manualRetryCount: newManualRetryCount,
      })
      .where(eq(socialPresencePostsTable.id, postId))
      .returning();

    emitWorkspaceAlert(
      workspaceId,
      "social_post_manual_retry_exhausted",
      `⚠️ Post de ${post.platform} falhou ${newManualRetryCount}× mesmo após retentativas manuais. Verifique a integração.`,
      {
        postId: post.id,
        platform: post.platform,
        manualRetryCount: newManualRetryCount,
        errorMessage: post.errorMessage,
      },
    );

    log.warn(
      { platform: post.platform, manualRetryCount: newManualRetryCount },
      "presence: publish-now blocked — manual retry limit exhausted",
    );

    return locked ?? null;
  }

  // Force scheduledFor to now so publishDuePresencePosts picks it up immediately.
  // Reset automatic retryCount so a manual retry always gets 3 full attempts — not residual count.
  const [updated] = await db
    .update(socialPresencePostsTable)
    .set({
      status: "scheduled",
      scheduledFor: new Date(),
      errorMessage: null,
      retryCount: 0,
      manualRetryCount: newManualRetryCount,
    })
    .where(eq(socialPresencePostsTable.id, postId))
    .returning();

  // Emit a warning alert when the operator is on their last allowed manual retry.
  if (newManualRetryCount === MANUAL_RETRY_LIMIT) {
    emitWorkspaceAlert(
      workspaceId,
      "social_post_manual_retry_warning",
      `⚠️ Post de ${post.platform} está na última retentativa manual permitida (${newManualRetryCount}/${MANUAL_RETRY_LIMIT}). Se falhar novamente, será bloqueado.`,
      {
        postId: post.id,
        platform: post.platform,
        manualRetryCount: newManualRetryCount,
      },
    );
  }

  log.info(
    { platform: post.platform, manualRetryCount: newManualRetryCount },
    "presence: publish-now triggered",
  );

  // Fire-and-forget: the scheduler runs and processes this (and any other due) post.
  setImmediate(() => publishDuePresencePosts().catch((err) => {
    log.warn({ err }, "presence: publish-now scheduler tick error");
  }));

  return updated;
}

export async function publishDuePresencePosts(): Promise<void> {
  const log = logger.child({ component: "presence-post-scheduler" });
  try {
    const now = new Date();

    // Recuperação 1: posts presos em "publishing" há mais de 10min voltam para "scheduled".
    const staleThreshold = new Date(now.getTime() - 10 * 60 * 1000);
    await db
      .update(socialPresencePostsTable)
      .set({ status: "scheduled" })
      .where(
        and(
          eq(socialPresencePostsTable.status, "publishing"),
          lte(socialPresencePostsTable.updatedAt, staleThreshold),
        ),
      )
      .catch(() => {});

    // Recuperação 2: posts presos em status="draft" com mediaGenStatus="failed" (storyboard falhou)
    // e que ainda têm menos de 5 tentativas → resetar para "scheduled" para nova geração.
    // Isso acontecia antes porque o handler de falha setava status="draft" em vez de "scheduled".
    await db
      .update(socialPresencePostsTable)
      .set({ status: "scheduled", mediaGenStatus: null, errorMessage: null })
      .where(
        and(
          eq(socialPresencePostsTable.status, "draft"),
          eq(socialPresencePostsTable.mediaGenStatus as any, "failed"),
          lte(socialPresencePostsTable.retryCount, 4),
          lte(socialPresencePostsTable.scheduledFor, new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)),
        ),
      )
      .catch(() => {});

    // ── Pré-agendamento: iniciar geração de vídeo 10 min antes do horário ──────
    // Reels/stories em "draft" com storyboard pronto que publicarão em até 10 min:
    // promover para "scheduled" mantendo storyboard_ready para que o bloco de vídeo
    // inicie a geração agora — dando tempo para o HeyGen renderizar antes da publicação.
    const PRE_SCHEDULE_WINDOW_MS = 10 * 60 * 1000;
    try {
      const preScheduleWindow = new Date(now.getTime() + PRE_SCHEDULE_WINDOW_MS);
      const preSchedulePosts = await db
        .select()
        .from(socialPresencePostsTable)
        .where(
          and(
            eq(socialPresencePostsTable.status, "draft"),
            inArray(socialPresencePostsTable.format as any, ["reel", "story", "feed_video"]),
            eq(socialPresencePostsTable.mediaGenStatus as any, "storyboard_ready"),
            lte(socialPresencePostsTable.scheduledFor, preScheduleWindow),
            gt(socialPresencePostsTable.scheduledFor, now), // ainda não vencido (recuperação 3 cuida dos vencidos)
          ),
        )
        .limit(10);
      for (const op of preSchedulePosts) {
        await db
          .update(socialPresencePostsTable)
          .set({ status: "scheduled", errorMessage: null })
          .where(eq(socialPresencePostsTable.id, op.id))
          .catch(() => {});
        log.info({ postId: op.id, format: op.format, scheduledFor: op.scheduledFor }, "presence: reel pré-agendado → promovido para scheduled 10min antes (auto video gen)");
        // Dispara geração imediata — o bloco storyboard_ready do loop seguinte cuidará
        // do polling, mas iniciar aqui adiantado garante que o vídeo esteja pronto no horário.
        setImmediate(() =>
          approveStoryboardGenerateVideo(op.workspaceId, op.id, log).catch((e) =>
            log.warn({ err: e, postId: op.id }, "presence: pre-schedule video gen error (non-fatal)"),
          ),
        );
      }
    } catch (preErr) {
      log.warn({ err: preErr }, "presence: pré-agendamento de vídeo falhou (não-fatal)");
    }

    // ── Recuperação 3: PUBLISH-NO-MATTER-WHAT ─────────────────────────────────
    // Posts em "draft" com scheduledFor vencido nunca devem ficar parados
    // aguardando aprovação do usuário. Promove para "scheduled".
    // Reels/stories: mantém storyboard_ready para que o bloco de vídeo gere com avatar stock.
    // Imagens/carrosséis: usa storyboard como imagem definitiva (sem atraso).
    try {
      const overdraftPosts = await db
        .select()
        .from(socialPresencePostsTable)
        .where(
          and(
            eq(socialPresencePostsTable.status, "draft"),
            lte(socialPresencePostsTable.scheduledFor, now),
          ),
        )
        .limit(10);
      for (const op of overdraftPosts) {
        // Aguardar se mídia ainda está sendo gerada neste ciclo
        if (op.mediaGenStatus === "storyboard_generating" || op.mediaGenStatus === "video_generating") continue;

        const isVideoFormat = ["reel", "story", "feed_video"].includes(op.format ?? "");
        const hasStoryboard =
          Array.isArray(op.storyboardUrls) && (op.storyboardUrls as string[]).length > 0;

        let patch: Record<string, unknown>;
        if (isVideoFormat && hasStoryboard && op.mediaGenStatus === "storyboard_ready") {
          // Reel com storyboard pronto → manter storyboard_ready para que o bloco de vídeo
          // inicie geração com avatar stock (não usar como imagem)
          patch = { status: "scheduled", errorMessage: null };
        } else if (!isVideoFormat && hasStoryboard) {
          // Imagem/carrossel com storyboard → usar como mídia definitiva (sem esperar vídeo)
          patch = { status: "scheduled", mediaUrls: op.storyboardUrls as string[], mediaGenStatus: null, errorMessage: null };
        } else {
          // Sem storyboard ainda → promover e deixar o scheduler gerar
          patch = { status: "scheduled", errorMessage: null };
        }

        await db
          .update(socialPresencePostsTable)
          .set(patch as any)
          .where(eq(socialPresencePostsTable.id, op.id))
          .catch(() => {});
        log.info(
          { postId: op.id, format: op.format, isVideoFormat, hadStoryboard: hasStoryboard },
          "presence: draft vencido → promovido para scheduled (publish-no-matter-what)",
        );
      }
    } catch (recErr) {
      log.warn({ err: recErr }, "presence: recuperação 3 (overdue drafts) falhou (não-fatal)");
    }

    const due = await db
      .select()
      .from(socialPresencePostsTable)
      .where(
        and(
          eq(socialPresencePostsTable.status, "scheduled"),
          lte(socialPresencePostsTable.scheduledFor, now),
        ),
      )
      .limit(25);

    if (due.length === 0) return;

    for (const post of due) {
      try {
        if (post.platform === "linkedin") {
          // Sem API de publicação orgânica — o usuário publica manualmente
          if (!post.errorMessage) {
            await db
              .update(socialPresencePostsTable)
              .set({
                errorMessage:
                  "LinkedIn: publicação automática indisponível — copie o conteúdo e publique manualmente, depois marque como publicado.",
              })
              .where(eq(socialPresencePostsTable.id, post.id));
          }
          continue;
        }

        const rawMediaUrls = Array.isArray(post.mediaUrls) ? (post.mediaUrls as string[]) : [];
        // Resolve internal serve URLs → fresh GCS signed URL so Instagram/TikTok
        // can fetch the file directly without following an internal redirect.
        const mediaUrls = await Promise.all(
          rawMediaUrls.map(async (url) => {
            const match = typeof url === "string" && url.match(/[?&]key=([^&]+)/);
            if (match) {
              const key = decodeURIComponent(match[1]);
              const signed = await getPresenceMediaSignedUrl(key, 3600).catch(() => null);
              return signed ?? url;
            }
            return url;
          }),
        );
        const needsMedia = post.platform === "instagram" || post.platform === "tiktok";
        // Stories can be image or video depending on storyMediaType chosen by the operator.
        // storyMediaType === "image" → treat as image (storyboard → approve); otherwise → video.
        const isStoryImage = post.format === "story" && (post as Record<string, unknown>).storyMediaType === "image";
        const isVideoFormat = (post.format === "reel" || post.format === "feed_video" || post.format === "story") && !isStoryImage;
        // Image formats are Instagram feed posts that don't need video (includes image-mode stories)
        const isImageFormat = (!isVideoFormat && post.platform === "instagram") || isStoryImage;
        if (needsMedia && mediaUrls.length === 0) {
          // ── Vídeo: gerenciar pipeline de storyboard → aprovação → vídeo ───────
          if (isVideoFormat) {
            const gs = post.mediaGenStatus;

            // Storyboard gerando — aguardar conclusão
            if (gs === "storyboard_generating") {
              continue;
            }

            // Vídeo em geração — polling automático no HeyGen a cada tick do scheduler
            if (gs === "video_generating") {
              const videoAgeMs = Date.now() - new Date(post.updatedAt ?? post.createdAt).getTime();
              const VIDEO_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutos

              if (post.mediaJobId) {
                // Timeout global: se o HeyGen não respondeu em 20 min, resetar para storyboard_ready
                if (videoAgeMs > VIDEO_TIMEOUT_MS) {
                  log.warn({ postId: post.id, videoAgeMs, mediaJobId: post.mediaJobId }, "presence: video_generating com jobId por >20min — resetando para storyboard_ready");
                  await db
                    .update(socialPresencePostsTable)
                    .set({ mediaGenStatus: "storyboard_ready", mediaJobId: null, mediaJobProvider: null, errorMessage: null })
                    .where(eq(socialPresencePostsTable.id, post.id));
                } else {
                  setImmediate(() =>
                    pollPostMediaJob(post.workspaceId, post.id, log).catch((e) =>
                      log.warn({ err: e, postId: post.id }, "presence: poll job error (non-fatal)"),
                    ),
                  );
                }
              } else {
                // Sem mediaJobId → submissão falhou silenciosamente
                // Resetar para storyboard_ready após 3 min para nova tentativa
                if (videoAgeMs > 3 * 60 * 1000) {
                  log.warn({ postId: post.id, videoAgeMs }, "presence: video_generating sem jobId há >3min — resetando para storyboard_ready");
                  await db
                    .update(socialPresencePostsTable)
                    .set({ mediaGenStatus: "storyboard_ready", errorMessage: null })
                    .where(eq(socialPresencePostsTable.id, post.id));
                }
              }
              continue;
            }

            // Storyboard IA pronto — gerar vídeo automaticamente se avatar configurado
            if (gs === "storyboard_ready") {
              const persona = await getWorkspacePersona(post.workspaceId);
              const effectiveVoiceId = persona.heygenVoiceId || persona.voiceCloneId;
              if (persona.heygenAvatarId && effectiveVoiceId) {
                // [C0.9 CONTENCAO] Trava de crédito HeyGen — suprime geração automática
                // pelo scheduler. Flag persistida em Redis (nexos:flag:disable_video_generation)
                // — alterável em <1ms sem redeploy. Fail-safe: ausência/erro → suprimir.
                // Fallback: env var DISABLE_SCHEDULED_VIDEO_GENERATION (também fail-safe).
                // O botão manual "Gerar vídeo" NÃO é afetado (passa por routes.ts → approveStoryboardGenerateVideo diretamente).
                // O continue abaixo também corrige o fall-through para linha ~1609 que
                // sobrescrevia mediaGenStatus antes do setImmediate disparar — causando
                // com_job_id=0 em produção (todos os 6 falhas anteriores têm essa causa).
                if (await shouldSuppressVideoGeneration(log)) {
                  log.info(
                    { "[CONTENCAO]": true, postId: post.id, workspaceId: post.workspaceId },
                    "[CONTENCAO] geração de vídeo agendada suprimida — post não publicado",
                  );
                  continue;
                }
                log.info({ postId: post.id, platform: post.platform }, "presence: storyboard pronto + avatar configurado → gerando vídeo automaticamente");
                setImmediate(() =>
                  approveStoryboardGenerateVideo(post.workspaceId, post.id, log).catch((e) =>
                    log.warn({ err: e, postId: post.id }, "presence: auto video gen error (non-fatal)"),
                  ),
                );
                continue; // evita fall-through para bloco de storyboard_generating abaixo
              } else {
                // Sem avatar → fallback: usar storyboard como imagem (publish-no-matter-what)
                const sbUrls =
                  Array.isArray(post.storyboardUrls) && (post.storyboardUrls as string[]).length > 0
                    ? (post.storyboardUrls as string[])
                    : null;
                if (sbUrls) {
                  log.info({ postId: post.id }, "presence: sem avatar → storyboard como imagem (publish-no-matter-what)");
                  await db
                    .update(socialPresencePostsTable)
                    .set({ mediaUrls: sbUrls, mediaGenStatus: null, errorMessage: null })
                    .where(eq(socialPresencePostsTable.id, post.id));
                  emitWorkspaceAlert(
                    post.workspaceId,
                    "presence_post_fallback_image",
                    `📸 Reel será publicado como imagem — avatar não configurado. Configure em Configurações → Persona para vídeos.`,
                    { postId: post.id, platform: post.platform, format: post.format, canEdit: true },
                  );
                } else if (!post.errorMessage?.includes("Configure um avatar")) {
                  await db
                    .update(socialPresencePostsTable)
                    .set({ errorMessage: "Configure um avatar em Configurações → Persona para gerar vídeos automaticamente." })
                    .where(eq(socialPresencePostsTable.id, post.id));
                }
                continue;
              }
            }

            // Rascunho SVG (storyboard_draft) — aguardar substituição ou geração IA
            if (gs === "storyboard_draft") {
              if (!post.errorMessage?.includes("Storyboard")) {
                await db
                  .update(socialPresencePostsTable)
                  .set({ errorMessage: "Storyboard em rascunho — abra o post para gerar com IA." })
                  .where(eq(socialPresencePostsTable.id, post.id));
              }
              continue;
            }

            // null / idle / failed → auto-gerar storyboard como referência visual
            log.info({ postId: post.id, platform: post.platform, format: post.format }, "presence: sem mídia — iniciando geração automática de storyboard para vídeo");
            await db
              .update(socialPresencePostsTable)
              .set({ status: "draft", mediaGenStatus: "storyboard_generating", errorMessage: null, storyboardUrls: [] })
              .where(eq(socialPresencePostsTable.id, post.id));
            const videoPostSnapshot = { ...post };
            setImmediate(() => {
              fetchBusinessContextForWorkspace(videoPostSnapshot.workspaceId).then(bctx =>
              generateStoryboardFrame(videoPostSnapshot.visualDirection, videoPostSnapshot.caption, videoPostSnapshot.platform, videoPostSnapshot.format, log, videoPostSnapshot.videoScript ?? videoPostSnapshot.reelScript, bctx))
                .then(async ({ buf, mimeType, isAI }) => {
                  const newStatus = isAI ? "storyboard_ready" : "storyboard_draft";
                  const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg").replace("svg+xml", "svg") ?? "png";
                  const key = presenceStoryboardObjectKey(videoPostSnapshot.workspaceId, videoPostSnapshot.id, 0).replace(/\.png$/, `.${ext}`);
                  await uploadBufferToGCS(buf, key, mimeType);
                  const serveUrl = `${env.APP_URL}/api/presence/media/serve?key=${encodeURIComponent(key)}`;
                  await db
                    .update(socialPresencePostsTable)
                    .set({ mediaGenStatus: newStatus, storyboardUrls: [serveUrl], errorMessage: "Storyboard pronto — abra o post e clique em 'Gerar Vídeo' para gerar o vídeo com IA." })
                    .where(eq(socialPresencePostsTable.id, videoPostSnapshot.id));
                  log.info({ postId: videoPostSnapshot.id, newStatus, key }, "presence: storyboard de vídeo auto-gerado ✓");
                })
                .catch(async (err) => {
                  log.warn({ err, postId: videoPostSnapshot.id }, "presence: auto-geração de storyboard de vídeo falhou");
                  const newRetryCount = (videoPostSnapshot.retryCount ?? 0) + 1;
                  const giveUp = newRetryCount >= 5;
                  await db
                    .update(socialPresencePostsTable)
                    .set({
                      mediaGenStatus: giveUp ? "failed" : null,
                      // Keep scheduled so the next tick retries — only give up after 5 attempts
                      status: giveUp ? "draft" : "scheduled",
                      retryCount: newRetryCount,
                      errorMessage: giveUp
                        ? `Geração de mídia falhou após ${newRetryCount} tentativas — adicione manualmente.`
                        : null,
                    })
                    .where(eq(socialPresencePostsTable.id, videoPostSnapshot.id));
                });
            });
            continue;
          }

          // ── Imagem: auto-gerar storyboard → aguardar aprovação ───────────────
          if (isImageFormat) {
            const gs = post.mediaGenStatus;
            // Já gerando — aguardar
            if (gs === "storyboard_generating") {
              continue;
            }
            // Gerado — auto-aprovar: usar storyboard como mídia definitiva (publish-no-matter-what)
            if (gs === "storyboard_ready" || gs === "storyboard_draft") {
              const sbUrls =
                Array.isArray(post.storyboardUrls) && (post.storyboardUrls as string[]).length > 0
                  ? (post.storyboardUrls as string[])
                  : null;
              if (sbUrls) {
                log.info({ postId: post.id }, "presence: storyboard pronto → auto-aprovado (publish-no-matter-what)");
                await db
                  .update(socialPresencePostsTable)
                  .set({ mediaUrls: sbUrls, mediaGenStatus: null, errorMessage: null })
                  .where(eq(socialPresencePostsTable.id, post.id));
                // Publicará no próximo tick com mediaUrls preenchido
              } else if (!post.errorMessage?.includes("Aprovação pendente")) {
                await db
                  .update(socialPresencePostsTable)
                  .set({ errorMessage: "Aprovação pendente — abra o post e aprove a imagem gerada pela IA para publicar." })
                  .where(eq(socialPresencePostsTable.id, post.id));
              }
              continue;
            }
            // null / idle / failed → auto-gerar agora
            log.info({ postId: post.id, platform: post.platform, format: post.format }, "presence: sem mídia — iniciando geração automática de imagem (draft p/ aprovação)");
            await db
              .update(socialPresencePostsTable)
              .set({ status: "draft", mediaGenStatus: "storyboard_generating", errorMessage: null, storyboardUrls: [] })
              .where(eq(socialPresencePostsTable.id, post.id));
            // Capturar variáveis locais para o closure
            const postSnapshot = { ...post };
            setImmediate(() => {
              fetchBusinessContextForWorkspace(postSnapshot.workspaceId).then(bctx =>
              generateStoryboardFrame(postSnapshot.visualDirection, postSnapshot.caption, postSnapshot.platform, postSnapshot.format, log, postSnapshot.videoScript ?? postSnapshot.reelScript, bctx))
                .then(async ({ buf, mimeType, isAI }) => {
                  const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg").replace("svg+xml", "svg") ?? "png";
                  const key = presenceStoryboardObjectKey(postSnapshot.workspaceId, postSnapshot.id, 0).replace(/\.png$/, `.${ext}`);
                  await uploadBufferToGCS(buf, key, mimeType);
                  const serveUrl = `${env.APP_URL}/api/presence/media/serve?key=${encodeURIComponent(key)}`;
                  if (isAI) {
                    // Storyboard IA real → aguarda aprovação do usuário (nunca auto-publica)
                    await db
                      .update(socialPresencePostsTable)
                      .set({ mediaGenStatus: "storyboard_ready", storyboardUrls: [serveUrl], errorMessage: null })
                      .where(eq(socialPresencePostsTable.id, postSnapshot.id));
                    log.info({ postId: postSnapshot.id, key }, "presence: storyboard IA gerado → aguardando aprovação do usuário ✓");
                  } else {
                    await db
                      .update(socialPresencePostsTable)
                      .set({ mediaGenStatus: "storyboard_draft", storyboardUrls: [serveUrl], errorMessage: "Rascunho SVG — abra para substituir por imagem real." })
                      .where(eq(socialPresencePostsTable.id, postSnapshot.id));
                    log.info({ postId: postSnapshot.id, key }, "presence: rascunho SVG criado — aguardando substituição manual");
                  }
                })
                .catch(async (err) => {
                  log.warn({ err, postId: postSnapshot.id }, "presence: auto-geração de imagem falhou");
                  const newRetryCount = (postSnapshot.retryCount ?? 0) + 1;
                  const giveUp = newRetryCount >= 5;
                  await db
                    .update(socialPresencePostsTable)
                    .set({
                      mediaGenStatus: giveUp ? "failed" : null,
                      status: giveUp ? "draft" : "scheduled",
                      retryCount: newRetryCount,
                      errorMessage: giveUp
                        ? `Geração de imagem falhou após ${newRetryCount} tentativas — adicione manualmente.`
                        : null,
                    })
                    .where(eq(socialPresencePostsTable.id, postSnapshot.id));
                });
            });
            continue;
          }

          // ── Fallback: plataformas que precisam de mídia manual ────────────────
          if (!post.errorMessage) {
            await db
              .update(socialPresencePostsTable)
              .set({
                errorMessage:
                  "Aguardando mídia — adicione uma imagem/vídeo ao post ou publique manualmente e marque como publicado.",
              })
              .where(eq(socialPresencePostsTable.id, post.id));
          }
          continue;
        }

        const provider = PLATFORM_TO_PROVIDER[post.platform];
        const integrations = await db
          .select()
          .from(workspaceIntegrationsTable)
          .where(
            and(
              eq(workspaceIntegrationsTable.workspaceId, post.workspaceId),
              eq(workspaceIntegrationsTable.provider, provider as never),
              eq(workspaceIntegrationsTable.status, "connected"),
            ),
          );
        const integration = integrations.find((row) =>
          isOrganicSocialIntegration(row.metadata as Record<string, unknown>),
        );

        if (!integration) {
          const retryCount = (post.retryCount ?? 0) + 1;
          const isPermanentlyFailed = retryCount >= 3;
          await db
            .update(socialPresencePostsTable)
            .set({
              status: isPermanentlyFailed ? "failed" : "scheduled",
              retryCount,
              errorMessage: `Integração ${post.platform} não conectada. Conecte em /integracoes.`,
            })
            .where(eq(socialPresencePostsTable.id, post.id));
          if (isPermanentlyFailed && (post.manualRetryCount ?? 0) >= MANUAL_RETRY_LIMIT) {
            emitWorkspaceAlert(
              post.workspaceId,
              "social_post_manual_retry_exhausted",
              `⚠️ Post de ${post.platform} falhou permanentemente — integração desconectada após ${post.manualRetryCount} retentativas manuais. Reconecte em /integracoes.`,
              { postId: post.id, platform: post.platform, manualRetryCount: post.manualRetryCount },
            );
          }
          continue;
        }
        // Must run immediately before the outbound adapter; a pause created after
        // scheduling still blocks the next external action.
        await enforceNoMandatoryPause(post.workspaceId, {
          campaignId: post.campaignId ?? undefined,
          channel: post.platform,
          action: "social_publish",
        });

        // Claim atômico (CAS) para evitar double-publish quando dois ticks se
        // sobrepõem — só avança se o post AINDA estiver "scheduled".
        const claimed = await db
          .update(socialPresencePostsTable)
          .set({ status: "publishing" })
          .where(
            and(
              eq(socialPresencePostsTable.id, post.id),
              eq(socialPresencePostsTable.status, "scheduled"),
            ),
          )
          .returning({ id: socialPresencePostsTable.id });
        if (claimed.length === 0) {
          // Outro tick já pegou este post
          continue;
        }

        const caption = post.caption;
        const hashtags = post.hashtags ?? [];
        const mockPost = {
          id: post.id,
          workspaceId: post.workspaceId,
          campaignId: post.campaignId,
          contentPieceId: null,
          integrationId: integration.id,
          platform: (post.platform === "facebook" ? "facebook_page" : post.platform) as never,
          postType: (() => {
            // Se o formato é vídeo mas a mídia real é imagem (fallback storyboard),
            // usar feed_image para evitar rejeição na API de Reels do Instagram.
            const hasVideoMedia = mediaUrls.some((u) => /\.(mp4|webm|mov)(\?|$)/i.test(u));
            if (post.format === "reel" && !hasVideoMedia) return "feed_image";
            if (post.format === "feed_video" && !hasVideoMedia) return "feed_image";
            if (post.format === "reel") return "reel";
            if (post.format === "story") return "story";
            if (post.format === "carousel") return "carousel";
            if (post.format === "feed_video") return "feed_video";
            return "feed_image";
          })() as never,
          status: "publishing" as never,
          caption,
          hashtags,
          mediaUrls,
          callToAction: null,
          linkUrl: null,
          scheduledAt: post.scheduledFor,
          publishedAt: null,
          platformPostId: null,
          platformUrl: null,
          metrics: { likes: 0, comments: 0, shares: 0, views: 0, reach: 0, impressions: 0, clicks: 0 },
          retryCount: post.retryCount,
          errorMessage: null,
          aiGenerated: true,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
        };

        let result;
        if (post.platform === "instagram") {
          result = await publishToInstagram(mockPost as never, integration);
        } else if (post.platform === "facebook") {
          result = await publishToFacebook(mockPost as never, integration);
        } else if (post.platform === "tiktok") {
          result = await publishToTikTok(mockPost as never, integration);
        } else {
          await db
            .update(socialPresencePostsTable)
            .set({ status: "failed", errorMessage: `Plataforma não suportada: ${post.platform}` })
            .where(eq(socialPresencePostsTable.id, post.id));
          continue;
        }

        if (result.success) {
          await db
            .update(socialPresencePostsTable)
            .set({
              status: "published",
              publishedAt: new Date(),
              platformPostId: result.platformPostId ?? null,
              platformUrl: result.platformUrl ?? null,
              errorMessage: null,
            })
            .where(eq(socialPresencePostsTable.id, post.id));
          log.info({ postId: post.id, platform: post.platform }, "presence: published");

          // Notifica o frontend em tempo real para mostrar push notification e atualizar UI
          emitWorkspaceAlert(
            post.workspaceId,
            "presence_post_published",
            `✅ Post publicado no ${post.platform === "instagram" ? "Instagram" : post.platform === "facebook" ? "Facebook" : post.platform === "tiktok" ? "TikTok" : post.platform}!`,
            {
              postId: post.id,
              platform: post.platform,
              format: post.format,
              platformPostId: result.platformPostId ?? null,
              platformUrl: result.platformUrl ?? null,
            },
          );

          // Auto-Highlight: se é story com highlightName e foi publicado no Instagram,
          // adiciona ao Destaque automaticamente (fire-and-forget).
          const postHighlight = (post as { highlightName?: string | null }).highlightName;
          if (post.platform === "instagram" && post.format === "story" && postHighlight && result.platformPostId && integration.accessToken && integration.accountId) {
            const safeIntegration = { accessToken: integration.accessToken, accountId: integration.accountId };
            setImmediate(() =>
              addStoryToHighlight(
                post.workspaceId,
                result.platformPostId!,
                postHighlight,
                safeIntegration,
                log,
              ).catch((err) => log.warn({ err, postId: post.id }, "presence: auto-highlight failed (non-fatal)"))
            );
          }
        } else {
          const retryCount = (post.retryCount ?? 0) + 1;
          const isPermanentlyFailed = retryCount >= 3;
          await db
            .update(socialPresencePostsTable)
            .set({
              status: isPermanentlyFailed ? "failed" : "scheduled",
              retryCount,
              errorMessage: result.error ?? "Erro desconhecido",
            })
            .where(eq(socialPresencePostsTable.id, post.id));
          log.warn(
            { postId: post.id, platform: post.platform, error: result.error, retryCount },
            "presence: publish failed",
          );

          // If this post was triggered by a manual retry and has now exhausted all
          // automatic retries, alert the operator via workspace Socket.io event.
          if (isPermanentlyFailed && (post.manualRetryCount ?? 0) >= MANUAL_RETRY_LIMIT) {
            emitWorkspaceAlert(
              post.workspaceId,
              "social_post_manual_retry_exhausted",
              `⚠️ Post de ${post.platform} falhou permanentemente após ${post.manualRetryCount} retentativas manuais. Verifique a integração.`,
              {
                postId: post.id,
                platform: post.platform,
                manualRetryCount: post.manualRetryCount,
                errorMessage: result.error,
              },
            );
          }
        }
      } catch (itemErr) {
        await db
          .update(socialPresencePostsTable)
          .set({ status: "scheduled" })
          .where(eq(socialPresencePostsTable.id, post.id))
          .catch(() => {});
        log.warn({ itemErr, postId: post.id }, "presence: item error (reset to scheduled)");
      }
    }
  } catch (err) {
    logger.warn({ err }, "publishDuePresencePosts: tick error (non-fatal)");
  }
}

/**
 * preGeneratePresenceMedia — pré-geração proativa de storyboards para posts futuros
 *
 * O publishDuePresencePosts só inicia a geração de mídia no momento exato de publicação,
 * o que impede aprovação antes do horário. Esta função roda a cada tick e busca posts
 * Instagram/TikTok agendados nas próximas 48 horas sem mídia nem geração iniciada,
 * disparando o storyboard com antecedência para que o usuário possa aprovar.
 *
 * Limite: 5 posts por tick para não sobrecarregar o pipeline de imagens.
 */
export async function preGeneratePresenceMedia(): Promise<void> {
  const log = logger.child({ component: "presence-media-pregenerator" });
  try {
    const now = new Date();
    // 48-hour look-ahead window
    const horizon = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const upcoming = await db
      .select()
      .from(socialPresencePostsTable)
      .where(
        and(
          eq(socialPresencePostsTable.status, "scheduled"),
          gt(socialPresencePostsTable.scheduledFor, now),   // future only (due posts handled by publishDuePresencePosts)
          lte(socialPresencePostsTable.scheduledFor, horizon),
          isNull(socialPresencePostsTable.mediaGenStatus),   // no generation started
        ),
      )
      .limit(5);

    if (upcoming.length === 0) return;
    log.info({ count: upcoming.length }, "presence: proactive media pre-generation — posts found");

    for (const post of upcoming) {
      try {
        // Only Instagram and TikTok need storyboard-based media
        const needsMedia = post.platform === "instagram" || post.platform === "tiktok";
        if (!needsMedia) continue;

        const rawMediaUrls = Array.isArray(post.mediaUrls) ? (post.mediaUrls as string[]) : [];
        if (rawMediaUrls.length > 0) continue; // already has media — skip

        const isStoryImage =
          post.format === "story" && (post as Record<string, unknown>).storyMediaType === "image";
        const isVideoFormat =
          (post.format === "reel" || post.format === "feed_video" || post.format === "story") &&
          !isStoryImage;

        log.info(
          { postId: post.id, platform: post.platform, format: post.format, scheduledFor: post.scheduledFor },
          "presence: starting proactive storyboard generation",
        );

        // Lock the post so concurrent ticks don't double-generate
        await db
          .update(socialPresencePostsTable)
          .set({ mediaGenStatus: "storyboard_generating", storyboardUrls: [] })
          .where(
            and(
              eq(socialPresencePostsTable.id, post.id),
              isNull(socialPresencePostsTable.mediaGenStatus), // guard against race
            ),
          );

        const snap = { ...post };
        setImmediate(() => {
          fetchBusinessContextForWorkspace(snap.workspaceId).then(bctx =>
          generateStoryboardFrame(
            snap.visualDirection,
            snap.caption,
            snap.platform,
            snap.format,
            log,
            snap.videoScript ?? snap.reelScript,
            bctx,
          ))
            .then(async ({ buf, mimeType, isAI }) => {
              const ext =
                mimeType.split("/")[1]?.replace("jpeg", "jpg").replace("svg+xml", "svg") ?? "png";
              const key = presenceStoryboardObjectKey(snap.workspaceId, snap.id, 0).replace(
                /\.png$/,
                `.${ext}`,
              );
              await uploadBufferToGCS(buf, key, mimeType);
              const serveUrl = `${env.APP_URL}/api/presence/media/serve?key=${encodeURIComponent(key)}`;
              if (isAI) {
                // Storyboard IA (imagem ou vídeo) → sempre aguarda aprovação do usuário
                await db
                  .update(socialPresencePostsTable)
                  .set({ mediaGenStatus: "storyboard_ready", storyboardUrls: [serveUrl], errorMessage: null })
                  .where(eq(socialPresencePostsTable.id, snap.id));
                log.info({ postId: snap.id, isVideoFormat }, "presence: storyboard IA gerado → aguardando aprovação do usuário ✓");
              } else {
                // SVG placeholder — sem IA disponível, precisa de substituição manual
                await db
                  .update(socialPresencePostsTable)
                  .set({ mediaGenStatus: "storyboard_draft", storyboardUrls: [serveUrl], errorMessage: "Rascunho SVG — abra para substituir por imagem real." })
                  .where(eq(socialPresencePostsTable.id, snap.id));
                log.info({ postId: snap.id }, "presence: rascunho SVG proativo criado");
              }
            })
            .catch(async (err) => {
              log.warn({ err, postId: snap.id }, "presence: proactive storyboard generation failed — resetting for retry");
              // Reset mediaGenStatus to null so next tick retries (no retryCount increment — this is pre-generation, not a publish attempt)
              await db
                .update(socialPresencePostsTable)
                .set({ mediaGenStatus: null })
                .where(eq(socialPresencePostsTable.id, snap.id));
            });
        });
      } catch (postErr) {
        log.warn({ postErr, postId: post.id }, "presence: preGeneratePresenceMedia post-level error (non-fatal)");
      }
    }
  } catch (err) {
    logger.warn({ err }, "presence: preGeneratePresenceMedia tick error (non-fatal)");
  }
}

// ─── Media Generation Pipeline ────────────────────────────────────────────────
// Fluxo: roteiro → storyboard (baixa resolução) → vídeo final com avatar clone

function buildImageClient(): OpenAI {
  // NEXOS_OPENAI é a chave dedicada para geração de imagem (sem restrições de org)
  if (env.NEXOS_OPENAI) return new OpenAI({ apiKey: env.NEXOS_OPENAI });
  if (env.OPENAI_API_KEY) return new OpenAI({ apiKey: env.OPENAI_API_KEY });
  if (env.AI_INTEGRATIONS_OPENAI_API_KEY && env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    return new OpenAI({ apiKey: env.AI_INTEGRATIONS_OPENAI_API_KEY, baseURL: env.AI_INTEGRATIONS_OPENAI_BASE_URL });
  }
  throw new Error("OPENAI_API_KEY não configurado — geração de imagem indisponível");
}

/**
 * Tenta gerar um storyboard via AI:
 *   1. Gemini direto (GEMINI_API_KEY, chave já usada pelos agentes de lançamento)
 *   2. SVG server-side rotulado como RASCUNHO — apenas se IA não disponível/sem crédito.
 *
 * Retorna { buf, mimeType, isAI } para que o caller registre o status correto:
 *   - isAI=true  → "storyboard_ready" (imagem real gerada por IA)
 *   - isAI=false → "storyboard_draft" (placeholder visual, sem crédito de IA)
 */
// ─── Helper: buscar contexto de negócio dado apenas workspaceId ─────────────

/** Exportado para uso nas rotas de análise de perfil */
export async function getBusinessContextForAnalysis(workspaceId: string): Promise<string> {
  return fetchBusinessContextForWorkspace(workspaceId);
}

async function fetchBusinessContextForWorkspace(workspaceId: string): Promise<string> {
  try {
    const [cfg] = await db
      .select()
      .from(socialPresenceConfigTable)
      .where(eq(socialPresenceConfigTable.workspaceId, workspaceId))
      .limit(1);
    if (cfg) return buildBusinessContext(workspaceId, cfg);
  } catch { /* noop */ }
  return "";
}

// ─── Geração de frame do storyboard ─────────────────────────────────────────

async function generateStoryboardFrame(
  visualDirection: string,
  caption: string,
  platform: string,
  format: string,
  log: Logger,
  videoScript?: string | null,
  businessContext?: string | null,
): Promise<{ buf: Buffer; mimeType: string; isAI: boolean }> {
  // Build a rich prompt that anchors the image to the real business context.
  // Without this, Gemini/DALL-E invents generic stock-photo aesthetics.
  const businessBlock = businessContext?.trim()
    ? `Business context (use to match brand aesthetics, product, audience): ${businessContext.slice(0, 600)}`
    : "";

  const isStoryFormat = format === "story";
  const captionSnippet = caption.trim().slice(0, 400);

  const prompt = [
    isStoryFormat
      ? `Create a vertical 9:16 Instagram story that works as a high-converting marketing asset.`
      : `Create a professional ${platform} ${format} ad visual that stops someone mid-scroll.`,
    businessBlock,
    `Visual direction: ${visualDirection || "bold, direct, commercial advertising style"}`,
    videoScript?.trim()
      ? `Video message to match visually: ${videoScript.slice(0, 350)}`
      : `Post message to communicate visually: ${captionSnippet}`,
    // Stories: texto curto é legível no Gemini e crítico para comunicar a mensagem
    isStoryFormat
      ? `IMPORTANT: Include a short bold headline (2–5 words, readable in 2 seconds) with the MAIN BENEFIT or OFFER from the post message. Place it prominently. High contrast. The visual supports this message.`
      : `No text or letters in the image — the caption carries the words. But the image alone must make the core offer instantly obvious to someone scrolling fast.`,
    "Bold, attention-grabbing commercial style. NOT cinematic or abstract art. Real, direct, benefit-first visuals.",
    "High contrast, strong focal point, professional quality. Someone who sees this for 2 seconds should immediately understand what is being offered.",
    businessBlock ? "Match brand aesthetics and target audience from the business context." : "",
  ].filter(Boolean).join(" ");

  // ── Tentativa 1: Gemini Image Generation via REST (Google AI Studio) ────────
  // Modelos confirmados disponíveis na conta (verificados via ListModels):
  //   gemini-3.1-flash-image, gemini-3.1-flash-image-preview, gemini-3.1-flash-lite-image,
  //   gemini-2.5-flash-image, gemini-2.0-flash-preview-image-generation
  // Todos usam generateContent com responseModalities:["IMAGE","TEXT"]
  const geminiKey = env.GEMINI_API_KEY || env.AI_INTEGRATIONS_GEMINI_API_KEY;
  if (geminiKey) {
    const geminiImageModels = [
      "gemini-3.1-flash-image",
      "gemini-2.5-flash-image",
      "gemini-3.1-flash-lite-image",
      "gemini-2.0-flash-preview-image-generation",
    ];
    for (const modelId of geminiImageModels) {
      try {
        log.info({ platform, format, model: modelId }, "presence: attempting Gemini image storyboard (REST)");
        const geminiResp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt.slice(0, 4000) }], role: "user" }],
              generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
            }),
            signal: AbortSignal.timeout(45_000),
          },
        );
        if (geminiResp.ok) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const geminiData = await geminiResp.json() as any;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const parts: any[] = geminiData?.candidates?.[0]?.content?.parts ?? [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const imgPart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));
          if (imgPart?.inlineData?.data) {
            log.info({ model: modelId }, "presence: Gemini image storyboard generated ✓");
            return {
              buf: Buffer.from(imgPart.inlineData.data as string, "base64"),
              mimeType: imgPart.inlineData.mimeType as string,
              isAI: true,
            };
          }
          log.warn({ model: modelId, geminiData: JSON.stringify(geminiData).slice(0, 200) }, "presence: Gemini image returned no image part — trying next");
        } else {
          const errText = await geminiResp.text().catch(() => "");
          log.warn({ model: modelId, status: geminiResp.status, errText: errText.slice(0, 200) }, "presence: Gemini image REST failed — trying next");
        }
      } catch (geminiErr) {
        log.warn({ geminiErr, model: modelId }, "presence: Gemini image exception — trying next");
      }
    }
  }

  // ── Tentativa 2: OpenAI image generation ────────────────────────────────────
  // Ordem de preferência: gpt-image-1.5 → chatgpt-image-latest → gpt-image-1 → dall-e-3
  // Tamanhos suportados:
  //   gpt-image-1.5 / gpt-image-1: portrait=1024x1536, landscape=1536x1024
  //   chatgpt-image-latest: portrait=1024x1536, landscape=1536x1024
  //   dall-e-3: portrait=1024x1792, landscape=1792x1024
  const imageModelsOAI = ["gpt-image-1.5", "chatgpt-image-latest", "gpt-image-1", "dall-e-3"];
  for (const oaiModel of imageModelsOAI) {
    try {
      const client = buildImageClient();
      const isPortrait = ["reel", "story"].includes(format);
      // dall-e-3 usa tamanhos diferentes; todos os modelos gpt-image-* usam 1024x1536/1536x1024
      const size = oaiModel === "dall-e-3"
        ? (isPortrait ? "1024x1792" : "1792x1024")
        : (isPortrait ? "1024x1536" : "1536x1024");
      log.info({ platform, format, size, model: oaiModel }, `presence: attempting ${oaiModel} storyboard (url mode)`);
      const respRaw = await client.images.generate({
        model: oaiModel,
        prompt: prompt.slice(0, 4000),
        n: 1,
        size,
        // Não passar quality nem response_format — compatibilidade máxima com o proxy
      } as Parameters<typeof client.images.generate>[0]);
      // Cast necessário: SDK tipagem retorna Stream | ImagesResponse mas chamadas sync sempre retornam ImagesResponse
      const resp = respRaw as import("openai/resources/images.js").ImagesResponse;
      // gpt-image-1.5 retorna b64_json por padrão; dall-e-3 retorna url
      const b64 = resp.data?.[0]?.b64_json;
      const imgUrl = resp.data?.[0]?.url;
      if (b64) {
        const buf = Buffer.from(b64, "base64");
        log.info({ format, size, model: oaiModel, bytes: buf.length }, `presence: ${oaiModel} storyboard generated ✓ (b64)`);
        return { buf, mimeType: "image/png", isAI: true };
      } else if (imgUrl) {
        const imgResp = await fetch(imgUrl, { signal: AbortSignal.timeout(30_000) });
        if (imgResp.ok) {
          const arrayBuf = await imgResp.arrayBuffer();
          const buf = Buffer.from(arrayBuf);
          const mimeType = imgResp.headers.get("content-type") ?? "image/png";
          log.info({ format, size, model: oaiModel }, `presence: ${oaiModel} storyboard generated ✓ (url)`);
          return { buf, mimeType, isAI: true };
        }
        log.warn({ status: imgResp.status, model: oaiModel }, "presence: OpenAI image download failed — trying next");
      } else {
        log.warn({ model: oaiModel, data: JSON.stringify(resp.data).slice(0, 200) }, "presence: OpenAI returned no b64 or url — trying next");
      }
    } catch (oaiErr) {
      log.warn({ oaiErr, model: oaiModel }, `presence: ${oaiModel} failed — trying next`);
    }
  }

  // ── Fallback: SVG placeholder (rascunho visual, sem crédito de IA) ──────────
  // Todos os provedores de IA falharam (keys indisponíveis, cota esgotada, etc.).
  // Gera um placeholder SVG de alta qualidade para que o usuário veja o contexto
  // do post e possa fornecer mídia manualmente ou aguardar retry com IA.
  log.warn({ platform, format }, "presence: all AI image providers failed — using SVG placeholder draft");
  const svgStr = buildStoryboardSVG({ visualDirection, caption, platform, format, isDraft: true });
  return { buf: Buffer.from(svgStr, "utf-8"), mimeType: "image/svg+xml", isAI: false };
}

/** Generates a branded SVG storyboard frame from post metadata. */
function buildStoryboardSVG(opts: {
  visualDirection: string;
  caption: string;
  platform: string;
  format: string;
  isDraft?: boolean;
}): string {
  const { visualDirection, caption, platform, format, isDraft = false } = opts;
  const isPortrait = ["reel", "story"].includes(format);
  const w = isPortrait ? 540 : 960;
  const h = isPortrait ? 960 : 540;

  // Wrap long text into lines of ~60 chars
  const wrap = (text: string, maxLen = 60): string[] => {
    const words = text.replace(/\n/g, " ").split(" ");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      if ((line + " " + word).trim().length > maxLen) {
        if (line) lines.push(line.trim());
        line = word;
      } else {
        line = (line + " " + word).trim();
      }
    }
    if (line) lines.push(line.trim());
    return lines.slice(0, 5); // max 5 lines
  };

  const dirLines = wrap(visualDirection, 55);
  const capLines = wrap(caption, 50);
  const platformLabel = `${platform.toUpperCase()} · ${format.toUpperCase()}`;

  const renderLines = (lines: string[], x: number, y: number, lineHeight: number, color: string, fontSize: number) =>
    lines
      .map(
        (l, i) =>
          `<text x="${x}" y="${y + i * lineHeight}" font-size="${fontSize}" fill="${color}" font-family="system-ui, sans-serif">${l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</text>`,
      )
      .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0a1a"/>
      <stop offset="100%" stop-color="#0d0d2b"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <!-- Grid lines -->
  <line x1="${w * 0.333}" y1="0" x2="${w * 0.333}" y2="${h}" stroke="#1e1e3a" stroke-width="1"/>
  <line x1="${w * 0.667}" y1="0" x2="${w * 0.667}" y2="${h}" stroke="#1e1e3a" stroke-width="1"/>
  <line x1="0" y1="${h * 0.333}" x2="${w}" y2="${h * 0.333}" stroke="#1e1e3a" stroke-width="1"/>
  <line x1="0" y1="${h * 0.667}" x2="${w}" y2="${h * 0.667}" stroke="#1e1e3a" stroke-width="1"/>
  <!-- Rule-of-thirds center mark -->
  <circle cx="${w * 0.333}" cy="${h * 0.333}" r="4" fill="none" stroke="#6366f1" stroke-width="1" opacity="0.5"/>
  <circle cx="${w * 0.667}" cy="${h * 0.333}" r="4" fill="none" stroke="#6366f1" stroke-width="1" opacity="0.5"/>
  <!-- Platform badge -->
  <rect x="24" y="24" width="${platformLabel.length * 8 + 20}" height="28" rx="6" fill="url(#accent)" opacity="0.9"/>
  <text x="34" y="42" font-size="13" fill="white" font-family="system-ui, sans-serif" font-weight="600">${platformLabel}</text>
  <!-- STORYBOARD / RASCUNHO label -->
  <text x="${w - 24}" y="42" font-size="11" fill="#6366f1" font-family="system-ui, monospace" text-anchor="end" opacity="0.7" letter-spacing="2">STORYBOARD</text>
  ${isDraft ? `
  <!-- RASCUNHO diagonal watermark -->
  <g transform="translate(${w / 2},${h / 2}) rotate(-30)">
    <text x="0" y="0" font-size="${isPortrait ? 56 : 72}" fill="#f59e0b" font-family="system-ui, sans-serif" font-weight="900" text-anchor="middle" dominant-baseline="middle" opacity="0.12" letter-spacing="4">RASCUNHO</text>
  </g>
  <!-- RASCUNHO badge top-right -->
  <rect x="${w - 110}" y="58" width="86" height="22" rx="5" fill="#f59e0b" opacity="0.9"/>
  <text x="${w - 67}" y="73" font-size="11" fill="#0a0a1a" font-family="system-ui, sans-serif" font-weight="700" text-anchor="middle">SEM CRÉDITO IA</text>` : ""}
  <!-- Visual direction section -->
  <rect x="24" y="${h * 0.42}" width="${w - 48}" height="${dirLines.length * 22 + 44}" rx="10" fill="#1a1a2e" opacity="0.9"/>
  <text x="40" y="${h * 0.42 + 22}" font-size="11" fill="#8b5cf6" font-family="system-ui, monospace" letter-spacing="1" font-weight="600">DIREÇÃO VISUAL</text>
  ${renderLines(dirLines, 40, h * 0.42 + 42, 22, "#e2e8f0", 14)}
  <!-- Caption section -->
  <rect x="24" y="${h * 0.72}" width="${w - 48}" height="${capLines.length * 20 + 44}" rx="10" fill="#0f172a" opacity="0.85"/>
  <text x="40" y="${h * 0.72 + 22}" font-size="11" fill="#6366f1" font-family="system-ui, monospace" letter-spacing="1" font-weight="600">CAPTION</text>
  ${renderLines(capLines, 40, h * 0.72 + 42, 20, "#94a3b8", 13)}
  <!-- Corner markers -->
  <path d="M0,30 L0,0 L30,0" fill="none" stroke="#6366f1" stroke-width="2" opacity="0.5"/>
  <path d="${w - 30},0 L${w},0 L${w},30" fill="none" stroke="#6366f1" stroke-width="2" opacity="0.5"/>
  <path d="${w},${h - 30} L${w},${h} L${w - 30},${h}" fill="none" stroke="#6366f1" stroke-width="2" opacity="0.5"/>
  <path d="30,${h} L0,${h} L0,${h - 30}" fill="none" stroke="#6366f1" stroke-width="2" opacity="0.5"/>
</svg>`;
}

async function getWorkspacePersona(workspaceId: string): Promise<{
  heygenAvatarId?: string;
  voiceCloneId?: string;
  heygenVoiceId?: string;
  avatarType?: "talking_photo" | "stock" | "digital_twin";
  lifestylePreferences?: import("../agents/presence-planner.agent.js").LifestylePreferences | null;
}> {
  const [ws] = await db
    .select({ settings: workspacesTable.settings })
    .from(workspacesTable)
    .where(eq(workspacesTable.id, workspaceId))
    .limit(1);
  const persona = ((ws?.settings as Record<string, unknown> | null)?.persona ?? {}) as Record<string, unknown>;
  return {
    heygenAvatarId: persona.heygenAvatarId as string | undefined,
    voiceCloneId: persona.voiceCloneId as string | undefined,
    heygenVoiceId: persona.heygenVoiceId as string | undefined,
    avatarType: (persona.avatarType as "talking_photo" | "stock" | "digital_twin" | undefined) ?? "talking_photo",
    lifestylePreferences: (persona.lifestylePreferences ?? null) as import("../agents/presence-planner.agent.js").LifestylePreferences | null,
  };
}

/** Inicia geração do storyboard (baixa resolução) para aprovação.
 *  Fire-and-forget: retorna imediatamente com status 'storyboard_generating'.
 *  O storyboard é armazenado como base64 data URL em storyboardUrls para
 *  fácil exibição no frontend sem endpoint de serving adicional. */
export async function generatePostStoryboard(
  workspaceId: string,
  postId: string,
  log: Logger,
): Promise<SocialPresencePost | null> {
  const [post] = await db
    .select()
    .from(socialPresencePostsTable)
    .where(and(eq(socialPresencePostsTable.id, postId), eq(socialPresencePostsTable.workspaceId, workspaceId)))
    .limit(1);
  if (!post) return null;

  const [updating] = await db
    .update(socialPresencePostsTable)
    .set({ mediaGenStatus: "storyboard_generating", storyboardUrls: [], mediaJobId: null, mediaJobProvider: null })
    .where(eq(socialPresencePostsTable.id, postId))
    .returning();

  setImmediate(async () => {
    try {
      const businessContext = await fetchBusinessContextForWorkspace(workspaceId);
      const { buf: imgBuf, mimeType, isAI } = await generateStoryboardFrame(
        post.visualDirection,
        post.caption,
        post.platform,
        post.format,
        log,
        post.videoScript,
        businessContext,
      );

      // Upload imediatamente ao GCS — nunca armazenar base64 no banco
      const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg").replace("svg+xml", "svg") ?? "png";
      const key = presenceStoryboardObjectKey(workspaceId, postId, 0).replace(/\.png$/, `.${ext}`);
      await uploadBufferToGCS(imgBuf, key, mimeType);
      const serveUrl = `${env.APP_URL}/api/presence/media/serve?key=${encodeURIComponent(key)}`;

      // Determinar se o formato é de imagem (não precisa de vídeo)
      const isVideoFmt = ["reel", "feed_video"].includes(post.format) ||
        (post.format === "story" && (post as Record<string, unknown>).storyMediaType !== "image");

      if (isAI && !isVideoFmt) {
        // Imagem IA real → auto-aprovação direta, pronto para publicar
        await db
          .update(socialPresencePostsTable)
          .set({ mediaUrls: [serveUrl], storyboardUrls: [serveUrl], mediaGenStatus: null, errorMessage: null, status: "scheduled" })
          .where(eq(socialPresencePostsTable.id, postId));
        log.info({ postId, key }, "presence: storyboard on-demand IA auto-aprovado ✓");
      } else if (isAI && isVideoFmt) {
        await db
          .update(socialPresencePostsTable)
          .set({ mediaGenStatus: "storyboard_ready", storyboardUrls: [serveUrl] })
          .where(eq(socialPresencePostsTable.id, postId));
        log.info({ postId, key }, "presence: storyboard on-demand de vídeo pronto ✓");
      } else {
        await db
          .update(socialPresencePostsTable)
          .set({ mediaGenStatus: "storyboard_draft", storyboardUrls: [serveUrl] })
          .where(eq(socialPresencePostsTable.id, postId));
        log.info({ postId, key }, "presence: rascunho SVG on-demand criado");
      }
    } catch (err) {
      log.warn({ err, postId }, "presence: storyboard generation failed");
      await db
        .update(socialPresencePostsTable)
        .set({
          mediaGenStatus: "failed",
          errorMessage: `Storyboard falhou: ${err instanceof Error ? err.message : String(err)}`,
        })
        .where(eq(socialPresencePostsTable.id, postId));
    }
  });

  return updating;
}

/** Stream de uma mídia pública (user upload) para publicação nas redes sociais. */
const MEDIA_TOKEN_TTL_SECONDS = 1800; // 30 minutos
const MEDIA_TOKEN_TYPE = "presence-media-stream";

/**
 * Valida a key, confirma ownership no banco e emite um redirect 302 para
 * uma URL de streaming com TTL:
 *   1. Tenta GCS V4 Signed URL (30 min) — sem fallback silencioso.
 *   2. Se o GCS não suportar signing (Replit sidecar), emite um JWT
 *      curto (30 min) e redireciona para /api/presence/media/stream?tok=…
 *
 * Instagram/TikTok seguem o 302 normalmente sem precisar de auth header.
 * URLs "vazadas" expiram em 30 min e post deletado retorna 404.
 */
export async function redirectToPresenceMedia(
  gcsKey: string,
  res: import("express").Response,
): Promise<void> {
  // 1. Prefix guard — aceita presence-media/ (mídia de posts), presence-storyboard/ (frames de IA)
  //    e presence-video/ (reels gerados por HeyGen, armazenados no GCS próprio via P3)
  if (!gcsKey.startsWith("presence-media/") && !gcsKey.startsWith("presence-storyboard/") && !gcsKey.startsWith("presence-video/")) {
    res.status(403).end();
    return;
  }

  // 2. Parse por formato:
  //    presence-video/{workspaceId}/{postId}.mp4         → 3 partes (reels HeyGen)
  //    presence-media/{workspaceId}/{postId}/{filename}  → 4+ partes
  //    presence-storyboard/{workspaceId}/{filename}      → 3 partes (sem postId obrigatório)
  const parts = gcsKey.split("/");
  let workspaceId: string;
  let postId: string;
  if (gcsKey.startsWith("presence-video/")) {
    // presence-video/{workspaceId}/{postId}.mp4
    if (parts.length < 3) { res.status(400).end(); return; }
    workspaceId = parts[1]!;
    postId      = parts[2]!.replace(/\.[^.]+$/, ""); // strip extensão
  } else if (gcsKey.startsWith("presence-storyboard/")) {
    // presence-storyboard/{workspaceId}/{filename} — sem postId de ownership
    // Verificação de ownership por workspaceId não é aplicável aqui; serve direto.
    if (parts.length < 3) { res.status(400).end(); return; }
    workspaceId = parts[1]!;
    postId      = ""; // sem post associado — skip ownership check abaixo
  } else {
    // presence-media/{workspaceId}/{postId}/{filename}
    if (parts.length < 4) { res.status(400).end(); return; }
    workspaceId = parts[1]!;
    postId      = parts[2]!;
  }

  // 3. Ownership check — post deve existir e pertencer ao workspace.
  //    presence-storyboard/ não tem postId; pular o check (o prefix guard já valida o tipo).
  if (postId) {
    const [row] = await db
      .select({ id: socialPresencePostsTable.id })
      .from(socialPresencePostsTable)
      .where(
        and(
          eq(socialPresencePostsTable.id, postId),
          eq(socialPresencePostsTable.workspaceId, workspaceId),
        ),
      )
      .limit(1);

    if (!row) {
      res.status(404).end();
      return;
    }
  }

  // 4a. Tentar GCS V4 Signed URL (requer iam.serviceAccounts.signBlob — indisponível no Replit)
  const signedUrl = await getPresenceMediaSignedUrl(gcsKey, MEDIA_TOKEN_TTL_SECONDS);
  if (signedUrl) {
    res.redirect(302, signedUrl);
    return;
  }

  // 4b. Fallback: pipe direto do GCS sem redirect.
  // Motivo: o downloader assíncrono do Instagram/TikTok não segue redirects de forma
  // confiável quando o destino é um JWT de servidor — isso causa container status=ERROR.
  // Servir os bytes diretamente garante que a URL passada na image_url/video_url já
  // entrega o arquivo, sem nenhum salto extra.
  try {
    const { contentType, size } = await getGCSObjectMeta(gcsKey);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(size));
    // Presença media é conteúdo publicável — pode ser cacheado publicamente
    res.setHeader("Cache-Control", "public, max-age=1800");
    createGCSObjectStream(gcsKey).pipe(res);
  } catch {
    res.status(404).end();
  }
}

/**
 * Stream endpoint sem auth — valida o JWT e faz pipe do arquivo GCS.
 * Chamado apenas via redirect de redirectToPresenceMedia.
 */
export async function streamPresenceMediaByToken(
  token: string,
  res: import("express").Response,
): Promise<void> {
  let payload: { key: string; type: string };
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as typeof payload;
  } catch {
    res.status(401).end(); // token inválido ou expirado
    return;
  }

  if (payload.type !== MEDIA_TOKEN_TYPE || !payload.key?.startsWith("presence-media/")) {
    res.status(403).end();
    return;
  }

  try {
    const { contentType, size } = await getGCSObjectMeta(payload.key);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(size));
    // max-age curto — o token já limita o acesso; browsers podem cachear por 5 min
    res.setHeader("Cache-Control", "private, max-age=300");
    createGCSObjectStream(payload.key).pipe(res);
  } catch {
    res.status(404).end();
  }
}

/** Aprova o storyboard e inicia a geração do vídeo real.
 *  Usa HeyGen avatar (se configurado) → fallback para Runway/Kling. */
export async function approveStoryboardGenerateVideo(
  workspaceId: string,
  postId: string,
  log: Logger,
): Promise<SocialPresencePost | null> {
  const [post] = await db
    .select()
    .from(socialPresencePostsTable)
    .where(and(eq(socialPresencePostsTable.id, postId), eq(socialPresencePostsTable.workspaceId, workspaceId)))
    .limit(1);
  if (!post) return null;

  // Aceita tanto storyboard_ready (IA real) quanto storyboard_draft (rascunho SVG)
  const approvedStatuses = ["storyboard_ready", "storyboard_draft"];
  if (!approvedStatuses.includes(post.mediaGenStatus ?? "")) {
    throw new Error("Storyboard ainda não aprovado ou não disponível.");
  }

  const [updating] = await db
    .update(socialPresencePostsTable)
    .set({ mediaGenStatus: "video_generating" })
    .where(eq(socialPresencePostsTable.id, postId))
    .returning();

  setImmediate(async () => {
    try {
      const persona = await getWorkspacePersona(workspaceId);
      let result;

      // Prefere vídeo com avatar (HeyGen) se o workspace tiver configurado.
      // heygenVoiceId: voz stock HeyGen selecionada diretamente no drawer de mídia.
      // voiceCloneId: fallback (voz clonada via ElevenLabs, salva em projetos de vídeo).
      const effectiveVoiceId = persona.heygenVoiceId || persona.voiceCloneId;
      if (persona.heygenAvatarId && effectiveVoiceId) {
        const voiceoverText = post.videoScript?.trim()
          ? post.videoScript
          : `${post.caption}\n\n${post.hashtags.map((h) => `#${h}`).join(" ")}`;

        result = await generateAvatarVideo({
          voiceoverText,
          avatarId: persona.heygenAvatarId,
          voiceId: effectiveVoiceId,
          avatarType: persona.avatarType ?? "talking_photo",
          aspectRatio: ["reel", "story"].includes(post.format) ? "9:16" : "16:9",
        });
      } else {
        // Sem avatar personalizado → usar avatar stock do HeyGen (personagens aleatórios)
        // O usuário vê um vídeo com personagem genérico mas profissional.
        log.info({ postId }, "presence: sem avatar personalizado → buscando avatar stock HeyGen");
        const stockAvatar = await fetchRandomStockHeygenAvatar();
        if (stockAvatar) {
          const voiceoverText = post.videoScript?.trim()
            ? post.videoScript
            : `${post.caption ?? ""}\n\n${(post.hashtags ?? []).map((h: string) => `#${h}`).join(" ")}`;
          result = await generateAvatarVideo({
            voiceoverText,
            avatarId: stockAvatar.avatarId,
            voiceId: stockAvatar.voiceId,
            avatarType: "stock",
            aspectRatio: ["reel", "story"].includes(post.format) ? "9:16" : "16:9",
          });
          log.info({ postId, avatarId: stockAvatar.avatarId, avatarName: stockAvatar.avatarName }, "presence: avatar stock selecionado");
          // Notificar usuário — ele pode editar depois se quiser
          emitWorkspaceAlert(
            post.workspaceId,
            "presence_stock_avatar_used",
            `🎬 Reel gerado com personagem automático. Quer personalizar? Configure seu avatar em Configurações → Persona.`,
            { postId, canEdit: true },
          );
        } else {
          // HeyGen indisponível ou sem avatares stock — fallback para imagem do storyboard
          const sbUrls = Array.isArray(post.storyboardUrls) ? (post.storyboardUrls as string[]) : [];
          if (sbUrls.length > 0) {
            log.warn({ postId }, "presence: sem avatar stock disponível → publicando storyboard como imagem");
            await db
              .update(socialPresencePostsTable)
              .set({ mediaGenStatus: null, mediaUrls: sbUrls, errorMessage: null })
              .where(eq(socialPresencePostsTable.id, postId));
            return;
          }
          throw new Error("Configure seu avatar em Configurações → Persona para gerar reels com vídeo.");
        }
      }

      if (
        result.status === "failed" ||
        result.status === "provider_not_configured" ||
        result.status === "avatar_still_processing" ||
        result.status === "avatar_consent_required"
      ) {
        throw new Error(result.error ?? result.setupInstructions ?? "Provedor de vídeo não configurado.");
      }

      if (result.status === "ready" && result.clipUrl) {
        // Vídeo entregue imediatamente (raro, mas possível).
        // P3: Download do CDN HeyGen e upload para GCS próprio.
        // PROIBIDO gravar URL HeyGen em mediaUrls — ela expira em ~7 dias.
        // PROIBIDO usar URL HeyGen como fallback em nenhum caminho de erro.
        try {
          const videoResp = await fetch(result.clipUrl);
          if (!videoResp.ok) throw new Error(`HeyGen CDN fetch HTTP ${videoResp.status}`);
          const buf = Buffer.from(await videoResp.arrayBuffer());
          const gcsKey = `presence-video/${workspaceId}/${postId}.mp4`;
          await uploadBufferToGCS(buf, gcsKey, "video/mp4");
          const serveUrl = `${env.APP_URL}/api/presence/media/serve?key=${encodeURIComponent(gcsKey)}`;
          // mediaJobId reutilizado como campo de auditoria pós-conclusão (polling encerrado).
          await db
            .update(socialPresencePostsTable)
            .set({
              mediaGenStatus: "video_ready",
              mediaJobId: result.clipUrl,  // auditoria: URL original HeyGen (expira)
              mediaJobProvider: null,
              mediaUrls: [serveUrl],
            })
            .where(eq(socialPresencePostsTable.id, postId));
          log.info({ postId, gcsKey, serveUrl, heygenUrl: result.clipUrl }, "presence: vídeo (imediato) armazenado no GCS ✓");
        } catch (dlErr) {
          log.error(
            { postId, heygenUrl: result.clipUrl, err: String(dlErr) },
            "presence: GCS upload falhou (path imediato) — post marcado como failed (sem fallback para URL HeyGen)",
          );
          await db
            .update(socialPresencePostsTable)
            .set({ mediaGenStatus: "failed", errorMessage: `Upload GCS falhou: ${String(dlErr)}` })
            .where(eq(socialPresencePostsTable.id, postId));
        }
      } else {
        // Vídeo assíncrono: salvar job ID para polling
        await db
          .update(socialPresencePostsTable)
          .set({
            mediaJobId: result.jobId ?? null,
            mediaJobProvider: result.provider ?? null,
          })
          .where(eq(socialPresencePostsTable.id, postId));
      }

      log.info({ postId, provider: result.provider, jobId: result.jobId }, "presence: video generation submitted");
    } catch (err) {
      log.warn({ err, postId }, "presence: video generation failed");
      await db
        .update(socialPresencePostsTable)
        .set({
          mediaGenStatus: "failed",
          errorMessage: `Geração de vídeo falhou: ${err instanceof Error ? err.message : String(err)}`,
        })
        .where(eq(socialPresencePostsTable.id, postId));
    }
  });

  return updating;
}

/** Verifica o status do job de geração de vídeo no provedor e atualiza o post. */
export async function pollPostMediaJob(
  workspaceId: string,
  postId: string,
  log: Logger,
): Promise<SocialPresencePost | null> {
  const [post] = await db
    .select()
    .from(socialPresencePostsTable)
    .where(and(eq(socialPresencePostsTable.id, postId), eq(socialPresencePostsTable.workspaceId, workspaceId)))
    .limit(1);
  if (!post) return null;
  if (post.mediaGenStatus !== "video_generating" || !post.mediaJobId || !post.mediaJobProvider) {
    return post;
  }

  try {
    const result = await pollVideoJob(post.mediaJobId, post.mediaJobProvider);
    if (result.status === "ready" && result.clipUrl) {
      // P3: Download do CDN HeyGen e upload para GCS próprio.
      // PROIBIDO gravar URL HeyGen em mediaUrls — ela expira em ~7 dias e quebra silenciosamente.
      // PROIBIDO usar URL HeyGen como fallback em nenhum caminho de erro.
      let gcsKey: string;
      try {
        const videoResp = await fetch(result.clipUrl);
        if (!videoResp.ok) throw new Error(`HeyGen CDN fetch HTTP ${videoResp.status}`);
        const buf = Buffer.from(await videoResp.arrayBuffer());
        gcsKey = `presence-video/${post.workspaceId}/${postId}.mp4`;
        await uploadBufferToGCS(buf, gcsKey, "video/mp4");
      } catch (dlErr) {
        log.error(
          { postId, heygenUrl: result.clipUrl, err: String(dlErr) },
          "presence: GCS upload falhou — post marcado como failed (sem fallback para URL HeyGen)",
        );
        const [updated] = await db
          .update(socialPresencePostsTable)
          .set({ mediaGenStatus: "failed", errorMessage: `Upload GCS falhou: ${String(dlErr)}` })
          .where(eq(socialPresencePostsTable.id, postId))
          .returning();
        return updated;
      }
      const serveUrl = `${env.APP_URL}/api/presence/media/serve?key=${encodeURIComponent(gcsKey)}`;
      // mediaJobId reutilizado como campo de auditoria pós-conclusão:
      // o polling já encerrou, então o campo não é mais necessário para rastreamento de job.
      // A URL HeyGen aqui é apenas registro interno — expira em ~7 dias, nunca servida ao cliente.
      const [updated] = await db
        .update(socialPresencePostsTable)
        .set({
          mediaGenStatus: "video_ready",
          mediaUrls: [serveUrl],
          mediaJobId: result.clipUrl,  // auditoria: URL original HeyGen (expira)
          mediaJobProvider: null,
        })
        .where(eq(socialPresencePostsTable.id, postId))
        .returning();
      log.info({ postId, gcsKey, serveUrl, heygenUrl: result.clipUrl }, "presence: vídeo armazenado no GCS ✓");
      return updated;
    } else if (result.status === "failed") {
      const [updated] = await db
        .update(socialPresencePostsTable)
        .set({ mediaGenStatus: "failed", errorMessage: result.error ?? "Geração de vídeo falhou." })
        .where(eq(socialPresencePostsTable.id, postId))
        .returning();
      return updated;
    }
    // ainda processando
    return post;
  } catch (err) {
    log.warn({ err, postId }, "presence: pollPostMediaJob error (non-fatal)");
    return post;
  }
}

/** Upload temporário de mídia para uso no post de teste (sem vínculo a post). */
export async function uploadTestMedia(
  workspaceId: string,
  buffer: Buffer,
  contentType: string,
  originalFilename: string,
  log: Logger,
): Promise<string> {
  const ext = originalFilename.split(".").pop()?.toLowerCase() ?? "bin";
  const key = `presence-media/test/${workspaceId}/${Date.now()}.${ext}`;
  await uploadBufferToGCS(buffer, key, contentType);

  // Prefer a 1-hour signed URL so Instagram can fetch directly without redirect
  const signed = await getPresenceMediaSignedUrl(key, 3600).catch(() => null);
  if (signed) return signed;

  // Fallback: internal serve URL (publicly accessible)
  return `${env.APP_URL}/api/presence/media/serve?key=${encodeURIComponent(key)}`;
}

/** Upload de mídia enviada pelo usuário (imagem ou vídeo) → GCS → atualiza mediaUrls. */
export async function attachUploadedMedia(
  workspaceId: string,
  postId: string,
  buffer: Buffer,
  contentType: string,
  originalFilename: string,
  log: Logger,
): Promise<SocialPresencePost | null> {
  const [post] = await db
    .select({ id: socialPresencePostsTable.id, workspaceId: socialPresencePostsTable.workspaceId })
    .from(socialPresencePostsTable)
    .where(and(eq(socialPresencePostsTable.id, postId), eq(socialPresencePostsTable.workspaceId, workspaceId)))
    .limit(1);
  if (!post) return null;

  const ext = originalFilename.split(".").pop()?.toLowerCase() ?? "bin";
  const key = presenceMediaObjectKey(workspaceId, postId, `${Date.now()}.${ext}`);
  await uploadBufferToGCS(buffer, key, contentType);

  // URL pública que o Instagram/TikTok consegue acessar
  const serveUrl = `${env.APP_URL}/api/presence/media/serve?key=${encodeURIComponent(key)}`;
  log.info({ postId, key, serveUrl }, "presence: media uploaded");

  const [updated] = await db
    .update(socialPresencePostsTable)
    .set({ mediaUrls: [serveUrl], mediaGenStatus: null, mediaJobId: null })
    .where(eq(socialPresencePostsTable.id, postId))
    .returning();
  return updated;
}

/**
 * Aprova o storyboard como imagem final para posts de feed (feed_image / feed_carousel).
 * Faz upload do base64 para o GCS, define mediaUrls e agenda o post.
 */
export async function approveStoryboardAsImage(
  workspaceId: string,
  postId: string,
  log: Logger,
): Promise<SocialPresencePost | null> {
  const [post] = await db
    .select()
    .from(socialPresencePostsTable)
    .where(and(eq(socialPresencePostsTable.id, postId), eq(socialPresencePostsTable.workspaceId, workspaceId)))
    .limit(1);
  if (!post) return null;

  const storyboardEntry = (post.storyboardUrls as string[] | null)?.[0];
  if (!storyboardEntry) {
    throw new Error("Storyboard ainda não disponível. Aguarde a geração ou gere novamente.");
  }

  let serveUrl: string;

  if (storyboardEntry.startsWith("data:image/")) {
    // Legado: base64 ainda no banco — fazer upload agora
    const match = storyboardEntry.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) throw new Error("Formato interno do storyboard inválido.");
    const mimeType = match[1];
    const b64 = match[2];
    const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg").replace("svg+xml", "svg") ?? "png";
    const buf = Buffer.from(b64, "base64");
    const key = presenceMediaObjectKey(workspaceId, postId, `${Date.now()}-storyboard.${ext}`);
    await uploadBufferToGCS(buf, key, mimeType);
    serveUrl = `${env.APP_URL}/api/presence/media/serve?key=${encodeURIComponent(key)}`;
    log.info({ postId, key, mimeType }, "presence: storyboard (legado base64) enviado ao GCS ✓");
  } else if (storyboardEntry.includes("/api/presence/media/serve")) {
    // Novo caminho: já foi enviado ao GCS durante a geração — reutilizar URL
    // Bloquear SVG: Instagram/TikTok rejeitam SVG com "Only photo or video accepted"
    if (storyboardEntry.includes(".svg") || post.mediaGenStatus === "storyboard_draft") {
      throw new Error(
        "Este é um rascunho gerado sem IA (SVG) e não pode ser publicado diretamente. " +
        "Use 'Tentar gerar imagem novamente' para obter uma imagem real, ou faça upload de uma imagem/vídeo próprio.",
      );
    }
    serveUrl = storyboardEntry;
    log.info({ postId, serveUrl }, "presence: storyboard já no GCS — aprovado como imagem final ✓");
  } else {
    throw new Error("Formato do storyboard não reconhecido.");
  }

  const [updated] = await db
    .update(socialPresencePostsTable)
    .set({
      mediaUrls: [serveUrl],
      mediaGenStatus: null,
      storyboardUrls: [],
      mediaJobId: null,
      mediaJobProvider: null,
      errorMessage: null,
      status: "scheduled",
    })
    .where(eq(socialPresencePostsTable.id, postId))
    .returning();
  return updated;
}

/** Vincula o vídeo gerado pela IA ao post (transição video_ready → mediaUrls confirmado). */
export async function confirmVideoAttachment(
  workspaceId: string,
  postId: string,
): Promise<SocialPresencePost | null> {
  const [post] = await db
    .select()
    .from(socialPresencePostsTable)
    .where(and(eq(socialPresencePostsTable.id, postId), eq(socialPresencePostsTable.workspaceId, workspaceId)))
    .limit(1);
  if (!post) return null;
  if (post.mediaGenStatus !== "video_ready" || !post.mediaUrls?.length) {
    throw new Error("Vídeo ainda não está pronto ou não gerado.");
  }
  // Limpar estado temporário da pipeline — o vídeo já está em mediaUrls
  const [updated] = await db
    .update(socialPresencePostsTable)
    .set({ mediaGenStatus: null, storyboardUrls: [], mediaJobId: null, mediaJobProvider: null })
    .where(eq(socialPresencePostsTable.id, postId))
    .returning();
  return updated;
}

// ─── Bulk Approve Storyboards ─────────────────────────────────────────────────
// Aprovação em lote: imagens → schedule direto; vídeos → dispara geração automática.
// "Uma decisão criativa, uma ação — sem segunda aprovação depois."

export async function bulkApproveStoryboards(
  workspaceId: string,
  postIds: string[],
  log: Logger,
): Promise<{ approved: number; videoTriggered: number; skipped: number; errors: string[] }> {
  let approved = 0;
  let videoTriggered = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const postId of postIds) {
    const [post] = await db
      .select()
      .from(socialPresencePostsTable)
      .where(and(eq(socialPresencePostsTable.id, postId), eq(socialPresencePostsTable.workspaceId, workspaceId)))
      .limit(1);

    if (!post) { skipped++; continue; }
    const status = post.mediaGenStatus ?? "";
    if (!["storyboard_ready", "storyboard_draft"].includes(status)) { skipped++; continue; }

    const isVideoFormat = ["reel", "feed_video", "story"].includes(post.format ?? "");

    try {
      if (isVideoFormat) {
        // Vídeo aprovado → dispara geração automática (avatar clone ou cinematográfico)
        await approveStoryboardGenerateVideo(workspaceId, postId, log);
        videoTriggered++;
      } else {
        // Imagem aprovada → passa direto para scheduled sem nova ação
        await approveStoryboardAsImage(workspaceId, postId, log);
        approved++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${postId}: ${msg}`);
      log.warn({ postId, err }, "bulk-approve: error on post");
    }
  }

  log.info({ workspaceId, approved, videoTriggered, skipped, errors: errors.length }, "bulk-approve: completed");
  return { approved, videoTriggered, skipped, errors };
}

// ─── Create Test Reel Post (agendado para 1h) ─────────────────────────────────

export async function createTestReelPost(
  workspaceId: string,
  platform: "instagram" | "facebook" | "tiktok",
  log: Logger,
): Promise<SocialPresencePost> {
  const scheduledFor = new Date(Date.now() + 60 * 60 * 1000); // 1h from now
  const hh = String(scheduledFor.getHours()).padStart(2, "0");
  const mm = String(scheduledFor.getMinutes()).padStart(2, "0");
  const dayOfWeek = scheduledFor.getDay(); // 0=Sun … 6=Sat
  const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0=Mon … 6=Sun
  const weekStart = currentPlanWeekStart(scheduledFor);

  const [post] = await db
    .insert(socialPresencePostsTable)
    .values({
      workspaceId,
      platform,
      status: "scheduled",
      weekStart,
      dayIndex,
      postingTime: `${hh}:${mm}`,
      scheduledFor,
      format: "reel",
      pillar: "produto",
      caption: [
        "🧠 Isso é o que acontece quando a IA cuida do próprio lançamento.",
        "",
        "A NexOS AI está gerenciando sua própria presença digital — criando posts, agendando reels, analisando métricas e publicando automaticamente enquanto você assiste.",
        "",
        "Sem equipe de marketing. Sem horas perdidas. Apenas resultado.",
        "",
        "↓ Veja o sistema rodando ao vivo.",
      ].join("\n"),
      hashtags: ["nexosai", "lancamentodigital", "ia", "marketingdigital", "automacao", "empreendedorismo", "agenteia"],
      visualDirection: [
        "Avatar digital NexOS falando diretamente para a câmera com tom confiante e inovador.",
        "Background tecnológico clean com partículas de dados roxas (#7C3AED).",
        "Texto em movimento: 'A IA gerenciando o próprio lançamento'.",
        "Corte dinâmico a cada 2s, luz environment suave, close no rosto do clone digital.",
      ].join(" "),
      videoScript: [
        "Você sabe o que é mais impressionante na NexOS AI?",
        "",
        "Ela está gerenciando o próprio lançamento.",
        "",
        "Esse reel que você está assistindo agora — foi planejado, roteirizado, e agendado por uma inteligência artificial.",
        "",
        "Enquanto você dormia, a NexOS criou o conteúdo.",
        "Enquanto você tomava café, ela agendou a publicação.",
        "E enquanto você trabalha, ela analisa os resultados e ajusta a estratégia.",
        "",
        "Isso é o futuro do marketing digital. E ele está disponível agora.",
        "",
        "Clique no link da bio e comece seu lançamento com IA.",
      ].join("\n"),
      objective: "Demonstrar na prática o poder da automação NexOS — reel gerado e publicado pela própria IA como prova de conceito do produto.",
      launchAligned: true,
      aiGenerated: true,
    })
    .returning();

  // Disparar geração de storyboard imediatamente
  setImmediate(() => {
    generatePostStoryboard(workspaceId, post.id, log).catch((err) => {
      log.warn({ err, postId: post.id }, "createTestReelPost: storyboard generation failed");
    });
  });

  log.info({ postId: post.id, platform, scheduledFor }, "createTestReelPost: reel de teste criado ✓");
  return post;
}

// ─── Criar publicação de teste agendada (suporta text/post/reel/story) ──────────
// Diferente do createTestReelPost (hardcoded NexOS), esta função usa o contexto
// real do negócio do workspace e suporta múltiplos formatos + timing personalizado.

export async function createTestScheduledPost(
  workspaceId: string,
  options: {
    platform: "instagram" | "facebook" | "tiktok";
    format: "text" | "post" | "reel" | "story";
    minutesFromNow: number;
    caption?: string;
  },
  log: Logger,
): Promise<SocialPresencePost> {
  const { platform, format, minutesFromNow, caption: inputCaption } = options;
  const scheduledFor = new Date(Date.now() + Math.max(5, minutesFromNow) * 60 * 1000);
  const hh = String(scheduledFor.getHours()).padStart(2, "0");
  const mm = String(scheduledFor.getMinutes()).padStart(2, "0");
  const dayOfWeek = scheduledFor.getDay();
  const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = currentPlanWeekStart(scheduledFor);

  // Usar contexto real do negócio para a legenda de teste
  const bctx = await fetchBusinessContextForWorkspace(workspaceId).catch(() => "");
  const timeLabel = scheduledFor.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const defaultCaption = inputCaption?.trim() || [
    `🧪 Publicação de teste — agendada para ${timeLabel}`,
    "",
    "Esta publicação foi criada para verificar que o sistema de agendamento automático está funcionando.",
    "Se você está vendo isso publicado no horário, a automação está operando corretamente! ✅",
  ].join("\n");

  // Formato real no banco — "text" mapeia para "post" internamente
  const dbFormat = format === "text" ? "post" : (format as "post" | "reel" | "story");

  const [post] = await db
    .insert(socialPresencePostsTable)
    .values({
      workspaceId,
      platform,
      status: "scheduled",
      weekStart,
      dayIndex,
      postingTime: `${hh}:${mm}`,
      scheduledFor,
      format: dbFormat,
      pillar: "autoridade",
      caption: defaultCaption,
      hashtags: ["teste", "publicacaoautomatica"],
      visualDirection: "Imagem profissional representando o negócio. Tom clean e moderno.",
      objective: "Verificar publicação automática agendada",
      aiGenerated: true,
    })
    .returning();

  const isTextOnly = format === "text";
  const isVideoFormat = format === "reel" || format === "story";

  // ── Texto puro no Facebook → nenhuma mídia necessária, publica direto ──────
  if (isTextOnly && platform === "facebook") {
    log.info({ postId: post.id, platform, scheduledFor }, "createTestScheduledPost: texto puro (Facebook) criado ✓");
    return post;
  }

  // ── Vídeo (reel/story) → pipeline normal de storyboard → aprovação ─────────
  if (isVideoFormat) {
    setImmediate(() => {
      generatePostStoryboard(workspaceId, post.id, log).catch((err) => {
        log.warn({ err, postId: post.id }, "createTestScheduledPost: storyboard de vídeo falhou");
      });
    });
    log.info({ postId: post.id, platform, format, scheduledFor }, "createTestScheduledPost: reel/story criado — storyboard iniciado ✓");
    return post;
  }

  // ── Imagem (post ou texto→Instagram) → gerar imagem IA + auto-aprovar ──────
  // Posts de imagem de teste pulam a etapa de aprovação manual do usuário.
  setImmediate(() => {
    generateAndAutoApproveTestImage(workspaceId, post.id, defaultCaption, bctx, log).catch((err) => {
      log.warn({ err, postId: post.id }, "createTestScheduledPost: auto-aprovação de imagem falhou");
    });
  });
  log.info({ postId: post.id, platform, format, scheduledFor }, "createTestScheduledPost: post de imagem criado — geração iniciada ✓");
  return post;
}

// Gera imagem de storyboard para posts de teste e a auto-aprova como mediaUrl
// (sem precisar da aprovação manual do usuário) para que o post publique no horário.
async function generateAndAutoApproveTestImage(
  workspaceId: string,
  postId: string,
  caption: string,
  bctx: string,
  log: Logger,
): Promise<void> {
  await db
    .update(socialPresencePostsTable)
    .set({ mediaGenStatus: "storyboard_generating" })
    .where(eq(socialPresencePostsTable.id, postId));

  const [post] = await db
    .select()
    .from(socialPresencePostsTable)
    .where(eq(socialPresencePostsTable.id, postId))
    .limit(1);
  if (!post) return;

  const { buf, mimeType, isAI } = await generateStoryboardFrame(
    post.visualDirection,
    caption,
    post.platform,
    post.format,
    log,
    undefined,
    bctx,
  );

  const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg").replace("svg+xml", "svg") ?? "jpg";
  const key = presenceStoryboardObjectKey(workspaceId, postId, 0).replace(/\.png$/, `.${ext}`);
  await uploadBufferToGCS(buf, key, mimeType);
  const serveUrl = `${env.APP_URL}/api/presence/media/serve?key=${encodeURIComponent(key)}`;

  if (isAI) {
    // Auto-aprovar: definir como mediaUrls diretamente (sem aprovação do usuário)
    // O post fica status="scheduled" com mídia pronta para publicar no horário.
    await db
      .update(socialPresencePostsTable)
      .set({
        status: "scheduled",
        mediaUrls: [serveUrl],
        storyboardUrls: [serveUrl],
        mediaGenStatus: null,
        errorMessage: null,
      })
      .where(eq(socialPresencePostsTable.id, postId));
    log.info({ postId, key }, "createTestScheduledPost: imagem gerada e auto-aprovada → pronto para publicar ✓");
  } else {
    // Fallback SVG → aguarda aprovação manual (melhor que nada)
    await db
      .update(socialPresencePostsTable)
      .set({
        mediaGenStatus: "storyboard_draft",
        storyboardUrls: [serveUrl],
        errorMessage: "Rascunho SVG — abra o post e aprove para publicar.",
      })
      .where(eq(socialPresencePostsTable.id, postId));
    log.warn({ postId, key }, "createTestScheduledPost: gerou SVG (sem chave IA) — requer aprovação manual");
  }
}

// ─── Auto-Highlight: adiciona story ao Destaque após publicação ───────────────

async function addStoryToHighlight(
  workspaceId: string,
  storyMediaId: string,
  highlightName: string,
  integration: { accessToken: string; accountId: string },
  log: { info(obj: object, msg: string): void; warn(obj: object, msg: string): void },
): Promise<void> {
  const token = integration.accessToken;
  const igAccountId = integration.accountId;

  // 1. Buscar highlights existentes
  const listRes = await fetch(
    `https://graph.facebook.com/v22.0/${igAccountId}/highlight_albums?fields=id,title&access_token=${token}`,
  );
  const listData = (await listRes.json()) as {
    data?: Array<{ id: string; title: string }>;
    error?: { message: string };
  };

  const existing = listData.data?.find(
    (h) => h.title.toLowerCase().trim() === highlightName.toLowerCase().trim(),
  );

  if (existing) {
    // 2a. Adicionar ao destaque existente
    await metaGraphFetch(`https://graph.facebook.com/v22.0/${existing.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_ids_to_add: storyMediaId, access_token: token }),
    });
    log.info({ postId: storyMediaId, highlight: highlightName }, "presence: story adicionada ao destaque existente");
  } else {
    // 2b. Criar novo destaque
    await metaGraphFetch(`https://graph.facebook.com/v22.0/${igAccountId}/highlight_albums`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: highlightName,
        media_ids: storyMediaId,
        cover_media_id: storyMediaId,
        access_token: token,
      }),
    });
    log.info({ postId: storyMediaId, highlight: highlightName }, "presence: novo destaque criado");
  }
}

// ─── DM keyword normalization ─────────────────────────────────────────────────
// Normaliza a mensagem recebida: remove pontuação, emojis e espaços extras,
// depois compara com a keyword. Ex: "Quero! 🔥" → "QUERO"; keyword "QUERO" → match.
function normalizeDmKeyword(text: string): string {
  return text
    .normalize("NFD")                        // decompor acentos
    .replace(/[\u0300-\u036f]/g, "")         // remover diacríticos
    .replace(/[^\p{L}\p{N}\s]/gu, " ")       // substituir pontuação/emojis por espaço
    .trim()
    .toUpperCase();
}

// Verifica se a mensagem contém a keyword (match exato de palavra inteira)
function messageMatchesKeyword(message: string, keyword: string): boolean {
  const normalizedMsg = normalizeDmKeyword(message);
  const normalizedKw = normalizeDmKeyword(keyword);
  // Match exato OU keyword está contida na mensagem como palavra completa
  if (normalizedMsg === normalizedKw) return true;
  const words = normalizedMsg.split(/\s+/);
  return words.includes(normalizedKw);
}

// ─── DM Sequences: processa steps pendentes a cada tick ──────────────────────

const MAX_STEP_RETRIES = 5; // desiste após 5 falhas consecutivas no mesmo step

export async function processDmSequences(): Promise<void> {
  const log = logger.child({ component: "dm-sequence-scheduler" });
  try {
    const now = new Date();
    const pending = await db
      .select()
      .from(instagramDmSequencesTable)
      .where(
        and(
          isNull(instagramDmSequencesTable.completedAt),
          lte(instagramDmSequencesTable.nextStepAt, now),
        ),
      )
      .limit(20);

    for (const seq of pending) {
      try {
        const step = seq.steps[seq.currentStep];
        if (!step) {
          // Sem mais steps — marcar completo
          await db
            .update(instagramDmSequencesTable)
            .set({ completedAt: new Date() })
            .where(eq(instagramDmSequencesTable.id, seq.id));
          continue;
        }

        // Buscar integração Instagram do workspace
        const [integration] = await db
          .select()
          .from(workspaceIntegrationsTable)
          .where(
            and(
              eq(workspaceIntegrationsTable.workspaceId, seq.workspaceId),
              eq(workspaceIntegrationsTable.provider, "instagram" as never),
              eq(workspaceIntegrationsTable.accountId, seq.igAccountId),
              eq(workspaceIntegrationsTable.status, "connected"),
            ),
          )
          .limit(1);

        if (!integration || !integration.accessToken?.trim() || !isOrganicSocialIntegration(integration.metadata as Record<string, unknown> | null)) continue;

        // Desistir após MAX_STEP_RETRIES falhas consecutivas no mesmo step
        if ((seq.retryCount ?? 0) >= MAX_STEP_RETRIES) {
          log.error(
            { seqId: seq.id, step: seq.currentStep, retryCount: seq.retryCount, lastError: seq.lastError },
            "dm-sequence: step abandonado após muitas falhas — marcando sequência como concluída",
          );
          await db
            .update(instagramDmSequencesTable)
            .set({ completedAt: new Date() })
            .where(eq(instagramDmSequencesTable.id, seq.id));
          continue;
        }

        // ── Lembrete de expiração ────────────────────────────────────────────
        const stepData = step as typeof step & {
          triggerKeyword?: string;
          reminderMessage?: string;
          reminderSent?: boolean;
        };
        if (
          stepData.triggerKeyword &&
          stepData.reminderMessage &&
          !stepData.reminderSent
        ) {
          const reminderRes = await metaGraphFetch(
            `https://graph.facebook.com/v22.0/${seq.igAccountId}/messages`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                recipient: { id: seq.recipientId },
                message: { text: stepData.reminderMessage },
                access_token: integration.accessToken,
              }),
            },
          );

          if (!reminderRes.ok) {
            const errBody = await reminderRes.text().catch(() => "(unreadable)");
            log.error(
              { seqId: seq.id, step: seq.currentStep, status: reminderRes.status, errBody },
              "dm-sequence: Graph API rejeitou lembrete — NÃO avançando step",
            );
            await db
              .update(instagramDmSequencesTable)
              .set({
                retryCount: (seq.retryCount ?? 0) + 1,
                lastError: `HTTP ${reminderRes.status}: ${errBody.slice(0, 500)}`,
                // Retry em 5 minutos
                nextStepAt: new Date(now.getTime() + 5 * 60 * 1000),
              })
              .where(eq(instagramDmSequencesTable.id, seq.id));
            continue;
          }

          const updatedSteps = [...seq.steps] as typeof seq.steps;
          (updatedSteps[seq.currentStep] as Record<string, unknown>).reminderSent = true;
          const reminderExtension = new Date(now.getTime() + 48 * 60 * 60 * 1000);
          await db
            .update(instagramDmSequencesTable)
            .set({ steps: updatedSteps, nextStepAt: reminderExtension, retryCount: 0, lastError: null })
            .where(eq(instagramDmSequencesTable.id, seq.id));

          log.info({ seqId: seq.id, step: seq.currentStep }, "dm-sequence: lembrete enviado (+48h)");
          continue;
        }
        // ─────────────────────────────────────────────────────────────────────

        const sendEvidence = await claimMetaWebhookEvent({
          workspaceId: seq.workspaceId,
          integrationId: integration.id,
          accountId: seq.igAccountId,
          providerEventId: `${seq.id}:${seq.currentStep}`,
          eventType: "instagram_dm",
          actionKey: "sequence_step",
          ruleRef: seq.postId ?? undefined,
        });
        if (!sendEvidence.claimed) {
          log.info({ seqId: seq.id, step: seq.currentStep }, "dm-sequence: outbound step already claimed");
          continue;
        }
        const outboundEndpoint = `/${seq.igAccountId}/messages`;
        const outboundRequest = { recipient: { id: seq.recipientId }, message: { text: step.message } };
        await recordMetaSendStarted(sendEvidence.id!, outboundEndpoint, outboundRequest);
        // Enviar mensagem principal via Graph API
        const sendRes = await metaGraphFetch(
          `https://graph.facebook.com/v22.0/${seq.igAccountId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipient: { id: seq.recipientId },
              message: { text: step.message },
              access_token: integration.accessToken,
            }),
          },
        );

        if (!sendRes.ok) {
          const errBody = await sendRes.text().catch(() => "(unreadable)");
          await recordMetaSendResult(sendEvidence.id!, { error: `HTTP ${sendRes.status}: ${errBody.slice(0, 500)}` });
          log.error(
            { seqId: seq.id, step: seq.currentStep, status: sendRes.status, errBody },
            "dm-sequence: Graph API rejeitou mensagem — NÃO avançando step",
          );
          await db
            .update(instagramDmSequencesTable)
            .set({
              retryCount: (seq.retryCount ?? 0) + 1,
              lastError: `HTTP ${sendRes.status}: ${errBody.slice(0, 500)}`,
              // Backoff progressivo: 5min → 15min → 30min → 1h → 2h
              nextStepAt: new Date(
                now.getTime() +
                  Math.min(2 * 60, 5 * Math.pow(2, seq.retryCount ?? 0)) * 60 * 1000,
              ),
            })
            .where(eq(instagramDmSequencesTable.id, seq.id));
          continue;
        }
        const sendData = await sendRes.clone().json().catch(() => ({})) as { message_id?: string; id?: string };
        await recordMetaSendResult(sendEvidence.id!, {
          providerResponse: sendData,
          providerMessageId: sendData.message_id ?? sendData.id,
        });

        // ✅ Envio bem-sucedido — avançar step e resetar retryCount
        const nextStep = seq.currentStep + 1;
        const nextStepData = seq.steps[nextStep] as (typeof seq.steps[number] & { triggerKeyword?: string }) | undefined;

        if (nextStepData) {
          const nextStepAt = nextStepData.triggerKeyword
            ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
            : new Date(now.getTime() + (nextStepData.delayMinutes ?? 0) * 60 * 1000);
          await db
            .update(instagramDmSequencesTable)
            .set({ currentStep: nextStep, nextStepAt, retryCount: 0, lastError: null })
            .where(eq(instagramDmSequencesTable.id, seq.id));
        } else {
          await db
            .update(instagramDmSequencesTable)
            .set({ currentStep: nextStep, completedAt: new Date(), retryCount: 0, lastError: null })
            .where(eq(instagramDmSequencesTable.id, seq.id));
        }

        log.info(
          { seqId: seq.id, step: seq.currentStep, nextStep },
          "dm-sequence: step enviado com sucesso ✓",
        );
      } catch (err) {
        log.warn({ err, seqId: seq.id }, "dm-sequence: erro inesperado no step (non-fatal)");
      }
    }
  } catch (err) {
    log.warn({ err }, "processDmSequences: tick error (non-fatal)");
  }
}

// ─── DM Trigger: dispara fluxo quando mensagem com keyword chega ─────────────

export async function handleInstagramDmTrigger(
  igAccountId: string,
  recipientId: string,
  messageText: string,
): Promise<void> {
  const log = logger.child({ component: "dm-trigger", igAccountId });
  try {
    // Encontrar workspace desta conta Instagram
    const [integration] = await db
      .select()
      .from(workspaceIntegrationsTable)
      .where(
        and(
          eq(workspaceIntegrationsTable.accountId, igAccountId),
          eq(workspaceIntegrationsTable.provider, "instagram" as never),
          eq(workspaceIntegrationsTable.status, "connected"),
        ),
      )
      .limit(1);

    if (
      !integration ||
      !integration.accessToken?.trim() ||
      !isOrganicSocialIntegration(integration.metadata as Record<string, unknown> | null)
    ) {
      log.warn({ igAccountId }, "Ignoring unroutable Meta DM webhook account");
      return;
    }

    // Buscar posts recentes (últimos 30 dias) com dmResponseFlow
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const posts = await db
      .select()
      .from(socialPresencePostsTable)
      .where(
        and(
          eq(socialPresencePostsTable.workspaceId, integration.workspaceId),
          eq(socialPresencePostsTable.platform, "instagram"),
          gte(socialPresencePostsTable.publishedAt, since),
        ),
      )
      .limit(50);

    for (const post of posts) {
      const flow = (post as { dmResponseFlow?: { triggerKeyword?: string; steps?: unknown[] } | null }).dmResponseFlow;
      if (!flow || !flow.triggerKeyword) continue;
      if (!messageMatchesKeyword(messageText, flow.triggerKeyword)) continue;
      if (!Array.isArray(flow.steps) || flow.steps.length === 0) continue;

      // Evitar duplicatas: verificar se já existe sequência ativa para este par
      const existing = await db
        .select({ id: instagramDmSequencesTable.id })
        .from(instagramDmSequencesTable)
        .where(
          and(
            eq(instagramDmSequencesTable.workspaceId, integration.workspaceId),
            eq(instagramDmSequencesTable.igAccountId, igAccountId),
            eq(instagramDmSequencesTable.recipientId, recipientId),
            isNull(instagramDmSequencesTable.completedAt),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        log.info({ recipientId }, "dm-trigger: sequência já ativa para este usuário — ignorando duplicata");
        return;
      }

      const firstStep = flow.steps[0] as { delayMinutes?: number };
      const nextStepAt = new Date(Date.now() + (firstStep.delayMinutes ?? 0) * 60 * 1000);

      await db.insert(instagramDmSequencesTable).values({
        workspaceId: integration.workspaceId,
        igAccountId,
        recipientId,
        postId: post.id,
        steps: flow.steps as never,
        currentStep: 0,
        nextStepAt,
      });

      log.info({ postId: post.id, keyword: normalizeDmKeyword(messageText), recipientId }, "dm-trigger: sequência criada (post-level)");
      // Processar o step 0 imediatamente se delayMinutes=0
      if ((firstStep.delayMinutes ?? 0) === 0) {
        setImmediate(() => processDmSequences().catch(() => {}));
      }
      return; // Disparou o primeiro match — sair
    }

    // ── Fallback: keyword global do workspace ──────────────────────────────────
    // Se nenhum post publicado tem um dmResponseFlow com essa keyword,
    // verificar workspace.settings.globalDmKeywords — salvo automaticamente
    // pelo gerador de semana. Funciona para posts antigos ou posts sem CTA de DM.
    const [ws] = await db
      .select({ settings: workspacesTable.settings })
      .from(workspacesTable)
      .where(eq(workspacesTable.id, integration.workspaceId))
      .limit(1);

    const globalKeywords = ((ws?.settings as Record<string, unknown> | null)?.globalDmKeywords as Array<{
      keyword: string;
      flow: { triggerKeyword?: string; steps?: unknown[] };
    }> | undefined) ?? [];

    const globalMatch = globalKeywords.find((k) => messageMatchesKeyword(messageText, k.keyword ?? ""));
    if (!globalMatch || !Array.isArray(globalMatch.flow?.steps) || globalMatch.flow.steps.length === 0) {
      log.info({ keyword: normalizeDmKeyword(messageText), recipientId, globalKeywordsCount: globalKeywords.length }, "dm-trigger: nenhum flow encontrado para keyword (post-level nem global)");
      return;
    }

    // Evitar duplicata de sequência ativa para o mesmo usuário
    const existingGlobal = await db
      .select({ id: instagramDmSequencesTable.id })
      .from(instagramDmSequencesTable)
      .where(
        and(
          eq(instagramDmSequencesTable.workspaceId, integration.workspaceId),
          eq(instagramDmSequencesTable.igAccountId, igAccountId),
          eq(instagramDmSequencesTable.recipientId, recipientId),
          isNull(instagramDmSequencesTable.completedAt),
        ),
      )
      .limit(1);

    if (existingGlobal.length > 0) {
      log.info({ recipientId }, "dm-trigger (global): sequência já ativa — ignorando");
      return;
    }

    const globalFirstStep = globalMatch.flow.steps[0] as { delayMinutes?: number };
    const globalNextStepAt = new Date(Date.now() + (globalFirstStep.delayMinutes ?? 0) * 60 * 1000);

    await db.insert(instagramDmSequencesTable).values({
      workspaceId: integration.workspaceId,
      igAccountId,
      recipientId,
      postId: null as never,
      steps: globalMatch.flow.steps as never,
      currentStep: 0,
      nextStepAt: globalNextStepAt,
    });

    log.info({ keyword: normalizeDmKeyword(messageText), recipientId }, "dm-trigger: sequência criada via global keyword fallback ✓");
    if ((globalFirstStep.delayMinutes ?? 0) === 0) {
      setImmediate(() => processDmSequences().catch(() => {}));
    }
  } catch (err) {
    log.warn({ err }, "handleInstagramDmTrigger: error (non-fatal)");
  }
}

// ─── DM Reply Handler: avança sequência quando usuário responde com keyword ──────
/**
 * Chamado quando o usuário responde a um DM com uma palavra-chave esperada.
 * Implementa o fluxo: Step 0 → "SEGUINDO" → entrega conteúdo → "COMPARTILHEI" → bônus.
 * Suporte ao requisito de Meta App Review: follow + share para desbloquear entregas.
 */
export async function handleIncomingDmReply(
  igAccountId: string,
  senderId: string,
  messageText: string,
): Promise<void> {
  const log = logger.child({ component: "dm-reply-handler", igAccountId });
  try {
    // Buscar sequências ativas para este usuário nesta conta Instagram
    const sequences = await db
      .select()
      .from(instagramDmSequencesTable)
      .where(
        and(
          eq(instagramDmSequencesTable.igAccountId, igAccountId),
          eq(instagramDmSequencesTable.recipientId, senderId),
          isNull(instagramDmSequencesTable.completedAt),
        ),
      )
      .limit(5);

    for (const seq of sequences) {
      const currentStepData = seq.steps[seq.currentStep] as
        | (typeof seq.steps[number] & { triggerKeyword?: string })
        | undefined;

      if (!currentStepData?.triggerKeyword) continue; // step por tempo, não por keyword
      if (!messageMatchesKeyword(messageText, currentStepData.triggerKeyword)) continue;

      // Keyword confere → avançar sequência imediatamente (nextStepAt = now)
      await db
        .update(instagramDmSequencesTable)
        .set({ nextStepAt: new Date() })
        .where(eq(instagramDmSequencesTable.id, seq.id));

      log.info(
        { seqId: seq.id, keyword: normalizeDmKeyword(messageText), step: seq.currentStep },
        "dm-reply: keyword recebida → sequência avançada imediatamente",
      );
      setImmediate(() => processDmSequences().catch(() => {}));
      return; // Só processa a primeira sequência ativa que bater
    }
  } catch (err) {
    log.warn({ err }, "handleIncomingDmReply: error (non-fatal)");
  }
}

/**
 * Lista sequências de DM do workspace para diagnóstico.
 * Retorna ativas + concluídas recentes (últimas 48h) com lastError e retryCount.
 */
export async function listDmSequences(workspaceId: string): Promise<typeof instagramDmSequencesTable.$inferSelect[]> {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  return db
    .select()
    .from(instagramDmSequencesTable)
    .where(
      and(
        eq(instagramDmSequencesTable.workspaceId, workspaceId),
        // Ativas (completedAt IS NULL) OU concluídas nas últimas 48h
        or(
          isNull(instagramDmSequencesTable.completedAt),
          gte(instagramDmSequencesTable.completedAt, since),
        ),
      ),
    )
    .orderBy(desc(instagramDmSequencesTable.createdAt))
    .limit(100);
}

/**
 * Segunda-feira 08h UTC — gera o plano da semana para todos os workspaces
 * com configuração de presença ativa que ainda não geraram esta semana.
 */
export async function generateWeekForAllActiveConfigs(): Promise<void> {
  const log = logger.child({ component: "presence-weekly-scheduler" });
  try {
    const weekStart = currentPlanWeekStart();
    const configs = await db
      .select()
      .from(socialPresenceConfigTable)
      .where(eq(socialPresenceConfigTable.active, true));

    for (const config of configs) {
      try {
        if (
          config.lastWeekGeneratedAt &&
          new Date(config.lastWeekGeneratedAt).getTime() >= weekStart.getTime()
        ) {
          continue; // já gerou esta semana
        }
        const enabled = (config.platforms ?? []).filter((p) => p.enabled);
        if (enabled.length === 0) continue;

        const result = await startGenerateWeek(config.workspaceId, log).catch((err) => {
          log.warn({ err, workspaceId: config.workspaceId }, "presence weekly: start failed");
          return null;
        });
        if (result?.started) {
          log.info({ workspaceId: config.workspaceId }, "presence weekly: generation started");
        }
      } catch (err) {
        log.warn({ err, workspaceId: config.workspaceId }, "presence weekly: workspace failed (continuing)");
      }
    }
  } catch (err) {
    logger.warn({ err }, "generateWeekForAllActiveConfigs: error (non-fatal)");
  }
}
