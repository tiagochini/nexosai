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
import { useUiText, useUiLocale, intlLocale } from "@/lib/i18n";
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

// Frase longa o suficiente para o ElevenLabs clonar bem a voz (~20-25 segundos ao ritmo natural)
const CORE_PHRASE =
  "Você está prestes a transformar completamente o seu negócio — e isso começa agora. " +
  "Com as ferramentas certas e uma estratégia clara, você vai construir algo que realmente funciona, " +
  "que gera resultado de verdade, e que coloca você numa posição de destaque no mercado. " +
  "Esse é o momento de agir. Essa é a virada.";

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

const CLONE_TAKE_UI: Record<string, {
  emotion: readonly [string, string];
  instruction: readonly [string, string];
}> = {
  neutro: {
    emotion: ["Neutral · Anchor", "Neutral · Base"],
    instruction: ["Read the phrase naturally and steadily, without forcing emotion, as if talking with a close friend.", "Lee la frase con naturalidad y calma, sin forzar la emoción, como si hablaras con un amigo cercano."],
  },
  autoridade: {
    emotion: ["Authority · Leadership", "Autoridad · Liderazgo"],
    instruction: ["You know exactly what you're talking about. Use a firm, confident tone without hesitation. You are the authority.", "Sabes exactamente de qué hablas. Usa un tono firme y seguro, sin dudar. Tú eres la referencia."],
  },
  entusiasta: {
    emotion: ["Enthusiasm · Excitement", "Entusiasmo · Euforia"],
    instruction: ["Maximum energy. You've just discovered something amazing and want the other person to feel the same. Let your excitement show.", "Máxima energía. Acabas de descubrir algo increíble y quieres que la otra persona sienta lo mismo. Deja que se note tu entusiasmo."],
  },
  empatico: {
    emotion: ["Empathy · Connection", "Empatía · Conexión"],
    instruction: ["You understand this person's struggle. Speak slowly and warmly, as if telling it face-to-face to someone who needs to hear it.", "Entiendes el problema de esta persona. Habla despacio y con calidez, como si se lo dijeras cara a cara a alguien que necesita escucharlo."],
  },
  urgencia: {
    emotion: ["Urgency · Decision", "Urgencia · Decisión"],
    instruction: ["The time is now. Speak with conviction, as if the other person needs to act immediately. Don't hesitate.", "El momento es ahora. Habla con convicción, como si la otra persona tuviera que actuar de inmediato. Sin dudar."],
  },
};
const CONTEXT_UI_LABELS: Record<CloneTake["context"], readonly [string, string]> = {
  contextualizada: ["Contextualized", "Contextualizada"],
  descontextualizada: ["Decontextualized", "Descontextualizada"],
  command: ["Direct command", "Orden directa"],
  emocional: ["Pure emotion", "Emoción pura"],
};
const localizedTakeEmotion = (take: CloneTake, t: ReturnType<typeof useUiText>) =>
  t(take.emotion, ...(CLONE_TAKE_UI[take.id]?.emotion ?? ([take.emotion, take.emotion] as const)));
const localizedTakeInstruction = (take: CloneTake, t: ReturnType<typeof useUiText>) =>
  t(take.instruction, ...(CLONE_TAKE_UI[take.id]?.instruction ?? ([take.instruction, take.instruction] as const)));
const localizedTakeContext = (context: CloneTake["context"], t: ReturnType<typeof useUiText>) =>
  t(CONTEXT_LABELS[context], ...CONTEXT_UI_LABELS[context]);

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

