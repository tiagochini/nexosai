import { useState, useEffect, useRef, useCallback } from "react";
import { Circle, Pause, Play, Square, Download, Video, X, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

type RecordingState = "idle" | "recording" | "paused" | "stopped";

type Recording = {
  id: string;
  name: string;
  state: RecordingState;
  startedAt: string;
  stoppedAt?: string | null;
  totalPausedMs: number;
};

// ─── Utility ──────────────────────────────────────────────────────────────────

function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function calcActiveMs(rec: Recording): number {
  if (!rec.startedAt) return 0;
  const started = new Date(rec.startedAt).getTime();
  const end = rec.state === "stopped" && rec.stoppedAt ? new Date(rec.stoppedAt).getTime() : Date.now();
  const paused = rec.state === "paused" ? rec.totalPausedMs + (Date.now() - end) : rec.totalPausedMs;
  return Math.max(0, end - started - paused);
}

// ─── Name dialog ─────────────────────────────────────────────────────────────

function NameDialog({ onStart, onCancel }: { onStart: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(`Lançamento ${new Date().toLocaleDateString("pt-BR")}`);
  return (
    <div className="absolute bottom-full mb-3 right-0 w-80 border border-primary/40 bg-card/95 backdrop-blur-xl p-5 shadow-[0_0_30px_hsl(var(--primary)/0.2)]">
      <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-primary"></div>
      <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-primary"></div>
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-primary"></div>
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-primary"></div>

      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-destructive animate-pulse"></div>
        <span className="font-mono text-xs uppercase tracking-widest text-foreground font-bold">Iniciar Gravação</span>
      </div>
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-3">Nome do lançamento</p>
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && name.trim()) onStart(name.trim()); if (e.key === "Escape") onCancel(); }}
        className="w-full h-10 bg-background/50 border border-border/50 px-3 font-mono text-sm text-foreground focus:outline-none focus:border-primary transition-colors mb-4"
        placeholder="Nome do lançamento..."
      />
      <div className="flex gap-2">
        <button
          onClick={() => { if (name.trim()) onStart(name.trim()); }}
          className="flex-1 h-9 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-mono text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <Circle className="h-3 w-3 fill-current" /> Gravar
        </button>
        <button
          onClick={onCancel}
          className="h-9 px-4 border border-border/50 text-muted-foreground hover:text-foreground font-mono text-xs uppercase tracking-widest transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RecordButton() {
  const { workspace } = useAuth();
  const [state, setState] = useState<RecordingState>("idle");
  const [recording, setRecording] = useState<Recording | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showDialog, setShowDialog] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick every second when recording
  useEffect(() => {
    if (recording && (recording.state === "recording")) {
      timerRef.current = setInterval(() => {
        setElapsed(calcActiveMs(recording));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recording) setElapsed(calcActiveMs(recording));
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [recording]);

  const api = useCallback(async (path: string, method = "POST", body?: unknown) => {
    const token = localStorage.getItem("nexos_access_token");
    const res = await fetch(`/api/recordings${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }, []);

  const handleStart = useCallback(async (name: string) => {
    if (!workspace) return;
    setShowDialog(false);
    try {
      const data = await api("/", "POST", { name });
      setRecording(data.recording);
      setState("recording");
      setElapsed(0);
      setCollapsed(false);
      toast.success("Gravação iniciada", { description: `"${name}" — capturando o lançamento completo` });
    } catch {
      toast.error("Erro ao iniciar gravação");
    }
  }, [workspace, api]);

  const handlePause = useCallback(async () => {
    if (!recording) return;
    try {
      const data = await api(`/${recording.id}/pause`);
      setRecording(data.recording);
      setState("paused");
      toast.info("Gravação pausada", { description: "Aguardando abertura do carrinho..." });
    } catch { toast.error("Erro ao pausar gravação"); }
  }, [recording, api]);

  const handleResume = useCallback(async () => {
    if (!recording) return;
    try {
      const data = await api(`/${recording.id}/resume`);
      setRecording(data.recording);
      setState("recording");
      toast.success("Gravação retomada", { description: "Capturando resultados do carrinho..." });
    } catch { toast.error("Erro ao retomar gravação"); }
  }, [recording, api]);

  const handleStop = useCallback(async () => {
    if (!recording) return;
    try {
      const data = await api(`/${recording.id}/stop`);
      setRecording(data.recording);
      setState("stopped");
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed(calcActiveMs(data.recording));
      toast.success("Gravação encerrada", { description: "Clique em Baixar ZIP para exportar o lançamento completo" });
    } catch { toast.error("Erro ao encerrar gravação"); }
  }, [recording, api]);

  const handleDownload = useCallback(async () => {
    if (!recording) return;
    setDownloading(true);
    try {
      const token = localStorage.getItem("nexos_access_token");
      const res = await fetch(`/api/recordings/${recording.id}/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erro ao gerar ZIP");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const filename = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "nexos_lancamento.zip";
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("ZIP baixado com sucesso");
    } catch { toast.error("Erro ao baixar ZIP"); }
    finally { setDownloading(false); }
  }, [recording]);

  const handleDiscard = useCallback(() => {
    setRecording(null);
    setState("idle");
    setElapsed(0);
  }, []);

  // ── Idle: floating start button ─────────────────────────────────────────────
  if (state === "idle") {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        {showDialog && (
          <NameDialog onStart={handleStart} onCancel={() => setShowDialog(false)} />
        )}
        <button
          onClick={() => setShowDialog(v => !v)}
          className="flex items-center gap-2.5 border border-destructive/40 bg-card/90 backdrop-blur-xl px-4 py-2.5 text-destructive hover:border-destructive hover:bg-destructive/10 hover:shadow-[0_0_20px_hsl(var(--destructive)/0.3)] transition-all duration-200 group"
          title="Gravar Lançamento"
        >
          <Circle className="h-3.5 w-3.5 fill-destructive/30 group-hover:fill-destructive transition-colors" />
          <span className="font-mono text-xs uppercase tracking-widest font-bold">Gravar Lançamento</span>
        </button>
      </div>
    );
  }

  // ── Recording / Paused / Stopped: expanded widget ───────────────────────────

  const stateColor = state === "recording" ? "destructive" : state === "paused" ? "yellow-400" : "success";
  const stateLabel = state === "recording" ? "● REC" : state === "paused" ? "⏸ PAUSADO" : "■ ENCERRADO";

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className={`border ${
        state === "recording" ? "border-destructive/50 shadow-[0_0_20px_hsl(var(--destructive)/0.2)]" :
        state === "paused"    ? "border-yellow-400/40 shadow-[0_0_20px_rgba(250,204,21,0.15)]" :
                                "border-success/40 shadow-[0_0_20px_hsl(var(--success)/0.15)]"
      } bg-card/95 backdrop-blur-xl w-72 transition-all duration-200`}>

        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-2.5 border-b ${
          state === "recording" ? "border-destructive/30 bg-destructive/10" :
          state === "paused"    ? "border-yellow-400/20 bg-yellow-400/5" :
                                  "border-success/20 bg-success/10"
        }`}>
          <div className="flex items-center gap-2">
            {state === "recording" && <div className="w-2 h-2 rounded-full bg-destructive animate-pulse"></div>}
            <span className={`font-mono text-xs uppercase tracking-widest font-black ${
              state === "recording" ? "text-destructive" :
              state === "paused"    ? "text-yellow-400" : "text-success"
            }`}>{stateLabel}</span>
            {state !== "stopped" && (
              <span className="font-mono text-xs text-muted-foreground/70">{fmtElapsed(elapsed)}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCollapsed(v => !v)}
              className="text-muted-foreground/50 hover:text-muted-foreground transition-colors p-1"
            >
              <ChevronUp className={`h-3.5 w-3.5 transition-transform ${collapsed ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>

        {!collapsed && (
          <>
            {/* Name + elapsed */}
            <div className="px-4 py-3 border-b border-border/30">
              <div className="flex items-center gap-2 mb-1">
                <Video className="h-3.5 w-3.5 text-muted-foreground/50" />
                <p className="font-mono text-xs text-muted-foreground/70 uppercase tracking-widest truncate">
                  {recording?.name}
                </p>
              </div>
              {state === "stopped" && (
                <p className="font-mono text-xs text-foreground font-bold">
                  Duração: {fmtElapsed(elapsed)}
                </p>
              )}
              {state === "paused" && (
                <p className="font-mono text-xs text-yellow-400/70 mt-1">
                  Gravação pausada — aguardando abertura do carrinho
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="p-3 space-y-2">
              {state === "recording" && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handlePause}
                    className="h-9 border border-yellow-400/40 bg-yellow-400/5 text-yellow-400 hover:bg-yellow-400/15 font-mono text-[11px] uppercase tracking-widest font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Pause className="h-3 w-3" /> Pausar
                  </button>
                  <button
                    onClick={handleStop}
                    className="h-9 border border-border/40 text-muted-foreground hover:border-destructive/40 hover:text-destructive font-mono text-[11px] uppercase tracking-widest font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Square className="h-3 w-3" /> Encerrar
                  </button>
                </div>
              )}

              {state === "paused" && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleResume}
                    className="h-9 border border-success/40 bg-success/5 text-success hover:bg-success/15 font-mono text-[11px] uppercase tracking-widest font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Play className="h-3 w-3" /> Retomar
                  </button>
                  <button
                    onClick={handleStop}
                    className="h-9 border border-border/40 text-muted-foreground hover:border-destructive/40 hover:text-destructive font-mono text-[11px] uppercase tracking-widest font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Square className="h-3 w-3" /> Encerrar
                  </button>
                </div>
              )}

              {state === "stopped" && (
                <div className="space-y-2">
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="w-full h-10 bg-success hover:bg-success/90 text-success-foreground font-mono text-xs uppercase tracking-widest font-black flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {downloading ? "Gerando ZIP..." : "Baixar ZIP"}
                  </button>
                  <button
                    onClick={handleDiscard}
                    className="w-full h-8 border border-border/30 text-muted-foreground/50 hover:text-muted-foreground font-mono text-[11px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <X className="h-3 w-3" /> Descartar
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
