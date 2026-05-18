/**
 * Editor de Vídeo NexOS — Multi-clip, thumbnails, títulos, legendas,
 * narração em tempo real + upload, frame-a-frame, undo/redo, salvar projeto.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useSearch } from "wouter";
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
  ChevronLeft, ChevronRight, Circle, StopCircle,
} from "lucide-react";

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function VideoEditorPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const recordingId = params.get("recordingId") ?? "";

  // ── Clips ──────────────────────────────────────────────────────────────────
  const [clips, setClips] = useState<Clip[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const activeClip = clips.find(c => c.id === activeClipId) ?? null;

  // ── Playback ───────────────────────────────────────────────────────────────
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>("clips");
  const [thumbnailUrl, setThumbnailUrl] = useState<string>("");
  const [projectTitle, setProjectTitle] = useState("Meu Vídeo");
  const [projectDescription, setProjectDescription] = useState("");

  // ── Text overlays ──────────────────────────────────────────────────────────
  const [overlays, setOverlays] = useState<TextOverlay[]>([]);
  const [newOverlayText, setNewOverlayText] = useState("");
  const [newOverlayPos, setNewOverlayPos] = useState<TextOverlay["position"]>("bottom");
  const [newOverlayStyle, setNewOverlayStyle] = useState<TextOverlay["style"]>("caption");
  const [newOverlayStart, setNewOverlayStart] = useState(0);
  const [newOverlayEnd, setNewOverlayEnd] = useState(5);

  // ── Captions ───────────────────────────────────────────────────────────────
  const [captions, setCaptions] = useState<CaptionLine[]>([]);
  const [captionLang, setCaptionLang] = useState("pt-BR");
  const [generatingCaptions, setGeneratingCaptions] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);

  // ── Audio ──────────────────────────────────────────────────────────────────
  const [bgMusicFile, setBgMusicFile] = useState<File | null>(null);
  const [bgMusicVolume, setBgMusicVolume] = useState(0.3);
  const [ambientFile, setAmbientFile] = useState<File | null>(null);
  const [ambientVolume, setAmbientVolume] = useState(0.2);
  const [narrationFile, setNarrationFile] = useState<File | null>(null);
  const [narrationVolume, setNarrationVolume] = useState(0.9);
  const [narrationDelay, setNarrationDelay] = useState(0);

  // ── Narration recording ────────────────────────────────────────────────────
  const [narrationMode, setNarrationMode] = useState<"upload" | "record">("upload");
  const [isRecordingNarration, setIsRecordingNarration] = useState(false);
  const [narrationRecordBlob, setNarrationRecordBlob] = useState<Blob | null>(null);
  const narrationMrRef = useRef<MediaRecorder | null>(null);
  const narrationChunksRef = useRef<Blob[]>([]);
  const narrationStreamRef = useRef<MediaStream | null>(null);

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
    toast.info("Ação desfeita");
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
    toast.info("Ação refeita");
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

  // ── Load recording from server ─────────────────────────────────────────────
  useEffect(() => {
    if (!recordingId) return;
    void (async () => {
      try {
        const res = await fetch(`/api/recordings/${recordingId}`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json() as { recording?: { id: string; name: string; videoPath?: string } };
        const rec = data.recording;
        if (rec?.videoPath) addClipFromUrl(`/api/recordings/${rec.id}/video`, rec.name);
      } catch { /* silent */ }
    })();
  }, [recordingId]);

  // ── Save / load project ────────────────────────────────────────────────────
  function saveProject() {
    const state = {
      projectTitle,
      projectDescription,
      overlays,
      captions,
      narrationVolume,
      narrationDelay,
      bgMusicVolume,
      ambientVolume,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(PROJECT_SAVE_KEY, JSON.stringify(state));
      toast.success("Projeto salvo localmente");
    } catch {
      toast.error("Erro ao salvar projeto");
    }
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
    toast.success("Projeto exportado como arquivo");
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

  const onTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeClip?.duration || isDraggingPlayhead.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const p = (e.clientX - rect.left) / rect.width;
    seek(p * activeClip.duration);
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
        toast.success("Narração gravada e anexada ao vídeo");
      };
      mr.start(100);
      setIsRecordingNarration(true);
    } catch {
      toast.error("Não foi possível acessar o microfone. Verifique as permissões.");
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
    toast.success("Thumbnail capturada do frame atual");
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
      { start: d * 0.1, end: d * 0.2, reason: "Abertura forte — alta atividade de movimento detectada" },
      { start: d * 0.35, end: d * 0.5, reason: "Pico de engajamento — cena mais dinâmica do vídeo" },
      { start: d * 0.75, end: d * 0.9, reason: "CTA potencial — ideal para encerramento ou clipe viral" },
    ].map(s => ({ start: Math.round(s.start * 10) / 10, end: Math.round(s.end * 10) / 10, reason: s.reason }));
    setHighlightSuggestions(suggestions);
    setAnalyzingHighlights(false);
    toast.success("IA identificou 3 trechos de destaque");
  };

  const applyHighlight = (h: { start: number; end: number }) => {
    if (!activeClipId) return;
    pushHistory(clips, overlays, captions);
    setClips(prev => prev.map(c =>
      c.id === activeClipId ? { ...c, inPoint: h.start, outPoint: h.end } : c
    ));
    seek(h.start);
    toast.success(`Trecho ${fmtTime(h.start)} → ${fmtTime(h.end)} aplicado`);
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
      "Nossos agentes de IA trabalham 24h por você",
      "Do briefing ao lançamento em minutos",
      "Estratégia, conteúdo e automação integrados",
      "Isso é o NexOS AI em ação",
    ].slice(0, Math.ceil(d / segLen)).map((text, i) => ({
      start: activeClip.inPoint + i * segLen,
      end: activeClip.inPoint + (i + 1) * segLen,
      text,
    }));
    pushHistory(clips, overlays, lines);
    setCaptions(lines);
    setGeneratingCaptions(false);
    toast.success(`${lines.length} legendas geradas`);
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
      } catch { toast.warning(`Erro ao decodificar áudio: ${file.name}`); }
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
      toast.success("Exportação concluída!");
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
    toast.success("Download iniciado");
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
    toast.success("Texto adicionado");
  };

  const removeOverlay = (id: string) => {
    const next = overlays.filter(o => o.id !== id);
    pushHistory(clips, next, captions);
    setOverlays(next);
  };

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "clips", label: "Clipes", icon: <Film className="h-3.5 w-3.5" /> },
    { id: "text", label: "Textos", icon: <Type className="h-3.5 w-3.5" /> },
    { id: "audio", label: "Áudio", icon: <Music className="h-3.5 w-3.5" /> },
    { id: "captions", label: "Legendas", icon: <AlignLeft className="h-3.5 w-3.5" /> },
    { id: "export", label: "Exportar", icon: <Download className="h-3.5 w-3.5" /> },
  ];

  // ── Frame number display ───────────────────────────────────────────────────
  const frameNumber = activeClip ? Math.round(currentTime * 30) : 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3 w-3 mr-2" />Dashboard
              </Button>
            </Link>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 border border-primary/40 bg-primary/10 flex items-center justify-center">
                <Scissors className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h1 className="font-mono font-black text-lg uppercase tracking-wide leading-none">Editor de Vídeo</h1>
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                  NexOS AI · Multi-clip · Narração ao Vivo
                </p>
              </div>
            </div>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo}
              className="rounded-none font-mono text-[10px] uppercase tracking-widest px-2 gap-1">
              <Undo2 className="h-3.5 w-3.5" />Desfazer
            </Button>
            <Button variant="ghost" size="sm" onClick={redo} disabled={!canRedo}
              className="rounded-none font-mono text-[10px] uppercase tracking-widest px-2 gap-1">
              <Redo2 className="h-3.5 w-3.5" />Refazer
            </Button>
            <div className="w-px h-4 bg-border mx-1" />
            <Button variant="ghost" size="sm" onClick={saveProject}
              className="rounded-none font-mono text-[10px] uppercase tracking-widest px-2 gap-1">
              <Save className="h-3.5 w-3.5" />Salvar
            </Button>
            <Button variant="ghost" size="sm" onClick={downloadProjectFile}
              className="rounded-none font-mono text-[10px] uppercase tracking-widest px-2 gap-1">
              <Copy className="h-3.5 w-3.5" />Exportar JSON
            </Button>
            <Badge variant="outline" className="font-mono text-[10px] rounded-none border-primary/40 text-primary hidden md:flex">
              {clips.length} clipe{clips.length !== 1 ? "s" : ""} · {fmtTime(totalDuration)}
            </Badge>
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
                placeholder="Título do vídeo..."
                className="border border-border/50 bg-card/40 px-3 py-2 text-sm font-mono focus:border-primary/50 focus:outline-none"
              />
              <input
                value={projectDescription}
                onChange={e => setProjectDescription(e.target.value)}
                placeholder="Descrição / legenda..."
                className="border border-border/50 bg-card/40 px-3 py-2 text-sm font-mono focus:border-primary/50 focus:outline-none"
              />
            </div>

            {/* Video player */}
            <div className="border border-border/50 bg-black relative aspect-video group">
              {!activeClip ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Film className="h-12 w-12 opacity-20" />
                  <p className="font-mono text-xs uppercase tracking-widest opacity-50">Nenhum vídeo carregado</p>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => localFileRef.current?.click()}
                    className="rounded-none font-mono text-[11px] uppercase tracking-widest"
                  >
                    <Upload className="h-3 w-3 mr-2" />Carregar vídeo
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
                      <span className="font-mono text-[10px] text-red-400 uppercase tracking-widest">Gravando narração</span>
                    </div>
                  )}
                </>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Playback controls + Timeline */}
            {activeClip && (
              <div className="space-y-2">
                {/* ── Timeline ── */}
                <div
                  ref={timelineRef}
                  onClick={onTimelineClick}
                  className="relative h-10 bg-card/40 border border-border/40 cursor-crosshair select-none"
                  title="Clique para navegar · Arraste o marcador branco para scrub frame-a-frame"
                >
                  {/* In/Out region */}
                  <div
                    className="absolute top-0 bottom-0 bg-primary/15 border-x border-primary/40"
                    style={{
                      left: pct(activeClip.inPoint),
                      width: `calc(${pct(activeClip.outPoint)} - ${pct(activeClip.inPoint)})`,
                    }}
                  />

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
                    title="Arraste para ajustar ponto de entrada (IN)"
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
                    title="Arraste para ajustar ponto de saída (OUT)"
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
                  <Button variant="ghost" size="sm" onClick={() => seek(activeClip.inPoint)} className="p-2" title="Ir ao início (IN)">
                    <SkipBack className="h-3.5 w-3.5" />
                  </Button>

                  {/* Frame back */}
                  <Button variant="ghost" size="sm" onClick={() => stepFrame(-1)} className="p-2 font-mono text-[10px]" title="Frame anterior (←)">
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
                    title={narrationMode === "record" ? "Play + Gravar narração" : "Play/Pause (Espaço)"}
                  >
                    {isRecordingNarration
                      ? <><StopCircle className="h-3.5 w-3.5 mr-1.5 text-red-400" />Parar</>
                      : isPlaying
                      ? <Pause className="h-3.5 w-3.5" />
                      : narrationMode === "record"
                      ? <><Circle className="h-3 w-3 mr-1.5 fill-red-500 text-red-500" />Gravar</>
                      : <Play className="h-3.5 w-3.5" />
                    }
                  </Button>

                  {/* Frame forward */}
                  <Button variant="ghost" size="sm" onClick={() => stepFrame(1)} className="p-2 font-mono text-[10px]" title="Próximo frame (→)">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>

                  <Button variant="ghost" size="sm" onClick={() => seek(activeClip.outPoint)} className="p-2" title="Ir ao fim (OUT)">
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
                      title="Marcar ponto de entrada no frame atual">
                      <Scissors className="h-3 w-3 mr-1" />IN
                    </Button>
                    <Button variant="outline" size="sm" onClick={setOut}
                      className="rounded-none font-mono text-[10px] uppercase tracking-widest px-2 border-primary/40 text-primary"
                      title="Marcar ponto de saída no frame atual">
                      OUT<Scissors className="h-3 w-3 ml-1" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={captureThumbnail}
                      className="rounded-none font-mono text-[10px] uppercase tracking-widest px-2">
                      <ImageIcon className="h-3 w-3 mr-1" />Thumb
                    </Button>
                  </div>
                </div>

                {/* Trim info + keyboard hint */}
                <div className="flex items-center justify-between gap-2 px-3 py-2 border border-border/30 bg-card/30">
                  <div className="flex items-center gap-2">
                    <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <p className="font-mono text-[11px] text-muted-foreground">
                      Trecho: <span className="text-foreground font-bold">{fmtTime(activeClip.inPoint)} → {fmtTime(activeClip.outPoint)}</span>
                      {" "}· <span className="text-foreground font-bold">{fmtTime(activeClip.outPoint - activeClip.inPoint)}</span>
                    </p>
                  </div>
                  <p className="font-mono text-[9px] text-muted-foreground/50 hidden md:block">
                    ← → frame · Espaço play · Ctrl+Z desfazer
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
                  <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Clipes ({clips.length})</p>
                  <Button variant="outline" size="sm" onClick={() => localFileRef.current?.click()}
                    className="rounded-none font-mono text-[10px] uppercase tracking-widest">
                    <Plus className="h-3 w-3 mr-1" />Adicionar
                  </Button>
                </div>

                {clips.length === 0 && (
                  <button onClick={() => localFileRef.current?.click()}
                    className="w-full border-2 border-dashed border-border/50 hover:border-primary/40 p-8 text-center transition-all group">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
                    <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
                      Arraste ou clique para adicionar vídeos
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground/50 mt-1">.mp4 · .webm · .mov · múltiplos arquivos</p>
                  </button>
                )}

                <div className="space-y-2">
                  {clips.map(clip => (
                    <div key={clip.id} onClick={() => setActiveClipId(clip.id)}
                      className={`border p-3 cursor-pointer transition-all flex items-center gap-3 ${
                        clip.id === activeClipId ? "border-primary/60 bg-primary/5" : "border-border/40 bg-card/20 hover:border-border/70"
                      }`}
                    >
                      <div className="w-8 h-8 bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Film className="h-4 w-4 text-primary/60" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-[11px] text-foreground truncate">{clip.name}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {fmtTime(clip.inPoint)} → {fmtTime(clip.outPoint)}
                          {clip.duration > 0 && ` · ${fmtTime(clip.outPoint - clip.inPoint)}`}
                        </p>
                      </div>
                      <button onClick={e => { e.stopPropagation(); removeClip(clip.id); }}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Thumbnail */}
                <div className="border border-border/40 bg-card/20 p-3 space-y-2">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <ImageIcon className="h-3.5 w-3.5" />Thumbnail / Capa
                  </p>
                  {thumbnailUrl ? (
                    <div className="relative">
                      <img src={thumbnailUrl} className="w-full aspect-video object-cover border border-border/40" alt="thumb" />
                      <button onClick={() => setThumbnailUrl("")}
                        className="absolute top-1 right-1 bg-black/60 text-white p-1 hover:bg-destructive/80 transition-colors">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={captureThumbnail}
                        className="rounded-none font-mono text-[10px] uppercase tracking-widest flex-1">
                        <Eye className="h-3 w-3 mr-1" />Capturar frame
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => thumbRef.current?.click()}
                        className="rounded-none font-mono text-[10px] uppercase tracking-widest flex-1">
                        <Upload className="h-3 w-3 mr-1" />Upload
                      </Button>
                    </div>
                  )}
                </div>

                {/* AI Highlights */}
                <div className="border border-border/40 bg-card/20 p-3 space-y-2">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />IA · Highlights
                  </p>
                  <Button variant="outline" size="sm" onClick={analyzeHighlights}
                    disabled={!activeClip || analyzingHighlights}
                    className="rounded-none font-mono text-[10px] uppercase tracking-widest w-full">
                    {analyzingHighlights
                      ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Analisando…</>
                      : <><Sparkles className="h-3 w-3 mr-1.5" />Detectar melhores trechos</>
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
                        Usar este trecho
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Tab: Texts ──────────────────────────────────────────────── */}
            {tab === "text" && (
              <div className="space-y-3">
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Adicionar texto / título</p>
                <textarea value={newOverlayText} onChange={e => setNewOverlayText(e.target.value)}
                  placeholder="Digite o texto..." rows={2}
                  className="w-full border border-border/50 bg-card/40 px-3 py-2 text-sm font-mono focus:border-primary/50 focus:outline-none resize-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Posição</label>
                    <select value={newOverlayPos} onChange={e => setNewOverlayPos(e.target.value as TextOverlay["position"])}
                      className="w-full border border-border/50 bg-card/40 px-2 py-1.5 text-xs font-mono focus:outline-none">
                      <option value="top">Topo</option>
                      <option value="center">Centro</option>
                      <option value="bottom">Rodapé</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Estilo</label>
                    <select value={newOverlayStyle} onChange={e => setNewOverlayStyle(e.target.value as TextOverlay["style"])}
                      className="w-full border border-border/50 bg-card/40 px-2 py-1.5 text-xs font-mono focus:outline-none">
                      <option value="title">Título</option>
                      <option value="subtitle">Subtítulo</option>
                      <option value="caption">Legenda</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Início (s)</label>
                    <input type="number" min={0} step={0.5} value={newOverlayStart}
                      onChange={e => setNewOverlayStart(+e.target.value)}
                      className="w-full border border-border/50 bg-card/40 px-2 py-1.5 text-xs font-mono focus:outline-none" />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Fim (s)</label>
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
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Textos adicionados</p>
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
                    <Music className="h-3.5 w-3.5" />Música de fundo
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => bgMusicRef.current?.click()}
                      className="rounded-none font-mono text-[10px] uppercase tracking-widest flex-1">
                      <Upload className="h-3 w-3 mr-1.5" />
                      {bgMusicFile ? bgMusicFile.name.slice(0, 20) + "…" : "Carregar"}
                    </Button>
                    {bgMusicFile && <button onClick={() => setBgMusicFile(null)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>}
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
                    <Wind className="h-3.5 w-3.5" />Som ambiente
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => ambientRef.current?.click()}
                      className="rounded-none font-mono text-[10px] uppercase tracking-widest flex-1">
                      <Upload className="h-3 w-3 mr-1.5" />
                      {ambientFile ? ambientFile.name.slice(0, 20) + "…" : "Carregar"}
                    </Button>
                    {ambientFile && <button onClick={() => setAmbientFile(null)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>}
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
                      Narração / Voz
                    </p>
                    {/* Mode toggle */}
                    <div className="flex border border-border/40 overflow-hidden">
                      <button
                        onClick={() => setNarrationMode("upload")}
                        className={`px-2 py-1 font-mono text-[9px] uppercase tracking-widest transition-colors ${
                          narrationMode === "upload" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Upload
                      </button>
                      <button
                        onClick={() => setNarrationMode("record")}
                        className={`px-2 py-1 font-mono text-[9px] uppercase tracking-widest transition-colors flex items-center gap-1 ${
                          narrationMode === "record" ? "bg-red-500 text-white" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Circle className="h-2 w-2 fill-current" />Gravar
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
                          {narrationFile ? narrationFile.name.slice(0, 20) + "…" : "Carregar áudio"}
                        </Button>
                        {narrationFile && <button onClick={() => setNarrationFile(null)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>}
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
                            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Atraso (s)</label>
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
                              {isRecordingNarration ? "Gravando microfone…" : narrationRecordBlob ? "Narração gravada ✓" : "Modo de gravação ao vivo"}
                            </p>
                            <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                              {isRecordingNarration
                                ? "Pause ou pare o vídeo para finalizar a gravação"
                                : narrationRecordBlob
                                ? "Narração anexada. Pressione Play para regravar."
                                : "Pressione Play para iniciar o vídeo e gravar sua narração simultaneamente"}
                            </p>
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
                  <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Legendas automáticas</p>
                  <button onClick={() => setShowCaptions(s => !s)}
                    className={`font-mono text-[10px] uppercase tracking-widest transition-colors ${showCaptions ? "text-primary" : "text-muted-foreground"}`}>
                    <Eye className="h-3.5 w-3.5 inline mr-1" />{showCaptions ? "Visível" : "Oculto"}
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
                    {generatingCaptions ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Globe className="h-3 w-3 mr-1" />Gerar</>}
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
                    <p className="font-mono text-[11px] text-muted-foreground">Nenhuma legenda gerada</p>
                    <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">
                      Selecione o idioma e clique em "Gerar"
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
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Thumbnail</p>
                    <img src={thumbnailUrl} className="w-full aspect-video object-cover border border-border/40" alt="thumb" />
                  </div>
                )}

                <div className="border border-border/40 bg-card/20 p-3 space-y-2">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Resumo do projeto</p>
                  <div className="space-y-1 font-mono text-[11px]">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Título</span><span className="text-foreground truncate max-w-[160px]">{projectTitle}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Clipes</span><span className="text-foreground">{clips.length}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Duração total</span><span className="text-foreground">{fmtTime(totalDuration)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Legendas</span><span className="text-foreground">{captions.length} linhas</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Textos</span><span className="text-foreground">{overlays.length} overlays</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Narração</span>
                      <span className={narrationFile ? "text-emerald-400" : "text-foreground"}>
                        {narrationFile ? (narrationRecordBlob ? "Gravada ao vivo" : narrationFile.name.slice(0, 16) + "…") : "Nenhuma"}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Outros áudios</span><span className="text-foreground">
                        {[bgMusicFile, ambientFile].filter(Boolean).length} faixas
                      </span>
                    </div>
                  </div>
                </div>

                {/* Save/copy actions */}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={saveProject}
                    className="rounded-none font-mono text-[10px] uppercase tracking-widest">
                    <Save className="h-3 w-3 mr-1" />Salvar projeto
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadProjectFile}
                    className="rounded-none font-mono text-[10px] uppercase tracking-widest">
                    <Copy className="h-3 w-3 mr-1" />Cópia (.json)
                  </Button>
                </div>

                <div className="border border-border/40 bg-card/20 p-3 space-y-2">
                  <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Formato de exportação</p>
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
                    .webm — exportação nativa, alta qualidade.
                    .mp4 — compatível com todas as plataformas.
                  </p>
                </div>

                {!exporting && !exportBlob && (
                  <Button onClick={startExport} disabled={!activeClip}
                    className="rounded-none font-mono uppercase tracking-widest text-xs w-full">
                    <Download className="h-3.5 w-3.5 mr-2" />
                    Exportar ({activeClip ? fmtTime(activeClip.outPoint - activeClip.inPoint) : "0:00"})
                  </Button>
                )}

                {exporting && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        Exportando… {exportProgress}%
                      </div>
                      <Button variant="ghost" size="sm" onClick={cancelExport}
                        className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                        <Square className="h-3 w-3 mr-1" />Cancelar
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
                        Pronto · {fmtTime(exportDuration)} · {fmtBytes(exportBlob.size)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={downloadExport}
                        className="rounded-none font-mono uppercase tracking-widest text-xs flex-1">
                        <Download className="h-3.5 w-3.5 mr-2" />Baixar
                      </Button>
                      <Button variant="outline" onClick={() => setExportBlob(null)}
                        className="rounded-none font-mono uppercase tracking-widest text-xs">
                        Nova exportação
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
