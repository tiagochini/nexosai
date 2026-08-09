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
  ArrowRight, Play, Wand2, PenLine, Settings,
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
}

interface Persona {
  heygenAvatarId?: string;
  voiceCloneId?: string;
  avatarType?: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MediaProductionDrawer({
  post: initialPost,
  onClose,
  onPostUpdated,
  onPublishNow,
}: {
  post: MediaPresencePost;
  onClose: () => void;
  onPostUpdated: (post: MediaPresencePost) => void;
  onPublishNow?: (postId: string) => void;
}) {
  const [tab, setTab] = useState<"ai" | "upload">("ai");
  const [currentPost, setCurrentPost] = useState(initialPost);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [editedDirection, setEditedDirection] = useState(initialPost.visualDirection);
  const [editedScript, setEditedScript] = useState(initialPost.videoScript ?? "");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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

  const hasAvatar = !!(persona?.heygenAvatarId && persona?.voiceCloneId);

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
              onEditDirection={setEditedDirection}
              onEditScript={setEditedScript}
              onGenerateStoryboard={generateStoryboard}
              onGenerateVideo={generateVideo}
              onConfirmVideo={confirmVideo}
              onReset={resetPipeline}
              busy={busy}
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
              onPublishNow={onPublishNow ? () => { onClose(); onPublishNow(currentPost.id); } : undefined}
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
  onEditDirection,
  onEditScript,
  onGenerateStoryboard,
  onGenerateVideo,
  onConfirmVideo,
  onReset,
  busy,
}: {
  post: MediaPresencePost;
  persona: Persona | null;
  hasAvatar: boolean;
  editedDirection: string;
  editedScript: string;
  onEditDirection: (v: string) => void;
  onEditScript: (v: string) => void;
  onGenerateStoryboard: () => void;
  onGenerateVideo: () => void;
  onConfirmVideo: () => void;
  onReset: () => void;
  busy: boolean;
}) {
  const step = post.mediaGenStatus;

  // Avatar warning banner
  const AvatarBanner = () => {
    if (persona === null) return null; // still loading
    if (hasAvatar) {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2 text-xs text-green-400">
          <User className="h-3.5 w-3.5 shrink-0" />
          <span>Avatar e voz configurados — o vídeo usará seu clone digital.</span>
        </div>
      );
    }
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2.5 text-xs text-amber-300">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium">Avatar ou voz clone não configurados.</p>
          <p className="text-amber-300/70">
            O vídeo será gerado sem apresentador (cinematográfico). Para incluir o seu clone digital,{" "}
            <a href="/app/configuracoes" className="underline hover:text-amber-200">
              configure em Configurações → Clone Digital
            </a>
            .
          </p>
        </div>
      </div>
    );
  };

  // Step: Roteiro (início do pipeline)
  if (!step || step === "idle") {
    return (
      <div className="space-y-4">
        <AvatarBanner />

        {/* Pipeline steps indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-primary w-5 h-5 flex items-center justify-center text-[10px] text-primary-foreground font-bold shrink-0">1</span>
          <span className="font-medium text-foreground">Roteiro</span>
          <ArrowRight className="h-3 w-3 shrink-0" />
          <span className="opacity-50 flex items-center gap-1"><span className="rounded-full border border-border w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0">2</span>Storyboard</span>
          <ArrowRight className="h-3 w-3 shrink-0 opacity-50" />
          <span className="opacity-50 flex items-center gap-1"><span className="rounded-full border border-border w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>Vídeo</span>
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

          {(post.format === "reel" || post.format === "story" || post.videoScript) && (
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
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando storyboard...</>
            : <><Wand2 className="mr-2 h-4 w-4" /> Gerar Storyboard (baixa resolução)</>}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          A IA cria um storyboard de baixa resolução para aprovação antes de gerar o vídeo final.
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

  // Step: Storyboard pronto — aprovação
  if (step === "storyboard_ready") {
    return (
      <div className="space-y-4">
        <AvatarBanner />

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-green-500/50 bg-green-500/10 text-green-400 w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0">✓</span>
          <span className="opacity-50">Roteiro</span>
          <ArrowRight className="h-3 w-3 shrink-0" />
          <span className="rounded-full bg-primary w-5 h-5 flex items-center justify-center text-[10px] text-primary-foreground font-bold shrink-0">2</span>
          <span className="font-medium text-foreground">Storyboard</span>
          <ArrowRight className="h-3 w-3 shrink-0 opacity-50" />
          <span className="opacity-50 flex items-center gap-1"><span className="rounded-full border border-border w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>Vídeo</span>
        </div>

        <div className="rounded-xl border border-border overflow-hidden bg-background/50">
          {post.storyboardUrls?.[0] ? (
            <img
              src={post.storyboardUrls[0]}
              alt="Storyboard preview"
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
          <Button onClick={onGenerateVideo} disabled={busy} className="w-full">
            {busy
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Iniciando geração de vídeo...</>
              : <><Video className="mr-2 h-4 w-4" /> Aprovar e Gerar Vídeo</>}
          </Button>
          <Button variant="outline" onClick={onReset} disabled={busy} className="w-full text-xs">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Editar direção e regenerar storyboard
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {hasAvatar ? "O vídeo será gerado com o seu clone digital e voz clonada." : "O vídeo será gerado cinematograficamente. Configure seu clone digital para aparecer no vídeo."}
        </p>
      </div>
    );
  }

  // Step: Storyboard rascunho (SVG gerado sem crédito de IA)
  if (step === "storyboard_draft") {
    return (
      <div className="space-y-4">
        <AvatarBanner />

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-green-500/50 bg-green-500/10 text-green-400 w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0">✓</span>
          <span className="opacity-50">Roteiro</span>
          <ArrowRight className="h-3 w-3 shrink-0" />
          <span className="rounded-full bg-amber-500 w-5 h-5 flex items-center justify-center text-[10px] text-white font-bold shrink-0">2</span>
          <span className="font-medium text-amber-400">Rascunho</span>
          <ArrowRight className="h-3 w-3 shrink-0 opacity-50" />
          <span className="opacity-50 flex items-center gap-1"><span className="rounded-full border border-border w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>Vídeo</span>
        </div>

        {/* RASCUNHO notice */}
        <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/8 px-3 py-2.5 text-xs text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Storyboard gerado sem IA (créditos indisponíveis)</p>
            <p className="text-amber-300/70 mt-0.5">
              Este é um rascunho visual com os textos do post. Quando os créditos Gemini estiverem disponíveis,
              regenere para obter uma imagem gerada por IA.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-400/20 overflow-hidden bg-background/50">
          {post.storyboardUrls?.[0] ? (
            <img
              src={post.storyboardUrls[0]}
              alt="Rascunho do storyboard"
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
          <Button onClick={onGenerateVideo} disabled={busy} className="w-full">
            {busy
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Iniciando geração de vídeo...</>
              : <><Video className="mr-2 h-4 w-4" /> Continuar e Gerar Vídeo</>}
          </Button>
          <Button variant="outline" onClick={onReset} disabled={busy} className="w-full text-xs">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Regenerar storyboard com IA
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {hasAvatar ? "O vídeo usará seu clone digital e voz clonada." : "Configure seu clone digital em Configurações para aparecer no vídeo."}
        </p>
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

  // Step: Falhou
  if (step === "failed") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-destructive/30 bg-destructive/8 p-4 text-sm">
          <p className="font-medium text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" /> Geração falhou
          </p>
          {post.errorMessage && (
            <p className="mt-2 text-xs text-muted-foreground">{post.errorMessage}</p>
          )}
        </div>
        <Button variant="outline" onClick={onReset} className="w-full">
          <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
        </Button>
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
  onPublishNow,
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
  onPublishNow?: () => void;
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
        {onPublishNow ? (
          <div className="flex flex-col gap-2">
            <Button className="w-full" onClick={onPublishNow}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Publicar Agora
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 text-xs" onClick={onUploadAnother}>
                <Upload className="mr-1.5 h-3.5 w-3.5" /> Trocar arquivo
              </Button>
              <Button variant="ghost" className="flex-1 text-xs" onClick={onClose}>
                Salvar sem publicar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onUploadAnother}>
              <Upload className="mr-2 h-4 w-4" /> Trocar arquivo
            </Button>
            <Button className="flex-1" onClick={onClose}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Concluído
            </Button>
          </div>
        )}
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
