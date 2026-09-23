import { useState, useEffect, useMemo, useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  getCampaignControlRoomPreviews, 
  type GetCampaignControlRoomPreviewsParams,
  type ControlRoomPreviewKind,
  type ControlRoomPreviewRecord,
  type ControlRoomPreviewsResponse,
} from "@workspace/api-client-react";
import {
  XCircle, Filter, Calendar, Type, Search, Activity, Terminal, RefreshCw, Eye, ArrowLeft, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

function findUrl(obj: any, keys: string[]): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  
  const isSafeUrl = (u: any) => typeof u === 'string' && (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('/'));
  
  for (const k of keys) {
    if (isSafeUrl(obj[k])) return obj[k];
    if (Array.isArray(obj[k]) && obj[k].length > 0 && isSafeUrl(obj[k][0])) {
      return obj[k][0];
    }
  }
  
  const nested = obj.content || obj.concept || obj.script || obj.storyboard || obj.html;
  if (nested && typeof nested === 'object') {
     for (const k of keys) {
       if (isSafeUrl(nested[k])) return nested[k];
       if (Array.isArray(nested[k]) && nested[k].length > 0 && isSafeUrl(nested[k][0])) {
         return nested[k][0];
       }
     }
  }
  return undefined;
}

function sanitizeHtml(html: string): string | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const removeTags = ['script', 'style', 'link', 'meta', 'base', 'iframe', 'object', 'embed', 'svg', 'math', 'form', 'input', 'button', 'select', 'textarea'];
    
    removeTags.forEach(tag => {
      const elements = doc.getElementsByTagName(tag);
      for (let i = elements.length - 1; i >= 0; i--) {
        elements[i].parentNode?.removeChild(elements[i]);
      }
    });

    const allElements = doc.getElementsByTagName('*');
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i];
      const attrs = Array.from(el.attributes);
      for (let j = 0; j < attrs.length; j++) {
        el.removeAttribute(attrs[j].name);
      }
    }

    return doc.body.innerHTML;
  } catch (e) {
    return null;
  }
}

function PreviewText({ content }: { content: unknown }) {
  const text = typeof content === "string" ? content : (
    (content as any)?.text || (content as any)?.body || (content as any)?.content?.text || (content as any)?.script?.text || JSON.stringify(content, null, 2)
  );
  return <div className="font-sans text-sm text-foreground whitespace-pre-wrap p-4 bg-black/40 border border-white/5 rounded-sm">{text}</div>;
}

function PreviewImage({ content, title }: { content: unknown, title: string }) {
  const url = typeof content === "string" && (content.startsWith('http') || content.startsWith('/'))
    ? content
    : findUrl(content, ['mediaUrl', 'mediaUrls', 'previewUrl', 'finalUrl', 'lowResUrl', 'url', 'src', 'imageUrl']);
  
  const alt = (content as any)?.alt || title || "Preview image";
  
  if (!url) return <PreviewStructured content={content} />;
  
  return (
    <div className="flex flex-col items-center gap-3">
      <img src={url} alt={alt} className="max-w-full h-auto object-contain max-h-[60vh] border border-border/20 bg-black/50" />
      {alt !== "Preview image" && <div className="text-xs text-muted-foreground font-mono">{alt}</div>}
    </div>
  );
}

function PreviewVideo({ content, title }: { content: unknown, title: string }) {
  const url = typeof content === "string" && (content.startsWith('http') || content.startsWith('/'))
    ? content
    : findUrl(content, ['finalVideoUrl', 'mediaUrl', 'mediaUrls', 'previewUrl', 'finalUrl', 'lowResUrl', 'url', 'src']);
    
  const poster = typeof content === "object" && content ? findUrl(content, ['poster', 'thumbnail']) : undefined;
  const alt = (content as any)?.alt || title || "Preview video";

  if (!url) return <PreviewStructured content={content} />;

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <video src={url} poster={poster} controls className="max-w-full h-auto object-contain max-h-[60vh] border border-border/20 bg-black/50" aria-label={alt}>
        <p className="text-xs text-muted-foreground font-mono">Vídeo indisponível nativamente: <a href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{alt}</a>.</p>
      </video>
    </div>
  );
}

