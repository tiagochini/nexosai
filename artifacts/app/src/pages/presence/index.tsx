import { useState, useEffect, useCallback, useRef } from "react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Share2, Settings, Sparkles, Loader2, RefreshCw, CheckCircle2,
  Clock, AlertTriangle, X, Instagram, Facebook, Music2, Linkedin,
  CalendarDays, ListChecks, BarChart3, Lightbulb, Copy, Check,
  Rocket, PenLine, ThumbsUp, Zap, Send, Link2Off, Film, ImageIcon,
} from "lucide-react";
import { MediaProductionDrawer } from "./MediaProductionDrawer";
import type { MediaPresencePost } from "./MediaProductionDrawer";

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

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const PLATFORM_META: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  instagram: { label: "Instagram", icon: Instagram, cls: "text-pink-400" },
  facebook:  { label: "Facebook",  icon: Facebook,  cls: "text-blue-400" },
  tiktok:    { label: "TikTok",    icon: Music2,    cls: "text-cyan-300" },
  linkedin:  { label: "LinkedIn",  icon: Linkedin,  cls: "text-sky-400" },
};
const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft:      { label: "Rascunho",   cls: "text-amber-400 border-amber-400/30 bg-amber-400/8" },
  scheduled:  { label: "Agendado",   cls: "text-blue-400 border-blue-400/30 bg-blue-400/8" },
  publishing: { label: "Publicando", cls: "text-purple-400 border-purple-400/30 bg-purple-400/8" },
  published:  { label: "Publicado",  cls: "text-green-400 border-green-400/30 bg-green-400/8" },
  failed:     { label: "Falhou",     cls: "text-destructive border-destructive/30 bg-destructive/8" },
  cancelled:  { label: "Cancelado",  cls: "text-muted-foreground border-border bg-muted/30" },
};
const FORMAT_LABEL: Record<string, string> = {
  reel: "Reel", carousel: "Carrossel", feed: "Feed", story: "Story", text: "Texto", live: "Live",
};
const DEFAULT_PLATFORMS: PlatformConfig[] = [
  { platform: "instagram", enabled: true,  postsPerDay: 1, autoPublish: false, preferredTimes: ["12:00", "19:30"] },
  { platform: "facebook",  enabled: false, postsPerDay: 1, autoPublish: false, preferredTimes: ["12:00"] },
  { platform: "tiktok",    enabled: false, postsPerDay: 1, autoPublish: false, preferredTimes: ["18:00"] },
  { platform: "linkedin",  enabled: false, postsPerDay: 1, autoPublish: false, preferredTimes: ["09:00"] },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PresencePage() {
  const [config, setConfig] = useState<PresenceConfig | null>(null);
  const [activeLaunch, setActiveLaunch] = useState<ActiveLaunch | null>(null);
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
        await Promise.all([loadConfig(), loadPosts(), loadMetrics(), loadSocialHealth()]);
      } catch { /* sem config ainda */ }
      setLoading(false);
    })();
  }, [loadConfig, loadPosts, loadMetrics]);

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
      setActionError(err instanceof Error ? err.message : "Erro ao gerar plano semanal.");
    }
  };

  const approve = async (postId: string) => {
    setActionError(null);
    try {
      const { post } = await customFetch<{ post: PresencePost }>(`${API}/posts/${postId}/approve`, { method: "POST" });
      setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro ao aprovar post.");
    }
  };

  const patchPost = async (postId: string, patch: Record<string, unknown>) => {
    setActionError(null);
    try {
      const { post } = await customFetch<{ post: PresencePost }>(`${API}/posts/${postId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro ao atualizar post.");
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
            setActionError(fresh.errorMessage ?? "Falha ao publicar na rede social.");
          }
        } catch { /* noop */ }
      };

      setTimeout(pollAndOpen, 5000);
      setTimeout(async () => { try { await loadPosts(); } catch { /* noop */ } }, 12000);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro ao publicar post.");
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
      setActionError(err instanceof Error ? err.message : "Erro ao otimizar bio.");
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
  const queueItems = [...drafts, ...stuckScheduled, ...publishingInProgress];

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
            <Share2 className="h-5 w-5 text-primary" /> Presença Social
            <Badge variant="outline" className="border-primary/30 text-primary">Always-On</Badge>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sua marca viva nas redes todos os dias — com ou sem lançamento ativo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {config && (
            <>
              <Button variant="outline" size="sm" onClick={optimizeBio} disabled={optimizingBio} data-testid="button-optimize-bio">
                {optimizingBio ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                Otimizar Bio
              </Button>
              <Button size="sm" onClick={() => generateWeek(currentWeekPosts.length > 0)} disabled={generating} data-testid="button-generate-week">
                {generating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
                {generating ? "Gerando semana..." : currentWeekPosts.length > 0 ? "Regenerar Semana" : "Gerar Semana"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowTestPost(true)} data-testid="button-test-post-header">
                <Send className="mr-1.5 h-4 w-4" /> Testar Publicação
              </Button>
            </>
          )}
          <Button variant="outline" size="icon" onClick={() => setShowConfig(true)} aria-label="Configurações de presença" data-testid="button-presence-config">
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
              Status das conexões sociais
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => loadSocialHealth(true)}
              disabled={healthChecking}
            >
              {healthChecking
                ? <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Verificando…</>
                : <><RefreshCw className="mr-1.5 h-3 w-3" />Verificar agora</>}
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
                        ✓ Conectado como <strong>{c.liveAccountName}</strong>
                        {c.accountId && <span className="text-muted-foreground ml-1">(ID: {c.accountId})</span>}
                      </p>
                    )}
                    {!c.pingOk && (
                      <p className="text-destructive">
                        ✗ Ping falhou — {c.pingError ?? "sem resposta da rede social"}
                      </p>
                    )}
                    {c.accountName && !c.liveAccountName && (
                      <p className="text-muted-foreground">Conta salva: {c.accountName}</p>
                    )}
                    {c.daysLeft !== null && (
                      <p className={c.tokenExpired ? "text-destructive" : c.expiringSoon ? "text-amber-400" : "text-muted-foreground"}>
                        Token: {c.tokenExpired
                          ? "EXPIRADO"
                          : c.daysLeft > 365
                          ? "sem expiração definida"
                          : `expira em ${c.daysLeft} dia${c.daysLeft === 1 ? "" : "s"}`}
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
                      Reconectar →
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          {socialHealth.every((c) => c.pingOk) && (
            <p className="text-xs text-green-400/70 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Todas as redes confirmaram conexão ativa — publicação autônoma operacional.
            </p>
          )}
        </div>
      )}

      {/* Campaign alignment badge — shown only if user chose one (or auto-detected active launch) */}
      {activeLaunch && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/25 bg-primary/5 px-4 py-2.5 text-sm">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 shrink-0 text-primary" />
            <span>
              Conteúdo alinhado à campanha{" "}
              <span className="text-primary font-medium">{activeLaunch.title}</span>
            </span>
          </div>
          <button
            className="text-xs text-muted-foreground/50 hover:text-muted-foreground underline underline-offset-2 shrink-0"
            onClick={() => setShowConfig(true)}
          >
            Alterar
          </button>
        </div>
      )}
      {!activeLaunch && config && (
        <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/10 px-4 py-2.5 text-sm text-muted-foreground/60">
          <Link2Off className="h-4 w-4 shrink-0" />
          <span>Sem alinhamento de campanha — conteúdo de autoridade independente.</span>
          <button
            className="ml-auto text-xs text-muted-foreground/50 hover:text-muted-foreground underline underline-offset-2 shrink-0"
            onClick={() => setShowConfig(true)}
          >
            Alinhar
          </button>
        </div>
      )}

      {actionError && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-4 py-2.5 text-sm text-destructive">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /> {actionError}</span>
          <button onClick={() => setActionError(null)} aria-label="Fechar aviso"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Empty state — sem configuração */}
      {!config ? (
        <div className="rounded-xl border border-border bg-card/50 p-10 text-center">
          <Share2 className="mx-auto h-10 w-10 text-primary/60" />
          <h2 className="mt-4 text-lg font-medium">Ative sua presença social</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            A IA gera um plano semanal de posts para suas redes toda segunda-feira — semana de
            autoridade quando não há lançamento, semana de aquecimento quando há campanha ativa.
          </p>
          <Button className="mt-5" onClick={() => setShowConfig(true)} data-testid="button-setup-presence">
            <Settings className="mr-1.5 h-4 w-4" /> Configurar Presença
          </Button>
        </div>
      ) : (
        <>
          {/* Insight da Semana */}
          {config.weeklyInsight?.summary && (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-400">
                <Lightbulb className="h-4 w-4" /> Insight da Semana
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
                { label: "Publicados (30d)", value: metrics.totals.published },
                { label: "Agendados", value: metrics.totals.scheduled },
                { label: "Aguardando aprovação", value: metrics.totals.drafts },
                { label: "Alcance total", value: metrics.totals.reach.toLocaleString("pt-BR") },
                { label: "Curtidas", value: metrics.totals.likes.toLocaleString("pt-BR") },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border bg-card/50 px-4 py-3">
                  <div className="text-lg font-semibold">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 border-b border-border">
            {[
              { id: "calendar" as const, label: "Calendário da Semana", icon: CalendarDays },
              { id: "queue" as const, label: `Fila de Aprovação${queueItems.length ? ` (${queueItems.length})` : ""}`, icon: ListChecks },
              { id: "metrics" as const, label: "Métricas", icon: BarChart3 },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                data-testid={`tab-${t.id}`}
                className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm transition-colors ${
                  tab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="h-4 w-4" /> {t.label}
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
                    <div key={day} className="min-h-24 rounded-lg border border-border bg-card/40 p-2">
                      <div className="mb-2 text-center text-xs font-medium text-muted-foreground">{day}</div>
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

          {/* Fila de aprovação */}
          {tab === "queue" && (
            queueItems.length === 0 ? (
              <div className="rounded-xl border border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-green-400" />
                Nenhum post aguardando aprovação.
              </div>
            ) : (
              <div className="space-y-3">
                {stuckScheduled.length > 0 && (
                  <div className="rounded-lg border border-amber-400/30 bg-amber-400/8 px-4 py-2 text-xs text-amber-400">
                    ⚠ {stuckScheduled.length} post{stuckScheduled.length > 1 ? "s" : ""} agendado{stuckScheduled.length > 1 ? "s" : ""} de semanas anteriores ainda não publicado{stuckScheduled.length > 1 ? "s" : ""} — adicione mídia ou publique manualmente.
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
            )
          )}

          {/* Métricas */}
          {tab === "metrics" && metrics && (
            <div className="space-y-4">
              {metrics.byPlatform.length === 0 ? (
                <div className="rounded-xl border border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
                  Nenhum post publicado ainda — as métricas aparecem aqui após as primeiras publicações.
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
                          <span className="ml-auto text-xs text-muted-foreground">{p.published} posts</span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                          <div><div className="text-base font-semibold">{p.reach.toLocaleString("pt-BR")}</div><div className="text-[11px] text-muted-foreground">Alcance</div></div>
                          <div><div className="text-base font-semibold">{p.likes.toLocaleString("pt-BR")}</div><div className="text-[11px] text-muted-foreground">Curtidas</div></div>
                          <div><div className="text-base font-semibold">{p.engagementRate}%</div><div className="text-[11px] text-muted-foreground">Engajamento</div></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {metrics.topPosts.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium">Top posts (30 dias)</h3>
                  <div className="space-y-2">
                    {metrics.topPosts.map((p) => {
                      const meta = PLATFORM_META[p.platform];
                      return (
                        <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border bg-card/40 px-4 py-2.5 text-sm">
                          {meta && <meta.icon className={`h-4 w-4 shrink-0 ${meta.cls}`} />}
                          <span className="line-clamp-1 flex-1">{p.caption}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {p.metrics.reach.toLocaleString("pt-BR")} alcance · {p.metrics.likes} curtidas
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
            await loadConfig();
          }}
        />
      )}
      {showTestPost && config && (
        <TestPostPanel
          platforms={config.platforms.filter((p) => p.enabled && p.platform !== "linkedin")}
          onClose={() => setShowTestPost(false)}
        />
      )}
      {showBio && config && (
        <BioModal suggestions={config.bioSuggestions ?? []} onClose={() => setShowBio(false)} />
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
  return (
    <div className="rounded-xl border border-border bg-card/50 p-10 text-center">
      {generating ? (
        <>
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">
            A IA está montando o plano da semana — captions, roteiros e horários por plataforma.
            Isso leva alguns minutos; os posts vão aparecendo aqui.
          </p>
        </>
      ) : (
        <>
          <CalendarDays className="mx-auto h-8 w-8 text-primary/60" />
          <p className="mt-4 text-sm text-muted-foreground">Nenhum post planejado para esta semana ainda.</p>
          <Button className="mt-4" onClick={onGenerate} data-testid="button-generate-week-empty">
            <Sparkles className="mr-1.5 h-4 w-4" /> Gerar Plano da Semana
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
          <span className="ml-auto rounded border border-border px-1 py-0.5 text-[10px]">{FORMAT_LABEL[post.format] ?? post.format}</span>
          {isGeneratingMedia && <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />}
          {hasMedia && !isGeneratingMedia && <ImageIcon className="h-3 w-3 text-green-400 shrink-0" aria-label="Tem mídia" />}
        </div>
        <p className={`mt-1.5 ${expanded ? "" : "line-clamp-3"}`}>{post.caption}</p>
      </button>
      <div className="mt-1.5 flex items-center gap-1 flex-wrap">
        {status && <span className={`rounded border px-1.5 py-0.5 text-[10px] ${status.cls}`}>{status.label}</span>}
        {post.launchAligned && <Rocket className="h-3 w-3 text-primary" aria-label="Alinhado ao lançamento" />}
        {needsMedia && (post.status === "draft" || post.status === "scheduled") && (
          <span className="rounded border border-amber-500/30 bg-amber-500/8 px-1.5 py-0.5 text-[10px] text-amber-400">Aguardando mídia</span>
        )}
      </div>
      {expanded && (
        <div className="mt-2 space-y-2 border-t border-border pt-2">
          {post.hashtags.length > 0 && (
            <p className="text-[11px] text-blue-300">{post.hashtags.map((h) => `#${h}`).join(" ")}</p>
          )}
          {/* Thumbnail da mídia já salva */}
          {hasMedia && (
            <div className="rounded-lg overflow-hidden border border-green-500/20 bg-black max-h-48">
              {/\.(mp4|mov|webm)(\?|$)/i.test(post.mediaUrls[0]) ? (
                <video src={post.mediaUrls[0]} className="w-full max-h-48 object-contain" controls playsInline />
              ) : (
                <img src={post.mediaUrls[0]} alt="Mídia do post" className="w-full max-h-48 object-contain" />
              )}
            </div>
          )}
          {post.visualDirection && (
            <p className="text-[11px] text-muted-foreground"><strong>Visual:</strong> {post.visualDirection}</p>
          )}
          {post.videoScript && (
            <p className="whitespace-pre-wrap text-[11px] text-muted-foreground"><strong>Roteiro:</strong> {post.videoScript}</p>
          )}
          {/* Link "Ver post" quando publicado */}
          {post.status === "published" && post.platformUrl && (
            <a
              href={post.platformUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded border border-green-500/30 bg-green-500/8 px-2 py-1 text-[11px] text-green-400 hover:bg-green-500/15 transition-colors"
            >
              <CheckCircle2 className="h-3 w-3" /> Ver post publicado →
            </a>
          )}
          {post.status === "publishing" && (
            <div className="flex items-center gap-1.5 text-[11px] text-primary">
              <Loader2 className="h-3 w-3 animate-spin" /> Publicando no Instagram…
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
                    → Ir para Integrações e reconectar
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
                {hasMedia ? "Trocar Mídia" : isGeneratingMedia ? "Ver Produção" : "Adicionar Mídia"}
              </Button>
            )}
            {post.status === "draft" && (
              <Button size="sm" className="h-6 px-2 text-[11px]" onClick={onApprove} data-testid={`button-approve-${post.id}`}>
                <ThumbsUp className="mr-1 h-3 w-3" /> Aprovar
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
                {publishingNow ? "Publicando..." : "Publicar Agora"}
              </Button>
            )}
            {post.status === "scheduled" && (
              <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={onMarkPublished}>
                <Check className="mr-1 h-3 w-3" /> Marcar publicado
              </Button>
            )}
            {(post.status === "draft" || post.status === "scheduled") && (
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-muted-foreground" onClick={onCancel}>
                Cancelar
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
        <Badge variant="outline">{FORMAT_LABEL[post.format] ?? post.format}</Badge>
        {post.pillar && <Badge variant="outline" className="text-muted-foreground">{post.pillar}</Badge>}
        {isGeneratingMedia && (
          <Badge variant="outline" className="border-primary/30 text-primary gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Gerando mídia…
          </Badge>
        )}
        {hasMedia && !isGeneratingMedia && (
          <Badge variant="outline" className="border-green-500/30 text-green-400 gap-1">
            <ImageIcon className="h-3 w-3" /> Mídia pronta
          </Badge>
        )}
        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> {DAYS[post.dayIndex]} · {post.postingTime}
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
            <Button size="sm" onClick={() => { onSaveCaption(caption); setEditing(false); }}>Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => { setCaption(post.caption); setEditing(false); }}>Descartar</Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 whitespace-pre-wrap text-sm">{post.caption}</p>
      )}
      {post.hashtags.length > 0 && (
        <p className="mt-2 text-xs text-blue-300">{post.hashtags.map((h) => `#${h}`).join(" ")}</p>
      )}
      {post.visualDirection && (
        <p className="mt-2 text-xs text-muted-foreground"><strong>Direção visual:</strong> {post.visualDirection}</p>
      )}
      {needsMedia && (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">Aguardando mídia — Instagram/TikTok requerem imagem ou vídeo para publicação.</span>
          <button
            className="text-amber-300 underline underline-offset-2 hover:text-amber-200 shrink-0 font-medium"
            onClick={onOpenMediaDrawer}
          >
            Adicionar
          </button>
        </div>
      )}
      {/* Estado: Publicando */}
      {post.status === "publishing" && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm text-primary">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span>Publicando… aguarde alguns segundos.</span>
        </div>
      )}

      {/* Estado: Publicado */}
      {post.status === "published" && (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-green-500/25 bg-green-500/8 px-3 py-2.5 text-sm text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="flex-1 font-medium">Publicado com sucesso!</span>
          {post.platformUrl && (
            <a
              href={post.platformUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 underline underline-offset-2 hover:text-green-300 font-medium text-xs"
            >
              Ver post →
            </a>
          )}
        </div>
      )}

      {!editing && (post.status === "draft" || post.status === "scheduled") && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={onApprove} data-testid={`button-queue-approve-${post.id}`}>
            <ThumbsUp className="mr-1.5 h-3.5 w-3.5" /> Aprovar e Agendar
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
            {publishingNow ? "Publicando..." : "Publicar Agora"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-primary/30 text-primary hover:bg-primary/10"
            onClick={onOpenMediaDrawer}
            data-testid={`button-queue-media-${post.id}`}
          >
            <Film className="mr-1.5 h-3.5 w-3.5" />
            {hasMedia ? "Trocar Mídia" : isGeneratingMedia ? "Ver Produção" : "Adicionar Mídia"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <PenLine className="mr-1.5 h-3.5 w-3.5" /> Editar
          </Button>
          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={onCancel}>
            Descartar post
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
      setTestResult({ success: false, error: err instanceof Error ? err.message : "Erro ao enviar post de teste." });
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
      setError(err instanceof Error ? err.message : "Erro ao salvar configuração.");
    } finally {
      setSaving(false);
    }
  };

  const STATUS_LABEL: Record<string, string> = {
    intake: "Intake", analyzing: "Analisando", awaiting_approval: "Aguardando",
    generating: "Gerando", ready: "Pronto", executing: "Executando",
    live: "Ao vivo", completed: "Concluído", cancelled: "Cancelado",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Configuração de Presença</h2>
          <button onClick={onClose} aria-label="Fechar configurações"><X className="h-4 w-4" /></button>
        </div>

        <label className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
          <span>Presença ativa (gera plano toda segunda 08h)</span>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} data-testid="checkbox-active" />
        </label>

        {/* ── Platforms ──────────────────────────────────────────────────── */}
        <div className="mt-4 space-y-3">
          <h3 className="text-sm font-medium">Plataformas</h3>
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
                    <span className="ml-auto text-[11px] text-muted-foreground">publicação manual</span>
                  )}
                </label>
                {p.enabled && (
                  <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                    <label className="space-y-1">
                      <span className="text-muted-foreground">Posts por dia</span>
                      <select
                        className="w-full rounded-md border border-border bg-background p-1.5"
                        value={p.postsPerDay}
                        onChange={(e) => updatePlatform(idx, { postsPerDay: Number(e.target.value) })}
                      >
                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-muted-foreground">Horários (HH:MM, vírgula)</span>
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
                          Publicar automaticamente sem aprovação (ativa após a 1ª semana)
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
          <h3 className="font-medium">Alinhamento de Campanha</h3>
          <p className="text-xs text-muted-foreground">
            A IA adapta o conteúdo ao contexto da campanha escolhida. Deixe em "Sem alinhamento" para conteúdo de autoridade independente.
          </p>
          <select
            className="w-full rounded-md border border-border bg-background p-2 text-sm"
            value={alignedCampaignId}
            onChange={(e) => setAlignedCampaignId(e.target.value)}
            data-testid="select-aligned-campaign"
          >
            <option value="">— Sem alinhamento —</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} [{STATUS_LABEL[c.status] ?? c.status}]
              </option>
            ))}
          </select>
        </div>

        {/* ── Content fields ─────────────────────────────────────────────── */}
        <div className="mt-4 space-y-3 text-sm">
          <label className="block space-y-1">
            <span className="text-muted-foreground">Pilares de conteúdo (separados por vírgula)</span>
            <input
              className="w-full rounded-md border border-border bg-background p-2"
              value={pillars}
              onChange={(e) => setPillars(e.target.value)}
              placeholder="Autoridade, Bastidores, Educação, Prova social"
              data-testid="input-pillars"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-muted-foreground">Tom de voz</span>
            <input
              className="w-full rounded-md border border-border bg-background p-2"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="Direto, provocador, sem clichês de coach"
              data-testid="input-tone"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-muted-foreground">Contexto do negócio (produto, público, promessa)</span>
            <textarea
              className="w-full rounded-md border border-border bg-background p-2"
              rows={3}
              value={businessContext}
              onChange={(e) => setBusinessContext(e.target.value)}
              placeholder="Se vazio, a IA usa os dados da campanha selecionada ou da mais recente."
              data-testid="textarea-business-context"
            />
          </label>
        </div>

        {/* ── Test post ──────────────────────────────────────────────────── */}
        <div className="mt-5 rounded-lg border border-dashed border-border p-3.5 space-y-3">
          <div>
            <h3 className="text-sm font-medium flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5 text-primary" /> Publicação de Teste
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Envia um post real de teste para confirmar que a integração está funcionando antes de investir tempo na estrutura.
            </p>
          </div>

          {enabledPlatforms.length === 0 ? (
            <p className="text-xs text-amber-400">Ative pelo menos uma plataforma acima (Instagram, Facebook ou TikTok) para testar.</p>
          ) : (
            <div className="flex gap-2 items-end flex-wrap">
              <label className="flex-1 min-w-[140px] space-y-1 text-xs">
                <span className="text-muted-foreground">Plataforma</span>
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
                  ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Enviando...</>
                  : <><Send className="mr-1.5 h-3.5 w-3.5" /> Enviar Post de Teste</>}
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
                  ? <>Post publicado com sucesso! {testResult.platformUrl && <a href={testResult.platformUrl} target="_blank" rel="noreferrer" className="underline">Ver post →</a>}</>
                  : <>{testResult.error ?? "Erro ao publicar post de teste."}</>}
              </div>
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving} data-testid="button-save-config">
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Bio modal ────────────────────────────────────────────────────────────────

