import { useState, useRef, useCallback, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Upload, Film, Scissors, Type, Download, Trash2, Plus, Play,
  ChevronUp, ChevronDown, Loader2, CheckCircle2, AlertCircle, X, Clock,
  Sparkles, Info, Brain, Zap, Star, Target, ChevronRight, RefreshCw,
} from "lucide-react";

const queryClient = new QueryClient();

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/../../api";

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function parseTimeInput(val: string): number {
  const parts = val.split(":").map(Number);
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + (parts[2] || 0);
  if (parts.length === 2) return parts[0]! * 60 + (parts[1] || 0);
  return Number(val) || 0;
}

function formatForInput(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface UploadedFile {
  fileId: string;
  originalName: string;
  duration: number;
  size: number;
  localUrl: string;
}

interface Clip {
  id: string;
  fileId: string;
  fileName: string;
  startTime: number;
  endTime: number;
  label: string;
}

interface Subtitle {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
}

interface SmartClip {
  fileId: string;
  startTime: number;
  endTime: number;
  label: string;
  scriptSection: string;
  score: number;
}

interface SmartMappingResult {
  clips: SmartClip[];
  summary: string;
  coverage: number;
}

type TranscriptStatus = "idle" | "loading" | "done" | "error";
type Step = "upload" | "smart" | "clips" | "subtitles" | "export";

const STEPS: { key: Step; label: string; icon: React.ReactNode }[] = [
  { key: "upload", label: "1. Upload", icon: <Upload className="w-4 h-4" /> },
  { key: "smart", label: "2. Smart Edit", icon: <Brain className="w-4 h-4" /> },
  { key: "clips", label: "3. Clipes", icon: <Scissors className="w-4 h-4" /> },
  { key: "subtitles", label: "4. Legendas", icon: <Type className="w-4 h-4" /> },
  { key: "export", label: "5. Exportar", icon: <Download className="w-4 h-4" /> },
];

function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 90
    ? "bg-chart-2/20 text-chart-2 border-chart-2/30"
    : score >= 70
      ? "bg-primary/20 text-primary border-primary/30"
      : "bg-chart-5/20 text-chart-5 border-chart-5/30";
  const label = score >= 90 ? "Excelente" : score >= 70 ? "Bom" : "Aceitável";
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold", color)}>
      <Star className="w-3 h-3" />
      {score} — {label}
    </span>
  );
}

function UploadZone({ onFilesUploaded }: { onFilesUploaded: (files: UploadedFile[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ name: string; done: boolean }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const fileArr = Array.from(files).filter(f => f.type.startsWith("video/"));
    if (fileArr.length === 0) return;

    setUploading(true);
    setUploadProgress(fileArr.map(f => ({ name: f.name, done: false })));

    const results: UploadedFile[] = [];
    for (let i = 0; i < fileArr.length; i++) {
      const file = fileArr[i]!;
      try {
        const fd = new FormData();
        fd.append("video", file);
        const res = await fetch(`${API_BASE}/video-editor/upload`, { method: "POST", body: fd });
        if (!res.ok) throw new Error("Upload falhou");
        const data = await res.json() as UploadedFile;
        results.push({ ...data, localUrl: URL.createObjectURL(file) });
        setUploadProgress(prev => prev.map((p, idx) => idx === i ? { ...p, done: true } : p));
      } catch {
        setUploadProgress(prev => prev.map((p, idx) => idx === i ? { ...p, done: true } : p));
      }
    }

    setUploading(false);
    setUploadProgress([]);
    if (results.length > 0) onFilesUploaded(results);
  }, [onFilesUploaded]);

  return (
    <div
      className={cn(
        "relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200",
        dragging
          ? "border-primary bg-primary/10 scale-[1.01]"
          : "border-border hover:border-primary/50 hover:bg-card"
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); void uploadFiles(e.dataTransfer.files); }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && void uploadFiles(e.target.files)}
      />
      {uploading ? (
        <div className="space-y-3">
          <Loader2 className="w-10 h-10 mx-auto text-primary animate-spin" />
          <p className="text-sm font-medium text-foreground">Enviando vídeos…</p>
          <div className="space-y-1 max-w-xs mx-auto">
            {uploadProgress.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                {p.done
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-chart-2 flex-shrink-0" />
                  : <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />}
                <span className="truncate">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto">
            <Film className="w-8 h-8 text-primary" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">Arraste vídeos aqui</p>
            <p className="text-sm text-muted-foreground mt-1">ou clique para selecionar • MP4, MOV, WebM, MKV</p>
          </div>
          <p className="text-xs text-muted-foreground">Máx. 500 MB por arquivo</p>
        </div>
      )}
    </div>
  );
}

