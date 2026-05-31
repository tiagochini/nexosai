import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import {
  Video, Play, CheckCircle2, Clock, AlertCircle, Sparkles,
  ChevronRight, User, Mic, Film, Wand2, Eye, Download,
  RefreshCw, Plus, Settings, Info
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type VideoStatus =
  | "intake" | "script_generating" | "script_ready" | "script_approved"
  | "storyboard_generating" | "storyboard_ready" | "storyboard_approved"
  | "preview_generating" | "preview_ready" | "preview_approved"
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

interface VideoProject {
  id: string;
  title: string;
  format: string;
  status: VideoStatus;
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
  const meta = project.config.storyboardMeta;

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
      <div className="space-y-3">
        {project.storyboard.map((scene) => (
          <div key={scene.id} className="border border-border/40 rounded-lg p-4 bg-background/40">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/20 text-primary font-mono text-xs flex items-center justify-center font-bold">{scene.order}</div>
                <span className="font-mono text-sm font-medium">{scene.title}</span>
                {scene.hasAvatar && <User className="h-3.5 w-3.5 text-yellow-400" />}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${SCENE_TYPE_COLORS[scene.sceneType] ?? "bg-muted text-muted-foreground border-border"}`}>
                  {SCENE_TYPE_LABELS[scene.sceneType] ?? scene.sceneType}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">{scene.durationSeconds}s</span>
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
        ))}
      </div>
      {project.status === "storyboard_ready" && (
        <div className="flex gap-3">
          <Button variant="outline" onClick={regenerate} disabled={loading} className="font-mono">
            <RefreshCw className="h-4 w-4 mr-2" />Regenerar
          </Button>
          <Button onClick={approve} disabled={loading} className="font-mono flex-1">
            {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Aprovar Storyboard — Gerar Preview
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VideoProductionPage() {
  const [, navigate] = useLocation();
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [selected, setSelected] = useState<VideoProject | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [provider, setProvider] = useState<ProviderStatus | null>(null);

  // Auto-select project from URL param (e.g. coming from CreativeStudioBlock)
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const projectIdParam = search?.get("projectId");

  useEffect(() => {
    loadProjects();
    loadProviderStatus();
  }, []);

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

  async function generateFinal() {
    if (!selected) return;
    setActionLoading(true);
    try {
      const res = await customFetch<{ project: VideoProject }>(`/api/video-projects/${selected.id}/generate-final`, { method: "POST", body: "{}" });
      setSelected(res.project);
      setProjects(ps => ps.map(p => p.id === res.project.id ? res.project : p));
    } finally { setActionLoading(false); }
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
                <span className="font-mono text-[10px] text-yellow-400">Provedor de vídeo não configurado</span>
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
                <div className="border border-yellow-500/30 rounded-lg p-4 bg-yellow-500/5">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-mono text-xs font-bold text-yellow-400 mb-1">Provedor de vídeo não configurado</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{provider.instructions.video}</div>
                      {provider.instructions.avatar && (
                        <div className="font-mono text-[11px] text-muted-foreground mt-1">{provider.instructions.avatar}</div>
                      )}
                      <div className="font-mono text-[10px] text-muted-foreground/60 mt-2">
                        O roteiro e storyboard funcionam sem provedor. A geração de clipes de vídeo requer Runway ML ou Kling (fal.ai).
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
                    <span>Agente: Roteirista (GPT-4o)</span>
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

              {/* Generate preview CTA */}
              {statusIs("storyboard_approved") && (
                <div className="border border-border/40 rounded-xl p-5 bg-background/40">
                  <div className="font-mono text-sm font-bold mb-2">Passo 5 — Gerar Preview</div>
                  <div className="font-mono text-xs text-muted-foreground mb-4">
                    O agente vai gerar clipes de preview (720p) para cada cena do storyboard.
                    Você aprova cena a cena antes do vídeo HD final.
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground mb-4">
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      {selected.config.hasUserFace ? "80" : "50"} créditos/cena · {(selected.config.hasUserFace ? 80 : 50) * selected.storyboard.length} total
                    </span>
                    <span>·</span>
                    <span>{provider?.videoProvider ?? "Runway ML / Kling"}</span>
                  </div>
                  {!provider?.configured && (
                    <div className="font-mono text-[10px] text-yellow-400 mb-3 flex items-center gap-1.5">
                      <AlertCircle className="h-3 w-3" />Configure RUNWAY_API_KEY ou FAL_API_KEY para gerar clipes reais
                    </div>
                  )}
                  <Button onClick={generatePreview} disabled={actionLoading} className="font-mono">
                    {actionLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                    Gerar Preview dos Clipes
                  </Button>
                </div>
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
