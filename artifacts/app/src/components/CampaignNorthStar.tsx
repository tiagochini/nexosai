/**
 * CampaignNorthStar — O "Cabo Guia" da campanha.
 *
 * Painel colapsável que fica SEMPRE visível no topo da tela de detalhe.
 * Mostra o objetivo, persona e Grande Domino — a tríade que não muda.
 * Cada campo é expansível ao clicar.
 */

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Users, Zap, TrendingUp } from "lucide-react";

interface Props {
  campaignId: string;
  title: string;
  track?: string | null;
  status: string;
  intakeData: Record<string, unknown>;
  strategyData: Record<string, unknown>;
}

const TRACK_LABELS: Record<string, { label: string; color: string }> = {
  "6-digit":    { label: "6 Dígitos",  color: "border-cyan-400/40 text-cyan-400 bg-cyan-400/8"     },
  "8-digit":    { label: "8 Dígitos",  color: "border-purple-400/40 text-purple-400 bg-purple-400/8" },
  "10-digit":   { label: "10 Dígitos", color: "border-yellow-400/40 text-yellow-400 bg-yellow-400/8" },
  six_digits:   { label: "6 Dígitos",  color: "border-cyan-400/40 text-cyan-400 bg-cyan-400/8"     },
  eight_digits: { label: "8 Dígitos",  color: "border-purple-400/40 text-purple-400 bg-purple-400/8" },
  ten_digits:   { label: "10 Dígitos", color: "border-yellow-400/40 text-yellow-400 bg-yellow-400/8" },
};

const STORAGE_KEY = "nexos_northstar_expanded";

function getStoredExpanded(id: string): boolean {
  try { return localStorage.getItem(`${STORAGE_KEY}_${id}`) !== "0"; } catch { return true; }
}
function storeExpanded(id: string, v: boolean) {
  try { localStorage.setItem(`${STORAGE_KEY}_${id}`, v ? "1" : "0"); } catch {}
}

/** Strip markdown code fences, parse JSON objects, return clean human text. */
function sanitizeAiText(raw: unknown): string | null {
  if (!raw) return null;
  let text = typeof raw === "string" ? raw : JSON.stringify(raw);
  // Remove markdown code fences (```json ... ``` or ``` ... ```)
  text = text.replace(/^```[\w]*\s*/gm, "").replace(/^```\s*$/gm, "").trim();
  // If still looks like a JSON object/array, try to extract a human string
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      // Priority extraction order
      const ORDER = ["executiveSummary","bigDomino","dominoBelief","summary","description","text","content","value","name"];
      for (const key of ORDER) {
        if (typeof parsed[key] === "string" && (parsed[key] as string).trim().length > 5) {
          return sanitizeAiText(parsed[key]);
        }
      }
      // Fallback: first non-empty string value
      const first = Object.values(parsed).find(v => typeof v === "string" && (v as string).trim().length > 5) as string | undefined;
      if (first) return sanitizeAiText(first);
    } catch {}
  }
  return text.length > 0 ? text : null;
}

function formatRevenue(v: unknown): string | null {
  if (!v) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.]/g, ""));
  if (!n || isNaN(n)) return typeof v === "string" ? v : null;
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `R$ ${(n / 1_000).toFixed(0)}k`;
  return `R$ ${n.toFixed(0)}`;
}

/** Expandable text cell — truncated by default, click to reveal all */
function ExpandableText({ text, clampLines = 2 }: { text: string; clampLines?: number }) {
  const [open, setOpen] = useState(false);
  const clampClass = clampLines === 2 ? "line-clamp-2" : clampLines === 3 ? "line-clamp-3" : "line-clamp-4";
  return (
    <button
      type="button"
      onClick={() => setOpen(o => !o)}
      className="w-full text-left group/text"
      title={open ? "Clique para recolher" : "Clique para ver tudo"}
    >
      <div className={`font-mono text-xs text-foreground/80 leading-relaxed transition-all ${open ? "" : clampClass}`}>
        {text}
      </div>
      <div className={`mt-0.5 font-mono text-[9px] uppercase tracking-widest transition-colors ${
        open ? "text-primary/40 group-hover/text:text-primary/60" : "text-muted-foreground/25 group-hover/text:text-primary/40"
      }`}>
        {open ? "▲ recolher" : "▼ ver mais"}
      </div>
    </button>
  );
}