function VideoPreview({ url, currentTime, onTimeUpdate }: { url: string; currentTime?: number; onTimeUpdate?: (t: number) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && currentTime !== undefined) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);
  return (
    <video
      ref={videoRef}
      src={url}
      controls
      className="w-full rounded-lg bg-black"
      onTimeUpdate={() => videoRef.current && onTimeUpdate?.(videoRef.current.currentTime)}
    />
  );
}

function ClipRow({
  clip, index, total, files, onUpdate, onRemove, onMoveUp, onMoveDown,
}: {
  clip: Clip; index: number; total: number; files: UploadedFile[];
  onUpdate: (id: string, changes: Partial<Clip>) => void;
  onRemove: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const file = files.find(f => f.fileId === clip.fileId);
  const duration = clip.endTime - clip.startTime;

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex flex-col gap-1 mt-0.5">
            <button onClick={() => onMoveUp(clip.id)} disabled={index === 0}
              className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-20 hover:bg-muted transition-colors">
              <ChevronUp className="w-4 h-4" />
            </button>
            <button onClick={() => onMoveDown(clip.id)} disabled={index === total - 1}
              className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-20 hover:bg-muted transition-colors">
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-xs font-bold text-primary">{index + 1}</span>
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <input type="text" value={clip.label}
                onChange={e => onUpdate(clip.id, { label: e.target.value })}
                placeholder="Nome do clipe (opcional)"
                className="flex-1 min-w-0 bg-muted border border-input rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <select value={clip.fileId}
                onChange={e => {
                  const newFile = files.find(f => f.fileId === e.target.value);
                  onUpdate(clip.id, { fileId: e.target.value, fileName: newFile?.originalName ?? "", endTime: newFile?.duration ?? 0, startTime: 0 });
                }}
                className="bg-muted border border-input rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {files.map(f => <option key={f.fileId} value={f.fileId}>{f.originalName}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Início (mm:ss)</span>
                <div className="flex items-center gap-2">
                  <input type="text" value={formatForInput(clip.startTime)}
                    onChange={e => { const t = parseTimeInput(e.target.value); if (!isNaN(t) && t < clip.endTime) onUpdate(clip.id, { startTime: Math.floor(t) }); }}
                    placeholder="00:00"
                    className="flex-1 bg-muted border border-input rounded-lg px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <span className="text-xs text-muted-foreground">{formatTime(clip.startTime)}</span>
                </div>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Fim (mm:ss)</span>
                <div className="flex items-center gap-2">
                  <input type="text" value={formatForInput(clip.endTime)}
                    onChange={e => { const t = parseTimeInput(e.target.value); if (!isNaN(t) && t > clip.startTime) onUpdate(clip.id, { endTime: Math.floor(t) }); }}
                    placeholder={file ? formatForInput(file.duration) : "00:00"}
                    className="flex-1 bg-muted border border-input rounded-lg px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <span className="text-xs text-muted-foreground">{formatTime(clip.endTime)}</span>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span>Duração: <span className="text-foreground font-medium">{formatTime(duration > 0 ? duration : 0)}</span></span>
                {file && <span className="text-muted-foreground/60">/ {formatTime(file.duration)} total</span>}
              </div>
              <button onClick={() => setShowPreview(v => !v)}
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
                <Play className="w-3 h-3" />
                {showPreview ? "Ocultar" : "Pré-visualizar"}
              </button>
            </div>
          </div>

          <button onClick={() => onRemove(clip.id)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors mt-0.5">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showPreview && file && (
        <div className="border-t border-card-border p-4 bg-black/30">
          <VideoPreview url={file.localUrl} currentTime={clip.startTime} />
        </div>
      )}
    </div>
  );
}

