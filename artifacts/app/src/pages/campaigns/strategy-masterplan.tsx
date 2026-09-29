import { useState, useRef } from "react";
import { useTextAnnotation, AnnotationToolbar, AnnotationDialog } from "@/components/strategy-annotation";
import {
  Target, Users, Zap, BarChart3, Brain, ShieldAlert,
  TrendingUp, MessageSquare, Lightbulb, Flame, Star,
  ChevronDown, Check, AlertTriangle, Pencil, X, Save,
  Award, Crosshair, Lock, Download, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { generateMasterplanPDF, type PdfUserIdentity } from "@/lib/masterplan-pdf";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useUiText } from "@/lib/i18n";

// ─── Types & utils ────────────────────────────────────────────────────────────

export type StrategyObj = Record<string, unknown>;
type Obj = Record<string, unknown>;
type ModuleStatus = "pending" | "approved" | "flagged" | "rejected";

export function parseStrategyInsights(strategyD: StrategyObj): StrategyObj {
  const raw = strategyD["executiveSummary"];
  if (typeof raw !== "string") return {};
  const stripped = raw
    .replace(/^```json\s*/m, "").replace(/^```\s*/m, "").replace(/```\s*$/m, "").trim();
  try {
    const parsed = JSON.parse(stripped);
    return typeof parsed === "object" && parsed !== null ? parsed as StrategyObj : {};
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try { return JSON.parse(match[0]) as StrategyObj; } catch { return {}; }
  }
}

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  return "";
}
function arr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim() !== "");
}
function num(v: unknown): number | null {
  const n = Number(v);
  return isNaN(n) ? null : n;
}
function obj(v: unknown): Obj {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Obj;
  return {};
}

// ─── Document primitives ──────────────────────────────────────────────────────

function SectionLabel({ n, children }: { n?: string; children: React.ReactNode }) {
  const t = useUiText();
  const labels: Record<string, [string, string, string]> = {
    "Análise de Viabilidade e PMF": ["Análise de Viabilidade e PMF", "Feasibility and PMF Analysis", "Análisis de viabilidad y PMF"],
    "Proposta Única de Valor": ["Proposta Única de Valor", "Unique Value Proposition", "Propuesta de valor única"],
    "Mecanismo Único": ["Mecanismo Único", "Unique Mechanism", "Mecanismo único"],
    "Contexto e Preço": ["Contexto e Preço", "Context and Pricing", "Contexto y precio"],
    "Vantagens Competitivas": ["Vantagens Competitivas", "Competitive Advantages", "Ventajas competitivas"],
    "Cenário Competitivo": ["Cenário Competitivo", "Competitive Landscape", "Panorama competitivo"],
    "Oportunidades · Ameaças · Barreiras": ["Oportunidades · Ameaças · Barreiras", "Opportunities · Threats · Barriers", "Oportunidades · Amenazas · Barreras"],
    "Avatar Principal": ["Avatar Principal", "Primary Avatar", "Avatar principal"],
    "Perfil Psicográfico": ["Perfil Psicográfico", "Psychographic Profile", "Perfil psicográfico"],
    "Estratégia de Sofisticação": ["Estratégia de Sofisticação", "Sophistication Strategy", "Estrategia de sofisticación"],
    "Gatilhos e Objeções": ["Gatilhos e Objeções", "Triggers and Objections", "Disparadores y objeciones"],
    "Avatares Secundários": ["Avatares Secundários", "Secondary Avatars", "Avatares secundarios"],
    "Narrativa Central": ["Narrativa Central", "Core Narrative", "Narrativa central"],
    "Gancho Emocional": ["Gancho Emocional", "Emotional Hook", "Gancho emocional"],
    "Mensagens-Chave": ["Mensagens-Chave", "Key Messages", "Mensajes clave"],
    "Pilares de Conteúdo": ["Pilares de Conteúdo", "Content Pillars", "Pilares de contenido"],
    "Distribuição por Plataforma": ["Distribuição por Plataforma", "Platform Distribution", "Distribución por plataforma"],
    "Estratégia de CTA": ["Estratégia de CTA", "CTA Strategy", "Estrategia de CTA"],
    "Gatilho Dominante": ["Gatilho Dominante", "Dominant Trigger", "Disparador dominante"],
    "Sequência de Ativação Dia a Dia": ["Sequência de Ativação Dia a Dia", "Day-by-Day Activation Sequence", "Secuencia de activación día a día"],
    "Ponte de Transformação": ["Ponte de Transformação", "Transformation Bridge", "Puente de transformación"],
    "Ângulos Anti-Requisito": ["Ângulos Anti-Requisito", "Anti-Requirement Angles", "Ángulos antirrequisito"],
    "Blueprint de Prova Social": ["Blueprint de Prova Social", "Social Proof Blueprint", "Plan de prueba social"],
    "Unit Economics": ["Economia Unitária", "Unit Economics", "Economía unitaria"],
    "Premissas Críticas": ["Premissas Críticas", "Critical Assumptions", "Supuestos críticos"],
    "Diretrizes de Execução": ["Diretrizes de Execução", "Execution Guidelines", "Directrices de ejecución"],
  };
  return (
    <div className="flex items-center gap-2 mb-2.5">
      {n && (
        <span className="font-mono text-[9px] text-primary/40 tracking-widest shrink-0">{n}</span>
      )}
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/35">
        {typeof children === "string" && labels[children] ? t(...labels[children]) : children}
      </span>
      <div className="flex-1 h-px bg-white/5" />
    </div>
  );
}

function QuoteBlock({ children, color = "primary" }: { children: React.ReactNode; color?: "primary" | "cyan" | "violet" | "amber" }) {
  const border = { primary: "border-l-primary/50", cyan: "border-l-cyan-400/50", violet: "border-l-violet-400/50", amber: "border-l-amber-400/50" }[color];
  const text   = { primary: "text-foreground/90", cyan: "text-foreground/90", violet: "text-foreground/90", amber: "text-foreground/90" }[color];
  return (
    <div className={`border-l-2 ${border} pl-4 py-1 bg-white/[0.015]`}>
      <p className={`font-mono text-sm font-bold ${text} leading-snug`}>{children}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useUiText();
  const labels: Record<string, [string, string, string]> = {
    "Posicionamento": ["Posicionamento", "Positioning", "Posicionamiento"],
    "Justificativa de Preço": ["Justificativa de Preço", "Pricing Rationale", "Justificación del precio"],
  };
  return (
    <div className="space-y-1">
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/35">{labels[label] ? t(...labels[label]) : label}</div>
      <div className="font-mono text-xs text-foreground/75 leading-relaxed">{children}</div>
    </div>
  );
}

function NumberedList({ items, color = "default" }: {
  items: string[];
  color?: "default" | "cyan" | "green" | "red" | "amber";
}) {
  if (!items.length) return null;
  const accent = {
    default: "text-primary/40",
    cyan:    "text-cyan-400/60",
    green:   "text-emerald-400/60",
    red:     "text-red-400/60",
    amber:   "text-amber-400/60",
  }[color];
  return (
    <ol className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className={`font-mono text-[10px] font-bold ${accent} shrink-0 w-5 leading-none mt-[2px] tabular-nums`}>
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="font-mono text-xs text-foreground/75 leading-relaxed">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function BulletList({ items, color = "default" }: {
  items: string[];
  color?: "default" | "cyan" | "green" | "red" | "amber";
}) {
  if (!items.length) return null;
  const dot = { default: "text-primary/40", cyan: "text-cyan-400", green: "text-emerald-400", red: "text-red-400/80", amber: "text-amber-400" }[color];
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className={`${dot} shrink-0 leading-none mt-[3px] text-[8px]`}>◆</span>
          <span className="font-mono text-xs text-foreground/75 leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Tag({ children, color = "default" }: { children: React.ReactNode; color?: "default" | "cyan" | "green" | "red" | "amber" | "violet" }) {
  const cls = {
    default: "border-white/10 text-muted-foreground/50",
    cyan:    "border-cyan-400/25 text-cyan-400/80",
    green:   "border-emerald-500/25 text-emerald-400/80",
    red:     "border-red-500/25 text-red-400/80",
    amber:   "border-amber-500/25 text-amber-400/80",
    violet:  "border-violet-400/25 text-violet-400/80",
  }[color];
  return (
    <span className={`inline-flex items-center font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 border bg-white/[0.02] ${cls}`}>
      {children}
    </span>
  );
}

function KpiBox({ label, value, accent }: { label: string; value: string; accent?: string }) {
  const t = useUiText();
  const labels: Record<string, [string, string, string]> = {
    "KPI Principal": ["KPI Principal", "Primary KPI", "KPI principal"],
    "Meta de Receita": ["Meta de Receita", "Revenue Target", "Meta de ingresos"],
    "Taxa de Conversão Alvo": ["Taxa de Conversão Alvo", "Target Conversion Rate", "Tasa de conversión objetivo"],
    "Horizonte de Lançamento": ["Horizonte de Lançamento", "Launch Timeline", "Horizonte del lanzamiento"],
  };
  if (!value) return null;
  return (
    <div className="border border-white/8 bg-white/[0.02] p-3">
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/35 mb-1">{labels[label] ? t(...labels[label]) : label}</div>
      <div className={`font-mono text-sm font-bold ${accent ?? "text-foreground/90"}`}>{value}</div>
    </div>
  );
}


function RiskTable({ risks, mitigations }: { risks: string[]; mitigations: string[] }) {
  const max = Math.max(risks.length, mitigations.length);
  if (!max) return null;
  return (
    <div className="divide-y divide-white/5">
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} className="grid grid-cols-2 gap-4 py-2.5 first:pt-0 last:pb-0">
          <div className="flex items-start gap-2">
            <span className="text-red-400/50 text-[8px] shrink-0 leading-none mt-[3px]">◆</span>
            <span className="font-mono text-xs text-foreground/70 leading-relaxed">{risks[i] ?? ""}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-emerald-400/50 text-[8px] shrink-0 leading-none mt-[3px]">◆</span>
            <span className="font-mono text-xs text-foreground/70 leading-relaxed">{mitigations[i] ?? ""}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PhaseTimeline({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="relative pl-8">
      <div className="absolute left-[14px] top-2 bottom-2 w-px bg-gradient-to-b from-primary/30 via-primary/15 to-transparent" />
      {items.map((t, i) => (
        <div key={i} className="relative mb-3 last:mb-0">
          <div className="absolute -left-[22px] top-0.5 w-5 h-5 border border-primary/25 bg-card flex items-center justify-center">
            <span className="font-mono text-[8px] text-primary/50 font-bold">{i + 1}</span>
          </div>
          <span className="font-mono text-xs text-foreground/75 leading-relaxed">{t}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Module wrapper ───────────────────────────────────────────────────────────

interface ModuleProps {
  index: number;
  id: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  status: ModuleStatus;
  accentColor: "cyan" | "green" | "amber" | "red" | "purple";
  children: React.ReactNode;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onFlag: (id: string) => void;
  isEmpty?: boolean;
}

const ACCENT_STYLES = {
  cyan:   { border: "border-l-cyan-400/40",   badge: "border-cyan-400/25 text-cyan-400/80 bg-cyan-400/[0.04]",   icon: "text-cyan-400/70" },
  green:  { border: "border-l-emerald-500/40", badge: "border-emerald-500/25 text-emerald-400/80 bg-emerald-500/[0.04]", icon: "text-emerald-400/70" },
  amber:  { border: "border-l-amber-500/40",  badge: "border-amber-500/25 text-amber-400/80 bg-amber-500/[0.04]",  icon: "text-amber-400/70" },
  red:    { border: "border-l-red-500/40",    badge: "border-red-500/25 text-red-400/80 bg-red-500/[0.04]",       icon: "text-red-400/70" },
  purple: { border: "border-l-violet-400/40", badge: "border-violet-400/25 text-violet-400/80 bg-violet-400/[0.04]", icon: "text-violet-400/70" },
};

function Module({ index, id, icon: Icon, title, subtitle, status, accentColor, children, onApprove, onReject, onFlag, isEmpty }: ModuleProps) {
  const t = useUiText();
  const titles: Record<string, [string, string, string]> = {
    "Diagnóstico Executivo": ["Diagnóstico Executivo", "Executive Diagnosis", "Diagnóstico ejecutivo"],
    "Posicionamento da Oferta": ["Posicionamento da Oferta", "Offer Positioning", "Posicionamiento de la oferta"],
    "Diagnóstico de Mercado": ["Diagnóstico de Mercado", "Market Diagnosis", "Diagnóstico de mercado"],
    "Arquétipo de Audiência": ["Arquétipo de Audiência", "Audience Archetype", "Arquetipo de audiencia"],
    "Arquitetura da Campanha": ["Arquitetura da Campanha", "Campaign Architecture", "Arquitectura de campaña"],
    "Engenharia de Gatilhos": ["Engenharia de Gatilhos", "Trigger Engineering", "Ingeniería de disparadores"],
    "Métricas de Performance": ["Métricas de Performance", "Performance Metrics", "Métricas de rendimiento"],
    "Análise de Riscos": ["Análise de Riscos", "Risk Analysis", "Análisis de riesgos"],
    "Nota do Estrategista": ["Nota do Estrategista", "Strategist's Note", "Nota del estratega"],
  };
  const subtitles: Record<string, [string, string, string]> = {
    "Contexto, oportunidade e viabilidade de lançamento": ["Contexto, oportunidade e viabilidade de lançamento", "Context, opportunity, and launch feasibility", "Contexto, oportunidad y viabilidad del lanzamiento"],
    "Proposta única de valor, mecanismo diferenciador e justificativa de preço": ["Proposta única de valor, mecanismo diferenciador e justificativa de preço", "Unique value proposition, differentiating mechanism, and pricing rationale", "Propuesta de valor única, mecanismo diferenciador y justificación del precio"],
    "Maturidade, cenário competitivo, oportunidades e ameaças": ["Maturidade, cenário competitivo, oportunidades e ameaças", "Maturity, competitive landscape, opportunities, and threats", "Madurez, panorama competitivo, oportunidades y amenazas"],
    "Avatar principal, perfil psicográfico, objeções e gatilhos de compra": ["Avatar principal, perfil psicográfico, objeções e gatilhos de compra", "Primary avatar, psychographic profile, objections, and purchase triggers", "Avatar principal, perfil psicográfico, objeciones y disparadores de compra"],
    "Narrativa central, gancho emocional, mensagens-chave e pilares de conteúdo": ["Narrativa central, gancho emocional, mensagens-chave e pilares de conteúdo", "Core narrative, emotional hook, key messages, and content pillars", "Narrativa central, gancho emocional, mensajes clave y pilares de contenido"],
    "Gatilho dominante, sequência de ativação, ponte de transformação": ["Gatilho dominante, sequência de ativação, ponte de transformação", "Dominant trigger, activation sequence, and transformation bridge", "Disparador dominante, secuencia de activación y puente de transformación"],
    "KPI principal, meta de receita, taxa de conversão e premissas críticas": ["KPI principal, meta de receita, taxa de conversão e premissas críticas", "Primary KPI, revenue target, conversion rate, and critical assumptions", "KPI principal, meta de ingresos, tasa de conversión y supuestos críticos"],
    "Nível de risco, ameaças principais e estratégias de mitigação": ["Nível de risco, ameaças principais e estratégias de mitigação", "Risk level, primary threats, and mitigation strategies", "Nivel de riesgo, principales amenazas y estrategias de mitigación"],
    "Observações finais, recomendações e instruções de execução": ["Observações finais, recomendações e instruções de execução", "Final observations, recommendations, and execution instructions", "Observaciones finales, recomendaciones e instrucciones de ejecución"],
  };
  const [expanded, setExpanded] = useState(false);
  const accent = ACCENT_STYLES[accentColor];

  const borderColor = status === "approved"
    ? "border-l-emerald-500/60"
    : status === "rejected"
    ? "border-l-red-500/60"
    : status === "flagged"
    ? "border-l-amber-500/60"
    : accent.border;

  if (isEmpty) {
    return (
      <div className={`border border-white/7 border-l-2 border-l-white/10 bg-card/10 opacity-60`}>
        <div className="px-4 py-3.5 flex items-center gap-3">
          <div className={`shrink-0 w-7 h-7 border flex items-center justify-center border-white/10 text-muted-foreground/30 bg-white/[0.02]`}>
            <span className="font-mono text-[9px] font-bold">{String(index).padStart(2, "0")}</span>
          </div>
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/25" />
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[11px] font-bold uppercase tracking-widest text-foreground/40">{titles[title] ? t(...titles[title]) : title}</div>
            <div className="font-mono text-[9px] text-muted-foreground/25 mt-0.5 truncate">{subtitles[subtitle] ? t(...subtitles[subtitle]) : subtitle}</div>
          </div>
          <span className="font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 border border-white/10 text-muted-foreground/30 bg-white/[0.02] shrink-0">
            {t("Aguardando", "Waiting", "Pendiente")}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`border border-white/7 border-l-2 ${borderColor} bg-card/20 transition-all duration-200`}>
      <button
        className="w-full text-left px-4 py-3.5 flex items-center gap-3 group"
        onClick={() => setExpanded(v => !v)}
      >
        <div className={`shrink-0 w-7 h-7 border flex items-center justify-center ${accent.badge}`}>
          <span className="font-mono text-[9px] font-bold">{String(index).padStart(2, "0")}</span>
        </div>
        <Icon className={`h-3.5 w-3.5 shrink-0 ${accent.icon}`} />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[11px] font-bold uppercase tracking-widest text-foreground/85 group-hover:text-foreground transition-colors">
            {titles[title] ? t(...titles[title]) : title}
          </div>
          <div className="font-mono text-[9px] text-muted-foreground/40 mt-0.5 truncate">{subtitles[subtitle] ? t(...subtitles[subtitle]) : subtitle}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status === "approved" && (
            <span className="font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 border border-emerald-500/35 text-emerald-400/80 bg-emerald-500/[0.06]">✓ {t("Aprovado", "Approved", "Aprobado")}</span>
          )}
          {status === "rejected" && (
            <span className="font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 border border-red-500/35 text-red-400/80 bg-red-500/[0.06]">✕ {t("Rejeitado", "Rejected", "Rechazado")}</span>
          )}
          {status === "flagged" && (
            <span className="font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 border border-amber-500/35 text-amber-400/80 bg-amber-500/[0.06]">⚠ {t("Sinalizado", "Flagged", "Marcado")}</span>
          )}
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/30 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/5">
          <div
            className="px-5 py-4 space-y-5"
            data-section-id={id}
            data-section-title={title}
          >
            {children}
          </div>
          <div className="px-5 pb-4 flex items-center gap-2">
            <Button size="sm" variant="outline"
              className={`rounded-none font-mono text-[9px] uppercase tracking-widest h-6 px-3 gap-1.5 transition-all ${
                status === "approved" ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/8" : "border-white/8 text-muted-foreground/50 hover:border-emerald-500/35 hover:text-emerald-400"
              }`}
              onClick={() => onApprove(id)}>
              <Check className="h-2.5 w-2.5" />{status === "approved" ? t("Aprovado", "Approved", "Aprobado") : t("Aprovar", "Approve", "Aprobar")}
            </Button>
            <Button size="sm" variant="outline"
              className={`rounded-none font-mono text-[9px] uppercase tracking-widest h-6 px-3 gap-1.5 transition-all ${
                status === "rejected" ? "border-red-500/40 text-red-400 bg-red-500/8" : "border-white/8 text-muted-foreground/50 hover:border-red-500/35 hover:text-red-400"
              }`}
              onClick={() => onReject(id)}>
              <X className="h-2.5 w-2.5" />{status === "rejected" ? t("Rejeitado", "Rejected", "Rechazado") : t("Rejeitar", "Reject", "Rechazar")}
            </Button>
            <Button size="sm" variant="outline"
              className={`rounded-none font-mono text-[9px] uppercase tracking-widest h-6 px-3 gap-1.5 transition-all ${
                status === "flagged" ? "border-amber-500/40 text-amber-400 bg-amber-500/8" : "border-white/8 text-muted-foreground/50 hover:border-amber-500/35 hover:text-amber-400"
              }`}
              onClick={() => onFlag(id)}>
              <AlertTriangle className="h-2.5 w-2.5" />{status === "flagged" ? t("Sinalizado", "Flagged", "Marcado") : t("Sinalizar", "Flag", "Marcar")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Big Domino card (M02) ────────────────────────────────────────────────────

function BigDominoCard({
  value, status, onApprove, onReject, onFlag,
  editing, editValue, onEdit, onSave, onCancelEdit, onChangeEdit,
}: {
  value: string; status: ModuleStatus;
  onApprove: (id: string) => void; onReject: (id: string) => void; onFlag: (id: string) => void;
  editing: boolean; editValue: string;
  onEdit: () => void; onSave: () => void; onCancelEdit: () => void; onChangeEdit: (v: string) => void;
}) {
  const t = useUiText();
  const border = status === "approved" ? "border-emerald-500/50" : status === "rejected" ? "border-red-500/50" : status === "flagged" ? "border-amber-500/50" : "border-primary/25";
  return (
    <div className={`relative border-2 ${border} bg-gradient-to-br from-primary/[0.05] to-transparent transition-all`}
      style={{ boxShadow: "0 0 40px hsl(var(--primary) / 0.06), inset 0 0 40px hsl(var(--primary) / 0.02)" }}
    >
      <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-primary/40 -translate-x-px -translate-y-px" />
      <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-primary/40 translate-x-px -translate-y-px" />
      <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-primary/40 -translate-x-px translate-y-px" />
      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-primary/40 translate-x-px translate-y-px" />

      <div className="px-5 pt-4 pb-2 flex items-center gap-2">
        <Zap className="h-3.5 w-3.5 text-primary/60" />
        <span className="font-mono text-[9px] uppercase tracking-widest text-primary/55 font-bold">{t("02 — Big Domino · A crença central", "02 — Big Domino · The core belief", "02 — Big Domino · La creencia central")}</span>
        <div className="flex-1 h-px bg-primary/10" />
        <span className="font-mono text-[9px] text-muted-foreground/20 tracking-widest">02 / 10</span>
      </div>

      <div className="px-5 pb-2">
        <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/30 mb-3">
          {t("A única crença que, implantada no avatar, colapsa todas as objeções de uma só vez", "The one belief that, once implanted in the avatar, collapses every objection at once", "La única creencia que, una vez implantada en el avatar, elimina todas las objeciones de una vez")}
        </div>
        {editing ? (
          <div className="space-y-2">
            <Textarea value={editValue} onChange={e => onChangeEdit(e.target.value)}
              className="font-mono text-sm bg-transparent border-primary/15 resize-none min-h-[80px]" />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="rounded-none font-mono text-[9px] h-6 px-3 gap-1.5 border-primary/25 text-primary" onClick={onSave}>
                <Save className="h-2.5 w-2.5" />{t("Salvar", "Save", "Guardar")}
              </Button>
              <Button size="sm" variant="ghost" className="rounded-none font-mono text-[9px] h-6 px-3" onClick={onCancelEdit}>{t("Cancelar", "Cancel", "Cancelar")}</Button>
            </div>
          </div>
        ) : (
          <div className="group">
            <blockquote className="border-l-2 border-primary/50 pl-4 py-1">
              <p className="font-mono text-base font-black text-foreground leading-snug tracking-tight">&ldquo;{value}&rdquo;</p>
            </blockquote>
            <Button size="sm" variant="ghost"
              className="mt-2 rounded-none font-mono text-[9px] h-6 px-2 gap-1 text-muted-foreground/30 hover:text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={onEdit}><Pencil className="h-2.5 w-2.5" />{t("Editar", "Edit", "Editar")}</Button>
          </div>
        )}
      </div>

      <div className="px-5 pb-4 flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline"
          className={`rounded-none font-mono text-[9px] uppercase tracking-widest h-6 px-3 gap-1.5 ${status === "approved" ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/8" : "border-white/8 text-muted-foreground/50 hover:border-emerald-500/35 hover:text-emerald-400"}`}
          onClick={() => onApprove("bigDomino")}><Check className="h-2.5 w-2.5" />{status === "approved" ? t("Aprovado", "Approved", "Aprobado") : t("Aprovar", "Approve", "Aprobar")}
        </Button>
        <Button size="sm" variant="outline"
          className={`rounded-none font-mono text-[9px] uppercase tracking-widest h-6 px-3 gap-1.5 ${status === "rejected" ? "border-red-500/40 text-red-400 bg-red-500/8" : "border-white/8 text-muted-foreground/50 hover:border-red-500/35 hover:text-red-400"}`}
          onClick={() => onReject("bigDomino")}><X className="h-2.5 w-2.5" />{status === "rejected" ? t("Rejeitado", "Rejected", "Rechazado") : t("Rejeitar", "Reject", "Rechazar")}
        </Button>
        <Button size="sm" variant="outline"
          className={`rounded-none font-mono text-[9px] uppercase tracking-widest h-6 px-3 gap-1.5 ${status === "flagged" ? "border-amber-500/40 text-amber-400 bg-amber-500/8" : "border-white/8 text-muted-foreground/50 hover:border-amber-500/35 hover:text-amber-400"}`}
          onClick={() => onFlag("bigDomino")}><AlertTriangle className="h-2.5 w-2.5" />{status === "flagged" ? t("Sinalizado", "Flagged", "Marcado") : t("Sinalizar", "Flag", "Marcar")}
        </Button>
        {!editing && (
          <Button size="sm" variant="ghost"
            className="rounded-none font-mono text-[9px] uppercase tracking-widest h-6 px-3 gap-1.5 text-muted-foreground/35 hover:text-foreground/60 ml-auto"
            onClick={onEdit}><Pencil className="h-2.5 w-2.5" />{t("Editar", "Edit", "Editar")}</Button>
        )}
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface StrategyMasterplanProps {
  strategyD: Obj;
  ins: Obj;
  userIdentity?: PdfUserIdentity;
  campaignId?: string;
  campaignTitle?: string;
  track?: string;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StrategyMasterplan({ strategyD, ins, userIdentity, campaignId, campaignTitle, track }: StrategyMasterplanProps) {
  const t = useUiText();
  const hasIns = Object.keys(ins).length > 0;
  const src = hasIns ? ins : strategyD;

  const [statuses, setStatuses] = useState<Record<string, ModuleStatus>>({});
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editValues, setEditValues]       = useState<Record<string, string>>({});
  const [savedEdits, setSavedEdits]       = useState<Record<string, string>>({});
  const [showConsent, setShowConsent]     = useState(false);
  const [downloading, setDownloading]     = useState(false);

  // ── Inline annotation (highlight → Indagar / Sugerir) ──
  const masterplanRef = useRef<HTMLDivElement>(null);
  const { selection, clearSelection, openDialog, dialog, closeDialog } =
    useTextAnnotation(masterplanRef);

  const setStatus = (id: string, next: ModuleStatus) =>
    setStatuses(prev => ({ ...prev, [id]: prev[id] === next ? "pending" : next }));
  const getStatus = (id: string): ModuleStatus => statuses[id] ?? "pending";

  // ── Data extraction ──
  const executiveSummary = savedEdits["executiveSummary"] ?? (str(src["executiveSummary"]) || str(strategyD["executiveSummary"]));
  const bigDomino        = savedEdits["bigDomino"]        ?? (str(src["bigDomino"])        || str(strategyD["bigDomino"]));
  const strategistNotes  = savedEdits["strategistNotes"]  ?? (str(src["strategistNotes"])  || str(strategyD["strategistNotes"]));

  const market       = obj(src["marketDiagnosis"]      ?? strategyD["marketDiagnosis"]);
  const positioning  = obj(src["offerPositioning"]     ?? strategyD["offerPositioning"]);
  const audience     = obj(src["audienceSegmentation"] ?? strategyD["audienceSegmentation"]);
  const architecture = obj(src["campaignArchitecture"] ?? strategyD["campaignArchitecture"]);
  const metrics      = obj(src["successMetrics"]       ?? strategyD["successMetrics"]);
  const risks        = obj(src["risks"]                ?? strategyD["risks"]);
  const triggerMap   = obj(src["triggerMap"]           ?? strategyD["triggerMap"]);

  const revenueTarget   = num(metrics["revenueTarget"]);
  const conversionRate  = num(metrics["conversionRateTarget"]);
  const triggerSequence = arr(triggerMap["triggerStackSequence"]);
  const dominantTrigger = str(triggerMap["dominantTrigger"]);
  const dominantJustif  = str(triggerMap["dominantTriggerJustification"]);
  const socialProof     = str(triggerMap["socialProofBlueprint"]);
  const antiReq         = arr(triggerMap["antiRequisiteAngles"]);
  const transformBridge = str(triggerMap["transformationBridge"]);

  const hasContent = !!(executiveSummary || bigDomino || Object.keys(positioning).length || Object.keys(audience).length);

  const TOTAL_MODULES  = 10;
  const approvedCount  = Object.values(statuses).filter(s => s === "approved").length;
  const rejectedCount  = Object.values(statuses).filter(s => s === "rejected").length;
  const flaggedCount   = Object.values(statuses).filter(s => s === "flagged").length;
  const progress       = Math.round((approvedCount / TOTAL_MODULES) * 100);

  if (!hasContent) {
    return (
      <div className="py-20 text-center">
        <div className="w-10 h-10 border border-white/8 flex items-center justify-center mx-auto mb-4">
          <Brain className="h-5 w-5 text-muted-foreground/20" />
        </div>
        <p className="font-mono text-[10px] text-muted-foreground/25 uppercase tracking-widest">
          {t("O estrategista está finalizando o masterplan…", "The strategist is finishing the master plan…", "El estratega está terminando el plan maestro…")}
        </p>
      </div>
    );
  }

  return (
    <div ref={masterplanRef} className="space-y-2.5">

      {/* ═══ HEADER ══════════════════════════════════════════════════════════ */}
      <div className="border border-white/7 bg-gradient-to-r from-primary/[0.05] to-transparent px-5 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-3.5 w-3.5 text-primary/50" />
              <span className="font-mono text-[9px] uppercase tracking-widest text-primary/50 font-bold">
                 {t("NexOS AI — Proposta Estratégica", "NexOS AI — Strategic Proposal", "NexOS AI — Propuesta estratégica")}
              </span>
            </div>
            <h2 className="font-mono text-sm font-black uppercase tracking-widest text-foreground">
              {t("Masterplan de lançamento", "Launch master plan", "Plan maestro de lanzamiento")}
            </h2>
            <p className="font-mono text-[10px] text-muted-foreground/40 mt-1">
              {t("10 módulos · Elaborado pela equipe NexOS AI · Revise e aprove cada seção", "10 modules · Prepared by the NexOS AI team · Review and approve each section", "10 módulos · Preparado por el equipo de NexOS AI · Revisa y aprueba cada sección")}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="text-right">
              <div className="font-mono text-xl font-black text-foreground leading-none">
                {approvedCount}<span className="text-muted-foreground/25 text-sm font-normal">/{TOTAL_MODULES}</span>
              </div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/35 mt-0.5">{t("aprovados", "approved", "aprobados")}</div>
            </div>
            {userIdentity && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-none font-mono text-[9px] uppercase tracking-widest h-7 px-3 gap-1.5 border-primary/25 text-primary/70 hover:border-primary/50 hover:text-primary transition-all"
                onClick={() => setShowConsent(true)}
              >
                <Download className="h-3 w-3" />{t("Baixar PDF", "Download PDF", "Descargar PDF")}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex justify-between mb-1">
            <span className="font-mono text-[9px] text-muted-foreground/30 uppercase tracking-widest">{t("Progresso de revisão", "Review progress", "Progreso de revisión")}</span>
            <span className="font-mono text-[9px] text-muted-foreground/40">{progress}%</span>
          </div>
          <div className="h-px bg-white/5 w-full">
            <div className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {approvedCount === TOTAL_MODULES ? (
            <Tag color="green"><Check className="h-2.5 w-2.5 mr-1" />{t("Masterplan 100% aprovado", "Master plan 100% approved", "Plan maestro 100% aprobado")}</Tag>
          ) : (
            <>
              <Tag color="default"><Lock className="h-2.5 w-2.5 mr-1" />{TOTAL_MODULES - approvedCount - flaggedCount - rejectedCount} {t("pendentes", "pending", "pendientes")}</Tag>
              {rejectedCount > 0 && <Tag color="red"><X className="h-2.5 w-2.5 mr-1" />{rejectedCount} {rejectedCount > 1 ? t("rejeitados", "rejected", "rechazados") : t("rejeitado", "rejected", "rechazado")}</Tag>}
              {flaggedCount  > 0 && <Tag color="amber"><AlertTriangle className="h-2.5 w-2.5 mr-1" />{flaggedCount} {flaggedCount > 1 ? t("sinalizados", "flagged", "marcados") : t("sinalizado", "flagged", "marcado")}</Tag>}
            </>
          )}
        </div>
      </div>

      {/* ═══ M01 — DIAGNÓSTICO EXECUTIVO ═════════════════════════════════════ */}
      {executiveSummary && (
        <Module index={1} id="executiveSummary" icon={Brain}
          title="Diagnóstico Executivo" subtitle="Contexto, oportunidade e viabilidade de lançamento"
          status={getStatus("executiveSummary")} accentColor="cyan"
          onApprove={id => setStatus(id, "approved")}
          onReject={id => setStatus(id, "rejected")}
          onFlag={id => setStatus(id, "flagged")}
        >
          {editingModule === "executiveSummary" ? (
            <div className="space-y-2">
              <Textarea value={editValues["executiveSummary"] ?? executiveSummary}
                onChange={e => setEditValues(p => ({ ...p, executiveSummary: e.target.value }))}
                className="font-mono text-xs bg-transparent border-white/10 resize-none min-h-[120px]" />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="rounded-none font-mono text-[9px] h-6 px-3 gap-1.5 border-primary/25 text-primary"
                  onClick={() => { setSavedEdits(p => ({ ...p, executiveSummary: editValues["executiveSummary"] ?? executiveSummary })); setEditingModule(null); }}>
                  <Save className="h-2.5 w-2.5" />{t("Salvar", "Save", "Guardar")}
                </Button>
                <Button size="sm" variant="ghost" className="rounded-none font-mono text-[9px] h-6 px-3" onClick={() => setEditingModule(null)}>{t("Cancelar", "Cancel", "Cancelar")}</Button>
              </div>
            </div>
          ) : (
            <div className="group">
              <SectionLabel n="1.1">Análise de Viabilidade e PMF</SectionLabel>
              <p className="font-mono text-xs text-foreground/75 leading-relaxed">{executiveSummary}</p>
              <Button size="sm" variant="ghost"
                className="mt-2 rounded-none font-mono text-[9px] h-6 px-2 gap-1 text-muted-foreground/30 hover:text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => { setEditValues(p => ({ ...p, executiveSummary })); setEditingModule("executiveSummary"); }}>
                <Pencil className="h-2.5 w-2.5" />{t("Editar", "Edit", "Editar")}
              </Button>
            </div>
          )}
        </Module>
      )}

      {/* ═══ M02 — BIG DOMINO ════════════════════════════════════════════════ */}
      {bigDomino && (
        <BigDominoCard
          value={bigDomino} status={getStatus("bigDomino")}
          onApprove={id => setStatus(id, "approved")}
          onReject={id => setStatus(id, "rejected")}
          onFlag={id => setStatus(id, "flagged")}
          editing={editingModule === "bigDomino"}
          editValue={editValues["bigDomino"] ?? bigDomino}
          onEdit={() => { setEditValues(p => ({ ...p, bigDomino })); setEditingModule("bigDomino"); }}
          onSave={() => { setSavedEdits(p => ({ ...p, bigDomino: editValues["bigDomino"] ?? bigDomino })); setEditingModule(null); }}
          onCancelEdit={() => setEditingModule(null)}
          onChangeEdit={v => setEditValues(p => ({ ...p, bigDomino: v }))}
        />
      )}

      {/* ═══ M03 — POSICIONAMENTO DA OFERTA ══════════════════════════════════ */}
      <Module index={3} id="positioning" icon={Target}
        title="Posicionamento da Oferta" subtitle="Proposta única de valor, mecanismo diferenciador e justificativa de preço"
        status={getStatus("positioning")} accentColor="purple"
        onApprove={id => setStatus(id, "approved")}
        onReject={id => setStatus(id, "rejected")}
        onFlag={id => setStatus(id, "flagged")}
        isEmpty={Object.keys(positioning).length === 0}
      >
        {str(positioning["uniqueValueProposition"]) && (
          <div>
              <SectionLabel n="3.1">Proposta Única de Valor</SectionLabel>
            <QuoteBlock color="violet">{str(positioning["uniqueValueProposition"])}</QuoteBlock>
          </div>
        )}
        {str(positioning["primaryDifferentiator"]) && (
          <div>
            <SectionLabel n="3.2">Mecanismo Único</SectionLabel>
            <p className="font-mono text-xs text-foreground/75 leading-relaxed">{str(positioning["primaryDifferentiator"])}</p>
          </div>
        )}
        {(str(positioning["positioning"]) || str(positioning["priceJustification"])) && (
          <div>
            <SectionLabel n="3.3">Contexto e Preço</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {str(positioning["positioning"])       && <Field label="Posicionamento">{str(positioning["positioning"])}</Field>}
              {str(positioning["priceJustification"])&& <Field label="Justificativa de Preço">{str(positioning["priceJustification"])}</Field>}
            </div>
          </div>
        )}
        {arr(positioning["competitiveAdvantages"]).length > 0 && (
          <div>
            <SectionLabel n="3.4">Vantagens Competitivas</SectionLabel>
            <NumberedList items={arr(positioning["competitiveAdvantages"])} color="green" />
          </div>
        )}
      </Module>

      {/* ═══ M04 — DIAGNÓSTICO DE MERCADO ════════════════════════════════════ */}
      <Module index={4} id="market" icon={TrendingUp}
        title="Diagnóstico de Mercado" subtitle="Maturidade, cenário competitivo, oportunidades e ameaças"
        status={getStatus("market")} accentColor="amber"
        onApprove={id => setStatus(id, "approved")}
        onReject={id => setStatus(id, "rejected")}
        onFlag={id => setStatus(id, "flagged")}
        isEmpty={Object.keys(market).length === 0}
      >
        {str(market["marketMaturity"]) && (
          <div className="flex items-center gap-3">
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/35">{t("Maturidade do mercado", "Market maturity", "Madurez del mercado")}</span>
            <Tag color="amber">{str(market["marketMaturity"])}</Tag>
          </div>
        )}
        {str(market["competitiveLandscape"]) && (
          <div>
            <SectionLabel n="4.1">Cenário Competitivo</SectionLabel>
            <p className="font-mono text-xs text-foreground/75 leading-relaxed">{str(market["competitiveLandscape"])}</p>
          </div>
        )}
        {(arr(market["opportunities"]).length > 0 || arr(market["threats"]).length > 0 || arr(market["entryBarriers"]).length > 0) && (
          <div>
            <SectionLabel n="4.2">Oportunidades · Ameaças · Barreiras</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              {arr(market["opportunities"]).length > 0 && (
                <div className="border border-white/8 bg-white/[0.015] p-3">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-cyan-400/60 mb-2">{t("Oportunidades", "Opportunities", "Oportunidades")}</div>
                  <BulletList items={arr(market["opportunities"])} color="cyan" />
                </div>
              )}
              {arr(market["threats"]).length > 0 && (
                <div className="border border-white/8 bg-white/[0.015] p-3">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-red-400/60 mb-2">{t("Ameaças", "Threats", "Amenazas")}</div>
                  <BulletList items={arr(market["threats"])} color="red" />
                </div>
              )}
              {arr(market["entryBarriers"]).length > 0 && (
                <div className="border border-white/8 bg-white/[0.015] p-3">
                  <div className="font-mono text-[9px] uppercase tracking-widest text-amber-400/60 mb-2">{t("Barreiras de entrada", "Barriers to entry", "Barreras de entrada")}</div>
                  <BulletList items={arr(market["entryBarriers"])} color="amber" />
                </div>
              )}
            </div>
          </div>
        )}
      </Module>

      {/* ═══ M05 — ARQUÉTIPO DE AUDIÊNCIA ════════════════════════════════════ */}
      <Module index={5} id="audience" icon={Users}
        title="Arquétipo de Audiência" subtitle="Avatar principal, perfil psicográfico, objeções e gatilhos de compra"
        status={getStatus("audience")} accentColor="cyan"
        onApprove={id => setStatus(id, "approved")}
        onReject={id => setStatus(id, "rejected")}
        onFlag={id => setStatus(id, "flagged")}
        isEmpty={Object.keys(audience).length === 0}
      >
        {str(audience["primaryAvatar"]) && (
          <div>
            <SectionLabel n="5.1">Avatar Principal</SectionLabel>
            <div className="border border-white/8 bg-white/[0.015] p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Star className="h-2.5 w-2.5 text-cyan-400/50" />
                <span className="font-mono text-[9px] uppercase tracking-widest text-cyan-400/50">{t("Perfil central", "Core profile", "Perfil central")}</span>
              </div>
              <p className="font-mono text-xs text-foreground/75 leading-relaxed">{str(audience["primaryAvatar"])}</p>
            </div>
          </div>
        )}
        {str(audience["psychographicProfile"]) && (
          <div>
            <SectionLabel n="5.2">Perfil Psicográfico</SectionLabel>
            <p className="font-mono text-xs text-foreground/75 leading-relaxed">{str(audience["psychographicProfile"])}</p>
          </div>
        )}
        {str(audience["sophisticationStrategy"]) && (
          <div>
            <SectionLabel n="5.3">Estratégia de Sofisticação</SectionLabel>
            <p className="font-mono text-xs text-foreground/75 leading-relaxed">{str(audience["sophisticationStrategy"])}</p>
          </div>
        )}
        {(arr(audience["buyingTriggers"]).length > 0 || arr(audience["objections"]).length > 0) && (
          <div>
            <SectionLabel n="5.4">Gatilhos e Objeções</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {arr(audience["buyingTriggers"]).length > 0 && (
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-amber-400/50">{t("Gatilhos de compra", "Purchase triggers", "Disparadores de compra")}</div>
                  <NumberedList items={arr(audience["buyingTriggers"])} color="amber" />
                </div>
              )}
              {arr(audience["objections"]).length > 0 && (
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-red-400/50">{t("Objeções reais", "Real objections", "Objeciones reales")}</div>
                  <NumberedList items={arr(audience["objections"])} color="red" />
                </div>
              )}
            </div>
          </div>
        )}
        {arr(audience["secondaryAvatars"]).length > 0 && (
          <div>
            <SectionLabel n="5.5">Avatares Secundários</SectionLabel>
            <BulletList items={arr(audience["secondaryAvatars"])} />
          </div>
        )}
      </Module>

      {/* ═══ M06 — ARQUITETURA DA CAMPANHA ═══════════════════════════════════ */}
      <Module index={6} id="architecture" icon={Lightbulb}
        title="Arquitetura da Campanha" subtitle="Narrativa central, gancho emocional, mensagens-chave e pilares de conteúdo"
        status={getStatus("architecture")} accentColor="purple"
        onApprove={id => setStatus(id, "approved")}
        onReject={id => setStatus(id, "rejected")}
        onFlag={id => setStatus(id, "flagged")}
        isEmpty={Object.keys(architecture).length === 0}
      >
        {str(architecture["coreNarrative"]) && (
          <div>
            <SectionLabel n="6.1">Narrativa Central</SectionLabel>
            <QuoteBlock color="violet">{str(architecture["coreNarrative"])}</QuoteBlock>
          </div>
        )}
        {str(architecture["emotionalHook"]) && (
          <div>
            <SectionLabel n="6.2">Gancho Emocional</SectionLabel>
            <p className="font-mono text-xs text-foreground/75 leading-relaxed">{str(architecture["emotionalHook"])}</p>
          </div>
        )}
        {arr(architecture["keyMessages"]).length > 0 && (
          <div>
            <SectionLabel n="6.3">Mensagens-Chave</SectionLabel>
            <NumberedList items={arr(architecture["keyMessages"])} color="green" />
          </div>
        )}
        {arr(architecture["contentPillars"]).length > 0 && (
          <div>
            <SectionLabel n="6.4">Pilares de Conteúdo</SectionLabel>
            <BulletList items={arr(architecture["contentPillars"])} />
          </div>
        )}
        {str(architecture["platformDistributionStrategy"]) && (
          <div>
            <SectionLabel n="6.5">Distribuição por Plataforma</SectionLabel>
            <p className="font-mono text-xs text-foreground/75 leading-relaxed">{str(architecture["platformDistributionStrategy"])}</p>
          </div>
        )}
        {str(architecture["callToActionStrategy"]) && (
          <div>
            <SectionLabel n="6.6">Estratégia de CTA</SectionLabel>
            <p className="font-mono text-xs text-foreground/75 leading-relaxed">{str(architecture["callToActionStrategy"])}</p>
          </div>
        )}
      </Module>

      {/* ═══ M07 — ENGENHARIA DE GATILHOS ════════════════════════════════════ */}
      <Module index={7} id="triggers" icon={Flame}
        title="Engenharia de Gatilhos" subtitle="Gatilho dominante, sequência de ativação, ponte de transformação"
        status={getStatus("triggers")} accentColor="red"
        onApprove={id => setStatus(id, "approved")}
        onReject={id => setStatus(id, "rejected")}
        onFlag={id => setStatus(id, "flagged")}
        isEmpty={!dominantTrigger && triggerSequence.length === 0 && !transformBridge}
      >
        {dominantTrigger && (
          <div>
            <SectionLabel n="7.1">Gatilho Dominante</SectionLabel>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <Tag color="red">{dominantTrigger}</Tag>
            </div>
            {dominantJustif && <p className="font-mono text-xs text-foreground/65 leading-relaxed mt-2">{dominantJustif}</p>}
          </div>
        )}
        {triggerSequence.length > 0 && (
          <div>
            <SectionLabel n="7.2">Sequência de Ativação Dia a Dia</SectionLabel>
            <PhaseTimeline items={triggerSequence} />
          </div>
        )}
        {transformBridge && (
          <div>
            <SectionLabel n="7.3">Ponte de Transformação</SectionLabel>
            <p className="font-mono text-xs text-foreground/75 leading-relaxed">{transformBridge}</p>
          </div>
        )}
        {antiReq.length > 0 && (
          <div>
            <SectionLabel n="7.4">Ângulos Anti-Requisito</SectionLabel>
            <NumberedList items={antiReq} color="amber" />
          </div>
        )}
        {socialProof && (
          <div>
            <SectionLabel n="7.5">Blueprint de Prova Social</SectionLabel>
            <p className="font-mono text-xs text-foreground/75 leading-relaxed">{socialProof}</p>
          </div>
        )}
      </Module>

      {/* ═══ M08 — MÉTRICAS DE PERFORMANCE ══════════════════════════════════ */}
      <Module index={8} id="metrics" icon={BarChart3}
        title="Métricas de Performance" subtitle="KPI principal, meta de receita, taxa de conversão e premissas críticas"
        status={getStatus("metrics")} accentColor="green"
        onApprove={id => setStatus(id, "approved")}
        onReject={id => setStatus(id, "rejected")}
        onFlag={id => setStatus(id, "flagged")}
        isEmpty={Object.keys(metrics).length === 0}
      >
        <div>
          <SectionLabel n="8.1">Unit Economics</SectionLabel>
          <div className="grid grid-cols-2 gap-1.5">
            <KpiBox label="KPI Principal" value={str(metrics["primaryKPI"])} />
            <KpiBox label="Meta de Receita" value={revenueTarget ? `R$ ${revenueTarget.toLocaleString("pt-BR")}` : ""} accent="text-emerald-400 font-bold" />
            <KpiBox label="Taxa de Conversão Alvo" value={conversionRate ? `${(conversionRate * 100).toFixed(1)}%` : ""} />
            <KpiBox label="Horizonte de Lançamento" value={str(metrics["launchWindow"])} />
          </div>
        </div>
        {arr(metrics["criticalAssumptions"]).length > 0 && (
          <div>
            <SectionLabel n="8.2">Premissas Críticas</SectionLabel>
            <NumberedList items={arr(metrics["criticalAssumptions"])} color="amber" />
          </div>
        )}
      </Module>

      {/* ═══ M09 — ANÁLISE DE RISCOS ══════════════════════════════════════════ */}
      <Module index={9} id="risks" icon={ShieldAlert}
        title="Análise de Riscos" subtitle="Nível de risco, ameaças principais e estratégias de mitigação"
        status={getStatus("risks")} accentColor="red"
        onApprove={id => setStatus(id, "approved")}
        onReject={id => setStatus(id, "rejected")}
        onFlag={id => setStatus(id, "flagged")}
        isEmpty={Object.keys(risks).length === 0}
      >
        {str(risks["level"]) && (
          <div className="flex items-center gap-3">
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/35">{t("Nível geral", "Overall level", "Nivel general")}</span>
            {(() => {
              const level = str(risks["level"]);
              return level === "low"  ? <Tag color="green">{t("Risco baixo", "Low risk", "Riesgo bajo")}</Tag>  :
                     level === "high" ? <Tag color="red">{t("Risco alto", "High risk", "Riesgo alto")}</Tag>    :
                                        <Tag color="amber">{t("Risco médio", "Medium risk", "Riesgo medio")}</Tag>;
            })()}
          </div>
        )}
        {(arr(risks["mainRisks"]).length > 0 || arr(risks["mitigations"]).length > 0) && (
          <div>
            <div className="grid grid-cols-2 gap-1 mb-2">
              <div className="font-mono text-[9px] uppercase tracking-widest text-red-400/50">{t("Riscos", "Risks", "Riesgos")}</div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-emerald-400/50">{t("Mitigações", "Mitigations", "Mitigaciones")}</div>
            </div>
            <RiskTable risks={arr(risks["mainRisks"])} mitigations={arr(risks["mitigations"])} />
          </div>
        )}
      </Module>

      {/* ═══ M10 — NOTA DO ESTRATEGISTA ══════════════════════════════════════ */}
      {strategistNotes && (
        <Module index={10} id="strategistNotes" icon={MessageSquare}
          title="Nota do Estrategista" subtitle="Observações finais, recomendações e instruções de execução"
          status={getStatus("strategistNotes")} accentColor="amber"
          onApprove={id => setStatus(id, "approved")}
          onReject={id => setStatus(id, "rejected")}
          onFlag={id => setStatus(id, "flagged")}
        >
          {editingModule === "strategistNotes" ? (
            <div className="space-y-2">
              <Textarea value={editValues["strategistNotes"] ?? strategistNotes}
                onChange={e => setEditValues(p => ({ ...p, strategistNotes: e.target.value }))}
                className="font-mono text-xs bg-transparent border-white/10 resize-none min-h-[100px]" />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="rounded-none font-mono text-[9px] h-6 px-3 gap-1.5 border-primary/25 text-primary"
                  onClick={() => { setSavedEdits(p => ({ ...p, strategistNotes: editValues["strategistNotes"] ?? strategistNotes })); setEditingModule(null); }}>
                  <Save className="h-2.5 w-2.5" />{t("Salvar", "Save", "Guardar")}
                </Button>
                <Button size="sm" variant="ghost" className="rounded-none font-mono text-[9px] h-6 px-3" onClick={() => setEditingModule(null)}>{t("Cancelar", "Cancel", "Cancelar")}</Button>
              </div>
            </div>
          ) : (
            <div className="group">
              <SectionLabel n="10.1">Diretrizes de Execução</SectionLabel>
              <p className="font-mono text-xs text-foreground/70 leading-relaxed">{strategistNotes}</p>
              <Button size="sm" variant="ghost"
                className="mt-2 rounded-none font-mono text-[9px] h-6 px-2 gap-1 text-muted-foreground/30 hover:text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => { setEditValues(p => ({ ...p, strategistNotes })); setEditingModule("strategistNotes"); }}>
                <Pencil className="h-2.5 w-2.5" />{t("Editar", "Edit", "Editar")}
              </Button>
            </div>
          )}
        </Module>
      )}

      {/* ═══ FOOTER ══════════════════════════════════════════════════════════ */}
      {(approvedCount > 0 || rejectedCount > 0) && (
        <div className={`border px-4 py-3 transition-all ${
          approvedCount === TOTAL_MODULES ? "border-emerald-500/25 bg-emerald-500/[0.03]" :
          rejectedCount > 0 ? "border-red-500/12 bg-white/[0.005]" : "border-white/7 bg-white/[0.01]"
        }`}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              {approvedCount === TOTAL_MODULES ? (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 5px #34d399" }} />
                  <span className="font-mono text-[10px] font-bold text-emerald-400/90 uppercase tracking-widest">
                    {t("Masterplan aprovado", "Master plan approved", "Plan maestro aprobado")} — {approvedCount}/{TOTAL_MODULES}
                  </span>
                </>
              ) : (
                <>
                  <Crosshair className="h-3 w-3 text-muted-foreground/30" />
                  <span className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
                    {approvedCount}/{TOTAL_MODULES} {t("aprovados", "approved", "aprobados")}
                    {rejectedCount > 0 ? ` · ${rejectedCount} ${rejectedCount > 1 ? t("rejeitados", "rejected", "rechazados") : t("rejeitado", "rejected", "rechazado")}` : ""}
                    {flaggedCount  > 0 ? ` · ${flaggedCount} ${flaggedCount > 1 ? t("sinalizados", "flagged", "marcados") : t("sinalizado", "flagged", "marcado")}` : ""}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              {[...Array(TOTAL_MODULES)].map((_, i) => {
                const ids = ["executiveSummary","bigDomino","positioning","market","audience","architecture","triggers","metrics","risks","strategistNotes"];
                const s = getStatus(ids[i]);
                return (
                  <div key={i} className={`w-5 h-0.5 transition-all ${
                    s === "approved" ? "bg-emerald-500" : s === "rejected" ? "bg-red-500" : s === "flagged" ? "bg-amber-500" : "bg-white/10"
                  }`} />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ CONSENT + DOWNLOAD MODAL ════════════════════════════════════════ */}
      {userIdentity && (
        <Dialog open={showConsent} onOpenChange={setShowConsent}>
          <DialogContent className="rounded-none border-primary/25 bg-background max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="h-4 w-4 text-primary/70" />
                <DialogTitle className="font-mono text-sm uppercase tracking-widest font-black text-foreground">
                  {t("Aviso de identificação digital", "Digital identification notice", "Aviso de identificación digital")}
                </DialogTitle>
              </div>
              <DialogDescription asChild>
                <div className="space-y-4 pt-1">
                  <p className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed">
                    {t("Ao baixar este masterplan, seu documento será gerado com", "When you download this master plan, your document will include a", "Al descargar este plan maestro, tu documento incluirá una")} <strong className="text-foreground/80">{t("marca d'água digital", "digital watermark", "marca de agua digital")}</strong> {t("contendo seus dados de identificação em todas as páginas:", "containing your identification details on every page:", "con tus datos de identificación en todas las páginas:")}
                  </p>

                  <div className="border border-primary/20 bg-primary/[0.04] p-3 space-y-1.5">
                    <div className="flex gap-2">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-primary/50 w-20 shrink-0">{t("Nome", "Name", "Nombre")}</span>
                      <span className="font-mono text-[11px] text-foreground/80">{userIdentity.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-primary/50 w-20 shrink-0">{t("E-mail", "Email", "Correo electrónico")}</span>
                      <span className="font-mono text-[11px] text-foreground/80">{userIdentity.email}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-primary/50 w-20 shrink-0">{t("ID da conta", "Account ID", "ID de cuenta")}</span>
                      <span className="font-mono text-[11px] text-foreground/80 truncate">{userIdentity.userId}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-primary/50 w-20 shrink-0">{t("Workspace", "Workspace", "Espacio de trabajo")}</span>
                      <span className="font-mono text-[11px] text-foreground/80">{userIdentity.workspaceName}</span>
                    </div>
                  </div>

                  <p className="font-mono text-[10px] text-muted-foreground/50 leading-relaxed">
                    {t("Este documento é de uso exclusivo e intransferível. Qualquer compartilhamento não autorizado é rastreável por uma impressão digital única gerada neste download. Ao clicar em", "This document is for your exclusive use and may not be transferred. Unauthorized sharing can be traced using the unique fingerprint generated for this download. By clicking", "Este documento es para uso exclusivo e intransferible. Cualquier divulgación no autorizada puede rastrearse mediante la huella digital única generada en esta descarga. Al hacer clic en")} <strong className="text-foreground/70">{t("Confirmar e baixar", "Confirm and download", "Confirmar y descargar")}</strong>, {t("você declara ciência e aceita os Termos de Uso do NexOS AI.", "you acknowledge and accept the NexOS AI Terms of Use.", "declaras que estás al tanto y aceptas los Términos de uso de NexOS AI.")}
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>

            <div className="flex gap-2 mt-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 rounded-none font-mono text-[9px] uppercase tracking-widest h-8 border border-white/10"
                onClick={() => setShowConsent(false)}
              >
                {t("Cancelar", "Cancel", "Cancelar")}
              </Button>
              <Button
                size="sm"
                disabled={downloading}
                className="flex-1 rounded-none font-mono text-[9px] uppercase tracking-widest h-8 gap-1.5 bg-primary hover:bg-primary/90"
                onClick={async () => {
                  setDownloading(true);
                  try {
                    const { fingerprint } = generateMasterplanPDF(
                      {
                        campaignId: campaignId ?? "unknown",
                  campaignTitle: campaignTitle ?? str(strategyD["productName"] as unknown) ?? t("Masterplan Estratégico", "Strategic master plan", "Plan maestro estratégico"),
                        track,
                        executiveSummary,
                        bigDomino,
                        positioning,
                        market,
                        audience,
                        architecture,
                        metrics,
                        risks,
                        triggerMap,
                        strategistNotes,
                      },
                      userIdentity
                    );
                    // Register fingerprint in backend for forensic lookup
                    void customFetch("/api/fingerprints", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        fingerprint,
                        campaignId: campaignId ?? "unknown",
                        campaignTitle: campaignTitle ?? "",
                        track: track ?? "",
                        userName: userIdentity.name,
                        userEmail: userIdentity.email,
                        workspaceName: userIdentity.workspaceName,
                      }),
                    }).catch(() => { /* non-blocking */ });
                  } finally {
                    setDownloading(false);
                    setShowConsent(false);
                  }
                }}
              >
                {downloading
                  ? <span className="animate-pulse">{t("Gerando PDF…", "Generating PDF…", "Generando PDF…")}</span>
                  : <><Download className="h-3 w-3" />{t("Confirmar e baixar", "Confirm and download", "Confirmar y descargar")}</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ═══ INLINE ANNOTATION ───────────────────────────────────────────────
           Floating toolbar appears when the user selects text inside a section.
           Portal-rendered so it is never clipped by overflow containers.        */}
      {selection && (
        <AnnotationToolbar
          selection={selection}
          onAction={openDialog}
          onDismiss={clearSelection}
        />
      )}
      {dialog && campaignId && (
        <AnnotationDialog
          state={dialog}
          campaignId={campaignId}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}
