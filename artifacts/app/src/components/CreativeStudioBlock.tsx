import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Image, Film, FileText, ChevronRight, Sparkles, Loader2,
  CheckCircle2, Clock, Play, Layers, Monitor, User, Camera,
  Mic, Video, Clapperboard, Radio, ExternalLink, Plus,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface VideoProject {
  id: string;
  title: string;
  status: string;
  format: string;
  script?: string | null;
  config: { hasUserFace?: boolean };
  createdAt: string;
}

interface Creative {
  id: string;
  status: string;
  format: string;
  platform: string;
}

interface VslItem {
  id: string;
  title: string;
  status: string;
  format: string;
  sections: unknown[];
  campaignId?: string | null;
}

type RecordingMode = "no_face" | "partial_pip" | "own_recording";

const RECORDING_MODES: { id: RecordingMode; label: string; desc: string; icon: React.ElementType; badge?: string }[] = [
  {
    id: "no_face",
    icon: Monitor,
    label: "Sem Aparição",
    desc: "IA gera B-roll cinematográfico automaticamente. Agente ATLAS dirige cada cena com paletas, câmera e ritmo.",
    badge: "Totalmente IA",
  },
  {
    id: "partial_pip",
    icon: Camera,
    label: "Aparição Parcial",
    desc: "Sua webcam aparece como PiP sobre o B-roll. GRAVAR captura simultaneamente a tela + a câmera.",
    badge: "PiP webcam",
  },
  {
    id: "own_recording",
    icon: Video,
    label: "Filmagem Própria",
    desc: "Você filma o vídeo completo. O Agente Editor (ATLAS) recebe suas cenas brutas e monta com cortes, legendas e música.",
    badge: "Você dirige",
  },
];

const VIDEO_STATUS: Record<string, { label: string; color: string }> = {
  intake: { label: "Configurando", color: "text-muted-foreground" },
  script_generating: { label: "Roteirizando...", color: "text-yellow-400" },
  script_ready: { label: "Roteiro pronto", color: "text-primary" },
  script_approved: { label: "Roteiro aprovado", color: "text-primary" },
  storyboard_generating: { label: "Storyboard...", color: "text-yellow-400" },
  storyboard_ready: { label: "Storyboard pronto", color: "text-primary" },
  storyboard_approved: { label: "Storyboard aprovado", color: "text-primary" },
  preview_generating: { label: "Gerando preview...", color: "text-yellow-400" },
  preview_ready: { label: "Preview pronto", color: "text-success/80" },
  preview_approved: { label: "Preview aprovado", color: "text-success" },
  final_generating: { label: "Gerando HD...", color: "text-yellow-400" },
  completed: { label: "Concluído ✓", color: "text-success" },
  failed: { label: "Falhou", color: "text-destructive" },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  campaignId: string;
  campaignTitle: string;
}

