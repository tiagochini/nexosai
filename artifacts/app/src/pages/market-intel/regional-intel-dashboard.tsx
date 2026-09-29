import { useState } from "react";
import {
  Globe, AlertTriangle, Crosshair, Users, Activity, BarChart2, Plus,
  MapPin, Shield, Clock, CheckCircle2, Zap, Loader2, MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useRegionalConfig, useUpdateRegionalConfig, useRegionalCompetitors, useCreateCompetitor,
  useRegionalEvidence, useRegionalObservations, useRegionalRuns, useRegionalAlerts,
  useAcknowledgeAlert, useRegionalSignals, useRegionalOpportunities, useTransitionOpportunity,
  useRegionalSegments, useRunAcquisition, useRegionalAcquisitionHealth
} from "@/hooks/use-regional-intel";
import { InteractionsTab } from "./interactions-tab";

import { PrepareInteractionPanel } from "./prepare-interaction-panel";
import { intlLocale, useUiLocale, useUiText } from "@/lib/i18n";

interface Props {
  campaignId: string;
}

function heatBandLabel(value: string, t: ReturnType<typeof useUiText>) {
  if (value === "hot") return t("Quente", "Hot", "Caliente");
  if (value === "warm") return t("Morno", "Warm", "Templado");
  if (value === "cold") return t("Frio", "Cold", "Frío");
  return value;
}

function competitorKindLabel(value: string, t: ReturnType<typeof useUiText>) {
  const labels: Record<string, [string, string, string]> = {
    direct: ["Direto", "Direct", "Directo"], indirect: ["Indireto", "Indirect", "Indirecto"],
    substitute: ["Substituto", "Substitute", "Sustituto"], aspirational: ["Aspiracional", "Aspirational", "Aspiracional"],
    emerging: ["Emergente", "Emerging", "Emergente"],
  };
  return labels[value] ? t(...labels[value]!) : value;
}

function runStatusLabel(value: string, t: ReturnType<typeof useUiText>) {
  if (value === "completed") return t("Concluída", "Completed", "Completada");
  if (value === "failed") return t("Falhou", "Failed", "Fallida");
  if (value === "running") return t("Em execução", "Running", "En ejecución");
  return value;
}

function opportunityLifecycleLabel(value: string, t: ReturnType<typeof useUiText>) {
  const labels: Record<string, [string, string, string]> = {
    observed: ["Observada", "Observed", "Observada"], qualified: ["Qualificada", "Qualified", "Calificada"],
    ready_for_activation: ["Pronta para ativação", "Ready for activation", "Lista para activar"],
    activated: ["Ativada", "Activated", "Activada"], closed: ["Encerrada", "Closed", "Cerrada"],
  };
  return labels[value] ? t(...labels[value]!) : value;
}

