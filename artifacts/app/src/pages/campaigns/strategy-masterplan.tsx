import { useState } from "react";
import {
  Target, Users, Zap, BarChart3, Brain, ShieldAlert,
  TrendingUp, MessageSquare, Lightbulb, Flame, Star,
  ChevronDown, Check, AlertTriangle, Pencil, Save,
  Award, Crosshair, Share2, Calendar, X, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// ─── Types ───────────────────────────────────────────────────────────────────

export type StrategyObj = Record<string, unknown>;
type Obj = Record<string, unknown>;
type ModuleStatus = "pending" | "approved" | "flagged" | "rejected";

export interface EditField {
  key: string;
  label: string;
  value: string;
  multiline?: boolean;
}

// ─── Parser ──────────────────────────────────────────────────────────────────

export function parseStrategyInsights(strategyD: StrategyObj): StrategyObj {
  const raw = strategyD["executiveSummary"];
  if (typeof raw !== "string") return {};
  const stripped = raw
    .replace(/^```json\s*/m, "").replace(/^```\s*/m, "").replace(/```\s*$/m, "").trim();
  try {
    const parsed = JSON.parse(stripped);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as StrategyObj;
    }
  } catch { /* not JSON */ }
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try { return JSON.parse(match[0]) as StrategyObj; } catch { return {}; }
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

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
  return isNaN(n) || n === 0 ? null : n;
}
function obj(v: unknown): Obj {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Obj;
  return {};
}

/** Returns true if an object has at least one non-empty string or non-empty array value */
function hasData(o: Obj): boolean {
  return Object.values(o).some(v => {
    if (typeof v === "string") return v.trim().length > 0;
    if (Array.isArray(v)) return v.some(i => typeof i === "string" && i.trim().length > 0);
    if (v && typeof v === "object") return hasData(v as Obj);
    return false;
  });
}

/** Split long prose into readable paragraphs */
function splitProse(text: string): string[] {
  if (!text) return [];
  // Split by sentence-ending patterns to create logical paragraphs
  const chunks = text
    .split(/(?<=[.!?])\s{2,}|(?<=\n)\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  if (chunks.length <= 1) {
    // Try single newlines or sentence groups of ~150 chars
    const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
    const grouped: string[] = [];
    let current = "";
    for (const s of sentences) {
      if ((current + s).length > 200 && current.length > 0) {
        grouped.push(current.trim());
        current = s;
      } else {
        current += " " + s;
      }
    }
    if (current.trim()) grouped.push(current.trim());
    return grouped.filter(s => s.length > 0);
  }
  return chunks;
}

// ─── Shared display sub-components ───────────────────────────────────────────

function Pill({ children, color = "default" }: {
  children: React.ReactNode;
  color?: "cyan" | "green" | "red" | "amber" | "default" | "violet";
}) {
  const colors = {
    cyan:   "border-cyan-400/30 bg-cyan-400/8 text-cyan-400",
    green:  "border-emerald-500/30 bg-emerald-500/8 text-emerald-400",
    red:    "border-red-500/30 bg-red-500/8 text-red-400",
    amber:  "border-amber-500/30 bg-amber-500/8 text-amber-400",
    violet: "border-violet-400/30 bg-violet-400/8 text-violet-400",
    default:"border-white/10 bg-white/5 text-foreground/60",
  };
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border ${colors[color]}`}>
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1.5">
      {children}
    </div>
  );
}

function ProseBlock({ text, accent }: { text: string; accent?: string }) {
  if (!text) return null;
  const paras = splitProse(text);
  if (paras.length <= 1) {
    return <p className={`font-mono text-xs leading-relaxed ${accent ?? "text-foreground/75"}`}>{text}</p>;
  }
  return (
    <div className="space-y-2">
      {paras.map((p, i) => (
        <p key={i} className={`font-mono text-xs leading-relaxed ${accent ?? "text-foreground/75"}`}>{p}</p>
      ))}
    </div>
  );
}

function LabeledText({ label, value, accent, large }: {
  label: string; value: string; accent?: string; large?: boolean;
}) {
  if (!value) return null;
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      {large
        ? <p className={`font-mono text-sm font-bold leading-snug ${accent ?? "text-foreground/90"}`}>{value}</p>
        : <ProseBlock text={value} accent={accent} />
      }
    </div>
  );
}

