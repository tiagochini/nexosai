import { useState, useMemo } from "react";
import {
  Brain, FileText, Layers, BookOpen, Users, Zap, TrendingUp,
  Activity, Target, CheckCircle2, Loader2, Clock, ChevronDown, ChevronRight,
  Bot, Mail, MessageSquare, Palette, Eye,
} from "lucide-react";
import type { CampaignEvent } from "@/lib/socket";
import { intlLocale, useUiLocale, useUiText } from "@/lib/i18n";

// ── Agent metadata ────────────────────────────────────────────────────────────

const AGENT_META: Record<string, { label: [string, string, string]; icon: React.ReactNode; provider: string }> = {
  command:              { label: ["Comando Estratégico", "Strategic Command", "Comando estratégico"], icon: <Zap className="h-4 w-4" />, provider: "claude" },
  strategy:             { label: ["Estrategista de Lançamento", "Launch Strategist", "Estratega de lanzamientos"], icon: <Brain className="h-4 w-4" />, provider: "claude" },
  profile_builder:      { label: ["Construtor de Perfil", "Profile Builder", "Constructor de perfiles"], icon: <Users className="h-4 w-4" />, provider: "claude" },
  offer:                { label: ["Especialista em Oferta", "Offer Specialist", "Especialista en ofertas"], icon: <Target className="h-4 w-4" />, provider: "claude" },
  financial_projector:  { label: ["Projetor Financeiro", "Financial Forecaster", "Proyecciones financieras"], icon: <TrendingUp className="h-4 w-4" />, provider: "gemini" },
  traffic_intelligence: { label: ["Inteligência de Tráfego", "Traffic Intelligence", "Inteligencia de tráfico"], icon: <Activity className="h-4 w-4" />, provider: "gemini" },
  creative_director:    { label: ["Diretor Criativo", "Creative Director", "Director creativo"], icon: <Palette className="h-4 w-4" />, provider: "claude" },
  copywriter:           { label: ["Copywriter", "Copywriter", "Copywriter"], icon: <FileText className="h-4 w-4" />, provider: "gpt" },
  landing_page:         { label: ["Especialista em Landing Page", "Landing Page Specialist", "Especialista en páginas de aterrizaje"], icon: <Layers className="h-4 w-4" />, provider: "gpt" },
  email_sequence:       { label: ["Especialista em e-mail", "Email Specialist", "Especialista en correo electrónico"], icon: <Mail className="h-4 w-4" />, provider: "gpt" },
  whatsapp_sequence:    { label: ["Especialista em WhatsApp", "WhatsApp Specialist", "Especialista en WhatsApp"], icon: <MessageSquare className="h-4 w-4" />, provider: "gpt" },
  audience:             { label: ["Analista de Audiência", "Audience Analyst", "Analista de audiencia"], icon: <Users className="h-4 w-4" />, provider: "gemini" },
  content_planner:      { label: ["Planejador de Conteúdo", "Content Planner", "Planificador de contenido"], icon: <BookOpen className="h-4 w-4" />, provider: "claude" },
  execution_governor:   { label: ["Governador de Execução", "Execution Governor", "Responsable de ejecución"], icon: <Eye className="h-4 w-4" />, provider: "claude" },
};

const PROVIDER_COLOR: Record<string, string> = {
  claude: "text-violet-400",
  gpt:    "text-emerald-400",
  gemini: "text-blue-400",
};

// ── Types ────────────────────────────────────────────────────────────────────

interface AgentSlot {
  role: string;
  status: "pending" | "running" | "completed" | "failed";
  thoughts: Array<{ text: string; ts: string }>;
  startedAt?: string;
  completedAt?: string;
}

interface DbAgent {
  agentRole?: string;
  agentType?: string;
  status?: string;
}

interface Props {
  events: CampaignEvent[];
  dbAgents?: DbAgent[];
  compact?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export function AgentLiveFeed({ events, dbAgents = [], compact = false }: Props) {
  const t = useUiText();
  const { locale } = useUiLocale();
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());

