import { useRoute, Link } from "wouter";
import { useGetSequence, getGetSequenceQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Cpu, AlertTriangle, FileText, Link2, Copy, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useUiText } from "@/lib/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ── Lead Capture Link Component ────────────────────────────────────────────────

function LeadCaptureLink({ sequenceId }: { sequenceId: string }) {
  const t = useUiText();
  const [copied, setCopied] = useState(false);
  const baseUrl = window.location.origin;
  const captureUrl = `${baseUrl}/c/${sequenceId}`;

  const handleCopy = () => {
    void navigator.clipboard.writeText(captureUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="border border-primary/20 bg-primary/5 px-5 py-4 flex items-center gap-4 flex-wrap">
      <Link2 className="h-4 w-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1">{t("Link público de captura de leads", "Public Lead Capture Link", "Enlace público para captar leads")}</p>
        <p className="font-mono text-xs text-foreground/70 truncate">{captureUrl}</p>
      </div>
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest border border-primary/30 text-primary px-3 py-1.5 hover:bg-primary/10 transition-colors shrink-0"
      >
        {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? t("Copiado!", "Copied!", "¡Copiado!") : t("Copiar", "Copy", "Copiar")}
      </button>
      <a
        href={captureUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest border border-border/40 text-muted-foreground px-3 py-1.5 hover:text-foreground hover:border-border transition-colors shrink-0"
      >
        <Link2 className="h-3 w-3" />
        {t("Abrir", "Open", "Abrir")}
      </a>
    </div>
  );
}

export default function SequenceDetail() {
  const t = useUiText();
  const [match, params] = useRoute("/sequences/:id");
  const sequenceId = params?.id || "";
  const queryClient = useQueryClient();

  const [generating, setGenerating] = useState(false);
  const [activating, setActivating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data, isLoading } = useGetSequence(sequenceId, {
    query: {
      enabled: !!sequenceId,
      queryKey: getGetSequenceQueryKey(sequenceId),
    }
  });

  const sequence = data?.sequence;
  const cfg = (sequence?.config ?? {}) as Record<string, unknown>;
  const isGeneratingInBackground = cfg["generatingPlan"] === true;

  // ── Polling: auto-detect background generation (handles page reload after timeout) ──
  const startPolling = () => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const fresh = await queryClient.fetchQuery({
        queryKey: getGetSequenceQueryKey(sequenceId),
        queryFn: () => customFetch<{ sequence: typeof sequence }>(`/api/launch-sequences/${sequenceId}`),
        staleTime: 0,
      });
      const freshCfg = ((fresh as { sequence?: Record<string, unknown> })?.sequence?.["config"] ?? {}) as Record<string, unknown>;
      const freshItems = ((fresh as { sequence?: Record<string, unknown> })?.sequence?.["items"] as unknown[]) ?? [];

      if (freshCfg["generatingPlan"] !== true && freshItems.length > 0) {
        // Generation completed — stop polling, refresh, notify user
        stopPolling();
        setGenerating(false);
        void queryClient.invalidateQueries({ queryKey: getGetSequenceQueryKey(sequenceId) });
        toast.success(t(`Plano gerado — ${freshItems.length} itens criados pelo agente.`, `Plan generated — ${freshItems.length} items created by the agent.`, `Plan generado: el agente creó ${freshItems.length} elementos.`));
      } else if (freshCfg["generatingPlan"] !== true && freshItems.length === 0) {
        // Generation failed — stop polling
        stopPolling();
        setGenerating(false);
        void queryClient.invalidateQueries({ queryKey: getGetSequenceQueryKey(sequenceId) });
        toast.error(t("Falha na geração do plano. Tente novamente.", "Plan generation failed. Try again.", "No se pudo generar el plan. Inténtalo de nuevo."));
      }
    }, 3000);
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  // On load: if server already generating (user refreshed or reconnected), auto-poll
  useEffect(() => {
    if (isGeneratingInBackground && !generating) {
      setGenerating(true);
      startPolling();
    }
    return () => stopPolling();
  }, [isGeneratingInBackground]);

  const handleGeneratePlan = async (force = false) => {
    setGenerating(true);
    try {
      const url = `/api/launch-sequences/${sequenceId}/generate${force ? "?force=true" : ""}`;
      const result = await customFetch<{ status: string; sequence?: unknown }>(url, { method: "POST" });

      if ((result as { status?: string }).status === "ready") {
        // Items already existed — server returned immediately
        void queryClient.invalidateQueries({ queryKey: getGetSequenceQueryKey(sequenceId) });
        toast.success(t("Plano carregado — os itens já existiam no servidor.", "Plan loaded — the items already existed on the server.", "Plan cargado: los elementos ya existían en el servidor."));
        setGenerating(false);
        return;
      }

      // status === "generating" — fire-and-forget on server, start polling here
      startPolling();
      toast.info(t("Agente em operação. O plano aparecerá automaticamente quando estiver pronto (~60–90 s).", "Agent is working. The plan will appear automatically when ready (~60–90s).", "El agente está trabajando. El plan aparecerá automáticamente cuando esté listo (~60–90 s)."));
    } catch {
      setGenerating(false);
      toast.error(t("Erro ao iniciar geração do plano.", "Failed to start plan generation.", "No se pudo iniciar la generación del plan."));
    }
  };

  const handleActivate = async () => {
    setActivating(true);
    try {
      await customFetch(`/api/launch-sequences/${sequenceId}/activate`, { method: "POST", body: JSON.stringify({}) });
      void queryClient.invalidateQueries({ queryKey: getGetSequenceQueryKey(sequenceId) });
      toast.success(t("Sequência ativada. Em operação.", "Sequence activated and running.", "Secuencia activada y en funcionamiento."));
    } catch {
      toast.error(t("Erro ao ativar sequência.", "Failed to activate sequence.", "No se pudo activar la secuencia."));
    } finally {
      setActivating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8 p-8">
        <Skeleton className="h-8 w-64 bg-muted/20" />
        <Skeleton className="h-64 w-full bg-muted/20" />
      </div>
    );
  }

  if (!sequence) return <div className="p-16 text-center uppercase font-mono text-muted-foreground tracking-widest">{t("Matriz não encontrada no registro", "Sequence matrix not found", "No se encontró la matriz de secuencias")}</div>;

  const channelColors: Record<string, string> = {
    email: "text-blue-400 border-blue-400/40 bg-blue-400/10",
    whatsapp: "text-green-400 border-green-400/40 bg-green-400/10",
    social: "text-pink-400 border-pink-400/40 bg-pink-400/10",
    blog: "text-orange-400 border-orange-400/40 bg-orange-400/10"
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'live': return 'badge-glow-green text-success border-success/40 bg-success/10';
      case 'draft': return 'text-muted-foreground border-border bg-muted/20';
      case 'generating': return 'badge-glow-blue text-primary border-primary/40 bg-primary/10 animate-pulse-slow';
      default: return 'badge-glow-primary text-primary border-primary/40 bg-primary/10';
    }
  };
  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active": case "live": return t("Ativa", "Active", "Activa");
      case "draft": return t("Rascunho", "Draft", "Borrador");
      case "scheduled": return t("Agendada", "Scheduled", "Programada");
      case "generating": return t("Gerando", "Generating", "Generando");
      default: return status;
    }
  };

  const hasItems = (sequence.items?.length ?? 0) > 0;
  const isDraft = sequence.status === 'draft' || sequence.status === 'scheduled';

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-border/50 pb-6 gap-6">
        <div>
          <Link href="/sequences">
            <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest mb-6 -ml-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3 mr-2" />
              {t("Todas as Sequências", "All Sequences", "Todas las secuencias")}
            </Button>
          </Link>
          <div className="flex items-center gap-5">
            <h1 className="text-4xl font-mono uppercase tracking-tighter font-bold text-foreground drop-shadow-sm">{sequence.name}</h1>
            <Badge variant="outline" className={`font-mono uppercase text-xs tracking-widest rounded-none px-3 py-1 border ${getStatusColor(generating ? 'generating' : sequence.status)}`}>
              {generating ? t("Gerando", "Generating", "Generando") : getStatusLabel(sequence.status)}
            </Badge>
          </div>
          <div className="flex gap-4 text-xs font-mono uppercase tracking-widest text-muted-foreground mt-4 flex-wrap">
            <span className="bg-card px-3 py-1 border border-border/50 shadow-sm">{t("DIAS:", "DAYS:", "DÍAS:")} {sequence.totalDays}</span>
            <span className="bg-card px-3 py-1 border border-border/50 shadow-sm">{t("MODELO:", "MODEL:", "MODELO:")} <span className="text-primary font-bold">{sequence.model}</span></span>
            {hasItems && <span className="bg-card px-3 py-1 border border-border/50 shadow-sm">{t("ITENS:", "ITEMS:", "ELEMENTOS:")} <span className="text-primary font-bold">{sequence.items?.length}</span></span>}
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          {/* Generating in background — show pulsing indicator */}
          {generating && (
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-primary border border-primary/30 bg-primary/5 px-4 h-10 animate-pulse">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("Agente em operação…", "Agent is working…", "Agente en operación…")}
            </div>
          )}

          {/* Generate button — shown when no items, or as force-regenerate when items exist */}
          {!generating && isDraft && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant={hasItems ? "outline" : "default"}
                  className={`font-mono uppercase tracking-widest rounded-none gap-2 h-10 px-5 ${!hasItems ? "btn-weapon-primary" : "border-border/50 text-muted-foreground hover:text-foreground"}`}
                >
                  {hasItems ? <><RefreshCw className="h-3.5 w-3.5" /> {t("Regenerar Plano", "Regenerate Plan", "Regenerar plan")}</> : <><Cpu className="h-4 w-4" /> {t("Gerar Plano com agente (-30 créditos)", "Generate Agent Plan (-30 credits)", "Generar plan con el agente (-30 créditos)")}</>}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border border-primary/30 bg-card/90 backdrop-blur-xl rounded-none shadow-[0_0_50px_hsl(var(--primary)/0.15)]">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-mono uppercase tracking-widest font-bold text-lg border-b border-border/50 pb-4 flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center border border-primary/30">
                      <AlertTriangle className="h-4 w-4 text-primary" />
                    </div>
                    {t("Autorização Necessária", "Authorization Required", "Autorización necesaria")}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="font-mono text-sm mt-6 text-foreground/80 leading-relaxed">
                    {hasItems
                      ? <>{t("Regenerar o plano", "Regenerating the plan", "Regenerar el plan")} <strong className="text-primary">{t(`substituirá todos os ${sequence.items?.length} itens atuais`, `will replace all ${sequence.items?.length} current items`, `reemplazará los ${sequence.items?.length} elementos actuales`)}</strong> {t("e deduzirá 30 créditos.", "and deduct 30 credits.", "y descontará 30 créditos.")}</>
                      : <>{t("A geração de um plano tático completo pelo agente deduzirá", "Generating a complete tactical plan with the agent will deduct", "Generar un plan táctico completo con el agente descontará")} <strong className="text-primary">30 {t("créditos", "credits", "créditos")}</strong> {t("do seu saldo.", "from your balance.", "de tu saldo.")}</>
                    }
                    <br /><br />
                    {t("O plano aparecerá automaticamente nesta página quando o agente concluir (~60–90 s). Você pode navegar livremente durante a geração.", "The plan will appear on this page automatically when the agent finishes (~60–90s). You can navigate freely while it is generated.", "El plan aparecerá automáticamente aquí cuando el agente termine (~60–90 s). Puedes navegar mientras se genera.")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-8 border-t border-border/50 pt-4">
                  <AlertDialogCancel className="rounded-none font-mono uppercase text-xs tracking-widest border-border/50 hover:bg-muted/20">{t("Abortar", "Cancel", "Cancelar")}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void handleGeneratePlan(hasItems)} className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-primary">
                    {t("Autorizar Operação", "Authorize Operation", "Autorizar operación")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Activate button */}
          {!generating && sequence.status !== 'active' && hasItems && (
            <Button
              onClick={() => void handleActivate()}
              disabled={activating}
              variant="outline"
              className="font-mono uppercase tracking-widest rounded-none gap-2 border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_15px_hsl(var(--primary)/0.3)] transition-all h-10 px-5"
            >
              {activating ? t("Processando...", "Processing...", "Procesando...") : <><Play className="h-4 w-4 fill-current" /> {t("Ativar Protocolo", "Activate Protocol", "Activar protocolo")}</>}
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Submenu */}
      <div className="flex border-b border-border/50 overflow-x-auto no-scrollbar pb-[1px]">
        <Link href={`/sequences/${sequenceId}`}>
          <div className="px-6 py-4 font-mono text-xs font-bold uppercase tracking-widest text-primary border-b-2 border-primary bg-primary/5 cursor-pointer shrink-0">
            {t("Inventário", "Overview", "Resumen")}
          </div>
        </Link>
        <Link href={`/sequences/${sequenceId}/calendar`}>
          <div className="px-6 py-4 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/10 cursor-pointer shrink-0 transition-colors">
            {t("Calendário", "Calendar", "Calendario")}
          </div>
        </Link>
        <Link href={`/sequences/${sequenceId}/today`}>
          <div className="px-6 py-4 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/10 cursor-pointer shrink-0 transition-colors">
            {t("Operação do Dia", "Today's Operations", "Operación del día")}
          </div>
        </Link>
        <Link href={`/sequences/${sequenceId}/copy`}>
          <div className="px-6 py-4 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/10 cursor-pointer shrink-0 transition-colors">
            {t("Estúdio de Copy", "Copy Studio", "Estudio de textos")}
          </div>
        </Link>
        <Link href={`/sequences/${sequenceId}/analytics`}>
          <div className="px-6 py-4 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/10 cursor-pointer shrink-0 transition-colors">
            {t("Métricas", "Metrics", "Métricas")}
          </div>
        </Link>
        <Link href={`/sequences/${sequenceId}/contacts`}>
          <div className="px-6 py-4 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/10 cursor-pointer shrink-0 transition-colors">
            {t("Base de Contatos", "Contact List", "Lista de contactos")}
          </div>
        </Link>
      </div>

      {/* Lead Capture Link */}
      {Boolean((sequence as unknown as Record<string, unknown>)["leadCaptureEnabled"]) && (
        <LeadCaptureLink sequenceId={sequenceId} />
      )}

      {/* Generating state — skeleton with status message */}
      {generating && !hasItems && (
        <div className="p-20 flex flex-col items-center justify-center text-center border border-primary/20 bg-primary/5 backdrop-blur-sm card-weapon">
          <div className="w-20 h-20 rounded-full border border-primary/40 bg-background/50 flex items-center justify-center mb-6 relative">
            <div className="absolute inset-0 rounded-full border border-primary/30 animate-ping opacity-30"></div>
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
          <p className="font-mono text-sm uppercase tracking-widest text-primary font-bold mb-2">{t("Agente em operação", "Agent is working", "Agente en operación")}</p>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground max-w-md leading-relaxed">
            {t("O plano está sendo gerado pelo agente em segundo plano. Esta página atualizará automaticamente quando os itens estiverem prontos. Você pode navegar livremente.", "The agent is generating the plan in the background. This page will refresh automatically when the items are ready. You can navigate freely.", "El agente está generando el plan en segundo plano. Esta página se actualizará automáticamente cuando los elementos estén listos. Puedes navegar libremente.")}
          </p>
        </div>
      )}

      {/* Generating + items exist — show items with loading overlay at top */}
      {generating && hasItems && (
        <div className="flex items-center gap-3 border border-primary/20 bg-primary/5 px-5 py-3 font-mono text-xs uppercase tracking-widest text-primary">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          {t("Regenerando plano — os novos itens aparecerão automaticamente. Os itens anteriores continuam abaixo.", "Regenerating plan — new items will appear automatically. Previous items remain below.", "Regenerando el plan: los nuevos elementos aparecerán automáticamente. Los anteriores se mantienen abajo.")}
        </div>
      )}

      {/* Empty state */}
      {!generating && !hasItems && (
        <div className="p-20 flex flex-col items-center justify-center text-center border border-border/50 bg-card/40 backdrop-blur-sm card-weapon">
          <div className="w-20 h-20 rounded-full border border-border/50 bg-background/50 flex items-center justify-center mb-6 relative">
            <div className="absolute inset-0 rounded-full border border-primary/20 animate-pulse-slow"></div>
            <FileText className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="font-mono text-sm uppercase tracking-widest text-foreground font-bold mb-2">{t("Matriz de itens vazia", "Sequence has no items", "La matriz está vacía")}</p>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground max-w-md leading-relaxed">
            {t("Esta sequência não contém envios programados. Use o botão acima para gerar um plano completo com o agente.", "This sequence has no scheduled deliveries. Use the button above to generate a complete plan with the agent.", "Esta secuencia no tiene envíos programados. Usa el botón de arriba para generar un plan completo con el agente.")}
          </p>
        </div>
      )}

      {/* Items list */}
      {hasItems && (
        <div className="border border-border/50 bg-card/40 backdrop-blur-sm relative">
          <div className="absolute left-0 inset-y-0 w-[2px] bg-gradient-to-b from-primary/30 to-transparent"></div>

          <div className="grid grid-cols-12 gap-4 p-4 border-b border-border/50 bg-muted/20 font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <div className="col-span-1 pl-2">{t("Dia", "Day", "Día")}</div>
            <div className="col-span-2">{t("Fase", "Phase", "Fase")}</div>
            <div className="col-span-5">{t("Mensagem / Pauta", "Message / Topic", "Mensaje / tema")}</div>
            <div className="col-span-2">{t("Canal", "Channel", "Canal")}</div>
            <div className="col-span-2">{t("Gatilho Mental", "Psychological Trigger", "Activador psicológico")}</div>
          </div>

          <div className="divide-y divide-border/30">
            {sequence.items?.map((item) => (
              <div key={item.id} className="grid grid-cols-12 gap-4 p-4 items-center table-row-glow font-mono text-sm group">
                <div className="col-span-1 font-bold text-primary pl-2">D{item.dayIndex}</div>
                <div className="col-span-2 uppercase text-xs tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">{item.phase}</div>
                <div className="col-span-5 truncate pr-4">
                  <div className="font-bold truncate text-foreground group-hover:text-primary transition-colors">{item.name}</div>
                  <div className="text-xs text-muted-foreground truncate uppercase tracking-widest mt-1">{item.description}</div>
                </div>
                <div className="col-span-2">
                  <Badge variant="outline" className={`rounded-none font-mono text-[11px] tracking-widest uppercase border ${channelColors[(item as unknown as Record<string, string>)["channel"]] || 'text-foreground border-border bg-muted/10'}`}>
                    {(item as unknown as Record<string, string>)["channel"]}
                  </Badge>
                </div>
                <div className="col-span-2 text-xs uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
                  {item.mentalTrigger?.replace(/_/g, ' ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
