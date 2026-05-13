/**
 * RecordButton — gravação de lançamento com duplo áudio (sistema + microfone).
 *
 * Funcionalidades:
 * - Captura de tela + áudio do sistema (getDisplayMedia)
 * - Microfone (getUserMedia) misturado via AudioContext
 * - Upload automático do vídeo ao servidor após parar
 * - Re-sincronização de sessão ativa na montagem do componente
 * - Modo minimizado (barra pulsando no canto)
 * - Timer correto: desconta pausedAt + totalPausedMs
 * - Marcadores de evento durante a gravação
 * - Export ZIP de metadados
 * - Botão para abrir no editor de vídeo após gravar
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Circle, Square, Pause, Play, Download, Minimize2, Maximize2,
  Radio, Tag, Video, CheckCircle2, XCircle, Mic,
  Monitor, AlertTriangle, Loader2, Trash2, ExternalLink,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type RecordingState = "idle" | "recording" | "paused" | "stopped";

interface RecordingMeta {
  id: string;
  name: string;
  state: RecordingState;
  campaignId: string | null;
  startedAt: string;
  pausedAt: string | null;
  stoppedAt: string | null;
  totalPausedMs: number;
  videoPath: string | null;
  videoSize: number | null;
  videoUploadedAt: string | null;
}

type EventType =
  | "briefing_started" | "briefing_completed" | "strategy_generated"
  | "copy_generated" | "approval_requested" | "approved"
  | "creative_delivered" | "budget_set" | "campaign_activated"
  | "cart_opened" | "cart_closed" | "metrics_snapshot" | "custom";

const EVENT_LABELS: Record<EventType, string> = {
  briefing_started: "Briefing iniciado",
  briefing_completed: "Briefing concluído",
  strategy_generated: "Estratégia gerada",
  copy_generated: "Copy gerada",
  approval_requested: "Aprovação solicitada",
  approved: "Aprovado",
  creative_delivered: "Criativo entregue",
  budget_set: "Orçamento definido",
  campaign_activated: "Campanha ativada",
  cart_opened: "Carrinho aberto",
  cart_closed: "Carrinho fechado",
  metrics_snapshot: "Snapshot de métricas",
  custom: "Evento personalizado",
};

const QUICK_EVENTS: EventType[] = [
  "briefing_started", "strategy_generated", "copy_generated",
  "approved", "cart_opened", "cart_closed", "metrics_snapshot",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Calculate active elapsed ms — correctly accounts for pause intervals. */
function calcActiveMs(rec: RecordingMeta): number {
  const started = new Date(rec.startedAt).getTime();
  const end = rec.stoppedAt ? new Date(rec.stoppedAt).getTime() : Date.now();
  let totalPaused = rec.totalPausedMs;
  // If currently paused, add time since it was paused
  if (rec.state === "paused" && rec.pausedAt) {
    totalPaused += Date.now() - new Date(rec.pausedAt).getTime();
  }
  return Math.max(0, end - started - totalPaused);
}

/** Mix multiple audio tracks from multiple streams into one via AudioContext. */
function mixAudioStreams(streams: MediaStream[]): { mixed: MediaStream; ctx: AudioContext } {
  const ctx = new AudioContext();
  const dst = ctx.createMediaStreamDestination();
  for (const stream of streams) {
    if (stream.getAudioTracks().length > 0) {
      ctx.createMediaStreamSource(stream).connect(dst);
    }
  }
  return { mixed: dst.stream, ctx };
}

