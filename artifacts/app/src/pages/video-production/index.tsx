import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import {
  Video, Play, CheckCircle2, Clock, AlertCircle, Sparkles,
  ChevronRight, User, Mic, Film, Wand2, Eye, Download,
  RefreshCw, Plus, Settings, Info, Clapperboard, Shirt, Lightbulb,
  ChevronDown, ChevronUp, Camera, Upload, Scissors, Square,
} from "lucide-react";
import { toast } from "sonner";
import { useUiText, useUiLocale, intlLocale } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

type VideoStatus =
  | "intake" | "script_generating" | "script_ready" | "script_approved"
  | "storyboard_generating" | "storyboard_ready" | "storyboard_approved"
  | "preview_generating" | "preview_ready" | "preview_approved"
  | "awaiting_clone"
  | "final_generating" | "completed" | "failed";

type SceneClipStatus = "pending" | "generating" | "ready" | "failed";

interface Scene {
  id: string;
  order: number;
  title: string;
  durationSeconds: number;
  voiceoverText: string;
  visualDescription: string;
  sceneType: string;
  style: string;
  palette: string[];
  transition: string;
  mood: string;
  hasAvatar: boolean;
  videoPrompt: string;
  clipUrl?: string;
  clipUrlHd?: string;
  clipStatus: SceneClipStatus;
  notes?: string;
}

interface SceneTake {
  numero: number;
  energia: string;
  postura: string;
  instrucao: string;
  variacao?: string | null;
}

interface SceneDirection {
  sceneId: string;
  titulo: string;
  sceneType: string;
  voiceoverText: string;
  entregaEmocional: string;
  takes: SceneTake[];
  dica: string;
}

interface FilmingBrief {
  vestuario: { cor: string; estilo: string; evitar: string; rationale: string };
  cenario: { tipo: string; elementos: string[]; iluminacao: string; fundo: string; rationale: string };
  linguagem: { tom: string; velocidade: string; pausas: string; gestos: string; olhar: string };
  scenes: SceneDirection[];
  mensagemFinal: string;
}

interface Recording {
  id: string;
  name: string;
  state: "recording" | "paused" | "stopped";
  hasVideo: boolean;
  finalizationStatus: "pending" | "processing" | "ready" | "failed";
  videoSize?: number;
  createdAt: string;
}

interface VideoProject {
  id: string;
  title: string;
  format: string;
  status: VideoStatus;
  pendingAction?: "preview" | "final" | null;
  config: {
    hasUserFace: boolean;
    voiceStyle: string;
    aspectRatio: string;
    palette?: string[];
    styleKeywords?: string[];
    rhythm: string;
    tone: string;
    totalCreditsUsed: number;
    storyboardMeta?: { totalDurationSeconds: number; phaseSummary: string; directorNotes: string };
    filmingBrief?: FilmingBrief;
    filmingBriefGeneratedAt?: string;
  };
  script?: string;
  storyboard: Scene[];
  creditsUsed: number;
}