function PreviewPage({ content }: { content: unknown }) {
  const htmlRaw = typeof content === "string" ? content : (content as any)?.html || (content as any)?.content?.html;
  
  if (typeof htmlRaw === "string") {
    const safeHtml = sanitizeHtml(htmlRaw);
    if (safeHtml) {
      return (
        <div className="w-full h-[70vh] border border-border/30 bg-white">
          <iframe srcDoc={safeHtml} sandbox="" className="w-full h-full border-0 bg-white" title="Page Preview" />
        </div>
      );
    }
  }
  return <PreviewStructured content={content} />;
}

function PreviewMessage({ content }: { content: unknown }) {
  let text = "";
  if (typeof content === "string") text = content;
  else if (typeof content === "object" && content) {
    text = (content as any)?.text || (content as any)?.body || (content as any)?.content?.text || (content as any)?.message || "";
  }
  const sender = (content as any)?.sender || (content as any)?.content?.sender;
  
  return (
    <div className="flex flex-col gap-2 max-w-md w-full mx-auto">
      <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 rounded-tl-sm">
        {sender && <div className="text-[10px] uppercase tracking-widest text-primary mb-2 font-bold">{sender}</div>}
        <div className="font-sans text-sm whitespace-pre-wrap text-foreground/90">{text}</div>
      </div>
      <PreviewStructured content={content} skipKeys={["text", "body", "sender"]} />
    </div>
  );
}

function PreviewAd({ content }: { content: unknown }) {
  const obj = (typeof content === "object" && content) ? content : {};
  const nested = (obj as any).content || (obj as any).concept || obj;
  
  const headline = nested.headline || nested.title;
  const body = nested.body || nested.text || nested.primaryText;
  const imageUrl = findUrl(obj, ['imageUrl', 'mediaUrl', 'previewUrl', 'url', 'src', 'image']);
  const cta = nested.cta || nested.callToAction || "Learn More";

  return (
    <div className="max-w-sm w-full border border-border/30 bg-black overflow-hidden flex flex-col mx-auto shadow-xl">
      {imageUrl && (
        <div className="w-full aspect-[4/5] bg-black/50 border-b border-border/20 flex items-center justify-center relative overflow-hidden">
          <img src={imageUrl} alt="Ad media" className="absolute inset-0 w-full h-full object-cover blur-sm opacity-30" />
          <img src={imageUrl} alt="Ad media" className="relative max-w-full max-h-full object-contain" />
        </div>
      )}
      <div className="p-5 flex flex-col gap-3">
        {headline && <div className="font-sans font-bold text-base text-foreground leading-tight">{headline}</div>}
        {body && <div className="font-sans text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{body}</div>}
        <button type="button" className="mt-3 w-full py-2.5 bg-primary/20 border border-primary/30 text-primary text-xs uppercase tracking-widest font-bold cursor-not-allowed opacity-80" disabled data-testid="ad-preview-cta">
          {cta} (Simulated)
        </button>
      </div>
      <PreviewStructured content={content} skipKeys={["headline", "title", "body", "text", "primaryText", "imageUrl", "mediaUrl", "cta", "callToAction"]} />
    </div>
  );
}

function PreviewStructured({ content, skipKeys = [] }: { content: unknown, skipKeys?: string[] }) {
  if (content === undefined || content === null) return null;
  if (typeof content !== "object") {
    return <div className="font-mono text-[10px] text-muted-foreground whitespace-pre-wrap p-4 bg-black/40 border border-white/5">{String(content)}</div>;
  }
  
  const displayObj = { ...content as any };
  skipKeys.forEach(k => delete displayObj[k]);
  
  if (Object.keys(displayObj).length === 0) return null;

  return (
    <div className="mt-6 relative w-full">
      <div className="absolute top-0 left-0 px-2 py-0.5 bg-white/10 text-[8px] text-white/50 uppercase tracking-widest z-10 border-b border-r border-white/10">Structured Data</div>
      <pre className="pt-7 pb-3 px-4 border border-white/5 bg-[#050505] text-[10px] text-muted-foreground/80 whitespace-pre-wrap break-words overflow-x-auto max-w-full">
        {JSON.stringify(displayObj, null, 2)}
      </pre>
    </div>
  );
}

function UniversalPreviewRenderer({ record }: { record: ControlRoomPreviewRecord }) {
  if (record.preview.state === "unavailable") {
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center border border-dashed border-border/30 bg-black/20 h-full w-full">
        <XCircle className="h-10 w-10 text-muted-foreground/30 mb-4" />
        <div className="font-mono text-[12px] uppercase tracking-widest text-muted-foreground font-bold">Preview Indisponível</div>
        {record.preview.reason ? (
          <div className="font-mono text-[10px] text-muted-foreground/60 mt-2 max-w-md">{record.preview.reason}</div>
        ) : (
          <div className="font-mono text-[10px] text-muted-foreground/60 mt-2">Nenhum conteúdo de preview encontrado.</div>
        )}
      </div>
    );
  }

  const { representation, content } = record.preview;

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4 md:p-8 w-full">
      {(() => {
        switch (representation) {
          case "text": return <PreviewText content={content} />;
          case "image": return <PreviewImage content={content} title={record.source.title} />;
          case "video": return <PreviewVideo content={content} title={record.source.title} />;
          case "page": return <PreviewPage content={content} />;
          case "message": return <PreviewMessage content={content} />;
          case "ad": return <PreviewAd content={content} />;
          case "structured": 
          default:
            return <PreviewStructured content={content} />;
        }
      })()}
    </div>
  );
}

