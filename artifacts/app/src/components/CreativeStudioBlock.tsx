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
import { useUiText } from "@/lib/i18n";

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

type RecordingMode = "no_face" | "partial_pip" | "own_recording" | "avatar_twin";

const RECORDING_MODES: { id: RecordingMode; label: readonly [string, string, string]; desc: readonly [string, string, string]; icon: React.ElementType; badge?: readonly [string, string, string] }[] = [
  {
    id: "avatar_twin",
    icon: Sparkles,
    label: ["Avatar Twin — Full Auto", "Avatar Twin — Full Auto", "Avatar Twin — Automático"],
    desc: ["Gera o vídeo completo com o seu avatar digital e voz clonada. Você não aparece — a IA cria tudo automaticamente.", "Generates the complete video with your digital avatar and cloned voice. You don't appear — AI creates everything automatically.", "Genera el vídeo completo con tu avatar digital y voz clonada. No apareces: la IA lo crea todo automáticamente."],
    badge: ["Avatar IA", "AI Avatar", "Avatar IA"],
  },
  {
    id: "no_face",
    icon: Monitor,
    label: ["Sem Aparição", "Faceless", "Sin aparición"],
    desc: ["IA gera B-roll cinematográfico automaticamente. Agente ATLAS dirige cada cena com paletas, câmera e ritmo.", "AI automatically generates cinematic B-roll. ATLAS directs each scene's palette, camera, and pacing.", "La IA genera B-roll cinematográfico automáticamente. ATLAS dirige cada escena con paletas, cámara y ritmo."],
    badge: ["Totalmente IA", "Fully AI", "Totalmente IA"],
  },
  {
    id: "partial_pip",
    icon: Camera,
    label: ["Aparição Parcial", "Partial Appearance", "Aparición parcial"],
    desc: ["Sua webcam aparece como PiP sobre o B-roll. GRAVAR captura simultaneamente a tela + a câmera.", "Your webcam appears as PiP over the B-roll. RECORD captures your screen and camera simultaneously.", "Tu cámara aparece como PiP sobre el B-roll. GRABAR captura la pantalla y la cámara simultáneamente."],
    badge: ["PiP webcam", "Webcam PiP", "Webcam PiP"],
  },
  {
    id: "own_recording",
    icon: Video,
    label: ["Filmagem Própria", "Own Recording", "Grabación propia"],
    desc: ["Você filma o vídeo completo. O Agente Editor (ATLAS) recebe suas cenas brutas e monta com cortes, legendas e música.", "You film the full video. Editor Agent (ATLAS) assembles your raw footage with cuts, captions, and music.", "Filmas el vídeo completo. El agente editor (ATLAS) monta tus tomas con cortes, subtítulos y música."],
    badge: ["Você dirige", "You direct", "Tú diriges"],
  },
];

const VIDEO_STATUS: Record<string, { label: readonly [string, string, string]; color: string }> = {
  intake: { label: ["Configurando", "Setting up", "Configurando"], color: "text-muted-foreground" },
  script_generating: { label: ["Roteirizando...", "Writing script...", "Redactando guion..."], color: "text-yellow-400" },
  script_ready: { label: ["Roteiro pronto", "Script ready", "Guion listo"], color: "text-primary" },
  script_approved: { label: ["Roteiro aprovado", "Script approved", "Guion aprobado"], color: "text-primary" },
  storyboard_generating: { label: ["Storyboard...", "Creating storyboard...", "Creando storyboard..."], color: "text-yellow-400" },
  storyboard_ready: { label: ["Storyboard pronto", "Storyboard ready", "Storyboard listo"], color: "text-primary" },
  storyboard_approved: { label: ["Storyboard aprovado", "Storyboard approved", "Storyboard aprobado"], color: "text-primary" },
  preview_generating: { label: ["Gerando preview...", "Generating preview...", "Generando vista previa..."], color: "text-yellow-400" },
  preview_ready: { label: ["Preview pronto", "Preview ready", "Vista previa lista"], color: "text-success/80" },
  preview_approved: { label: ["Preview aprovado", "Preview approved", "Vista previa aprobada"], color: "text-success" },
  final_generating: { label: ["Gerando HD...", "Generating HD...", "Generando HD..."], color: "text-yellow-400" },
  completed: { label: ["Concluído ✓", "Completed ✓", "Completado ✓"], color: "text-success" },
  failed: { label: ["Falhou", "Failed", "Falló"], color: "text-destructive" },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  campaignId: string;
  campaignTitle: string;
}

