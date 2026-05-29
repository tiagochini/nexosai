/**
 * RecordButton — gravação de lançamento profissional.
 *
 * Fluxo:
 *   1. Clique em "Gravar" → abre diálogo de pré-voo (áudio, câmera, qualidade)
 *   2. Clique em "Iniciar" → contagem regressiva 3 · 2 · 1 · GO
 *   3. Gravação começa com todos os streams configurados
 *   4. Parar → download automático para o device + navega para o editor
 *
 * Capacidades:
 *   - Áudio: nenhum / apenas app / apenas mic / ambos (AudioContext mixing)
 *   - Câmera: overlay PiP fixo na tela (capturado dentro da gravação de tela)
 *   - Qualidade: até 4K 60fps (browser limita ao máximo disponível)
 *   - Marcadores de evento durante gravação
 *   - Upload automático ao servidor
 *   - Download .webm para galeria do device ao parar
 *   - Abertura automática no editor de vídeo NexOS
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Circle, Square, Pause, Play, Download, Minimize2, Maximize2,
  Radio, Tag, Video, CheckCircle2, XCircle, Mic,
  Monitor, AlertTriangle, Loader2, Trash2, Camera,
  Volume2, VolumeX, Settings2, Sparkles,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type RecordingState = "idle" | "countdown" | "recording" | "paused" | "stopped";
type AudioMode = "none" | "app" | "mic" | "both";
type QualityPreset = "auto" | "1080" | "4k";

interface RecordingMeta {
  id: string;
  name: string;
  state: "idle" | "recording" | "paused" | "stopped";
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
  metrics_snapshot: "Snapshot métricas",
  custom: "Evento personalizado",
};

const QUICK_EVENTS: EventType[] = [
  "briefing_started", "strategy_generated", "copy_generated",
  "approved", "cart_opened", "cart_closed", "metrics_snapshot",
];

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function calcActiveMs(rec: RecordingMeta): number {
  const started = new Date(rec.startedAt).getTime();
  const end = rec.stoppedAt ? new Date(rec.stoppedAt).getTime() : Date.now();
  let totalPaused = rec.totalPausedMs;
  if (rec.state === "paused" && rec.pausedAt) {
    totalPaused += Date.now() - new Date(rec.pausedAt).getTime();
  }
  return Math.max(0, end - started - totalPaused);
}

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

function triggerDeviceDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function uploadVideoToServer(blob: Blob, recordingId: string): Promise<void> {
  const token = localStorage.getItem("accessToken") || localStorage.getItem("nexos_access_token");
  const res = await fetch(`/api/recordings/${recordingId}/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "video/webm",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: blob,
  });
  if (!res.ok) throw new Error(`Upload falhou: ${await res.text().catch(() => "erro")}`);
}

// ── Pre-flight Setup Dialog ────────────────────────────────────────────────────

interface SetupConfig {
  sessionName: string;
  audioMode: AudioMode;
  enableCamera: boolean;
  quality: QualityPreset;
}

function AudioModeOption({
  value, current, label, icon, desc, onChange,
}: {
  value: AudioMode; current: AudioMode; label: string;
  icon: React.ReactNode; desc: string;
  onChange: (v: AudioMode) => void;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`flex items-start gap-3 p-3 border transition-all text-left ${
        active
          ? "border-primary/60 bg-primary/10 text-foreground"
          : "border-border/40 bg-card/20 text-muted-foreground hover:border-border/70 hover:bg-card/40"
      }`}
    >
      <div className={`mt-0.5 shrink-0 ${active ? "text-primary" : ""}`}>{icon}</div>
      <div>
        <div className={`font-mono text-[12px] uppercase tracking-widest font-bold ${active ? "text-primary" : ""}`}>
          {label}
        </div>
        <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">{desc}</div>
      </div>
      <div className={`ml-auto shrink-0 w-3.5 h-3.5 rounded-full border-2 mt-0.5 ${
        active ? "border-primary bg-primary" : "border-border/60"
      }`} />
    </button>
  );
}

function PreflightDialog({
  config, onConfig, onStart, onClose,
}: {
  config: SetupConfig;
  onConfig: (c: SetupConfig) => void;
  onStart: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg border border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 bg-card/60">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
            <span className="font-mono text-sm uppercase tracking-widest font-bold">Configurar Gravação</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <XCircle className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Session name */}
          <div>
            <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/70 block mb-2">
              Nome da Sessão
            </label>
            <input
              value={config.sessionName}
              onChange={e => onConfig({ ...config, sessionName: e.target.value })}
              placeholder={`Gravação ${new Date().toLocaleDateString("pt-BR")}`}
              autoFocus
              className="w-full border border-border/50 bg-card/40 px-3 py-2.5 text-sm font-mono
                text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none"
            />
          </div>

          {/* Audio mode */}
          <div>
            <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/70 block mb-2">
              Captura de Áudio
            </label>
            <div className="grid grid-cols-2 gap-2">
              <AudioModeOption value="both" current={config.audioMode}
                label="Ambos" icon={<Mic className="h-4 w-4" />}
                desc="App + microfone misturados"
                onChange={v => onConfig({ ...config, audioMode: v })} />
              <AudioModeOption value="mic" current={config.audioMode}
                label="Microfone" icon={<Mic className="h-4 w-4" />}
                desc="Somente seu microfone"
                onChange={v => onConfig({ ...config, audioMode: v })} />
              <AudioModeOption value="app" current={config.audioMode}
                label="App / Sistema" icon={<Volume2 className="h-4 w-4" />}
                desc="Áudio interno do sistema"
                onChange={v => onConfig({ ...config, audioMode: v })} />
              <AudioModeOption value="none" current={config.audioMode}
                label="Nenhum" icon={<VolumeX className="h-4 w-4" />}
                desc="Apenas vídeo, sem áudio"
                onChange={v => onConfig({ ...config, audioMode: v })} />
            </div>
          </div>

          {/* Camera + Quality row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Camera toggle */}
            <div>
              <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/70 block mb-2">
                Câmera (PiP)
              </label>
              <button
                type="button"
                onClick={() => onConfig({ ...config, enableCamera: !config.enableCamera })}
                className={`w-full flex items-center gap-3 p-3 border transition-all ${
                  config.enableCamera
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border/40 bg-card/20 text-muted-foreground hover:border-border/70"
                }`}
              >
                <Camera className="h-4 w-4 shrink-0" />
                <div className="text-left">
                  <div className="font-mono text-[12px] uppercase tracking-widest font-bold">
                    {config.enableCamera ? "Ativada" : "Desativada"}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground/60">Webcam no canto</div>
                </div>
                <div className={`ml-auto w-8 h-4 rounded-full transition-colors shrink-0 ${
                  config.enableCamera ? "bg-primary" : "bg-border/50"
                }`}>
                  <div className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform mt-0.5 ${
                    config.enableCamera ? "translate-x-4" : "translate-x-0.5"
                  }`} />
                </div>
              </button>
            </div>

            {/* Quality */}
            <div>
              <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/70 block mb-2">
                Qualidade
              </label>
              <div className="space-y-1.5">
                {(["auto", "1080", "4k"] as QualityPreset[]).map(q => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => onConfig({ ...config, quality: q })}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 border transition-all text-left ${
                      config.quality === q
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border/40 bg-card/20 text-muted-foreground hover:border-border/70"
                    }`}
                  >
                    {q === "4k" && <Sparkles className="h-3 w-3 shrink-0" />}
                    {q !== "4k" && <Settings2 className="h-3 w-3 shrink-0" />}
                    <span className="font-mono text-[11px] uppercase tracking-widest font-bold">
                      {q === "auto" ? "Auto" : q === "1080" ? "Full HD" : "4K Ultra"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Info note */}
          <p className="font-mono text-[10px] text-muted-foreground/50 leading-relaxed border border-border/20 bg-card/20 px-3 py-2">
            O browser pedirá para selecionar o que compartilhar (aba ou tela inteira).
            O vídeo é enviado ao servidor automaticamente e baixado para seu device ao parar.
          </p>

          {/* CTA */}
          <Button
            onClick={onStart}
            className="w-full h-12 rounded-none font-mono text-sm uppercase tracking-widest font-bold btn-weapon-primary"
          >
            <Circle className="h-4 w-4 mr-2 fill-current animate-pulse" />
            Iniciar Gravação →
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Countdown Overlay ──────────────────────────────────────────────────────────

