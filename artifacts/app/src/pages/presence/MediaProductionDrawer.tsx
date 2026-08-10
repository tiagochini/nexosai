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
import {
  X, Sparkles, Upload, Loader2, AlertTriangle, Film,
  RefreshCw, CheckCircle2, Video, ImageIcon, User,
  ArrowRight, Play, Wand2, PenLine, Settings, Clapperboard, Users,
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
  const [tab, setTab] = useState<"ai" | "upload">("ai");
  const [currentPost, setCurrentPost] = useState(initialPost);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [editedDirection, setEditedDirection] = useState(initialPost.visualDirection);
  const [editedScript, setEditedScript] = useState(initialPost.videoScript ?? "");
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
          }),
        },
      );
      updatePost(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro ao gerar storyboard.");
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
      setActionError(err instanceof Error ? err.message : "Erro ao gerar vídeo.");
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
      setActionError(err instanceof Error ? err.message : "Erro ao aprovar imagem.");
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
      setActionError(err instanceof Error ? err.message : "Erro ao confirmar vídeo.");
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
        const err = (await res.json().catch(() => ({ error: "Erro ao fazer upload." }))) as { error?: string };
        throw new Error(err.error ?? "Erro ao fazer upload.");
      }
      const { post: updated } = (await res.json()) as { post: MediaPresencePost };
      updatePost(updated);
      setUploadedMediaUrl(updated.mediaUrls?.[0] ?? previewUrl);
      setUploadDone(true);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro ao fazer upload.");
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
      setActionError(err instanceof Error ? err.message : "Erro ao salvar avatar.");
    } finally {
      setSavingAvatar(false);
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
              Produção de Mídia
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
              {currentPost.platform} · {currentPost.format} · {currentPost.caption.slice(0, 60)}
              {currentPost.caption.length > 60 ? "…" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar produção de mídia"
            className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          {[
            { id: "ai" as const, label: "Gerar com IA", icon: Sparkles },
            { id: "upload" as const, label: "Fazer Upload", icon: Upload },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-5 py-2.5 text-sm border-b-2 transition-colors ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
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
              onEditDirection={setEditedDirection}
              onEditScript={setEditedScript}
              onChangeStoryMediaType={changeStoryMediaType}
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
  onEditDirection,
  onEditScript,
  onChangeStoryMediaType,
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
  onEditDirection: (v: string) => void;
  onEditScript: (v: string) => void;
  onChangeStoryMediaType: (type: "image" | "video") => void;
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
  const step = post.mediaGenStatus;
  // Formats that produce a final image (not video).
  // Stories can be either image or video — decided by storyMediaType.
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
          <span>Clone digital configurado — o vídeo usará seu avatar e voz clonada.</span>
        </div>
      );
    }
    // No avatar: show 3 options side-by-side
    return (
      <div className="space-y-2">
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Como gerar o vídeo</p>
        <div className="grid grid-cols-3 gap-2">
          {/* Option 1 — Cinematic (requires Runway / FAL video provider) */}
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-2.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <Clapperboard className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-[10px] font-bold text-primary">Cinematográfico</span>
            </div>
            <p className="text-[9px] text-muted-foreground leading-tight">
              Vídeo sem apresentador. Requer provedor de vídeo (Runway / FAL) configurado.
            </p>
            <span className="text-[9px] text-primary/70 font-medium mt-auto">✓ Padrão selecionado</span>
          </div>

          {/* Option 2 — HeyGen stock avatar */}
          <button
            type="button"
            onClick={onOpenAvatarSelector}
            className={`rounded-lg border p-2.5 flex flex-col gap-1.5 transition-colors text-left ${hasAvatar && persona?.avatarType === "stock" ? "border-green-500/50 bg-green-500/5" : "border-border/50 bg-background/40 hover:border-border hover:bg-background/70"}`}
          >
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-[10px] font-bold text-foreground">Avatar HeyGen</span>
            </div>
            <p className="text-[9px] text-muted-foreground leading-tight">
              +1.000 avatares profissionais da biblioteca HeyGen.
            </p>
            <span className={`text-[9px] mt-auto font-medium ${hasAvatar && persona?.avatarType === "stock" ? "text-green-400" : "text-primary/70"}`}>
              {hasAvatar && persona?.avatarType === "stock" ? "✓ Configurado" : "Selecionar →"}
            </span>
          </button>

          {/* Option 3 — Personal clone */}
          <a
            href="/video-production?setup=avatar"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-border/50 bg-background/40 hover:border-border hover:bg-background/70 p-2.5 flex flex-col gap-1.5 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-[10px] font-bold text-foreground">Meu Clone</span>
            </div>
            <p className="text-[9px] text-muted-foreground leading-tight">
              Seu rosto e voz clonada em cada vídeo.
            </p>
            <span className="text-[9px] text-muted-foreground/60 mt-auto">Configurar →</span>
          </a>
        </div>

        {/* Inline avatar + voice selector */}
        {showAvatarSelector && (
          <div className="border border-border/60 rounded-xl bg-background/60 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-mono font-bold">Selecionar avatar e voz</p>
              <button type="button" onClick={onCloseAvatarSelector} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {avatarSelectorLoading ? (
              <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Carregando avatares...</span>
              </div>
            ) : (
              <>
                {/* Avatar grid */}
                <div>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">Avatar</p>
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
                        {selectedAvatarId === av.id && <span className="text-[9px] text-primary font-medium">✓ Selecionado</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Voice selector */}
                {heygenVoices.length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">Voz para narração</p>
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
                  {savingAvatar ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Salvando...</> : <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Confirmar avatar e voz</>}
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
            <p className="text-xs font-medium text-muted-foreground">Tipo de Story</p>
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
                <ImageIcon className="h-3.5 w-3.5" /> Imagem
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
                <Video className="h-3.5 w-3.5" /> Vídeo
              </button>
            </div>
          </div>
        )}

        {!isImageFormat && <AvatarBanner />}

        {/* Pipeline steps indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-primary w-5 h-5 flex items-center justify-center text-[10px] text-primary-foreground font-bold shrink-0">1</span>
          <span className="font-medium text-foreground">Direção Visual</span>
          <ArrowRight className="h-3 w-3 shrink-0" />
          <span className="opacity-50 flex items-center gap-1"><span className="rounded-full border border-border w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0">2</span>{isImageFormat ? "Imagem" : "Storyboard"}</span>
          {!isImageFormat && <>
            <ArrowRight className="h-3 w-3 shrink-0 opacity-50" />
            <span className="opacity-50 flex items-center gap-1"><span className="rounded-full border border-border w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>Vídeo</span>
          </>}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Direção Visual
            </label>
            <textarea
              className="w-full rounded-lg border border-border bg-background/80 p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
              rows={4}
              value={editedDirection}
              onChange={(e) => onEditDirection(e.target.value)}
              placeholder="Descreva a cena: cenário, iluminação, personagens, elementos visuais, emoção..."
            />
          </div>

          {/* Script field: show for reel, or video-mode story, or when there's an existing script */}
          {(post.format === "reel" || (post.format === "story" && !isImageFormat) || post.videoScript) && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Roteiro / Narração (opcional)
              </label>
              <textarea
                className="w-full rounded-lg border border-border bg-background/80 p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                rows={4}
                value={editedScript}
                onChange={(e) => onEditScript(e.target.value)}
                placeholder="Texto falado no vídeo — se vazio, o título do post é usado."
              />
            </div>
          )}
        </div>

        <Button onClick={onGenerateStoryboard} disabled={busy || !editedDirection.trim()} className="w-full">
          {busy
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando imagem...</>
            : <><Wand2 className="mr-2 h-4 w-4" /> {isImageFormat ? "Gerar Imagem com IA" : "Gerar Storyboard (baixa resolução)"}</>}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {isImageFormat
            ? "A IA gera a imagem final baseada na sua direção visual. Você aprova antes de publicar."
            : "A IA cria um storyboard de baixa resolução para aprovação antes de gerar o vídeo final."}
        </p>
      </div>
    );
  }

  // Step: Gerando storyboard
  if (step === "storyboard_generating") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-medium">Gerando storyboard…</p>
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          A IA está criando o frame visual em baixa resolução baseado na sua direção. Leva ~30 segundos.
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
          <span className="opacity-50">Direção Visual</span>
          <ArrowRight className="h-3 w-3 shrink-0" />
          <span className="rounded-full bg-primary w-5 h-5 flex items-center justify-center text-[10px] text-primary-foreground font-bold shrink-0">2</span>
          <span className="font-medium text-foreground">{isImageFormat ? "Imagem Gerada" : "Storyboard"}</span>
          {!isImageFormat && <>
            <ArrowRight className="h-3 w-3 shrink-0 opacity-50" />
            <span className="opacity-50 flex items-center gap-1"><span className="rounded-full border border-border w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>Vídeo</span>
          </>}
        </div>

        <div className="rounded-xl border border-border overflow-hidden bg-background/50">
          {post.storyboardUrls?.[0] ? (
            <img
              src={post.storyboardUrls[0]}
              alt={isImageFormat ? "Imagem gerada pela IA" : "Storyboard preview"}
              className="w-full object-cover max-h-80"
            />
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              <ImageIcon className="h-8 w-8 opacity-40" />
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-background/40 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Direção visual:</strong> {post.visualDirection}
        </div>

        <div className="flex flex-col gap-2">
          {isImageFormat ? (
            <Button onClick={onApproveImage} disabled={busy} className="w-full">
              {busy
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando imagem...</>
                : <><CheckCircle2 className="mr-2 h-4 w-4" /> Usar esta imagem no post</>}
            </Button>
          ) : (
            <Button onClick={onGenerateVideo} disabled={busy} className="w-full">
              {busy
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Iniciando geração de vídeo...</>
                : <><Video className="mr-2 h-4 w-4" /> Aprovar e Gerar Vídeo</>}
            </Button>
          )}
          <Button variant="outline" onClick={onReset} disabled={busy} className="w-full text-xs">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Editar direção e {isImageFormat ? "gerar nova imagem" : "regenerar storyboard"}
          </Button>
        </div>
        {!isImageFormat && (
          <p className="text-center text-xs text-muted-foreground">
            {hasAvatar
              ? "O vídeo usará seu clone digital e voz clonada."
              : "Vídeo cinematográfico por IA — configure avatar HeyGen ou clone próprio para aparecer nos vídeos."}
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
          <span className="opacity-50">Direção Visual</span>
          <ArrowRight className="h-3 w-3 shrink-0" />
          <span className="rounded-full bg-amber-500 w-5 h-5 flex items-center justify-center text-[10px] text-white font-bold shrink-0">2</span>
          <span className="font-medium text-amber-400">Rascunho</span>
          {!isImageFormat && <>
            <ArrowRight className="h-3 w-3 shrink-0 opacity-50" />
            <span className="opacity-50 flex items-center gap-1"><span className="rounded-full border border-border w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>Vídeo</span>
          </>}
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/8 px-3 py-2.5 text-xs text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">
              {isImageFormat ? "Rascunho visual — clique em Regenerar para gerar a imagem final" : "Rascunho visual — clique em Regenerar para gerar a imagem final"}
            </p>
            <p className="text-amber-300/70 mt-0.5">
              {"Este é um esboço com os textos do post. Clique em Regenerar para gerar a imagem real com IA (gpt-image-1.5)."}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-400/20 overflow-hidden bg-background/50">
          {post.storyboardUrls?.[0] ? (
            <img
              src={post.storyboardUrls[0]}
              alt="Rascunho"
              className="w-full object-cover max-h-80"
            />
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              <ImageIcon className="h-8 w-8 opacity-40" />
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-background/40 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Direção visual:</strong> {post.visualDirection}
        </div>

        <div className="flex flex-col gap-2">
          {isImageFormat ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/8 px-3 py-2.5 text-xs text-red-400">
              <p className="font-semibold">Rascunho SVG não pode ser publicado</p>
              <p className="text-red-400/70 mt-0.5">Instagram e TikTok rejeitam SVG. Use "Tentar gerar imagem novamente" ou faça upload de uma imagem real via "Fazer Upload".</p>
            </div>
          ) : (
            <Button onClick={onGenerateVideo} disabled={busy} className="w-full">
              {busy
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Iniciando geração de vídeo...</>
                : <><Video className="mr-2 h-4 w-4" /> Continuar e Gerar Vídeo</>}
            </Button>
          )}
          <Button variant="outline" onClick={onReset} disabled={busy} className="w-full text-xs">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> {isImageFormat ? "Tentar gerar imagem novamente" : "Regenerar storyboard com IA"}
          </Button>
        </div>
        {!isImageFormat && (
          <p className="text-center text-xs text-muted-foreground">
            {hasAvatar ? "O vídeo usará seu clone digital e voz clonada." : "Configure seu clone digital em Configurações para aparecer no vídeo."}
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
        <p className="text-sm font-medium">Gerando vídeo…</p>
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          A renderização do vídeo pode levar 2–5 minutos dependendo do provedor.
          Pode fechar este painel — o processo continua em background.
        </p>
        <p className="text-[11px] text-muted-foreground/50">
          Provedor: {post.mediaJobProvider ?? "processando…"}
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
          <span className="font-medium text-foreground">Vídeo Pronto</span>
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
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirmando...</>
              : <><CheckCircle2 className="mr-2 h-4 w-4" /> Usar este vídeo no post</>}
          </Button>
          <Button variant="outline" onClick={onReset} disabled={busy} className="w-full text-xs">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Regenerar do início
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
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Thumbnail gerada</p>
            <div className="rounded-xl border border-border overflow-hidden bg-background/50">
              <img
                src={post.storyboardUrls![0]}
                alt="Thumbnail"
                className="w-full object-cover max-h-80"
              />
            </div>
          </div>
        )}

        <div className="rounded-xl border border-destructive/30 bg-destructive/8 p-4 text-sm">
          <p className="font-medium text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" /> Geração de vídeo falhou
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
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Iniciando...</>
                : <><Video className="mr-2 h-4 w-4" />Tentar gerar vídeo novamente</>}
            </Button>
          )}
          {/* Se tem thumbnail e é formato de imagem, pode aprovar direto */}
          {hasThumbnail && isImageFormat && (
            <Button onClick={onApproveImage} disabled={busy} className="w-full">
              {busy
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Aprovando...</>
                : <><CheckCircle2 className="mr-2 h-4 w-4" />Usar esta thumbnail no post</>}
            </Button>
          )}
          <Button variant="outline" onClick={onReset} disabled={busy} className="w-full text-xs">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refazer do zero
          </Button>
        </div>

        {hasThumbnail && !isImageFormat && (
          <p className="text-center text-xs text-muted-foreground">
            {hasAvatar
              ? "Avatar HeyGen configurado — clique acima para gerar o vídeo com seu avatar."
              : "Configure um avatar HeyGen na seção acima para gerar o vídeo."}
          </p>
        )}
      </div>
    );
  }

  // Estado indefinido → volta ao início
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <Film className="h-8 w-8 text-primary/50" />
      <p className="text-sm text-muted-foreground">Pronto para produzir a mídia deste post.</p>
      <Button onClick={onReset} variant="outline" className="mt-2">
        <Wand2 className="mr-2 h-4 w-4" /> Começar produção
      </Button>
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
          <span className="font-medium">Mídia salva no post com sucesso!</span>
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
                alt="Mídia salva"
                className="w-full max-h-72 object-contain"
              />
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onUploadAnother}>
            <Upload className="mr-2 h-4 w-4" /> Trocar arquivo
          </Button>
          <Button className="flex-1" onClick={onClose}>
            <CheckCircle2 className="mr-2 h-4 w-4" /> Fechar e revisar
          </Button>
        </div>
        <p className="text-center text-[11px] text-muted-foreground">
          A mídia foi salva. Clique em "Publicar Agora" no post para confirmar a publicação.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Envie uma imagem ou vídeo próprio para usar neste post. Formatos aceitos: JPG, PNG, WEBP, GIF, MP4, MOV.
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
              <img src={previewUrl} alt="Preview" className="w-full max-h-64 object-contain" />
            )}
            <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
              <p className="text-white text-sm font-medium">Clique para trocar</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center px-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Arraste e solte ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground mt-1">Imagens e vídeos até 200 MB</p>
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
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…</>
          : <><CheckCircle2 className="mr-2 h-4 w-4" /> Usar esta mídia no post</>}
      </Button>
    </div>
  );
}