interface ProviderStatus {
  videoProvider: string | null;
  avatarProvider: string | null;
  voiceProvider: string | null;
  configured: boolean;
  instructions: { video: string; avatar: string; voice: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<VideoStatus, readonly [string, string, string]> = {
  intake: ["Configurando", "Setting up", "Configurando"],
  script_generating: ["Gerando roteiro...", "Generating script...", "Generando guion..."],
  script_ready: ["Roteiro pronto — aguardando aprovação", "Script ready — awaiting approval", "Guion listo — esperando aprobación"],
  script_approved: ["Roteiro aprovado", "Script approved", "Guion aprobado"],
  storyboard_generating: ["Diretor criando storyboard...", "Director is creating the storyboard...", "El director está creando el storyboard..."],
  storyboard_ready: ["Storyboard pronto — aguardando aprovação", "Storyboard ready — awaiting approval", "Storyboard listo — esperando aprobación"],
  storyboard_approved: ["Storyboard aprovado", "Storyboard approved", "Storyboard aprobado"],
  preview_generating: ["Gerando clipes de preview...", "Generating preview clips...", "Generando clips de vista previa..."],
  preview_ready: ["Preview pronto — aguardando aprovação", "Preview ready — awaiting approval", "Vista previa lista — esperando aprobación"],
  preview_approved: ["Preview aprovado", "Preview approved", "Vista previa aprobada"],
  awaiting_clone: ["Aguardando avatar/voz do lançador", "Waiting for launcher's avatar/voice", "Esperando el avatar/voz del lanzador"],
  final_generating: ["Gerando vídeo final HD...", "Generating final HD video...", "Generando vídeo final en HD..."],
  completed: ["Concluído", "Completed", "Completado"],
  failed: ["Erro", "Error", "Error"],
};

const PIPELINE_STEPS: { key: string; label: readonly [string, string, string]; statuses: string[] }[] = [
  { key: "script", label: ["Roteiro", "Script", "Guion"] as const, statuses: ["script_generating","script_ready","script_approved"] },
  { key: "storyboard", label: ["Storyboard", "Storyboard", "Storyboard"] as const, statuses: ["storyboard_generating","storyboard_ready","storyboard_approved"] },
  { key: "preview", label: ["Preview", "Preview", "Vista previa"] as const, statuses: ["preview_generating","preview_ready","preview_approved"] },
  { key: "final", label: ["Final HD", "Final HD", "Final HD"] as const, statuses: ["final_generating","completed"] },
];

function stepState(step: typeof PIPELINE_STEPS[0], status: VideoStatus): "done" | "active" | "pending" {
  const order = ["intake","script_generating","script_ready","script_approved","storyboard_generating","storyboard_ready","storyboard_approved","preview_generating","preview_ready","preview_approved","final_generating","completed","failed"];
  const cur = order.indexOf(status);
  const first = order.indexOf(step.statuses[0]!);
  const last = order.indexOf(step.statuses[step.statuses.length - 1]!);
  if (cur > last) return "done";
  if (cur >= first) return "active";
  return "pending";
}

const SCENE_TYPE_LABELS: Record<string, readonly [string, string, string]> = {
  hook: ["Hook", "Hook", "Hook"], problem: ["Problema", "Problem", "Problema"], solution: ["Solução", "Solution", "Solución"], proof: ["Prova", "Proof", "Prueba"], cta: ["CTA", "CTA", "CTA"], bridge: ["Ponte", "Bridge", "Puente"], transition: ["Transição", "Transition", "Transición"]
};
const SCENE_TYPE_COLORS: Record<string, string> = {
  hook: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  problem: "bg-red-500/20 text-red-400 border-red-500/30",
  solution: "bg-green-500/20 text-green-400 border-green-500/30",
  proof: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  cta: "bg-primary/20 text-primary border-primary/30",
  bridge: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  transition: "bg-muted text-muted-foreground border-border",
};

// ─── Create Project Modal ─────────────────────────────────────────────────────

function CreateProjectForm({
  onCreated,
  providerConfigured,
}: {
  onCreated: (p: VideoProject) => void;
  providerConfigured?: boolean;
}) {
  const t = useUiText();
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState("vsl");
  const [hasUserFace, setHasUserFace] = useState(false);
  const [voiceStyle, setVoiceStyle] = useState("narrator");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [tone, setTone] = useState("inspirational");
  const [rhythm, setRhythm] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!title.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await customFetch<{ project: VideoProject }>("/api/video-projects", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), format, config: { hasUserFace, voiceStyle, aspectRatio, tone, rhythm } }),
      });
      onCreated(res.project);
    } catch (e: any) {
      setError(e.message ?? t("Erro ao criar projeto", "Error creating project", "Error al crear el proyecto"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="font-mono text-xs text-muted-foreground mb-1 block">{t("NOME DO VÍDEO", "VIDEO NAME", "NOMBRE DEL VÍDEO")}</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={t("Ex: VSL NexOS — Lançamento 2026", "e.g. NexOS VSL — 2026 Launch", "p. ej., VSL de NexOS — Lanzamiento 2026")}
          className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="font-mono text-xs text-muted-foreground mb-1 block">{t("FORMATO", "FORMAT", "FORMATO")}</label>
          <select value={format} onChange={e => setFormat(e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-xs">
            <option value="vsl">VSL</option>
            <option value="cpl">CPL</option>
            <option value="live_promo">{t("Promo de Live", "Live Promo", "Promoción de directo")}</option>
            <option value="stories">Stories</option>
            <option value="reels">Reels</option>
            <option value="youtube">YouTube</option>
            <option value="webinar_promo">{t("Promo de Webinar", "Webinar Promo", "Promoción de webinar")}</option>
            <option value="testimonial">{t("Depoimento", "Testimonial", "Testimonio")}</option>
            <option value="product_demo">{t("Demo de Produto", "Product Demo", "Demostración de producto")}</option>
          </select>
        </div>
        <div>
          <label className="font-mono text-xs text-muted-foreground mb-1 block">{t("PROPORÇÃO", "ASPECT RATIO", "PROPORCIÓN")}</label>
          <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-xs">
            <option value="16:9">{t("16:9 — Horizontal", "16:9 — Landscape", "16:9 — Horizontal")}</option>
            <option value="9:16">{t("9:16 — Vertical", "9:16 — Portrait", "9:16 — Vertical")}</option>
            <option value="1:1">{t("1:1 — Quadrado", "1:1 — Square", "1:1 — Cuadrado")}</option>
          </select>
        </div>
      </div>
      <div>
        <label className="font-mono text-xs text-muted-foreground mb-2 block">{t("VOCÊ VAI APARECER NO VÍDEO?", "WILL YOU APPEAR IN THE VIDEO?", "¿APARECERÁS EN EL VÍDEO?")}</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { setHasUserFace(false); setVoiceStyle("narrator"); }}
            className={`border rounded-lg p-3 text-left transition-all ${!hasUserFace ? "border-primary bg-primary/5" : "border-border hover:border-border/80"}`}
          >
            <Film className="h-5 w-5 mb-1 text-primary" />
            <div className="font-mono text-xs font-bold">{t("Não — Vídeo com B-roll", "No — B-roll Video", "No — Vídeo con B-roll")}</div>
            <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{t("Agente gera cenas cinematográficas", "Agent generates cinematic scenes", "El agente genera escenas cinematográficas")}</div>
          </button>
          <button
            onClick={() => { setHasUserFace(true); setVoiceStyle("avatar"); }}
            className={`border rounded-lg p-3 text-left transition-all ${hasUserFace ? "border-primary bg-primary/5" : "border-border hover:border-border/80"}`}
          >
            <User className="h-5 w-5 mb-1 text-primary" />
            <div className="font-mono text-xs font-bold">{t("Sim — Apresentador", "Yes — Presenter", "Sí — Presentador")}</div>
            <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{t("Requer avatar digital configurado", "Requires a configured digital avatar", "Requiere un avatar digital configurado")}</div>
          </button>
        </div>
        {hasUserFace && (
          <div className="flex flex-col gap-1 mt-1">
            <a
              href="/video-production/director-guide"
              className="flex items-center gap-1.5 font-mono text-[10px] text-primary/70 hover:text-primary transition-colors font-bold"
            >
              <Info className="h-3 w-3" />
              {t("Guia do Diretor — vestuário, cenário, linguagem e roteiro completo", "Director's Guide — clothing, setting, language, and full script", "Guía del director: vestuario, escenario, lenguaje y guion completo")}
            </a>
            <a
              href="/video-production/filming-guide"
              className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <Info className="h-3 w-3" />
              {t("Guia técnico de filmagem — setup de câmera, áudio e iluminação", "Technical filming guide — camera, audio, and lighting setup", "Guía técnica de filmación: configuración de cámara, audio e iluminación")}
            </a>
          </div>
        )}
      </div>
      {hasUserFace && (
        <div>
          <label className="font-mono text-xs text-muted-foreground mb-1 block">{t("VOZ", "VOICE", "VOZ")}</label>
          <select value={voiceStyle} onChange={e => setVoiceStyle(e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-xs">
            <option value="avatar">{t("Avatar digital NexOS", "NexOS Digital Avatar", "Avatar digital de NexOS")}</option>
            <option value="voice_clone">{t("Clonar minha voz com IA", "Clone my voice with AI", "Clonar mi voz con IA")}</option>
          </select>
        </div>
      )}
      {providerConfigured === false && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1">
              <div className="font-mono text-xs font-bold text-amber-300">
                 {t("Produção 100% IA indisponível neste momento", "100% AI production is currently unavailable", "La producción 100 % con IA no está disponible en este momento")}
              </div>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted-foreground">
                 {t("Você ainda pode criar o projeto, gerar roteiro e storyboard. Na etapa de produção, grave o material no modo Híbrido ou abra o NexOS Studio para editar mídias existentes.", "You can still create a project and generate a script and storyboard. During production, record your footage in Hybrid mode or open NexOS Studio to edit existing media.", "Aún puedes crear el proyecto y generar el guion y el storyboard. En la etapa de producción, graba el material en modo híbrido o abre NexOS Studio para editar archivos existentes.")}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="font-mono text-[11px]"
                  onClick={() => {
                    setHasUserFace(true);
                    setVoiceStyle("narrator");
                  }}
                >
                  <Camera className="mr-1.5 h-3.5 w-3.5" />
                   {t("Preparar modo Híbrido", "Set up Hybrid mode", "Configurar modo híbrido")}
                </Button>
                <Button asChild type="button" variant="outline" size="sm" className="font-mono text-[11px]">
                  <a href="/video-editor/">
                    <Clapperboard className="mr-1.5 h-3.5 w-3.5" />
                     {t("Abrir NexOS Studio", "Open NexOS Studio", "Abrir NexOS Studio")}
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
           <label className="font-mono text-xs text-muted-foreground mb-1 block">{t("TOM", "TONE", "TONO")}</label>
          <select value={tone} onChange={e => setTone(e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-xs">
             <option value="inspirational">{t("Inspiracional", "Inspirational", "Inspirador")}</option>
             <option value="urgent">{t("Urgente", "Urgent", "Urgente")}</option>
             <option value="educational">{t("Educativo", "Educational", "Educativo")}</option>
             <option value="conversational">{t("Conversacional", "Conversational", "Conversacional")}</option>
             <option value="cinematic">{t("Cinematográfico", "Cinematic", "Cinematográfico")}</option>
          </select>
        </div>
        <div>
           <label className="font-mono text-xs text-muted-foreground mb-1 block">{t("RITMO", "PACE", "RITMO")}</label>
          <select value={rhythm} onChange={e => setRhythm(e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-xs">
             <option value="slow">{t("Lento", "Slow", "Lento")}</option>
             <option value="medium">{t("Médio", "Medium", "Medio")}</option>
             <option value="fast">{t("Rápido", "Fast", "Rápido")}</option>
             <option value="dynamic">{t("Dinâmico", "Dynamic", "Dinámico")}</option>
          </select>
        </div>
      </div>
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}
      <Button onClick={submit} disabled={loading || !title.trim()} className="w-full font-mono">
        {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
         {t("Criar Projeto de Vídeo", "Create Video Project", "Crear proyecto de vídeo")}
      </Button>
    </div>
  );
}

// ─── Pipeline Header ──────────────────────────────────────────────────────────

function PipelineBar({ status }: { status: VideoStatus }) {
  const t = useUiText();
  return (
    <div className="flex items-center gap-2 font-mono text-xs">
      {PIPELINE_STEPS.map((step, i) => {
        const state = stepState(step, status);
        return (
          <div key={step.key} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
              state === "done" ? "border-primary/40 bg-primary/10 text-primary" :
              state === "active" ? "border-primary bg-primary/20 text-primary font-bold" :
              "border-border text-muted-foreground"
            }`}>
              {state === "done" && <CheckCircle2 className="h-3 w-3" />}
              {state === "active" && <RefreshCw className="h-3 w-3 animate-spin" />}
              {state === "pending" && <Clock className="h-3 w-3" />}
              {t(...step.label)}
            </div>
            {i < PIPELINE_STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Script View ──────────────────────────────────────────────────────────────

function ScriptPanel({ project, onAction }: { project: VideoProject; onAction: () => void }) {
  const t = useUiText();
  const [editedScript, setEditedScript] = useState(project.script ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => { setEditedScript(project.script ?? ""); }, [project.script]);

  async function approveScript() {
    setLoading(true);
    try {
      await customFetch(`/api/video-projects/${project.id}/approve-script`, {
        method: "POST", body: JSON.stringify({ script: editedScript }),
      });
      onAction();
    } finally { setLoading(false); }
  }

  async function regenerate() {
    setLoading(true);
    try {
      await customFetch(`/api/video-projects/${project.id}/generate-script`, { method: "POST", body: "{}" });
      onAction();
    } finally { setLoading(false); }
  }

  if (project.status === "script_generating") {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
        <p className="font-mono text-sm text-muted-foreground">{t("Roteirista escrevendo o roteiro...", "Writer is drafting the script...", "El guionista está redactando el guion...")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-mono text-xs text-muted-foreground uppercase tracking-widest">{t("Roteiro gerado pelo agente — edite se necessário", "Script generated by the agent — edit if needed", "Guion generado por el agente: edítalo si es necesario")}</div>
        <Button variant="ghost" size="sm" onClick={regenerate} disabled={loading} className="font-mono text-xs">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />{t("Regenerar", "Regenerate", "Regenerar")}
        </Button>
      </div>
      <Textarea
        value={editedScript}
        onChange={e => setEditedScript(e.target.value)}
        rows={16}
        className="font-mono text-xs bg-background/50 resize-none"
        disabled={project.status === "script_approved"}
      />
      {project.status === "script_ready" && (
        <div className="flex gap-3">
          <Button onClick={approveScript} disabled={loading} className="font-mono flex-1">
            {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            {t("Aprovar Roteiro e Criar Storyboard", "Approve Script and Create Storyboard", "Aprobar guion y crear storyboard")}
          </Button>
        </div>
      )}
      {project.status === "script_approved" && (
        <div className="flex items-center gap-2 text-primary font-mono text-xs">
          <CheckCircle2 className="h-4 w-4" /> {t("Roteiro aprovado — storyboard sendo criado", "Script approved — storyboard is being created", "Guion aprobado: creando storyboard")}
        </div>
      )}
    </div>
  );
}

// ─── Storyboard View ──────────────────────────────────────────────────────────

function StoryboardPanel({ project, onAction }: { project: VideoProject; onAction: () => void }) {
  const t = useUiText();
  const [loading, setLoading] = useState(false);
  const [approvedScenes, setApprovedScenes] = useState<Set<string>>(new Set());
  const meta = project.config.storyboardMeta;
  const totalScenes = project.storyboard.length;
  const allScenesApproved = totalScenes > 0 && approvedScenes.size >= totalScenes;

  function toggleSceneApproval(sceneId: string) {
    setApprovedScenes(prev => {
      const next = new Set(prev);
      if (next.has(sceneId)) next.delete(sceneId);
      else next.add(sceneId);
      return next;
    });
  }

  function approveAllScenes() {
    setApprovedScenes(new Set(project.storyboard.map(s => s.id)));
  }

  async function approve() {
    setLoading(true);
    try {
      await customFetch(`/api/video-projects/${project.id}/approve-storyboard`, { method: "POST", body: "{}" });
      onAction();
    } finally { setLoading(false); }
  }

  async function regenerate() {
    setLoading(true);
    try {
      await customFetch(`/api/video-projects/${project.id}/generate-storyboard`, { method: "POST", body: "{}" });
      onAction();
    } finally { setLoading(false); }
  }

  if (project.status === "storyboard_generating") {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
        <p className="font-mono text-sm text-muted-foreground">{t("Diretor de Cena criando storyboard cena a cena...", "Scene Director is creating the storyboard scene by scene...", "El director de escena está creando el storyboard escena por escena...")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {meta && (
        <div className="border border-border/40 rounded-lg p-3 bg-muted/20 space-y-1">
          <div className="font-mono text-xs text-primary font-bold">{meta.phaseSummary}</div>
          <div className="font-mono text-[11px] text-muted-foreground">
            {t(`Duração total: ${Math.floor(meta.totalDurationSeconds / 60)}:${String(meta.totalDurationSeconds % 60).padStart(2,"0")} · ${project.storyboard.length} cenas`, `Total duration: ${Math.floor(meta.totalDurationSeconds / 60)}:${String(meta.totalDurationSeconds % 60).padStart(2,"0")} · ${project.storyboard.length} scenes`, `Duración total: ${Math.floor(meta.totalDurationSeconds / 60)}:${String(meta.totalDurationSeconds % 60).padStart(2,"0")} · ${project.storyboard.length} escenas`)}
          </div>
          {meta.directorNotes && <div className="font-mono text-[10px] text-muted-foreground/60 italic">{meta.directorNotes}</div>}
        </div>
      )}
      {/* Frame cards pre-approval progress */}
      {project.status === "storyboard_ready" && totalScenes > 0 && (
        <div className="border border-border/40 rounded-lg p-3 bg-muted/10 space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              {t(`Aprovação de frames — ${approvedScenes.size}/${totalScenes} cenas`, `Frame approval — ${approvedScenes.size}/${totalScenes} scenes`, `Aprobación de fotogramas — ${approvedScenes.size}/${totalScenes} escenas`)}
            </div>
            {!allScenesApproved && (
              <button
                onClick={approveAllScenes}
                className="font-mono text-[10px] text-primary hover:underline"
              >
                {t("Aprovar todas", "Approve all", "Aprobar todas")}
              </button>
            )}
            {allScenesApproved && (
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-green-400">
                <CheckCircle2 className="h-3 w-3" /> {t("Todas aprovadas", "All approved", "Todas aprobadas")}
              </div>
            )}
          </div>
          <div className="w-full h-1 bg-border/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${totalScenes > 0 ? (approvedScenes.size / totalScenes) * 100 : 0}%` }}
            />
          </div>
          {!allScenesApproved && (
            <p className="font-mono text-[10px] text-muted-foreground/60">
              {t("Revise cada frame abaixo e marque como aprovado. O render final só libera após todas as cenas confirmadas.", "Review each frame below and mark it as approved. Final rendering becomes available once all scenes are confirmed.", "Revisa cada fotograma y márcalo como aprobado. El renderizado final estará disponible cuando confirmes todas las escenas.")}
            </p>
          )}
        </div>
      )}
      <div className="space-y-3">
        {project.storyboard.map((scene) => {
          const isSceneApproved = approvedScenes.has(scene.id);
          return (
          <div key={scene.id} className={`border rounded-lg p-4 transition-colors ${isSceneApproved ? "border-green-400/40 bg-green-400/5" : "border-border/40 bg-background/40"}`}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full font-mono text-xs flex items-center justify-center font-bold ${isSceneApproved ? "bg-green-400/20 text-green-400" : "bg-primary/20 text-primary"}`}>
                  {isSceneApproved ? <CheckCircle2 className="h-3.5 w-3.5" /> : scene.order}
                </div>
                <span className="font-mono text-sm font-medium">{scene.title}</span>
                {scene.hasAvatar && <User className="h-3.5 w-3.5 text-yellow-400" />}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${SCENE_TYPE_COLORS[scene.sceneType] ?? "bg-muted text-muted-foreground border-border"}`}>
                  {SCENE_TYPE_LABELS[scene.sceneType] ? t(...SCENE_TYPE_LABELS[scene.sceneType]) : scene.sceneType}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">{scene.durationSeconds}s</span>
                {project.status === "storyboard_ready" && (
                  <button
                    onClick={() => toggleSceneApproval(scene.id)}
                    className={`font-mono text-[10px] px-2 py-0.5 rounded border transition-colors ${
                      isSceneApproved
                        ? "border-green-400/40 text-green-400 bg-green-400/10 hover:bg-green-400/5"
                        : "border-border/60 text-muted-foreground hover:border-primary/50 hover:text-primary"
                    }`}
                  >
                    {isSceneApproved ? `✓ ${t("Aprovada", "Approved", "Aprobada")}` : t("Aprovar", "Approve", "Aprobar")}
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
              <div>
                <div className="text-muted-foreground/60 uppercase text-[9px] tracking-widest mb-1">{t("Locução", "Voiceover", "Locución")}</div>
                <div className="text-foreground/80 leading-relaxed">{scene.voiceoverText}</div>
              </div>
              <div>
                <div className="text-muted-foreground/60 uppercase text-[9px] tracking-widest mb-1">{t("Cena Visual", "Visual Scene", "Escena visual")}</div>
                <div className="text-muted-foreground leading-relaxed">{scene.visualDescription}</div>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30">
              <div className="flex items-center gap-1.5">
                {scene.palette.map((c, i) => (
                  <div key={i} className="w-3.5 h-3.5 rounded-full border border-border/40" style={{ backgroundColor: c }} title={c} />
                ))}
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">{scene.mood} · {scene.transition}</span>
            </div>
          </div>
          );
        })}
      </div>
      {project.status === "storyboard_ready" && (
        <div className="flex gap-3">
          <Button variant="outline" onClick={regenerate} disabled={loading} className="font-mono">
            <RefreshCw className="h-4 w-4 mr-2" />{t("Regenerar", "Regenerate", "Regenerar")}
          </Button>
          <Button
            onClick={approve}
            disabled={loading || !allScenesApproved}
            className="font-mono flex-1"
            title={!allScenesApproved ? t(`Aprove todas as ${totalScenes} cenas para continuar`, `Approve all ${totalScenes} scenes to continue`, `Aprueba las ${totalScenes} escenas para continuar`) : undefined}
          >
            {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            {allScenesApproved ? t("Aprovar Storyboard — Gerar Preview", "Approve Storyboard — Generate Preview", "Aprobar storyboard — Generar vista previa") : t(`Aprove todas as cenas (${approvedScenes.size}/${totalScenes})`, `Approve all scenes (${approvedScenes.size}/${totalScenes})`, `Aprobar todas las escenas (${approvedScenes.size}/${totalScenes})`)}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Clips View ───────────────────────────────────────────────────────────────

function ClipsPanel({ project, isHd, onAction }: { project: VideoProject; isHd: boolean; onAction: () => void }) {
  const t = useUiText();
  const [loading, setLoading] = useState(false);
  const isGenerating = project.status === (isHd ? "final_generating" : "preview_generating");
  const isReady = project.status === (isHd ? "completed" : "preview_ready");

  async function approve() {
    setLoading(true);
    try {
      await customFetch(`/api/video-projects/${project.id}/approve-preview`, { method: "POST", body: "{}" });
      onAction();
    } finally { setLoading(false); }
  }

  async function poll() {
    setLoading(true);
    try {
      await customFetch(`/api/video-projects/${project.id}/poll`, { method: "POST", body: "{}" });
      onAction();
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      {isGenerating && (
        <div className="flex flex-col items-center justify-center h-32 gap-3 border border-primary/20 rounded-lg bg-primary/5">
          <RefreshCw className="h-7 w-7 text-primary animate-spin" />
          <p className="font-mono text-sm text-muted-foreground">
            {isHd ? t("Gerando clipes HD finais pelo agente...", "Agent is generating final HD clips...", "El agente está generando los clips HD finales...") : t("Gerando clipes de preview pelo agente...", "Agent is generating preview clips...", "El agente está generando los clips de vista previa...")}
          </p>
          <Button variant="outline" size="sm" onClick={poll} disabled={loading} className="font-mono text-xs">
            {t("Verificar Status", "Check Status", "Comprobar estado")}
          </Button>
        </div>
      )}
      <div className="space-y-3">
        {project.storyboard.map((scene) => {
          const url = isHd ? scene.clipUrlHd : scene.clipUrl;
          return (
            <div key={scene.id} className="border border-border/40 rounded-lg p-4 bg-background/40">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary font-mono text-xs flex items-center justify-center font-bold">{scene.order}</div>
                  <span className="font-mono text-sm">{scene.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  {scene.clipStatus === "ready" && url && (
                    <Badge variant="outline" className="font-mono text-[10px] text-green-400 border-green-400/30">
                      <CheckCircle2 className="h-3 w-3 mr-1" />{t("Pronto", "Ready", "Listo")}
                    </Badge>
                  )}
                  {scene.clipStatus === "generating" && (
                    <Badge variant="outline" className="font-mono text-[10px] text-yellow-400 border-yellow-400/30">
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />{t("Gerando", "Generating", "Generando")}
                    </Badge>
                  )}
                  {scene.clipStatus === "failed" && (
                    <Badge variant="outline" className="font-mono text-[10px] text-red-400 border-red-400/30">
                      <AlertCircle className="h-3 w-3 mr-1" />{t("Falhou", "Failed", "Falló")}
                    </Badge>
                  )}
                  {scene.clipStatus === "pending" && (
                    <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3 mr-1" />{t("Aguardando", "Waiting", "Esperando")}
                    </Badge>
                  )}
                </div>
              </div>
              {url && (
                <div className="mt-2">
                  <video src={url} controls className="w-full rounded-md max-h-48 bg-black" />
                  <a href={url} download className="flex items-center gap-1.5 font-mono text-[10px] text-primary hover:underline mt-1">
                    <Download className="h-3 w-3" />{t("Baixar clipe", "Download clip", "Descargar clip")}
                  </a>
                </div>
              )}
              {scene.clipStatus === "failed" && scene.notes && !scene.notes.startsWith("job:") && (
                <p className="font-mono text-[10px] text-red-400 mt-2">{scene.notes}</p>
              )}
            </div>
          );
        })}
      </div>
      {isReady && !isHd && (
        <div className="flex gap-3">
          <Button onClick={approve} disabled={loading} className="font-mono flex-1">
            {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            {t("Aprovar Preview — Gerar Vídeo HD Final", "Approve Preview — Generate Final HD Video", "Aprobar vista previa — Generar vídeo HD final")}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Avatar/Voice Clone Gate ────────────────────────────────────────────────────

interface StockAvatar { id: string; label: string; gender?: string }

function AvatarCloneGate({ project, onResumed, onDismiss }: { project: VideoProject; onResumed: (p: VideoProject) => void; onDismiss?: () => void }) {
  const t = useUiText();
  const [voiceCloneId, setVoiceCloneId] = useState<string | null>(null);
  const [avatarReady, setAvatarReady] = useState(false);
  const [avatarMode, setAvatarMode] = useState<"stock" | "record" | "video" | null>(null);
  const [stockAvatars, setStockAvatars] = useState<StockAvatar[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [selectingStockId, setSelectingStockId] = useState<string | null>(null);

  // Voice recording state
  const [recState, setRecState] = useState<"idle" | "recording" | "recorded" | "cloning" | "done">("idle");
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioMime, setAudioMime] = useState("audio/webm");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Avatar frame capture state
  const [camStream, setCamStream] = useState<MediaStream | null>(null);
  const [frameBase64, setFrameBase64] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [resuming, setResuming] = useState(false);

  // Video-based Digital Twin clone state
  const [videoStep, setVideoStep] = useState<"training" | "consent" | "uploading" | "training_pending" | "done">("training");
  const [videoRecState, setVideoRecState] = useState<"idle" | "recording" | "recorded">("idle");
  const [trainingBase64, setTrainingBase64] = useState<string | null>(null);
  const [trainingUrl, setTrainingUrl] = useState<string | null>(null);
  const [consentBase64, setConsentBase64] = useState<string | null>(null);
  const [consentUrl, setConsentUrl] = useState<string | null>(null);
  const [videoMime, setVideoMime] = useState("video/webm");
  const [avatarTrainingStatus, setAvatarTrainingStatus] = useState<string | null>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const trainingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (trainingPollRef.current) clearInterval(trainingPollRef.current); };
  }, []);

  async function startVideoRecording(kind: "training" | "consent") {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
      videoStreamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "video/mp4";
      setVideoMime(mime);
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      videoChunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) videoChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(videoChunksRef.current, { type: mime });
        const url = URL.createObjectURL(blob);
        const reader = new FileReader();
        reader.onload = () => {
          const b64 = (reader.result as string).split(",")[1] ?? "";
          if (kind === "training") setTrainingBase64(b64); else setConsentBase64(b64);
        };
        reader.readAsDataURL(blob);
        if (kind === "training") setTrainingUrl(url); else setConsentUrl(url);
        setVideoRecState("recorded");
      };
      recorder.start();
      videoRecorderRef.current = recorder;
      setVideoRecState("recording");
    } catch {
      setError(t("Câmera/microfone não disponíveis — verifique as permissões do navegador.", "Camera/microphone unavailable — check your browser permissions.", "Cámara/micrófono no disponibles: comprueba los permisos del navegador."));
    }
  }

  function stopVideoRecording() {
    if (videoRecorderRef.current && videoRecorderRef.current.state !== "inactive") videoRecorderRef.current.stop();
  }

  function retakeVideo(kind: "training" | "consent") {
    if (kind === "training") { setTrainingBase64(null); setTrainingUrl(null); } else { setConsentBase64(null); setConsentUrl(null); }
    setVideoRecState("idle");
  }

  function pollTrainingStatus() {
    trainingPollRef.current = setInterval(async () => {
      try {
        const res = await customFetch<{ status: string; heygenAvatarId?: string }>("/api/workspaces/me/persona/avatar-training-status");
        setAvatarTrainingStatus(res.status);
        if (res.status === "complete") {
          if (trainingPollRef.current) clearInterval(trainingPollRef.current);
          setVideoStep("done");
          setAvatarReady(true);
          toast.success(t("Avatar de vídeo treinado com sucesso.", "Video avatar trained successfully.", "Avatar de vídeo entrenado correctamente."));
        } else if (res.status === "failed") {
          if (trainingPollRef.current) clearInterval(trainingPollRef.current);
          setError(t("Treinamento do avatar falhou — tente novamente ou use foto rápida.", "Avatar training failed — try again or use quick photo.", "El entrenamiento del avatar falló: inténtalo de nuevo o usa una foto rápida."));
          setVideoStep("training");
        }
      } catch {
        // transient error — keep polling
      }
    }, 8000);
  }

  async function submitVideoClone() {
    if (!trainingBase64 || !consentBase64) return;
    setVideoStep("uploading");
    setError(null);
    try {
      await customFetch("/api/workspaces/me/persona/clone-avatar-video", {
        method: "POST",
        body: JSON.stringify({ trainingVideoBase64: trainingBase64, consentVideoBase64: consentBase64, mimeType: videoMime }),
      });
      setVideoStep("training_pending");
      setAvatarTrainingStatus("pending");
      pollTrainingStatus();
    } catch (e: any) {
      setError(e.message ?? t("Erro ao enviar vídeos para clonagem", "Error uploading videos for cloning", "Error al subir vídeos para clonarlos"));
      setVideoStep("consent");
    }
  }

  useEffect(() => {
    return () => { camStream?.getTracks().forEach(t => t.stop()); };
  }, [camStream]);

  async function loadStockAvatars() {
    setStockLoading(true);
    try {
      const res = await customFetch<{ avatars: StockAvatar[] }>("/api/workspaces/me/persona/stock-avatars");
      setStockAvatars(res.avatars ?? []);
    } catch {
      setError(t("Não foi possível carregar os avatares padrão.", "Could not load stock avatars.", "No se pudieron cargar los avatares predeterminados."));
    } finally {
      setStockLoading(false);
    }
  }

  async function startVoiceRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      setAudioMime(mime);
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        setAudioUrl(URL.createObjectURL(blob));
        const reader = new FileReader();
        reader.onload = () => setAudioBase64((reader.result as string).split(",")[1] ?? "");
        reader.readAsDataURL(blob);
        setRecState("recorded");
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecState("recording");
    } catch {
      setError(t("Microfone não disponível — verifique as permissões do navegador.", "Microphone unavailable — check your browser permissions.", "Micrófono no disponible: comprueba los permisos del navegador."));
    }
  }

  function stopVoiceRecording() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  }

  async function cloneVoiceNow() {
    if (!audioBase64) return;
    setError(null);
    setRecState("cloning");
    try {
      const res = await customFetch<{ voiceCloneId: string }>("/api/workspaces/me/persona/clone-voice", {
        method: "POST",
        body: JSON.stringify({ audioBase64, mimeType: audioMime, voiceName: "Voz do Lançador — NexOS" }),
      });
      setVoiceCloneId(res.voiceCloneId);
      setRecState("done");
      toast.success(t("Voz clonada com sucesso.", "Voice cloned successfully.", "Voz clonada correctamente."));
    } catch (e: any) {
      setError(e.message ?? t("Erro ao clonar voz", "Error cloning voice", "Error al clonar la voz"));
      setRecState("recorded");
    }
  }

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      setCamStream(stream);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 50);
    } catch {
      setError(t("Câmera não disponível — verifique as permissões do navegador.", "Camera unavailable — check your browser permissions.", "Cámara no disponible: comprueba los permisos del navegador."));
    }
  }

  function captureFrame() {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current, c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    setFrameBase64(c.toDataURL("image/jpeg", 0.92).split(",")[1] ?? "");
    camStream?.getTracks().forEach(t => t.stop());
    setCamStream(null);
  }

  async function createAvatarFromFrame() {
    if (!frameBase64) return;
    setAvatarUploading(true);
    setError(null);
    try {
      await customFetch("/api/workspaces/me/persona/clone-avatar", {
        method: "POST",
        body: JSON.stringify({ imageBase64: frameBase64, mimeType: "image/jpeg" }),
      });
      setAvatarReady(true);
      toast.success(t("Avatar criado a partir do seu vídeo.", "Avatar created from your video.", "Avatar creado a partir de tu vídeo."));
    } catch (e: any) {
      setError(e.message ?? t("Erro ao criar avatar", "Error creating avatar", "Error al crear el avatar"));
    } finally {
      setAvatarUploading(false);
    }
  }

  async function selectStock(avatarId: string) {
    setSelectingStockId(avatarId);
    setError(null);
    try {
      await customFetch("/api/workspaces/me/persona/select-stock-avatar", {
        method: "POST",
        body: JSON.stringify({ avatarId }),
      });
      setAvatarReady(true);
      toast.success(t("Avatar padrão selecionado.", "Stock avatar selected.", "Avatar predeterminado seleccionado."));
    } catch (e: any) {
      setError(e.message ?? t("Erro ao selecionar avatar", "Error selecting avatar", "Error al seleccionar el avatar"));
    } finally {
      setSelectingStockId(null);
    }
  }

  async function resumePipeline() {
    setResuming(true);
    setError(null);
    try {
      const action = project.pendingAction === "final" ? "generate-final" : "generate-preview";
      const res = await customFetch<{ project: VideoProject }>(`/api/video-projects/${project.id}/${action}`, { method: "POST", body: "{}" });
      onResumed(res.project);
    } catch (e: any) {
      setError(e.message ?? t("Erro ao retomar geração", "Error resuming generation", "Error al reanudar la generación"));
    } finally {
      setResuming(false);
    }
  }

  const canResume = !!voiceCloneId && avatarReady;

  return (
    <div className="border border-primary/30 rounded-xl p-5 bg-primary/5 space-y-5">
      {onDismiss && (
        <div className="flex justify-end">
          <button
            onClick={onDismiss}
            className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
          >
            {t("← Pular por agora", "← Skip for now", "← Omitir por ahora")}
          </button>
        </div>
      )}
      <div>
        <div className="font-mono text-sm font-bold flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />{t("Este vídeo tem cenas com avatar — precisamos da sua voz e rosto", "This video includes avatar scenes — we need your voice and face", "Este vídeo incluye escenas con avatar: necesitamos tu voz y rostro")}
        </div>
        <div className="font-mono text-xs text-muted-foreground mt-1">
          {t("Você escolheu aparecer nas cenas. Para gerar o vídeo com avatar de IA precisamos clonar sua voz e criar seu avatar (ou você pode usar um avatar padrão).", "You chose to appear in the scenes. To generate the video with an AI avatar, we need to clone your voice and create your avatar (or you can use a stock avatar).", "Elegiste aparecer en las escenas. Para generar el vídeo con un avatar de IA, debemos clonar tu voz y crear tu avatar (o puedes usar un avatar predeterminado).")}
        </div>
      </div>

      {error && <div className="font-mono text-[11px] text-red-400 border border-red-500/30 rounded-md p-2 bg-red-500/5">{error}</div>}

      {/* Step 1 — Voice */}
      <div className="border border-border/40 rounded-lg p-4 space-y-3">
        <div className="font-mono text-xs font-bold flex items-center gap-2">
          {voiceCloneId ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <Mic className="h-4 w-4 text-primary" />}
          1. {t("Sua voz", "Your voice", "Tu voz")} {voiceCloneId && <span className="text-green-400">— {t("clonada", "cloned", "clonada")}</span>}
        </div>
        {!voiceCloneId && (
          <div className="space-y-2">
            <div className="font-mono text-[10px] text-muted-foreground">{t("Grave 20-30s falando naturalmente para clonarmos sua voz.", "Record 20–30 seconds of natural speech so we can clone your voice.", "Graba entre 20 y 30 segundos hablando con naturalidad para que podamos clonar tu voz.")}</div>
            <div className="flex items-center gap-2">
              {recState === "idle" && (
                <Button size="sm" onClick={startVoiceRecording} className="font-mono text-xs"><Mic className="h-3.5 w-3.5 mr-1.5" />{t("Gravar", "Record", "Grabar")}</Button>
              )}
              {recState === "recording" && (
                <Button size="sm" variant="destructive" onClick={stopVoiceRecording} className="font-mono text-xs"><Square className="h-3.5 w-3.5 mr-1.5" />{t("Parar", "Stop", "Detener")}</Button>
              )}
              {(recState === "recorded" || recState === "cloning") && (
                <>
                  {audioUrl && <audio src={audioUrl} controls className="h-8" />}
                  <Button size="sm" onClick={cloneVoiceNow} disabled={recState === "cloning"} className="font-mono text-xs">
                    {recState === "cloning" ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                    {t("Clonar Voz", "Clone Voice", "Clonar voz")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setRecState("idle"); setAudioUrl(null); setAudioBase64(null); }} className="font-mono text-xs">{t("Regravar", "Re-record", "Volver a grabar")}</Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Step 2 — Avatar */}
      <div className="border border-border/40 rounded-lg p-4 space-y-3">
        <div className="font-mono text-xs font-bold flex items-center gap-2">
          {avatarReady ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <Camera className="h-4 w-4 text-primary" />}
          2. {t("Seu avatar", "Your avatar", "Tu avatar")} {avatarReady && <span className="text-green-400">— {t("pronto", "ready", "listo")}</span>}
        </div>
        {!avatarReady && (
          <div className="space-y-3">
            {!avatarMode && (
              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => { setAvatarMode("stock"); void loadStockAvatars(); }} className="p-3 rounded-lg border border-border/40 hover:border-primary/50 text-left transition-colors">
                  <div className="font-mono text-xs font-bold">{t("Avatar padrão", "Stock avatar", "Avatar predeterminado")}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{t("Escolha um avatar pronto da NexOS", "Choose a ready-made NexOS avatar", "Elige un avatar predeterminado de NexOS")}</div>
                </button>
                <button onClick={() => setAvatarMode("record")} className="p-3 rounded-lg border border-border/40 hover:border-primary/50 text-left transition-colors">
                  <div className="font-mono text-xs font-bold">{t("Foto rápida", "Quick photo", "Foto rápida")}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{t("Capture um frame da webcam (instantâneo)", "Capture a webcam frame (instant)", "Captura un fotograma de la cámara web (instantáneo)")}</div>
                </button>
                <button onClick={() => setAvatarMode("video")} className="p-3 rounded-lg border border-border/40 hover:border-primary/50 text-left transition-colors">
                  <div className="font-mono text-xs font-bold">{t("Vídeo (mais realista)", "Video (more realistic)", "Vídeo (más realista)")}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{t("Grave 2 vídeos — leva alguns minutos para treinar", "Record 2 videos — training takes a few minutes", "Graba 2 vídeos; el entrenamiento tarda unos minutos")}</div>
                </button>
              </div>
            )}

            {avatarMode === "video" && (
              <div className="space-y-3">
                {videoStep === "training" && (
                  <div className="space-y-2">
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {t("Passo 1/2 — Grave 20-30s olhando para a câmera, falando naturalmente e movendo levemente a cabeça (isso treina seu avatar em vídeo).", "Step 1/2 — Record 20–30 seconds looking at the camera, speaking naturally, and moving your head slightly (this trains your video avatar).", "Paso 1/2: graba entre 20 y 30 segundos mirando a la cámara, hablando con naturalidad y moviendo ligeramente la cabeza (esto entrena tu avatar de vídeo).")}
                    </div>
                    {!videoStreamRef.current && videoRecState === "idle" && !trainingUrl && (
                      <Button size="sm" onClick={() => startVideoRecording("training")} className="font-mono text-xs"><Camera className="h-3.5 w-3.5 mr-1.5" />{t("Gravar treino", "Record training", "Grabar entrenamiento")}</Button>
                    )}
                    {videoRecState === "recording" && (
                      <Button size="sm" variant="destructive" onClick={stopVideoRecording} className="font-mono text-xs"><Square className="h-3.5 w-3.5 mr-1.5" />{t("Parar", "Stop", "Detener")}</Button>
                    )}
                    {trainingUrl && (
                      <div className="space-y-2">
                        <video src={trainingUrl} controls className="w-full max-w-xs rounded-lg" />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => { setVideoStep("consent"); setVideoRecState("idle"); }} className="font-mono text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />{t("Próximo passo", "Next step", "Siguiente paso")}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => retakeVideo("training")} className="font-mono text-xs">{t("Regravar", "Re-record", "Volver a grabar")}</Button>
                        </div>
                      </div>
                    )}
                    <button onClick={() => setAvatarMode(null)} className="font-mono text-[10px] text-muted-foreground hover:underline">{t("← Voltar", "← Back", "← Volver")}</button>
                  </div>
                )}

                {videoStep === "consent" && (
                  <div className="space-y-2">
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {t("Passo 2/2 — Grave-se dizendo:", "Step 2/2 — Record yourself saying:", "Paso 2/2: grábate diciendo:")} <span className="text-foreground">{t('"Eu autorizo o uso da minha imagem e voz para criar um avatar digital meu."', '"I authorize the use of my image and voice to create my digital avatar."', '"Autorizo el uso de mi imagen y voz para crear mi avatar digital."')}</span>
                    </div>
                    {videoRecState === "idle" && !consentUrl && (
                      <Button size="sm" onClick={() => startVideoRecording("consent")} className="font-mono text-xs"><Mic className="h-3.5 w-3.5 mr-1.5" />{t("Gravar consentimento", "Record consent", "Grabar consentimiento")}</Button>
                    )}
                    {videoRecState === "recording" && (
                      <Button size="sm" variant="destructive" onClick={stopVideoRecording} className="font-mono text-xs"><Square className="h-3.5 w-3.5 mr-1.5" />{t("Parar", "Stop", "Detener")}</Button>
                    )}
                    {consentUrl && (
                      <div className="space-y-2">
                        <video src={consentUrl} controls className="w-full max-w-xs rounded-lg" />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => void submitVideoClone()} className="font-mono text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />{t("Enviar para treinamento", "Submit for training", "Enviar para entrenamiento")}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => retakeVideo("consent")} className="font-mono text-xs">{t("Regravar", "Re-record", "Volver a grabar")}</Button>
                        </div>
                      </div>
                    )}
                    <button onClick={() => setVideoStep("training")} className="font-mono text-[10px] text-muted-foreground hover:underline">{t("← Voltar", "← Back", "← Volver")}</button>
                  </div>
                )}

                {videoStep === "uploading" && (
                  <div className="font-mono text-xs flex items-center gap-2 text-muted-foreground">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />{t("Enviando vídeos...", "Uploading videos...", "Subiendo vídeos...")}
                  </div>
                )}

                {videoStep === "training_pending" && (
                  <div className="font-mono text-xs flex items-center gap-2 text-muted-foreground">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    {t(`Treinando seu avatar digital (${avatarTrainingStatus ?? "pending"})... isso pode levar alguns minutos, você pode aguardar aqui.`, `Training your digital avatar (${avatarTrainingStatus ?? "pending"})... this may take a few minutes; you can wait here.`, `Entrenando tu avatar digital (${avatarTrainingStatus ?? "pending"})... puede tardar unos minutos; puedes esperar aquí.`)}
                  </div>
                )}
              </div>
            )}

            {avatarMode === "stock" && (
              <div className="space-y-2">
                {stockLoading ? (
                  <div className="font-mono text-[10px] text-muted-foreground">{t("Carregando avatares...", "Loading avatars...", "Cargando avatares...")}</div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {stockAvatars.map(a => (
                      <button
                        key={a.id}
                        onClick={() => void selectStock(a.id)}
                        disabled={!!selectingStockId}
                        className="border border-border/40 hover:border-primary/50 rounded-lg p-2 text-center transition-colors"
                      >
                        <div className="w-full h-16 rounded mb-1 bg-primary/10 flex items-center justify-center">
                          <User className="h-6 w-6 text-primary/60" />
                        </div>
                        <div className="font-mono text-[9px]">{selectingStockId === a.id ? t("Selecionando...", "Selecting...", "Seleccionando...") : a.label}</div>
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => setAvatarMode(null)} className="font-mono text-[10px] text-muted-foreground hover:underline">{t("← Voltar", "← Back", "← Volver")}</button>
              </div>
            )}

            {avatarMode === "record" && (
              <div className="space-y-2">
                {!camStream && !frameBase64 && (
                  <Button size="sm" onClick={startCamera} className="font-mono text-xs"><Camera className="h-3.5 w-3.5 mr-1.5" />{t("Ligar câmera", "Turn on camera", "Activar cámara")}</Button>
                )}
                {camStream && (
                  <div className="space-y-2">
                    <video ref={videoRef} autoPlay muted playsInline className="w-full max-w-xs rounded-lg bg-black" />
                    <Button size="sm" onClick={captureFrame} className="font-mono text-xs"><Camera className="h-3.5 w-3.5 mr-1.5" />{t("Capturar", "Capture", "Capturar")}</Button>
                  </div>
                )}
                {frameBase64 && !avatarReady && (
                  <div className="space-y-2">
                    <img src={`data:image/jpeg;base64,${frameBase64}`} alt={t("Frame capturado", "Captured frame", "Fotograma capturado")} className="w-full max-w-xs rounded-lg" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={createAvatarFromFrame} disabled={avatarUploading} className="font-mono text-xs">
                        {avatarUploading ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                        {t("Criar Avatar", "Create Avatar", "Crear avatar")}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setFrameBase64(null)} className="font-mono text-xs">{t("Refazer", "Retake", "Volver a tomar")}</Button>
                    </div>
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
                <button onClick={() => setAvatarMode(null)} className="font-mono text-[10px] text-muted-foreground hover:underline">{t("← Voltar", "← Back", "← Volver")}</button>
              </div>
            )}
          </div>
        )}
      </div>

      <Button onClick={resumePipeline} disabled={!canResume || resuming} className="font-mono w-full">
        {resuming ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
        {t("Continuar Geração do Vídeo", "Continue Video Generation", "Continuar generación del vídeo")}
      </Button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VideoProductionPage() {
  const t = useUiText();
  const { locale } = useUiLocale();
  const dateLocale = intlLocale(locale);
  const [, navigate] = useLocation();
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [selected, setSelected] = useState<VideoProject | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [briefLoading, setBriefLoading] = useState(false);
  const [expandedScene, setExpandedScene] = useState<string | null>(null);
  const [provider, setProvider] = useState<ProviderStatus | null>(null);

  // Hybrid mode — user uploads their own recording
  const [hybridMode, setHybridMode] = useState<"ai" | "recording">("ai");
  const [hybridFile, setHybridFile] = useState<File | null>(null);
  const [hybridUploading, setHybridUploading] = useState(false);
  const hybridInputRef = useRef<HTMLInputElement>(null);

  // Recordings list (for hybrid mode history panel)
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [recordingsLoaded, setRecordingsLoaded] = useState(false);

  // Auto-select project from URL param (e.g. coming from CreativeStudioBlock)
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const projectIdParam = search?.get("projectId");
  const setupAvatarMode = search?.get("setup") === "avatar";

  useEffect(() => {
    loadProjects();
    loadProviderStatus();
  }, []);

  useEffect(() => {
    if (hybridMode === "recording" && selected?.config.hasUserFace) {
      setRecordings([]);
      loadRecordings();
    }
  }, [hybridMode, selected?.id]);

  async function loadProjects() {
    setLoading(true);
    try {
      const res = await customFetch<{ projects: VideoProject[] }>("/api/video-projects");
      const list = res.projects ?? [];
      setProjects(list);
      // Auto-select project passed via URL (e.g. from CreativeStudioBlock)
      if (projectIdParam) {
        const match = list.find(p => p.id === projectIdParam);
        if (match) setSelected(match);
      }
    } finally { setLoading(false); }
  }

  async function loadProviderStatus() {
    try {
      const res = await customFetch<ProviderStatus>("/api/video-projects/provider-status");
      setProvider(res);
    } catch {}
  }

  async function refreshSelected() {
    if (!selected) return;
    try {
      const res = await customFetch<{ project: VideoProject }>(`/api/video-projects/${selected.id}`);
      setSelected(res.project);
      setProjects(ps => ps.map(p => p.id === res.project.id ? res.project : p));
    } catch {}
  }

  async function generateScript() {
    if (!selected) return;
    setActionLoading(true);
    try {
      const res = await customFetch<{ project: VideoProject }>(`/api/video-projects/${selected.id}/generate-script`, { method: "POST", body: "{}" });
      setSelected(res.project);
      setProjects(ps => ps.map(p => p.id === res.project.id ? res.project : p));
    } finally { setActionLoading(false); }
  }

  async function generateStoryboard() {
    if (!selected) return;
    setActionLoading(true);
    try {
      const res = await customFetch<{ project: VideoProject }>(`/api/video-projects/${selected.id}/generate-storyboard`, { method: "POST", body: "{}" });
      setSelected(res.project);
      setProjects(ps => ps.map(p => p.id === res.project.id ? res.project : p));
    } finally { setActionLoading(false); }
  }

  async function generatePreview() {
    if (!selected) return;
    setActionLoading(true);
    try {
      const res = await customFetch<{ project: VideoProject }>(`/api/video-projects/${selected.id}/generate-preview`, { method: "POST", body: "{}" });
      setSelected(res.project);
      setProjects(ps => ps.map(p => p.id === res.project.id ? res.project : p));
    } finally { setActionLoading(false); }
  }

  async function loadRecordings() {
    try {
      const res = await customFetch<{ recordings: Recording[] }>("/api/recordings");
      setRecordings(res.recordings ?? []);
    } catch {} finally { setRecordingsLoaded(true); }
  }

  async function uploadRecordingAndEdit() {
    if (!selected || !hybridFile) return;
    setHybridUploading(true);
    try {
      // 1 — create recording entry linked to this video project
      const createRes = await customFetch<{ recording: { id: string } }>("/api/recordings", {
        method: "POST",
        body: JSON.stringify({ name: `Gravação — ${selected.title}`, recordingMode: "manual" }),
      });
      const recId = createRes.recording.id;

      // 2 — upload raw video blob (streaming)
      const token = localStorage.getItem("accessToken") ?? localStorage.getItem("nexos_token");
      if (!token) throw new Error(t("Sua sessão expirou. Entre novamente para enviar o vídeo.", "Your session expired. Sign in again to upload the video.", "Tu sesión ha caducado. Inicia sesión de nuevo para subir el vídeo."));
      const uploadRes = await fetch(`/api/recordings/${recId}/upload?mode=hybrid`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": hybridFile.type || "video/webm",
        },
        body: hybridFile,
      });
      if (!uploadRes.ok) throw new Error(t("Upload falhou", "Upload failed", "Falló la carga"));

      toast.success(t("Gravação enviada! Abrindo editor de vídeo…", "Recording uploaded! Opening video editor…", "¡Grabación subida! Abriendo el editor de vídeo…"));
      navigate(`/video-editor?recordingId=${recId}&projectId=${selected.id}`);
    } catch (err) {
      toast.error(t("Falha no upload. Tente novamente.", "Upload failed. Please try again.", "Falló la carga. Inténtalo de nuevo."));
    } finally {
      setHybridUploading(false);
    }
  }

  async function generateFinal() {
    if (!selected) return;
    setActionLoading(true);
    try {
      const res = await customFetch<{ project: VideoProject }>(`/api/video-projects/${selected.id}/generate-final`, { method: "POST", body: "{}" });
      setSelected(res.project);
      setProjects(ps => ps.map(p => p.id === res.project.id ? res.project : p));
    } finally { setActionLoading(false); }
  }

  async function requestFilmingBrief() {
    if (!selected) return;
    setBriefLoading(true);
    try {
      const res = await customFetch<{ project: VideoProject }>(`/api/video-projects/${selected.id}/filming-brief`, { method: "POST", body: "{}" });
      setSelected(res.project);
      setProjects(ps => ps.map(p => p.id === res.project.id ? res.project : p));
    } finally { setBriefLoading(false); }
  }

  function downloadFilmingBrief() {
    if (!selected?.config.filmingBrief) return;
    const brief = selected.config.filmingBrief;
    const timestamp = new Date().toLocaleString(dateLocale);
    const fingerprint = `${selected.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    const lines: string[] = [
      "═══════════════════════════════════════════════════════════",
      `  ${t("DIREÇÃO DE FILMAGEM", "FILMING DIRECTION", "DIRECCIÓN DE RODAJE")} — ATLAS / NexOS AI`,
      "═══════════════════════════════════════════════════════════",
      `  ${t("Projeto", "Project", "Proyecto")}: ${selected.title}`,
      `  ${t("Formato", "Format", "Formato")}: ${selected.format.replace(/_/g, " ").toUpperCase()}`,
      `  ${t("Gerado em", "Generated on", "Generado el")}: ${timestamp}`,
      `  ${t("ID de verificação", "Verification ID", "ID de verificación")}: ${fingerprint}`,
      `  ⚠ ${t("DOCUMENTO CONFIDENCIAL — uso exclusivo do destinatário", "CONFIDENTIAL DOCUMENT — for recipient's use only", "DOCUMENTO CONFIDENCIAL — uso exclusivo del destinatario")}`,
      "═══════════════════════════════════════════════════════════",
      "",
      `▌ ${t("VESTUÁRIO", "WARDROBE", "VESTUARIO")}`,
      `  ${t("Cor", "Color", "Color")}: ${brief.vestuario.cor}`,
      `  ${t("Estilo", "Style", "Estilo")}: ${brief.vestuario.estilo}`,
      `  ${t("Evitar", "Avoid", "Evitar")}: ${brief.vestuario.evitar}`,
      `  ${t("Por quê", "Why", "Por qué")}: ${brief.vestuario.rationale}`,
      "",
      `▌ ${t("CENÁRIO", "SETTING", "ESCENARIO")}`,
      `  ${t("Tipo", "Type", "Tipo")}: ${brief.cenario.tipo}`,
      `  ${t("Fundo", "Background", "Fondo")}: ${brief.cenario.fundo}`,
      `  ${t("Iluminação", "Lighting", "Iluminación")}: ${brief.cenario.iluminacao}`,
      `  ${t("Elementos", "Elements", "Elementos")}: ${brief.cenario.elementos.join(" / ")}`,
      `  ${t("Por quê", "Why", "Por qué")}: ${brief.cenario.rationale}`,
      "",
      `▌ ${t("LINGUAGEM CORPORAL E VOZ", "BODY LANGUAGE AND VOICE", "LENGUAJE CORPORAL Y VOZ")}`,
      `  ${t("Tom", "Tone", "Tono")}: ${brief.linguagem.tom}`,
      `  ${t("Velocidade", "Pace", "Velocidad")}: ${brief.linguagem.velocidade}`,
      `  ${t("Pausas", "Pauses", "Pausas")}: ${brief.linguagem.pausas}`,
      `  ${t("Gestos", "Gestures", "Gestos")}: ${brief.linguagem.gestos}`,
      `  ${t("Olhar", "Gaze", "Mirada")}: ${brief.linguagem.olhar}`,
      "",
      "═══════════════════════════════════════════════════════════",
      `  ${t("DIREÇÃO CENA A CENA", "SCENE-BY-SCENE DIRECTION", "DIRECCIÓN ESCENA POR ESCENA")}`,
      "═══════════════════════════════════════════════════════════",
    ];

    for (const scene of brief.scenes) {
      lines.push("");
      lines.push(`▌ ${scene.titulo.toUpperCase()} [${scene.sceneType.toUpperCase()}]`);
      lines.push(`  ${t("Entrega emocional", "Emotional delivery", "Interpretación emocional")}: ${scene.entregaEmocional}`);
      if (scene.voiceoverText) {
        lines.push(`  ${t("Texto", "Text", "Texto")}: "${scene.voiceoverText.slice(0, 120)}${scene.voiceoverText.length > 120 ? "..." : ""}"`);
      }
      lines.push("");
      for (const take of scene.takes) {
        lines.push(`  ◆ ${t("TAKE", "TAKE", "TOMA")} ${take.numero} — ${take.energia}`);
        lines.push(`    ${t("Postura", "Posture", "Postura")}: ${take.postura}`);
        lines.push(`    ${t("Instrução", "Direction", "Instrucción")}: ${take.instrucao}`);
        if (take.variacao) lines.push(`    ${t("Variação", "Variation", "Variación")}: ${take.variacao}`);
        lines.push("");
      }
      lines.push(`  💡 ${t("Dica do ATLAS", "ATLAS Tip", "Consejo de ATLAS")}: ${scene.dica}`);
    }

    lines.push("");
    lines.push("═══════════════════════════════════════════════════════════");
    lines.push(`  ${t("MENSAGEM DO DIRETOR", "DIRECTOR'S MESSAGE", "MENSAJE DEL DIRECTOR")}`);
    lines.push("═══════════════════════════════════════════════════════════");
    lines.push(`  ${brief.mensagemFinal}`);
    lines.push("");
    lines.push("═══════════════════════════════════════════════════════════");
    lines.push(`  NexOS AI · ${fingerprint} · ${timestamp}`);
    lines.push("═══════════════════════════════════════════════════════════");

    const content = lines.join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `atlas-direcao-${selected.title.toLowerCase().replace(/\s+/g, "-").slice(0, 30)}-${fingerprint}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleCreated(project: VideoProject) {
    setProjects(ps => [project, ...ps]);
    setSelected(project);
    setCreating(false);
  }

  const statusIs = (s: VideoStatus) => selected?.status === s;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Film className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-mono font-bold text-foreground">{t("Produção de Vídeo", "Video Production", "Producción de vídeo")}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{t("Roteiro → Storyboard → Preview → Vídeo HD Final", "Script → Storyboard → Preview → Final HD Video", "Guion → Storyboard → Vista previa → Vídeo HD final")}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {provider && !provider.configured && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10">
                <AlertCircle className="h-3.5 w-3.5 text-yellow-400" />
                <span className="font-mono text-[10px] text-yellow-400">{t("Provedor não configurado", "Provider not configured", "Proveedor no configurado")}</span>
              </div>
            )}
            {provider?.configured && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-green-500/30 bg-green-500/10">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                <span className="font-mono text-[10px] text-green-400">{provider.videoProvider}</span>
              </div>
            )}
            <Button onClick={() => setCreating(true)} size="sm" className="font-mono text-xs">
              <Plus className="h-3.5 w-3.5 mr-1.5" />{t("Novo Vídeo", "New Video", "Nuevo vídeo")}
            </Button>
          </div>
        </div>
      </div>

      {/* Avatar setup banner — shown when coming from Presença Social */}
      {setupAvatarMode && (
        <div className="border-b border-amber-400/20 bg-amber-400/5 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="font-mono text-sm font-bold text-amber-300">{t("Configurar clone digital para vídeos automáticos", "Set up your digital clone for automated videos", "Configura tu clon digital para vídeos automáticos")}</p>
              <p className="font-mono text-xs text-amber-300/70 mt-0.5">
                {t('Para criar vídeos com você na câmera, crie um projeto abaixo, selecione "Quero aparecer nos vídeos" e configure seu avatar e voz clonada. Depois os posts de Presença Social usarão você automaticamente.', 'To create videos featuring you on camera, create a project below, select "I want to appear in videos", and set up your avatar and cloned voice. Social Presence posts will then use you automatically.', 'Para crear vídeos en los que aparezcas, crea un proyecto abajo, selecciona "Quiero aparecer en los vídeos" y configura tu avatar y voz clonada. Después, las publicaciones de Presencia Social te usarán automáticamente.')}
              </p>
            </div>
            <Button
              size="sm"
              className="font-mono text-xs shrink-0 bg-amber-400/20 border border-amber-400/30 text-amber-300 hover:bg-amber-400/30"
              variant="outline"
              onClick={() => setCreating(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />{t("Criar projeto", "Create project", "Crear proyecto")}
            </Button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6">
        {/* Left: project list */}
        <div className="w-72 shrink-0">
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-3">{t("Projetos", "Projects", "Proyectos")}</div>
          <div className="space-y-2">
            {loading && <div className="font-mono text-xs text-muted-foreground">{t("Carregando...", "Loading...", "Cargando...")}</div>}
            {!loading && !projects.length && !creating && (
              <div className="border border-border/40 rounded-lg p-4 text-center">
                <Film className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <div className="font-mono text-xs text-muted-foreground">{t("Nenhum projeto ainda", "No projects yet", "Aún no hay proyectos")}</div>
                <Button variant="ghost" size="sm" className="font-mono text-xs mt-2" onClick={() => setCreating(true)}>
                  {t("Criar primeiro vídeo", "Create first video", "Crear el primer vídeo")}
                </Button>
              </div>
            )}
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className={`w-full text-left border rounded-lg p-3 transition-all ${selected?.id === p.id ? "border-primary bg-primary/5" : "border-border/40 hover:border-border"}`}
              >
                <div className="font-mono text-xs font-medium truncate">{p.title}</div>
                <div className="font-mono text-[10px] text-muted-foreground mt-0.5 uppercase">{p.format} · {t(...STATUS_LABELS[p.status]).split("—")[0]?.trim()}</div>
                {p.status === "completed" && <div className="font-mono text-[9px] text-green-400 mt-0.5">✓ {t("Concluído", "Completed", "Completado")}</div>}
              </button>
            ))}
          </div>
        </div>

        {/* Right: project detail */}
        <div className="flex-1 min-w-0">
          {creating && !selected && (
            <div className="border border-border/40 rounded-xl p-6 bg-background/40">
              <div className="font-mono text-sm font-bold mb-4">{t("Novo Projeto de Vídeo", "New Video Project", "Nuevo proyecto de vídeo")}</div>
              <CreateProjectForm onCreated={handleCreated} providerConfigured={provider?.configured} />
            </div>
          )}

          {!creating && !selected && (
            <div className="flex flex-col items-center justify-center h-64 gap-3 border border-dashed border-border/40 rounded-xl">
              <Film className="h-10 w-10 text-muted-foreground/30" />
              <div className="font-mono text-sm text-muted-foreground">{t("Selecione um projeto ou crie um novo", "Select a project or create a new one", "Selecciona un proyecto o crea uno nuevo")}</div>
              <Button onClick={() => setCreating(true)} variant="outline" size="sm" className="font-mono text-xs">
                <Plus className="h-3.5 w-3.5 mr-1.5" />{t("Novo Vídeo", "New Video", "Nuevo vídeo")}
              </Button>
            </div>
          )}

          {selected && (
            <div className="space-y-5">
              {/* Project header */}
              <div className="border border-border/40 rounded-xl p-5 bg-background/40">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="font-mono font-bold text-lg">{selected.title}</div>
                    <div className="font-mono text-xs text-muted-foreground mt-0.5">
                      {selected.format.replace(/_/g," ").toUpperCase()} ·{" "}
                      {selected.config.aspectRatio} ·{" "}
                      {selected.config.hasUserFace ? t("Com apresentador", "With presenter", "Con presentador") : "B-roll"} ·{" "}
                      {t(`${selected.creditsUsed} cr usados`, `${selected.creditsUsed} credits used`, `${selected.creditsUsed} créditos usados`)}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={refreshSelected} className="font-mono text-xs">
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />{t("Atualizar", "Refresh", "Actualizar")}
                  </Button>
                </div>
                <PipelineBar status={selected.status} />
                <div className="mt-3 font-mono text-xs text-muted-foreground">
                  {t(...STATUS_LABELS[selected.status])}
                </div>
              </div>

              {/* Provider warning */}
              {provider && !provider.configured && (
                <div className="border border-amber-500/20 rounded-xl p-5 bg-amber-500/5">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm font-bold text-amber-500 mb-1">{t("Geração de Vídeo 100% IA Temporariamente Indisponível", "100% AI video generation is temporarily unavailable", "La generación de vídeo 100 % con IA no está disponible temporalmente")}</div>
                      <div className="font-mono text-xs text-muted-foreground mb-3">
                        {t("Não há um provedor de vídeo configurado ou ativo neste momento para processamento 100% autônomo. Para dar andamento imediato na produção do seu vídeo:", "No video provider is configured or active for fully automated processing right now. To continue producing your video immediately:", "Ahora no hay ningún proveedor de vídeo configurado o activo para el procesamiento totalmente automático. Para continuar la producción de tu vídeo de inmediato:")}
                      </div>
                      <ul className="font-mono text-xs text-muted-foreground list-disc ml-5 mb-4 space-y-1">
                        <li><strong>{t("Modo Híbrido", "Hybrid mode", "Modo híbrido")}:</strong> {t("Altere para Híbrido, grave com a sua própria câmera, e envie para a IA apenas legendar e cortar.", "Switch to Hybrid mode, record with your own camera, and let AI handle only captions and cuts.", "Cambia al modo híbrido, graba con tu propia cámara y usa la IA solo para añadir subtítulos y hacer cortes.")}</li>
                        <li><strong>NexOS Studio:</strong> {t("Utilize o Studio (Editor Completo) para renderizar projetos em", "Use Studio (Full Editor) to render projects in", "Usa Studio (editor completo) para renderizar proyectos en")} <strong>Digital Twin</strong> {t("caso possua motor próprio.", "if you have your own engine.", "si tienes tu propio motor.")}</li>
                      </ul>
                      <div className="font-mono text-[10px] text-muted-foreground italic">
                        {t("Roteiro e storyboard (ideação) já funcionam perfeitamente para qualquer modo.", "Script and storyboard (ideation) already work perfectly in any mode.", "El guion y el storyboard (ideación) ya funcionan perfectamente en cualquier modo.")}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step actions */}
              {statusIs("intake") && (
                <div className="border border-border/40 rounded-xl p-5 bg-background/40">
                  <div className="font-mono text-sm font-bold mb-2">{t("Passo 1 — Gerar Roteiro", "Step 1 — Generate Script", "Paso 1: generar guion")}</div>
                  <div className="font-mono text-xs text-muted-foreground mb-4">
                    {t(`O agente roteirista vai escrever o roteiro completo do seu ${selected.format.replace(/_/g," ")} baseado no perfil da campanha. Você poderá editar antes de aprovar.`, `The scriptwriter agent will write the complete ${selected.format.replace(/_/g," ")} script based on the campaign profile. You can edit it before approval.`, `El agente guionista redactará el guion completo de ${selected.format.replace(/_/g," ")} según el perfil de la campaña. Podrás editarlo antes de aprobarlo.`)}
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground mb-4">
                    <span className="flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-primary" /> {t("18 créditos", "18 credits", "18 créditos")}</span>
                    <span>·</span>
                    <span>{t("Agente:", "Agent:", "Agente:")} {t("Roteirista", "Scriptwriter", "Guionista")} (GPT-5.5)</span>
                  </div>
                  <Button onClick={generateScript} disabled={actionLoading} className="font-mono">
                    {actionLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                    {t("Gerar Roteiro", "Generate Script", "Generar guion")}
                  </Button>
                </div>
              )}

              {/* Script panel */}
              {["script_generating","script_ready","script_approved"].includes(selected.status) && (
                <div className="border border-border/40 rounded-xl p-5 bg-background/40">
                  <div className="font-mono text-sm font-bold mb-4">{t("Roteiro", "Script", "Guion")}</div>
                  <ScriptPanel project={selected} onAction={refreshSelected} />
                </div>
              )}

              {/* Generate storyboard CTA */}
              {statusIs("script_approved") && (
                <div className="border border-border/40 rounded-xl p-5 bg-background/40">
                  <div className="font-mono text-sm font-bold mb-2">{t("Passo 3 — Criar Storyboard", "Step 3 — Create Storyboard", "Paso 3: crear storyboard")}</div>
                  <div className="font-mono text-xs text-muted-foreground mb-4">
                    {t("O Diretor de Cena vai dividir o roteiro em cenas individuais com descrição visual, paleta, transições e tempo.", "The Scene Director will divide the script into individual scenes with visual descriptions, palettes, transitions, and timing.", "El director de escena dividirá el guion en escenas individuales con descripciones visuales, paletas, transiciones y duración.")}
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground mb-4">
                    <span className="flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-primary" /> {t("12 créditos", "12 credits", "12 créditos")}</span>
                    <span>·</span>
                    <span>{t("Agente:", "Agent:", "Agente:")} {t("Diretor de Cena", "Scene Director", "Director de escena")} (Gemini)</span>
                  </div>
                  <Button onClick={generateStoryboard} disabled={actionLoading} className="font-mono">
                    {actionLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Film className="h-4 w-4 mr-2" />}
                    {t("Criar Storyboard", "Create Storyboard", "Crear storyboard")}
                  </Button>
                </div>
              )}

              {/* Storyboard panel */}
              {["storyboard_generating","storyboard_ready","storyboard_approved"].includes(selected.status) && (
                <div className="border border-border/40 rounded-xl p-5 bg-background/40">
                  <div className="font-mono text-sm font-bold mb-4">{t("Storyboard — Cenas", "Storyboard — Scenes", "Storyboard: escenas")}</div>
                  <StoryboardPanel project={selected} onAction={refreshSelected} />
                </div>
              )}

              {/* ─── ATLAS — Direção de Filmagem Pontual ─────────────────── */}
              {selected.script && (
                <div className="border border-primary/30 rounded-xl bg-primary/5">
                  {/* Header */}
                  <div className="flex items-start justify-between p-5 border-b border-primary/20">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Clapperboard className="h-4.5 w-4.5 text-primary" />
                      </div>
                      <div>
                        <div className="font-mono font-bold text-sm flex items-center gap-2">
                           ATLAS — {t("Direção de Filmagem", "Filming Direction", "Dirección de rodaje")}
                           <Badge variant="outline" className="font-mono text-[9px] text-primary border-primary/40">{t("Diretor de Cena", "Scene Director", "Director de escena")}</Badge>
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground mt-0.5">
                          {selected.config.filmingBrief
                            ? t(`Gerado em ${new Date(selected.config.filmingBriefGeneratedAt!).toLocaleDateString(dateLocale)} · ${selected.config.filmingBrief.scenes.length} cenas · take por take`, `Generated on ${new Date(selected.config.filmingBriefGeneratedAt!).toLocaleDateString(dateLocale)} · ${selected.config.filmingBrief.scenes.length} scenes · take by take`, `Generado el ${new Date(selected.config.filmingBriefGeneratedAt!).toLocaleDateString(dateLocale)} · ${selected.config.filmingBrief.scenes.length} escenas · toma por toma`)
                            : t("ATLAS lê o roteiro e gera direção pontual — vestuário, cenário e takes específicos para este vídeo", "ATLAS reads the script and creates tailored direction — wardrobe, setting, and specific takes for this video", "ATLAS lee el guion y genera indicaciones específicas: vestuario, escenario y tomas para este vídeo")
                          }
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {selected.config.filmingBrief && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={downloadFilmingBrief}
                          className="font-mono text-xs border-primary/30 text-primary hover:bg-primary/10"
                        >
                          <Download className="h-3.5 w-3.5 mr-1.5" />
                          {t("Baixar Briefing", "Download Brief", "Descargar briefing")}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={requestFilmingBrief}
                        disabled={briefLoading}
                        className="font-mono text-xs"
                        variant={selected.config.filmingBrief ? "outline" : "default"}
                      >
                        {briefLoading
                          ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />{t("Gerando...", "Generating...", "Generando...")}</>
                          : selected.config.filmingBrief
                          ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5" />{t("Regerar", "Regenerate", "Regenerar")}</>
                          : <><Camera className="h-3.5 w-3.5 mr-1.5" />{t("Pedir Direção do ATLAS", "Request ATLAS Direction", "Solicitar indicaciones a ATLAS")}</>
                        }
                      </Button>
                    </div>
                  </div>

                  {/* Credit note when no brief yet */}
                  {!selected.config.filmingBrief && !briefLoading && (
                    <div className="px-5 py-4 flex items-start gap-4">
                      <div className="flex-1 grid grid-cols-3 gap-3">
                        {[
                          { icon: <Shirt className="h-4 w-4 text-primary" />, label: t("Vestuário pontual", "Tailored wardrobe", "Vestuario específico"), desc: t("Cor e estilo específicos para este roteiro e tom", "Colors and style tailored to this script and tone", "Colores y estilo específicos para este guion y tono") },
                          { icon: <Lightbulb className="h-4 w-4 text-primary" />, label: t("Cenário e luz", "Setting and lighting", "Escenario e iluminación"), desc: t("Setup do set que reforça a mensagem deste vídeo", "Set setup that reinforces this video's message", "Configuración del set que refuerza el mensaje de este vídeo") },
                          { icon: <Camera className="h-4 w-4 text-primary" />, label: t("Takes cena a cena", "Scene-by-scene takes", "Tomas escena por escena"), desc: t("2–3 takes por cena com instrução de energia e postura", "2–3 takes per scene with energy and posture guidance", "2–3 tomas por escena con indicaciones de energía y postura") },
                        ].map(item => (
                          <div key={item.label} className="border border-border/30 rounded-lg p-3 bg-background/30">
                            {item.icon}
                            <div className="font-mono text-xs font-bold mt-2 mb-1">{item.label}</div>
                            <div className="font-mono text-[10px] text-muted-foreground">{item.desc}</div>
                          </div>
                        ))}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                        {t("12 créditos", "12 credits", "12 créditos")}
                      </div>
                    </div>
                  )}

                  {/* Brief content when generated */}
                  {selected.config.filmingBrief && (
                    <div className="p-5 space-y-5">
                      {/* Setup row: vestuário + cenário + linguagem */}
                      <div className="grid grid-cols-3 gap-4">
                        {/* Vestuário */}
                        <div className="border border-border/30 rounded-lg p-4 bg-background/30">
                          <div className="flex items-center gap-2 mb-3">
                            <Shirt className="h-3.5 w-3.5 text-primary" />
                            <div className="font-mono text-xs font-bold text-primary uppercase tracking-wide">{t("Vestuário", "Wardrobe", "Vestuario")}</div>
                          </div>
                          <div className="space-y-2 font-mono text-[11px]">
                            <div><span className="text-muted-foreground">{t("Cor:", "Color:", "Color:")}</span> {selected.config.filmingBrief.vestuario.cor}</div>
                            <div><span className="text-muted-foreground">{t("Estilo:", "Style:", "Estilo:")}</span> {selected.config.filmingBrief.vestuario.estilo}</div>
                            <div className="text-orange-400/80">✕ {t("Evitar:", "Avoid:", "Evitar:")} {selected.config.filmingBrief.vestuario.evitar}</div>
                            <div className="text-muted-foreground/60 text-[10px] mt-2 pt-2 border-t border-border/20">{selected.config.filmingBrief.vestuario.rationale}</div>
                          </div>
                        </div>

                        {/* Cenário */}
                        <div className="border border-border/30 rounded-lg p-4 bg-background/30">
                          <div className="flex items-center gap-2 mb-3">
                            <Lightbulb className="h-3.5 w-3.5 text-primary" />
                            <div className="font-mono text-xs font-bold text-primary uppercase tracking-wide">{t("Cenário & Luz", "Setting & Lighting", "Escenario e iluminación")}</div>
                          </div>
                          <div className="space-y-2 font-mono text-[11px]">
                            <div><span className="text-muted-foreground">{t("Fundo:", "Background:", "Fondo:")}</span> {selected.config.filmingBrief.cenario.fundo}</div>
                            <div><span className="text-muted-foreground">{t("Luz:", "Lighting:", "Iluminación:")}</span> {selected.config.filmingBrief.cenario.iluminacao}</div>
                            {selected.config.filmingBrief.cenario.elementos.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {selected.config.filmingBrief.cenario.elementos.map((el, i) => (
                                  <Badge key={i} variant="outline" className="font-mono text-[9px]">{el}</Badge>
                                ))}
                              </div>
                            )}
                            <div className="text-muted-foreground/60 text-[10px] mt-2 pt-2 border-t border-border/20">{selected.config.filmingBrief.cenario.rationale}</div>
                          </div>
                        </div>

                        {/* Linguagem */}
                        <div className="border border-border/30 rounded-lg p-4 bg-background/30">
                          <div className="flex items-center gap-2 mb-3">
                            <Mic className="h-3.5 w-3.5 text-primary" />
                            <div className="font-mono text-xs font-bold text-primary uppercase tracking-wide">{t("Linguagem", "Delivery", "Forma de hablar")}</div>
                          </div>
                          <div className="space-y-2 font-mono text-[11px]">
                            <div><span className="text-muted-foreground">{t("Tom:", "Tone:", "Tono:")}</span> {selected.config.filmingBrief.linguagem.tom}</div>
                            <div><span className="text-muted-foreground">{t("Velocidade:", "Pace:", "Velocidad:")}</span> {selected.config.filmingBrief.linguagem.velocidade}</div>
                            <div><span className="text-muted-foreground">{t("Pausas:", "Pauses:", "Pausas:")}</span> {selected.config.filmingBrief.linguagem.pausas}</div>
                            <div><span className="text-muted-foreground">{t("Gestos:", "Gestures:", "Gestos:")}</span> {selected.config.filmingBrief.linguagem.gestos}</div>
                          </div>
                        </div>
                      </div>

                      {/* Scene-by-scene direction */}
                      <div>
                        <div className="font-mono text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                          <Clapperboard className="h-3.5 w-3.5" />
                          {t(`Direção Cena a Cena — ${selected.config.filmingBrief.scenes.length} cenas`, `Scene-by-Scene Direction — ${selected.config.filmingBrief.scenes.length} scenes`, `Dirección escena por escena — ${selected.config.filmingBrief.scenes.length} escenas`)}
                        </div>
                        <div className="space-y-2">
                          {selected.config.filmingBrief.scenes.map((scene, idx) => {
                            const isOpen = expandedScene === scene.sceneId;
                            return (
                              <div
                                key={scene.sceneId}
                                className="border border-border/30 rounded-lg bg-background/20 overflow-hidden"
                              >
                                <button
                                  onClick={() => setExpandedScene(isOpen ? null : scene.sceneId)}
                                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-background/40 transition-colors text-left"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                                      <span className="font-mono text-[10px] font-bold text-primary">{String(idx + 1).padStart(2, "0")}</span>
                                    </div>
                                    <div>
                                      <div className="font-mono text-xs font-bold">{scene.titulo}</div>
                                      <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                                         {t(`${scene.takes.length} takes · ${scene.sceneType}`, `${scene.takes.length} takes · ${scene.sceneType}`, `${scene.takes.length} tomas · ${scene.sceneType}`)}
                                        {scene.entregaEmocional && ` · ${scene.entregaEmocional.slice(0, 50)}${scene.entregaEmocional.length > 50 ? "..." : ""}`}
                                      </div>
                                    </div>
                                  </div>
                                  {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                                </button>

                                {isOpen && (
                                  <div className="px-4 pb-4 border-t border-border/20 pt-3 space-y-3">
                                    {/* Voiceover text */}
                                    {scene.voiceoverText && (
                                      <div className="font-mono text-[10px] text-muted-foreground italic bg-background/40 rounded px-3 py-2 border border-border/20">
                                        "{scene.voiceoverText}"
                                      </div>
                                    )}

                                    {/* Takes */}
                                    <div className="space-y-2">
                                      {scene.takes.map(take => (
                                        <div key={take.numero} className="border border-primary/20 rounded-lg p-3 bg-primary/5">
                                          <div className="flex items-center gap-2 mb-2">
                                            <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center shrink-0">
                                              <span className="font-mono text-[9px] font-bold text-primary">T{take.numero}</span>
                                            </div>
                                            <span className="font-mono text-[10px] font-bold text-primary">{take.energia}</span>
                                            <span className="font-mono text-[10px] text-muted-foreground">· {take.postura}</span>
                                          </div>
                                          <div className="font-mono text-[11px]">{take.instrucao}</div>
                                          {take.variacao && (
                                            <div className="font-mono text-[10px] text-muted-foreground mt-1.5 flex items-start gap-1">
                                              <span className="text-primary shrink-0">↳</span>
                                              <span>{take.variacao}</span>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>

                                    {/* Director tip */}
                                    <div className="flex items-start gap-2 font-mono text-[10px] text-muted-foreground border border-border/20 rounded px-3 py-2">
                                      <Lightbulb className="h-3 w-3 text-yellow-400 shrink-0 mt-0.5" />
                                      <span>{scene.dica}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* ATLAS final message */}
                      <div className="border border-primary/20 rounded-lg p-4 bg-primary/5 text-center">
                        <div className="font-mono text-[10px] text-primary/70 mb-2 uppercase tracking-widest">{t("Mensagem do Diretor", "Director's Message", "Mensaje del director")}</div>
                        <div className="font-mono text-sm text-foreground/90 italic">"{selected.config.filmingBrief.mensagemFinal}"</div>
                        <div className="font-mono text-[9px] text-muted-foreground/50 mt-3">— ATLAS, {t("Diretor de Cena", "Scene Director", "Director de escena")} · NexOS AI</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Generate preview CTA */}
              {statusIs("storyboard_approved") && (
                <div className="border border-border/40 rounded-xl p-5 bg-background/40 space-y-4">
                  <div className="font-mono text-sm font-bold">{t("Passo 5 — Escolha o Modo de Produção", "Step 5 — Choose Production Mode", "Paso 5: elige el modo de producción")}</div>

                  {/* Mode selector — only when hasUserFace=true */}
                  {selected.config.hasUserFace && (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setHybridMode("ai")}
                        className={`p-4 rounded-lg border text-left transition-all ${hybridMode === "ai" ? "border-primary bg-primary/10" : "border-border/40 hover:border-border/70"}`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Sparkles className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-mono text-sm font-bold">{t("100% IA", "100% AI", "100% IA")}</span>
                        </div>
                          <div className="font-mono text-[10px] text-muted-foreground">{t("Avatar gerado por IA. Zero gravação necessária.", "AI-generated avatar. No recording needed.", "Avatar generado por IA. No hace falta grabar.")}</div>
                          <div className="font-mono text-[10px] text-primary mt-1.5">{t("80 cr/cena", "80 credits/scene", "80 créditos/escena")}</div>
                      </button>
                      <button
                        onClick={() => setHybridMode("recording")}
                        className={`p-4 rounded-lg border text-left transition-all ${hybridMode === "recording" ? "border-primary bg-primary/10" : "border-border/40 hover:border-border/70"}`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Camera className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-mono text-sm font-bold">{t("Híbrido", "Hybrid", "Híbrido")}</span>
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">{t("Você grava, a IA edita. Legendas, trilha e cortes automáticos.", "You record, AI edits. Automatic captions, soundtrack, and cuts.", "Tú grabas y la IA edita. Subtítulos, música y cortes automáticos.")}</div>
                        <div className="font-mono text-[10px] text-primary mt-1.5">{t("30 cr/vídeo", "30 credits/video", "30 créditos/vídeo")}</div>
                      </button>
                    </div>
                  )}

                  {/* AI mode */}
                  {hybridMode === "ai" && (
                    <div>
                      <div className="font-mono text-xs text-muted-foreground mb-3">
                        {selected.config.hasUserFace
                          ? t("O agente vai gerar clipes com avatar digital (720p) para cada cena. Você aprova cena a cena.", "The agent will generate digital-avatar clips (720p) for each scene. You approve them scene by scene.", "El agente generará clips con avatar digital (720p) para cada escena. Los aprobarás uno por uno.")
                          : t("O agente vai gerar clipes de preview (720p) para cada cena do storyboard. Você aprova cena a cena antes do vídeo HD final.", "The agent will generate preview clips (720p) for each storyboard scene. You approve them scene by scene before the final HD video.", "El agente generará clips de vista previa (720p) para cada escena del storyboard. Los aprobarás uno por uno antes del vídeo HD final.")}
                      </div>
                      <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          {t(`${selected.config.hasUserFace ? "80" : "50"} créditos/cena · ${(selected.config.hasUserFace ? 80 : 50) * selected.storyboard.length} total`, `${selected.config.hasUserFace ? "80" : "50"} credits/scene · ${(selected.config.hasUserFace ? 80 : 50) * selected.storyboard.length} total`, `${selected.config.hasUserFace ? "80" : "50"} créditos/escena · ${(selected.config.hasUserFace ? 80 : 50) * selected.storyboard.length} en total`)}
                        </span>
                        <span>·</span>
                        <span>{provider?.videoProvider ?? "Runway ML / Kling"}</span>
                      </div>
                      {!provider?.configured && (
                        <div className="border border-amber-500/20 bg-amber-500/5 p-3 rounded-lg mb-4">
                          <div className="font-mono text-xs text-amber-500 font-bold flex items-center gap-1.5 mb-1.5">
                            <AlertCircle className="h-4 w-4" /> {t("Geração de Vídeo Indisponível", "Video Generation Unavailable", "Generación de vídeo no disponible")}
                          </div>
                          <div className="font-mono text-[10px] text-muted-foreground leading-relaxed">
                            {t("Nenhum provedor de vídeo está configurado no momento. Como alternativa, utilize o modo", "No video provider is configured at the moment. Alternatively, use", "No hay ningún proveedor de vídeo configurado en este momento. Como alternativa, usa el modo")} <strong>{t("Híbrido", "Hybrid", "Híbrido")}</strong> {t("para gravar seu próprio vídeo e utilizar o editor IA, ou utilize a plataforma de", "to record your own video and use the AI editor, or use the advanced", "para grabar tu propio vídeo y usar el editor con IA, o usa la plataforma")} <strong>Studio</strong> {t("avançada.", "platform.", "avanzada.")}
                          </div>
                          <Button variant="outline" size="sm" className="mt-3 font-mono text-[10px]" onClick={() => setHybridMode("recording")}>
                            {t("Mudar para modo Híbrido", "Switch to Hybrid mode", "Cambiar al modo híbrido")}
                          </Button>
                        </div>
                      )}
                      <Button onClick={generatePreview} disabled={actionLoading || !provider?.configured} className="font-mono">
                        {actionLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                        {t("Gerar Preview dos Clipes", "Generate Clip Preview", "Generar vista previa de los clips")}
                      </Button>
                    </div>
                  )}

                  {/* Hybrid recording mode */}
                  {hybridMode === "recording" && (
                    <div className="space-y-4">
                      <div className="font-mono text-xs text-muted-foreground">
                        {t("Grave seu vídeo seguindo o roteiro e o guia do diretor. Faça o upload abaixo — a IA vai adicionar legendas, trilha sonora, títulos e cortes automáticos no editor.", "Record your video following the script and director's guide. Upload it below — AI will add captions, a soundtrack, titles, and automatic cuts in the editor.", "Graba tu vídeo siguiendo el guion y la guía del director. Súbelo abajo: la IA añadirá subtítulos, música, títulos y cortes automáticos en el editor.")}
                      </div>

                      {/* Upload area */}
                      <div
                        onClick={() => hybridInputRef.current?.click()}
                        className="border-2 border-dashed border-border/50 hover:border-primary/50 rounded-xl p-8 text-center cursor-pointer transition-colors group"
                      >
                        <input
                          ref={hybridInputRef}
                          type="file"
                          accept="video/*,.webm,.mp4,.mov,.avi"
                          className="hidden"
                          onChange={e => setHybridFile(e.target.files?.[0] ?? null)}
                        />
                        {hybridFile ? (
                          <div className="space-y-2">
                            <CheckCircle2 className="h-8 w-8 text-primary mx-auto" />
                            <div className="font-mono text-sm font-bold text-primary">{hybridFile.name}</div>
                            <div className="font-mono text-[10px] text-muted-foreground">
                              {(hybridFile.size / 1024 / 1024).toFixed(1)} MB · {t("Clique para trocar", "Click to replace", "Haz clic para cambiar")}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Upload className="h-8 w-8 text-muted-foreground/50 mx-auto group-hover:text-primary transition-colors" />
                            <div className="font-mono text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                              {t("Clique para selecionar seu vídeo", "Click to select your video", "Haz clic para seleccionar tu vídeo")}
                            </div>
                            <div className="font-mono text-[10px] text-muted-foreground/60">{t("MP4, MOV, WebM — até 2GB", "MP4, MOV, WebM — up to 2 GB", "MP4, MOV, WebM — hasta 2 GB")}</div>
                          </div>
                        )}
                      </div>

                      {/* Action */}
                      <div className="flex items-center gap-3">
                        <Button
                          onClick={uploadRecordingAndEdit}
                          disabled={!hybridFile || hybridUploading}
                          className="font-mono"
                        >
                          {hybridUploading
                            ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{t("Enviando…", "Uploading…", "Subiendo…")}</>
                            : <><Scissors className="h-4 w-4 mr-2" />{t("Enviar e Editar com IA", "Upload and Edit with AI", "Subir y editar con IA")}</>
                          }
                        </Button>
                        <div className="font-mono text-[10px] text-muted-foreground">{t("30 créditos · Editor de vídeo com IA", "30 credits · AI video editor", "30 créditos · Editor de vídeo con IA")}</div>
                      </div>

                      {/* Previous recordings list */}
                      {recordings.length > 0 && (
                        <div className="border border-border/30 rounded-lg p-4 space-y-2">
                          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{t("Gravações anteriores", "Previous recordings", "Grabaciones anteriores")}</div>
                          {recordings.map(rec => (
                            <div key={rec.id} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <Video className="h-3.5 w-3.5 text-primary shrink-0" />
                                <div>
                                  <div className="font-mono text-xs truncate max-w-[200px]">{rec.name}</div>
                                  <div className="font-mono text-[10px] text-muted-foreground">
                                    {new Date(rec.createdAt).toLocaleDateString(dateLocale)}
                                    {rec.videoSize ? ` · ${(rec.videoSize / 1024 / 1024).toFixed(1)} MB` : ""}
                                  </div>
                                </div>
                              </div>
                              {rec.hasVideo && rec.finalizationStatus === "ready" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="font-mono text-[10px] h-7 shrink-0"
                                  onClick={() => navigate(`/video-editor?recordingId=${rec.id}&projectId=${selected.id}`)}
                                >
                                  {t("Editar", "Edit", "Editar")}
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Avatar/voice clone gate */}
              {statusIs("awaiting_clone") && (
                <AvatarCloneGate
                  project={selected}
                  onResumed={(p) => {
                    setSelected(p);
                    setProjects(ps => ps.map(x => x.id === p.id ? p : x));
                  }}
                  onDismiss={() => setSelected(null)}
                />
              )}

              {/* Preview clips panel */}
              {["preview_generating","preview_ready","preview_approved"].includes(selected.status) && (
                <div className="border border-border/40 rounded-xl p-5 bg-background/40">
                  <div className="font-mono text-sm font-bold mb-4">
                    {t(`Preview — ${selected.storyboard.filter(s => s.clipStatus === "ready").length}/${selected.storyboard.length} cenas prontas`, `Preview — ${selected.storyboard.filter(s => s.clipStatus === "ready").length}/${selected.storyboard.length} scenes ready`, `Vista previa — ${selected.storyboard.filter(s => s.clipStatus === "ready").length}/${selected.storyboard.length} escenas listas`)}
                  </div>
                  <ClipsPanel project={selected} isHd={false} onAction={refreshSelected} />
                </div>
              )}

              {/* Generate final CTA */}
              {statusIs("preview_approved") && (
                <div className="border border-border/40 rounded-xl p-5 bg-background/40">
                  <div className="font-mono text-sm font-bold mb-2">{t("Passo 7 — Gerar Vídeo Final HD", "Step 7 — Generate Final HD Video", "Paso 7: generar vídeo HD final")}</div>
                  <div className="font-mono text-xs text-muted-foreground mb-4">
                    {t("Preview aprovado. O agente vai regenerar todos os clipes em 1080p HD para entrega final.", "Preview approved. The agent will regenerate all clips in 1080p HD for final delivery.", "Vista previa aprobada. El agente volverá a generar todos los clips en HD 1080p para la entrega final.")}
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground mb-4">
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      {t(`${selected.config.hasUserFace ? "80" : "150"} créditos/cena · ${(selected.config.hasUserFace ? 80 : 150) * selected.storyboard.length} total`, `${selected.config.hasUserFace ? "80" : "150"} credits/scene · ${(selected.config.hasUserFace ? 80 : 150) * selected.storyboard.length} total`, `${selected.config.hasUserFace ? "80" : "150"} créditos/escena · ${(selected.config.hasUserFace ? 80 : 150) * selected.storyboard.length} en total`)}
                    </span>
                  </div>
                  {!provider?.configured && (
                    <div className="border border-amber-500/20 bg-amber-500/5 p-3 rounded-lg mb-4">
                      <div className="font-mono text-xs text-amber-500 font-bold flex items-center gap-1.5 mb-1.5">
                        <AlertCircle className="h-4 w-4" /> {t("Geração de Vídeo Indisponível", "Video Generation Unavailable", "Generación de vídeo no disponible")}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground leading-relaxed">
                        {t("Nenhum provedor de vídeo está configurado no momento. Como alternativa, utilize o modo", "No video provider is configured at the moment. Alternatively, use", "No hay ningún proveedor de vídeo configurado en este momento. Como alternativa, usa el modo")} <strong>{t("Híbrido", "Hybrid", "Híbrido")}</strong> {t("para gravar seu próprio vídeo e utilizar o editor IA, ou utilize a plataforma de", "to record your own video and use the AI editor, or use the advanced", "para grabar tu propio vídeo y usar el editor con IA, o usa la plataforma")} <strong>Studio</strong> {t("avançada.", "platform.", "avanzada.")}
                      </div>
                    </div>
                  )}
                  <Button onClick={generateFinal} disabled={actionLoading || !provider?.configured} className="font-mono">
                    {actionLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Video className="h-4 w-4 mr-2" />}
                    {t("Gerar Vídeo Final HD", "Generate Final HD Video", "Generar vídeo HD final")}
                  </Button>
                </div>
              )}

              {/* Final clips panel */}
              {["final_generating","completed"].includes(selected.status) && (
                <div className="border border-border/40 rounded-xl p-5 bg-background/40">
                  <div className="font-mono text-sm font-bold mb-4">
                    {selected.status === "completed" ? t("✓ Vídeo HD Concluído", "✓ HD Video Complete", "✓ Vídeo HD completado") : t("Gerando vídeo HD...", "Generating HD video...", "Generando vídeo HD...")}
                  </div>
                  <ClipsPanel project={selected} isHd={true} onAction={refreshSelected} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