function BulletList({ label, items, color = "default" }: {
  label: string; items: string[];
  color?: "cyan" | "green" | "red" | "amber" | "violet" | "default";
}) {
  if (!items.length) return null;
  const dotColors = {
    cyan: "text-cyan-400", green: "text-emerald-400", red: "text-red-400",
    amber: "text-amber-400", violet: "text-violet-400", default: "text-primary/50",
  };
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
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

function KpiCards({ items }: { items: { label: string; value: string; accent?: string }[] }) {
  const visible = items.filter(x => x.value);
  if (!visible.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {visible.map((item, i) => (
        <div key={i} className="border border-white/8 bg-white/[0.02] p-3">
          <SectionLabel>{item.label}</SectionLabel>
          <div className={`font-mono text-sm font-bold ${item.accent ?? "text-foreground/90"}`}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function PhaseCard({ label, trigger, stack, logic, color }: {
  label: string; trigger: string; stack: string[]; logic: string;
  color: "cyan" | "green" | "amber" | "red";
}) {
  if (!trigger && !stack.length && !logic) return null;
  return (
    <div className="border border-white/8 bg-white/[0.02] p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>{label}</SectionLabel>
        {trigger && <Pill color={color}>{trigger}</Pill>}
      </div>
      {stack.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {stack.map((t, i) => (
            <span key={i} className="font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 border border-white/8 text-muted-foreground/50">{t}</span>
          ))}
        </div>
      )}
      {logic && <p className="font-mono text-[11px] text-muted-foreground/50 leading-relaxed">{logic}</p>}
    </div>
  );
}

function SequenceTimeline({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <SectionLabel>Sequência Dia a Dia</SectionLabel>
      <div className="relative pl-5 space-y-2">
        <div className="absolute left-1.5 top-0 bottom-0 w-px bg-gradient-to-b from-primary/30 via-primary/15 to-transparent" />
        {items.map((t, i) => (
          <div key={i} className="relative flex items-start gap-2">
            <div className="absolute -left-[13px] top-1.5 w-2.5 h-2.5 rounded-full border border-primary/40 bg-card flex items-center justify-center shrink-0">
              <div className="w-1 h-1 rounded-full bg-primary/60" />
            </div>
            <span className="font-mono text-[10px] text-primary/40 shrink-0 w-5">D{i + 1}</span>
            <span className="font-mono text-xs text-foreground/70 leading-relaxed">{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Module wrapper ───────────────────────────────────────────────────────────

const ACCENT = {
  cyan:   { border: "border-l-cyan-400/50",    badge: "border-cyan-400/30 text-cyan-400 bg-cyan-400/5",    icon: "text-cyan-400",   glow: "0 0 20px hsl(180 100% 60% / 0.07)" },
  green:  { border: "border-l-emerald-500/50", badge: "border-emerald-500/30 text-emerald-400 bg-emerald-500/5", icon: "text-emerald-400", glow: "0 0 20px hsl(150 80% 50% / 0.06)" },
  amber:  { border: "border-l-amber-500/50",   badge: "border-amber-500/30 text-amber-400 bg-amber-500/5",  icon: "text-amber-400",  glow: "0 0 20px hsl(40 100% 55% / 0.06)" },
  red:    { border: "border-l-red-500/50",     badge: "border-red-500/30 text-red-400 bg-red-500/5",       icon: "text-red-400",    glow: "0 0 20px hsl(0 80% 50% / 0.06)" },
  violet: { border: "border-l-violet-400/50",  badge: "border-violet-400/30 text-violet-400 bg-violet-400/5", icon: "text-violet-400", glow: "0 0 20px hsl(270 80% 60% / 0.06)" },
} as const;

type AccentColor = keyof typeof ACCENT;

interface ModuleProps {
  index: number;
  id: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  status: ModuleStatus;
  accentColor: AccentColor;
  children: React.ReactNode;
  editFields?: EditField[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onFlag: (id: string) => void;
  onSave?: (id: string, vals: Record<string, string>) => void;
  hidden?: boolean;
  defaultOpen?: boolean;
}

function Module({
  index, id, icon: Icon, title, subtitle, status, accentColor,
  children, editFields, onApprove, onReject, onFlag, onSave, hidden, defaultOpen,
}: ModuleProps) {
  const [expanded, setExpanded] = useState(defaultOpen ?? false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  if (hidden) return null;

  const a = ACCENT[accentColor];
  const borderClass = status === "approved" ? "border-l-emerald-500/70"
    : status === "rejected"  ? "border-l-red-500/70"
    : status === "flagged"   ? "border-l-amber-500/70"
    : a.border;

  const statusCfg: Record<ModuleStatus, { label: string; cls: string }> = {
    pending:  { label: "Pendente",      cls: "border-white/10 text-muted-foreground/40" },
    approved: { label: "✓ Aprovado",    cls: "border-emerald-500/40 text-emerald-400" },
    flagged:  { label: "⚠ Sinalizado",  cls: "border-amber-500/40 text-amber-400" },
    rejected: { label: "✕ Rejeitado",   cls: "border-red-500/40 text-red-400" },
  };
  const cfg = statusCfg[status];

  function startEdit() {
    const init: Record<string, string> = {};
    (editFields ?? []).forEach(f => { init[f.key] = f.value; });
    setDraft(init);
    setEditing(true);
  }

  function saveEdit() {
    onSave?.(id, draft);
    setEditing(false);
  }

  return (
    <div
      className={`border border-white/8 border-l-2 ${borderClass} bg-card/40 transition-all duration-200`}
      style={expanded ? { boxShadow: a.glow } : undefined}
    >
      {/* Header */}
      <button
        className="w-full text-left p-4 flex items-center gap-3 group hover:bg-white/[0.02] transition-colors"
        onClick={() => { setExpanded(v => !v); if (editing) setEditing(false); }}
      >
        <div className={`shrink-0 w-7 h-7 border flex items-center justify-center font-mono text-[10px] font-bold ${a.badge}`}>
          {String(index).padStart(2, "0")}
        </div>
        <Icon className={`h-4 w-4 shrink-0 ${a.icon}`} />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-xs font-bold uppercase tracking-widest text-foreground group-hover:text-white transition-colors">{title}</div>
          <div className="font-mono text-[10px] text-muted-foreground/50 mt-0.5 truncate">{subtitle}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`hidden sm:inline font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 border ${cfg.cls}`}>
            {cfg.label}
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground/30 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div className="border-t border-white/5">

          {/* Rejected overlay */}
          {status === "rejected" && !editing && (
            <div className="mx-4 mt-4 border border-red-500/20 bg-red-500/[0.04] p-3 flex items-center gap-2">
              <X className="h-3.5 w-3.5 text-red-400 shrink-0" />
              <span className="font-mono text-[11px] text-red-400/80">Módulo rejeitado — edite o conteúdo e re-aprove ou reenvie para o estrategista.</span>
            </div>
          )}

          {/* Content or edit form */}
          {editing && editFields && editFields.length > 0 ? (
            <div className="p-4 space-y-4">
              {editFields.map(f => (
                <div key={f.key}>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1.5">{f.label}</div>
                  <Textarea
                    value={draft[f.key] ?? f.value}
                    onChange={e => setDraft(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="font-mono text-xs bg-transparent border-white/10 resize-none"
                    rows={f.multiline ? 5 : 2}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 space-y-5">{children}</div>
          )}

          {/* Action bar */}
          <div className="px-4 pb-4 flex items-center gap-2 flex-wrap border-t border-white/5 pt-3 mt-1">
            {editing ? (
              <>
                <Button size="sm" variant="outline"
                  className="rounded-none font-mono text-[10px] uppercase tracking-widest h-7 px-3 gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                  onClick={saveEdit}>
                  <Save className="h-3 w-3" />Salvar alterações
                </Button>
                <Button size="sm" variant="ghost"
                  className="rounded-none font-mono text-[10px] h-7 px-3 text-muted-foreground"
                  onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
              </>
            ) : (
              <>
                {/* Aprovar */}
                <Button size="sm" variant="outline"
                  className={`rounded-none font-mono text-[10px] uppercase tracking-widest h-7 px-3 gap-1.5 transition-all ${
                    status === "approved"
                      ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10"
                      : "border-white/10 text-muted-foreground hover:border-emerald-500/40 hover:text-emerald-400"
                  }`}
                  onClick={() => onApprove(id)}>
                  <Check className="h-3 w-3" />
                  {status === "approved" ? "Aprovado" : "Aprovar"}
                </Button>

                {/* Editar */}
                {editFields && editFields.length > 0 && (
                  <Button size="sm" variant="outline"
                    className="rounded-none font-mono text-[10px] uppercase tracking-widest h-7 px-3 gap-1.5 border-white/10 text-muted-foreground hover:border-primary/40 hover:text-primary transition-all"
                    onClick={startEdit}>
                    <Pencil className="h-3 w-3" />Editar
                  </Button>
                )}

                {/* Rejeitar */}
                <Button size="sm" variant="outline"
                  className={`rounded-none font-mono text-[10px] uppercase tracking-widest h-7 px-3 gap-1.5 transition-all ${
                    status === "rejected"
                      ? "border-red-500/50 text-red-400 bg-red-500/10"
                      : "border-white/10 text-muted-foreground hover:border-red-500/40 hover:text-red-400"
                  }`}
                  onClick={() => onReject(id)}>
                  <X className="h-3 w-3" />
                  {status === "rejected" ? "Rejeitado" : "Rejeitar"}
                </Button>

                {/* Sinalizar / voltar ao pendente */}
                <Button size="sm" variant="ghost"
                  className={`rounded-none font-mono text-[10px] uppercase tracking-widest h-7 px-3 gap-1.5 transition-all ml-auto ${
                    status === "flagged"
                      ? "text-amber-400 bg-amber-500/8"
                      : "text-muted-foreground/40 hover:text-amber-400"
                  }`}
                  onClick={() => status !== "pending" ? onFlag(id) : undefined}
                  title={status === "pending" ? "Já pendente" : "Sinalizar para revisão"}>
                  {status !== "pending"
                    ? <><RotateCcw className="h-3 w-3" />Reverter</>
                    : <><AlertTriangle className="h-3 w-3" />Sinalizar</>
                  }
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Big Domino (always-visible hero card) ────────────────────────────────────

function BigDominoCard({ value, status, onApprove, onReject, onFlag }: {
  value: string; status: ModuleStatus;
  onApprove: (id: string) => void; onReject: (id: string) => void; onFlag: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(value);
  const [display, setDisplay] = useState(value);

  const borderClass = status === "approved" ? "border-emerald-500/50"
    : status === "rejected"  ? "border-red-500/50"
    : status === "flagged"   ? "border-amber-500/50"
    : "border-primary/30";

  return (
    <div className={`relative border-2 ${borderClass} bg-gradient-to-br from-primary/[0.07] to-transparent p-5 transition-all`}
      style={{ boxShadow: "0 0 40px hsl(var(--primary)/0.08), inset 0 0 40px hsl(var(--primary)/0.03)" }}>
      {/* Corner marks */}
      {["-translate-x-px -translate-y-px border-t-2 border-l-2 top-0 left-0",
        "translate-x-px -translate-y-px border-t-2 border-r-2 top-0 right-0",
        "-translate-x-px translate-y-px border-b-2 border-l-2 bottom-0 left-0",
        "translate-x-px translate-y-px border-b-2 border-r-2 bottom-0 right-0"].map((cls, i) => (
        <div key={i} className={`absolute w-3 h-3 border-primary/50 ${cls}`} />
      ))}

      <div className="flex items-center gap-2 mb-4">
        <Zap className="h-4 w-4 text-primary" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-primary/70 font-bold">M02 — Big Domino · A Crença Central</span>
      </div>

      {editing ? (
        <div className="space-y-2 mb-4">
          <Textarea value={editVal} onChange={e => setEditVal(e.target.value)}
            className="font-mono text-sm bg-transparent border-primary/20 resize-none min-h-[80px]" />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="rounded-none font-mono text-[10px] h-7 px-3 gap-1.5 border-primary/30 text-primary"
              onClick={() => { setDisplay(editVal); setEditing(false); }}>
              <Save className="h-3 w-3" />Salvar
            </Button>
            <Button size="sm" variant="ghost" className="rounded-none font-mono text-[10px] h-7 px-3" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <div className="mb-4 group">
          <p className="font-mono text-base sm:text-lg font-black text-foreground leading-snug tracking-tight italic mb-2">
            "{display}"
          </p>
          <p className="font-mono text-[10px] text-muted-foreground/35 leading-relaxed mb-3">
            Implantando esta crença, todas as objeções colapsam automaticamente — sem precisar refutar uma por uma.
          </p>
          <Button size="sm" variant="ghost"
            className="rounded-none font-mono text-[9px] h-6 px-2 gap-1 text-muted-foreground/30 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => { setEditVal(display); setEditing(true); }}>
            <Pencil className="h-2.5 w-2.5" />Editar
          </Button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="outline"
          className={`rounded-none font-mono text-[10px] uppercase tracking-widest h-7 px-3 gap-1.5 ${
            status === "approved" ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10" : "border-white/10 text-muted-foreground hover:border-emerald-500/40 hover:text-emerald-400"
          }`}
          onClick={() => onApprove("bigDomino")}>
          <Check className="h-3 w-3" />{status === "approved" ? "Aprovado" : "Aprovar"}
        </Button>
        <Button size="sm" variant="outline"
          className={`rounded-none font-mono text-[10px] uppercase tracking-widest h-7 px-3 gap-1.5 ${
            status === "rejected" ? "border-red-500/50 text-red-400 bg-red-500/10" : "border-white/10 text-muted-foreground hover:border-red-500/40 hover:text-red-400"
          }`}
          onClick={() => onReject("bigDomino")}>
          <X className="h-3 w-3" />{status === "rejected" ? "Rejeitado" : "Rejeitar"}
        </Button>
        <Button size="sm" variant="ghost"
          className={`rounded-none font-mono text-[10px] uppercase tracking-widest h-7 px-3 gap-1.5 ml-auto ${
            status === "flagged" ? "text-amber-400 bg-amber-500/8" : "text-muted-foreground/40 hover:text-amber-400"
          }`}
          onClick={() => onFlag("bigDomino")}>
          <AlertTriangle className="h-3 w-3" />{status === "flagged" ? "Sinalizado" : "Sinalizar"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface StrategyMasterplanProps {
  strategyD: Obj;
  ins: Obj;
}

const TOTAL = 10;
const MODULE_IDS = ["executiveSummary","bigDomino","positioning","market","audience","architecture","triggers","metrics","risks","notes"];

export function StrategyMasterplan({ strategyD, ins }: StrategyMasterplanProps) {
  const hasIns = Object.keys(ins).length > 0;
  const src = hasIns ? ins : strategyD;

  const [statuses, setStatuses] = useState<Record<string, ModuleStatus>>({});
  const [savedEdits, setSavedEdits] = useState<Record<string, Record<string, string>>>({});

  const toggle = (id: string, next: ModuleStatus) =>
    setStatuses(prev => ({ ...prev, [id]: prev[id] === next ? "pending" : next }));
  const getStatus = (id: string): ModuleStatus => statuses[id] ?? "pending";
  const handleSave = (id: string, vals: Record<string, string>) =>
    setSavedEdits(prev => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...vals } }));
  const edited = (id: string, key: string, fallback: string): string =>
    savedEdits[id]?.[key] ?? fallback;

  // ── Extract fields ──
  const rawExec     = str(src["executiveSummary"]) || str(strategyD["executiveSummary"]);
  const strategistNotes = str(src["strategistNotes"]) || str(strategyD["strategistNotes"]);

  const market       = obj(src["marketDiagnosis"]     ?? strategyD["marketDiagnosis"]);
  const positioning  = obj(src["offerPositioning"]    ?? strategyD["offerPositioning"]);
  const audience     = obj(src["audienceSegmentation"] ?? strategyD["audienceSegmentation"]);
  const architecture = obj(src["campaignArchitecture"] ?? strategyD["campaignArchitecture"]);
  const metrics      = obj(src["successMetrics"]      ?? strategyD["successMetrics"]);
  const risks        = obj(src["risks"]               ?? strategyD["risks"]);
  const triggerMap   = obj(src["triggerMap"]          ?? strategyD["triggerMap"]);

  // Big Domino: not a top-level field — extract from architecture narrative or summary
  const bigDomino = str(src["bigDomino"] ?? strategyD["bigDomino"])
    || str(architecture["coreNarrative"])
    || str(architecture["emotionalHook"]);

  // TriggerMap phases
  const preLaunch  = obj(triggerMap["preLaunch"]);
  const cartOpen   = obj(triggerMap["cartOpen"]);
  const cartClose  = obj(triggerMap["cartClose"]);
  const remarketing = obj(triggerMap["remarketing"]);
  const triggerSeq = arr(triggerMap["triggerStackSequence"]);
  const dominant   = str(triggerMap["dominantTrigger"]);
  const dominantJustif = str(triggerMap["dominantTriggerJustification"]);
  const socialProof = str(triggerMap["socialProofBlueprint"]);
  const antiReq    = arr(triggerMap["antiRequisiteAngles"]);
  const bridge     = str(triggerMap["transformationBridge"]);

  // Platform distribution
  const platformDist = str(architecture["platformDistributionStrategy"]);

  const revenueTarget  = num(metrics["revenueTarget"]);
  const conversionRate = num(metrics["conversionRateTarget"]);

  // ── Hide executiveSummary if it looks like raw JSON (fallback from parseAgentJSON)
  const execIsJson = rawExec.trimStart().startsWith("{") || rawExec.trimStart().startsWith("```");
  const executiveSummary = execIsJson ? "" : rawExec;

  // ── Progress ──
  const approved = Object.values(statuses).filter(s => s === "approved").length;
  const rejected = Object.values(statuses).filter(s => s === "rejected").length;
  const flagged  = Object.values(statuses).filter(s => s === "flagged").length;
  const progress = Math.round((approved / TOTAL) * 100);

  const hasAnyContent = !!(executiveSummary || bigDomino || hasData(positioning) || hasData(audience) || hasData(architecture));

  if (!hasAnyContent) {
    return (
      <div className="py-20 text-center border border-white/5">
        <Brain className="h-10 w-10 text-muted-foreground/15 mx-auto mb-4" />
        <p className="font-mono text-xs text-muted-foreground/30 uppercase tracking-widest">
          O Estrategista está elaborando o masterplan…
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">

      {/* ═══ HEADER ═══════════════════════════════════════════════════════════ */}
      <div className="border border-white/8 bg-gradient-to-r from-primary/[0.05] to-transparent p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Award className="h-3.5 w-3.5 text-primary/60" />
              <span className="font-mono text-[9px] uppercase tracking-widest text-primary/55 font-bold">NexOS AI — Proposta Estratégica</span>
            </div>
            <h2 className="font-mono text-sm font-black uppercase tracking-widest text-foreground">Masterplan de Lançamento</h2>
            <p className="font-mono text-[10px] text-muted-foreground/40 mt-1">
              {TOTAL} módulos · Revise, edite e aprove cada seção antes de gerar conteúdo
            </p>
          </div>
          <div className="text-right shrink-0 space-y-0.5">
            <div className="font-mono text-2xl font-black text-foreground leading-none">
              {approved}<span className="text-muted-foreground/25 text-sm font-normal">/{TOTAL}</span>
            </div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/35">Aprovados</div>
            {rejected > 0 && <div className="font-mono text-[9px] text-red-400/70">{rejected} rejeitado{rejected > 1 ? "s" : ""}</div>}
            {flagged  > 0 && <div className="font-mono text-[9px] text-amber-400/60">{flagged} sinalizado{flagged > 1 ? "s" : ""}</div>}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 mb-3">
          <div className="flex justify-between mb-1">
            <span className="font-mono text-[9px] text-muted-foreground/35 uppercase tracking-widest">Progresso de revisão</span>
            <span className="font-mono text-[9px] text-muted-foreground/40">{progress}%</span>
          </div>
          <div className="h-0.5 bg-white/5 w-full">
            <div className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Module track */}
        <div className="flex gap-1">
          {MODULE_IDS.map((id, i) => {
            const s = getStatus(id);
            return (
              <div key={i} title={`Módulo ${String(i+1).padStart(2,"0")}`}
                className={`flex-1 h-1 transition-all rounded-sm ${
                  s === "approved" ? "bg-emerald-500"
                  : s === "rejected" ? "bg-red-500"
                  : s === "flagged"  ? "bg-amber-500"
                  : "bg-white/8"
                }`} />
            );
          })}
        </div>
      </div>

      {/* ═══ M01 — DIAGNÓSTICO EXECUTIVO ═════════════════════════════════════ */}
      <Module index={1} id="executiveSummary" icon={Brain} title="Diagnóstico Executivo"
        subtitle="Análise situacional, oportunidade identificada e viabilidade do lançamento"
        status={getStatus("executiveSummary")} accentColor="cyan"
        onApprove={id => toggle(id, "approved")} onReject={id => toggle(id, "rejected")} onFlag={id => toggle(id, "flagged")}
        onSave={handleSave}
        editFields={[{ key: "executiveSummary", label: "Diagnóstico Executivo", value: executiveSummary, multiline: true }]}
        hidden={!executiveSummary}
      >
        <ProseBlock text={edited("executiveSummary", "executiveSummary", executiveSummary)} />
      </Module>

      {/* ═══ M02 — BIG DOMINO (hero card, always expanded) ═══════════════════ */}
      {bigDomino && (
        <BigDominoCard value={bigDomino} status={getStatus("bigDomino")}
          onApprove={id => toggle(id, "approved")}
          onReject={id => toggle(id, "rejected")}
          onFlag={id => toggle(id, "flagged")} />
      )}

      {/* ═══ M03 — POSICIONAMENTO DA OFERTA ══════════════════════════════════ */}
      <Module index={3} id="positioning" icon={Target} title="Posicionamento da Oferta"
        subtitle="Proposta única de valor, mecanismo diferenciador e justificativa de preço"
        status={getStatus("positioning")} accentColor="violet"
        onApprove={id => toggle(id, "approved")} onReject={id => toggle(id, "rejected")} onFlag={id => toggle(id, "flagged")}
        onSave={handleSave}
        editFields={[
          { key: "uniqueValueProposition", label: "Proposta Única de Valor", value: str(positioning["uniqueValueProposition"]), multiline: true },
          { key: "primaryDifferentiator",  label: "Mecanismo Único",          value: str(positioning["primaryDifferentiator"]) },
          { key: "positioning",            label: "Posicionamento Estratégico", value: str(positioning["positioning"]) },
          { key: "priceJustification",     label: "Justificativa de Preço",   value: str(positioning["priceJustification"]) },
        ]}
        hidden={!hasData(positioning)}
      >
        <div className="space-y-4">
          {(edited("positioning","uniqueValueProposition", str(positioning["uniqueValueProposition"]))) && (
            <div className="border-l-2 border-violet-400/40 pl-4 py-1">
              <SectionLabel>Proposta Única de Valor</SectionLabel>
              <p className="font-mono text-sm font-bold text-foreground/95 leading-snug">
                {edited("positioning","uniqueValueProposition", str(positioning["uniqueValueProposition"]))}
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <LabeledText label="Mecanismo Único" value={edited("positioning","primaryDifferentiator", str(positioning["primaryDifferentiator"]))} />
            <LabeledText label="Posicionamento Estratégico" value={edited("positioning","positioning", str(positioning["positioning"]))} />
            <LabeledText label="Justificativa de Preço" value={edited("positioning","priceJustification", str(positioning["priceJustification"]))} />
          </div>
          <BulletList label="Vantagens Competitivas" items={arr(positioning["competitiveAdvantages"])} color="green" />
        </div>
      </Module>

      {/* ═══ M04 — DIAGNÓSTICO DE MERCADO ════════════════════════════════════ */}
      <Module index={4} id="market" icon={TrendingUp} title="Diagnóstico de Mercado"
        subtitle="Maturidade, cenário competitivo, oportunidades e ameaças identificadas"
        status={getStatus("market")} accentColor="amber"
        onApprove={id => toggle(id, "approved")} onReject={id => toggle(id, "rejected")} onFlag={id => toggle(id, "flagged")}
        onSave={handleSave}
        editFields={[
          { key: "competitiveLandscape", label: "Cenário Competitivo", value: str(market["competitiveLandscape"]), multiline: true },
        ]}
        hidden={!hasData(market)}
      >
        <div className="space-y-4">
          {str(market["marketMaturity"]) && (
            <div className="flex items-center gap-3">
              <SectionLabel>Maturidade do Mercado</SectionLabel>
              <Pill color="amber">{str(market["marketMaturity"])}</Pill>
            </div>
          )}
          <LabeledText label="Cenário Competitivo" value={edited("market","competitiveLandscape", str(market["competitiveLandscape"]))} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <BulletList label="Oportunidades" items={arr(market["opportunities"])} color="green" />
            <BulletList label="Ameaças" items={arr(market["threats"])} color="red" />
          </div>
          <BulletList label="Barreiras de Entrada" items={arr(market["entryBarriers"])} color="amber" />
        </div>
      </Module>

      {/* ═══ M05 — ARQUÉTIPO DE AUDIÊNCIA ════════════════════════════════════ */}
      <Module index={5} id="audience" icon={Users} title="Arquétipo de Audiência"
        subtitle="Avatar principal, perfil psicográfico, objeções reais e gatilhos de compra"
        status={getStatus("audience")} accentColor="cyan"
        onApprove={id => toggle(id, "approved")} onReject={id => toggle(id, "rejected")} onFlag={id => toggle(id, "flagged")}
        onSave={handleSave}
        editFields={[
          { key: "primaryAvatar",          label: "Avatar Principal",            value: str(audience["primaryAvatar"]), multiline: true },
          { key: "psychographicProfile",   label: "Perfil Psicográfico",         value: str(audience["psychographicProfile"]), multiline: true },
          { key: "sophisticationStrategy", label: "Estratégia de Sofisticação",  value: str(audience["sophisticationStrategy"]), multiline: true },
        ]}
        hidden={!hasData(audience)}
      >
        <div className="space-y-4">
          {(edited("audience","primaryAvatar", str(audience["primaryAvatar"]))) && (
            <div className="border border-white/8 bg-white/[0.02] p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Star className="h-3 w-3 text-cyan-400/60" />
                <SectionLabel>Avatar Principal</SectionLabel>
              </div>
              <ProseBlock text={edited("audience","primaryAvatar", str(audience["primaryAvatar"]))} />
            </div>
          )}
          <LabeledText label="Perfil Psicográfico" value={edited("audience","psychographicProfile", str(audience["psychographicProfile"]))} />
          <LabeledText label="Estratégia de Sofisticação" value={edited("audience","sophisticationStrategy", str(audience["sophisticationStrategy"]))} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <BulletList label="Gatilhos de Compra" items={arr(audience["buyingTriggers"])} color="amber" />
            <BulletList label="Objeções Reais" items={arr(audience["objections"])} color="red" />
          </div>
          <BulletList label="Avatares Secundários" items={arr(audience["secondaryAvatars"])} />
        </div>
      </Module>

      {/* ═══ M06 — ARQUITETURA DA CAMPANHA ══════════════════════════════════ */}
      <Module index={6} id="architecture" icon={Lightbulb} title="Arquitetura da Campanha"
        subtitle="Narrativa central, gancho emocional, distribuição por plataforma e pilares de conteúdo"
        status={getStatus("architecture")} accentColor="violet"
        onApprove={id => toggle(id, "approved")} onReject={id => toggle(id, "rejected")} onFlag={id => toggle(id, "flagged")}
        onSave={handleSave}
        editFields={[
          { key: "coreNarrative",           label: "Narrativa Central",          value: str(architecture["coreNarrative"]), multiline: true },
          { key: "emotionalHook",           label: "Gancho Emocional",           value: str(architecture["emotionalHook"]), multiline: true },
          { key: "callToActionStrategy",    label: "Estratégia de CTA",          value: str(architecture["callToActionStrategy"]) },
          { key: "platformDistribution",    label: "Distribuição por Plataforma", value: platformDist, multiline: true },
        ]}
        hidden={!hasData(architecture)}
      >
        <div className="space-y-4">
          {(edited("architecture","coreNarrative", str(architecture["coreNarrative"]))) && (
            <div className="border-l-2 border-violet-400/40 pl-4 py-1">
              <SectionLabel>Narrativa Central</SectionLabel>
              <p className="font-mono text-sm font-bold text-foreground/90 leading-snug">
                {edited("architecture","coreNarrative", str(architecture["coreNarrative"]))}
              </p>
            </div>
          )}
          <LabeledText label="Gancho Emocional" value={edited("architecture","emotionalHook", str(architecture["emotionalHook"]))} />
          <LabeledText label="Estratégia de CTA" value={edited("architecture","callToActionStrategy", str(architecture["callToActionStrategy"]))} />
          {(edited("architecture","platformDistribution", platformDist)) && (
            <div className="border border-white/8 bg-white/[0.02] p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Share2 className="h-3 w-3 text-violet-400/60" />
                <SectionLabel>Distribuição por Plataforma</SectionLabel>
              </div>
              <ProseBlock text={edited("architecture","platformDistribution", platformDist)} />
            </div>
          )}
          <BulletList label="Mensagens-Chave" items={arr(architecture["keyMessages"])} color="green" />
          <BulletList label="Pilares de Conteúdo" items={arr(architecture["contentPillars"])} />
        </div>
      </Module>

      {/* ═══ M07 — ENGENHARIA DE GATILHOS ════════════════════════════════════ */}
      <Module index={7} id="triggers" icon={Flame} title="Engenharia de Gatilhos"
        subtitle="Gatilho dominante, fases da campanha e sequência de ativação emocional"
        status={getStatus("triggers")} accentColor="red"
        onApprove={id => toggle(id, "approved")} onReject={id => toggle(id, "rejected")} onFlag={id => toggle(id, "flagged")}
        onSave={handleSave}
        editFields={[
          { key: "dominantTrigger",      label: "Gatilho Dominante",          value: dominant },
          { key: "dominantJustification",label: "Justificativa do Gatilho",   value: dominantJustif, multiline: true },
          { key: "transformationBridge", label: "Ponte de Transformação",     value: bridge, multiline: true },
        ]}
        hidden={!hasData(triggerMap) && !dominant}
      >
        <div className="space-y-4">
          {dominant && (
            <div className="border border-white/8 bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-2">
                <SectionLabel>Gatilho Dominante</SectionLabel>
                <Pill color="red">{dominant}</Pill>
              </div>
              {dominantJustif && <ProseBlock text={dominantJustif} accent="text-muted-foreground/55" />}
            </div>
          )}

          {/* Phase cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <PhaseCard label="Pré-Lançamento" color="cyan"
              trigger={str(preLaunch["primaryTrigger"])}
              stack={arr(preLaunch["triggerStack"])}
              logic={str(preLaunch["triggerLogic"])} />
            <PhaseCard label="Abertura de Carrinho" color="green"
              trigger={str(cartOpen["primaryTrigger"])}
              stack={arr(cartOpen["triggerStack"])}
              logic={str(cartOpen["triggerLogic"])} />
            <PhaseCard label="Fechamento" color="red"
              trigger={str(cartClose["primaryTrigger"])}
              stack={arr(cartClose["triggerStack"])}
              logic={str(cartClose["triggerLogic"])} />
            <PhaseCard label="Remarketing" color="amber"
              trigger={str(remarketing["primaryTrigger"])}
              stack={arr(remarketing["triggerStack"])}
              logic={str(remarketing["triggerLogic"])} />
          </div>

          <SequenceTimeline items={triggerSeq} />
          <LabeledText label="Ponte de Transformação" value={bridge} />
          <BulletList label="Ângulos Anti-Requisito" items={antiReq} color="amber" />
          {socialProof && <LabeledText label="Blueprint de Prova Social" value={socialProof} />}
        </div>
      </Module>

      {/* ═══ M08 — MÉTRICAS DE PERFORMANCE ══════════════════════════════════ */}
      <Module index={8} id="metrics" icon={BarChart3} title="Métricas de Performance"
        subtitle="KPI principal, metas de receita, taxa de conversão alvo e premissas críticas"
        status={getStatus("metrics")} accentColor="green"
        onApprove={id => toggle(id, "approved")} onReject={id => toggle(id, "rejected")} onFlag={id => toggle(id, "flagged")}
        onSave={handleSave}
        editFields={[
          { key: "primaryKPI",    label: "KPI Principal",       value: str(metrics["primaryKPI"]) },
          { key: "launchWindow",  label: "Janela de Lançamento", value: str(metrics["launchWindow"]) },
        ]}
        hidden={!hasData(metrics)}
      >
        <div className="space-y-4">
          <KpiCards items={[
            { label: "KPI Principal",        value: edited("metrics","primaryKPI", str(metrics["primaryKPI"])) },
            { label: "Meta de Receita",      value: revenueTarget ? `R$ ${revenueTarget.toLocaleString("pt-BR")}` : "", accent: "text-emerald-400 font-bold" },
            { label: "Taxa de Conv. Alvo",   value: conversionRate ? `${(conversionRate * 100).toFixed(1)}%` : "" },
            { label: "Janela de Lançamento", value: edited("metrics","launchWindow", str(metrics["launchWindow"])) },
          ]} />
          <BulletList label="Premissas Críticas" items={arr(metrics["criticalAssumptions"])} color="amber" />
        </div>
      </Module>

      {/* ═══ M09 — ANÁLISE DE RISCOS ═════════════════════════════════════════ */}
      <Module index={9} id="risks" icon={ShieldAlert} title="Análise de Riscos"
        subtitle="Nível de risco identificado, ameaças principais e estratégias de mitigação"
        status={getStatus("risks")} accentColor="red"
        onApprove={id => toggle(id, "approved")} onReject={id => toggle(id, "rejected")} onFlag={id => toggle(id, "flagged")}
        hidden={!hasData(risks)}
      >
        <div className="space-y-4">
          {str(risks["level"]) && (() => {
            const level = str(risks["level"]);
            const cfg = level === "low" ? { label: "Risco Baixo", color: "green" as const }
              : level === "high" ? { label: "Risco Alto", color: "red" as const }
              : { label: "Risco Médio", color: "amber" as const };
            return (
              <div className="flex items-center gap-3">
                <SectionLabel>Nível Geral</SectionLabel>
                <Pill color={cfg.color}>{cfg.label}</Pill>
              </div>
            );
          })()}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <BulletList label="Principais Riscos" items={arr(risks["mainRisks"])} color="red" />
            <BulletList label="Mitigações" items={arr(risks["mitigations"])} color="green" />
          </div>
        </div>
      </Module>

      {/* ═══ M10 — NOTA DO ESTRATEGISTA ══════════════════════════════════════ */}
      <Module index={10} id="notes" icon={MessageSquare} title="Nota do Estrategista"
        subtitle="Observações críticas finais, recomendações e instruções de execução"
        status={getStatus("notes")} accentColor="amber"
        onApprove={id => toggle(id, "approved")} onReject={id => toggle(id, "rejected")} onFlag={id => toggle(id, "flagged")}
        onSave={handleSave}
        editFields={[{ key: "strategistNotes", label: "Nota do Estrategista", value: strategistNotes, multiline: true }]}
        hidden={!strategistNotes}
      >
        <div className="border-l-2 border-amber-500/30 pl-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Calendar className="h-3 w-3 text-amber-400/50" />
            <SectionLabel>Observações do Estrategista</SectionLabel>
          </div>
          <ProseBlock text={edited("notes","strategistNotes", strategistNotes)} accent="text-foreground/75 italic" />
        </div>
      </Module>

      {/* ═══ FOOTER ═══════════════════════════════════════════════════════════ */}
      {(approved > 0 || rejected > 0) && (
        <div className={`border p-4 transition-all ${
          approved === TOTAL ? "border-emerald-500/25 bg-emerald-500/[0.03]"
          : rejected > 0    ? "border-red-500/15 bg-red-500/[0.02]"
          : "border-white/6"
        }`}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              {approved === TOTAL ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 6px #34d399" }} />
                  <span className="font-mono text-[11px] font-bold text-emerald-400 uppercase tracking-widest">
                    Masterplan 100% aprovado
                  </span>
                </>
              ) : (
                <>
                  <Crosshair className="h-3.5 w-3.5 text-muted-foreground/35" />
                  <span className="font-mono text-[11px] text-muted-foreground/50 uppercase tracking-widest">
                    {approved}/{TOTAL} aprovados
                    {rejected > 0 ? ` · ${rejected} rejeitado${rejected > 1 ? "s" : ""}` : ""}
                    {flagged  > 0 ? ` · ${flagged} sinalizado${flagged  > 1 ? "s" : ""}` : ""}
                  </span>
                </>
              )}
            </div>
            <div className="flex gap-0.5">
              {MODULE_IDS.map((id, i) => {
                const s = getStatus(id);
                return (
                  <div key={i}
                    className={`w-4 h-1 transition-all ${
                      s === "approved" ? "bg-emerald-500"
                      : s === "rejected" ? "bg-red-500"
                      : s === "flagged"  ? "bg-amber-500"
                      : "bg-white/8"
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
