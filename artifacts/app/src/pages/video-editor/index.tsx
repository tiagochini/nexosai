/**
 * Editor de Vídeo — simples, 100% no browser.
 *
 * Funcionalidades:
 * - Carrega vídeo do servidor (por recordingId) ou upload local
 * - Player customizado com barra de progresso clicável
 * - Marcadores de corte (In / Out) para selecionar trecho
 * - Overlay de áudio: sobe arquivo de áudio que toca por cima
 * - Exportação via captureStream + MediaRecorder (sem FFmpeg)
 * - Download do resultado em .webm
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearch } from "wouter";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, Upload, Play, Pause, Square, Download, Music,
  Scissors, SkipBack, SkipForward, Volume2, VolumeX,
  Loader2, CheckCircle2, Video, Trash2, Info,
} from "lucide-react";
import { Link } from "wouter";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RecordingMeta {
  id: string;
  name: string;
  state: string;
  videoPath: string | null;
  videoSize: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(s: number): string {
  if (!isFinite(s)) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

function fmtBytes(b: number): string {
  return b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function VideoEditorPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const recordingId = params.get("recordingId") ?? "";

  // ── Video state ────────────────────────────────────────────────────────────
  const [videoUrl, setVideoUrl]     = useState<string>("");
  const [videoName, setVideoName]   = useState<string>("");
  const [duration, setDuration]     = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [volume, setVolume]         = useState(1);
  const [muted, setMuted]           = useState(false);

  // ── Trim state ─────────────────────────────────────────────────────────────
  const [inPoint, setInPoint]       = useState(0);
  const [outPoint, setOutPoint]     = useState(0);

  // ── Audio overlay state ────────────────────────────────────────────────────
  const [audioFile, setAudioFile]   = useState<File | null>(null);
  const [audioVolume, setAudioVolume] = useState(0.5);
  const [audioDelay, setAudioDelay] = useState(0); // seconds from inPoint

  // ── Export state ───────────────────────────────────────────────────────────
  const [exporting, setExporting]   = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportBlob, setExportBlob] = useState<Blob | null>(null);
  const [exportDuration, setExportDuration] = useState(0);

  // ── Server recording ───────────────────────────────────────────────────────
  const [recMeta, setRecMeta]       = useState<RecordingMeta | null>(null);
  const [loadingRec, setLoadingRec] = useState(false);

  const videoRef     = useRef<HTMLVideoElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const timelineRef  = useRef<HTMLDivElement>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);
  const localFileRef = useRef<HTMLInputElement>(null);
  const rafRef       = useRef<number>(0);
  const exportMrRef  = useRef<MediaRecorder | null>(null);

  // ── Load server recording by ID ────────────────────────────────────────────
  useEffect(() => {
    if (!recordingId) return;
    setLoadingRec(true);
    void (async () => {
      try {
        const data = await customFetch<{ recordings: RecordingMeta[] }>("/api/recordings");
        const rec = data.recordings.find(r => r.id === recordingId);
        if (rec) {
          setRecMeta(rec);
          setVideoName(rec.name);
          if (rec.videoPath) {
            const url = `/api/recordings/${rec.id}/video`;
            setVideoUrl(url);
          } else {
            toast.warning("O vídeo ainda não foi enviado ao servidor para esta gravação.");
          }
        } else {
          toast.error("Gravação não encontrada.");
        }
      } catch {
        toast.error("Erro ao carregar gravação.");
      } finally {
        setLoadingRec(false);
      }
    })();
  }, [recordingId]);

  // ── Local file picker ──────────────────────────────────────────────────────
  const handleLocalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setVideoName(file.name);
    setExportBlob(null);
  };

  // ── Video events ───────────────────────────────────────────────────────────
  const onVideoLoaded = () => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration);
    setOutPoint(v.duration);
    setInPoint(0);
  };

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    // Auto-stop at out-point during normal playback
    if (v.currentTime >= outPoint) {
      v.pause();
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v || !videoUrl) return;
    if (isPlaying) {
      v.pause();
      setIsPlaying(false);
    } else {
      if (v.currentTime >= outPoint) v.currentTime = inPoint;
      v.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const seek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.max(0, Math.min(duration, t));
    v.currentTime = clamped;
    setCurrentTime(clamped);
  };

  // ── Timeline click ─────────────────────────────────────────────────────────
  const onTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    seek(pct * duration);
  };

  // ── Set in / out points ────────────────────────────────────────────────────
  const setIn  = () => setInPoint(Math.min(currentTime, outPoint - 0.5));
  const setOut = () => setOutPoint(Math.max(currentTime, inPoint + 0.5));

  const trimDuration = Math.max(0, outPoint - inPoint);

  // ── Export via captureStream ───────────────────────────────────────────────
  const startExport = async () => {
    const v = videoRef.current;
    const canvas = canvasRef.current;
    if (!v || !canvas || !videoUrl) return;

    setExporting(true);
    setExportProgress(0);
    setExportBlob(null);

    // Draw video frames to canvas
    canvas.width  = v.videoWidth  || 1280;
    canvas.height = v.videoHeight || 720;
    const ctx2d = canvas.getContext("2d")!;

    // Setup AudioContext for audio mixing
    const audioCtx = new AudioContext();
    const canvasStream = canvas.captureStream(30);

    // Video audio source
    const vidStream = (v as HTMLVideoElement & { captureStream?: (fps?: number) => MediaStream }).captureStream?.(30);
    const audioStreams: AudioNode[] = [];
    const dest = audioCtx.createMediaStreamDestination();

    if (vidStream) {
      const vidSource = audioCtx.createMediaStreamSource(vidStream);
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = volume;
      vidSource.connect(gainNode);
      gainNode.connect(dest);
    }

    // Optional audio overlay
    let overlayBuffer: AudioBuffer | null = null;
    if (audioFile) {
      try {
        const arrayBuf = await audioFile.arrayBuffer();
        overlayBuffer = await audioCtx.decodeAudioData(arrayBuf);
      } catch {
        toast.warning("Não foi possível decodificar o arquivo de áudio.");
      }
    }

    const finalStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...dest.stream.getAudioTracks(),
    ]);

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";

    const mr = new MediaRecorder(finalStream, { mimeType });
    exportMrRef.current = mr;
    const exportChunks: Blob[] = [];
    mr.ondataavailable = e => { if (e.data.size > 0) exportChunks.push(e.data); };

    let overlaySource: AudioBufferSourceNode | null = null;

    mr.onstop = () => {
      overlaySource?.stop();
      audioCtx.close().catch(() => {});
      cancelAnimationFrame(rafRef.current);
      const blob = new Blob(exportChunks, { type: mimeType });
      setExportBlob(blob);
      setExportDuration(trimDuration);
      setExporting(false);
      setExportProgress(100);
      toast.success("Exportação concluída!");
    };

    mr.start(1000);

    // Start overlay audio after delay
    if (overlayBuffer) {
      const delayMs = Math.max(0, audioDelay) * 1000;
      setTimeout(() => {
        if (overlayBuffer) {
          overlaySource = audioCtx.createBufferSource();
          overlaySource.buffer = overlayBuffer;
          const gainNode = audioCtx.createGain();
          gainNode.gain.value = audioVolume;
          overlaySource.connect(gainNode);
          gainNode.connect(dest);
          overlaySource.start();
        }
      }, delayMs);
    }

    // Seek to in-point and play
    v.currentTime = inPoint;
    v.muted = false;
    v.playbackRate = 1;
    await v.play().catch(() => {});

    const startWall = Date.now();
    const totalMs   = trimDuration * 1000;

    const drawFrame = () => {
      ctx2d.drawImage(v, 0, 0, canvas.width, canvas.height);
      const elapsed = Date.now() - startWall;
      const pct = Math.min(100, (elapsed / totalMs) * 100);
      setExportProgress(Math.round(pct));

      if (v.currentTime < outPoint && elapsed < totalMs + 500) {
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

  // ── Download export ────────────────────────────────────────────────────────
  const downloadExport = () => {
    if (!exportBlob) return;
    const url = URL.createObjectURL(exportBlob);
    const a = document.createElement("a");
    const name = videoName.replace(/[^a-z0-9]/gi, "_").slice(0, 40);
    a.href = url; a.download = `${name}_editado.webm`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast.success("Download iniciado — veja a pasta Downloads.");
  };

  // ── Pct helpers ────────────────────────────────────────────────────────────
  const pct = (t: number) => duration > 0 ? `${((t / duration) * 100).toFixed(2)}%` : "0%";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest -ml-2 text-muted-foreground hover:text-foreground mb-4">
              <ArrowLeft className="h-3 w-3 mr-2" />Dashboard
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border border-primary/40 bg-primary/10 flex items-center justify-center">
              <Video className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-mono font-black text-2xl uppercase tracking-wide">Editor de Vídeo</h1>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                Trim · Corte · Overlay de Áudio · Exportação
              </p>
            </div>
          </div>
        </div>

        {/* Load video section */}
        {!videoUrl && (
          <div className="border border-border/50 bg-card/40 p-6 space-y-4">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Carregar vídeo</p>

            {loadingRec && (
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Carregando gravação do servidor…
              </div>
            )}

            {!loadingRec && recMeta && !recMeta.videoPath && (
              <div className="flex items-center gap-2 px-3 py-2 border border-yellow-400/30 bg-yellow-400/5">
                <Info className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                <p className="font-mono text-[11px] text-yellow-400">
                  Esta gravação não tem vídeo no servidor. Use o upload local.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={() => localFileRef.current?.click()}
                className="border-2 border-dashed border-border/50 hover:border-primary/40 p-6 text-center transition-all group"
              >
                <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
                  Upload de arquivo local
                </p>
                <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">.webm · .mp4 · .mov</p>
              </button>
              <input ref={localFileRef} type="file" accept="video/*" className="hidden" onChange={handleLocalFile} />

              {recMeta?.videoPath && (
                <button
                  onClick={() => setVideoUrl(`/api/recordings/${recMeta.id}/video`)}
                  className="border border-border/50 hover:border-primary/40 p-6 text-center transition-all group"
                >
                  <Video className="h-6 w-6 mx-auto mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
                  <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
                    Carregar do Servidor
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">
                    {recMeta.name} · {recMeta.videoSize ? fmtBytes(recMeta.videoSize) : ""}
                  </p>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Video loaded */}
        {videoUrl && (
          <div className="space-y-4">
            {/* Video info + swap */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px] rounded-none border-primary/40 text-primary">
                  {videoName || "vídeo"}
                </Badge>
                {recMeta?.videoSize && (
                  <Badge variant="outline" className="font-mono text-[10px] rounded-none">
                    {fmtBytes(recMeta.videoSize)}
                  </Badge>
                )}
              </div>
              <button
                onClick={() => { setVideoUrl(""); setExportBlob(null); }}
                className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" />Trocar vídeo
              </button>
            </div>

            {/* Video player */}
            <div className="border border-border/50 bg-black relative aspect-video">
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain"
                onLoadedMetadata={onVideoLoaded}
                onTimeUpdate={onTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                crossOrigin="use-credentials"
              />
              {/* Hidden canvas for export */}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Timeline */}
            <div className="space-y-2">
              {/* Timeline bar */}
              <div
                ref={timelineRef}
                onClick={onTimelineClick}
                className="relative h-8 bg-card/40 border border-border/40 cursor-pointer group"
              >
                {/* Trim zone */}
                <div
                  className="absolute top-0 bottom-0 bg-primary/20 border-x border-primary/50"
                  style={{ left: pct(inPoint), width: `calc(${pct(outPoint)} - ${pct(inPoint)})` }}
                />
                {/* Playhead */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white/80"
                  style={{ left: pct(currentTime) }}
                >
                  <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-white/80 rotate-45" />
                </div>
                {/* In/Out handles */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-primary cursor-ew-resize"
                  style={{ left: pct(inPoint) }}
                  onMouseDown={e => {
                    const startX = e.clientX;
                    const startIn = inPoint;
                    const bar = timelineRef.current;
                    if (!bar) return;
                    const move = (ev: MouseEvent) => {
                      const rect = bar.getBoundingClientRect();
                      const delta = (ev.clientX - startX) / rect.width * duration;
                      setInPoint(Math.max(0, Math.min(startIn + delta, outPoint - 0.5)));
                    };
                    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
                    window.addEventListener("mousemove", move);
                    window.addEventListener("mouseup", up);
                    e.stopPropagation();
                  }}
                />
                <div
                  className="absolute top-0 bottom-0 w-1 bg-primary cursor-ew-resize"
                  style={{ left: pct(outPoint) }}
                  onMouseDown={e => {
                    const startX = e.clientX;
                    const startOut = outPoint;
                    const bar = timelineRef.current;
                    if (!bar) return;
                    const move = (ev: MouseEvent) => {
                      const rect = bar.getBoundingClientRect();
                      const delta = (ev.clientX - startX) / rect.width * duration;
                      setOutPoint(Math.max(inPoint + 0.5, Math.min(startOut + delta, duration)));
                    };
                    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
                    window.addEventListener("mousemove", move);
                    window.addEventListener("mouseup", up);
                    e.stopPropagation();
                  }}
                />
              </div>

              {/* Time labels */}
              <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                <span>{fmtTime(inPoint)}</span>
                <span>{fmtTime(currentTime)}</span>
                <span>{fmtTime(outPoint)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="ghost" size="sm" onClick={() => seek(inPoint)}
                className="font-mono text-[11px] uppercase tracking-widest p-2">
                <SkipBack className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" onClick={togglePlay}
                className="rounded-none font-mono text-[11px] uppercase tracking-widest px-4">
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => seek(outPoint)}
                className="font-mono text-[11px] uppercase tracking-widest p-2">
                <SkipForward className="h-3.5 w-3.5" />
              </Button>

              <div className="flex items-center gap-1.5 ml-2">
                <button onClick={() => setMuted(m => { if (videoRef.current) videoRef.current.muted = !m; return !m; })}
                  className="text-muted-foreground hover:text-foreground transition-colors">
                  {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                </button>
                <input type="range" min={0} max={1} step={0.05} value={volume}
                  onChange={e => { const v = +e.target.value; setVolume(v); if (videoRef.current) videoRef.current.volume = v; }}
                  className="w-20 accent-primary" />
              </div>

              <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={setIn}
                  title="Marcar ponto de entrada (In)"
                  className="rounded-none font-mono text-[11px] uppercase tracking-widest border-primary/40 text-primary hover:bg-primary/10">
                  <Scissors className="h-3 w-3 mr-1" />[IN] {fmtTime(inPoint)}
                </Button>
                <Button variant="outline" size="sm" onClick={setOut}
                  title="Marcar ponto de saída (Out)"
                  className="rounded-none font-mono text-[11px] uppercase tracking-widest border-primary/40 text-primary hover:bg-primary/10">
                  <Scissors className="h-3 w-3 mr-1" />[OUT] {fmtTime(outPoint)}
                </Button>
              </div>
            </div>

            {/* Trim info */}
            <div className="flex items-center gap-2 px-3 py-2 border border-border/30 bg-card/30">
              <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <p className="font-mono text-[11px] text-muted-foreground">
                Trecho selecionado:{" "}
                <span className="text-foreground font-bold">{fmtTime(inPoint)} → {fmtTime(outPoint)}</span>
                {" "}·{" "}duração: <span className="text-foreground font-bold">{fmtTime(trimDuration)}</span>
              </p>
            </div>

            {/* Audio overlay */}
            <div className="border border-border/40 bg-card/20 p-4 space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Music className="h-3.5 w-3.5" />Overlay de Áudio (opcional)
              </p>

              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => audioFileRef.current?.click()}
                  className="rounded-none font-mono text-[11px] uppercase tracking-widest shrink-0">
                  <Upload className="h-3 w-3 mr-1.5" />
                  {audioFile ? audioFile.name.slice(0, 25) : "Carregar áudio"}
                </Button>
                {audioFile && (
                  <button onClick={() => setAudioFile(null)}
                    className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <input ref={audioFileRef} type="file" accept="audio/*" className="hidden"
                  onChange={e => setAudioFile(e.target.files?.[0] ?? null)} />
              </div>

              {audioFile && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">
                      Volume do áudio
                    </label>
                    <input type="range" min={0} max={1} step={0.05} value={audioVolume}
                      onChange={e => setAudioVolume(+e.target.value)}
                      className="w-full accent-primary" />
                    <span className="font-mono text-[10px] text-muted-foreground">{Math.round(audioVolume * 100)}%</span>
                  </div>
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">
                      Atraso (segundos)
                    </label>
                    <input type="number" min={0} step={0.5} value={audioDelay}
                      onChange={e => setAudioDelay(+e.target.value)}
                      className="w-full border border-border/50 bg-card/40 px-2 py-1 text-xs font-mono focus:border-primary/50 focus:outline-none" />
                  </div>
                </div>
              )}
            </div>

            {/* Export controls */}
            <div className="border border-border/40 bg-card/20 p-4 space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Exportar</p>

              <p className="font-mono text-[10px] text-muted-foreground/70 leading-relaxed">
                A exportação faz a reprodução do trecho selecionado em tempo real, capturando vídeo + áudio
                misturado. O arquivo final é baixado em .webm.
              </p>

              {!exporting && !exportBlob && (
                <Button onClick={startExport} disabled={!duration}
                  className="rounded-none font-mono uppercase tracking-widest text-xs w-full sm:w-auto">
                  <Download className="h-3.5 w-3.5 mr-2" />
                  Exportar Trecho ({fmtTime(trimDuration)})
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
                      Exportação concluída · {fmtTime(exportDuration)} · {fmtBytes(exportBlob.size)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={downloadExport}
                      className="rounded-none font-mono uppercase tracking-widest text-xs">
                      <Download className="h-3.5 w-3.5 mr-2" />Download (.webm)
                    </Button>
                    <Button variant="outline" onClick={startExport}
                      className="rounded-none font-mono uppercase tracking-widest text-xs">
                      Exportar Novamente
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
