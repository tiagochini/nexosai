import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Video, Upload, Trash2, Edit2, RefreshCw,
  Clock, HardDrive, CheckCircle2, Plus,
  Film, ChevronRight, Camera, Play, X,
  Folder as FolderIcon, AlertCircle, AlertTriangle,
  Search, Check, FolderOpen, MoreVertical, Pencil, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { useUiText, useUiLocale, intlLocale } from "@/lib/i18n";

interface Folder {
  id: string;
  name: string;
  slug: string;
  isSystem: boolean;
  systemType: "automatic" | "manual" | null;
  createdAt: string;
  updatedAt: string;
}

interface Recording {
  id: string;
  name: string;
  state: "recording" | "paused" | "stopped";
  hasVideo: boolean;
  videoSize?: number;
  duration?: number;
  campaignId?: string;
  createdAt: string;
  folderId?: string;
  recordingMode?: "manual" | "automatic";
  finalizedAt?: string;
  finalizationStatus?: "pending" | "processing" | "ready" | "failed";
  finalizationError?: string;
}

function statusLabel(rec: Recording, t: ReturnType<typeof useUiText>) {
  if (rec.state === "stopped" && rec.finalizationStatus === "ready" && rec.hasVideo) return { label: t("Pronto", "Ready", "Listo"), color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" };
  if (rec.state === "stopped") return { label: t("Sem vídeo", "No video", "Sin vídeo"), color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" };
  if (rec.state === "paused")  return { label: t("Pausada", "Paused", "Pausada"), color: "bg-orange-500/15 text-orange-400 border-orange-500/20" };
  return { label: t("Gravando", "Recording", "Grabando"), color: "bg-blue-500/15 text-blue-400 border-blue-500/20" };
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

// ── Video Preview Modal ────────────────────────────────────────────────────────
function VideoPreviewModal({ rec, token, onClose }: { rec: Recording; token: string; onClose: () => void }) {
  const t = useUiText();
  const streamUrl = `/api/recordings/${rec.id}/video-stream?token=${encodeURIComponent(token)}`;
  return (
    <div className="fixed inset-0 z-[8000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative w-full max-w-4xl mx-auto flex flex-col max-h-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-card border border-border/50 px-4 py-3 rounded-t-xl shrink-0">
          <div>
            <div className="font-mono text-sm font-bold">{rec.name}</div>
            {rec.videoSize && (
              <div className="font-mono text-xs text-muted-foreground">{formatBytes(rec.videoSize)}{rec.duration ? ` · ${formatDuration(rec.duration)}` : ""}</div>
            )}
          </div>
          <button onClick={onClose} aria-label={t("Fechar preview", "Close preview", "Cerrar vista previa")} className="text-muted-foreground hover:text-foreground transition-colors p-1 bg-muted/30 rounded-md">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="bg-black/90 rounded-b-xl overflow-hidden relative flex-1 min-h-0 flex items-center justify-center">
          <video
            src={streamUrl}
            controls
            autoPlay
            className="w-full h-full object-contain max-h-[75vh]"
          />
        </div>
      </div>
    </div>
  );
}

export default function RecordingsPage() {
  const t = useUiText();
  const { locale } = useUiLocale();
  const numberLocale = intlLocale(locale);
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const retryInputRef = useRef<HTMLInputElement>(null);
  const token = typeof window !== "undefined" ? (localStorage.getItem("accessToken") ?? localStorage.getItem("nexos_token") ?? "") : "";

  const [selectedFolderId, setSelectedFolderId] = useState<string | "all">("all");
  const [search, setSearch] = useState("");

  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [previewRec, setPreviewRec] = useState<Recording | null>(null);

  // Folder Dialogs
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [folderName, setFolderName] = useState("");

  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // -- Queries --
  const { data: foldersData, isLoading: isLoadingFolders, error: foldersError, refetch: refetchFolders } = useQuery({
    queryKey: ["/api/recordings/folders"],
    queryFn: () => customFetch<{ folders: Folder[] }>("/api/recordings/folders"),
    refetchInterval: 60_000,
  });

  const { data: recordingsData, isLoading: isLoadingRecordings, error: recordingsError, refetch: refetchRecordings } = useQuery({
    queryKey: ["/api/recordings", selectedFolderId],
    queryFn: () => customFetch<{ recordings: Recording[] }>(`/api/recordings${selectedFolderId !== "all" ? `?folderId=${selectedFolderId}` : ""}`),
    refetchInterval: 15_000,
  });

  const folders = foldersData?.folders ?? [];
  const recordings = recordingsData?.recordings ?? [];

  const filteredRecordings = useMemo(() => {
    if (!search.trim()) return recordings;
    const lower = search.toLowerCase();
    return recordings.filter(r => r.name.toLowerCase().includes(lower));
  }, [recordings, search]);

  // -- Mutations --
  const saveFolderMut = useMutation({
    mutationFn: async (name: string) => {
      if (editingFolder) {
        return customFetch(`/api/recordings/folders/${editingFolder.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
      } else {
        return customFetch(`/api/recordings/folders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/recordings/folders"] });
      setFolderDialogOpen(false);
      toast.success(editingFolder ? t("Pasta renomeada", "Folder renamed", "Carpeta renombrada") : t("Pasta criada", "Folder created", "Carpeta creada"));
    },
    onError: () => toast.error(t("Erro ao salvar pasta", "Error saving folder", "Error al guardar la carpeta")),
  });

  const deleteFolderMut = useMutation({
    mutationFn: async (id: string) => {
      return customFetch(`/api/recordings/folders/${id}`, { method: "DELETE" });
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["/api/recordings/folders"] });
      if (selectedFolderId === id) setSelectedFolderId("all");
      setDeletingFolder(null);
      toast.success(t("Pasta excluída", "Folder deleted", "Carpeta eliminada"));
    },
    onError: () => toast.error(t("Erro ao excluir pasta", "Error deleting folder", "Error al eliminar la carpeta")),
  });

  // -- Actions --
  async function handleUpload() {
    if (!uploadFile) return;
    setUploading(true);
    try {
      // Manual uploads may use custom folders, but never the automatic system folder.
      const selectedFolder = selectedFolderId === "all"
        ? undefined
        : folders.find((folder) => folder.id === selectedFolderId);
      const manualFolder = folders.find((folder) => folder.systemType === "manual");
      const targetFolderId = selectedFolder && !selectedFolder.isSystem
        ? selectedFolder.id
        : manualFolder?.id;

      const createRes = await customFetch<{ recording: Recording }>("/api/recordings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: uploadFile.name,
          recordingMode: "manual",
          ...(targetFolderId ? { folderId: targetFolderId } : {})
        }),
      });

      const { recording } = createRes;

      const uploadRes = await fetch(`/api/recordings/${recording.id}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }, // customFetch handles auth, but fetch needs it
        body: uploadFile,
      });

      if (!uploadRes.ok) {
        throw new Error(await uploadRes.text().catch(() => t("Erro no upload", "Upload failed", "Error al subir el archivo")));
      }

      setUploadFile(null);
      void qc.invalidateQueries({ queryKey: ["/api/recordings"] });
      toast.success(t("Upload concluído com sucesso", "Upload completed successfully", "Carga completada correctamente"));
    } catch (e) {
      console.error(e);
      toast.error(t("Erro ao enviar vídeo: ", "Error uploading video: ", "Error al subir el vídeo: ") + (e instanceof Error ? e.message : t("Desconhecido", "Unknown error", "Error desconocido")));
    } finally {
      setUploading(false);
    }
  }

  async function deleteRecording(id: string) {
    setDeletingId(id);
    try {
      await customFetch(`/api/recordings/${id}`, { method: "DELETE" });
      qc.setQueriesData<{ recordings: Recording[] }>(
        { queryKey: ["/api/recordings"] },
        (current) => current
          ? { ...current, recordings: current.recordings.filter((recording) => recording.id !== id) }
          : current,
      );
      await qc.invalidateQueries({ queryKey: ["/api/recordings"] });
      toast.success(t("Gravação excluída", "Recording deleted", "Grabación eliminada"));
    } catch (e) {
      toast.error(t("Erro ao excluir gravação", "Error deleting recording", "Error al eliminar la grabación"));
    } finally {
      setDeletingId(null);
    }
  }

  async function retryRecordingUpload(file: File) {
    if (!retryingId) return;
    try {
      const response = await fetch(`/api/recordings/${retryingId}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": file.type || "video/webm",
        },
        body: file,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? t("Falha ao reenviar o arquivo", "Failed to re-upload file", "No se pudo volver a subir el archivo"));
      }
      await qc.invalidateQueries({ queryKey: ["/api/recordings"] });
      toast.success(t("Vídeo reenviado e salvo na pasta original", "Video re-uploaded and saved to the original folder", "Vídeo vuelto a subir y guardado en la carpeta original"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Falha ao reenviar o arquivo", "Failed to re-upload file", "No se pudo volver a subir el archivo"));
    } finally {
      setRetryingId(null);
      if (retryInputRef.current) retryInputRef.current.value = "";
    }
  }

  function openFolderDialog(folder?: Folder) {
    setEditingFolder(folder || null);
    setFolderName(folder ? folder.name : "");
    setFolderDialogOpen(true);
  }

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-background flex flex-col md:flex-row">
      {previewRec && (
        <VideoPreviewModal rec={previewRec} token={token} onClose={() => setPreviewRec(null)} />
      )}
      <input
        ref={retryInputRef}
        type="file"
        accept="video/*,.webm,.mp4,.mov,.avi"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void retryRecordingUpload(file);
        }}
      />

      {/* Sidebar Folders */}
      <aside className="w-full md:w-64 lg:w-72 border-b md:border-b-0 md:border-r border-border/50 bg-card/20 flex flex-col shrink-0">
        <div className="p-4 border-b border-border/50 flex items-center justify-between shrink-0">
          <h2 className="font-mono text-sm uppercase tracking-widest font-bold">{t("Pastas", "Folders", "Carpetas")}</h2>
          <Button variant="ghost" size="icon" aria-label={t("Nova pasta", "New folder", "Nueva carpeta")} className="h-8 w-8 text-muted-foreground" onClick={() => openFolderDialog()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-3 space-y-1 overflow-y-auto flex-1">
          <button
            onClick={() => setSelectedFolderId("all")}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-mono transition-colors",
              selectedFolderId === "all" ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            <div className="flex items-center gap-2">
              <FolderIcon className="h-4 w-4 shrink-0" />
              <span>{t("Todas as gravações", "All recordings", "Todas las grabaciones")}</span>
            </div>
          </button>

          {isLoadingFolders ? (
            <div className="py-4 flex justify-center"><RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : foldersError ? (
            <div className="py-4 px-3 text-xs font-mono text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> {t("Erro ao carregar pastas", "Error loading folders", "Error al cargar las carpetas")}
            </div>
          ) : (
            <>
              {folders.map(folder => (
                <div key={folder.id} className={cn(
                  "group flex items-center justify-between px-3 py-2 rounded-lg text-sm font-mono transition-colors",
                  selectedFolderId === folder.id ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}>
                  <button
                    className="flex-1 flex items-center gap-2 text-left truncate mr-2"
                    onClick={() => setSelectedFolderId(folder.id)}
                  >
                    {folder.isSystem ? <FolderOpen className="h-4 w-4 shrink-0 opacity-70" /> : <FolderIcon className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{folder.name}</span>
                  </button>

                  {!folder.isSystem && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button aria-label={t("Opções da pasta", "Folder options", "Opciones de carpeta")} className="opacity-0 group-hover:opacity-100 hover:text-foreground p-1 rounded-md hover:bg-background transition-all shrink-0">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="font-mono text-xs">
                        <DropdownMenuItem onClick={() => openFolderDialog(folder)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> {t("Renomear", "Rename", "Renombrar")}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-400 focus:text-red-400 focus:bg-red-400/10" onClick={() => setDeletingFolder(folder)}>
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> {t("Excluir", "Delete", "Eliminar")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 py-6 border-b border-border/50 flex flex-col sm:flex-row sm:items-end justify-between gap-4 shrink-0">
          <div>
            <h1 className="font-mono text-2xl font-bold tracking-tight">
              {selectedFolderId === "all" ? t("Todas as gravações", "All recordings", "Todas las grabaciones") : folders.find(f => f.id === selectedFolderId)?.name || t("Gravações", "Recordings", "Grabaciones")}
            </h1>
            <p className="font-mono text-sm text-muted-foreground mt-1">
              {t("Biblioteca de vídeos brutos e uploads", "Raw video and upload library", "Biblioteca de vídeos sin procesar y archivos subidos")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t("Buscar gravação...", "Search recordings...", "Buscar grabaciones...")}
                className="pl-9 w-full sm:w-64 font-mono text-sm bg-card/30"
              />
            </div>
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="font-mono shrink-0">
              <Plus className="h-4 w-4 mr-2" />
              {t("Upload", "Upload", "Subir")}
            </Button>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {/* Upload area */}
          <div
            className={cn(
              "border-2 border-dashed border-border/40 rounded-xl p-8 text-center transition-colors cursor-pointer",
              "hover:border-primary/40 hover:bg-primary/5 group",
              uploadFile && "border-primary/60 bg-primary/5",
              uploading && "pointer-events-none opacity-80"
            )}
            onClick={() => !uploading && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,.webm,.mp4,.mov,.avi"
              className="hidden"
              onChange={e => {
                if (e.target.files?.[0]) setUploadFile(e.target.files[0]);
                e.target.value = ''; // reset so same file can be chosen again
              }}
            />
            {uploadFile ? (
              <div className="space-y-3">
                <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
                <div className="font-mono text-base font-bold">{uploadFile.name}</div>
                <div className="font-mono text-sm text-muted-foreground">
                  {formatBytes(uploadFile.size)} · {t("Clique para trocar", "Click to replace", "Haz clic para cambiar")}
                </div>
                <Button
                  onClick={e => { e.stopPropagation(); void handleUpload(); }}
                  disabled={uploading}
                  className="font-mono mt-2"
                >
                  {uploading
                    ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />{t("Enviando…", "Uploading…", "Subiendo…")}</>
                    : <><Upload className="h-4 w-4 mr-2" />{t("Confirmar Upload", "Confirm Upload", "Confirmar carga")}</>
                  }
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-10 w-10 text-muted-foreground/40 mx-auto group-hover:text-primary transition-colors" />
                <div className="font-mono text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                  {t("Clique para selecionar ou arraste um vídeo aqui", "Click to select or drag a video here", "Haz clic para seleccionar o arrastra un vídeo aquí")}
                </div>
                <div className="font-mono text-xs text-muted-foreground/60">{t("MP4, MOV, WebM — até 2GB", "MP4, MOV, WebM — up to 2 GB", "MP4, MOV, WebM — hasta 2 GB")}</div>
              </div>
            )}
          </div>

          {/* Recordings grid */}
          {isLoadingRecordings ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
               <span className="font-mono text-sm text-muted-foreground">{t("Carregando gravações...", "Loading recordings...", "Cargando grabaciones...")}</span>
            </div>
          ) : recordingsError ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4 border border-destructive/20 bg-destructive/5 rounded-xl">
              <AlertTriangle className="h-8 w-8 text-destructive/80" />
               <span className="font-mono text-sm text-destructive">{t("Falha ao carregar gravações", "Failed to load recordings", "No se pudieron cargar las grabaciones")}</span>
              <Button variant="outline" size="sm" onClick={() => refetchRecordings()} className="font-mono">
                 {t("Tentar novamente", "Try again", "Reintentar")}
              </Button>
            </div>
          ) : filteredRecordings.length === 0 ? (
            <div className="text-center py-20 space-y-3">
              <Film className="h-12 w-12 text-muted-foreground/30 mx-auto" />
              <div className="font-mono text-sm text-muted-foreground">
                 {search ? t("Nenhuma gravação encontrada para esta busca", "No recordings found for this search", "No se encontraron grabaciones para esta búsqueda") : t("Nenhuma gravação nesta pasta", "No recordings in this folder", "No hay grabaciones en esta carpeta")}
              </div>
              {!search && (
                <div className="font-mono text-xs text-muted-foreground/60">
                   {t("Faça um upload ou utilize o NexOS Launcher para gravar", "Upload a file or use NexOS Launcher to record", "Sube un archivo o usa NexOS Launcher para grabar")}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground flex justify-between">
                 <span>{t(`${filteredRecordings.length} gravação${filteredRecordings.length !== 1 ? "ões" : ""}`, `${filteredRecordings.length} recording${filteredRecordings.length !== 1 ? "s" : ""}`, `${filteredRecordings.length} grabación${filteredRecordings.length !== 1 ? "es" : ""}`)}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredRecordings.map(rec => {
                  const { label, color } = statusLabel(rec, t);
                  const hasVideo = rec.finalizationStatus === "ready" && rec.hasVideo;
                  const isProcessing = rec.finalizationStatus === "pending" || rec.finalizationStatus === "processing";
                  const isFailed = rec.finalizationStatus === "failed";

                  return (
                    <div
                      key={rec.id}
                      className="border border-border/40 rounded-xl p-4 bg-background/60 hover:bg-background/80 transition-colors flex flex-col gap-3 group"
                    >
                      <div className="flex items-start gap-4">
                        {/* Thumbnail / Play button */}
                        <button
                          className={cn(
                            "shrink-0 w-24 h-16 rounded-lg bg-muted/30 border border-border/30 flex items-center justify-center relative overflow-hidden",
                            hasVideo && "cursor-pointer hover:border-primary/50 group/thumb",
                          )}
                          disabled={!hasVideo}
                          onClick={() => hasVideo && setPreviewRec(rec)}
                          title={hasVideo ? t("Pré-visualizar vídeo", "Preview video", "Vista previa del vídeo") : undefined}
                        >
                          {hasVideo ? (
                            <>
                              <Camera className="h-6 w-6 text-primary/60 transition-opacity group-hover/thumb:opacity-0" />
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity bg-primary/10">
                                <Play className="h-8 w-8 text-primary fill-primary" />
                              </div>
                            </>
                          ) : isProcessing ? (
                            <RefreshCw className="h-6 w-6 text-blue-400/60 animate-spin" />
                          ) : (
                            <Video className="h-6 w-6 text-muted-foreground/30" />
                          )}
                        </button>

                        {/* Info */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="font-mono text-sm font-bold truncate" title={rec.name}>{rec.name}</div>
                            <Badge variant="outline" className={cn("font-mono text-[9px] uppercase tracking-widest shrink-0", color)}>
                              {label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground flex-wrap">
                            {rec.videoSize ? (
                              <span className="flex items-center gap-1">
                                <HardDrive className="h-3 w-3" />
                                {formatBytes(rec.videoSize)}
                              </span>
                            ) : null}
                            {rec.duration ? (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDuration(rec.duration)}
                              </span>
                            ) : null}
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(rec.createdAt).toLocaleDateString(numberLocale, {
                                day: "2-digit", month: "short", year: "numeric",
                              })}
                            </span>
                            {rec.recordingMode && (
                              <span className="text-muted-foreground/60 border border-border/50 px-1 rounded bg-card/30">
                                {rec.recordingMode === "manual" ? "Upload" : "NexOS"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Processing Status / Errors */}
                      {isProcessing && (
                        <div className="px-3 py-2 rounded bg-blue-500/5 border border-blue-500/10 flex items-center gap-2">
                          <RefreshCw className="h-3.5 w-3.5 text-blue-400 animate-spin" />
                           <span className="font-mono text-xs text-blue-400">{t("Processando arquivo de vídeo...", "Processing video file...", "Procesando archivo de vídeo...")}</span>
                        </div>
                      )}
                      {isFailed && (
                        <div className="px-3 py-2 rounded bg-red-500/5 border border-red-500/10 flex items-start gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                          <div className="flex-1">
                             <div className="font-mono text-xs text-red-400 font-bold">{t("Falha no processamento", "Processing failed", "Error de procesamiento")}</div>
                            {rec.finalizationError && (
                              <div className="font-mono text-[10px] text-red-400/80 mt-0.5 break-words">{rec.finalizationError}</div>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2 h-7 font-mono text-[10px]"
                              onClick={() => {
                                setRetryingId(rec.id);
                                retryInputRef.current?.click();
                              }}
                            >
                              <Upload className="mr-1.5 h-3.5 w-3.5" />
                              {t("Reenviar arquivo", "Re-upload file", "Volver a subir el archivo")}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="pt-2 flex items-center justify-between border-t border-border/30 mt-auto">
                        <div className="flex gap-2">
                           {hasVideo && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="font-mono text-[11px] h-7 px-2 text-primary hover:text-primary hover:bg-primary/10"
                              onClick={() => setPreviewRec(rec)}
                            >
                              <Play className="h-3.5 w-3.5 mr-1.5" />
                               {t("Reproduzir", "Play", "Reproducir")}
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {hasVideo && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="font-mono text-[11px] h-7 px-2.5 bg-card/50"
                                onClick={() => navigate(`/video-editor?recordingId=${rec.id}`)}
                              >
                                <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                                {t("Editar", "Edit", "Editar")}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="font-mono text-[11px] h-7 px-2.5 bg-card/50"
                                onClick={() => window.open(`/api/recordings/${rec.id}/video-stream?token=${encodeURIComponent(token)}&download=1`, "_blank")}
                                 title={t("Baixar arquivo original", "Download original file", "Descargar archivo original")}
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-400/10"
                            disabled={deletingId === rec.id}
                            onClick={() => void deleteRecording(rec.id)}
                             title={t("Excluir gravação", "Delete recording", "Eliminar grabación")} aria-label={t("Excluir gravação", "Delete recording", "Eliminar grabación")}
                          >
                            {deletingId === rec.id
                              ? <RefreshCw className="h-3 w-3 animate-spin" />
                              : <Trash2 className="h-3 w-3" />
                            }
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* -- Dialogs -- */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono">{editingFolder ? t("Renomear pasta", "Rename folder", "Renombrar carpeta") : t("Nova pasta", "New folder", "Nueva carpeta")}</DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {editingFolder
                ? t("Altere o nome usado para organizar suas gravações.", "Change the name used to organize your recordings.", "Cambia el nombre para organizar tus grabaciones.")
                : t("Crie uma pasta personalizada para organizar vídeos deste workspace.", "Create a custom folder to organize videos in this workspace.", "Crea una carpeta personalizada para organizar los vídeos de este espacio de trabajo.")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{t("Nome da pasta", "Folder name", "Nombre de la carpeta")}</label>
              <Input
                value={folderName}
                onChange={e => setFolderName(e.target.value)}
                placeholder={t("Ex: Lançamento Nov/2023", "e.g. November 2023 Launch", "p. ej., Lanzamiento noviembre de 2023")}
                className="font-mono"
                autoFocus
                onKeyDown={e => {
                  if (e.key === "Enter" && folderName.trim()) saveFolderMut.mutate(folderName.trim());
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)} className="font-mono">{t("Cancelar", "Cancel", "Cancelar")}</Button>
            <Button
              onClick={() => saveFolderMut.mutate(folderName.trim())}
              disabled={!folderName.trim() || saveFolderMut.isPending}
              className="font-mono"
            >
              {saveFolderMut.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t("Salvar", "Save", "Guardar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingFolder} onOpenChange={(o) => !o && setDeletingFolder(null)}>
        <DialogContent className="sm:max-w-md border-red-500/20">
          <DialogHeader>
            <DialogTitle className="font-mono text-red-500">{t("Excluir pasta?", "Delete folder?", "¿Eliminar carpeta?")}</DialogTitle>
            <DialogDescription className="font-mono text-sm pt-2">
              {t("Tem certeza que deseja excluir a pasta", "Are you sure you want to delete the folder", "¿Seguro que quieres eliminar la carpeta")} <strong className="text-foreground">{deletingFolder?.name}</strong>?
              {" "}{t("As gravações dentro dela não serão excluídas, apenas movidas para a visualização geral.", "Recordings inside it will not be deleted; they will be moved to the all recordings view.", "Las grabaciones que contiene no se eliminarán, solo se moverán a la vista general.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeletingFolder(null)} className="font-mono">{t("Cancelar", "Cancel", "Cancelar")}</Button>
            <Button
              variant="destructive"
              onClick={() => deletingFolder && deleteFolderMut.mutate(deletingFolder.id)}
              disabled={deleteFolderMut.isPending}
              className="font-mono"
            >
              {deleteFolderMut.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {t("Excluir Pasta", "Delete Folder", "Eliminar carpeta")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