  // Build per-agent state from live socket events
  const liveAgents = useMemo(() => {
    const map = new Map<string, AgentSlot>();
    for (const ev of events) {
      if (!ev.agentType) continue;
      if (!map.has(ev.agentType)) {
        map.set(ev.agentType, { role: ev.agentType, status: "pending", thoughts: [] });
      }
      const slot = map.get(ev.agentType)!;
      if (ev.type === "agent_started") {
        slot.status = "running";
        slot.startedAt = ev.timestamp;
      } else if (ev.type === "agent_thinking" && ev.message) {
        slot.thoughts.push({ text: ev.message, ts: ev.timestamp });
      } else if (ev.type === "agent_completed") {
        slot.status = "completed";
        slot.completedAt = ev.timestamp;
      } else if (ev.type === "agent_failed") {
        slot.status = "failed";
      }
    }
    return Array.from(map.values());
  }, [events]);

  // Merge DB agents (historical, loaded before socket connected) with live feed
  const mergedAgents = useMemo(() => {
    const all = new Map<string, AgentSlot>();

    // Seed from DB (lower priority — may be stale)
    for (const a of dbAgents) {
      const role = (a.agentType ?? a.agentRole ?? "").toLowerCase();
      if (!role) continue;
      if (!all.has(role)) {
        all.set(role, {
          role,
          status: a.status === "completed" ? "completed" : a.status === "running" ? "running" : "pending",
          thoughts: [],
        });
      }
    }

    // Override/add with live socket data (higher priority)
    for (const slot of liveAgents) {
      all.set(slot.role, slot);
    }

    return Array.from(all.values());
  }, [liveAgents, dbAgents]);

  const completedCount = mergedAgents.filter(a => a.status === "completed").length;
  const runningAgent = mergedAgents.find(a => a.status === "running");
  const hasAny = mergedAgents.length > 0;

