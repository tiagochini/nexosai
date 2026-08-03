/**
 * CloneStudioPanel — Sessão guiada de captura para clone de voz/vídeo.
 *
 * Fluxo:
 *   1. Intro / pré-voo (câmera + mic)
 *   2. Exibe a MESMA frase em 5 contextos emocionais — o cliente grava cada take
 *   3. Frase contextualizada vs. descontextualizada vs. command vs. emocional puro
 *   4. Faz upload de cada take para /api/recordings/:id/upload com tag clone
 *   5. Ao finalizar → dispara onComplete(sessionId)
 *
 * NÃO captura tela — apenas webcam + mic.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Video, Mic, Square, Play, Check, ChevronRight,
  Loader2, X, Camera, AlertTriangle, RotateCcw,
  Volume2, Radio, Star, Zap, Heart, Shield,
  Flame,
} from "lucide-react";

// ── Clone takes definition ─────────────────────────────────────────────────────

interface CloneTake {
  id: string;
  emotion: string;
  icon: React.ElementType;
  color: string;
  instruction: string;
  context: "contextualizada" | "descontextualizada" | "command" | "emocional";
  targetSecs: number;
}

const CORE_PHRASE = "Você está prestes a transformar completamente o seu negócio — e isso começa agora.";

const CLONE_TAKES: CloneTake[] = [
  {
    id: "neutro",
    emotion: "Neutro · Âncora",
    icon: Mic,
    color: "text-slate-300 border-slate-300/30 bg-slate-300/5",
    instruction: "Leia a frase de forma natural, pausada, sem forçar emoção. Como se estivesse conversando com um amigo próximo.",
    context: "descontextualizada",
    targetSecs: 8,
  },
  {
    id: "autoridade",
    emotion: "Autoridade · Liderança",
    icon: Shield,
    color: "text-primary border-primary/30 bg-primary/5",
    instruction: "Você sabe exatamente o que está falando. Tom firme, seguro, sem hesitação. Você é a referência.",
    context: "contextualizada",
    targetSecs: 8,
  },
  {
    id: "entusiasta",
    emotion: "Entusiasmo · Euforia",
    icon: Zap,
    color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
    instruction: "Energia máxima. Você acabou de descobrir algo incrível e quer que o outro sinta o mesmo. Deixa a empolgação transbordar.",
    context: "emocional",
    targetSecs: 8,
  },
  {
    id: "empatico",
    emotion: "Empatia · Conexão",
    icon: Heart,
    color: "text-rose-400 border-rose-400/30 bg-rose-400/5",
    instruction: "Você entende a dor dessa pessoa. Fale devagar, com calor. Como se estivesse dizendo isso olho no olho para alguém que precisa ouvir.",
    context: "emocional",
    targetSecs: 10,
  },
  {
    id: "urgencia",
    emotion: "Urgência · Decisão",
    icon: Flame,
    color: "text-orange-400 border-orange-400/30 bg-orange-400/5",
    instruction: "O tempo está acabando. A oportunidade é agora. Transmita que quem não age agora perde algo real. Sem exagero — urgência real.",
    context: "command",
    targetSecs: 8,
  },
];

const CONTEXT_LABELS: Record<CloneTake["context"], string> = {
  contextualizada: "Contextualizada",
  descontextualizada: "Descontextualizada",
  command: "Comando",
  emocional: "Emocional puro",
};

// ── State types ────────────────────────────────────────────────────────────────

type PanelPhase = "intro" | "camera_check" | "recording" | "review" | "uploading" | "complete";
type TakeState = "pending" | "recording" | "done" | "uploading";

interface TakeResult {
  takeId: string;
  blob: Blob;
  durationMs: number;
  uploaded: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  userName: string;
  onComplete: (sessionRecordingId: string) => void;
  onSkip: () => void;
}

export function CloneStudioPanel({ userName, onComplete, onSkip }: Props) {
  const firstName = userName.split(" ")[0] ?? "você";

  const [phase, setPhase] = useState<PanelPhase>("intro");
  const [currentTakeIdx, setCurrentTakeIdx] = useState(0);
  const [takeStates, setTakeStates] = useState<TakeState[]>(CLONE_TAKES.map(() => "pending"));
  const [results, setResults] = useState<TakeResult[]>([]);

  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordingSecs, setRecordingSecs] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [sessionRecordingId, setSessionRecordingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const currentTake = CLONE_TAKES[currentTakeIdx]!;
  const TakeIcon = currentTake.icon;
  const progress = CLONE_TAKES.filter((_, i) => takeStates[i] === "done" || takeStates[i] === "uploading").length;

  // ── Camera init ──────────────────────────────────────────────────────────────
  const initCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
      }
      setPhase("camera_check");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      if (msg.includes("Permission") || msg.includes("denied")) {
        setCameraError("Permissão de câmera negada. Libere o acesso nas configurações do navegador.");
      } else {
        setCameraError(`Não foi possível acessar a câmera: ${msg}`);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  // ── Start take recording ─────────────────────────────────────────────────────
  const startTake = useCallback(() => {
    if (!streamRef.current) return;
    setCountdown(3);
    let c = 3;
    const cd = setInterval(() => {
      c--;
      setCountdown(c > 0 ? c : null);
      if (c <= 0) {
        clearInterval(cd);
        beginRecording();
      }
    }, 1000);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const beginRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";
    const recorder = new MediaRecorder(streamRef.current, { mimeType, videoBitsPerSecond: 2_500_000 });
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = handleRecordingStop;
    recorderRef.current = recorder;
    recorder.start(100);
    startTimeRef.current = Date.now();
    setRecordingSecs(0);
    setPhase("recording");
    setTakeStates(s => s.map((v, i) => i === currentTakeIdx ? "recording" : v));
    timerRef.current = setInterval(() => setRecordingSecs(Math.floor((Date.now() - startTimeRef.current) / 1000)), 500);
  };

  const stopTake = () => {
    recorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleRecordingStop = () => {
    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    const durationMs = Date.now() - startTimeRef.current;
    setResults(r => [...r, { takeId: currentTake.id, blob, durationMs, uploaded: false }]);
    setTakeStates(s => s.map((v, i) => i === currentTakeIdx ? "done" : v));
    setPhase("review");
  };

  // ── Re-do take ───────────────────────────────────────────────────────────────
  const redoTake = () => {
    setResults(r => r.filter(x => x.takeId !== currentTake.id));
    setTakeStates(s => s.map((v, i) => i === currentTakeIdx ? "pending" : v));
    setPhase("camera_check");
  };

  // ── Advance to next take or finish ───────────────────────────────────────────
  const advanceTake = () => {
    if (currentTakeIdx < CLONE_TAKES.length - 1) {
      setCurrentTakeIdx(i => i + 1);
      setPhase("camera_check");
    } else {
      void submitSession();
    }
  };

  // ── Upload & finalize ────────────────────────────────────────────────────────
  const submitSession = async () => {
    setPhase("uploading");
    setUploadProgress(0);
    try {
      // Create a recording session for the clone
      const startRes = await customFetch<{ recording: { id: string } }>("/api/recordings", {
        method: "POST",
        body: JSON.stringify({ name: `Clone Studio — ${firstName} — ${new Date().toLocaleDateString("pt-BR")}` }),
      });
      const recId = startRes.recording.id;
      setSessionRecordingId(recId);

      // Upload each take
      for (let i = 0; i < results.length; i++) {
        const r = results[i]!;
        setUploadProgress(Math.round((i / results.length) * 85));
        await fetch(`/api/recordings/${recId}/upload?mode=clone`, {
          method: "POST",
          headers: {
            "Content-Type": "video/webm",
            Authorization: `Bearer ${localStorage.getItem("nexos_access_token") ?? ""}`,
          },
          body: r.blob,
        });
        // Tag the take
        await customFetch(`/api/recordings/${recId}/events`, {
          method: "POST",
          body: JSON.stringify({ type: "custom", phase: "clone_take", data: { takeId: r.takeId, durationMs: r.durationMs } }),
        });
      }

      // Stop the recording session
      await customFetch(`/api/recordings/${recId}/stop`, { method: "POST" });

      setUploadProgress(100);
      stopStream();
      setPhase("complete");
      onComplete(recId);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar takes. Tente novamente.");
      setPhase("review");
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (phase === "intro") {
    return createPortal(
      <div className="fixed inset-0 z-[8000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="relative w-full max-w-lg bg-[#0a0a0a] border border-primary/40 p-6 space-y-5 overflow-y-auto max-h-[90dvh]">
          {/* Corner marks */}
          {["top-0 left-0 border-t border-l","top-0 right-0 border-t border-r","bottom-0 left-0 border-b border-l","bottom-0 right-0 border-b border-r"].map((c,i) => (
            <div key={i} className={`absolute w-3 h-3 ${c} border-primary`} />
          ))}

          {/* Close button */}
          <button
            onClick={onSkip}
            className="absolute top-3 right-3 text-white/30 hover:text-white/70 transition-colors z-10"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0">
              <Video className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1">
                Clone Studio · Gravação de Avatar
              </div>
              <h3 className="font-mono text-base font-bold uppercase tracking-tight text-white">
                Vamos criar seu Clone NexOS
              </h3>
              <p className="font-mono text-[12px] text-white/50 mt-1.5 leading-relaxed">
                Em menos de 5 minutos, você grava 5 takes da mesma frase com emoções diferentes. Seu clone usará sua voz e jeito de falar para criar vídeos de campanha automaticamente.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-1">
            {CLONE_TAKES.map((t, i) => {
              const Icon = t.icon;
              return (
                <div key={t.id} className={`border px-2 py-2 text-center ${t.color}`}>
                  <Icon className="h-3.5 w-3.5 mx-auto mb-1" />
                  <div className="font-mono text-[10px] font-bold uppercase leading-tight">{t.emotion.split(" · ")[0]}</div>
                  <div className="font-mono text-[9px] text-white/30 mt-0.5">Take {i + 1}</div>
                </div>
              );
            })}
          </div>

          <div className="border border-white/10 bg-white/5 px-4 py-3">
            <p className="font-mono text-[11px] text-white/60 leading-relaxed">
              <span className="text-white font-bold">A frase que você vai gravar:</span><br />
              "{CORE_PHRASE}"
            </p>
            <p className="font-mono text-[10px] text-white/30 mt-2">
              A mesma frase · 5 entregas emocionais diferentes · cada take ≈ 8-10 segundos
            </p>
          </div>

          {cameraError && (
            <div className="border border-destructive/40 bg-destructive/10 px-3 py-2 flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
              <span className="font-mono text-[11px] text-destructive">{cameraError}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={initCamera} className="flex-1 font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-10 text-xs">
              <Camera className="h-3.5 w-3.5" />
              Ativar câmera e iniciar
            </Button>
            <Button variant="ghost" onClick={onSkip} className="font-mono text-[11px] uppercase tracking-widest rounded-none text-white/30 hover:text-white/70 h-10 px-3">
              Cancelar
            </Button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // Camera check, recording, review phases — all show the video feed
  return createPortal(
    <div className="fixed inset-0 z-[8000] bg-black/95 flex flex-col">
      {/* Header */}
      <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between bg-black/80">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-white/70">
            Clone Studio
          </span>
          <span className="font-mono text-[11px] text-white/40">·</span>
          <span className={`font-mono text-[11px] font-bold uppercase ${currentTake.color.split(" ")[0]}`}>
            {currentTake.emotion}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress pills */}
          <div className="flex gap-1">
            {CLONE_TAKES.map((t, i) => (
              <div
                key={t.id}
                className={`w-5 h-1.5 ${
                  i < currentTakeIdx ? "bg-success" :
                  i === currentTakeIdx ? "bg-primary animate-pulse" :
                  "bg-white/10"
                }`}
              />
            ))}
          </div>
          <span className="font-mono text-[11px] text-white/40">
            {currentTakeIdx + 1}/{CLONE_TAKES.length}
          </span>
          <button onClick={onSkip} className="text-white/30 hover:text-white/60 transition-colors ml-2">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex gap-0 overflow-hidden">
        {/* Left column: camera + button bar */}
        <div className="flex-1 flex flex-col min-h-0">

          {/* Câmera — sempre montada para o stream funcionar */}
          <div className="flex-1 relative bg-black flex items-center justify-center min-h-0">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="max-h-full max-w-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />

            {/* ── PRÉ-TAKE: overlay de direção sobre a câmera ──────────────── */}
            {phase === "camera_check" && countdown === null && (
              <div className="absolute inset-0 overflow-y-auto bg-black/90 flex flex-col">
                {/* Conteúdo scrollável */}
                <div className="flex-1 flex flex-col items-center justify-center px-6 pt-8 pb-4">
                  <div className={`flex items-center gap-2 mb-5 ${currentTake.color.split(" ")[0]}`}>
                    <TakeIcon className="h-5 w-5" />
                    <span className="font-mono text-sm font-bold uppercase tracking-widest">
                      Take {currentTakeIdx + 1} de {CLONE_TAKES.length} · {currentTake.emotion}
                    </span>
                  </div>

                  <div className="border border-white/20 bg-white/5 px-5 py-4 mb-4 max-w-lg w-full">
                    <div className="font-mono text-[10px] text-white/40 uppercase tracking-widest mb-2">
                      Leia esta frase:
                    </div>
                    <p className="font-mono text-base text-white leading-relaxed font-bold text-center">
                      "{CORE_PHRASE}"
                    </p>
                  </div>

                  <div className="border border-white/15 bg-black/50 px-5 py-4 max-w-lg w-full">
                    <div className="font-mono text-[10px] text-white/40 uppercase tracking-widest mb-2">
                      Como entregar este take:
                    </div>
                    <p className={`font-mono text-[14px] leading-relaxed ${currentTake.color.split(" ")[0]}`}>
                      {currentTake.instruction}
                    </p>
                    <div className="font-mono text-[10px] text-white/30 mt-3">
                      Duração alvo: ~{currentTake.targetSecs} segundos
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Countdown overlay */}
            {countdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                <div className="font-mono text-8xl font-black text-white">
                  {countdown === 0 ? "GO" : countdown}
                </div>
              </div>
            )}

            {/* Recording indicator */}
            {phase === "recording" && (
              <div className="absolute top-3 left-3 flex items-center gap-2 border border-red-500/40 bg-red-500/20 px-3 py-1">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="font-mono text-xs text-red-400 font-bold">
                  {String(Math.floor(recordingSecs / 60)).padStart(2,"0")}:{String(recordingSecs % 60).padStart(2,"0")}
                </span>
              </div>
            )}

            {/* Uploading overlay */}
            {phase === "uploading" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-4">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="font-mono text-sm text-white">Enviando takes… {uploadProgress}%</p>
                <div className="w-48 h-1 bg-white/10">
                  <div className="h-1 bg-primary transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* ── BARRA DE BOTÕES — fora da câmera, nunca clipada ─────────── */}

          {/* Botão iniciar gravação — fase camera_check */}
          {phase === "camera_check" && countdown === null && (
            <div className="flex-none flex flex-col items-center gap-2 py-5 border-t border-white/10 bg-black">
              <Button
                onClick={startTake}
                className="font-mono text-sm uppercase tracking-widest rounded-none gap-2 h-12 px-10"
                style={{ background: "var(--primary)", color: "black", minWidth: 280 }}
              >
                <Radio className="h-4 w-4" /> Entendi — Iniciar gravação
              </Button>
            </div>
          )}

          {/* Botão finalizar leitura — fase recording */}
          {phase === "recording" && (
            <div className="flex-none flex flex-col items-center gap-2 py-5 border-t border-white/10 bg-black">
              <Button
                onClick={stopTake}
                className="font-mono text-sm uppercase tracking-widest rounded-none gap-2 h-12 px-8"
                style={{ background: "var(--primary)", color: "black", minWidth: 280 }}
              >
                <Check className="h-4 w-4" /> Terminei de ler esta frase
              </Button>
              <span className="font-mono text-[10px] text-white/30">
                Clique ao terminar a leitura para avançar
              </span>
            </div>
          )}

          {/* Botões de review — fase review */}
          {phase === "review" && (
            <div className="flex-none flex items-center justify-center gap-3 py-5 border-t border-white/10 bg-black">
              <Button
                onClick={redoTake}
                variant="outline"
                className="font-mono text-[11px] uppercase tracking-widest rounded-none gap-1.5 border-white/20 bg-black text-white hover:bg-white/10 h-10 px-4"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Regravar
              </Button>
              <Button
                onClick={advanceTake}
                className="font-mono text-[11px] uppercase tracking-widest rounded-none gap-1.5 btn-weapon-primary h-10 px-5"
              >
                <Check className="h-3.5 w-3.5" />
                {currentTakeIdx < CLONE_TAKES.length - 1 ? "Próximo take" : "Finalizar clone"}
              </Button>
            </div>
          )}
        </div>

        {/* Sidebar — referência rápida durante gravação */}
        <div className="w-64 border-l border-white/10 bg-black/60 flex flex-col overflow-y-auto">
          {/* Emotion badge */}
          <div className="border-b border-white/10 px-4 py-3">
            <div className={`flex items-center gap-2 mb-1 ${currentTake.color.split(" ")[0]}`}>
              <TakeIcon className="h-4 w-4" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-widest">{currentTake.emotion}</span>
            </div>
            <div className="font-mono text-[10px] text-white/40 uppercase tracking-widest">
              {CONTEXT_LABELS[currentTake.context]}
            </div>
          </div>

          {/* The phrase — referência rápida */}
          <div className="px-4 py-3 border-b border-white/10">
            <div className="font-mono text-[10px] text-white/40 uppercase tracking-widest mb-2">Frase:</div>
            <p className="font-mono text-[12px] text-white/90 leading-relaxed font-bold">
              "{CORE_PHRASE}"
            </p>
          </div>

          {/* Direção — lembrete condensado visível durante gravação */}
          {phase === "recording" && (
            <div className="px-4 py-3 border-b border-white/10">
              <div className="font-mono text-[10px] text-white/40 uppercase tracking-widest mb-1.5">Lembre-se:</div>
              <p className={`font-mono text-[11px] leading-relaxed ${currentTake.color.split(" ")[0]}`}>
                {currentTake.instruction}
              </p>
            </div>
          )}

          {/* Take list */}
          <div className="px-4 py-4 flex-1">
            <div className="font-mono text-[10px] text-white/40 uppercase tracking-widest mb-2">Takes:</div>
            <div className="space-y-1">
              {CLONE_TAKES.map((t, i) => {
                const state = takeStates[i];
                const TIcon = t.icon;
                return (
                  <div key={t.id} className={`flex items-center gap-2 px-2 py-1.5 ${
                    i === currentTakeIdx ? "border border-white/20 bg-white/5" : ""
                  }`}>
                    {state === "done" ? (
                      <Check className="h-3 w-3 text-success" />
                    ) : state === "recording" ? (
                      <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                    ) : (
                      <TIcon className={`h-3 w-3 ${t.color.split(" ")[0]} opacity-50`} />
                    )}
                    <span className={`font-mono text-[11px] ${
                      i === currentTakeIdx ? "text-white" :
                      state === "done" ? "text-success" :
                      "text-white/30"
                    }`}>
                      {t.emotion}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status contextual no rodapé */}
          <div className="px-4 py-4 border-t border-white/10">
            {phase === "camera_check" && countdown === null && (
              <div className="font-mono text-[10px] text-white/30 text-center leading-relaxed">
                Leia a direção na tela<br />e clique para iniciar
              </div>
            )}
            {phase === "recording" && (
              <div className="font-mono text-[10px] text-primary/70 text-center flex items-center justify-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Clique o botão ao terminar de ler
              </div>
            )}
            {phase === "review" && (
              <div className="font-mono text-[10px] text-white/40 text-center">
                Take gravado ✓ — escolha na câmera
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
