import { useState } from "react";
import {
  Target, Users, Zap, BarChart3, Brain, ShieldAlert,
  TrendingUp, MessageSquare, Lightbulb, Flame, Star,
  ChevronDown, Check, AlertTriangle, Pencil, X, Save,
  Award, Crosshair, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

// ─── Types & utils ───────────────────────────────────────────────────────────

export type StrategyObj = Record<string, unknown>;
type Obj = Record<string, unknown>;
type ModuleStatus = "pending" | "approved" | "flagged";

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

// ─── Sub-components ──────────────────────────────────────────────────────────

function Pill({ children, color = "default" }: {
  children: React.ReactNode;
  color?: "cyan" | "green" | "red" | "amber" | "default";
}) {
  const colors = {
    cyan:    "border-cyan-400/30 bg-cyan-400/8 text-cyan-400",
    green:   "border-emerald-500/30 bg-emerald-500/8 text-emerald-400",
    red:     "border-red-500/30 bg-red-500/8 text-red-400",
    amber:   "border-amber-500/30 bg-amber-500/8 text-amber-400",
    default: "border-white/10 bg-white/5 text-foreground/60",
  };
  return (
    <span className={`inline-flex items-center font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border ${colors[color]}`}>
      {children}
    </span>
  );
}

function DataRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">{label}</span>
      <span className={`font-mono text-xs leading-relaxed ${accent ?? "text-foreground/80"}`}>{value}</span>
    </div>
  );
}