/** When provided, the component resumes from a previous in-progress session. */
export interface CloneResumeState {
  recordingId: string;
  completedTakeIds: string[];
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CloneStudioPanel({
  firstName = "Fundador",
  onComplete,
  onSkip,
  resumeState,
}: Props & { resumeState?: CloneResumeState }) {
  const t = useUiText();
  const { locale } = useUiLocale();
  const initialTakeIdx = resumeState ? resumeState.completedTakeIds.length : 0;

  const [phase, setPhase] = useState<Phase>("intro");
  const [currentTakeIdx, setCurrentTakeIdx] = useState(initialTakeIdx);
  const [takeStates, setTakeStates] = useState<TakeState[]>(
    CLONE_TAKES.map((_, i) => i < initialTakeIdx ? "done" : "pending"),
  );
  const [results, setResults] = useState<TakeResult[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordingSecs, setRecordingSecs] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const videoRef    = useRef<HTMLVideoElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Serialised background upload queue — new uploads chain onto this Promise.
  const uploadQueueRef        = useRef<Promise<void>>(Promise.resolve());
  // Recording session ID — created lazily on first take acceptance.
  const sessionRecordingIdRef = useRef<string | null>(resumeState?.recordingId ?? null);
  // Track how many takes have been queued for upload (for progress bar in finalize).
  const uploadedCountRef      = useRef<number>(resumeState?.completedTakeIds.length ?? 0);
  // Tracks the mimeType chosen by the MediaRecorder at record-start time.
  const mimeTypeRef           = useRef<string>("audio/webm");

  const currentTake = CLONE_TAKES[currentTakeIdx]!;
  const TakeIcon = currentTake.icon;
  const localizedCorePhrase = t(
    CORE_PHRASE,
    "You're about to completely transform your business—and it starts now. With the right tools and a clear strategy, you'll build something that really works, delivers real results, and puts you in a standout position in the market. This is the moment to act. This is the turning point.",
    "Estás a punto de transformar por completo tu negocio, y empieza ahora. Con las herramientas adecuadas y una estrategia clara, construirás algo que realmente funciona, que genera resultados de verdad y que te coloca en una posición destacada en el mercado. Este es el momento de actuar. Este es el cambio decisivo."
  );

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
      const msg = e instanceof Error ? e.message : t("Erro desconhecido", "Unknown error", "Error desconocido");
      if (msg.includes("Permission") || msg.includes("denied")) {
        setCameraError(t("Permissão de câmera negada. Libere o acesso nas configurações do navegador.", "Camera permission denied. Allow access in your browser settings.", "Permiso de cámara denegado. Permite el acceso en la configuración del navegador."));
      } else {
        setCameraError(t(`Não foi possível acessar a câmera: ${msg}`, `Could not access the camera: ${msg}`, `No se pudo acceder a la cámara: ${msg}`));
      }
    }
  }, [t]);

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
    // Gravar SOMENTE áudio — ElevenLabs só precisa de voz, não vídeo.
    // O stream de câmera continua vivo para o preview no <video>, mas não é gravado.
    const audioTracks = streamRef.current.getAudioTracks();
    const audioStream = audioTracks.length > 0
      ? new MediaStream(audioTracks)
      : streamRef.current; // fallback: usar stream completo se não houver pista de áudio separada
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "video/webm"; // fallback final
    mimeTypeRef.current = mime;
    const recorder = new MediaRecorder(audioStream, { mimeType: mime, audioBitsPerSecond: 128_000 });
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
    const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
    const durationMs = Date.now() - startTimeRef.current;
    setResults(r => [...r, { takeId: currentTake.id, blob, durationMs, uploaded: false }]);
    setTakeStates(s => s.map((v, i) => i === currentTakeIdx ? "done" : v));
    setPhase("review");
  };

  /** Converte um Blob para base64 de forma segura (sem stack overflow). */
  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        resolve(dataUrl.split(",")[1] ?? "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  const redoTake = () => {
    setResults(r => r.filter(x => x.takeId !== currentTake.id));
    setTakeStates(s => s.map((v, i) => i === currentTakeIdx ? "pending" : v));
    setPhase("camera_check");
  };

  // ── Upload helpers ───────────────────────────────────────────────────────────

  /** Lazily create the recording session on first use. Idempotent. */
  const ensureSession = async (): Promise<string> => {
    if (sessionRecordingIdRef.current) return sessionRecordingIdRef.current;
    const startRes = await customFetch<{ recording: { id: string } }>("/api/recordings", {
      method: "POST",
      body: JSON.stringify({ name: `Clone Studio — ${firstName} — ${new Date().toLocaleDateString(intlLocale(locale))}` }),
    });
    sessionRecordingIdRef.current = startRes.recording.id;
    return startRes.recording.id;
  };

  /** Upload one take blob and save progress to the backend. Fire-and-forget safe. */
  const uploadTakeToServer = async (result: TakeResult): Promise<void> => {
    const recId = await ensureSession();
    const authToken = localStorage.getItem("accessToken") ?? localStorage.getItem("nexos_access_token") ?? "";
    await fetch(`/api/recordings/${recId}/upload?mode=clone`, {
      method: "POST",
      headers: {
        "Content-Type": result.blob.type || "audio/webm",
        ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {}),
      },
      body: result.blob,
    });
    await customFetch(`/api/recordings/${recId}/events`, {
      method: "POST",
      body: JSON.stringify({ type: "custom", phase: "clone_take", data: { takeId: result.takeId, durationMs: result.durationMs } }),
    });
    uploadedCountRef.current += 1;
    setResults(r => r.map(x => x.takeId === result.takeId ? { ...x, uploaded: true } : x));

    // Persist progress so user can resume if they navigate away
    const completedTakeIds = CLONE_TAKES
      .slice(0, currentTakeIdx + 1)
      .map(t => t.id)
      .filter(id => id === result.takeId || (resumeState?.completedTakeIds ?? []).includes(id));
    await customFetch("/api/workspaces/me/persona/voice-clone-progress", {
      method: "POST",
      body: JSON.stringify({ recordingId: recId, completedTakeIds }),
    }).catch(() => {}); // non-fatal
  };

  /** Chain a take upload onto the serialised upload queue. Returns immediately. */
  const queueTakeUpload = (result: TakeResult) => {
    uploadQueueRef.current = uploadQueueRef.current.then(() => uploadTakeToServer(result)).catch(e => {
      console.error("Background take upload failed:", e);
    });
  };

  const advanceTake = () => {
    // Queue the current take for background upload immediately
    const currentResult = results.find(r => r.takeId === currentTake.id);
    if (currentResult && !currentResult.uploaded) {
      queueTakeUpload(currentResult);
    }

    if (currentTakeIdx < CLONE_TAKES.length - 1) {
      setCurrentTakeIdx(i => i + 1);
      setPhase("camera_check");
    } else {
      void finalizeSession();
    }
  };

  // ── Upload & finalize ────────────────────────────────────────────────────────
  // Evita chamar /stop duas vezes se o usuário clicar em Finalizar após um erro parcial
  const sessionStoppedRef = useRef(false);

  const finalizeSession = async () => {
    setPhase("uploading");
    setUploadProgress(10);
    try {
      // 1. Aguardar todos os uploads de take em background
      await uploadQueueRef.current;
      setUploadProgress(40);

      // 2. Parar a sessão de recording (apenas uma vez)
      const recId = await ensureSession();
      if (!sessionStoppedRef.current) {
        await customFetch(`/api/recordings/${recId}/stop`, { method: "POST" });
        sessionStoppedRef.current = true;
      }
      setUploadProgress(60);

      // 3. Enviar todos os blobs de áudio para o ElevenLabs via clone-voice-multi
      // Os blobs ainda estão em memória (results[]) — áudio-only, pequenos (~200-500 KB cada)
      const audioTakes = results.filter(r => r.blob.size > 100);
      if (audioTakes.length > 0) {
        toast.loading(t("Criando clone de voz…", "Creating voice clone…", "Creando clon de voz…"), { id: "voice-clone-creating" });
        const samples = await Promise.all(
          audioTakes.map(async r => ({
            data: await blobToBase64(r.blob),
            mimeType: r.blob.type || "audio/webm",
          }))
        );
        setUploadProgress(80);
        await customFetch("/api/workspaces/me/persona/clone-voice-multi", {
          method: "POST",
          body: JSON.stringify({ samples, voiceName: "Minha Voz NexOS", sessionId: recId }),
        });
        toast.dismiss("voice-clone-creating");
      }
      setUploadProgress(100);

      // 4. Limpar progresso salvo — sessão completa
      await customFetch("/api/workspaces/me/persona/voice-clone-progress", {
        method: "POST",
        body: JSON.stringify({ recordingId: null }),
      }).catch(() => {});

      stopStream();
      setPhase("complete");
      onComplete(recId);
    } catch (e: unknown) {
      console.error(e);
      toast.dismiss("voice-clone-creating");
      const msg = String(e);
      if (msg.includes("paid_plan_required") || msg.includes("instant voice cloning") || msg.includes("payment_required")) {
        // Erro de provedor interno — não expor detalhes ao usuário
        toast.error(
          t("Serviço de clonagem de voz temporariamente indisponível. Entre em contato com o suporte.", "Voice cloning is temporarily unavailable. Please contact support.", "El servicio de clonación de voz no está disponible temporalmente. Contacta con soporte."),
          { duration: 8000 }
        );
        // Sessão já foi parada — não voltar para review (evita loop de /stop 404)
        setPhase("complete");
      } else {
        toast.error(t("Erro ao finalizar sessão. Tente novamente.", "Error finishing session. Please try again.", "Error al finalizar la sesión. Inténtalo de nuevo."));
        setPhase("review");
      }
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
          <button onClick={onSkip} className="absolute top-3 right-3 text-white/30 hover:text-white/70 transition-colors z-10" aria-label={t("Fechar", "Close", "Cerrar")}>
            <X className="h-4 w-4" />
          </button>

          {resumeState && (
            <div className="flex items-center gap-2 border border-primary/30 bg-primary/10 px-3 py-2 rounded-lg -mt-1">
              <span className="font-mono text-[11px] text-primary">
                ✓ {t(`Sessão anterior salva — ${resumeState.completedTakeIds.length}/5 takes já enviados ao servidor. Continue de onde parou.`, `Previous session saved — ${resumeState.completedTakeIds.length}/5 takes already uploaded. Pick up where you left off.`, `Sesión anterior guardada: ${resumeState.completedTakeIds.length}/5 tomas ya subidas al servidor. Continúa donde lo dejaste.`)}
              </span>
            </div>
          )}

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0">
              <Mic className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-1">{t("Clone de Voz · NexOS", "Voice Clone · NexOS", "Clon de voz · NexOS")}</div>
              <h3 className="font-mono text-base font-bold uppercase tracking-tight text-white">
                {resumeState ? t(`Retomando — take ${resumeState.completedTakeIds.length + 1} de 5`, `Resuming — take ${resumeState.completedTakeIds.length + 1} of 5`, `Retomando: toma ${resumeState.completedTakeIds.length + 1} de 5`) : t("Vamos criar sua voz clonada", "Let's create your voice clone", "Vamos a crear tu clon de voz")}
              </h3>
              <p className="font-mono text-[12px] text-white/50 mt-1.5 leading-relaxed">
                {resumeState
                  ? t(`Você já completou ${resumeState.completedTakeIds.length} takes. Os áudios estão salvos no servidor — grave os takes restantes para finalizar.`, `You've completed ${resumeState.completedTakeIds.length} takes. The audio is saved on the server — record the remaining takes to finish.`, `Ya completaste ${resumeState.completedTakeIds.length} tomas. El audio está guardado en el servidor: graba las tomas restantes para terminar.`)
                  : t("Em menos de 5 minutos, você grava a mesma frase com 5 emoções diferentes. Sua voz será usada para narrar vídeos de campanha automaticamente.", "In under 5 minutes, record the same phrase with 5 different emotions. Your voice will automatically narrate campaign videos.", "En menos de 5 minutos, grabarás la misma frase con 5 emociones distintas. Tu voz se usará para narrar videos de campaña automáticamente.")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-1">
            {CLONE_TAKES.map((take, i) => {
              const Icon = take.icon;
              return (
                <div key={take.id} className={`border px-2 py-2 text-center ${take.color}`}>
                  <Icon className="h-3.5 w-3.5 mx-auto mb-1" />
                  <div className="font-mono text-[10px] font-bold uppercase leading-tight">{localizedTakeEmotion(take, t).split(" · ")[0]}</div>
                  <div className="font-mono text-[9px] text-white/30 mt-0.5">{t(`Take ${i + 1}`, `Take ${i + 1}`, `Toma ${i + 1}`)}</div>
                </div>
              );
            })}
          </div>

          <div className="border border-white/10 bg-white/5 px-4 py-3">
            <p className="font-mono text-[11px] text-white/60 leading-relaxed">
              <span className="text-white font-bold">{t("A frase que você vai gravar:", "The phrase you'll record:", "La frase que vas a grabar:")}</span><br />
              "{localizedCorePhrase}"
            </p>
            <p className="font-mono text-[10px] text-white/30 mt-2">
              {t("A mesma frase · 5 entregas emocionais diferentes · cada take ≈ 8-10 segundos", "Same phrase · 5 different emotional deliveries · each take ≈ 8–10 seconds", "La misma frase · 5 interpretaciones emocionales · cada toma ≈ 8-10 segundos")}
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
              {t("Ativar câmera e iniciar", "Enable camera and start", "Activar cámara e iniciar")}
            </Button>
            <Button variant="ghost" onClick={onSkip} className="font-mono text-[11px] uppercase tracking-widest rounded-none text-white/30 hover:text-white/70 h-10 px-3">
              {t("Cancelar", "Cancel", "Cancelar")}
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
          <Radio className="h-4 w-4" /> {t("Entendi — Iniciar gravação", "Got it — Start recording", "Entendido — Iniciar grabación")}
        </Button>
      );
    }
    if (phase === "recording") {
      return (
        <div className="flex flex-col items-center gap-2">
          <Button
            onClick={stopTake}
            className="font-mono text-sm uppercase tracking-widest rounded-none gap-2 h-12 px-8 btn-weapon-primary"
            style={{ minWidth: 240 }}
          >
            <Check className="h-4 w-4" /> {t("Terminei de ler — Parar", "Finished reading — Stop", "Terminé de leer — Detener")}
          </Button>
          <span className="font-mono text-[10px] text-white/30">
            {t("Clique quando terminar de ler a frase", "Click when you've finished reading the phrase", "Haz clic cuando termines de leer la frase")}
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
            <RotateCcw className="h-3.5 w-3.5" /> {t("Regravar este take", "Re-record this take", "Volver a grabar esta toma")}
          </Button>
          <Button
            onClick={advanceTake}
            className="font-mono text-[11px] uppercase tracking-widest rounded-none gap-1.5 btn-weapon-primary h-11 px-6"
          >
            <Check className="h-3.5 w-3.5" />
            {currentTakeIdx < CLONE_TAKES.length - 1 ? t(`Próximo take (${currentTakeIdx + 2}/${CLONE_TAKES.length})`, `Next take (${currentTakeIdx + 2}/${CLONE_TAKES.length})`, `Siguiente toma (${currentTakeIdx + 2}/${CLONE_TAKES.length})`) : t("Finalizar e enviar", "Finish and upload", "Finalizar y enviar")}
          </Button>
        </div>
      );
    }
    if (phase === "uploading") {
      return (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
          <span className="font-mono text-sm text-white">{t("Enviando takes…", "Uploading takes…", "Subiendo tomas…")} {uploadProgress}%</span>
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
      className="fixed inset-x-0 top-0 z-[8000] bg-black/95"
      style={{
        height: "100dvh",
        display: "grid",
        gridTemplateRows: "52px minmax(0, 1fr) auto",
      }}
    >
      {/* ── Linha 1: Header — altura fixa 52px ─────────────────────────────── */}
      <div className="border-b border-white/10 px-4 flex items-center justify-between bg-black">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-white/70">{t("Clone de Voz", "Voice Clone", "Clon de voz")}</span>
          <span className="font-mono text-[11px] text-white/40">·</span>
          <span className={`font-mono text-[11px] font-bold uppercase ${currentTake.color.split(" ")[0]}`}>
            {localizedTakeEmotion(currentTake, t)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress pills */}
          <div className="flex gap-1">
            {CLONE_TAKES.map((take, i) => (
              <div
                key={take.id}
                title={localizedTakeEmotion(take, t)}
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
          <button onClick={onSkip} className="text-white/30 hover:text-white/60 transition-colors ml-1" aria-label={t("Fechar sessão", "Close session", "Cerrar sesión")}>
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
                  {t(`Take ${currentTakeIdx + 1} de ${CLONE_TAKES.length} · ${currentTake.emotion}`, `Take ${currentTakeIdx + 1} of ${CLONE_TAKES.length} · ${localizedTakeEmotion(currentTake, t)}`, `Toma ${currentTakeIdx + 1} de ${CLONE_TAKES.length} · ${localizedTakeEmotion(currentTake, t)}`)}
                </span>
              </div>

              <div className="border border-white/20 bg-white/5 px-5 py-4 w-full max-w-md">
                <div className="font-mono text-[10px] text-white/40 uppercase tracking-widest mb-2">{t("Leia esta frase:", "Read this phrase:", "Lee esta frase:")}</div>
                <p className="font-mono text-base text-white leading-relaxed font-bold text-center">
                  "{localizedCorePhrase}"
                </p>
              </div>

              <div className="border border-white/15 bg-black/50 px-5 py-4 w-full max-w-md">
                <div className="font-mono text-[10px] text-white/40 uppercase tracking-widest mb-2">{t("Como entregar este take:", "How to deliver this take:", "Cómo interpretar esta toma:")}</div>
                <p className={`font-mono text-[13px] leading-relaxed ${currentTake.color.split(" ")[0]}`}>
                  {localizedTakeInstruction(currentTake, t)}
                </p>
                <div className="font-mono text-[10px] text-white/30 mt-2">
                  {localizedTakeContext(currentTake.context, t)}
                </div>
                <div className="font-mono text-[10px] text-white/30 mt-3">{t(`Duração alvo: ~${currentTake.targetSecs} segundos`, `Target duration: ~${currentTake.targetSecs} seconds`, `Duración objetivo: ~${currentTake.targetSecs} segundos`)}</div>
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

          {/* Recording indicator + teleprompter — frase visível durante toda a gravação */}
          {phase === "recording" && (
            <>
              <div className="absolute top-3 left-3 flex items-center gap-2 border border-red-500/40 bg-red-500/20 px-3 py-1 z-10">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="font-mono text-xs text-red-400 font-bold tabular-nums">
                  {String(Math.floor(recordingSecs / 60)).padStart(2,"0")}:{String(recordingSecs % 60).padStart(2,"0")}
                </span>
              </div>
              {/* Teleprompter — frase fixada na base da câmera para o usuário ler durante a gravação */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/90 border-t border-white/10 px-4 py-3 z-10">
                <div className="font-mono text-[9px] uppercase tracking-widest text-white/40 mb-1.5">{t("Leia em voz alta:", "Read aloud:", "Lee en voz alta:")}</div>
                <p className="font-mono text-[13px] text-white leading-relaxed">
                  "{localizedCorePhrase}"
                </p>
              </div>
            </>
          )}

          {/* Review overlay — vídeo gravado, aguardando decisão */}
          {phase === "review" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="font-mono text-sm text-white/60 text-center">
                <Check className="h-8 w-8 text-green-400 mx-auto mb-2" />
                {t(`Take ${currentTakeIdx + 1} gravado.`, `Take ${currentTakeIdx + 1} recorded.`, `Toma ${currentTakeIdx + 1} grabada.`)}<br />
                <span className="text-[11px] text-white/40">{t("Regrave ou avance para o próximo.", "Re-record or continue to the next one.", "Vuelve a grabar o continúa con la siguiente.")}</span>
              </div>
            </div>
          )}

          {/* Upload overlay */}
          {phase === "uploading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="font-mono text-sm text-white">{t("Enviando takes…", "Uploading takes…", "Subiendo tomas…")}</p>
            </div>
          )}
        </div>

        {/* Sidebar — referência e lista de takes */}
        <div className="border-l border-white/10 bg-black/60 overflow-y-auto flex flex-col">
          {/* Direção rápida durante gravação */}
          {phase === "recording" && (
            <div className="px-4 py-3 border-b border-white/10">
              <div className="font-mono text-[10px] text-white/40 uppercase tracking-widest mb-1.5">{t("Lembre-se:", "Remember:", "Recuerda:")}</div>
              <p className={`font-mono text-[11px] leading-relaxed ${currentTake.color.split(" ")[0]}`}>
                {localizedTakeInstruction(currentTake, t)}
              </p>
            </div>
          )}

          {/* Frase de referência */}
          <div className="px-4 py-3 border-b border-white/10">
            <div className="font-mono text-[10px] text-white/40 uppercase tracking-widest mb-1.5">{t("Frase:", "Phrase:", "Frase:")}</div>
            <p className="font-mono text-[11px] text-white/80 leading-relaxed">
              "{localizedCorePhrase}"
            </p>
          </div>

          {/* Lista de takes */}
          <div className="px-4 py-4 flex-1">
            <div className="font-mono text-[10px] text-white/40 uppercase tracking-widest mb-2">{t("Takes:", "Takes:", "Tomas:")}</div>
            <div className="space-y-1">
              {CLONE_TAKES.map((take, i) => {
                const state = takeStates[i];
                const TIcon = take.icon;
                return (
                  <div key={take.id} className={`flex items-center gap-2 px-2 py-1.5 ${i === currentTakeIdx ? "border border-white/20 bg-white/5" : ""}`}>
                    {state === "done" ? (
                      <Check className="h-3 w-3 text-green-400" />
                    ) : state === "recording" ? (
                      <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                    ) : (
                      <TIcon className={`h-3 w-3 ${take.color.split(" ")[0]} opacity-50`} />
                    )}
                    <span className={`font-mono text-[11px] ${
                      i === currentTakeIdx ? "text-white" :
                      state === "done" ? "text-green-400" :
                      "text-white/30"
                    }`}>
                      {localizedTakeEmotion(take, t)}
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
                {t('Leia as instruções na tela e clique em "Iniciar gravação"', 'Read the instructions on screen and click "Start recording"', 'Lee las instrucciones en pantalla y pulsa «Iniciar grabación»')}
              </div>
            )}
            {phase === "recording" && (
              <div className="font-mono text-[10px] text-primary/70 text-center flex items-center justify-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                {t("Gravando — clique PARAR ao terminar", "Recording — click STOP when finished", "Grabando: pulsa DETENER al terminar")}
              </div>
            )}
            {phase === "review" && (
              <div className="font-mono text-[10px] text-white/40 text-center">
                {t(`Take ${currentTakeIdx + 1} gravado ✓`, `Take ${currentTakeIdx + 1} recorded ✓`, `Toma ${currentTakeIdx + 1} grabada ✓`)}
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
