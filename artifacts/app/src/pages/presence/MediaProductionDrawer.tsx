/**
 * MediaProductionDrawer — Pipeline de produção de mídia para posts de presença social.
 *
 * Fluxo IA:  Roteiro → Storyboard (baixa resolução) → Vídeo final (HeyGen/Runway/Kling)
 * Fluxo Upload: Seleção de arquivo → Preview → Anexar ao post
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { useUiText } from "@/lib/i18n";
import {
  X, Sparkles, Upload, Loader2, AlertTriangle, Film,
  RefreshCw, CheckCircle2, Video, ImageIcon, User,
  ArrowRight, Play, Wand2, PenLine, Settings, Clapperboard, Users, Mic, Camera,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MediaPresencePost {
  id: string;
  platform: string;
  format: string;
  caption: string;
  visualDirection: string;
  videoScript: string | null;
  mediaUrls: string[];
  storyboardUrls: string[];
  mediaGenStatus: string | null;
  mediaJobId: string | null;
  mediaJobProvider: string | null;
  status: string;
  errorMessage: string | null;
  storyMediaType?: string | null;
}

interface Persona {
  heygenAvatarId?: string;
  voiceCloneId?: string;
  heygenVoiceId?: string;
  avatarType?: string;
}

interface StockAvatar { id: string; label: string; gender: string; }
interface HeyGenVoice { voice_id: string; name: string; language: string; gender: string; }

// ─── Main Component ───────────────────────────────────────────────────────────

export function MediaProductionDrawer({
  post: initialPost,
  onClose,
  onPostUpdated,
}: {
  post: MediaPresencePost;
  onClose: () => void;
  onPostUpdated: (post: MediaPresencePost) => void;
}) {
  const t = useUiText();
  const [tab, setTab] = useState<"ai" | "upload">("ai");
  const [currentPost, setCurrentPost] = useState(initialPost);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [editedDirection, setEditedDirection] = useState(initialPost.visualDirection);
  const [editedScript, setEditedScript] = useState(initialPost.videoScript ?? "");
  const [carouselSlideCount, setCarouselSlideCount] = useState(
    ["carousel", "feed_carousel"].includes(initialPost.format) && initialPost.storyboardUrls?.length
      ? initialPost.storyboardUrls.length
      : 2
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Avatar selector state
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  const [avatarSelectorLoading, setAvatarSelectorLoading] = useState(false);
  const [stockAvatars, setStockAvatars] = useState<StockAvatar[]>([]);
  const [heygenVoices, setHeygenVoices] = useState<HeyGenVoice[]>([]);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  // For story posts: track whether the operator chose image or video
  const [storyMediaType, setStoryMediaType] = useState<"image" | "video">(
    initialPost.storyMediaType === "image" ? "image" : "video",
  );
  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadedMediaUrl, setUploadedMediaUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load workspace persona (avatar + voice clone check)
  useEffect(() => {
    customFetch<{ persona: Persona }>("/api/workspaces/me/persona")
      .then((d) => setPersona(d.persona))
      .catch(() => {});
  }, []);

  // Auto-poll while generating storyboard or video
  useEffect(() => {
    const generating =
      currentPost.mediaGenStatus === "storyboard_generating" ||
      currentPost.mediaGenStatus === "video_generating";


    if (generating && !pollRef.current) {
      pollRef.current = setInterval(async () => {
        try {
          const { post: updated } = await customFetch<{ post: MediaPresencePost }>(
            `/api/presence/posts/${currentPost.id}/media/poll`,
          );
          if (updated) {
            setCurrentPost(updated);
            onPostUpdated(updated);
            const stillGenerating =
              updated.mediaGenStatus === "storyboard_generating" ||
              updated.mediaGenStatus === "video_generating";
            // storyboard_draft and storyboard_ready both stop polling
            if (!stillGenerating && pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          }
        } catch { /* noop */ }
      }, 5000);
    }

    if (!generating && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [currentPost.mediaGenStatus, currentPost.id, onPostUpdated]);

  const updatePost = useCallback(
    (updated: MediaPresencePost) => { setCurrentPost(updated); onPostUpdated(updated); },
    [onPostUpdated],
  );

  // ── AI Tab actions ─────────────────────────────────────────────────────────

  const generateStoryboard = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const { post: updated } = await customFetch<{ post: MediaPresencePost }>(
        `/api/presence/posts/${currentPost.id}/media/generate-storyboard`,
        {
          method: "POST",
          body: JSON.stringify({
            visualDirection: editedDirection,
            videoScript: editedScript || null,
            ...(["carousel", "feed_carousel"].includes(currentPost.format) ? { slideCount: carouselSlideCount } : {}),
          }),
        },
      );
      updatePost(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("Erro ao gerar storyboard.", "Error generating storyboard.", "Error al generar el guion gráfico."));
    } finally {
      setBusy(false);
    }
  };

  const generateVideo = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const { post: updated } = await customFetch<{ post: MediaPresencePost }>(
        `/api/presence/posts/${currentPost.id}/media/generate-video`,
        { method: "POST" },
      );
      updatePost(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("Erro ao gerar vídeo.", "Error generating video.", "Error al generar el vídeo."));
    } finally {
      setBusy(false);
    }
  };

  const approveImage = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const { post: updated } = await customFetch<{ post: MediaPresencePost }>(
        `/api/presence/posts/${currentPost.id}/media/approve-image`,
        { method: "POST" },
      );
      updatePost(updated);
      onClose();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("Erro ao aprovar imagem.", "Error approving image.", "Error al aprobar la imagen."));
    } finally {
      setBusy(false);
    }
  };

  const confirmVideo = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const { post: updated } = await customFetch<{ post: MediaPresencePost }>(
        `/api/presence/posts/${currentPost.id}/media/confirm-video`,
        { method: "POST" },
      );
      updatePost(updated);
      onClose();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("Erro ao confirmar vídeo.", "Error confirming video.", "Error al confirmar el vídeo."));
    } finally {
      setBusy(false);
    }
  };

  const resetPipeline = async () => {
    setActionError(null);
    try {
      const { post: updated } = await customFetch<{ post: MediaPresencePost }>(
        `/api/presence/posts/${currentPost.id}`,
        { method: "PATCH", body: JSON.stringify({ mediaUrls: [] }) },
      );
      const reset = {
        ...updated,
        mediaGenStatus: null,
        storyboardUrls: [],
        mediaJobId: null,
        mediaJobProvider: null,
      } as MediaPresencePost;
      setCurrentPost(reset);
      onPostUpdated(reset);
      setEditedDirection(updated.visualDirection);
      setEditedScript(updated.videoScript ?? "");
    } catch { /* noop */ }
  };

  // For story posts: save type choice and reset media pipeline
  const changeStoryMediaType = async (type: "image" | "video") => {
    if (type === storyMediaType) return;
    setStoryMediaType(type);
    try {
      await customFetch<{ post: MediaPresencePost }>(
        `/api/presence/posts/${currentPost.id}`,
        { method: "PATCH", body: JSON.stringify({ storyMediaType: type, mediaUrls: [] }) },
      );
      // Also reset any in-progress pipeline so user starts fresh with the new type
      const reset: MediaPresencePost = {
        ...currentPost,
        storyMediaType: type,
        mediaGenStatus: null,
        storyboardUrls: [],
        mediaJobId: null,
        mediaJobProvider: null,
        mediaUrls: [],
      };
      setCurrentPost(reset);
      onPostUpdated(reset);
    } catch { /* noop — local state already updated */ }
  };

  // ── Upload Tab actions ─────────────────────────────────────────────────────

  const handleFileSelect = (file: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setActionError(null);
  };

  const uploadFile = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setActionError(null);
    try {
      // Use native fetch to avoid customFetch overriding Content-Type.
      // The auth store (lib/auth.tsx) saves the token under "accessToken".
      const token =
        localStorage.getItem("accessToken") ??
        localStorage.getItem("nexos_access_token") ??
        sessionStorage.getItem("accessToken") ??
        sessionStorage.getItem("nexos_access_token") ??
        "";
      const headers: Record<string, string> = {
        "Content-Type": selectedFile.type || "application/octet-stream",
        "X-Filename": selectedFile.name,
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/presence/posts/${currentPost.id}/media/upload`, {
        method: "POST",
        body: selectedFile,
        headers,
        credentials: "include",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: t("Erro ao fazer upload.", "Error uploading file.", "Error al subir el archivo.") }))) as { error?: string };
        throw new Error(err.error ?? t("Erro ao fazer upload.", "Error uploading file.", "Error al subir el archivo."));
      }
      const { post: updated } = (await res.json()) as { post: MediaPresencePost };
      updatePost(updated);
      setUploadedMediaUrl(updated.mediaUrls?.[0] ?? previewUrl);
      setUploadDone(true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("Erro ao fazer upload.", "Error uploading file.", "Error al subir el archivo."));
    } finally {
      setUploading(false);
    }
  };

  const hasAvatar = !!(persona?.heygenAvatarId && (persona?.voiceCloneId || persona?.heygenVoiceId));

  const openAvatarSelector = async () => {
    setShowAvatarSelector(true);
    setAvatarSelectorLoading(true);
    try {
      const [avatarsRes, voicesRes] = await Promise.all([
        customFetch<{ avatars: StockAvatar[] }>("/api/workspaces/me/persona/stock-avatars"),
        customFetch<{ voices: HeyGenVoice[] }>("/api/workspaces/me/persona/heygen-voices").catch(() => ({ voices: [] })),
      ]);
      setStockAvatars(avatarsRes.avatars ?? []);
      setHeygenVoices(voicesRes.voices ?? []);
      // Pre-select current values if already configured
      if (persona?.heygenAvatarId) setSelectedAvatarId(persona.heygenAvatarId);
      if (voicesRes.voices.length > 0 && !selectedVoiceId) setSelectedVoiceId(voicesRes.voices[0].voice_id);
    } catch { /* noop */ }
    setAvatarSelectorLoading(false);
  };

  const saveAvatarSelection = async () => {
    if (!selectedAvatarId || !selectedVoiceId) return;
    setSavingAvatar(true);
    try {
      const result = await customFetch<{ heygenAvatarId: string; heygenVoiceId: string; success: boolean }>(
        "/api/workspaces/me/persona/select-stock-avatar",
        { method: "POST", body: JSON.stringify({ avatarId: selectedAvatarId, voiceId: selectedVoiceId }) },
      );
      if (result.success) {
        setPersona((p) => p ? { ...p, heygenAvatarId: result.heygenAvatarId, heygenVoiceId: result.heygenVoiceId, avatarType: "stock" } : p);
        setShowAvatarSelector(false);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("Erro ao salvar avatar.", "Error saving avatar.", "Error al guardar el avatar."));
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleUpdateStoryboardUrls = async (newUrls: string[]) => {
    try {
      const { post: updated } = await customFetch<{ post: MediaPresencePost }>(
        `/api/presence/posts/${currentPost.id}`,
        { method: "PATCH", body: JSON.stringify({ storyboardUrls: newUrls }) }
      );
      updatePost(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t("Erro ao atualizar slides.", "Error updating slides.", "Error al actualizar las diapositivas."));
    }
  };

  const content = (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-t-2xl sm:rounded-2xl border border-border bg-card flex flex-col"
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Film className="h-4 w-4 text-primary" />
              {t("Produção de Mídia", "Media Production", "Producción multimedia")}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
              {currentPost.platform} · {currentPost.format} · {currentPost.caption.slice(0, 60)}
              {currentPost.caption.length > 60 ? "…" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label={t("Fechar produção de mídia", "Close media production", "Cerrar producción multimedia")}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          {[
            { id: "ai" as const, label: t("Gerar com IA", "Generate with AI", "Generar con IA"), icon: Sparkles },
            { id: "upload" as const, label: t("Fazer Upload", "Upload", "Subir archivo"), icon: Upload },
          ].map((tabItem) => (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              className={`flex items-center gap-1.5 px-5 py-2.5 text-sm border-b-2 transition-colors ${
                tab === tabItem.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tabItem.icon className="h-3.5 w-3.5" /> {tabItem.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
          {actionError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{actionError}</span>
              <button className="ml-auto" onClick={() => setActionError(null)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {tab === "ai" ? (
            <AITabContent
              post={currentPost}
              persona={persona}
              hasAvatar={hasAvatar}
              editedDirection={editedDirection}
              editedScript={editedScript}
              storyMediaType={storyMediaType}
              carouselSlideCount={carouselSlideCount}
              onCarouselSlideCountChange={setCarouselSlideCount}
              onEditDirection={setEditedDirection}
              onEditScript={setEditedScript}
              onChangeStoryMediaType={changeStoryMediaType}
              onUpdateStoryboardUrls={handleUpdateStoryboardUrls}
              onGenerateStoryboard={generateStoryboard}
              onGenerateVideo={generateVideo}
              onApproveImage={approveImage}
              onConfirmVideo={confirmVideo}
              onReset={resetPipeline}
              busy={busy}
              showAvatarSelector={showAvatarSelector}
              avatarSelectorLoading={avatarSelectorLoading}
              stockAvatars={stockAvatars}
              heygenVoices={heygenVoices}
              selectedAvatarId={selectedAvatarId}
              selectedVoiceId={selectedVoiceId}
              savingAvatar={savingAvatar}
              onOpenAvatarSelector={openAvatarSelector}
              onCloseAvatarSelector={() => setShowAvatarSelector(false)}
              onSelectAvatar={setSelectedAvatarId}
              onSelectVoice={setSelectedVoiceId}
              onSaveAvatarSelection={saveAvatarSelection}
            />
          ) : (
            <UploadTabContent
              selectedFile={selectedFile}
              previewUrl={previewUrl}
              uploading={uploading}
              uploadDone={uploadDone}
              uploadedMediaUrl={uploadedMediaUrl}
              fileInputRef={fileInputRef}
              onFileSelect={handleFileSelect}
              onUpload={uploadFile}
              onClose={onClose}
              onUploadAnother={() => { setUploadDone(false); setUploadedMediaUrl(null); setSelectedFile(null); setPreviewUrl(null); }}
            />
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

// ─── AI Tab ───────────────────────────────────────────────────────────────────

function AITabContent({
  post,
  persona,
  hasAvatar,
  editedDirection,
  editedScript,
  storyMediaType,
  carouselSlideCount,
  onCarouselSlideCountChange,
  onEditDirection,
  onEditScript,
  onChangeStoryMediaType,
  onUpdateStoryboardUrls,
  onGenerateStoryboard,
  onGenerateVideo,
  onApproveImage,
  onConfirmVideo,
  onReset,
  busy,
  showAvatarSelector,
  avatarSelectorLoading,
  stockAvatars,
  heygenVoices,
  selectedAvatarId,
  selectedVoiceId,
  savingAvatar,
  onOpenAvatarSelector,
  onCloseAvatarSelector,
  onSelectAvatar,
  onSelectVoice,
  onSaveAvatarSelection,
}: {
  post: MediaPresencePost;
  persona: Persona | null;
  hasAvatar: boolean;
  editedDirection: string;
  editedScript: string;
  storyMediaType: "image" | "video";
  carouselSlideCount: number;
  onCarouselSlideCountChange: (count: number) => void;
  onEditDirection: (v: string) => void;
  onEditScript: (v: string) => void;
  onChangeStoryMediaType: (type: "image" | "video") => void;
  onUpdateStoryboardUrls: (urls: string[]) => void;
  onGenerateStoryboard: () => void;
  onGenerateVideo: () => void;
  onApproveImage: () => void;
  onConfirmVideo: () => void;
  onReset: () => void;
  busy: boolean;
  showAvatarSelector: boolean;
  avatarSelectorLoading: boolean;
  stockAvatars: StockAvatar[];
  heygenVoices: HeyGenVoice[];
  selectedAvatarId: string | null;
  selectedVoiceId: string | null;
  savingAvatar: boolean;
  onOpenAvatarSelector: () => void;
  onCloseAvatarSelector: () => void;
  onSelectAvatar: (id: string) => void;
  onSelectVoice: (id: string) => void;
  onSaveAvatarSelection: () => void;
}) {
  const t = useUiText();
  const step = post.mediaGenStatus;
  // Formats that produce a final image (not video).
  // Stories can be either image or video — decided by storyMediaType.
  const isCarouselFormat = ["carousel", "feed_carousel"].includes(post.format);
  const isImageFormat =
    post.format === "story"
      ? storyMediaType === "image"
      : !["reel", "feed_video"].includes(post.format);

  // Avatar / video style banner
  const AvatarBanner = () => {
    if (persona === null) return null; // still loading
    if (hasAvatar) {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2 text-xs text-green-400">
          <User className="h-3.5 w-3.5 shrink-0" />
          <span>{t("Clone digital configurado — o vídeo usará seu avatar e voz clonada.", "Digital clone configured — the video will use your avatar and cloned voice.", "Clon digital configurado: el vídeo usará tu avatar y tu voz clonada.")}</span>
        </div>
      );
    }
    // No avatar: show clone-digital style setup prompt
    return (
      <div className="space-y-3">
        {/* Header */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
          <p className="text-xs font-bold text-foreground">{t("Clone Digital", "Digital Clone", "Clon digital")}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
            {t("Seu clone é composto por dois elementos: sua", "Your clone has two components: your", "Tu clon consta de dos elementos: tu")} <span className="text-foreground font-medium">{t("voz clonada", "cloned voice", "voz clonada")}</span> {t("e seu", "and your", "y tu")} <span className="text-foreground font-medium">{t("avatar de vídeo", "video avatar", "avatar de vídeo")}</span>.
          </p>
        </div>

        {/* Clone de Voz card */}
        <a
          href="/clone-digital"
          className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/50 hover:border-primary/40 hover:bg-primary/5 px-3 py-3 transition-colors cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Mic className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-foreground">{t("Clone de Voz", "Voice Clone", "Clon de voz")}</p>
              <span className="text-[9px] font-mono bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-full">{t("Não configurado", "Not configured", "Sin configurar")}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
              {t("Grave 5 takes com emoções diferentes. Em ~5 minutos, sua voz narra automaticamente cada campanha.", "Record 5 takes with different emotions. In about 5 minutes, your voice can narrate each campaign automatically.", "Graba 5 tomas con distintas emociones. En unos 5 minutos, tu voz podrá narrar cada campaña automáticamente.")}
            </p>
            <span className="text-[10px] text-primary font-medium mt-1 inline-block group-hover:underline">{t("Criar clone de voz agora →", "Create voice clone now →", "Crear clon de voz ahora →")}</span>
          </div>
        </a>

        {/* Avatar Digital card */}
        <a
          href="/clone-digital"
          className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/50 hover:border-primary/40 hover:bg-primary/5 px-3 py-3 transition-colors cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Camera className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-foreground">{t("Avatar Digital", "Digital Avatar", "Avatar digital")}</p>
              <span className="text-[9px] font-mono bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-full">{t("Não configurado", "Not configured", "Sin configurar")}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
              {t("Grave 2 vídeos curtos (treino + consentimento). O HeyGen treina seu avatar — aparece falando em cada reel.", "Record 2 short videos (training + consent). HeyGen trains your avatar to appear speaking in every Reel.", "Graba 2 vídeos cortos (entrenamiento y consentimiento). HeyGen entrenará tu avatar para que aparezca hablando en cada reel.")}
            </p>
            <span className="text-[10px] text-primary font-medium mt-1 inline-block group-hover:underline">{t("Criar avatar digital agora →", "Create digital avatar now →", "Crear avatar digital ahora →")}</span>
          </div>
        </a>

        {/* Alternative: stock HeyGen avatar */}
        <div className="relative">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-border/40" />
          <p className="relative text-center text-[9px] text-muted-foreground bg-background/80 px-2 mx-auto w-fit">{t("ou usar avatar da biblioteca", "or use a stock avatar", "o usa un avatar de la biblioteca")}</p>
        </div>
        <button
          type="button"
          onClick={onOpenAvatarSelector}
          className="w-full flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 hover:border-border hover:bg-background/70 px-3 py-2.5 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground">HeyGen {t("Avatar", "Avatar", "Avatar")}</p>
            <p className="text-[10px] text-muted-foreground">{t("+1.000 avatares profissionais — configure sem câmera", "1,000+ professional avatars — set up without a camera", "Más de 1.000 avatares profesionales: configúralo sin cámara")}</p>
          </div>
          <span className="text-[10px] text-primary/70 font-medium shrink-0">{t("Selecionar →", "Select →", "Seleccionar →")}</span>
        </button>

        {/* Inline avatar + voice selector */}
        {showAvatarSelector && (
          <div className="border border-border/60 rounded-xl bg-background/60 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-mono font-bold">{t("Selecionar avatar e voz", "Select avatar and voice", "Seleccionar avatar y voz")}</p>
              <button type="button" onClick={onCloseAvatarSelector} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {avatarSelectorLoading ? (
              <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">{t("Carregando avatares...", "Loading avatars...", "Cargando avatares...")}</span>
              </div>
            ) : (
              <>
                {/* Avatar grid */}
                <div>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">{t("Avatar", "Avatar", "Avatar")}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {stockAvatars.map((av) => (
                      <button
                        key={av.id}
                        type="button"
                        onClick={() => onSelectAvatar(av.id)}
                        className={`rounded-lg border p-2.5 text-left transition-colors ${selectedAvatarId === av.id ? "border-primary bg-primary/10" : "border-border/40 hover:border-border"}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold leading-tight">{av.label}</p>
                            <p className="text-[9px] text-muted-foreground capitalize">{av.gender}</p>
                          </div>
                        </div>
                        {selectedAvatarId === av.id && <span className="text-[9px] text-primary font-medium">✓ {t("Selecionado", "Selected", "Seleccionado")}</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Voice selector */}
                {heygenVoices.length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">{t("Voz para narração", "Voiceover", "Voz para narración")}</p>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {heygenVoices.map((v) => (
                        <button
                          key={v.voice_id}
                          type="button"
                          onClick={() => onSelectVoice(v.voice_id)}
                          className={`w-full rounded-lg border px-3 py-2 text-left text-[10px] transition-colors ${selectedVoiceId === v.voice_id ? "border-primary bg-primary/10 text-foreground" : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"}`}
                        >
                          <span className="font-medium">{v.name}</span>
                          <span className="ml-2 text-[9px] opacity-60">{v.gender} · {v.language}</span>
                          {selectedVoiceId === v.voice_id && <span className="ml-2 text-primary">✓</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  size="sm"
                  className="w-full font-mono text-xs"
                  disabled={!selectedAvatarId || !selectedVoiceId || savingAvatar}
                  onClick={onSaveAvatarSelection}
                >
                  {savingAvatar ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />{t("Salvando...", "Saving...", "Guardando...")}</> : <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />{t("Confirmar avatar e voz", "Confirm avatar and voice", "Confirmar avatar y voz")}</>}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  // Step: Roteiro (início do pipeline)
  if (!step || step === "idle") {
    return (
      <div className="space-y-4">
        {/* Story type selector — shown only for story format */}
        {post.format === "story" && (
          <div className="rounded-lg border border-border bg-background/40 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{t("Tipo de Story", "Story Type", "Tipo de historia")}</p>
            <div className="flex gap-2">
              <button
                onClick={() => onChangeStoryMediaType("image")}
                disabled={busy}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  storyMediaType === "image"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                <ImageIcon className="h-3.5 w-3.5" /> {t("Imagem", "Image", "Imagen")}
              </button>
              <button
                onClick={() => onChangeStoryMediaType("video")}
                disabled={busy}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  storyMediaType === "video"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                <Video className="h-3.5 w-3.5" /> {t("Vídeo", "Video", "Vídeo")}
              </button>
            </div>
          </div>
        )}

        {!isImageFormat && <AvatarBanner />}

        {/* Pipeline steps indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-primary w-5 h-5 flex items-center justify-center text-[10px] text-primary-foreground font-bold shrink-0">1</span>
          <span className="font-medium text-foreground">{t("Direção Visual", "Visual Direction", "Dirección visual")}</span>
          <ArrowRight className="h-3 w-3 shrink-0" />
          <span className="opacity-50 flex items-center gap-1"><span className="rounded-full border border-border w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0">2</span>{isImageFormat ? (isCarouselFormat ? t("Imagens", "Images", "Imágenes") : t("Imagem", "Image", "Imagen")) : "Storyboard"}</span>
          {!isImageFormat && <>
            <ArrowRight className="h-3 w-3 shrink-0 opacity-50" />
            <span className="opacity-50 flex items-center gap-1"><span className="rounded-full border border-border w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>{t("Vídeo", "Video", "Vídeo")}</span>
          </>}
        </div>

        <div className="space-y-3">
          {isCarouselFormat && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex justify-between">
                <span>{t("Número de Slides", "Number of Slides", "Número de diapositivas")}</span>
                <span className="text-foreground">{carouselSlideCount}</span>
              </label>
              <input
                type="range"
                min="2"
                max="10"
                step="1"
                value={carouselSlideCount}
                onChange={(e) => onCarouselSlideCountChange(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>2</span>
                <span>10</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t("Direção Visual", "Visual Direction", "Dirección visual")}
            </label>
            <textarea
              className="w-full rounded-lg border border-border bg-background/80 p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
              rows={4}
              value={editedDirection}
              onChange={(e) => onEditDirection(e.target.value)}
              placeholder={t("Descreva a cena: cenário, iluminação, personagens, elementos visuais, emoção...", "Describe the scene: setting, lighting, characters, visual elements, mood...", "Describe la escena: ambiente, iluminación, personajes, elementos visuales, emoción...")}
            />
          </div>

          {/* Script field: show for reel, or video-mode story, or when there's an existing script */}
          {(post.format === "reel" || (post.format === "story" && !isImageFormat) || post.videoScript) && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                {t("Roteiro / Narração (opcional)", "Script / Voiceover (optional)", "Guion / narración (opcional)")}
              </label>
              <textarea
                className="w-full rounded-lg border border-border bg-background/80 p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                rows={4}
                value={editedScript}
                onChange={(e) => onEditScript(e.target.value)}
                placeholder={t("Texto falado no vídeo — se vazio, o título do post é usado.", "Spoken video text — if blank, the post title is used.", "Texto hablado en el vídeo; si lo dejas en blanco, se usará el título de la publicación.")}
              />
            </div>
          )}
        </div>

        <Button onClick={onGenerateStoryboard} disabled={busy || !editedDirection.trim()} className="w-full">
          {busy
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t(`Gerando ${isCarouselFormat ? "slides" : "imagem"}...`, `Generating ${isCarouselFormat ? "slides" : "image"}...`, `Generando ${isCarouselFormat ? "diapositivas" : "imagen"}...`)}</>
            : <><Wand2 className="mr-2 h-4 w-4" /> {isImageFormat ? (isCarouselFormat ? t(`Gerar ${carouselSlideCount} Slides com IA`, `Generate ${carouselSlideCount} Slides with AI`, `Generar ${carouselSlideCount} diapositivas con IA`) : t("Gerar Imagem com IA", "Generate Image with AI", "Generar imagen con IA")) : t("Gerar Storyboard (baixa resolução)", "Generate Storyboard (low resolution)", "Generar guion gráfico (baja resolución)")}</>}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {isImageFormat
            ? (isCarouselFormat ? t("A IA gera os slides do carrossel baseada na sua direção visual. Você pode revisar e reordenar antes de publicar.", "AI creates carousel slides based on your visual direction. Review and reorder them before publishing.", "La IA crea las diapositivas del carrusel según tu dirección visual. Puedes revisarlas y reordenarlas antes de publicar.") : t("A IA gera a imagem final baseada na sua direção visual. Você aprova antes de publicar.", "AI creates the final image based on your visual direction. Approve it before publishing.", "La IA crea la imagen final según tu dirección visual. Apruébala antes de publicar."))
            : t("A IA cria um storyboard de baixa resolução para aprovação antes de gerar o vídeo final.", "AI creates a low-resolution storyboard for approval before generating the final video.", "La IA crea un guion gráfico de baja resolución para que lo apruebes antes de generar el vídeo final.")}
        </p>
      </div>
    );
  }

  // Step: Gerando storyboard
  if (step === "storyboard_generating") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-medium">{t("Gerando storyboard…", "Generating storyboard…", "Generando el guion gráfico…")}</p>
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          {t("A IA está criando o frame visual em baixa resolução baseado na sua direção. Leva ~30 segundos.", "AI is creating a low-resolution visual frame based on your direction. This takes about 30 seconds.", "La IA está creando un fotograma visual de baja resolución según tus indicaciones. Tardará unos 30 segundos.")}
        </p>
      </div>
    );
  }

  // Step: Imagem / Storyboard pronto — aprovação
  if (step === "storyboard_ready") {
    return (
      <div className="space-y-4">
        {!isImageFormat && <AvatarBanner />}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-green-500/50 bg-green-500/10 text-green-400 w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0">✓</span>
          <span className="opacity-50">{t("Direção Visual", "Visual Direction", "Dirección visual")}</span>
          <ArrowRight className="h-3 w-3 shrink-0" />
          <span className="rounded-full bg-primary w-5 h-5 flex items-center justify-center text-[10px] text-primary-foreground font-bold shrink-0">2</span>
          <span className="font-medium text-foreground">{isImageFormat ? (isCarouselFormat ? t("Slides Gerados", "Slides Generated", "Diapositivas generadas") : t("Imagem Gerada", "Image Generated", "Imagen generada")) : "Storyboard"}</span>
          {!isImageFormat && <>
            <ArrowRight className="h-3 w-3 shrink-0 opacity-50" />
            <span className="opacity-50 flex items-center gap-1"><span className="rounded-full border border-border w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>{t("Vídeo", "Video", "Vídeo")}</span>
          </>}
        </div>

        {isCarouselFormat ? (
          <CarouselEditor
            urls={post.storyboardUrls || []}
            onUpdate={onUpdateStoryboardUrls}
          />
        ) : (
          <div className="rounded-xl border border-border overflow-hidden bg-background/50">
            {post.storyboardUrls?.[0] ? (
              <img
                src={post.storyboardUrls[0]}
                alt={isImageFormat ? t("Imagem gerada pela IA", "AI-generated image", "Imagen generada por IA") : t("Prévia do storyboard", "Storyboard preview", "Vista previa del guion gráfico")}
                className="w-full object-cover max-h-80"
              />
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                <ImageIcon className="h-8 w-8 opacity-40" />
              </div>
            )}
          </div>
        )}

        <div className="rounded-lg border border-border bg-background/40 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">{t("Direção visual:", "Visual direction:", "Dirección visual:")}</strong> {post.visualDirection}
        </div>

        <div className="flex flex-col gap-2">
          {isImageFormat ? (
            <Button onClick={onApproveImage} disabled={busy || (isCarouselFormat && (post.storyboardUrls?.length || 0) < 2)} className="w-full">
              {busy
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t(`Salvando ${isCarouselFormat ? "slides" : "imagem"}...`, `Saving ${isCarouselFormat ? "slides" : "image"}...`, `Guardando ${isCarouselFormat ? "diapositivas" : "imagen"}...`)}</>
                : <><CheckCircle2 className="mr-2 h-4 w-4" /> {isCarouselFormat ? t("Aprovar conjunto de slides", "Approve slide set", "Aprobar conjunto de diapositivas") : t("Usar esta imagem no post", "Use this image in the post", "Usar esta imagen en la publicación")}</>}
            </Button>
          ) : (
            <Button onClick={onGenerateVideo} disabled={busy} className="w-full">
              {busy
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("Iniciando geração de vídeo...", "Starting video generation...", "Iniciando la generación del vídeo...")}</>
                : <><Video className="mr-2 h-4 w-4" /> {t("Aprovar e Gerar Vídeo", "Approve and Generate Video", "Aprobar y generar vídeo")}</>}
            </Button>
          )}
          <Button variant="outline" onClick={onReset} disabled={busy} className="w-full text-xs">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> {t("Editar direção e", "Edit direction and", "Editar dirección y")} {isImageFormat ? (isCarouselFormat ? t("gerar novos slides", "generate new slides", "generar nuevas diapositivas") : t("gerar nova imagem", "generate a new image", "generar una nueva imagen")) : t("regenerar storyboard", "regenerate storyboard", "regenerar el guion gráfico")}
          </Button>
        </div>
        {!isImageFormat && (
          <p className="text-center text-xs text-muted-foreground">
            {hasAvatar
              ? t("O vídeo usará seu clone digital e voz clonada.", "The video will use your digital clone and cloned voice.", "El vídeo usará tu clon digital y tu voz clonada.")
              : t("Vídeo cinematográfico por IA — configure avatar HeyGen ou clone próprio para aparecer nos vídeos.", "AI cinematic video — set up a HeyGen avatar or your own clone to appear in videos.", "Vídeo cinematográfico con IA: configura un avatar de HeyGen o tu propio clon para aparecer en los vídeos.")}
          </p>
        )}
      </div>
    );
  }

  // Step: Rascunho (gerado sem IA — todos os provedores falharam)
  if (step === "storyboard_draft") {
    return (
      <div className="space-y-4">
        {!isImageFormat && <AvatarBanner />}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-green-500/50 bg-green-500/10 text-green-400 w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0">✓</span>
          <span className="opacity-50">{t("Direção Visual", "Visual Direction", "Dirección visual")}</span>
          <ArrowRight className="h-3 w-3 shrink-0" />
          <span className="rounded-full bg-amber-500 w-5 h-5 flex items-center justify-center text-[10px] text-white font-bold shrink-0">2</span>
          <span className="font-medium text-amber-400">{t("Rascunho", "Draft", "Borrador")}</span>
          {!isImageFormat && <>
            <ArrowRight className="h-3 w-3 shrink-0 opacity-50" />
            <span className="opacity-50 flex items-center gap-1"><span className="rounded-full border border-border w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>{t("Vídeo", "Video", "Vídeo")}</span>
          </>}
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/8 px-3 py-2.5 text-xs text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">
              {t("Rascunho visual — clique em Regenerar para gerar a imagem final", "Visual draft — click Regenerate to create the final image", "Borrador visual: haz clic en Regenerar para crear la imagen final")}
            </p>
            <p className="text-amber-300/70 mt-0.5">
              {t("Este é um esboço com os textos do post. Clique em Regenerar para gerar a imagem real com IA (gpt-image-1.5).", "This is a sketch with the post text. Click Regenerate to create the actual AI image (gpt-image-1.5).", "Este es un boceto con el texto de la publicación. Haz clic en Regenerar para crear la imagen real con IA (gpt-image-1.5).")}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-400/20 overflow-hidden bg-background/50">
          {post.storyboardUrls?.[0] ? (
            <img
              src={post.storyboardUrls[0]}
              alt={t("Rascunho", "Draft", "Borrador")}
              className="w-full object-cover max-h-80"
            />
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              <ImageIcon className="h-8 w-8 opacity-40" />
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-background/40 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">{t("Direção visual:", "Visual direction:", "Dirección visual:")}</strong> {post.visualDirection}
        </div>

        <div className="flex flex-col gap-2">
          {isImageFormat ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/8 px-3 py-2.5 text-xs text-red-400">
              <p className="font-semibold">{t("Rascunho SVG não pode ser publicado", "SVG drafts cannot be published", "No se pueden publicar borradores SVG")}</p>
              <p className="text-red-400/70 mt-0.5">{t('Instagram e TikTok rejeitam SVG. Use "Tentar gerar imagem novamente" ou faça upload de uma imagem real via "Fazer Upload".', 'Instagram and TikTok do not accept SVGs. Choose "Try generating the image again" or upload a real image.', 'Instagram y TikTok no admiten SVG. Elige "Intentar generar otra imagen" o sube una imagen real.')}</p>
            </div>
          ) : (
            <Button onClick={onGenerateVideo} disabled={busy} className="w-full">
              {busy
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("Iniciando geração de vídeo...", "Starting video generation...", "Iniciando la generación del vídeo...")}</>
                : <><Video className="mr-2 h-4 w-4" /> {t("Continuar e Gerar Vídeo", "Continue and Generate Video", "Continuar y generar vídeo")}</>}
            </Button>
          )}
          <Button variant="outline" onClick={onReset} disabled={busy} className="w-full text-xs">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> {isImageFormat ? t("Tentar gerar imagem novamente", "Try generating the image again", "Intentar generar otra imagen") : t("Regenerar storyboard com IA", "Regenerate storyboard with AI", "Regenerar el guion gráfico con IA")}
          </Button>
        </div>
        {!isImageFormat && (
          <p className="text-center text-xs text-muted-foreground">
            {hasAvatar ? t("O vídeo usará seu clone digital e voz clonada.", "The video will use your digital clone and cloned voice.", "El vídeo usará tu clon digital y tu voz clonada.") : t("Configure seu clone digital em Configurações para aparecer no vídeo.", "Set up your digital clone in Settings to appear in the video.", "Configura tu clon digital en Ajustes para aparecer en el vídeo.")}
          </p>
        )}
      </div>
    );
  }

  // Step: Gerando vídeo
  if (step === "video_generating") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <div className="relative">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <Video className="absolute inset-0 m-auto h-4 w-4 text-primary/60" />
        </div>
        <p className="text-sm font-medium">{t("Gerando vídeo…", "Generating video…", "Generando vídeo…")}</p>
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          {t("A renderização do vídeo pode levar 2–5 minutos dependendo do provedor. Pode fechar este painel — o processo continua em background.", "Video rendering may take 2–5 minutes depending on the provider. You can close this panel — the process continues in the background.", "El renderizado puede tardar entre 2 y 5 minutos, según el proveedor. Puedes cerrar este panel: el proceso continuará en segundo plano.")}
        </p>
        <p className="text-[11px] text-muted-foreground/50">
          {t("Provedor:", "Provider:", "Proveedor:")} {post.mediaJobProvider ?? t("processando…", "processing…", "procesando…")}
        </p>
      </div>
    );
  }

  // Step: Vídeo pronto — aprovação final
  if (step === "video_ready") {
    const videoUrl = post.mediaUrls?.[0];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {["Roteiro", "Storyboard"].map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className="rounded-full border border-green-500/50 bg-green-500/10 text-green-400 w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0">✓</span>
              <span className="opacity-50">{s}</span>
              <ArrowRight className="h-3 w-3 shrink-0 opacity-50" />
            </span>
          ))}
          <span className="rounded-full bg-primary w-5 h-5 flex items-center justify-center text-[10px] text-primary-foreground font-bold shrink-0">3</span>
          <span className="font-medium text-foreground">{t("Vídeo Pronto", "Video Ready", "Vídeo listo")}</span>
        </div>

        {videoUrl ? (
          <div className="rounded-xl border border-border overflow-hidden bg-black">
            <video
              src={videoUrl}
              controls
              className="w-full max-h-80"
              playsInline
            />
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-green-500/20 bg-green-500/5 h-32">
            <CheckCircle2 className="h-8 w-8 text-green-400" />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button onClick={onConfirmVideo} disabled={busy} className="w-full">
            {busy
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("Confirmando...", "Confirming...", "Confirmando...")}</>
              : <><CheckCircle2 className="mr-2 h-4 w-4" /> {t("Usar este vídeo no post", "Use this video in the post", "Usar este vídeo en la publicación")}</>}
          </Button>
          <Button variant="outline" onClick={onReset} disabled={busy} className="w-full text-xs">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> {t("Regenerar do início", "Regenerate from the beginning", "Regenerar desde el principio")}
          </Button>
        </div>
      </div>
    );
  }

  // Step: Falhou — mas preserva a thumbnail se ela existir
  if (step === "failed") {
    const hasThumbnail = !!post.storyboardUrls?.[0];
    return (
      <div className="space-y-4">
        {/* Thumbnail preservada — não perde o trabalho já feito */}
        {hasThumbnail && (
          <div className="space-y-2">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{t("Thumbnail gerada", "Generated thumbnail", "Miniatura generada")}</p>
            <div className="rounded-xl border border-border overflow-hidden bg-background/50">
              <img
                src={post.storyboardUrls![0]}
                alt={t("Thumbnail", "Thumbnail", "Miniatura")}
                className="w-full object-cover max-h-80"
              />
            </div>
          </div>
        )}

        <div className="rounded-xl border border-destructive/30 bg-destructive/8 p-4 text-sm">
          <p className="font-medium text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {t("Geração de vídeo falhou", "Video generation failed", "Falló la generación del vídeo")}
          </p>
          {post.errorMessage && (
            <p className="mt-2 text-xs text-muted-foreground">{post.errorMessage}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {/* Se tem thumbnail e é reel, pode tentar gerar vídeo novamente com avatar */}
          {hasThumbnail && !isImageFormat && (
            <Button onClick={onGenerateVideo} disabled={busy} className="w-full">
              {busy
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("Iniciando...", "Starting...", "Iniciando...")}</>
                : <><Video className="mr-2 h-4 w-4" />{t("Tentar gerar vídeo novamente", "Try generating the video again", "Intentar generar el vídeo de nuevo")}</>}
            </Button>
          )}
          {/* Se tem thumbnail e é formato de imagem, pode aprovar direto */}
          {hasThumbnail && isImageFormat && (
            <Button onClick={onApproveImage} disabled={busy} className="w-full">
              {busy
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("Aprovando...", "Approving...", "Aprobando...")}</>
                : <><CheckCircle2 className="mr-2 h-4 w-4" />{t("Usar esta thumbnail no post", "Use this thumbnail in the post", "Usar esta miniatura en la publicación")}</>}
            </Button>
          )}
          <Button variant="outline" onClick={onReset} disabled={busy} className="w-full text-xs">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> {t("Refazer do zero", "Start over", "Empezar de nuevo")}
          </Button>
        </div>

        {hasThumbnail && !isImageFormat && (
          <p className="text-center text-xs text-muted-foreground">
            {hasAvatar
              ? t("Avatar HeyGen configurado — clique acima para gerar o vídeo com seu avatar.", "HeyGen avatar configured — click above to generate the video with your avatar.", "Avatar de HeyGen configurado: haz clic arriba para generar el vídeo con tu avatar.")
              : t("Configure um avatar HeyGen na seção acima para gerar o vídeo.", "Set up a HeyGen avatar in the section above to generate the video.", "Configura un avatar de HeyGen en la sección de arriba para generar el vídeo.")}
          </p>
        )}
      </div>
    );
  }

  // Estado indefinido → volta ao início
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <Film className="h-8 w-8 text-primary/50" />
      <p className="text-sm text-muted-foreground">{t("Pronto para produzir a mídia deste post.", "Ready to produce media for this post.", "Listo para producir contenido multimedia para esta publicación.")}</p>
      <Button onClick={onReset} variant="outline" className="mt-2">
        <Wand2 className="mr-2 h-4 w-4" /> {t("Começar produção", "Start production", "Empezar la producción")}
      </Button>
    </div>
  );
}

function CarouselEditor({
  urls,
  onUpdate,
}: {
  urls: string[];
  onUpdate: (urls: string[]) => void;
}) {
  const t = useUiText();
  const [activeIndex, setActiveIndex] = useState(0);

  if (!urls.length) return null;

  const currentUrl = urls[activeIndex];

  const handleRemove = (index: number) => {
    const next = [...urls];
    next.splice(index, 1);
    if (activeIndex >= next.length) {
      setActiveIndex(Math.max(0, next.length - 1));
    }
    onUpdate(next);
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= urls.length) return;
    const next = [...urls];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    if (activeIndex === index) setActiveIndex(nextIndex);
    else if (activeIndex === nextIndex) setActiveIndex(index);
    onUpdate(next);
  };

  return (
    <div className="space-y-3">
      {/* Main Preview */}
      <div className="rounded-xl border border-border overflow-hidden bg-black/50 relative aspect-[4/5] sm:aspect-video flex items-center justify-center">
        <img
          src={currentUrl}
          alt={`${t("Slide", "Slide", "Diapositiva")} ${activeIndex + 1}`}
          className="w-full h-full object-contain"
        />
        <div className="absolute top-3 left-3 bg-black/60 text-white text-xs font-mono px-2 py-1 rounded-md backdrop-blur-sm">
          {activeIndex + 1} / {urls.length}
        </div>

        {urls.length > 1 && (
          <>
            <button
              onClick={() => setActiveIndex(prev => Math.max(0, prev - 1))}
              disabled={activeIndex === 0}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm transition-colors"
            >
              <ArrowRight className="h-4 w-4 rotate-180" />
            </button>
            <button
              onClick={() => setActiveIndex(prev => Math.min(urls.length - 1, prev + 1))}
              disabled={activeIndex === urls.length - 1}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm transition-colors"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails Row */}
      <div className="flex gap-2 overflow-x-auto pb-2 snap-x hide-scrollbar">
        {urls.map((url, i) => (
          <div
            key={url + i}
            className={`relative w-20 h-20 shrink-0 rounded-lg overflow-hidden border-2 snap-start group cursor-pointer transition-colors ${
              i === activeIndex ? "border-primary" : "border-transparent hover:border-primary/50"
            }`}
            onClick={() => setActiveIndex(i)}
          >
            <img src={url} alt={`${t("Miniatura", "Thumbnail", "Miniatura")} ${i + 1}`} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              <button
                className="w-5 h-5 rounded bg-black/80 hover:bg-primary flex items-center justify-center text-white disabled:opacity-30"
                onClick={(e) => { e.stopPropagation(); handleMove(i, -1); }}
                disabled={i === 0}
              >
                <ArrowRight className="h-3 w-3 rotate-180" />
              </button>
              <button
                className="w-5 h-5 rounded bg-destructive/80 hover:bg-destructive flex items-center justify-center text-white"
                onClick={(e) => { e.stopPropagation(); handleRemove(i); }}
              >
                <X className="h-3 w-3" />
              </button>
              <button
                className="w-5 h-5 rounded bg-black/80 hover:bg-primary flex items-center justify-center text-white disabled:opacity-30"
                onClick={(e) => { e.stopPropagation(); handleMove(i, 1); }}
                disabled={i === urls.length - 1}
              >
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <div className="absolute top-1 left-1 bg-black/80 text-white text-[9px] px-1 rounded">
              {i + 1}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Upload Tab ───────────────────────────────────────────────────────────────

function UploadTabContent({
  selectedFile,
  previewUrl,
  uploading,
  uploadDone,
  uploadedMediaUrl,
  fileInputRef,
  onFileSelect,
  onUpload,
  onClose,
  onUploadAnother,
}: {
  selectedFile: File | null;
  previewUrl: string | null;
  uploading: boolean;
  uploadDone: boolean;
  uploadedMediaUrl: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (file: File) => void;
  onUpload: () => void;
  onClose: () => void;
  onUploadAnother: () => void;
}) {
  const t = useUiText();
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  };

  const isVideo = selectedFile?.type.startsWith("video/");
  const uploadedIsVideo = uploadedMediaUrl && /\.(mp4|mov|webm)(\?|$)/i.test(uploadedMediaUrl);

  // ── Upload success state ──────────────────────────────────────────────────
  if (uploadDone) {
    return (
      <div className="space-y-4">
        {/* Success header */}
        <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/8 px-3 py-2.5 text-sm text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="font-medium">{t("Mídia salva no post com sucesso!", "Media saved to the post successfully!", "¡Contenido multimedia guardado correctamente en la publicación!")}</span>
        </div>

        {/* Preview of what was saved */}
        {uploadedMediaUrl && (
          <div className="rounded-xl overflow-hidden border border-border bg-black">
            {uploadedIsVideo ? (
              <video
                src={uploadedMediaUrl}
                className="w-full max-h-72 object-contain"
                controls
                playsInline
              />
            ) : (
              <img
                src={uploadedMediaUrl}
                alt={t("Mídia salva", "Saved media", "Contenido multimedia guardado")}
                className="w-full max-h-72 object-contain"
              />
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onUploadAnother}>
            <Upload className="mr-2 h-4 w-4" /> {t("Trocar arquivo", "Replace file", "Cambiar archivo")}
          </Button>
          <Button className="flex-1" onClick={onClose}>
            <CheckCircle2 className="mr-2 h-4 w-4" /> {t("Fechar e revisar", "Close and review", "Cerrar y revisar")}
          </Button>
        </div>
        <p className="text-center text-[11px] text-muted-foreground">
          {t('A mídia foi salva. Clique em "Publicar Agora" no post para confirmar a publicação.', 'Media has been saved. Click "Publish Now" on the post to confirm publication.', 'El contenido multimedia se guardó. Haz clic en "Publicar ahora" en la publicación para confirmar.') }
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("Envie uma imagem ou vídeo próprio para usar neste post. Formatos aceitos: JPG, PNG, WEBP, GIF, MP4, MOV.", "Upload your own image or video to use in this post. Accepted formats: JPG, PNG, WEBP, GIF, MP4, MOV.", "Sube tu propia imagen o vídeo para usarlo en esta publicación. Formatos admitidos: JPG, PNG, WEBP, GIF, MP4, MOV.")}
      </p>

      {/* Drop zone */}
      <div
        className="relative rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer overflow-hidden"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {previewUrl ? (
          <div className="relative">
            {isVideo ? (
              <video src={previewUrl} className="w-full max-h-64 object-contain bg-black" controls playsInline />
            ) : (
              <img src={previewUrl} alt={t("Prévia", "Preview", "Vista previa")} className="w-full max-h-64 object-contain" />
            )}
            <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
              <p className="text-white text-sm font-medium">{t("Clique para trocar", "Click to replace", "Haz clic para cambiar")}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center px-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{t("Arraste e solte ou clique para selecionar", "Drag and drop or click to select", "Arrastra y suelta o haz clic para seleccionar")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("Imagens e vídeos até 200 MB", "Images and videos up to 200 MB", "Imágenes y vídeos de hasta 200 MB")}</p>
            </div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,video/mp4,video/quicktime"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f); }}
        />
      </div>

      {selectedFile && (
        <div className="rounded-lg border border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
          {isVideo ? <Video className="h-3.5 w-3.5 shrink-0" /> : <ImageIcon className="h-3.5 w-3.5 shrink-0" />}
          <span className="flex-1 truncate">{selectedFile.name}</span>
          <span className="shrink-0">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</span>
        </div>
      )}

      <Button
        onClick={onUpload}
        disabled={!selectedFile || uploading}
        className="w-full"
      >
        {uploading
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("Enviando…", "Uploading…", "Subiendo…")}</>
          : <><CheckCircle2 className="mr-2 h-4 w-4" /> {t("Usar esta mídia no post", "Use this media in the post", "Usar este contenido multimedia en la publicación")}</>}
      </Button>
    </div>
  );
}