  function toggle(role: string) {
    setExpandedRoles(prev => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }

  function isExpanded(role: string) {
    // Auto-expand the running agent; user can override
    return expandedRoles.has(role) || (role === runningAgent?.role && !expandedRoles.has(`__closed_${role}`));
  }

  function formatElapsed(startedAt?: string, endedAt?: string) {
    if (!startedAt) return null;
    const start = new Date(startedAt).getTime();
    const end = endedAt ? new Date(endedAt).getTime() : Date.now();
    const s = Math.round((end - start) / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m${s % 60}s`;
  }

  // Empty / initializing state
  if (!hasAny) {
    return (
      <div className={`border border-primary/20 bg-card/20 ${compact ? "p-4" : "p-5"}`}>
        <div className="flex items-center gap-3">
          <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
          <div>
            <p className="font-mono text-sm text-foreground/70">{t("Inicializando agentes...", "Initializing agents...", "Inicializando agentes...")}</p>
            <p className="font-mono text-[11px] text-muted-foreground/40 mt-0.5">
              {t("Os agentes começarão a aparecer aqui em tempo real", "Agents will appear here in real time", "Los agentes aparecerán aquí en tiempo real")}
            </p>
          </div>
        </div>
        {!compact && (
          <div className="mt-4 space-y-2">
            {[70, 50, 60].map((w, i) => (
              <div key={i} className="flex items-center gap-3 opacity-20">
                <div className="w-7 h-7 bg-border/30 animate-pulse rounded-sm shrink-0" />
                <div className="h-2.5 bg-border/30 animate-pulse rounded-sm" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border border-primary/25 bg-card/20 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-primary/15 flex items-center gap-2.5 bg-primary/5">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" style={{ boxShadow: "0 0 6px hsl(var(--primary))" }} />
        <span className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold">
          {t("Agentes em produção", "Agents at work", "Agentes en acción")}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground/40 ml-auto">
          {completedCount}/{mergedAgents.length} {t("concluídos", "completed", "completados")}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-border/20">
        <div
          className="h-full bg-primary transition-all duration-700"
          style={{ width: mergedAgents.length > 0 ? `${(completedCount / mergedAgents.length) * 100}%` : "0%" }}
        />
      </div>

      {/* Agent list */}
      <div className="divide-y divide-border/15">
        {mergedAgents.map((agent) => {
          const meta = AGENT_META[agent.role] ?? {
            label: [agent.role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), agent.role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), agent.role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())] as [string, string, string],
            icon: <Bot className="h-4 w-4" />,
            provider: "claude",
          };
          const expanded = isExpanded(agent.role) && agent.thoughts.length > 0;
          const elapsed = formatElapsed(agent.startedAt, agent.completedAt);

          return (
            <div key={agent.role} className="group">
              {/* Agent row */}
              <div
                className={`px-4 py-3 flex items-center gap-3 transition-colors ${
                  agent.thoughts.length > 0 ? "cursor-pointer hover:bg-white/3" : ""
                }`}
                onClick={() => agent.thoughts.length > 0 && toggle(agent.role)}
              >
                {/* Status icon */}
                <div className={`shrink-0 flex items-center justify-center w-6 h-6 ${
                  agent.status === "completed" ? "text-success" :
                  agent.status === "running"   ? "text-primary" :
                  agent.status === "failed"    ? "text-destructive" :
                  "text-muted-foreground/30"
                }`}>
                  {agent.status === "completed" ? <CheckCircle2 className="h-4 w-4" /> :
                   agent.status === "running"   ? <Loader2 className="h-4 w-4 animate-spin" /> :
                   agent.status === "failed"    ? <span className="text-sm">✗</span> :
                   <Clock className="h-3.5 w-3.5" />}
                </div>

                {/* Agent icon */}
                <div className={`shrink-0 ${
                  agent.status === "completed" ? "text-success/60" :
                  agent.status === "running"   ? "text-primary/80" :
                  "text-muted-foreground/25"
                }`}>
                  {meta.icon}
                </div>

                {/* Name + provider */}
                <div className="flex-1 min-w-0">
                  <span className={`font-mono text-sm font-medium truncate block ${
                    agent.status === "completed" ? "text-foreground/70" :
                    agent.status === "running"   ? "text-foreground" :
                    "text-muted-foreground/40"
                  }`}>
                    {t(...meta.label)}
                  </span>
                  {!compact && (
                    <span className={`font-mono text-[10px] uppercase tracking-widest ${PROVIDER_COLOR[meta.provider] ?? "text-muted-foreground/40"}`}>
                      {meta.provider === "gpt" ? "GPT-5.5" : meta.provider === "gemini" ? "Gemini" : "Claude"}
                    </span>
                  )}
                </div>

                {/* Elapsed / status */}
                <div className="shrink-0 flex items-center gap-2">
                  {elapsed && (
                    <span className="font-mono text-[10px] text-muted-foreground/40 tabular-nums">
                      {elapsed}
                    </span>
                  )}
                  {agent.status === "running" && (
                    <span className="font-mono text-[10px] text-primary uppercase tracking-wider animate-pulse">
                      {t("ativo", "active", "activo")}
                    </span>
                  )}
                  {agent.thoughts.length > 0 && (
                    expanded
                      ? <ChevronDown className="h-3 w-3 text-muted-foreground/30" />
                      : <ChevronRight className="h-3 w-3 text-muted-foreground/20" />
                  )}
                </div>
              </div>

              {/* Thinking panel — expandable */}
              {expanded && agent.thoughts.length > 0 && (
                <div className="border-t border-primary/10 bg-black/20 px-4 py-3 space-y-1.5 max-h-52 overflow-y-auto">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-primary/50 mb-2 flex items-center gap-1.5">
                    <Brain className="h-3 w-3" />
                    {t("Pensamentos do agente", "Agent thoughts", "Pensamientos del agente")}
                  </div>
                  {agent.thoughts.map((t, i) => (
                    <div key={i} className="flex items-start gap-2 font-mono text-[11px] text-muted-foreground/60 leading-relaxed">
                      <span className="shrink-0 text-primary/30 mt-0.5">·</span>
                      <span className="text-muted-foreground/30 shrink-0 tabular-nums text-[10px] mt-0.5">
                        {new Date(t.ts).toLocaleTimeString(intlLocale(locale))}
                      </span>
                      <span>{t.text}</span>
                    </div>
                  ))}
                  {agent.status === "running" && (
                    <div className="flex items-center gap-2 text-primary/40 font-mono text-[11px] pt-1">
                      <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                      <span className="animate-pulse">{t("processando...", "processing...", "procesando...")}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!compact && mergedAgents.length > 0 && (
        <div className="px-4 py-2 border-t border-border/10 bg-black/10">
          <p className="font-mono text-[10px] text-muted-foreground/25 text-center">
            {t("Clique em qualquer agente para expandir os pensamentos em tempo real", "Select an agent to expand its real-time thoughts", "Selecciona un agente para ver sus pensamientos en tiempo real")}
          </p>
        </div>
      )}
    </div>
  );
}
