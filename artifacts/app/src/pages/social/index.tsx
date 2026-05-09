import { useState } from "react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Share2, ExternalLink, CheckCircle2, XCircle, Loader2,
  Calendar, Eye, RefreshCw, Plus, Wifi, WifiOff, Play,
} from "lucide-react";

interface SocialAccount { id: string; platform: string; status: string; accountName?: string; connectedAt?: string }
interface SocialPost {
  id: string; platform: string; status: string; scheduledAt?: string; publishedAt?: string;
  caption?: string; mediaUrl?: string; impressions?: number; reach?: number; clicks?: number;
}

const PLATFORM_LABEL: Record<string, string> = { meta: "Meta (Instagram/Facebook)", tiktok: "TikTok" };
const PLATFORM_COLOR: Record<string, string> = {
  meta: "text-blue-400 border-blue-400/40 bg-blue-400/10",
  tiktok: "text-pink-400 border-pink-400/40 bg-pink-400/10",
};
const POST_STATUS_COLOR: Record<string, string> = {
  draft: "text-muted-foreground border-border/50 bg-muted/10",
  scheduled: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
  published: "text-success border-success/40 bg-success/10",
  failed: "text-destructive border-destructive/40 bg-destructive/10",
  cancelled: "text-muted-foreground border-border/50 bg-muted/10",
};

