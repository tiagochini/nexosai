import { useEffect, useRef, useState } from "react";
import { useEditor } from "../hooks/useEditorState";
import { Asset } from "../domain/editor";
import { videoEditorClient } from "../lib/video-editor-client";
import { Loader2 } from "lucide-react";

export function Monitor({ projectId, assets }: { projectId: string, assets: Asset[] }) {
  const { state, dispatch } = useEditor();
  const { playheadMs, isPlaying, playbackRate, items } = state;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeAsset, setActiveAsset] = useState<Asset | null>(null);
  
  const mediaUrlsRef = useRef<Map<string, string>>(new Map());
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [currentSrc, setCurrentSrc] = useState<string>("");

  const lastUpdateRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      mediaUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      mediaUrlsRef.current.clear();
    };
  }, []);

  // Determine which item is visible at playhead (top-most video track)
  useEffect(() => {
    const activeItem = items
      .filter(i => i.startMs <= playheadMs && i.startMs + i.durationMs > playheadMs)
      .sort((a, b) => a.position - b.position)[0];
    
    if (activeItem) {
      const asset = assets.find(a => a.id === activeItem.assetId);
      setActiveAsset(asset || null);
      
      if (asset) {
        if (!mediaUrlsRef.current.has(asset.id) && !loadingMedia) {
          setLoadingMedia(true);
          setMediaError(null);
          videoEditorClient.getAssetMedia(projectId, asset.id)
            .then(blob => {
              const url = URL.createObjectURL(blob);
              mediaUrlsRef.current.set(asset.id, url);
              setCurrentSrc(url);
            })
            .catch(err => {
              setMediaError(err.message || "Failed to load media");
            })
            .finally(() => {
              setLoadingMedia(false);
            });
        } else if (mediaUrlsRef.current.has(asset.id)) {
          const url = mediaUrlsRef.current.get(asset.id)!;
          if (currentSrc !== url) setCurrentSrc(url);
        }

        // compute local time
        const localTimeS = (activeItem.trimStartMs + (playheadMs - activeItem.startMs)) / 1000;
        if (videoRef.current && Math.abs(videoRef.current.currentTime - localTimeS) > 0.1 && (!isPlaying || playbackRate !== 1)) {
          videoRef.current.currentTime = localTimeS;
        }
      }
    } else {
      setActiveAsset(null);
      setCurrentSrc("");
    }
  }, [playheadMs, items, assets, isPlaying, projectId, currentSrc, loadingMedia, playbackRate]);

  // Playback loop
  useEffect(() => {
    if (isPlaying) {
      lastUpdateRef.current = performance.now();
      const loop = (time: number) => {
        const delta = time - lastUpdateRef.current;
        lastUpdateRef.current = time;
        dispatch({ type: "ADVANCE_PLAYHEAD", payload: delta * playbackRate });
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
      if (videoRef.current) {
        if (playbackRate === 1) {
          videoRef.current.play().catch(() => {});
        } else {
          videoRef.current.pause();
        }
      }
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (videoRef.current) videoRef.current.pause();
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, playbackRate, dispatch]);

  return (
    <div className="flex-1 flex flex-col bg-background border-l border-b border-border/50 shadow-inner relative overflow-hidden">
      <div className="h-10 border-b border-border/50 flex items-center px-4 justify-between bg-muted/20 shrink-0 z-10">
        <span className="text-xs font-semibold text-foreground/80 tracking-wide uppercase">Monitor</span>
        <div className="font-mono text-sm font-medium text-primary">
          {formatTimeCode(playheadMs)}
        </div>
      </div>
      <div className="flex-1 bg-black/90 p-4 flex items-center justify-center relative shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]">
        {loadingMedia && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
        {mediaError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
            <span className="text-sm font-semibold text-destructive">{mediaError}</span>
          </div>
        )}
        {activeAsset && currentSrc ? (
          <video
            ref={videoRef}
            src={currentSrc}
            className="max-w-full max-h-full shadow-2xl rounded ring-1 ring-white/10"
            muted={false} // maybe add global mute
            controls={false}
          />
        ) : (
          <div className="text-muted-foreground/30 flex flex-col items-center gap-2">
            <div className="w-16 h-16 border-2 border-dashed border-current rounded flex items-center justify-center">
              <span className="text-xl">!</span>
            </div>
            <span className="text-xs tracking-widest uppercase">No Media</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function formatTimeCode(ms: number) {
  const d = new Date(ms);
  const h = d.getUTCHours().toString().padStart(2, "0");
  const m = d.getUTCMinutes().toString().padStart(2, "0");
  const s = d.getUTCSeconds().toString().padStart(2, "0");
  const frames = Math.floor((ms % 1000) / (1000/30)).toString().padStart(2, "0"); // assuming 30fps
  return `${h}:${m}:${s}:${frames}`;
}
