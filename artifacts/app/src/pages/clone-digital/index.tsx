/**
 * Clone Digital Hub — /clone-digital
 *
 * Dois fluxos independentes:
 *   1. Clone de Voz  → CloneStudioPanel (5 takes → ElevenLabs)
 *   2. Avatar Digital → 2 vídeos (treino + consentimento → HeyGen)
 *
 * Persistência ativa:
 *   • Voz: cada take é enviado ao servidor assim que aceito; progresso salvo no banco.
 *          Ao retornar, "Retomar (X/5)" reabre o painel no take correto.
 *   • Avatar: vídeo de treino é enviado ao GCS ao avançar para o passo de consentimento.
 *             Ao retornar, detecta quais vídeos existem no GCS e abre no passo correto.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { CloneStudioPanel, type CloneResumeState } from "@/components/CloneStudioPanel";
import { toast } from "sonner";
import {
  Mic, Camera, RefreshCw, Square, ChevronLeft,
  AlertTriangle, Sparkles, Video, Info, ArrowRight,
  Loader2, Star, Shield, Check, RotateCcw,
} from "lucide-react";
import { useLocation } from "wouter";
import { useUiText } from "@/lib/i18n";

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
  heygenConsentUrl: string | null;
  hasTrainingVideo: boolean;
  hasConsentVideo: boolean;
  hasGCSVideos: boolean;
}

interface VoiceCloneProgress {
  inProgress: boolean;
  recordingId?: string;
  completedTakeIds?: string[];
}

type AvatarFlowStep = "training" | "consent" | "ready";
type VideoRecState  = "idle" | "recording" | "recorded";

// ─── Snapshot camera (for avatar recovery) ────────────────────────────────────

function SnapshotCamera({ onCapture, onCancel }: { onCapture: (b64: string) => void; onCancel: () => void }) {
  const t = useUiText();
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then(s => { streamRef.current = s; if (videoRef.current) { videoRef.current.srcObject = s; } setReady(true); })
      .catch(() => setError(t("Câmera não disponível. Libere o acesso nas configurações do navegador.", "Camera unavailable. Allow access in your browser settings.", "Cámara no disponible. Permite el acceso en la configuración del navegador.")));
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
        {t("Olhe para a câmera e clique em", "Look at the camera and click", "Mira a la cámara y haz clic en")} <strong className="text-foreground">{t("Tirar foto", "Take Photo", "Tomar foto")}</strong>. {t("Será usada para criar seu avatar — seus vídeos já estão salvos no servidor.", "This will be used to create your avatar — your videos are already saved on the server.", "Se usará para crear tu avatar; tus vídeos ya están guardados en el servidor.")}
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
          <Camera className="h-4 w-4" /> {t("Tirar foto", "Take Photo", "Tomar foto")}
        </Button>
        <Button variant="outline" onClick={onCancel} className="font-mono text-xs">{t("Cancelar", "Cancel", "Cancelar")}</Button>
      </div>
    </div>
  );
}

// ─── Avatar recording flow ────────────────────────────────────────────────────

interface AvatarFlowProps {
  onDone: () => void;
  /** When set, start the flow at this step (skipping earlier ones). */
  initialStep?: AvatarFlowStep;
  /** Training video is already in GCS — skip recording it again. */
  hasTrainingInGCS?: boolean;
}