export default function SocialPage() {
  const [activeTab, setActiveTab] = useState<"accounts" | "posts">("accounts");
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ["/api/social/accounts"],
    queryFn: async () => {
      const res = await customFetch<Response>("/api/social/accounts");
      if (!res.ok) return { accounts: [] };
      return res.json() as Promise<{ accounts: SocialAccount[] }>;
    },
  });

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ["/api/social/posts"],
    enabled: activeTab === "posts",
    queryFn: async () => {
      const res = await customFetch<Response>("/api/social/posts?limit=20");
      if (!res.ok) return { posts: [] };
      return res.json() as Promise<{ posts: SocialPost[] }>;
    },
  });

  const connectMutation = useMutation({
    mutationFn: async (platform: string) => {
      const res = await customFetch<Response>(`/api/social/connect/${platform}`);
      if (!res.ok) throw new Error("Erro ao conectar");
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: (data) => {
      window.open(data.url, "_blank", "width=600,height=700");
    },
    onError: () => toast.error("Erro ao iniciar conexão OAuth"),
  });

  const disconnectMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const res = await customFetch<Response>(`/api/social/accounts/${accountId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao desconectar");
    },
    onSuccess: () => {
      toast.success("Conta desconectada.");
      queryClient.invalidateQueries({ queryKey: ["/api/social/accounts"] });
    },
    onError: () => toast.error("Erro ao desconectar conta"),
  });

  const publishMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await customFetch<Response>(`/api/social/posts/${postId}/publish`, { method: "POST" });
      if (!res.ok) throw new Error("Erro ao publicar");
    },
    onSuccess: () => {
      toast.success("Post publicado com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] });
    },
    onError: () => toast.error("Erro ao publicar post"),
  });

  const syncMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await customFetch<Response>(`/api/social/posts/${postId}/sync-metrics`, { method: "POST" });
      if (!res.ok) throw new Error("Erro ao sincronizar");
    },
    onSuccess: () => {
      toast.success("Métricas sincronizadas.");
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] });
    },
  });

  const PLATFORMS = ["meta", "tiktok"];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="border-b border-border/50 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
          <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold">Social Media</h1>
        </div>
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          Conecte suas plataformas e gerencie posts gerados pelos agentes IA
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border border-border/50 bg-card/40 p-1 rounded-sm w-fit">
        {[{ id: "accounts" as const, label: "Contas Conectadas" }, { id: "posts" as const, label: "Posts & Agendamentos" }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-[10px] font-mono uppercase tracking-widest transition-all rounded-sm
              ${activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Accounts Tab ── */}
      {activeTab === "accounts" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PLATFORMS.map(platform => {
              const account = (accountsData?.accounts ?? []).find(a => a.platform === platform);
              const connected = account?.status === "connected";
              return (
                <div key={platform} className={`border bg-card/40 p-5 ${connected ? "border-success/30" : "border-border/50"}`}>
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 border flex items-center justify-center ${PLATFORM_COLOR[platform]}`}>
                        <Share2 className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-mono font-bold text-sm uppercase tracking-wide">{PLATFORM_LABEL[platform]}</div>
                        {account?.accountName && <div className="text-[10px] text-muted-foreground font-mono">@{account.accountName}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {connected ? <Wifi className="h-4 w-4 text-success" /> : <WifiOff className="h-4 w-4 text-muted-foreground/40" />}
                      <Badge variant="outline" className={`rounded-none font-mono text-[9px] px-2 py-0.5 ${connected ? "text-success border-success/40 bg-success/10" : "text-muted-foreground border-border/50"}`}>
                        {connected ? "Conectado" : "Desconectado"}
                      </Badge>
                    </div>
                  </div>
                  {connected ? (
                    <Button variant="outline" size="sm" onClick={() => account && disconnectMutation.mutate(account.id)}
                      disabled={disconnectMutation.isPending}
                      className="font-mono uppercase tracking-widest rounded-none text-[10px] h-8 px-3 border-destructive/30 text-destructive hover:bg-destructive/10 w-full">
                      <XCircle className="h-3 w-3 mr-1.5" />Desconectar
                    </Button>
                  ) : (
                    <Button onClick={() => { setConnectingPlatform(platform); connectMutation.mutate(platform); }}
                      disabled={connectMutation.isPending && connectingPlatform === platform}
                      className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-10 w-full text-[10px]">
                      {connectMutation.isPending && connectingPlatform === platform
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Conectando...</>
                        : <><ExternalLink className="h-3.5 w-3.5" />Conectar via OAuth</>}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="border border-border/50 bg-card/30 p-4">
            <p className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-widest">
              Os agentes IA geram posts automaticamente quando uma campanha entra em fase de execução. Conecte suas contas para habilitar publicação automática e coleta de métricas.
            </p>
          </div>
        </div>
      )}

      {/* ── Posts Tab ── */}
      {activeTab === "posts" && (
        <div className="space-y-3">
          {postsLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 bg-muted/20" />)}</div>
          ) : (postsData?.posts ?? []).length === 0 ? (
            <div className="py-16 text-center">
              <Calendar className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">Nenhum post gerado ainda</p>
              <p className="font-mono text-[10px] text-muted-foreground/50">Posts são gerados automaticamente quando campanhas entram na fase de execução</p>
            </div>
          ) : (
            (postsData?.posts ?? []).map(post => (
              <div key={post.id} className="border border-border/50 bg-card/40 p-4">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Badge variant="outline" className={`rounded-none font-mono text-[9px] px-2 py-0.5 ${PLATFORM_COLOR[post.platform] ?? ""}`}>{post.platform}</Badge>
                  <Badge variant="outline" className={`rounded-none font-mono text-[9px] px-2 py-0.5 ${POST_STATUS_COLOR[post.status] ?? ""}`}>{post.status}</Badge>
                  {post.scheduledAt && <span className="text-[9px] font-mono text-muted-foreground/60">{new Date(post.scheduledAt).toLocaleString("pt-BR")}</span>}
                </div>
                {post.caption && <p className="text-xs font-mono text-foreground/80 mb-3 leading-relaxed line-clamp-3">{post.caption}</p>}
                {(post.impressions || post.reach || post.clicks) ? (
                  <div className="flex gap-4 text-[9px] font-mono text-muted-foreground/70 mb-3">
                    {post.impressions && <span><Eye className="h-3 w-3 inline mr-1" />{post.impressions.toLocaleString()} impressões</span>}
                    {post.reach && <span>{post.reach.toLocaleString()} alcance</span>}
                    {post.clicks && <span>{post.clicks.toLocaleString()} cliques</span>}
                  </div>
                ) : null}
                <div className="flex gap-2">
                  {post.status === "draft" && (
                    <Button size="sm" onClick={() => publishMutation.mutate(post.id)} disabled={publishMutation.isPending}
                      className="font-mono uppercase tracking-widest rounded-none h-7 px-3 text-[9px] bg-success/20 text-success border border-success/30">
                      <Play className="h-2.5 w-2.5 mr-1" />Publicar
                    </Button>
                  )}
                  {post.status === "published" && (
                    <Button size="sm" variant="ghost" onClick={() => syncMutation.mutate(post.id)} disabled={syncMutation.isPending}
                      className="font-mono uppercase tracking-widest rounded-none h-7 px-3 text-[9px] text-muted-foreground">
                      <RefreshCw className="h-2.5 w-2.5 mr-1" />Sync Métricas
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
