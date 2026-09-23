import { useState, useMemo } from "react";
import { 
  useListSocialIntelligenceInbox, 
  useListSocialIntelligenceReports, 
  useSaveSocialIntelligenceReport, 
  useGetSocialIntelligenceReport,
  getListSocialIntelligenceReportsQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, formatISO, subDays } from "date-fns";
import { ChevronLeft, ChevronRight, RefreshCw, Info, FileText } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface InboxItem {
  id: string;
  at: string;
  kind: string; 
  campaignId?: string;
  platform: string;
  status: string;
  deliveryStatus: string;
  commentText?: string | null;
  inputText?: string | null;
  replyText?: string | null;
  direction?: string | null;
}

interface ReportItem {
  id: string;
  periodFrom: string;
  periodTo: string;
  aggregates: Record<string, any>;
  provenance: Record<string, any>;
  rowCount: number;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDeliveryLabel(status?: string) {
  switch (status?.toLowerCase()) {
    case 'historically_sent': return { label: 'ENVIO REGISTRADO', color: 'text-success border-success/40 bg-success/10' };
    case 'not_sent': return { label: 'SEM ENVIO CONFIRMADO', color: 'text-muted-foreground border-border/40 bg-muted/10' };
    default: return { label: 'ESTADO DESCONHECIDO', color: 'text-muted-foreground border-border/40 bg-muted/10' };
  }
}

const PRESETS = [
  { label: "7 Dias", days: 7 },
  { label: "30 Dias", days: 30 },
  { label: "365 Dias", days: 365 }
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function ReportModal({ id, onClose }: { id: string, onClose: () => void }) {
  const { data, isLoading, isError } = useGetSocialIntelligenceReport(id);
  const report = data as unknown as ReportItem;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="border border-border/70 bg-card w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col">
        <div className="border-b border-border/50 px-5 py-4 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-mono font-bold text-sm uppercase tracking-wide">Detalhes do Snapshot</h3>
            <p className="text-xs font-mono text-muted-foreground/60 uppercase tracking-widest mt-0.5">ID: {id}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar detalhes do relatório" className="text-muted-foreground hover:text-foreground transition-colors font-mono text-lg leading-none">×</button>
        </div>
        
        <div className="p-5 overflow-y-auto flex-1 font-mono text-sm">
           {isLoading ? (
             <div className="space-y-4">
               <Skeleton className="h-10 bg-card/40" />
               <Skeleton className="h-32 bg-card/40" />
             </div>
           ) : isError ? (
             <div className="text-destructive text-xs uppercase tracking-widest border border-destructive/40 bg-destructive/10 p-4">
               Erro ao carregar detalhes do relatório.
             </div>
           ) : report ? (
             <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 border border-border/40 p-4 bg-muted/5">
                   <div>
                     <div className="text-[10px] text-muted-foreground/60 uppercase tracking-widest mb-1">Período Analisado</div>
                     <div className="text-xs font-bold text-foreground">
                       {report.periodFrom ? format(new Date(report.periodFrom), "dd/MM/yyyy") : "—"} até {report.periodTo ? format(new Date(report.periodTo), "dd/MM/yyyy") : "—"}
                     </div>
                   </div>
                   <div>
                     <div className="text-[10px] text-muted-foreground/60 uppercase tracking-widest mb-1">Registros Salvos</div>
                     <div className="text-xs font-bold text-foreground">{report.rowCount ?? "0"}</div>
                   </div>
                </div>

                {report.aggregates && Object.keys(report.aggregates).length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-primary mb-3">Agregações</h4>
                    <div className="bg-muted/10 border border-border/30 p-3 whitespace-pre-wrap text-xs text-foreground/80 overflow-x-auto">
                      {JSON.stringify(report.aggregates, null, 2)}
                    </div>
                  </div>
                )}

                {report.provenance && Object.keys(report.provenance).length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-primary mb-3">Proveniência</h4>
                    <div className="bg-muted/10 border border-border/30 p-3 whitespace-pre-wrap text-xs text-foreground/80 overflow-x-auto">
                      {JSON.stringify(report.provenance, null, 2)}
                    </div>
                  </div>
                )}
             </div>
           ) : (
             <div className="text-muted-foreground text-xs uppercase tracking-widest">Relatório não encontrado.</div>
           )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Tab ────────────────────────────────────────────────────────────────

export function SocialIntelligenceTab() {
  const queryClient = useQueryClient();
  const [days, setDays] = useState<number | null>(7);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | undefined>(undefined);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const dateFrom = useMemo(() => days ? formatISO(subDays(new Date(), days)) : undefined, [days]);
  
  const inboxParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (dateFrom) p.from = dateFrom;
    if (currentCursor) p.cursor = currentCursor;
    return p;
  }, [dateFrom, currentCursor]);

