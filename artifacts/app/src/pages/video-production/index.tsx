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
  status: string;
  videoPath?: string;
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

const STATUS_LABELS: Record<VideoStatus, string> = {
  intake: "Configurando",
  script_generating: "Gerando roteiro...",
  script_ready: "Roteiro pronto — aguardando aprovação",
  script_approved: "Roteiro aprovado",
  storyboard_generating: "Diretor criando storyboard...",
  storyboard_ready: "Storyboard pronto — aguardando aprovação",
  storyboard_approved: "Storyboard aprovado",
  preview_generating: "Gerando clipes de preview...",
  preview_ready: "Preview pronto — aguardando aprovação",
  preview_approved: "Preview aprovado",
  awaiting_clone: "Aguardando avatar/voz do lançador",
  final_generating: "Gerando vídeo final HD...",
  completed: "Concluído",
  failed: "Erro",
};

const PIPELINE_STEPS = [
  { key: "script", label: "Roteiro", statuses: ["script_generating","script_ready","script_approved"] },
  { key: "storyboard", label: "Storyboard", statuses: ["storyboard_generating","storyboard_ready","storyboard_approved"] },
  { key: "preview", label: "Preview", statuses: ["preview_generating","preview_ready","preview_approved"] },
  { key: "final", label: "Final HD", statuses: ["final_generating","completed"] },
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

const SCENE_TYPE_LABELS: Record<string, string> = {
  hook: "Hook", problem: "Problema", solution: "Solução", proof: "Prova", cta: "CTA", bridge: "Ponte", transition: "Transição"
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

function CreateProjectForm({ onCreated }: { onCreated: (p: VideoProject) => void }) {
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
      setError(e.message ?? "Erro ao criar projeto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="font-mono text-xs text-muted-foreground mb-1 block">NOME DO VÍDEO</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Ex: VSL NexOS — Lançamento 2026"
          className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="font-mono text-xs text-muted-foreground mb-1 block">FORMATO</label>
          <select value={format} onChange={e => setFormat(e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-xs">
            <option value="vsl">VSL</option>
            <option value="cpl">CPL</option>
            <option value="live_promo">Promo de Live</option>
            <option value="stories">Stories</option>
            <option value="reels">Reels</option>
            <option value="youtube">YouTube</option>
            <option value="webinar_promo">Promo de Webinar</option>
            <option value="testimonial">Depoimento</option>
            <option value="product_demo">Demo de Produto</option>
          </select>
        </div>
        <div>
          <label className="font-mono text-xs text-muted-foreground mb-1 block">PROPORÇÃO</label>
          <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-xs">
            <option value="16:9">16:9 — Horizontal</option>
            <option value="9:16">9:16 — Vertical</option>
            <option value="1:1">1:1 — Quadrado</option>
          </select>
        </div>
      </div>
      <div>
        <label className="font-mono text-xs text-muted-foreground mb-2 block">VOCÊ VAI APARECER NO VÍDEO?</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { setHasUserFace(false); setVoiceStyle("narrator"); }}
            className={`border rounded-lg p-3 text-left transition-all ${!hasUserFace ? "border-primary bg-primary/5" : "border-border hover:border-border/80"}`}
          >
            <Film className="h-5 w-5 mb-1 text-primary" />
            <div className="font-mono text-xs font-bold">Não — Vídeo com B-roll</div>
            <div className="font-mono text-[10px] text-muted-foreground mt-0.5">Agente gera cenas cinematográficas</div>
          </button>
          <button
            onClick={() => { setHasUserFace(true); setVoiceStyle("avatar"); }}
            className={`border rounded-lg p-3 text-left transition-all ${hasUserFace ? "border-primary bg-primary/5" : "border-border hover:border-border/80"}`}
          >
            <User className="h-5 w-5 mb-1 text-primary" />
            <div className="font-mono text-xs font-bold">Sim — Apresentador</div>
            <div className="font-mono text-[10px] text-muted-foreground mt-0.5">Requer HeyGen configurado</div>
          </button>
        </div>
        {hasUserFace && (
          <div className="flex flex-col gap-1 mt-1">
            <a
              href="/video-production/director-guide"
              className="flex items-center gap-1.5 font-mono text-[10px] text-primary/70 hover:text-primary transition-colors font-bold"
            >
              <Info className="h-3 w-3" />
              Guia do Diretor — vestuário, cenário, linguagem e roteiro completo
            </a>
            <a
              href="/video-production/filming-guide"
              className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <Info className="h-3 w-3" />
              Guia técnico de filmagem — setup de câmera, áudio e iluminação
            </a>
          </div>
        )}
      </div>
      {hasUserFace && (
        <div>
          <label className="font-mono text-xs text-muted-foreground mb-1 block">VOZ</label>
          <select value={voiceStyle} onChange={e => setVoiceStyle(e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-xs">
            <option value="avatar">Avatar padrão HeyGen</option>
            <option value="voice_clone">Clonar minha voz (ElevenLabs)</option>
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="font-mono text-xs text-muted-foreground mb-1 block">TOM</label>
          <select value={tone} onChange={e => setTone(e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-xs">
            <option value="inspirational">Inspiracional</option>
            <option value="urgent">Urgente</option>
            <option value="educational">Educativo</option>
            <option value="conversational">Conversacional</option>
            <option value="cinematic">Cinematográfico</option>
          </select>
        </div>
        <div>
          <label className="font-mono text-xs text-muted-foreground mb-1 block">RITMO</label>
          <select value={rhythm} onChange={e => setRhythm(e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-xs">
            <option value="slow">Lento</option>
            <option value="medium">Médio</option>
            <option value="fast">Rápido</option>
            <option value="dynamic">Dinâmico</option>
          </select>
        </div>
      </div>
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}
      <Button onClick={submit} disabled={loading || !title.trim()} className="w-full font-mono">
        {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
        Criar Projeto de Vídeo
      </Button>
    </div>
  );
}

// ─── Pipeline Header ──────────────────────────────────────────────────────────

function PipelineBar({ status }: { status: VideoStatus }) {
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
              {step.label}
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
        <p className="font-mono text-sm text-muted-foreground">Roteirista escrevendo o roteiro...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Roteiro gerado pelo agente — edite se necessário</div>
        <Button variant="ghost" size="sm" onClick={regenerate} disabled={loading} className="font-mono text-xs">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Regenerar
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
            Aprovar Roteiro e Criar Storyboard
          </Button>
        </div>
      )}
      {project.status === "script_approved" && (
        <div className="flex items-center gap-2 text-primary font-mono text-xs">
          <CheckCircle2 className="h-4 w-4" /> Roteiro aprovado — storyboard sendo criado
        </div>
      )}
    </div>
  );
}

// ─── Storyboard View ──────────────────────────────────────────────────────────

function StoryboardPanel({ project, onAction }: { project: VideoProject; onAction: () => void }) {
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
        <p className="font-mono text-sm text-muted-foreground">Diretor de Cena criando storyboard cena a cena...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {meta && (
        <div className="border border-border/40 rounded-lg p-3 bg-muted/20 space-y-1">
          <div className="font-mono text-xs text-primary font-bold">{meta.phaseSummary}</div>
          <div className="font-mono text-[11px] text-muted-foreground">
            Duração total: {Math.floor(meta.totalDurationSeconds / 60)}:{String(meta.totalDurationSeconds % 60).padStart(2,"0")} · {project.storyboard.length} cenas
          </div>
          {meta.directorNotes && <div className="font-mono text-[10px] text-muted-foreground/60 italic">{meta.directorNotes}</div>}
        </div>
      )}
      {/* Frame cards pre-approval progress */}
      {project.status === "storyboard_ready" && totalScenes > 0 && (
        <div className="border border-border/40 rounded-lg p-3 bg-muted/10 space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Aprovação de frames — {approvedScenes.size}/{totalScenes} cenas
            </div>
            {!allScenesApproved && (
              <button
                onClick={approveAllScenes}
                className="font-mono text-[10px] text-primary hover:underline"
              >
                Aprovar todas
              </button>
            )}
            {allScenesApproved && (
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-green-400">
                <CheckCircle2 className="h-3 w-3" /> Todas aprovadas
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
              Revise cada frame abaixo e marque como aprovado. O render final só libera após todas as cenas confirmadas.
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
                  {SCENE_TYPE_LABELS[scene.sceneType] ?? scene.sceneType}
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
                    {isSceneApproved ? "✓ Aprovada" : "Aprovar"}
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
              <div>
                <div className="text-muted-foreground/60 uppercase text-[9px] tracking-widest mb-1">Locução</div>
                <div className="text-foreground/80 leading-relaxed">{scene.voiceoverText}</div>
              </div>
              <div>
                <div className="text-muted-foreground/60 uppercase text-[9px] tracking-widest mb-1">Cena Visual</div>
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
            <RefreshCw className="h-4 w-4 mr-2" />Regenerar
          </Button>
          <Button
            onClick={approve}
            disabled={loading || !allScenesApproved}
            className="font-mono flex-1"
            title={!allScenesApproved ? `Aprove todas as ${totalScenes} cenas para continuar` : undefined}
          >
            {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            {allScenesApproved ? "Aprovar Storyboard — Gerar Preview" : `Aprove todas as cenas (${approvedScenes.size}/${totalScenes})`}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Clips View ───────────────────────────────────────────────────────────────

function ClipsPanel({ project, isHd, onAction }: { project: VideoProject; isHd: boolean; onAction: () => void }) {
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
            {isHd ? "Gerando clipes HD finais pelo agente..." : "Gerando clipes de preview pelo agente..."}
          </p>
          <Button variant="outline" size="sm" onClick={poll} disabled={loading} className="font-mono text-xs">
            Verificar Status
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
                      <CheckCircle2 className="h-3 w-3 mr-1" />Pronto
                    </Badge>
                  )}
                  {scene.clipStatus === "generating" && (
                    <Badge variant="outline" className="font-mono text-[10px] text-yellow-400 border-yellow-400/30">
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />Gerando
                    </Badge>
                  )}
                  {scene.clipStatus === "failed" && (
                    <Badge variant="outline" className="font-mono text-[10px] text-red-400 border-red-400/30">
                      <AlertCircle className="h-3 w-3 mr-1" />Falhou
                    </Badge>
                  )}
                  {scene.clipStatus === "pending" && (
                    <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3 mr-1" />Aguardando
                    </Badge>
                  )}
                </div>
              </div>
              {url && (
                <div className="mt-2">
                  <video src={url} controls className="w-full rounded-md max-h-48 bg-black" />
                  <a href={url} download className="flex items-center gap-1.5 font-mono text-[10px] text-primary hover:underline mt-1">
                    <Download className="h-3 w-3" />Baixar clipe
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
            Aprovar Preview — Gerar Vídeo HD Final
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Avatar/Voice Clone Gate ────────────────────────────────────────────────────

interface StockAvatar { id: string; label: string; gender?: string }

function AvatarCloneGate({ project, onResumed, onDismiss }: { project: VideoProject; onResumed: (p: VideoProject) => void; onDismiss?: () => void }) {
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
      setError("Câmera/microfone não disponíveis — verifique as permissões do navegador.");
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
          toast.success("Avatar de vídeo treinado com sucesso.");
        } else if (res.status === "failed") {
          if (trainingPollRef.current) clearInterval(trainingPollRef.current);
          setError("Treinamento do avatar falhou — tente novamente ou use foto rápida.");
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
      setError(e.message ?? "Erro ao enviar vídeos para clonagem");
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
      setError("Não foi possível carregar os avatares padrão.");
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
      setError("Microfone não disponível — verifique as permissões do navegador.");
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
      toast.success("Voz clonada com sucesso.");
    } catch (e: any) {
      setError(e.message ?? "Erro ao clonar voz");
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
      setError("Câmera não disponível — verifique as permissões do navegador.");
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
      toast.success("Avatar criado a partir do seu vídeo.");
    } catch (e: any) {
      setError(e.message ?? "Erro ao criar avatar");
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
      toast.success("Avatar padrão selecionado.");
    } catch (e: any) {
      setError(e.message ?? "Erro ao selecionar avatar");
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
      setError(e.message ?? "Erro ao retomar geração");
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
            ← Pular por agora
          </button>
        </div>
      )}
      <div>
        <div className="font-mono text-sm font-bold flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />Este vídeo tem cenas com avatar — precisamos da sua voz e rosto
        </div>
        <div className="font-mono text-xs text-muted-foreground mt-1">
          Você escolheu aparecer nas cenas. Para gerar o vídeo com avatar de IA precisamos clonar sua voz e criar seu avatar (ou você pode usar um avatar padrão).
        </div>
      </div>

      {error && <div className="font-mono text-[11px] text-red-400 border border-red-500/30 rounded-md p-2 bg-red-500/5">{error}</div>}

      {/* Step 1 — Voice */}
      <div className="border border-border/40 rounded-lg p-4 space-y-3">
        <div className="font-mono text-xs font-bold flex items-center gap-2">
          {voiceCloneId ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <Mic className="h-4 w-4 text-primary" />}
          1. Sua voz {voiceCloneId && <span className="text-green-400">— clonada</span>}
        </div>
        {!voiceCloneId && (
          <div className="space-y-2">
            <div className="font-mono text-[10px] text-muted-foreground">Grave 20-30s falando naturalmente para clonarmos sua voz.</div>
            <div className="flex items-center gap-2">
              {recState === "idle" && (
                <Button size="sm" onClick={startVoiceRecording} className="font-mono text-xs"><Mic className="h-3.5 w-3.5 mr-1.5" />Gravar</Button>
              )}
              {recState === "recording" && (
                <Button size="sm" variant="destructive" onClick={stopVoiceRecording} className="font-mono text-xs"><Square className="h-3.5 w-3.5 mr-1.5" />Parar</Button>
              )}
              {(recState === "recorded" || recState === "cloning") && (
                <>
                  {audioUrl && <audio src={audioUrl} controls className="h-8" />}
                  <Button size="sm" onClick={cloneVoiceNow} disabled={recState === "cloning"} className="font-mono text-xs">
                    {recState === "cloning" ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                    Clonar Voz
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setRecState("idle"); setAudioUrl(null); setAudioBase64(null); }} className="font-mono text-xs">Regravar</Button>
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
          2. Seu avatar {avatarReady && <span className="text-green-400">— pronto</span>}
        </div>
        {!avatarReady && (
          <div className="space-y-3">
            {!avatarMode && (
              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => { setAvatarMode("stock"); void loadStockAvatars(); }} className="p-3 rounded-lg border border-border/40 hover:border-primary/50 text-left transition-colors">
                  <div className="font-mono text-xs font-bold">Avatar padrão</div>
                  <div className="font-mono text-[10px] text-muted-foreground">Escolha um avatar pronto da NexOS</div>
                </button>
                <button onClick={() => setAvatarMode("record")} className="p-3 rounded-lg border border-border/40 hover:border-primary/50 text-left transition-colors">
                  <div className="font-mono text-xs font-bold">Foto rápida</div>
                  <div className="font-mono text-[10px] text-muted-foreground">Capture um frame da webcam (instantâneo)</div>
                </button>
                <button onClick={() => setAvatarMode("video")} className="p-3 rounded-lg border border-border/40 hover:border-primary/50 text-left transition-colors">
                  <div className="font-mono text-xs font-bold">Vídeo (mais realista)</div>
                  <div className="font-mono text-[10px] text-muted-foreground">Grave 2 vídeos — leva alguns minutos para treinar</div>
                </button>
              </div>
            )}

            {avatarMode === "video" && (
              <div className="space-y-3">
                {videoStep === "training" && (
                  <div className="space-y-2">
                    <div className="font-mono text-[10px] text-muted-foreground">
                      Passo 1/2 — Grave 20-30s olhando para a câmera, falando naturalmente e movendo levemente a cabeça (isso treina seu avatar em vídeo).
                    </div>
                    {!videoStreamRef.current && videoRecState === "idle" && !trainingUrl && (
                      <Button size="sm" onClick={() => startVideoRecording("training")} className="font-mono text-xs"><Camera className="h-3.5 w-3.5 mr-1.5" />Gravar treino</Button>
                    )}
                    {videoRecState === "recording" && (
                      <Button size="sm" variant="destructive" onClick={stopVideoRecording} className="font-mono text-xs"><Square className="h-3.5 w-3.5 mr-1.5" />Parar</Button>
                    )}
                    {trainingUrl && (
                      <div className="space-y-2">
                        <video src={trainingUrl} controls className="w-full max-w-xs rounded-lg" />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => { setVideoStep("consent"); setVideoRecState("idle"); }} className="font-mono text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Próximo passo
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => retakeVideo("training")} className="font-mono text-xs">Regravar</Button>
                        </div>
                      </div>
                    )}
                    <button onClick={() => setAvatarMode(null)} className="font-mono text-[10px] text-muted-foreground hover:underline">← Voltar</button>
                  </div>
                )}

                {videoStep === "consent" && (
                  <div className="space-y-2">
                    <div className="font-mono text-[10px] text-muted-foreground">
                      Passo 2/2 — Grave-se dizendo: <span className="text-foreground">"Eu autorizo o uso da minha imagem e voz para criar um avatar digital meu."</span>
                    </div>
                    {videoRecState === "idle" && !consentUrl && (
                      <Button size="sm" onClick={() => startVideoRecording("consent")} className="font-mono text-xs"><Mic className="h-3.5 w-3.5 mr-1.5" />Gravar consentimento</Button>
                    )}
                    {videoRecState === "recording" && (
                      <Button size="sm" variant="destructive" onClick={stopVideoRecording} className="font-mono text-xs"><Square className="h-3.5 w-3.5 mr-1.5" />Parar</Button>
                    )}
                    {consentUrl && (
                      <div className="space-y-2">
                        <video src={consentUrl} controls className="w-full max-w-xs rounded-lg" />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => void submitVideoClone()} className="font-mono text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Enviar para treinamento
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => retakeVideo("consent")} className="font-mono text-xs">Regravar</Button>
                        </div>
                      </div>
                    )}
                    <button onClick={() => setVideoStep("training")} className="font-mono text-[10px] text-muted-foreground hover:underline">← Voltar</button>
                  </div>
                )}

                {videoStep === "uploading" && (
                  <div className="font-mono text-xs flex items-center gap-2 text-muted-foreground">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />Enviando vídeos...
                  </div>
                )}

                {videoStep === "training_pending" && (
                  <div className="font-mono text-xs flex items-center gap-2 text-muted-foreground">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Treinando seu avatar digital ({avatarTrainingStatus ?? "pending"})... isso pode levar alguns minutos, você pode aguardar aqui.
                  </div>
                )}
              </div>
            )}

            {avatarMode === "stock" && (
              <div className="space-y-2">
                {stockLoading ? (
                  <div className="font-mono text-[10px] text-muted-foreground">Carregando avatares...</div>
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
                        <div className="font-mono text-[9px]">{selectingStockId === a.id ? "Selecionando..." : a.label}</div>
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => setAvatarMode(null)} className="font-mono text-[10px] text-muted-foreground hover:underline">← Voltar</button>
              </div>
            )}

            {avatarMode === "record" && (
              <div className="space-y-2">
                {!camStream && !frameBase64 && (
                  <Button size="sm" onClick={startCamera} className="font-mono text-xs"><Camera className="h-3.5 w-3.5 mr-1.5" />Ligar câmera</Button>
                )}
                {camStream && (
                  <div className="space-y-2">
                    <video ref={videoRef} autoPlay muted playsInline className="w-full max-w-xs rounded-lg bg-black" />
                    <Button size="sm" onClick={captureFrame} className="font-mono text-xs"><Camera className="h-3.5 w-3.5 mr-1.5" />Capturar</Button>
                  </div>
                )}
                {frameBase64 && !avatarReady && (
                  <div className="space-y-2">
                    <img src={`data:image/jpeg;base64,${frameBase64}`} alt="Frame capturado" className="w-full max-w-xs rounded-lg" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={createAvatarFromFrame} disabled={avatarUploading} className="font-mono text-xs">
                        {avatarUploading ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                        Criar Avatar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setFrameBase64(null)} className="font-mono text-xs">Refazer</Button>
                    </div>
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
                <button onClick={() => setAvatarMode(null)} className="font-mono text-[10px] text-muted-foreground hover:underline">← Voltar</button>
              </div>
            )}
          </div>
        )}
      </div>

      <Button onClick={resumePipeline} disabled={!canResume || resuming} className="font-mono w-full">
        {resuming ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
        Continuar Geração do Vídeo
      </Button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VideoProductionPage() {
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
        body: JSON.stringify({ name: `Gravação — ${selected.title}` }),
      });
      const recId = createRes.recording.id;

      // 2 — upload raw video blob (streaming)
      const uploadRes = await fetch(`/api/recordings/${recId}/upload?mode=hybrid`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": hybridFile.type || "video/webm" },
        body: hybridFile,
      });
      if (!uploadRes.ok) throw new Error("Upload falhou");

      toast.success("Gravação enviada! Abrindo editor de vídeo…");
      navigate(`/video-editor?recordingId=${recId}&projectId=${selected.id}`);
    } catch (err) {
      toast.error("Falha no upload. Tente novamente.");
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
    const timestamp = new Date().toLocaleString("pt-BR");
    const fingerprint = `${selected.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    const lines: string[] = [
      "═══════════════════════════════════════════════════════════",
      "  DIREÇÃO DE FILMAGEM — ATLAS / NexOS AI",
      "═══════════════════════════════════════════════════════════",
      `  Projeto: ${selected.title}`,
      `  Formato: ${selected.format.replace(/_/g, " ").toUpperCase()}`,
      `  Gerado em: ${timestamp}`,
      `  ID de verificação: ${fingerprint}`,
      "  ⚠ DOCUMENTO CONFIDENCIAL — uso exclusivo do destinatário",
      "═══════════════════════════════════════════════════════════",
      "",
      "▌ VESTUÁRIO",
      `  Cor: ${brief.vestuario.cor}`,
      `  Estilo: ${brief.vestuario.estilo}`,
      `  Evitar: ${brief.vestuario.evitar}`,
      `  Por quê: ${brief.vestuario.rationale}`,
      "",
      "▌ CENÁRIO",
      `  Tipo: ${brief.cenario.tipo}`,
      `  Fundo: ${brief.cenario.fundo}`,
      `  Iluminação: ${brief.cenario.iluminacao}`,
      `  Elementos: ${brief.cenario.elementos.join(" / ")}`,
      `  Por quê: ${brief.cenario.rationale}`,
      "",
      "▌ LINGUAGEM CORPORAL E VOZ",
      `  Tom: ${brief.linguagem.tom}`,
      `  Velocidade: ${brief.linguagem.velocidade}`,
      `  Pausas: ${brief.linguagem.pausas}`,
      `  Gestos: ${brief.linguagem.gestos}`,
      `  Olhar: ${brief.linguagem.olhar}`,
      "",
      "═══════════════════════════════════════════════════════════",
      "  DIREÇÃO CENA A CENA",
      "═══════════════════════════════════════════════════════════",
    ];

    for (const scene of brief.scenes) {
      lines.push("");
      lines.push(`▌ ${scene.titulo.toUpperCase()} [${scene.sceneType.toUpperCase()}]`);
      lines.push(`  Entrega emocional: ${scene.entregaEmocional}`);
      if (scene.voiceoverText) {
        lines.push(`  Texto: "${scene.voiceoverText.slice(0, 120)}${scene.voiceoverText.length > 120 ? "..." : ""}"`);
      }
      lines.push("");
      for (const take of scene.takes) {
        lines.push(`  ◆ TAKE ${take.numero} — ${take.energia}`);
        lines.push(`    Postura: ${take.postura}`);
        lines.push(`    Instrução: ${take.instrucao}`);
        if (take.variacao) lines.push(`    Variação: ${take.variacao}`);
        lines.push("");
      }
      lines.push(`  💡 Dica do ATLAS: ${scene.dica}`);
    }

    lines.push("");
    lines.push("═══════════════════════════════════════════════════════════");
    lines.push("  MENSAGEM DO DIRETOR");
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
              <div className="font-mono font-bold text-foreground">Produção de Vídeo</div>
              <div className="font-mono text-[10px] text-muted-foreground">Roteiro → Storyboard → Preview → Vídeo HD Final</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {provider && !provider.configured && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10">
                <AlertCircle className="h-3.5 w-3.5 text-yellow-400" />
                <span className="font-mono text-[10px] text-yellow-400">Geração de vídeo em breve</span>
              </div>
            )}
            {provider?.configured && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-green-500/30 bg-green-500/10">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                <span className="font-mono text-[10px] text-green-400">{provider.videoProvider}</span>
              </div>
            )}
            <Button onClick={() => setCreating(true)} size="sm" className="font-mono text-xs">
              <Plus className="h-3.5 w-3.5 mr-1.5" />Novo Vídeo
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6">
        {/* Left: project list */}
        <div className="w-72 shrink-0">
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mb-3">Projetos</div>
          <div className="space-y-2">
            {loading && <div className="font-mono text-xs text-muted-foreground">Carregando...</div>}
            {!loading && !projects.length && !creating && (
              <div className="border border-border/40 rounded-lg p-4 text-center">
                <Film className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <div className="font-mono text-xs text-muted-foreground">Nenhum projeto ainda</div>
                <Button variant="ghost" size="sm" className="font-mono text-xs mt-2" onClick={() => setCreating(true)}>
                  Criar primeiro vídeo
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
                <div className="font-mono text-[10px] text-muted-foreground mt-0.5 uppercase">{p.format} · {STATUS_LABELS[p.status]?.split("—")[0]?.trim()}</div>
                {p.status === "completed" && <div className="font-mono text-[9px] text-green-400 mt-0.5">✓ Concluído</div>}
              </button>
            ))}
          </div>
        </div>

        {/* Right: project detail */}
        <div className="flex-1 min-w-0">
          {creating && !selected && (
            <div className="border border-border/40 rounded-xl p-6 bg-background/40">
              <div className="font-mono text-sm font-bold mb-4">Novo Projeto de Vídeo</div>
              <CreateProjectForm onCreated={handleCreated} />
            </div>
          )}

          {!creating && !selected && (
            <div className="flex flex-col items-center justify-center h-64 gap-3 border border-dashed border-border/40 rounded-xl">
              <Film className="h-10 w-10 text-muted-foreground/30" />
              <div className="font-mono text-sm text-muted-foreground">Selecione um projeto ou crie um novo</div>
              <Button onClick={() => setCreating(true)} variant="outline" size="sm" className="font-mono text-xs">
                <Plus className="h-3.5 w-3.5 mr-1.5" />Novo Vídeo
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
                      {selected.config.hasUserFace ? "Com apresentador" : "B-roll"} ·{" "}
                      {selected.creditsUsed} cr usados
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={refreshSelected} className="font-mono text-xs">
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Atualizar
                  </Button>
                </div>
                <PipelineBar status={selected.status} />
                <div className="mt-3 font-mono text-xs text-muted-foreground">
                  {STATUS_LABELS[selected.status]}
                </div>
              </div>

              {/* Provider warning */}
              {provider && !provider.configured && (
                <div className="border border-primary/20 rounded-xl p-5 bg-primary/5">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm font-bold text-foreground mb-1">Geração de vídeo IA — em breve</div>
                      <div className="font-mono text-xs text-muted-foreground mb-3">
                        A NexOS vai oferecer geração de vídeo com IA diretamente pelo painel — sem precisar contratar nenhum provedor externo.
                        Você usa créditos NexOS e paga conforme consome.
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        {[
                          { label: "Preview 720p", cost: "50 créditos/cena", icon: "🎬" },
                          { label: "Avatar com lip-sync", cost: "80 créditos/cena", icon: "👤" },
                          { label: "Vídeo HD Final", cost: "150 créditos/cena", icon: "✨" },
                        ].map(p => (
                          <div key={p.label} className="border border-border/40 rounded-lg px-3 py-2 bg-background/40">
                            <div className="font-mono text-base mb-1">{p.icon}</div>
                            <div className="font-mono text-[11px] font-bold text-foreground">{p.label}</div>
                            <div className="font-mono text-[10px] text-primary">{p.cost}</div>
                          </div>
                        ))}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        Roteiro e storyboard já funcionam. Geração de clipes estará disponível em breve para todos os planos.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step actions */}
              {statusIs("intake") && (
                <div className="border border-border/40 rounded-xl p-5 bg-background/40">
                  <div className="font-mono text-sm font-bold mb-2">Passo 1 — Gerar Roteiro</div>
                  <div className="font-mono text-xs text-muted-foreground mb-4">
                    O Roteiristo agente vai escrever o roteiro completo do seu {selected.format.replace(/_/g," ")} baseado no perfil da campanha.
                    Você poderá editar antes de aprovar.
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground mb-4">
                    <span className="flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-primary" /> 18 créditos</span>
                    <span>·</span>
                    <span>Agente: Roteirista (GPT-5.5)</span>
                  </div>
                  <Button onClick={generateScript} disabled={actionLoading} className="font-mono">
                    {actionLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                    Gerar Roteiro
                  </Button>
                </div>
              )}

              {/* Script panel */}
              {["script_generating","script_ready","script_approved"].includes(selected.status) && (
                <div className="border border-border/40 rounded-xl p-5 bg-background/40">
                  <div className="font-mono text-sm font-bold mb-4">Roteiro</div>
                  <ScriptPanel project={selected} onAction={refreshSelected} />
                </div>
              )}

              {/* Generate storyboard CTA */}
              {statusIs("script_approved") && (
                <div className="border border-border/40 rounded-xl p-5 bg-background/40">
                  <div className="font-mono text-sm font-bold mb-2">Passo 3 — Criar Storyboard</div>
                  <div className="font-mono text-xs text-muted-foreground mb-4">
                    O Diretor de Cena vai dividir o roteiro em cenas individuais com descrição visual, paleta, transições e tempo.
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground mb-4">
                    <span className="flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-primary" /> 12 créditos</span>
                    <span>·</span>
                    <span>Agente: Diretor de Cena (Gemini)</span>
                  </div>
                  <Button onClick={generateStoryboard} disabled={actionLoading} className="font-mono">
                    {actionLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Film className="h-4 w-4 mr-2" />}
                    Criar Storyboard
                  </Button>
                </div>
              )}

              {/* Storyboard panel */}
              {["storyboard_generating","storyboard_ready","storyboard_approved"].includes(selected.status) && (
                <div className="border border-border/40 rounded-xl p-5 bg-background/40">
                  <div className="font-mono text-sm font-bold mb-4">Storyboard — Cenas</div>
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
                          ATLAS — Direção de Filmagem
                          <Badge variant="outline" className="font-mono text-[9px] text-primary border-primary/40">Diretor de Cena</Badge>
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground mt-0.5">
                          {selected.config.filmingBrief
                            ? `Gerado em ${new Date(selected.config.filmingBriefGeneratedAt!).toLocaleDateString("pt-BR")} · ${selected.config.filmingBrief.scenes.length} cenas · take por take`
                            : "ATLAS lê o roteiro e gera direção pontual — vestuário, cenário e takes específicos para este vídeo"
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
                          Baixar Briefing
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
                          ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />Gerando...</>
                          : selected.config.filmingBrief
                          ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Regerar</>
                          : <><Camera className="h-3.5 w-3.5 mr-1.5" />Pedir Direção do ATLAS</>
                        }
                      </Button>
                    </div>
                  </div>

                  {/* Credit note when no brief yet */}
                  {!selected.config.filmingBrief && !briefLoading && (
                    <div className="px-5 py-4 flex items-start gap-4">
                      <div className="flex-1 grid grid-cols-3 gap-3">
                        {[
                          { icon: <Shirt className="h-4 w-4 text-primary" />, label: "Vestuário pontual", desc: "Cor e estilo específicos para este roteiro e tom" },
                          { icon: <Lightbulb className="h-4 w-4 text-primary" />, label: "Cenário e luz", desc: "Setup do set que reforça a mensagem deste vídeo" },
                          { icon: <Camera className="h-4 w-4 text-primary" />, label: "Takes cena a cena", desc: "2–3 takes por cena com instrução de energia e postura" },
                        ].map(item => (
                          <div key={item.label} className="border border-border/30 rounded-lg p-3 bg-background/30">
                            {item.icon}
                            <div className="font-mono text-xs font-bold mt-2 mb-1">{item.label}</div>
                            <div className="font-mono text-[10px] text-muted-foreground">{item.desc}</div>
                          </div>
                        ))}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                        12 créditos
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
                            <div className="font-mono text-xs font-bold text-primary uppercase tracking-wide">Vestuário</div>
                          </div>
                          <div className="space-y-2 font-mono text-[11px]">
                            <div><span className="text-muted-foreground">Cor:</span> {selected.config.filmingBrief.vestuario.cor}</div>
                            <div><span className="text-muted-foreground">Estilo:</span> {selected.config.filmingBrief.vestuario.estilo}</div>
                            <div className="text-orange-400/80">✕ Evitar: {selected.config.filmingBrief.vestuario.evitar}</div>
                            <div className="text-muted-foreground/60 text-[10px] mt-2 pt-2 border-t border-border/20">{selected.config.filmingBrief.vestuario.rationale}</div>
                          </div>
                        </div>

                        {/* Cenário */}
                        <div className="border border-border/30 rounded-lg p-4 bg-background/30">
                          <div className="flex items-center gap-2 mb-3">
                            <Lightbulb className="h-3.5 w-3.5 text-primary" />
                            <div className="font-mono text-xs font-bold text-primary uppercase tracking-wide">Cenário & Luz</div>
                          </div>
                          <div className="space-y-2 font-mono text-[11px]">
                            <div><span className="text-muted-foreground">Fundo:</span> {selected.config.filmingBrief.cenario.fundo}</div>
                            <div><span className="text-muted-foreground">Luz:</span> {selected.config.filmingBrief.cenario.iluminacao}</div>
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
                            <div className="font-mono text-xs font-bold text-primary uppercase tracking-wide">Linguagem</div>
                          </div>
                          <div className="space-y-2 font-mono text-[11px]">
                            <div><span className="text-muted-foreground">Tom:</span> {selected.config.filmingBrief.linguagem.tom}</div>
                            <div><span className="text-muted-foreground">Velocidade:</span> {selected.config.filmingBrief.linguagem.velocidade}</div>
                            <div><span className="text-muted-foreground">Pausas:</span> {selected.config.filmingBrief.linguagem.pausas}</div>
                            <div><span className="text-muted-foreground">Gestos:</span> {selected.config.filmingBrief.linguagem.gestos}</div>
                          </div>
                        </div>
                      </div>

                      {/* Scene-by-scene direction */}
                      <div>
                        <div className="font-mono text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                          <Clapperboard className="h-3.5 w-3.5" />
                          Direção Cena a Cena — {selected.config.filmingBrief.scenes.length} cenas
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
                                        {scene.takes.length} takes · {scene.sceneType}
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
                        <div className="font-mono text-[10px] text-primary/70 mb-2 uppercase tracking-widest">Mensagem do Diretor</div>
                        <div className="font-mono text-sm text-foreground/90 italic">"{selected.config.filmingBrief.mensagemFinal}"</div>
                        <div className="font-mono text-[9px] text-muted-foreground/50 mt-3">— ATLAS, Diretor de Cena · NexOS AI</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Generate preview CTA */}
              {statusIs("storyboard_approved") && (
                <div className="border border-border/40 rounded-xl p-5 bg-background/40 space-y-4">
                  <div className="font-mono text-sm font-bold">Passo 5 — Escolha o Modo de Produção</div>

                  {/* Mode selector — only when hasUserFace=true */}
                  {selected.config.hasUserFace && (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setHybridMode("ai")}
                        className={`p-4 rounded-lg border text-left transition-all ${hybridMode === "ai" ? "border-primary bg-primary/10" : "border-border/40 hover:border-border/70"}`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Sparkles className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-mono text-sm font-bold">100% IA</span>
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">Avatar gerado por IA. Zero gravação necessária.</div>
                        <div className="font-mono text-[10px] text-primary mt-1.5">80 cr/cena</div>
                      </button>
                      <button
                        onClick={() => setHybridMode("recording")}
                        className={`p-4 rounded-lg border text-left transition-all ${hybridMode === "recording" ? "border-primary bg-primary/10" : "border-border/40 hover:border-border/70"}`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Camera className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-mono text-sm font-bold">Híbrido</span>
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">Você grava, a IA edita. Legendas, trilha e cortes automáticos.</div>
                        <div className="font-mono text-[10px] text-primary mt-1.5">30 cr/vídeo</div>
                      </button>
                    </div>
                  )}

                  {/* AI mode */}
                  {hybridMode === "ai" && (
                    <div>
                      <div className="font-mono text-xs text-muted-foreground mb-3">
                        {selected.config.hasUserFace
                          ? "O agente vai gerar clipes com avatar digital (720p) para cada cena. Você aprova cena a cena."
                          : "O agente vai gerar clipes de preview (720p) para cada cena do storyboard. Você aprova cena a cena antes do vídeo HD final."}
                      </div>
                      <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          {selected.config.hasUserFace ? "80" : "50"} créditos/cena · {(selected.config.hasUserFace ? 80 : 50) * selected.storyboard.length} total
                        </span>
                        <span>·</span>
                        <span>{provider?.videoProvider ?? "Runway ML / Kling"}</span>
                      </div>
                      {!provider?.configured && (
                        <div className="font-mono text-[10px] text-primary/70 mb-3 flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3" />Geração de clipes via créditos NexOS — em breve
                        </div>
                      )}
                      <Button onClick={generatePreview} disabled={actionLoading} className="font-mono">
                        {actionLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                        Gerar Preview dos Clipes
                      </Button>
                    </div>
                  )}

                  {/* Hybrid recording mode */}
                  {hybridMode === "recording" && (
                    <div className="space-y-4">
                      <div className="font-mono text-xs text-muted-foreground">
                        Grave seu vídeo seguindo o roteiro e o guia do diretor. Faça o upload abaixo — a IA vai adicionar legendas,
                        trilha sonora, títulos e cortes automáticos no editor.
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
                              {(hybridFile.size / 1024 / 1024).toFixed(1)} MB · Clique para trocar
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Upload className="h-8 w-8 text-muted-foreground/50 mx-auto group-hover:text-primary transition-colors" />
                            <div className="font-mono text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                              Clique para selecionar seu vídeo
                            </div>
                            <div className="font-mono text-[10px] text-muted-foreground/60">MP4, MOV, WebM — até 2GB</div>
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
                            ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Enviando…</>
                            : <><Scissors className="h-4 w-4 mr-2" />Enviar e Editar com IA</>
                          }
                        </Button>
                        <div className="font-mono text-[10px] text-muted-foreground">30 créditos · Editor de vídeo com IA</div>
                      </div>

                      {/* Previous recordings list */}
                      {recordings.length > 0 && (
                        <div className="border border-border/30 rounded-lg p-4 space-y-2">
                          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Gravações anteriores</div>
                          {recordings.map(rec => (
                            <div key={rec.id} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <Video className="h-3.5 w-3.5 text-primary shrink-0" />
                                <div>
                                  <div className="font-mono text-xs truncate max-w-[200px]">{rec.name}</div>
                                  <div className="font-mono text-[10px] text-muted-foreground">
                                    {new Date(rec.createdAt).toLocaleDateString("pt-BR")}
                                    {rec.videoSize ? ` · ${(rec.videoSize / 1024 / 1024).toFixed(1)} MB` : ""}
                                  </div>
                                </div>
                              </div>
                              {rec.videoPath && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="font-mono text-[10px] h-7 shrink-0"
                                  onClick={() => navigate(`/video-editor?recordingId=${rec.id}&projectId=${selected.id}`)}
                                >
                                  Editar
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
                    Preview — {selected.storyboard.filter(s => s.clipStatus === "ready").length}/{selected.storyboard.length} cenas prontas
                  </div>
                  <ClipsPanel project={selected} isHd={false} onAction={refreshSelected} />
                </div>
              )}

              {/* Generate final CTA */}
              {statusIs("preview_approved") && (
                <div className="border border-border/40 rounded-xl p-5 bg-background/40">
                  <div className="font-mono text-sm font-bold mb-2">Passo 7 — Gerar Vídeo Final HD</div>
                  <div className="font-mono text-xs text-muted-foreground mb-4">
                    Preview aprovado. O agente vai regenerar todos os clipes em 1080p HD para entrega final.
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground mb-4">
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      {selected.config.hasUserFace ? "80" : "150"} créditos/cena · {(selected.config.hasUserFace ? 80 : 150) * selected.storyboard.length} total
                    </span>
                  </div>
                  <Button onClick={generateFinal} disabled={actionLoading} className="font-mono">
                    {actionLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Video className="h-4 w-4 mr-2" />}
                    Gerar Vídeo Final HD
                  </Button>
                </div>
              )}

              {/* Final clips panel */}
              {["final_generating","completed"].includes(selected.status) && (
                <div className="border border-border/40 rounded-xl p-5 bg-background/40">
                  <div className="font-mono text-sm font-bold mb-4">
                    {selected.status === "completed" ? "✓ Vídeo HD Concluído" : "Gerando vídeo HD..."}
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
