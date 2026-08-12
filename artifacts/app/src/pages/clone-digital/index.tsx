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
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then(s => { streamRef.current = s; if (videoRef.current) { videoRef.current.srcObject = s; } setReady(true); })
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
        Olhe para a câmera e clique em <strong className="text-foreground">Tirar foto</strong>. Será usada para criar seu avatar — seus vídeos já estão salvos no servidor.
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
        <Button variant="outline" onClick={onCancel} className="font-mono text-xs">Cancelar</Button>
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
  const [step, setStep]         = useState<"training" | "consent" | "uploading" | "pending" | "done">(
    hasTrainingInGCS ? "consent" : (initialStep === "consent" ? "consent" : "training"),
  );
  const [recState, setRecState] = useState<VideoRecState>("idle");
  const [trainingUrl, setTrainingUrl] = useState<string | null>(null);
  const [consentUrl, setConsentUrl]   = useState<string | null>(null);
  // Rastreia se o upload do vídeo de treino foi confirmado no servidor
  const [trainingSaved, setTrainingSaved] = useState(hasTrainingInGCS);
  const [trainingUploadError, setTrainingUploadError] = useState<string | null>(null);
  const [videoMime, setVideoMime]     = useState("video/webm");
  const [error, setError]             = useState<string | null>(null);
  const [trainingStatus, setTrainingStatus] = useState<string | null>(null);
  const [uploadingTraining, setUploadingTraining] = useState(false);

  const recorderRef     = useRef<MediaRecorder | null>(null);
  const chunksRef       = useRef<Blob[]>([]);
  const streamRef       = useRef<MediaStream | null>(null);
  const pollRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const trainingBlobRef = useRef<Blob | null>(null);
  const consentBlobRef  = useRef<Blob | null>(null);
  // GCS key for training video (set after auto-upload on advance)
  const trainingKeyRef  = useRef<string | null>(hasTrainingInGCS ? "already-in-gcs" : null);

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
        if (kind === "training") { trainingBlobRef.current = blob; setTrainingUrl(URL.createObjectURL(blob)); }
        else                     { consentBlobRef.current  = blob; setConsentUrl(URL.createObjectURL(blob));  }
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
    if (kind === "training") { setTrainingUrl(null); trainingBlobRef.current = null; trainingKeyRef.current = null; }
    else                     { setConsentUrl(null);  consentBlobRef.current  = null; }
    setRecState("idle");
  }

  async function uploadVideoRaw(blob: Blob, kind: "training" | "consent"): Promise<string> {
    const base  = (import.meta as any).env?.BASE_URL ?? "/";
    const url   = `${base}api/workspaces/me/persona/upload-video/${kind}`.replace("//", "/");
    const token = localStorage.getItem("accessToken") ?? localStorage.getItem("nexos_access_token") ?? "";
    const res   = await fetch(url, {
      method:  "POST",
      headers: {
        "Content-Type":  blob.type || videoMime,
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      },
      body: blob,
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
      toast.success("Vídeo de treino salvo com segurança ✓");
      setStep("consent");
    } catch (err: any) {
      // NUNCA engolir silenciosamente — o usuário precisa saber
      const msg = err?.message ?? "Erro ao salvar vídeo de treino";
      setTrainingUploadError(msg);
      toast.error(`Falha ao salvar vídeo: ${msg.slice(0, 120)}`);
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
      toast.success("Vídeo de treino salvo com segurança ✓");
      setStep("consent");
    } catch (err: any) {
      const msg = err?.message ?? "Erro ao salvar vídeo";
      setTrainingUploadError(msg);
      toast.error(`Falha ao salvar vídeo: ${msg.slice(0, 120)}`);
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
          setStep("done"); toast.success("Avatar digital treinado com sucesso!"); onDone();
        } else if (res.status === "failed") {
          clearInterval(pollRef.current!); pollRef.current = null;
          setError("Treinamento falhou. Tente novamente."); setStep("training");
        }
      } catch { /* keep polling */ }
    }, 8000);
  }

  async function submit() {
    const cBlob = consentBlobRef.current;
    if (!cBlob) { setError("Grave o vídeo de consentimento antes de enviar."); return; }
    setStep("uploading");
    setError(null);
    try {
      // Upload consent video (training may already be uploaded or in memory)
      const consentKey = await uploadVideoRaw(cBlob, "consent");
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
        toast.success("Avatar criado com sucesso!");
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
            <span className="font-mono text-sm font-bold">Vídeo de treino — 20-30 segundos</span>
          </div>
          <p className="font-mono text-xs text-muted-foreground leading-relaxed">
            Olhe para a câmera, fale naturalmente e mova levemente a cabeça. O HeyGen usa este vídeo para aprender seus movimentos faciais.
          </p>
          <div className="border border-yellow-500/20 bg-yellow-500/5 rounded-lg px-3 py-2">
            <p className="font-mono text-[11px] text-yellow-400/80">💡 Boa iluminação frontal, fundo limpo, câmera na altura dos olhos.</p>
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

              {/* Erro de upload — bloqueante, com botão de retry */}
              {trainingUploadError && (
                <div className="border border-destructive/40 bg-destructive/10 rounded-lg px-3 py-2.5 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs text-destructive font-bold">Falha ao salvar vídeo de treino</p>
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
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…</>
                      : <><RotateCcw className="h-3.5 w-3.5" /> Tentar salvar novamente</>}
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
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando no servidor…</>
                      : <><Check className="h-4 w-4" /> Ficou bom — Próximo passo</>}
                  </Button>
                  <Button variant="outline" onClick={() => retake("training")} disabled={uploadingTraining} className="font-mono text-xs gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5" /> Regravar
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
                {hasTrainingInGCS ? "Vídeo de treino já salvo no servidor ✓" : "Vídeo de treino salvo com segurança ✓"}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span className="font-mono text-[11px] text-amber-400">
                Vídeo de treino pendente — volte ao passo anterior para salvar
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center">
              <span className="font-mono text-[11px] font-bold text-primary">2</span>
            </div>
            <span className="font-mono text-sm font-bold">Consentimento — exigido pelo HeyGen</span>
          </div>
          <p className="font-mono text-xs text-muted-foreground leading-relaxed">Grave-se dizendo em voz alta e clara:</p>
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
                  <RotateCcw className="h-3.5 w-3.5" /> Regravar
                </Button>
              </div>
            </div>
          )}
          {!hasTrainingInGCS && (
            <button onClick={() => { setStep("training"); setRecState("idle"); }}
              className="font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <ChevronLeft className="h-3.5 w-3.5" /> Voltar para o vídeo de treino
            </button>
          )}
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
              O HeyGen está processando seus vídeos. Leva alguns minutos. Você pode fechar a página — ao voltar o avatar estará pronto.
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
            toast.success("Avatar digital pronto!");
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
        toast.success("Avatar criado com sucesso!");
        await Promise.all([loadPersona(), loadRecovery()]);
      } else {
        toast.success("Treinamento iniciado. Aguarde alguns minutos.");
        await loadRecovery();
      }
    } catch (e: any) {
      if (e?.code === "HEYGEN_ENTERPRISE_REQUIRED" || e?.message?.includes("Enterprise")) {
        setShowSnapshot(true);
      } else if (e?.code === "GCS_VIDEOS_NOT_FOUND") {
        toast.error("Vídeos não encontrados. Grave novamente.");
        await loadRecovery();
      } else {
        toast.error("Erro ao retentar. Tente novamente.");
      }
    } finally {
      setRetrying(false);
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const hasVoice  = !!persona?.voiceCloneId;
  const hasAvatar = !!persona?.heygenAvatarId;
  const firstName = persona?.firstName ?? "Fundador";

  const isTrainingPending = !hasAvatar && !!recovery?.digitalTwinId &&
    (recovery?.avatarTrainingStatus === "pending" || recovery?.avatarTrainingStatus === "in_progress");
  const bothVideosInGCS  = !hasAvatar && !isTrainingPending && !!recovery?.hasTrainingVideo && !!recovery?.hasConsentVideo;
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
                  : canResumeVoice
                    ? <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">{voiceResumeTakeCount}/5 takes</span>
                    : <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">Não configurado</span>}
              </div>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                {hasVoice
                  ? "Sua voz está clonada e pronta para narrar vídeos e anúncios automaticamente."
                  : canResumeVoice
                    ? `Você já gravou ${voiceResumeTakeCount} de 5 takes. Continue de onde parou — seus áudios estão salvos no servidor.`
                    : "Grave 5 takes da mesma frase com emoções diferentes. Cada take é salvo automaticamente — se sair e voltar, retoma de onde parou."}
              </p>
              {hasVoice && persona?.voiceCloneId && (
                <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">ID: {persona.voiceCloneId.slice(0, 18)}…</p>
              )}
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3 flex-wrap">
            {hasVoice ? (
              <Button variant="outline" onClick={() => setActiveFlow("voice")} className="font-mono text-xs gap-2">
                <RefreshCw className="h-3.5 w-3.5" /> Regravar clone de voz
              </Button>
            ) : canResumeVoice ? (
              <>
                <Button onClick={() => setActiveFlow("voice")} className="font-mono gap-2 btn-weapon-primary">
                  <Mic className="h-4 w-4" /> Retomar gravação ({voiceResumeTakeCount}/5)
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="ghost" onClick={() => setActiveFlow("voice")} className="font-mono text-xs text-muted-foreground">
                  Começar do zero
                </Button>
              </>
            ) : (
              <Button onClick={() => setActiveFlow("voice")} className="font-mono gap-2">
                <Mic className="h-4 w-4" /> Criar clone de voz agora
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {!hasVoice && !canResumeVoice && (
              <span className="font-mono text-[11px] text-muted-foreground">≈ 5 minutos · câmera + microfone</span>
            )}
          </div>
        </div>

        {/* ── Card 2: Avatar Digital ────────────────────────────────────────── */}
        <div className={`rounded-2xl border p-6 transition-all ${hasAvatar ? "border-green-500/30 bg-green-500/5" : isTrainingPending ? "border-primary/30 bg-primary/5" : "border-border/50 bg-background/40"}`}>
          <div className="flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${hasAvatar ? "bg-green-500/15 border border-green-500/30" : "bg-primary/10 border border-primary/30"}`}>
              <Video className={`h-5 w-5 ${hasAvatar ? "text-green-400" : "text-primary"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h2 className="font-mono text-base font-bold">Avatar Digital</h2>
                {hasAvatar && <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">Ativo</span>}
                {isTrainingPending && (
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 flex items-center gap-1">
                    <RefreshCw className="h-2.5 w-2.5 animate-spin" /> Treinando…
                  </span>
                )}
                {!hasAvatar && !isTrainingPending && recovery?.hasTrainingVideo && !recovery.hasConsentVideo && (
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">1/2 vídeos</span>
                )}
                {!hasAvatar && !isTrainingPending && !recovery?.hasTrainingVideo && (
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">Não configurado</span>
                )}
              </div>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                {hasAvatar
                  ? "Seu avatar de vídeo está treinado e pronto como apresentador em vídeos gerados por IA."
                  : isTrainingPending
                    ? "Vídeos enviados. O HeyGen está treinando seu avatar — pode fechar e voltar depois."
                    : recovery?.hasTrainingVideo && !recovery.hasConsentVideo
                      ? "Vídeo de treino salvo. Abra o fluxo para gravar o consentimento e finalizar."
                      : "Grave 2 vídeos curtos — cada um salvo automaticamente ao avançar."}
              </p>
              {hasAvatar && persona?.heygenAvatarId && (
                <p className="font-mono text-[10px] text-muted-foreground/60 mt-1">
                  ID: {persona.heygenAvatarId.slice(0, 18)}… · {persona.avatarType ?? "avatar"}
                </p>
              )}
              {isTrainingPending && recovery?.digitalTwinId && (
                <p className="font-mono text-[10px] text-primary/60 mt-1">
                  Digital Twin: {recovery.digitalTwinId.slice(0, 16)}… · verificando a cada 8s
                </p>
              )}
            </div>
          </div>

          {/* Recovery banner — both videos in GCS but avatar not yet created */}
          {canRetryFromGCS && !showSnapshot && activeFlow !== "avatar" && (
            <div className="mt-4 border border-yellow-500/20 bg-yellow-500/5 rounded-xl px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-yellow-400 shrink-0" />
                <p className="font-mono text-xs font-bold text-yellow-300">Seus dois vídeos estão salvos</p>
              </div>
              <p className="font-mono text-[11px] text-yellow-400/80 leading-relaxed">
                Você não precisa regravar. Tire apenas uma foto para criar o avatar.
              </p>
              <div className="flex gap-2 pt-1">
                <Button onClick={() => retryFromGCS()} disabled={retrying} size="sm" className="font-mono text-xs gap-1.5 btn-weapon-primary">
                  {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Retentar criação
                </Button>
                <Button onClick={() => setShowSnapshot(true)} disabled={retrying} size="sm" variant="outline" className="font-mono text-xs gap-1.5">
                  <Camera className="h-3.5 w-3.5" /> Tirar foto + retentar
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
                {hasAvatar ? "Retreinar avatar" : recovery?.hasTrainingVideo ? "Continuar — gravar consentimento" : "Criar avatar digital agora"}
                {!hasAvatar && <ArrowRight className="h-4 w-4" />}
              </Button>
              <span className="font-mono text-[11px] text-muted-foreground">
                {hasAvatar ? "Substitui o avatar atual" : "≈ 10 min · câmera + microfone"}
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
            <div className="font-mono text-[11px] text-muted-foreground">Vestuário, cenário, iluminação e postura</div>
          </a>
          <a href="/video-production/filming-guide" className="border border-border/40 rounded-xl p-4 hover:border-primary/40 transition-colors group">
            <div className="font-mono text-xs font-bold group-hover:text-primary transition-colors mb-1">Guia Técnico</div>
            <div className="font-mono text-[11px] text-muted-foreground">Setup de câmera, áudio e enquadramento</div>
          </a>
        </div>
      </div>

      {/* ── CloneStudioPanel overlay ───────────────────────────────────────── */}
      {activeFlow === "voice" && (
        <CloneStudioPanel
          firstName={firstName}
          resumeState={voiceResumeState}
          onComplete={(sessionId) => {
            toast.success("Clone de voz criado com sucesso!");
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