  const { data: inboxData, isLoading: isInboxLoading, isFetching: isInboxFetching, isError: isInboxError } = useListSocialIntelligenceInbox(inboxParams as any);
  
  const { data: reportsData, isLoading: isReportsLoading } = useListSocialIntelligenceReports();
  const saveMutation = useSaveSocialIntelligenceReport();

  const handleNextPage = () => {
    const next = (inboxData as any)?.nextCursor;
    if (next) {
      setCursorStack(prev => [...prev, currentCursor || ""]);
      setCurrentCursor(next);
    }
  };

  const handlePrevPage = () => {
    if (cursorStack.length === 0) return;
    const newStack = [...cursorStack];
    const prev = newStack.pop();
    setCursorStack(newStack);
    setCurrentCursor(prev === "" ? undefined : prev);
  };

  const handleFilterChange = (d: number | null) => {
    setDays(d);
    setCursorStack([]);
    setCurrentCursor(undefined);
  };

  const handleSaveSnapshot = () => {
    saveMutation.mutate({ data: { from: dateFrom } }, {
      onSuccess: () => {
        toast.success("Snapshot salvo com sucesso");
        queryClient.invalidateQueries({ queryKey: getListSocialIntelligenceReportsQueryKey() });
      },
      onError: (err: any) => {
        const status = err?.status || err?.response?.status;
        const msg = status === 403 
          ? "Acesso negado: apenas o proprietário pode salvar snapshots." 
          : "Erro ao salvar snapshot de inteligência";
        toast.error(msg);
      }
    });
  };

  const inboxItems = (inboxData as any)?.items as InboxItem[] | undefined;
  const reportsList = (reportsData as any)?.reports as ReportItem[] | undefined;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {selectedReportId && <ReportModal id={selectedReportId} onClose={() => setSelectedReportId(null)} />}
      
