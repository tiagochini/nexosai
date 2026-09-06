import { useEffect, useRef, useState } from "react";
import { useEditor } from "../hooks/useEditorState";
import { Asset, Track, TimelineItem } from "../domain/editor";
import { cn } from "../lib/utils";

export function Timeline({ assets }: { assets: Asset[] }) {
  const { state, dispatch } = useEditor();
  const { tracks, items, playheadMs, zoomMsPerPixel, selectedItemIds } = state;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  
  // Dragging clips
  const [draggingItem, setDraggingItem] = useState<{ id: string, startX: number, originalStartMs: number, trackId: string } | null>(null);

  const handlePointerDownPlayhead = (e: React.PointerEvent) => {
    setIsDraggingPlayhead(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMovePlayhead = (e: React.PointerEvent) => {
    if (!isDraggingPlayhead || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left - 150);
    dispatch({ type: "SET_PLAYHEAD", payload: x * zoomMsPerPixel });
  };

  const handlePointerUpPlayhead = (e: React.PointerEvent) => {
    setIsDraggingPlayhead(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };
  
  const handlePointerDownItem = (e: React.PointerEvent, item: TimelineItem) => {
    e.stopPropagation();
    dispatch({ type: "SELECT_ITEM", payload: { id: item.id, multi: e.shiftKey || e.ctrlKey || e.metaKey } });
    setDraggingItem({ id: item.id, startX: e.clientX, originalStartMs: item.startMs, trackId: item.trackId });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const getSnapPoints = () => {
    return [
      playheadMs,
      ...items.flatMap(i => [i.startMs, i.startMs + i.durationMs])
    ];
  };

  const getSnappedTime = (targetMs: number) => {
    const snapPoints = getSnapPoints();
    const thresholdMs = 15 * zoomMsPerPixel; // 15px snap threshold
    let closest = targetMs;
    let minDiff = thresholdMs;
    
    for (const point of snapPoints) {
      const diff = Math.abs(targetMs - point);
      if (diff < minDiff) {
        minDiff = diff;
        closest = point;
      }
    }
    return closest;
  };

  const handlePointerMoveItem = (e: React.PointerEvent) => {
    if (!draggingItem) return;
    const deltaX = e.clientX - draggingItem.startX;
    const deltaMs = deltaX * zoomMsPerPixel;
    const targetMs = Math.max(0, draggingItem.originalStartMs + deltaMs);
    const snappedMs = getSnappedTime(targetMs);
    
    dispatch({
      type: "MOVE_ITEM",
      payload: { id: draggingItem.id, trackId: draggingItem.trackId, startMs: snappedMs }
    });
  };

  const [trimmingItem, setTrimmingItem] = useState<{ id: string, side: "left" | "right", startX: number, originalItem: TimelineItem } | null>(null);

  const handlePointerDownTrim = (e: React.PointerEvent, item: TimelineItem, side: "left" | "right") => {
    e.stopPropagation();
    setTrimmingItem({ id: item.id, side, startX: e.clientX, originalItem: { ...item } });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMoveTrim = (e: React.PointerEvent) => {
    if (!trimmingItem) return;
    const deltaX = e.clientX - trimmingItem.startX;
    let deltaMs = deltaX * zoomMsPerPixel;
    
    const asset = assets.find(a => a.id === trimmingItem.originalItem.assetId);
    const sourceDurationMs = asset?.durationMs || 5000;
    
    if (trimmingItem.side === "left") {
      let newStartMs = getSnappedTime(trimmingItem.originalItem.startMs + deltaMs);
      let effectiveDeltaMs = newStartMs - trimmingItem.originalItem.startMs;
      
      // Enforce bounds
      if (trimmingItem.originalItem.trimStartMs + effectiveDeltaMs < 0) {
        effectiveDeltaMs = -trimmingItem.originalItem.trimStartMs;
        newStartMs = trimmingItem.originalItem.startMs + effectiveDeltaMs;
      }
      if (trimmingItem.originalItem.durationMs - effectiveDeltaMs < 33) {
        effectiveDeltaMs = trimmingItem.originalItem.durationMs - 33;
        newStartMs = trimmingItem.originalItem.startMs + effectiveDeltaMs;
      }

      dispatch({
        type: "TRIM_ITEM",
        payload: { 
          id: trimmingItem.id, 
          startMs: newStartMs,
          durationMs: trimmingItem.originalItem.durationMs - effectiveDeltaMs,
          trimStartMs: trimmingItem.originalItem.trimStartMs + effectiveDeltaMs,
          trimEndMs: trimmingItem.originalItem.trimEndMs
        }
      });
    } else {
      let targetEndMs = getSnappedTime(trimmingItem.originalItem.startMs + trimmingItem.originalItem.durationMs + deltaMs);
      let effectiveDeltaMs = targetEndMs - (trimmingItem.originalItem.startMs + trimmingItem.originalItem.durationMs);
      
      // Enforce bounds
      if (trimmingItem.originalItem.trimEndMs - effectiveDeltaMs < 0) {
        effectiveDeltaMs = trimmingItem.originalItem.trimEndMs;
      }
      if (trimmingItem.originalItem.durationMs + effectiveDeltaMs < 33) {
        effectiveDeltaMs = -(trimmingItem.originalItem.durationMs - 33);
      }

      dispatch({
        type: "TRIM_ITEM",
        payload: { 
          id: trimmingItem.id, 
          startMs: trimmingItem.originalItem.startMs,
          durationMs: trimmingItem.originalItem.durationMs + effectiveDeltaMs,
          trimStartMs: trimmingItem.originalItem.trimStartMs,
          trimEndMs: trimmingItem.originalItem.trimEndMs - effectiveDeltaMs
        }
      });
    }
  };

  const handlePointerUpTrim = (e: React.PointerEvent) => {
    setTrimmingItem(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };
  
  const handlePointerUpItem = (e: React.PointerEvent) => {
    setDraggingItem(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        dispatch({ type: "TOGGLE_PLAY" });
      }
      if (e.code === "KeyJ") {
        dispatch({ type: "SET_PLAYBACK_RATE", payload: state.playbackRate <= 0 ? state.playbackRate - 1 : -1 });
      }
      if (e.code === "KeyK") {
        dispatch({ type: "SET_PLAYBACK_RATE", payload: 0 });
      }
      if (e.code === "KeyL") {
        dispatch({ type: "SET_PLAYBACK_RATE", payload: state.playbackRate >= 0 ? state.playbackRate + 1 : 1 });
      }
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        dispatch({ type: "SET_PLAYHEAD", payload: Math.max(0, state.playheadMs - 33) });
      }
      if (e.code === "ArrowRight") {
        e.preventDefault();
        dispatch({ type: "SET_PLAYHEAD", payload: state.playheadMs + 33 });
      }
      if (e.code === "Backspace" || e.code === "Delete") {
        e.preventDefault();
        dispatch({ type: "DELETE_SELECTED" });
      }
      if ((e.metaKey || e.ctrlKey) && e.code === "KeyZ") {
        e.preventDefault();
        if (e.shiftKey) dispatch({ type: "REDO" });
        else dispatch({ type: "UNDO" });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch, state.playbackRate, state.playheadMs]);

  const handleDrop = (e: React.DragEvent, trackId: string, offsetX: number) => {
    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (data.type === "asset") {
        const asset = assets.find(a => a.id === data.id);
        if (!asset) return;
        const startMs = Math.max(0, offsetX * zoomMsPerPixel);
        dispatch({
          type: "ADD_ITEM",
          payload: {
            id: crypto.randomUUID(),
            trackId,
            assetId: asset.id,
            position: 0,
            startMs,
            durationMs: asset.durationMs || 5000,
            trimStartMs: 0,
            trimEndMs: asset.durationMs || 5000
          }
        });
      }
    } catch {}
  };

  return (
    <div className="flex-1 bg-background flex flex-col overflow-hidden relative select-none">
      {/* Toolbar */}
      <div className="h-10 border-b border-border/50 bg-muted/20 flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => dispatch({ type: "ADD_TRACK", payload: { id: crypto.randomUUID(), trackType: "video", name: `Video ${tracks.length + 1}`, position: tracks.length } })}
            className="text-[10px] font-semibold tracking-wider uppercase px-2 py-1 bg-primary/20 text-primary hover:bg-primary/30 rounded">
            + Track
          </button>
          <button onClick={() => dispatch({ type: "SPLIT_ITEM", payload: { itemId: selectedItemIds[0]!, atMs: playheadMs, newId: crypto.randomUUID() } })}
            disabled={selectedItemIds.length !== 1}
            className="text-[10px] font-semibold tracking-wider uppercase px-2 py-1 border border-border hover:bg-muted rounded disabled:opacity-30">
            Split
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Zoom</span>
          <input type="range" min="10" max="500" value={zoomMsPerPixel} onChange={e => dispatch({ type: "SET_ZOOM", payload: Number(e.target.value) })} className="w-24 accent-primary" />
        </div>
      </div>

      <div className="flex-1 flex relative overflow-auto custom-scrollbar" ref={containerRef}>
        {/* Track Headers */}
        <div className="w-[150px] shrink-0 sticky left-0 z-20 bg-background border-r border-border/50 shadow-[10px_0_20px_rgba(0,0,0,0.2)]">
          <div className="h-8 border-b border-border/20 bg-muted/10"></div>
          {tracks.sort((a,b)=>a.position-b.position).map(t => (
            <div key={t.id} className="h-20 border-b border-border/20 flex items-center px-3 bg-muted/5 group">
              <span className="text-[10px] font-semibold text-foreground/80 truncate uppercase tracking-wider">{t.name}</span>
            </div>
          ))}
        </div>

        {/* Timeline Canvas */}
        <div className="relative flex-1 min-w-[2000px]">
          {/* Ruler */}
          <div className="h-8 border-b border-border/20 bg-muted/10 sticky top-0 z-10 overflow-hidden" onPointerDown={handlePointerDownPlayhead}>
            {/* Draw ticks */}
            {Array.from({ length: Math.ceil(200000 / 1000) }).map((_, i) => (
              <div key={i} className="absolute top-0 bottom-0 border-l border-border/40" style={{ left: (i * 1000) / zoomMsPerPixel }}>
                <span className="absolute left-1 top-1 text-[8px] text-muted-foreground/60 select-none">
                  {i}s
                </span>
              </div>
            ))}
          </div>

          {/* Tracks */}
          <div className="relative">
            {tracks.sort((a,b)=>a.position-b.position).map((t, i) => (
              <div 
                key={t.id} 
                className="h-20 border-b border-border/20 relative"
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  handleDrop(e, t.id, e.clientX - rect.left);
                }}
              >
                {/* Items */}
                {items.filter(item => item.trackId === t.id).map(item => {
                  const asset = assets.find(a => a.id === item.assetId);
                  const isSelected = selectedItemIds.includes(item.id);
                  const left = item.startMs / zoomMsPerPixel;
                  const width = item.durationMs / zoomMsPerPixel;
                  return (
                    <div
                      key={item.id}
                      onPointerDown={(e) => handlePointerDownItem(e, item)}
                      onPointerMove={draggingItem?.id === item.id ? handlePointerMoveItem : undefined}
                      onPointerUp={draggingItem?.id === item.id ? handlePointerUpItem : undefined}
                      className={cn(
                        "absolute top-1 h-[72px] rounded border overflow-hidden cursor-pointer",
                        isSelected ? "border-primary shadow-[0_0_10px_rgba(var(--primary),0.5)] z-10" : "border-border/50 opacity-90 hover:opacity-100 bg-primary/20"
                      )}
                      style={{ left, width }}
                    >
                      <div className="px-2 py-1 bg-black/40 text-[10px] font-semibold text-white truncate shadow-sm pointer-events-none">
                        {asset?.name || "Unknown"}
                      </div>
                      <div 
                        onPointerDown={(e) => handlePointerDownTrim(e, item, "left")}
                        onPointerMove={trimmingItem?.id === item.id && trimmingItem.side === "left" ? handlePointerMoveTrim : undefined}
                        onPointerUp={trimmingItem?.id === item.id && trimmingItem.side === "left" ? handlePointerUpTrim : undefined}
                        className="absolute left-0 top-0 bottom-0 w-2 hover:bg-primary/50 cursor-col-resize flex items-center justify-center border-r border-primary/20"
                      />
                      <div 
                        onPointerDown={(e) => handlePointerDownTrim(e, item, "right")}
                        onPointerMove={trimmingItem?.id === item.id && trimmingItem.side === "right" ? handlePointerMoveTrim : undefined}
                        onPointerUp={trimmingItem?.id === item.id && trimmingItem.side === "right" ? handlePointerUpTrim : undefined}
                        className="absolute right-0 top-0 bottom-0 w-2 hover:bg-primary/50 cursor-col-resize flex items-center justify-center border-l border-primary/20"
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Playhead */}
          <div 
            className="absolute top-0 bottom-0 w-px bg-primary z-30 pointer-events-none"
            style={{ left: playheadMs / zoomMsPerPixel }}
          >
            <div 
              onPointerDown={handlePointerDownPlayhead}
              onPointerMove={handlePointerMovePlayhead}
              onPointerUp={handlePointerUpPlayhead}
              className="absolute -top-1 -translate-x-1/2 w-4 h-4 bg-primary rounded-sm shadow-md cursor-ew-resize pointer-events-auto flex items-center justify-center before:content-[''] before:w-1 before:h-2 before:border-l before:border-r before:border-primary-foreground/50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
