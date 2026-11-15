import { useCallback, useEffect, useRef, useState } from "react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { useUiText } from "@/lib/i18n";
import { toast } from "sonner";
import { CheckCircle2, Headphones, Loader2, Mic, Play, Square, Trash2 } from "lucide-react";

type VoiceSample = {
  sampleId: string;
  name: string;
  durationSeconds: number;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

const STORAGE_CONSENT_VERSION = "voice-sample-storage-v2";

export function VoiceSampleLibrary({ onSamplesChange }: { onSamplesChange?: (count: number) => void }) {
  const t = useUiText();
  const [samples, setSamples] = useState<VoiceSample[]>([]);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [storageConsent, setStorageConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const audioUrlsRef = useRef<Record<string, string>>({});

  const loadSamples = useCallback(async () => {
    const result = await customFetch<{ samples: VoiceSample[] }>("/api/workspaces/me/persona/voice-samples");
    setSamples(result.samples);
    onSamplesChange?.(result.samples.length);
  }, [onSamplesChange]);

  useEffect(() => {
    void loadSamples().catch(() => toast.error(t("Não foi possível carregar as amostras salvas.", "Couldn't load saved samples.", "No se pudieron cargar las muestras guardadas.")));
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      Object.values(audioUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    };
    // URLs are explicitly revoked when replaced and at unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearPreview = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const recordingBlob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setBlob(recordingBlob);
        const url = URL.createObjectURL(recordingBlob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
        setRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
      };
      recorder.start(200);
      recorderRef.current = recorder;
      setRecording(true);
      timerRef.current = setInterval(() => setSeconds((current) => {
        if (current >= 119) stopRecording();
        return current + 1;
      }), 1000);
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      toast.error(t("Microfone indisponível. Verifique as permissões do navegador.", "Microphone unavailable. Check your browser permissions.", "Micrófono no disponible. Comprueba los permisos del navegador."));
    }
  };

  const saveSample = async () => {
    if (!blob || !storageConsent) return;
    setLoading(true);
    try {
      const query = new URLSearchParams({ consent: "true", consentVersion: STORAGE_CONSENT_VERSION });
      const result = await customFetch<{ sample: VoiceSample }>(`/api/workspaces/me/persona/voice-samples?${query}`, {
        method: "POST",
        headers: { "Content-Type": blob.type.split(";")[0] || "audio/webm" },
        body: blob,
      });
      setSamples([result.sample]);
      onSamplesChange?.(1);
      setStorageConsent(false);
      clearPreview();
      toast.success(t("Amostra salva. A anterior foi substituída e removida.", "Sample saved. The previous one was replaced and deleted.", "Muestra guardada. La anterior fue sustituida y eliminada."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Não foi possível salvar a amostra.", "Couldn't save the sample.", "No se pudo guardar la muestra."));
    } finally {
      setLoading(false);
    }
  };

  const playSample = async (sample: VoiceSample) => {
    try {
      let url = audioUrls[sample.sampleId];
      if (!url) {
        const audio = await customFetch<Blob>(`/api/workspaces/me/persona/voice-samples/${sample.sampleId}/audio`, { responseType: "blob" });
        url = URL.createObjectURL(audio);
        audioUrlsRef.current[sample.sampleId] = url;
        setAudioUrls((current) => ({ ...current, [sample.sampleId]: url! }));
      }
      setPlayingId(sample.sampleId);
      const player = new Audio(url);
      player.onended = () => setPlayingId(null);
      player.onerror = () => setPlayingId(null);
      await player.play();
    } catch {
      setPlayingId(null);
      toast.error(t("Não foi possível reproduzir esta amostra.", "Couldn't play this sample.", "No se pudo reproducir esta muestra."));
    }
  };

  const deleteSample = async (sample: VoiceSample) => {
    setLoading(true);
    try {
      await customFetch(`/api/workspaces/me/persona/voice-samples/${sample.sampleId}`, { method: "DELETE" });
      setSamples((current) => current.filter((item) => item.sampleId !== sample.sampleId));
      onSamplesChange?.(Math.max(0, samples.length - 1));
      if (audioUrlsRef.current[sample.sampleId]) URL.revokeObjectURL(audioUrlsRef.current[sample.sampleId]!);
      delete audioUrlsRef.current[sample.sampleId];
      setAudioUrls((current) => { const next = { ...current }; delete next[sample.sampleId]; return next; });
      toast.success(t("Amostra removida.", "Sample deleted.", "Muestra eliminada."));
    } catch {
      toast.error(t("Não foi possível remover a amostra. Tente novamente.", "Couldn't delete the sample. Try again.", "No se pudo eliminar la muestra. Inténtalo de nuevo."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SectionCard title={t("Biblioteca privada de voz", "Private voice library", "Biblioteca privada de voz")} icon={Headphones}>
      <div className="space-y-4">
        <p className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed">
          {t("Grave ou envie uma amostra de 5 segundos a 2 minutos. O workspace mantém somente uma amostra: ao salvar outra, a anterior será substituída e removida permanentemente. Após seu consentimento, o áudio fica no armazenamento privado do NexOS; nenhum provedor de IA recebe o arquivo nesta etapa.", "Record or upload one sample from 5 seconds to 2 minutes. Each workspace keeps only one sample: saving another permanently replaces and deletes the previous one. With your consent, the audio is stored privately by NexOS; no AI provider receives it at this stage.", "Graba o sube una muestra de 5 segundos a 2 minutos. Cada espacio de trabajo conserva una sola muestra: al guardar otra, la anterior se sustituye y se elimina permanentemente. Con tu consentimiento, NexOS almacena el audio de forma privada; ningún proveedor de IA lo recibe en esta etapa.")}
        </p>

        <div className="space-y-3 border border-border/40 bg-background/20 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {!recording ? (
              <Button size="sm" onClick={() => void startRecording()} disabled={loading} className="rounded-none font-mono text-[10px] uppercase tracking-widest gap-2">
                <Mic className="h-3.5 w-3.5" /> {t("Gravar amostra", "Record sample", "Grabar muestra")}
              </Button>
            ) : (
              <Button size="sm" onClick={stopRecording} className="rounded-none font-mono text-[10px] uppercase tracking-widest gap-2 text-red-400">
                <Square className="h-3.5 w-3.5" /> {t("Parar gravação", "Stop recording", "Detener grabación")} · {seconds}s
              </Button>
            )}
            {previewUrl && <audio controls src={previewUrl} className="h-9 max-w-full" />}
          </div>
          {blob && (
            <div className="space-y-3">
              <label className="flex items-start gap-2 font-mono text-[10px] text-muted-foreground/80 leading-relaxed">
                <input type="checkbox" checked={storageConsent} onChange={(event) => setStorageConsent(event.target.checked)} className="mt-0.5 accent-primary" />
                <span>{t("Autorizo guardar esta amostra no armazenamento privado do NexOS. Entendo que o workspace aceita somente uma amostra e que, ao salvar esta, a anterior será substituída e removida permanentemente. Salvar não clona minha voz nem envia o áudio a um provedor de IA.", "I authorize saving this sample to NexOS private storage. I understand the workspace accepts only one sample and that saving this one permanently replaces and deletes the previous one. Saving does not clone my voice or send audio to an AI provider.", "Autorizo guardar esta muestra en el almacenamiento privado de NexOS. Entiendo que el espacio de trabajo admite una sola muestra y que, al guardar esta, la anterior se sustituirá y eliminará permanentemente. Guardarla no clona mi voz ni envía el audio a un proveedor de IA.")}</span>
              </label>
              <Button size="sm" onClick={() => void saveSample()} disabled={!storageConsent || loading} className="rounded-none font-mono text-[10px] uppercase tracking-widest gap-2">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {t(samples.length ? "Substituir amostra salva" : "Consentir e salvar amostra", samples.length ? "Replace saved sample" : "Consent and save sample", samples.length ? "Sustituir muestra guardada" : "Consentir y guardar muestra")}
              </Button>
            </div>
          )}
        </div>

        {samples.length > 0 ? (
          <div className="space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("Amostra salva", "Saved sample", "Muestra guardada")} ({samples.length}/1)</div>
            {samples.map((sample) => (
              <div key={sample.sampleId} className="flex flex-wrap items-center gap-3 border border-border/30 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-xs text-foreground">{sample.name}</div>
                  <div className="font-mono text-[10px] text-muted-foreground/60">{sample.durationSeconds}s · {(sample.sizeBytes / 1024).toFixed(0)} KB · {new Date(sample.createdAt).toLocaleDateString()}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => void playSample(sample)} className="h-8 rounded-none gap-1.5 font-mono text-[10px]">
                  <Play className="h-3 w-3" /> {playingId === sample.sampleId ? t("Reproduzindo", "Playing", "Reproduciendo") : t("Ouvir", "Listen", "Escuchar")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void deleteSample(sample)} disabled={loading} className="h-8 rounded-none text-red-400 gap-1.5 font-mono text-[10px]">
                  <Trash2 className="h-3 w-3" /> {t("Excluir", "Delete", "Eliminar")}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="font-mono text-[10px] text-muted-foreground/60">{t("Nenhuma amostra salva ainda.", "No saved samples yet.", "Aún no hay muestras guardadas.")}</div>
        )}
      </div>
    </SectionCard>
  );
}

function SectionCard({ children, title, icon: Icon }: { children: React.ReactNode; title: string; icon: React.ElementType }) {
  return (
    <div className="border border-border/50 bg-card/40 backdrop-blur-sm relative overflow-hidden card-weapon">
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-primary/40 pointer-events-none" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-primary/40 pointer-events-none" />
      <div className="px-6 py-4 border-b border-border/40 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{title}</span>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