      {/* Main Inbox */}
      <div className="flex-1 space-y-4">
        <div className="flex flex-wrap items-center justify-between border-b border-border/50 pb-4 gap-3">
          <div>
            <h2 className="text-sm font-mono font-bold uppercase tracking-wide">Inbox de Inteligência</h2>
            <p className="text-[11px] font-mono text-muted-foreground/60 tracking-widest uppercase">Histórico de interações sociais e eventos</p>
          </div>
          <div className="flex items-center gap-2">
            {PRESETS.map(p => (
              <Button key={p.label} variant={days === p.days ? "secondary" : "outline"} size="sm" 
                onClick={() => handleFilterChange(p.days)}
                className="h-7 text-[10px] rounded-none font-mono uppercase tracking-widest transition-colors">
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {isInboxLoading ? (
            [1,2,3].map(i => <Skeleton key={i} className="h-24 bg-card/40" />)
          ) : isInboxError ? (
            <div className="border border-destructive/40 bg-destructive/10 p-4 text-destructive font-mono text-xs uppercase tracking-widest">
              Erro ao carregar dados do inbox.
            </div>
          ) : !inboxItems || inboxItems.length === 0 ? (
            <div className="border border-border/30 bg-card/30 py-12 text-center text-muted-foreground font-mono text-xs uppercase tracking-widest">
              Nenhuma interação encontrada no período
            </div>
          ) : (
            <div className="space-y-2">
              {inboxItems.map(item => {
                const delivery = getDeliveryLabel(item.deliveryStatus);
                const content = item.kind === 'comment'
                  ? (item.commentText || 'Comentário registrado sem texto disponível')
                  : (item.direction === 'outbound' ? item.replyText : item.inputText)
                    || item.inputText || item.replyText || 'Mensagem registrada sem texto disponível';
                return (
                  <div key={item.id} className="border border-border/50 bg-card/40 p-4 transition-colors hover:border-primary/30 scanline-overlay relative group">
                    <div className="relative z-20">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="rounded-none font-mono text-[10px] px-1.5 py-0 border-primary/40 text-primary uppercase tracking-widest">{item.platform}</Badge>
                          <Badge variant="outline" className="rounded-none font-mono text-[10px] px-1.5 py-0 border-border/50 text-muted-foreground uppercase tracking-widest">{item.kind}</Badge>
                          <Badge variant="outline" className={`rounded-none font-mono text-[10px] px-1.5 py-0 uppercase tracking-widest ${delivery.color}`}>{delivery.label}</Badge>
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground/50 whitespace-nowrap">
                          {item.at ? format(new Date(item.at), "dd/MM/yy HH:mm") : "—"}
                        </div>
                      </div>
                      <div className="text-xs font-mono text-foreground/80 leading-relaxed line-clamp-3">
                        {content}
                      </div>
                      {item.status && (
                        <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">
                          <Info className="h-3 w-3" />
                          Processamento: {item.status}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {inboxData && (
            <div className="flex items-center justify-between border-t border-border/50 pt-4">
              <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={cursorStack.length === 0 || isInboxFetching} 
                className="h-8 rounded-none font-mono text-[11px] uppercase tracking-widest gap-2">
                <ChevronLeft className="h-3.5 w-3.5" /> Anterior
              </Button>
              {isInboxFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              <Button variant="outline" size="sm" onClick={handleNextPage} disabled={!(inboxData as any)?.nextCursor || isInboxFetching} 
                className="h-8 rounded-none font-mono text-[11px] uppercase tracking-widest gap-2">
                Próxima <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar / Reports */}
      <div className="lg:w-80 space-y-4 shrink-0">
        <div className="flex items-center justify-between border-b border-border/50 pb-4">
          <div>
            <h2 className="text-sm font-mono font-bold uppercase tracking-wide">Snapshots</h2>
            <p className="text-[11px] font-mono text-muted-foreground/60 tracking-widest uppercase">Relatórios salvos</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleSaveSnapshot} disabled={saveMutation.isPending} 
            className="h-7 text-[10px] rounded-none font-mono uppercase tracking-widest btn-weapon-outline border-primary/30 text-primary bg-primary/5 hover:bg-primary/10">
            {saveMutation.isPending ? "Salvando..." : "Salvar Atual"}
          </Button>
        </div>

        <div className="space-y-3">
          {isReportsLoading ? (
            [1,2].map(i => <Skeleton key={i} className="h-20 bg-card/40" />)
          ) : !reportsList || reportsList.length === 0 ? (
            <div className="border border-border/30 bg-card/30 p-6 text-center text-muted-foreground font-mono text-xs uppercase tracking-widest">
              Nenhum snapshot salvo
            </div>
          ) : (
            <div className="space-y-2">
              {reportsList.map(report => (
                <button key={report.id} onClick={() => setSelectedReportId(report.id)} 
                  className="w-full text-left border border-border/50 bg-card/40 p-3 hover:border-primary/40 hover:bg-primary/5 transition-colors group">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-mono text-xs font-bold text-foreground flex items-center gap-1.5">
                      <FileText className="h-3 w-3 text-primary" /> Snapshot
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground/50">
                      {report.createdAt ? format(new Date(report.createdAt), "dd/MM/yy") : "—"}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <div className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest">Registros</div>
                      <div className="text-xs font-mono font-bold text-foreground">{report.rowCount ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest">Período</div>
                      <div className="text-[10px] font-mono text-foreground/80 truncate">
                        {report.periodFrom ? format(new Date(report.periodFrom), "dd/MM") : "Início"} 
                        {' → '} 
                        {report.periodTo ? format(new Date(report.periodTo), "dd/MM") : "Hoje"}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