export function CreativeStudioBlock({ campaignId, campaignTitle }: Props) {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<RecordingMode>("no_face");
  const [creatingVideo, setCreatingVideo] = useState(false);
  const queryClient = useQueryClient();

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: videosData } = useQuery({
    queryKey: ["/api/video-projects", campaignId],
    queryFn: () => customFetch<{ projects: VideoProject[] }>(`/api/video-projects?campaignId=${campaignId}`).catch(() => ({ projects: [] })),
    staleTime: 30_000,
  });

  const { data: creativesData } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/creatives`],
    queryFn: () => customFetch<{ creatives: Creative[] }>(`/api/campaigns/${campaignId}/creatives`).catch(() => ({ creatives: [] })),
    staleTime: 30_000,
  });

  const { data: vslsData } = useQuery({
    queryKey: ["/api/vsls", campaignId],
    queryFn: () => customFetch<{ vsls: VslItem[] }>(`/api/vsls?campaignId=${campaignId}`).catch(() => ({ vsls: [] })),
    staleTime: 30_000,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createVideoMutation = useMutation({
    mutationFn: async ({ vslId, format }: { vslId?: string; format?: string } = {}) => {
      const hasUserFace = mode !== "no_face";
      const data = await customFetch<{ project: VideoProject }>("/api/video-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: vslId
            ? `Vídeo — ${vsls.find(v => v.id === vslId)?.title ?? campaignTitle}`
            : `Vídeo — ${campaignTitle}`,
          format: format ?? "vsl",
          campaignId,
          vslId,
          config: {
            hasUserFace,
            voiceStyle: hasUserFace ? "avatar" : "narrator",
            tone: "inspirational",
            rhythm: "medium",
          },
        }),
      });
      return data;
    },
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-projects", campaignId] });
      toast.success(d.project.script
        ? "Projeto de vídeo criado com o roteiro VSL importado!"
        : "Projeto de vídeo criado! O agente CYRUS vai gerar o roteiro.");
      navigate(`/video-production?projectId=${d.project.id}`);
    },
    onError: () => toast.error("Erro ao criar projeto de vídeo"),
  });

  const videos = videosData?.projects ?? [];
  const creatives = creativesData?.creatives ?? [];
  const vsls = vslsData?.vsls ?? [];

  const approvedCreatives = creatives.filter(c => c.status === "final_approved" || c.status === "approved");
  const pendingCreatives = creatives.filter(c => !["final_approved", "approved"].includes(c.status));
  const completedVideos = videos.filter(v => v.status === "completed");
  const activeVideos = videos.filter(v => v.status !== "completed");
  const campaignVsls = vsls.filter(v => v.campaignId === campaignId || vsls.length <= 3);

  return (
    <div className="border border-primary/30 bg-card/40 space-y-0 overflow-hidden">
      {/* Header */}
      <div className="bg-primary/8 border-b border-primary/20 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-primary">
            Estúdio de Criativos — Aprovação Final
          </span>
        </div>
        <p className="text-[10px] font-mono text-muted-foreground/60 hidden sm:block">
          Gere, revise e aprove os materiais reais antes do lançamento
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border/40">

        {/* ── COL 1: Banners & Carrosséis ─────────────────────────────────── */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Image className="h-4 w-4 text-pink-400" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-foreground">Banners & Criativos</span>
          </div>
          <p className="text-[11px] font-mono text-muted-foreground/70">
            Imagens reais geradas pelo agente — conceito → preview → HD final. Aprovação por etapa.
          </p>

          {/* Status bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1 bg-border/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-success transition-all"
                style={{ width: creatives.length > 0 ? `${(approvedCreatives.length / creatives.length) * 100}%` : "0%" }}
              />
            </div>
            <span className="font-mono text-[10px] text-muted-foreground shrink-0">
              {approvedCreatives.length}/{creatives.length} aprovados
            </span>
          </div>

          {/* Format chips */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: "feed_square", label: "Feed 1:1" },
              { key: "stories", label: "Stories 9:16" },
              { key: "banner", label: "Banner 16:9" },
              { key: "carousel_slide", label: "Carrossel" },
            ].map(f => {
              const count = creatives.filter(c => c.format === f.key);
              const done = count.filter(c => c.status === "final_approved" || c.status === "approved").length;
              return (
                <div key={f.key} className={`text-[10px] font-mono px-2 py-0.5 border rounded-none ${done > 0 && done === count.length ? "border-success/40 text-success bg-success/5" : "border-border/40 text-muted-foreground"}`}>
                  {f.label} {count.length > 0 ? `${done}/${count.length}` : "—"}
                </div>
              );
            })}
          </div>

          <Link href={`/campaigns/${campaignId}/creatives`}>
            <Button className="w-full font-mono uppercase tracking-widest rounded-none gap-2 h-9 text-xs btn-weapon-primary">
              <Layers className="h-3.5 w-3.5" />
              {creatives.length === 0 ? "Gerar Criativos com IA" : "Gerenciar Criativos"}
              <ChevronRight className="h-3.5 w-3.5 ml-auto" />
            </Button>
          </Link>

          {pendingCreatives.length > 0 && (
            <p className="text-[10px] font-mono text-yellow-400/80">
              ⚠ {pendingCreatives.length} criativo(s) aguardando aprovação final
            </p>
          )}
        </div>

        {/* ── COL 2: Vídeos (VSL/CPL/Reels) ───────────────────────────────── */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-blue-400" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-foreground">Vídeos</span>
          </div>

          {/* Existing video projects */}
          {videos.length > 0 && (
            <div className="space-y-2">
              {videos.slice(0, 3).map(vp => {
                const vs = VIDEO_STATUS[vp.status] ?? { label: vp.status, color: "text-muted-foreground" };
                return (
                  <div key={vp.id} className="border border-border/40 bg-card/60 p-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] text-foreground truncate">{vp.title}</div>
                      <div className={`font-mono text-[10px] ${vs.color}`}>{vs.label}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className="font-mono text-[9px] rounded-none px-1.5 border-border/40 text-muted-foreground uppercase">
                        {vp.format}
                      </Badge>
                      {vp.config.hasUserFace ? <User className="h-3 w-3 text-primary/60" /> : <Monitor className="h-3 w-3 text-primary/60" />}
                    </div>
                  </div>
                );
              })}
              {videos.length > 3 && (
                <p className="text-[10px] font-mono text-muted-foreground/60">+{videos.length - 3} projeto(s) em /video-production</p>
              )}
            </div>
          )}

          {/* Recording mode selector */}
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Modo de Criação</div>
            {RECORDING_MODES.map(rm => (
              <button
                key={rm.id}
                onClick={() => setMode(rm.id)}
                className={`w-full text-left border p-2.5 flex items-start gap-2.5 transition-all ${
                  mode === rm.id
                    ? "border-primary/50 bg-primary/8"
                    : "border-border/30 hover:border-border/60"
                }`}
              >
                <div className={`w-3 h-3 rounded-full border-2 mt-0.5 shrink-0 transition-all ${mode === rm.id ? "border-primary bg-primary" : "border-muted-foreground/40"}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <rm.icon className={`h-3 w-3 shrink-0 ${mode === rm.id ? "text-primary" : "text-muted-foreground/60"}`} />
                    <span className={`font-mono text-[11px] font-bold uppercase tracking-wide ${mode === rm.id ? "text-primary" : "text-foreground/80"}`}>
                      {rm.label}
                    </span>
                    {rm.badge && (
                      <Badge variant="outline" className={`font-mono text-[8px] rounded-none px-1 uppercase ${mode === rm.id ? "border-primary/40 text-primary" : "border-border/30 text-muted-foreground"}`}>
                        {rm.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground/70 mt-0.5 leading-relaxed">{rm.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <Button
            onClick={() => createVideoMutation.mutate({})}
            disabled={createVideoMutation.isPending}
            className="w-full font-mono uppercase tracking-widest rounded-none gap-2 h-9 text-xs btn-weapon-primary"
          >
            {createVideoMutation.isPending
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Criando...</>
              : <><Clapperboard className="h-3.5 w-3.5" />Criar Projeto de Vídeo</>}
          </Button>

          {mode === "own_recording" && (
            <p className="text-[10px] font-mono text-primary/70">
              O botão GRAVAR no topo da tela ficará ativo. Grave suas cenas e o Agente Editor (ATLAS) monta o vídeo final.
            </p>
          )}
          {mode === "partial_pip" && (
            <p className="text-[10px] font-mono text-primary/70">
              GRAVAR no topo ativa o PiP da webcam. Grave a tela + câmera simultaneamente.
            </p>
          )}
        </div>

        {/* ── COL 3: Roteiros VSL/CPL ───────────────────────────────────────── */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-green-400" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-foreground">Roteiros VSL / CPL</span>
          </div>
          <p className="text-[11px] font-mono text-muted-foreground/70">
            Roteiros criados pelos agentes. Importe para o produtor de vídeo com um clique.
          </p>

          {campaignVsls.length > 0 ? (
            <div className="space-y-2">
              {campaignVsls.slice(0, 4).map(vsl => {
                const hasScript = (vsl.sections ?? []).length > 0;
                const linkedVideo = videos.find(v => v.title.includes(vsl.title.slice(0, 15)));
                return (
                  <div key={vsl.id} className="border border-border/40 bg-card/60 p-2.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] text-foreground truncate">{vsl.title}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className="font-mono text-[9px] rounded-none px-1.5 border-border/30 text-muted-foreground uppercase">
                            {vsl.format}
                          </Badge>
                          {hasScript
                            ? <span className="font-mono text-[10px] text-success">✓ Roteiro pronto</span>
                            : <span className="font-mono text-[10px] text-muted-foreground/50">Sem roteiro</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Link href="/vsls">
                        <Button variant="outline" size="sm" className="font-mono uppercase tracking-widest rounded-none gap-1 h-7 px-2 text-[10px] border-border/40">
                          <ExternalLink className="h-3 w-3" />Ver
                        </Button>
                      </Link>
                      {hasScript && !linkedVideo && (
                        <Button
                          size="sm"
                          onClick={() => createVideoMutation.mutate({ vslId: vsl.id, format: vsl.format as string })}
                          disabled={createVideoMutation.isPending}
                          className="font-mono uppercase tracking-widest rounded-none gap-1 h-7 px-2 text-[10px] btn-weapon-primary flex-1"
                        >
                          {createVideoMutation.isPending
                            ? <><Loader2 className="h-3 w-3 animate-spin" />...</>
                            : <><Clapperboard className="h-3 w-3" />Criar Vídeo deste Roteiro</>}
                        </Button>
                      )}
                      {linkedVideo && (
                        <Badge variant="outline" className="font-mono text-[9px] rounded-none px-1.5 border-success/30 text-success">
                          ✓ Vídeo criado
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="border border-border/30 p-3 text-center space-y-2">
              <FileText className="h-6 w-6 text-muted-foreground/30 mx-auto" />
              <p className="font-mono text-[11px] text-muted-foreground/60">Nenhum roteiro VSL/CPL ainda</p>
              <Link href={`/vsls?campaignId=${campaignId}`}>
                <Button variant="outline" size="sm" className="font-mono uppercase tracking-widest rounded-none gap-1.5 h-7 px-3 text-[10px] border-primary/40 text-primary">
                  <Plus className="h-3 w-3" />Criar Roteiro VSL
                </Button>
              </Link>
            </div>
          )}

          {/* Creative completion summary */}
          <div className="border-t border-border/30 pt-3 space-y-1.5">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Status do Pacote</div>
            {[
              { label: "Banners", done: approvedCreatives.length, total: creatives.length, color: "bg-pink-400" },
              { label: "Vídeos", done: completedVideos.length, total: videos.length, color: "bg-blue-400" },
              { label: "Roteiros", done: campaignVsls.filter(v => (v.sections ?? []).length > 0).length, total: campaignVsls.length, color: "bg-green-400" },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-muted-foreground w-16 shrink-0">{item.label}</span>
                <div className="flex-1 h-1 bg-border/40 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} transition-all`} style={{ width: item.total > 0 ? `${(item.done / item.total) * 100}%` : "0%" }} />
                </div>
                <span className="font-mono text-[10px] text-muted-foreground shrink-0 w-8 text-right">{item.done}/{item.total}</span>
              </div>
            ))}
            {approvedCreatives.length > 0 && completedVideos.length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <CheckCircle2 className="h-3 w-3 text-success" />
                <span className="font-mono text-[10px] text-success">Pacote criativo pronto para lançamento</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
