import { useRoute, Link, useLocation } from "wouter";
import {
  useGetCampaign,
  useExecuteCampaign,
  CampaignExecuteInputPhase,
  getGetCampaignQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Play, FileText, FileSpreadsheet,
  CheckCircle2, Clock, AlertCircle, Loader2, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  intake: "Intake em Andamento",
  analyzing: "Analisando",
  strategy_ready: "Estratégia Pronta",
  generating: "Gerando Conteúdo",
  awaiting_approval: "Aguardando Aprovação",
  approved: "Aprovado",
  executing: "Em Execução",
  live: "Ao Vivo",
  completed: "Concluído",
};

const STATUS_COLOR: Record<string, string> = {
  live: "text-success border-success/40 bg-success/10",
  executing: "text-primary border-primary/40 bg-primary/10",
  generating: "text-primary border-primary/40 bg-primary/10",
  analyzing: "text-primary border-primary/40 bg-primary/10",
  awaiting_approval: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
  approved: "text-green-400 border-green-400/40 bg-green-400/10",
  strategy_ready: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10",
  completed: "text-muted-foreground border-border bg-muted/20",
  draft: "text-muted-foreground border-border bg-muted/20",
  intake: "text-blue-400 border-blue-400/40 bg-blue-400/10",
};

// Next action definition per status
interface NextAction {
  label: string;
  phase?: CampaignExecuteInputPhase;
  href?: string;
  description: string;
}

function getNextAction(status: string, campaignId: string): NextAction | null {
  switch (status) {
    case "draft":
      return { label: "Iniciar Intake", href: `/campaigns/${campaignId}/intake`, description: "Preencha o briefing da campanha para liberar a IA." };
    case "intake":
      return { label: "Iniciar Intake", href: `/campaigns/${campaignId}/intake`, description: "Continue preenchendo o briefing para finalizar." };
    case "strategy_ready":
      return { phase: "content", label: "Gerar Conteúdo", description: "A estratégia está pronta. Inicie a geração de conteúdo." };
    case "awaiting_approval":
      return { label: "Ver Conteúdo para Aprovação", href: `/campaigns/${campaignId}/intake`, description: "Revise e aprove o conteúdo gerado pela IA." };
    case "approved":
      return { phase: "launch", label: "Lançar Campanha", description: "Conteúdo aprovado. Inicie o lançamento." };
    case "executing":
      return { phase: "monitor", label: "Ativar Monitoramento", description: "Campanha em execução. Ative o monitoramento de métricas." };
    default:
      return null;
  }
}

// Timeline step for visualizing where the campaign is
const PIPELINE: { id: string; label: string; statuses: string[] }[] = [
  { id: "intake",    label: "01 · Briefing",   statuses: ["draft", "intake"] },
  { id: "strategy",  label: "02 · Estratégia", statuses: ["analyzing", "strategy_ready"] },
  { id: "content",   label: "03 · Conteúdo",   statuses: ["generating", "awaiting_approval", "approved"] },
  { id: "launch",    label: "04 · Lançamento", statuses: ["executing", "live"] },
  { id: "monitor",   label: "05 · Monitor",    statuses: ["completed"] },
];

function getPipelineState(status: string, stepStatuses: string[]): "done" | "active" | "pending" {
  const stepOrder = PIPELINE.map((s) => s.statuses).flat();
  const currentIdx = stepOrder.indexOf(status);
  const stepFirstIdx = Math.min(...stepStatuses.map((s) => stepOrder.indexOf(s)));
  const stepLastIdx  = Math.max(...stepStatuses.map((s) => stepOrder.indexOf(s)));

  if (currentIdx > stepLastIdx) return "done";
  if (currentIdx >= stepFirstIdx && currentIdx <= stepLastIdx) return "active";
  return "pending";
}

