/**
 * CloneStudioPanel — Sessão guiada de captura de voz para clone.
 *
 * Fluxo:
 *   1. Intro / pré-voo (câmera + mic)
 *   2. Exibe a MESMA frase em 5 contextos emocionais — o cliente grava cada take
 *   3. Faz upload de cada take para /api/recordings/:id/upload com tag clone
 *   4. Ao finalizar → dispara onComplete(sessionId)
 *
 * Layout: CSS Grid com 3 linhas — header fixo / câmera flex / botões sempre visíveis.
 * Isso garante que os botões aparecem em QUALQUER altura de tela (Chromebook, etc.)
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Video, Mic, Square, Check, ChevronRight,
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
    instruction: "O momento é agora. Fale com convicção, como se o outro precisasse agir imediatamente. Sem vacilar.",
    context: "command",
    targetSecs: 8,
  },
];

const CONTEXT_LABELS: Record<CloneTake["context"], string> = {
  contextualizada: "Contextualizada",
  descontextualizada: "Descontextualizada",
  command: "Comando direto",
  emocional: "Emocional puro",
};

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  firstName?: string;
  onComplete: (sessionId: string) => void;
  onSkip: () => void;
}

// ── Types ──────────────────────────────────────────────────────────────────────

type Phase = "intro" | "camera_check" | "recording" | "review" | "uploading" | "complete";
type TakeState = "pending" | "recording" | "done" | "uploading";

interface TakeResult {
  takeId: string;
  blob: Blob;
  durationMs: number;
  uploaded: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CloneStudioPanel({ firstName = "Fundador", onComplete, onSkip }: Props) {
  const [phase, setPhase] = useState<Phase>("intro");
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

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    return () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Recording controls ───────────────────────────────────────────────────────
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const redoTake = () => {
    setResults(r => r.filter(x => x.takeId !== currentTake.id));
    setTakeStates(s => s.map((v, i) => i === currentTakeIdx ? "pending" : v));
    setPhase("camera_check");
  };

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
      const startRes = await customFetch<{ recording: { id: string } }>("/api/recordings", {
        method: "POST",
        body: JSON.stringify({ name: `Clone Studio — ${firstName} — ${new Date().toLocaleDateString("pt-BR")}` }),
      });
      const recId = startRes.recording.id;
      setSessionRecordingId(recId);

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
        await customFetch(`/api/recordings/${recId}/events`, {
          method: "POST",
          body: JSON.stringify({ type: "custom", phase: "clone_take", data: { takeId: r.takeId, durationMs: r.durationMs } }),
        });
      }

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

  // ── INTRO SCREEN ─────────────────────────────────────────────────────────────
  if (phase === "intro") {
    return createPortal(
      <div className="fixed inset-0 z-[8000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="relative w-full max-w-lg bg-[#0a0a0a] border border-primary/40 p-6 space-y-5 overflow-y-auto max-h-[90dvh]">
          {["top-0 left-0 border-t border-l","top-0 right-0 border-t border-r","bottom-0 left-0 border-b border-l","bottom-0 right-0 border-b border-r"].map((c,i) => (
            <div key={i} className={`absolute w-3 h-3 ${c} border-primary`} />
          ))}
          <button onClick={onSkip} className="absolute top-3 right-3 text-white/30 hover:text-white/70 transition-colors z-10" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0">
              <Mic className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1">Clone de Voz · NexOS</div>
              <h3 className="font-mono text-base font-bold uppercase tracking-tight text-white">Vamos criar sua voz clonada</h3>
              <p className="font-mono text-[12px] text-white/50 mt-1.5 leading-relaxed">
                Em menos de 5 minutos, você grava a mesma frase com 5 emoções diferentes. Sua voz será usada para narrar vídeos de campanha automaticamente.
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

  // ── RECORDING PHASES — CSS Grid layout garante botões sempre visíveis ─────────
  //
  //  grid-rows: [header 52px] [camera+sidebar auto] [buttons auto]
  //  O truque: a linha do meio usa "minmax(0, 1fr)" (cresce mas não empurra as outras)
  //  A linha de botões é sempre "auto" — nunca comprimida, nunca clipada.

  // Determinar label do botão de ação principal
  const actionButton = (() => {
    if (phase === "camera_check" && countdown === null) {
      return (
        <Button
          onClick={startTake}
          className="font-mono text-sm uppercase tracking-widest rounded-none gap-2 h-12 px-10 btn-weapon-primary"
          style={{ minWidth: 240 }}
        >
          <Radio className="h-4 w-4" /> Entendi — Iniciar gravação
        </Button>
      );
    }
    if (phase === "recording") {
      return (
        <div className="flex flex-col items-center gap-2">
          <Button
            onClick={stopTake}
            className="font-mono text-sm uppercase tracking-widest rounded-none gap-2 h-12 px-8"
            style={{ background: "var(--primary)", color: "black", minWidth: 240 }}
          >
            <Check className="h-4 w-4" /> Terminei de ler — Parar
          </Button>
          <span className="font-mono text-[10px] text-white/30">
            Clique quando terminar de ler a frase
          </span>
        </div>
      );
    }
    if (phase === "review") {
      return (
        <div className="flex items-center gap-3">
          <Button
            onClick={redoTake}
            variant="outline"
            className="font-mono text-[11px] uppercase tracking-widest rounded-none gap-1.5 border-white/20 bg-black text-white hover:bg-white/10 h-11 px-5"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Regravar este take
          </Button>
          <Button
            onClick={advanceTake}
            className="font-mono text-[11px] uppercase tracking-widest rounded-none gap-1.5 btn-weapon-primary h-11 px-6"
          >
            <Check className="h-3.5 w-3.5" />
            {currentTakeIdx < CLONE_TAKES.length - 1 ? `Próximo take (${currentTakeIdx + 2}/${CLONE_TAKES.length})` : "Finalizar e enviar"}
          </Button>
        </div>
      );
    }
    if (phase === "uploading") {
      return (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
          <span className="font-mono text-sm text-white">Enviando takes… {uploadProgress}%</span>
          <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-1.5 bg-primary transition-all rounded-full" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      );
    }
    return null;
  })();

  return createPortal(
    <div
      className="fixed inset-0 z-[8000] bg-black/95"
      style={{
        display: "grid",
        gridTemplateRows: "52px minmax(0, 1fr) auto",
      }}
    >
      {/* ── Linha 1: Header — altura fixa 52px ─────────────────────────────── */}
      <div className="border-b border-white/10 px-4 flex items-center justify-between bg-black">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-white/70">Clone de Voz</span>
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
                title={t.emotion}
                className={`w-5 h-1.5 transition-colors ${
                  i < currentTakeIdx ? "bg-green-500" :
                  i === currentTakeIdx ? "bg-primary animate-pulse" :
                  "bg-white/10"
                }`}
              />
            ))}
          </div>
          <span className="font-mono text-[11px] text-white/50 tabular-nums">
            {currentTakeIdx + 1}/{CLONE_TAKES.length}
          </span>
          <button onClick={onSkip} className="text-white/30 hover:text-white/60 transition-colors ml-1" aria-label="Fechar sessão">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Linha 2: Câmera + Sidebar — cresce, nunca empurra botões ────────── */}
      <div className="overflow-hidden" style={{ display: "grid", gridTemplateColumns: "1fr 220px" }}>

        {/* Câmera — sempre montada para stream funcionar */}
        <div className="relative bg-black overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="max-h-full max-w-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />

          {/* Instrução de take — overlay sobre câmera */}
          {phase === "camera_check" && countdown === null && (
            <div className="absolute inset-0 bg-black/85 overflow-y-auto flex flex-col items-center justify-center px-6 py-6 gap-4">
              <div className={`flex items-center gap-2 ${currentTake.color.split(" ")[0]}`}>
                <TakeIcon className="h-5 w-5" />
                <span className="font-mono text-sm font-bold uppercase tracking-widest">
                  Take {currentTakeIdx + 1} de {CLONE_TAKES.length} · {currentTake.emotion}
                </span>
              </div>

              <div className="border border-white/20 bg-white/5 px-5 py-4 w-full max-w-md">
                <div className="font-mono text-[10px] text-white/40 uppercase tracking-widest mb-2">Leia esta frase:</div>
                <p className="font-mono text-base text-white leading-relaxed font-bold text-center">
                  "{CORE_PHRASE}"
                </p>
              </div>

              <div className="border border-white/15 bg-black/50 px-5 py-4 w-full max-w-md">
                <div className="font-mono text-[10px] text-white/40 uppercase tracking-widest mb-2">Como entregar este take:</div>
                <p className={`font-mono text-[13px] leading-relaxed ${currentTake.color.split(" ")[0]}`}>
                  {currentTake.instruction}
                </p>
                <div className="font-mono text-[10px] text-white/30 mt-3">Duração alvo: ~{currentTake.targetSecs} segundos</div>
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
              <span className="font-mono text-xs text-red-400 font-bold tabular-nums">
                {String(Math.floor(recordingSecs / 60)).padStart(2,"0")}:{String(recordingSecs % 60).padStart(2,"0")}
              </span>
            </div>
          )}

          {/* Review overlay — vídeo gravado, aguardando decisão */}
          {phase === "review" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="font-mono text-sm text-white/60 text-center">
                <Check className="h-8 w-8 text-green-400 mx-auto mb-2" />
                Take {currentTakeIdx + 1} gravado.<br />
                <span className="text-[11px] text-white/40">Regrave ou avance para o próximo.</span>
              </div>
            </div>
          )}

          {/* Upload overlay */}
          {phase === "uploading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="font-mono text-sm text-white">Enviando takes…</p>
            </div>
          )}
        </div>

        {/* Sidebar — referência e lista de takes */}
        <div className="border-l border-white/10 bg-black/60 overflow-y-auto flex flex-col">
          {/* Direção rápida durante gravação */}
          {phase === "recording" && (
            <div className="px-4 py-3 border-b border-white/10">
              <div className="font-mono text-[10px] text-white/40 uppercase tracking-widest mb-1.5">Lembre-se:</div>
              <p className={`font-mono text-[11px] leading-relaxed ${currentTake.color.split(" ")[0]}`}>
                {currentTake.instruction}
              </p>
            </div>
          )}

          {/* Frase de referência */}
          <div className="px-4 py-3 border-b border-white/10">
            <div className="font-mono text-[10px] text-white/40 uppercase tracking-widest mb-1.5">Frase:</div>
            <p className="font-mono text-[11px] text-white/80 leading-relaxed">
              "{CORE_PHRASE}"
            </p>
          </div>

          {/* Lista de takes */}
          <div className="px-4 py-4 flex-1">
            <div className="font-mono text-[10px] text-white/40 uppercase tracking-widest mb-2">Takes:</div>
            <div className="space-y-1">
              {CLONE_TAKES.map((t, i) => {
                const state = takeStates[i];
                const TIcon = t.icon;
                return (
                  <div key={t.id} className={`flex items-center gap-2 px-2 py-1.5 ${i === currentTakeIdx ? "border border-white/20 bg-white/5" : ""}`}>
                    {state === "done" ? (
                      <Check className="h-3 w-3 text-green-400" />
                    ) : state === "recording" ? (
                      <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                    ) : (
                      <TIcon className={`h-3 w-3 ${t.color.split(" ")[0]} opacity-50`} />
                    )}
                    <span className={`font-mono text-[11px] ${
                      i === currentTakeIdx ? "text-white" :
                      state === "done" ? "text-green-400" :
                      "text-white/30"
                    }`}>
                      {t.emotion}
                    </span>
                    {state === "done" && (
                      <span className="font-mono text-[9px] text-green-400/50 ml-auto">✓</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dica contextual */}
          <div className="px-4 py-3 border-t border-white/10">
            {phase === "camera_check" && countdown === null && (
              <div className="font-mono text-[10px] text-white/30 text-center leading-relaxed">
                Leia as instruções na tela<br />e clique em "Iniciar gravação"
              </div>
            )}
            {phase === "recording" && (
              <div className="font-mono text-[10px] text-primary/70 text-center flex items-center justify-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Gravando — clique PARAR ao terminar
              </div>
            )}
            {phase === "review" && (
              <div className="font-mono text-[10px] text-white/40 text-center">
                Take {currentTakeIdx + 1} gravado ✓
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Linha 3: Botões — SEMPRE visíveis, nunca clipados ────────────────── */}
      {/*    Esta linha é "auto" no grid — cresce com o conteúdo, nunca some.      */}
      {/*    paddingBottom usa env(safe-area-inset-bottom) para não sumir atrás    */}
      {/*    da barra de navegação do Android/iOS.                                  */}
      <div
        className="border-t border-white/10 bg-[#050505] flex items-center justify-center px-4 gap-3"
        style={{ paddingTop: 20, paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}
      >
        {actionButton}
      </div>
    </div>,
    document.body
  );
}