export function CampaignNorthStar({ campaignId, title, track, intakeData, strategyData }: Props) {
  const [expanded, setExpanded] = useState(() => getStoredExpanded(campaignId));

  useEffect(() => { storeExpanded(campaignId, expanded); }, [campaignId, expanded]);

  // ── Persona / Para Quem ────────────────────────────────────────────────────
  // Intake stores audience with dot-notation keys (audience.description is primary)
  const persona = sanitizeAiText(
    intakeData["audience.description"]
    ?? intakeData["audience.primaryPersona"]
    ?? intakeData["targetAudience"]
    ?? intakeData["audience"]
    ?? intakeData["idealCustomer"]
    ?? intakeData["persona"]
    ?? intakeData["para_quem"]
  );

  // ── Produto / Objetivo ─────────────────────────────────────────────────────
  const product = sanitizeAiText(
    intakeData["product.name"]
    ?? intakeData["productName"]
    ?? intakeData["product"]
  );

  const revenueGoal = formatRevenue(
    intakeData["campaign.revenueTarget"]
    ?? intakeData["revenueGoal"]
    ?? intakeData["revenueTarget"]
    ?? strategyData["revenueTarget"]
  );

  // ── Grande Domino ──────────────────────────────────────────────────────────
  const bigDomino = sanitizeAiText(
    strategyData["bigDomino"]
    ?? strategyData["dominoBelief"]
    ?? strategyData["crença_dominó"]
    ?? strategyData["grande_domino"]
  );

  const execSummary = sanitizeAiText(strategyData["executiveSummary"] ?? strategyData["summary"]);

  const dominoDisplay = bigDomino ?? (execSummary ? execSummary.substring(0, 300) : null);

  // ── Track ──────────────────────────────────────────────────────────────────
  const trackInfo = track ? (TRACK_LABELS[track] ?? null) : null;

  const hasContent = persona || revenueGoal || bigDomino || execSummary;
  if (!hasContent) return null;

  return (
    <div className="border border-primary/25 bg-card/30 overflow-hidden mb-5">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-primary/5 transition-colors group"
      >
        <div
          className="w-2 h-2 rounded-full bg-primary shrink-0"
          style={{ boxShadow: "0 0 6px hsl(var(--primary))" }}
        />
        <div className="flex-1 flex items-center gap-2 min-w-0 text-left">
          <span className="font-mono text-[11px] uppercase tracking-widest text-primary/70 font-bold shrink-0">
            Norte · {title}
          </span>
          {trackInfo && (
            <Badge
              variant="outline"
              className={`rounded-none font-mono text-[10px] px-1.5 py-0 shrink-0 ${trackInfo.color}`}
            >
              {trackInfo.label}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {revenueGoal && !expanded && (
            <span className="font-mono text-[11px] text-primary/60 font-bold hidden sm:inline">
              {revenueGoal}
            </span>
          )}
          {expanded
            ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-primary/15 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-primary/10">

          {/* Objetivo */}
          <div className="px-4 py-3 flex gap-3">
            <TrendingUp className="h-3.5 w-3.5 text-primary/50 shrink-0 mt-0.5" />
            <div className="min-w-0 w-full">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-0.5">Objetivo</div>
              <div className="font-mono text-xs text-foreground/80 font-bold">
                {revenueGoal ?? "—"}
              </div>
              {product && (
                <div className="font-mono text-[10px] text-muted-foreground/50 mt-0.5 leading-relaxed">
                  <ExpandableText text={product} clampLines={2} />
                </div>
              )}
            </div>
          </div>

          {/* Para Quem */}
          <div className="px-4 py-3 flex gap-3">
            <Users className="h-3.5 w-3.5 text-cyan-400/50 shrink-0 mt-0.5" />
            <div className="min-w-0 w-full">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-0.5">Para quem</div>
              {persona
                ? <ExpandableText text={persona} clampLines={3} />
                : <span className="font-mono text-xs text-muted-foreground/30 italic">Complete o briefing para preencher</span>
              }
            </div>
          </div>

          {/* Grande Domino */}
          <div className="px-4 py-3 flex gap-3">
            <Zap className="h-3.5 w-3.5 text-yellow-400/50 shrink-0 mt-0.5" />
            <div className="min-w-0 w-full">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-0.5">Grande Domino</div>
              {dominoDisplay
                ? <ExpandableText text={dominoDisplay} clampLines={3} />
                : <span className="font-mono text-xs text-muted-foreground/30 italic">Gerado após análise de estratégia</span>
              }
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

export default CampaignNorthStar;