function BulletItems({ label, items, color = "default" }: {
  label: string; items: string[];
  color?: "cyan" | "green" | "red" | "amber" | "default";
}) {
  if (!items.length) return null;
  const dotColors = { cyan: "text-cyan-400", green: "text-emerald-400", red: "text-red-400", amber: "text-amber-400", default: "text-primary/50" };
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-2">{label}</div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={`${dotColors[color]} shrink-0 leading-none mt-[3px] text-[10px]`}>▸</span>
            <span className="font-mono text-xs text-foreground/75 leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SequenceTimeline({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-3">Sequência Dia a Dia</div>
      <div className="relative pl-6">
        <div className="absolute left-2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/30 via-primary/20 to-transparent" />
        {items.map((t, i) => (
          <div key={i} className="relative mb-3 last:mb-0">
            <div className="absolute -left-[18px] top-1 w-3 h-3 rounded-full border border-primary/40 bg-card flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-primary/60" />
            </div>
            <div className="flex items-start gap-2">
              <span className="font-mono text-[10px] text-primary/50 shrink-0 w-6">D{i + 1}</span>
              <span className="font-mono text-xs text-foreground/75 leading-relaxed">{t}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiGrid({ items }: { items: { label: string; value: string; accent?: string }[] }) {
  const filtered = items.filter(x => x.value);
  if (!filtered.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {filtered.map((item, i) => (
        <div key={i} className="border border-white/8 bg-white/[0.02] p-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1">{item.label}</div>
          <div className={`font-mono text-sm font-bold ${item.accent ?? "text-foreground/90"}`}>{item.value}</div>
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
  onFlag: (id: string) => void;
  isEmpty?: boolean;
}

const ACCENT_STYLES = {
  cyan:   { border: "border-l-cyan-400/50",   badge: "border-cyan-400/30 text-cyan-400 bg-cyan-400/5",   icon: "text-cyan-400",   glow: "0 0 12px hsl(180 100% 60% / 0.1)" },
  green:  { border: "border-l-emerald-500/50", badge: "border-emerald-500/30 text-emerald-400 bg-emerald-500/5", icon: "text-emerald-400", glow: "0 0 12px hsl(150 80% 50% / 0.08)" },
  amber:  { border: "border-l-amber-500/50",  badge: "border-amber-500/30 text-amber-400 bg-amber-500/5",  icon: "text-amber-400",  glow: "0 0 12px hsl(40 100% 55% / 0.08)" },
  red:    { border: "border-l-red-500/50",    badge: "border-red-500/30 text-red-400 bg-red-500/5",       icon: "text-red-400",    glow: "0 0 12px hsl(0 80% 50% / 0.08)" },
  purple: { border: "border-l-violet-400/50", badge: "border-violet-400/30 text-violet-400 bg-violet-400/5", icon: "text-violet-400", glow: "0 0 12px hsl(270 80% 60% / 0.08)" },
};

function Module({ index, id, icon: Icon, title, subtitle, status, accentColor, children, onApprove, onFlag, isEmpty }: ModuleProps) {
  const [expanded, setExpanded] = useState(false);
  const accent = ACCENT_STYLES[accentColor];

  const statusBadge = {
    pending:  { label: "Aguardando revisão", cls: "border-white/15 text-muted-foreground/50 bg-transparent" },
    approved: { label: "✓ Aprovado",         cls: "border-emerald-500/40 text-emerald-400 bg-emerald-500/8" },
    flagged:  { label: "⚠ Sinalizado",       cls: "border-amber-500/40 text-amber-400 bg-amber-500/8" },
  }[status];

  const borderColor = status === "approved"
    ? "border-l-emerald-500/70"
    : status === "flagged"
    ? "border-l-amber-500/70"
    : accent.border;

  if (isEmpty) return null;

  return (
    <div
      className={`border border-white/8 border-l-2 ${borderColor} bg-card/30 transition-all duration-200`}
      style={expanded ? { boxShadow: accent.glow } : undefined}
    >
      {/* ── Module header ── */}
      <button
        className="w-full text-left p-4 flex items-center gap-3 group"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Number badge */}
        <div className={`shrink-0 w-7 h-7 border flex items-center justify-center ${accent.badge}`}>
          <span className="font-mono text-[10px] font-bold leading-none">
            {String(index).padStart(2, "0")}
          </span>
        </div>

        {/* Icon */}
        <Icon className={`h-4 w-4 shrink-0 ${accent.icon}`} />

        {/* Title block */}
        <div className="flex-1 min-w-0">
          <div className="font-mono text-xs font-bold uppercase tracking-widest text-foreground group-hover:text-white transition-colors">
            {title}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground/50 mt-0.5 truncate">
            {subtitle}
          </div>
        </div>

        {/* Status + chevron */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`hidden sm:inline-flex font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 border ${statusBadge.cls}`}>
            {statusBadge.label}
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground/40 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* ── Module body ── */}
      {expanded && (
        <div className="border-t border-white/5">
          <div className="p-4 space-y-4">
            {children}
          </div>

          {/* Action bar */}
          <div className="px-4 pb-4 flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className={`rounded-none font-mono text-[10px] uppercase tracking-widest h-7 px-3 gap-1.5 transition-all ${
                status === "approved"
                  ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10"
                  : "border-white/10 text-muted-foreground hover:border-emerald-500/40 hover:text-emerald-400"
              }`}
              onClick={() => onApprove(id)}
            >
              <Check className="h-3 w-3" />
              {status === "approved" ? "Aprovado" : "Aprovar módulo"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={`rounded-none font-mono text-[10px] uppercase tracking-widest h-7 px-3 gap-1.5 transition-all ${
                status === "flagged"
                  ? "border-amber-500/50 text-amber-400 bg-amber-500/10"
                  : "border-white/10 text-muted-foreground hover:border-amber-500/40 hover:text-amber-400"
              }`}
              onClick={() => onFlag(id)}
            >
              <AlertTriangle className="h-3 w-3" />
              {status === "flagged" ? "Sinalizado" : "Sinalizar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Big Domino special card ─────────────────────────────────────────────────

function BigDominoCard({
  value,
  status,
  onApprove,
  onFlag,
  editing,
  editValue,
  onEdit,
  onSave,
  onCancelEdit,
  onChangeEdit,
}: {
  value: string;
  status: ModuleStatus;
  onApprove: (id: string) => void;
  onFlag: (id: string) => void;
  editing: boolean;
  editValue: string;
  onEdit: () => void;
  onSave: () => void;
  onCancelEdit: () => void;
  onChangeEdit: (v: string) => void;
}) {
  const borderClass = status === "approved"
    ? "border-emerald-500/50"
    : status === "flagged"
    ? "border-amber-500/50"
    : "border-primary/30";

  return (
    <div className={`relative border-2 ${borderClass} bg-gradient-to-br from-primary/[0.06] to-transparent p-5 transition-all`}
      style={{ boxShadow: "0 0 40px hsl(var(--primary) / 0.08), inset 0 0 40px hsl(var(--primary) / 0.03)" }}
    >
      {/* Corner marks */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-primary/50 -translate-x-px -translate-y-px" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-primary/50 translate-x-px -translate-y-px" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-primary/50 -translate-x-px translate-y-px" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-primary/50 translate-x-px translate-y-px" />

      <div className="flex items-center gap-2 mb-4">
        <Zap className="h-4 w-4 text-primary" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-primary/70 font-bold">
          Big Domino — A Crença Central
        </span>
        <div className="ml-auto">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/30 border border-white/8 px-2 py-0.5">
            02 / 10
          </span>
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={editValue}
            onChange={e => onChangeEdit(e.target.value)}
            className="font-mono text-sm bg-transparent border-primary/20 resize-none min-h-[80px]"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="rounded-none font-mono text-[10px] h-7 px-3 gap-1.5 border-primary/30 text-primary" onClick={onSave}>
              <Save className="h-3 w-3" /> Salvar
            </Button>
            <Button size="sm" variant="ghost" className="rounded-none font-mono text-[10px] h-7 px-3" onClick={onCancelEdit}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="font-mono text-base sm:text-lg font-black text-foreground leading-snug tracking-tight italic mb-2">
            "{value}"
          </p>
          <p className="font-mono text-[10px] text-muted-foreground/40 leading-relaxed mb-4">
            Implantando esta crença, todas as objeções colapsam automaticamente — sem precisar refutar uma por uma.
          </p>
        </>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline"
          className={`rounded-none font-mono text-[10px] uppercase tracking-widest h-7 px-3 gap-1.5 ${
            status === "approved" ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10" : "border-white/10 text-muted-foreground hover:border-emerald-500/40 hover:text-emerald-400"
          }`}
          onClick={() => onApprove("bigDomino")}>
          <Check className="h-3 w-3" />{status === "approved" ? "Aprovado" : "Aprovar"}
        </Button>
        <Button size="sm" variant="outline"
          className={`rounded-none font-mono text-[10px] uppercase tracking-widest h-7 px-3 gap-1.5 ${
            status === "flagged" ? "border-amber-500/50 text-amber-400 bg-amber-500/10" : "border-white/10 text-muted-foreground hover:border-amber-500/40 hover:text-amber-400"
          }`}
          onClick={() => onFlag("bigDomino")}>
          <AlertTriangle className="h-3 w-3" />{status === "flagged" ? "Sinalizado" : "Sinalizar"}
        </Button>
        {!editing && (
          <Button size="sm" variant="ghost"
            className="rounded-none font-mono text-[10px] uppercase tracking-widest h-7 px-3 gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={onEdit}>
            <Pencil className="h-3 w-3" />Editar
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface StrategyMasterplanProps {
  strategyD: Obj;
  ins: Obj;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StrategyMasterplan({ strategyD, ins }: StrategyMasterplanProps) {
  const hasIns = Object.keys(ins).length > 0;
  const src = hasIns ? ins : strategyD;

  const [statuses, setStatuses] = useState<Record<string, ModuleStatus>>({});
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savedEdits, setSavedEdits] = useState<Record<string, string>>({});

  const setStatus = (id: string, next: ModuleStatus) =>
    setStatuses(prev => ({ ...prev, [id]: prev[id] === next ? "pending" : next }));

  const getStatus = (id: string): ModuleStatus => statuses[id] ?? "pending";

  // ── Data extraction ──
  const executiveSummary = savedEdits["executiveSummary"] ?? (str(src["executiveSummary"]) || str(strategyD["executiveSummary"]));
  const bigDomino        = savedEdits["bigDomino"] ?? (str(src["bigDomino"]) || str(strategyD["bigDomino"]));
  const strategistNotes  = savedEdits["strategistNotes"] ?? (str(src["strategistNotes"]) || str(strategyD["strategistNotes"]));

  const market       = obj(src["marketDiagnosis"] ?? strategyD["marketDiagnosis"]);
  const positioning  = obj(src["offerPositioning"] ?? strategyD["offerPositioning"]);
  const audience     = obj(src["audienceSegmentation"] ?? strategyD["audienceSegmentation"]);
  const architecture = obj(src["campaignArchitecture"] ?? strategyD["campaignArchitecture"]);
  const metrics      = obj(src["successMetrics"] ?? strategyD["successMetrics"]);
  const risks        = obj(src["risks"] ?? strategyD["risks"]);
  const triggerMap   = obj(src["triggerMap"] ?? strategyD["triggerMap"]);

  const revenueTarget    = num(metrics["revenueTarget"]);
  const conversionRate   = num(metrics["conversionRateTarget"]);
  const triggerSequence  = arr(triggerMap["triggerStackSequence"]);
  const dominantTrigger  = str(triggerMap["dominantTrigger"]);
  const dominantJustif   = str(triggerMap["dominantTriggerJustification"]);
  const socialProof      = str(triggerMap["socialProofBlueprint"]);
  const antiReq          = arr(triggerMap["antiRequisiteAngles"]);
  const transformBridge  = str(triggerMap["transformationBridge"]);

  const hasContent = !!(executiveSummary || bigDomino || Object.keys(positioning).length || Object.keys(audience).length);

  // ── Progress calculation ──
  const TOTAL_MODULES = 10;
  const approvedCount = Object.values(statuses).filter(s => s === "approved").length;
  const flaggedCount  = Object.values(statuses).filter(s => s === "flagged").length;
  const progress = Math.round((approvedCount / TOTAL_MODULES) * 100);

  if (!hasContent) {
    return (
      <div className="py-20 text-center">
        <div className="w-12 h-12 border border-white/10 flex items-center justify-center mx-auto mb-4">
          <Brain className="h-6 w-6 text-muted-foreground/20" />
        </div>
        <p className="font-mono text-xs text-muted-foreground/30 uppercase tracking-widest">
          O Estrategista está finalizando o masterplan…
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">

      {/* ═══════════════════════════════════════════════════════════════════
          HEADER — Proposta Estratégica
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="border border-white/8 bg-gradient-to-r from-primary/[0.06] to-transparent p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-4 w-4 text-primary/70" />
              <span className="font-mono text-[9px] uppercase tracking-widest text-primary/60 font-bold">
                NexOS AI — Proposta Estratégica
              </span>
            </div>
            <h2 className="font-mono text-base font-black uppercase tracking-widest text-foreground">
              Masterplan de Lançamento
            </h2>
            <p className="font-mono text-[11px] text-muted-foreground/50 mt-1">
              10 módulos estratégicos · Elaborado pelo Time NexOS AI · Revise, edite e aprove cada seção
            </p>
          </div>

          {/* Progress block */}
          <div className="text-right shrink-0">
            <div className="font-mono text-2xl font-black text-foreground leading-none">{approvedCount}<span className="text-muted-foreground/30 text-base font-normal">/{TOTAL_MODULES}</span></div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mt-0.5">Módulos aprovados</div>
            {flaggedCount > 0 && (
              <div className="font-mono text-[9px] text-amber-400/70 mt-0.5">{flaggedCount} sinalizado{flaggedCount > 1 ? "s" : ""}</div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between mb-1.5">
            <span className="font-mono text-[9px] text-muted-foreground/40 uppercase tracking-widest">Progresso de revisão</span>
            <span className="font-mono text-[9px] text-muted-foreground/50">{progress}%</span>
          </div>
          <div className="h-1 bg-white/5 w-full">
            <div
              className="h-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Status chips */}
        <div className="flex flex-wrap gap-2 mt-3">
          {approvedCount === TOTAL_MODULES ? (
            <Pill color="green"><Check className="h-2.5 w-2.5 mr-1" />Masterplan 100% aprovado</Pill>
          ) : (
            <>
              <Pill color="default"><Lock className="h-2.5 w-2.5 mr-1" />{TOTAL_MODULES - approvedCount - flaggedCount} módulos pendentes</Pill>
              {flaggedCount > 0 && <Pill color="amber"><AlertTriangle className="h-2.5 w-2.5 mr-1" />{flaggedCount} sinalizados</Pill>}
            </>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          M01 — DIAGNÓSTICO EXECUTIVO
      ══════════════════════════════════════════════════════════════════════ */}
      {executiveSummary && (
        <Module index={1} id="executiveSummary" icon={Brain} title="Diagnóstico Executivo"
          subtitle="Análise profunda do contexto, oportunidade e viabilidade de lançamento"
          status={getStatus("executiveSummary")} accentColor="cyan"
          onApprove={id => setStatus(id, "approved")} onFlag={id => setStatus(id, "flagged")}
        >
          <div className="relative">
            {editingModule === "executiveSummary" ? (
              <div className="space-y-2">
                <Textarea
                  value={editValues["executiveSummary"] ?? executiveSummary}
                  onChange={e => setEditValues(prev => ({ ...prev, executiveSummary: e.target.value }))}
                  className="font-mono text-xs bg-transparent border-white/10 resize-none min-h-[120px]"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="rounded-none font-mono text-[10px] h-7 px-3 gap-1.5 border-primary/30 text-primary"
                    onClick={() => { setSavedEdits(p => ({ ...p, executiveSummary: editValues["executiveSummary"] ?? executiveSummary })); setEditingModule(null); }}>
                    <Save className="h-3 w-3" />Salvar
                  </Button>
                  <Button size="sm" variant="ghost" className="rounded-none font-mono text-[10px] h-7 px-3" onClick={() => setEditingModule(null)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="group">
                <p className="font-mono text-xs text-foreground/80 leading-relaxed">{executiveSummary}</p>
                <Button size="sm" variant="ghost"
                  className="mt-2 rounded-none font-mono text-[10px] h-6 px-2 gap-1 text-muted-foreground/40 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => { setEditValues(p => ({ ...p, executiveSummary })); setEditingModule("executiveSummary"); }}>
                  <Pencil className="h-2.5 w-2.5" />Editar
                </Button>
              </div>
            )}
          </div>
        </Module>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          M02 — BIG DOMINO (special card, always visible if exists)
      ══════════════════════════════════════════════════════════════════════ */}
      {bigDomino && (
        <BigDominoCard
          value={bigDomino}
          status={getStatus("bigDomino")}
          onApprove={id => setStatus(id, "approved")}
          onFlag={id => setStatus(id, "flagged")}
          editing={editingModule === "bigDomino"}
          editValue={editValues["bigDomino"] ?? bigDomino}
          onEdit={() => { setEditValues(p => ({ ...p, bigDomino })); setEditingModule("bigDomino"); }}
          onSave={() => { setSavedEdits(p => ({ ...p, bigDomino: editValues["bigDomino"] ?? bigDomino })); setEditingModule(null); }}
          onCancelEdit={() => setEditingModule(null)}
          onChangeEdit={v => setEditValues(p => ({ ...p, bigDomino: v }))}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          M03 — POSICIONAMENTO DA OFERTA
      ══════════════════════════════════════════════════════════════════════ */}
      <Module index={3} id="positioning" icon={Target} title="Posicionamento da Oferta"
        subtitle="Proposta única de valor, mecanismo diferenciador e justificativa de preço"
        status={getStatus("positioning")} accentColor="purple"
        onApprove={id => setStatus(id, "approved")} onFlag={id => setStatus(id, "flagged")}
        isEmpty={Object.keys(positioning).length === 0}
      >
        <div className="space-y-4">
          {str(positioning["uniqueValueProposition"]) && (
            <div className="border-l-2 border-violet-400/40 pl-4 py-1">
              <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1.5">Proposta Única de Valor</div>
              <p className="font-mono text-sm font-bold text-foreground/95 leading-snug">
                {str(positioning["uniqueValueProposition"])}
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DataRow label="Mecanismo Único" value={str(positioning["primaryDifferentiator"])} />
            <DataRow label="Posicionamento" value={str(positioning["positioning"])} />
            <DataRow label="Justificativa de Preço" value={str(positioning["priceJustification"])} />
          </div>
          <BulletItems label="Vantagens Competitivas" items={arr(positioning["competitiveAdvantages"])} color="green" />
        </div>
      </Module>

      {/* ═══════════════════════════════════════════════════════════════════
          M04 — DIAGNÓSTICO DE MERCADO
      ══════════════════════════════════════════════════════════════════════ */}
      <Module index={4} id="market" icon={TrendingUp} title="Diagnóstico de Mercado"
        subtitle="Maturidade, cenário competitivo, oportunidades e ameaças identificadas"
        status={getStatus("market")} accentColor="amber"
        onApprove={id => setStatus(id, "approved")} onFlag={id => setStatus(id, "flagged")}
        isEmpty={Object.keys(market).length === 0}
      >
        <div className="space-y-4">
          {str(market["marketMaturity"]) && (
            <div className="flex items-center gap-3">
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">Maturidade do Mercado</span>
              <Pill color="amber">{str(market["marketMaturity"])}</Pill>
            </div>
          )}
          <DataRow label="Cenário Competitivo" value={str(market["competitiveLandscape"])} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <BulletItems label="Oportunidades" items={arr(market["opportunities"])} color="green" />
            <BulletItems label="Ameaças" items={arr(market["threats"])} color="red" />
          </div>
          <BulletItems label="Barreiras de Entrada" items={arr(market["entryBarriers"])} color="amber" />
        </div>
      </Module>

      {/* ═══════════════════════════════════════════════════════════════════
          M05 — ARQUÉTIPO DE AUDIÊNCIA
      ══════════════════════════════════════════════════════════════════════ */}
      <Module index={5} id="audience" icon={Users} title="Arquétipo de Audiência"
        subtitle="Avatar principal, perfil psicográfico, objeções reais e gatilhos de compra"
        status={getStatus("audience")} accentColor="cyan"
        onApprove={id => setStatus(id, "approved")} onFlag={id => setStatus(id, "flagged")}
        isEmpty={Object.keys(audience).length === 0}
      >
        <div className="space-y-4">
          {str(audience["primaryAvatar"]) && (
            <div className="border border-white/8 bg-white/[0.02] p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Star className="h-3 w-3 text-cyan-400/70" />
                <span className="font-mono text-[9px] uppercase tracking-widest text-cyan-400/60">Avatar Principal</span>
              </div>
              <p className="font-mono text-xs text-foreground/80 leading-relaxed">{str(audience["primaryAvatar"])}</p>
            </div>
          )}
          <DataRow label="Perfil Psicográfico" value={str(audience["psychographicProfile"])} />
          <DataRow label="Estratégia de Sofisticação" value={str(audience["sophisticationStrategy"])} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <BulletItems label="Gatilhos de Compra" items={arr(audience["buyingTriggers"])} color="amber" />
            <BulletItems label="Objeções Reais" items={arr(audience["objections"])} color="red" />
          </div>
          <BulletItems label="Avatares Secundários" items={arr(audience["secondaryAvatars"])} />
        </div>
      </Module>

      {/* ═══════════════════════════════════════════════════════════════════
          M06 — ARQUITETURA DA CAMPANHA
      ══════════════════════════════════════════════════════════════════════ */}
      <Module index={6} id="architecture" icon={Lightbulb} title="Arquitetura da Campanha"
        subtitle="Narrativa central, gancho emocional, mensagens-chave e pilares de conteúdo"
        status={getStatus("architecture")} accentColor="purple"
        onApprove={id => setStatus(id, "approved")} onFlag={id => setStatus(id, "flagged")}
        isEmpty={Object.keys(architecture).length === 0}
      >
        <div className="space-y-4">
          {str(architecture["coreNarrative"]) && (
            <div className="border-l-2 border-violet-400/40 pl-4 py-1">
              <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1.5">Narrativa Central</div>
              <p className="font-mono text-sm font-bold text-foreground/95 leading-snug">{str(architecture["coreNarrative"])}</p>
            </div>
          )}
          <DataRow label="Gancho Emocional" value={str(architecture["emotionalHook"])} />
          <DataRow label="Estratégia de CTA" value={str(architecture["callToActionStrategy"])} />
          <BulletItems label="Mensagens-Chave" items={arr(architecture["keyMessages"])} color="green" />
          <BulletItems label="Pilares de Conteúdo" items={arr(architecture["contentPillars"])} />
        </div>
      </Module>

      {/* ═══════════════════════════════════════════════════════════════════
          M07 — ENGENHARIA DE GATILHOS
      ══════════════════════════════════════════════════════════════════════ */}
      <Module index={7} id="triggers" icon={Flame} title="Engenharia de Gatilhos"
        subtitle="Gatilho dominante, sequência dia a dia, ponte de transformação e ângulos anti-requisito"
        status={getStatus("triggers")} accentColor="red"
        onApprove={id => setStatus(id, "approved")} onFlag={id => setStatus(id, "flagged")}
        isEmpty={!dominantTrigger && triggerSequence.length === 0 && !transformBridge}
      >
        <div className="space-y-4">
          {dominantTrigger && (
            <div className="border border-white/8 bg-white/[0.02] p-4">
              <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-2">Gatilho Dominante</div>
              <div className="flex flex-wrap gap-2 mb-2">
                <Pill color="red">{dominantTrigger}</Pill>
              </div>
              {dominantJustif && <p className="font-mono text-[11px] text-muted-foreground/55 leading-relaxed">{dominantJustif}</p>}
            </div>
          )}
          <SequenceTimeline items={triggerSequence} />
          <DataRow label="Ponte de Transformação" value={transformBridge} />
          <BulletItems label="Ângulos Anti-Requisito" items={antiReq} color="amber" />
          {socialProof && <DataRow label="Blueprint de Prova Social" value={socialProof} />}
        </div>
      </Module>

      {/* ═══════════════════════════════════════════════════════════════════
          M08 — MÉTRICAS DE PERFORMANCE
      ══════════════════════════════════════════════════════════════════════ */}
      <Module index={8} id="metrics" icon={BarChart3} title="Métricas de Performance"
        subtitle="KPI principal, metas de receita, taxa de conversão e premissas críticas"
        status={getStatus("metrics")} accentColor="green"
        onApprove={id => setStatus(id, "approved")} onFlag={id => setStatus(id, "flagged")}
        isEmpty={Object.keys(metrics).length === 0}
      >
        <div className="space-y-4">
          <KpiGrid items={[
            { label: "KPI Principal",       value: str(metrics["primaryKPI"]) },
            { label: "Meta de Receita",     value: revenueTarget ? `R$ ${revenueTarget.toLocaleString("pt-BR")}` : "", accent: "text-emerald-400 font-bold" },
            { label: "Taxa de Conv. Alvo",  value: conversionRate ? `${(conversionRate * 100).toFixed(1)}%` : "" },
            { label: "Horizonte",           value: str(metrics["launchWindow"]) },
          ]} />
          <BulletItems label="Premissas Críticas" items={arr(metrics["criticalAssumptions"])} color="amber" />
        </div>
      </Module>

      {/* ═══════════════════════════════════════════════════════════════════
          M09 — ANÁLISE DE RISCOS
      ══════════════════════════════════════════════════════════════════════ */}
      <Module index={9} id="risks" icon={ShieldAlert} title="Análise de Riscos"
        subtitle="Nível de risco, principais ameaças e estratégias de mitigação"
        status={getStatus("risks")} accentColor="red"
        onApprove={id => setStatus(id, "approved")} onFlag={id => setStatus(id, "flagged")}
        isEmpty={Object.keys(risks).length === 0}
      >
        <div className="space-y-4">
          {str(risks["level"]) && (
            <div className="flex items-center gap-3">
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">Nível Geral</span>
              {(() => {
                const level = str(risks["level"]);
                const cfg = level === "low" ? { label: "Risco Baixo", color: "green" as const } :
                            level === "high" ? { label: "Risco Alto", color: "red" as const } :
                            { label: "Risco Médio", color: "amber" as const };
                return <Pill color={cfg.color}>{cfg.label}</Pill>;
              })()}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <BulletItems label="Principais Riscos" items={arr(risks["mainRisks"])} color="red" />
            <BulletItems label="Mitigações" items={arr(risks["mitigations"])} color="green" />
          </div>
        </div>
      </Module>

      {/* ═══════════════════════════════════════════════════════════════════
          M10 — NOTA DO ESTRATEGISTA
      ══════════════════════════════════════════════════════════════════════ */}
      {strategistNotes && (
        <Module index={10} id="strategistNotes" icon={MessageSquare} title="Nota do Estrategista"
          subtitle="Observações finais, recomendações e instruções de execução"
          status={getStatus("strategistNotes")} accentColor="amber"
          onApprove={id => setStatus(id, "approved")} onFlag={id => setStatus(id, "flagged")}
        >
          <div className="group">
            {editingModule === "strategistNotes" ? (
              <div className="space-y-2">
                <Textarea
                  value={editValues["strategistNotes"] ?? strategistNotes}
                  onChange={e => setEditValues(p => ({ ...p, strategistNotes: e.target.value }))}
                  className="font-mono text-xs bg-transparent border-white/10 resize-none min-h-[100px]"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="rounded-none font-mono text-[10px] h-7 px-3 gap-1.5 border-primary/30 text-primary"
                    onClick={() => { setSavedEdits(p => ({ ...p, strategistNotes: editValues["strategistNotes"] ?? strategistNotes })); setEditingModule(null); }}>
                    <Save className="h-3 w-3" />Salvar
                  </Button>
                  <Button size="sm" variant="ghost" className="rounded-none font-mono text-[10px] h-7 px-3" onClick={() => setEditingModule(null)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <>
                <p className="font-mono text-xs text-foreground/75 leading-relaxed italic">{strategistNotes}</p>
                <Button size="sm" variant="ghost"
                  className="mt-2 rounded-none font-mono text-[10px] h-6 px-2 gap-1 text-muted-foreground/40 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => { setEditValues(p => ({ ...p, strategistNotes })); setEditingModule("strategistNotes"); }}>
                  <Pencil className="h-2.5 w-2.5" />Editar
                </Button>
              </>
            )}
          </div>
        </Module>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER CTA — Aprovação total
      ══════════════════════════════════════════════════════════════════════ */}
      {approvedCount > 0 && (
        <div className={`border p-4 transition-all ${
          approvedCount === TOTAL_MODULES
            ? "border-emerald-500/30 bg-emerald-500/[0.04]"
            : "border-white/8 bg-white/[0.02]"
        }`}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              {approvedCount === TOTAL_MODULES ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 6px #34d399" }} />
                  <span className="font-mono text-[11px] font-bold text-emerald-400 uppercase tracking-widest">
                    Masterplan aprovado — {approvedCount}/{TOTAL_MODULES} módulos
                  </span>
                </>
              ) : (
                <>
                  <Crosshair className="h-3.5 w-3.5 text-muted-foreground/40" />
                  <span className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-widest">
                    {approvedCount}/{TOTAL_MODULES} módulos aprovados
                    {flaggedCount > 0 ? ` · ${flaggedCount} sinalizados` : ""}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              {[...Array(TOTAL_MODULES)].map((_, i) => {
                const moduleIds = ["executiveSummary", "bigDomino", "positioning", "market", "audience", "architecture", "triggers", "metrics", "risks", "strategistNotes"];
                const s = getStatus(moduleIds[i]);
                return (
                  <div key={i} className={`w-4 h-1 transition-all ${
                    s === "approved" ? "bg-emerald-500" :
                    s === "flagged" ? "bg-amber-500" : "bg-white/10"
                  }`} />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
