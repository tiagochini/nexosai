import { useState, useRef, useCallback, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Upload, Film, Scissors, Type, Download, Trash2, Plus, Play,
  ChevronUp, ChevronDown, Loader2, CheckCircle2, AlertCircle, X, Clock
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
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
  if (parts.length === 2) return parts[0] * 60 + (parts[1] || 0);
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

type Step = "upload" | "clips" | "subtitles" | "export";

const STEPS: { key: Step; label: string; icon: React.ReactNode }[] = [
  { key: "upload", label: "1. Upload", icon: <Upload className="w-4 h-4" /> },
  { key: "clips", label: "2. Clipes", icon: <Scissors className="w-4 h-4" /> },
  { key: "subtitles", label: "3. Legendas", icon: <Type className="w-4 h-4" /> },
  { key: "export", label: "4. Exportar", icon: <Download className="w-4 h-4" /> },
];

function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
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
      const file = fileArr[i];
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
  clip,
  index,
  total,
  files,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  clip: Clip;
  index: number;
  total: number;
  files: UploadedFile[];
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
            <button
              onClick={() => onMoveUp(clip.id)}
              disabled={index === 0}
              className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-20 hover:bg-muted transition-colors"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => onMoveDown(clip.id)}
              disabled={index === total - 1}
              className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-20 hover:bg-muted transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-xs font-bold text-primary">{index + 1}</span>
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={clip.label}
                onChange={e => onUpdate(clip.id, { label: e.target.value })}
                placeholder="Nome do clipe (opcional)"
                className="flex-1 min-w-0 bg-muted border border-input rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <select
                value={clip.fileId}
                onChange={e => {
                  const newFile = files.find(f => f.fileId === e.target.value);
                  onUpdate(clip.id, { fileId: e.target.value, fileName: newFile?.originalName ?? "", endTime: newFile?.duration ?? 0, startTime: 0 });
                }}
                className="bg-muted border border-input rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {files.map(f => (
                  <option key={f.fileId} value={f.fileId}>{f.originalName}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Início (mm:ss)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={formatForInput(clip.startTime)}
                    onChange={e => {
                      const t = parseTimeInput(e.target.value);
                      if (!isNaN(t) && t < clip.endTime) onUpdate(clip.id, { startTime: Math.floor(t) });
                    }}
                    placeholder="00:00"
                    className="flex-1 bg-muted border border-input rounded-lg px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <span className="text-xs text-muted-foreground">{formatTime(clip.startTime)}</span>
                </div>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground font-medium">Fim (mm:ss)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={formatForInput(clip.endTime)}
                    onChange={e => {
                      const t = parseTimeInput(e.target.value);
                      if (!isNaN(t) && t > clip.startTime) onUpdate(clip.id, { endTime: Math.floor(t) });
                    }}
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
                {file && (
                  <span className="text-muted-foreground/60">/ {formatTime(file.duration)} total</span>
                )}
              </div>
              <button
                onClick={() => setShowPreview(v => !v)}
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
              >
                <Play className="w-3 h-3" />
                {showPreview ? "Ocultar" : "Pré-visualizar"}
              </button>
            </div>
          </div>

          <button
            onClick={() => onRemove(clip.id)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors mt-0.5"
          >
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

function SubtitleRow({
  sub,
  index,
  onUpdate,
  onRemove,
}: {
  sub: Subtitle;
  index: number;
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
          <textarea
            value={sub.text}
            onChange={e => onUpdate(sub.id, { text: e.target.value })}
            placeholder="Texto da legenda…"
            rows={2}
            className="w-full bg-muted border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Aparecer em (mm:ss)</span>
              <input
                type="text"
                value={formatForInput(sub.startTime)}
                onChange={e => {
                  const t = parseTimeInput(e.target.value);
                  if (!isNaN(t)) onUpdate(sub.id, { startTime: Math.floor(t) });
                }}
                className="w-full bg-muted border border-input rounded-lg px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground font-medium">Sumir em (mm:ss)</span>
              <input
                type="text"
                value={formatForInput(sub.endTime)}
                onChange={e => {
                  const t = parseTimeInput(e.target.value);
                  if (!isNaN(t)) onUpdate(sub.id, { endTime: Math.floor(t) });
                }}
                className="w-full bg-muted border border-input rounded-lg px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
          </div>
        </div>
        <button
          onClick={() => onRemove(sub.id)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors mt-0.5"
        >
          <X className="w-4 h-4" />
        </button>
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
    const firstNew = newFiles[0];
    if (firstNew) {
      const newClip: Clip = {
        id: crypto.randomUUID(),
        fileId: firstNew.fileId,
        fileName: firstNew.originalName,
        startTime: 0,
        endTime: firstNew.duration,
        label: "",
      };
      setClips(prev => [...prev, newClip]);
    }
    setStep("clips");
  }, []);

  const addClip = useCallback(() => {
    if (files.length === 0) return;
    const f = files[0];
    setClips(prev => [...prev, {
      id: crypto.randomUUID(),
      fileId: f.fileId,
      fileName: f.originalName,
      startTime: 0,
      endTime: f.duration,
      label: "",
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
      [newArr[idx], newArr[target]] = [newArr[target], newArr[idx]];
      return newArr;
    });
  }, []);

  const addSubtitle = useCallback(() => {
    const lastEnd = subtitles[subtitles.length - 1]?.endTime ?? 0;
    setSubtitles(prev => [...prev, {
      id: crypto.randomUUID(),
      text: "",
      startTime: lastEnd,
      endTime: lastEnd + 3,
    }]);
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
    try {
      await fetch(`${API_BASE}/video-editor/files/${fileId}`, { method: "DELETE" });
    } catch {}
  }, []);

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
              <p className="text-xs text-muted-foreground">Montagem de vídeo com FFmpeg</p>
            </div>
          </div>
          {files.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Film className="w-3.5 h-3.5" />
              <span>{files.length} arquivo{files.length !== 1 ? "s" : ""}</span>
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
            </div>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <nav className="flex items-center gap-1 bg-card border border-card-border rounded-xl p-1">
          {STEPS.map((s) => {
            const active = step === s.key;
            const isClickable =
              s.key === "upload" ||
              (s.key === "clips" && files.length > 0) ||
              (s.key === "subtitles" && clips.length > 0) ||
              (s.key === "export" && clips.length > 0);
            return (
              <button
                key={s.key}
                onClick={() => isClickable && setStep(s.key)}
                disabled={!isClickable}
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

        {step === "upload" && (
          <div className="space-y-6">
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
                        <p className="text-xs text-muted-foreground">
                          {formatTime(f.duration)} · {(f.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                      </div>
                      <button
                        onClick={() => void removeFile(f.fileId)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="pt-2 flex gap-3">
                  <UploadZone onFilesUploaded={handleFilesUploaded} />
                </div>
                <button
                  onClick={() => setStep("clips")}
                  className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:opacity-90 transition-opacity"
                >
                  Continuar para Clipes →
                </button>
              </div>
            )}
          </div>
        )}

        {step === "clips" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Defina os clipes</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Escolha o arquivo, o ponto de início e o ponto de corte. Use o preview para ajustar com precisão.
                </p>
              </div>
              <button
                onClick={addClip}
                className="flex items-center gap-2 py-2 px-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                <span>Clipe</span>
              </button>
            </div>

            {clips.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
                <Scissors className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum clipe ainda. Clique em "+ Clipe" para adicionar.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {clips.map((clip, i) => (
                  <ClipRow
                    key={clip.id}
                    clip={clip}
                    index={i}
                    total={clips.length}
                    files={files}
                    onUpdate={updateClip}
                    onRemove={removeClip}
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
                <button
                  onClick={() => setStep("subtitles")}
                  className="py-2.5 px-5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:opacity-90 transition-opacity"
                >
                  Continuar →
                </button>
              </div>
            )}
          </div>
        )}

        {step === "subtitles" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Legendas</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Opcional. Adicione legendas com tempo relativo ao vídeo final concatenado.
                </p>
              </div>
              <button
                onClick={addSubtitle}
                className="flex items-center gap-2 py-2 px-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                <span>Legenda</span>
              </button>
            </div>

            {subtitles.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
                <Type className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Sem legendas. Você pode pular esta etapa.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {subtitles.map((sub, i) => (
                  <SubtitleRow
                    key={sub.id}
                    sub={sub}
                    index={i}
                    onUpdate={updateSubtitle}
                    onRemove={removeSubtitle}
                  />
                ))}
              </div>
            )}

            <div className="flex items-center justify-end pt-2 gap-3">
              <button
                onClick={() => setStep("export")}
                className="py-2.5 px-5 bg-muted text-foreground rounded-xl font-medium text-sm hover:bg-accent transition-colors"
              >
                Pular →
              </button>
              <button
                onClick={() => setStep("export")}
                disabled={subtitles.length === 0}
                className="py-2.5 px-5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                Continuar com Legendas →
              </button>
            </div>
          </div>
        )}

        {step === "export" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-foreground">Exportar vídeo</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Revise a composição e inicie o processamento FFmpeg.
              </p>
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
                      <span className="w-6 h-6 rounded bg-primary/15 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-foreground truncate flex-1">
                        {clip.label || file?.originalName || "Sem nome"}
                      </span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {formatTime(clip.startTime)} → {formatTime(clip.endTime)}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        ({formatTime(clip.endTime - clip.startTime)})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Configurações de saída</h3>
              <div className="flex gap-3">
                {(["mp4", "webm"] as const).map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => setOutputFormat(fmt)}
                    className={cn(
                      "flex-1 py-2.5 px-4 rounded-lg border text-sm font-medium transition-all",
                      outputFormat === fmt
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    )}
                  >
                    .{fmt}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                H.264/AAC para compatibilidade máxima (MP4) ou VP9/Opus para web-first (WebM).
              </p>
            </div>

            {!processing && !jobStatus && (
              <button
                onClick={() => void startProcessing()}
                disabled={clips.length === 0}
                className="w-full py-3.5 px-6 bg-primary text-primary-foreground rounded-xl font-semibold text-base hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
              >
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
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-500"
                        style={{ width: `${jobStatus.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Concatenando clipes, aplicando legendas e codificando com libx264…
                    </p>
                  </div>
                )}

                {jobStatus?.status === "done" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-chart-2" />
                      <span className="text-sm font-semibold text-foreground">Vídeo pronto!</span>
                    </div>
                    <a
                      href={`${API_BASE}/video-editor/files/${jobStatus.resultFileId}?download=1`}
                      download={jobStatus.resultFileName}
                      className="flex items-center justify-center gap-2 w-full py-3 px-6 bg-chart-2/15 border border-chart-2/30 text-chart-2 rounded-xl font-semibold text-sm hover:bg-chart-2/25 transition-colors"
                    >
                      <Download className="w-5 h-5" />
                      Baixar {jobStatus.resultFileName}
                    </a>
                    <button
                      onClick={() => {
                        setJobId(null);
                        setJobStatus(null);
                        setProcessing(false);
                      }}
                      className="w-full py-2.5 px-4 bg-muted text-muted-foreground rounded-xl text-sm hover:bg-accent hover:text-foreground transition-colors"
                    >
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
                    <button
                      onClick={() => {
                        setJobId(null);
                        setJobStatus(null);
                        setProcessing(false);
                      }}
                      className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                    >
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
