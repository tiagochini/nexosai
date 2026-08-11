/**
 * Clone Digital Hub — /clone-digital
 *
 * Dois fluxos independentes:
 *   1. Clone de Voz  → CloneStudioPanel (5 takes emocionais → ElevenLabs)
 *   2. Avatar Digital → gravação de 2 vídeos (treino + consentimento → HeyGen)
 *
 * Recovery: se os vídeos foram enviados mas o HeyGen falhou (403 / sem Enterprise),
 * os arquivos ficam salvos no GCS. O usuário pode retentar tirando apenas uma foto
 * via webcam — sem regravar os dois vídeos inteiros.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { CloneStudioPanel } from "@/components/CloneStudioPanel";
import { toast } from "sonner";
import {
  Mic, Camera, CheckCircle2, RefreshCw, Square, ChevronLeft,
  AlertTriangle, Sparkles, Video, Info, ArrowRight, Check,
  Loader2, Star, Shield,
} from "lucide-react";
import { useLocation } from "wouter";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface WorkspacePersona {
  voiceCloneId?: string | null;
  heygenAvatarId?: string | null;
  digitalTwinId?: string | null;
  avatarTrainingStatus?: string | null;
  avatarType?: string | null;
  firstName?: string;
  lastName?: string;
}

interface AvatarRecoveryStatus {
  heygenAvatarId: string | null;
  digitalTwinId: string | null;
  avatarTrainingStatus: string | null;
  avatarType: string | null;
  hasGCSVideos: boolean;
}

type AvatarStep = "training" | "consent" | "uploading" | "pending" | "done";
type VideoRecState = "idle" | "recording" | "recorded";

// ─── Snapshot camera (for recovery flow) ──────────────────────────────────────

function SnapshotCamera({ onCapture, onCancel }: { onCapture: (b64: string) => void; onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then(s => {
        streamRef.current = s;
        if (videoRef.current) { videoRef.current.srcObject = s; }
        setReady(true);
      })
      .catch(() => setError("Câmera não disponível. Libere o acesso nas configurações do navegador."));
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  function takeSnapshot() {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width  = videoRef.current.videoWidth  || 640;
    canvas.height = videoRef.current.videoHeight || 360;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const b64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1] ?? "";
    streamRef.current?.getTracks().forEach(t => t.stop());
    onCapture(b64);
  }

  return (
    <div className="space-y-3 border border-primary/30 rounded-xl p-4 bg-background/40">
      <p className="font-mono text-xs text-muted-foreground leading-relaxed">
        Olhe para a câmera e clique em <strong className="text-foreground">Tirar foto</strong>. Ela será usada para criar seu avatar (seus vídeos gravados já estão salvos).
      </p>
      {error && (
        <div className="flex items-center gap-2 border border-destructive/40 bg-destructive/10 px-3 py-2 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <span className="font-mono text-xs text-destructive">{error}</span>
        </div>
      )}
      <video ref={videoRef} autoPlay playsInline muted
        className="w-full max-w-sm rounded-lg border border-border/40"
        style={{ transform: "scaleX(-1)" }}
      />
      <div className="flex gap-2">
        <Button onClick={takeSnapshot} disabled={!ready} className="font-mono gap-2 btn-weapon-primary">
          <Camera className="h-4 w-4" /> Tirar foto
        </Button>
        <Button variant="outline" onClick={onCancel} className="font-mono text-xs">
          Cancelar
        </Button>
      </div>
    </div>
  );
}

// ─── Avatar recording sub-component ───────────────────────────────────────────

function AvatarCloneFlow({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<AvatarStep>("training");
  const [recState, setRecState] = useState<VideoRecState>("idle");
  const [trainingUrl, setTrainingUrl] = useState<string | null>(null);
  const [trainingBase64, setTrainingBase64] = useState<string | null>(null);
  const [consentUrl, setConsentUrl] = useState<string | null>(null);
  const [consentBase64, setConsentBase64] = useState<string | null>(null);
  const [videoMime, setVideoMime] = useState("video/webm");
  const [error, setError] = useState<string | null>(null);
  const [trainingStatus, setTrainingStatus] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);
  const streamRef   = useRef<MediaStream | null>(null);
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function startRecording(kind: "training" | "consent") {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "video/mp4";
      setVideoMime(mime);
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        const url  = URL.createObjectURL(blob);
        const reader = new FileReader();
        reader.onload = () => {
          const b64 = (reader.result as string).split(",")[1] ?? "";
          if (kind === "training") setTrainingBase64(b64);
          else setConsentBase64(b64);
        };
        reader.readAsDataURL(blob);
        if (kind === "training") setTrainingUrl(url);
        else setConsentUrl(url);
        setRecState("recorded");
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecState("recording");
    } catch {
      setError("Câmera/microfone não disponíveis. Verifique as permissões do navegador.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
  }

  function retake(kind: "training" | "consent") {
    if (kind === "training") { setTrainingUrl(null); setTrainingBase64(null); }
    else { setConsentUrl(null); setConsentBase64(null); }
    setRecState("idle");
  }

  // Extract a JPEG frame from the training video for the talking_photo fallback.
  async function extractFrame(): Promise<string | null> {
    if (!trainingUrl) return null;
    return new Promise((resolve) => {
      const vid = document.createElement("video");
      vid.src = trainingUrl;
      vid.crossOrigin = "anonymous";
      vid.muted = true;
      vid.currentTime = 1;
      vid.onloadeddata = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width  = vid.videoWidth  || 640;
          canvas.height = vid.videoHeight || 360;
          canvas.getContext("2d")?.drawImage(vid, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1] ?? null);
        } catch { resolve(null); }
      };
      vid.onerror = () => resolve(null);
      vid.load();
    });
  }

  function startPolling() {
    setStep("pending");
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await customFetch<{ status: string }>("/api/workspaces/me/persona/avatar-training-status");
        setTrainingStatus(res.status);
        if (res.status === "complete") {
          if (pollRef.current) clearInterval(pollRef.current);
          setStep("done");
          toast.success("Avatar digital treinado com sucesso!");
          onDone();
        } else if (res.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setError("Treinamento falhou. Tente novamente.");
          setStep("training");
        }
      } catch { /* keep polling */ }
    }, 8000);
  }

  async function submit() {
    if (!trainingBase64 || !consentBase64) return;
    setStep("uploading");
    setError(null);
    try {
      const frameBase64 = await extractFrame();
      const result = await customFetch<{ avatarType?: string; success: boolean }>("/api/workspaces/me/persona/clone-avatar-video", {
        method: "POST",
        body: JSON.stringify({
          trainingVideoBase64: trainingBase64,
          consentVideoBase64:  consentBase64,
          mimeType: videoMime,
          ...(frameBase64 ? { frameBase64 } : {}),
        }),
      });

      // talking_photo: already done (synchronous)
      if (result.avatarType === "talking_photo") {
        toast.success("Avatar criado com sucesso!");
        setStep("done");
        onDone();
        return;
      }

      // digital_twin: async training — start polling
      startPolling();
    } catch {
      setError("Erro ao enviar vídeos. Tente novamente.");
      setStep("training");
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 border border-destructive/40 bg-destructive/10 px-3 py-2 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <span className="font-mono text-xs text-destructive">{error}</span>
        </div>
      )}

      {/* PASSO 1 — Vídeo de treino */}
      {(step === "training") && (
        <div className="space-y-4">
          <div className="border border-border/50 rounded-xl p-5 space-y-3 bg-background/40">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center">
                <span className="font-mono text-[11px] font-bold text-primary">1</span>
              </div>
              <span className="font-mono text-sm font-bold">Vídeo de treino — 20-30 segundos</span>
            </div>
            <p className="font-mono text-xs text-muted-foreground leading-relaxed">
              Olhe para a câmera, fale naturalmente e mova levemente a cabeça. O objetivo é treinar seus movimentos faciais para o HeyGen criar seu avatar.
            </p>
            <div className="border border-yellow-500/20 bg-yellow-500/5 rounded-lg px-3 py-2">
              <p className="font-mono text-[11px] text-yellow-400/80">
                💡 Dica: boa iluminação frontal, fundo limpo, câmera na altura dos olhos.
              </p>
            </div>
            {!trainingUrl && recState === "idle" && (
              <Button onClick={() => startRecording("training")} className="font-mono gap-2">
                <Camera className="h-4 w-4" /> Iniciar gravação de treino
              </Button>
            )}
            {recState === "recording" && !trainingUrl && (
              <Button variant="destructive" onClick={stopRecording} className="font-mono gap-2 animate-pulse">
                <Square className="h-4 w-4" /> Parar gravação
              </Button>
            )}
            {trainingUrl && (
              <div className="space-y-3">
                <video src={trainingUrl} controls className="w-full max-w-sm rounded-lg border border-border/40" />
                <div className="flex gap-2">
                  <Button onClick={() => { setStep("consent"); setRecState("idle"); }} className="font-mono gap-2">
                    <Check className="h-4 w-4" /> Ficou bom — Próximo passo
                  </Button>
                  <Button variant="outline" onClick={() => retake("training")} className="font-mono text-xs gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" /> Regravar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PASSO 2 — Vídeo de consentimento */}
      {step === "consent" && (
        <div className="space-y-4">
          <div className="border border-border/50 rounded-xl p-5 space-y-3 bg-background/40">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center">
                <span className="font-mono text-[11px] font-bold text-primary">2</span>
              </div>
              <span className="font-mono text-sm font-bold">Consentimento — exigido pelo HeyGen</span>
            </div>
            <p className="font-mono text-xs text-muted-foreground leading-relaxed">
              Grave-se dizendo em voz alta e clara:
            </p>
            <div className="border border-primary/30 bg-primary/5 rounded-lg px-4 py-3">
              <p className="font-mono text-sm text-white leading-relaxed font-bold">
                "Eu autorizo o uso da minha imagem e voz para criar um avatar digital meu."
              </p>
            </div>
            {!consentUrl && recState === "idle" && (
              <Button onClick={() => startRecording("consent")} className="font-mono gap-2">
                <Mic className="h-4 w-4" /> Iniciar gravação de consentimento
              </Button>
            )}
            {recState === "recording" && !consentUrl && (
              <Button variant="destructive" onClick={stopRecording} className="font-mono gap-2 animate-pulse">
                <Square className="h-4 w-4" /> Parar gravação
              </Button>
            )}
            {consentUrl && (
              <div className="space-y-3">
                <video src={consentUrl} controls className="w-full max-w-sm rounded-lg border border-border/40" />
                <div className="flex gap-2">
                  <Button onClick={submit} className="font-mono gap-2 btn-weapon-primary">
                    <Sparkles className="h-4 w-4" /> Enviar para treinamento
                  </Button>
                  <Button variant="outline" onClick={() => retake("consent")} className="font-mono text-xs gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" /> Regravar
                  </Button>
                </div>
              </div>
            )}
            <button onClick={() => { setStep("training"); setRecState("idle"); }} className="font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <ChevronLeft className="h-3.5 w-3.5" /> Voltar para o vídeo de treino
            </button>
          </div>
        </div>
      )}

      {/* ENVIANDO */}
      {step === "uploading" && (
        <div className="flex items-center gap-3 border border-border/40 rounded-xl p-5 bg-background/40">
          <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
          <div>
            <p className="font-mono text-sm font-bold">Enviando vídeos…</p>
            <p className="font-mono text-xs text-muted-foreground mt-0.5">Criando seu avatar. Isso pode levar alguns segundos.</p>
          </div>
        </div>
      )}

      {/* TREINANDO */}
      {step === "pending" && (
        <div className="flex items-start gap-3 border border-border/40 rounded-xl p-5 bg-background/40">
          <RefreshCw className="h-5 w-5 text-primary animate-spin shrink-0 mt-0.5" />
          <div>
            <p className="font-mono text-sm font-bold">Treinando seu avatar digital…</p>
            <p className="font-mono text-xs text-muted-foreground mt-0.5 leading-relaxed">
              O HeyGen está processando seus vídeos. Isso leva alguns minutos. Você pode fechar esta página — o avatar estará pronto quando voltar.
            </p>
            <p className="font-mono text-[11px] text-primary/60 mt-2">Status: {trainingStatus ?? "pending"}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function CloneDigitalPage() {
  const [, navigate] = useLocation();
  const [persona, setPersona]         = useState<WorkspacePersona | null>(null);
  const [recovery, setRecovery]       = useState<AvatarRecoveryStatus | null>(null);
  const [loading, setLoading]         = useState(true);
  const [activeFlow, setActiveFlow]   = useState<"voice" | "avatar" | null>(null);
  const [showSnapshot, setShowSnapshot] = useState(false);
  const [retrying, setRetrying]       = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadPersona = useCallback(() => {
    return customFetch<{ persona: WorkspacePersona }>("/api/workspaces/me/persona")
      .then(r => setPersona(r.persona))
      .catch(() => {});
  }, []);

  const loadRecovery = useCallback(() => {
    return customFetch<AvatarRecoveryStatus>("/api/workspaces/me/persona/avatar-recovery-status")
      .then(r => setRecovery(r))
      .catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([loadPersona(), loadRecovery()]).finally(() => setLoading(false));
  }, [loadPersona, loadRecovery]);

  // Auto-resume polling if digital twin training is in progress from a previous session
  useEffect(() => {
    if (!recovery) return;
    if (recovery.heygenAvatarId) return; // already done
    if (recovery.digitalTwinId && recovery.avatarTrainingStatus === "pending") {
      if (pollRef.current) return; // already polling
      pollRef.current = setInterval(async () => {
        try {
          const res = await customFetch<{ status: string; heygenAvatarId?: string }>("/api/workspaces/me/persona/avatar-training-status");
          if (res.status === "complete") {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            toast.success("Avatar digital pronto!");
            await Promise.all([loadPersona(), loadRecovery()]);
          } else if (res.status === "failed") {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            await loadRecovery();
          }
        } catch { /* keep polling */ }
      }, 8000);
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [recovery, loadPersona, loadRecovery]);

  function refreshAll() {
    Promise.all([loadPersona(), loadRecovery()]);
  }

  async function retryFromGCS(frameBase64?: string) {
    setRetrying(true);
    try {
      const result = await customFetch<{ avatarType?: string; success: boolean }>("/api/workspaces/me/persona/retry-avatar-from-gcs", {
        method: "POST",
        body: JSON.stringify(frameBase64 ? { frameBase64 } : {}),
      });
      if (result.avatarType === "talking_photo") {
        toast.success("Avatar criado com sucesso!");
        await Promise.all([loadPersona(), loadRecovery()]);
      } else {
        // Digital twin started — start polling
        toast.success("Treinamento iniciado. Aguarde alguns minutos.");
        await loadRecovery();
      }
    } catch (e: any) {
      if (e?.code === "HEYGEN_ENTERPRISE_REQUIRED" || e?.message?.includes("Enterprise")) {
        // Need a photo — show snapshot camera
        setShowSnapshot(true);
      } else if (e?.code === "GCS_VIDEOS_NOT_FOUND") {
        toast.error("Vídeos não encontrados no storage. Grave novamente.");
        await loadRecovery();
      } else {
        toast.error("Erro ao retentar. Tente novamente.");
      }
    } finally {
      setRetrying(false);
    }
  }

  const hasVoice  = !!persona?.voiceCloneId;
  const hasAvatar = !!persona?.heygenAvatarId;
  const firstName = persona?.firstName ?? "Fundador";

  const isTrainingPending = !hasAvatar && !!recovery?.digitalTwinId &&
    (recovery?.avatarTrainingStatus === "pending" || recovery?.avatarTrainingStatus === "in_progress");
  const canRetryFromGCS = !hasAvatar && !isTrainingPending && !!recovery?.hasGCSVideos;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate("/settings")}
          className="font-mono text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1.5 mb-6 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Voltar para Configurações
        </button>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Star className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-mono text-xl font-bold tracking-tight">Clone Digital</h1>
            <p className="font-mono text-xs text-muted-foreground">Crie sua presença de IA permanente</p>
          </div>
        </div>
        <p className="font-mono text-sm text-muted-foreground leading-relaxed mt-3">
          Seu clone digital é composto por dois elementos independentes: sua <strong className="text-foreground">voz clonada</strong> (narração automática de campanhas) e seu <strong className="text-foreground">avatar de vídeo</strong> (apresentador realista em vídeos com IA).
        </p>
      </div>

      <div className="space-y-5">
        {/* ── Card 1: Clone de Voz ──────────────────────────────────────────── */}
        <div className={`rounded-2xl border p-6 transition-all ${hasVoice ? "border-green-500/30 bg-green-500/5" : "border-border/50 bg-background/40"}`}>
          <div className="flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${hasVoice ? "bg-green-500/15 border border-green-500/30" : "bg-primary/10 border border-primary/30"}`}>
              <Mic className={`h-5 w-5 ${hasVoice ? "text-green-400" : "text-primary"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-mono text-base font-bold">Clone de Voz</h2>
                {hasVoice
                  ? <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">Ativo</span>
                  : <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">Não configurado</span>}
              </div>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                {hasVoice
                  ? "Sua voz está clonada e pronta para narrar vídeos e anúncios automaticamente."
                  : "Grave 5 takes da mesma frase com emoções diferentes. Em ~5 minutos, sua voz estará disponível para narração automática de campanhas."}
              </p>
              {hasVoice && persona?.voiceCloneId && (
                <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">
                  ID: {persona.voiceCloneId.slice(0, 18)}…
                </p>
              )}
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            {hasVoice ? (
              <Button variant="outline" onClick={() => setActiveFlow("voice")} className="font-mono text-xs gap-2">
                <RefreshCw className="h-3.5 w-3.5" /> Regravar clone de voz
              </Button>
            ) : (
              <Button onClick={() => setActiveFlow("voice")} className="font-mono gap-2">
                <Mic className="h-4 w-4" /> Criar clone de voz agora
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            <span className="font-mono text-[11px] text-muted-foreground">
              {hasVoice ? "Substitui o clone atual" : "≈ 5 minutos · câmera + microfone"}
            </span>
          </div>
        </div>

        {/* ── Card 2: Avatar Digital ────────────────────────────────────────── */}
        <div className={`rounded-2xl border p-6 transition-all ${hasAvatar ? "border-green-500/30 bg-green-500/5" : isTrainingPending ? "border-primary/30 bg-primary/5" : "border-border/50 bg-background/40"}`}>
          <div className="flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${hasAvatar ? "bg-green-500/15 border border-green-500/30" : isTrainingPending ? "bg-primary/10 border border-primary/30" : "bg-primary/10 border border-primary/30"}`}>
              <Video className={`h-5 w-5 ${hasAvatar ? "text-green-400" : "text-primary"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-mono text-base font-bold">Avatar Digital</h2>
                {hasAvatar && <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">Ativo</span>}
                {isTrainingPending && <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 flex items-center gap-1"><RefreshCw className="h-2.5 w-2.5 animate-spin" />Treinando…</span>}
                {!hasAvatar && !isTrainingPending && <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">Não configurado</span>}
              </div>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                {hasAvatar
                  ? "Seu avatar de vídeo está treinado e pronto para aparecer como apresentador em vídeos gerados por IA."
                  : isTrainingPending
                    ? "Seus vídeos foram enviados e o HeyGen está treinando seu avatar digital. Isso pode levar alguns minutos — fique à vontade para fechar e voltar depois."
                    : "Grave 2 vídeos curtos (treino + consentimento). O HeyGen treina seu avatar em alguns minutos — ele aparecerá falando em vídeos de campanha."}
              </p>
              {hasAvatar && persona?.heygenAvatarId && (
                <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">
                  ID HeyGen: {persona.heygenAvatarId.slice(0, 18)}… · {persona.avatarType ?? "avatar"}
                </p>
              )}
              {isTrainingPending && recovery?.digitalTwinId && (
                <p className="font-mono text-[10px] text-primary/60 mt-1">
                  Digital Twin ID: {recovery.digitalTwinId.slice(0, 18)}… · verificando a cada 8s
                </p>
              )}
            </div>
          </div>

          {/* Recovery banner — GCS videos saved but avatar not created */}
          {canRetryFromGCS && !showSnapshot && !activeFlow && (
            <div className="mt-4 border border-yellow-500/20 bg-yellow-500/5 rounded-xl px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-yellow-400 shrink-0" />
                <p className="font-mono text-xs font-bold text-yellow-300">Seus vídeos estão salvos</p>
              </div>
              <p className="font-mono text-[11px] text-yellow-400/80 leading-relaxed">
                Os vídeos que você gravou foram enviados para o servidor mas o avatar não foi criado. Você não precisa regravar — tire apenas uma foto para finalizar a criação.
              </p>
              <div className="flex gap-2 pt-1">
                <Button
                  onClick={() => retryFromGCS()}
                  disabled={retrying}
                  size="sm"
                  className="font-mono text-xs gap-1.5 btn-weapon-primary"
                >
                  {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Retentar criação
                </Button>
                <Button
                  onClick={() => setShowSnapshot(true)}
                  disabled={retrying}
                  size="sm"
                  variant="outline"
                  className="font-mono text-xs gap-1.5"
                >
                  <Camera className="h-3.5 w-3.5" /> Tirar foto + retentar
                </Button>
              </div>
            </div>
          )}

          {/* Snapshot camera for retry */}
          {showSnapshot && (
            <div className="mt-4">
              <SnapshotCamera
                onCapture={async (b64) => {
                  setShowSnapshot(false);
                  await retryFromGCS(b64);
                }}
                onCancel={() => setShowSnapshot(false)}
              />
            </div>
          )}

          {/* Main action buttons */}
          <div className="mt-5 flex items-center gap-3">
            {activeFlow === "avatar" ? (
              <AvatarCloneFlow onDone={() => { setActiveFlow(null); refreshAll(); }} />
            ) : !isTrainingPending && (
              <>
                <Button
                  onClick={() => setActiveFlow("avatar")}
                  variant={hasAvatar ? "outline" : "default"}
                  className="font-mono gap-2"
                >
                  <Camera className="h-4 w-4" />
                  {hasAvatar ? "Retreinar avatar" : canRetryFromGCS ? "Regravar do zero" : "Criar avatar digital agora"}
                  {!hasAvatar && !canRetryFromGCS && <ArrowRight className="h-4 w-4" />}
                </Button>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {hasAvatar ? "Substitui o avatar atual" : "≈ 10 min · câmera + microfone"}
                </span>
              </>
            )}
          </div>
        </div>

        {/* ── Info box ─────────────────────────────────────────────────────── */}
        <div className="border border-border/30 rounded-xl px-4 py-4 bg-background/20">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Clone de Voz</strong> é usado pela IA para narrar reels, VSLs e anúncios automaticamente — sem você gravar cada vídeo.
              </p>
              <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Avatar Digital</strong> é um modelo realista do seu rosto que aparece falando em vídeos gerados pela NexOS via HeyGen.
              </p>
            </div>
          </div>
        </div>

        {/* ── Guias de referência ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <a href="/video-production/director-guide" className="border border-border/40 rounded-xl p-4 hover:border-primary/40 transition-colors group">
            <div className="font-mono text-xs font-bold group-hover:text-primary transition-colors mb-1">Guia do Diretor</div>
            <div className="font-mono text-[11px] text-muted-foreground">Vestuário, cenário, iluminação e postura para gravações profissionais</div>
          </a>
          <a href="/video-production/filming-guide" className="border border-border/40 rounded-xl p-4 hover:border-primary/40 transition-colors group">
            <div className="font-mono text-xs font-bold group-hover:text-primary transition-colors mb-1">Guia Técnico</div>
            <div className="font-mono text-[11px] text-muted-foreground">Setup de câmera, áudio, iluminação e enquadramento</div>
          </a>
        </div>
      </div>

      {/* ── CloneStudioPanel (voice clone overlay) ─────────────────────────── */}
      {activeFlow === "voice" && (
        <CloneStudioPanel
          firstName={firstName}
          onComplete={(sessionId) => {
            toast.success("Clone de voz criado com sucesso!");
            setActiveFlow(null);
            loadPersona();
            console.info("voice clone session:", sessionId);
          }}
          onSkip={() => setActiveFlow(null)}
        />
      )}
    </div>
  );
}
