import { useCallback, useEffect, useRef, useState } from "react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { useUiText } from "@/lib/i18n";
import { toast } from "sonner";
import { Camera, Loader2, Play, Square, Trash2, Video } from "lucide-react";

type AvatarSample = {
  sampleId: string;
  name: string;
  durationSeconds: number;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

const CONSENT_VERSION = "avatar-sample-storage-v2";
const CHUNK_BYTES = 8 * 1024 * 1024;

export function AvatarSampleLibrary({ onUseSample, refreshKey }: {
  onUseSample: (sampleId: string, videoUrl: string) => void;
  refreshKey?: number;
}) {
  const t = useUiText();
  const [samples, setSamples] = useState<AvatarSample[]>([]);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const urlMapRef = useRef<Record<string, string>>({});
  const previewRef = useRef<string | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSamples = useCallback(async () => {
    const result = await customFetch<{ samples: AvatarSample[] }>("/api/workspaces/me/persona/avatar-samples");
    setSamples(result.samples);
  }, []);

  useEffect(() => {
    void loadSamples().catch(() => toast.error(t("Não foi possível carregar as gravações de avatar.", "Couldn't load avatar recordings.", "No se pudieron cargar las grabaciones del avatar.")));
  }, [loadSamples, refreshKey, t]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      Object.values(urlMapRef.current).forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const video = liveVideoRef.current;
    const stream = recording ? streamRef.current : null;
    if (video && stream) {
      video.srcObject = stream;
      void video.play().catch(() => {});
    } else if (video) {
      video.srcObject = null;
    }
  }, [recording]);

  const clearPreview = () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreviewUrl(null);
    setBlob(null);
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const startRecording = async () => {
    clearPreview();
    setSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
      streamRef.current = stream;
      const mimeType = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const videoBlob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
        const url = URL.createObjectURL(videoBlob);
        previewRef.current = url;
        setBlob(videoBlob);
        setPreviewUrl(url);
        setRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
      };
      recorder.start(250);
      recorderRef.current = recorder;
      setRecording(true);
      timerRef.current = setInterval(() => setSeconds((current) => {
        if (current >= 119) stopRecording();
        return current + 1;
      }), 1000);
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      toast.error(t("Câmera ou microfone indisponível. Verifique as permissões do navegador.", "Camera or microphone unavailable. Check your browser permissions.", "Cámara o micrófono no disponible. Comprueba los permisos del navegador."));
    }
  };

  const saveSample = async () => {
    if (!blob || !consent) return;
    setSaving(true);
    try {
      let savedSample: AvatarSample | undefined;
      const query = new URLSearchParams({ consent: "true", consentVersion: CONSENT_VERSION, durationSeconds: String(seconds) });
      const mimeType = blob.type.split(";")[0] || "video/webm";
      if (blob.size <= CHUNK_BYTES) {
        const result = await customFetch<{ sample: AvatarSample }>(`/api/workspaces/me/persona/avatar-samples?${query}`, {
          method: "POST",
          headers: { "Content-Type": mimeType },
          body: blob,
        });
        savedSample = result.sample;
      } else {
        const uploadId = crypto.randomUUID();
        const totalChunks = Math.ceil(blob.size / CHUNK_BYTES);
        for (let index = 0; index < totalChunks; index += 1) {
          const result = await customFetch<{ complete: boolean; sample?: AvatarSample }>(`/api/workspaces/me/persona/avatar-samples/chunk?${query}`, {
            method: "POST",
            headers: {
              "Content-Type": mimeType,
              "X-Upload-Id": uploadId,
              "X-Chunk-Index": String(index),
              "X-Total-Chunks": String(totalChunks),
            },
            body: blob.slice(index * CHUNK_BYTES, Math.min(blob.size, (index + 1) * CHUNK_BYTES)),
          });
          if (result.sample) savedSample = result.sample;
        }
      }
      if (!savedSample) throw new Error(t("O envio terminou sem confirmar a gravação.", "The upload finished without confirming the recording.", "La carga terminó sin confirmar la grabación."));
      Object.values(urlMapRef.current).forEach((url) => URL.revokeObjectURL(url));
      urlMapRef.current = {};
      setSamples([savedSample]);
      setConsent(false);
      clearPreview();
      toast.success(t("Gravação salva no workspace privado.", "Recording saved to your private workspace.", "Grabación guardada en el espacio privado."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Não foi possível guardar a gravação.", "Couldn't save the recording.", "No se pudo guardar la grabación."));
    } finally {
      setSaving(false);
    }
  };

  const getVideoUrl = async (sampleId: string) => {
    if (urlMapRef.current[sampleId]) return urlMapRef.current[sampleId]!;
    const video = await customFetch<Blob>(`/api/workspaces/me/persona/avatar-samples/${sampleId}/video`, { responseType: "blob" });
    const url = URL.createObjectURL(video);
    urlMapRef.current[sampleId] = url;
    return url;
  };

  const playSample = async (sample: AvatarSample) => {
    try {
      const url = await getVideoUrl(sample.sampleId);
      setPlayingId(sample.sampleId);
      const player = document.createElement("video");
      player.src = url;
      player.controls = true;
      player.playsInline = true;
      player.className = "w-full max-w-sm rounded-lg border border-border/40";
      const container = document.getElementById(`avatar-sample-preview-${sample.sampleId}`);
      if (container) { container.replaceChildren(player); }
      player.onended = () => setPlayingId(null);
      await player.play();
    } catch {
      setPlayingId(null);
      toast.error(t("Não foi possível reproduzir esta gravação.", "Couldn't play this recording.", "No se pudo reproducir esta grabación."));
    }
  };

  const useSample = async (sample: AvatarSample) => {
    setBusyId(sample.sampleId);
    try {
      const url = await getVideoUrl(sample.sampleId);
      onUseSample(sample.sampleId, url);
    } catch {
      toast.error(t("Não foi possível carregar a gravação selecionada.", "Couldn't load the selected recording.", "No se pudo cargar la grabación seleccionada."));
    } finally {
      setBusyId(null);
    }
  };

  const deleteSample = async (sample: AvatarSample) => {
    setBusyId(sample.sampleId);
    try {
      await customFetch(`/api/workspaces/me/persona/avatar-samples/${sample.sampleId}`, { method: "DELETE" });
      setSamples((current) => current.filter((item) => item.sampleId !== sample.sampleId));
      if (urlMapRef.current[sample.sampleId]) URL.revokeObjectURL(urlMapRef.current[sample.sampleId]!);
      delete urlMapRef.current[sample.sampleId];
      toast.success(t("Gravação removida.", "Recording deleted.", "Grabación eliminada."));
    } catch {
      toast.error(t("Não foi possível remover a gravação. Tente novamente.", "Couldn't delete the recording. Try again.", "No se pudo eliminar la grabación. Inténtalo de nuevo."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="border border-border/50 bg-card/40 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2"><Video className="h-4 w-4 text-primary" /><h3 className="font-mono text-xs uppercase tracking-widest">{t("Biblioteca privada de avatar", "Private avatar library", "Biblioteca privada de avatar")}</h3></div>
      <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
        {t("Grave vídeos de treino de 5 segundos a 2 minutos. As gravações ficam privadas neste workspace, podem ser usadas para treinar seu avatar e podem ser removidas por você. Gravar não salva nem inicia treinamento.", "Record 5-second to 2-minute training videos. Recordings stay private in this workspace, can be used to train your avatar, and can be deleted by you. Recording does not save or start training.", "Graba vídeos de entrenamiento de 5 segundos a 2 minutos. Permanecen privados en este espacio, pueden entrenar tu avatar y puedes eliminarlos. Grabar no guarda ni inicia el entrenamiento.")}
      </p>
      <div className="space-y-3 border border-border/40 bg-background/20 p-4">
        {!recording ? (
          <Button size="sm" onClick={() => void startRecording()} disabled={saving} className="font-mono text-xs gap-2"><Camera className="h-4 w-4" />{t("Gravar vídeo de treino", "Record training video", "Grabar vídeo de entrenamiento")}</Button>
        ) : (
          <Button size="sm" variant="destructive" onClick={stopRecording} className="font-mono text-xs gap-2"><Square className="h-4 w-4" />{t("Parar gravação", "Stop recording", "Detener grabación")} · {seconds}s</Button>
        )}
        {recording && (
          <div className="w-full max-w-sm space-y-2">
            <div className="relative overflow-hidden rounded-lg border border-border/40 bg-black aspect-video">
              <video ref={liveVideoRef} autoPlay muted playsInline className="h-full w-full object-cover -scale-x-100" />
              <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 font-mono text-[10px] text-red-400">
                {t("PRÉVIA AO VIVO", "LIVE PREVIEW", "VISTA PREVIA EN VIVO")}
              </span>
            </div>
            <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
              {t("Confira se seu rosto e ombros estão enquadrados, se a luz ilumina seu rosto pela frente e se o ambiente está silencioso.", "Check that your face and shoulders are in frame, your face is lit from the front, and the room is quiet.", "Comprueba que tu rostro y hombros estén encuadrados, que la luz ilumine tu rostro desde delante y que el ambiente esté en silencio.")}
            </p>
          </div>
        )}
        {!recording && previewUrl && <video src={previewUrl} controls playsInline className="w-full max-w-sm rounded-lg border border-border/40" />}
        {blob && (
          <div className="space-y-3">
            <label className="flex items-start gap-2 font-mono text-[10px] text-muted-foreground leading-relaxed">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 accent-primary" />
              <span>{t("Autorizo guardar este vídeo de imagem e voz no workspace privado para uso futuro no treinamento do meu avatar. Posso removê-lo a qualquer momento.", "I authorize saving this image and voice video in the private workspace for future avatar training. I can delete it at any time.", "Autorizo guardar este vídeo de imagen y voz en el espacio privado para entrenar mi avatar más adelante. Puedo eliminarlo cuando quieras.")}</span>
            </label>
            <Button size="sm" onClick={() => void saveSample()} disabled={!consent || saving} className="font-mono text-xs gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}{t("Consentir e salvar gravação", "Consent and save recording", "Consentir y guardar grabación")}
            </Button>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("Gravações salvas", "Saved recordings", "Grabaciones guardadas")} ({samples.length}/20)</div>
        {samples.length === 0 && <p className="font-mono text-[10px] text-muted-foreground">{t("Nenhuma gravação salva ainda.", "No saved recordings yet.", "Aún no hay grabaciones guardadas.")}</p>}
        {samples.map((sample) => (
          <div key={sample.sampleId} className="border border-border/30 px-3 py-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-0"><div className="truncate font-mono text-xs">{sample.name}</div><div className="font-mono text-[10px] text-muted-foreground">{sample.durationSeconds}s · {(sample.sizeBytes / 1024 / 1024).toFixed(1)} MB · {new Date(sample.createdAt).toLocaleDateString()}</div></div>
              <Button size="sm" variant="outline" onClick={() => void playSample(sample)} disabled={busyId === sample.sampleId} className="h-8 rounded-none font-mono text-[10px] gap-1.5"><Play className="h-3 w-3" />{playingId === sample.sampleId ? t("Reproduzindo", "Playing", "Reproduciendo") : t("Ouvir/ver", "Preview", "Reproducir")}</Button>
              <Button size="sm" onClick={() => void useSample(sample)} disabled={busyId === sample.sampleId} className="h-8 rounded-none font-mono text-[10px] gap-1.5">{busyId === sample.sampleId ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}{t("Usar para avatar", "Use for avatar", "Usar para avatar")}</Button>
              <Button size="sm" variant="outline" onClick={() => void deleteSample(sample)} disabled={busyId === sample.sampleId} className="h-8 rounded-none text-red-400 font-mono text-[10px] gap-1.5"><Trash2 className="h-3 w-3" />{t("Excluir", "Delete", "Eliminar")}</Button>
            </div>
            <div id={`avatar-sample-preview-${sample.sampleId}`} />
          </div>
        ))}
      </div>
    </section>
  );
}
