import { useState, useEffect, useCallback, useRef } from "react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Share2, Settings, Sparkles, Loader2, RefreshCw, CheckCircle2,
  Clock, AlertTriangle, X, Instagram, Facebook, Music2, Linkedin,
  CalendarDays, ListChecks, BarChart3, Lightbulb, Copy, Check,
  Rocket, PenLine, ThumbsUp, Zap, Send, Link2Off, Film, ImageIcon, Upload,
  Search, TrendingUp, Target, ChevronDown, ChevronUp,
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

// ─── Rationale: por que este post segue esta lógica ──────────────────────────

function buildPostRationale(post: PresencePost): string {
  const parts: string[] = [];

  const FORMAT_REASON: Record<string, string> = {
    reel: "Reels têm alcance orgânico 3–5× maior que feed estático",
    carousel: "Carrosseis geram mais salvamentos — ideais para conteúdo educativo",
    story: "Stories criam urgência e mantêm sua conta ativa no algoritmo diariamente",
    feed: "Posts de feed constroem autoridade permanente no perfil",
    text: "Posts de texto geram alto engajamento em LinkedIn e perfis de autoridade",
    live: "Lives aumentam alcance imediato via notificações para seguidores",
  };

  const PILLAR_REASON: Record<string, string> = {
    autoridade: "posicionar você como referência no mercado",
    produto: "apresentar sua solução com prova de valor",
    bastidores: "humanizar a marca e criar conexão emocional",
    comunidade: "fortalecer o senso de pertencimento da sua audiência",
    educacao: "educar o mercado sobre o problema que você resolve",
    lancamento: "gerar aquecimento e antecipação para o lançamento",
    depoimento: "usar prova social para reduzir objeções de compra",
  };

  if (FORMAT_REASON[post.format]) parts.push(FORMAT_REASON[post.format]);

  const pillar = (post.pillar ?? "").toLowerCase().replace(/\s+/g, "").split(/[_-]/)[0];
  for (const [key, val] of Object.entries(PILLAR_REASON)) {
    if (pillar.includes(key)) { parts.push(`Pilar "${post.pillar}" — objetivo: ${val}`); break; }
  }

  if (post.launchAligned && post.launchPhase) {
    parts.push(`Alinhado à fase de ${post.launchPhase} do seu lançamento ativo`);
  } else if (post.launchAligned) {
    parts.push("Alinhado ao seu lançamento ativo para maximizar aquecimento de audiência");
  }

  if (post.objective) parts.push(post.objective);

  return parts.slice(0, 2).join(". ");
}

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
  const [showProfileAnalysis, setShowProfileAnalysis] = useState(false);
  const [creatingTestReel, setCreatingTestReel] = useState(false);
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

  const createTestReel = useCallback(async () => {
    setActionError(null);
    setCreatingTestReel(true);
    try {
      const { post } = await customFetch<{ post: PresencePost }>(
        `${API}/posts/create-test-reel`,
        { method: "POST", body: JSON.stringify({ platform: "instagram" }) },
      );
      await loadPosts();
      setTab("queue");
      alert(
        `✅ Reel de teste criado!\n\nAgendado para: ${post.scheduledFor ? new Date(post.scheduledFor).toLocaleTimeString("pt-BR") : "1h"}\n\n` +
        `Vá para a aba "Aprovação Criativa", aprove o storyboard assim que ele aparecer (~30s), e o scheduler vai disparar a geração do vídeo com seu clone e publicar automaticamente no horário marcado.`,
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro ao criar reel de teste.");
    } finally {
      setCreatingTestReel(false);
    }
  }, [loadPosts]);

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

  const [bulkApproving, setBulkApproving] = useState<Set<string>>(new Set());

  const bulkApprove = useCallback(async (postIds: string[], label: string) => {
    setActionError(null);
    const key = postIds.join(",");
    setBulkApproving((prev) => new Set([...prev, key]));
    try {
      await customFetch<{ approved: number; videoTriggered: number; skipped: number; errors: string[] }>(
        `${API}/approve-bulk`,
        { method: "POST", body: JSON.stringify({ postIds }) },
      );
      await loadPosts();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Erro ao aprovar ${label}.`);
    } finally {
      setBulkApproving((prev) => { const s = new Set(prev); s.delete(key); return s; });
    }
  }, [loadPosts]);

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
              <Button
                variant="outline"
                size="sm"
                onClick={createTestReel}
                disabled={creatingTestReel}
                title="Cria um reel sobre a NexOS AI agendado para 1h — para testar se o scheduler dispara automaticamente"
                data-testid="button-create-test-reel"
              >
                {creatingTestReel ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Film className="mr-1.5 h-4 w-4" />}
                {creatingTestReel ? "Criando..." : "Criar Reel Teste (1h)"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowTestPost(true)} data-testid="button-test-post-header">
                <Send className="mr-1.5 h-4 w-4" /> Publicar Teste
              </Button>
            </>
          )}
          {config && (
            <Button variant="outline" size="sm" onClick={() => setShowProfileAnalysis(true)} data-testid="button-profile-analysis">
              <Search className="mr-1.5 h-4 w-4" /> Analisar Perfil
            </Button>
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
              { id: "queue" as const, label: `Aprovação Criativa${(pendingApproval.length + queueItems.length) ? ` (${pendingApproval.length + queueItems.length})` : ""}`, icon: ListChecks },
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
                      Por que você aprova antes de publicar?
                    </p>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      A IA planejou e gerou o conteúdo com base nos seus objetivos reais — produto, promessa, público-alvo e fase do lançamento. Mas <strong className="text-foreground">cada post é uma decisão criativa sua</strong>: ele representa a sua voz, sua marca, sua reputação. Você revisa uma vez, aprova, e a partir daí tudo roda automaticamente. <strong className="text-foreground">Para imagens: aprovação → publicação automática. Para vídeos: aprovação → geração automática do vídeo com seu avatar.</strong> Nenhuma outra etapa necessária.
                    </p>
                  </div>

                  {/* Aprovação em lote: toda semana */}
                  {pendingApproval.length > 1 && (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{pendingApproval.length} posts prontos para revisão</p>
                        <p className="text-xs text-muted-foreground">Aprovar tudo dispara imagens + geração de vídeo automaticamente</p>
                      </div>
                      <button
                        onClick={() => bulkApprove(pendingApproval.map(p => p.id), "toda a semana")}
                        disabled={bulkApproving.size > 0}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                      >
                        {bulkApproving.size > 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
                        Aprovar Semana Toda
                      </button>
                    </div>
                  )}

                  {/* Agrupado por dia */}
                  {DAYS.map((dayName, idx) => {
                    const dayPosts = pendingApproval.filter((p) => p.dayIndex === idx);
                    if (dayPosts.length === 0) return null;
                    const dayKey = dayPosts.map(p => p.id).join(",");
                    const isApproving = bulkApproving.has(dayKey);
                    return (
                      <div key={dayName} className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{dayName}</span>
                            <span className="text-xs text-muted-foreground">
                              {dayPosts.length} post{dayPosts.length > 1 ? "s" : ""} aguardando
                            </span>
                          </div>
                          {dayPosts.length > 0 && (
                            <button
                              onClick={() => bulkApprove(dayPosts.map(p => p.id), dayName)}
                              disabled={bulkApproving.size > 0}
                              className="rounded-md border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50 flex items-center gap-1"
                            >
                              {isApproving ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
                              Aprovar {dayName}
                            </button>
                          )}
                        </div>
                        {dayPosts.map((p) => {
                          const isVideoFormat = ["reel", "feed_video", "story"].includes(p.format);
                          const rationale = buildPostRationale(p);
                          const storyboardUrl = p.storyboardUrls?.[0];
                          const isReady = p.mediaGenStatus === "storyboard_ready";
                          return (
                            <div key={p.id} className={`rounded-xl border ${isReady ? "border-primary/25 bg-primary/5" : "border-amber-400/20 bg-amber-400/5"} p-4 space-y-3`}>
                              {/* Storyboard preview + info */}
                              <div className="flex gap-3">
                                {/* Thumbnail */}
                                <div className="relative shrink-0 w-16 h-16 rounded-lg border border-border overflow-hidden bg-muted/30">
                                  {storyboardUrl ? (
                                    <img src={storyboardUrl} alt="storyboard" className="w-full h-full object-cover" />
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
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {(() => { const meta = PLATFORM_META[p.platform]; return meta ? <meta.icon className={`h-3.5 w-3.5 ${meta.cls}`} /> : null; })()}
                                    <span className="text-xs font-medium">{FORMAT_LABEL[p.format] ?? p.format}</span>
                                    <span className="text-xs text-muted-foreground">·</span>
                                    <span className="text-xs text-muted-foreground">{p.postingTime}</span>
                                    {isVideoFormat ? (
                                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                                        ✨ Após aprovação → Vídeo com clone gerado automaticamente
                                      </span>
                                    ) : (
                                      <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] text-green-400">
                                        ✓ Após aprovação → Publicação automática
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-foreground leading-snug line-clamp-2">{p.caption}</p>
                                </div>
                              </div>

                              {/* Rationale */}
                              {rationale && (
                                <div className="rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
                                  <span className="text-primary font-medium">🧠 Por que este post: </span>{rationale}
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
                                    {isVideoFormat ? "Aprovar + Gerar Vídeo" : "Aprovar + Agendar"}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => openMediaDrawer(p.id)}
                                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
                                  >
                                    <Upload className="h-3.5 w-3.5" /> Melhorar imagem
                                  </button>
                                )}
                                <button
                                  onClick={() => openMediaDrawer(p.id)}
                                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                >
                                  <PenLine className="h-3.5 w-3.5" /> Editar
                                </button>
                                <button
                                  onClick={() => patchPost(p.id, { status: "cancelled" })}
                                  className="ml-auto rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                                >
                                  <X className="h-3.5 w-3.5" /> Descartar
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
                  Nenhum post aguardando aprovação. A IA está trabalhando nos storyboards desta semana.
                </div>
              ) : queueItems.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" /> Outros itens pendentes
                  </p>
                  {stuckScheduled.length > 0 && (
                    <div className="rounded-lg border border-amber-400/30 bg-amber-400/8 px-4 py-2 text-xs text-amber-400">
                      ⚠ {stuckScheduled.length} post{stuckScheduled.length > 1 ? "s" : ""} de semanas anteriores ainda não publicado{stuckScheduled.length > 1 ? "s" : ""} — adicione mídia ou publique manualmente.
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
                    <span className="text-sm font-medium text-green-400">Publicados recentemente</span>
                    <span className="text-xs text-muted-foreground">({recentlyPublished.length} nos últimos 30 dias)</span>
                    <div className="flex-1 h-px bg-green-400/20" />
                  </div>
                  {recentlyPublished.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-2"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        {(() => { const meta = PLATFORM_META[p.platform]; return meta ? <meta.icon className={`h-3.5 w-3.5 ${meta.cls}`} /> : null; })()}
                        <span className="text-xs font-medium text-green-400">{STATUS_META.published.label}</span>
                        <span className="rounded border border-border px-1 py-0.5 text-[10px] text-muted-foreground">{FORMAT_LABEL[p.format] ?? p.format}</span>
                        {p.publishedAt && (
                          <span className="ml-auto text-[11px] text-muted-foreground">
                            {new Date(p.publishedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
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
                          <CheckCircle2 className="h-3 w-3" /> Ver post publicado →
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
          {post.format === "story" && (
            <p className="text-[11px] text-amber-400/80 italic">
              ⚡ Story: o Instagram não exibe caption via API — use este texto como sticker de texto ou narração.
            </p>
          )}
          {/* Thumbnail da mídia aprovada */}
          {hasMedia && (
            <div className="rounded-lg overflow-hidden border border-green-500/20 bg-black max-h-48">
              {/\.(mp4|mov|webm)(\?|$)/i.test(post.mediaUrls[0]) ? (
                <video src={post.mediaUrls[0]} className="w-full max-h-48 object-contain" controls playsInline />
              ) : (
                <img src={post.mediaUrls[0]} alt="Mídia do post" className="w-full max-h-48 object-contain" />
              )}
            </div>
          )}
          {/* Storyboard rascunho — gerado proativamente, aguardando aprovação */}
          {!hasMedia && (post.storyboardUrls?.length ?? 0) > 0 && !isGeneratingMedia && (
            <button
              className="relative w-full rounded-lg overflow-hidden border border-primary/30 bg-black max-h-40 text-left group"
              onClick={onOpenMediaDrawer}
              title="Abrir produção de mídia para aprovar"
            >
              <img
                src={post.storyboardUrls[0]}
                alt="Storyboard rascunho"
                className="w-full max-h-40 object-contain opacity-75 group-hover:opacity-90 transition-opacity"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-2 py-2">
                <span className="text-[10px] text-primary font-medium">
                  🎨 Rascunho pronto — clique para aprovar e publicar
                </span>
              </div>
            </button>
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
                {publishingNow ? "Retentando..." : `Tentar Novamente (${post.manualRetryCount ?? 0}/3)`}
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
                {publishingNow ? "Retentando..." : `Tentar Novamente (${post.manualRetryCount ?? 0}/3)`}
              </Button>
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={onCancel}>
                Descartar post
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/8 px-3 py-2.5 text-sm text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="flex-1">Post bloqueado após {post.manualRetryCount} retentativas manuais. Intervenção técnica necessária.</span>
            </div>
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

function BioCard({
  suggestion,
}: {
  suggestion: BioSuggestion;
}) {
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
      setPublishError(err instanceof Error ? err.message : "Erro ao publicar bio.");
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
          {copied ? "Copiado!" : "Copiar"}
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
          <strong>Destaques:</strong> {suggestion.highlights.join(" · ")}
        </p>
      )}
      {suggestion.keywords.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <strong>Palavras-chave:</strong> {suggestion.keywords.join(", ")}
        </p>
      )}

      {/* Publish action */}
      {canPublish && (
        <div className="space-y-1.5 pt-1">
          {published ? (
            <div className="flex items-center gap-2 rounded-md bg-green-500/10 border border-green-500/20 px-3 py-2 text-xs text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Bio publicada com sucesso no {meta?.label ?? suggestion.platform}!
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
                ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Publicando...</>
                : <><Send className="mr-2 h-3.5 w-3.5" /> Publicar bio no {meta?.label ?? suggestion.platform}</>}
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> Bios Otimizadas pela IA
          </h2>
          <button onClick={onClose} aria-label="Fechar bios"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Edite o texto se quiser e clique em <strong>Publicar bio</strong> para atualizar direto na plataforma.
        </p>
        {suggestions.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nenhuma sugestão gerada ainda.</p>
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
  const [platform, setPlatform] = useState<"instagram" | "facebook" | "tiktok" | "linkedin" | "youtube">("instagram");
  const [handle, setHandle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<SocialProfileAnalysis | null>(null);
  const [openSection, setOpenSection] = useState<string | null>("overview");

  const analyze = async () => {
    if (!handle.trim()) { setError("Informe o @ ou URL do perfil."); return; }
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
      setError(err instanceof Error ? err.message : "Erro ao analisar perfil.");
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
              <Search className="h-4 w-4 text-primary" /> Análise de Perfil Social
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              A IA pesquisa o perfil público e compara com seus objetivos comerciais
            </p>
          </div>
          <button onClick={onClose} aria-label="Fechar análise" className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50">
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
              placeholder="@handle ou URL do perfil"
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={analyze}
              disabled={loading || !handle.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? "Analisando..." : "Analisar"}
            </button>
          </div>

          {loading && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-6 text-center space-y-2">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                A IA está pesquisando o perfil e comparando com seus objetivos comerciais...
              </p>
              <p className="text-xs text-muted-foreground/60">Isso pode levar 30–60 segundos</p>
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
                  <div className="text-[10px] text-muted-foreground">Alinhamento</div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">@{analysis.handle} · {analysis.platform}</p>
                  <p className="text-xs text-muted-foreground">{analysis.overview.estimatedFollowers} seguidores · {analysis.overview.postFrequency}</p>
                  {analysis.searchSourced && (
                    <span className="text-[10px] text-green-400 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="h-3 w-3" /> Analisado via Google Search em tempo real
                    </span>
                  )}
                </div>
              </div>

              {/* Sections */}
              <Section id="overview" title="Visão Geral do Perfil" icon={Share2}>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    ["Bio", analysis.overview.bio],
                    ["Seguidores", analysis.overview.estimatedFollowers],
                    ["Frequência", analysis.overview.postFrequency],
                    ["Estilo Visual", analysis.contentAnalysis.visualStyle],
                    ["Engajamento", analysis.contentAnalysis.avgEngagementSignal],
                    ["Legenda", analysis.contentAnalysis.captionStyle],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg border border-border/50 bg-background/50 px-3 py-2">
                      <div className="text-muted-foreground mb-0.5">{k}</div>
                      <div className="font-medium leading-snug">{v || "—"}</div>
                    </div>
                  ))}
                </div>
                {analysis.contentAnalysis.topThemes.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Temas dominantes:</p>
                    <div className="flex flex-wrap gap-1">
                      {analysis.contentAnalysis.topThemes.map((t) => (
                        <span key={t} className="rounded-full border border-primary/20 bg-primary/8 px-2 py-0.5 text-[11px] text-primary">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </Section>

              <Section id="gaps" title="Gaps vs Objetivos Comerciais" icon={Target}>
                {analysis.gapAnalysis.criticalGaps.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-destructive mb-1.5">❌ Gaps críticos:</p>
                    <ul className="space-y-1">
                      {analysis.gapAnalysis.criticalGaps.map((g, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-2"><span className="text-destructive shrink-0">•</span>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.gapAnalysis.quickWins.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-green-400 mb-1.5">⚡ Quick wins (mudanças imediatas):</p>
                    <ul className="space-y-1">
                      {analysis.gapAnalysis.quickWins.map((w, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-2"><span className="text-green-400 shrink-0">•</span>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Section>

              <Section id="swot" title="Análise Estratégica (SWOT)" icon={TrendingUp}>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Forças", items: analysis.strategicAnalysis.strengths, color: "text-green-400", bg: "bg-green-500/5 border-green-500/20" },
                    { label: "Fraquezas", items: analysis.strategicAnalysis.weaknesses, color: "text-destructive", bg: "bg-destructive/5 border-destructive/20" },
                    { label: "Oportunidades", items: analysis.strategicAnalysis.opportunities, color: "text-blue-400", bg: "bg-blue-500/5 border-blue-500/20" },
                    { label: "Ameaças", items: analysis.strategicAnalysis.threats, color: "text-amber-400", bg: "bg-amber-500/5 border-amber-500/20" },
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

              <Section id="plan" title="Plano de Ação" icon={Lightbulb}>
                {analysis.actionPlan.contentCalendarHint && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                    <span className="text-primary font-medium">Mix semanal ideal: </span>
                    {analysis.actionPlan.contentCalendarHint}
                  </div>
                )}
                {[
                  { label: "📅 Esta semana (7 dias)", items: analysis.actionPlan.immediate },
                  { label: "📆 Próximo mês (30 dias)", items: analysis.actionPlan.shortTerm },
                  { label: "🗓️ Trimestre (90 dias)", items: analysis.actionPlan.longTerm },
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

function TestPostPanel({
  platforms,
  onClose,
}: {
  platforms: PlatformConfig[];
  onClose: () => void;
}) {
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
      setResult({ success: false, error: "Erro ao fazer upload da imagem: " + (err instanceof Error ? err.message : String(err)) });
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
          Publica um post real de teste na plataforma escolhida para confirmar que a integração está funcionando.
        </p>

        {platforms.length === 0 ? (
          <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-sm text-amber-400">
            Nenhuma plataforma habilitada. Vá em Configurações e ative o Instagram, Facebook ou TikTok.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Plataforma */}
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

            {/* Legenda */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Legenda <span className="text-muted-foreground font-normal">(opcional)</span></label>
              <textarea
                className="w-full rounded-md border border-border bg-background p-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                rows={3}
                maxLength={2200}
                placeholder="Escreva a legenda do post... (deixe em branco para usar texto de teste padrão)"
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
                <label className="text-sm font-medium">Imagem <span className="text-muted-foreground font-normal">(opcional)</span></label>
                {selectedFile && (
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => { setSelectedFile(null); setPreviewUrl(null); setUploadedImageUrl(null); }}
                  >
                    Remover
                  </button>
                )}
              </div>

              {previewUrl ? (
                <div className="relative rounded-lg overflow-hidden border border-border bg-black">
                  <img src={previewUrl} alt="Preview" className="w-full max-h-40 object-contain" />
                  {uploadedImageUrl ? (
                    <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-green-500/80 px-2 py-1 text-[11px] text-white">
                      <CheckCircle2 className="h-3 w-3" /> Pronto para enviar
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Button size="sm" onClick={handleUploadImage} disabled={uploading}>
                        {uploading ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Enviando…</> : <><Upload className="mr-1.5 h-3.5 w-3.5" /> Usar esta imagem</>}
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
                  <p className="text-xs text-muted-foreground">Arraste ou clique para escolher uma imagem</p>
                  <p className="text-[11px] text-muted-foreground/60">Sem imagem → usa foto padrão de teste</p>
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
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publicando… (aguarde ~10s)</>
                : selectedFile && !uploadedImageUrl
                  ? <><Upload className="mr-2 h-4 w-4" /> Confirme o upload da imagem acima</>
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
