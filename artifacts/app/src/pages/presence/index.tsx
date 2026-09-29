import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useAuth } from "@/lib/auth";
import { useWorkspaceSocket } from "@/lib/socket";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Share2, Settings, Sparkles, Loader2, RefreshCw, CheckCircle2,
  Clock, AlertTriangle, X, Instagram, Facebook, Music2, Linkedin,
  CalendarDays, ListChecks, BarChart3, Lightbulb, Copy, Check,
  Rocket, PenLine, ThumbsUp, Zap, Send, Link2Off, Film, ImageIcon, Upload,
  Search, TrendingUp, Target, ChevronDown, ChevronUp, Database
} from "lucide-react";
import { MediaProductionDrawer } from "./MediaProductionDrawer";
import type { MediaPresencePost } from "./MediaProductionDrawer";
import { useUiText, useUiLocale, intlLocale } from "@/lib/i18n";

const API = "/api/presence";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformConfig {
  platform: "instagram" | "facebook" | "tiktok" | "linkedin";
  enabled: boolean;
  postsPerDay: number;
  autoPublish: boolean;
  preferredTimes: string[];
}
interface WeeklyInsight {
  weekStart: string;
  summary: string;
  wins: string[];
  losses: string[];
  adjustments: string[];
  winningFormats: string[];
  generatedAt: string;
}
interface BioSuggestion {
  platform: string;
  bio: string;
  highlights: string[];
  keywords: string[];
  generatedAt: string;
}
interface PresenceConfig {
  id: string;
  active: boolean;
  platforms: PlatformConfig[];
  contentPillars: string[];
  tone: string;
  businessContext: string;
  alignedCampaignId: string | null;
  weeklyInsight: WeeklyInsight | null;
  bioSuggestions: BioSuggestion[];
  lastWeekGeneratedAt: string | null;
}
interface ActiveLaunch {
  campaignId: string;
  title: string;
  status: string;
}
interface PresenceIntelligenceContext {
  campaign: { id: string; title: string; status: string } | null;
  marketGap: { gap: string; opportunity: string } | null;
  triggers: string[];
  strategicPillars: string[];
  phase: string;
  source: "real_data" | "generic_fallback";
  sources: {
    marketIntel: boolean;
    psychologyLayer: boolean;
    campaignStrategy: boolean;
  };
}
interface PresencePost {
  id: string;
  platform: string;
  status: string;
  weekStart: string;
  dayIndex: number;
  postingTime: string;
  scheduledFor: string | null;
  format: string;
  pillar: string;
  caption: string;
  hashtags: string[];
  visualDirection: string;
  videoScript: string | null;
  mediaUrls: string[];
  objective: string;
  launchAligned: boolean;
  launchPhase: string | null;
  publishedAt: string | null;
  platformUrl: string | null;
  errorMessage: string | null;
  retryCount: number;
  manualRetryCount: number;
  metrics: { likes: number; comments: number; shares: number; views: number; reach: number; impressions: number };
  // Media production pipeline
  mediaGenStatus: string | null;
  storyboardUrls: string[];
  mediaJobId: string | null;
  mediaJobProvider: string | null;
}
interface MetricsOverview {
  totals: {
    published: number; scheduled: number; drafts: number; failed: number;
    reach: number; likes: number; comments: number; shares: number; views: number;
  };
  byPlatform: {
    platform: string; published: number; reach: number; likes: number;
    comments: number; engagementRate: number;
  }[];
  topPosts: PresencePost[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS: readonly (readonly [string, string, string])[] = [
  ["Seg", "Mon", "Lun"],
  ["Ter", "Tue", "Mar"],
  ["Qua", "Wed", "Mié"],
  ["Qui", "Thu", "Jue"],
  ["Sex", "Fri", "Vie"],
  ["Sáb", "Sat", "Sáb"],
  ["Dom", "Sun", "Dom"],
] as const;
const PLATFORM_META: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  instagram: { label: "Instagram", icon: Instagram, cls: "text-pink-400" },
  facebook:  { label: "Facebook",  icon: Facebook,  cls: "text-blue-400" },
  tiktok:    { label: "TikTok",    icon: Music2,    cls: "text-cyan-300" },
  linkedin:  { label: "LinkedIn",  icon: Linkedin,  cls: "text-sky-400" },
};
const STATUS_META: Record<string, { label: readonly [string, string, string]; cls: string }> = {
  draft:      { label: ["Rascunho", "Draft", "Borrador"], cls: "text-amber-400 border-amber-400/30 bg-amber-400/8" },
  scheduled:  { label: ["Agendado", "Scheduled", "Programado"], cls: "text-blue-400 border-blue-400/30 bg-blue-400/8" },
  publishing: { label: ["Publicando", "Publishing", "Publicando"], cls: "text-purple-400 border-purple-400/30 bg-purple-400/8" },
  published:  { label: ["Publicado", "Published", "Publicado"], cls: "text-green-400 border-green-400/30 bg-green-400/8" },
  failed:     { label: ["Falhou", "Failed", "Fallido"], cls: "text-destructive border-destructive/30 bg-destructive/8" },
  cancelled:  { label: ["Cancelado", "Cancelled", "Cancelado"], cls: "text-muted-foreground border-border bg-muted/30" },
};
const FORMAT_LABEL: Record<string, readonly [string, string, string]> = {
  reel: ["Reel", "Reel", "Reel"],
  carousel: ["Carrossel", "Carousel", "Carrusel"],
  feed: ["Feed", "Feed", "Feed"],
  story: ["Story", "Story", "Historia"],
  text: ["Texto", "Text", "Texto"],
  live: ["Live", "Live", "En vivo"],
};

function formatLabel(format: string, t: ReturnType<typeof useUiText>): string {
  const labels = FORMAT_LABEL[format];
  return labels ? t(...labels) : format;
}

function statusLabel(status: string, t: ReturnType<typeof useUiText>): string {
  const labels = STATUS_META[status]?.label;
  return labels ? t(...labels) : status;
}
const DEFAULT_PLATFORMS: PlatformConfig[] = [
  { platform: "instagram", enabled: true,  postsPerDay: 1, autoPublish: false, preferredTimes: ["12:00", "19:30"] },
  { platform: "facebook",  enabled: false, postsPerDay: 1, autoPublish: false, preferredTimes: ["12:00"] },
  { platform: "tiktok",    enabled: false, postsPerDay: 1, autoPublish: false, preferredTimes: ["18:00"] },
  { platform: "linkedin",  enabled: false, postsPerDay: 1, autoPublish: false, preferredTimes: ["09:00"] },
];

// ─── Rationale: por que este post segue esta lógica ──────────────────────────

function buildPostRationale(post: PresencePost, t: ReturnType<typeof useUiText>): string {
  const parts: string[] = [];

  const FORMAT_REASON: Record<string, string> = {
    reel: t("Reels têm alcance orgânico 3–5× maior que feed estático", "Reels get 3–5× more organic reach than static feed posts", "Los reels tienen entre 3 y 5 veces más alcance orgánico que las publicaciones estáticas"),
    carousel: t("Carrosseis geram mais salvamentos — ideais para conteúdo educativo", "Carousels earn more saves — ideal for educational content", "Los carruseles generan más guardados: ideales para contenido educativo"),
    story: t("Stories criam urgência e mantêm sua conta ativa no algoritmo diariamente", "Stories create urgency and keep your account active in the algorithm every day", "Las historias generan urgencia y mantienen tu cuenta activa en el algoritmo cada día"),
    feed: t("Posts de feed constroem autoridade permanente no perfil", "Feed posts build lasting authority on your profile", "Las publicaciones del feed construyen autoridad duradera en tu perfil"),
    text: t("Posts de texto geram alto engajamento em LinkedIn e perfis de autoridade", "Text posts drive high engagement on LinkedIn and authority profiles", "Las publicaciones de texto generan mucha interacción en LinkedIn y perfiles de autoridad"),
    live: t("Lives aumentam alcance imediato via notificações para seguidores", "Live streams boost immediate reach through follower notifications", "Los directos aumentan el alcance inmediato mediante notificaciones a tus seguidores"),
  };

  const PILLAR_REASON: Record<string, string> = {
    autoridade: t("posicionar você como referência no mercado", "position you as a market authority", "posicionarte como referente en el mercado"),
    produto: t("apresentar sua solução com prova de valor", "present your solution with proof of value", "presentar tu solución con pruebas de valor"),
    bastidores: t("humanizar a marca e criar conexão emocional", "humanize the brand and build an emotional connection", "humanizar la marca y crear una conexión emocional"),
    comunidade: t("fortalecer o senso de pertencimento da sua audiência", "strengthen your audience's sense of belonging", "reforzar el sentido de pertenencia de tu audiencia"),
    educacao: t("educar o mercado sobre o problema que você resolve", "educate the market about the problem you solve", "educar al mercado sobre el problema que resuelves"),
    lancamento: t("gerar aquecimento e antecipação para o lançamento", "build momentum and anticipation for the launch", "generar expectativa y anticipación para el lanzamiento"),
    depoimento: t("usar prova social para reduzir objeções de compra", "use social proof to reduce purchase objections", "usar prueba social para reducir las objeciones de compra"),
  };

  if (FORMAT_REASON[post.format]) parts.push(FORMAT_REASON[post.format]);

  const pillar = (post.pillar ?? "").toLowerCase().replace(/\s+/g, "").split(/[_-]/)[0];
  for (const [key, val] of Object.entries(PILLAR_REASON)) {
    if (pillar.includes(key)) { parts.push(t(`Pilar "${post.pillar}" — objetivo: ${val}`, `"${post.pillar}" pillar — objective: ${val}`, `Pilar "${post.pillar}" — objetivo: ${val}`)); break; }
  }

  if (post.launchAligned && post.launchPhase) {
    parts.push(t(`Alinhado à fase de ${post.launchPhase} do seu lançamento ativo`, `Aligned with the ${post.launchPhase} phase of your active launch`, `Alineado con la fase de ${post.launchPhase} de tu lanzamiento activo`));
  } else if (post.launchAligned) {
    parts.push(t("Alinhado ao seu lançamento ativo para maximizar aquecimento de audiência", "Aligned with your active launch to build audience momentum", "Alineado con tu lanzamiento activo para aumentar la expectativa de la audiencia"));
  }

  if (post.objective) parts.push(post.objective);

  return parts.slice(0, 2).join(". ");
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PresencePage() {
  const t = useUiText();
  const { locale } = useUiLocale();
  const numberLocale = intlLocale(locale);
  const { workspace } = useAuth();
  const [config, setConfig] = useState<PresenceConfig | null>(null);
  const [activeLaunch, setActiveLaunch] = useState<ActiveLaunch | null>(null);
  const [intelligenceContext, setIntelligenceContext] = useState<PresenceIntelligenceContext | null>(null);
  const [intelligenceExpanded, setIntelligenceExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [posts, setPosts] = useState<PresencePost[]>([]);
  const [metrics, setMetrics] = useState<MetricsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"calendar" | "queue" | "metrics">("calendar");
  const [showConfig, setShowConfig] = useState(false);
  const [showTestPost, setShowTestPost] = useState(false);
  const [showBio, setShowBio] = useState(false);
  const [optimizingBio, setOptimizingBio] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [publishingNow, setPublishingNow] = useState<Set<string>>(new Set());
  const [mediaDrawerPostId, setMediaDrawerPostId] = useState<string | null>(null);
  const [showProfileAnalysis, setShowProfileAnalysis] = useState(false);
  const [showScheduleTest, setShowScheduleTest] = useState(false);
  const [socialHealth, setSocialHealth] = useState<{
    provider: string;
    accountId: string | null;
    accountName: string | null;
    daysLeft: number | null;
    tokenExpired: boolean;
    expiringSoon: boolean;
    pingOk: boolean;
    pingStatus: number;
    liveAccountName: string | null;
    pingError: string | null;
    needsAction: boolean;
    statusLabel: string;
    connectedSince: string;
    lastUpdated: string;
    metadata: Record<string, unknown>;
  }[]>([]);
  const [healthChecking, setHealthChecking] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadConfig = useCallback(async () => {
    const data = await customFetch<{
      config: PresenceConfig | null;
      generating: boolean;
      currentWeekStart: string;
      activeLaunch: ActiveLaunch | null;
    }>(`${API}/config`);
    setConfig(data.config);
    setGenerating(data.generating);
    setActiveLaunch(data.activeLaunch);
    setWeekStart(data.currentWeekStart);
    return data;
  }, []);

  const loadPosts = useCallback(async () => {
    const data = await customFetch<{ posts: PresencePost[]; generating: boolean }>(`${API}/posts`);
    setPosts(data.posts);
    setGenerating(data.generating);
    return data;
  }, []);

  const loadIntelligenceContext = useCallback(async () => {
    const data = await customFetch<{ context: PresenceIntelligenceContext }>(`${API}/intelligence-context`);
    setIntelligenceContext(data.context);
  }, []);


  const loadMetrics = useCallback(async () => {
    const data = await customFetch<MetricsOverview>(`${API}/metrics`);
    setMetrics(data);
  }, []);

  const loadSocialHealth = useCallback(async (showSpinner = false) => {
    if (showSpinner) setHealthChecking(true);
    try {
      const data = await customFetch<{ integrations: typeof socialHealth }>("/api/integrations/oauth/social-health");
      setSocialHealth(data.integrations);
    } catch { /* não bloquear se health check falhar */ }
    finally { setHealthChecking(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([loadConfig(), loadPosts(), loadMetrics(), loadSocialHealth(), loadIntelligenceContext()]);
      } catch { /* sem config ainda */ }
      setLoading(false);
    })();
  }, [loadConfig, loadPosts, loadMetrics, loadIntelligenceContext]);

  // Relógio de 1s para countdown ao vivo
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Permissão de notificação do browser
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Socket: escuta publicações em tempo real → notificação push + reload
  useWorkspaceSocket(workspace?.id, (alert) => {
    if (alert.type === "presence_post_published") {
      loadPosts().catch(() => {});
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          const n = new Notification("NexOS · Post publicado!", {
            body: alert.message,
            icon: "/icon-192.png",
            tag: `presence-published-${alert.data?.postId ?? Date.now()}`,
          });
          setTimeout(() => n.close(), 8000);
        } catch { /* browser sem suporte */ }
      }
    }
  });

