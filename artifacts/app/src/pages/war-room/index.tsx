/**
 * War Room — visão simplificada do progresso de uma campanha (Modo Fundador).
 *
 * Modo compacto: nome, fase, progresso, departamentos, próximo passo.
 * Modo expandido: agentes trabalhando, decisões tomadas, logs resumidos.
 * O usuário alterna com "Ver mais / Ver menos".
 *
 * No modo Arquiteto, redireciona para /campaigns/:id (visão completa).
 */

import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useMode } from "@/lib/mode";
import { useGetCampaign } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UxContextBar } from "@/components/ux-context-bar";
import { FeatureOnboarding, FeatureOnboardingTrigger } from "@/components/feature-onboarding";
import { FEATURE_KEYS } from "@/hooks/useFeatureOnboarding";
import {
  ChevronRight, ChevronDown, ChevronUp, Loader2,
  CheckCircle2, Circle, Clock, Rocket, ArrowRight,
  AlertCircle, Bot, Zap, BarChart2, Target, MessageSquare,
  Users, Shield, Play, ExternalLink,
} from "lucide-react";
import { Link } from "wouter";

// ── Departamentos (agrupa agentes em conceitos humanos) ──────────────────────

interface Department {
  id: string;
  label: string;
  icon: React.ElementType;
  phases: string[]; // statuses de campanha em que este dept está ativo
}

const DEPARTMENTS: Department[] = [
  { id: "strategy",    label: "Estratégia",   icon: Target,        phases: ["analyzing", "strategy_ready"] },
  { id: "product",     label: "Produto",       icon: Zap,           phases: ["intake", "analyzing"] },
  { id: "offer",       label: "Oferta",        icon: Rocket,        phases: ["analyzing", "strategy_ready"] },
  { id: "audience",    label: "Público",       icon: Users,         phases: ["analyzing", "strategy_ready"] },
  { id: "copy",        label: "Copy",          icon: MessageSquare, phases: ["generating", "awaiting_approval"] },
  { id: "creatives",   label: "Criativos",     icon: Zap,           phases: ["generating", "awaiting_approval"] },
  { id: "funnel",      label: "Funil",         icon: BarChart2,     phases: ["generating", "awaiting_approval"] },
  { id: "automation",  label: "Automação",     icon: Bot,           phases: ["approved", "executing", "live"] },
  { id: "traffic",     label: "Tráfego",       icon: Target,        phases: ["executing", "live"] },
  { id: "integrations",label: "Integrações",   icon: Zap,           phases: ["approved", "executing"] },
  { id: "metrics",     label: "Métricas",      icon: BarChart2,     phases: ["live", "completed"] },
  { id: "approvals",   label: "Aprovações",    icon: Shield,        phases: ["awaiting_approval", "strategy_ready"] },
];

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  intake:            "Briefing com IA",
  analyzing:         "Time Estratégico Trabalhando",
  strategy_ready:    "Estratégia Pronta para Revisão",
  generating:        "Criando Copies e Criativos",
  awaiting_approval: "Aguardando sua Aprovação",
  approved:          "Aprovado — Preparando Lançamento",
  executing:         "Lançamento em Execução",
  live:              "Campanha ao Vivo",
  paused:            "Pausado",
  completed:         "Concluído",
  cancelled:         "Cancelado",
};

const STATUS_PROGRESS: Record<string, number> = {
  intake: 8, analyzing: 20, strategy_ready: 35,
  generating: 50, awaiting_approval: 60, approved: 70,
  executing: 80, live: 90, paused: 85, completed: 100, cancelled: 0,
};

const STATUS_STATE: Record<string, "idle" | "working" | "needs_action" | "done"> = {
  intake: "idle", analyzing: "working", strategy_ready: "needs_action",
  generating: "working", awaiting_approval: "needs_action", approved: "idle",
  executing: "working", live: "working", paused: "idle",
  completed: "done", cancelled: "idle",
};

function getNextStepLabel(status: string): string {
  switch (status) {
    case "intake":            return "Continuar briefing";
    case "strategy_ready":    return "Revisar estratégia";
    case "awaiting_approval": return "Aprovar conteúdo";
    case "approved":          return "Preparar lançamento";
    case "live":              return "Ver resultados";
    case "completed":         return "Ver relatório final";
    default:                  return "Ver detalhes";
  }
}