export function RegionalIntelDashboard({ campaignId }: Props) {
  const t = useUiText();
  const [activeTab, setActiveTab] = useState<"overview" | "opportunities" | "competitors" | "config" | "engine" | "interactions">("overview");
  const [selectedInteractionId, setSelectedInteractionId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-border/50 pb-4 overflow-x-auto hide-scrollbar">
        {[
          { id: "overview", label: t("Visão Geral", "Overview", "Vista general"), icon: BarChart2 },
          { id: "opportunities", label: t("Oportunidades", "Opportunities", "Oportunidades"), icon: Crosshair },
          { id: "competitors", label: t("Concorrentes", "Competitors", "Competidores"), icon: Shield },
          { id: "engine", label: t("Aquisição", "Acquisition", "Adquisición"), icon: Activity },
          { id: "interactions", label: t("Interações", "Interactions", "Interacciones"), icon: MessageSquare },
          { id: "config", label: t("Configuração", "Settings", "Configuración"), icon: Globe },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === t.id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && <OverviewTab campaignId={campaignId} />}
      {activeTab === "opportunities" && <OpportunitiesTab campaignId={campaignId} setActiveTab={setActiveTab} onInteractionPrepared={(id) => { setSelectedInteractionId(id); setActiveTab("interactions"); }} />}
      {activeTab === "competitors" && <CompetitorsTab campaignId={campaignId} />}
      {activeTab === "engine" && <EngineTab campaignId={campaignId} />}
      {activeTab === "interactions" && <InteractionsTab campaignId={campaignId} preselectedId={selectedInteractionId} />}
      {activeTab === "config" && <ConfigTab campaignId={campaignId} />}
    </div>
  );
}

function OverviewTab({ campaignId }: Props) {
  const t = useUiText();
  const { locale } = useUiLocale();
  const dateLocale = intlLocale(locale);
  const { data: alertsData, isLoading: alertsLoading } = useRegionalAlerts(campaignId);
  const { data: signalsData } = useRegionalSignals(campaignId);
  const { data: segmentsData } = useRegionalSegments(campaignId);
  const { mutate: ackAlert, isPending: acking } = useAcknowledgeAlert();

  if (alertsLoading) return <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;

  const openAlerts = alertsData?.alerts?.filter(a => a.status === "open") || [];
  const signals = signalsData?.signals || [];
  const segments = segmentsData?.segments || [];

  return (
    <div className="space-y-6">
      {openAlerts.length > 0 && (
        <div className="border border-amber-500/30 bg-amber-500/5 p-4 rounded-sm space-y-3">
          <div className="flex items-center gap-2 text-amber-500 font-mono text-sm uppercase tracking-wider">
            <AlertTriangle className="h-4 w-4" /> {t("Alertas Regionais Pendentes", "Pending Regional Alerts", "Alertas regionales pendientes")} ({openAlerts.length})
          </div>
          <div className="space-y-2">
            {openAlerts.slice(0, 5).map(alert => (
              <div key={alert.id} className="flex items-start justify-between gap-4 p-3 bg-background/50 border border-border/50 rounded-sm">
                <div>
                  <p className="text-sm font-medium">{t("Mudança Material Detectada", "Material Change Detected", "Cambio importante detectado")}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-1">{t("ID:", "ID:", "ID:")} {alert.changeEventId}</p>
                </div>
                <Button size="sm" variant="outline" disabled={acking} onClick={() => ackAlert({ alertId: alert.id, campaignId })}>
                  {t("Reconhecer", "Acknowledge", "Reconocer")}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Zap className="h-4 w-4" /> {t("Sinais Sociais Recentes", "Recent Social Signals", "Señales sociales recientes")}
          </h3>
          <div className="border border-border/50 bg-card/30 rounded-sm divide-y divide-border/50">
            {signals.length === 0 ? (
              <p className="text-xs text-muted-foreground p-6 text-center">{t("Nenhum sinal coletado ainda.", "No signals collected yet.", "Aún no se han recopilado señales.")}</p>
            ) : (
              signals.slice(0, 10).map((signal: any) => (
                <div key={signal.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{signal.platform}</Badge>
                      <span className="text-xs font-medium">{signal.interactionType}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {new Date(signal.occurredAt).toLocaleDateString(dateLocale)}
                    </span>
                  </div>
                  {signal.publicTextExcerpt && (
                    <p className="text-sm text-muted-foreground bg-background/50 p-2 rounded-sm italic border-l-2 border-primary/30">
                      "{signal.publicTextExcerpt}"
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap pt-1">
                    {signal.sentiment && <Badge variant="secondary" className="text-[10px]">{t("Sentimento:", "Sentiment:", "Sentimiento:")} {signal.sentiment}</Badge>}
                    {signal.intent && <Badge variant="secondary" className="text-[10px]">{t("Intenção:", "Intent:", "Intención:")} {signal.intent}</Badge>}
                    {signal.regionInference && <Badge variant="secondary" className="text-[10px]"><MapPin className="h-3 w-3 mr-1" /> {signal.regionInference}</Badge>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4" /> {t("Segmentos Agregados", "Aggregated Segments", "Segmentos agregados")}
          </h3>
          <div className="grid gap-3">
            {segments.length === 0 ? (
              <div className="border border-border/50 rounded-sm p-6 text-center">
                <p className="text-xs text-muted-foreground">{t("Nenhum segmento materializado.", "No segments available.", "No hay segmentos disponibles.")}</p>
              </div>
            ) : (
              segments.map((seg: any) => (
                <div key={seg.id} className="border border-border/50 rounded-sm p-4 bg-card/30 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{seg.label}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {seg.signalCount} {t("sinais", "signals", "señales")} • {seg.opportunityCount} {t("oportunidades", "opportunities", "oportunidades")}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-primary border-primary/30 bg-primary/5">
                    {seg.lastObservedAt ? new Date(seg.lastObservedAt).toLocaleDateString(dateLocale) : "N/A"}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OpportunitiesTab({ campaignId, setActiveTab, onInteractionPrepared }: Props & { setActiveTab: (t: any) => void; onInteractionPrepared: (id: string) => void }) {
  const t = useUiText();
  const { data, isLoading } = useRegionalOpportunities(campaignId);
  const { mutate: transition, isPending: transitioning } = useTransitionOpportunity();

  const [preparingId, setPreparingId] = useState<string | null>(null);

  if (isLoading) return <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;

  const opps = data?.opportunities || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-sm uppercase tracking-wider">{t("Potenciais Leads", "Potential Leads", "Clientes potenciales")} ({opps.length})</h2>
        <p className="text-xs text-muted-foreground">{t("Classificação baseada em calor determinístico.", "Classification based on deterministic heat scoring.", "Clasificación basada en una puntuación determinista de interés.")}</p>
      </div>

      <div className="grid gap-4">
        {opps.length === 0 ? (
          <div className="border border-border/50 rounded-sm p-12 text-center bg-card/30">
            <Crosshair className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">{t("Nenhuma oportunidade identificada ainda.", "No opportunities identified yet.", "Aún no se han identificado oportunidades.")}</p>
          </div>
        ) : (
          opps.map((opp: any) => (
            <div key={opp.id} className="border border-border/50 rounded-sm p-5 bg-card/30 hover:bg-card/50 transition-colors space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold">{opp.opportunityType}</span>
                    <Badge variant="outline" className={`text-[10px] ${
                      opp.heatBand === "hot" ? "text-destructive border-destructive/30" :
                      opp.heatBand === "warm" ? "text-amber-500 border-amber-500/30" :
                      "text-blue-400 border-blue-400/30"
                    }`}>
                      {t("Pontuação:", "Score:", "Puntuación:")} {opp.heatScore} ({heatBandLabel(opp.heatBand, t)})
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] uppercase">{opportunityLifecycleLabel(opp.lifecycle, t)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{opp.summary}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    {opp.contactPermission === "permitted" ? (
                      <Badge variant="outline" className="text-green-400 border-green-400/30 bg-green-400/5 text-[10px]">{t("Contato Permitido", "Contact Permitted", "Contacto permitido")}</Badge>
                    ) : opp.contactPermission === "opted_out" ? (
                      <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/5 text-[10px]">{t("Opt-Out", "Opted out", "Exclusión voluntaria")}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 text-[10px]">{t("Sem Permissão", "No Permission", "Sin permiso")}</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 pt-2">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">{t("Motivos do Score", "Score Reasons", "Motivos de la puntuación")}</p>
                  <ul className="space-y-1">
                    {(opp.scoreReasons || []).map((r: string, i: number) => (
                      <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                        <span className="text-primary">•</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">{t("Ações", "Actions", "Acciones")}</p>
                  <div className="flex flex-wrap gap-2">
                    {opp.lifecycle === "observed" && (
                      <Button size="sm" variant="outline" disabled={transitioning} onClick={() => transition({ opportunityId: opp.id, lifecycle: "qualified", campaignId })}>
                        {t("Qualificar", "Qualify", "Calificar")}
                      </Button>
                    )}
                    {(opp.lifecycle === "qualified" || opp.lifecycle === "observed") && (
                      <Button size="sm" variant="secondary" onClick={() => setPreparingId(opp.id)}>
                        {t("Preparar Interação", "Prepare Interaction", "Preparar interacción")}
                      </Button>
                    )}
                    {(opp.lifecycle === "ready_for_activation") && opp.contactPermission === "permitted" && (
                      <Button size="sm" className="bg-green-500 hover:bg-green-600 text-black" disabled={transitioning} onClick={() => transition({ opportunityId: opp.id, lifecycle: "activated", campaignId })}>
                        {t("Ativar (Apenas Contrato Futuro)", "Activate (Future Contract Only)", "Activar (solo contrato futuro)")}
                      </Button>
                    )}
                    {opp.contactPermission !== "permitted" && (
                      <p className="text-[10px] text-destructive flex items-center gap-1 mt-1">
                        <AlertTriangle className="h-3 w-3" /> {t("Sem base legal para ativação", "No legal basis for activation", "Sin base legal para activación")}
                      </p>
                    )}
                  </div>
                  {preparingId === opp.id && (
                    <PrepareInteractionPanel
                      opportunityId={opp.id}
                      onCancel={() => setPreparingId(null)}
                      onSuccess={(createdOpportunityId) => onInteractionPrepared(createdOpportunityId)}
                    />
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CompetitorsTab({ campaignId }: Props) {
  const t = useUiText();
  const { locale } = useUiLocale();
  const dateLocale = intlLocale(locale);
  const { data, isLoading } = useRegionalCompetitors(campaignId);
  const { mutate: createCompetitor, isPending } = useCreateCompetitor();

  const [name, setName] = useState("");
  const [kind, setKind] = useState<any>("direct");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [notes, setNotes] = useState("");

  if (isLoading) return <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;

  const competitors = data?.competitors || [];

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="space-y-4">
          <h2 className="font-mono text-sm uppercase tracking-wider">{t("Concorrentes Regionais", "Regional Competitors", "Competidores regionales")} ({competitors.length})</h2>
          <div className="grid gap-3">
            {competitors.length === 0 ? (
              <div className="border border-border/50 rounded-sm p-8 text-center bg-card/30">
                <p className="text-xs text-muted-foreground">{t("Nenhum concorrente cadastrado.", "No competitors added.", "No hay competidores registrados.")}</p>
              </div>
            ) : (
              competitors.map((c: any) => (
                <div key={c.id} className="border border-border/50 rounded-sm p-4 bg-card/30 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{c.name}</p>
                      <Badge variant="outline" className="text-[10px]">{competitorKindLabel(c.kind, t)}</Badge>
                    </div>
                    {c.websiteUrl && (
                      <p className="text-xs text-primary hover:underline cursor-pointer font-mono truncate max-w-sm">
                        {c.websiteUrl}
                      </p>
                    )}
                    {c.notes && <p className="text-xs text-muted-foreground mt-2">{c.notes}</p>}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(c.createdAt).toLocaleDateString(dateLocale)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border border-border/50 rounded-sm p-4 bg-card/50 space-y-4 sticky top-6">
          <h3 className="font-mono text-xs uppercase tracking-wider">{t("Novo Concorrente", "New Competitor", "Nuevo competidor")}</h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-muted-foreground">{t("Nome *", "Name *", "Nombre *")}</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-background border border-border/50 rounded-sm px-3 py-1.5 text-sm focus:outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-muted-foreground">{t("Tipo *", "Type *", "Tipo *")}</label>
              <select value={kind} onChange={e => setKind(e.target.value)} className="w-full bg-background border border-border/50 rounded-sm px-3 py-1.5 text-sm focus:outline-none focus:border-primary/50">
                <option value="direct">{t("Direto", "Direct", "Directo")}</option>
                <option value="indirect">{t("Indireto", "Indirect", "Indirecto")}</option>
                <option value="substitute">{t("Substituto", "Substitute", "Sustituto")}</option>
                <option value="aspirational">{t("Aspiracional", "Aspirational", "Aspiracional")}</option>
                <option value="emerging">{t("Emergente", "Emerging", "Emergente")}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-muted-foreground">{t("URL do site", "Website URL", "URL del sitio")}</label>
              <input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://..." aria-label={t("URL do site do concorrente", "Competitor website URL", "URL del sitio del competidor")} className="w-full bg-background border border-border/50 rounded-sm px-3 py-1.5 text-sm focus:outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-muted-foreground">{t("Notas", "Notes", "Notas")}</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full bg-background border border-border/50 rounded-sm px-3 py-1.5 text-sm focus:outline-none focus:border-primary/50 resize-none" />
            </div>
            <Button
              className="w-full"
              disabled={isPending || !name.trim()}
              onClick={() => {
                createCompetitor({ campaignId, name, kind, websiteUrl: websiteUrl || undefined, notes: notes || undefined }, {
                  onSuccess: () => { setName(""); setWebsiteUrl(""); setNotes(""); }
                });
              }}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              {t("Adicionar", "Add", "Añadir")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EngineTab({ campaignId }: Props) {
  const t = useUiText();
  const { locale } = useUiLocale();
  const dateLocale = intlLocale(locale);
  const { data: runsData } = useRegionalRuns(campaignId);
  const { data: healthData } = useRegionalAcquisitionHealth();
  const { data: evidenceData } = useRegionalEvidence(campaignId);
  const { data: observationsData } = useRegionalObservations(campaignId);
  const { mutate: runNow, isPending } = useRunAcquisition();

  const runs = runsData?.runs || [];
  const evidence = evidenceData?.evidence || [];
  const observations = observationsData?.observations || [];

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="border border-border/50 rounded-sm p-6 bg-card/30 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-sm uppercase tracking-wider flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> {t("Motor de Aquisição", "Acquisition Engine", "Motor de adquisición")}
            </h2>
            {healthData?.paused && <Badge variant="outline" className="text-destructive border-destructive/30">{t("Pausado", "Paused", "En pausa")}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {t("O motor varre fontes públicas, coleta evidências e constrói sinais continuamente.", "The engine scans public sources, gathers evidence, and continuously builds signals.", "El motor analiza fuentes públicas, recopila evidencia y genera señales continuamente.")}
          </p>
          <div className="flex gap-3 pt-2">
            <Button disabled={isPending || healthData?.paused} onClick={() => runNow({ campaignId, mode: "detailed" })}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
              {t("Forçar Varredura (Detalhada)", "Force Scan (Detailed)", "Forzar exploración (detallada)")}
            </Button>
            <Button variant="outline" disabled={isPending || healthData?.paused} onClick={() => runNow({ campaignId, mode: "lightweight" })}>
              {t("Varredura Rápida", "Quick Scan", "Exploración rápida")}
            </Button>
          </div>
        </div>

        <div className="border border-border/50 rounded-sm p-6 bg-card/30 space-y-4">
          <h2 className="font-mono text-sm uppercase tracking-wider flex items-center gap-2">
            <Clock className="h-4 w-4" /> {t("Últimas Execuções", "Recent Runs", "Ejecuciones recientes")}
          </h2>
          <div className="space-y-2">
            {runs.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("Nenhuma execução registrada.", "No runs recorded.", "No hay ejecuciones registradas.")}</p>
            ) : (
              runs.slice(0, 4).map((run: any) => (
                <div key={run.id} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    {run.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                    ) : run.status === "failed" ? (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : (
                      <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />
                    )}
                    <span className="text-xs font-mono uppercase">{runStatusLabel(run.status, t)}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(run.startedAt).toLocaleString(dateLocale)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{t("Evidências Coletadas", "Collected Evidence", "Evidencia recopilada")}</h3>
          <div className="border border-border/50 rounded-sm bg-card/30 divide-y divide-border/50">
            {evidence.length === 0 ? (
              <p className="text-xs text-muted-foreground p-6 text-center">{t("Nenhuma evidência.", "No evidence.", "No hay evidencia.")}</p>
            ) : (
              evidence.slice(0, 5).map((e: any) => (
                <div key={e.id} className="p-4 space-y-2">
                  <p className="text-sm font-medium">{e.claim}</p>
                  <p className="text-[10px] text-primary font-mono truncate">{e.source?.url || t("Fonte pública", "Public source", "Fuente pública")}</p>
                  <span className="text-[10px] text-muted-foreground font-mono">{new Date(e.observedAt).toLocaleDateString(dateLocale)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{t("Últimas Observações", "Recent Observations", "Observaciones recientes")}</h3>
          <div className="border border-border/50 rounded-sm bg-card/30 divide-y divide-border/50">
            {observations.length === 0 ? (
              <p className="text-xs text-muted-foreground p-6 text-center">{t("Nenhuma observação.", "No observations.", "No hay observaciones.")}</p>
            ) : (
              observations.slice(0, 5).map((o: any) => (
                <div key={o.id} className="p-4 space-y-2">
                  <div className="flex gap-2 mb-1">
                    <Badge variant="secondary" className="text-[10px]">{t("ID do concorrente:", "Competitor ID:", "ID del competidor:")} {o.competitorId.substring(0, 6)}...</Badge>
                  </div>
                  <pre className="text-[10px] text-muted-foreground bg-background/50 p-2 rounded-sm overflow-x-auto">
                    {JSON.stringify(o.facts, null, 2)}
                  </pre>
                  <span className="text-[10px] text-muted-foreground font-mono">{new Date(o.observedAt).toLocaleDateString(dateLocale)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfigTab({ campaignId }: Props) {
  const t = useUiText();
  const { data, isLoading } = useRegionalConfig(campaignId);
  const { mutate: updateConfig, isPending } = useUpdateRegionalConfig();

  const [region, setRegion] = useState("");
  const [locale, setLocale] = useState("pt-BR");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [countryCode, setCountryCode] = useState("BR");
  const [languages, setLanguages] = useState("pt");

  // Load initial data
  useState(() => {
    if (data?.profile) {
      setRegion(data.profile.region || "");
      setLocale(data.profile.locale || "pt-BR");
      setTimezone(data.profile.timezone || "America/Sao_Paulo");
      setCountryCode(data.profile.countryCode || "BR");
      setLanguages((data.profile.languages || []).join(", "));
    }
  });

  if (isLoading) return <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="border border-border/50 rounded-sm p-6 bg-card/30 max-w-2xl space-y-6">
      <div className="space-y-1">
        <h2 className="font-mono text-sm uppercase tracking-wider flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" /> {t("Perfil Geográfico", "Geographic Profile", "Perfil geográfico")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("Defina as fronteiras de observação desta campanha.", "Define the observation boundaries for this campaign.", "Define los límites de observación de esta campaña.")}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase text-muted-foreground">{t("Região Alvo *", "Target Region *", "Región objetivo *")}</label>
          <input value={region} onChange={e => setRegion(e.target.value)} placeholder={t("Ex: Sudeste do Brasil, LatAm...", "E.g., Southeastern Brazil, LatAm...", "Ej.: Sudeste de Brasil, LatAm...")} className="w-full bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase text-muted-foreground">{t("País (ISO 3166-1 alpha-2)", "Country (ISO 3166-1 alpha-2)", "País (ISO 3166-1 alpha-2)")}</label>
          <input value={countryCode} onChange={e => setCountryCode(e.target.value)} placeholder="BR, US, PT..." className="w-full bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50 uppercase" maxLength={2} />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase text-muted-foreground">{t("Fuso Horário (IANA)", "Time Zone (IANA)", "Zona horaria (IANA)")}</label>
          <input value={timezone} onChange={e => setTimezone(e.target.value)} placeholder="America/Sao_Paulo" className="w-full bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase text-muted-foreground">{t("Idiomas (vírgula)", "Languages (comma-separated)", "Idiomas (separados por comas)")}</label>
          <input value={languages} onChange={e => setLanguages(e.target.value)} placeholder="pt, es, en" className="w-full bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary/50" />
        </div>
      </div>

      <div className="pt-2">
        <Button
          disabled={isPending || !region.trim()}
          onClick={() => {
            updateConfig({
              campaignId,
              region,
              locale,
              countryCode: countryCode.toUpperCase(),
              timezone,
              languages: languages.split(",").map(s => s.trim()).filter(Boolean)
            });
          }}
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {t("Salvar Configurações", "Save Settings", "Guardar configuración")}
        </Button>
      </div>
    </div>
  );
}
