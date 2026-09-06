import { useEffect, useState, useRef } from "react";
import { useEditorReducer, EditorContext } from "../hooks/useEditorState";
import { AssetBin } from "./AssetBin";
import { Monitor } from "./Monitor";
import { Inspector } from "./Inspector";
import { Timeline } from "./Timeline";
import { videoEditorClient } from "../lib/video-editor-client";
import { ProjectDetail, Asset } from "../domain/editor";
import { Loader2, ArrowLeft, Save, MonitorPlay } from "lucide-react";

export function EditorCockpit({ 
  projectId, 
  onBack 
}: { 
  projectId: string; 
  onBack: () => void;
}) {
  const [projectData, setProjectData] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [state, dispatch] = useEditorReducer();
  const lastSavedRef = useRef<string>("");
  const revisionRef = useRef<number>(projectData?.revisions?.[0]?.revisionNumber ?? 0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error" | "conflict">("idle");
  const [renderJob, setRenderJob] = useState<{ id: string, status: string, progress?: number, error?: string } | null>(null);

  useEffect(() => {
    let active = true;
    videoEditorClient.getProject(projectId).then(data => {
      if (!active) return;
      setProjectData(data);
      if (data.timeline) {
        dispatch({ type: "INIT_TIMELINE", payload: data.timeline });
        lastSavedRef.current = JSON.stringify(data.timeline);
      } else {
        const initial = { tracks: [], items: [] };
        dispatch({ type: "INIT_TIMELINE", payload: initial });
        lastSavedRef.current = JSON.stringify(initial);
      }
      revisionRef.current = data.revisions?.[0]?.revisionNumber ?? 0;
      setLoading(false);
    }).catch(err => {
      if (!active) return;
      setError(err.message);
      setLoading(false);
    });
    return () => { active = false; };
  }, [projectId, dispatch]);

  // Auto-save loop
  useEffect(() => {
    if (loading || !projectData || saveStatus === "conflict") return;
    const currentStr = JSON.stringify({ tracks: state.tracks, items: state.items });
    if (currentStr === lastSavedRef.current) return;

    const timer = setTimeout(() => {
      setSaveStatus("saving");
      videoEditorClient.updateTimeline(projectId, { tracks: state.tracks, items: state.items }, revisionRef.current)
        .then((updated) => {
          lastSavedRef.current = currentStr;
          revisionRef.current = updated.revisions?.[0]?.revisionNumber ?? revisionRef.current;
          setSaveStatus("saved");
        })
        .catch(err => {
          console.error("Autosave failed", err);
          if (err.message?.includes("conflict") || err.status === 409) {
            setSaveStatus("conflict");
          } else {
            setSaveStatus("error");
          }
        });
    }, 1500);

    return () => clearTimeout(timer);
  }, [state.tracks, state.items, projectId, loading, projectData, saveStatus]);

  const handleRender = async () => {
    try {
      setSaveStatus("saving");
      const updated = await videoEditorClient.updateTimeline(projectId, { tracks: state.tracks, items: state.items }, revisionRef.current);
      revisionRef.current = updated.revisions?.[0]?.revisionNumber ?? revisionRef.current;
      lastSavedRef.current = JSON.stringify({ tracks: state.tracks, items: state.items });
      setSaveStatus("saved");

      const res = await videoEditorClient.createRender(projectId);
      setRenderJob({ id: res.render.id, status: res.render.status });
    } catch (err) {
      alert("Falha na renderização: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  useEffect(() => {
    if (!renderJob || ["succeeded", "failed", "cancelled"].includes(renderJob.status)) return;
    const t = setInterval(async () => {
      try {
        const res = await videoEditorClient.getRender(projectId, renderJob.id);
        setRenderJob({ id: res.render.id, status: res.render.status, error: res.render.errorMessage });
      } catch (e) {}
    }, 3000);
    return () => clearInterval(t);
  }, [renderJob, projectId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background gap-4">
        <div className="text-destructive font-mono text-sm">{error}</div>
        <button onClick={onBack} className="text-primary text-sm hover:underline">Back</button>
      </div>
    );
  }

  return (
    <EditorContext.Provider value={{ state, dispatch }}>
      <div className="flex flex-col h-[100dvh] bg-background text-foreground overflow-hidden">
        {/* Top Navbar */}
        <header className="h-12 border-b border-border/50 bg-card/50 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex flex-col">
              <h1 className="text-sm font-semibold tracking-tight">{projectData?.project?.name || "Projeto Sem Título"}</h1>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono uppercase">
                <span>{projectData?.project?.id.split("-")[0]}</span>
                <span>•</span>
                {saveStatus === "saving" && <span className="text-primary animate-pulse">Salvando...</span>}
                {saveStatus === "saved" && <span className="text-emerald-500">Salvo</span>}
                {saveStatus === "error" && <span className="text-destructive">Erro ao salvar</span>}
                {saveStatus === "conflict" && <span className="text-destructive font-bold">Conflito de versão!</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center border border-border/50 rounded overflow-hidden mr-2">
              <button 
                onClick={() => dispatch({ type: "UNDO" })}
                disabled={state.historyIndex <= 0}
                className="px-3 py-1.5 text-[10px] font-semibold tracking-wider bg-muted/20 hover:bg-muted/50 disabled:opacity-30 transition-colors uppercase border-r border-border/50"
              >
                Desfazer
              </button>
              <button 
                onClick={() => dispatch({ type: "REDO" })}
                disabled={state.historyIndex >= state.history.length - 1}
                className="px-3 py-1.5 text-[10px] font-semibold tracking-wider bg-muted/20 hover:bg-muted/50 disabled:opacity-30 transition-colors uppercase"
              >
                Refazer
              </button>
            </div>
            
            {saveStatus === "conflict" && (
              <button 
                onClick={() => window.location.reload()}
                className="flex items-center gap-1.5 bg-destructive/20 text-destructive hover:bg-destructive/30 px-3 py-1.5 rounded text-xs font-semibold tracking-wide transition-colors">
                Recarregar Projeto
              </button>
            )}

            <button 
              onClick={handleRender}
              disabled={saveStatus === "conflict" || Boolean(renderJob && ["queued", "running"].includes(renderJob.status))}
              className="flex items-center gap-2 bg-chart-2/20 text-chart-2 hover:bg-chart-2/30 px-3 py-1.5 rounded text-xs font-semibold tracking-wide transition-colors disabled:opacity-50">
              {(renderJob && ["queued", "running"].includes(renderJob.status)) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MonitorPlay className="w-3.5 h-3.5" />}
              {(renderJob && ["queued", "running"].includes(renderJob.status)) ? "RENDERIZANDO..." : "RENDERIZAR"}
            </button>
          </div>
        </header>

        {renderJob && !["queued", "running"].includes(renderJob.status) && (
          <div className={`h-8 flex items-center justify-center text-xs font-semibold uppercase tracking-wider shrink-0 ${renderJob.status === "succeeded" ? "bg-emerald-500/20 text-emerald-400" : renderJob.status === "failed" ? "bg-destructive/20 text-destructive" : "bg-muted"}`}>
            {renderJob.status === "succeeded" ? "Render finalizado com sucesso" : renderJob.status === "failed" ? `Falha no render: ${renderJob.error || "Erro desconhecido"}` : `Render ${renderJob.status}`}
            <button onClick={() => setRenderJob(null)} className="ml-4 underline opacity-70 hover:opacity-100">Fechar</button>
          </div>
        )}

        {/* Main Work Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div className="flex-1 flex min-h-0 relative z-10">
            <AssetBin 
              projectId={projectId} 
              assets={projectData?.assets || []} 
              onAssetAdded={(asset) => {
                setProjectData(prev => prev ? { ...prev, assets: [...prev.assets, asset] } : null);
              }}
              onAssetDeleted={(id) => {
                setProjectData(prev => prev ? { ...prev, assets: prev.assets.filter(a => a.id !== id) } : null);
              }}
            />
            <Monitor projectId={projectId} assets={projectData?.assets || []} />
            <Inspector />
          </div>
          <div className="h-[40%] min-h-[300px] max-h-[60vh] flex flex-col relative z-20 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
            <Timeline assets={projectData?.assets || []} />
          </div>
        </div>
      </div>
    </EditorContext.Provider>
  );
}