export function CreativeStudioBlock({ campaignId, campaignTitle }: Props) {
  const t = useUiText();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<RecordingMode>("avatar_twin");
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
      const hasUserFace = mode === "avatar_twin" || mode === "partial_pip" || mode === "own_recording";
      const voiceStyle = mode === "avatar_twin" ? "avatar" :
                         mode === "own_recording" ? "voice_clone" :
                         mode === "partial_pip" ? "voice_clone" : "narrator";
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
            voiceStyle,
            tone: "inspirational",
            rhythm: "medium",
            avatarMode: mode === "avatar_twin",
          },
        }),
      });
      return data;
    },
    onSuccess: (d) => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-projects", campaignId] });
      toast.success(d.project.script
        ? t("Projeto de vídeo criado com o roteiro VSL importado!", "Video project created with the VSL script imported!", "¡Proyecto de vídeo creado con el guion VSL importado!")
        : t("Projeto de vídeo criado! O agente CYRUS vai gerar o roteiro.", "Video project created! CYRUS will generate the script.", "¡Proyecto de vídeo creado! CYRUS generará el guion."));
      navigate(`/video-production?projectId=${d.project.id}`);
    },
   onError: () => toast.error(t("Erro ao criar projeto de vídeo", "Error creating video project", "Error al crear el proyecto de vídeo")),
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
             {t("Estúdio de Criativos — Aprovação Final", "Creative Studio — Final Approval", "Estudio creativo — Aprobación final")}
          </span>
        </div>
        <p className="text-[10px] font-mono text-muted-foreground/60 hidden sm:block">
           {t("Gere, revise e aprove os materiais reais antes do lançamento", "Generate, review, and approve the final assets before launch", "Genera, revisa y aprueba los materiales finales antes del lanzamiento")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border/40">

        {/* ── COL 1: Banners & Carrosséis ─────────────────────────────────── */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Image className="h-4 w-4 text-pink-400" />
             <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-foreground">{t("Banners & Criativos", "Banners & Creatives", "Banners y creatividades")}</span>
          </div>
          <p className="text-[11px] font-mono text-muted-foreground/70">
             {t("Imagens reais geradas pelo agente — conceito → preview → HD final. Aprovação por etapa.", "Images generated by the agent — concept → preview → final HD. Approval at each stage.", "Imágenes generadas por el agente: concepto → vista previa → HD final. Aprobación en cada etapa.")}
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
               {t(`${approvedCreatives.length}/${creatives.length} aprovados`, `${approvedCreatives.length}/${creatives.length} approved`, `${approvedCreatives.length}/${creatives.length} aprobados`)}
            </span>
          </div>

          {/* Format chips */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: "feed_square", label: "Feed 1:1" },
              { key: "stories", label: "Stories 9:16" },
              { key: "banner", label: "Banner 16:9" },
               { key: "carousel_slide", label: t("Carrossel", "Carousel", "Carrusel") },
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
              {creatives.length === 0 ? t("Gerar Criativos com IA", "Generate Creatives with AI", "Generar creatividades con IA") : t("Gerenciar Criativos", "Manage Creatives", "Gestionar creatividades")}
              <ChevronRight className="h-3.5 w-3.5 ml-auto" />
            </Button>
          </Link>

          {pendingCreatives.length > 0 && (
            <p className="text-[10px] font-mono text-yellow-400/80">
               ⚠ {t(`${pendingCreatives.length} criativo(s) aguardando aprovação final`, `${pendingCreatives.length} creative(s) awaiting final approval`, `${pendingCreatives.length} creatividad(es) pendientes de aprobación final`)}
            </p>
          )}
        </div>

        {/* ── COL 2: Vídeos (VSL/CPL/Reels) ───────────────────────────────── */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-blue-400" />
             <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-foreground">{t("Vídeos", "Videos", "Vídeos")}</span>
          </div>

          {/* Existing video projects */}
          {videos.length > 0 && (
            <div className="space-y-2">
              {videos.slice(0, 3).map(vp => {
                 const vs = VIDEO_STATUS[vp.status] ?? { label: [vp.status, vp.status, vp.status] as const, color: "text-muted-foreground" };
                return (
                  <div key={vp.id} className="border border-border/40 bg-card/60 p-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] text-foreground truncate">{vp.title}</div>
                       <div className={`font-mono text-[10px] ${vs.color}`}>{t(...vs.label)}</div>
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
                 <p className="text-[10px] font-mono text-muted-foreground/60">{t(`+${videos.length - 3} projeto(s) em /video-production`, `+${videos.length - 3} more project(s) in /video-production`, `+${videos.length - 3} proyecto(s) más en /video-production`)}</p>
              )}
            </div>
          )}

          {/* Recording mode selector */}
          <div className="space-y-2">
             <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{t("Modo de Criação", "Creation Mode", "Modo de creación")}</div>
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
                       {t(...rm.label)}
                    </span>
                    {rm.badge && (
                      <Badge variant="outline" className={`font-mono text-[8px] rounded-none px-1 uppercase ${mode === rm.id ? "border-primary/40 text-primary" : "border-border/30 text-muted-foreground"}`}>
                         {t(...rm.badge)}
                      </Badge>
                    )}
                  </div>
                   <p className="font-mono text-[10px] text-muted-foreground/70 mt-0.5 leading-relaxed">{t(...rm.desc)}</p>
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
               ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{t("Criando...", "Creating...", "Creando...")}</>
               : <><Clapperboard className="h-3.5 w-3.5" />{t("Criar Projeto de Vídeo", "Create Video Project", "Crear proyecto de vídeo")}</>}
          </Button>

          {mode === "avatar_twin" && (
            <p className="text-[10px] font-mono text-primary/70">
               ✦ {t("Seu avatar digital e voz clonada precisam estar configurados em", "Your digital avatar and cloned voice must be configured in", "Tu avatar digital y voz clonada deben estar configurados en")} <a href="/clone-digital" className="underline">{t("Clone Digital", "Digital Clone", "Clon digital")}</a>. {t("Se ainda não configurou, faça isso primeiro.", "If you haven't set them up yet, do that first.", "Si aún no los configuraste, hazlo primero.")}
            </p>
          )}
          {mode === "own_recording" && (
            <p className="text-[10px] font-mono text-primary/70">
               {t("O botão GRAVAR no topo da tela ficará ativo. Grave suas cenas e o Agente Editor (ATLAS) monta o vídeo final.", "The RECORD button at the top of the screen will be enabled. Record your scenes and Editor Agent (ATLAS) will assemble the final video.", "El botón GRABAR en la parte superior se activará. Graba tus escenas y el agente editor (ATLAS) montará el vídeo final.")}
            </p>
          )}
          {mode === "partial_pip" && (
            <p className="text-[10px] font-mono text-primary/70">
               {t("GRAVAR no topo ativa o PiP da webcam. Grave a tela + câmera simultaneamente.", "RECORD at the top enables webcam PiP. Record your screen and camera simultaneously.", "GRABAR en la parte superior activa el PiP de la webcam. Graba la pantalla y la cámara simultáneamente.")}
            </p>
          )}
        </div>

        {/* ── COL 3: Roteiros VSL/CPL ───────────────────────────────────────── */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-green-400" />
             <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-foreground">{t("Roteiros VSL / CPL", "VSL / CPL Scripts", "Guiones VSL / CPL")}</span>
          </div>
          <p className="text-[11px] font-mono text-muted-foreground/70">
             {t("Roteiros criados pelos agentes. Importe para o produtor de vídeo com um clique.", "Scripts created by agents. Import them into the video producer with one click.", "Guiones creados por los agentes. Impórtalos al productor de vídeo con un clic.")}
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
                             ? <span className="font-mono text-[10px] text-success">✓ {t("Roteiro pronto", "Script ready", "Guion listo")}</span>
                             : <span className="font-mono text-[10px] text-muted-foreground/50">{t("Sem roteiro", "No script", "Sin guion")}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Link href="/vsls">
                        <Button variant="outline" size="sm" className="font-mono uppercase tracking-widest rounded-none gap-1 h-7 px-2 text-[10px] border-border/40">
                           <ExternalLink className="h-3 w-3" />{t("Ver", "View", "Ver")}
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
                             : <><Clapperboard className="h-3 w-3" />{t("Criar Vídeo deste Roteiro", "Create Video from Script", "Crear vídeo desde este guion")}</>}
                        </Button>
                      )}
                      {linkedVideo && (
                        <Badge variant="outline" className="font-mono text-[9px] rounded-none px-1.5 border-success/30 text-success">
                           ✓ {t("Vídeo criado", "Video created", "Vídeo creado")}
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
               <p className="font-mono text-[11px] text-muted-foreground/60">{t("Nenhum roteiro VSL/CPL ainda", "No VSL/CPL scripts yet", "Todavía no hay guiones VSL/CPL")}</p>
              <Link href={`/vsls?campaignId=${campaignId}`}>
                <Button variant="outline" size="sm" className="font-mono uppercase tracking-widest rounded-none gap-1.5 h-7 px-3 text-[10px] border-primary/40 text-primary">
                   <Plus className="h-3 w-3" />{t("Criar Roteiro VSL", "Create VSL Script", "Crear guion VSL")}
                </Button>
              </Link>
            </div>
          )}

          {/* Creative completion summary */}
          <div className="border-t border-border/30 pt-3 space-y-1.5">
             <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{t("Status do Pacote", "Package Status", "Estado del paquete")}</div>
            {[
               { label: t("Banners", "Banners", "Banners"), done: approvedCreatives.length, total: creatives.length, color: "bg-pink-400" },
               { label: t("Vídeos", "Videos", "Vídeos"), done: completedVideos.length, total: videos.length, color: "bg-blue-400" },
               { label: t("Roteiros", "Scripts", "Guiones"), done: campaignVsls.filter(v => (v.sections ?? []).length > 0).length, total: campaignVsls.length, color: "bg-green-400" },
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
                 <span className="font-mono text-[10px] text-success">{t("Pacote criativo pronto para lançamento", "Creative package ready for launch", "Paquete creativo listo para el lanzamiento")}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
