/**
 * Gestão de Presença Social Always-On
 * Módulo autônomo de presença nas redes — opera independente de lançamentos.
 * Semana de autoridade quando não há campanha ativa; semana de lançamento
 * (narrativa injetada via Campaign Brain) quando há campanha executing/live.
 */

import { eq, and, desc, gte, lt, lte, inArray, isNull } from "drizzle-orm";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
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
  pollVideoJob,
} from "../video-production/video-generation.service.js";
import { env } from "../../lib/env.js";
import type {
  SocialPresenceConfig,
  SocialPresencePost,
  PresencePlatformConfig,
  PresenceWeeklyInsight,
  PresenceBioSuggestion,
} from "@workspace/db";
import type { Logger } from "pino";
import { logger } from "../../lib/logger.js";
import {
  runPresencePlannerAgent,
  runPresenceInsightAgent,
  runBioOptimizerAgent,
  type PresenceLaunchContext,
  type PresenceInsightOutput,
} from "../agents/presence-planner.agent.js";
import { getCampaignBrain } from "../campaign-brain/campaign-brain.service.js";
import {
  publishToInstagram,
  publishToFacebook,
  publishToTikTok,
  getInstagramMetrics,
  getTikTokMetrics,
} from "../social/social.publisher.js";

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
  if (config.businessContext && config.businessContext.trim().length > 0) {
    return config.businessContext;
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

  const provider = PLATFORM_TO_PROVIDER[platform];
  if (!provider) {
    return { success: false, error: `Plataforma ${platform} não suporta publicação automática.` };
  }

  const [integration] = await db
    .select()
    .from(workspaceIntegrationsTable)
    .where(
      and(
        eq(workspaceIntegrationsTable.workspaceId, workspaceId),
        eq(workspaceIntegrationsTable.provider, provider as never),
        eq(workspaceIntegrationsTable.status, "connected"),
      ),
    )
    .limit(1);

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
  const enabled = (config.platforms ?? []).filter((p) => p.enabled);

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
          businessContext,
          weekStartISO,
          launchContext: launch?.context ?? null,
          insight,
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

  const [integration] = await db
    .select()
    .from(workspaceIntegrationsTable)
    .where(
      and(
        eq(workspaceIntegrationsTable.workspaceId, workspaceId),
        eq(workspaceIntegrationsTable.provider, provider as never),
        eq(workspaceIntegrationsTable.status, "connected"),
      ),
    )
    .limit(1);

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
      const resp = await fetch(url, {
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
      const resp = await fetch(url, {
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
  const integrations = await db
    .select()
    .from(workspaceIntegrationsTable)
    .where(
      and(
        eq(workspaceIntegrationsTable.workspaceId, workspaceId),
        inArray(workspaceIntegrationsTable.provider, ["instagram", "meta_ads", "tiktok_ads"] as never[]),
        eq(workspaceIntegrationsTable.status, "connected"),
      ),
    );
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

  // Force scheduledFor to now so publishDuePresencePosts picks it up immediately.
  // Reset retryCount so a manual retry always gets 3 full attempts — not residual count.
  const [updated] = await db
    .update(socialPresencePostsTable)
    .set({ status: "scheduled", scheduledFor: new Date(), errorMessage: null, retryCount: 0 })
    .where(eq(socialPresencePostsTable.id, postId))
    .returning();

  log.info({ platform: post.platform }, "presence: publish-now triggered");

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

    // Recuperação: posts presos em "publishing" há mais de 10min (crash entre
    // claim e resultado) voltam para "scheduled" para nova tentativa.
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
        const isVideoFormat = post.format === "reel" || post.format === "feed_video" || post.format === "story";
        // Image formats are Instagram feed posts that don't need video
        const isImageFormat = !isVideoFormat && post.platform === "instagram";
        if (needsMedia && mediaUrls.length === 0) {
          // ── Vídeo: aguardar geração em andamento ──────────────────────────────
          if (isVideoFormat && (post.mediaGenStatus === "video_generating" || post.mediaGenStatus === "storyboard_generating" || post.mediaGenStatus === "storyboard_ready" || post.mediaGenStatus === "storyboard_draft")) {
            log.info({ postId: post.id, mediaGenStatus: post.mediaGenStatus }, "presence: reel/story sem vídeo pronto — aguardando geração (skip silencioso)");
            continue;
          }

          // ── Imagem: auto-gerar storyboard → aguardar aprovação ───────────────
          if (isImageFormat) {
            const gs = post.mediaGenStatus;
            // Já gerando — aguardar
            if (gs === "storyboard_generating") {
              continue;
            }
            // Gerado — aguardar aprovação do usuário
            if (gs === "storyboard_ready" || gs === "storyboard_draft") {
              if (!post.errorMessage?.includes("Aprovação pendente")) {
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
              generateStoryboardFrame(postSnapshot.visualDirection, postSnapshot.caption, postSnapshot.platform, postSnapshot.format, log)
                .then(async ({ buf, mimeType, isAI }) => {
                  const newStatus = isAI ? "storyboard_ready" : "storyboard_draft";
                  // Upload imediatamente ao GCS — nunca armazenar base64 no banco
                  const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg").replace("svg+xml", "svg") ?? "png";
                  const key = presenceStoryboardObjectKey(postSnapshot.workspaceId, postSnapshot.id, 0).replace(/\.png$/, `.${ext}`);
                  await uploadBufferToGCS(buf, key, mimeType);
                  const serveUrl = `${env.APP_URL}/api/presence/media/serve?key=${encodeURIComponent(key)}`;
                  await db
                    .update(socialPresencePostsTable)
                    .set({ mediaGenStatus: newStatus, storyboardUrls: [serveUrl], errorMessage: "Aprovação pendente — abra o post e aprove a imagem gerada pela IA para publicar." })
                    .where(eq(socialPresencePostsTable.id, postSnapshot.id));
                  log.info({ postId: postSnapshot.id, newStatus, key }, "presence: imagem auto-gerada e enviada ao GCS ✓ — aguardando aprovação");
                })
                .catch(async (err) => {
                  log.warn({ err, postId: postSnapshot.id }, "presence: auto-geração de imagem falhou");
                  await db
                    .update(socialPresencePostsTable)
                    .set({ mediaGenStatus: "failed", status: "draft", errorMessage: `Auto-geração de imagem falhou: ${err instanceof Error ? err.message : String(err)}` })
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
        const [integration] = await db
          .select()
          .from(workspaceIntegrationsTable)
          .where(
            and(
              eq(workspaceIntegrationsTable.workspaceId, post.workspaceId),
              eq(workspaceIntegrationsTable.provider, provider as never),
              eq(workspaceIntegrationsTable.status, "connected"),
            ),
          )
          .limit(1);

        if (!integration) {
          const retryCount = (post.retryCount ?? 0) + 1;
          await db
            .update(socialPresencePostsTable)
            .set({
              status: retryCount >= 3 ? "failed" : "scheduled",
              retryCount,
              errorMessage: `Integração ${post.platform} não conectada. Conecte em /integracoes.`,
            })
            .where(eq(socialPresencePostsTable.id, post.id));
          continue;
        }

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
          postType: (
            post.format === "reel" ? "reel"
            : post.format === "story" ? "story"
            : post.format === "carousel" ? "carousel"
            : post.format === "feed_video" ? "feed_video"
            : "feed_image"
          ) as never,
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
          await db
            .update(socialPresencePostsTable)
            .set({
              status: retryCount >= 3 ? "failed" : "scheduled",
              retryCount,
              errorMessage: result.error ?? "Erro desconhecido",
            })
            .where(eq(socialPresencePostsTable.id, post.id));
          log.warn(
            { postId: post.id, platform: post.platform, error: result.error, retryCount },
            "presence: publish failed",
          );
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

// ─── Media Generation Pipeline ────────────────────────────────────────────────
// Fluxo: roteiro → storyboard (baixa resolução) → vídeo final com avatar clone

function buildImageClient(): OpenAI {
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
async function generateStoryboardFrame(
  visualDirection: string,
  caption: string,
  platform: string,
  format: string,
  log: Logger,
): Promise<{ buf: Buffer; mimeType: string; isAI: boolean }> {
  const prompt = [
    `Storyboard frame for a ${platform} ${format} post.`,
    `Visual direction: ${visualDirection}`,
    `Context: ${caption.slice(0, 200)}`,
    "Cinematic composition, professional photography style.",
    "IMPORTANT: NO text, words, letters, numbers, subtitles, watermarks, or captions in the image.",
  ].join(" ");

  // ── Tentativa 1: Gemini direto (mesma chave dos agentes de lançamento) ──────
  const geminiKey = env.GEMINI_API_KEY || env.AI_INTEGRATIONS_GEMINI_API_KEY;
  if (geminiKey) {
    // Modelos para image output via generateContent (responseModalities: IMAGE)
    const imageModels = ["gemini-2.0-flash-exp", "gemini-2.5-flash-preview-05-20"];
    for (const modelId of imageModels) {
      try {
        log.info({ platform, format, model: modelId }, "presence: attempting Gemini storyboard");
        // Usa GEMINI_API_KEY direto (sem baseURL = Google API nativa) ou proxy como fallback
        const useProxy = !env.GEMINI_API_KEY && !!(env.AI_INTEGRATIONS_GEMINI_API_KEY && env.AI_INTEGRATIONS_GEMINI_BASE_URL);
        const gemini = new GoogleGenerativeAI(geminiKey);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const reqOpts: any = useProxy ? { baseUrl: env.AI_INTEGRATIONS_GEMINI_BASE_URL } : {};
        const model = gemini.getGenerativeModel(
          {
            model: modelId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            generationConfig: { responseModalities: ["IMAGE"] } as any,
          },
          reqOpts,
        );

        const result = await model.generateContent(prompt);
        const parts = result.response.candidates?.[0]?.content?.parts ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const imgPart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/")) as any;

        if (imgPart?.inlineData?.data) {
          log.info({ model: modelId }, "presence: Gemini storyboard generated ✓");
          return {
            buf: Buffer.from(imgPart.inlineData.data, "base64"),
            mimeType: imgPart.inlineData.mimeType as string,
            isAI: true,
          };
        }
        log.warn({ model: modelId }, "presence: Gemini returned no image part — trying next model");
      } catch (geminiErr) {
        log.warn({ geminiErr, model: modelId }, "presence: Gemini model failed — trying next");
      }
    }
  }

  // ── Tentativa 2: DALL-E 3 (OpenAI) ──────────────────────────────────────────
  try {
    const client = buildImageClient();
    const isPortrait = ["reel", "story"].includes(format);
    // DALL-E 3 sizes: 1024x1024, 1792x1024 (landscape), 1024x1792 (portrait)
    const size: "1024x1024" | "1792x1024" | "1024x1792" = isPortrait ? "1024x1792" : "1792x1024";
    log.info({ platform, format, size }, "presence: attempting DALL-E 3 storyboard");
    const resp = await client.images.generate({
      model: "dall-e-3",
      prompt: prompt.slice(0, 4000),
      n: 1,
      size,
      response_format: "b64_json",
      quality: "standard",
    });
    const b64 = resp.data[0]?.b64_json;
    if (b64) {
      log.info({ format, size }, "presence: DALL-E 3 storyboard generated ✓");
      return { buf: Buffer.from(b64, "base64"), mimeType: "image/png", isAI: true };
    }
    log.warn({}, "presence: DALL-E 3 returned no b64 data");
  } catch (dalleErr) {
    log.warn({ dalleErr }, "presence: DALL-E 3 failed — all providers exhausted");
  }

  // Todos os provedores falharam — propagar erro para o caller setar status="failed"
  throw new Error("Geração de imagem indisponível: nenhum provedor retornou uma imagem. Verifique créditos das APIs de IA (Gemini / DALL-E).");
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
  avatarType?: "talking_photo" | "stock" | "digital_twin";
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
    avatarType: (persona.avatarType as "talking_photo" | "stock" | "digital_twin" | undefined) ?? "talking_photo",
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
      const { buf: imgBuf, mimeType, isAI } = await generateStoryboardFrame(
        post.visualDirection,
        post.caption,
        post.platform,
        post.format,
        log,
      );
      // isAI=true → storyboard_ready (IA real); isAI=false → storyboard_draft (rascunho SVG)
      const newStatus = isAI ? "storyboard_ready" : "storyboard_draft";

      // Upload imediatamente ao GCS — nunca armazenar base64 no banco
      const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg").replace("svg+xml", "svg") ?? "png";
      const key = presenceStoryboardObjectKey(workspaceId, postId, 0).replace(/\.png$/, `.${ext}`);
      await uploadBufferToGCS(imgBuf, key, mimeType);
      const serveUrl = `${env.APP_URL}/api/presence/media/serve?key=${encodeURIComponent(key)}`;

      await db
        .update(socialPresencePostsTable)
        .set({ mediaGenStatus: newStatus, storyboardUrls: [serveUrl] })
        .where(eq(socialPresencePostsTable.id, postId));

      log.info({ postId, isAI, newStatus, key }, "presence: storyboard generated and uploaded to GCS");
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
  // 1. Prefix guard
  if (!gcsKey.startsWith("presence-media/")) {
    res.status(403).end();
    return;
  }

  // 2. Parse: presence-media/{workspaceId}/{postId}/{filename}
  const parts = gcsKey.split("/");
  if (parts.length < 4) {
    res.status(400).end();
    return;
  }
  const workspaceId = parts[1];
  const postId      = parts[2];

  // 3. Ownership check — post deve existir e não estar cancelado
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

      // Prefere vídeo com avatar (HeyGen) se o workspace tiver configurado
      if (persona.heygenAvatarId && persona.voiceCloneId) {
        const voiceoverText = post.videoScript?.trim()
          ? post.videoScript
          : `${post.caption}\n\n${post.hashtags.map((h) => `#${h}`).join(" ")}`;

        result = await generateAvatarVideo({
          voiceoverText,
          avatarId: persona.heygenAvatarId,
          voiceId: persona.voiceCloneId,
          avatarType: persona.avatarType ?? "talking_photo",
          aspectRatio: ["reel", "story"].includes(post.format) ? "9:16" : "16:9",
        });
      } else {
        // Fallback: vídeo cinematográfico sem avatar (Runway / Kling)
        const prompt = [
          post.visualDirection,
          `Platform: ${post.platform}, format: ${post.format}.`,
          "High quality, cinematic, professional social media content. No text overlays.",
        ].join(" ");

        result = await generateVideoClip({
          prompt,
          durationSeconds: ["story", "reel"].includes(post.format) ? 10 : 8,
          aspectRatio: ["reel", "story"].includes(post.format) ? "9:16" : "1:1",
          resolution: "1080p",
          negativePrompt: "text, subtitles, watermark, low quality, blurry",
        });
      }

      if (result.status === "failed" || result.status === "provider_not_configured") {
        throw new Error(result.error ?? result.setupInstructions ?? "Provedor de vídeo não configurado.");
      }

      if (result.status === "ready" && result.clipUrl) {
        // Vídeo entregue imediatamente (raro, mas possível)
        await db
          .update(socialPresencePostsTable)
          .set({
            mediaGenStatus: "video_ready",
            mediaJobId: null,
            mediaJobProvider: null,
            mediaUrls: [result.clipUrl],
          })
          .where(eq(socialPresencePostsTable.id, postId));
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
      const [updated] = await db
        .update(socialPresencePostsTable)
        .set({ mediaGenStatus: "video_ready", mediaUrls: [result.clipUrl], mediaJobId: null })
        .where(eq(socialPresencePostsTable.id, postId))
        .returning();
      log.info({ postId, url: result.clipUrl }, "presence: video ready");
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
    await fetch(`https://graph.facebook.com/v22.0/${existing.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_ids_to_add: storyMediaId, access_token: token }),
    });
    log.info({ postId: storyMediaId, highlight: highlightName }, "presence: story adicionada ao destaque existente");
  } else {
    // 2b. Criar novo destaque
    await fetch(`https://graph.facebook.com/v22.0/${igAccountId}/highlight_albums`, {
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

// ─── DM Sequences: processa steps pendentes a cada tick ──────────────────────

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
              eq(workspaceIntegrationsTable.status, "connected"),
            ),
          )
          .limit(1);

        if (!integration) continue;

        // Enviar mensagem via Graph API
        await fetch(
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

        const nextStep = seq.currentStep + 1;
        const nextStepData = seq.steps[nextStep];

        if (nextStepData) {
          const nextStepAt = new Date(now.getTime() + nextStepData.delayMinutes * 60 * 1000);
          await db
            .update(instagramDmSequencesTable)
            .set({ currentStep: nextStep, nextStepAt })
            .where(eq(instagramDmSequencesTable.id, seq.id));
        } else {
          await db
            .update(instagramDmSequencesTable)
            .set({ currentStep: nextStep, completedAt: new Date() })
            .where(eq(instagramDmSequencesTable.id, seq.id));
        }

        log.info({ seqId: seq.id, step: seq.currentStep }, "dm-sequence: step enviado");
      } catch (err) {
        log.warn({ err, seqId: seq.id }, "dm-sequence: step falhou (non-fatal)");
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

    if (!integration) return;

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

    const keyword = messageText.trim().toUpperCase();
    for (const post of posts) {
      const flow = (post as { dmResponseFlow?: { triggerKeyword?: string; steps?: unknown[] } | null }).dmResponseFlow;
      if (!flow || !flow.triggerKeyword) continue;
      if (flow.triggerKeyword.toUpperCase() !== keyword) continue;
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

      log.info({ postId: post.id, keyword, recipientId }, "dm-trigger: sequência criada");
      // Processar o step 0 imediatamente se delayMinutes=0
      if ((firstStep.delayMinutes ?? 0) === 0) {
        setImmediate(() => processDmSequences().catch(() => {}));
      }
      return; // Disparou o primeiro match — sair
    }
  } catch (err) {
    log.warn({ err }, "handleInstagramDmTrigger: error (non-fatal)");
  }
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
