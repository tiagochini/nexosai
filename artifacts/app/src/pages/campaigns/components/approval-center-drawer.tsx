import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCampaignControlRoomApprovals,
  useDecideCampaignControlRoomApproval,
  useScheduleCampaignApprovalSla,
  getGetCampaignControlRoomApprovalsQueryKey,
  type ApprovalItem,
  type ApprovalDecisionRecord,
  type ApprovalDecision,
  type ControlRoomApprovalsResponse,
} from "@workspace/api-client-react";
import {
  CheckCircle2, XCircle, AlertTriangle, ChevronRight, Activity,
  RefreshCw, History, ArrowLeft, ShieldCheck, Database, FileText,
  MessageSquare, Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUiText } from "@/lib/i18n";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

const generateIdempotencyKey = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2) + Date.now().toString(36);

function SafePreview({ content }: { content: unknown }) {
  const t = useUiText();
  if (content === null || content === undefined) {
    return <div className="text-muted-foreground italic text-xs">{t("Nenhuma visualização disponível", "No preview available", "No hay vista previa disponible")}</div>;
  }
  if (typeof content === "string") {
    return <div className="whitespace-pre-wrap font-mono text-[10px] break-words">{content}</div>;
  }
  if (typeof content !== "object") {
    return <div className="font-mono text-[10px]">{String(content)}</div>;
  }
  return (
    <pre className="font-mono text-[10px] whitespace-pre-wrap break-words text-muted-foreground/80 bg-black/40 border border-white/5 p-4 overflow-x-auto max-h-[50vh]">
      {JSON.stringify(content, null, 2)}
    </pre>
  );
}

