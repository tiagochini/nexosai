import { useState, useMemo, useEffect } from "react";
import { 
  useGetCampaignControlRoomVersionSources,
  useGetCampaignControlRoomVersionDiff,
  getGetCampaignControlRoomVersionDiffQueryKey,
  getGetCampaignControlRoomVersionSourcesQueryKey,
  type GetCampaignControlRoomVersionDiffParams,
  type GetCampaignControlRoomVersionDiffResource,
  type ControlRoomVersionSource,
  type ControlRoomVersionMetadata,
  type ControlRoomDiffSummary,
  type ControlRoomDiffChange
} from "@workspace/api-client-react";
import {
  ArrowLeft, GitCompare, History, XCircle, AlertTriangle, 
  CheckCircle2, RefreshCw, Layers, FileText, FileDiff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export function VersionDiffDrawer({
  open,
  onOpenChange,
  campaignId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
}) {
  const [selectedSource, setSelectedSource] = useState<{ id: string; resource: GetCampaignControlRoomVersionDiffResource } | null>(null);
  const [baseId, setBaseId] = useState<string>("");
  const [targetId, setTargetId] = useState<string>("");
  const [submittedParams, setSubmittedParams] = useState<GetCampaignControlRoomVersionDiffParams | null>(null);
  const disabledDiffParams: GetCampaignControlRoomVersionDiffParams = {
    resource: "masterplan",
    baseId: "00000000-0000-4000-8000-000000000000",
    targetId: "00000000-0000-4000-8000-000000000001",
  };

  // Reset state when drawer opens/closes or when source changes
  useEffect(() => {
    if (!open) {
      setSelectedSource(null);
      setBaseId("");
      setTargetId("");
      setSubmittedParams(null);
    }
  }, [open]);

  useEffect(() => {
    setSubmittedParams(null);
  }, [selectedSource, baseId, targetId]);

  const {
    data: sourcesResponse,
    isLoading: isLoadingSources,
    isError: isErrorSources,
    error: sourcesError,
    refetch: refetchSources
  } = useGetCampaignControlRoomVersionSources(campaignId, {
    query: { 
      enabled: open,
      queryKey: getGetCampaignControlRoomVersionSourcesQueryKey(campaignId)
    }
  });

  const sources = sourcesResponse?.sources || [];

  const activeSource = useMemo(() => {
    if (!selectedSource) return null;
    return sources.find(s => s.id === selectedSource.id && s.kind === selectedSource.resource) || null;
  }, [sources, selectedSource]);

  const activeVersions = useMemo(() => {
    if (!activeSource || !activeSource.versions) return [];
    return activeSource.versions;
  }, [activeSource]);

  // Set default selection when active source changes
  useEffect(() => {
    if (activeSource && activeVersions.length >= 2) {
      setTargetId(activeVersions[0].id);
      setBaseId(activeVersions[1].id);
    } else {
      setBaseId("");
      setTargetId("");
    }
  }, [activeSource, activeVersions]);

  const {
    data: diffResponse,
    isLoading: isLoadingDiff,
    isError: isErrorDiff,
    error: diffError,
    isFetching: isFetchingDiff,
    refetch: refetchDiff
  } = useGetCampaignControlRoomVersionDiff(
    campaignId,
    submittedParams ?? disabledDiffParams,
    {
      query: {
        enabled: open && !!submittedParams && submittedParams.baseId !== submittedParams.targetId,
        queryKey: submittedParams 
          ? getGetCampaignControlRoomVersionDiffQueryKey(campaignId, submittedParams)
          : ["campaign-control-room-version-diff-disabled", campaignId]
      }
    }
  );

  const handleBack = () => {
    setSubmittedParams(null);
    setSelectedSource(null);
  };

  const handleSelectSource = (source: ControlRoomVersionSource) => {
    if (source.kind !== "masterplan" && source.kind !== "page") return;
    setSubmittedParams(null);
    setBaseId("");
    setTargetId("");
    setSelectedSource({ id: source.id, resource: source.kind });
  };

  const handleCompare = () => {
    if (!selectedSource || !baseId || !targetId || baseId === targetId) return;
    
    const params: GetCampaignControlRoomVersionDiffParams = {
      resource: selectedSource.resource,
      baseId,
      targetId
    };

    // Only set sourceId if resource is not masterplan
    if (selectedSource.resource !== "masterplan") {
      params.sourceId = selectedSource.id;
    }

    setSubmittedParams(params);
  };

  const handleBaseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSubmittedParams(null);
    setBaseId(e.target.value);
  };

  const handleTargetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSubmittedParams(null);
    setTargetId(e.target.value);
  };

  const submittedMatchesSelection = Boolean(
    submittedParams
      && selectedSource
      && submittedParams.resource === selectedSource.resource
      && submittedParams.baseId === baseId
      && submittedParams.targetId === targetId
      && (selectedSource.resource === "masterplan"
        ? submittedParams.sourceId === undefined
        : submittedParams.sourceId === selectedSource.id)
  );

  const renderSourceList = () => {
    if (isLoadingSources) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]" aria-live="polite">
          <RefreshCw className="h-6 w-6 text-primary animate-spin mb-3" />
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Carregando catálogo de versões...</div>
        </div>
      );
    }

    if (isErrorSources) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] text-center p-6" role="alert">
          <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
          <div className="font-mono text-[11px] uppercase tracking-widest text-destructive font-bold mb-2">Falha ao carregar catálogo</div>
          <p className="font-mono text-[9px] text-muted-foreground mb-4 max-w-md">{(sourcesError as Error)?.message || "Não foi possível carregar as fontes de versão."}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => refetchSources()} className="font-mono text-[10px] uppercase tracking-widest">
            Tentar Novamente
          </Button>
        </div>
      );
    }

    if (!sources || sources.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] text-center p-6 border border-dashed border-border/30 bg-black/20 m-4">
          <History className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <div className="font-mono text-[11px] uppercase tracking-widest text-white/50 font-bold mb-2">Nenhuma Fonte Disponível</div>
          <p className="font-mono text-[9px] text-muted-foreground max-w-md">Não há histórico de versões persistido para esta campanha.</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-4">
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {sources.map((source) => {
          const isMasterplan = source.kind === "masterplan";
          const Icon = isMasterplan ? FileText : Layers;
          const resourceType = isMasterplan ? "masterplan" : "page";
          const testId = `version-source-${resourceType}-${source.id}`;
          
          if (!source.historyAvailable) {
            return (
              <div 
                key={source.id} 
                className="border border-border/20 bg-black/40 p-4 flex flex-col gap-3 opacity-60 relative overflow-hidden"
                data-testid={testId}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground font-bold">{source.label || source.kind}</span>
                  </div>
                </div>
                <div className="font-sans text-xs text-muted-foreground/60">{source.id}</div>
                <div className="mt-2 flex flex-col gap-1.5 p-2 bg-destructive/10 border border-destructive/20 w-fit">
                  <div className="flex items-center gap-1.5 text-destructive font-mono text-[9px] uppercase tracking-widest">
                    <AlertTriangle className="h-3 w-3" />
                    <span data-testid={`version-diff-unavailable-${source.id}`}>history_not_persisted</span>
                  </div>
                  <div className="font-mono text-[8px] text-destructive/70 max-w-[250px] leading-tight">
                    {source.reason || "Esta fonte de dados não suporta ou não possui histórico persistido na arquitetura atual."}
                  </div>
                </div>
              </div>
            );
          }
          
          if (!source.comparable) {
            return (
              <div 
                key={source.id} 
                className="border border-border/20 bg-black/40 p-4 flex flex-col gap-3 opacity-60 relative overflow-hidden"
                data-testid={testId}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground font-bold">{source.label || source.kind}</span>
                  </div>
                </div>
                <div className="font-sans text-xs text-muted-foreground/60">{source.id}</div>
                <div className="mt-2 flex flex-col gap-1.5 p-2 bg-[#FFB000]/10 border border-[#FFB000]/20 w-fit">
                  <div className="flex items-center gap-1.5 text-[#FFB000] font-mono text-[9px] uppercase tracking-widest">
                    <History className="h-3 w-3" />
                    <span data-testid={`version-diff-unavailable-${source.id}`}>not_comparable</span>
                  </div>
                  <div className="font-mono text-[8px] text-[#FFB000]/70 max-w-[250px] leading-tight">
                    Histórico existe, mas não possui versões suficientes (mínimo de 2) para comparação.
                  </div>
                </div>
              </div>
            );
          }

          const versionsArray = source.versions || [];

          return (
            <button
              type="button"
              key={source.id}
              onClick={() => handleSelectSource(source)}
              className="border border-primary/20 bg-primary/5 p-4 flex flex-col gap-3 hover:bg-primary/10 hover:border-primary/40 transition-colors text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60 group"
              data-testid={testId}
            >
              <div className="flex items-start justify-between w-full">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="font-mono text-[11px] uppercase tracking-widest text-white font-bold">{source.label || source.kind}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="px-2 py-0.5 bg-black/40 border border-border/30 font-mono text-[9px] text-muted-foreground group-hover:text-primary transition-colors">
                    {source.versionCount} versões
                  </div>
                  {source.catalogTruncated && (
                    <div className="flex items-center gap-1 text-[#FFB000] font-mono text-[8px] uppercase tracking-widest">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      truncado
                    </div>
                  )}
                </div>
              </div>
              <div className="font-sans text-xs text-muted-foreground/80">{source.id}</div>
              <div className="mt-2 flex items-center gap-1.5 text-primary font-mono text-[9px] uppercase tracking-widest">
                <GitCompare className="h-3 w-3" />
                Comparar Histórico
              </div>
            </button>
          );
        })}
      </div>
      </div>
    );
  };

  const renderDiffContent = () => {
    if (!selectedSource || !activeSource) return null;

    return (
      <div className="flex flex-col h-full bg-[#010308]">
        <div className="p-4 border-b border-border/20 bg-black/40 flex flex-col sm:flex-row sm:items-center gap-4 justify-between shrink-0">
          <div className="flex flex-col gap-1">
            <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Comparação de Histórico</div>
            <div className="font-mono text-[12px] text-white font-bold">{activeSource.label || activeSource.kind}</div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 bg-black/60 p-2 border border-border/30">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label htmlFor="version-select-base" className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground shrink-0 w-12 text-right">Base:</label>
              <select
                id="version-select-base"
                data-testid="version-select-base"
                value={baseId}
                onChange={handleBaseChange}
                disabled={activeVersions.length < 2}
                className="w-full sm:w-40 bg-[#0a0a0a] border border-border/40 text-[10px] font-mono p-1.5 text-white focus-visible:outline-none focus-visible:border-primary/60 disabled:opacity-50"
              >
                <option value="" disabled>Selecione...</option>
                {activeVersions.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.label ? `${v.label} ` : ''}({v.id.substring(0, 6)})
                  </option>
                ))}
              </select>
            </div>
            <div className="hidden sm:block text-muted-foreground/30"><GitCompare className="h-3 w-3" /></div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label htmlFor="version-select-target" className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground shrink-0 w-12 text-right">Target:</label>
              <select
                id="version-select-target"
                data-testid="version-select-target"
                value={targetId}
                onChange={handleTargetChange}
                disabled={activeVersions.length < 2}
                className="w-full sm:w-40 bg-[#0a0a0a] border border-border/40 text-[10px] font-mono p-1.5 text-white focus-visible:outline-none focus-visible:border-primary/60 disabled:opacity-50"
              >
                <option value="" disabled>Selecione...</option>
                {activeVersions.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.label ? `${v.label} ` : ''}({v.id.substring(0, 6)})
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCompare}
              disabled={activeVersions.length < 2 || baseId === targetId || isFetchingDiff || isLoadingDiff}
              data-testid="btn-compare-versions"
              className="font-mono text-[9px] uppercase tracking-widest bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 w-full sm:w-auto"
            >
              Atualizar Diff
            </Button>
          </div>
        </div>

        <div
          className="flex-1 overflow-y-auto hide-scrollbar relative"
          aria-live="polite"
          aria-busy={submittedMatchesSelection && (isLoadingDiff || isFetchingDiff)}
        >
          {activeVersions.length < 2 ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-center p-6">
              <History className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <div className="font-mono text-[11px] uppercase tracking-widest text-white/50 font-bold mb-2">Histórico Insuficiente</div>
              <p className="font-mono text-[9px] text-muted-foreground max-w-md">Menos de duas versões persistidas. A comparação exige pelo menos duas versões distintas.</p>
            </div>
          ) : baseId === targetId ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-center p-6">
              <GitCompare className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <div className="font-mono text-[11px] uppercase tracking-widest text-white/50 font-bold mb-2">Versões Idênticas</div>
              <p className="font-mono text-[9px] text-muted-foreground max-w-md">Selecione duas versões diferentes para comparar.</p>
            </div>
          ) : !submittedMatchesSelection ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-center p-6">
              <GitCompare className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <div className="font-mono text-[11px] uppercase tracking-widest text-white/50 font-bold mb-2">Pronto para Comparar</div>
              <p className="font-mono text-[9px] text-muted-foreground max-w-md">Selecione as versões base e target e clique em Atualizar Diff.</p>
            </div>
          ) : isLoadingDiff || isFetchingDiff ? (
            <div className="flex flex-col items-center justify-center min-h-[300px]">
              <RefreshCw className="h-6 w-6 text-primary animate-spin mb-3" />
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Calculando diff determinístico...</div>
            </div>
          ) : isErrorDiff ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-center p-6" role="alert">
              <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
              <div className="font-mono text-[11px] uppercase tracking-widest text-destructive font-bold mb-2">Falha no Diff</div>
              <p className="font-mono text-[9px] text-muted-foreground mb-4 max-w-md">{(diffError as Error)?.message || "Não foi possível comparar as versões."}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void refetchDiff()} className="font-mono text-[10px] uppercase tracking-widest">
                Tentar Novamente
              </Button>
            </div>
          ) : !diffResponse || !diffResponse.available ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-center p-6">
              <XCircle className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Diff Indisponível</div>
              <p className="font-mono text-[9px] text-muted-foreground max-w-md">{diffResponse?.warnings?.[0] || "Não foi possível realizar a comparação determinística."}</p>
            </div>
          ) : (
            <div className="p-4 flex flex-col gap-6">
              {/* Summary */}
              {(() => {
                const summary = diffResponse.summary as ControlRoomDiffSummary;
                
                return (
                  <div className="flex flex-col gap-4">
                    {diffResponse.warnings && diffResponse.warnings.length > 0 && (
                      <div className="bg-[#FFB000]/10 border border-[#FFB000]/30 p-3 flex flex-col gap-2">
                        {diffResponse.warnings.map((w, i) => (
                          <div key={i} className="flex items-center gap-2 text-[#FFB000] font-mono text-[9px] uppercase tracking-widest">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            {w}
                          </div>
                        ))}
                      </div>
                    )}
                    {summary.truncated && (
                      <div className="bg-[#FFB000]/10 border border-[#FFB000]/30 p-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-[#FFB000] shrink-0" />
                        <span className="font-mono text-[10px] text-[#FFB000] uppercase tracking-widest">Aviso: comparison_incomplete_due_to_limits. O volume de alterações excede os limites de processamento da UI. Algumas modificações podem não estar listadas.</span>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="bg-success/10 border border-success/20 p-3 flex flex-col items-center justify-center text-center">
                        <span className="font-mono text-[18px] font-bold text-success" data-testid="diff-summary-added">{summary.added || 0}</span>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-success/80 mt-1">Adicionados</span>
                      </div>
                      <div className="bg-destructive/10 border border-destructive/20 p-3 flex flex-col items-center justify-center text-center">
                        <span className="font-mono text-[18px] font-bold text-destructive" data-testid="diff-summary-removed">{summary.removed || 0}</span>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-destructive/80 mt-1">Removidos</span>
                      </div>
                      <div className="bg-[#FFB000]/10 border border-[#FFB000]/20 p-3 flex flex-col items-center justify-center text-center">
                        <span className="font-mono text-[18px] font-bold text-[#FFB000]" data-testid="diff-summary-changed">{summary.changed || 0}</span>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-[#FFB000]/80 mt-1">Alterados</span>
                      </div>
                      <div className="bg-white/5 border border-white/10 p-3 flex flex-col items-center justify-center text-center">
                        <span className="font-mono text-[18px] font-bold text-muted-foreground" data-testid="diff-summary-unchanged">{summary.unchanged || 0}</span>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/80 mt-1">Inalterados</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Changes */}
              {(() => {
                const changes = diffResponse.changes || [];
                const summary = diffResponse.summary as ControlRoomDiffSummary;

                if (changes.length === 0) {
                  if (summary.truncated) {
                    return (
                      <div className="p-8 text-center border border-dashed border-border/30 bg-black/20">
                        <AlertTriangle className="h-8 w-8 text-[#FFB000]/50 mx-auto mb-3" />
                        <div className="font-mono text-[11px] uppercase tracking-widest text-[#FFB000]/80 font-bold mb-2">Exibição Truncada</div>
                        <p className="font-mono text-[9px] text-muted-foreground">Existem alterações, mas não puderam ser exibidas devido ao limite de processamento de diff visual.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="p-8 text-center border border-dashed border-border/30 bg-black/20">
                      <CheckCircle2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                      <div className="font-mono text-[11px] uppercase tracking-widest text-white/50 font-bold mb-2">Sem Diferenças Visíveis</div>
                      <p className="font-mono text-[9px] text-muted-foreground">Nenhuma alteração determinística encontrada entre as duas versões nestas categorias.</p>
                    </div>
                  );
                }

                return (
                  <div className="flex flex-col gap-4">
                    <h3 className="font-mono text-[11px] uppercase tracking-widest text-white font-bold border-b border-border/20 pb-2">Entradas Alteradas</h3>
                    <div className="flex flex-col gap-3">
                      {changes.map((change, index) => {
                        const isAdded = change.kind === "added";
                        const isRemoved = change.kind === "removed";
                        const isChanged = change.kind === "changed";
                        
                        let colorClass = "border-border/30 bg-black/40";
                        let titleColor = "text-white";
                        let badgeClass = "bg-white/10 text-white";
                        
                        if (isAdded) {
                          colorClass = "border-success/30 bg-success/5";
                          titleColor = "text-success";
                          badgeClass = "bg-success/20 text-success border-success/30";
                        } else if (isRemoved) {
                          colorClass = "border-destructive/30 bg-destructive/5";
                          titleColor = "text-destructive";
                          badgeClass = "bg-destructive/20 text-destructive border-destructive/30";
                        } else if (isChanged) {
                          colorClass = "border-[#FFB000]/30 bg-[#FFB000]/5";
                          titleColor = "text-[#FFB000]";
                          badgeClass = "bg-[#FFB000]/20 text-[#FFB000] border-[#FFB000]/30";
                        }

                        return (
                          <div 
                            key={index} 
                            className={`border p-3 flex flex-col gap-3 overflow-hidden ${colorClass}`}
                            data-testid={`diff-change-${index}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex flex-col gap-1 min-w-0">
                                <div className={`font-mono text-[10px] break-all ${titleColor} font-bold`}>{change.path}</div>
                                {change.category && (
                                  <div className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground">{change.category}</div>
                                )}
                              </div>
                              <div className={`px-1.5 py-0.5 border font-mono text-[8px] uppercase tracking-widest shrink-0 ${badgeClass}`}>
                                {change.kind}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border/20 border border-border/20">
                              {(isRemoved || isChanged) && (
                                <div className="bg-[#1f0f0f] p-2 overflow-x-auto">
                                  <div className="font-mono text-[8px] uppercase tracking-widest text-destructive/60 mb-1.5">Antes (Base)</div>
                                  <pre className="font-mono text-[10px] text-destructive/90 whitespace-pre-wrap">
                                    {typeof change.before === 'object' ? JSON.stringify(change.before, null, 2) : String(change.before)}
                                  </pre>
                                </div>
                              )}
                              {(isAdded || isChanged) && (
                                <div className="bg-[#0f1f15] p-2 overflow-x-auto">
                                  <div className="font-mono text-[8px] uppercase tracking-widest text-success/60 mb-1.5">Depois (Target)</div>
                                  <pre className="font-mono text-[10px] text-success/90 whitespace-pre-wrap">
                                    {typeof change.after === 'object' ? JSON.stringify(change.after, null, 2) : String(change.after)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="max-h-[95vh] h-[95vh] border-primary/25 bg-[#030712] text-foreground flex flex-col focus-visible:outline-none"
        onKeyDownCapture={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            if (selectedSource) {
              event.stopPropagation();
              setSelectedSource(null);
            } else {
              onOpenChange(false);
            }
          }
        }}
      >
        <div className="mx-auto w-full max-w-[1200px] overflow-hidden flex flex-col h-full">
          <DrawerHeader className="border-b border-border/20 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#030712]">
            <div className="flex items-center gap-4">
              {selectedSource && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="p-1.5 border border-border/40 bg-black/40 hover:bg-white/5 hover:border-border/80 transition-colors text-muted-foreground hover:text-white shrink-0"
                  aria-label="Voltar para o catálogo"
                  data-testid="btn-back-version-diff"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <div>
                <DrawerTitle className="font-mono text-sm uppercase tracking-widest text-primary flex items-center gap-2">
                  <FileDiff className="h-4 w-4" />
                  Version Control
                </DrawerTitle>
                <DrawerDescription className="font-mono text-[10px] uppercase tracking-wider mt-1 text-muted-foreground">
                  {selectedSource ? (
                    <span>Comparando versões para {selectedSource.id}</span>
                  ) : (
                    <span>Catálogo de fontes versionadas</span>
                  )}
                </DrawerDescription>
              </div>
            </div>
            <DrawerClose asChild>
              <Button 
                type="button"
                variant="outline" 
                size="sm" 
                className="font-mono text-[10px] uppercase tracking-widest border-border/30 hover:bg-white/5"
                data-testid="btn-close-version-diff"
              >
                Fechar
              </Button>
            </DrawerClose>
          </DrawerHeader>

          <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar bg-[#010308]">
            {selectedSource ? renderDiffContent() : renderSourceList()}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
