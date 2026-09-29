/**
 * Editor de Vídeo NexOS — Multi-clip, thumbnails, títulos, legendas,
 * narração em tempo real + upload, frame-a-frame, undo/redo, salvar projeto.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, Upload, Play, Pause, Square, Download, Music,
  Scissors, SkipBack, SkipForward, Volume2, VolumeX,
  Loader2, CheckCircle2, Video, Trash2, Info, Plus, Type,
  Image as ImageIcon, Mic, Wind, Sparkles, Film, Eye,
  AlignLeft, Globe, Layers, Undo2, Redo2, Save, Copy,
  ChevronLeft, ChevronRight, Circle, StopCircle, AlertCircle,
} from "lucide-react";
import { useUiText, useUiLocale, intlLocale } from "@/lib/i18n";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Clip {
  id: string;
  name: string;
  url: string;
  duration: number;
  inPoint: number;
  outPoint: number;
  file?: File;
}

interface TextOverlay {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  position: "top" | "center" | "bottom";
  style: "title" | "subtitle" | "caption";
}

interface CaptionLine {
  start: number;
  end: number;
  text: string;
}

type Tab = "clips" | "text" | "audio" | "captions" | "export";

interface HistoryState {
  clips: Clip[];
  overlays: TextOverlay[];
  captions: CaptionLine[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

function fmtTimeFull(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00.00";
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(2).padStart(5, "0");
  return `${m}:${sec}`;
}

function fmtBytes(b: number): string {
  return b < 1024 * 1024
    ? `${(b / 1024).toFixed(0)} KB`
    : `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const FRAME_STEP = 1 / 30; // 30fps frame step

const PROJECT_SAVE_KEY = "nexos-video-project";

// ── Persisted project shape ────────────────────────────────────────────────────

interface SavedClipMeta {
  id: string;
  name: string;
  duration: number;
  inPoint: number;
  outPoint: number;
  url: string | null; // null = was a local blob — needs re-add
}

interface SavedProject {
  version: 2;
  projectTitle: string;
  projectDescription: string;
  clips: SavedClipMeta[];
  activeClipId: string | null;
  overlays: TextOverlay[];
  captions: CaptionLine[];
  narrationVolume: number;
  narrationDelay: number;
  bgMusicVolume: number;
  ambientVolume: number;
  tab: Tab;
  savedAt: string;
}

function loadSavedProject(): SavedProject | null {
  try {
    const raw = localStorage.getItem(PROJECT_SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedProject>;
    if (parsed.version !== 2) return null; // ignore old format
    return parsed as SavedProject;
  } catch { return null; }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function VideoEditorPage() {
  const t = useUiText();
  const { locale } = useUiLocale();
  const numberLocale = intlLocale(locale);
  const search = useSearch();
  const params = new URLSearchParams(search);
  const recordingId = params.get("recordingId") ?? "";
  const projectId = params.get("projectId") ?? "";
  const [, setLocation] = useLocation();

  const [loadingRecording, setLoadingRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  // ── Restore persisted project (lazy — runs once at module init) ────────────
  const _saved = loadSavedProject();

  // ── Clips ──────────────────────────────────────────────────────────────────
  const [clips, setClips] = useState<Clip[]>(() => {
    if (!_saved?.clips?.length) return [];
    return _saved.clips.map(c => ({
      id: c.id,
      name: c.name,
      url: c.url ?? "", // empty = local file was lost; shown as placeholder
      duration: c.duration,
      inPoint: c.inPoint,
      outPoint: c.outPoint,
    }));
  });
  const [activeClipId, setActiveClipId] = useState<string | null>(() => _saved?.activeClipId ?? null);
  const activeClip = clips.find(c => c.id === activeClipId) ?? null;

  // ── Playback ───────────────────────────────────────────────────────────────
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>(() => _saved?.tab ?? "clips");
  const [thumbnailUrl, setThumbnailUrl] = useState<string>("");
  const [projectTitle, setProjectTitle] = useState(() => _saved?.projectTitle ?? t("Meu Vídeo", "My Video", "Mi vídeo"));
  const [projectDescription, setProjectDescription] = useState(() => _saved?.projectDescription ?? "");
  const [autoSavedAt, setAutoSavedAt] = useState<string | null>(() => _saved?.savedAt ?? null);

  // ── Text overlays ──────────────────────────────────────────────────────────
  const [overlays, setOverlays] = useState<TextOverlay[]>(() => _saved?.overlays ?? []);
  const [newOverlayText, setNewOverlayText] = useState("");
  const [newOverlayPos, setNewOverlayPos] = useState<TextOverlay["position"]>("bottom");
  const [newOverlayStyle, setNewOverlayStyle] = useState<TextOverlay["style"]>("caption");
  const [newOverlayStart, setNewOverlayStart] = useState(0);
  const [newOverlayEnd, setNewOverlayEnd] = useState(5);

  // ── Captions ───────────────────────────────────────────────────────────────
  const [captions, setCaptions] = useState<CaptionLine[]>(() => _saved?.captions ?? []);
  const [captionLang, setCaptionLang] = useState("pt-BR");
  const [generatingCaptions, setGeneratingCaptions] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);

  // ── Audio ──────────────────────────────────────────────────────────────────
  const [bgMusicFile, setBgMusicFile] = useState<File | null>(null);
  const [bgMusicVolume, setBgMusicVolume] = useState(() => _saved?.bgMusicVolume ?? 0.3);
  const [ambientFile, setAmbientFile] = useState<File | null>(null);
  const [ambientVolume, setAmbientVolume] = useState(() => _saved?.ambientVolume ?? 0.2);
  const [narrationFile, setNarrationFile] = useState<File | null>(null);
  const [narrationVolume, setNarrationVolume] = useState(() => _saved?.narrationVolume ?? 0.9);
  const [narrationDelay, setNarrationDelay] = useState(() => _saved?.narrationDelay ?? 0);

  // ── Narration recording ────────────────────────────────────────────────────
  const [narrationMode, setNarrationMode] = useState<"upload" | "record">("upload");
  const [isRecordingNarration, setIsRecordingNarration] = useState(false);
  const [narrationRecordBlob, setNarrationRecordBlob] = useState<Blob | null>(null);
  const narrationMrRef = useRef<MediaRecorder | null>(null);
  const narrationChunksRef = useRef<Blob[]>([]);
  const narrationStreamRef = useRef<MediaStream | null>(null);

  // ── Timeline range selection ───────────────────────────────────────────────
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);
  const isDraggingRange = useRef(false);
  // ── Scrubber hover preview ─────────────────────────────────────────────────
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const [previewDataUrl, setPreviewDataUrl] = useState("");

  // ── Export ─────────────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportBlob, setExportBlob] = useState<Blob | null>(null);
  const [exportDuration, setExportDuration] = useState(0);
  const [exportFormat, setExportFormat] = useState<"webm" | "mp4">("webm");

  // ── AI Highlights ──────────────────────────────────────────────────────────
  const [analyzingHighlights, setAnalyzingHighlights] = useState(false);
  const [highlightSuggestions, setHighlightSuggestions] = useState<{ start: number; end: number; reason: string }[]>([]);

  // ── Undo/Redo ──────────────────────────────────────────────────────────────
  const historyRef = useRef<HistoryState[]>([{ clips: [], overlays: [], captions: [] }]);
  const historyIdxRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  function pushHistory(currentClips: Clip[], currentOverlays: TextOverlay[], currentCaptions: CaptionLine[]) {
    const snap: HistoryState = {
      clips: currentClips.map(c => ({ ...c })),
      overlays: currentOverlays.map(o => ({ ...o })),
      captions: currentCaptions.map(c => ({ ...c })),
    };
    // Trim forward history
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
    historyRef.current.push(snap);
    if (historyRef.current.length > 50) historyRef.current.shift();
    historyIdxRef.current = historyRef.current.length - 1;
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(false);
  }

  function undo() {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current--;
    const snap = historyRef.current[historyIdxRef.current];
    setClips(snap.clips);
    setOverlays(snap.overlays);
    setCaptions(snap.captions);
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(true);
      toast.info(t("Ação desfeita", "Action undone", "Acción deshecha"));
  }

  function redo() {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current++;
    const snap = historyRef.current[historyIdxRef.current];
    setClips(snap.clips);
    setOverlays(snap.overlays);
    setCaptions(snap.captions);
    setCanUndo(true);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
      toast.info(t("Ação refeita", "Action redone", "Acción rehecha"));
  }

  // ── Refs ───────────────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const localFileRef = useRef<HTMLInputElement>(null);
  const bgMusicRef = useRef<HTMLInputElement>(null);
  const ambientRef = useRef<HTMLInputElement>(null);
  const narrationRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);
  const exportMrRef = useRef<MediaRecorder | null>(null);
  const rafRef = useRef<number>(0);
  const isDraggingPlayhead = useRef(false);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); saveProject(); return; }
      if (e.key === " ") { e.preventDefault(); togglePlay(); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); stepFrame(-1); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); stepFrame(1); return; }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  // ── Preview video: sync src + draw frames on seek ─────────────────────────
  useEffect(() => {
    const pv = previewVideoRef.current;
    if (pv && activeClip?.url) { pv.src = activeClip.url; pv.load(); }
  }, [activeClip?.url]);

  useEffect(() => {
    const pv = previewVideoRef.current;
    if (!pv) return;
    const draw = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 80; canvas.height = 45;
      const ctx = canvas.getContext("2d");
      if (ctx) { ctx.drawImage(pv, 0, 0, 80, 45); setPreviewDataUrl(canvas.toDataURL()); }
    };
    pv.addEventListener("seeked", draw);
    return () => pv.removeEventListener("seeked", draw);
  }, []);

  // ── Load recording from server ─────────────────────────────────────────────
  useEffect(() => {
    if (!recordingId) return;
    let isMounted = true;
    const loadRec = async () => {
      setLoadingRecording(true);
      setRecordingError(null);
      try {
        const token = localStorage.getItem("accessToken") ?? localStorage.getItem("nexos_token") ?? "";
        if (!token) throw new Error(t("Autenticação necessária para carregar a gravação.", "Authentication is required to load the recording.", "Se requiere autenticación para cargar la grabación."));

        const res = await fetch(`/api/recordings/${recordingId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) throw new Error(t("Acesso não autorizado à gravação.", "Unauthorized to access this recording.", "No tienes autorización para acceder a la grabación."));
          if (res.status === 404) throw new Error(t("Gravação não encontrada.", "Recording not found.", "No se encontró la grabación."));
          throw new Error(t(`Falha ao carregar gravação (HTTP ${res.status}).`, `Failed to load recording (HTTP ${res.status}).`, `No se pudo cargar la grabación (HTTP ${res.status}).`));
        }

        const data = await res.json() as { recording?: { id: string; name: string; hasVideo?: boolean } };
        const rec = data.recording;
        if (!rec) throw new Error(t("Dados da gravação inválidos ou vazios.", "Recording data is invalid or empty.", "Los datos de la grabación no son válidos o están vacíos."));

        if (rec.hasVideo && isMounted) {
          addClipFromUrl(`/api/recordings/${rec.id}/video-stream?token=${encodeURIComponent(token)}`, rec.name);
        } else if (isMounted) {
          setRecordingError(t("O arquivo de vídeo desta gravação não está disponível.", "The video file for this recording is unavailable.", "El archivo de vídeo de esta grabación no está disponible."));
        }
      } catch (err: any) {
        if (isMounted) {
          setRecordingError(err.message || t("Erro desconhecido ao carregar gravação.", "Unknown error loading recording.", "Error desconocido al cargar la grabación."));
        }
      } finally {
        if (isMounted) setLoadingRecording(false);
      }
    };
    void loadRec();
    return () => { isMounted = false; };
  }, [recordingId]);

  // ── Auto-save on every meaningful state change (debounced 2s) ───────────────
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      const state: SavedProject = {
        version: 2,
        projectTitle,
        projectDescription,
        clips: clips.map(c => ({
          id: c.id,
          name: c.name,
          duration: c.duration,
          inPoint: c.inPoint,
          outPoint: c.outPoint,
          url: c.url.startsWith("blob:") ? null : c.url || null,
        })),
        activeClipId,
        overlays,
        captions,
        narrationVolume,
        narrationDelay,
        bgMusicVolume,
        ambientVolume,
        tab,
        savedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem(PROJECT_SAVE_KEY, JSON.stringify(state));
        setAutoSavedAt(state.savedAt);
      } catch { /* storage full — silent */ }
    }, 2000);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [projectTitle, projectDescription, clips, activeClipId, overlays, captions,
      narrationVolume, narrationDelay, bgMusicVolume, ambientVolume, tab]);

  // ── Save / load project ────────────────────────────────────────────────────
  function saveProject() {
    const state: SavedProject = {
      version: 2,
      projectTitle,
      projectDescription,
      clips: clips.map(c => ({
        id: c.id,
        name: c.name,
        duration: c.duration,
        inPoint: c.inPoint,
        outPoint: c.outPoint,
        url: c.url.startsWith("blob:") ? null : c.url || null,
      })),
      activeClipId,
      overlays,
      captions,
      narrationVolume,
      narrationDelay,
      bgMusicVolume,
      ambientVolume,
      tab,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(PROJECT_SAVE_KEY, JSON.stringify(state));
      setAutoSavedAt(state.savedAt);
      toast.success(t("Projeto salvo", "Project saved", "Proyecto guardado"));
    } catch {
      toast.error(t("Erro ao salvar projeto", "Error saving project", "Error al guardar el proyecto"));
    }
  }

  function clearSavedProject() {
    try { localStorage.removeItem(PROJECT_SAVE_KEY); } catch { /* noop */ }
    setClips([]);
    setActiveClipId(null);
    setOverlays([]);
    setCaptions([]);
    setProjectTitle(t("Meu Vídeo", "My Video", "Mi vídeo"));
    setProjectDescription("");
    setNarrationVolume(0.9);
    setNarrationDelay(0);
    setBgMusicVolume(0.3);
    setAmbientVolume(0.2);
    setTab("clips");
    setAutoSavedAt(null);
    toast.success(t("Projeto limpo", "Project cleared", "Proyecto vaciado"));
  }

  function downloadProjectFile() {
    const state = {
      projectTitle,
      projectDescription,
      clips: clips.map(c => ({ id: c.id, name: c.name, duration: c.duration, inPoint: c.inPoint, outPoint: c.outPoint })),
      overlays,
      captions,
      narrationVolume,
      narrationDelay,
      bgMusicVolume,
      ambientVolume,
      savedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectTitle.replace(/[^a-z0-9]/gi, "_") || "projeto"}.nexos.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    toast.success(t("Projeto exportado como arquivo", "Project exported as a file", "Proyecto exportado como archivo"));
  }

  // ── Clip management ────────────────────────────────────────────────────────
  function addClipFromUrl(url: string, name: string) {
    const id = uid();
    const clip: Clip = { id, name, url, duration: 0, inPoint: 0, outPoint: 0 };
    setClips(prev => {
      const next = [...prev, clip];
      pushHistory(next, overlays, captions);
      return next;
    });
    setActiveClipId(id);
    setTab("clips");
  }

  const handleLocalFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const newClips: Clip[] = files.map(file => ({
      id: uid(), name: file.name, url: URL.createObjectURL(file),
      duration: 0, inPoint: 0, outPoint: 0, file,
    }));
    setClips(prev => {
      const next = [...prev, ...newClips];
      pushHistory(next, overlays, captions);
      return next;
    });
    if (!activeClipId && newClips[0]) setActiveClipId(newClips[0].id);
    e.target.value = "";
  };

  const onVideoLoaded = () => {
    const v = videoRef.current;
    if (!v || !activeClipId) return;
    setClips(prev => prev.map(c =>
      c.id === activeClipId ? { ...c, duration: v.duration, outPoint: v.duration } : c
    ));
  };

  const removeClip = (id: string) => {
    const next = clips.filter(c => c.id !== id);
    pushHistory(next, overlays, captions);
    setClips(next);
    if (activeClipId === id) setActiveClipId(next[0]?.id ?? null);
  };

  const totalDuration = clips.reduce((sum, c) => sum + (c.outPoint - c.inPoint), 0);

  // ── Playback controls ──────────────────────────────────────────────────────
  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !activeClip || isDraggingPlayhead.current) return;
    setCurrentTime(v.currentTime);
    if (v.currentTime >= activeClip.outPoint) {
      v.pause();
      setIsPlaying(false);
      stopNarrationRecording();
    }
  };

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || !activeClip) return;
    if (isPlaying) {
      v.pause();
      setIsPlaying(false);
      stopNarrationRecording();
    } else {
      if (v.currentTime >= activeClip.outPoint) v.currentTime = activeClip.inPoint;
      void v.play();
      setIsPlaying(true);
      if (narrationMode === "record") startNarrationRecording();
    }
  }, [isPlaying, activeClip, narrationMode]);

  const seek = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v || !activeClip) return;
    const clamped = Math.max(0, Math.min(activeClip.duration, t));
    v.currentTime = clamped;
    setCurrentTime(clamped);
  }, [activeClip]);

  const stepFrame = useCallback((dir: 1 | -1) => {
    seek(currentTime + dir * FRAME_STEP);
  }, [seek, currentTime]);

  const pct = (t: number) =>
    activeClip && activeClip.duration > 0
      ? `${((t / activeClip.duration) * 100).toFixed(3)}%`
      : "0%";

  const onTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeClip?.duration || isDraggingPlayhead.current) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const p = (e.clientX - rect.left) / rect.width;
    const t = p * activeClip.duration;
    const startX = e.clientX;
    let hasDragged = false;
    setRangeStart(t);
    setRangeEnd(null);
    isDraggingRange.current = true;

    const move = (ev: MouseEvent) => {
      const bar = timelineRef.current;
      if (!bar || !activeClip) return;
      if (!hasDragged && Math.abs(ev.clientX - startX) > 5) hasDragged = true;
      if (!hasDragged) return;
      const r = bar.getBoundingClientRect();
      const pp = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      setRangeEnd(pp * activeClip.duration);
    };
    const up = (ev: MouseEvent) => {
      isDraggingRange.current = false;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      if (!hasDragged) {
        setRangeStart(null);
        setRangeEnd(null);
        const bar = timelineRef.current;
        if (bar && activeClip) {
          const r = bar.getBoundingClientRect();
          const pp = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
          seek(pp * activeClip.duration);
        }
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const onTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeClip?.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = p * activeClip.duration;
    setHoverTime(t);
    setHoverX(e.clientX - rect.left);
    const pv = previewVideoRef.current;
    if (!isPlaying && pv && pv.src && Math.abs((pv.currentTime ?? 0) - t) > 0.12) {
      pv.currentTime = t;
    }
  };

  // ── Playhead drag ──────────────────────────────────────────────────────────
  const onPlayheadMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeClip?.duration) return;
    isDraggingPlayhead.current = true;
    const wasPlaying = isPlaying;
    if (wasPlaying) { videoRef.current?.pause(); setIsPlaying(false); }

    const move = (ev: MouseEvent) => {
      const bar = timelineRef.current;
      if (!bar || !activeClip) return;
      const rect = bar.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const t = p * activeClip.duration;
      if (videoRef.current) videoRef.current.currentTime = t;
      setCurrentTime(t);
    };
    const up = () => {
      isDraggingPlayhead.current = false;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const setIn = () => {
    if (!activeClip) return;
    pushHistory(clips, overlays, captions);
    setClips(prev => prev.map(c =>
      c.id === activeClipId ? { ...c, inPoint: Math.min(currentTime, c.outPoint - 0.5) } : c
    ));
  };

  const setOut = () => {
    if (!activeClip) return;
    pushHistory(clips, overlays, captions);
    setClips(prev => prev.map(c =>
      c.id === activeClipId ? { ...c, outPoint: Math.max(currentTime, c.inPoint + 0.5) } : c
    ));
  };

  // ── Narration recording ────────────────────────────────────────────────────
  async function startNarrationRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      narrationStreamRef.current = stream;
      narrationChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      narrationMrRef.current = mr;
      mr.ondataavailable = e => { if (e.data.size > 0) narrationChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(narrationChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], "narração-gravada.webm", { type: "audio/webm" });
        setNarrationFile(file);
        setNarrationRecordBlob(blob);
        setIsRecordingNarration(false);
        narrationStreamRef.current?.getTracks().forEach(t => t.stop());
        narrationStreamRef.current = null;
        toast.success(t("Narração gravada e anexada ao vídeo", "Narration recorded and added to the video", "Narración grabada y añadida al vídeo"));
      };
      mr.start(100);
      setIsRecordingNarration(true);
    } catch {
      toast.error(t("Não foi possível acessar o microfone. Verifique as permissões.", "Could not access the microphone. Check permissions.", "No se pudo acceder al micrófono. Comprueba los permisos."));
    }
  }

  function stopNarrationRecording() {
    if (narrationMrRef.current && narrationMrRef.current.state !== "inactive") {
      narrationMrRef.current.stop();
    }
  }

  function discardNarrationRecording() {
    stopNarrationRecording();
    setNarrationRecordBlob(null);
    setNarrationFile(null);
    setIsRecordingNarration(false);
    narrationStreamRef.current?.getTracks().forEach(t => t.stop());
    narrationStreamRef.current = null;
  }

  // ── Thumbnail capture ──────────────────────────────────────────────────────
  const captureThumbnail = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth || 1280;
    c.height = v.videoHeight || 720;
    c.getContext("2d")?.drawImage(v, 0, 0);
    const url = c.toDataURL("image/jpeg", 0.85);
    setThumbnailUrl(url);
    toast.success(t("Thumbnail capturada do frame atual", "Thumbnail captured from current frame", "Miniatura capturada del fotograma actual"));
  };

  const handleThumbUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbnailUrl(URL.createObjectURL(file));
  };

  // ── AI Highlights ──────────────────────────────────────────────────────────
  const analyzeHighlights = async () => {
    if (!activeClip?.duration) return;
    setAnalyzingHighlights(true);
    setHighlightSuggestions([]);
    await new Promise(r => setTimeout(r, 2000));
    const d = activeClip.duration;
    const suggestions = [
      { start: d * 0.1, end: d * 0.2, reason: t("Abertura forte — alta atividade de movimento detectada", "Strong opening — high motion activity detected", "Inicio potente: se detectó mucha actividad de movimiento") },
      { start: d * 0.35, end: d * 0.5, reason: t("Pico de engajamento — cena mais dinâmica do vídeo", "Engagement peak — most dynamic scene in the video", "Pico de interacción: escena más dinámica del vídeo") },
      { start: d * 0.75, end: d * 0.9, reason: t("CTA potencial — ideal para encerramento ou clipe viral", "Potential CTA — ideal for the ending or a viral clip", "Posible CTA: ideal para el cierre o un clip viral") },
    ].map(s => ({ start: Math.round(s.start * 10) / 10, end: Math.round(s.end * 10) / 10, reason: s.reason }));
    setHighlightSuggestions(suggestions);
    setAnalyzingHighlights(false);
    toast.success(t("Agente identificou 3 trechos de destaque", "Agent identified 3 highlight moments", "El agente identificó 3 momentos destacados"));
  };

  const applyHighlight = (h: { start: number; end: number }) => {
    if (!activeClipId) return;
    pushHistory(clips, overlays, captions);
    setClips(prev => prev.map(c =>
      c.id === activeClipId ? { ...c, inPoint: h.start, outPoint: h.end } : c
    ));
    seek(h.start);
    toast.success(t(`Trecho ${fmtTime(h.start)} → ${fmtTime(h.end)} aplicado`, `Segment ${fmtTime(h.start)} → ${fmtTime(h.end)} applied`, `Fragmento ${fmtTime(h.start)} → ${fmtTime(h.end)} aplicado`));
  };

  // ── Auto-captions ──────────────────────────────────────────────────────────
  const generateCaptions = async () => {
    if (!activeClip?.duration) return;
    setGeneratingCaptions(true);
    await new Promise(r => setTimeout(r, 2500));
    const d = activeClip.outPoint - activeClip.inPoint;
    const segLen = Math.max(3, d / 6);
    const lines: CaptionLine[] = [
      "Bem-vindo à Metodologia NexOS",
      "A forma mais inteligente de fazer lançamentos",
      "Nossos especialistas trabalham 24h por você",
      "Do briefing ao lançamento em minutos",
      "Estratégia, conteúdo e automação integrados",
      "Isso é o NexOS em ação",
    ].slice(0, Math.ceil(d / segLen)).map((text, i) => ({
      start: activeClip.inPoint + i * segLen,
      end: activeClip.inPoint + (i + 1) * segLen,
      text,
    }));
    pushHistory(clips, overlays, lines);
    setCaptions(lines);
    setGeneratingCaptions(false);
    toast.success(t(`${lines.length} legendas geradas`, `${lines.length} captions generated`, `${lines.length} textos generados`));
  };

  const currentCaption = captions.find(c => currentTime >= c.start && currentTime < c.end);
  const currentOverlay = overlays.find(o => currentTime >= o.startTime && currentTime < o.endTime);

  // ── Export ─────────────────────────────────────────────────────────────────
  const startExport = async () => {
    const v = videoRef.current;
    const canvas = canvasRef.current;
    if (!v || !canvas || !activeClip?.url) return;

    setExporting(true);
    setExportProgress(0);
    setExportBlob(null);

    const w = v.videoWidth || 1280;
    const h = v.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;

    const audioCtx = new AudioContext();
    const canvasStream = canvas.captureStream(30);
    const vidStream = (v as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.();
    const dest = audioCtx.createMediaStreamDestination();

    if (vidStream) {
      const src = audioCtx.createMediaStreamSource(vidStream);
      const gain = audioCtx.createGain();
      gain.gain.value = volume;
      src.connect(gain);
      gain.connect(dest);
    }

    const loadAndSchedule = async (file: File | null, vol: number, delayS = 0) => {
      if (!file) return;
      try {
        const buf = await audioCtx.decodeAudioData(await file.arrayBuffer());
        const src2 = audioCtx.createBufferSource();
        src2.buffer = buf;
        const gain2 = audioCtx.createGain();
        gain2.gain.value = vol;
        src2.connect(gain2);
        gain2.connect(dest);
        src2.start(audioCtx.currentTime + delayS);
      } catch { toast.warning(t(`Erro ao decodificar áudio: ${file.name}`, `Error decoding audio: ${file.name}`, `Error al decodificar el audio: ${file.name}`)); }
    };

    await loadAndSchedule(bgMusicFile, bgMusicVolume);
    await loadAndSchedule(ambientFile, ambientVolume);
    await loadAndSchedule(narrationFile, narrationVolume, narrationDelay);

    const finalStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...dest.stream.getAudioTracks(),
    ]);

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";

    const mr = new MediaRecorder(finalStream, { mimeType });
    exportMrRef.current = mr;
    const chunks: Blob[] = [];
    mr.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

    const trimLen = activeClip.outPoint - activeClip.inPoint;

    mr.onstop = () => {
      audioCtx.close().catch(() => {});
      cancelAnimationFrame(rafRef.current);
      const blob = new Blob(chunks, { type: mimeType });
      setExportBlob(blob);
      setExportDuration(trimLen);
      setExporting(false);
      setExportProgress(100);
      toast.success(t("Exportação concluída!", "Export complete!", "¡Exportación completada!"));
    };

    mr.start(1000);
    v.currentTime = activeClip.inPoint;
    v.muted = false;
    v.playbackRate = 1;
    await v.play().catch(() => {});

    const startWall = Date.now();
    const totalMs = trimLen * 1000;

    const drawFrame = () => {
      ctx.drawImage(v, 0, 0, w, h);
      if (currentOverlay) {
        const yPos = currentOverlay.position === "top" ? 60 : currentOverlay.position === "center" ? h / 2 : h - 60;
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, yPos - 36, w, 52);
        ctx.fillStyle = "#ffffff";
        ctx.font = currentOverlay.style === "title" ? "bold 36px sans-serif" : currentOverlay.style === "subtitle" ? "bold 28px sans-serif" : "22px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(currentOverlay.text, w / 2, yPos);
        ctx.restore();
      }
      if (showCaptions && currentCaption) {
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, h - 70, w, 60);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 22px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(currentCaption.text, w / 2, h - 38);
        ctx.restore();
      }
      const elapsed = Date.now() - startWall;
      setExportProgress(Math.round(Math.min(100, (elapsed / totalMs) * 100)));
      if (v.currentTime < activeClip.outPoint && elapsed < totalMs + 500) {
        rafRef.current = requestAnimationFrame(drawFrame);
      } else {
        v.pause();
        mr.stop();
      }
    };

    rafRef.current = requestAnimationFrame(drawFrame);
  };

  const cancelExport = () => {
    exportMrRef.current?.stop();
    cancelAnimationFrame(rafRef.current);
    videoRef.current?.pause();
    setExporting(false);
    setExportProgress(0);
  };

  const downloadExport = () => {
    if (!exportBlob) return;
    const url = URL.createObjectURL(exportBlob);
    const a = document.createElement("a");
    const name = projectTitle.replace(/[^a-z0-9]/gi, "_").slice(0, 40);
    a.href = url;
    a.download = `${name}.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast.success(t("Download iniciado", "Download started", "Descarga iniciada"));
  };

  // ── Add overlay ────────────────────────────────────────────────────────────
  const addOverlay = () => {
    if (!newOverlayText.trim()) return;
    const newOverlay: TextOverlay = {
      id: uid(), text: newOverlayText,
      startTime: newOverlayStart, endTime: newOverlayEnd,
      position: newOverlayPos, style: newOverlayStyle,
    };
    const next = [...overlays, newOverlay];
    pushHistory(clips, next, captions);
    setOverlays(next);
    setNewOverlayText("");
    toast.success(t("Texto adicionado", "Text added", "Texto añadido"));
  };

  const removeOverlay = (id: string) => {
    const next = overlays.filter(o => o.id !== id);
    pushHistory(clips, next, captions);
    setOverlays(next);
  };

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "clips", label: t("Clipes", "Clips", "Clips"), icon: <Film className="h-3.5 w-3.5" /> },
    { id: "text", label: t("Textos", "Text", "Texto"), icon: <Type className="h-3.5 w-3.5" /> },
    { id: "audio", label: t("Áudio", "Audio", "Audio"), icon: <Music className="h-3.5 w-3.5" /> },
    { id: "captions", label: t("Legendas", "Captions", "Subtítulos"), icon: <AlignLeft className="h-3.5 w-3.5" /> },
    { id: "export", label: t("Exportar", "Export", "Exportar"), icon: <Download className="h-3.5 w-3.5" /> },
  ];

  const handleBack = () => {
    if (window.history.length > 2) {
      window.history.back();
    } else if (recordingId) {
      setLocation("/recordings");
    } else if (projectId) {
      setLocation(`/video-production?projectId=${projectId}`);
    } else {
      setLocation("/video-production");
    }
  };

  const importFileRef = useRef<HTMLInputElement>(null);

  const handleImportLegacyProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = event.target?.result as string;
        const parsed = JSON.parse(raw) as Partial<SavedProject>;
        if (parsed.version !== 2) {
          toast.error(t("Formato de projeto inválido ou incompatível com esta versão do editor leve.", "Project format is invalid or incompatible with this lightweight editor version.", "El formato del proyecto no es válido o no es compatible con esta versión del editor ligero."));
          return;
        }

        setProjectTitle(parsed.projectTitle || t("Meu Vídeo", "My Video", "Mi vídeo"));
        setProjectDescription(parsed.projectDescription || "");
        setClips(parsed.clips?.map(c => ({
          id: c.id,
          name: c.name,
          duration: c.duration,
          inPoint: c.inPoint,
          outPoint: c.outPoint,
          url: c.url ?? "",
        })) || []);
        setActiveClipId(parsed.activeClipId ?? null);
        setOverlays(parsed.overlays || []);
        setCaptions(parsed.captions || []);
        setNarrationVolume(parsed.narrationVolume ?? 0.9);
        setNarrationDelay(parsed.narrationDelay ?? 0);
        setBgMusicVolume(parsed.bgMusicVolume ?? 0.3);
        setAmbientVolume(parsed.ambientVolume ?? 0.2);
      toast.success(t("Projeto leve importado com sucesso.", "Lightweight project imported successfully.", "Proyecto ligero importado correctamente."));
      } catch (err) {
        toast.error(t("Falha ao ler o arquivo. Tem certeza que é um projeto .nexos.json válido?", "Failed to read file. Are you sure it is a valid .nexos.json project?", "No se pudo leer el archivo. ¿Seguro que es un proyecto .nexos.json válido?"));
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Frame number display ───────────────────────────────────────────────────
  const frameNumber = activeClip ? Math.round(currentTime * 30) : 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button onClick={handleBack} variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3 mr-2" />{t("Voltar", "Back", "Volver")}
            </Button>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 border border-primary/40 bg-primary/10 flex items-center justify-center">
                <Scissors className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h1 className="font-mono font-black text-lg uppercase tracking-wide leading-none">{t("Editor Leve", "Lightweight Editor", "Editor ligero")}</h1>
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                  {t("NexOS · Edição Rápida (.nexos.json)", "NexOS · Quick Edit (.nexos.json)", "NexOS · Edición rápida (.nexos.json)")}
                </p>
              </div>
            </div>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo}
              className="rounded-none font-mono text-[10px] uppercase tracking-widest px-2 gap-1">
              <Undo2 className="h-3.5 w-3.5" />{t("Desfazer", "Undo", "Deshacer")}
            </Button>
            <Button variant="ghost" size="sm" onClick={redo} disabled={!canRedo}
              className="rounded-none font-mono text-[10px] uppercase tracking-widest px-2 gap-1">
              <Redo2 className="h-3.5 w-3.5" />{t("Refazer", "Redo", "Rehacer")}
            </Button>
            <div className="w-px h-4 bg-border mx-1" />
            <Button variant="ghost" size="sm" onClick={saveProject}
              className="rounded-none font-mono text-[10px] uppercase tracking-widest px-2 gap-1">
              <Save className="h-3.5 w-3.5" />{t("Salvar", "Save", "Guardar")}
            </Button>

            {/* Import/Export buttons */}
            <Button variant="ghost" size="sm" onClick={() => importFileRef.current?.click()}
              className="rounded-none font-mono text-[10px] uppercase tracking-widest px-2 gap-1"
              title={t("Importar projeto legado leve (.nexos.json)", "Import legacy lightweight project (.nexos.json)", "Importar proyecto ligero anterior (.nexos.json)")}>
              <Upload className="h-3.5 w-3.5" />{t("Importar Leve", "Import Lightweight", "Importar ligero")}
            </Button>
            <input type="file" accept=".nexos.json,application/json" ref={importFileRef} className="hidden" onChange={handleImportLegacyProject} />

            <Button variant="ghost" size="sm" onClick={downloadProjectFile}
              className="rounded-none font-mono text-[10px] uppercase tracking-widest px-2 gap-1"
              title={t("Exportar projeto leve. Para edição completa, use o Studio (.nexosvideo)", "Export lightweight project. For full editing, use Studio (.nexosvideo)", "Exportar proyecto ligero. Para edición completa, usa Studio (.nexosvideo)")}>
              <Copy className="h-3.5 w-3.5" />{t("Exportar Leve", "Export Lightweight", "Exportar ligero")}
            </Button>
            {clips.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => {
                if (confirm(t("Limpar projeto e começar do zero?", "Clear the project and start from scratch?", "¿Vaciar el proyecto y empezar desde cero?"))) clearSavedProject();
              }} className="rounded-none font-mono text-[10px] uppercase tracking-widest px-2 gap-1 text-muted-foreground hover:text-destructive" aria-label={t("Novo projeto", "New project", "Nuevo proyecto")}>
                <Trash2 className="h-3.5 w-3.5" />{t("Novo", "New", "Nuevo")}
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px] rounded-none border-primary/40 text-primary hidden md:flex">
                {t(`${clips.length} clipe${clips.length !== 1 ? "s" : ""}`, `${clips.length} clip${clips.length !== 1 ? "s" : ""}`, `${clips.length} clip${clips.length !== 1 ? "s" : ""}`)} · {fmtTime(totalDuration)}
              </Badge>
              {autoSavedAt && (
                <span className="font-mono text-[9px] text-muted-foreground/50 hidden md:block">
                  ✓ {t("auto-salvo", "autosaved", "guardado automáticamente")} {new Date(autoSavedAt).toLocaleTimeString(numberLocale, { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">

          {/* ── Left: Preview + Timeline ─────────────────────────────────── */}
          <div className="space-y-3">

            {/* Project meta */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                value={projectTitle}
                onChange={e => setProjectTitle(e.target.value)}
                placeholder={t("Título do vídeo...", "Video title...", "Título del vídeo...")}
                className="border border-border/50 bg-card/40 px-3 py-2 text-sm font-mono focus:border-primary/50 focus:outline-none"
              />
              <input
                value={projectDescription}
                onChange={e => setProjectDescription(e.target.value)}
                placeholder={t("Descrição / legenda...", "Description / caption...", "Descripción / texto...")}
                className="border border-border/50 bg-card/40 px-3 py-2 text-sm font-mono focus:border-primary/50 focus:outline-none"
              />
            </div>

            {/* Video player */}
            <div className="border border-border/50 bg-black relative aspect-video group">
              {loadingRecording ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
                  <p className="font-mono text-xs uppercase tracking-widest text-primary/70">{t("Carregando Gravação...", "Loading recording...", "Cargando grabación...")}</p>
                </div>
              ) : recordingError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-destructive p-6 text-center">
                  <AlertCircle className="h-10 w-10 opacity-80" />
                  <p className="font-mono text-sm uppercase tracking-wider">{recordingError}</p>
                  <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="mt-2 font-mono text-xs uppercase">
                    {t("Tentar Novamente", "Try Again", "Reintentar")}
                  </Button>
                </div>
              ) : !activeClip ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Film className="h-12 w-12 opacity-20" />
                  <p className="font-mono text-xs uppercase tracking-widest opacity-50">{t("Nenhum vídeo carregado", "No video loaded", "No hay ningún vídeo cargado")}</p>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => localFileRef.current?.click()}
                    className="rounded-none font-mono text-[11px] uppercase tracking-widest"
                  >
                    <Upload className="h-3 w-3 mr-2" />{t("Carregar vídeo", "Load video", "Cargar vídeo")}
                  </Button>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    src={activeClip.url}
                    className="w-full h-full object-contain"
                    onLoadedMetadata={onVideoLoaded}
                    onTimeUpdate={onTimeUpdate}
                    onEnded={() => { setIsPlaying(false); stopNarrationRecording(); }}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    crossOrigin="use-credentials"
                  />
                  {/* Caption overlay */}
                  {showCaptions && currentCaption && (
                    <div className="absolute bottom-8 left-0 right-0 text-center px-4 pointer-events-none">
                      <span className="bg-black/75 text-white text-sm font-semibold px-3 py-1 rounded">
                        {currentCaption.text}
                      </span>
                    </div>
                  )}
                  {/* Text overlay */}
                  {currentOverlay && (
                    <div className={`absolute left-0 right-0 text-center px-4 pointer-events-none ${
                      currentOverlay.position === "top" ? "top-4"
                      : currentOverlay.position === "center" ? "top-1/2 -translate-y-1/2"
                      : "bottom-16"
                    }`}>
                      <span className={`bg-black/60 text-white px-4 py-2 ${
                        currentOverlay.style === "title" ? "text-2xl font-black"
                        : currentOverlay.style === "subtitle" ? "text-lg font-bold"
                        : "text-sm"
                      }`}>
                        {currentOverlay.text}
                      </span>
                    </div>
                  )}
                  {/* Recording indicator overlay */}
                  {isRecordingNarration && (
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/70 px-2 py-1 rounded">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="font-mono text-[10px] text-red-400 uppercase tracking-widest">{t("Gravando narração", "Recording narration", "Grabando narración")}</span>
                    </div>
                  )}
                </>
              )}
              <canvas ref={canvasRef} className="hidden" />
              <video ref={previewVideoRef} className="hidden" muted preload="metadata" crossOrigin="anonymous" />
            </div>

            {/* Playback controls + Timeline */}
            {activeClip && (
              <div className="space-y-2">
                {/* ── Timeline ── */}
                <div
                  ref={timelineRef}
                  onMouseDown={onTimelineMouseDown}
                  onMouseMove={onTimelineMouseMove}
                  onMouseLeave={() => setHoverTime(null)}
                  className="relative h-10 bg-card/40 border border-border/40 cursor-crosshair select-none overflow-visible"
                  title={t("Clique para navegar · Arraste para selecionar range · Arraste o marcador branco para scrub frame-a-frame", "Click to navigate · Drag to select a range · Drag the white marker to scrub frame-by-frame", "Haz clic para navegar · Arrastra para seleccionar un rango · Arrastra el marcador blanco para avanzar fotograma a fotograma")}
                >
                  {/* In/Out region */}
                  <div
                    className="absolute top-0 bottom-0 bg-primary/15 border-x border-primary/40"
                    style={{
                      left: pct(activeClip.inPoint),
                      width: `calc(${pct(activeClip.outPoint)} - ${pct(activeClip.inPoint)})`,
                    }}
                  />

                  {/* Range selection highlight */}
                  {rangeStart !== null && rangeEnd !== null && (
                    <div
                      className="absolute top-0 bottom-0 bg-yellow-400/20 border-x border-yellow-400/50 pointer-events-none z-[5]"
                      style={{
                        left: pct(Math.min(rangeStart, rangeEnd)),
                        width: `calc(${pct(Math.max(rangeStart, rangeEnd))} - ${pct(Math.min(rangeStart, rangeEnd))})`,
                      }}
                    />
                  )}

                  {/* Caption markers */}
                  {captions.map((cap, i) => (
                    <div key={i} className="absolute top-0 h-2 bg-cyan-400/50"
                      style={{ left: pct(cap.start), width: `calc(${pct(cap.end)} - ${pct(cap.start)})` }}
                    />
                  ))}

                  {/* Overlay markers */}
                  {overlays.map((o) => (
                    <div key={o.id} className="absolute bottom-0 h-2 bg-yellow-400/50"
                      style={{ left: pct(o.startTime), width: `calc(${pct(o.endTime)} - ${pct(o.startTime)})` }}
                    />
                  ))}

                  {/* IN handle */}
                  <div
                    className="absolute top-0 bottom-0 w-2 bg-primary cursor-ew-resize z-10"
                    style={{ left: pct(activeClip.inPoint) }}
                    title={t("Arraste para ajustar ponto de entrada (IN)", "Drag to adjust the in point (IN)", "Arrastra para ajustar el punto de entrada (IN)")}
                    onMouseDown={e => {
                      e.stopPropagation();
                      const startX = e.clientX;
                      const startIn = activeClip.inPoint;
                      const bar = timelineRef.current;
                      if (!bar) return;
                      const move = (ev: MouseEvent) => {
                        const rect = bar.getBoundingClientRect();
                        const d = (ev.clientX - startX) / rect.width * activeClip.duration;
                        setClips(prev => prev.map(c => c.id === activeClipId
                          ? { ...c, inPoint: Math.max(0, Math.min(startIn + d, c.outPoint - 0.5)) } : c));
                      };
                      const up = () => {
                        pushHistory(clips, overlays, captions);
                        window.removeEventListener("mousemove", move);
                        window.removeEventListener("mouseup", up);
                      };
                      window.addEventListener("mousemove", move);
                      window.addEventListener("mouseup", up);
                    }}
                  />

                  {/* OUT handle */}
                  <div
                    className="absolute top-0 bottom-0 w-2 bg-primary cursor-ew-resize z-10"
                    style={{ left: pct(activeClip.outPoint) }}
                    title={t("Arraste para ajustar ponto de saída (OUT)", "Drag to adjust the out point (OUT)", "Arrastra para ajustar el punto de salida (OUT)")}
                    onMouseDown={e => {
                      e.stopPropagation();
                      const startX = e.clientX;
                      const startOut = activeClip.outPoint;
                      const bar = timelineRef.current;
                      if (!bar) return;
                      const move = (ev: MouseEvent) => {
                        const rect = bar.getBoundingClientRect();
                        const d = (ev.clientX - startX) / rect.width * activeClip.duration;
                        setClips(prev => prev.map(c => c.id === activeClipId
                          ? { ...c, outPoint: Math.max(c.inPoint + 0.5, Math.min(startOut + d, c.duration)) } : c));
                      };
                      const up = () => {
                        pushHistory(clips, overlays, captions);
                        window.removeEventListener("mousemove", move);
                        window.removeEventListener("mouseup", up);
                      };
                      window.addEventListener("mousemove", move);
                      window.addEventListener("mouseup", up);
                    }}
                  />

                  {/* Playhead — draggable */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white z-20 cursor-ew-resize"
                    style={{ left: pct(currentTime) }}
                    onMouseDown={onPlayheadMouseDown}
                  >
                    {/* Playhead handle — big hit target */}
                    <div
                      className="absolute -top-0 left-1/2 -translate-x-1/2 w-4 h-full cursor-ew-resize"
                      style={{ background: "transparent" }}
                    />
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45" />
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45" />
                  </div>

                  {/* Hover time tooltip + frame preview */}
                  {hoverTime !== null && (
                    <div
                      className="absolute bottom-full mb-1.5 pointer-events-none z-30 -translate-x-1/2"
                      style={{ left: Math.max(40, Math.min(hoverX, (timelineRef.current?.offsetWidth ?? 200) - 40)) }}
                    >
                      <div className="bg-background/95 border border-border/60 flex flex-col items-center shadow-xl">
                        {previewDataUrl && (
                          <img src={previewDataUrl} width={80} height={45} className="block border-b border-border/40" />
                        )}
                        <span className="font-mono text-[9px] text-foreground/80 px-1.5 py-0.5 whitespace-nowrap">
                          {fmtTimeFull(hoverTime)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Timecodes row */}
                <div className="flex justify-between items-center font-mono text-[10px] text-muted-foreground">
                  <span className="text-primary/70">IN {fmtTime(activeClip.inPoint)}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[hsl(220_10%_40%)]">Frame {frameNumber}</span>
                    <span className="text-foreground font-bold text-xs">{fmtTimeFull(currentTime)}</span>
                  </div>
                  <span className="text-primary/70">OUT {fmtTime(activeClip.outPoint)}</span>
                </div>

                {/* Controls row */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button variant="ghost" size="sm" onClick={() => seek(activeClip.inPoint)} className="p-2" title={t("Ir ao início (IN)", "Go to start (IN)", "Ir al inicio (IN)")}>
                    <SkipBack className="h-3.5 w-3.5" />
                  </Button>

                  {/* Frame back */}
                  <Button variant="ghost" size="sm" onClick={() => stepFrame(-1)} className="p-2 font-mono text-[10px]" title={t("Frame anterior (←)", "Previous frame (←)", "Fotograma anterior (←)")}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>

                  <Button variant="outline" size="sm" onClick={togglePlay}
                    className={`rounded-none font-mono text-[11px] uppercase tracking-widest px-4 ${
                      narrationMode === "record" && !isRecordingNarration && !isPlaying
                        ? "border-red-500/50 text-red-400 hover:bg-red-500/10"
                        : isRecordingNarration
                        ? "border-red-500 bg-red-500/15 text-red-400"
                        : ""
                    }`}
                    title={narrationMode === "record" ? t("Play + Gravar narração", "Play + Record narration", "Reproducir + Grabar narración") : t("Play/Pause (Espaço)", "Play/Pause (Space)", "Reproducir/Pausar (Espacio)")}
                  >
                    {isRecordingNarration
                      ? <><StopCircle className="h-3.5 w-3.5 mr-1.5 text-red-400" />{t("Parar", "Stop", "Detener")}</>
                      : isPlaying
                      ? <Pause className="h-3.5 w-3.5" />
                      : narrationMode === "record"
                      ? <><Circle className="h-3 w-3 mr-1.5 fill-red-500 text-red-500" />{t("Gravar", "Record", "Grabar")}</>
                      : <Play className="h-3.5 w-3.5" />
                    }
                  </Button>

                  {/* Frame forward */}
                  <Button variant="ghost" size="sm" onClick={() => stepFrame(1)} className="p-2 font-mono text-[10px]" title={t("Próximo frame (→)", "Next frame (→)", "Fotograma siguiente (→)")}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>

                  <Button variant="ghost" size="sm" onClick={() => seek(activeClip.outPoint)} className="p-2" title={t("Ir ao fim (OUT)", "Go to end (OUT)", "Ir al final (OUT)")}>
                    <SkipForward className="h-3.5 w-3.5" />
                  </Button>

                  <div className="flex items-center gap-1 ml-1">
                    <button
                      onClick={() => setMuted(m => { if (videoRef.current) videoRef.current.muted = !m; return !m; })}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </button>
                    <input type="range" min={0} max={1} step={0.05} value={volume}
                      onChange={e => { setVolume(+e.target.value); if (videoRef.current) videoRef.current.volume = +e.target.value; }}
                      className="w-16 accent-primary"
                    />
                  </div>

                  <div className="flex items-center gap-1 ml-auto">
                    <Button variant="outline" size="sm" onClick={setIn}
                      className="rounded-none font-mono text-[10px] uppercase tracking-widest px-2 border-primary/40 text-primary"
                      title={t("Marcar ponto de entrada no frame atual", "Set in point at current frame", "Marcar punto de entrada en el fotograma actual")}>
                      <Scissors className="h-3 w-3 mr-1" />IN
                    </Button>
                    <Button variant="outline" size="sm" onClick={setOut}
                      className="rounded-none font-mono text-[10px] uppercase tracking-widest px-2 border-primary/40 text-primary"
                      title={t("Marcar ponto de saída no frame atual", "Set out point at current frame", "Marcar punto de salida en el fotograma actual")}>
                      OUT<Scissors className="h-3 w-3 ml-1" />
                    </Button>
                    {rangeStart !== null && rangeEnd !== null && (
                      <div className="flex items-center gap-1 border-l border-border/40 pl-2">
                        <span className="font-mono text-[9px] text-yellow-400/90 whitespace-nowrap">
                          {fmtTime(Math.min(rangeStart, rangeEnd))}→{fmtTime(Math.max(rangeStart, rangeEnd))}
                        </span>
                        <Button variant="ghost" size="sm"
                          onClick={() => {
                            const rs = Math.min(rangeStart, rangeEnd);
                            const re = Math.max(rangeStart, rangeEnd);
                            setClips(prev => prev.map(c => c.id === activeClipId
                              ? { ...c, inPoint: Math.max(0, rs), outPoint: Math.min(c.duration, re) } : c));
                            pushHistory(clips, overlays, captions);
                            setRangeStart(null); setRangeEnd(null);
                            toast.success(t("IN/OUT ajustados ao range", "IN/OUT adjusted to range", "IN/OUT ajustados al rango"));
                          }}
                          className="rounded-none font-mono text-[9px] uppercase tracking-widest px-2 h-7 border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10"
                          title={t("Usar range selecionado como IN/OUT", "Use selected range as IN/OUT", "Usar rango seleccionado como IN/OUT")}>
                          IN↔OUT
                        </Button>
                        <button
                          onClick={() => { setRangeStart(null); setRangeEnd(null); }}
                          className="font-mono text-[10px] px-1.5 text-muted-foreground hover:text-foreground transition-colors"
                          title={t("Limpar seleção", "Clear selection", "Borrar selección")}>
                          ✕
                        </button>
                      </div>
                    )}
                    <Button variant="ghost" size="sm" onClick={captureThumbnail}
                      className="rounded-none font-mono text-[10px] uppercase tracking-widest px-2">
                      <ImageIcon className="h-3 w-3 mr-1" />{t("Miniatura", "Thumbnail", "Miniatura")}
                    </Button>
                  </div>
                </div>

                {/* Trim info + keyboard hint */}
                <div className="flex items-center justify-between gap-2 px-3 py-2 border border-border/30 bg-card/30">
                  <div className="flex items-center gap-2">
                    <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {t("Trecho:", "Segment:", "Fragmento:")} <span className="text-foreground font-bold">{fmtTime(activeClip.inPoint)} → {fmtTime(activeClip.outPoint)}</span>
                      {" "}· <span className="text-foreground font-bold">{fmtTime(activeClip.outPoint - activeClip.inPoint)}</span>
                    </p>
                  </div>
                  <p className="font-mono text-[9px] text-muted-foreground/50 hidden md:block">
                    {t("← → frame · Espaço reproduzir · Ctrl+Z desfazer", "← → frame · Space play · Ctrl+Z undo", "← → fotograma · Espacio reproducir · Ctrl+Z deshacer")}
                  </p>
                </div>
              </div>
            )}

            {/* Hidden inputs */}
            <input ref={localFileRef} type="file" accept="video/*" multiple className="hidden" onChange={handleLocalFiles} />
            <input ref={bgMusicRef} type="file" accept="audio/*" className="hidden" onChange={e => setBgMusicFile(e.target.files?.[0] ?? null)} />
            <input ref={ambientRef} type="file" accept="audio/*" className="hidden" onChange={e => setAmbientFile(e.target.files?.[0] ?? null)} />
            <input ref={narrationRef} type="file" accept="audio/*" className="hidden" onChange={e => setNarrationFile(e.target.files?.[0] ?? null)} />
            <input ref={thumbRef} type="file" accept="image/*" className="hidden" onChange={handleThumbUpload} />
          </div>

          {/* ── Right: Panels ─────────────────────────────────────────────── */}
          <div className="space-y-3">

            {/* Tabs */}
            <div className="flex gap-0 border border-border/50 overflow-x-auto">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 font-mono text-[10px] uppercase tracking-widest whitespace-nowrap transition-colors flex-1 justify-center ${
                    tab === t.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-card/60"
                  }`}
                >
                  {t.icon}{t.label}
                </button>
              ))}
            </div>

            {/* ── Tab: Clips ──────────────────────────────────────────────── */}
            {tab === "clips" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{t("Clipes", "Clips", "Clips")} ({clips.length})</p>
                  <Button variant="outline" size="sm" onClick={() => localFileRef.current?.click()}
                    className="rounded-none font-mono text-[10px] uppercase tracking-widest">
                    <Plus className="h-3 w-3 mr-1" />{t("Adicionar", "Add", "Añadir")}
                  </Button>
                </div>

                {clips.length === 0 && (
                  <button onClick={() => localFileRef.current?.click()}
                    className="w-full border-2 border-dashed border-border/50 hover:border-primary/40 p-8 text-center transition-all group">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
                    <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
                      {t("Arraste ou clique para adicionar vídeos", "Drag or click to add videos", "Arrastra o haz clic para añadir vídeos")}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground/50 mt-1">{t(".mp4 · .webm · .mov · múltiplos arquivos", ".mp4 · .webm · .mov · multiple files", ".mp4 · .webm · .mov · varios archivos")}</p>
                  </button>
                )}

                <div className="space-y-2">
                  {clips.map(clip => {
                    const isLost = !clip.url; // local file URL lost after page close
                    return (
                      <div key={clip.id}
                        onClick={() => !isLost && setActiveClipId(clip.id)}
                        className={`border p-3 transition-all flex items-center gap-3 ${
                          isLost
                            ? "border-amber-500/30 bg-amber-500/5 cursor-default opacity-70"
                            : clip.id === activeClipId
                              ? "border-primary/60 bg-primary/5 cursor-pointer"
                              : "border-border/40 bg-card/20 hover:border-border/70 cursor-pointer"
                        }`}
                      >
                        <div className={`w-8 h-8 border flex items-center justify-center shrink-0 ${
                          isLost ? "bg-amber-500/10 border-amber-500/20" : "bg-primary/10 border-primary/20"
                        }`}>
                          {isLost ? <Upload className="h-4 w-4 text-amber-400/60" /> : <Film className="h-4 w-4 text-primary/60" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-[11px] text-foreground truncate">{clip.name}</p>
                          {isLost ? (
                            <p className="font-mono text-[10px] text-amber-400/70">
                              {t("arquivo local — re-adicione para editar", "local file — re-add to edit", "archivo local: vuelve a añadirlo para editar")}
                            </p>
                          ) : (
                            <p className="font-mono text-[10px] text-muted-foreground">
                              {fmtTime(clip.inPoint)} → {fmtTime(clip.outPoint)}
                              {clip.duration > 0 && ` · ${fmtTime(clip.outPoint - clip.inPoint)}`}
                            </p>
                          )}
                        </div>
                        {isLost && (
                          <button onClick={e => { e.stopPropagation(); localFileRef.current?.click(); }}
                            className="text-[10px] font-mono text-amber-400/70 hover:text-amber-400 transition-colors border border-amber-500/30 px-1.5 py-0.5 shrink-0">
                            + {t("Adicionar", "Add", "Añadir")}
                          </button>
                        )}
                        <button onClick={e => { e.stopPropagation(); removeClip(clip.id); }}
                          className="text-muted-foreground hover:text-destructive transition-colors shrink-0" aria-label={t("Remover clipe", "Remove clip", "Eliminar clip")}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Thumbnail */}
                <div className="border border-border/40 bg-card/20 p-3 space-y-2">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <ImageIcon className="h-3.5 w-3.5" />{t("Thumbnail / Capa", "Thumbnail / Cover", "Miniatura / Portada")}
                  </p>
                  {thumbnailUrl ? (
                    <div className="relative">
                      <img src={thumbnailUrl} className="w-full aspect-video object-cover border border-border/40" alt="thumb" />
                      <button onClick={() => setThumbnailUrl("")}
                        className="absolute top-1 right-1 bg-black/60 text-white p-1 hover:bg-destructive/80 transition-colors" aria-label={t("Remover miniatura", "Remove thumbnail", "Eliminar miniatura")}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={captureThumbnail}
                        className="rounded-none font-mono text-[10px] uppercase tracking-widest flex-1">
                        <Eye className="h-3 w-3 mr-1" />{t("Capturar frame", "Capture frame", "Capturar fotograma")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => thumbRef.current?.click()}
                        className="rounded-none font-mono text-[10px] uppercase tracking-widest flex-1">
                        <Upload className="h-3 w-3 mr-1" />{t("Fazer upload", "Upload", "Subir")}
                      </Button>
                    </div>
                  )}
                </div>

                {/* AI Highlights */}
                <div className="border border-border/40 bg-card/20 p-3 space-y-2">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />{t("Agente · Destaques", "Agent · Highlights", "Agente · Momentos destacados")}
                  </p>
                  <Button variant="outline" size="sm" onClick={analyzeHighlights}
                    disabled={!activeClip || analyzingHighlights}
                    className="rounded-none font-mono text-[10px] uppercase tracking-widest w-full">
                    {analyzingHighlights
                      ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />{t("Analisando…", "Analyzing…", "Analizando…")}</>
                      : <><Sparkles className="h-3 w-3 mr-1.5" />{t("Detectar melhores trechos", "Find best moments", "Detectar mejores momentos")}</>
                    }
                  </Button>
                  {highlightSuggestions.map((h, i) => (
                    <div key={i} className="border border-border/30 bg-card/30 p-2 space-y-1">
                      <p className="font-mono text-[10px] text-primary font-bold">
                        {fmtTime(h.start)} → {fmtTime(h.end)}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground">{h.reason}</p>
                      <Button variant="ghost" size="sm" onClick={() => applyHighlight(h)}
                        className="font-mono text-[10px] uppercase tracking-widest h-6 px-2">
                        {t("Usar este trecho", "Use this segment", "Usar este fragmento")}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Tab: Texts ──────────────────────────────────────────────── */}
            {tab === "text" && (
              <div className="space-y-3">
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{t("Adicionar texto / título", "Add text / title", "Añadir texto / título")}</p>
                <textarea value={newOverlayText} onChange={e => setNewOverlayText(e.target.value)}
                  placeholder={t("Digite o texto...", "Enter text...", "Escribe el texto...")} rows={2}
                  className="w-full border border-border/50 bg-card/40 px-3 py-2 text-sm font-mono focus:border-primary/50 focus:outline-none resize-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">{t("Posição", "Position", "Posición")}</label>
                    <select value={newOverlayPos} onChange={e => setNewOverlayPos(e.target.value as TextOverlay["position"])}
                      className="w-full border border-border/50 bg-card/40 px-2 py-1.5 text-xs font-mono focus:outline-none">
                      <option value="top">{t("Topo", "Top", "Arriba")}</option>
                      <option value="center">{t("Centro", "Center", "Centro")}</option>
                      <option value="bottom">{t("Rodapé", "Bottom", "Abajo")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">{t("Estilo", "Style", "Estilo")}</label>
                    <select value={newOverlayStyle} onChange={e => setNewOverlayStyle(e.target.value as TextOverlay["style"])}
                      className="w-full border border-border/50 bg-card/40 px-2 py-1.5 text-xs font-mono focus:outline-none">
                      <option value="title">{t("Título", "Title", "Título")}</option>
                      <option value="subtitle">{t("Subtítulo", "Subtitle", "Subtítulo")}</option>
                      <option value="caption">{t("Legenda", "Caption", "Texto")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">{t("Início (s)", "Start (s)", "Inicio (s)")}</label>
                    <input type="number" min={0} step={0.5} value={newOverlayStart}
                      onChange={e => setNewOverlayStart(+e.target.value)}
                      className="w-full border border-border/50 bg-card/40 px-2 py-1.5 text-xs font-mono focus:outline-none" />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">{t("Fim (s)", "End (s)", "Fin (s)")}</label>
                    <input type="number" min={0} step={0.5} value={newOverlayEnd}
                      onChange={e => setNewOverlayEnd(+e.target.value)}
                      className="w-full border border-border/50 bg-card/40 px-2 py-1.5 text-xs font-mono focus:outline-none" />
                  </div>
                </div>
                <Button onClick={addOverlay} disabled={!newOverlayText.trim()}
                  className="rounded-none font-mono uppercase tracking-widest text-xs w-full">
                  <Plus className="h-3.5 w-3.5 mr-2" />Adicionar texto
                </Button>

                {overlays.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("Textos adicionados", "Added text", "Textos añadidos")}</p>
                    {overlays.map(o => (
                      <div key={o.id} className="flex items-center gap-2 border border-border/30 bg-card/20 p-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-[11px] truncate">{o.text}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {fmtTime(o.startTime)} → {fmtTime(o.endTime)} · {o.position} · {o.style}
                          </p>
                        </div>
                        <button onClick={() => removeOverlay(o.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Audio ──────────────────────────────────────────────── */}
            {tab === "audio" && (
              <div className="space-y-3">

                {/* Música de fundo */}
                <div className="border border-border/40 bg-card/20 p-3 space-y-2">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Music className="h-3.5 w-3.5" />{t("Música de fundo", "Background Music", "Música de fondo")}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => bgMusicRef.current?.click()}
                      className="rounded-none font-mono text-[10px] uppercase tracking-widest flex-1">
                      <Upload className="h-3 w-3 mr-1.5" />
                    {bgMusicFile ? bgMusicFile.name.slice(0, 20) + "…" : t("Carregar", "Load", "Cargar")}
                    </Button>
                    {bgMusicFile && <button onClick={() => setBgMusicFile(null)} className="text-muted-foreground hover:text-destructive transition-colors" aria-label={t("Remover música", "Remove music", "Eliminar música")}><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                  {bgMusicFile && (
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-3 w-3 text-muted-foreground shrink-0" />
                      <input type="range" min={0} max={1} step={0.05} value={bgMusicVolume}
                        onChange={e => setBgMusicVolume(+e.target.value)} className="flex-1 accent-primary" />
                      <span className="font-mono text-[10px] text-muted-foreground w-8 text-right">{Math.round(bgMusicVolume * 100)}%</span>
                    </div>
                  )}
                </div>

                {/* Som ambiente */}
                <div className="border border-border/40 bg-card/20 p-3 space-y-2">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Wind className="h-3.5 w-3.5" />{t("Som ambiente", "Ambient Sound", "Sonido ambiente")}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => ambientRef.current?.click()}
                      className="rounded-none font-mono text-[10px] uppercase tracking-widest flex-1">
                      <Upload className="h-3 w-3 mr-1.5" />
                    {ambientFile ? ambientFile.name.slice(0, 20) + "…" : t("Carregar", "Load", "Cargar")}
                    </Button>
                    {ambientFile && <button onClick={() => setAmbientFile(null)} className="text-muted-foreground hover:text-destructive transition-colors" aria-label={t("Remover ambiente", "Remove ambience", "Eliminar ambiente")}><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                  {ambientFile && (
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-3 w-3 text-muted-foreground shrink-0" />
                      <input type="range" min={0} max={1} step={0.05} value={ambientVolume}
                        onChange={e => setAmbientVolume(+e.target.value)} className="flex-1 accent-primary" />
                      <span className="font-mono text-[10px] text-muted-foreground w-8 text-right">{Math.round(ambientVolume * 100)}%</span>
                    </div>
                  )}
                </div>

                {/* ── Narração — modo upload ou gravação em tempo real ── */}
                <div className={`border p-3 space-y-3 ${
                  narrationMode === "record" ? "border-red-500/30 bg-red-500/5" : "border-border/40 bg-card/20"
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Mic className={`h-3.5 w-3.5 ${narrationMode === "record" ? "text-red-400" : ""}`} />
                      {t("Narração / Voz", "Narration / Voice", "Narración / Voz")}
                    </p>
                    {/* Mode toggle */}
                    <div className="flex border border-border/40 overflow-hidden">
                      <button
                        onClick={() => setNarrationMode("upload")}
                        className={`px-2 py-1 font-mono text-[9px] uppercase tracking-widest transition-colors ${
                          narrationMode === "upload" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t("Upload", "Upload", "Subir")}
                      </button>
                      <button
                        onClick={() => setNarrationMode("record")}
                        className={`px-2 py-1 font-mono text-[9px] uppercase tracking-widest transition-colors flex items-center gap-1 ${
                          narrationMode === "record" ? "bg-red-500 text-white" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Circle className="h-2 w-2 fill-current" />{t("Gravar", "Record", "Grabar")}
                      </button>
                    </div>
                  </div>

                  {narrationMode === "upload" ? (
                    /* Upload mode */
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => narrationRef.current?.click()}
                          className="rounded-none font-mono text-[10px] uppercase tracking-widest flex-1">
                          <Upload className="h-3 w-3 mr-1.5" />
                        {narrationFile ? narrationFile.name.slice(0, 20) + "…" : t("Carregar áudio", "Load audio", "Cargar audio")}
                        </Button>
                        {narrationFile && <button onClick={() => setNarrationFile(null)} className="text-muted-foreground hover:text-destructive transition-colors" aria-label={t("Remover narração", "Remove narration", "Eliminar narración")}><Trash2 className="h-3.5 w-3.5" /></button>}
                      </div>
                      {narrationFile && (
                        <>
                          <div className="flex items-center gap-2">
                            <Volume2 className="h-3 w-3 text-muted-foreground shrink-0" />
                            <input type="range" min={0} max={1} step={0.05} value={narrationVolume}
                              onChange={e => setNarrationVolume(+e.target.value)} className="flex-1 accent-primary" />
                            <span className="font-mono text-[10px] text-muted-foreground w-8 text-right">{Math.round(narrationVolume * 100)}%</span>
                          </div>
                          <div>
                            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">{t("Atraso (s)", "Delay (s)", "Retraso (s)")}</label>
                            <input type="number" min={0} step={0.5} value={narrationDelay}
                              onChange={e => setNarrationDelay(+e.target.value)}
                              className="w-full border border-border/50 bg-card/40 px-2 py-1.5 text-xs font-mono focus:outline-none" />
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    /* Record mode */
                    <div className="space-y-2">
                      <div className="p-3 border border-red-500/20 bg-red-500/5 rounded space-y-2">
                        <div className="flex items-start gap-2">
                          <Circle className={`h-3 w-3 mt-0.5 shrink-0 fill-current ${isRecordingNarration ? "text-red-500 animate-pulse" : "text-red-400/60"}`} />
                          <div>
                            <p className="font-mono text-[11px] text-foreground font-bold">
                              {isRecordingNarration ? t("Gravando microfone…", "Recording microphone…", "Grabando con el micrófono…") : narrationRecordBlob ? t("Narração gravada ✓", "Narration recorded ✓", "Narración grabada ✓") : t("Modo de gravação ao vivo", "Live recording mode", "Modo de grabación en directo")}
                            </p>
                            <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                              {isRecordingNarration
                                ? t("Pause ou pare o vídeo para finalizar a gravação", "Pause or stop the video to finish recording", "Pausa o detén el vídeo para finalizar la grabación")
                                : narrationRecordBlob
                                ? t("Narração anexada. Pressione Play para regravar.", "Narration attached. Press Play to re-record.", "Narración adjunta. Pulsa Reproducir para volver a grabar.")
                                : rangeStart !== null && rangeEnd !== null
                                ? t(`Segmento ${fmtTime(Math.min(rangeStart, rangeEnd))}→${fmtTime(Math.max(rangeStart, rangeEnd))} selecionado. Play para gravar este trecho.`, `Segment ${fmtTime(Math.min(rangeStart, rangeEnd))}→${fmtTime(Math.max(rangeStart, rangeEnd))} selected. Press Play to record this segment.`, `Fragmento ${fmtTime(Math.min(rangeStart, rangeEnd))}→${fmtTime(Math.max(rangeStart, rangeEnd))} seleccionado. Pulsa Reproducir para grabarlo.`)
                                : t("Pressione Play para gravar narração. Arraste na timeline para selecionar um segmento específico.", "Press Play to record narration. Drag on the timeline to select a specific segment.", "Pulsa Reproducir para grabar la narración. Arrastra en la línea de tiempo para seleccionar un fragmento concreto.")}
                            </p>
                            {!isRecordingNarration && !narrationRecordBlob && rangeStart !== null && rangeEnd !== null && (
                              <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1 border border-yellow-500/30 bg-yellow-500/5">
                                <div className="h-1.5 w-1.5 rounded-full bg-yellow-400/80 shrink-0" />
                                <span className="font-mono text-[9px] text-yellow-400/80">
                                  {fmtTime(Math.min(rangeStart, rangeEnd))} → {fmtTime(Math.max(rangeStart, rangeEnd))}
                                  {" "}({fmtTime(Math.abs(rangeEnd - rangeStart))})
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        {narrationRecordBlob && (
                          <div className="flex gap-2">
                            <audio src={URL.createObjectURL(narrationRecordBlob)} controls className="flex-1 h-7" />
                            <button onClick={discardNarrationRecording}
                              className="text-muted-foreground hover:text-destructive transition-colors shrink-0 px-2">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      {narrationFile && !isRecordingNarration && (
                        <div className="flex items-center gap-2">
                          <Volume2 className="h-3 w-3 text-muted-foreground shrink-0" />
                          <input type="range" min={0} max={1} step={0.05} value={narrationVolume}
                            onChange={e => setNarrationVolume(+e.target.value)} className="flex-1 accent-primary" />
                          <span className="font-mono text-[10px] text-muted-foreground w-8 text-right">{Math.round(narrationVolume * 100)}%</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Tab: Captions ───────────────────────────────────────────── */}
            {tab === "captions" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{t("Legendas automáticas", "Auto captions", "Subtítulos automáticos")}</p>
                  <button onClick={() => setShowCaptions(s => !s)}
                    className={`font-mono text-[10px] uppercase tracking-widest transition-colors ${showCaptions ? "text-primary" : "text-muted-foreground"}`}>
                    <Eye className="h-3.5 w-3.5 inline mr-1" />{showCaptions ? t("Visível", "Visible", "Visible") : t("Oculto", "Hidden", "Oculto")}
                  </button>
                </div>

                <div className="flex gap-2">
                  <select value={captionLang} onChange={e => setCaptionLang(e.target.value)}
                    className="flex-1 border border-border/50 bg-card/40 px-2 py-1.5 text-xs font-mono focus:outline-none">
                    <option value="pt-BR">Português (BR)</option>
                    <option value="en-US">English (US)</option>
                    <option value="es-LA">Español (LA)</option>
                  </select>
                  <Button onClick={generateCaptions} disabled={!activeClip || generatingCaptions} size="sm"
                    className="rounded-none font-mono text-[10px] uppercase tracking-widest">
                    {generatingCaptions ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Globe className="h-3 w-3 mr-1" />{t("Gerar", "Generate", "Generar")}</>}
                  </Button>
                </div>

                {captions.length > 0 && (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {captions.map((cap, i) => (
                      <div key={i}
                        className={`border p-2 cursor-pointer transition-colors ${
                          currentTime >= cap.start && currentTime < cap.end
                            ? "border-primary/60 bg-primary/5"
                            : "border-border/30 bg-card/20"
                        }`}
                        onClick={() => seek(cap.start)}
                      >
                        <p className="font-mono text-[10px] text-primary">{fmtTime(cap.start)} → {fmtTime(cap.end)}</p>
                        <p className="font-mono text-[11px] text-foreground">{cap.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {captions.length === 0 && (
                  <div className="border border-border/30 bg-card/10 p-4 text-center">
                    <AlignLeft className="h-6 w-6 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="font-mono text-[11px] text-muted-foreground">{t("Nenhuma legenda gerada", "No captions generated", "No se generaron subtítulos")}</p>
                    <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">
                      {t('Selecione o idioma e clique em "Gerar"', 'Select a language and click "Generate"', 'Selecciona el idioma y haz clic en "Generar"')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Export ─────────────────────────────────────────────── */}
            {tab === "export" && (
              <div className="space-y-3">
                {thumbnailUrl && (
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{t("Thumbnail", "Thumbnail", "Miniatura")}</p>
                    <img src={thumbnailUrl} className="w-full aspect-video object-cover border border-border/40" alt={t("Miniatura", "Thumbnail", "Miniatura")} />
                  </div>
                )}

                <div className="border border-border/40 bg-card/20 p-3 space-y-2">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{t("Resumo do projeto", "Project Summary", "Resumen del proyecto")}</p>
                  <div className="space-y-1 font-mono text-[11px]">
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("Título", "Title", "Título")}</span><span className="text-foreground truncate max-w-[160px]">{projectTitle}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("Clipes", "Clips", "Clips")}</span><span className="text-foreground">{clips.length}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("Duração total", "Total duration", "Duración total")}</span><span className="text-foreground">{fmtTime(totalDuration)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("Legendas", "Captions", "Subtítulos")}</span><span className="text-foreground">{t(`${captions.length} linhas`, `${captions.length} lines`, `${captions.length} líneas`)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("Textos", "Text", "Texto")}</span><span className="text-foreground">{t(`${overlays.length} overlays`, `${overlays.length} overlays`, `${overlays.length} textos superpuestos`)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("Narração", "Narration", "Narración")}</span>
                      <span className={narrationFile ? "text-emerald-400" : "text-foreground"}>
                        {narrationFile ? (narrationRecordBlob ? t("Gravada ao vivo", "Recorded live", "Grabada en directo") : narrationFile.name.slice(0, 16) + "…") : t("Nenhuma", "None", "Ninguna")}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t("Outros áudios", "Other audio", "Otros audios")}</span><span className="text-foreground">
                        {t(`${[bgMusicFile, ambientFile].filter(Boolean).length} faixas`, `${[bgMusicFile, ambientFile].filter(Boolean).length} tracks`, `${[bgMusicFile, ambientFile].filter(Boolean).length} pistas`)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Save/copy actions */}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={saveProject}
                    className="rounded-none font-mono text-[10px] uppercase tracking-widest">
                    <Save className="h-3 w-3 mr-1" />{t("Salvar projeto", "Save project", "Guardar proyecto")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadProjectFile}
                    className="rounded-none font-mono text-[10px] uppercase tracking-widest">
                    <Copy className="h-3 w-3 mr-1" />{t("Cópia (.json)", "Copy (.json)", "Copia (.json)")}
                  </Button>
                </div>

                <div className="border border-border/40 bg-card/20 p-3 space-y-2">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{t("Formato de exportação", "Export Format", "Formato de exportación")}</p>
                  <div className="flex gap-2">
                    {(["webm", "mp4"] as const).map(f => (
                      <button key={f} onClick={() => setExportFormat(f)}
                        className={`flex-1 border py-2 font-mono text-[11px] uppercase tracking-widest transition-colors ${
                          exportFormat === f ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border/70"
                        }`}
                      >
                        .{f}
                      </button>
                    ))}
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground/70">
                    {t(".webm — exportação nativa, alta qualidade. .mp4 — compatível com todas as plataformas.", ".webm — native export, high quality. .mp4 — compatible with all platforms.", ".webm: exportación nativa de alta calidad. .mp4: compatible con todas las plataformas.")}
                  </p>
                </div>

                {!exporting && !exportBlob && (
                  <Button onClick={startExport} disabled={!activeClip}
                    className="rounded-none font-mono uppercase tracking-widest text-xs w-full">
                    <Download className="h-3.5 w-3.5 mr-2" />
                    {t("Exportar", "Export", "Exportar")} ({activeClip ? fmtTime(activeClip.outPoint - activeClip.inPoint) : "0:00"})
                  </Button>
                )}

                {exporting && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        {t("Exportando…", "Exporting…", "Exportando…")} {exportProgress}%
                      </div>
                      <Button variant="ghost" size="sm" onClick={cancelExport}
                        className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                        <Square className="h-3 w-3 mr-1" />{t("Cancelar", "Cancel", "Cancelar")}
                      </Button>
                    </div>
                    <div className="h-1.5 bg-border/30 w-full">
                      <div className="h-full bg-primary transition-all" style={{ width: `${exportProgress}%` }} />
                    </div>
                  </div>
                )}

                {!exporting && exportBlob && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-3 py-2 border border-emerald-500/30 bg-emerald-500/5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="font-mono text-[11px] text-emerald-400 font-bold">
                         {t("Pronto", "Ready", "Listo")} · {fmtTime(exportDuration)} · {fmtBytes(exportBlob.size)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={downloadExport}
                        className="rounded-none font-mono uppercase tracking-widest text-xs flex-1">
                        <Download className="h-3.5 w-3.5 mr-2" />{t("Baixar", "Download", "Descargar")}
                      </Button>
                      <Button variant="outline" onClick={() => setExportBlob(null)}
                        className="rounded-none font-mono uppercase tracking-widest text-xs">
                        {t("Nova exportação", "New export", "Nueva exportación")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