export function ApprovalCenterDrawer({
  open,
  onOpenChange,
  campaignId
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
}) {
  const t = useUiText();
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);

  const [intent, setIntent] = useState<"approved" | "rejected" | "revision_requested" | null>(null);
  const [reason, setReason] = useState("");
  const idempotencyKeyRef = useRef<string>("");
  const [reasonError, setReasonError] = useState("");
  const [stale, setStale] = useState(false);
  const [expiredError, setExpiredError] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleDueAt, setScheduleDueAt] = useState("");
  const [scheduleWarningAt, setScheduleWarningAt] = useState("");
  const [scheduleEscalationAt, setScheduleEscalationAt] = useState("");
  const [scheduleExpiresAt, setScheduleExpiresAt] = useState("");

  useEffect(() => {
    if (!open) {
      setSelectedItem(null);
    }
  }, [open]);

  useEffect(() => {
    setIntent(null);
    setReason("");
    setStale(false);
    setExpiredError(false);
    setSuccessMsg("");
    setIsScheduling(false);
    idempotencyKeyRef.current = "";
    setReasonError("");
  }, [selectedItem?.subjectType, selectedItem?.subjectId, selectedItem?.snapshotHash]);

  const { data, isLoading, isError, error, refetch } = useGetCampaignControlRoomApprovals(campaignId, undefined, {
    query: {
      enabled: open,
      refetchInterval: open ? 5000 : false,
      queryKey: getGetCampaignControlRoomApprovalsQueryKey(campaignId)
    }
  });

  useEffect(() => {
    if (!selectedItem || !data?.pendingItems) return;
    const refreshed = data.pendingItems.find(
      (item) =>
        item.subjectType === selectedItem.subjectType &&
        item.subjectId === selectedItem.subjectId &&
        item.snapshotHash === selectedItem.snapshotHash,
    );
    if (refreshed && refreshed !== selectedItem) setSelectedItem(refreshed);
  }, [data, selectedItem]);

  const { mutate, isPending, error: submitError, isError: isSubmitError } = useDecideCampaignControlRoomApproval({
    mutation: {
      onSuccess: () => {
        setSuccessMsg(t("Decisão registrada. Nenhuma publicação ou execução foi iniciada.", "Decision recorded. No publishing or execution was initiated.", "Decisión registrada. No se inició ninguna publicación ni ejecución."));
        queryClient.invalidateQueries({ queryKey: getGetCampaignControlRoomApprovalsQueryKey(campaignId) });
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "control-room"] });
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "masterplan"] });
        queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/content`] });
      },
      onError: (err: any) => {
        const code = err?.response?.data?.code || err?.response?.data?.error?.code || err?.data?.code;
        if (code === 'APPROVAL_EXPIRED') {
          setExpiredError(true);
        } else if (err?.status === 409 || err?.response?.status === 409 || err?.status === 400 || err?.response?.status === 400) {
          if (code === 'APPROVAL_EXPIRED') {
             setExpiredError(true);
          } else {
             setStale(true);
          }
        }
      }
    }
  });

  const { mutate: scheduleSla, isPending: isSchedulingSla } = useScheduleCampaignApprovalSla({
    mutation: {
      onSuccess: () => {
        setIsScheduling(false);
        setSuccessMsg(t("Prazo (SLA) agendado com sucesso.", "SLA deadline scheduled successfully.", "Plazo (SLA) programado correctamente."));
        queryClient.invalidateQueries({ queryKey: getGetCampaignControlRoomApprovalsQueryKey(campaignId) });
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "control-room"] });
      },
      onError: (err: any) => {
        setReasonError(err?.message || t("Falha ao agendar prazo.", "Failed to schedule deadline.", "No se pudo programar el plazo."));
      }
    }
  });

  const handleOpenSchedule = () => {
    const now = new Date();
    const dDue = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dWarn = new Date(dDue.getTime() - 1 * 60 * 60 * 1000);
    const dEsc = new Date(dDue.getTime() + 4 * 60 * 60 * 1000);
    const dExp = new Date(dDue.getTime() + 24 * 60 * 60 * 1000);

    const fmt = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    setScheduleDueAt(fmt(dDue));
    setScheduleWarningAt(fmt(dWarn));
    setScheduleEscalationAt(fmt(dEsc));
    setScheduleExpiresAt(fmt(dExp));
    setIsScheduling(true);
  };

  const handleSubmitSchedule = () => {
    if (!selectedItem) return;
    scheduleSla({
      campaignId,
      subjectType: selectedItem.subjectType as "masterplan" | "content_piece" | "checkpoint",
      subjectId: selectedItem.subjectId,
      data: {
        subjectSnapshotHash: selectedItem.snapshotHash,
        dueAt: new Date(scheduleDueAt).toISOString(),
        warningAt: scheduleWarningAt ? new Date(scheduleWarningAt).toISOString() : undefined,
        escalationAt: scheduleEscalationAt ? new Date(scheduleEscalationAt).toISOString() : new Date(new Date(scheduleDueAt).getTime() + 4 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(scheduleExpiresAt).toISOString(),
        channel: "in_app",
        idempotencyKey: generateIdempotencyKey()
      }
    });
  };

  const handleStartDecision = (newIntent: "approved" | "rejected" | "revision_requested" | null) => {
    if (!newIntent) {
      setIntent(null);
      idempotencyKeyRef.current = "";
      return;
    }
    if (intent !== newIntent) {
      idempotencyKeyRef.current = generateIdempotencyKey();
    }
    setIntent(newIntent);
    setReason("");
    setReasonError("");
  };

  const handleSubmit = () => {
    if (!selectedItem || !intent) return;
    if ((intent === "rejected" || intent === "revision_requested") && !reason.trim()) {
      setReasonError(t("Por favor, forneça um motivo obrigatório.", "Please provide a required reason.", "Proporciona un motivo obligatorio."));
      return;
    }
    setReasonError("");

    mutate({
      campaignId,
      subjectType: selectedItem.subjectType,
      subjectId: selectedItem.subjectId,
      data: {
        decision: intent,
        expectedSnapshotHash: selectedItem.snapshotHash,
        expectedVersion: (typeof selectedItem.subjectVersion === "number" && selectedItem.subjectVersion > 0) ? selectedItem.subjectVersion : undefined,
        reason: reason.trim() || undefined,
        idempotencyKey: idempotencyKeyRef.current
      }
    });
  };

  const pendingItems = data?.pendingItems || [];
  const recentDecisions = data?.recentDecisions || [];
  const unavailableSources = data?.unavailableSources || [];
  const totalPending = data?.total ?? pendingItems.length;
  const catalogTruncated = data?.catalogTruncated ?? false;
  const catalogWarnings = data?.catalogWarnings ?? [];

  const isSlaExpired = selectedItem?.sla?.status === 'expired';
  const slaStatusLabel = (status: NonNullable<ApprovalItem["sla"]>["status"]) =>
    status === "scheduled" ? t("agendado", "scheduled", "programado") :
    status === "due_soon" ? t("vence em breve", "due soon", "vence pronto") :
    status === "overdue" ? t("atrasado", "overdue", "atrasado") :
    status === "expired" ? t("expirado", "expired", "vencido") :
    t("resolvido", "resolved", "resuelto");

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="max-h-[95vh] h-[95vh] border-primary/25 bg-[#030712] text-foreground flex flex-col focus-visible:outline-none"
        onKeyDownCapture={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            if (selectedItem) {
              event.stopPropagation();
              setSelectedItem(null);
            } else {
              onOpenChange(false);
            }
          }
        }}
      >
        <div className="mx-auto w-full max-w-[1400px] overflow-hidden flex flex-col h-full">
          <DrawerHeader className="border-b border-border/20 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#030712]">
            <div className="flex items-center gap-4">
              {selectedItem && (
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="p-1.5 border border-border/40 bg-black/40 hover:bg-white/5 hover:border-border/80 transition-colors text-muted-foreground hover:text-white shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
                  aria-label={t("Voltar ao Centro de Aprovações", "Back to Approval Center", "Volver al Centro de Aprobaciones")}
                  data-testid="btn-back-approval-center"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <div>
                <DrawerTitle className="font-mono text-sm uppercase tracking-widest text-primary flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  {t("Centro de Aprovações", "Approval Center", "Centro de Aprobaciones")}
                </DrawerTitle>
                <DrawerDescription className="font-mono text-[10px] uppercase tracking-wider mt-1 text-muted-foreground">
                  {selectedItem ? `${t("Revisando", "Reviewing", "Revisando")} ${selectedItem.subjectType} ${selectedItem.subjectId.substring(0, 8)}` : t("Revise itens pendentes e decisões recentes.", "Review pending items and recent decisions.", "Revisa los elementos pendientes y las decisiones recientes.")}
                </DrawerDescription>
              </div>
            </div>
            {!selectedItem && (
              <DrawerClose asChild>
                <Button variant="outline" size="sm" data-testid="btn-close-approval-center" className="font-mono text-[9px] uppercase tracking-widest h-8 rounded-none shrink-0 border-border/40 hover:bg-white/5">
                  {t("Fechar", "Close", "Cerrar")}
                </Button>
              </DrawerClose>
            )}
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto min-h-0 bg-[#010308] relative hide-scrollbar">
            {isLoading ? (
               <div className="flex-1 flex h-full items-center justify-center">
                 <div className="flex flex-col items-center gap-3">
                   <RefreshCw className="h-6 w-6 text-primary animate-spin" />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("Carregando aprovações...", "Loading approvals...", "Cargando aprobaciones...")}</span>
                 </div>
               </div>
            ) : isError ? (
               <div className="flex-1 flex flex-col h-full items-center justify-center p-6 text-center">
                 <XCircle className="h-8 w-8 text-destructive mb-3" />
                  <div className="font-mono text-[11px] uppercase tracking-widest text-destructive mb-2 font-bold">{t("Falha ao carregar aprovações", "Failed to load approvals", "No se pudieron cargar las aprobaciones")}</div>
                  <p className="font-mono text-[9px] text-muted-foreground max-w-md mb-4">{error?.message || t("Não foi possível recuperar os itens para aprovação.", "Unable to retrieve items for approval.", "No se pudieron recuperar los elementos para aprobación.")}</p>
                 <Button type="button" onClick={() => refetch()} variant="outline" className="font-mono text-[10px] uppercase tracking-widest border-border/30 hover:bg-white/5">
                    {t("Tentar Novamente", "Try Again", "Intentar de nuevo")}
                 </Button>
               </div>
            ) : !selectedItem ? (
              <div className="p-4 md:p-6 flex flex-col gap-8 max-w-5xl mx-auto w-full">

                <section>
                  <h3 className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold mb-4 flex items-center gap-2 border-b border-primary/20 pb-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {t("Aprovações Pendentes", "Pending Approvals", "Aprobaciones pendientes")} ({totalPending})
                  </h3>
                  {catalogTruncated && (
                    <div className="mb-4 border border-[#FFB000]/30 bg-[#FFB000]/10 p-3 font-mono text-[10px] text-[#FFB000]" role="status">
                      {t(`Mostrando ${pendingItems.length} de ${totalPending} itens. O catálogo foi limitado com segurança.`, `Showing ${pendingItems.length} of ${totalPending} items. The catalog was safely limited.`, `Mostrando ${pendingItems.length} de ${totalPending} elementos. El catálogo se limitó de forma segura.`)}
                      {catalogWarnings.length > 0 && <span className="block mt-1">{t("Avisos", "Warnings", "Avisos")}: {catalogWarnings.join(", ")}</span>}
                    </div>
                  )}

                  {pendingItems.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-border/30 bg-black/20">
                      <ShieldCheck className="h-8 w-8 text-success/30 mx-auto mb-3" />
                      <div className="font-mono text-[11px] uppercase tracking-widest text-white/50 font-bold mb-2">{t("Nenhuma decisão pendente", "No pending decisions", "No hay decisiones pendientes")}</div>
                      <p className="font-mono text-[9px] text-muted-foreground">{t("Tudo certo.", "All clear.", "Todo en orden.")}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {pendingItems.map((item) => (
                        <button
                          type="button"
                          key={`${item.subjectType}-${item.subjectId}`}
                          onClick={() => setSelectedItem(item)}
                          className="border border-border/20 bg-black/40 hover:bg-white/5 hover:border-primary/40 transition-colors p-4 text-left group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
                          data-testid={`approval-item-${item.subjectType}-${item.subjectId}`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div>
                              <div className="font-mono text-[11px] uppercase tracking-widest text-white font-bold line-clamp-1">{item.title || item.subjectType}</div>
                              <div className="font-mono text-[9px] text-muted-foreground mt-1 uppercase tracking-widest">{item.subjectType}</div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                          </div>

                          <div className="flex flex-wrap items-center gap-2 font-mono text-[8px] uppercase tracking-widest text-muted-foreground/60 mt-3">
                            <span className="bg-white/5 px-1.5 py-0.5 border border-white/10">v{item.subjectVersion || "?"}</span>
                            <span>{item.snapshotHash.substring(0, 8)}</span>
                            {item.contextFingerprint && <span>· {item.contextFingerprint.substring(0, 8)}</span>}
                            {item.sla && (
                              <span className={`ml-auto px-1.5 py-0.5 border ${
                                item.sla.status === 'expired' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                                item.sla.status === 'overdue' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                                item.sla.status === 'due_soon' ? 'bg-[#FFB000]/10 text-[#FFB000] border-[#FFB000]/20' :
                                'bg-primary/10 text-primary border-primary/20'
                              }`}>
                                SLA: {slaStatusLabel(item.sla.status)}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                {unavailableSources.length > 0 && (
                  <section>
                    <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground font-bold mb-4 flex items-center gap-2 border-b border-border/20 pb-2">
                      <AlertTriangle className="h-4 w-4" />
                      {t("Fontes Indisponíveis", "Unavailable Sources", "Fuentes no disponibles")} ({unavailableSources.length})
                    </h3>
                    <div className="flex flex-col gap-2">
                      {unavailableSources.map((source, idx) => (
                        <div key={idx} className="border border-border/20 bg-black/40 p-3 flex flex-col gap-1" data-testid={`approval-unavailable-${idx}`}>
                          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{t("Fonte Indisponível", "Unavailable Source", "Fuente no disponible")}</div>
                          <pre className="font-mono text-[9px] text-muted-foreground/60 whitespace-pre-wrap">{JSON.stringify(source, null, 2)}</pre>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section>
                  <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground font-bold mb-4 flex items-center gap-2 border-b border-border/20 pb-2">
                    <History className="h-4 w-4" />
                    {t("Decisões Imutáveis Recentes", "Recent Immutable Decisions", "Decisiones inmutables recientes")}
                  </h3>

                  {recentDecisions.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-border/30 bg-black/20">
                      <div className="font-mono text-[11px] uppercase tracking-widest text-white/30 font-bold">{t("Nenhuma decisão recente", "No recent decisions", "No hay decisiones recientes")}</div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {recentDecisions.map((decision, idx) => (
                        <div key={decision.id} className="border border-border/20 bg-black/20 p-4" data-testid={`approval-recent-${idx}`}>
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest font-bold mb-1">
                                {decision.decision === "approved" ? (
                                  <span className="text-success">{t("Aprovado", "Approved", "Aprobado")}</span>
                                ) : decision.decision === "rejected" ? (
                                  <span className="text-destructive">{t("Rejeitado", "Rejected", "Rechazado")}</span>
                                ) : (
                                  <span className="text-[#FFB000]">{t("Revisão Solicitada", "Revision Requested", "Revisión solicitada")}</span>
                                )}
                                <span className="text-muted-foreground/50 text-[9px]">· {decision.subjectType}</span>
                              </div>
                              <div className="font-mono text-[9px] text-muted-foreground">ID: {decision.subjectId}</div>
                            </div>
                            <div className="text-right font-mono text-[8px] uppercase tracking-widest text-muted-foreground/50">
                              <div>{new Date(decision.decidedAt).toLocaleString()}</div>
                               <div>{t("Por", "By", "Por")}: {decision.actorUserId}</div>
                            </div>
                          </div>

                          {decision.reason && (
                            <div className="mt-3 bg-black/40 border border-white/5 p-2 font-mono text-[10px] text-muted-foreground/80 break-words">
                              {decision.reason}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-2 font-mono text-[8px] uppercase tracking-widest text-muted-foreground/40 mt-3 pt-2 border-t border-border/10">
                            <span>Hash: {decision.resolvedSnapshotHash.substring(0,8)}</span>
                            <span>v{decision.subjectVersion || "?"}</span>
                             {decision.contextFingerprint && <span>· {t("Assinatura", "Fingerprint", "Huella")}: {decision.contextFingerprint.substring(0,8)}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="p-4 md:p-6 flex flex-col gap-6 flex-1 max-w-5xl mx-auto w-full">
                  <div className="border border-border/20 bg-black/40 p-4 relative">
                    {selectedItem.subjectType === "masterplan" ? (
                       <a href={`/campaigns/${campaignId}/strategy`} target="_blank" rel="noopener noreferrer" className="absolute top-4 right-4 font-mono text-[9px] uppercase tracking-widest text-primary hover:underline flex items-center gap-1">
                         {t("Ver Documento de Estratégia", "View Strategy Document", "Ver documento de estrategia")} <ChevronRight className="h-3 w-3" />
                       </a>
                    ) : selectedItem.subjectType === "content_piece" ? (
                       <a href={`/campaigns/${campaignId}/content`} target="_blank" rel="noopener noreferrer" className="absolute top-4 right-4 font-mono text-[9px] uppercase tracking-widest text-primary hover:underline flex items-center gap-1">
                         {t("Abrir Fábrica de Conteúdo", "Open Content Factory", "Abrir fábrica de contenido")} <ChevronRight className="h-3 w-3" />
                       </a>
                    ) : null}
                    <h2 className="font-mono text-[12px] uppercase tracking-widest text-white font-bold mb-2 break-all pr-32">{selectedItem.title}</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-[9px] uppercase tracking-widest text-muted-foreground mt-4">
                      <div>
                        <div className="opacity-50 mb-1">{t("Tipo", "Type", "Tipo")}</div>
                        <div className="text-white">{selectedItem.subjectType}</div>
                      </div>
                      <div>
                        <div className="opacity-50 mb-1">{t("Versão", "Version", "Versión")}</div>
                        <div className="text-white">v{selectedItem.subjectVersion || "?"}</div>
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <div className="opacity-50 mb-1">{t("Hash", "Hash", "Hash")}</div>
                        <div className="text-white break-all text-[8px]">{selectedItem.snapshotHash}</div>
                      </div>
                      <div className="col-span-2 md:col-span-1">
                        <div className="opacity-50 mb-1">{t("Assinatura", "Fingerprint", "Huella digital")}</div>
                        <div className="text-white break-all text-[8px]">{selectedItem.contextFingerprint || "N/A"}</div>
                      </div>
                    </div>
                  </div>

                  {/* SLA SECTION */}
                  {isScheduling ? (
                    <div className="border border-primary/20 bg-black/40 p-4">
                      <h3 className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold mb-3 flex items-center gap-2"><Calendar className="h-4 w-4" /> {t("Agendar Prazo (SLA)", "Schedule Deadline (SLA)", "Programar plazo (SLA)")}</h3>
                      <p className="font-mono text-[9px] text-muted-foreground mb-4">
                        {t("O aviso e escalonamento acontecerão via canal in-app (único suportado atualmente). O prazo é vinculado exatamente ao hash do snapshot atual.", "Warnings and escalation will be sent via the in-app channel (the only channel currently supported). The deadline is bound exactly to the current snapshot hash.", "Los avisos y el escalamiento se enviarán por el canal de la aplicación (el único compatible actualmente). El plazo está vinculado exactamente al hash de la instantánea actual.")}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label htmlFor="approval-sla-due" className="block font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">{t("Data/Hora Limite", "Deadline Date/Time", "Fecha y hora límite")}</label>
                          <input
                            id="approval-sla-due"
                            type="datetime-local"
                            required
                            value={scheduleDueAt}
                            onChange={(event) => {
                              const nextDue = event.target.value;
                              setScheduleDueAt(nextDue);
                              const due = new Date(nextDue);
                              if (!Number.isNaN(due.getTime())) {
                                const warning = new Date(due.getTime() - 60 * 60 * 1000);
                                setScheduleWarningAt(new Date(warning.getTime() - warning.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
                              }
                            }}
                            className="w-full bg-[#0a0a0a] border border-border/40 text-[11px] font-mono p-2 text-white focus-visible:outline-none focus-visible:border-primary/60"
                          />
                        </div>
                        <div>
                          <label htmlFor="approval-sla-warning" className="block font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">{t("Aviso Automático (1h antes)", "Automatic Warning (1h before)", "Aviso automático (1 h antes)")}</label>
                          <input id="approval-sla-warning" type="datetime-local" value={scheduleWarningAt} readOnly aria-readonly="true" className="w-full bg-[#0a0a0a] border border-border/30 text-[11px] font-mono p-2 text-muted-foreground cursor-not-allowed" />
                        </div>
                        <div>
                          <label htmlFor="approval-sla-escalation" className="block font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">{t("Escalonamento", "Escalation", "Escalamiento")}</label>
                          <input id="approval-sla-escalation" type="datetime-local" required value={scheduleEscalationAt} onChange={e => setScheduleEscalationAt(e.target.value)} className="w-full bg-[#0a0a0a] border border-border/40 text-[11px] font-mono p-2 text-white focus-visible:outline-none focus-visible:border-primary/60" />
                        </div>
                        <div>
                          <label htmlFor="approval-sla-expiration" className="block font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1">{t("Expiração", "Expiration", "Vencimiento")}</label>
                          <input id="approval-sla-expiration" type="datetime-local" required value={scheduleExpiresAt} onChange={e => setScheduleExpiresAt(e.target.value)} className="w-full bg-[#0a0a0a] border border-border/40 text-[11px] font-mono p-2 text-white focus-visible:outline-none focus-visible:border-primary/60" />
                        </div>
                      </div>
                      <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setIsScheduling(false)} className="font-mono text-[10px] uppercase tracking-widest rounded-none h-8 border-border/40 hover:bg-white/5">{t("Cancelar", "Cancel", "Cancelar")}</Button>
                        <Button onClick={handleSubmitSchedule} disabled={isSchedulingSla} className="font-mono text-[10px] uppercase tracking-widest rounded-none h-8 bg-primary text-primary-foreground hover:bg-primary/90">
                          {isSchedulingSla ? t("Agendando...", "Scheduling...", "Programando...") : t("Confirmar Agendamento", "Confirm Schedule", "Confirmar programación")}
                        </Button>
                      </div>
                    </div>
                  ) : selectedItem.sla ? (
                    <div className={`border ${isSlaExpired ? 'border-destructive/40' : 'border-primary/20'} bg-black/40 p-4`}>
                      <div className="flex flex-wrap gap-4 justify-between items-start">
                        <div>
                          <h3 className={`font-mono text-[11px] uppercase tracking-widest font-bold mb-1 flex items-center gap-2 ${isSlaExpired ? 'text-destructive' : 'text-primary'}`}>
                            <Calendar className="h-4 w-4" /> {t("Prazo (SLA)", "Deadline (SLA)", "Plazo (SLA)")}: {
                              selectedItem.sla.status === 'scheduled' ? t('Agendado', 'Scheduled', 'Programado') :
                              selectedItem.sla.status === 'due_soon' ? t('Vence em Breve', 'Due Soon', 'Vence pronto') :
                              selectedItem.sla.status === 'overdue' ? t('Atrasado', 'Overdue', 'Atrasado') :
                              selectedItem.sla.status === 'expired' ? t('Expirado', 'Expired', 'Vencido') :
                              selectedItem.sla.status === 'resolved' ? t('Resolvido', 'Resolved', 'Resuelto') : selectedItem.sla.status
                            }
                          </h3>
                          <div className="font-mono text-[9px] text-muted-foreground">
                            {t("Limite", "Deadline", "Límite")}: {selectedItem.sla.dueAt ? new Date(selectedItem.sla.dueAt).toLocaleString() : "—"}
                          </div>
                        </div>
                        {selectedItem.sla.nextEvent && !isSlaExpired && selectedItem.sla.status !== 'resolved' && (
                          <div className="text-right">
                            <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60 mb-0.5">{t("Próximo Evento", "Next Event", "Próximo evento")}</div>
                            <div className="font-mono text-[10px] text-white bg-white/5 px-2 py-1 border border-white/10">{selectedItem.sla.nextEvent.replace(/_/g, " ")}</div>
                          </div>
                        )}
                      </div>
                      
                      {selectedItem.sla.deliveredEvents && selectedItem.sla.deliveredEvents.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-border/20">
                          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5"><History className="h-3 w-3" /> {t("Histórico de Alertas In-App", "In-App Alert History", "Historial de alertas en la aplicación")}</div>
                          <div className="flex flex-col gap-1.5 max-h-[100px] overflow-y-auto hide-scrollbar">
                            {selectedItem.sla.deliveredEvents.map((ev: any, idx: number) => (
                              <div key={idx} className="font-mono text-[9px] text-muted-foreground/80 flex gap-2">
                                <span className="text-white/40">[{new Date(ev.deliveredAt || ev.timestamp || Date.now()).toLocaleString()}]</span>
                                <span>{ev.kind || ev.type} via {ev.channel}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="border border-dashed border-border/30 bg-black/20 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-white/70 font-bold flex items-center gap-2"><Calendar className="h-4 w-4" /> {t("Nenhum prazo definido", "No deadline set", "No hay plazo definido")}</div>
                        <div className="font-mono text-[9px] text-muted-foreground mt-0.5">{t("Agende um SLA para forçar lembretes e expiração automática.", "Schedule an SLA to enforce reminders and automatic expiration.", "Programa un SLA para activar recordatorios y vencimiento automático.")}</div>
                      </div>
                      <Button type="button" onClick={handleOpenSchedule} variant="outline" className="font-mono text-[9px] uppercase tracking-widest rounded-none h-8 border-primary/30 text-primary hover:bg-primary/10 shrink-0">
                        {t("Agendar Prazo", "Schedule Deadline", "Programar plazo")}
                      </Button>
                    </div>
                  )}

                  {/* WARNINGS AND TRUNCATED STATES */}
                  {(selectedItem.previewTruncated || (selectedItem.previewWarnings ?? []).length > 0) && (
                    <div className="flex flex-col gap-2">
                      {selectedItem.previewTruncated && (
                        <div className="bg-[#FFB000]/10 border border-[#FFB000]/30 p-3 text-[#FFB000] font-mono text-[10px]">
                          {t("Aviso: O conteúdo visível foi truncado. A aprovação é vinculada ao hash completo da versão. O conteúdo oculto permanece protegido.", "Warning: Visible content was truncated. Approval is bound to the full version hash. Hidden content remains protected.", "Aviso: El contenido visible está truncado. La aprobación está vinculada al hash completo de la versión. El contenido oculto permanece protegido.")}
                        </div>
                      )}
                      {(selectedItem.previewWarnings ?? []).length > 0 && (
                        <div className="bg-destructive/10 border border-destructive/30 p-3 text-destructive font-mono text-[10px]">
                          {t("Avisos da fonte:", "Source warnings:", "Avisos de la fuente:")}
                          <ul className="list-disc pl-4 mt-1">
                            {(selectedItem.previewWarnings ?? []).map((w: string, i: number) => <li key={i}>{w}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex-1 min-h-[300px] border border-border/20 bg-black/20 flex flex-col">
                    <div className="border-b border-border/20 p-2 bg-black/40 flex items-center justify-between">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-2">
                         <Database className="h-3 w-3" /> {t("Visualização do Payload", "Payload Preview", "Vista previa del payload")}
                      </span>
                    </div>
                    <div className="p-4 overflow-y-auto">
                      <SafePreview content={selectedItem.preview} />
                    </div>
                  </div>
                </div>

                <div className="border-t border-border/20 bg-[#030712] shrink-0 sticky bottom-0 p-4">
                  <div className="max-w-5xl mx-auto w-full">
                    {successMsg ? (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border border-success/30 bg-success/10 p-4" data-testid="approval-success">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-5 w-5 text-success" />
                          <div className="font-mono text-[11px] uppercase tracking-widest text-success font-bold" aria-live="polite">
                            {successMsg}
                          </div>
                        </div>
                        <Button
                          type="button"
                          onClick={() => { setSelectedItem(null); refetch(); }}
                          className="font-mono text-[10px] uppercase tracking-widest border border-success/40 bg-success/20 text-success hover:bg-success/30 rounded-none shrink-0"
                        >
                          {t("Voltar para a Lista", "Back to List", "Volver a la lista")}
                        </Button>
                      </div>
                    ) : expiredError ? (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border border-destructive/30 bg-destructive/10 p-4" data-testid="approval-expired-error">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          <div>
                            <div className="font-mono text-[11px] uppercase tracking-widest text-destructive font-bold" aria-live="polite">
                              {t("Conflito: Prazo Expirado", "Conflict: Deadline Expired", "Conflicto: plazo vencido")}
                            </div>
                            <div className="font-sans text-[10px] text-destructive/80 mt-1">{t("O prazo agendado para esta decisão expirou. A aprovação automática não é permitida.", "The deadline scheduled for this decision has expired. Automatic approval is not allowed.", "El plazo programado para esta decisión venció. No se permite la aprobación automática.")}</div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          onClick={() => { setSelectedItem(null); refetch(); }}
                          className="font-mono text-[10px] uppercase tracking-widest border border-destructive/40 bg-destructive/20 text-destructive hover:bg-destructive/30 rounded-none shrink-0"
                        >
                          {t("Atualizar Catálogo", "Refresh Catalog", "Actualizar catálogo")}
                        </Button>
                      </div>
                    ) : stale ? (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border border-[#FFB000]/30 bg-[#FFB000]/10 p-4" data-testid="approval-stale">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="h-5 w-5 text-[#FFB000]" />
                          <div className="font-mono text-[11px] uppercase tracking-widest text-[#FFB000] font-bold" aria-live="polite">
                            {t("Conflito: O item foi modificado por outro processo.", "Conflict: This item was modified by another process.", "Conflicto: otro proceso modificó este elemento.")}
                          </div>
                        </div>
                        <Button
                          type="button"
                          onClick={() => { setSelectedItem(null); refetch(); }}
                          className="font-mono text-[10px] uppercase tracking-widest border border-[#FFB000]/40 bg-[#FFB000]/20 text-[#FFB000] hover:bg-[#FFB000]/30 rounded-none shrink-0"
                        >
                          {t("Atualizar Catálogo", "Refresh Catalog", "Actualizar catálogo")}
                        </Button>
                      </div>
                    ) : isSlaExpired ? (
                      <div className="flex items-center gap-3 border border-destructive/30 bg-destructive/10 p-4 w-full" data-testid="approval-expired-warning">
                        <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                        <div>
                          <div className="font-mono text-[11px] uppercase tracking-widest text-destructive font-bold">{t("SLA Expirado", "SLA Expired", "SLA vencido")}</div>
                          <div className="font-sans text-[11px] text-destructive/80 mt-1">{t("A expiração de um prazo nunca aprova itens automaticamente por segurança. Este item não pode mais ser decidido; ele precisa ser reemitido ou descartado pela orquestração.", "For safety, an expired deadline never automatically approves items. This item can no longer be decided; it must be reissued or discarded by orchestration.", "Por seguridad, el vencimiento de un plazo nunca aprueba elementos automáticamente. Este elemento ya no puede decidirse; la orquestación debe volver a emitirlo o descartarlo.")}</div>
                        </div>
                      </div>
                    ) : intent ? (
                      <div className="flex flex-col gap-4 border border-primary/20 bg-black/40 p-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between">
                          <div className="font-mono text-[11px] uppercase tracking-widest font-bold flex items-center gap-2">
                            {intent === "approved" && <span className="text-success">{t("Confirmar Aprovação", "Confirm Approval", "Confirmar aprobación")}</span>}
                            {intent === "rejected" && <span className="text-destructive">{t("Confirmar Rejeição", "Confirm Rejection", "Confirmar rechazo")}</span>}
                            {intent === "revision_requested" && <span className="text-[#FFB000]">{t("Solicitar Revisão", "Request Revision", "Solicitar revisión")}</span>}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleStartDecision(null)}
                            disabled={isPending}
                            className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground hover:text-white transition-colors focus-visible:outline-none focus-visible:underline"
                          >
                            {t("Cancelar", "Cancel", "Cancelar")}
                          </button>
                        </div>

                        {(intent === "rejected" || intent === "revision_requested") && (
                          <div className="flex flex-col gap-2">
                            <label htmlFor="approval-reason" className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                              {t("Motivo (Obrigatório)", "Reason (Required)", "Motivo (obligatorio)")}
                            </label>
                            <textarea
                              id="approval-reason"
                              data-testid="approval-reason"
                              value={reason}
                              onChange={(e) => {
                                setReason(e.target.value);
                                if (reasonError) setReasonError("");
                              }}
                              disabled={isPending}
                              placeholder={t("Forneça detalhes para esta decisão...", "Provide details for this decision...", "Proporciona detalles para esta decisión...")}
                              className={`w-full bg-[#0a0a0a] border ${reasonError ? "border-destructive/60 focus-visible:border-destructive" : "border-border/40 focus-visible:border-primary/60"} text-[11px] font-mono p-3 text-white focus-visible:outline-none min-h-[80px] resize-y`}
                              aria-required="true"
                              aria-invalid={!!reasonError}
                              aria-describedby={reasonError ? "approval-reason-error" : undefined}
                            />
                            {reasonError && (
                              <div id="approval-reason-error" className="text-destructive font-mono text-[9px]">
                                {reasonError}
                              </div>
                            )}
                          </div>
                        )}

                        {isSubmitError && !stale && !expiredError && (
                           <div className="text-[10px] text-destructive bg-destructive/10 border border-destructive/20 p-2 font-mono" role="alert">
                             {(submitError as any)?.message || t("Falha ao registrar decisão. Tente novamente.", "Failed to record decision. Try again.", "No se pudo registrar la decisión. Inténtalo de nuevo.")}
                           </div>
                        )}

                        <div className="flex justify-end pt-2">
                          <Button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isPending || ((intent === "rejected" || intent === "revision_requested") && !reason.trim())}
                            data-testid="btn-submit-approval-decision"
                            className={`font-mono text-[10px] uppercase tracking-widest rounded-none h-10 px-6 ${
                              intent === "approved" ? "bg-success text-success-foreground hover:bg-success/90" :
                              intent === "rejected" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" :
                              "bg-[#FFB000] text-[#FFB000]-foreground hover:bg-[#FFB000]/90 text-black"
                            }`}
                          >
                            {isPending ? (
                              <><RefreshCw className="h-3 w-3 mr-2 animate-spin" /> {t("Registrando...", "Recording...", "Registrando...")}</>
                            ) : (
                              t("Registrar Decisão", "Record Decision", "Registrar decisión")
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleStartDecision("revision_requested")}
                          data-testid="btn-approval-revision"
                          className="w-full sm:w-auto font-mono text-[10px] uppercase tracking-widest border-[#FFB000]/40 text-[#FFB000] hover:bg-[#FFB000]/10 rounded-none h-12"
                        >
                          {t("Solicitar Revisão", "Request Revision", "Solicitar revisión")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleStartDecision("rejected")}
                          data-testid="btn-approval-reject"
                          className="w-full sm:w-auto font-mono text-[10px] uppercase tracking-widest border-destructive/40 text-destructive hover:bg-destructive/10 rounded-none h-12"
                        >
                          {t("Rejeitar", "Reject", "Rechazar")}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleStartDecision("approved")}
                          data-testid="btn-approval-approve"
                          className="w-full sm:w-auto font-mono text-[10px] uppercase tracking-widest bg-success text-success-foreground hover:bg-success/90 rounded-none h-12"
                        >
                          {t("Aprovar", "Approve", "Aprobar")}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