function CountdownOverlay({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState<number | "GO">(3);

  useEffect(() => {
    const steps: Array<number | "GO"> = [3, 2, 1, "GO"];
    let idx = 0;
    const tick = () => {
      idx++;
      if (idx >= steps.length) { onDone(); return; }
      setCount(steps[idx]);
      setTimeout(tick, idx < steps.length - 1 ? 900 : 700);
    };
    const t = setTimeout(tick, 900);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isGo = count === "GO";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md pointer-events-none">
      <div className="text-center select-none">
        <div
          key={String(count)}
          className="font-mono font-black tabular-nums tracking-tighter"
          style={{
            fontSize: isGo ? "clamp(5rem,20vw,14rem)" : "clamp(6rem,25vw,18rem)",
            color: isGo ? "hsl(var(--primary))" : "white",
            textShadow: isGo
              ? "0 0 60px hsl(var(--primary)/0.8), 0 0 120px hsl(var(--primary)/0.4)"
              : "0 0 40px rgba(255,255,255,0.5)",
            animation: "countdown-pop 0.35s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          {count}
        </div>
        {!isGo && (
          <p className="font-mono text-xs uppercase tracking-[0.5em] text-white/40 mt-4">
            Gravação começa em
          </p>
        )}
        {isGo && (
          <p className="font-mono text-sm uppercase tracking-[0.5em] text-primary/80 mt-2">
            Gravando!
          </p>
        )}
      </div>

      <style>{`
        @keyframes countdown-pop {
          from { opacity: 0; transform: scale(1.5); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ── Webcam PiP Overlay ─────────────────────────────────────────────────────────

function WebcamPip({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  return (
    <div className="fixed bottom-24 right-6 z-[60] w-36 h-24 border-2 border-primary/60 shadow-2xl overflow-hidden bg-black">
      <video ref={videoRef} muted autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
      <div className="absolute bottom-1 left-1 flex items-center gap-1 bg-black/60 px-1.5 py-0.5">
        <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
        <span className="font-mono text-[9px] uppercase tracking-widest text-white/80">Cam</span>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function RecordButton({ campaignId }: { campaignId?: string }) {
  const { workspace } = useAuth();
  const [, setLocation] = useLocation();

  // ── UI State ───────────────────────────────────────────────────────────────
  const [uiState, setUiState]               = useState<RecordingState>("idle");
  const [open, setOpen]                     = useState(false);
  const [showSetup, setShowSetup]           = useState(false);
  const [minimized, setMinimized]           = useState(false);
  const [recording, setRecording]           = useState<RecordingMeta | null>(null);
  const [elapsed, setElapsed]               = useState(0);
  const [videoBlob, setVideoBlob]           = useState<Blob | null>(null);
  const [uploading, setUploading]           = useState(false);
  const [uploadDone, setUploadDone]         = useState(false);
  const [hasMic, setHasMic]                 = useState(false);
  const [hasSystem, setHasSystem]           = useState(false);
  const [hasCamera, setHasCamera]           = useState(false);
  const [eventCount, setEventCount]         = useState(0);
  const [lastEvent, setLastEvent]           = useState<string | null>(null);
  const [firingEvent, setFiringEvent]       = useState(false);
  const [syncLoading, setSyncLoading]       = useState(true);
  const [camStream, setCamStream]           = useState<MediaStream | null>(null);

  // Setup config
  const [config, setConfig] = useState<SetupConfig>({
    sessionName: "",
    audioMode: "both",
    enableCamera: false,
    quality: "auto",
  });

  // ── Refs ───────────────────────────────────────────────────────────────────
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const chunksRef         = useRef<Blob[]>([]);
  const displayStreamRef  = useRef<MediaStream | null>(null);
  const micStreamRef      = useRef<MediaStream | null>(null);
  const camStreamRef      = useRef<MediaStream | null>(null);
  const audioCtxRef       = useRef<AudioContext | null>(null);
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef      = useRef<RecordingMeta | null>(null);
  const pendingConfigRef  = useRef<SetupConfig | null>(null);

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
        const active = data.recordings.find(r => r.state === "recording" || r.state === "paused");
        if (active) {
          setRecording(active);
          recordingRef.current = active;
          setUiState(active.state);
          setElapsed(calcActiveMs(active));
          if (active.state === "recording") startTimer(active);
          toast.info(`Sessão "${active.name}" restaurada`, { duration: 3000 });
        }
      } catch { /* silently ignore */ }
      finally { if (!cancelled) setSyncLoading(false); }
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
      camStreamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close().catch(() => {});
    };
  }, [stopTimer]);

  // ── Video constraints by quality ──────────────────────────────────────────
  const getVideoConstraints = (q: QualityPreset): MediaTrackConstraints => {
    if (q === "4k") return { width: { ideal: 3840 }, height: { ideal: 2160 }, frameRate: { ideal: 60 } };
    if (q === "1080") return { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } };
    return { frameRate: { ideal: 60 } }; // auto — browser decides
  };

  // ── Open setup dialog ─────────────────────────────────────────────────────
  const openSetup = () => {
    setConfig({
      sessionName: "",
      audioMode: "both",
      enableCamera: false,
      quality: "auto",
    });
    setShowSetup(true);
    setOpen(false);
  };

  // ── Start countdown → then capture ────────────────────────────────────────
  const beginCountdown = (cfg: SetupConfig) => {
    pendingConfigRef.current = cfg;
    setShowSetup(false);
    setUiState("countdown");
  };

  // Called when countdown finishes (after GO)
  const handleCountdownDone = useCallback(() => {
    void startCapture(pendingConfigRef.current!);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Start capture ──────────────────────────────────────────────────────────
  const startCapture = async (cfg: SetupConfig) => {
    if (!workspace) { toast.error("Workspace não carregado"); setUiState("idle"); return; }
    const name = cfg.sessionName.trim() || `Gravação ${new Date().toLocaleString("pt-BR")}`;
    const videoConstraints = getVideoConstraints(cfg.quality);
    const needSystemAudio = cfg.audioMode === "app" || cfg.audioMode === "both";
    const needMic = cfg.audioMode === "mic" || cfg.audioMode === "both";

    // 1. Screen capture (with or without system audio)
    let displayStream: MediaStream;
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: videoConstraints,
        audio: needSystemAudio,
      });
      setHasSystem(displayStream.getAudioTracks().length > 0);
      displayStreamRef.current = displayStream;
    } catch {
      toast.error("Compartilhamento de tela cancelado ou negado.");
      setUiState("idle");
      return;
    }

    // 2. Microphone (if needed)
    let micStream: MediaStream | null = null;
    if (needMic) {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
        });
        micStreamRef.current = micStream;
        setHasMic(true);
      } catch {
        setHasMic(false);
        if (cfg.audioMode === "mic") {
          toast.warning("Microfone não disponível — gravando sem áudio.");
        } else {
          toast.warning("Microfone não disponível — gravando apenas áudio do sistema.");
        }
      }
    }

    // 3. Webcam PiP (if enabled)
    let cameraStream: MediaStream | null = null;
    if (cfg.enableCamera) {
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: false,
        });
        camStreamRef.current = cameraStream;
        setCamStream(cameraStream);
        setHasCamera(true);
      } catch {
        setHasCamera(false);
        toast.warning("Câmera não disponível — gravando sem overlay de câmera.");
      }
    }

    // 4. Audio mixing (if any audio)
    const audioStreams: MediaStream[] = [];
    if (cfg.audioMode !== "none") {
      if (needSystemAudio && displayStream.getAudioTracks().length > 0) audioStreams.push(displayStream);
      if (needMic && micStream) audioStreams.push(micStream);
    }

    let combinedVideoTrack = displayStream.getVideoTracks()[0];
    let mixedAudioTrack: MediaStreamTrack | null = null;

    if (audioStreams.length > 0) {
      const { mixed, ctx } = mixAudioStreams(audioStreams);
      audioCtxRef.current = ctx;
      mixedAudioTrack = mixed.getAudioTracks()[0] ?? null;
    }

    const combined = new MediaStream([
      ...(combinedVideoTrack ? [combinedVideoTrack] : []),
      ...(mixedAudioTrack ? [mixedAudioTrack] : []),
    ]);

    // 5. Create server session
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
      cameraStream?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close().catch(() => {});
      toast.error("Erro ao iniciar sessão no servidor.");
      setUiState("idle");
      return;
    }

    // 6. MediaRecorder — prefer best supported codec
    const mimeType =
      MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" :
      MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus") ? "video/webm;codecs=vp8,opus" :
      MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "";

    const mr = new MediaRecorder(combined, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: cfg.quality === "4k" ? 20_000_000 : cfg.quality === "1080" ? 8_000_000 : 4_000_000,
    });
    mediaRecorderRef.current = mr;
    chunksRef.current = [];

    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };

    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || "video/webm" });
      setVideoBlob(blob);

      // Auto-download to device gallery immediately
      const safeName = name.replace(/[^a-z0-9]/gi, "_").slice(0, 40);
      triggerDeviceDownload(blob, `${safeName}_${Date.now()}.webm`);
      toast.success("📥 Vídeo salvo na pasta Downloads do device.");

      // Upload to server
      const currentRec = recordingRef.current;
      if (currentRec) {
        setUploading(true);
        try {
          await uploadVideoToServer(blob, currentRec.id);
          setUploadDone(true);
          toast.success("Vídeo enviado ao servidor. Abrindo editor...", { duration: 3000 });
          // Auto-navigate to video editor
          setTimeout(() => {
            setLocation(`/video-editor?recordingId=${currentRec.id}`);
            setOpen(true);
          }, 2000);
        } catch {
          setUploadDone(false);
          toast.error("Upload ao servidor falhou — use o arquivo baixado localmente.");
        } finally {
          setUploading(false);
        }
      }

      // Clean up camera
      cameraStream?.getTracks().forEach(t => t.stop());
      camStreamRef.current = null;
      setCamStream(null);
    };

    // If user ends screen share via browser button
    displayStream.getVideoTracks()[0]?.addEventListener("ended", () => {
      void stopCapture(rec.id);
    });

    mr.start(2000);

    setRecording(rec);
    recordingRef.current = rec;
    setUiState("recording");
    setElapsed(0);
    setEventCount(0);
    setLastEvent(null);
    setVideoBlob(null);
    setUploadDone(false);
    startTimer(rec);
  };

  // ── Pause ──────────────────────────────────────────────────────────────────
  const pauseCapture = async () => {
    const rec = recordingRef.current;
    if (!rec || uiState !== "recording") return;
    mediaRecorderRef.current?.pause();
    try {
      const data = await customFetch<{ recording: RecordingMeta }>(`/api/recordings/${rec.id}/pause`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
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
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
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
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      setRecording(data.recording);
      recordingRef.current = data.recording;
      setElapsed(calcActiveMs(data.recording));
    } catch { /* best-effort */ }

    setUiState("stopped");
    setMinimized(false);
  };

  // ── Fire event marker ──────────────────────────────────────────────────────
  const fireEvent = async (type: EventType) => {
    const rec = recordingRef.current;
    if (!rec || rec.state === "stopped") return;
    setFiringEvent(true);
    try {
      await customFetch(`/api/recordings/${rec.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, phase: "geral" }),
      });
      setEventCount(c => c + 1);
      setLastEvent(EVENT_LABELS[type]);
    } catch { toast.error("Erro ao registrar evento"); }
    finally { setFiringEvent(false); }
  };

  // ── Downloads ──────────────────────────────────────────────────────────────
  const downloadLocal = () => {
    if (!videoBlob) return;
    const safeName = (recording?.name ?? "gravacao").replace(/[^a-z0-9]/gi, "_").slice(0, 40);
    triggerDeviceDownload(videoBlob, `${safeName}.webm`);
  };

  const downloadZip = () => {
    if (recording) window.open(`/api/recordings/${recording.id}/export`, "_blank");
  };

  const openInEditor = () => {
    if (recording) setLocation(`/video-editor?recordingId=${recording.id}`);
  };

  const resetSession = () => {
    setUiState("idle"); setRecording(null); recordingRef.current = null;
    setElapsed(0); setVideoBlob(null); setUploadDone(false);
    setEventCount(0); setLastEvent(null);
    setHasMic(false); setHasSystem(false); setHasCamera(false);
    setCamStream(null);
  };

  const hasActive = uiState === "recording" || uiState === "paused";

  // ── Countdown overlay ─────────────────────────────────────────────────────
  if (uiState === "countdown") {
    return <CountdownOverlay onDone={handleCountdownDone} />;
  }

  // ── Pre-flight setup dialog ───────────────────────────────────────────────
  if (showSetup) {
    return (
      <>
        {camStream && <WebcamPip stream={camStream} />}
        <PreflightDialog
          config={config}
          onConfig={setConfig}
          onStart={() => beginCountdown(config)}
          onClose={() => setShowSetup(false)}
        />
      </>
    );
  }

  return (
    <>
      {/* Webcam PiP during recording */}
      {hasActive && camStream && <WebcamPip stream={camStream} />}

      {/* ── Minimized pill ─────────────────────────────────────────────── */}
      {minimized && hasActive && (
        <button
          onClick={() => setMinimized(false)}
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-3 py-2 border
            text-xs font-mono uppercase tracking-widest shadow-lg transition-all
            ${uiState === "paused"
              ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-400"
              : "border-destructive/60 bg-destructive/10 text-destructive"}`}
        >
          <span className={`w-2 h-2 rounded-full ${uiState === "paused" ? "bg-yellow-400" : "bg-destructive animate-pulse"}`} />
          <span>{fmtDuration(elapsed)}</span>
          <Maximize2 className="h-3 w-3 opacity-60" />
        </button>
      )}

      {/* ── Idle pill ──────────────────────────────────────────────────── */}
      {!hasActive && uiState !== "stopped" && (
        <button
          onClick={openSetup}
          title="Iniciar Gravação de Lançamento"
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 border
            border-border/50 bg-card/90 text-muted-foreground hover:text-foreground
            hover:border-primary/40 hover:bg-card text-xs font-mono uppercase tracking-widest
            shadow-lg transition-all hover:shadow-primary/10"
        >
          <Circle className="h-3.5 w-3.5 text-destructive" />
          <span>Gravar</span>
        </button>
      )}

      {/* ── Active recording bar ────────────────────────────────────────── */}
      {uiState === "recording" && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center shadow-2xl border border-destructive/70
          bg-destructive/90 text-white font-mono text-xs uppercase tracking-widest">
          <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 px-3 py-2.5 hover:bg-white/10 transition-colors">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse shrink-0" />
            <span className="tabular-nums font-bold tracking-wider">{fmtDuration(elapsed)}</span>
          </button>
          <div className="w-px h-8 bg-white/20" />
          <button onClick={pauseCapture} className="flex items-center gap-1.5 px-3 py-2.5 hover:bg-white/10 transition-colors">
            <Pause className="h-3.5 w-3.5" /><span className="hidden sm:inline">Pausar</span>
          </button>
          <div className="w-px h-8 bg-white/20" />
          <button onClick={() => void stopCapture()} className="flex items-center gap-1.5 px-3 py-2.5 bg-black/20 hover:bg-black/40 transition-colors">
            <Square className="h-3.5 w-3.5 fill-current" /><span className="hidden sm:inline">Parar</span>
          </button>
        </div>
      )}

      {/* ── Paused bar ─────────────────────────────────────────────────── */}
      {uiState === "paused" && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center shadow-2xl border border-yellow-400/80
          bg-yellow-500/90 text-black font-mono text-xs uppercase tracking-widest">
          <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 px-3 py-2.5 hover:bg-black/10 transition-colors">
            <span className="w-2.5 h-2.5 rounded-full bg-black/60 shrink-0" />
            <span className="tabular-nums font-bold">{fmtDuration(elapsed)}</span>
          </button>
          <div className="w-px h-8 bg-black/20" />
          <button onClick={resumeCapture} className="flex items-center gap-1.5 px-3 py-2.5 hover:bg-black/10 transition-colors font-bold">
            <Play className="h-3.5 w-3.5 fill-current" /><span className="hidden sm:inline">Retomar</span>
          </button>
          <div className="w-px h-8 bg-black/20" />
          <button onClick={() => void stopCapture()} className="flex items-center gap-1.5 px-3 py-2.5 bg-black/20 hover:bg-black/30 transition-colors">
            <Square className="h-3.5 w-3.5 fill-current" /><span className="hidden sm:inline">Parar</span>
          </button>
        </div>
      )}

      {/* ── Panel (details/events + stopped actions) ────────────────────── */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] border border-border bg-background shadow-2xl">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/60">
            <div className="flex items-center gap-2">
              <Radio className={`h-4 w-4 ${hasActive ? "text-destructive" : "text-primary"}`} />
              <span className="font-mono text-xs uppercase tracking-widest font-bold">Gravação de Lançamento</span>
            </div>
            <div className="flex items-center gap-1">
              {hasActive && (
                <button onClick={() => { setMinimized(true); setOpen(false); }}
                  className="p-1.5 hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors" title="Minimizar">
                  <Minimize2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors">
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

            {/* ── RECORDING / PAUSED ─────────────────────────────────── */}
            {(uiState === "recording" || uiState === "paused") && (
              <div className="space-y-3">
                {/* Status */}
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

                {/* Active stream badges */}
                <div className="flex gap-1.5 flex-wrap">
                  {hasSystem && <Badge variant="outline" className="text-[10px] font-mono rounded-none border-emerald-500/40 text-emerald-400"><Monitor className="h-2.5 w-2.5 mr-1" />Sistema</Badge>}
                  {hasMic && <Badge variant="outline" className="text-[10px] font-mono rounded-none border-blue-500/40 text-blue-400"><Mic className="h-2.5 w-2.5 mr-1" />Microfone</Badge>}
                  {hasCamera && <Badge variant="outline" className="text-[10px] font-mono rounded-none border-primary/40 text-primary"><Camera className="h-2.5 w-2.5 mr-1" />Câmera</Badge>}
                  {!hasSystem && !hasMic && <Badge variant="outline" className="text-[10px] font-mono rounded-none border-yellow-400/40 text-yellow-400"><AlertTriangle className="h-2.5 w-2.5 mr-1" />Sem áudio</Badge>}
                  <Badge variant="outline" className="text-[10px] font-mono rounded-none border-border/40 text-muted-foreground"><Tag className="h-2.5 w-2.5 mr-1" />{eventCount} marcos</Badge>
                </div>

                {/* Quick events */}
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2">Marcar evento</p>
                  <div className="flex flex-wrap gap-1">
                    {QUICK_EVENTS.map(type => (
                      <button key={type} onClick={() => void fireEvent(type)} disabled={firingEvent}
                        className="text-[10px] font-mono px-2 py-1 border border-border/40 bg-card/40
                          hover:border-primary/40 hover:bg-primary/10 transition-all text-muted-foreground
                          hover:text-foreground disabled:opacity-40">
                        {EVENT_LABELS[type]}
                      </button>
                    ))}
                  </div>
                  {lastEvent && <p className="mt-1.5 text-[10px] font-mono text-primary/70">✓ {lastEvent}</p>}
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

            {/* ── STOPPED ─────────────────────────────────────────────── */}
            {uiState === "stopped" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-3 py-2.5 border border-emerald-500/30 bg-emerald-500/5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs font-bold text-foreground truncate">{recording?.name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{fmtDuration(elapsed)} · {eventCount} marcos</p>
                  </div>
                </div>

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
                      <span className="font-bold text-foreground">Salvo no servidor</span>
                      {recording?.videoSize && <span className="text-muted-foreground ml-1">· {fmtBytes(recording.videoSize)}</span>}
                    </div>
                  </div>
                )}

                {!uploading && !uploadDone && videoBlob && (
                  <div className="flex items-center gap-2 px-3 py-2 border border-yellow-400/30 bg-yellow-400/5">
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                    <p className="font-mono text-[10px] text-yellow-400">Upload falhou — use o download local</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Button variant="outline" size="sm" onClick={openInEditor}
                    className="w-full rounded-none font-mono text-[11px] uppercase tracking-widest border-primary/40 text-primary hover:bg-primary/10">
                    <Video className="h-3.5 w-3.5 mr-2" />Abrir no Editor de Vídeo NexOS
                  </Button>

                  {videoBlob && (
                    <Button variant="outline" size="sm" onClick={downloadLocal}
                      className="w-full rounded-none font-mono text-[11px] uppercase tracking-widest">
                      <Download className="h-3.5 w-3.5 mr-2" />Baixar para o Device (.webm)
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
