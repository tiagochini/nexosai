import { useEditor } from "../hooks/useEditorState";
import { formatTimeCode } from "./Monitor";

export function Inspector() {
  const { state, dispatch } = useEditor();
  const selectedItems = state.items.filter(i => state.selectedItemIds.includes(i.id));

  if (selectedItems.length === 0) {
    return (
      <div className="w-[280px] bg-sidebar border-l border-sidebar-border flex flex-col h-full shrink-0">
        <div className="h-10 border-b border-sidebar-border flex items-center px-4 bg-sidebar-accent/30">
          <span className="text-xs font-semibold text-sidebar-foreground uppercase tracking-wider">Inspector</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-sidebar-foreground/40 p-6 text-center">
          <span className="text-xs">Select a clip in the timeline to inspect</span>
        </div>
      </div>
    );
  }

  const item = selectedItems[0]!;
  
  const updateItem = (updates: Partial<typeof item>) => {
    dispatch({
      type: "TRIM_ITEM",
      payload: {
        id: item.id,
        startMs: updates.startMs ?? item.startMs,
        durationMs: updates.durationMs ?? item.durationMs,
        trimStartMs: updates.trimStartMs ?? item.trimStartMs,
        trimEndMs: updates.trimEndMs ?? item.trimEndMs
      }
    });
  };
  const settings = item.settings ?? {};
  const updateSetting = (key: string, value: unknown) => {
    dispatch({ type: "UPDATE_ITEM_SETTINGS", payload: { id: item.id, settings: { ...settings, [key]: value } } });
  };
  const numberSetting = (key: string, label: string, step = 1) => (
    <div className="space-y-1.5" key={key}>
      <label className="text-[10px] text-sidebar-foreground/80">{label}</label>
      <input type="number" step={step} value={Number(settings[key] ?? (key === "opacity" || key === "scale" ? 1 : 0))}
        onChange={e => updateSetting(key, Number(e.target.value))}
        className="w-full bg-black/40 border border-sidebar-border rounded px-2 py-1.5 text-xs text-sidebar-foreground focus:outline-none focus:border-primary font-mono" />
    </div>
  );

  return (
    <div className="w-[280px] bg-sidebar border-l border-sidebar-border flex flex-col h-full shrink-0 shadow-[-10px_0_15px_rgba(0,0,0,0.1)]">
      <div className="h-10 border-b border-sidebar-border flex items-center px-4 bg-sidebar-accent/30 shrink-0">
        <span className="text-xs font-semibold text-sidebar-foreground uppercase tracking-wider">Inspector</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-sidebar-foreground/60 uppercase tracking-widest">Timing</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] text-sidebar-foreground/80">Position</label>
              <input 
                type="number"
                value={item.startMs}
                onChange={e => updateItem({ startMs: Number(e.target.value) })}
                className="w-full bg-black/40 border border-sidebar-border rounded px-2 py-1.5 text-xs text-sidebar-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-sidebar-foreground/80">Duration</label>
              <input 
                type="number"
                value={item.durationMs}
                onChange={e => updateItem({ durationMs: Number(e.target.value) })}
                className="w-full bg-black/40 border border-sidebar-border rounded px-2 py-1.5 text-xs text-sidebar-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono"
              />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[10px] text-sidebar-foreground/80">In Point (Trim)</label>
            <input 
              type="number"
              value={item.trimStartMs}
              onChange={e => updateItem({ trimStartMs: Number(e.target.value) })}
              className="w-full bg-black/40 border border-sidebar-border rounded px-2 py-1.5 text-xs text-sidebar-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono"
            />
          </div>
        </div>

        <div className="space-y-3">
          <span className="text-[10px] font-semibold text-sidebar-foreground/60 uppercase tracking-widest">Mix & appearance</span>
          <div className="grid grid-cols-2 gap-3">
            {numberSetting("opacity", "Opacity", 0.05)}
            {numberSetting("volumeDb", "Volume (dB)", 0.5)}
            {numberSetting("pan", "Pan", 0.05)}
            {numberSetting("playbackRate", "Speed", 0.05)}
            {numberSetting("fadeInMs", "Fade in (ms)")}
            {numberSetting("fadeOutMs", "Fade out (ms)")}
            {numberSetting("x", "X")}
            {numberSetting("y", "Y")}
            {numberSetting("scale", "Scale", 0.05)}
            {numberSetting("rotation", "Rotation", 1)}
            {numberSetting("exposure", "Exposure", 0.05)}
            {numberSetting("contrast", "Contrast", 0.05)}
            {numberSetting("saturation", "Saturation", 0.05)}
            {numberSetting("temperature", "Temperature", 0.05)}
            {numberSetting("tint", "Tint", 0.05)}
          </div>
          <label className="flex items-center gap-2 text-[10px] text-sidebar-foreground/80">
            <input type="checkbox" checked={settings.mute === true} onChange={e => updateSetting("mute", e.target.checked)} />
            Mute this item
          </label>
        </div>

        <div className="space-y-3">
          <span className="text-[10px] font-semibold text-sidebar-foreground/60 uppercase tracking-widest">Text & captions</span>
          <textarea value={String(settings.content ?? "")} onChange={e => updateSetting("content", e.target.value)}
            placeholder="Caption or text content" rows={3}
            className="w-full resize-y bg-black/40 border border-sidebar-border rounded px-2 py-1.5 text-xs text-sidebar-foreground focus:outline-none focus:border-primary" />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><label className="text-[10px] text-sidebar-foreground/80">Font</label><input value={String(settings.font ?? "")} onChange={e => updateSetting("font", e.target.value)} className="w-full bg-black/40 border border-sidebar-border rounded px-2 py-1.5 text-xs" /></div>
            {numberSetting("fontSize", "Size")}
            <div className="space-y-1.5"><label className="text-[10px] text-sidebar-foreground/80">Color</label><input value={String(settings.color ?? "#ffffff")} onChange={e => updateSetting("color", e.target.value)} className="w-full bg-black/40 border border-sidebar-border rounded px-2 py-1.5 text-xs" /></div>
            <div className="space-y-1.5"><label className="text-[10px] text-sidebar-foreground/80">Align</label><select value={String(settings.alignment ?? "center")} onChange={e => updateSetting("alignment", e.target.value)} className="w-full bg-black/40 border border-sidebar-border rounded px-2 py-1.5 text-xs"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></div>
          </div>
        </div>
      </div>
    </div>
  );
}
