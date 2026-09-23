import { useState } from "react";
import { 
  useGetLifecycleOverview, 
  useListLifecycleActions, 
  useListLifecycleContacts, 
  useGetLifecycleTimeline,
  getGetLifecycleTimelineQueryKey,
  LifecycleOverview,
  LifecycleContact,
  LifecycleActionsResponseActionsItem,
  LifecycleTimelineResponseEventsItem,
  LifecycleTimelineResponseOnboardingItem,
  LifecycleTimelineResponseRecoveryItem
} from "@workspace/api-client-react";
import { format } from "date-fns";
import { 
  Activity, Users, ShieldAlert, AlertTriangle, Play, RefreshCw, 
  Search, Shield, Info, History, ArrowRight, User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// ─── Interfaces & Extended Types ─────────────────────────────────────────────

type PrivacyContact = LifecycleContact & { emailMasked?: string };

// ─── Formatting Helpers ──────────────────────────────────────────────────────

function formatMoney(cents: number = 0) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getStatusBadgeProps(status: string) {
  switch (status.toLowerCase()) {
    case "pending":
      return { label: "Pendente", color: "text-yellow-500 border-yellow-500/30 bg-yellow-500/10" };
    case "suppressed":
      return { label: "Suprimido", color: "text-muted-foreground border-border/40 bg-muted/10" };
    case "confirmed":
    case "completed":
      return { label: "Concluído no registro", color: "text-success border-success/30 bg-success/10" };
    default:
      return { label: status, color: "text-muted-foreground border-border/30 bg-muted/10" };
  }
}

function getRiskColor(risk: number = 0) {
  if (risk >= 80) return "text-destructive";
  if (risk >= 50) return "text-yellow-500";
  return "text-success";
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TimelineSheet({ contactId, onClose }: { contactId: string | null; onClose: () => void }) {
  const { data, isLoading, isError } = useGetLifecycleTimeline(contactId || "", undefined, {
    query: { 
      enabled: !!contactId,
      queryKey: getGetLifecycleTimelineQueryKey(contactId || "", undefined)
    }
  });
  
  const events: LifecycleTimelineResponseEventsItem[] = data?.events || [];
  const onboarding: LifecycleTimelineResponseOnboardingItem[] = data?.onboarding || [];
  const recovery: LifecycleTimelineResponseRecoveryItem[] = data?.recovery || [];

  const allTimelineItems = [
    ...events.map(e => ({
      id: e.id,
      type: e.type,
      status: e.status,
      date: e.occurredAt || e.processedAt || new Date().toISOString(),
      description: `Evento processado. Status: ${e.status}.`
    })),
    ...onboarding.map(o => ({
      id: o.id,
      type: "onboarding",
      status: o.status,
      date: o.createdAt,
      description: `Processo de onboarding. Status: ${o.status}.`
    })),
    ...recovery.map(r => ({
      id: r.id,
      type: "recovery",
      status: r.status,
      date: r.createdAt,
      description: `Tentativa de recuperação via ${r.channel}. Status: ${r.status}.`
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Sheet open={!!contactId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px] border-l border-primary/20 bg-card/95 backdrop-blur-xl p-0 flex flex-col font-mono">
        <SheetHeader className="p-6 border-b border-border/50 shrink-0">
          <SheetTitle className="text-sm uppercase tracking-widest text-primary flex items-center gap-2">
            <History className="h-4 w-4" /> Histórico do Contato
          </SheetTitle>
          <div className="text-[11px] text-muted-foreground/60 uppercase tracking-widest">
            ID: {contactId}
          </div>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-16 w-full bg-muted/20" />)
          ) : isError ? (
            <div className="text-xs text-destructive border border-destructive/30 bg-destructive/10 p-4 uppercase tracking-widest">
              Falha ao carregar timeline.
            </div>
          ) : allTimelineItems.length === 0 ? (
            <div className="text-xs text-muted-foreground/50 border border-border/30 p-6 text-center uppercase tracking-widest">
              Nenhum evento registrado.
            </div>
          ) : (
            <div className="relative border-l border-border/30 ml-3 space-y-6">
              {allTimelineItems.map((item) => (
                <div key={item.id} className="relative pl-6">
                  <div className="absolute left-[-5px] top-1 h-2.5 w-2.5 rounded-full bg-background border border-primary/50" />
                  <div className="text-[10px] text-muted-foreground/60 mb-1">
                    {format(new Date(item.date), "dd/MM/yyyy HH:mm")}
                  </div>
                  <div className="border border-border/40 bg-muted/5 p-3 group hover:border-primary/30 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded-none border-border/50 uppercase tracking-widest">
                        {item.type}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded-none border-border/50 text-muted-foreground uppercase tracking-widest">
                        {item.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-foreground/80 leading-relaxed">
                      {item.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function LifecyclePage() {
  const [activeTab, setActiveTab] = useState<"overview" | "contacts" | "actions">("overview");
  const [selectedContact, setSelectedContact] = useState<string | null>(null);

  const { data: overviewData, isLoading: isLoadingOverview } = useGetLifecycleOverview();
  const overview = overviewData as LifecycleOverview | undefined;

  const { data: contactsData, isLoading: isLoadingContacts } = useListLifecycleContacts();
  const contacts = contactsData?.contacts as PrivacyContact[] | undefined;

  const { data: actionsData, isLoading: isLoadingActions } = useListLifecycleActions();
  const actions = actionsData?.actions as LifecycleActionsResponseActionsItem[] | undefined;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-border/50 pb-6">
        <h1 className="text-2xl font-mono font-black uppercase tracking-widest flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" />
          M12 Lifecycle
        </h1>
        <p className="text-xs font-mono text-muted-foreground/60 uppercase tracking-widest max-w-2xl leading-relaxed">
          Painel de operações de ciclo de vida. Visão local de estágios, LTV registrado e ações retidas em pendência.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/40">
        {[
          { id: "overview", label: "Overview", icon: Activity },
          { id: "contacts", label: "Contatos", icon: Users },
          { id: "actions", label: "Ações Pendentes", icon: ShieldAlert }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`flex items-center gap-2 px-4 py-2 font-mono text-[11px] uppercase tracking-widest transition-all
              ${activeTab === t.id 
                ? "text-primary border-b-2 border-primary bg-primary/5" 
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {isLoadingOverview ? (
              <Skeleton className="h-[400px] w-full bg-muted/20" />
            ) : overview ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* LTV Local */}
                <div className="border border-border/50 bg-card/30 p-5 col-span-1 md:col-span-2 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative z-10">
                    <div className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-1">
                      LTV Registrado (Local)
                    </div>
                    <div className="text-3xl font-mono font-bold text-foreground mt-2">
                      {formatMoney(overview.ltv?.recordedLifetimeValueCents)}
                    </div>
                    <div className="mt-4 flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 p-3">
                      <Info className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                      <div className="text-[10px] font-mono text-yellow-500/80 leading-relaxed uppercase tracking-widest">
                        Aviso: Valor derivado de {overview.ltv?.contacts || 0} contatos. 
                        Atribuição estrita: {overview.ltv?.attribution || "Não atribuído externamente"}. 
                        Não implica recebimento bancário liquidado.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Referrals */}
                <div className="border border-border/50 bg-card/30 p-5 col-span-1 md:col-span-2">
                  <div className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-4">
                    Métricas de Indicação
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {overview.referrals && Object.keys(overview.referrals).length > 0 ? (
                      Object.entries(overview.referrals).map(([key, val]) => (
                        <div key={key} className="border border-border/30 bg-muted/10 p-3 flex flex-col justify-center">
                          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-1 truncate">{key}</div>
                          <div className="text-xl font-mono font-bold text-primary">{String(val)}</div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 text-center text-xs font-mono text-muted-foreground/50 py-4 uppercase tracking-widest">
                        Sem dados de indicação
                      </div>
                    )}
                  </div>
                </div>

                {/* Estágios */}
                <div className="border border-border/50 bg-card/30 p-5 col-span-1 md:col-span-4">
                  <div className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-4">
                    Estágios de Contato
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Object.entries(overview.contactStages || {}).map(([stage, count]) => (
                      <div key={stage} className="border border-border/30 bg-muted/10 p-3 text-center">
                        <div className="text-2xl font-mono font-bold text-primary mb-1">{String(count)}</div>
                        <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest truncate">{stage}</div>
                      </div>
                    ))}
                    {(!overview.contactStages || Object.keys(overview.contactStages).length === 0) && (
                      <div className="col-span-4 text-center text-xs font-mono text-muted-foreground/50 py-4 uppercase tracking-widest">
                        Sem dados de estágio
                      </div>
                    )}
                  </div>
                </div>

                {/* Resumo de Ações */}
                <div className="border border-border/50 bg-card/30 p-5 col-span-1 md:col-span-4">
                  <div className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-4">
                    Estado das Ações do Sistema
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(overview.actions || {}).map(([actionType, statuses]) => (
                      <div key={actionType} className="border border-border/30 p-4">
                        <div className="text-xs font-mono font-bold uppercase tracking-widest mb-3 pb-2 border-b border-border/30 text-foreground/80">
                          {actionType}
                        </div>
                        <div className="space-y-2">
                          {Object.entries(statuses || {}).map(([status, count]) => {
                            const badge = getStatusBadgeProps(status);
                            return (
                              <div key={status} className="flex items-center justify-between text-[11px] font-mono">
                                <span className={badge.color + " uppercase tracking-widest"}>{badge.label}</span>
                                <span className="font-bold">{count}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {(!overview.actions || Object.keys(overview.actions).length === 0) && (
                      <div className="col-span-4 text-center text-xs font-mono text-muted-foreground/50 py-8 uppercase tracking-widest border border-border/20">
                        Nenhuma métrica de ação registrada
                      </div>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div className="text-center p-12 border border-border/30 text-muted-foreground font-mono text-xs uppercase tracking-widest">
                Falha ao carregar overview.
              </div>
            )}
          </div>
        )}

        {/* CONTACTS TAB */}
        {activeTab === "contacts" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input 
                  placeholder="Filtrar por nome ou ID..." 
                  className="pl-9 font-mono text-xs h-9 rounded-none bg-muted/10 border-border/40 focus-visible:border-primary/50"
                />
              </div>
            </div>

            <div className="border border-border/50 bg-card/30 overflow-x-auto">
              <table className="w-full text-left font-mono text-xs whitespace-nowrap">
                <thead className="bg-muted/20 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="p-3 font-medium">ID / Contato</th>
                    <th className="p-3 font-medium">Estágio</th>
                    <th className="p-3 font-medium">Risco de Churn</th>
                    <th className="p-3 font-medium">Última Atividade</th>
                    <th className="p-3 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {isLoadingContacts ? (
                    Array(5).fill(0).map((_, i) => (
                      <tr key={i}>
                        <td className="p-3"><Skeleton className="h-8 w-32 bg-muted/20" /></td>
                        <td className="p-3"><Skeleton className="h-5 w-16 bg-muted/20" /></td>
                        <td className="p-3"><Skeleton className="h-5 w-12 bg-muted/20" /></td>
                        <td className="p-3"><Skeleton className="h-5 w-24 bg-muted/20" /></td>
                        <td className="p-3"><Skeleton className="h-6 w-8 bg-muted/20 ml-auto" /></td>
                      </tr>
                    ))
                  ) : !contacts || contacts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground uppercase tracking-widest">
                        Nenhum contato encontrado
                      </td>
                    </tr>
                  ) : (
                    contacts.map(c => (
                      <tr key={c.id} className="hover:bg-muted/10 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-foreground">{c.displayLabel || "Desconhecido"}</div>
                          <div className="text-[10px] text-muted-foreground/50 mt-0.5">{c.emailMasked || c.email || c.id}</div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="rounded-none text-[9px] px-1.5 py-0 uppercase tracking-widest border-border/50">
                            {c.stage || "N/A"}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {c.churnRisk !== undefined ? (
                            <div className={`flex items-center gap-1.5 ${getRiskColor(c.churnRisk)}`}>
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {(c.churnRisk).toFixed(1)}%
                            </div>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground/70 text-[11px]">
                          {c.lastActivityAt ? format(new Date(c.lastActivityAt), "dd/MM/yyyy HH:mm") : "—"}
                        </td>
                        <td className="p-3 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setSelectedContact(c.id)}
                            className="h-7 text-[10px] rounded-none uppercase tracking-widest text-primary hover:text-primary hover:bg-primary/10"
                          >
                            Timeline <ArrowRight className="h-3 w-3 ml-1.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ACTIONS TAB */}
        {activeTab === "actions" && (
          <div className="space-y-4">
            <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 flex items-start gap-3">
              <Shield className="h-5 w-5 text-yellow-500 shrink-0" />
              <div>
                <div className="text-xs font-mono font-bold text-yellow-500 uppercase tracking-widest mb-1">
                  Ações de Ciclo de Vida não implicam envio
                </div>
                <div className="text-[10px] font-mono text-yellow-500/80 leading-relaxed uppercase tracking-widest max-w-3xl">
                  Registros "Pendentes" ou "Concluído no registro" refletem o estado da intenção no sistema. Envios reais para canais externos dependem da infraestrutura de telecomunicações e não são garantidos por esta interface (sem prova de entrega).
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {isLoadingActions ? (
                Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full bg-muted/20" />)
              ) : !actions || actions.length === 0 ? (
                <div className="col-span-1 lg:col-span-2 border border-border/30 p-12 text-center text-muted-foreground font-mono text-xs uppercase tracking-widest">
                  Nenhuma ação registrada
                </div>
              ) : (
                actions.map(act => {
                  const badge = getStatusBadgeProps(act.status);
                  return (
                    <div key={act.id} className="border border-border/50 bg-card/30 p-4 hover:border-primary/30 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="rounded-none text-[9px] px-1.5 py-0 uppercase tracking-widest border-primary/40 text-primary">
                            {act.type}
                          </Badge>
                          <Badge variant="outline" className={`rounded-none text-[9px] px-1.5 py-0 uppercase tracking-widest ${badge.color}`}>
                            {badge.label}
                          </Badge>
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground/50 text-right">
                          {format(new Date(act.createdAt), "dd/MM HH:mm")}
                        </div>
                      </div>
                      
                      <div className="space-y-1.5 mb-3">
                        <div className="text-xs font-mono text-foreground/80 flex items-center justify-between">
                          <span className="text-muted-foreground/60">Canal:</span>
                          <span className="uppercase">{act.channel || "Não especificado"}</span>
                        </div>
                        <div className="text-xs font-mono text-foreground/80 flex items-center justify-between">
                          <span className="text-muted-foreground/60">Risco Associado:</span>
                          <span className={getRiskColor(act.riskScore || 0)}>{act.riskScore != null ? (act.riskScore).toFixed(1) + "%" : "—"}</span>
                        </div>
                      </div>

                      <div className="text-[10px] font-mono text-muted-foreground/60 bg-muted/10 p-2 border border-border/20 line-clamp-2" title={act.reason || undefined}>
                        {act.reason || "Sem motivo registrado"}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      <TimelineSheet contactId={selectedContact} onClose={() => setSelectedContact(null)} />
    </div>
  );
}
