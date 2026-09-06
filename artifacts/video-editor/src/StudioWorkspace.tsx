import React, { useEffect, useState, useCallback, useRef } from "react";
import { 
  AlertCircle, CheckCircle2, Circle, Clapperboard, Loader2, Plus, 
  Settings2, Activity, PlaySquare, CalendarClock, ChevronDown, MonitorPlay, 
  Smartphone, Square, RefreshCcw, Camera, Users, Sparkles, Combine, Download, Film, AlertOctagon, XCircle
} from "lucide-react";
import { PRODUCTION_PHASES, type ProductionPhase, type StudioProject } from "./domain/projects";
import { videoEditorClient } from "./lib/video-editor-client";
import { ProjectDetail } from "./domain/editor";

const PHASE_LABELS: Record<ProductionPhase, string> = {
  script: "Roteiro", storyboard: "Storyboard", assets: "Assets & Takes", timeline: "Timeline",
  edit: "Edição", sound: "Som", color: "Cor", qc: "Controle de Qualidade", corrections: "Correções", export: "Exportação",
};

const SOURCE_MODES = [
  { value: "filmed", label: "Live Action", icon: Camera },
  { value: "digital_twin", label: "Digital Twin", icon: Users },
  { value: "synthetic", label: "AI Generation", icon: Sparkles },
  { value: "hybrid", label: "Hybrid", icon: Combine },
] as const;

const FORMATS = [
  { value: "vsl", label: "VSL" },
  { value: "cpl", label: "CPL" },
  { value: "live_promo", label: "Live Promo" },
  { value: "stories", label: "Stories" },
  { value: "reels", label: "Reels" },
  { value: "youtube", label: "YouTube" },
  { value: "webinar_promo", label: "Webinar Promo" },
  { value: "testimonial", label: "Testimonial" },
  { value: "product_demo", label: "Product Demo" },
] as const;

const ASPECT_RATIOS = [
  { value: "16:9", label: "16:9 Landscape", icon: MonitorPlay },
  { value: "9:16", label: "9:16 Portrait", icon: Smartphone },
  { value: "1:1", label: "1:1 Square", icon: Square },
] as const;

const DURATIONS = [
  { value: 10, label: "10s" },
  { value: 15, label: "15s" },
  { value: 30, label: "30s" },
  { value: 60, label: "60s" },
  { value: 300, label: "5min" },
  { value: 600, label: "10min" },
] as const;

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

function phaseStatus(project: StudioProject, phase: ProductionPhase) {
  return project.phases.find((item) => item.phase === phase)?.status ?? "not_started";
}