function getHappening(status: string): string {
  switch (status) {
    case "intake":            return "Seu briefing está sendo coletado. A IA está conhecendo seu negócio.";
    case "analyzing":         return "O time de estratégia está analisando seu mercado, público e oferta.";
    case "strategy_ready":    return "A estratégia está pronta. Revise e aprove para avançar para criação.";
    case "generating":        return "Os especialistas estão criando copies, emails, WhatsApp e roteiros.";
    case "awaiting_approval": return "O conteúdo está pronto para você revisar e aprovar antes do lançamento.";
    case "approved":          return "Tudo aprovado. Configurando integrações e agendamentos automáticos.";
    case "executing":         return "O lançamento está sendo executado. Acompanhe os primeiros resultados.";
    case "live":              return "Sua campanha está ao vivo. A IA monitora e otimiza em tempo real.";
    case "paused":            return "Campanha pausada. Retome quando estiver pronto.";
    case "completed":         return "Lançamento concluído. Veja o relatório completo de resultados.";
    default:                  return "Processando...";
  }
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function WarRoom() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { isArquiteto } = useMode();
  const [expanded, setExpanded] = useState(false);

  // No modo Arquiteto → redireciona para visão completa
  useEffect(() => {
    if (isArquiteto) {
      setLocation(`/campaigns/${id}`);
    }
  }, [isArquiteto, id, setLocation]);

  const { data: campaignData, isLoading } = useGetCampaign(id!, {});
  const campaign = campaignData?.campaign;

  // Agentes recentes
  const { data: agentsData } = useQuery({
    queryKey: ["war-room-agents", id],
    enabled: !!id,
    refetchInterval: 10_000,
    queryFn: async () => {
      const res = await customFetch<{ agents: AgentRun[]; checkpoints: Checkpoint[] }>(
        `/api/campaigns/${id}/agents`
      );
      return res;
    },
  });

  if (isLoading || !campaign) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 py-8">
        <div className="h-8 w-48 bg-muted/20 animate-pulse" />
        <div className="h-32 bg-muted/20 animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-muted/20 animate-pulse" />)}
        </div>
      </div>
    );
  }

  const status = campaign.status;
  const progress = STATUS_PROGRESS[status] ?? 0;
  const uxState = STATUS_STATE[status] ?? "idle";
  const activeDepts = DEPARTMENTS.filter(d => d.phases.includes(status));
  const pendingDepts = DEPARTMENTS.filter(d => !d.phases.includes(status));
  const agents = (agentsData?.agents ?? []).slice(-6).reverse();
  const checkpoints = (agentsData?.checkpoints ?? []).filter(c => c.status === "awaiting_review");
  const nextStepLabel = getNextStepLabel(status);
  const nextStepHref = status === "intake" ? `/campaigns/${id}/intake`
    : status === "awaiting_approval" ? `/campaigns/${id}/content`
    : `/campaigns/${id}`;

  return (
    <div className="max-w-3xl mx-auto space-y-4">

      {/* Feature onboarding — first visit */}
      <FeatureOnboarding
        featureKey={FEATURE_KEYS.WAR_ROOM}
        title="Sua War Room de Lançamento"
        description="Esta é a central de controle da sua campanha. Aqui você acompanha o que o time está fazendo, o que precisa da sua aprovação e o próximo passo."
        steps={[
          "Acompanhe o progresso por departamento",
          "Quando aparecer 'Aguarda aprovação', é hora de agir",
          "Use 'Ver mais' para ver detalhes técnicos do que os agentes fizeram",
        ]}
        variant="banner"
      />

      {/* UX Context Bar */}
      <UxContextBar
        where={STATUS_LABEL[status] ?? status}
        happening={getHappening(status)}
        understood={campaign.title}
        requiresApproval={
          checkpoints.length > 0
            ? `${checkpoints.length} item${checkpoints.length > 1 ? "s" : ""} esperando sua aprovação`
            : undefined
        }
        nextStep={nextStepLabel}
        nextStepHref={nextStepHref}
        state={uxState}
      />

      {/* ── Cabeçalho da campanha ── */}
      <div className="border border-border/50 bg-card/30 p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1">
              Campanha em andamento
            </div>
            <h1 className="font-mono font-black text-xl uppercase tracking-tight text-foreground">
              {campaign.title}
            </h1>
          </div>
          <Badge
            variant="outline"
            className={`rounded-none font-mono text-[11px] uppercase tracking-widest shrink-0 ${
              status === "live" ? "border-success/40 text-success bg-success/10" :
              status === "awaiting_approval" ? "border-yellow-400/40 text-yellow-400 bg-yellow-400/10 animate-pulse" :
              "border-primary/40 text-primary bg-primary/10"
            }`}
          >
            {STATUS_LABEL[status] ?? status}
          </Badge>
        </div>

        {/* Barra de progresso */}
        <div className="mb-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
              Progresso da operação
            </span>
            <span className="font-mono text-[11px] font-bold text-primary">{progress}%</span>
          </div>
          <div className="h-1.5 bg-muted/30 w-full">
            <div
              className="h-full bg-primary transition-all duration-1000"
              style={{ width: `${progress}%`, boxShadow: "0 0 8px hsl(var(--primary)/0.4)" }}
            />
          </div>
        </div>
      </div>

      {/* ── Departamentos ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50">
            Departamentos
          </span>
          <FeatureOnboardingTrigger featureKey={FEATURE_KEYS.WAR_ROOM} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {DEPARTMENTS.map((dept) => {
            const isActive = activeDepts.some(d => d.id === dept.id);
            const Icon = dept.icon;
            return (
              <div
                key={dept.id}
                className={`border p-3 flex items-center gap-2.5 transition-colors ${
                  isActive
                    ? "border-primary/30 bg-primary/5"
                    : "border-border/20 bg-card/10 opacity-40"
                }`}
              >
                {isActive ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 animate-pulse" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20 shrink-0" />
                )}
                <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground/30"}`} />
                <span className={`font-mono text-[11px] uppercase tracking-widest font-bold ${isActive ? "text-foreground/80" : "text-muted-foreground/30"}`}>
                  {dept.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Aprovações pendentes ── */}
      {checkpoints.length > 0 && (
        <div className="border border-yellow-400/30 bg-yellow-400/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-yellow-400" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-yellow-400 font-bold">
              {checkpoints.length} aprovação{checkpoints.length > 1 ? "ões" : ""} pendente{checkpoints.length > 1 ? "s" : ""}
            </span>
          </div>
          <p className="font-mono text-xs text-muted-foreground/70 mb-3">
            O time está aguardando sua decisão para avançar.
          </p>
          <Link href={`/campaigns/${id}/content`}>
            <Button size="sm" className="rounded-none font-mono uppercase tracking-widest text-[11px] h-8 gap-1.5 btn-weapon-primary">
              Revisar e aprovar
              <ChevronRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      )}

      {/* ── Toggle expandido ── */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center justify-center gap-2 py-3 border border-border/30 hover:border-border/50 font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      >
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {expanded ? "Ver menos" : "Ver mais — agentes e decisões"}
      </button>

      {/* ── Detalhes expandidos ── */}
      {expanded && (
        <div className="space-y-3">
          {/* Agentes recentes */}
          {agents.length > 0 && (
            <div className="border border-border/30 p-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-3">
                O que o time fez recentemente
              </div>
              <div className="space-y-2">
                {agents.map((agent) => (
                  <div key={agent.id} className="flex items-center gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      agent.status === "completed" ? "bg-success" :
                      agent.status === "running"   ? "bg-primary animate-pulse" :
                      "bg-muted-foreground/30"
                    }`} />
                    <span className="font-mono text-[11px] text-foreground/60 capitalize">
                      {agent.agentRole.replace(/_/g, " ")}
                    </span>
                    <span className={`font-mono text-[10px] ml-auto ${
                      agent.status === "completed" ? "text-success/70" :
                      agent.status === "running"   ? "text-primary/70" :
                      "text-muted-foreground/40"
                    }`}>
                      {agent.status === "completed" ? "Concluído" :
                       agent.status === "running"   ? "Em andamento" : agent.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Link para visão completa */}
          <Link href={`/campaigns/${id}`}>
            <div className="flex items-center justify-center gap-2 py-3 border border-border/20 hover:border-border/40 transition-colors cursor-pointer">
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/40 hover:text-muted-foreground/60">
                Abrir visão técnica completa
              </span>
            </div>
          </Link>
        </div>
      )}

      {/* ── Próximo passo CTA ── */}
      {!["completed", "cancelled", "live"].includes(status) && (
        <div className="border border-border/30 bg-card/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-0.5">
              Próximo passo
            </div>
            <p className="font-mono text-sm text-foreground/80 font-bold">
              {nextStepLabel}
            </p>
          </div>
          <Link href={nextStepHref}>
            <Button className="rounded-none font-mono uppercase tracking-widest font-bold gap-2 btn-weapon-primary h-10 px-6 text-xs shrink-0">
              <Play className="h-3.5 w-3.5" />
              {nextStepLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Types locais ──────────────────────────────────────────────────────────────
interface AgentRun {
  id: string;
  agentRole: string;
  status: string;
  startedAt: string;
  completedAt?: string;
}
interface Checkpoint {
  id: string;
  type: string;
  status: string;
  createdAt: string;
}