export function UniversalPreviewDrawer({
  open,
  onOpenChange,
  campaignId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
}) {
  const [filters, setFilters] = useState({
    kind: "",
    status: "",
    updatedFrom: "",
    updatedTo: ""
  });
  const [selectedRecord, setSelectedRecord] = useState<ControlRoomPreviewRecord | null>(null);

  useEffect(() => {
    if (open) {
      setFilters({ kind: "", status: "", updatedFrom: "", updatedTo: "" });
      setSelectedRecord(null);
    }
  }, [open]);

  const validationError = useMemo(() => {
    if (filters.updatedFrom && filters.updatedTo) {
      const f = new Date(filters.updatedFrom).getTime();
      const t = new Date(filters.updatedTo).getTime();
      if (!isNaN(f) && !isNaN(t) && f >= t) return "Data inicial deve ser menor que a data final.";
    }
    return null;
  }, [filters]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    isLoading,
    isError,
    error,
    refetch
  } = useInfiniteQuery<ControlRoomPreviewsResponse, Error>({
    queryKey: ["/api/campaigns", campaignId, "control-room", "previews", filters],
    queryFn: async ({ pageParam }) => {
      const params: GetCampaignControlRoomPreviewsParams = {
        limit: 20,
      };
      if (pageParam) params.cursor = String(pageParam);
      if (filters.kind) params.kind = filters.kind as ControlRoomPreviewKind;
      if (filters.status) params.status = filters.status;
      if (filters.updatedFrom) {
        const d = new Date(filters.updatedFrom);
        if (!isNaN(d.getTime())) params.updatedFrom = d.toISOString();
      }
      if (filters.updatedTo) {
        const d = new Date(filters.updatedTo);
        if (!isNaN(d.getTime())) params.updatedTo = d.toISOString();
      }
      return getCampaignControlRoomPreviews(campaignId, params);
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.nextCursor : undefined,
    enabled: open && !validationError,
  });

  const allRecords = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, ControlRoomPreviewRecord>();
    data.pages.forEach(p => {
      p.records.forEach(r => {
        map.set(`${r.source.kind}-${r.source.id}`, r);
      });
    });
    return Array.from(map.values());
  }, [data]);

  const firstPage = data?.pages[0];
  const total = firstPage?.total ?? 0;
  const loaded = allRecords.length;
  const appliedFiltersCount = Object.values(filters).filter(Boolean).length;
  const isInitialLoading = isLoading && allRecords.length === 0;
  const isInitialError = isError && allRecords.length === 0;

  const handleReset = () => {
    setFilters({ kind: "", status: "", updatedFrom: "", updatedTo: "" });
  };
  
  const onRetryInitial = useCallback(() => {
    refetch();
  }, [refetch]);

  const onRetryNextPage = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="max-h-[95vh] h-[95vh] border-primary/25 bg-[#030712] text-foreground flex flex-col focus-visible:outline-none"
        onKeyDownCapture={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            if (selectedRecord) {
              event.stopPropagation();
              setSelectedRecord(null);
            } else {
              onOpenChange(false);
            }
          }
        }}
      >
        <div className="mx-auto w-full max-w-[1400px] overflow-hidden flex flex-col h-full">
          {/* Header */}
          <DrawerHeader className="border-b border-border/20 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#030712]">
            <div className="flex items-center gap-4">
              {selectedRecord && (
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="p-1.5 border border-border/40 bg-black/40 hover:bg-white/5 hover:border-border/80 transition-colors text-muted-foreground hover:text-white shrink-0"
                  aria-label="Voltar para a lista"
                  data-testid="btn-back-to-preview-list"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <div>
                <DrawerTitle className="font-mono text-sm uppercase tracking-widest text-primary flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Universal Previews
                </DrawerTitle>
                <DrawerDescription className="font-mono text-[10px] uppercase tracking-wider mt-1 text-muted-foreground">
                  {selectedRecord ? (
                    <span>Visualizando: {selectedRecord.source.title}</span>
                  ) : isLoading ? (
                    <span className="animate-pulse">Consultando previews...</span>
                  ) : (
                    <span>Exibindo {loaded} de {total} itens persistidos</span>
                  )}
                  {!selectedRecord && appliedFiltersCount > 0 && ` • ${appliedFiltersCount} filtro(s) ativo(s)`}
                </DrawerDescription>
              </div>
            </div>
            {!selectedRecord && validationError && (
              <div className="px-3 py-1.5 border border-destructive/30 bg-destructive/10 text-destructive font-mono text-[9px] uppercase tracking-wider flex items-center gap-2 shrink-0">
                <Activity className="h-3 w-3" />
                {validationError}
              </div>
            )}
            {selectedRecord && selectedRecord.sourceLink && (
              <Link
                href={selectedRecord.sourceLink}
                className="inline-flex h-8 items-center justify-center rounded-md border border-primary/30 px-3 text-[9px] uppercase tracking-widest text-primary hover:bg-primary/10 font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
                data-testid={`link-source-${selectedRecord.source.id}`}
              >
                <ExternalLink className="h-3 w-3 mr-2" />
                Abrir Fonte Original
              </Link>
            )}
          </DrawerHeader>

          <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden bg-[#010308]">
            {/* List / Filters Area */}
            <div className={`flex flex-col lg:flex-row w-full h-full transition-all duration-300 ${selectedRecord ? "hidden lg:flex lg:w-80 border-r border-border/20 shrink-0" : "flex"}`}>
              {/* Filters Sidebar (Hidden when viewing detail on mobile, always visible on lg if not detail or maybe sidebar shrinks on detail) */}
              <div className={`w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-border/20 p-4 overflow-y-auto hide-scrollbar bg-black/20 flex flex-col gap-4 font-mono ${selectedRecord ? "hidden" : "flex shrink-0"}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-2">
                    <Filter className="h-3 w-3" />
                    Filtros
                  </h3>
                  {appliedFiltersCount > 0 && (
                    <button
                      onClick={handleReset}
                      className="text-[9px] uppercase tracking-widest text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
                      data-testid="btn-reset-preview-filters"
                    >
                      Resetar
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5" htmlFor="preview-filter-kind">
                      <Type className="h-3 w-3" /> Tipo (Kind)
                    </label>
                    <select
                      id="preview-filter-kind"
                      value={filters.kind}
                      onChange={e => setFilters(f => ({ ...f, kind: e.target.value }))}
                      className="w-full bg-black border border-border/30 text-[10px] p-1.5 text-white focus-visible:outline-none focus-visible:border-primary/60 transition-colors"
                      data-testid="select-preview-kind"
                    >
                      <option value="">Todos</option>
                      <option value="content_piece">Content Piece</option>
                      <option value="media_brief">Media Brief</option>
                      <option value="creative">Creative</option>
                      <option value="social_post">Social Post</option>
                      <option value="campaign_asset">Campaign Asset</option>
                      <option value="page">Page</option>
                      <option value="video_project">Video Project</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5" htmlFor="preview-filter-status">
                      <Terminal className="h-3 w-3" /> Status
                    </label>
                    <input
                      id="preview-filter-status"
                      type="text"
                      value={filters.status}
                      onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                      placeholder="ex: ready, approved..."
                      className="w-full bg-black border border-border/30 text-[10px] p-1.5 text-white focus-visible:outline-none focus-visible:border-primary/60 placeholder:text-muted-foreground/30 transition-colors"
                      data-testid="input-preview-status"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5" htmlFor="preview-filter-from">
                      <Calendar className="h-3 w-3" /> Modificado Após
                    </label>
                    <input
                      id="preview-filter-from"
                      type="datetime-local"
                      value={filters.updatedFrom}
                      onChange={e => setFilters(f => ({ ...f, updatedFrom: e.target.value }))}
                      className="w-full bg-black border border-border/30 text-[10px] p-1.5 text-white focus-visible:outline-none focus-visible:border-primary/60 [color-scheme:dark] transition-colors"
                      data-testid="input-preview-from"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5" htmlFor="preview-filter-to">
                      <Calendar className="h-3 w-3" /> Modificado Antes
                    </label>
                    <input
                      id="preview-filter-to"
                      type="datetime-local"
                      value={filters.updatedTo}
                      onChange={e => setFilters(f => ({ ...f, updatedTo: e.target.value }))}
                      className="w-full bg-black border border-border/30 text-[10px] p-1.5 text-white focus-visible:outline-none focus-visible:border-primary/60 [color-scheme:dark] transition-colors"
                      data-testid="input-preview-to"
                    />
                  </div>
                </div>
              </div>

              {/* Results List */}
              <div className={`flex-1 flex flex-col min-h-0 relative ${selectedRecord ? "lg:flex" : "flex"}`}>
                {isInitialLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCw className="h-6 w-6 text-primary animate-spin" />
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Carregando previews...</span>
                    </div>
                  </div>
                ) : isInitialError ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <XCircle className="h-8 w-8 text-destructive mb-3" />
                    <div className="font-mono text-[11px] uppercase tracking-widest text-destructive mb-2 font-bold">Falha na Busca</div>
                    <p className="font-mono text-[9px] text-muted-foreground max-w-md mb-4">{error?.message || "Erro ao carregar os previews."}</p>
                    <Button type="button" onClick={onRetryInitial} variant="outline" className="font-mono text-[10px] uppercase tracking-widest border-border/30 hover:bg-white/5" data-testid="btn-retry-previews">
                      Tentar Novamente
                    </Button>
                  </div>
                ) : allRecords.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <Search className="h-8 w-8 text-muted-foreground/30 mb-3" />
                    <div className="font-mono text-[11px] uppercase tracking-widest text-white/50 mb-2 font-bold">
                      {appliedFiltersCount > 0 ? "Nenhum preview para os filtros" : "Nenhum preview disponível"}
                    </div>
                    {appliedFiltersCount > 0 && (
                      <Button type="button" onClick={handleReset} variant="outline" className="mt-4 font-mono text-[10px] uppercase tracking-widest border-primary/30 text-primary hover:bg-primary/10" data-testid="btn-empty-reset-filters">
                        Limpar Filtros
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto hide-scrollbar p-0 flex flex-col divide-y divide-border/10 font-mono" aria-live="polite" aria-busy={isFetchingNextPage}>
                    {allRecords.map((rec) => {
                      const isSelected = selectedRecord?.source.id === rec.source.id && selectedRecord?.source.kind === rec.source.kind;
                      return (
                        <button
                          type="button"
                          key={`${rec.source.kind}-${rec.source.id}`}
                          onClick={() => setSelectedRecord(rec)}
                          className={`w-full text-left p-4 hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:bg-white/10 ${isSelected ? "bg-primary/10 border-l-2 border-primary" : "border-l-2 border-transparent bg-transparent"}`}
                          data-testid={`preview-item-${rec.source.kind}-${rec.source.id}`}
                        >
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[11px] uppercase tracking-wider text-white font-bold line-clamp-1">{rec.source.title}</span>
                              <span className={`px-1.5 py-0.5 border text-[8px] tracking-widest uppercase shrink-0 ${rec.preview.state === 'ready' ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive'}`} data-testid="list-preview-status">
                                {rec.preview.state}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[9px] text-muted-foreground uppercase tracking-widest">
                              <span className="text-primary/70">{rec.source.kind}</span>
                              <span className="opacity-40">•</span>
                              <span>{rec.source.type}</span>
                              <span className="opacity-40">•</span>
                              <span>{rec.preview.representation}</span>
                            </div>
                            <div className="text-[8px] text-muted-foreground/60 mt-1">
                              Atualizado: {new Date(rec.source.updatedAt).toLocaleString("pt-BR")}
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    {isFetchNextPageError && (
                      <div className="p-4 flex flex-col items-center gap-2 border-t border-destructive/20 bg-destructive/5" role="alert">
                        <div className="text-[10px] text-destructive uppercase tracking-widest">Falha ao carregar mais itens</div>
                        <Button type="button" onClick={onRetryNextPage} variant="outline" className="font-mono text-[9px] uppercase tracking-widest border-destructive/30 text-destructive" data-testid="btn-retry-next-page">
                          Tentar Novamente
                        </Button>
                      </div>
                    )}

                    {hasNextPage && !isFetchNextPageError && (
                      <div className="p-4 flex justify-center">
                        <Button
                          type="button"
                          onClick={onRetryNextPage}
                          disabled={isFetchingNextPage}
                          variant="outline"
                          className="font-mono text-[10px] uppercase tracking-widest border-primary/30 text-primary hover:bg-primary/10 w-full"
                          data-testid="btn-load-more-previews"
                        >
                          {isFetchingNextPage ? (
                            <><RefreshCw className="mr-2 h-3 w-3 animate-spin" /> Carregando...</>
                          ) : (
                            "Carregar Mais"
                          )}
                        </Button>
                      </div>
                    )}
                    
                    {!hasNextPage && allRecords.length > 0 && (
                      <div className="p-6 text-center font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 flex items-center justify-center gap-3">
                        <div className="h-px w-8 bg-border/20" />
                        Fim dos previews
                        <div className="h-px w-8 bg-border/20" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Detail Area */}
            {selectedRecord && (
              <div className="flex-1 flex flex-col min-h-0 bg-[#02040a] relative overflow-y-auto hide-scrollbar shadow-[-10px_0_30px_rgba(0,0,0,0.5)] lg:shadow-none z-10 w-full">
                {/* Header for detail on desktop (mobile already has global back button in drawer header) */}
                <div className="sticky top-0 z-20 bg-black/60 backdrop-blur-md border-b border-border/20 p-4 flex items-center justify-between gap-4">
                  <div className="flex flex-col min-w-0">
                    <h2 className="font-sans font-bold text-sm sm:text-base text-white truncate" data-testid="detail-preview-title">{selectedRecord.source.title}</h2>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mt-1 flex items-center gap-2">
                      <span className="text-primary">{selectedRecord.source.kind}</span>
                      <span>•</span>
                      <span>{selectedRecord.preview.representation}</span>
                      <span>•</span>
                      <span className={`${selectedRecord.preview.state === 'ready' ? 'text-success' : 'text-destructive'}`} data-testid="detail-preview-status">{selectedRecord.preview.state}</span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 w-full">
                  <UniversalPreviewRenderer record={selectedRecord} />
                </div>
              </div>
            )}
            
            {/* Empty Detail State (Desktop only) */}
            {!selectedRecord && (
              <div className="hidden lg:flex flex-1 flex-col items-center justify-center p-8 bg-[#02040a] text-center">
                <Eye className="h-12 w-12 text-white/5 mb-4" />
                <h3 className="font-mono text-[12px] uppercase tracking-widest text-white/30 font-bold mb-2">Nenhum Item Selecionado</h3>
                <p className="font-mono text-[10px] text-muted-foreground max-w-sm">Selecione um entregável na lista à esquerda para inspecionar sua representação em modo seguro.</p>
              </div>
            )}
          </div>

          <DrawerFooter className="border-t border-border/20 shrink-0 bg-[#030712] flex-row justify-end p-4">
            <DrawerClose asChild>
              <Button variant="outline" className="rounded-none font-mono text-[10px] uppercase tracking-widest border-border/40 hover:bg-white/5" data-testid="btn-close-universal-preview">
                Fechar Previews
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