export function StudioWorkspace({ onPhaseChange, onProjectSelect }: { onPhaseChange: (phase: ProductionPhase) => void, onProjectSelect?: (projectId: string | null) => void }) {
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);

  const [capabilities, setCapabilities] = useState<{ native?: { available: boolean; workers: Array<{ name: string; capabilities: Array<{ modelId?: string; modelRevision?: string; licenseApproved?: boolean; resolutions?: string[] }> }> }; digitalTwin?: { backend: string; nativeCloneEngineAvailable: boolean } } | null>(null);

  useEffect(() => {
    onProjectSelect?.(selected);
  }, [selected, onProjectSelect]);

  const fetchProjects = useCallback(async () => {
    try {
      const result = await videoEditorClient.listProjects();
      setProjects(result.projects);
      return result.projects;
    } catch (err) {
      console.error(err);
      return [];
    }
  }, []);

  const fetchProjectDetail = useCallback(async (id: string) => {
    try {
      const detail = await videoEditorClient.getProject(id);
      setProjectDetail(detail);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    videoEditorClient.getCapabilities().then(setCapabilities).catch(console.error);
  }, []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [directing, setDirecting] = useState(false);
  const [producing, setProducing] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [trailerOperations, setTrailerOperations] = useState<{ [key: number]: boolean }>({});
  const [operationStatus, setOperationStatus] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [format, setFormat] = useState<typeof FORMATS[number]["value"]>("vsl");
  const [sourceMode, setSourceMode] = useState<typeof SOURCE_MODES[number]["value"]>("filmed");
  const [aspectRatio, setAspectRatio] = useState<typeof ASPECT_RATIOS[number]["value"]>("16:9");
  const [targetDurations, setTargetDurations] = useState<number[]>([]);
  const [trailerEnabled, setTrailerEnabled] = useState(false);
  const [trailerDurations, setTrailerDurations] = useState<(15 | 30)[]>([]);
  const [retentionPolicy, setRetentionPolicy] = useState<"archive" | "ephemeral">("archive");
  const [downloadEvidence, setDownloadEvidence] = useState<{ renderJobId: string; checksum?: string; size?: number } | null>(null);
  const [purging, setPurging] = useState(false);
  const [importingPackage, setImportingPackage] = useState(false);
  const packageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProjects().then(projs => {
      if (projs.length > 0) {
        setSelected(projs[0].id);
      }
      setLoading(false);
    });
  }, [fetchProjects]);

  useEffect(() => {
    if (selected) {
      fetchProjectDetail(selected);
    } else {
      setProjectDetail(null);
    }
  }, [selected, fetchProjectDetail]);

  // Polling for processing renders
  useEffect(() => {
    let interval: number;
    if (selected && projectDetail?.renders?.some(r => ["queued", "running"].includes(r.status))) {
      interval = window.setInterval(() => {
        fetchProjectDetail(selected);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [selected, projectDetail?.renders, fetchProjectDetail]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const project = await videoEditorClient.createProject({
        name: name.trim(),
        campaignId: campaignId.trim() || undefined,
        format,
        sourceMode,
        aspectRatio,
        targetDurationsSeconds: targetDurations.length > 0 ? targetDurations : undefined,
        trailerPolicy: trailerEnabled ? { enabled: true, durations: trailerDurations } : undefined,
        retentionPolicy,
      });
      setProjects((current) => [project, ...current]);
      setSelected(project.id);
      setShowCreate(false);
      
      setName("");
      setCampaignId("");
      setTargetDurations([]);
      setTrailerEnabled(false);
      setTrailerDurations([]);
      setRetentionPolicy("archive");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar o projeto.");
    } finally {
      setCreating(false);
    }
  };

  const toggleDuration = (val: number) => {
    setTargetDurations(prev => 
      prev.includes(val) ? prev.filter(d => d !== val) : [...prev, val]
    );
  };

  const runAutonomousDirection = async () => {
    if (!selected) return;
    setDirecting(true);
    setError(null);
    try {
      await videoEditorClient.runAutonomousPreproduction(selected);
      await fetchProjects();
      await fetchProjectDetail(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir a pré-produção autônoma.");
    } finally {
      setDirecting(false);
    }
  };

  const advanceProduction = async () => {
    if (!selected) return;
    setProducing(true);
    setOperationStatus("Avançando geração e seleção de takes...");
    setError(null);
    try {
      await videoEditorClient.advanceProduction(selected);
      await fetchProjects();
      await fetchProjectDetail(selected);
      setOperationStatus("Etapa concluída. Se houver jobs externos, use avançar novamente para verificar.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível avançar a produção.");
      setOperationStatus(null);
    } finally {
      setProducing(false);
    }
  };

  const renderAndReview = async () => {
    if (!selected) return;
    setRendering(true);
    setError(null);
    setOperationStatus("Iniciando montagem do vídeo master...");
    try {
      await videoEditorClient.createRender(selected);
      await fetchProjectDetail(selected);
      setOperationStatus("Renderização finalizada/enfileirada. QC pendente (revisão manual).");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível iniciar renderização.");
      setOperationStatus(null);
    } finally {
      setRendering(false);
    }
  };

  const renderTrailerAction = async (duration: 15 | 30) => {
    if (!selected) return;
    setTrailerOperations(prev => ({ ...prev, [duration]: true }));
    try {
      await videoEditorClient.renderTrailer(selected, duration);
      await fetchProjectDetail(selected);
    } catch (err) {
      alert(err instanceof Error ? err.message : `Falha ao iniciar trailer de ${duration}s.`);
    } finally {
      setTrailerOperations(prev => ({ ...prev, [duration]: false }));
    }
  };

  const downloadMedia = async (renderJobId: string, duration?: 15 | 30) => {
    try {
      const handoff = !duration ? await videoEditorClient.downloadRenderHandoff(selected!, renderJobId) : undefined;
      const blob = handoff?.blob ?? (duration
        ? await videoEditorClient.getTrailerMedia(selected!, duration, renderJobId)
        : await videoEditorClient.getRenderMedia(selected!, renderJobId));
        
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = duration ? `trailer-${duration}s-${Date.now()}.mp4` : `master-${Date.now()}.mp4`;
      a.click();
      window.URL.revokeObjectURL(url);
      if (handoff) setDownloadEvidence({ renderJobId, checksum: handoff.checksum, size: handoff.size });
    } catch (e) {
      alert("Erro ao baixar mídia.");
    }
  };
  const confirmPurge = async () => {
    if (!selected || !downloadEvidence?.checksum) return;
    const confirmation = window.prompt("A exclusão é irreversível: fontes, proxies, renders, trailers e temporários serão apagados. Sem nova carga, não será possível editar novamente. Digite APAGAR MÍDIA para confirmar:");
    if (confirmation !== "APAGAR MÍDIA") return;
    setPurging(true);
    try {
      await videoEditorClient.purgeMedia(selected, { renderJobId: downloadEvidence.renderJobId, expectedChecksum: downloadEvidence.checksum, confirmation });
      setDownloadEvidence(null);
      await fetchProjectDetail(selected);
      await fetchProjects();
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível apagar a mídia."); }
    finally { setPurging(false); }
  };
  const downloadEditablePackage = async () => {
    if (!selected || !masterRender || masterRender.status !== "succeeded") return;
    try {
      setError(null);
      setOperationStatus("Preparando pacote editável com fontes e timeline...");
      const handoff = await videoEditorClient.downloadEditablePackage(selected);
      if (!handoff.checksum) throw new Error("O servidor não informou o checksum do pacote.");
      const url = window.URL.createObjectURL(handoff.blob);
      const a = document.createElement("a");
      a.href = url; a.download = `projeto-editavel-${Date.now()}.nexosvideo`; a.click();
      window.URL.revokeObjectURL(url);
      const confirmation = window.prompt("Confirme somente após salvar o arquivo .nexosvideo. Digite SALVEI O PACOTE EDITÁVEL:");
      if (confirmation !== "SALVEI O PACOTE EDITÁVEL") {
        setOperationStatus("Pacote baixado, mas ainda não confirmado.");
        return;
      }
      await videoEditorClient.confirmEditablePackage(selected, handoff.checksum, confirmation);
      setDownloadEvidence({ renderJobId: masterRender.id, checksum: handoff.checksum, size: handoff.size });
      setOperationStatus("Pacote editável confirmado. A exclusão da mídia pode ser habilitada.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível baixar o pacote editável.");
      setOperationStatus(null);
    }
  };
  const importEditablePackage = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".nexosvideo")) { setError("Selecione um arquivo .nexosvideo."); return; }
    setImportingPackage(true); setError(null); setOperationStatus("Validando e importando pacote editável...");
    try {
      const detail = await videoEditorClient.importEditablePackage(file);
      await fetchProjects();
      setSelected(detail.project.id);
      setProjectDetail(detail);
      setOperationStatus("Projeto editável importado com sucesso.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Não foi possível importar o pacote.");
      setOperationStatus(null);
    } finally {
      setImportingPackage(false);
      if (packageInputRef.current) packageInputRef.current.value = "";
    }
  };

  const project = projects.find((item) => item.id === selected);
  const council = projectDetail?.manifest?.specification?.council;
  const masterRender = projectDetail?.renders?.find(r => !r.isTrailer);
  const trailers = projectDetail?.renders?.filter(r => r.isTrailer) || [];
  const timelineDurationMs = projectDetail?.timeline?.items?.reduce((max, item) => Math.max(max, item.position + item.durationMs), 0) || 0;
  const isMasterLongEnoughForTrailers = timelineDurationMs > 30000;

  // Aggregate members from all rounds
  const allProposals = Object.values(council?.rounds || {}).flatMap(r => r.proposals || []);
  const allCritiques = Object.values(council?.rounds || {}).flatMap(r => r.critiques || []);
  const lastRoundKey = council?.rounds ? Object.keys(council.rounds).sort().pop() : undefined;
  const directorSynthesis = lastRoundKey ? council?.rounds?.[lastRoundKey]?.directorSynthesis : undefined;

  return (
    <section className="bg-card border border-border/50 rounded-xl overflow-hidden shadow-2xs relative" data-testid="workspace-projects">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/10 via-primary/50 to-primary/10" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border-b border-border/50 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_15px_rgba(var(--primary),0.15)]">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-2">
              Production Control
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            </h2>
            <p className="text-xs text-muted-foreground">Orquestração e monitoramento de projetos audiovisuais</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input ref={packageInputRef} type="file" accept=".nexosvideo,application/zip" className="hidden" onChange={(event) => void importEditablePackage(event.target.files?.[0])} />
          <button type="button" onClick={() => packageInputRef.current?.click()} disabled={importingPackage} className="inline-flex h-10 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground hover:border-primary/50 disabled:opacity-50">
            {importingPackage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Importar projeto
          </button>
          {!showCreate && projects.length > 0 && (
            <div className="relative group">
              <select
                data-testid="select-project"
                value={selected ?? ""}
                onChange={(event) => setSelected(event.target.value)}
                className="appearance-none bg-background border border-input hover:border-primary/50 transition-colors rounded-lg pl-3 pr-9 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary h-10 w-[240px] truncate cursor-pointer shadow-sm"
              >
                {projects.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none group-hover:text-foreground transition-colors" />
            </div>
          )}
          <button
            data-testid="button-toggle-create"
            onClick={() => setShowCreate(!showCreate)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all shadow-sm h-10",
              showCreate 
                ? "bg-muted text-foreground border border-input hover:bg-accent" 
                : "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(var(--primary),0.3)]"
            )}
          >
            {showCreate ? "Cancelar" : <><Plus className="w-4 h-4" /> Novo Projeto</>}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border-l-2 border-destructive p-3 mx-5 mt-5 rounded-r-lg flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Main Content Area */}
      <div className="p-5">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
            <p className="text-sm font-medium">Sincronizando ambiente de produção...</p>
          </div>
        ) : showCreate || projects.length === 0 ? (
          <div className="bg-background border border-border rounded-xl p-5 md:p-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-2 mb-6 border-b border-border/50 pb-4">
              <Settings2 className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Configuração da Produção</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {/* Left Column */}
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">Identificação</label>
                  <input
                    autoFocus
                    placeholder="Nome do projeto (ex: VSL Lançamento 01)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-muted/50 border border-input rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                  <input
                    placeholder="ID da Campanha associada (Opcional)"
                    value={campaignId}
                    onChange={(e) => setCampaignId(e.target.value)}
                    className="w-full bg-muted/50 border border-input rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">Formato do Deliverável</label>
                  <div className="grid grid-cols-3 gap-2">
                    {FORMATS.map(f => (
                      <button
                        key={f.value}
                        onClick={() => setFormat(f.value)}
                        className={cn(
                          "px-2 py-2 rounded-md text-xs font-medium border transition-all",
                          format === f.value
                            ? "bg-primary/10 border-primary text-primary shadow-[0_0_10px_rgba(var(--primary),0.1)]"
                            : "bg-muted/30 border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">Proporção (Aspect Ratio)</label>
                  <div className="flex gap-2">
                    {ASPECT_RATIOS.map(ar => (
                      <button
                        key={ar.value}
                        onClick={() => setAspectRatio(ar.value)}
                        className={cn(
                          "flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg border transition-all",
                          aspectRatio === ar.value
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-muted/30 border-input text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <ar.icon className="w-4 h-4" />
                        <span className="text-[11px] font-medium">{ar.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">Modo de Produção</label>
                  <div className="grid grid-cols-2 gap-2">
                    {SOURCE_MODES.map(mode => (
                      <button
                        key={mode.value}
                        onClick={() => setSourceMode(mode.value)}
                        disabled={(mode.value === "synthetic" || mode.value === "digital_twin") && capabilities?.native?.available === false}
                        className={cn(
                          "flex items-center gap-2 p-3 rounded-lg border text-left transition-all disabled:cursor-not-allowed disabled:opacity-40",
                          sourceMode === mode.value
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-muted/30 border-input text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <mode.icon className="w-4 h-4 shrink-0" />
                        <span className="text-xs font-medium">{mode.label}</span>
                      </button>
                    ))}
                  </div>
                  {sourceMode === "digital_twin" && (
                    <div className="mt-3 p-3 bg-muted/20 border border-primary/20 rounded-lg text-xs animate-in fade-in slide-in-from-top-2">
                      <p className="font-semibold mb-1 text-primary">Capacidade do Motor de Geração</p>
                      <p className="text-muted-foreground">Execução: {capabilities?.digitalTwin?.backend || "verificando worker privado"}.</p>
                      {capabilities?.digitalTwin?.nativeCloneEngineAvailable === false ? (
                        <p className="text-destructive font-medium mt-2 flex items-center gap-1"><AlertOctagon className="w-3 h-3"/> Nenhum worker GPU privado saudável para clonagem. A geração nativa está desabilitada.</p>
                      ) : capabilities?.digitalTwin?.nativeCloneEngineAvailable === true ? (
                        <p className="text-emerald-500 font-medium mt-2 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Motor nativo de clonagem disponível e ativo.</p>
                      ) : (
                        <p className="text-muted-foreground mt-2">Verificando status do motor nativo...</p>
                      )}
                      {capabilities?.native?.workers.map((worker) => (
                        <p key={worker.name} className="text-[10px] mt-2 text-muted-foreground">Worker {worker.name}: {worker.capabilities.map((c) => `${c.modelId ?? "local"}${c.modelRevision ? `@${c.modelRevision}` : ""} · ${c.licenseApproved ? "licença aprovada" : "sem licença"}${c.resolutions?.length ? ` · ${c.resolutions.join(", ")}` : ""}`).join(" | ")}</p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">Durações Alvo (Opcional)</label>
                  <div className="flex flex-wrap gap-2">
                    {DURATIONS.map(d => (
                      <button
                        key={d.value}
                        onClick={() => toggleDuration(d.value)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                          targetDurations.includes(d.value)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/30 border-input text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">Geração de Trailers</label>
                    <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={trailerEnabled} 
                        onChange={e => setTrailerEnabled(e.target.checked)} 
                        className="rounded border-input text-primary focus:ring-primary w-4 h-4 bg-background" 
                      />
                      Habilitar Derivados
                    </label>
                  </div>
                  {trailerEnabled && (
                    <div className="flex flex-col gap-2 mt-2 animate-in fade-in">
                      <p className="text-[10px] text-muted-foreground border-l-2 border-primary/50 pl-2">Apenas para vídeos masters com duração superior a 30 segundos.</p>
                      <div className="flex gap-2 mt-1">
                        {[15, 30].map(d => (
                          <button
                            key={d}
                            onClick={() => setTrailerDurations(prev => prev.includes(d as 15 | 30) ? prev.filter(x => x !== d) : [...prev, d as 15 | 30])}
                            className={cn(
                              "px-3 py-1.5 rounded-md text-xs font-medium border transition-all flex-1",
                              trailerDurations.includes(d as 15 | 30)
                                ? "bg-primary/20 text-primary border-primary/50 shadow-[0_0_10px_rgba(var(--primary),0.1)]"
                                : "bg-muted/30 border-input text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            Trailer de {d}s
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2 pt-4 border-t border-border/50">
                  <label className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">Retenção de mídia</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setRetentionPolicy("archive")} className={cn("rounded-lg border p-3 text-left text-xs", retentionPolicy === "archive" ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground")}>Arquivo permanente</button>
                    <button type="button" onClick={() => setRetentionPolicy("ephemeral")} className={cn("rounded-lg border p-3 text-left text-xs", retentionPolicy === "ephemeral" ? "border-amber-500 bg-amber-500/10 text-foreground" : "border-input text-muted-foreground")}>Efêmera — apagar após download</button>
                  </div>
                  {retentionPolicy === "ephemeral" && <p className="text-[11px] text-amber-600 dark:text-amber-400">A mídia fica temporariamente armazenada durante a edição. Após baixar e verificar o arquivo, você deverá confirmar a exclusão irreversível. A timeline/auditoria pode permanecer, mas não poderá ser reeditada sem novo upload. O armazenamento de mídia recorrente fica zero ou próximo de zero após sucesso; pequenos metadados/auditoria e o processamento temporário permanecem.</p>}
                </div>

              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-border/50 flex justify-end">
              <button
                onClick={handleCreate}
                disabled={creating || !name.trim()}
                className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_15px_rgba(var(--primary),0.3)] disabled:opacity-50 disabled:shadow-none transition-all rounded-lg px-6 py-2.5 text-sm font-medium w-full sm:w-auto"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clapperboard className="w-4 h-4" />}
                Inicializar Projeto
              </button>
            </div>
          </div>
        ) : project ? (
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* Project Quick Stats */}
            <div className="flex items-center gap-4 text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-chart-2 shadow-[0_0_8px_rgba(var(--chart-2),0.6)]" />
                {project.status.toUpperCase()}
              </span>
              {project.retentionPolicy === "ephemeral" && <span className="rounded bg-amber-500/10 px-2 py-1 text-amber-600 dark:text-amber-400">{project.mediaPurgedAt ? "MÍDIA APAGADA" : "MÍDIA EFÊMERA"}</span>}
              <span className="text-muted-foreground border-l border-border/50 pl-4 flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5" />
                Criado {new Date(project.createdAt).toLocaleDateString()}
              </span>
              <button
                onClick={() => {
                  setLoading(true);
                  fetchProjects()
                    .then(() => fetchProjectDetail(project.id))
                    .catch(() => {})
                    .finally(() => setLoading(false));
                }}
                className="ml-auto text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 bg-muted/30 px-2 py-1 rounded"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Sincronizar
              </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Direção audiovisual autônoma</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Cria ou retoma roteiro e storyboard, depois coordena arte, figurino, performance, voz, som, montagem, cor e continuidade.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void runAutonomousDirection()}
                    disabled={directing}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 shadow-[0_0_15px_rgba(var(--primary),0.2)]"
                  >
                    {directing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {directing ? "Dirigindo produção..." : "Criar pré-produção"}
                  </button>
                </div>

                <div className="bg-background rounded-xl border border-border p-4 shadow-sm">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <MonitorPlay className="w-4 h-4 text-chart-2" /> 
                    Controle de Renderização
                  </h3>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={() => void advanceProduction()}
                      disabled={producing || directing}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60"
                    >
                      {producing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlaySquare className="h-4 w-4 text-primary" />}
                      {producing ? "Avançando..." : "Avançar Geração de Takes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void renderAndReview()}
                      disabled={rendering || producing || phaseStatus(project, "timeline") !== "ready" || ["queued", "running"].includes(masterRender?.status || "")}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-chart-2/30 bg-chart-2/10 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-chart-2/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {rendering || ["queued", "running"].includes(masterRender?.status || "") ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4 text-chart-2" />}
                      {rendering || ["queued", "running"].includes(masterRender?.status || "") ? "Montando master..." : "Montar Master"}
                    </button>
                  </div>
                  {operationStatus && <p className="mt-3 text-xs text-muted-foreground bg-muted/20 p-2 rounded border border-border/50">{operationStatus}</p>}
                  {project.retentionPolicy === "ephemeral" && !project.mediaPurgedAt && (
                    <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                      <p className="font-semibold text-foreground">Download e exclusão da mídia efêmera</p>
                      <p className="mt-1 text-muted-foreground">Antes da exclusão, baixe e confirme o pacote editável (.nexosvideo), que contém fontes e timeline. MP4 continua sendo um download separado.</p>
                      {!downloadEvidence && <button type="button" disabled={masterRender?.status !== "succeeded"} onClick={() => void downloadEditablePackage()} className="mt-2 inline-flex rounded bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"><Download className="mr-1 h-3.5 w-3.5" />Baixar projeto editável</button>}
                      {downloadEvidence && <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center"><span className="font-mono text-[10px] break-all">Pacote confirmado · SHA-256: {downloadEvidence.checksum} {downloadEvidence.size ? `· ${downloadEvidence.size} bytes` : ""}</span><button type="button" disabled={purging} onClick={() => void confirmPurge()} className="rounded bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground disabled:opacity-50">{purging ? "Apagando..." : "Apagar mídia após pacote salvo"}</button></div>}
                    </div>
                  )}

                  {/* Render Status Section */}
                  {(masterRender || trailers.length > 0) && (
                    <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                      {masterRender && (
                        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/10 text-sm">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-2 h-2 rounded-full", masterRender.status === 'succeeded' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : masterRender.status === 'failed' ? 'bg-destructive' : 'bg-chart-4 animate-pulse')} />
                            <div>
                              <p className="font-semibold">Vídeo Master</p>
                              {masterRender.errorMessage && <p className="text-[10px] text-destructive">{masterRender.errorMessage}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground mr-2">{masterRender.status.toUpperCase()}</span>
                            {masterRender.status === 'succeeded' && (
                              <button onClick={() => downloadMedia(masterRender.id)} className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Download Master">
                                <Download className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {trailers.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase">Derivados</p>
                          {trailers.map(t => (
                            <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg border border-dashed bg-muted/5 text-xs">
                              <div className="flex items-center gap-3">
                                <div className={cn("w-1.5 h-1.5 rounded-full", t.status === 'succeeded' ? 'bg-emerald-500' : t.status === 'failed' ? 'bg-destructive' : 'bg-chart-4 animate-pulse')} />
                                <div>
                                  <span className="font-medium">Trailer {t.durationSeconds}s</span>
                                  {t.errorMessage && <p className="text-[10px] text-destructive">{t.errorMessage}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground mr-1">{t.status.toUpperCase()}</span>
                                {t.status === 'succeeded' && (
                                  <button onClick={() => downloadMedia(t.id, t.durationSeconds as 15 | 30)} className="p-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Generate Trailers Actions */}
                      <div className="flex items-center gap-2 pt-2">
                        {[15, 30].map((d) => {
                          const existing = trailers.find(t => t.durationSeconds === d && t.status !== 'failed');
                          const isProcessing = trailerOperations[d] || ["queued", "running"].includes(existing?.status || "");
                          const disabled = !isMasterLongEnoughForTrailers || !!existing || isProcessing || phaseStatus(project, "timeline") !== "ready";
                          
                          return (
                            <button
                              key={d}
                              onClick={() => renderTrailerAction(d as 15 | 30)}
                              disabled={disabled}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-md border text-xs font-medium transition-colors hover:bg-muted/50 disabled:opacity-40 disabled:hover:bg-transparent"
                              title={!isMasterLongEnoughForTrailers ? "Master precisa ter mais de 30s" : "Gerar Trailer Derivado"}
                            >
                              {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clapperboard className="w-3.5 h-3.5" />}
                              Gerar {d}s
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Production Council Section */}
              {council && (
                <div className="w-full lg:w-[380px] shrink-0 bg-background rounded-xl border border-border shadow-sm flex flex-col h-auto">
                  <div className="bg-muted/30 p-3 border-b border-border flex justify-between items-center shrink-0">
                    <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <Users className="w-4 h-4 text-primary" /> 
                      Production Council
                    </h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-background rounded-full border shadow-sm">
                      {council.version || "v1"}
                    </span>
                  </div>
                  
                  <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-5">
                    {council.errors && council.errors.length > 0 && (
                      <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg text-xs text-destructive flex gap-2">
                        <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <ul className="list-disc list-inside space-y-1">
                          {council.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                        </ul>
                      </div>
                    )}
                    
                    {council.status && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Status do Conselho</p>
                        <div className="text-[11px] px-2 py-1 rounded bg-muted/50 border border-border/50 inline-flex items-center gap-1.5">
                          <span className={council.status === 'approved' ? 'text-emerald-500 font-medium' : council.status === 'rejected' ? 'text-destructive font-medium' : 'text-primary font-medium'}>
                            {council.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    )}

                    {directorSynthesis && (
                      <div className="text-sm border-l-2 border-primary pl-3 py-1 bg-primary/5 rounded-r-lg">
                        <p className="text-[10px] font-semibold uppercase text-primary tracking-wider mb-1">Síntese da Direção</p>
                        <p className="text-foreground/90 text-xs leading-relaxed">{directorSynthesis}</p>
                      </div>
                    )}

                    {(allProposals.length > 0 || allCritiques.length > 0) ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                        {allProposals.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                              <Circle className="w-3 h-3 text-chart-2" /> Propostas
                            </h5>
                            <div className="space-y-2">
                              {allProposals.map((p: { author: string; content: string }, i: number) => (
                                <div key={i} className="text-xs bg-muted/20 p-2.5 rounded-lg border border-border/50">
                                  <span className="font-semibold text-foreground">{p.author}:</span> <span className="text-muted-foreground">{p.content}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {allCritiques.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                              <AlertCircle className="w-3 h-3 text-chart-5" /> Críticas
                            </h5>
                            <div className="space-y-2">
                              {allCritiques.map((c: { author: string; target: string; content: string }, i: number) => (
                                <div key={i} className="text-xs bg-muted/20 p-2.5 rounded-lg border border-border/50">
                                  <span className="font-semibold text-foreground">{c.author} <span className="opacity-50">→</span> {c.target}:</span> <span className="text-muted-foreground">{c.content}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            {/* Phases Grid */}
            <div className="bg-background rounded-xl border border-border p-1.5 overflow-x-auto custom-scrollbar shadow-sm">
              <div className="flex items-stretch min-w-max gap-1">
                {PRODUCTION_PHASES.map((phase, idx) => {
                  const status = phaseStatus(project, phase);
                  const isReady = status === "ready";
                  const inProgress = status === "in_progress";
                  const isBlocked = status === "blocked";
                  const isNext = idx > 0 && phaseStatus(project, PRODUCTION_PHASES[idx - 1]) === "ready" && status === "not_started";
                  
                  return (
                    <button
                      key={phase}
                      onClick={() => onPhaseChange(phase)}
                      className={cn(
                        "relative flex flex-col items-center justify-center p-3 w-[120px] shrink-0 rounded-lg border border-transparent transition-all group",
                        isReady && "hover:bg-chart-2/5",
                        inProgress && "bg-primary/10 border-primary/30 shadow-[inset_0_0_20px_rgba(var(--primary),0.05)]",
                        isBlocked && "opacity-50",
                        status === "not_started" && !isNext && "hover:bg-muted/50",
                        isNext && "hover:bg-primary/5 border-primary/20 border-dashed"
                      )}
                    >
                      <div className="mb-2">
                        {isReady ? (
                          <div className="w-6 h-6 rounded-full bg-chart-2/20 flex items-center justify-center">
                            <CheckCircle2 className="w-3.5 h-3.5 text-chart-2" />
                          </div>
                        ) : inProgress ? (
                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center relative">
                            <div className="absolute inset-0 border-2 border-primary/50 border-t-transparent rounded-full animate-spin" />
                            <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                          </div>
                        ) : isBlocked ? (
                          <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center">
                            <div className="w-3 h-3 border-2 border-destructive/50 rounded-sm" />
                          </div>
                        ) : (
                          <div className={cn("w-6 h-6 rounded-full flex items-center justify-center transition-colors", isNext ? "bg-primary/10" : "bg-muted")}>
                            <Circle className={cn("w-3.5 h-3.5", isNext ? "text-primary/60" : "text-muted-foreground/50")} />
                          </div>
                        )}
                      </div>
                      <span className={cn(
                        "text-[11px] font-medium text-center leading-tight",
                        isReady ? "text-foreground" :
                        inProgress ? "text-primary font-semibold" :
                        isBlocked ? "text-destructive/70" :
                        "text-muted-foreground group-hover:text-foreground/80 transition-colors"
                      )}>
                        {PHASE_LABELS[phase]}
                      </span>
                      
                      {/* Connection line between nodes */}
                      {idx < PRODUCTION_PHASES.length - 1 && (
                        <div className={cn(
                          "absolute right-[-2px] top-1/2 -translate-y-1/2 w-4 h-[1px] translate-x-full z-10",
                          isReady ? "bg-chart-2/40" : "bg-border"
                        )} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