function BioModal({ suggestions, onClose }: { suggestions: BioSuggestion[]; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> Bios Otimizadas
          </h2>
          <button onClick={onClose} aria-label="Fechar bios"><X className="h-4 w-4" /></button>
        </div>
        {suggestions.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nenhuma sugestão gerada ainda.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {suggestions.map((s) => {
              const meta = PLATFORM_META[s.platform];
              return (
                <div key={s.platform} className="rounded-lg border border-border p-3.5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {meta && <meta.icon className={`h-4 w-4 ${meta.cls}`} />}
                    {meta?.label ?? s.platform}
                    <Button
                      size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs"
                      onClick={() => copy(s.platform, s.bio)}
                      data-testid={`button-copy-bio-${s.platform}`}
                    >
                      {copied === s.platform ? <Check className="mr-1 h-3.5 w-3.5 text-green-400" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                      Copiar
                    </Button>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap rounded-md bg-background/70 p-2.5 text-sm">{s.bio}</p>
                  {s.highlights.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      <strong>Destaques:</strong> {s.highlights.join(" · ")}
                    </p>
                  )}
                  {s.keywords.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <strong>Palavras-chave:</strong> {s.keywords.join(", ")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Test Post Panel ──────────────────────────────────────────────────────────

function TestPostPanel({
  platforms,
  onClose,
}: {
  platforms: PlatformConfig[];
  onClose: () => void;
}) {
  const [platform, setPlatform] = useState<string>(platforms[0]?.platform ?? "instagram");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; platformUrl?: string; error?: string } | null>(null);

  const runTest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await customFetch<{ success: boolean; platformUrl?: string; error?: string }>(
        `${API}/test-post`,
        { method: "POST", body: JSON.stringify({ platform }) },
      );
      setResult(res);
      if (res.success && res.platformUrl) {
        setTimeout(() => window.open(res.platformUrl, "_blank", "noopener,noreferrer"), 800);
      }
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : "Erro ao enviar post de teste." });
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
            <Send className="h-4 w-4 text-primary" /> Publicação de Teste
          </h2>
          <button onClick={onClose} aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          Publica um post real de teste na plataforma escolhida — com imagem e legenda de teste — para confirmar que a integração está funcionando.
        </p>

        {platforms.length === 0 ? (
          <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-sm text-amber-400">
            Nenhuma plataforma habilitada. Vá em Configurações e ative o Instagram, Facebook ou TikTok.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Plataforma</label>
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

            <Button
              className="w-full"
              onClick={runTest}
              disabled={loading}
              data-testid="button-run-test-post"
            >
              {loading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publicando… (aguarde ~5s)</>
                : <><Send className="mr-2 h-4 w-4" /> Enviar Post de Teste no {PLATFORM_META[platform]?.label ?? platform}</>
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
                      Post publicado com sucesso!{" "}
                      {result.platformUrl && (
                        <a href={result.platformUrl} target="_blank" rel="noreferrer" className="underline font-medium">
                          Ver post →
                        </a>
                      )}
                    </>
                  ) : (
                    result.error ?? "Erro ao publicar post de teste."
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