function SubtitleRow({ sub, index, onUpdate, onRemove }: {
  sub: Subtitle; index: number;
  onUpdate: (id: string, changes: Partial<Subtitle>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-xs font-bold text-muted-foreground">{index + 1}</span>
        </div>
        <div className="flex-1 space-y-3">
          <textarea value={sub.text} onChange={e => onUpdate(sub.id, { text: e.target.value })}
            placeholder="Texto da legenda…" rows={2}
            className="w-full bg-muted border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Aparecer em (mm:ss)</span>
              <input type="text" value={formatForInput(sub.startTime)}
                onChange={e => { const t = parseTimeInput(e.target.value); if (!isNaN(t)) onUpdate(sub.id, { startTime: Math.floor(t) }); }}
                className="w-full bg-muted border border-input rounded-lg px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Sumir em (mm:ss)</span>
              <input type="text" value={formatForInput(sub.endTime)}
                onChange={e => { const t = parseTimeInput(e.target.value); if (!isNaN(t)) onUpdate(sub.id, { endTime: Math.floor(t) }); }}
                className="w-full bg-muted border border-input rounded-lg px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
          </div>
        </div>
        <button onClick={() => onRemove(sub.id)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors mt-0.5">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function VideoEditorOnboarding() {
  const [visible, setVisible] = useState(() => {
    try { return !localStorage.getItem("nexos_video_editor_seen"); } catch { return true; }
  });
  if (!visible) return null;
  return (
    <div className="border border-primary/20 bg-primary/5 rounded-xl p-4 relative">
      <button onClick={() => { setVisible(false); try { localStorage.setItem("nexos_video_editor_seen", "1"); } catch {} }}
        className="absolute top-3 right-3 text-muted-foreground/40 hover:text-muted-foreground">
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">O que você pode fazer aqui</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-2">
            {[
              { icon: Brain, text: "Smart Edit: cole o roteiro, IA monta a edição automaticamente" },
              { icon: Film, text: "Importe vários takes (MP4, MOV, WebM, MKV)" },
              { icon: Scissors, text: "Defina clipes com pontos de corte precisos por mm:ss" },
              { icon: Sparkles, text: "Gere legendas com IA (Whisper) em 1 clique" },
              { icon: Type, text: "Adicione ou edite legendas manualmente com timing" },
              { icon: Download, text: "Exporte o vídeo final em MP4 ou WebM" },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-center gap-2">
                <Icon className="w-3 h-3 text-primary/60 shrink-0" />
                <span className="text-xs text-muted-foreground">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function VideoEditor() {
  const [step, setStep] = useState<Step>("upload");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [outputFormat, setOutputFormat] = useState<"mp4" | "webm">("mp4");
  const [aiGenerating, setAiGenerating] = useState(false);

  // Smart Edit state
  const [smartScript, setSmartScript] = useState("");
  const [smartTranscriptStatus, setSmartTranscriptStatus] = useState<Record<string, TranscriptStatus>>({});
  const [smartMapping, setSmartMapping] = useState<SmartMappingResult | null>(null);
  const [smartMappingLoading, setSmartMappingLoading] = useState(false);
  const [smartError, setSmartError] = useState<string | null>(null);

  // Export state
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<{
    status: "processing" | "done" | "failed";
    progress: number;
    resultFileId?: string;
    resultFileName?: string;
    error?: string;
  } | null>(null);
  const [processing, setProcessing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleFilesUploaded = useCallback((newFiles: UploadedFile[]) => {
    setFiles(prev => {
      const merged = [...prev];
      for (const f of newFiles) {
        if (!merged.find(x => x.fileId === f.fileId)) merged.push(f);
      }
      return merged;
    });
    setSmartTranscriptStatus(prev => {
      const next = { ...prev };
      for (const f of newFiles) next[f.fileId] = "idle";
      return next;
    });
    setStep("smart");
  }, []);

  const addClip = useCallback(() => {
    if (files.length === 0) return;
    const f = files[0]!;
    setClips(prev => [...prev, {
      id: crypto.randomUUID(), fileId: f.fileId, fileName: f.originalName,
      startTime: 0, endTime: f.duration, label: "",
    }]);
  }, [files]);

  const updateClip = useCallback((id: string, changes: Partial<Clip>) => {
    setClips(prev => prev.map(c => c.id === id ? { ...c, ...changes } : c));
  }, []);

  const removeClip = useCallback((id: string) => {
    setClips(prev => prev.filter(c => c.id !== id));
  }, []);

  const moveClip = useCallback((id: string, dir: "up" | "down") => {
    setClips(prev => {
      const idx = prev.findIndex(c => c.id === id);
      if (idx === -1) return prev;
      const newArr = [...prev];
      const target = dir === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= newArr.length) return prev;
      [newArr[idx], newArr[target]] = [newArr[target]!, newArr[idx]!];
      return newArr;
    });
  }, []);

  const addSubtitle = useCallback(() => {
    const lastEnd = subtitles[subtitles.length - 1]?.endTime ?? 0;
    setSubtitles(prev => [...prev, { id: crypto.randomUUID(), text: "", startTime: lastEnd, endTime: lastEnd + 3 }]);
  }, [subtitles]);

  const updateSubtitle = useCallback((id: string, changes: Partial<Subtitle>) => {
    setSubtitles(prev => prev.map(s => s.id === id ? { ...s, ...changes } : s));
  }, []);

  const removeSubtitle = useCallback((id: string) => {
    setSubtitles(prev => prev.filter(s => s.id !== id));
  }, []);

  const removeFile = useCallback(async (fileId: string) => {
    setFiles(prev => prev.filter(f => f.fileId !== fileId));
    setClips(prev => prev.filter(c => c.fileId !== fileId));
    setSmartTranscriptStatus(prev => { const next = { ...prev }; delete next[fileId]; return next; });
    try { await fetch(`${API_BASE}/video-editor/files/${fileId}`, { method: "DELETE" }); } catch {}
  }, []);

  // ── Smart Edit functions ──────────────────────────────────────────────────

  const transcribeSingleFile = useCallback(async (fileId: string) => {
    setSmartTranscriptStatus(prev => ({ ...prev, [fileId]: "loading" }));
    try {
      const res = await fetch(`${API_BASE}/video-editor/transcribe/${fileId}`, { method: "POST" });
      if (!res.ok) throw new Error("Falha na transcrição");
      setSmartTranscriptStatus(prev => ({ ...prev, [fileId]: "done" }));
    } catch {
      setSmartTranscriptStatus(prev => ({ ...prev, [fileId]: "error" }));
    }
  }, []);

  const transcribeAllFiles = useCallback(async () => {
    setSmartError(null);
    const toTranscribe = files.filter(f =>
      smartTranscriptStatus[f.fileId] === "idle" || smartTranscriptStatus[f.fileId] === "error"
    );
    await Promise.all(toTranscribe.map(f => transcribeSingleFile(f.fileId)));
  }, [files, smartTranscriptStatus, transcribeSingleFile]);

  const runSmartEdit = useCallback(async () => {
    if (!smartScript.trim()) {
      setSmartError("Cole o roteiro completo do CPL antes de continuar.");
      return;
    }
    const allDone = files.every(f => smartTranscriptStatus[f.fileId] === "done");
    if (!allDone) {
      setSmartError("Transcreva todos os takes primeiro.");
      return;
    }
    setSmartMappingLoading(true);
    setSmartError(null);
    setSmartMapping(null);
    try {
      const res = await fetch(`${API_BASE}/video-editor/smart-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: files.map(f => f.fileId), script: smartScript }),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error);
      }
      const data = await res.json() as SmartMappingResult;
      setSmartMapping(data);
    } catch (err) {
      setSmartError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setSmartMappingLoading(false);
    }
  }, [files, smartScript, smartTranscriptStatus]);

  const applySmartMapping = useCallback(() => {
    if (!smartMapping) return;
    const newClips: Clip[] = smartMapping.clips.map(sc => {
      const fileInfo = files.find(f => f.fileId === sc.fileId);
      return {
        id: crypto.randomUUID(),
        fileId: sc.fileId,
        fileName: fileInfo?.originalName ?? sc.fileId,
        startTime: sc.startTime,
        endTime: sc.endTime,
        label: sc.label,
      };
    });
    setClips(newClips);
    setStep("clips");
  }, [smartMapping, files]);

  // ── Subtitle AI generation ────────────────────────────────────────────────

  const generateSubtitlesWithAI = useCallback(async () => {
    const firstFile = files[0];
    if (!firstFile) return;
    setAiGenerating(true);
    try {
      const vid = document.createElement("video");
      vid.src = firstFile.localUrl;
      vid.preload = "metadata";
      await new Promise(r => { vid.onloadedmetadata = r; vid.onerror = r; });
      const stream = (vid as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.();
      let audioBlob: Blob | null = null;
      if (stream) {
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
          const audioStream = new MediaStream(audioTracks);
          const mr = new MediaRecorder(audioStream);
          const chunks: Blob[] = [];
          mr.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
          await new Promise<void>(res => {
            mr.onstop = () => res();
            mr.start();
            void vid.play();
            setTimeout(() => { mr.stop(); vid.pause(); }, Math.min((vid.duration || 60) * 1000, 90_000));
          });
          audioBlob = new Blob(chunks, { type: "audio/webm" });
        }
      }
      if (!audioBlob || audioBlob.size < 1000) {
        const response = await fetch(firstFile.localUrl);
        audioBlob = await response.blob();
      }
      const reader = new FileReader();
      const audioBase64: string = await new Promise(r => {
        reader.onload = e => r(e.target?.result as string);
        reader.readAsDataURL(audioBlob!);
      });
      const token = localStorage.getItem("nexos_access_token");
      const res = await fetch(`${API_BASE}/agents/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ audioBase64, mimeType: "audio/webm" }),
      });
      if (!res.ok) throw new Error("Transcrição falhou");
      const data = await res.json() as { text: string };
      const text = data.text?.trim();
      if (!text) throw new Error("Sem texto retornado");
      const words = text.split(" ");
      const chunkSize = Math.max(6, Math.ceil(words.length / Math.max(1, Math.floor(firstFile.duration / 5))));
      const newSubs: Subtitle[] = [];
      for (let i = 0; i < words.length; i += chunkSize) {
        const chunk = words.slice(i, i + chunkSize).join(" ");
        const start = Math.floor((i / words.length) * firstFile.duration);
        const end = Math.min(start + 5, firstFile.duration);
        newSubs.push({ id: crypto.randomUUID(), text: chunk, startTime: start, endTime: end });
      }
      setSubtitles(newSubs);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao gerar legendas com IA");
    } finally {
      setAiGenerating(false);
    }
  }, [files]);

  // ── Export ────────────────────────────────────────────────────────────────

  const startProcessing = useCallback(async () => {
    if (clips.length === 0) return;
    setProcessing(true);
    setJobStatus(null);
    setJobId(null);
    try {
      const res = await fetch(`${API_BASE}/video-editor/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clips: clips.map(c => ({ fileId: c.fileId, startTime: c.startTime, endTime: c.endTime, label: c.label })),
          subtitles: subtitles.filter(s => s.text.trim()),
          outputFormat,
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error);
      }
      const { jobId: id } = await res.json() as { jobId: string };
      setJobId(id);
      setJobStatus({ status: "processing", progress: 0 });
    } catch (err) {
      setJobStatus({ status: "failed", progress: 0, error: err instanceof Error ? err.message : "Erro desconhecido." });
      setProcessing(false);
    }
  }, [clips, subtitles, outputFormat]);

  useEffect(() => {
    if (!jobId) return;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/video-editor/jobs/${jobId}`);
        const data = await res.json() as typeof jobStatus;
        setJobStatus(data);
        if (data && (data.status === "done" || data.status === "failed")) {
          clearInterval(pollRef.current!);
          setProcessing(false);
        }
      } catch {}
    }, 1500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId]);

  const totalDuration = clips.reduce((acc, c) => acc + Math.max(0, c.endTime - c.startTime), 0);

  const allTranscribed = files.length > 0 && files.every(f => smartTranscriptStatus[f.fileId] === "done");
  const anyTranscribing = files.some(f => smartTranscriptStatus[f.fileId] === "loading");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Film className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground tracking-tight">NexOS Video Editor</h1>
              <p className="text-xs text-muted-foreground">Smart Edit com IA · Corte · Legendas · Exportação</p>
            </div>
          </div>
          {files.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Film className="w-3.5 h-3.5" />
              <span>{files.length} arquivo{files.length !== 1 ? "s" : ""}</span>
              {clips.length > 0 && (
                <>
                  <span className="mx-1">·</span>
                  <Scissors className="w-3.5 h-3.5" />
                  <span>{clips.length} clipe{clips.length !== 1 ? "s" : ""}</span>
                  {totalDuration > 0 && (
                    <>
                      <span className="mx-1">·</span>
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatTime(totalDuration)}</span>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Navigation */}
        <nav className="flex items-center gap-1 bg-card border border-card-border rounded-xl p-1">
          {STEPS.map((s) => {
            const active = step === s.key;
            const isClickable =
              s.key === "upload" ||
              (s.key === "smart" && files.length > 0) ||
              (s.key === "clips" && files.length > 0) ||
              (s.key === "subtitles" && clips.length > 0) ||
              (s.key === "export" && clips.length > 0);
            return (
              <button key={s.key} onClick={() => isClickable && setStep(s.key)} disabled={!isClickable}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : isClickable
                      ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                      : "text-muted-foreground/40 cursor-not-allowed"
                )}
              >
                {s.icon}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ── STEP: Upload ── */}
        {step === "upload" && (
          <div className="space-y-6">
            <VideoEditorOnboarding />
            <UploadZone onFilesUploaded={handleFilesUploaded} />
            {files.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Arquivos carregados</h3>
                <div className="space-y-2">
                  {files.map(f => (
                    <div key={f.fileId} className="flex items-center gap-3 bg-card border border-card-border rounded-xl p-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                        <Film className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{f.originalName}</p>
                        <p className="text-xs text-muted-foreground">{formatTime(f.duration)} · {(f.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                      <button onClick={() => void removeFile(f.fileId)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <UploadZone onFilesUploaded={handleFilesUploaded} />
                <button onClick={() => setStep("smart")}
                  className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                  <Brain className="w-4 h-4" />
                  Continuar para Smart Edit →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── STEP: Smart Edit ── */}
        {step === "smart" && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-primary" />
                  </div>
                  <h2 className="text-base font-semibold text-foreground">Smart Edit com IA</h2>
                  <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-semibold">Exclusivo NexOS</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Cole o roteiro do CPL. A IA transcreve todos os takes, identifica o melhor trecho para cada cena e monta a edição completa automaticamente.
                </p>
              </div>
              <button onClick={() => setStep("clips")}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 whitespace-nowrap shrink-0 mt-1">
                Edição manual
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* Differentials */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Target, title: "Mapeamento semântico", desc: "Compara o roteiro com a transcrição de cada take" },
                { icon: Star, title: "Pontuação por take", desc: "Score 0–100 por completude, fluência e aderência" },
                { icon: Zap, title: "Montagem 1 clique", desc: "Sequência completa gerada e aplicada automaticamente" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-card border border-card-border rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold text-foreground">{title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>

            {/* Script input */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                Roteiro do CPL
                <span className="text-xs text-muted-foreground font-normal">— cole o texto completo que você vai falar</span>
              </label>
              <textarea
                value={smartScript}
                onChange={e => setSmartScript(e.target.value)}
                placeholder="Ex: Olá, tudo bem? Hoje eu quero te mostrar o método que eu usei para fazer meu primeiro lançamento de 6 dígitos em 7 dias..."
                rows={8}
                className="w-full bg-muted border border-input rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none font-mono leading-relaxed"
              />
              <p className="text-xs text-muted-foreground">
                {smartScript.trim().split(/\s+/).filter(Boolean).length} palavras
                {smartScript.trim().length > 0 && ` · ~${Math.ceil(smartScript.trim().split(/\s+/).length / 130)} min estimado`}
              </p>
            </div>

            {/* Takes transcription status */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Takes para transcrever</h3>
                <button
                  onClick={() => void transcribeAllFiles()}
                  disabled={anyTranscribing || allTranscribed}
                  className="flex items-center gap-1.5 py-1.5 px-3 border border-primary/40 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  {anyTranscribing
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Transcrevendo…</>
                    : allTranscribed
                      ? <><CheckCircle2 className="w-3.5 h-3.5" /> Todos transcritos</>
                      : <><Sparkles className="w-3.5 h-3.5" /> Transcrever todos</>}
                </button>
              </div>
              <div className="space-y-2">
                {files.map(f => {
                  const status = smartTranscriptStatus[f.fileId] ?? "idle";
                  return (
                    <div key={f.fileId} className="flex items-center gap-3 bg-card border border-card-border rounded-xl p-3">
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                        status === "done" ? "bg-chart-2/15" : status === "error" ? "bg-destructive/10" : status === "loading" ? "bg-primary/15" : "bg-muted"
                      )}>
                        {status === "done" ? <CheckCircle2 className="w-4 h-4 text-chart-2" />
                          : status === "error" ? <AlertCircle className="w-4 h-4 text-destructive" />
                            : status === "loading" ? <Loader2 className="w-4 h-4 text-primary animate-spin" />
                              : <Film className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{f.originalName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(f.duration)} · {status === "done" ? "Transcrito ✓" : status === "loading" ? "Transcrevendo via Whisper…" : status === "error" ? "Erro — clique para tentar novamente" : "Aguardando transcrição"}
                        </p>
                      </div>
                      {(status === "idle" || status === "error") && (
                        <button onClick={() => void transcribeSingleFile(f.fileId)}
                          className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors">
                          {status === "error" ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Error */}
            {smartError && (
              <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                <p className="text-sm text-destructive">{smartError}</p>
              </div>
            )}

            {/* Montar button */}
            {!smartMapping && (
              <button
                onClick={() => void runSmartEdit()}
                disabled={smartMappingLoading || !allTranscribed || smartScript.trim().length < 20}
                className="w-full py-3.5 px-6 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
              >
                {smartMappingLoading
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> IA montando a edição…</>
                  : <><Brain className="w-5 h-5" /> Montar edição com IA</>}
              </button>
            )}

            {/* Mapping results */}
            {smartMapping && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Edição gerada pela IA</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{smartMapping.summary} · cobertura {smartMapping.coverage ?? "—"}%</p>
                  </div>
                  <button onClick={() => { setSmartMapping(null); void runSmartEdit(); }}
                    className="flex items-center gap-1.5 py-1.5 px-3 border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
                    <RefreshCw className="w-3 h-3" />
                    Remontar
                  </button>
                </div>

                <div className="space-y-2">
                  {smartMapping.clips.map((clip, i) => {
                    const fileInfo = files.find(f => f.fileId === clip.fileId);
                    const dur = clip.endTime - clip.startTime;
                    return (
                      <div key={i} className="bg-card border border-card-border rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-bold text-primary">{i + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-foreground">{clip.label}</span>
                              <ScoreBadge score={clip.score} />
                            </div>
                            <p className="text-xs text-muted-foreground italic">"{clip.scriptSection}…"</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground/70">{fileInfo?.originalName ?? clip.fileId}</span>
                              <span className="font-mono">{formatTime(clip.startTime)} → {formatTime(clip.endTime)}</span>
                              <span>({formatTime(dur)})</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button onClick={applySmartMapping}
                  className="w-full py-3.5 px-6 bg-chart-2 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Aplicar esta montagem e continuar
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── STEP: Clips (manual) ── */}
        {step === "clips" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Defina os clipes</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Ajuste manualmente os pontos de corte. Use o Smart Edit para montar automaticamente.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setStep("smart")}
                  className="flex items-center gap-1.5 py-2 px-3 border border-primary/40 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors">
                  <Brain className="w-3.5 h-3.5" />
                  Smart Edit
                </button>
                <button onClick={addClip}
                  className="flex items-center gap-2 py-2 px-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                  <Plus className="w-4 h-4" />
                  <span>Clipe</span>
                </button>
              </div>
            </div>

            {clips.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-border rounded-xl px-6">
                <Scissors className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm font-semibold text-foreground mb-1">Nenhum clipe ainda</p>
                <p className="text-sm text-muted-foreground mb-4">Use o Smart Edit para montar automaticamente, ou clique em "+ Clipe" para definir manualmente</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left max-w-lg mx-auto">
                  {[
                    { s: "1", text: "Clique em + Clipe", sub: "Escolha o arquivo de origem" },
                    { s: "2", text: "Defina Início e Fim", sub: "Use mm:ss — ex: 01:30 a 02:45" },
                    { s: "3", text: "Pré-visualize e ordene", sub: "Arraste ↑↓ para reordenar" },
                  ].map(({ s, text, sub }) => (
                    <div key={s} className="flex items-start gap-2.5 bg-muted/30 rounded-lg p-3">
                      <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{s}</span>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{text}</p>
                        <p className="text-[11px] text-muted-foreground">{sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {clips.map((clip, i) => (
                  <ClipRow key={clip.id} clip={clip} index={i} total={clips.length} files={files}
                    onUpdate={updateClip} onRemove={removeClip}
                    onMoveUp={(id) => moveClip(id, "up")}
                    onMoveDown={(id) => moveClip(id, "down")}
                  />
                ))}
              </div>
            )}

            {clips.length > 0 && (
              <div className="flex items-center justify-between pt-2">
                <div className="text-sm text-muted-foreground">
                  Duração total: <span className="text-foreground font-semibold">{formatTime(totalDuration)}</span>
                </div>
                <button onClick={() => setStep("subtitles")}
                  className="py-2.5 px-5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:opacity-90 transition-opacity">
                  Continuar →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── STEP: Subtitles ── */}
        {step === "subtitles" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Legendas</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Opcional. Adicione manualmente ou gere automaticamente com IA (Whisper).
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {files.length > 0 && (
                  <button onClick={() => void generateSubtitlesWithAI()} disabled={aiGenerating}
                    className="flex items-center gap-1.5 py-2 px-3 border border-primary/40 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
                    title="Transcreve o áudio do vídeo via Whisper e gera legendas automáticas">
                    {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>{aiGenerating ? "Gerando…" : "Gerar com IA"}</span>
                  </button>
                )}
                <button onClick={addSubtitle}
                  className="flex items-center gap-2 py-2 px-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                  <Plus className="w-4 h-4" />
                  <span>Manual</span>
                </button>
              </div>
            </div>

            {subtitles.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
                <Type className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Sem legendas. Você pode pular esta etapa.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {subtitles.map((sub, i) => (
                  <SubtitleRow key={sub.id} sub={sub} index={i} onUpdate={updateSubtitle} onRemove={removeSubtitle} />
                ))}
              </div>
            )}

            <div className="flex items-center justify-end pt-2 gap-3">
              <button onClick={() => setStep("export")}
                className="py-2.5 px-5 bg-muted text-foreground rounded-xl font-medium text-sm hover:bg-accent transition-colors">
                Pular →
              </button>
              <button onClick={() => setStep("export")} disabled={subtitles.length === 0}
                className="py-2.5 px-5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
                Continuar com Legendas →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: Export ── */}
        {step === "export" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-foreground">Exportar vídeo</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Revise a composição e inicie o processamento FFmpeg.</p>
            </div>

            <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Resumo da composição</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{clips.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Clipes</p>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{formatTime(totalDuration)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Duração total</p>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{subtitles.filter(s => s.text.trim()).length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Legendas</p>
                </div>
              </div>

              <div className="space-y-2">
                {clips.map((clip, i) => {
                  const file = files.find(f => f.fileId === clip.fileId);
                  return (
                    <div key={clip.id} className="flex items-center gap-3 text-sm">
                      <span className="w-6 h-6 rounded bg-primary/15 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <span className="text-foreground truncate flex-1">{clip.label || file?.originalName || "Sem nome"}</span>
                      <span className="text-muted-foreground font-mono text-xs">{formatTime(clip.startTime)} → {formatTime(clip.endTime)}</span>
                      <span className="text-muted-foreground text-xs">({formatTime(clip.endTime - clip.startTime)})</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Configurações de saída</h3>
              <div className="flex gap-3">
                {(["mp4", "webm"] as const).map(fmt => (
                  <button key={fmt} onClick={() => setOutputFormat(fmt)}
                    className={cn(
                      "flex-1 py-2.5 px-4 rounded-lg border text-sm font-medium transition-all",
                      outputFormat === fmt
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    )}>
                    .{fmt}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">H.264/AAC para compatibilidade máxima (MP4) ou VP9/Opus para web-first (WebM).</p>
            </div>

            {!processing && !jobStatus && (
              <button onClick={() => void startProcessing()} disabled={clips.length === 0}
                className="w-full py-3.5 px-6 bg-primary text-primary-foreground rounded-xl font-semibold text-base hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2">
                <Film className="w-5 h-5" />
                Processar e Exportar
              </button>
            )}

            {(processing || jobStatus) && (
              <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
                {jobStatus?.status === "processing" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                      <span className="text-sm font-medium text-foreground">Processando com FFmpeg…</span>
                      <span className="ml-auto text-sm font-mono text-primary">{jobStatus.progress}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: `${jobStatus.progress}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">Concatenando clipes, aplicando legendas e codificando com libx264…</p>
                  </div>
                )}

                {jobStatus?.status === "done" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-chart-2" />
                      <span className="text-sm font-semibold text-foreground">Vídeo pronto!</span>
                    </div>
                    <a href={`${API_BASE}/video-editor/files/${jobStatus.resultFileId}?download=1`}
                      download={jobStatus.resultFileName}
                      className="flex items-center justify-center gap-2 w-full py-3 px-6 bg-chart-2/15 border border-chart-2/30 text-chart-2 rounded-xl font-semibold text-sm hover:bg-chart-2/25 transition-colors">
                      <Download className="w-5 h-5" />
                      Baixar {jobStatus.resultFileName}
                    </a>
                    <button onClick={() => { setJobId(null); setJobStatus(null); setProcessing(false); }}
                      className="w-full py-2.5 px-4 bg-muted text-muted-foreground rounded-xl text-sm hover:bg-accent hover:text-foreground transition-colors">
                      Processar novamente
                    </button>
                  </div>
                )}

                {jobStatus?.status === "failed" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-destructive" />
                      <span className="text-sm font-semibold text-destructive">Falha no processamento</span>
                    </div>
                    {jobStatus.error && (
                      <p className="text-xs text-muted-foreground bg-muted rounded-lg p-3 font-mono">{jobStatus.error}</p>
                    )}
                    <button onClick={() => { setJobId(null); setJobStatus(null); setProcessing(false); }}
                      className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
                      Tentar novamente
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <VideoEditor />
    </QueryClientProvider>
  );
}
