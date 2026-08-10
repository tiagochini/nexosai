import { useState } from "react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Instagram, Facebook, RefreshCw, Users, Heart, MessageCircle,
  Eye, TrendingUp, Globe, X, AlertTriangle, ChevronRight,
  BarChart3, Image, Film, Radio, Plus, Loader2,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailyMetricPoint {
  date: string;
  followers?: number;
  reach?: number;
  impressions?: number;
}

interface AccountAnalyticsPost {
  id: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  mediaType?: string;
  caption?: string;
  timestamp?: string;
  likes: number;
  comments: number;
  reach: number;
  impressions: number;
  saved?: number;
}

interface AccountAnalytics {
  integrationId: string;
  provider: string;
  accountName: string;
  accountId: string | null;
  profilePictureUrl?: string;
  biography?: string;
  website?: string;
  followers: number | null;
  following: number | null;
  mediaCount: number | null;
  avgEngagement: number | null;
  totalReach30d: number | null;
  totalImpressions30d: number | null;
  dailyMetrics: DailyMetricPoint[];
  recentPosts: AccountAnalyticsPost[];
  status: string;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("pt-BR");
}

function providerLabel(provider: string): string {
  switch (provider) {
    case "instagram": return "Instagram";
    case "facebook":
    case "meta_ads": return "Facebook";
    case "tiktok_ads": return "TikTok";
    default: return provider;
  }
}

function ProviderIcon({ provider, className }: { provider: string; className?: string }) {
  if (provider === "instagram") return <Instagram className={className} />;
  if (provider === "facebook" || provider === "meta_ads") return <Facebook className={className} />;
  if (provider === "tiktok_ads") return <Radio className={className} />;
  return <Globe className={className} />;
}

function providerColors(provider: string): string {
  if (provider === "instagram") return "text-pink-400 border-pink-400/40 bg-pink-400/10";
  if (provider === "facebook" || provider === "meta_ads") return "text-blue-400 border-blue-400/40 bg-blue-400/10";
  if (provider === "tiktok_ads") return "text-cyan-400 border-cyan-400/40 bg-cyan-400/10";
  return "text-muted-foreground border-border/40 bg-muted/10";
}

function relativeTime(iso?: string): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86400_000);
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `${days}d atrás`;
  if (days < 365) return `${Math.floor(days / 30)}m atrás`;
  return `${Math.floor(days / 365)}a atrás`;
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">
        <Icon className={`h-2.5 w-2.5 ${color ?? ""}`} />{label}
      </div>
      <div className={`font-mono font-bold text-sm ${color ?? "text-foreground"}`}>{value}</div>
    </div>
  );
}

// ─── Trend Chart ──────────────────────────────────────────────────────────────

type ChartMetric = "reach" | "impressions" | "followers";

const METRIC_LABELS: Record<ChartMetric, string> = {
  reach: "Alcance",
  impressions: "Impressões",
  followers: "Seguidores",
};

const METRIC_COLORS: Record<ChartMetric, string> = {
  reach: "#a78bfa",
  impressions: "#38bdf8",
  followers: "#34d399",
};

function fmtShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function AccountTrendChart({ dailyMetrics, provider }: { dailyMetrics: DailyMetricPoint[]; provider: string }) {
  const availableMetrics: ChartMetric[] = (["reach", "impressions", "followers"] as ChartMetric[]).filter(
    m => dailyMetrics.some(d => d[m] != null && d[m]! > 0)
  );
  const [activeMetrics, setActiveMetrics] = useState<Set<ChartMetric>>(new Set(availableMetrics));

  if (availableMetrics.length === 0) return null;

  const providerColor =
    provider === "instagram" ? "#f472b6"
    : provider === "facebook" || provider === "meta_ads" ? "#60a5fa"
    : "#22d3ee";

  const toggleMetric = (m: ChartMetric) => {
    setActiveMetrics(prev => {
      const next = new Set(prev);
      if (next.has(m)) {
        if (next.size > 1) next.delete(m); // keep at least one active
      } else {
        next.add(m);
      }
      return next;
    });
  };

  const chartData = dailyMetrics.map(({ date, ...rest }) => ({
    date: date.slice(5), // "MM-DD"
    ...rest,
  }));

  return (
    <div className="space-y-3">
      {/* Metric toggles */}
      <div className="flex flex-wrap gap-1.5">
        {availableMetrics.map(m => (
          <button
            key={m}
            onClick={() => toggleMetric(m)}
            className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border transition-colors ${
              activeMetrics.has(m)
                ? "border-current text-foreground bg-muted/20"
                : "border-border/30 text-muted-foreground/40"
            }`}
            style={activeMetrics.has(m) ? { borderColor: METRIC_COLORS[m], color: METRIC_COLORS[m] } : {}}
          >
            {METRIC_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fontFamily: "monospace", fill: "rgba(255,255,255,0.35)" }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 9, fontFamily: "monospace", fill: "rgba(255,255,255,0.35)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={fmtShort}
            width={36}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 0,
              fontSize: 11,
              fontFamily: "monospace",
              color: "hsl(var(--foreground))",
            }}
            formatter={(value: number, name: string) => [
              fmtShort(value),
              METRIC_LABELS[name as ChartMetric] ?? name,
            ]}
            labelStyle={{ color: "rgba(255,255,255,0.5)", marginBottom: 4 }}
          />
          {availableMetrics.filter(m => activeMetrics.has(m)).map(m => (
            <Line
              key={m}
              type="monotone"
              dataKey={m}
              stroke={METRIC_COLORS[m]}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, stroke: METRIC_COLORS[m], fill: METRIC_COLORS[m] }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {provider === "tiktok_ads" && (
        <p className="text-[10px] font-mono text-muted-foreground/40 italic">
          * Dados de alcance via posts publicados nos últimos 30 dias (TikTok não expõe histórico de seguidores)
        </p>
      )}
    </div>
  );
}

// ─── Detail Drawer ─────────────────────────────────────────────────────────────

function AccountDrawer({ account, onClose }: { account: AccountAnalytics; onClose: () => void }) {
  const colors = providerColors(account.provider);
  const textColor = colors.split(" ")[0];

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-card border-l border-border/60 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-border/50 px-5 py-4 flex items-center gap-3 shrink-0">
          <div className={`w-10 h-10 border flex items-center justify-center ${colors}`}>
            <ProviderIcon provider={account.provider} className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono font-bold text-sm uppercase tracking-wide truncate">{account.accountName}</div>
            <div className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-widest">
              {providerLabel(account.provider)} · {account.accountId ?? "—"}
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Profile section */}
          <div className="px-5 py-4 border-b border-border/30">
            <div className="flex items-start gap-4">
              {account.profilePictureUrl ? (
                <img src={account.profilePictureUrl} alt={account.accountName}
                  className={`w-16 h-16 rounded-full border-2 ${textColor} object-cover shrink-0`} />
              ) : (
                <div className={`w-16 h-16 border flex items-center justify-center ${colors} shrink-0`}>
                  <ProviderIcon provider={account.provider} className="h-6 w-6" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-mono font-bold text-base">{account.accountName}</div>
                {account.biography && (
                  <p className="text-xs font-mono text-muted-foreground/70 mt-1 leading-relaxed line-clamp-3">{account.biography}</p>
                )}
                {account.website && (
                  <a href={account.website} target="_blank" rel="noopener noreferrer"
                    className={`text-xs font-mono mt-1 flex items-center gap-1 ${textColor} hover:opacity-80 transition-opacity`}>
                    <Globe className="h-2.5 w-2.5" />{account.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Key metrics */}
          <div className="px-5 py-4 border-b border-border/30">
            <div className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-3">Métricas da Conta</div>
            <div className="grid grid-cols-2 gap-4">
              <StatChip icon={Users} label="Seguidores" value={fmt(account.followers)} color={textColor} />
              <StatChip icon={Users} label="Seguindo" value={fmt(account.following)} />
              <StatChip icon={Image} label="Publicações" value={fmt(account.mediaCount)} />
              <StatChip icon={Heart} label="Eng. Médio / Post" value={fmt(account.avgEngagement)} />
              {account.totalReach30d != null && (
                <StatChip icon={Eye} label="Alcance 30 dias" value={fmt(account.totalReach30d)} />
              )}
              {account.totalImpressions30d != null && (
                <StatChip icon={BarChart3} label="Impressões 30 dias" value={fmt(account.totalImpressions30d)} />
              )}
            </div>
          </div>

          {/* 30-day trend chart */}
          {account.dailyMetrics && account.dailyMetrics.length > 1 && (
            <div className="px-5 py-4 border-b border-border/30">
              <div className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-3">Evolução 30 dias</div>
              <AccountTrendChart dailyMetrics={account.dailyMetrics} provider={account.provider} />
            </div>
          )}

          {/* Recent posts */}
          {account.recentPosts.length > 0 && (
            <div className="px-5 py-4">
              <div className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-3">Top Posts por Engajamento</div>
              <div className="space-y-2">
                {[...account.recentPosts]
                  .sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments))
                  .slice(0, 6)
                  .map(post => (
                    <div key={post.id} className="border border-border/40 bg-background/40 p-3 flex gap-3 items-start">
                      {(post.thumbnailUrl || post.mediaUrl) ? (
                        <img
                          src={post.thumbnailUrl ?? post.mediaUrl}
                          alt="post"
                          className="w-14 h-14 object-cover border border-border/30 shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 bg-muted/20 border border-border/30 flex items-center justify-center shrink-0">
                          {post.mediaType === "VIDEO" ? <Film className="h-5 w-5 text-muted-foreground/30" /> : <Image className="h-5 w-5 text-muted-foreground/30" />}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        {post.caption && (
                          <p className="text-xs font-mono text-foreground/70 leading-relaxed line-clamp-2 mb-1.5">{post.caption}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-muted-foreground/60">
                          <span className="flex items-center gap-1"><Heart className="h-2.5 w-2.5 text-pink-400" />{fmt(post.likes)}</span>
                          <span className="flex items-center gap-1"><MessageCircle className="h-2.5 w-2.5 text-blue-400" />{fmt(post.comments)}</span>
                          {post.reach > 0 && <span className="flex items-center gap-1"><Eye className="h-2.5 w-2.5" />{fmt(post.reach)}</span>}
                          {post.timestamp && <span className="ml-auto">{relativeTime(post.timestamp)}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {account.error && (
            <div className="px-5 py-4">
              <div className="border border-yellow-400/30 bg-yellow-400/5 p-3 flex gap-2 text-xs font-mono text-yellow-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{account.error}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Account Card ─────────────────────────────────────────────────────────────

function AccountCard({ account, onClick }: { account: AccountAnalytics; onClick: () => void }) {
  const colors = providerColors(account.provider);
  const textColor = colors.split(" ")[0];
  const hasError = Boolean(account.error) && !account.followers;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left border border-border/50 bg-card/40 hover:border-border transition-colors relative overflow-hidden group`}
    >
      {/* Top accent */}
      <div className={`absolute top-0 left-0 right-0 h-[1px] ${textColor.replace("text", "bg")}/40`} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-4">
          {account.profilePictureUrl ? (
            <img
              src={account.profilePictureUrl}
              alt={account.accountName}
              className={`w-12 h-12 rounded-full border ${textColor} object-cover shrink-0`}
            />
          ) : (
            <div className={`w-12 h-12 border flex items-center justify-center ${colors} shrink-0`}>
              <ProviderIcon provider={account.provider} className="h-5 w-5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-sm truncate">{account.accountName}</span>
              <Badge variant="outline" className={`rounded-none font-mono text-[10px] px-1.5 py-0 ${colors}`}>
                {providerLabel(account.provider)}
              </Badge>
            </div>
            {account.accountId && (
              <div className="text-[11px] font-mono text-muted-foreground/40 truncate">ID: {account.accountId}</div>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0 mt-1" />
        </div>

        {hasError ? (
          <div className="flex items-start gap-2 text-xs font-mono text-yellow-400/70 border border-yellow-400/20 bg-yellow-400/5 p-2">
            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{account.error}</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className={`font-mono font-bold text-lg ${textColor}`}>{fmt(account.followers)}</div>
              <div className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">Seguidores</div>
            </div>
            <div className="text-center">
              <div className="font-mono font-bold text-lg text-foreground">{fmt(account.mediaCount)}</div>
              <div className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">Posts</div>
            </div>
            <div className="text-center">
              <div className="font-mono font-bold text-lg text-foreground">{fmt(account.avgEngagement)}</div>
              <div className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">Eng. Médio</div>
            </div>
          </div>
        )}

        {account.biography && !hasError && (
          <p className="mt-3 text-[11px] font-mono text-muted-foreground/50 line-clamp-1">{account.biography}</p>
        )}
      </div>
    </button>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

export function SocialAnalyticsTab() {
  const [selectedAccount, setSelectedAccount] = useState<AccountAnalytics | null>(null);
  const [addingMeta, setAddingMeta] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["/api/social/accounts/analytics"],
    queryFn: () =>
      customFetch<{ analytics: AccountAnalytics[] }>("/api/social/accounts/analytics").catch(
        () => ({ analytics: [] as AccountAnalytics[] })
      ),
    staleTime: 5 * 60_000, // 5 min cache
  });

  const analytics = data?.analytics ?? [];

  const handleAddMetaAccount = async () => {
    setAddingMeta(true);
    try {
      const { url } = await customFetch<{ url: string }>("/api/social/connect/meta");
      window.location.href = url;
    } catch {
      toast.error("Erro ao iniciar conexão OAuth. Verifique a configuração do app Meta.");
      setAddingMeta(false);
    }
  };

  return (
    <div className="space-y-5">
      {selectedAccount && (
        <AccountDrawer account={selectedAccount} onClose={() => setSelectedAccount(null)} />
      )}

      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest font-bold text-muted-foreground">
            {analytics.length} conta{analytics.length !== 1 ? "s" : ""} conectada{analytics.length !== 1 ? "s" : ""}
          </div>
          <div className="text-[11px] font-mono text-muted-foreground/40 mt-0.5">
            Clique em um card para ver análise completa · Dados em tempo real das APIs
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {analytics.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddMetaAccount}
              disabled={addingMeta}
              className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline gap-2 h-8"
            >
              {addingMeta ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Adicionar conta
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline gap-2 h-8"
          >
            <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="border border-border/30 bg-card/30 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-full bg-muted/30" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-32 bg-muted/30" />
                  <Skeleton className="h-3 w-20 bg-muted/20" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map(j => <Skeleton key={j} className="h-10 bg-muted/20" />)}
              </div>
            </div>
          ))}
        </div>
      ) : analytics.length === 0 ? (
        /* Empty state */
        <div className="border border-border/30 bg-card/30 py-16 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-10 border border-pink-400/40 bg-pink-400/10 flex items-center justify-center">
              <Instagram className="h-5 w-5 text-pink-400" />
            </div>
            <div className="w-10 h-10 border border-blue-400/40 bg-blue-400/10 flex items-center justify-center">
              <Facebook className="h-5 w-5 text-blue-400" />
            </div>
            <div className="w-10 h-10 border border-cyan-400/40 bg-cyan-400/10 flex items-center justify-center">
              <Radio className="h-5 w-5 text-cyan-400" />
            </div>
          </div>
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-1">
            Nenhuma conta social conectada
          </p>
          <p className="font-mono text-xs text-muted-foreground/40 mb-5">
            Conecte Instagram, Facebook ou TikTok em Configurações → Integrações
          </p>
          <a href="/settings?tab=integracoes">
            <Button size="sm" className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-primary gap-2">
              <TrendingUp className="h-3.5 w-3.5" />
              Conectar Conta Social
            </Button>
          </a>
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: "Total de Seguidores",
                icon: Users,
                value: fmt(analytics.reduce((s, a) => s + (a.followers ?? 0), 0)),
                color: "text-primary",
              },
              {
                label: "Total de Posts",
                icon: Image,
                value: fmt(analytics.reduce((s, a) => s + (a.mediaCount ?? 0), 0)),
                color: "text-foreground",
              },
              {
                label: "Alcance 30d",
                icon: Eye,
                value: fmt(analytics.reduce((s, a) => s + (a.totalReach30d ?? 0), 0)) === "0" ? "—" : fmt(analytics.reduce((s, a) => s + (a.totalReach30d ?? 0), 0)),
                color: "text-foreground",
              },
              {
                label: "Eng. Médio Geral",
                icon: Heart,
                value: (() => {
                  const withEng = analytics.filter(a => a.avgEngagement != null);
                  if (!withEng.length) return "—";
                  return fmt(Math.round(withEng.reduce((s, a) => s + (a.avgEngagement ?? 0), 0) / withEng.length));
                })(),
                color: "text-foreground",
              },
            ].map(stat => (
              <div key={stat.label} className="border border-border/30 bg-card/30 p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest mb-1">
                  <stat.icon className="h-2.5 w-2.5" />{stat.label}
                </div>
                <div className={`font-mono font-bold text-xl ${stat.color}`}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Account cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analytics.map(account => (
              <AccountCard
                key={account.integrationId}
                account={account}
                onClick={() => setSelectedAccount(account)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