  // Poll enquanto gera
  useEffect(() => {
    if (generating && !pollRef.current) {
      pollRef.current = setInterval(async () => {
        try {
          const d = await loadPosts();
          if (!d.generating) {
            await Promise.all([loadConfig(), loadMetrics()]);
          }
        } catch { /* noop */ }
      }, 8000);
    }
    if (!generating && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [generating, loadPosts, loadConfig, loadMetrics]);

  const generateWeek = async (force = false) => {
    setActionError(null);
    try {
      await customFetch(`${API}/generate-week`, {
        method: "POST",
        body: JSON.stringify({ force }),
      });
      setGenerating(true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("Erro ao gerar plano semanal.", "Error generating weekly plan.", "Error al generar el plan semanal."));
    }
  };

  const approve = async (postId: string) => {
    setActionError(null);
    try {
      const { post } = await customFetch<{ post: PresencePost }>(`${API}/posts/${postId}/approve`, { method: "POST" });
      setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
      const scheduledAt = post.scheduledFor
        ? new Date(post.scheduledFor).toLocaleTimeString(numberLocale, { hour: "2-digit", minute: "2-digit" })
        : null;
      toast.success(
        scheduledAt
          ? t(`Aprovado — será publicado às ${scheduledAt}. Aparecerá na agenda.`, `Approved — it will be published at ${scheduledAt}. It will appear in the schedule.`, `Aprobado: se publicará a las ${scheduledAt}. Aparecerá en la agenda.`)
          : t("Post aprovado e adicionado à agenda de publicação.", "Post approved and added to the publishing schedule.", "Publicación aprobada y añadida a la agenda de publicación."),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("Erro ao aprovar post.", "Error approving post.", "Error al aprobar la publicación.");
      setActionError(msg);
      toast.error(msg);
    }
  };

  const [bulkApproving, setBulkApproving] = useState<Set<string>>(new Set());

  const bulkApprove = useCallback(async (postIds: string[], label: string) => {
    setActionError(null);
    const key = postIds.join(",");
    setBulkApproving((prev) => new Set([...prev, key]));
    try {
      const result = await customFetch<{ approved: number; videoTriggered: number; skipped: number; errors: string[] }>(
        `${API}/approve-bulk`,
        { method: "POST", body: JSON.stringify({ postIds }) },
      );
      await loadPosts();
      const n = result.approved ?? postIds.length;
      toast.success(
        t(
          `${n} post${n !== 1 ? "s" : ""} aprovado${n !== 1 ? "s" : ""} — aparecerão na agenda quando publicados.`,
          `${n} approved post${n !== 1 ? "s" : ""} — they will appear in the schedule when published.`,
          `${n} publicación${n !== 1 ? "es" : ""} aprobada${n !== 1 ? "s" : ""}: aparecerá${n !== 1 ? "n" : ""} en la agenda al publicarse.`,
        ),
      );
      if ((result.videoTriggered ?? 0) > 0) {
        toast.info(t(
          `${result.videoTriggered} vídeo${result.videoTriggered !== 1 ? "s" : ""} em geração — acompanhe na seção de reels.`,
          `${result.videoTriggered} video${result.videoTriggered !== 1 ? "s" : ""} generating — track progress in the Reels section.`,
          `${result.videoTriggered} vídeo${result.videoTriggered !== 1 ? "s" : ""} en generación: sigue el progreso en la sección de reels.`,
        ));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t(`Erro ao aprovar ${label}.`, `Error approving ${label}.`, `Error al aprobar ${label}.`);
      setActionError(msg);
      toast.error(msg);
    } finally {
      setBulkApproving((prev) => { const s = new Set(prev); s.delete(key); return s; });
    }
  }, [loadPosts, t]);

  const patchPost = async (postId: string, patch: Record<string, unknown>) => {
    setActionError(null);
    try {
      const { post } = await customFetch<{ post: PresencePost }>(`${API}/posts/${postId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("Erro ao atualizar post.", "Error updating post.", "Error al actualizar la publicación."));
    }
  };

  const publishNow = async (postId: string) => {
    setActionError(null);
    setPublishingNow((prev) => new Set(prev).add(postId));
    try {
      const { post } = await customFetch<{ post: PresencePost }>(`${API}/posts/${postId}/publish-now`, { method: "POST" });
      setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));

      // Poll and open the platform URL when the post is confirmed published
      const pollAndOpen = async () => {
        try {
          await loadPosts();
          // Find the updated post from the latest state
          const { post: fresh } = await customFetch<{ post: PresencePost }>(`${API}/posts/${postId}`);
          if (fresh.status === "published" && fresh.platformUrl) {
            window.open(fresh.platformUrl, "_blank", "noopener,noreferrer");
          } else if (fresh.status === "failed") {
            setActionError(fresh.errorMessage ?? t("Falha ao publicar na rede social.", "Failed to publish to the social network.", "No se pudo publicar en la red social."));
          }
        } catch { /* noop */ }
      };

      setTimeout(pollAndOpen, 5000);
      setTimeout(async () => { try { await loadPosts(); } catch { /* noop */ } }, 12000);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("Erro ao publicar post.", "Error publishing post.", "Error al publicar la publicación."));
    } finally {
      setPublishingNow((prev) => { const s = new Set(prev); s.delete(postId); return s; });
    }
  };

  const optimizeBio = async () => {
    setOptimizingBio(true);
    setActionError(null);
    try {
      await customFetch(`${API}/bio/optimize`, { method: "POST" });
      await loadConfig();
      setShowBio(true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("Erro ao otimizar bio.", "Error optimizing bio.", "Error al optimizar la biografía."));
    } finally {
      setOptimizingBio(false);
    }
  };

  const openMediaDrawer = useCallback((postId: string) => setMediaDrawerPostId(postId), []);

  /**
   * "Publicar Agora" com guarda de mídia:
   * - Se o post requer mídia (Instagram/TikTok, formato não-texto) e ainda não tem
   *   mediaUrls preenchido → abre o MediaProductionDrawer em vez de chamar publish-now.
   * - Só dispara publish-now quando a mídia já está presente (ou não é necessária).
   */
  const handlePublishNow = useCallback((postId: string) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const hasMedia = (post.mediaUrls?.length ?? 0) > 0;
    const needsMedia =
      REQUIRES_MEDIA.includes(post.platform) &&
      post.format !== "text" &&
      !hasMedia;
    if (needsMedia) {
      openMediaDrawer(postId);
    } else {
      publishNow(postId);
    }
  }, [posts, openMediaDrawer, publishNow]);

  const handleMediaDrawerUpdate = useCallback((updated: MediaPresencePost) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } as PresencePost : p)));
  }, []);

  const currentWeekPosts = posts.filter((p) => !weekStart || p.weekStart?.slice(0, 10) === weekStart.slice(0, 10));
  const drafts = posts.filter((p) => p.status === "draft");
  // Posts agendados com data passada que ainda não foram publicados (sem mídia ou com erro)
  const stuckScheduled = posts.filter(
    (p) =>
      p.status === "scheduled" &&
      p.scheduledFor !== null &&
      new Date(p.scheduledFor) < new Date() &&
      (!weekStart || p.weekStart?.slice(0, 10) !== weekStart.slice(0, 10)),
  );
  // Posts em processo de publicação — aparecem na fila enquanto o scheduler processa
  const publishingInProgress = posts.filter((p) => p.status === "publishing");
  // Posts com storyboard pronto aguardando aprovação criativa
  const pendingApproval = posts.filter(
    (p) => p.mediaGenStatus === "storyboard_ready" || p.mediaGenStatus === "storyboard_draft",
  );
  const queueItems = [...drafts, ...stuckScheduled, ...publishingInProgress];

  // Posts publicados nos últimos 30 dias — ficam visíveis como histórico
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentlyPublished = posts
    .filter(
      (p) =>
        p.status === "published" &&
        (p.publishedAt ? new Date(p.publishedAt) >= thirtyDaysAgo : true),
    )
    .sort((a, b) => {
      const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return db - da; // mais recente primeiro
    });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Share2 className="h-5 w-5 text-primary" /> {t("Presença Social", "Social Presence", "Presencia Social")}
            <Badge variant="outline" className="border-primary/30 text-primary">{t("Sempre ativo", "Always-On", "Siempre activo")}</Badge>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Sua marca viva nas redes todos os dias — com ou sem lançamento ativo.", "Keep your brand active on social media every day — with or without a live launch.", "Mantén tu marca activa en redes todos los días, con o sin un lanzamiento en curso.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {config && (
            <>
              <Button variant="outline" size="sm" onClick={optimizeBio} disabled={optimizingBio} data-testid="button-optimize-bio">
                {optimizingBio ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                {t("Otimizar Bio", "Optimize Bio", "Optimizar biografía")}
              </Button>
              <Button size="sm" onClick={() => generateWeek(currentWeekPosts.length > 0)} disabled={generating} data-testid="button-generate-week">
                {generating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
                {generating ? t("Gerando semana...", "Generating week...", "Generando la semana...") : currentWeekPosts.length > 0 ? t("Regenerar Semana", "Regenerate Week", "Regenerar semana") : t("Gerar Semana", "Generate Week", "Generar semana")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowScheduleTest(true)}
                title={t("Cria uma publicação real agendada para provar que o scheduler publica automaticamente", "Schedule a real post to confirm that the scheduler publishes automatically", "Programa una publicación real para comprobar que el programador publica automáticamente")}
                data-testid="button-schedule-test-post"
              >
                <CalendarDays className="mr-1.5 h-4 w-4" /> {t("Agendar Teste", "Schedule Test", "Programar prueba")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowTestPost(true)} data-testid="button-test-post-header">
                <Send className="mr-1.5 h-4 w-4" /> {t("Publicar Agora", "Publish Now", "Publicar ahora")}
              </Button>
            </>
          )}
          {config && (
            <Button variant="outline" size="sm" onClick={() => setShowProfileAnalysis(true)} data-testid="button-profile-analysis">
              <Search className="mr-1.5 h-4 w-4" /> {t("Analisar Perfil", "Analyze Profile", "Analizar perfil")}
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={() => setShowConfig(true)} aria-label={t("Configurações de presença", "Presence settings", "Configuración de presencia")} data-testid="button-presence-config">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Social connection health panel ──────────────────────────────────── */}
      {socialHealth.length > 0 && (
        <div className="rounded-xl border border-border bg-background/60 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Share2 className="h-4 w-4 text-primary" />
              {t("Status das conexões sociais", "Social connection status", "Estado de las conexiones sociales")}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => loadSocialHealth(true)}
              disabled={healthChecking}
            >
              {healthChecking
                ? <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />{t("Verificando…", "Checking…", "Verificando…")}</>
                : <><RefreshCw className="mr-1.5 h-3 w-3" />{t("Verificar agora", "Check now", "Verificar ahora")}</>}
            </Button>
          </div>

          <div className="space-y-2">
            {socialHealth.map((c) => {
              const providerLabel =
                c.provider === "instagram" ? "Instagram" :
                c.provider === "facebook" ? "Facebook" :
                c.provider === "meta_ads" ? "Facebook/Meta Ads" :
                c.provider === "tiktok_ads" ? "TikTok" : c.provider;

              const reconnectPlatform = c.provider.startsWith("tiktok") ? "tiktok" : "meta";

              // Linha de status verde / âmbar / vermelho
              const isOk = c.pingOk;
              const isCritical = !c.pingOk && (c.tokenExpired || c.statusLabel === "falhou_ping");
              const isWarning = !isCritical && (c.expiringSoon || !c.pingOk);

              return (
                <div
                  key={c.provider}
                  className={`rounded-lg border px-3 py-2.5 text-xs flex flex-wrap items-start gap-x-4 gap-y-1.5 ${
                    isOk
                      ? "border-green-500/25 bg-green-500/5"
                      : isCritical
                      ? "border-destructive/35 bg-destructive/6"
                      : "border-amber-500/35 bg-amber-500/6"
                  }`}
                >
                  {/* Status dot + nome */}
                  <div className="flex items-center gap-2 min-w-[130px]">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${isOk ? "bg-green-500" : isCritical ? "bg-destructive" : "bg-amber-400"}`} />
                    <span className={`font-medium ${isOk ? "text-green-400" : isCritical ? "text-destructive" : "text-amber-400"}`}>
                      {providerLabel}
                    </span>
                  </div>

                  {/* Conta confirmada pela rede */}
                  <div className="flex-1 space-y-0.5">
                    {c.pingOk && c.liveAccountName && (
                      <p className="text-green-400">
                        ✓ {t("Conectado como", "Connected as", "Conectado como")} <strong>{c.liveAccountName}</strong>
                        {c.accountId && <span className="text-muted-foreground ml-1">(ID: {c.accountId})</span>}
                      </p>
                    )}
                    {!c.pingOk && (
                      <p className="text-destructive">
                         ✗ {t("Ping falhou —", "Ping failed —", "Falló la comprobación —")} {c.pingError ?? t("sem resposta da rede social", "no response from the social network", "sin respuesta de la red social")}
                      </p>
                    )}
                    {c.accountName && !c.liveAccountName && (
                       <p className="text-muted-foreground">{t("Conta salva:", "Saved account:", "Cuenta guardada:")} {c.accountName}</p>
                    )}
                    {c.daysLeft !== null && (
                      <p className={c.tokenExpired ? "text-destructive" : c.expiringSoon ? "text-amber-400" : "text-muted-foreground"}>
                        Token: {c.tokenExpired
                          ? "EXPIRADO"
                          : c.daysLeft > 365
                           ? t("sem expiração definida", "no expiration set", "sin fecha de vencimiento")
                           : t(`expira em ${c.daysLeft} dia${c.daysLeft === 1 ? "" : "s"}`, `expires in ${c.daysLeft} day${c.daysLeft === 1 ? "" : "s"}`, `vence en ${c.daysLeft} día${c.daysLeft === 1 ? "" : "s"}`)}
                      </p>
                    )}
                  </div>

                  {/* Ação */}
                  {(!c.pingOk || c.tokenExpired || c.expiringSoon) && (
                    <a
                      href={`/api/integrations/oauth/start/${reconnectPlatform}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`shrink-0 self-start rounded border px-2.5 py-1 font-medium hover:bg-white/5 transition-colors ${
                        isCritical ? "border-destructive/50 text-destructive" : "border-amber-500/50 text-amber-400"
                      }`}
                    >
                      {t("Reconectar →", "Reconnect →", "Volver a conectar →")}
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          {socialHealth.every((c) => c.pingOk) && (
            <p className="text-xs text-green-400/70 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t("Todas as redes confirmaram conexão ativa — publicação autônoma operacional.", "All networks confirmed an active connection — automatic publishing is operational.", "Todas las redes confirmaron una conexión activa: la publicación automática está operativa.")}
            </p>
          )}
        </div>
      )}

      {/* Campaign alignment badge — shown only if user chose one (or auto-detected active launch) */}
      {activeLaunch ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/25 bg-primary/5 px-4 py-2.5 text-sm">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 shrink-0 text-primary" />
            <span>
              {t("Conteúdo alinhado à campanha", "Content aligned with campaign", "Contenido alineado con la campaña")}{" "}
              <span className="text-primary font-medium">{activeLaunch.title}</span>
            </span>
          </div>
          <button
            className="text-xs text-muted-foreground/50 hover:text-muted-foreground underline underline-offset-2 shrink-0"
            onClick={() => setShowConfig(true)}
          >
            {t("Alterar", "Change", "Cambiar")}
          </button>
        </div>
      ) : config ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-border/40 bg-card/30 px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">
              {t("Para conteúdos mais alinhados, configure o", "For better-aligned content, configure the", "Para crear contenido más alineado, configura el")} <strong className="text-foreground font-medium">Briefing Central</strong> {t("do seu produto.", "for your product.", "de tu producto.")}
            </span>
          </div>
          <a
            href="/intake?entryPoint=social_media"
            className="text-xs font-mono uppercase tracking-widest text-primary hover:text-primary/80 border border-primary/30 px-3 py-1.5 rounded-sm hover:bg-primary/10 transition-colors"
          >
            {t("Acessar Briefing Central", "Open Central Brief", "Abrir Brief Central")}
          </a>
        </div>
      ) : null}
      {!activeLaunch && config && (
        <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/10 px-4 py-2.5 text-sm text-muted-foreground/60">
          <Link2Off className="h-4 w-4 shrink-0" />
          <span>{t("Sem alinhamento de campanha — conteúdo de autoridade independente.", "No campaign alignment — independent authority content.", "Sin alineación con una campaña: contenido de autoridad independiente.")}</span>
          <button
            className="ml-auto text-xs text-muted-foreground/50 hover:text-muted-foreground underline underline-offset-2 shrink-0"
            onClick={() => setShowConfig(true)}
          >
            {t("Alinhar", "Align", "Alinear")}
          </button>
        </div>
      )}

      {config && intelligenceContext && (
        <div className="overflow-hidden rounded-xl border border-primary/20 bg-card/40">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-primary/5 transition-colors"
            onClick={() => setIntelligenceExpanded((value) => !value)}
            aria-expanded={intelligenceExpanded}
            data-testid="button-campaign-intelligence"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{t("Inteligência da Campanha Ativa", "Active Campaign Intelligence", "Inteligencia de la campaña activa")}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {intelligenceContext.campaign?.title ?? t("Sem campanha alinhada", "No aligned campaign", "Ninguna campaña alineada")} · {intelligenceContext.phase}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge
                variant="outline"
                className={intelligenceContext.source === "real_data"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-400"}
              >
                {intelligenceContext.source === "real_data" ? t("Dados reais", "Real data", "Datos reales") : t("Fallback genérico", "Generic fallback", "Datos genéricos")}
              </Badge>
              {intelligenceExpanded
                ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </button>

          {intelligenceExpanded && (
            <div className="grid gap-3 border-t border-border/60 p-4 md:grid-cols-3">
              <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Target className="h-3.5 w-3.5 text-primary" /> {t("Gap de mercado", "Market gap", "Brecha de mercado")}
                </p>
                {intelligenceContext.marketGap ? (
                  <>
                    <p className="text-sm font-medium">{intelligenceContext.marketGap.gap}</p>
                    {intelligenceContext.marketGap.opportunity && (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{intelligenceContext.marketGap.opportunity}</p>
                    )}
                  </>
                ) : (
                   <p className="text-xs text-muted-foreground">{t("Nenhum relatório de mercado vinculado a esta campanha.", "No market report is linked to this campaign.", "No hay ningún informe de mercado vinculado a esta campaña.")}</p>
                )}
              </div>

              <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                   <Zap className="h-3.5 w-3.5 text-primary" /> {t("Gatilhos principais", "Key triggers", "Desencadenantes principales")}
                </p>
                {intelligenceContext.triggers.length > 0 ? (
                  <ul className="space-y-1.5 text-xs">
                    {intelligenceContext.triggers.map((trigger, index) => (
                      <li key={`${trigger}-${index}`} className="flex gap-2">
                        <span className="text-primary">•</span><span>{trigger}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                   <p className="text-xs text-muted-foreground">{t("A camada de psicologia ainda não gerou gatilhos.", "The psychology layer has not generated any triggers yet.", "La capa de psicología todavía no ha generado desencadenantes.")}</p>
                )}
              </div>

              <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                   <ListChecks className="h-3.5 w-3.5 text-primary" /> {t("Sequência de pilares", "Pillar sequence", "Secuencia de pilares")}
                </p>
                {intelligenceContext.strategicPillars.length > 0 ? (
                  <ol className="space-y-1.5 text-xs">
                    {intelligenceContext.strategicPillars.map((pillar, index) => (
                      <li key={`${pillar}-${index}`} className="flex gap-2">
                        <span className="font-mono text-primary">{index + 1}.</span><span>{pillar}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                   <p className="text-xs text-muted-foreground">{t("Nenhum pilar estratégico definido para esta fase.", "No strategic pillars have been defined for this phase.", "No se han definido pilares estratégicos para esta fase.")}</p>
                )}
              </div>

              <p className="md:col-span-3 text-[11px] text-muted-foreground">
                {intelligenceContext.source === "real_data"
                  ? t("Este contexto é injetado na geração da semana. As fontes disponíveis estão vinculadas à campanha selecionada.", "This context is used to generate the weekly plan. Available sources are linked to the selected campaign.", "Este contexto se incorpora a la generación semanal. Las fuentes disponibles están vinculadas a la campaña seleccionada.")
                  : t("A geração usa o contexto geral do negócio até que uma campanha com inteligência especializada seja alinhada.", "Generation uses general business context until a campaign with specialized intelligence is aligned.", "La generación usa el contexto general del negocio hasta que se alinee una campaña con inteligencia especializada.")}
              </p>
            </div>
          )}
        </div>
      )}

      {actionError && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-2.5 text-sm text-destructive">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /> {actionError}</span>
          <button onClick={() => setActionError(null)} aria-label={t("Fechar aviso", "Close notice", "Cerrar aviso")}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Empty state — sem configuração */}
      {!config ? (
        <div className="rounded-xl border border-border bg-card/50 p-10 text-center">
          <Share2 className="mx-auto h-10 w-10 text-primary/60" />
          <h2 className="mt-4 text-lg font-medium">{t("Ative sua presença social", "Activate your social presence", "Activa tu presencia en redes")}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {t("A IA gera um plano semanal de posts para suas redes toda segunda-feira — semana de autoridade quando não há lançamento, semana de aquecimento quando há campanha ativa.", "AI creates a weekly social post plan every Monday — authority content when there is no launch, and warm-up content when a campaign is active.", "La IA crea un plan semanal de publicaciones cada lunes: contenido de autoridad si no hay un lanzamiento y de expectativa cuando hay una campaña activa.")}
          </p>
          <Button className="mt-5" onClick={() => setShowConfig(true)} data-testid="button-setup-presence">
            <Settings className="mr-1.5 h-4 w-4" /> {t("Configurar Presença", "Set Up Presence", "Configurar presencia")}
          </Button>
        </div>
      ) : (
        <>
          {/* Insight da Semana */}
          {config.weeklyInsight?.summary && (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-400">
                <Lightbulb className="h-4 w-4" /> {t("Insight da Semana", "Weekly Insight", "Perspectiva de la semana")}
              </div>
              <p className="mt-2 text-sm">{config.weeklyInsight.summary}</p>
              {config.weeklyInsight.adjustments.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {config.weeklyInsight.adjustments.slice(0, 3).map((a, i) => (
                    <li key={i} className="flex gap-2"><span className="text-amber-400">→</span>{a}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Stats strip */}
          {metrics && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                { label: t("Publicados (30d)", "Published (30d)", "Publicados (30 días)"), value: metrics.totals.published },
                { label: t("Agendados", "Scheduled", "Programados"), value: metrics.totals.scheduled },
                { label: t("Aguardando aprovação", "Awaiting approval", "Pendientes de aprobación"), value: metrics.totals.drafts },
                { label: t("Alcance total", "Total reach", "Alcance total"), value: metrics.totals.reach.toLocaleString(numberLocale) },
                { label: t("Curtidas", "Likes", "Me gusta"), value: metrics.totals.likes.toLocaleString(numberLocale) },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border bg-card/50 px-4 py-3">
                  <div className="text-lg font-semibold">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Countdown — próximas publicações ─────────────────────────── */}
          {(() => {
            const upcoming = posts
              .filter(
                (p) =>
                  p.status === "scheduled" &&
                  p.scheduledFor !== null &&
                  new Date(p.scheduledFor).getTime() > nowTick,
              )
              .sort(
                (a, b) =>
                  new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime(),
              )
              .slice(0, 3);
            if (upcoming.length === 0) return null;

            const fmt = (ms: number) => {
              const s = Math.floor(ms / 1000);
              const m = Math.floor(s / 60);
              const h = Math.floor(m / 60);
              if (h > 0) return `${h}h ${m % 60}m`;
              if (m > 0) return `${m}m ${s % 60}s`;
              return `${s}s`;
            };

            return (
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
                  <Rocket className="h-3.5 w-3.5" />
                  {t("Próximas publicações automáticas", "Upcoming automatic posts", "Próximas publicaciones automáticas")}
                  <span className="ml-auto text-muted-foreground font-normal normal-case tracking-normal">
                    {t("Você receberá uma notificação quando publicar", "You will receive a notification when it publishes", "Recibirás una notificación cuando se publique")}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {upcoming.map((p) => {
                    const msLeft = new Date(p.scheduledFor!).getTime() - nowTick;
                    const PlatIcon = PLATFORM_META[p.platform]?.icon ?? Share2;
                    const hasIssue = !!p.errorMessage || (
                      (p.platform === "instagram" || p.platform === "tiktok") &&
                      (!p.mediaUrls || (p.mediaUrls as string[]).length === 0)
                    );
                    return (
                      <button
                        key={p.id}
                        onClick={() => openMediaDrawer(p.id)}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/40 active:scale-[0.98] ${
                          hasIssue
                            ? "border-amber-500/40 bg-amber-500/5"
                            : "border-border bg-background/60"
                        }`}
                        title={t("Clique para ver o post", "Click to view the post", "Haz clic para ver la publicación")}
                      >
                        <PlatIcon className={`h-4 w-4 shrink-0 ${PLATFORM_META[p.platform]?.cls ?? ""}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span className="truncate text-xs font-medium capitalize">{p.format}</span>
                            {hasIssue && <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {p.errorMessage
                              ? <span className="text-amber-400">{p.errorMessage.slice(0, 40)}…</span>
                              : p.postingTime}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className={`font-mono text-sm font-bold tabular-nums ${hasIssue ? "text-amber-400" : "text-primary"}`}>
                            {fmt(msLeft)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {hasIssue ? t("com problema", "needs attention", "con un problema") : t("entra no ar", "goes live", "se publica")}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Tabs */}
          <div className="flex gap-1 border-b border-border">
            {[
              { id: "calendar" as const, label: t("Calendário da Semana", "Weekly Calendar", "Calendario semanal"), icon: CalendarDays },
              { id: "queue" as const, label: `${t("Aprovação Criativa", "Creative Approval", "Aprobación creativa")}${(pendingApproval.length + queueItems.length) ? ` (${pendingApproval.length + queueItems.length})` : ""}`, icon: ListChecks },
              { id: "metrics" as const, label: t("Métricas", "Metrics", "Métricas"), icon: BarChart3 },
            ].map((tabItem) => (
              <button
                key={tabItem.id}
                onClick={() => setTab(tabItem.id)}
                data-testid={`tab-${tabItem.id}`}
                className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm transition-colors ${
                  tab === tabItem.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <tabItem.icon className="h-4 w-4" /> {tabItem.label}
              </button>
            ))}
          </div>

          {/* Calendário */}
          {tab === "calendar" && (
            currentWeekPosts.length === 0 ? (
              <EmptyWeek generating={generating} onGenerate={() => generateWeek(false)} />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
                {DAYS.map((day, idx) => {
                  const dayPosts = currentWeekPosts
                    .filter((p) => p.dayIndex === idx && p.status !== "cancelled")
                    .sort((a, b) => a.postingTime.localeCompare(b.postingTime));
                  return (
                    <div key={idx} className="min-h-24 rounded-lg border border-border bg-card/40 p-2">
                      <div className="mb-2 text-center text-xs font-medium text-muted-foreground">{t(...day)}</div>
                      <div className="space-y-2">
                        {dayPosts.map((p) => (
                          <CalendarPostCard
                            key={p.id}
                            post={p}
                            expanded={expanded === p.id}
                            onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
                            onApprove={() => approve(p.id)}
                            onCancel={() => patchPost(p.id, { status: "cancelled" })}
                            onMarkPublished={() => patchPost(p.id, { status: "published" })}
                            onPublishNow={() => handlePublishNow(p.id)}
                            publishingNow={publishingNow.has(p.id)}
                            onOpenMediaDrawer={() => openMediaDrawer(p.id)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* Aprovação Criativa */}
          {tab === "queue" && (
            <div className="space-y-6">

              {/* ── Seção principal: storyboards aguardando decisão criativa ── */}
              {pendingApproval.length > 0 && (
                <div className="space-y-4">
                  {/* Contexto racional: por que isso funciona assim */}
                  <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm space-y-2">
                    <p className="font-medium text-primary flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" />
                       {t("Por que você aprova antes de publicar?", "Why do you approve before publishing?", "¿Por qué apruebas antes de publicar?")}
                    </p>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {t("A IA planejou e gerou o conteúdo com base nos seus objetivos reais — produto, promessa, público-alvo e fase do lançamento. Mas cada post é uma decisão criativa sua: ele representa a sua voz, sua marca, sua reputação. Você revisa uma vez, aprova, e a partir daí tudo roda automaticamente. Para imagens: aprovação → publicação automática. Para vídeos: aprovação → geração automática do vídeo com seu avatar. Nenhuma outra etapa necessária.", "AI planned and created this content around your real goals — product, promise, audience, and launch phase. But each post is your creative decision: it represents your voice, brand, and reputation. Review and approve it once, then everything runs automatically. Images: approval → automatic publishing. Videos: approval → automatic video generation with your avatar. No further steps required.", "La IA planificó y creó el contenido según tus objetivos reales —producto, promesa, público y fase del lanzamiento—. Pero cada publicación es una decisión creativa tuya: representa tu voz, marca y reputación. Revísala y apruébala una vez; a partir de ahí, todo funciona automáticamente. Imágenes: aprobación → publicación automática. Vídeos: aprobación → generación automática con tu avatar. No se necesitan más pasos.")}
                    </p>
                  </div>

                  {/* Aprovação em lote: toda semana */}
                  {pendingApproval.length > 1 && (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{t(`${pendingApproval.length} posts prontos para revisão`, `${pendingApproval.length} posts ready for review`, `${pendingApproval.length} publicaciones listas para revisar`)}</p>
                        <p className="text-xs text-muted-foreground">{t("Aprovar tudo dispara imagens + geração de vídeo automaticamente", "Approving all starts image creation and video generation automatically", "Al aprobar todo, se inicia automáticamente la creación de imágenes y vídeos")}</p>
                      </div>
                      <button
                        onClick={() => bulkApprove(pendingApproval.map(p => p.id), t("toda a semana", "the whole week", "toda la semana"))}
                        disabled={bulkApproving.size > 0}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                      >
                        {bulkApproving.size > 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
                        {t("Aprovar Semana Toda", "Approve Entire Week", "Aprobar toda la semana")}
                      </button>
                    </div>
                  )}

                  {/* Agrupado por dia */}
                  {DAYS.map((dayName, idx) => {
                    const dayPosts = pendingApproval.filter((p) => p.dayIndex === idx);
                    if (dayPosts.length === 0) return null;
                    const localizedDay = t(...dayName);
                    const dayKey = dayPosts.map(p => p.id).join(",");
                    const isApproving = bulkApproving.has(dayKey);
                    return (
                      <div key={idx} className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{localizedDay}</span>
                            <span className="text-xs text-muted-foreground">
                              {t(`${dayPosts.length} post${dayPosts.length > 1 ? "s" : ""} aguardando`, `${dayPosts.length} post${dayPosts.length > 1 ? "s" : ""} awaiting approval`, `${dayPosts.length} publicación${dayPosts.length > 1 ? "es" : ""} pendiente${dayPosts.length > 1 ? "s" : ""}`)}
                            </span>
                          </div>
                          {dayPosts.length > 0 && (
                            <button
                              onClick={() => bulkApprove(dayPosts.map(p => p.id), localizedDay)}
                              disabled={bulkApproving.size > 0}
                              className="rounded-md border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50 flex items-center gap-1"
                            >
                              {isApproving ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
                              {t(`Aprovar ${localizedDay}`, `Approve ${localizedDay}`, `Aprobar ${localizedDay}`)}
                            </button>
                          )}
                        </div>
                        {dayPosts.map((p) => {
                          const isVideoFormat = ["reel", "feed_video", "story"].includes(p.format);
                          const rationale = buildPostRationale(p, t);
                          const storyboardUrl = p.storyboardUrls?.[0];
                          const isReady = p.mediaGenStatus === "storyboard_ready";
                          const isTestReel = p.caption?.includes("cuida do próprio lançamento");
                          return (
                            <div key={p.id} className={`rounded-xl border ${isTestReel ? "border-orange-400/50 bg-orange-400/5 ring-1 ring-orange-400/30" : isReady ? "border-primary/25 bg-primary/5" : "border-amber-400/20 bg-amber-400/5"} p-4 space-y-3`}>
                              {/* Storyboard preview + info */}
                              <div className="flex gap-3">
                                {/* Thumbnail */}
                                <div className="relative shrink-0 w-16 h-16 rounded-lg border border-border overflow-hidden bg-muted/30">
                                  {storyboardUrl ? (
                                    <img src={storyboardUrl} alt={t("storyboard", "storyboard", "guion gráfico")} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="flex items-center justify-center h-full">
                                      {isVideoFormat ? <Film className="h-5 w-5 text-muted-foreground/40" /> : <ImageIcon className="h-5 w-5 text-muted-foreground/40" />}
                                    </div>
                                  )}
                                  {isVideoFormat && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                      <Film className="h-4 w-4 text-white" />
                                    </div>
                                  )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0 space-y-1">
                                  {isTestReel && (
                                    <div className="flex items-center gap-1.5 rounded-md border border-orange-400/40 bg-orange-400/15 px-2 py-1 w-fit">
                                      <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wide">🧪 {t("Este é o Reel de Teste", "This is a Test Reel", "Este es el reel de prueba")}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {(() => { const meta = PLATFORM_META[p.platform]; return meta ? <meta.icon className={`h-3.5 w-3.5 ${meta.cls}`} /> : null; })()}
                                    <span className="text-xs font-medium">{formatLabel(p.format, t)}</span>
                                    <span className="text-xs text-muted-foreground">·</span>
                                    <span className="text-xs text-muted-foreground">{p.postingTime}</span>
                                    {p.scheduledFor && (
                                      <>
                                        <span className="text-xs text-muted-foreground">·</span>
                                        <span className="text-xs text-muted-foreground">
                                          {new Date(p.scheduledFor).toLocaleDateString(numberLocale, { day: "2-digit", month: "2-digit" })} {t("às", "at", "a las")} {new Date(p.scheduledFor).toLocaleTimeString(numberLocale, { hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                      </>
                                    )}
                                    {isVideoFormat ? (
                                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                                        ✨ {t("Após aprovação → Vídeo com clone gerado automaticamente", "After approval → Video generated automatically with your clone", "Tras la aprobación → Vídeo generado automáticamente con tu clon")}
                                      </span>
                                    ) : (
                                      <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] text-green-400">
                                        ✓ {t("Após aprovação → Publicação automática", "After approval → Automatic publishing", "Tras la aprobación → Publicación automática")}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-foreground leading-snug line-clamp-2">{p.caption}</p>
                                </div>
                              </div>

                              {/* Rationale */}
                              {rationale && (
                                <div className="rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
                                  <span className="text-primary font-medium">🧠 {t("Por que este post:", "Why this post:", "Por qué esta publicación:")} </span>{rationale}
                                </div>
                              )}

                              {/* Actions */}
                              <div className="flex items-center gap-2 flex-wrap">
                                {isReady ? (
                                  <button
                                    onClick={() => bulkApprove([p.id], "post")}
                                    disabled={bulkApproving.size > 0}
                                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50 flex items-center gap-1"
                                  >
                                    <ThumbsUp className="h-3.5 w-3.5" />
                                    {isVideoFormat ? t("Aprovar + Gerar Vídeo", "Approve + Generate Video", "Aprobar + generar vídeo") : t("Aprovar + Agendar", "Approve + Schedule", "Aprobar + programar")}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => openMediaDrawer(p.id)}
                                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
                                  >
                                    <Upload className="h-3.5 w-3.5" /> {t("Melhorar imagem", "Improve image", "Mejorar imagen")}
                                  </button>
                                )}
                                <button
                                  onClick={() => openMediaDrawer(p.id)}
                                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                >
                                  <PenLine className="h-3.5 w-3.5" /> {t("Editar", "Edit", "Editar")}
                                </button>
                                <button
                                  onClick={() => patchPost(p.id, { status: "cancelled" })}
                                  className="ml-auto rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                                >
                                  <X className="h-3.5 w-3.5" /> {t("Descartar", "Discard", "Descartar")}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Outros itens na fila (rascunhos, travados, publicando) ── */}
              {(pendingApproval.length === 0 && queueItems.length === 0) ? (
                <div className="rounded-xl border border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-green-400" />
                  {t("Nenhum post aguardando aprovação. A IA está trabalhando nos storyboards desta semana.", "No posts are awaiting approval. AI is working on this week's storyboards.", "No hay publicaciones pendientes de aprobación. La IA está preparando los guiones gráficos de esta semana.")}
                </div>
              ) : queueItems.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" /> {t("Outros itens pendentes", "Other pending items", "Otros elementos pendientes")}
                  </p>
                  {stuckScheduled.length > 0 && (
                    <div className="rounded-lg border border-amber-400/30 bg-amber-400/8 px-4 py-2 text-xs text-amber-400">
                      ⚠ {t(`${stuckScheduled.length} post${stuckScheduled.length > 1 ? "s" : ""} de semanas anteriores ainda não publicado${stuckScheduled.length > 1 ? "s" : ""} — adicione mídia ou publique manualmente.`, `${stuckScheduled.length} post${stuckScheduled.length > 1 ? "s" : ""} from previous weeks still unpublished — add media or publish manually.`, `${stuckScheduled.length} publicación${stuckScheduled.length > 1 ? "es" : ""} de semanas anteriores aún sin publicar: añade contenido multimedia o publica manualmente.`)}
                    </div>
                  )}
                  {queueItems.map((p) => (
                    <QueuePostCard
                      key={p.id}
                      post={p}
                      onApprove={() => approve(p.id)}
                      onCancel={() => patchPost(p.id, { status: "cancelled" })}
                      onSaveCaption={(caption) => patchPost(p.id, { caption })}
                      onPublishNow={() => handlePublishNow(p.id)}
                      publishingNow={publishingNow.has(p.id)}
                      onOpenMediaDrawer={() => openMediaDrawer(p.id)}
                    />
                  ))}
                </div>
              )}

              {/* Publicados recentemente — ficam visíveis por 30 dias */}
              {recentlyPublished.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                    <span className="text-sm font-medium text-green-400">{t("Publicados recentemente", "Recently published", "Publicados recientemente")}</span>
                    <span className="text-xs text-muted-foreground">({t(`${recentlyPublished.length} nos últimos 30 dias`, `${recentlyPublished.length} in the last 30 days`, `${recentlyPublished.length} en los últimos 30 días`)})</span>
                    <div className="flex-1 h-px bg-green-400/20" />
                  </div>
                  {recentlyPublished.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-2"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        {(() => { const meta = PLATFORM_META[p.platform]; return meta ? <meta.icon className={`h-3.5 w-3.5 ${meta.cls}`} /> : null; })()}
                        <span className="text-xs font-medium text-green-400">{statusLabel("published", t)}</span>
                        <span className="rounded border border-border px-1 py-0.5 text-[10px] text-muted-foreground">{formatLabel(p.format, t)}</span>
                        {p.publishedAt && (
                          <span className="ml-auto text-[11px] text-muted-foreground">
                            {new Date(p.publishedAt).toLocaleDateString(numberLocale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                      <p className="text-sm line-clamp-3">{p.caption}</p>
                      {p.hashtags.length > 0 && (
                        <p className="text-[11px] text-blue-300 line-clamp-1">{p.hashtags.map((h) => `#${h}`).join(" ")}</p>
                      )}
                      {p.platformUrl && (
                        <a
                          href={p.platformUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded border border-green-500/30 bg-green-500/8 px-2.5 py-1 text-[11px] text-green-400 hover:bg-green-500/15 transition-colors"
                        >
                          <CheckCircle2 className="h-3 w-3" /> {t("Ver post publicado →", "View published post →", "Ver publicación →")}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Métricas */}
          {tab === "metrics" && metrics && (
            <div className="space-y-4">
              {metrics.byPlatform.length === 0 ? (
                <div className="rounded-xl border border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
                  {t("Nenhum post publicado ainda — as métricas aparecem aqui após as primeiras publicações.", "No posts have been published yet — metrics will appear here after the first posts go live.", "Aún no se ha publicado nada: las métricas aparecerán aquí después de las primeras publicaciones.")}
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {metrics.byPlatform.map((p) => {
                    const meta = PLATFORM_META[p.platform];
                    return (
                      <div key={p.platform} className="rounded-lg border border-border bg-card/50 p-4">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {meta && <meta.icon className={`h-4 w-4 ${meta.cls}`} />}
                          {meta?.label ?? p.platform}
                          <span className="ml-auto text-xs text-muted-foreground">{t(`${p.published} posts`, `${p.published} posts`, `${p.published} publicaciones`)}</span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                          <div><div className="text-base font-semibold">{p.reach.toLocaleString(numberLocale)}</div><div className="text-[11px] text-muted-foreground">{t("Alcance", "Reach", "Alcance")}</div></div>
                          <div><div className="text-base font-semibold">{p.likes.toLocaleString(numberLocale)}</div><div className="text-[11px] text-muted-foreground">{t("Curtidas", "Likes", "Me gusta")}</div></div>
                          <div><div className="text-base font-semibold">{p.engagementRate}%</div><div className="text-[11px] text-muted-foreground">{t("Engajamento", "Engagement", "Interacción")}</div></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {metrics.topPosts.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium">{t("Top posts (30 dias)", "Top posts (30 days)", "Publicaciones destacadas (30 días)")}</h3>
                  <div className="space-y-2">
                    {metrics.topPosts.map((p) => {
                      const meta = PLATFORM_META[p.platform];
                      return (
                        <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border bg-card/40 px-4 py-2.5 text-sm">
                          {meta && <meta.icon className={`h-4 w-4 shrink-0 ${meta.cls}`} />}
                          <span className="line-clamp-1 flex-1">{p.caption}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {t(`${p.metrics.reach.toLocaleString(numberLocale)} alcance · ${p.metrics.likes} curtidas`, `${p.metrics.reach.toLocaleString(numberLocale)} reach · ${p.metrics.likes} likes`, `${p.metrics.reach.toLocaleString(numberLocale)} de alcance · ${p.metrics.likes} me gusta`)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showConfig && (
        <ConfigModal
          config={config}
          onClose={() => setShowConfig(false)}
          onSaved={async () => {
            setShowConfig(false);
            await Promise.all([loadConfig(), loadIntelligenceContext()]);
          }}
        />
      )}
      {showTestPost && config && (
        <TestPostPanel
          platforms={config.platforms.filter((p) => p.enabled && p.platform !== "linkedin")}
          onClose={() => setShowTestPost(false)}
        />
      )}
      {showScheduleTest && config && (
        <ScheduleTestModal
          platforms={config.platforms.filter((p) => p.enabled && p.platform !== "linkedin")}
          onClose={() => setShowScheduleTest(false)}
          onCreated={() => { void loadPosts(); setTab("calendar"); }}
        />
      )}
      {showBio && config && (
        <BioModal suggestions={config.bioSuggestions ?? []} onClose={() => setShowBio(false)} />
      )}
      {showProfileAnalysis && (
        <SocialProfileAnalysisPanel onClose={() => setShowProfileAnalysis(false)} />
      )}
      {mediaDrawerPostId && (() => {
        const drawerPost = posts.find((p) => p.id === mediaDrawerPostId);
        if (!drawerPost) return null;
        return (
          <MediaProductionDrawer
            post={drawerPost as unknown as MediaPresencePost}
            onClose={() => setMediaDrawerPostId(null)}
            onPostUpdated={handleMediaDrawerUpdate}
          />
        );
      })()}
    </div>
  );
}

// ─── Empty week ───────────────────────────────────────────────────────────────

function EmptyWeek({ generating, onGenerate }: { generating: boolean; onGenerate: () => void }) {
  const t = useUiText();
  return (
    <div className="rounded-xl border border-border bg-card/50 p-10 text-center">
      {generating ? (
        <>
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">
            {t("A IA está montando o plano da semana — captions, roteiros e horários por plataforma. Isso leva alguns minutos; os posts vão aparecendo aqui.", "AI is putting together this week's plan — captions, scripts, and times for each platform. This takes a few minutes; posts will appear here as they are ready.", "La IA está preparando el plan de esta semana: textos, guiones y horarios para cada plataforma. Tardará unos minutos; las publicaciones aparecerán aquí cuando estén listas.")}
          </p>
        </>
      ) : (
        <>
          <CalendarDays className="mx-auto h-8 w-8 text-primary/60" />
          <p className="mt-4 text-sm text-muted-foreground">{t("Nenhum post planejado para esta semana ainda.", "No posts are planned for this week yet.", "Todavía no hay publicaciones planificadas para esta semana.")}</p>
          <Button className="mt-4" onClick={onGenerate} data-testid="button-generate-week-empty">
            <Sparkles className="mr-1.5 h-4 w-4" /> {t("Gerar Plano da Semana", "Generate Weekly Plan", "Generar plan semanal")}
          </Button>
        </>
      )}
    </div>
  );
}

// ─── Calendar post card ───────────────────────────────────────────────────────

const REQUIRES_MEDIA = ["instagram", "tiktok"];

function CalendarPostCard({
  post, expanded, onToggle, onApprove, onCancel, onMarkPublished, onPublishNow, publishingNow, onOpenMediaDrawer,
}: {
  post: PresencePost;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onCancel: () => void;
  onMarkPublished: () => void;
  onPublishNow: () => void;
  publishingNow: boolean;
  onOpenMediaDrawer: () => void;
}) {
  const t = useUiText();
  const meta = PLATFORM_META[post.platform];
  const status = STATUS_META[post.status];
  const hasMedia = (post.mediaUrls?.length ?? 0) > 0;
  const needsMedia = REQUIRES_MEDIA.includes(post.platform) && post.format !== "text" && !hasMedia;
  const isGeneratingMedia = post.mediaGenStatus === "storyboard_generating" || post.mediaGenStatus === "video_generating";

  return (
    <div className={`rounded-md border bg-background/60 p-2 text-xs ${needsMedia ? "border-amber-500/30" : "border-border"}`}>
      <button onClick={onToggle} className="w-full text-left" data-testid={`post-card-${post.id}`}>
        <div className="flex items-center gap-1.5">
          {meta && <meta.icon className={`h-3.5 w-3.5 shrink-0 ${meta.cls}`} />}
          <span className="text-muted-foreground">{post.postingTime}</span>
          <span className="ml-auto rounded border border-border px-1 py-0.5 text-[10px]">{formatLabel(post.format, t)}</span>
          {isGeneratingMedia && <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />}
          {hasMedia && !isGeneratingMedia && <ImageIcon className="h-3 w-3 text-green-400 shrink-0" aria-label={t("Tem mídia", "Has media", "Tiene contenido multimedia")} />}
        </div>
        <p className={`mt-1.5 ${expanded ? "" : "line-clamp-3"}`}>{post.caption}</p>
      </button>
      <div className="mt-1.5 flex items-center gap-1 flex-wrap">
        {status && <span className={`rounded border px-1.5 py-0.5 text-[10px] ${status.cls}`}>{statusLabel(post.status, t)}</span>}
        {post.launchAligned && <Rocket className="h-3 w-3 text-primary" aria-label={t("Alinhado ao lançamento", "Aligned with launch", "Alineado con el lanzamiento")} />}
        {needsMedia && (post.status === "draft" || post.status === "scheduled") && (
          <span className="rounded border border-amber-500/30 bg-amber-500/8 px-1.5 py-0.5 text-[10px] text-amber-400">{t("Aguardando mídia", "Awaiting media", "Pendiente de contenido multimedia")}</span>
        )}
      </div>
      {expanded && (
        <div className="mt-2 space-y-2 border-t border-border pt-2">
          {post.hashtags.length > 0 && (
            <p className="text-[11px] text-blue-300">{post.hashtags.map((h) => `#${h}`).join(" ")}</p>
          )}
          {post.format === "story" && (
            <p className="text-[11px] text-amber-400/80 italic">
              {t("⚡ Story: o Instagram não exibe caption via API — use este texto como sticker de texto ou narração.", "⚡ Stories do not show captions through the Instagram API — use this text as a text sticker or narration.", "⚡ Instagram no muestra el texto de las historias mediante la API: úsalo como sticker de texto o narración.")}
            </p>
          )}
          {/* Thumbnail da mídia aprovada */}
          {hasMedia && (
            <div className="rounded-lg overflow-hidden border border-green-500/20 bg-black max-h-48">
              {/\.(mp4|mov|webm)(\?|$)/i.test(post.mediaUrls[0]) ? (
                <video src={post.mediaUrls[0]} className="w-full max-h-48 object-contain" controls playsInline />
              ) : (
                <img src={post.mediaUrls[0]} alt={t("Mídia do post", "Post media", "Contenido multimedia de la publicación")} className="w-full max-h-48 object-contain" />
              )}
            </div>
          )}
          {/* Storyboard rascunho — gerado proativamente, aguardando aprovação */}
          {!hasMedia && (post.storyboardUrls?.length ?? 0) > 0 && !isGeneratingMedia && (
            <button
              className="relative w-full rounded-lg overflow-hidden border border-primary/30 bg-black max-h-40 text-left group"
              onClick={onOpenMediaDrawer}
              title={t("Abrir produção de mídia para aprovar", "Open media production to approve", "Abrir producción multimedia para aprobar")}
            >
              <img
                src={post.storyboardUrls[0]}
                alt={t("Storyboard rascunho", "Storyboard draft", "Borrador del guion gráfico")}
                className="w-full max-h-40 object-contain opacity-75 group-hover:opacity-90 transition-opacity"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-2 py-2">
                <span className="text-[10px] text-primary font-medium">
                  🎨 {t("Rascunho pronto — clique para aprovar e publicar", "Draft ready — click to approve and publish", "Borrador listo: haz clic para aprobar y publicar")}
                </span>
              </div>
            </button>
          )}
          {post.visualDirection && (
            <p className="text-[11px] text-muted-foreground"><strong>{t("Visual:", "Visual:", "Visual:")}</strong> {post.visualDirection}</p>
          )}
          {post.videoScript && (
            <p className="whitespace-pre-wrap text-[11px] text-muted-foreground"><strong>{t("Roteiro:", "Script:", "Guion:")}</strong> {post.videoScript}</p>
          )}
          {/* Link "Ver post" quando publicado */}
          {post.status === "published" && post.platformUrl && (
            <a
              href={post.platformUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded border border-green-500/30 bg-green-500/8 px-2 py-1 text-[11px] text-green-400 hover:bg-green-500/15 transition-colors"
            >
              <CheckCircle2 className="h-3 w-3" /> {t("Ver post publicado →", "View published post →", "Ver publicación →")}
            </a>
          )}
          {post.status === "publishing" && (
            <div className="flex items-center gap-1.5 text-[11px] text-primary">
              <Loader2 className="h-3 w-3 animate-spin" /> {t("Publicando no Instagram…", "Publishing to Instagram…", "Publicando en Instagram…")}
            </div>
          )}
          {post.errorMessage && (() => {
            const isReconnect = post.errorMessage.includes("Reconecte em /integracoes");
            const displayMsg = isReconnect
              ? post.errorMessage.split(". (Detalhe técnico:")[0] + "."
              : post.errorMessage;
            return (
              <div className="text-[11px] text-amber-400 space-y-0.5">
                <p>{displayMsg}</p>
                {isReconnect && (
                  <a
                    href="/app/integracoes"
                    className="inline-flex items-center gap-1 underline hover:text-amber-300 font-medium"
                  >
                    → {t("Ir para Integrações e reconectar", "Go to Integrations and reconnect", "Ve a Integraciones y vuelve a conectar")}
                  </a>
                )}
              </div>
            );
          })()}
          <div className="flex flex-wrap gap-1.5">
            {(post.status === "draft" || post.status === "scheduled") && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[11px] border-primary/40 text-primary hover:bg-primary/10"
                onClick={onOpenMediaDrawer}
                data-testid={`button-media-${post.id}`}
              >
                <Film className="mr-1 h-3 w-3" />
                {hasMedia ? t("Trocar Mídia", "Replace Media", "Cambiar contenido multimedia") : isGeneratingMedia ? t("Ver Produção", "View Production", "Ver producción") : t("Adicionar Mídia", "Add Media", "Añadir contenido multimedia")}
              </Button>
            )}
            {post.status === "draft" && (
              <Button size="sm" className="h-6 px-2 text-[11px]" onClick={onApprove} data-testid={`button-approve-${post.id}`}>
                <ThumbsUp className="mr-1 h-3 w-3" /> {t("Aprovar", "Approve", "Aprobar")}
              </Button>
            )}
            {(post.status === "draft" || post.status === "scheduled") && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[11px] border-amber-500/40 text-amber-400 hover:bg-amber-400/10"
                onClick={onPublishNow}
                disabled={publishingNow}
                data-testid={`button-publish-now-${post.id}`}
              >
                {publishingNow
                  ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  : <Zap className="mr-1 h-3 w-3" />}
                {publishingNow ? t("Publicando...", "Publishing...", "Publicando...") : t("Publicar Agora", "Publish Now", "Publicar ahora")}
              </Button>
            )}
            {post.status === "failed" && (post.manualRetryCount ?? 0) <= 3 && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[11px] border-red-500/40 text-red-400 hover:bg-red-400/10"
                onClick={onPublishNow}
                disabled={publishingNow}
                data-testid={`button-retry-${post.id}`}
              >
                {publishingNow
                  ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  : <RefreshCw className="mr-1 h-3 w-3" />}
                {publishingNow ? t("Retentando...", "Retrying...", "Reintentando...") : t(`Tentar Novamente (${post.manualRetryCount ?? 0}/3)`, `Try Again (${post.manualRetryCount ?? 0}/3)`, `Reintentar (${post.manualRetryCount ?? 0}/3)`)}
              </Button>
            )}
            {post.status === "scheduled" && (
              <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={onMarkPublished}>
                <Check className="mr-1 h-3 w-3" /> {t("Marcar publicado", "Mark as published", "Marcar como publicada")}
              </Button>
            )}
            {(post.status === "draft" || post.status === "scheduled") && (
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-muted-foreground" onClick={onCancel}>
                {t("Cancelar", "Cancel", "Cancelar")}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Queue post card (aprovação com edição) ──────────────────────────────────

function QueuePostCard({
  post, onApprove, onCancel, onSaveCaption, onPublishNow, publishingNow, onOpenMediaDrawer,
}: {
  post: PresencePost;
  onApprove: () => void;
  onCancel: () => void;
  onSaveCaption: (caption: string) => void;
  onPublishNow: () => void;
  publishingNow: boolean;
  onOpenMediaDrawer: () => void;
}) {
  const t = useUiText();
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(post.caption);
  const meta = PLATFORM_META[post.platform];
  const hasMedia = (post.mediaUrls?.length ?? 0) > 0;
  const needsMedia = REQUIRES_MEDIA.includes(post.platform) && post.format !== "text" && !hasMedia;
  const isGeneratingMedia = post.mediaGenStatus === "storyboard_generating" || post.mediaGenStatus === "video_generating";

  return (
    <div className={`rounded-lg border bg-card/50 p-4 ${needsMedia ? "border-amber-500/25" : "border-border"}`}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {meta && <meta.icon className={`h-4 w-4 ${meta.cls}`} />}
        <span className="font-medium">{meta?.label ?? post.platform}</span>
        <Badge variant="outline">{formatLabel(post.format, t)}</Badge>
        {post.pillar && <Badge variant="outline" className="text-muted-foreground">{post.pillar}</Badge>}
        {isGeneratingMedia && (
          <Badge variant="outline" className="border-primary/30 text-primary gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> {t("Gerando mídia…", "Generating media…", "Generando contenido multimedia…")}
          </Badge>
        )}
        {hasMedia && !isGeneratingMedia && (
          <Badge variant="outline" className="border-green-500/30 text-green-400 gap-1">
            <ImageIcon className="h-3 w-3" /> {t("Mídia pronta", "Media ready", "Contenido multimedia listo")}
          </Badge>
        )}
        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> {DAYS[post.dayIndex] ? t(...DAYS[post.dayIndex]) : ""} · {post.postingTime}
        </span>
      </div>
      {editing ? (
        <div className="mt-3">
          <textarea
            className="w-full rounded-md border border-border bg-background p-2.5 text-sm"
            rows={5}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            data-testid={`textarea-caption-${post.id}`}
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => { onSaveCaption(caption); setEditing(false); }}>{t("Salvar", "Save", "Guardar")}</Button>
            <Button size="sm" variant="ghost" onClick={() => { setCaption(post.caption); setEditing(false); }}>{t("Descartar", "Discard", "Descartar")}</Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 whitespace-pre-wrap text-sm">{post.caption}</p>
      )}
      {post.hashtags.length > 0 && (
        <p className="mt-2 text-xs text-blue-300">{post.hashtags.map((h) => `#${h}`).join(" ")}</p>
      )}
      {post.visualDirection && (
        <p className="mt-2 text-xs text-muted-foreground"><strong>{t("Direção visual:", "Visual direction:", "Dirección visual:")}</strong> {post.visualDirection}</p>
      )}
      {needsMedia && (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{t("Aguardando mídia — Instagram/TikTok requerem imagem ou vídeo para publicação.", "Media needed — Instagram/TikTok require an image or video to publish.", "Falta contenido multimedia: Instagram y TikTok requieren una imagen o vídeo para publicar.")}</span>
          <button
            className="text-amber-300 underline underline-offset-2 hover:text-amber-200 shrink-0 font-medium"
            onClick={onOpenMediaDrawer}
          >
            {t("Adicionar", "Add", "Añadir")}
          </button>
        </div>
      )}
      {/* Estado: Publicando */}
      {post.status === "publishing" && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm text-primary">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span>{t("Publicando… aguarde alguns segundos.", "Publishing… please wait a few seconds.", "Publicando… espera unos segundos.")}</span>
        </div>
      )}

      {/* Estado: Publicado */}
      {post.status === "published" && (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-green-500/25 bg-green-500/8 px-3 py-2.5 text-sm text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="flex-1 font-medium">{t("Publicado com sucesso!", "Published successfully!", "¡Publicado correctamente!")}</span>
          {post.platformUrl && (
            <a
              href={post.platformUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 underline underline-offset-2 hover:text-green-300 font-medium text-xs"
            >
              {t("Ver post →", "View post →", "Ver publicación →")}
            </a>
          )}
        </div>
      )}

      {!editing && post.status === "failed" && (
        <div className="mt-3">
          {(post.manualRetryCount ?? 0) <= 3 ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-red-500/40 text-red-400 hover:bg-red-400/10"
                onClick={onPublishNow}
                disabled={publishingNow}
                data-testid={`button-queue-retry-${post.id}`}
              >
                {publishingNow
                  ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                {publishingNow ? t("Retentando...", "Retrying...", "Reintentando...") : t(`Tentar Novamente (${post.manualRetryCount ?? 0}/3)`, `Try Again (${post.manualRetryCount ?? 0}/3)`, `Reintentar (${post.manualRetryCount ?? 0}/3)`)}
              </Button>
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={onCancel}>
                {t("Descartar post", "Discard post", "Descartar publicación")}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/8 px-3 py-2.5 text-sm text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{t(`Post bloqueado após ${post.manualRetryCount} retentativas manuais. Intervenção técnica necessária.`, `Post blocked after ${post.manualRetryCount} manual retries. Technical intervention is required.`, `Publicación bloqueada tras ${post.manualRetryCount} reintentos manuales. Se requiere intervención técnica.`)}</span>
            </div>
          )}
        </div>
      )}

      {!editing && (post.status === "draft" || post.status === "scheduled") && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={onApprove} data-testid={`button-queue-approve-${post.id}`}>
            <ThumbsUp className="mr-1.5 h-3.5 w-3.5" /> {t("Aprovar e Agendar", "Approve and Schedule", "Aprobar y programar")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-500/40 text-amber-400 hover:bg-amber-400/10"
            onClick={onPublishNow}
            disabled={publishingNow}
            data-testid={`button-queue-publish-now-${post.id}`}
          >
            {publishingNow
              ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              : <Zap className="mr-1.5 h-3.5 w-3.5" />}
            {publishingNow ? t("Publicando...", "Publishing...", "Publicando...") : t("Publicar Agora", "Publish Now", "Publicar ahora")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-primary/30 text-primary hover:bg-primary/10"
            onClick={onOpenMediaDrawer}
            data-testid={`button-queue-media-${post.id}`}
          >
            <Film className="mr-1.5 h-3.5 w-3.5" />
            {hasMedia ? t("Trocar Mídia", "Replace Media", "Cambiar contenido multimedia") : isGeneratingMedia ? t("Ver Produção", "View Production", "Ver producción") : t("Adicionar Mídia", "Add Media", "Añadir contenido multimedia")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <PenLine className="mr-1.5 h-3.5 w-3.5" /> {t("Editar", "Edit", "Editar")}
          </Button>
          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={onCancel}>
            {t("Descartar post", "Discard post", "Descartar publicación")}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Config modal ─────────────────────────────────────────────────────────────

function ConfigModal({
  config, onClose, onSaved,
}: {
  config: PresenceConfig | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useUiText();
  const [active, setActive] = useState(config?.active ?? true);
  const [platforms, setPlatforms] = useState<PlatformConfig[]>(
    config?.platforms?.length ? config.platforms : DEFAULT_PLATFORMS,
  );
  const [pillars, setPillars] = useState((config?.contentPillars ?? []).join(", "));
  const [tone, setTone] = useState(config?.tone ?? "");
  const [businessContext, setBusinessContext] = useState(config?.businessContext ?? "");
  const [alignedCampaignId, setAlignedCampaignId] = useState<string>(config?.alignedCampaignId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Campaign list for alignment dropdown
  const [campaigns, setCampaigns] = useState<{ id: string; title: string; status: string }[]>([]);
  useEffect(() => {
    customFetch<{ campaigns: { id: string; title: string; status: string }[] }>(`${API}/campaigns`)
      .then((d) => setCampaigns(d.campaigns))
      .catch(() => {});
  }, []);

  // Test post state
  const enabledPlatforms = platforms.filter((p) => p.enabled && p.platform !== "linkedin");
  const [testPlatform, setTestPlatform] = useState<string>("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; platformUrl?: string; error?: string } | null>(null);

  // Auto-select first enabled testable platform
  useEffect(() => {
    if (!testPlatform && enabledPlatforms.length > 0) setTestPlatform(enabledPlatforms[0].platform);
  }, [enabledPlatforms.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const updatePlatform = (idx: number, patch: Partial<PlatformConfig>) => {
    setPlatforms((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const runTestPost = async () => {
    if (!testPlatform) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await customFetch<{ success: boolean; platformUrl?: string; error?: string }>(
        `${API}/test-post`,
        { method: "POST", body: JSON.stringify({ platform: testPlatform }) },
      );
      setTestResult(res);
    } catch (err) {
       setTestResult({ success: false, error: err instanceof Error ? err.message : t("Erro ao enviar post de teste.", "Error sending test post.", "Error al enviar la publicación de prueba.") });
    } finally {
      setTestLoading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await customFetch(`${API}/config`, {
        method: "PUT",
        body: JSON.stringify({
          active,
          platforms,
          contentPillars: pillars.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8),
          tone,
          businessContext,
          alignedCampaignId: alignedCampaignId || null,
        }),
      });
      onSaved();
    } catch (err) {
       setError(err instanceof Error ? err.message : t("Erro ao salvar configuração.", "Error saving settings.", "Error al guardar la configuración."));
    } finally {
      setSaving(false);
    }
  };

  const STATUS_LABEL: Record<string, readonly [string, string, string]> = {
    intake: ["Intake", "Intake", "Recepción"], analyzing: ["Analisando", "Analyzing", "Analizando"], awaiting_approval: ["Aguardando", "Awaiting approval", "Pendiente"],
    generating: ["Gerando", "Generating", "Generando"], ready: ["Pronto", "Ready", "Listo"], executing: ["Executando", "Executing", "En ejecución"],
    live: ["Ao vivo", "Live", "En curso"], completed: ["Concluído", "Completed", "Completado"], cancelled: ["Cancelado", "Cancelled", "Cancelado"],
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("Configuração de Presença", "Presence Settings", "Configuración de presencia")}</h2>
          <button onClick={onClose} aria-label={t("Fechar configurações", "Close settings", "Cerrar configuración")}><X className="h-4 w-4" /></button>
        </div>

        <label className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
          <span>{t("Presença ativa (gera plano toda segunda 08h)", "Presence active (generates a plan every Monday at 8 AM)", "Presencia activa (genera un plan todos los lunes a las 8:00)")}</span>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} data-testid="checkbox-active" />
        </label>

        {/* ── Platforms ──────────────────────────────────────────────────── */}
        <div className="mt-4 space-y-3">
          <h3 className="text-sm font-medium">{t("Plataformas", "Platforms", "Plataformas")}</h3>
          {platforms.map((p, idx) => {
            const meta = PLATFORM_META[p.platform];
            return (
              <div key={p.platform} className={`rounded-lg border p-3 ${p.enabled ? "border-primary/30" : "border-border opacity-70"}`}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    onChange={(e) => updatePlatform(idx, { enabled: e.target.checked })}
                    data-testid={`checkbox-platform-${p.platform}`}
                  />
                  {meta && <meta.icon className={`h-4 w-4 ${meta.cls}`} />}
                  <span className="font-medium">{meta?.label ?? p.platform}</span>
                  {p.platform === "linkedin" && (
                    <span className="ml-auto text-[11px] text-muted-foreground">{t("publicação manual", "manual publishing", "publicación manual")}</span>
                  )}
                </label>
                {p.enabled && (
                  <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                    <label className="space-y-1">
                      <span className="text-muted-foreground">{t("Posts por dia", "Posts per day", "Publicaciones por día")}</span>
                      <select
                        className="w-full rounded-md border border-border bg-background p-1.5"
                        value={p.postsPerDay}
                        onChange={(e) => updatePlatform(idx, { postsPerDay: Number(e.target.value) })}
                      >
                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-muted-foreground">{t("Horários (HH:MM, vírgula)", "Times (HH:MM, comma-separated)", "Horarios (HH:MM, separados por comas)")}</span>
                      <input
                        className="w-full rounded-md border border-border bg-background p-1.5"
                        value={p.preferredTimes.join(", ")}
                        onChange={(e) =>
                          updatePlatform(idx, {
                            preferredTimes: e.target.value.split(",").map((s) => s.trim()).filter((s) => /^\d{2}:\d{2}$/.test(s)).slice(0, 5),
                          })
                        }
                        placeholder="12:00, 19:30"
                      />
                    </label>
                    {p.platform !== "linkedin" && (
                      <label className="col-span-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={p.autoPublish}
                          onChange={(e) => updatePlatform(idx, { autoPublish: e.target.checked })}
                        />
                        <span className="text-muted-foreground">
                          {t("Publicar automaticamente sem aprovação (ativa após a 1ª semana)", "Publish automatically without approval (enabled after the first week)", "Publicar automáticamente sin aprobación (se activa después de la primera semana)")}
                        </span>
                      </label>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Campaign alignment ─────────────────────────────────────────── */}
        <div className="mt-4 space-y-1.5 text-sm">
          <h3 className="font-medium">{t("Alinhamento de Campanha", "Campaign Alignment", "Alineación con campaña")}</h3>
          <p className="text-xs text-muted-foreground">
            {t('A IA adapta o conteúdo ao contexto da campanha escolhida. Deixe em "Sem alinhamento" para conteúdo de autoridade independente.', 'AI adapts content to the selected campaign. Choose "No alignment" for independent authority content.', 'La IA adapta el contenido a la campaña seleccionada. Elige "Sin alineación" para crear contenido de autoridad independiente.')}
          </p>
          <select
            className="w-full rounded-md border border-border bg-background p-2 text-sm"
            value={alignedCampaignId}
            onChange={(e) => setAlignedCampaignId(e.target.value)}
            data-testid="select-aligned-campaign"
          >
            <option value="">— {t("Sem alinhamento", "No alignment", "Sin alineación")} —</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} [{STATUS_LABEL[c.status] ? t(...STATUS_LABEL[c.status]) : c.status}]
              </option>
            ))}
          </select>
        </div>

        {/* ── Content fields ─────────────────────────────────────────────── */}
        <div className="mt-4 space-y-3 text-sm">
          <label className="block space-y-1">
            <span className="text-muted-foreground">{t("Pilares de conteúdo (separados por vírgula)", "Content pillars (comma-separated)", "Pilares de contenido (separados por comas)")}</span>
            <input
              className="w-full rounded-md border border-border bg-background p-2"
              value={pillars}
              onChange={(e) => setPillars(e.target.value)}
              placeholder={t("Autoridade, Bastidores, Educação, Prova social", "Authority, Behind the Scenes, Education, Social Proof", "Autoridad, detrás de escena, educación, prueba social")}
              data-testid="input-pillars"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-muted-foreground">{t("Tom de voz", "Tone of voice", "Tono de voz")}</span>
            <input
              className="w-full rounded-md border border-border bg-background p-2"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder={t("Direto, provocador, sem clichês de coach", "Direct, thought-provoking, no coaching clichés", "Directo, provocador y sin clichés de gurú")}
              data-testid="input-tone"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-muted-foreground">{t("Contexto do negócio (produto, público, promessa)", "Business context (product, audience, promise)", "Contexto del negocio (producto, público, promesa)")}</span>
            <textarea
              className="w-full rounded-md border border-border bg-background p-2"
              rows={3}
              value={businessContext}
              onChange={(e) => setBusinessContext(e.target.value)}
              placeholder={t("Se vazio, a IA usa os dados da campanha selecionada ou da mais recente.", "If left blank, AI uses data from the selected or most recent campaign.", "Si lo dejas en blanco, la IA usará los datos de la campaña seleccionada o de la más reciente.")}
              data-testid="textarea-business-context"
            />
          </label>
        </div>

        {/* ── Test post ──────────────────────────────────────────────────── */}
        <div className="mt-5 rounded-lg border border-dashed border-border p-3.5 space-y-3">
          <div>
            <h3 className="text-sm font-medium flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5 text-primary" /> {t("Publicação de Teste", "Test Post", "Publicación de prueba")}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("Envia um post real de teste para confirmar que a integração está funcionando antes de investir tempo na estrutura.", "Send a real test post to confirm the integration works before investing time in your setup.", "Envía una publicación real de prueba para confirmar que la integración funciona antes de dedicar tiempo a la configuración.")}
            </p>
          </div>

          {enabledPlatforms.length === 0 ? (
            <p className="text-xs text-amber-400">{t("Ative pelo menos uma plataforma acima (Instagram, Facebook ou TikTok) para testar.", "Enable at least one platform above (Instagram, Facebook, or TikTok) to test.", "Activa al menos una plataforma de arriba (Instagram, Facebook o TikTok) para probarla.")}</p>
          ) : (
            <div className="flex gap-2 items-end flex-wrap">
              <label className="flex-1 min-w-[140px] space-y-1 text-xs">
                <span className="text-muted-foreground">{t("Plataforma", "Platform", "Plataforma")}</span>
                <select
                  className="w-full rounded-md border border-border bg-background p-1.5 text-sm"
                  value={testPlatform}
                  onChange={(e) => { setTestPlatform(e.target.value); setTestResult(null); }}
                >
                  {enabledPlatforms.map((p) => {
                    const meta = PLATFORM_META[p.platform];
                    return <option key={p.platform} value={p.platform}>{meta?.label ?? p.platform}</option>;
                  })}
                </select>
              </label>
              <Button
                size="sm"
                variant="outline"
                onClick={runTestPost}
                disabled={testLoading || !testPlatform}
                className="h-8"
                data-testid="button-test-post"
              >
                {testLoading
                  ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> {t("Enviando...", "Sending...", "Enviando...")}</>
                  : <><Send className="mr-1.5 h-3.5 w-3.5" /> {t("Enviar Post de Teste", "Send Test Post", "Enviar publicación de prueba")}</>}
              </Button>
            </div>
          )}

          {testResult && (
            <div className={`rounded-md px-3 py-2 text-xs flex items-start gap-2 ${
              testResult.success
                ? "bg-green-500/10 border border-green-500/20 text-green-400"
                : "bg-destructive/10 border border-destructive/20 text-destructive"
            }`}>
              {testResult.success
                ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                : <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
              <div>
                {testResult.success
                   ? <>{t("Post publicado com sucesso!", "Test post published successfully!", "¡Publicación de prueba publicada correctamente!")} {testResult.platformUrl && <a href={testResult.platformUrl} target="_blank" rel="noreferrer" className="underline">{t("Ver post →", "View post →", "Ver publicación →")}</a>}</>
                   : <>{testResult.error ?? t("Erro ao publicar post de teste.", "Error publishing test post.", "Error al publicar la publicación de prueba.")}</>}
              </div>
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t("Cancelar", "Cancel", "Cancelar")}</Button>
          <Button onClick={save} disabled={saving} data-testid="button-save-config">
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} {t("Salvar", "Save", "Guardar")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Bio modal ────────────────────────────────────────────────────────────────

function BioCard({
  suggestion,
}: {
  suggestion: BioSuggestion;
}) {
  const t = useUiText();
  const [editedBio, setEditedBio] = useState(suggestion.bio);
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const meta = PLATFORM_META[suggestion.platform];
  const canPublish = suggestion.platform === "instagram" || suggestion.platform === "facebook";

  const copy = () => {
    navigator.clipboard.writeText(editedBio).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const publishBio = async () => {
    setPublishing(true);
    setPublishError(null);
    try {
      await customFetch(`${API}/bio/publish`, {
        method: "POST",
        body: JSON.stringify({ platform: suggestion.platform, bio: editedBio }),
      });
      setPublished(true);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : t("Erro ao publicar bio.", "Error publishing bio.", "Error al publicar la biografía."));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="rounded-lg border border-border p-3.5 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-medium">
        {meta && <meta.icon className={`h-4 w-4 ${meta.cls}`} />}
        <span>{meta?.label ?? suggestion.platform}</span>
        <Button
          size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs"
          onClick={copy}
          data-testid={`button-copy-bio-${suggestion.platform}`}
        >
          {copied ? <Check className="mr-1 h-3.5 w-3.5 text-green-400" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
          {copied ? t("Copiado!", "Copied!", "¡Copiado!") : t("Copiar", "Copy", "Copiar")}
        </Button>
      </div>

      {/* Editable bio */}
      <textarea
        className="w-full rounded-md border border-border bg-background/70 p-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 min-h-[80px]"
        value={editedBio}
        onChange={(e) => { setEditedBio(e.target.value); setPublished(false); setPublishError(null); }}
        rows={4}
        data-testid={`textarea-bio-${suggestion.platform}`}
      />

      {/* Highlights / keywords */}
      {suggestion.highlights.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <strong>{t("Destaques:", "Highlights:", "Aspectos destacados:")}</strong> {suggestion.highlights.join(" · ")}
        </p>
      )}
      {suggestion.keywords.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <strong>{t("Palavras-chave:", "Keywords:", "Palabras clave:")}</strong> {suggestion.keywords.join(", ")}
        </p>
      )}

      {/* Publish action */}
      {canPublish && (
        <div className="space-y-1.5 pt-1">
          {published ? (
            <div className="flex items-center gap-2 rounded-md bg-green-500/10 border border-green-500/20 px-3 py-2 text-xs text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              {t("Bio publicada com sucesso no", "Bio published successfully on", "Biografía publicada correctamente en")} {meta?.label ?? suggestion.platform}!
            </div>
          ) : (
            <Button
              className="w-full"
              size="sm"
              onClick={publishBio}
              disabled={publishing || !editedBio.trim()}
              data-testid={`button-publish-bio-${suggestion.platform}`}
            >
              {publishing
                ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> {t("Publicando...", "Publishing...", "Publicando...")}</>
                : <><Send className="mr-2 h-3.5 w-3.5" /> {t("Publicar bio no", "Publish bio on", "Publicar biografía en")} {meta?.label ?? suggestion.platform}</>}
            </Button>
          )}
          {publishError && (
            <p className="text-xs text-destructive flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              {publishError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function BioModal({ suggestions, onClose }: { suggestions: BioSuggestion[]; onClose: () => void }) {
  const t = useUiText();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> {t("Bios Otimizadas pela IA", "AI-Optimized Bios", "Biografías optimizadas por IA")}
          </h2>
          <button onClick={onClose} aria-label={t("Fechar bios", "Close bios", "Cerrar biografías")}><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("Edite o texto se quiser e clique em", "Edit the text if needed, then click", "Edita el texto si quieres y haz clic en")} <strong>{t("Publicar bio", "Publish bio", "Publicar biografía")}</strong> {t("para atualizar direto na plataforma.", "to update it directly on the platform.", "para actualizarla directamente en la plataforma.")}
        </p>
        {suggestions.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("Nenhuma sugestão gerada ainda.", "No suggestions have been generated yet.", "Todavía no se han generado sugerencias.")}</p>
        ) : (
          <div className="mt-4 space-y-4">
            {suggestions.map((s) => (
              <BioCard key={s.platform} suggestion={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Social Profile Analysis Panel ───────────────────────────────────────────

interface SocialProfileAnalysis {
  platform: string;
  handle: string;
  analyzedAt: string;
  overview: { bio: string; estimatedFollowers: string; followingCount: string; postFrequency: string; accountAge: string; verified: boolean | null };
  contentAnalysis: { dominantFormats: string[]; topThemes: string[]; avgEngagementSignal: string; bestPerformingContent: string; visualStyle: string; captionStyle: string };
  strategicAnalysis: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] };
  gapAnalysis: { alignmentScore: number; criticalGaps: string[]; quickWins: string[] };
  actionPlan: { immediate: string[]; shortTerm: string[]; longTerm: string[]; contentCalendarHint: string };
  searchSourced: boolean;
}

function SocialProfileAnalysisPanel({ onClose }: { onClose: () => void }) {
  const t = useUiText();
  const [platform, setPlatform] = useState<"instagram" | "facebook" | "tiktok" | "linkedin" | "youtube">("instagram");
  const [handle, setHandle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<SocialProfileAnalysis | null>(null);
  const [openSection, setOpenSection] = useState<string | null>("overview");

  const analyze = async () => {
    if (!handle.trim()) { setError(t("Informe o @ ou URL do perfil.", "Enter the profile's @handle or URL.", "Introduce el @usuario o la URL del perfil.")); return; }
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const { analysis: result } = await customFetch<{ analysis: SocialProfileAnalysis }>(
        "/api/presence/analyze-profile",
        { method: "POST", body: JSON.stringify({ platform, handle: handle.trim() }) },
      );
      setAnalysis(result);
      setOpenSection("overview");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Erro ao analisar perfil.", "Error analyzing profile.", "Error al analizar el perfil."));
    } finally {
      setLoading(false);
    }
  };

  const PLATFORM_OPTIONS = [
    { value: "instagram", label: "Instagram" },
    { value: "facebook", label: "Facebook" },
    { value: "tiktok", label: "TikTok" },
    { value: "linkedin", label: "LinkedIn" },
    { value: "youtube", label: "YouTube" },
  ] as const;

  const scoreColor = (n: number) =>
    n >= 8 ? "text-green-400" : n >= 5 ? "text-amber-400" : "text-destructive";

  const Section = ({ id, title, icon: Icon, children }: { id: string; title: string; icon: React.ElementType; children: React.ReactNode }) => (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors"
        onClick={() => setOpenSection(openSection === id ? null : id)}
      >
        <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" />{title}</span>
        {openSection === id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {openSection === id && <div className="px-4 pb-4 pt-2 space-y-2">{children}</div>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl border border-border bg-card flex flex-col"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
               <Search className="h-4 w-4 text-primary" /> {t("Análise de Perfil Social", "Social Profile Analysis", "Análisis del perfil social")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("A IA pesquisa o perfil público e compara com seus objetivos comerciais", "AI researches the public profile and compares it with your business goals", "La IA investiga el perfil público y lo compara con tus objetivos comerciales")}
            </p>
          </div>
          <button onClick={onClose} aria-label={t("Fechar análise", "Close analysis", "Cerrar análisis")} className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
          {/* Input */}
          <div className="flex gap-2">
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as typeof platform)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm shrink-0"
            >
              {PLATFORM_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && analyze()}
              placeholder={t("@handle ou URL do perfil", "@handle or profile URL", "@usuario o URL del perfil")}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={analyze}
              disabled={loading || !handle.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? t("Analisando...", "Analyzing...", "Analizando...") : t("Analisar", "Analyze", "Analizar")}
            </button>
          </div>

          {loading && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-6 text-center space-y-2">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {t("A IA está pesquisando o perfil e comparando com seus objetivos comerciais...", "AI is researching the profile and comparing it with your business goals...", "La IA está investigando el perfil y comparándolo con tus objetivos comerciales...")}
              </p>
              <p className="text-xs text-muted-foreground/60">{t("Isso pode levar 30–60 segundos", "This may take 30–60 seconds", "Esto puede tardar entre 30 y 60 segundos")}</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {analysis && (
            <div className="space-y-3">
              {/* Score badge */}
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${scoreColor(analysis.gapAnalysis.alignmentScore)}`}>
                    {analysis.gapAnalysis.alignmentScore}/10
                  </div>
                  <div className="text-[10px] text-muted-foreground">{t("Alinhamento", "Alignment", "Alineación")}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">@{analysis.handle} · {analysis.platform}</p>
                  <p className="text-xs text-muted-foreground">{analysis.overview.estimatedFollowers} {t("seguidores", "followers", "seguidores")} · {analysis.overview.postFrequency}</p>
                  {analysis.searchSourced && (
                    <span className="text-[10px] text-green-400 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="h-3 w-3" /> {t("Analisado via Google Search em tempo real", "Analyzed using real-time Google Search", "Analizado con Google Search en tiempo real")}
                    </span>
                  )}
                </div>
              </div>

              {/* Sections */}
              <Section id="overview" title={t("Visão Geral do Perfil", "Profile Overview", "Resumen del perfil")} icon={Share2}>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    ["Bio", analysis.overview.bio],
                    [t("Seguidores", "Followers", "Seguidores"), analysis.overview.estimatedFollowers],
                    [t("Frequência", "Frequency", "Frecuencia"), analysis.overview.postFrequency],
                    [t("Estilo Visual", "Visual Style", "Estilo visual"), analysis.contentAnalysis.visualStyle],
                    [t("Engajamento", "Engagement", "Interacción"), analysis.contentAnalysis.avgEngagementSignal],
                    [t("Legenda", "Caption", "Texto"), analysis.contentAnalysis.captionStyle],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg border border-border/50 bg-background/50 px-3 py-2">
                      <div className="text-muted-foreground mb-0.5">{k}</div>
                      <div className="font-medium leading-snug">{v || "—"}</div>
                    </div>
                  ))}
                </div>
                {analysis.contentAnalysis.topThemes.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t("Temas dominantes:", "Dominant themes:", "Temas predominantes:")}</p>
                    <div className="flex flex-wrap gap-1">
                      {analysis.contentAnalysis.topThemes.map((t) => (
                        <span key={t} className="rounded-full border border-primary/20 bg-primary/8 px-2 py-0.5 text-[11px] text-primary">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </Section>

              <Section id="gaps" title={t("Gaps vs Objetivos Comerciais", "Gaps vs. Business Goals", "Brechas frente a objetivos comerciales")} icon={Target}>
                {analysis.gapAnalysis.criticalGaps.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-destructive mb-1.5">❌ {t("Gaps críticos:", "Critical gaps:", "Brechas críticas:")}</p>
                    <ul className="space-y-1">
                      {analysis.gapAnalysis.criticalGaps.map((g, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-2"><span className="text-destructive shrink-0">•</span>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.gapAnalysis.quickWins.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-green-400 mb-1.5">⚡ {t("Quick wins (mudanças imediatas):", "Quick wins (immediate changes):", "Mejoras rápidas (cambios inmediatos):")}</p>
                    <ul className="space-y-1">
                      {analysis.gapAnalysis.quickWins.map((w, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-2"><span className="text-green-400 shrink-0">•</span>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Section>

              <Section id="swot" title={t("Análise Estratégica (SWOT)", "Strategic Analysis (SWOT)", "Análisis estratégico (FODA)")} icon={TrendingUp}>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: t("Forças", "Strengths", "Fortalezas"), items: analysis.strategicAnalysis.strengths, color: "text-green-400", bg: "bg-green-500/5 border-green-500/20" },
                    { label: t("Fraquezas", "Weaknesses", "Debilidades"), items: analysis.strategicAnalysis.weaknesses, color: "text-destructive", bg: "bg-destructive/5 border-destructive/20" },
                    { label: t("Oportunidades", "Opportunities", "Oportunidades"), items: analysis.strategicAnalysis.opportunities, color: "text-blue-400", bg: "bg-blue-500/5 border-blue-500/20" },
                    { label: t("Ameaças", "Threats", "Amenazas"), items: analysis.strategicAnalysis.threats, color: "text-amber-400", bg: "bg-amber-500/5 border-amber-500/20" },
                  ].map(({ label, items, color, bg }) => (
                    <div key={label} className={`rounded-lg border px-3 py-2 ${bg}`}>
                      <p className={`text-[11px] font-semibold mb-1.5 ${color}`}>{label}</p>
                      <ul className="space-y-0.5">
                        {items.slice(0, 3).map((item, i) => (
                          <li key={i} className="text-[11px] text-muted-foreground">• {item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </Section>

              <Section id="plan" title={t("Plano de Ação", "Action Plan", "Plan de acción")} icon={Lightbulb}>
                {analysis.actionPlan.contentCalendarHint && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                    <span className="text-primary font-medium">{t("Mix semanal ideal:", "Ideal weekly mix:", "Distribución semanal ideal:")} </span>
                    {analysis.actionPlan.contentCalendarHint}
                  </div>
                )}
                {[
                  { label: t("📅 Esta semana (7 dias)", "📅 This week (7 days)", "📅 Esta semana (7 días)"), items: analysis.actionPlan.immediate },
                  { label: t("📆 Próximo mês (30 dias)", "📆 Next month (30 days)", "📆 Próximo mes (30 días)"), items: analysis.actionPlan.shortTerm },
                  { label: t("🗓️ Trimestre (90 dias)", "🗓️ Quarter (90 days)", "🗓️ Trimestre (90 días)"), items: analysis.actionPlan.longTerm },
                ].map(({ label, items }) => items.length > 0 && (
                  <div key={label}>
                    <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">{label}:</p>
                    <ul className="space-y-1">
                      {items.map((item, i) => (
                        <li key={i} className="text-xs flex gap-2"><span className="text-primary shrink-0">→</span>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Test Post Panel ──────────────────────────────────────────────────────────

// ─── Modal: Agendar Publicação de Teste ──────────────────────────────────────
// Substitui o botão "Criar Reel Teste (1h)". Suporta text/post/reel/story com
// timing personalizado. Posts de imagem auto-aprovados (sem etapa manual).

function ScheduleTestModal({
  platforms,
  onClose,
  onCreated,
}: {
  platforms: PlatformConfig[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useUiText();
  const { locale } = useUiLocale();
  const numberLocale = intlLocale(locale);
  type FormatKey = "text" | "post" | "reel" | "story";
  const [platform, setPlatform] = useState<"instagram" | "facebook" | "tiktok">(
    (platforms[0]?.platform ?? "instagram") as "instagram" | "facebook" | "tiktok",
  );
  const [format, setFormat] = useState<FormatKey>("post");
  const [minutes, setMinutes] = useState(60);
  const [customMinutes, setCustomMinutes] = useState("");
  const [caption, setCaption] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated]   = useState<{ scheduledAt: string; format: FormatKey; platform: string } | null>(null);

  const FORMATS: { value: FormatKey; label: string; icon: string; desc: string }[] = [
    { value: "text",  label: t("Texto", "Text", "Texto"),  icon: "📝", desc: t("Sem imagem", "No image", "Sin imagen") },
    { value: "post",  label: t("Foto", "Photo", "Foto"),   icon: "📷", desc: t("Imagem por IA", "AI image", "Imagen generada por IA") },
    { value: "reel",  label: "Reel",   icon: "🎬", desc: t("Vídeo + avatar", "Video + avatar", "Vídeo + avatar") },
    { value: "story", label: "Story",  icon: "⬜", desc: t("Story vertical", "Vertical story", "Historia vertical") },
  ];

  const isVideoFormat = format === "reel" || format === "story";
  const TIMINGS = [
    { label: "30 min", value: 30 },
    { label: t("1 hora", "1 hour", "1 hora"), value: 60 },
    { label: t("2 horas", "2 hours", "2 horas"), value: 120 },
    { label: t("Personalizado", "Custom", "Personalizado"), value: 0 },
  ];

  const effectiveMinutes = minutes === 0 ? Math.max(5, parseInt(customMinutes || "60", 10)) : minutes;
  const scheduledAt = new Date(Date.now() + effectiveMinutes * 60 * 1000).toLocaleTimeString(numberLocale, {
    hour: "2-digit", minute: "2-digit",
  });

  const create = async () => {
    setCreating(true);
    try {
      await customFetch(`${API}/posts/create-test-scheduled`, {
        method: "POST",
        body: JSON.stringify({ platform, format, minutesFromNow: effectiveMinutes, caption: caption.trim() || undefined }),
      });
      // Não fecha o modal — mostra estado de confirmação com instruções claras
      setCreated({ scheduledAt, format, platform });
      onCreated(); // atualiza o calendário em background
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Erro ao criar publicação de teste.", "Error creating test post.", "Error al crear la publicación de prueba."));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <CalendarDays className="h-4 w-4 text-primary" /> {t("Agendar Publicação de Teste", "Schedule Test Post", "Programar publicación de prueba")}
          </h2>
          <button onClick={onClose} aria-label={t("Fechar", "Close", "Cerrar")}><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t("Cria uma publicação real no calendário para provar que o scheduler publica automaticamente no horário marcado.", "Creates a real calendar post to verify that the scheduler publishes automatically at the scheduled time.", "Crea una publicación real en el calendario para comprobar que el programador publica automáticamente a la hora indicada.")}
        </p>

        {/* ── Estado de confirmação (após criar) ──────────────────────────── */}
        {created ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-green-500/30 bg-green-500/8 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                  <Check className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-green-400">{t("Publicação agendada! ✅", "Post scheduled! ✅", "¡Publicación programada! ✅")}</p>
                  <p className="text-xs text-muted-foreground">
                    {created.format === "reel" ? "Reel" : created.format === "story" ? "Story" : t("Post", "Post", "Publicación")} {t("em", "on", "en")}{" "}
                    <strong className="text-foreground">{created.platform}</strong> — {t("publicação às", "publishes at", "se publica a las")}{" "}
                    <strong className="text-foreground">{created.scheduledAt}</strong>
                  </p>
                </div>
              </div>

              {/* Instruções específicas por formato */}
              {(created.format === "reel" || created.format === "story") ? (
                <div className="space-y-2.5 rounded-lg border border-amber-500/20 bg-amber-500/8 p-3">
                  <p className="text-xs font-semibold text-amber-400">⚠️ {t("Ação necessária antes de publicar:", "Action required before publishing:", "Acción necesaria antes de publicar:")}</p>
                  <ol className="space-y-1.5 text-xs text-amber-300/90">
                    <li className="flex items-start gap-2">
                      <span className="font-bold shrink-0">1.</span>
                      {t(`O sistema está gerando o storyboard do ${created.format === "reel" ? "reel" : "story"} agora (~2 min)`, `The system is generating the ${created.format === "reel" ? "Reel" : "Story"} storyboard now (~2 min)`, `El sistema está generando el guion gráfico del ${created.format === "reel" ? "reel" : "story"} ahora (~2 min)`)}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold shrink-0">2.</span>
                      {t('Quando terminar, um número aparecerá na aba', 'When it is ready, a number will appear on the', 'Cuando termine, aparecerá un número en la pestaña')} <strong>{t("Aprovação Criativa", "Creative Approval", "Aprobación creativa")}</strong> — {t("clique lá para aprovar o storyboard", "click there to approve the storyboard", "haz clic allí para aprobar el guion gráfico")}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold shrink-0">3.</span>
                      {t("Após aprovar, o HeyGen gera o vídeo e o scheduler publica automaticamente no horário", "After approval, HeyGen generates the video and the scheduler publishes it at the scheduled time", "Tras la aprobación, HeyGen genera el vídeo y el programador lo publica a la hora indicada")}
                    </li>
                  </ol>
                  <p className="text-[11px] text-amber-400/70 border-t border-amber-500/20 pt-2">
                    💡 {t("Para um teste mais simples sem etapa de aprovação, use", "For a simpler test without an approval step, use", "Para una prueba más sencilla sin aprobación, usa")} <strong>{t("Texto (Facebook)", "Text (Facebook)", "Texto (Facebook)")}</strong> — {t("publica direto no horário sem nenhuma ação.", "it publishes at the scheduled time without any action.", "se publica a la hora indicada sin ninguna acción.")}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-primary">{t("O que acontece agora:", "What happens next:", "¿Qué ocurre ahora?")}</p>
                  <ol className="space-y-1 text-xs text-muted-foreground">
                    {(created.format === "post" || created.format === "text") && created.platform === "instagram" && (
                      <li className="flex items-start gap-2"><span className="shrink-0">•</span>{t("A IA está gerando a imagem (~1 min)", "AI is generating the image (~1 min)", "La IA está generando la imagen (~1 min)")}</li>
                    )}
                    <li className="flex items-start gap-2">
                      <span className="shrink-0">•</span>
                      {t("O post aparece no", "The post appears in the", "La publicación aparece en el")} <strong className="text-foreground">{t("Calendário da Semana", "Weekly Calendar", "Calendario semanal")}</strong> {t("com um timer de contagem regressiva", "with a countdown timer", "con un temporizador de cuenta atrás")}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="shrink-0">•</span>
                      {t("Às", "At", "A las")} <strong className="text-foreground">{created.scheduledAt}</strong> {t("o scheduler publica automaticamente — sem nenhuma ação sua", "the scheduler publishes automatically — no action required", "el programador publica automáticamente, sin que tengas que hacer nada")}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="shrink-0">•</span>
                      {t("Você receberá uma notificação do browser quando publicar", "You will receive a browser notification when it is published", "Recibirás una notificación del navegador cuando se publique")}
                    </li>
                  </ol>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button className="flex-1" onClick={onClose}>
                <CalendarDays className="mr-2 h-4 w-4" /> {t("Ver no Calendário", "View in Calendar", "Ver en el calendario")}
              </Button>
              <Button variant="outline" onClick={() => setCreated(null)} className="text-xs">
                {t("Criar outro", "Create another", "Crear otra")}
              </Button>
            </div>
          </div>
        ) : platforms.length === 0 ? (
          <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-sm text-amber-400">
            {t("Nenhuma plataforma conectada. Conecte o Instagram, Facebook ou TikTok em Configurações.", "No platforms connected. Connect Instagram, Facebook, or TikTok in Settings.", "No hay plataformas conectadas. Conecta Instagram, Facebook o TikTok en Ajustes.")}
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {/* Formato */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Formato", "Format", "Formato")}</label>
              <div className="grid grid-cols-4 gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFormat(f.value)}
                    className={`flex flex-col items-center gap-1 rounded-lg border py-3 px-1 text-center transition-all ${
                      format === f.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/30 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="text-xl">{f.icon}</span>
                    <span className="text-[11px] font-medium">{f.label}</span>
                    <span className="text-[10px] opacity-60">{f.desc}</span>
                  </button>
                ))}
              </div>
              {format === "text" && platform === "instagram" && (
                <p className="text-[11px] text-amber-400/80">
                  {t("ℹ️ Instagram não aceita texto puro — será gerado um card visual automaticamente.", "ℹ️ Instagram does not support plain text — a visual card will be generated automatically.", "ℹ️ Instagram no admite texto sin formato: se generará automáticamente una tarjeta visual.")}
                </p>
              )}
              {isVideoFormat && (
                <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[11px] text-amber-400">
                  ⚠️ {t("Reels e stories requerem aprovação do storyboard antes de publicar — não publicam sozinhos sem uma etapa manual sua. Para testar publicação automática completa, escolha", "Reels and Stories require storyboard approval before publishing — they will not publish automatically without your manual approval. To test fully automated publishing, choose", "Los reels y las historias requieren aprobar el guion gráfico antes de publicar: no se publican automáticamente sin tu aprobación. Para probar la publicación totalmente automática, elige")} <strong>{t("Texto", "Text", "Texto")}</strong> {t("ou", "or", "o")} <strong>{t("Foto", "Photo", "Foto")}</strong>.
                </div>
              )}
            </div>

            {/* Plataforma */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Plataforma", "Platform", "Plataforma")}</label>
              <div className="flex gap-2 flex-wrap">
                {platforms.map((p) => {
                  const meta = PLATFORM_META[p.platform];
                  return (
                    <button
                      key={p.platform}
                      onClick={() => setPlatform(p.platform as "instagram" | "facebook" | "tiktok")}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        platform === p.platform
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      {meta && <meta.icon className={`h-4 w-4 ${meta.cls}`} />}
                      {meta?.label ?? p.platform}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Timing */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("Publicar em", "Publish in", "Publicar en")}</label>
              <div className="flex gap-2 flex-wrap">
                {TIMINGS.map((timing) => (
                  <button
                    key={timing.label}
                    onClick={() => setMinutes(timing.value)}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      minutes === timing.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    {timing.label}
                  </button>
                ))}
              </div>
              {minutes === 0 && (
                <input
                  type="number"
                  min={5}
                  max={10080}
                  placeholder={t("Minutos a partir de agora (ex: 45)", "Minutes from now (e.g. 45)", "Minutos a partir de ahora (p. ej., 45)")}
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              )}
              <p className="text-[11px] text-muted-foreground">
                {t("Publicará às", "Will publish at", "Se publicará a las")} <strong>{scheduledAt}</strong>
              </p>
            </div>

            {/* Legenda opcional */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("Legenda", "Caption", "Texto")} <span className="normal-case font-normal">{t("(opcional — IA usa contexto do seu negócio)", "(optional — AI uses your business context)", "(opcional: la IA usa el contexto de tu negocio)")}</span>
              </label>
              <textarea
                rows={2}
                maxLength={2200}
                placeholder={t("Deixe em branco para a IA gerar automaticamente...", "Leave blank for AI to generate it automatically...", "Déjalo en blanco para que la IA lo genere automáticamente...")}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full rounded-md border border-border bg-background p-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <Button className="w-full" onClick={create} disabled={creating} data-testid="button-create-scheduled-test">
              {creating
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("Agendando...", "Scheduling...", "Programando...")}</>
                : <><CalendarDays className="mr-2 h-4 w-4" /> {t("Agendar para", "Schedule for", "Programar para")} {scheduledAt}</>
              }
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function TestPostPanel({
  platforms,
  onClose,
}: {
  platforms: PlatformConfig[];
  onClose: () => void;
}) {
  const t = useUiText();
  const [platform, setPlatform] = useState<string>(platforms[0]?.platform ?? "instagram");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; platformUrl?: string; error?: string } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setUploadedImageUrl(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreviewUrl(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && /^image\//.test(file.type)) handleFileSelect(file);
  };

  const handleUploadImage = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const res = await customFetch<{ url: string }>(
        `${API}/test-media-upload`,
        {
          method: "POST",
          body: selectedFile,
          headers: { "Content-Type": selectedFile.type, "X-Filename": selectedFile.name },
        },
      );
      setUploadedImageUrl(res.url);
    } catch (err) {
      setResult({ success: false, error: t("Erro ao fazer upload da imagem: ", "Error uploading image: ", "Error al subir la imagen: ") + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setUploading(false);
    }
  };

  const runTest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await customFetch<{ success: boolean; platformUrl?: string; error?: string }>(
        `${API}/test-post`,
        { method: "POST", body: JSON.stringify({ platform, imageUrl: uploadedImageUrl ?? undefined, caption: caption.trim() || undefined }) },
      );
      setResult(res);
      if (res.success && res.platformUrl) {
        setTimeout(() => window.open(res.platformUrl, "_blank", "noopener,noreferrer"), 800);
      }
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : t("Erro ao enviar post de teste.", "Error sending test post.", "Error al enviar la publicación de prueba.") });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Send className="h-4 w-4 text-primary" /> {t("Publicação de Teste", "Test Post", "Publicación de prueba")}
          </h2>
          <button onClick={onClose} aria-label={t("Fechar", "Close", "Cerrar")}><X className="h-4 w-4" /></button>
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          {t("Publica um post real de teste na plataforma escolhida para confirmar que a integração está funcionando.", "Publish a real test post on the selected platform to confirm the integration is working.", "Publica una publicación de prueba real en la plataforma elegida para confirmar que la integración funciona.")}
        </p>

        {platforms.length === 0 ? (
          <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-sm text-amber-400">
            {t("Nenhuma plataforma habilitada. Vá em Configurações e ative o Instagram, Facebook ou TikTok.", "No platforms enabled. Go to Settings and enable Instagram, Facebook, or TikTok.", "No hay plataformas habilitadas. Ve a Ajustes y activa Instagram, Facebook o TikTok.")}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Plataforma */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("Plataforma", "Platform", "Plataforma")}</label>
              <div className="flex gap-2 flex-wrap">
                {platforms.map((p) => {
                  const meta = PLATFORM_META[p.platform];
                  return (
                    <button
                      key={p.platform}
                      onClick={() => { setPlatform(p.platform); setResult(null); }}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        platform === p.platform
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      {meta && <meta.icon className={`h-4 w-4 ${meta.cls}`} />}
                      {meta?.label ?? p.platform}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Legenda */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("Legenda", "Caption", "Texto")} <span className="text-muted-foreground font-normal">{t("(opcional)", "(optional)", "(opcional)")}</span></label>
              <textarea
                className="w-full rounded-md border border-border bg-background p-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                rows={3}
                maxLength={2200}
                placeholder={t("Escreva a legenda do post... (deixe em branco para usar texto de teste padrão)", "Write the post caption... (leave blank to use the default test text)", "Escribe el texto de la publicación... (déjalo en blanco para usar el texto de prueba predeterminado)")}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
              {caption.length > 0 && (
                <p className="text-right text-[11px] text-muted-foreground">{caption.length}/2200</p>
              )}
            </div>

            {/* Imagem opcional */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{t("Imagem", "Image", "Imagen")} <span className="text-muted-foreground font-normal">{t("(opcional)", "(optional)", "(opcional)")}</span></label>
                {selectedFile && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => { setSelectedFile(null); setPreviewUrl(null); setUploadedImageUrl(null); }}
                  >
                    {t("Remover", "Remove", "Quitar")}
                  </button>
                )}
              </div>

              {previewUrl ? (
                <div className="relative rounded-lg overflow-hidden border border-border bg-black">
                  <img src={previewUrl} alt={t("Prévia", "Preview", "Vista previa")} className="w-full max-h-40 object-contain" />
                  {uploadedImageUrl ? (
                    <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-green-500/80 px-2 py-1 text-[11px] text-white">
                      <CheckCircle2 className="h-3 w-3" /> {t("Pronto para enviar", "Ready to send", "Listo para enviar")}
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Button size="sm" onClick={handleUploadImage} disabled={uploading}>
                        {uploading ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> {t("Enviando…", "Uploading…", "Subiendo…")}</> : <><Upload className="mr-1.5 h-3.5 w-3.5" /> {t("Usar esta imagem", "Use this image", "Usar esta imagen")}</>}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-4 text-center cursor-pointer hover:border-primary/40 transition-colors"
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">{t("Arraste ou clique para escolher uma imagem", "Drag or click to choose an image", "Arrastra o haz clic para elegir una imagen")}</p>
                  <p className="text-[11px] text-muted-foreground/60">{t("Sem imagem → usa foto padrão de teste", "No image → uses the default test photo", "Sin imagen → se usará la foto de prueba predeterminada")}</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
              />
            </div>

            <Button
              className="w-full"
              onClick={runTest}
              disabled={loading || (!!selectedFile && !uploadedImageUrl)}
              data-testid="button-run-test-post"
            >
              {loading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("Publicando… (aguarde ~10s)", "Publishing… (wait ~10s)", "Publicando… (espera ~10 s)")}</>
                : selectedFile && !uploadedImageUrl
                  ? <><Upload className="mr-2 h-4 w-4" /> {t("Confirme o upload da imagem acima", "Confirm the image upload above", "Confirma arriba la carga de la imagen")}</>
                  : <><Send className="mr-2 h-4 w-4" /> {t("Enviar Post de Teste no", "Send Test Post on", "Enviar publicación de prueba en")} {PLATFORM_META[platform]?.label ?? platform}</>
              }
            </Button>

            {result && (
              <div className={`rounded-lg border px-4 py-3 text-sm flex items-start gap-2.5 ${
                result.success
                  ? "border-green-500/20 bg-green-500/10 text-green-400"
                  : "border-destructive/20 bg-destructive/10 text-destructive"
              }`}>
                {result.success
                  ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
                <div>
                  {result.success ? (
                    <>
                      {t("Post publicado com sucesso!", "Post published successfully!", "¡Publicación realizada correctamente!")}{" "}
                      {result.platformUrl && (
                        <a href={result.platformUrl} target="_blank" rel="noreferrer" className="underline font-medium">
                          {t("Ver post →", "View post →", "Ver publicación →")}
                        </a>
                      )}
                    </>
                  ) : (
                    result.error ?? t("Erro ao publicar post de teste.", "Error publishing test post.", "Error al publicar la publicación de prueba.")
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
