/**
 * DecisionTracePanel — Modo Arquiteto only
 *
 * Mostra a trilha auditável de decisões da campanha:
 * cadeia de agentes, decisões com racional, doctrine checks,
 * self-critique e pesos aplicados.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import {
  Brain, ChevronDown, ChevronRight, CheckCircle2, XCircle,
  Cpu, Shield, Sparkles, Scale, GitBranch, Eye,
} from "lucide-react";

// ─── Types (mirrors backend) ──────────────────────────────────────────────────

interface TraceAgent {
  agentType:   string;
  status:      string;
  aiProvider:  string | null;
  model:       string | null;
  creditsUsed: number;
  tokensUsed:  number | null;
  completedAt: string | null;
  keyOutputs:  string[];
  influence:   "primary" | "secondary" | "validation";
}

interface TraceDecision {
  dimension:  string;
  value:      string;
  rationale:  string[];
  agent:      string;
  confidence: number;
}

interface DoctrineCheck {
  principle: string;
  passed:    boolean;
  reason:    string;
}

interface DecisionTrace {
  campaignId:     string;
  campaignTitle:  string;
  status:         string;
  track:          string;
  generatedAt:    string;
  agentChain:     TraceAgent[];
  keyDecisions:   TraceDecision[];
  doctrineChecks: DoctrineCheck[];
  selfCritique: {
    ran:           boolean;
    overallScore:  number | null;
    strengths:     string[];
    risks:         string[];
    suggestions:   string[];
  };
  memoryInfluence: {
    alignmentScore:     number | null;
    conflicts:          string[];
    warnings:           string[];
    verticalInsights:   string[];
    creativeDirection:  string | null;
  };
  decisionWeights: {
    appliedProfile: string | null;
    weightedKPIs:   string[];
  };
  narrativeSummary: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INFLUENCE_LABEL: Record<string, string> = {
  primary:    "Primário",
  secondary:  "Secundário",
  validation: "Validação",
};

const INFLUENCE_COLOR: Record<string, string> = {
  primary:    "text-violet-400 border-violet-500/30 bg-violet-500/10",
  secondary:  "text-blue-400 border-blue-500/30 bg-blue-500/10",
  validation: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
};

const STATUS_ICON: Record<string, string> = {
  completed: "✓",
  failed:    "✗",
  running:   "◎",
  pending:   "○",
  skipped:   "–",
};

const PROVIDER_COLOR: Record<string, string> = {
  anthropic: "text-orange-400",
  openai:    "text-emerald-400",
  gemini:    "text-blue-400",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, label, count }: { icon: React.ElementType; label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-3.5 w-3.5 text-cyan-400" />
      <span className="font-mono text-[11px] uppercase tracking-widest text-cyan-300/80 font-semibold">
        {label}
      </span>
      {count !== undefined && (
        <span className="ml-auto font-mono text-[10px] text-white/30">{count}</span>
      )}
    </div>
  );
}

function AgentCard({ agent, index }: { agent: TraceAgent; index: number }) {
  const [open, setOpen] = useState(false);
  const infColor = INFLUENCE_COLOR[agent.influence] ?? INFLUENCE_COLOR["secondary"]!;
  const provColor = PROVIDER_COLOR[agent.aiProvider ?? ""] ?? "text-white/40";

  return (
    <div className="border border-white/8 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors text-left"
      >
        <span className="font-mono text-[10px] text-white/20 w-4 shrink-0">{index + 1}</span>
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${infColor} shrink-0`}>
          {INFLUENCE_LABEL[agent.influence]}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono text-white/80 font-semibold truncate">{agent.agentType}</p>
          {agent.aiProvider && (
            <p className={`text-[10px] font-mono ${provColor}`}>{agent.aiProvider} · {agent.model}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-[10px] font-mono ${agent.status === "completed" ? "text-emerald-400" : "text-white/30"}`}>
            {STATUS_ICON[agent.status] ?? "?"} {agent.status}
          </span>
          {agent.creditsUsed > 0 && (
            <span className="text-[10px] font-mono text-white/30">{agent.creditsUsed} cr</span>
          )}
          {open ? <ChevronDown className="h-3 w-3 text-white/30" /> : <ChevronRight className="h-3 w-3 text-white/30" />}
        </div>
      </button>
      {open && agent.keyOutputs.length > 0 && (
        <div className="px-4 pb-3 space-y-1 border-t border-white/5 pt-3">
          {agent.keyOutputs.map((o, i) => (
            <p key={i} className="text-[11px] text-white/50 font-mono">· {o}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function DecisionCard({ decision }: { decision: TraceDecision }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/8 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">{decision.dimension}</p>
          <p className="text-sm font-mono text-white/90 font-semibold">{decision.value}</p>
          <p className="text-[10px] font-mono text-white/30">por {decision.agent}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex flex-col items-end gap-1">
            <div className="h-1 w-16 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full"
                style={{ width: `${decision.confidence}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-cyan-400/60">{decision.confidence}%</span>
          </div>
          {open ? <ChevronDown className="h-3 w-3 text-white/30" /> : <ChevronRight className="h-3 w-3 text-white/30" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-3 border-t border-white/5 pt-2 space-y-1">
          <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-1">Porque:</p>
          {decision.rationale.map((r, i) => (
            <p key={i} className="text-[11px] text-white/60 font-mono">· {r}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DecisionTracePanel({ campaignId }: { campaignId: string }) {
  const [activeSection, setActiveSection] = useState<"agents" | "decisions" | "doctrine" | "critique" | "memory">("decisions");

  const { data, isLoading, error } = useQuery({
    queryKey: ["decision-trace", campaignId],
    queryFn:  () => customFetch<{ trace: DecisionTrace }>(`/api/campaigns/${campaignId}/decision-trace`),
    staleTime: 30_000,
  });

  const trace = data?.trace;

  if (isLoading) {
    return (
      <div className="border border-cyan-500/20 rounded-xl bg-cyan-500/5 p-6 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="h-4 w-4 text-cyan-400" />
          <span className="font-mono text-xs uppercase tracking-widest text-cyan-400">Carregando Trilha de Decisão...</span>
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-white/5 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !trace) {
    return (
      <div className="border border-white/10 rounded-xl bg-white/2 p-6">
        <div className="flex items-center gap-3">
          <Brain className="h-4 w-4 text-white/30" />
          <span className="font-mono text-xs uppercase tracking-widest text-white/30">
            Trilha de decisão disponível após estratégia ser gerada
          </span>
        </div>
      </div>
    );
  }

  const SECTIONS = [
    { id: "decisions" as const, label: "Decisões",    icon: Scale,      count: trace.keyDecisions.length   },
    { id: "agents"   as const, label: "Agentes",      icon: Cpu,        count: trace.agentChain.length     },
    { id: "doctrine" as const, label: "Doctrine",     icon: Shield,     count: trace.doctrineChecks.length },
    { id: "critique" as const, label: "Self-Critique", icon: Sparkles,  count: trace.selfCritique.strengths.length + trace.selfCritique.risks.length },
    { id: "memory"   as const, label: "Memória",      icon: GitBranch,  count: trace.memoryInfluence.conflicts.length + trace.memoryInfluence.verticalInsights.length },
  ];

  return (
    <div className="border border-cyan-500/20 rounded-xl bg-[#050d1a] overflow-hidden shadow-[0_0_40px_rgba(6,182,212,0.06)]">
      {/* Header */}
      <div className="flex items-start justify-between px-6 py-4 border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
            <Eye className="h-4 w-4 text-cyan-400" />
          </div>
          <div>
            <h3 className="font-mono text-sm font-bold text-white uppercase tracking-widest">
              Trilha de Decisão
            </h3>
            <p className="font-mono text-[10px] text-cyan-400/60 uppercase tracking-widest">
              Modo Arquiteto · explainability total
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
            {trace.agentChain.length} agentes · {trace.keyDecisions.length} decisões
          </p>
        </div>
      </div>

      {/* Narrative summary */}
      <div className="px-6 py-4 border-b border-white/5 bg-white/2">
        <p className="text-xs font-mono text-white/60 leading-relaxed italic">"{trace.narrativeSummary}"</p>
      </div>

      {/* Section tabs */}
      <div className="flex gap-0.5 px-4 pt-3 border-b border-white/8 overflow-x-auto">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={[
              "flex items-center gap-1.5 px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors shrink-0 border-b-2",
              activeSection === s.id
                ? "text-cyan-300 border-cyan-400"
                : "text-white/30 border-transparent hover:text-white/60",
            ].join(" ")}
          >
            <s.icon className="h-3 w-3" />
            {s.label}
            {s.count > 0 && (
              <span className="ml-0.5 text-[9px] text-white/20">{s.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-6 py-4 space-y-3 max-h-[520px] overflow-y-auto">

        {/* Decisions */}
        {activeSection === "decisions" && (
          <>
            <SectionHeader icon={Scale} label="Decisões estratégicas com racional" count={trace.keyDecisions.length} />
            {trace.keyDecisions.length === 0 ? (
              <p className="text-xs font-mono text-white/30">Sem decisões registradas ainda.</p>
            ) : (
              trace.keyDecisions.map((d, i) => <DecisionCard key={i} decision={d} />)
            )}
            {trace.decisionWeights.weightedKPIs.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/5">
                <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-2">
                  Pesos aplicados · perfil {trace.decisionWeights.appliedProfile}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {trace.decisionWeights.weightedKPIs.map((k, i) => (
                    <span key={i} className="font-mono text-[10px] text-cyan-400/70 border border-cyan-500/20 bg-cyan-500/5 px-2 py-0.5 rounded">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Agent chain */}
        {activeSection === "agents" && (
          <>
            <SectionHeader icon={Cpu} label="Cadeia de agentes executados" count={trace.agentChain.length} />
            {trace.agentChain.length === 0 ? (
              <p className="text-xs font-mono text-white/30">Nenhum agente executado ainda.</p>
            ) : (
              trace.agentChain.map((a, i) => <AgentCard key={i} agent={a} index={i} />)
            )}
          </>
        )}

        {/* Doctrine */}
        {activeSection === "doctrine" && (
          <>
            <SectionHeader icon={Shield} label="Doctrine Gate — 7 princípios validados" count={trace.doctrineChecks.length} />
            {trace.doctrineChecks.length === 0 ? (
              <p className="text-xs font-mono text-white/30">Doctrine Gate ainda não rodou para esta campanha.</p>
            ) : (
              <div className="space-y-2">
                {trace.doctrineChecks.map((c, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-lg border border-white/8 bg-white/2">
                    {c.passed
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      : <XCircle     className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    }
                    <div className="flex-1">
                      <p className="text-xs font-mono font-semibold text-white/80">{c.principle}</p>
                      <p className="text-[11px] font-mono text-white/40 mt-0.5">{c.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Self-critique */}
        {activeSection === "critique" && (
          <>
            <SectionHeader icon={Sparkles} label="Self-Critique — Claude auditando Claude" />
            {!trace.selfCritique.ran ? (
              <p className="text-xs font-mono text-white/30">Self-critique ainda não executado.</p>
            ) : (
              <div className="space-y-4">
                {trace.selfCritique.overallScore !== null && (
                  <div className="flex items-center gap-4 px-4 py-3 rounded-lg border border-white/8">
                    <div>
                      <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Score geral</p>
                      <p className="text-2xl font-mono font-black text-white">{trace.selfCritique.overallScore}<span className="text-sm text-white/30">/100</span></p>
                    </div>
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all"
                        style={{ width: `${trace.selfCritique.overallScore}%` }}
                      />
                    </div>
                  </div>
                )}
                {trace.selfCritique.strengths.length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono text-emerald-400/60 uppercase tracking-widest mb-2">Forças</p>
                    {trace.selfCritique.strengths.map((s, i) => (
                      <p key={i} className="text-xs font-mono text-white/60 mb-1">✓ {s}</p>
                    ))}
                  </div>
                )}
                {trace.selfCritique.risks.length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono text-amber-400/60 uppercase tracking-widest mb-2">Riscos</p>
                    {trace.selfCritique.risks.map((r, i) => (
                      <p key={i} className="text-xs font-mono text-white/60 mb-1">⚠ {r}</p>
                    ))}
                  </div>
                )}
                {trace.selfCritique.suggestions.length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono text-cyan-400/60 uppercase tracking-widest mb-2">Sugestões</p>
                    {trace.selfCritique.suggestions.map((s, i) => (
                      <p key={i} className="text-xs font-mono text-white/60 mb-1">→ {s}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Memory influence */}
        {activeSection === "memory" && (
          <>
            <SectionHeader icon={GitBranch} label="Influência da memória cognitiva" />
            <div className="space-y-4">
              {trace.memoryInfluence.alignmentScore !== null && (
                <div className="px-4 py-3 rounded-lg border border-white/8 bg-white/2">
                  <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-1">Score de alinhamento</p>
                  <div className="flex items-center gap-3">
                    <p className="text-xl font-mono font-black text-white">{trace.memoryInfluence.alignmentScore}<span className="text-sm text-white/30">/100</span></p>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                        style={{ width: `${trace.memoryInfluence.alignmentScore}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
              {trace.memoryInfluence.creativeDirection && (
                <div className="px-4 py-3 rounded-lg border border-violet-500/20 bg-violet-500/5">
                  <p className="text-[10px] font-mono text-violet-400/60 uppercase tracking-widest mb-1">Direção criativa aprovada</p>
                  <p className="text-xs font-mono text-violet-300">{trace.memoryInfluence.creativeDirection}</p>
                </div>
              )}
              {trace.memoryInfluence.verticalInsights.length > 0 && (
                <div>
                  <p className="text-[10px] font-mono text-blue-400/60 uppercase tracking-widest mb-2">Insights verticais injetados</p>
                  {trace.memoryInfluence.verticalInsights.map((v, i) => (
                    <p key={i} className="text-xs font-mono text-white/50 mb-1">· {v}</p>
                  ))}
                </div>
              )}
              {trace.memoryInfluence.conflicts.length > 0 && (
                <div>
                  <p className="text-[10px] font-mono text-red-400/60 uppercase tracking-widest mb-2">Conflitos detectados</p>
                  {trace.memoryInfluence.conflicts.map((c, i) => (
                    <p key={i} className="text-xs font-mono text-white/50 mb-1">⚡ {c}</p>
                  ))}
                </div>
              )}
              {trace.memoryInfluence.conflicts.length === 0 && trace.memoryInfluence.verticalInsights.length === 0 && !trace.memoryInfluence.creativeDirection && (
                <p className="text-xs font-mono text-white/30">Memória disponível após execução dos agentes de estratégia.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