export default function CampaignDetail() {
  const [match, params] = useRoute("/campaigns/:id");
  const campaignId = params?.id || "";
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data, isLoading } = useGetCampaign(campaignId, {
    query: {
      enabled: !!campaignId,
      queryKey: getGetCampaignQueryKey(campaignId),
    },
  });

  const executeMutation = useExecuteCampaign({
    mutation: {
      onSuccess: () => {
        toast.success("Fase iniciada com sucesso.");
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        toast.error(msg ?? "Falha ao iniciar fase. Verifique o status da campanha.");
      },
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-8 w-64 bg-muted/20" />
        <Skeleton className="h-64 w-full bg-muted/20" />
      </div>
    );
  }

  if (!data?.campaign) {
    return (
      <div className="p-16 text-center uppercase font-mono text-muted-foreground tracking-widest">
        Campanha não encontrada no registro
      </div>
    );
  }

  const { campaign } = data;
  const nextAction = getNextAction(campaign.status, campaignId);

  const handleExecute = (phase: CampaignExecuteInputPhase) => {
    executeMutation.mutate({ campaignId, data: { phase } });
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* ── Header ── */}
      <div className="border-b border-border/50 pb-5">
        <Link href="/">
          <Button variant="ghost" size="sm" className="font-mono uppercase text-[10px] tracking-widest mb-4 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3 mr-2" />
            Retornar ao Radar
          </Button>
        </Link>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <h1 className="text-2xl md:text-4xl font-mono uppercase tracking-tighter font-bold text-foreground break-all">
                {campaign.title}
              </h1>
              <Badge
                variant="outline"
                className={`font-mono uppercase text-[10px] tracking-widest rounded-none px-3 py-1 border shrink-0 ${STATUS_COLOR[campaign.status] ?? "text-primary border-primary/40 bg-primary/10"}`}
              >
                {STATUS_LABEL[campaign.status] ?? campaign.status}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <span className="bg-card px-3 py-1 border border-border/50">TIPO: {campaign.type}</span>
              <span className="bg-card px-3 py-1 border border-border/50">ALVO: <span className="text-primary">{campaign.track}</span></span>
              {campaign.revenueTarget && (
                <span className="bg-card px-3 py-1 border border-border/50">META: R$ {campaign.revenueTarget}</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <Link href={`/campaigns/${campaign.id}/intake`}>
              <Button variant="outline" className="font-mono uppercase tracking-widest rounded-none gap-2 border-border/50 hover:border-primary/50 hover:text-primary transition-all h-10 px-4 text-xs">
                <FileText className="h-4 w-4" />
                Briefing
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => setLocation("/sequences")}
              className="font-mono uppercase tracking-widest rounded-none gap-2 border-border/50 hover:border-primary/50 hover:text-primary transition-all h-10 px-4 text-xs"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Sequências
            </Button>
          </div>
        </div>
      </div>

      {/* ── Pipeline progress ── */}
      <div className="border border-border/50 bg-card/40 p-4 md:p-6 relative overflow-hidden">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">
          Pipeline de Execução
        </div>
        <div className="flex flex-col md:flex-row gap-2 md:gap-0 md:items-center relative">
          {/* Connecting line desktop */}
          <div className="hidden md:block absolute top-5 left-0 right-0 h-px bg-border/40 z-0" />

          {PIPELINE.map((step, idx) => {
            const state = getPipelineState(campaign.status, step.statuses);
            return (
              <div key={step.id} className="flex md:flex-col md:flex-1 items-center md:items-center gap-3 md:gap-2 relative z-10">
                {/* Mobile connector */}
                {idx > 0 && <div className="md:hidden w-px h-4 bg-border/40 ml-4" />}

                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
                  ${state === "done"   ? "border-success bg-success/20" :
                    state === "active" ? "border-primary bg-primary/20 shadow-[0_0_12px_hsl(var(--primary)/0.4)]" :
                                         "border-border/50 bg-muted/10"
                  }`}
                >
                  {state === "done"   ? <CheckCircle2 className="h-4 w-4 text-success" /> :
                   state === "active" ? <Loader2 className="h-4 w-4 text-primary animate-spin" /> :
                                        <Clock className="h-4 w-4 text-muted-foreground/40" />}
                </div>
                <span className={`text-[9px] md:text-[10px] font-mono uppercase tracking-widest md:text-center
                  ${state === "done"   ? "text-success" :
                    state === "active" ? "text-primary" :
                                         "text-muted-foreground/50"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Next action card ── */}
      {nextAction ? (
        <div className="border border-primary/30 bg-card/40 p-5 md:p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-primary" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-primary" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-primary" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-primary" />

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-widest text-primary flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                Próxima Ação
              </div>
              <h3 className="font-mono font-bold text-lg text-foreground uppercase tracking-wide">{nextAction.label}</h3>
              <p className="text-xs text-muted-foreground font-mono">{nextAction.description}</p>
            </div>

            {nextAction.href ? (
              <Link href={nextAction.href}>
                <Button className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-12 px-6 w-full md:w-auto">
                  <ChevronRight className="h-4 w-4" />
                  {nextAction.label}
                </Button>
              </Link>
            ) : nextAction.phase ? (
              <Button
                className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-12 px-6 w-full md:w-auto"
                onClick={() => handleExecute(nextAction.phase!)}
                disabled={executeMutation.isPending}
              >
                {executeMutation.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Processando...</>
                  : <><Play className="h-4 w-4 fill-current" />{nextAction.label}</>
                }
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="border border-border/50 bg-card/40 p-6 flex items-center gap-4">
          {campaign.status === "live" || campaign.status === "executing" ? (
            <>
              <div className="w-3 h-3 rounded-full bg-success animate-pulse shadow-[0_0_10px_hsl(var(--success))]" />
              <div>
                <div className="font-mono font-bold text-success uppercase tracking-widest">Campanha Ao Vivo</div>
                <div className="text-[10px] text-muted-foreground font-mono mt-0.5">Monitorando em tempo real</div>
              </div>
            </>
          ) : campaign.status === "completed" ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <div className="font-mono font-bold text-muted-foreground uppercase tracking-widest">Campanha Concluída</div>
                <div className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">Todos os dados disponíveis no painel de métricas</div>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-yellow-400 shrink-0" />
              <div>
                <div className="font-mono font-bold text-yellow-400 uppercase tracking-widest">Aguardando ação</div>
                <div className="text-[10px] text-muted-foreground font-mono mt-0.5">Aguardando status: {campaign.status}</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Metadata ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: "ID da Campanha", value: campaign.id.split("-")[0].toUpperCase() },
          { label: "Criado em", value: campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString("pt-BR") : "—" },
          { label: "Atualizado em", value: campaign.updatedAt ? new Date(campaign.updatedAt).toLocaleDateString("pt-BR") : "—" },
        ].map((item) => (
          <div key={item.label} className="border border-border/50 bg-card/30 px-4 py-3">
            <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/70">{item.label}</div>
            <div className="font-mono text-sm text-foreground mt-1 font-bold">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