/** Upload video blob to server as raw binary. */
async function uploadVideoToServer(blob: Blob, recordingId: string): Promise<void> {
  const token = localStorage.getItem("nexos_access_token");
  const res = await fetch(`/api/recordings/${recordingId}/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "video/webm",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: blob,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "erro desconhecido");
    throw new Error(`Upload falhou: ${msg}`);
  }
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function RecordButton({ campaignId }: { campaignId?: string }) {
  const { workspace } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [open, setOpen]             = useState(false);
  const [minimized, setMinimized]   = useState(false);
  const [uiState, setUiState]       = useState<RecordingState>("idle");
  const [recording, setRecording]   = useState<RecordingMeta | null>(null);
  const [elapsed, setElapsed]       = useState(0);
  const [sessionName, setSessionName] = useState("");
  const [videoBlob, setVideoBlob]   = useState<Blob | null>(null);
  const [uploading, setUploading]   = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [hasMic, setHasMic]         = useState(true);
  const [hasSystem, setHasSystem]   = useState(false);
  const [eventCount, setEventCount] = useState(0);
  const [lastEvent, setLastEvent]   = useState<string | null>(null);
  const [firingEvent, setFiringEvent] = useState(false);
  const [syncLoading, setSyncLoading] = useState(true);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef     = useRef<MediaStream | null>(null);
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef     = useRef<RecordingMeta | null>(null);

  useEffect(() => { recordingRef.current = recording; }, [recording]);

  // ── Timer ──────────────────────────────────────────────────────────────────
  const startTimer = useCallback((rec: RecordingMeta) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const cur = recordingRef.current;
      if (!cur || cur.state === "stopped") { clearInterval(timerRef.current!); return; }
      setElapsed(calcActiveMs(cur));
    }, 500);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // ── Re-sync active session on mount ───────────────────────────────────────
  useEffect(() => {
    if (!workspace) { setSyncLoading(false); return; }
    let cancelled = false;

    void (async () => {
      try {
        const data = await customFetch<{ recordings: RecordingMeta[] }>("/api/recordings");
        if (cancelled) return;
        // Find any active session belonging to this workspace
        const active = data.recordings.find(r => r.state === "recording" || r.state === "paused");
        if (active) {
          setRecording(active);
          recordingRef.current = active;
          setUiState(active.state);
          setElapsed(calcActiveMs(active));
          if (active.state === "recording") startTimer(active);
          toast.info(`Sessão "${active.name}" restaurada`, { duration: 3000 });
        }
      } catch {
        // Silently ignore — recording is optional
      } finally {
        if (!cancelled) setSyncLoading(false);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopTimer();
      displayStreamRef.current?.getTracks().forEach(t => t.stop());
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close().catch(() => {});
    };
  }, [stopTimer]);

  // ── Start recording ────────────────────────────────────────────────────────
  const startCapture = async () => {
    if (!workspace) { toast.error("Workspace não carregado"); return; }
    const name = sessionName.trim() || `Gravação ${new Date().toLocaleString("pt-BR")}`;

    // 1. Screen + system audio
    let displayStream: MediaStream;
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true, // system audio (when available)
      });
      setHasSystem(displayStream.getAudioTracks().length > 0);
    } catch {
      toast.error("Acesso à tela negado. Permita o compartilhamento de tela.");
      return;
    }

    // 2. Microphone (optional)
    let micStream: MediaStream | null = null;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setHasMic(true);
    } catch {
      setHasMic(false);
      toast.warning("Microfone não disponível — gravando apenas áudio do sistema.");
    }

    // 3. Mix: system audio + microphone via AudioContext
    const { mixed, ctx } = mixAudioStreams([displayStream, ...(micStream ? [micStream] : [])]);
    audioCtxRef.current = ctx;
    displayStreamRef.current = displayStream;
    micStreamRef.current = micStream;

    // 4. Combined stream: display video + mixed audio
    const combined = new MediaStream([
      ...displayStream.getVideoTracks(),
      ...mixed.getAudioTracks(),
    ]);

    // 5. Create session on server
    let rec: RecordingMeta;
    try {
      const data = await customFetch<{ recording: RecordingMeta }>("/api/recordings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, campaignId }),
      });
      rec = data.recording;
    } catch {
      displayStream.getTracks().forEach(t => t.stop());
      micStream?.getTracks().forEach(t => t.stop());
      ctx.close().catch(() => {});
      toast.error("Erro ao iniciar gravação no servidor.");
      return;
    }

    // 6. Start MediaRecorder
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "";

    const mr = new MediaRecorder(combined, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = mr;
    chunksRef.current = [];

    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };

    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || "video/webm" });
      setVideoBlob(blob);
      // Auto-upload
      const currentRec = recordingRef.current;
      if (currentRec) {
        setUploading(true);
        try {
          await uploadVideoToServer(blob, currentRec.id);
          setUploadDone(true);
          toast.success("Vídeo salvo no servidor.");
        } catch {
          setUploadDone(false);
          toast.error("Upload falhou — use o download local para salvar o vídeo.");
        } finally {
          setUploading(false);
        }
      }
    };

    // Stop gracefully if user ends screen share via browser
    displayStream.getVideoTracks()[0]?.addEventListener("ended", () => {
      void stopCapture(rec.id);
    });

    mr.start(2000); // collect chunks every 2s

    setRecording(rec);
    recordingRef.current = rec;
    setUiState("recording");
    setElapsed(0);
    setEventCount(0);
    setLastEvent(null);
    setVideoBlob(null);
    setUploadDone(false);
    startTimer(rec);
    toast.success("Gravação iniciada — duplo áudio ativo.");
  };

  // ── Pause ──────────────────────────────────────────────────────────────────
  const pauseCapture = async () => {
    const rec = recordingRef.current;
    if (!rec || uiState !== "recording") return;
    mediaRecorderRef.current?.pause();
    try {
      const data = await customFetch<{ recording: RecordingMeta }>(`/api/recordings/${rec.id}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      setRecording(data.recording);
      recordingRef.current = data.recording;
      setUiState("paused");
      stopTimer();
    } catch { toast.error("Erro ao pausar"); }
  };

  // ── Resume ─────────────────────────────────────────────────────────────────
  const resumeCapture = async () => {
    const rec = recordingRef.current;
    if (!rec || uiState !== "paused") return;
    mediaRecorderRef.current?.resume();
    try {
      const data = await customFetch<{ recording: RecordingMeta }>(`/api/recordings/${rec.id}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      setRecording(data.recording);
      recordingRef.current = data.recording;
      setUiState("recording");
      startTimer(data.recording);
    } catch { toast.error("Erro ao retomar"); }
  };

  // ── Stop ───────────────────────────────────────────────────────────────────
  const stopCapture = async (overrideId?: string) => {
    const recId = overrideId ?? recordingRef.current?.id;
    if (!recId) return;

    stopTimer();
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
    displayStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close().catch(() => {});

    try {
      const data = await customFetch<{ recording: RecordingMeta }>(`/api/recordings/${recId}/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      setRecording(data.recording);
      recordingRef.current = data.recording;
      setElapsed(calcActiveMs(data.recording));
    } catch { /* best-effort */ }

    setUiState("stopped");
    setMinimized(false);
  };

  // ── Fire event marker ──────────────────────────────────────────────────────
  const fireEvent = async (type: EventType, phase = "geral") => {
    const rec = recordingRef.current;
    if (!rec || rec.state === "stopped") return;
    setFiringEvent(true);
    try {
      await customFetch(`/api/recordings/${rec.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, phase }),
      });
      setEventCount(c => c + 1);
      setLastEvent(EVENT_LABELS[type]);
    } catch { toast.error("Erro ao registrar evento"); }
    finally { setFiringEvent(false); }
  };

  // ── Downloads ──────────────────────────────────────────────────────────────
  const downloadLocal = () => {
    if (!videoBlob) return;
    const url = URL.createObjectURL(videoBlob);
    const a = document.createElement("a");
    const name = recording?.name.replace(/[^a-z0-9]/gi, "_").slice(0, 40) ?? "gravacao";
    a.href = url; a.download = `${name}.webm`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast.success("Download iniciado — veja a pasta Downloads do navegador.");
  };

  const downloadZip = () => {
    if (!recording) return;
    window.open(`/api/recordings/${recording.id}/export`, "_blank");
  };

  const openInEditor = () => {
    if (!recording) return;
    window.open(`/video-editor?recordingId=${recording.id}`, "_blank");
  };

  const resetSession = () => {
    setUiState("idle"); setRecording(null); recordingRef.current = null;
    setElapsed(0); setVideoBlob(null); setUploadDone(false);
    setEventCount(0); setLastEvent(null); setSessionName("");
    setHasMic(true); setHasSystem(false);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const hasActive = uiState === "recording" || uiState === "paused";

  // ── Minimized mode ─────────────────────────────────────────────────────────
  if (minimized && hasActive) {
    return (
      <button
        onClick={() => setMinimized(false)}
        title={`Gravação ${uiState === "paused" ? "pausada" : "ativa"} · ${fmtDuration(elapsed)}`}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-3 py-2 border
          text-xs font-mono uppercase tracking-widest shadow-lg transition-all
          ${uiState === "paused"
            ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-400"
            : "border-destructive/60 bg-destructive/10 text-destructive"
          }`}
      >
        <span className={`w-2 h-2 rounded-full ${
          uiState === "paused" ? "bg-yellow-400" : "bg-destructive animate-pulse"
        }`} />
        <span>{fmtDuration(elapsed)}</span>
        <Maximize2 className="h-3 w-3 opacity-60" />
      </button>
    );
  }

  // ── Full panel ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Gravação de Lançamento"
        className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 px-3 py-2 border
          text-xs font-mono uppercase tracking-widest shadow-lg transition-all
          ${hasActive
            ? uiState === "paused"
              ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-400"
              : "border-destructive/60 bg-destructive/10 text-destructive"
            : "border-border/50 bg-card/80 text-muted-foreground hover:text-foreground hover:border-border"
          }`}
      >
        {hasActive && (
          <span className={`w-2 h-2 rounded-full ${
            uiState === "paused" ? "bg-yellow-400" : "bg-destructive animate-pulse"
          }`} />
        )}
        {!hasActive && <Radio className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">
          {hasActive ? fmtDuration(elapsed) : "Gravar"}
        </span>
        {hasActive && <span className="sm:hidden">{fmtDuration(elapsed)}</span>}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] border border-border bg-background shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/60">
            <div className="flex items-center gap-2">
              <Radio className={`h-4 w-4 ${hasActive ? "text-destructive" : "text-muted-foreground"}`} />
              <span className="font-mono text-xs uppercase tracking-widest font-bold">
                Gravação de Lançamento
              </span>
            </div>
            <div className="flex items-center gap-1">
              {hasActive && (
                <button
                  onClick={() => { setMinimized(true); setOpen(false); }}
                  className="p-1.5 hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
                  title="Minimizar (continua gravando)"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {syncLoading && (
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Verificando sessões ativas…
              </div>
            )}

            {/* ── IDLE ──────────────────────────────────────────────────── */}
            {uiState === "idle" && !syncLoading && (
              <div className="space-y-3">
                <div>
                  <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground block mb-1.5">
                    Nome da sessão
                  </label>
                  <input
                    value={sessionName}
                    onChange={e => setSessionName(e.target.value)}
                    placeholder="Ex: Lançamento Janeiro — CPL 1"
                    className="w-full border border-border/50 bg-card/40 px-3 py-2 text-xs font-mono
                      text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none"
                  />
                </div>

                <div className="flex gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground border border-border/30 px-2 py-1">
                    <Monitor className="h-3 w-3" />Tela + áudio do sistema
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground border border-border/30 px-2 py-1">
                    <Mic className="h-3 w-3" />Microfone (misturado)
                  </div>
                </div>

                <p className="text-[11px] font-mono text-muted-foreground/70 leading-relaxed">
                  O browser pedirá permissão de tela. Ambos os áudios (sistema + microfone) são
                  misturados automaticamente. O vídeo é enviado ao servidor ao parar.
                </p>

                <Button onClick={startCapture} className="w-full rounded-none font-mono uppercase tracking-widest text-xs">
                  <Circle className="h-3.5 w-3.5 mr-2 fill-current" />
                  Iniciar Gravação
                </Button>
              </div>
            )}

            {/* ── RECORDING / PAUSED ──────────────────────────────────── */}
            {(uiState === "recording" || uiState === "paused") && (
              <div className="space-y-3">
                {/* Status bar */}
                <div className={`flex items-center gap-3 px-3 py-2.5 border ${
                  uiState === "paused" ? "border-yellow-400/40 bg-yellow-400/5" : "border-destructive/40 bg-destructive/5"
                }`}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    uiState === "paused" ? "bg-yellow-400" : "bg-destructive animate-pulse"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs font-bold text-foreground truncate">{recording?.name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                      {uiState === "paused" ? "Pausado" : "Gravando"}
                    </p>
                  </div>
                  <span className="font-mono text-xl font-bold tabular-nums">{fmtDuration(elapsed)}</span>
                </div>

                {/* Audio status badges */}
                <div className="flex gap-1.5 flex-wrap">
                  {hasSystem && (
                    <Badge variant="outline" className="text-[10px] font-mono rounded-none border-emerald-500/40 text-emerald-400">
                      <Monitor className="h-2.5 w-2.5 mr-1" />Sistema
                    </Badge>
                  )}
                  {hasMic && (
                    <Badge variant="outline" className="text-[10px] font-mono rounded-none border-blue-500/40 text-blue-400">
                      <Mic className="h-2.5 w-2.5 mr-1" />Microfone
                    </Badge>
                  )}
                  {!hasSystem && !hasMic && (
                    <Badge variant="outline" className="text-[10px] font-mono rounded-none border-yellow-400/40 text-yellow-400">
                      <AlertTriangle className="h-2.5 w-2.5 mr-1" />Sem áudio
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] font-mono rounded-none border-border/40 text-muted-foreground">
                    <Tag className="h-2.5 w-2.5 mr-1" />{eventCount} marcos
                  </Badge>
                </div>

                {/* Quick event markers */}
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2">
                    Marcar evento
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {QUICK_EVENTS.map(type => (
                      <button
                        key={type}
                        onClick={() => void fireEvent(type)}
                        disabled={firingEvent}
                        className="text-[10px] font-mono px-2 py-1 border border-border/40 bg-card/40
                          hover:border-primary/40 hover:bg-primary/10 transition-all text-muted-foreground
                          hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {EVENT_LABELS[type]}
                      </button>
                    ))}
                  </div>
                  {lastEvent && (
                    <p className="mt-1.5 text-[10px] font-mono text-primary/70">✓ {lastEvent}</p>
                  )}
                </div>

                {/* Controls */}
                <div className="grid grid-cols-3 gap-2">
                  {uiState === "recording" ? (
                    <Button variant="outline" size="sm" onClick={pauseCapture}
                      className="col-span-1 rounded-none font-mono text-[11px] uppercase tracking-widest border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/10">
                      <Pause className="h-3 w-3 mr-1" />Pausar
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={resumeCapture}
                      className="col-span-1 rounded-none font-mono text-[11px] uppercase tracking-widest border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10">
                      <Play className="h-3 w-3 mr-1" />Retomar
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => void stopCapture()}
                    className="col-span-2 rounded-none font-mono text-[11px] uppercase tracking-widest border-destructive/40 text-destructive hover:bg-destructive/10">
                    <Square className="h-3 w-3 mr-1 fill-current" />Parar e Salvar
                  </Button>
                </div>
              </div>
            )}

            {/* ── STOPPED ───────────────────────────────────────────────── */}
            {uiState === "stopped" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-3 py-2.5 border border-emerald-500/30 bg-emerald-500/5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs font-bold text-foreground truncate">{recording?.name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {fmtDuration(elapsed)} · {eventCount} marcos
                    </p>
                  </div>
                </div>

                {/* Upload status */}
                {uploading && (
                  <div className="flex items-center gap-2 px-3 py-2 text-xs font-mono text-muted-foreground border border-border/30">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    Enviando vídeo ao servidor…
                  </div>
                )}

                {!uploading && uploadDone && (
                  <div className="flex items-center gap-2 px-3 py-2 border border-primary/30 bg-primary/5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    <div className="font-mono text-[11px]">
                      <span className="font-bold text-foreground">Vídeo no servidor</span>
                      {recording?.videoSize && (
                        <span className="text-muted-foreground ml-1">· {fmtBytes(recording.videoSize)}</span>
                      )}
                    </div>
                  </div>
                )}

                {!uploading && !uploadDone && videoBlob && (
                  <div className="flex items-center gap-2 px-3 py-2 border border-yellow-400/30 bg-yellow-400/5">
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                    <p className="font-mono text-[10px] text-yellow-400">
                      Upload falhou — use download local
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-2">
                  {videoBlob && (
                    <Button variant="outline" size="sm" onClick={downloadLocal}
                      className="w-full rounded-none font-mono text-[11px] uppercase tracking-widest">
                      <Download className="h-3.5 w-3.5 mr-2" />Download Local (.webm)
                    </Button>
                  )}

                  {uploadDone && (
                    <Button variant="outline" size="sm" onClick={openInEditor}
                      className="w-full rounded-none font-mono text-[11px] uppercase tracking-widest border-primary/40 text-primary hover:bg-primary/10">
                      <Video className="h-3.5 w-3.5 mr-2" />Editar no Editor de Vídeo
                      <ExternalLink className="h-3 w-3 ml-1.5 opacity-60" />
                    </Button>
                  )}

                  <Button variant="outline" size="sm" onClick={downloadZip}
                    className="w-full rounded-none font-mono text-[11px] uppercase tracking-widest">
                    <Download className="h-3.5 w-3.5 mr-2" />Exportar Timeline (.zip)
                  </Button>

                  <Button variant="ghost" size="sm" onClick={resetSession}
                    className="w-full rounded-none font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground">
                    <Trash2 className="h-3.5 w-3.5 mr-2" />Nova Sessão
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