function AvatarCloneFlow({ onDone, initialStep = "training", hasTrainingInGCS = false }: AvatarFlowProps) {
  const t = useUiText();
  const [step, setStep]         = useState<"training" | "consent" | "uploading" | "pending" | "done">(
    hasTrainingInGCS ? "consent" : (initialStep === "consent" ? "consent" : "training"),
  );
  const [recState, setRecState] = useState<VideoRecState>("idle");
  const [trainingUrl, setTrainingUrl] = useState<string | null>(null);
  const [consentUrl, setConsentUrl]   = useState<string | null>(null);
  // Rastreia se o upload do vídeo de treino foi confirmado no servidor
  const [trainingSaved, setTrainingSaved] = useState(hasTrainingInGCS);
  const [trainingUploadError, setTrainingUploadError] = useState<string | null>(null);
  // Consent auto-upload state (upload para GCS imediatamente após gravação)
  const [consentSaved, setConsentSaved]   = useState(false);
  const [consentUploading, setConsentUploading] = useState(false);
  const [consentUploadError, setConsentUploadError] = useState<string | null>(null);
  // Demo avatar video state
  const [demoJobId, setDemoJobId]         = useState<string | null>(null);
  const [demoVideoUrl, setDemoVideoUrl]   = useState<string | null>(null);
  const [demoGenerating, setDemoGenerating] = useState(false);
  const [demoError, setDemoError]         = useState<string | null>(null);
  const [demoStillProcessing, setDemoStillProcessing] = useState(false);
  const demoRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [videoMime, setVideoMime]     = useState("video/webm");
  const [error, setError]             = useState<string | null>(null);
  const [trainingStatus, setTrainingStatus] = useState<string | null>(null);
  const [uploadingTraining, setUploadingTraining] = useState(false);

  const recorderRef     = useRef<MediaRecorder | null>(null);
  const chunksRef       = useRef<Blob[]>([]);
  const streamRef       = useRef<MediaStream | null>(null);
  const pollRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoPollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const trainingBlobRef = useRef<Blob | null>(null);
  const consentBlobRef  = useRef<Blob | null>(null);
  // GCS keys (set after auto-upload)
  const trainingKeyRef  = useRef<string | null>(hasTrainingInGCS ? "already-in-gcs" : null);
  const consentKeyRef   = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (pollRef.current) clearInterval(pollRef.current);
      if (demoPollRef.current) clearInterval(demoPollRef.current);
      if (demoRetryRef.current) clearTimeout(demoRetryRef.current);
    };
  }, []);

  // ── Auto-upload consent immediately when recording stops ──────────────────
  // O blob de consent é definido em recorder.onstop. Este effect dispara logo
  // após a URL ser criada, fazendo upload para GCS antes de qualquer interação.
  useEffect(() => {
    if (!consentUrl || !consentBlobRef.current || consentSaved) return;
    let cancelled = false;
    setConsentUploading(true);
    setConsentUploadError(null);
    uploadVideoRaw(consentBlobRef.current, "consent")
      .then(key => {
        if (cancelled) return;
        consentKeyRef.current = key;
        setConsentSaved(true);
        setConsentUploading(false);
        toast.success(t("Vídeo de consentimento salvo com segurança ✓", "Consent video saved securely ✓", "Vídeo de consentimiento guardado de forma segura ✓"));
      })
      .catch(err => {
        if (cancelled) return;
        setConsentUploadError(err?.message ?? t("Erro ao salvar vídeo de consentimento", "Error saving consent video", "Error al guardar el vídeo de consentimiento"));
        setConsentUploading(false);
        toast.error(t("Falha ao salvar vídeo de consentimento — tente novamente", "Failed to save consent video — please try again", "No se pudo guardar el vídeo de consentimiento; inténtalo de nuevo"));
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consentUrl]);

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
        if (kind === "training") { trainingBlobRef.current = blob; setTrainingUrl(URL.createObjectURL(blob)); }
        else                     { consentBlobRef.current  = blob; setConsentUrl(URL.createObjectURL(blob));  }
        setRecState("recorded");
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecState("recording");
    } catch {
      setError(t("Câmera/microfone não disponíveis. Verifique as permissões do navegador.", "Camera/microphone unavailable. Check your browser permissions.", "Cámara/micrófono no disponibles. Comprueba los permisos del navegador."));
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
  }

  function retake(kind: "training" | "consent") {
    if (kind === "training") {
      setTrainingUrl(null); trainingBlobRef.current = null; trainingKeyRef.current = null;
      setTrainingSaved(false); setTrainingUploadError(null);
    } else {
      setConsentUrl(null); consentBlobRef.current = null; consentKeyRef.current = null;
      setConsentSaved(false); setConsentUploadError(null); setConsentUploading(false);
    }
    setRecState("idle");
  }

  async function uploadVideoRaw(blob: Blob, kind: "training" | "consent"): Promise<string> {
    const base        = (import.meta as any).env?.BASE_URL ?? "/";
    const token       = localStorage.getItem("accessToken") ?? localStorage.getItem("nexos_access_token") ?? "";
    const contentType = blob.type || videoMime;
    const authHeader  = (token ? { "Authorization": `Bearer ${token}` } : {}) as Record<string, string>;

    // Vídeos grandes (>8 MB) são enviados em chunks de 8 MB para contornar
    // o limite de 413 do proxy do Replit em produção.
    const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB

    if (blob.size > CHUNK_SIZE) {
      const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);
      const chunkUrl    = `${base}api/workspaces/me/persona/upload-chunk/${kind}`.replace("//", "/");
      let finalKey      = "";

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const chunk = blob.slice(start, start + CHUNK_SIZE);
        const res   = await fetch(chunkUrl, {
          method:  "POST",
          headers: {
            "Content-Type":    contentType,
            "X-Chunk-Index":   String(i),
            "X-Total-Chunks":  String(totalChunks),
            ...authHeader,
          },
          body: chunk,
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Upload ${kind} falhou (${res.status}): ${txt.slice(0, 200)}`);
        }
        const data = (await res.json()) as { key?: string; complete: boolean };
        if (data.key) finalKey = data.key;
      }
      return finalKey;
    }

    // Vídeos pequenos: upload direto (caminho original)
    const url = `${base}api/workspaces/me/persona/upload-video/${kind}`.replace("//", "/");
    const res = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": contentType, ...authHeader },
      body:    blob,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Upload ${kind} falhou (${res.status}): ${txt.slice(0, 200)}`);
    }
    return ((await res.json()) as { key: string }).key;
  }

  async function extractFrame(): Promise<string | null> {
    if (!trainingUrl) return null;
    return new Promise((resolve) => {
      const vid = document.createElement("video");
      vid.src = trainingUrl;
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

  /** Upload training video before advancing — bloqueante para garantir que está no GCS. */
  async function advanceToConsent() {
    setRecState("idle");
    setTrainingUploadError(null);

    if (hasTrainingInGCS) {
      // Já confirmado no GCS — avançar direto
      setTrainingSaved(true);
      setStep("consent");
      return;
    }

    if (!trainingBlobRef.current) {
      setStep("consent");
      return;
    }

    setUploadingTraining(true);
    try {
      const key = await uploadVideoRaw(trainingBlobRef.current, "training");
      trainingKeyRef.current = key;
      setTrainingSaved(true);   // Upload confirmado no servidor
      toast.success(t("Vídeo de treino salvo com segurança ✓", "Training video saved securely ✓", "Vídeo de entrenamiento guardado de forma segura ✓"));
      setStep("consent");
    } catch (err: any) {
      // NUNCA engolir silenciosamente — o usuário precisa saber
      const msg = err?.message ?? t("Erro ao salvar vídeo de treino", "Error saving training video", "Error al guardar el vídeo de entrenamiento");
      setTrainingUploadError(msg);
      toast.error(t(`Falha ao salvar vídeo: ${msg.slice(0, 120)}`, `Failed to save video: ${msg.slice(0, 120)}`, `Error al guardar el vídeo: ${msg.slice(0, 120)}`));
      // Não avança para consent — o vídeo precisa estar no servidor para não ser perdido
    } finally {
      setUploadingTraining(false);
    }
  }

  /** Retentar upload do treino após falha. */
  async function retryTrainingUpload() {
    if (!trainingBlobRef.current) return;
    setTrainingUploadError(null);
    setUploadingTraining(true);
    try {
      const key = await uploadVideoRaw(trainingBlobRef.current, "training");
      trainingKeyRef.current = key;
      setTrainingSaved(true);
      toast.success(t("Vídeo de treino salvo com segurança ✓", "Training video saved securely ✓", "Vídeo de entrenamiento guardado de forma segura ✓"));
      setStep("consent");
    } catch (err: any) {
      const msg = err?.message ?? t("Erro ao salvar vídeo", "Error saving video", "Error al guardar el vídeo");
      setTrainingUploadError(msg);
      toast.error(t(`Falha ao salvar vídeo: ${msg.slice(0, 120)}`, `Failed to save video: ${msg.slice(0, 120)}`, `Error al guardar el vídeo: ${msg.slice(0, 120)}`));
    } finally {
      setUploadingTraining(false);
    }
  }

  function startPolling() {
    setStep("pending");
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await customFetch<{ status: string }>("/api/workspaces/me/persona/avatar-training-status");
        setTrainingStatus(res.status);
        if (res.status === "complete") {
          clearInterval(pollRef.current!); pollRef.current = null;
          toast.success(t("🎉 Avatar digital treinado com sucesso!", "🎉 Digital avatar trained successfully!", "🎉 ¡Avatar digital entrenado correctamente!"));
          setStep("done");
          // Gerar vídeo demo automaticamente após treinamento concluído
          void generateDemo();
        } else if (res.status === "failed") {
          clearInterval(pollRef.current!); pollRef.current = null;
          setError(t("Treinamento falhou. Tente novamente.", "Training failed. Please try again.", "El entrenamiento falló. Inténtalo de nuevo.")); setStep("training");
        }
      } catch { /* keep polling */ }
    }, 8000);
  }

  async function generateDemo() {
    setDemoGenerating(true);
    setDemoError(null);
    setDemoStillProcessing(false);
    if (demoRetryRef.current) { clearTimeout(demoRetryRef.current); demoRetryRef.current = null; }
    try {
      const result = await customFetch<{ jobId?: string; error?: string; code?: string; retryAfterSeconds?: number }>(
        "/api/workspaces/me/persona/generate-avatar-demo",
        { method: "POST" },
      );

      // Avatar ainda em processamento interno no HeyGen — temporário, auto-retry
      if (result.code === "AVATAR_STILL_PROCESSING") {
        setDemoStillProcessing(true);
        setDemoGenerating(false);
        const retryMs = (result.retryAfterSeconds ?? 60) * 1000;
        demoRetryRef.current = setTimeout(() => {
          demoRetryRef.current = null;
          void generateDemo();
        }, retryMs);
        return;
      }
      // Consentimento pendente — exige que o usuário complete o fluxo
      if (result.code === "AVATAR_CONSENT_REQUIRED") {
        setDemoError(t("Consentimento do avatar pendente no HeyGen. Clique em \"Retreinar avatar\" para completar o fluxo de consentimento.", "Avatar consent is pending in HeyGen. Click \"Retrain avatar\" to complete the consent flow.", "El consentimiento del avatar está pendiente en HeyGen. Haz clic en \"Volver a entrenar el avatar\" para completar el proceso."));
        setDemoGenerating(false);
        return;
      }

      const jobId = result.jobId!;
      setDemoJobId(jobId);
      // Polling para URL do vídeo
      if (demoPollRef.current) clearInterval(demoPollRef.current);
      demoPollRef.current = setInterval(async () => {
        try {
          const poll = await customFetch<{ status: string; videoUrl?: string; error?: string }>(
            `/api/workspaces/me/persona/avatar-demo-status?jobId=${jobId}`,
          );
          if (poll.status === "ready" && poll.videoUrl) {
            clearInterval(demoPollRef.current!); demoPollRef.current = null;
            setDemoVideoUrl(poll.videoUrl);
            setDemoGenerating(false);
          } else if (poll.status === "failed") {
            clearInterval(demoPollRef.current!); demoPollRef.current = null;
            setDemoError(poll.error ?? t("Geração do demo falhou.", "Demo generation failed.", "Falló la generación de la demostración."));
            setDemoGenerating(false);
          }
        } catch { /* keep polling */ }
      }, 6000);
    } catch (err: any) {
      // customFetch throws on non-2xx — checar se o body tem code AVATAR_STILL_PROCESSING ou AVATAR_CONSENT_REQUIRED
      const code = err?.body?.code ?? err?.code;
      if (code === "AVATAR_STILL_PROCESSING") {
        setDemoStillProcessing(true);
        setDemoGenerating(false);
        demoRetryRef.current = setTimeout(() => {
          demoRetryRef.current = null;
          void generateDemo();
        }, 60_000);
        return;
      }
      if (code === "AVATAR_CONSENT_REQUIRED") {
        setDemoError(t("Consentimento do avatar pendente no HeyGen. Clique em \"Retreinar avatar\" para completar o fluxo de consentimento.", "Avatar consent is pending in HeyGen. Click \"Retrain avatar\" to complete the consent flow.", "El consentimiento del avatar está pendiente en HeyGen. Haz clic en \"Volver a entrenar el avatar\" para completar el proceso."));
        setDemoGenerating(false);
        return;
      }
      setDemoError(err?.message ?? t("Erro ao gerar demonstração", "Error generating demo", "Error al generar la demostración"));
      setDemoGenerating(false);
    }
  }

  async function submit() {
    const cBlob = consentBlobRef.current;
    if (!cBlob) { setError(t("Grave o vídeo de consentimento antes de enviar.", "Record the consent video before submitting.", "Graba el vídeo de consentimiento antes de enviarlo.")); return; }
    if (!consentSaved && !consentKeyRef.current) {
      // Auto-upload ainda não terminou — aguardar um pouco ou informar
      setError(t("Aguarde — o vídeo de consentimento ainda está sendo salvo no servidor. Tente novamente em alguns segundos.", "Please wait — the consent video is still being saved to the server. Try again in a few seconds.", "Espera: el vídeo de consentimiento aún se está guardando en el servidor. Inténtalo de nuevo en unos segundos."));
      return;
    }
    setStep("uploading");
    setError(null);
    try {
      // Consent pode já estar no GCS (auto-uploaded). Usar a chave existente.
      const consentKey = consentKeyRef.current ?? await uploadVideoRaw(cBlob, "consent");
      let trainingKey = trainingKeyRef.current;
      if (!trainingKey || trainingKey === "already-in-gcs") {
        if (trainingBlobRef.current) {
          trainingKey = await uploadVideoRaw(trainingBlobRef.current, "training");
        } else {
          // hasTrainingInGCS: use the stable GCS key directly
          const base  = (import.meta as any).env?.BASE_URL ?? "/";
          const tok2  = localStorage.getItem("accessToken") ?? localStorage.getItem("nexos_access_token") ?? "";
          const meta  = await fetch(`${base}api/workspaces/me/persona/avatar-recovery-status`.replace("//", "/"), {
            headers: tok2 ? { Authorization: `Bearer ${tok2}` } : {},
          }).then(r => r.json()) as AvatarRecoveryStatus;
          // Stable key is known by the backend — pass sentinel
          trainingKey = "__gcs_stable__";
          void meta; // used only for type check
        }
      }

      const frameBase64 = await extractFrame();

      // If training is already in GCS, we only pass consentKey and let backend resolve
      const body: Record<string, string> = { consentKey };
      if (trainingKey && trainingKey !== "__gcs_stable__") body["trainingKey"] = trainingKey;
      if (frameBase64) body["frameBase64"] = frameBase64;

      const result = await customFetch<{ avatarType?: string; success: boolean }>("/api/workspaces/me/persona/clone-avatar-video", {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (result.avatarType === "talking_photo") {
        toast.success(t("Avatar criado com sucesso!", "Avatar created successfully!", "¡Avatar creado correctamente!"));
        setStep("done"); onDone(); return;
      }
      startPolling();
    } catch (err: any) {
      setError(`Erro: ${err?.message ?? "tente novamente"}`);
      setStep("consent");
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
      {step === "training" && (
        <div className="border border-border/50 rounded-xl p-5 space-y-3 bg-background/40">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center">
              <span className="font-mono text-[11px] font-bold text-primary">1</span>
            </div>
           <span className="font-mono text-sm font-bold">{t("Vídeo de treino — 20-30 segundos", "Training video — 20–30 seconds", "Vídeo de entrenamiento: 20–30 segundos")}</span>
          </div>
          <p className="font-mono text-xs text-muted-foreground leading-relaxed">
             {t("Olhe para a câmera, fale naturalmente e mova levemente a cabeça. O HeyGen usa este vídeo para aprender seus movimentos faciais.", "Look at the camera, speak naturally, and move your head slightly. HeyGen uses this video to learn your facial movements.", "Mira a la cámara, habla con naturalidad y mueve ligeramente la cabeza. HeyGen usa este vídeo para aprender tus movimientos faciales.")}
          </p>
          <div className="border border-yellow-500/20 bg-yellow-500/5 rounded-lg px-3 py-2">
             <p className="font-mono text-[11px] text-yellow-400/80">{t("💡 Boa iluminação frontal, fundo limpo, câmera na altura dos olhos.", "💡 Use good front lighting, a clean background, and keep the camera at eye level.", "💡 Usa buena iluminación frontal, un fondo despejado y la cámara a la altura de los ojos.")}</p>
          </div>
          {!trainingUrl && recState === "idle" && (
            <Button onClick={() => startRecording("training")} className="font-mono gap-2">
               <Camera className="h-4 w-4" /> {t("Iniciar gravação de treino", "Start training recording", "Iniciar grabación de entrenamiento")}
            </Button>
          )}
          {recState === "recording" && !trainingUrl && (
            <Button variant="destructive" onClick={stopRecording} className="font-mono gap-2 animate-pulse">
               <Square className="h-4 w-4" /> {t("Parar gravação", "Stop recording", "Detener grabación")}
            </Button>
          )}
          {trainingUrl && (
            <div className="space-y-3">
              <video src={trainingUrl} controls className="w-full max-w-sm rounded-lg border border-border/40" />

              {/* Erro de upload — bloqueante, com botão de retry */}
              {trainingUploadError && (
                <div className="border border-destructive/40 bg-destructive/10 rounded-lg px-3 py-2.5 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                       <p className="font-mono text-xs text-destructive font-bold">{t("Falha ao salvar vídeo de treino", "Failed to save training video", "No se pudo guardar el vídeo de entrenamiento")}</p>
                      <p className="font-mono text-[11px] text-destructive/80 mt-0.5 break-all">{trainingUploadError.slice(0, 160)}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={retryTrainingUpload}
                    disabled={uploadingTraining}
                    className="font-mono text-xs gap-1.5 w-full"
                  >
                    {uploadingTraining
                       ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("Salvando…", "Saving…", "Guardando…")}</>
                       : <><RotateCcw className="h-3.5 w-3.5" /> {t("Tentar salvar novamente", "Try saving again", "Volver a intentar guardar")}</>}
                  </Button>
                </div>
              )}

              {!trainingUploadError && (
                <div className="flex gap-2">
                  <Button
                    onClick={advanceToConsent}
                    disabled={uploadingTraining}
                    className="font-mono gap-2"
                  >
                    {uploadingTraining
                       ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("Salvando no servidor…", "Saving to server…", "Guardando en el servidor…")}</>
                       : <><Check className="h-4 w-4" /> {t("Ficou bom — Próximo passo", "Looks good — Next step", "Está bien — Siguiente paso")}</>}
                  </Button>
                  <Button variant="outline" onClick={() => retake("training")} disabled={uploadingTraining} className="font-mono text-xs gap-1.5">
                     <RotateCcw className="h-3.5 w-3.5" /> {t("Regravar", "Re-record", "Volver a grabar")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* PASSO 2 — Vídeo de consentimento */}
      {step === "consent" && (
        <div className="border border-border/50 rounded-xl p-5 space-y-3 bg-background/40">
          {/* Indicador de status do vídeo de treino — só mostra verde quando confirmado no servidor */}
          {trainingSaved ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
              <Check className="h-3.5 w-3.5 text-green-400 shrink-0" />
              <span className="font-mono text-[11px] text-green-400">
                 {hasTrainingInGCS ? t("Vídeo de treino já salvo no servidor ✓", "Training video already saved on the server ✓", "Vídeo de entrenamiento ya guardado en el servidor ✓") : t("Vídeo de treino salvo com segurança ✓", "Training video saved securely ✓", "Vídeo de entrenamiento guardado de forma segura ✓")}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span className="font-mono text-[11px] text-amber-400">
                 {t("Vídeo de treino pendente — volte ao passo anterior para salvar", "Training video pending — go back to the previous step to save it", "Vídeo de entrenamiento pendiente: vuelve al paso anterior para guardarlo")}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center">
              <span className="font-mono text-[11px] font-bold text-primary">2</span>
            </div>
             <span className="font-mono text-sm font-bold">{t("Consentimento — exigido pelo HeyGen", "Consent — required by HeyGen", "Consentimiento: obligatorio para HeyGen")}</span>
          </div>
           <p className="font-mono text-xs text-muted-foreground leading-relaxed">{t("Grave-se dizendo em voz alta e clara:", "Record yourself saying this loudly and clearly:", "Grábate diciendo esto en voz alta y con claridad:")}</p>
          <div className="border border-primary/30 bg-primary/5 rounded-lg px-4 py-3">
            <p className="font-mono text-sm text-white leading-relaxed font-bold">
               {t('"Eu autorizo o uso da minha imagem e voz para criar um avatar digital meu."', '"I authorize the use of my image and voice to create my digital avatar."', '"Autorizo el uso de mi imagen y voz para crear mi avatar digital."')}
            </p>
          </div>
          {!consentUrl && recState === "idle" && (
            <Button onClick={() => startRecording("consent")} className="font-mono gap-2">
               <Mic className="h-4 w-4" /> {t("Iniciar gravação de consentimento", "Start consent recording", "Iniciar grabación de consentimiento")}
            </Button>
          )}
          {recState === "recording" && !consentUrl && (
            <Button variant="destructive" onClick={stopRecording} className="font-mono gap-2 animate-pulse">
               <Square className="h-4 w-4" /> {t("Parar gravação", "Stop recording", "Detener grabación")}
            </Button>
          )}
          {consentUrl && (
            <div className="space-y-3">
              <video src={consentUrl} controls className="w-full max-w-sm rounded-lg border border-border/40" />

              {/* Status do upload do consentimento no GCS */}
              {consentUploading && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                  <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />
                   <span className="font-mono text-[11px] text-primary">{t("Salvando no servidor…", "Saving to server…", "Guardando en el servidor…")}</span>
                </div>
              )}
              {consentSaved && !consentUploading && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
                  <Check className="h-3.5 w-3.5 text-green-400 shrink-0" />
                   <span className="font-mono text-[11px] text-green-400">{t("Consentimento salvo com segurança ✓", "Consent saved securely ✓", "Consentimiento guardado de forma segura ✓")}</span>
                </div>
              )}
              {consentUploadError && !consentUploading && (
                <div className="border border-destructive/40 bg-destructive/10 rounded-lg px-3 py-2.5 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="font-mono text-xs text-destructive break-all">{consentUploadError.slice(0, 160)}</p>
                  </div>
                  <Button
                    size="sm" variant="destructive"
                    onClick={() => {
                      if (!consentBlobRef.current) return;
                      setConsentUploading(true); setConsentUploadError(null);
                      uploadVideoRaw(consentBlobRef.current, "consent")
                         .then(key => { consentKeyRef.current = key; setConsentSaved(true); setConsentUploading(false); toast.success(t("Consentimento salvo ✓", "Consent saved ✓", "Consentimiento guardado ✓")); })
                        .catch(err => { setConsentUploadError(err?.message ?? t("Erro", "Error", "Error")); setConsentUploading(false); });
                    }}
                    className="font-mono text-xs gap-1.5 w-full"
                  >
                     <RotateCcw className="h-3.5 w-3.5" /> {t("Tentar salvar novamente", "Try saving again", "Volver a intentar guardar")}
                  </Button>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={submit}
                  disabled={consentUploading}
                  className="font-mono gap-2 btn-weapon-primary"
                >
                  {consentUploading
                     ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("Aguarde — salvando…", "Please wait — saving…", "Espera: guardando…")}</>
                     : <><Sparkles className="h-4 w-4" /> {t("Enviar para treinamento", "Submit for training", "Enviar para entrenamiento")}</>}
                </Button>
                <Button variant="outline" onClick={() => retake("consent")} disabled={consentUploading} className="font-mono text-xs gap-1.5">
                   <RotateCcw className="h-3.5 w-3.5" /> {t("Regravar", "Re-record", "Volver a grabar")}
                </Button>
              </div>
            </div>
          )}
          {!hasTrainingInGCS && (
            <button onClick={() => { setStep("training"); setRecState("idle"); }}
              className="font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
               <ChevronLeft className="h-3.5 w-3.5" /> {t("Voltar para o vídeo de treino", "Back to training video", "Volver al vídeo de entrenamiento")}
            </button>
          )}
        </div>
      )}

      {/* ENVIANDO */}
      {step === "uploading" && (
        <div className="flex items-center gap-3 border border-border/40 rounded-xl p-5 bg-background/40">
          <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
          <div>
             <p className="font-mono text-sm font-bold">{t("Enviando vídeos…", "Uploading videos…", "Subiendo vídeos…")}</p>
             <p className="font-mono text-xs text-muted-foreground mt-0.5">{t("Criando seu avatar. Isso pode levar alguns segundos.", "Creating your avatar. This may take a few seconds.", "Creando tu avatar. Esto puede tardar unos segundos.")}</p>
          </div>
        </div>
      )}

      {/* TREINANDO */}
      {step === "pending" && (
        <div className="flex items-start gap-3 border border-border/40 rounded-xl p-5 bg-background/40">
          <RefreshCw className="h-5 w-5 text-primary animate-spin shrink-0 mt-0.5" />
          <div>
             <p className="font-mono text-sm font-bold">{t("Treinando seu avatar digital…", "Training your digital avatar…", "Entrenando tu avatar digital…")}</p>
            <p className="font-mono text-xs text-muted-foreground mt-0.5 leading-relaxed">
               {t("O HeyGen está processando seus vídeos. Leva de 5 a 15 minutos. Você pode fechar a página — ao voltar o avatar estará pronto.", "HeyGen is processing your videos. This takes 5–15 minutes. You can close this page — your avatar will be ready when you return.", "HeyGen está procesando tus vídeos. Tarda entre 5 y 15 minutos. Puedes cerrar la página; el avatar estará listo cuando vuelvas.")}
            </p>
             <p className="font-mono text-[11px] text-primary/60 mt-2">{t("Status:", "Status:", "Estado:")} {trainingStatus ?? "pending"}</p>
          </div>
        </div>
      )}

      {/* AVATAR PRONTO + DEMONSTRAÇÃO */}
      {step === "done" && (
        <div className="space-y-4 border border-green-500/30 rounded-xl p-5 bg-green-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center shrink-0">
              <Check className="h-5 w-5 text-green-400" />
            </div>
            <div>
               <p className="font-mono text-sm font-bold text-green-400">{t("Avatar Digital Criado!", "Digital Avatar Created!", "¡Avatar digital creado!")}</p>
               <p className="font-mono text-xs text-muted-foreground">{t("Seu clone está pronto para aparecer em reels e campanhas automaticamente.", "Your clone is ready to appear in Reels and campaigns automatically.", "Tu clon ya puede aparecer automáticamente en reels y campañas.")}</p>
            </div>
          </div>

          {/* Demo video section */}
          <div className="border border-border/40 rounded-xl p-4 bg-background/60 space-y-3">
             <p className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-wide">{t("Vídeo Demonstração", "Demo Video", "Vídeo de demostración")}</p>

            {demoVideoUrl ? (
              <div className="space-y-2">
                <video
                  src={demoVideoUrl}
                  controls
                  autoPlay
                  className="w-full max-w-xs rounded-lg border border-border/40 mx-auto block"
                  style={{ maxHeight: "420px" }}
                />
                <p className="font-mono text-[11px] text-green-400 text-center">
                  ✓ {t("Seu avatar está funcionando corretamente!", "Your avatar is working correctly!", "¡Tu avatar funciona correctamente!")}
                </p>
              </div>
            ) : demoGenerating ? (
              <div className="flex items-center gap-3 py-4">
                <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
                <div>
                   <p className="font-mono text-xs font-bold">{t("Gerando vídeo demonstração…", "Generating demo video…", "Generando vídeo de demostración…")}</p>
                  <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                     {t("O HeyGen está renderizando seu avatar falando. ~2 min.", "HeyGen is rendering your avatar speaking. ~2 min.", "HeyGen está renderizando a tu avatar hablando. ~2 min.")}
                  </p>
                </div>
              </div>
            ) : demoStillProcessing ? (
              <div className="space-y-2">
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <Loader2 className="h-4 w-4 text-blue-400 shrink-0 mt-0.5 animate-spin" />
                  <div>
                     <p className="font-mono text-xs font-bold text-blue-300">{t("Avatar em processamento final", "Avatar in final processing", "Avatar en procesamiento final")}</p>
                    <p className="font-mono text-[11px] text-blue-400 mt-0.5">
                       {t("O HeyGen ainda está preparando seu avatar internamente. Tentando novamente em 60 segundos automaticamente…", "HeyGen is still preparing your avatar. Retrying automatically in 60 seconds…", "HeyGen sigue preparando tu avatar. Se volverá a intentar automáticamente en 60 segundos…")}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={generateDemo} className="font-mono text-xs gap-1.5 w-full">
                  <RotateCcw className="h-3.5 w-3.5" /> {t("Tentar agora", "Try now", "Intentar ahora")}
                </Button>
              </div>
            ) : demoError ? (
              <div className="space-y-2">
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="font-mono text-xs text-amber-400">{demoError}</p>
                </div>
                <Button size="sm" variant="outline" onClick={generateDemo} className="font-mono text-xs gap-1.5 w-full">
                  <RotateCcw className="h-3.5 w-3.5" /> {t("Tentar gerar demonstração novamente", "Try generating the demo again", "Intentar generar la demostración de nuevo")}
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={generateDemo} className="font-mono gap-1.5 w-full">
                 <Video className="h-4 w-4" /> {t("Gerar vídeo demonstração", "Generate demo video", "Generar vídeo de demostración")}
              </Button>
            )}
          </div>

          <Button onClick={onDone} variant="outline" className="font-mono gap-1.5 w-full">
             <Check className="h-4 w-4" /> {t("Fechar e ir para Configurações", "Close and go to Settings", "Cerrar e ir a Ajustes")}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function CloneDigitalPage() {
  const t = useUiText();
  const [, navigate] = useLocation();

  // ── Data state ─────────────────────────────────────────────────────────────
  const [persona, setPersona]           = useState<WorkspacePersona | null>(null);
  const [recovery, setRecovery]         = useState<AvatarRecoveryStatus | null>(null);
  const [voiceProgress, setVoiceProgress] = useState<VoiceCloneProgress | null>(null);
  const [loading, setLoading]           = useState(true);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [activeFlow, setActiveFlow]     = useState<"voice" | "avatar" | null>(null);
  const [avatarInitialStep, setAvatarInitialStep] = useState<AvatarFlowStep>("training");
  const [hasTrainingInGCS, setHasTrainingInGCS]   = useState(false);
  const [showSnapshot, setShowSnapshot] = useState(false);
  const [retrying, setRetrying]         = useState(false);

  // ── Consent URL state (banner de consentimento pendente do HeyGen) ──────────
  const [loadingConsentUrl, setLoadingConsentUrl]     = useState(false);

  const openConsentUrl = async () => {
    if (recovery?.heygenConsentUrl) {
      window.open(recovery.heygenConsentUrl, "_blank");
      return;
    }
    setLoadingConsentUrl(true);
    try {
      const data = await customFetch<{ consentUrl: string }>(
        "/api/workspaces/me/persona/avatar-consent-url",
        { method: "POST" }
      );
      window.open(data.consentUrl, "_blank");
      await loadRecovery();
    } catch {
      toast.error(t("Não foi possível gerar o link de consentimento. Tente novamente.", "Could not generate the consent link. Please try again.", "No se pudo generar el enlace de consentimiento. Inténtalo de nuevo."));
    } finally {
      setLoadingConsentUrl(false);
    }
  };

  // ── Main-page avatar demo state ────────────────────────────────────────────
  const [mainDemoGenerating, setMainDemoGenerating]   = useState(false);
  const [mainDemoError, setMainDemoError]             = useState<string | null>(null);
  const [mainDemoStillProcessing, setMainDemoStillProcessing] = useState(false);
  const [mainDemoVideoUrl, setMainDemoVideoUrl]       = useState<string | null>(null);
  const mainDemoPollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const mainDemoRetryRef = useRef<ReturnType<typeof setTimeout>  | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadPersona = useCallback(() =>
    customFetch<{ persona: WorkspacePersona }>("/api/workspaces/me/persona")
      .then(r => setPersona(r.persona)).catch(() => {}), []);

  const loadRecovery = useCallback(() =>
    customFetch<AvatarRecoveryStatus>("/api/workspaces/me/persona/avatar-recovery-status")
      .then(r => setRecovery(r)).catch(() => {}), []);

  const loadVoiceProgress = useCallback(() =>
    customFetch<VoiceCloneProgress>("/api/workspaces/me/persona/voice-clone-progress")
      .then(r => setVoiceProgress(r)).catch(() => {}), []);

  // ── On mount ───────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([loadPersona(), loadRecovery(), loadVoiceProgress()])
      .finally(() => setLoading(false));
  }, [loadPersona, loadRecovery, loadVoiceProgress]);

  // Restore avatar flow to the correct step based on GCS state
  useEffect(() => {
    if (!recovery) return;
    if (recovery.heygenAvatarId) return; // already configured

    if (recovery.hasTrainingVideo && !recovery.hasConsentVideo) {
      // Training done, consent missing → open flow at consent step
      setHasTrainingInGCS(true);
      setAvatarInitialStep("consent");
      setActiveFlow("avatar");
    } else if (recovery.hasTrainingVideo && recovery.hasConsentVideo) {
      // Both uploaded — handled by recovery banner (don't auto-open flow)
      setHasTrainingInGCS(true);
      setAvatarInitialStep("consent");
    } else {
      setHasTrainingInGCS(false);
      setAvatarInitialStep("training");
    }
  }, [recovery]);

  // Auto-resume Digital Twin polling if training is in progress
  useEffect(() => {
    if (!recovery || recovery.heygenAvatarId) return;
    if (recovery.digitalTwinId && (recovery.avatarTrainingStatus === "pending" || recovery.avatarTrainingStatus === "in_progress")) {
      if (pollRef.current) return;
      pollRef.current = setInterval(async () => {
        try {
          const res = await customFetch<{ status: string }>("/api/workspaces/me/persona/avatar-training-status");
          if (res.status === "complete") {
            clearInterval(pollRef.current!); pollRef.current = null;
            toast.success(t("Avatar digital pronto!", "Digital avatar is ready!", "¡El avatar digital está listo!"));
            await Promise.all([loadPersona(), loadRecovery()]);
          } else if (res.status === "failed") {
            clearInterval(pollRef.current!); pollRef.current = null;
            await loadRecovery();
          }
        } catch { /* keep polling */ }
      }, 8000);
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [recovery, loadPersona, loadRecovery]);

  function refreshAll() { Promise.all([loadPersona(), loadRecovery(), loadVoiceProgress()]); }

  async function retryFromGCS(frameBase64?: string) {
    setRetrying(true);
    try {
      const result = await customFetch<{ avatarType?: string; success: boolean }>("/api/workspaces/me/persona/retry-avatar-from-gcs", {
        method: "POST",
        body: JSON.stringify(frameBase64 ? { frameBase64 } : {}),
      });
      if (result.avatarType === "talking_photo") {
        toast.success(t("Avatar criado com sucesso!", "Avatar created successfully!", "¡Avatar creado correctamente!"));
        await Promise.all([loadPersona(), loadRecovery()]);
      } else {
        toast.success(t("Treinamento iniciado. Aguarde alguns minutos.", "Training started. Please wait a few minutes.", "Entrenamiento iniciado. Espera unos minutos."));
        await loadRecovery();
      }
    } catch (e: any) {
      if (e?.code === "HEYGEN_ENTERPRISE_REQUIRED" || e?.message?.includes("Enterprise")) {
        setShowSnapshot(true);
      } else if (e?.code === "GCS_VIDEOS_NOT_FOUND") {
        toast.error(t("Vídeos não encontrados. Grave novamente.", "Videos not found. Please record them again.", "No se encontraron los vídeos. Grábalos de nuevo."));
        await loadRecovery();
      } else {
        toast.error(t("Erro ao retentar. Tente novamente.", "Retry failed. Please try again.", "Error al reintentar. Inténtalo de nuevo."));
      }
    } finally {
      setRetrying(false);
    }
  }

  // ── Main-page demo generation ─────────────────────────────────────────────

  async function generateMainDemo() {
    setMainDemoGenerating(true);
    setMainDemoError(null);
    setMainDemoStillProcessing(false);
    if (mainDemoRetryRef.current) { clearTimeout(mainDemoRetryRef.current); mainDemoRetryRef.current = null; }
    try {
      const result = await customFetch<{ jobId?: string; error?: string; code?: string; retryAfterSeconds?: number }>(
        "/api/workspaces/me/persona/generate-avatar-demo",
        { method: "POST" },
      );
      if (result.code === "AVATAR_STILL_PROCESSING") {
        setMainDemoStillProcessing(true);
        setMainDemoGenerating(false);
        mainDemoRetryRef.current = setTimeout(() => {
          mainDemoRetryRef.current = null;
          void generateMainDemo();
        }, (result.retryAfterSeconds ?? 60) * 1000);
        return;
      }
      if (result.code === "AVATAR_CONSENT_REQUIRED") {
        setMainDemoError(t("Consentimento pendente. Clique em \"Retreinar avatar\" para completar o fluxo de consentimento no HeyGen.", "Consent is pending. Click \"Retrain avatar\" to complete the consent flow in HeyGen.", "El consentimiento está pendiente. Haz clic en \"Volver a entrenar el avatar\" para completar el proceso en HeyGen."));
        setMainDemoGenerating(false);
        return;
      }
      const jobId = result.jobId!;
      if (mainDemoPollRef.current) clearInterval(mainDemoPollRef.current);
      mainDemoPollRef.current = setInterval(async () => {
        try {
          const poll = await customFetch<{ status: string; videoUrl?: string; error?: string }>(
            `/api/workspaces/me/persona/avatar-demo-status?jobId=${jobId}`,
          );
          if (poll.status === "ready" && poll.videoUrl) {
            clearInterval(mainDemoPollRef.current!); mainDemoPollRef.current = null;
            setMainDemoVideoUrl(poll.videoUrl);
            setMainDemoGenerating(false);
          } else if (poll.status === "failed") {
            clearInterval(mainDemoPollRef.current!); mainDemoPollRef.current = null;
            setMainDemoError(poll.error ?? t("Geração do demo falhou.", "Demo generation failed.", "Falló la generación de la demostración."));
            setMainDemoGenerating(false);
          }
        } catch { /* keep polling */ }
      }, 6000);
    } catch (err: any) {
      const code = err?.body?.code ?? err?.code;
      if (code === "AVATAR_STILL_PROCESSING") {
        setMainDemoStillProcessing(true);
        setMainDemoGenerating(false);
        mainDemoRetryRef.current = setTimeout(() => { mainDemoRetryRef.current = null; void generateMainDemo(); }, 60_000);
        return;
      }
      if (code === "AVATAR_CONSENT_REQUIRED") {
        setMainDemoError(t("Consentimento pendente. Clique em \"Retreinar avatar\" para completar o fluxo de consentimento no HeyGen.", "Consent is pending. Click \"Retrain avatar\" to complete the consent flow in HeyGen.", "El consentimiento está pendiente. Haz clic en \"Volver a entrenar el avatar\" para completar el proceso en HeyGen."));
        setMainDemoGenerating(false);
        return;
      }
      setMainDemoError(err?.message ?? t("Erro ao gerar demonstração", "Error generating demo", "Error al generar la demostración"));
      setMainDemoGenerating(false);
    }
  }

  // Cleanup demo refs on unmount
  useEffect(() => () => {
    if (mainDemoPollRef.current) clearInterval(mainDemoPollRef.current);
    if (mainDemoRetryRef.current) clearTimeout(mainDemoRetryRef.current);
  }, []);

  // ── Derived state ──────────────────────────────────────────────────────────

  const hasVoice  = !!persona?.voiceCloneId;
  const hasAvatar = !!persona?.heygenAvatarId;
  const firstName = persona?.firstName ?? "Fundador";

  const isConsentPending  = !hasAvatar && !!recovery?.digitalTwinId &&
    recovery?.avatarTrainingStatus === "pending_consent";
  const isTrainingPending = !hasAvatar && !!recovery?.digitalTwinId &&
    (recovery?.avatarTrainingStatus === "pending" || recovery?.avatarTrainingStatus === "in_progress");
  const bothVideosInGCS  = !hasAvatar && !isTrainingPending && !isConsentPending && !!recovery?.hasTrainingVideo && !!recovery?.hasConsentVideo;
  const canRetryFromGCS  = bothVideosInGCS;

  const voiceResumeTakeCount = voiceProgress?.completedTakeIds?.length ?? 0;
  const canResumeVoice = !hasVoice && !!voiceProgress?.inProgress && voiceResumeTakeCount > 0;

  // ── Resume state for CloneStudioPanel ─────────────────────────────────────
  const voiceResumeState: CloneResumeState | undefined = canResumeVoice
    ? { recordingId: voiceProgress!.recordingId!, completedTakeIds: voiceProgress!.completedTakeIds! }
    : undefined;

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
        <button onClick={() => navigate("/settings")}
          className="font-mono text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1.5 mb-6 transition-colors">
          <ChevronLeft className="h-3.5 w-3.5" /> {t("Voltar para Configurações", "Back to Settings", "Volver a Configuración")}
        </button>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Star className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-mono text-xl font-bold tracking-tight">{t("Clone Digital", "Digital Clone", "Clon digital")}</h1>
            <p className="font-mono text-xs text-muted-foreground">{t("Crie sua presença de IA permanente", "Create your permanent AI presence", "Crea tu presencia permanente de IA")}</p>
          </div>
        </div>
        <p className="font-mono text-sm text-muted-foreground leading-relaxed mt-3">
          {t("Seu clone digital é composto por dois elementos independentes: sua", "Your digital clone consists of two independent elements: your", "Tu clon digital consta de dos elementos independientes: tu")} <strong className="text-foreground">{t("voz clonada", "cloned voice", "voz clonada")}</strong> {t("(narração automática de campanhas) e seu", "(automatic campaign narration) and your", "(narración automática de campañas) y tu")} <strong className="text-foreground">{t("avatar de vídeo", "video avatar", "avatar de vídeo")}</strong> {t("(apresentador realista em vídeos com IA).", "(a realistic presenter in AI-generated videos).", "(un presentador realista en vídeos generados por IA).")}
        </p>
      </div>

      <div className="space-y-5">
        {/* ── Card 1: Clone de Voz ──────────────────────────────────────────── */}
        <div className={`rounded-2xl border p-6 transition-all ${hasVoice ? "border-green-500/30 bg-green-500/5" : "border-border/40 bg-background/40 opacity-70"}`}>
          <div className="flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${hasVoice ? "bg-green-500/15 border border-green-500/30" : "bg-muted/40 border border-border/40"}`}>
              <Mic className={`h-5 w-5 ${hasVoice ? "text-green-400" : "text-muted-foreground/50"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-mono text-base font-bold">{t("Clone de Voz", "Voice Clone", "Clon de voz")}</h2>
                {hasVoice
                  ? <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">{t("Ativo", "Active", "Activo")}</span>
                  : <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/40">{t("Em breve", "Coming soon", "Próximamente")}</span>}
              </div>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                {hasVoice
                  ? t("Sua voz está clonada e pronta para narrar vídeos e anúncios automaticamente.", "Your voice is cloned and ready to narrate videos and ads automatically.", "Tu voz está clonada y lista para narrar vídeos y anuncios automáticamente.")
                  : t("Clone de voz estará disponível em breve.", "Voice cloning will be available soon.", "El clon de voz estará disponible próximamente.")}
              </p>
              {hasVoice && persona?.voiceCloneId && (
                <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">ID: {persona.voiceCloneId.slice(0, 18)}…</p>
              )}
            </div>
          </div>

          {hasVoice && (
            <div className="mt-5 flex items-center gap-3 flex-wrap">
              <Button variant="outline" onClick={() => setActiveFlow("voice")} className="font-mono text-xs gap-2">
                <RefreshCw className="h-3.5 w-3.5" /> {t("Regravar clone de voz", "Re-record voice clone", "Volver a grabar el clon de voz")}
              </Button>
            </div>
          )}
        </div>

        {/* ── Card 2: Avatar Digital ────────────────────────────────────────── */}
        <div className={`rounded-2xl border p-6 transition-all ${
          hasAvatar ? "border-green-500/30 bg-green-500/5"
          : isConsentPending ? "border-orange-500/30 bg-orange-500/5"
          : isTrainingPending ? "border-primary/30 bg-primary/5"
          : "border-border/50 bg-background/40"
        }`}>
          <div className="flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${hasAvatar ? "bg-green-500/15 border border-green-500/30" : isConsentPending ? "bg-orange-500/15 border border-orange-500/30" : "bg-primary/10 border border-primary/30"}`}>
              <Video className={`h-5 w-5 ${hasAvatar ? "text-green-400" : isConsentPending ? "text-orange-400" : "text-primary"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h2 className="font-mono text-base font-bold">{t("Avatar Digital", "Digital Avatar", "Avatar digital")}</h2>
                {hasAvatar && <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">{t("Ativo", "Active", "Activo")}</span>}
                {isConsentPending && (
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20 flex items-center gap-1">
                    ⚠ {t("Consentimento pendente", "Consent pending", "Consentimiento pendiente")}
                  </span>
                )}
                {isTrainingPending && (
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 flex items-center gap-1">
                    <RefreshCw className="h-2.5 w-2.5 animate-spin" /> {t("Treinando…", "Training…", "Entrenando…")}
                  </span>
                )}
                {!hasAvatar && !isTrainingPending && !isConsentPending && recovery?.hasTrainingVideo && !recovery.hasConsentVideo && (
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">{t("1/2 vídeos", "1/2 videos", "1/2 vídeos")}</span>
                )}
                {!hasAvatar && !isTrainingPending && !isConsentPending && !recovery?.hasTrainingVideo && (
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">{t("Não configurado", "Not configured", "Sin configurar")}</span>
                )}
              </div>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                {hasAvatar
                  ? t("Seu avatar de vídeo está treinado e pronto como apresentador em vídeos gerados por IA.", "Your video avatar is trained and ready to present in AI-generated videos.", "Tu avatar de vídeo está entrenado y listo para aparecer en vídeos generados por IA.")
                  : isConsentPending
                    ? t("Seus vídeos foram enviados ao HeyGen, mas é necessário completar o consentimento no site deles antes que o treinamento comece.", "Your videos were sent to HeyGen, but you need to complete consent on their website before training begins.", "Tus vídeos se enviaron a HeyGen, pero debes completar el consentimiento en su sitio web antes de que comience el entrenamiento.")
                    : isTrainingPending
                      ? t("Vídeos enviados. O HeyGen está treinando seu avatar — pode fechar e voltar depois.", "Videos sent. HeyGen is training your avatar — you can close this page and come back later.", "Vídeos enviados. HeyGen está entrenando tu avatar; puedes cerrar la página y volver más tarde.")
                      : recovery?.hasTrainingVideo && !recovery.hasConsentVideo
                        ? t("Vídeo de treino salvo. Abra o fluxo para gravar o consentimento e finalizar.", "Training video saved. Open the flow to record consent and finish.", "Vídeo de entrenamiento guardado. Abre el flujo para grabar el consentimiento y terminar.")
                        : t("Grave 2 vídeos curtos — cada um salvo automaticamente ao avançar.", "Record 2 short videos — each is saved automatically as you continue.", "Graba 2 vídeos cortos; cada uno se guarda automáticamente al continuar.")}
              </p>

              {/* ── Banner de consentimento pendente ──────────────────────── */}
              {isConsentPending && (
                <div className="mt-4 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
                  <p className="font-mono text-xs text-orange-300 leading-relaxed mb-1">
                    <strong>{t("O que aconteceu:", "What happened:", "Qué ocurrió:")}</strong> {t("seu vídeo foi gravado e salvo, mas o HeyGen rejeita consentimento por vídeo em contas não-Enterprise. É preciso completar o consentimento pelo site deles (webcam, ~30 segundos).", "your video was recorded and saved, but HeyGen does not accept video consent for non-Enterprise accounts. Complete consent on their website using your webcam (about 30 seconds).", "el vídeo se grabó y guardó, pero HeyGen no acepta el consentimiento en vídeo en cuentas que no son Enterprise. Debes completar el consentimiento en su sitio web con la cámara (unos 30 segundos).")}
                  </p>
                  <p className="font-mono text-[11px] text-orange-400/70 mb-3">
                    {t("Após completar no site do HeyGen, o treinamento do avatar inicia automaticamente.", "After completing this on HeyGen's site, avatar training starts automatically.", "Al completar este paso en el sitio de HeyGen, el entrenamiento del avatar comenzará automáticamente.")}
                  </p>
                  <Button
                    onClick={openConsentUrl}
                    disabled={loadingConsentUrl}
                    className="font-mono text-xs gap-2 bg-orange-500 hover:bg-orange-600 text-white border-0"
                  >
                    {loadingConsentUrl
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("Gerando link…", "Generating link…", "Generando enlace…")}</>
                      : <><ArrowRight className="h-3.5 w-3.5" /> {t("Completar consentimento no HeyGen", "Complete consent on HeyGen", "Completar consentimiento en HeyGen")}</>}
                  </Button>
                </div>
              )}
              {hasAvatar && persona?.heygenAvatarId && (
                <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">
                  ID: {persona.heygenAvatarId.slice(0, 18)}… · {persona.avatarType ?? "avatar"}
                </p>
              )}
              {/* ── Demo video section (only when avatar is active) ── */}
              {hasAvatar && (
                <div className="mt-3 space-y-2">
                  {mainDemoVideoUrl ? (
                    <div className="space-y-2">
                      <p className="font-mono text-[10px] text-green-400 font-bold flex items-center gap-1">
                         <Check className="h-3 w-3" /> {t("Vídeo demonstração gerado", "Demo video generated", "Vídeo de demostración generado")}
                      </p>
                      <video
                        src={mainDemoVideoUrl}
                        autoPlay
                        controls
                        playsInline
                        className="w-full max-w-[240px] rounded-xl border border-green-500/20 shadow-lg"
                      />
                    </div>
                  ) : mainDemoGenerating ? (
                    <div className="flex items-center gap-2 py-1">
                      <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />
                       <p className="font-mono text-[11px] text-muted-foreground">{t("Gerando vídeo demonstração… ~2 min", "Generating demo video… ~2 min", "Generando vídeo de demostración… ~2 min")}</p>
                    </div>
                  ) : mainDemoStillProcessing ? (
                    <div className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <Loader2 className="h-3 w-3 text-blue-400 shrink-0 mt-0.5 animate-spin" />
                      <p className="font-mono text-[10px] text-blue-400 leading-relaxed">
                         {t("Avatar em processamento final no HeyGen. Tentando novamente automaticamente em 60s…", "Avatar is in final processing on HeyGen. Retrying automatically in 60s…", "El avatar está en el procesamiento final de HeyGen. Se volverá a intentar automáticamente en 60 s…")}
                      </p>
                    </div>
                  ) : mainDemoError ? (
                    <div className="space-y-1.5">
                      <p className="font-mono text-[10px] text-amber-400">{mainDemoError}</p>
                      <Button size="sm" variant="outline" onClick={generateMainDemo} className="font-mono text-[10px] gap-1 h-6 px-2">
                         <RotateCcw className="h-2.5 w-2.5" /> {t("Tentar novamente", "Try again", "Reintentar")}
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={generateMainDemo} className="font-mono text-[10px] gap-1.5 h-7">
                       <Video className="h-3 w-3" /> {t("Ver demonstração do avatar", "View avatar demo", "Ver demostración del avatar")}
                    </Button>
                  )}
                </div>
              )}
              {isTrainingPending && recovery?.digitalTwinId && (
                <p className="font-mono text-[10px] text-primary/60 mt-1">
                   Digital Twin: {recovery.digitalTwinId.slice(0, 16)}… · {t("verificando a cada 8s", "checking every 8s", "comprobando cada 8 s")}
                </p>
              )}
            </div>
          </div>

          {/* Recovery banner — both videos in GCS but avatar not yet created */}
          {canRetryFromGCS && !showSnapshot && activeFlow !== "avatar" && (
            <div className="mt-4 border border-yellow-500/20 bg-yellow-500/5 rounded-xl px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-yellow-400 shrink-0" />
                 <p className="font-mono text-xs font-bold text-yellow-300">{t("Seus dois vídeos estão salvos", "Both of your videos are saved", "Tus dos vídeos están guardados")}</p>
              </div>
              <p className="font-mono text-[11px] text-yellow-400/80 leading-relaxed">
                 {t("Você não precisa regravar. Tire apenas uma foto para criar o avatar.", "You don't need to record again. Just take a photo to create your avatar.", "No tienes que volver a grabar. Solo toma una foto para crear el avatar.")}
              </p>
              <div className="flex gap-2 pt-1">
                <Button onClick={() => retryFromGCS()} disabled={retrying} size="sm" className="font-mono text-xs gap-1.5 btn-weapon-primary">
                  {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                   {t("Retentar criação", "Retry creation", "Reintentar creación")}
                </Button>
                <Button onClick={() => setShowSnapshot(true)} disabled={retrying} size="sm" variant="outline" className="font-mono text-xs gap-1.5">
                   <Camera className="h-3.5 w-3.5" /> {t("Tirar foto + retentar", "Take photo + retry", "Tomar foto + reintentar")}
                </Button>
              </div>
            </div>
          )}

          {showSnapshot && (
            <div className="mt-4">
              <SnapshotCamera
                onCapture={async (b64) => { setShowSnapshot(false); await retryFromGCS(b64); }}
                onCancel={() => setShowSnapshot(false)}
              />
            </div>
          )}

          {/* Main action area */}
          {!isTrainingPending && activeFlow !== "avatar" && !showSnapshot && !canRetryFromGCS && (
            <div className="mt-5 flex items-center gap-3">
              <Button
                onClick={() => setActiveFlow("avatar")}
                variant={hasAvatar ? "outline" : "default"}
                className="font-mono gap-2"
              >
                <Camera className="h-4 w-4" />
                 {hasAvatar ? t("Retreinar avatar", "Retrain avatar", "Volver a entrenar el avatar") : recovery?.hasTrainingVideo ? t("Continuar — gravar consentimento", "Continue — record consent", "Continuar — grabar consentimiento") : t("Criar avatar digital agora", "Create digital avatar now", "Crear avatar digital ahora")}
                {!hasAvatar && <ArrowRight className="h-4 w-4" />}
              </Button>
              <span className="font-mono text-[11px] text-muted-foreground">
                 {hasAvatar ? t("Substitui o avatar atual", "Replaces the current avatar", "Reemplaza el avatar actual") : t("≈ 10 min · câmera + microfone", "≈ 10 min · camera + microphone", "≈ 10 min · cámara + micrófono")}
              </span>
            </div>
          )}

          {/* Inline avatar flow */}
          {activeFlow === "avatar" && !isTrainingPending && (
            <div className="mt-5">
              <AvatarCloneFlow
                initialStep={avatarInitialStep}
                hasTrainingInGCS={hasTrainingInGCS && activeFlow === "avatar"}
                onDone={() => { setActiveFlow(null); refreshAll(); }}
              />
            </div>
          )}
        </div>

        {/* ── Info box ──────────────────────────────────────────────────────── */}
        <div className="border border-border/30 rounded-xl px-4 py-4 bg-background/20">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
                <strong className="text-foreground">{t("Clone de Voz", "Voice Clone", "Clon de voz")}</strong> {t("é usado pela IA para narrar reels, VSLs e anúncios automaticamente — sem você gravar cada vídeo.", "is used by AI to narrate Reels, VSLs, and ads automatically — without you recording every video.", "se usa para que la IA narre reels, VSL y anuncios automáticamente, sin que tengas que grabar cada vídeo.")}
              </p>
              <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
                <strong className="text-foreground">{t("Avatar Digital", "Digital Avatar", "Avatar digital")}</strong> {t("é um modelo realista do seu rosto que aparece falando em vídeos gerados pela NexOS via HeyGen.", "is a realistic model of your face that appears speaking in NexOS videos generated via HeyGen.", "es un modelo realista de tu rostro que aparece hablando en vídeos generados por NexOS mediante HeyGen.")}
              </p>
            </div>
          </div>
        </div>

        {/* ── Guias de referência ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <a href="/video-production/director-guide" className="border border-border/40 rounded-xl p-4 hover:border-primary/40 transition-colors group">
             <div className="font-mono text-xs font-bold group-hover:text-primary transition-colors mb-1">{t("Guia do Diretor", "Director's Guide", "Guía del director")}</div>
             <div className="font-mono text-[11px] text-muted-foreground">{t("Vestuário, cenário, iluminação e postura", "Clothing, setting, lighting, and posture", "Vestuario, escenario, iluminación y postura")}</div>
          </a>
          <a href="/video-production/filming-guide" className="border border-border/40 rounded-xl p-4 hover:border-primary/40 transition-colors group">
             <div className="font-mono text-xs font-bold group-hover:text-primary transition-colors mb-1">{t("Guia Técnico", "Technical Guide", "Guía técnica")}</div>
             <div className="font-mono text-[11px] text-muted-foreground">{t("Setup de câmera, áudio e enquadramento", "Camera, audio, and framing setup", "Configuración de cámara, audio y encuadre")}</div>
          </a>
        </div>
      </div>

      {/* ── CloneStudioPanel overlay ───────────────────────────────────────── */}
      {activeFlow === "voice" && (
        <CloneStudioPanel
          firstName={firstName}
          resumeState={voiceResumeState}
          onComplete={(sessionId) => {
            toast.success(t("Clone de voz criado com sucesso!", "Voice clone created successfully!", "¡Clon de voz creado correctamente!"));
            setActiveFlow(null);
            loadPersona();
            loadVoiceProgress();
            console.info("voice clone session:", sessionId);
          }}
          onSkip={() => setActiveFlow(null)}
        />
      )}
    </div>
  );
}
