/**
 * Gestão de Presença Social Always-On
 * Módulo autônomo de presença nas redes — opera independente de lançamentos.
 * Semana de autoridade quando não há campanha ativa; semana de lançamento
 * (narrativa injetada via Campaign Brain) quando há campanha executing/live.
 */

import { eq, and, desc, gte, lt, lte, inArray } from "drizzle-orm";
import {
  db,
  socialPresenceConfigTable,
  socialPresencePostsTable,
  campaignsTable,
  workspaceIntegrationsTable,
} from "@workspace/db";
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
}

export async function upsertConfig(
  workspaceId: string,
  patch: ConfigPatch,
): Promise<SocialPresenceConfig> {
  const existing = await getConfig(workspaceId);
  if (existing) {
    const [updated] = await db
      .update(socialPresenceConfigTable)
      .set(patch)
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
          videoScript: post.videoScript ?? null,
          objective: post.objective,
          launchAligned: Boolean(launch),
          campaignId: launch?.campaignId ?? null,
          launchPhase: post.launchPhase ?? null,
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

        const mediaUrls = Array.isArray(post.mediaUrls) ? post.mediaUrls : [];
        const needsMedia = post.platform === "instagram" || post.platform === "tiktok";
        if (needsMedia && mediaUrls.length === 0) {
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
          postType: (post.format === "reel" ? "reel" : "feed_image") as never,
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
