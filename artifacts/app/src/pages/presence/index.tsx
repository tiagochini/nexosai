import { useState, useEffect, useCallback, useRef } from "react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Share2, Settings, Sparkles, Loader2, RefreshCw, CheckCircle2,
  Clock, AlertTriangle, X, Instagram, Facebook, Music2, Linkedin,
  CalendarDays, ListChecks, BarChart3, Lightbulb, Copy, Check,
  Rocket, PenLine, ThumbsUp, Zap,
} from "lucide-react";

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
  const [showBio, setShowBio] = useState(false);
  const [optimizingBio, setOptimizingBio] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [publishingNow, setPublishingNow] = useState<Set<string>>(new Set());
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

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([loadConfig(), loadPosts(), loadMetrics()]);
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
      // Poll for a few seconds so UI reflects when status transitions to published/failed
      setTimeout(async () => { try { await loadPosts(); } catch { /* noop */ } }, 3000);
      setTimeout(async () => { try { await loadPosts(); } catch { /* noop */ } }, 8000);
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

  const currentWeekPosts = posts.filter((p) => !weekStart || p.weekStart?.slice(0, 10) === weekStart.slice(0, 10));
  const drafts = posts.filter((p) => p.status === "draft");

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
            </>
          )}
          <Button variant="outline" size="icon" onClick={() => setShowConfig(true)} aria-label="Configurações de presença" data-testid="button-presence-config">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Launch alignment badge */}
      {activeLaunch && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-4 py-2.5 text-sm">
          <Rocket className="h-4 w-4 shrink-0 text-primary" />
          <span>
            <strong>Semana de Lançamento</strong> — conteúdo alinhado à campanha{" "}
            <span className="text-primary">{activeLaunch.title}</span>
          </span>
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
              { id: "queue" as const, label: `Fila de Aprovação${drafts.length ? ` (${drafts.length})` : ""}`, icon: ListChecks },
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
                            onPublishNow={() => publishNow(p.id)}
                            publishingNow={publishingNow.has(p.id)}
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
            drafts.length === 0 ? (
              <div className="rounded-xl border border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-green-400" />
                Nenhum post aguardando aprovação.
              </div>
            ) : (
              <div className="space-y-3">
                {drafts.map((p) => (
                  <QueuePostCard
                    key={p.id}
                    post={p}
                    onApprove={() => approve(p.id)}
                    onCancel={() => patchPost(p.id, { status: "cancelled" })}
                    onSaveCaption={(caption) => patchPost(p.id, { caption })}
                    onPublishNow={() => publishNow(p.id)}
                    publishingNow={publishingNow.has(p.id)}
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
      {showBio && config && (
        <BioModal suggestions={config.bioSuggestions ?? []} onClose={() => setShowBio(false)} />
      )}
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

function CalendarPostCard({
  post, expanded, onToggle, onApprove, onCancel, onMarkPublished, onPublishNow, publishingNow,
}: {
  post: PresencePost;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onCancel: () => void;
  onMarkPublished: () => void;
  onPublishNow: () => void;
  publishingNow: boolean;
}) {
  const meta = PLATFORM_META[post.platform];
  const status = STATUS_META[post.status];
  return (
    <div className="rounded-md border border-border bg-background/60 p-2 text-xs">
      <button onClick={onToggle} className="w-full text-left" data-testid={`post-card-${post.id}`}>
        <div className="flex items-center gap-1.5">
          {meta && <meta.icon className={`h-3.5 w-3.5 shrink-0 ${meta.cls}`} />}
          <span className="text-muted-foreground">{post.postingTime}</span>
          <span className="ml-auto rounded border border-border px-1 py-0.5 text-[10px]">{FORMAT_LABEL[post.format] ?? post.format}</span>
        </div>
        <p className={`mt-1.5 ${expanded ? "" : "line-clamp-3"}`}>{post.caption}</p>
      </button>
      <div className="mt-1.5 flex items-center gap-1">
        {status && <span className={`rounded border px-1.5 py-0.5 text-[10px] ${status.cls}`}>{status.label}</span>}
        {post.launchAligned && <Rocket className="h-3 w-3 text-primary" aria-label="Alinhado ao lançamento" />}
      </div>
      {expanded && (
        <div className="mt-2 space-y-2 border-t border-border pt-2">
          {post.hashtags.length > 0 && (
            <p className="text-[11px] text-blue-300">{post.hashtags.map((h) => `#${h}`).join(" ")}</p>
          )}
          {post.visualDirection && (
            <p className="text-[11px] text-muted-foreground"><strong>Visual:</strong> {post.visualDirection}</p>
          )}
          {post.videoScript && (
            <p className="whitespace-pre-wrap text-[11px] text-muted-foreground"><strong>Roteiro:</strong> {post.videoScript}</p>
          )}
          {post.errorMessage && (
            <p className="text-[11px] text-amber-400">{post.errorMessage}</p>
          )}
          <div className="flex flex-wrap gap-1.5">
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
  post, onApprove, onCancel, onSaveCaption, onPublishNow, publishingNow,
}: {
  post: PresencePost;
  onApprove: () => void;
  onCancel: () => void;
  onSaveCaption: (caption: string) => void;
  onPublishNow: () => void;
  publishingNow: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(post.caption);
  const meta = PLATFORM_META[post.platform];
  return (
    <div className="rounded-lg border border-border bg-card/50 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {meta && <meta.icon className={`h-4 w-4 ${meta.cls}`} />}
        <span className="font-medium">{meta?.label ?? post.platform}</span>
        <Badge variant="outline">{FORMAT_LABEL[post.format] ?? post.format}</Badge>
        {post.pillar && <Badge variant="outline" className="text-muted-foreground">{post.pillar}</Badge>}
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
      {!editing && (
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updatePlatform = (idx: number, patch: Partial<PlatformConfig>) => {
    setPlatforms((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
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
        }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar configuração.");
    } finally {
      setSaving(false);
    }
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
              rows={4}
              value={businessContext}
              onChange={(e) => setBusinessContext(e.target.value)}
              placeholder="Se vazio, a IA usa os dados da sua campanha mais recente."
              data-testid="textarea-business-context"
            />
          </label>
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
