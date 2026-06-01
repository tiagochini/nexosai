import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Video, Upload, Trash2, Edit2, RefreshCw,
  Clock, HardDrive, CheckCircle2, Plus,
  Film, ChevronRight, Camera, Play, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Recording {
  id: string;
  name: string;
  state: "recording" | "paused" | "stopped";
  videoPath?: string;
  videoSize?: number;
  duration?: number;
  campaignId?: string;
  createdAt: string;
}

function statusLabel(rec: Recording) {
  if (rec.state === "stopped" && rec.videoPath) return { label: "Pronto", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" };
  if (rec.state === "stopped") return { label: "Sem vídeo", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" };
  if (rec.state === "paused")  return { label: "Pausada",   color: "bg-orange-500/15 text-orange-400 border-orange-500/20" };
  return { label: "Gravando", color: "bg-blue-500/15 text-blue-400 border-blue-500/20" };
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function useApiAuth() {
  const token = typeof window !== "undefined" ? localStorage.getItem("nexos_token") : "";
  return (path: string, opts?: RequestInit) =>
    fetch(`/api${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(opts?.headers ?? {}),
      },
    }).then((r) => {
      if (!r.ok) throw new Error(`API ${path} → ${r.status}`);
      return r.json();
    });
}

// ── Video Preview Modal ────────────────────────────────────────────────────────
function VideoPreviewModal({ rec, token, onClose }: { rec: Recording; token: string; onClose: () => void }) {
  const streamUrl = `/api/recordings/${rec.id}/video-stream?token=${encodeURIComponent(token)}`;
  return (
    <div className="fixed inset-0 z-[8000] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-3xl mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-card border border-border/50 px-4 py-3 rounded-t-xl">
          <div>
            <div className="font-mono text-sm font-bold">{rec.name}</div>
            {rec.videoSize && (
              <div className="font-mono text-xs text-muted-foreground">{formatBytes(rec.videoSize)}{rec.duration ? ` · ${formatDuration(rec.duration)}` : ""}</div>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <video
          src={streamUrl}
          controls
          autoPlay
          className="w-full rounded-b-xl bg-black max-h-[60vh] object-contain"
        />
      </div>
    </div>
  );
}

export default function RecordingsPage() {
  const [, navigate] = useLocation();
  const api = useApiAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewRec, setPreviewRec] = useState<Recording | null>(null);

  const token = typeof window !== "undefined" ? (localStorage.getItem("nexos_token") ?? "") : "";

  const { data, isLoading } = useQuery({
    queryKey: ["/api/recordings"],
    queryFn: () => api("/recordings") as Promise<{ recordings: Recording[] }>,
    refetchInterval: 15_000,
  });

  const recordings = data?.recordings ?? [];

  async function handleUpload() {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const createRes = await fetch("/api/recordings", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: uploadFile.name }),
      });
      if (!createRes.ok) throw new Error("Erro ao criar gravação");
      const { recording } = await createRes.json() as { recording: Recording };

      const uploadRes = await fetch(`/api/recordings/${recording.id}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: uploadFile,
      });
      if (!uploadRes.ok) throw new Error("Erro ao enviar vídeo");
      setUploadFile(null);
      void qc.invalidateQueries({ queryKey: ["/api/recordings"] });
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  }

  async function deleteRecording(id: string) {
    setDeletingId(id);
    try {
      await api(`/recordings/${id}`, { method: "DELETE" });
      void qc.invalidateQueries({ queryKey: ["/api/recordings"] });
    } catch { } finally { setDeletingId(null); }
  }

  return (
    <div className="min-h-screen bg-background">
      {previewRec && (
        <VideoPreviewModal rec={previewRec} token={token} onClose={() => setPreviewRec(null)} />
      )}

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-mono text-2xl font-bold tracking-tight">Gravações</h1>
            <p className="font-mono text-sm text-muted-foreground mt-1">
              Seus vídeos gravados para edição com IA no modo híbrido
            </p>
          </div>
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="font-mono">
            <Plus className="h-4 w-4 mr-2" />
            Nova Gravação
          </Button>
        </div>

        {/* Upload area */}
        <div
          className={cn(
            "border-2 border-dashed border-border/40 rounded-xl p-8 text-center transition-colors cursor-pointer",
            "hover:border-primary/40 hover:bg-primary/5 group",
            uploadFile && "border-primary/60 bg-primary/5",
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,.webm,.mp4,.mov,.avi"
            className="hidden"
            onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
          />
          {uploadFile ? (
            <div className="space-y-3">
              <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
              <div className="font-mono text-base font-bold">{uploadFile.name}</div>
              <div className="font-mono text-sm text-muted-foreground">
                {formatBytes(uploadFile.size)} · Clique para trocar
              </div>
              <Button
                onClick={e => { e.stopPropagation(); void handleUpload(); }}
                disabled={uploading}
                className="font-mono mt-2"
              >
                {uploading
                  ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Enviando…</>
                  : <><Upload className="h-4 w-4 mr-2" />Enviar Gravação</>
                }
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-10 w-10 text-muted-foreground/40 mx-auto group-hover:text-primary transition-colors" />
              <div className="font-mono text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                Clique para selecionar ou arraste um vídeo aqui
              </div>
              <div className="font-mono text-xs text-muted-foreground/60">MP4, MOV, WebM — até 2GB</div>
            </div>
          )}
        </div>

        {/* Recordings grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : recordings.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <Film className="h-12 w-12 text-muted-foreground/30 mx-auto" />
            <div className="font-mono text-sm text-muted-foreground">Nenhuma gravação ainda</div>
            <div className="font-mono text-xs text-muted-foreground/60">
              Grave seus vídeos seguindo o roteiro do NexOS e faça upload aqui para edição com IA
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {recordings.length} gravação{recordings.length !== 1 ? "ões" : ""}
            </div>
            {recordings.map(rec => {
              const { label, color } = statusLabel(rec);
              const hasVideo = rec.state === "stopped" && rec.videoPath;
              return (
                <div
                  key={rec.id}
                  className="border border-border/40 rounded-xl p-5 bg-background/60 hover:bg-background/80 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Thumbnail / Play button */}
                    <button
                      className={cn(
                        "shrink-0 w-20 h-14 rounded-lg bg-muted/30 border border-border/30 flex items-center justify-center relative group/thumb overflow-hidden",
                        hasVideo && "cursor-pointer hover:border-primary/50",
                      )}
                      disabled={!hasVideo}
                      onClick={() => hasVideo && setPreviewRec(rec)}
                      title={hasVideo ? "Pré-visualizar vídeo" : undefined}
                    >
                      {hasVideo ? (
                        <>
                          <Camera className="h-6 w-6 text-primary/60 transition-opacity group-hover/thumb:opacity-0" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity bg-primary/10">
                            <Play className="h-7 w-7 text-primary fill-primary" />
                          </div>
                        </>
                      ) : (
                        <Video className="h-6 w-6 text-muted-foreground/30" />
                      )}
                    </button>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-mono text-sm font-bold truncate">{rec.name}</div>
                        <Badge variant="outline" className={cn("font-mono text-[10px] shrink-0", color)}>
                          {label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground flex-wrap">
                        {rec.videoSize && (
                          <span className="flex items-center gap-1">
                            <HardDrive className="h-3 w-3" />
                            {formatBytes(rec.videoSize)}
                          </span>
                        )}
                        {rec.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(rec.duration)}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(rec.createdAt).toLocaleDateString("pt-BR", {
                            day: "2-digit", month: "short", year: "numeric",
                          })}
                        </span>
                        {hasVideo && (
                          <button
                            className="flex items-center gap-1 text-primary/60 hover:text-primary transition-colors"
                            onClick={() => setPreviewRec(rec)}
                          >
                            <Play className="h-3 w-3" />
                            Preview
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {hasVideo && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="font-mono text-xs"
                          onClick={() => navigate(`/video-editor?recordingId=${rec.id}`)}
                        >
                          <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                          Editar
                        </Button>
                      )}
                      {rec.state === "stopped" && rec.campaignId && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="font-mono text-xs"
                          onClick={() => navigate(`/video-production`)}
                        >
                          <ChevronRight className="h-3.5 w-3.5 mr-1" />
                          Projeto
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-400"
                        disabled={deletingId === rec.id}
                        onClick={() => void deleteRecording(rec.id)}
                      >
                        {deletingId === rec.id
                          ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />
                        }
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CTA to video production */}
        <div className="border border-border/30 rounded-xl p-5 bg-background/40 flex items-center justify-between">
          <div>
            <div className="font-mono text-sm font-bold">Modo Híbrido</div>
            <div className="font-mono text-xs text-muted-foreground mt-1">
              Crie um projeto de vídeo, grave seguindo o roteiro e edite aqui com IA
            </div>
          </div>
          <Button
            variant="outline"
            className="font-mono text-sm shrink-0"
            onClick={() => navigate("/video-production")}
          >
            <Film className="h-4 w-4 mr-2" />
            Produção de Vídeo
          </Button>
        </div>
      </div>
    </div>
  );
}
