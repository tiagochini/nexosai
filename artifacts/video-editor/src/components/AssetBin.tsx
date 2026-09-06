import { useState, useRef, useCallback, memo } from "react";
import { Film, Upload, Trash2, Loader2, Music, Image as ImageIcon, Type } from "lucide-react";
import { Asset } from "../domain/editor";
import { videoEditorClient } from "../lib/video-editor-client";
import { cn } from "../lib/utils";

export const AssetBin = memo(function AssetBin({ 
  projectId, 
  assets, 
  onAssetAdded,
  onAssetDeleted
}: { 
  projectId: string; 
  assets: Asset[];
  onAssetAdded: (asset: Asset) => void;
  onAssetDeleted: (assetId: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      try {
        const uploaded = await videoEditorClient.upload(file);
        const asset = await videoEditorClient.attachUpload(projectId, uploaded.fileId, file.name);
        onAssetAdded(asset);
      } catch (err) {
        console.error("Upload failed", err);
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }, [projectId, onAssetAdded]);

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const getIcon = (type: string) => {
    if (type.startsWith("audio")) return <Music className="w-4 h-4 text-emerald-400" />;
    if (type.startsWith("image")) return <ImageIcon className="w-4 h-4 text-amber-400" />;
    return <Film className="w-4 h-4 text-primary" />;
  };

  return (
    <div className="w-[300px] flex flex-col bg-sidebar border-r border-sidebar-border h-full overflow-hidden shrink-0 shadow-lg relative z-20">
      <div className="h-10 border-b border-sidebar-border flex items-center justify-between px-4 bg-sidebar-accent/30 shrink-0">
        <span className="text-xs font-semibold text-sidebar-foreground uppercase tracking-wider">Project Bin</span>
        <span className="text-[10px] text-sidebar-foreground/50">{assets.length} items</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {assets.map(asset => (
          <div 
            key={asset.id} 
            className="group flex items-center gap-3 p-2 rounded-md hover:bg-sidebar-accent cursor-pointer transition-colors border border-transparent hover:border-sidebar-border"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", JSON.stringify({ type: "asset", id: asset.id }));
            }}
          >
            <div className="w-10 h-10 bg-black/50 rounded flex items-center justify-center shrink-0 border border-sidebar-border shadow-inner relative overflow-hidden">
              {getIcon(asset.mimeType)}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <span className="text-xs font-medium text-sidebar-foreground truncate" title={asset.name}>{asset.name}</span>
              <span className="text-[10px] text-sidebar-foreground/60 font-mono mt-0.5">
                {(asset.durationMs / 1000).toFixed(1)}s
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-sidebar-border bg-sidebar shrink-0">
        <input 
          type="file" 
          ref={inputRef} 
          className="hidden" 
          multiple 
          accept="video/*,audio/*,image/*" 
          onChange={e => void handleFiles(e.target.files)} 
        />
        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          disabled={uploading}
          className={cn(
            "w-full h-16 border border-dashed rounded-lg flex flex-col items-center justify-center transition-all",
            uploading ? "border-primary/50 bg-primary/5 text-primary" : "border-sidebar-border hover:border-primary hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground cursor-pointer"
          )}
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin mb-1" /> : <Upload className="w-4 h-4 mb-1" />}
          <span className="text-[10px] font-semibold uppercase tracking-wider">
            {uploading ? "Uploading..." : "Import Media"}
          </span>
        </button>
      </div>
    </div>
  );
});
