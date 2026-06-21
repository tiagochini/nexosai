/**
 * CampaignNorthStar — O "Cabo Guia" da campanha.
 *
 * Painel colapsável que fica SEMPRE visível no topo da tela de detalhe.
 * Mostra o objetivo, persona e Grande Domino — a tríade que não muda.
 * O usuário pode colapsar/expandir a qualquer momento.
 */

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Target, ChevronDown, ChevronUp, Users, Zap, TrendingUp } from "lucide-react";

interface Props {
  campaignId: string;
  title: string;
  track?: string | null;
  status: string;
  intakeData: Record<string, unknown>;
  strategyData: Record<string, unknown>;
}

const TRACK_LABELS: Record<string, { label: string; color: string }> = {
  "6-digit":  { label: "6 Dígitos",  color: "border-cyan-400/40 text-cyan-400 bg-cyan-400/8" },
  "8-digit":  { label: "8 Dígitos",  color: "border-purple-400/40 text-purple-400 bg-purple-400/8" },
  "10-digit": { label: "10 Dígitos", color: "border-yellow-400/40 text-yellow-400 bg-yellow-400/8" },
};

const STORAGE_KEY = "nexos_northstar_expanded";

function getStoredExpanded(id: string): boolean {
  try { return localStorage.getItem(`${STORAGE_KEY}_${id}`) !== "0"; } catch { return true; }
}
function storeExpanded(id: string, v: boolean) {
  try { localStorage.setItem(`${STORAGE_KEY}_${id}`, v ? "1" : "0"); } catch {}
}

function formatRevenue(v: unknown): string | null {
  if (!v) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.]/g, ""));
  if (!n || isNaN(n)) return typeof v === "string" ? v : null;
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}k`;
  return `R$ ${n.toFixed(0)}`;
}

export function CampaignNorthStar({ campaignId, title, track, intakeData, strategyData }: Props) {
  const [expanded, setExpanded] = useState(() => getStoredExpanded(campaignId));

  useEffect(() => { storeExpanded(campaignId, expanded); }, [campaignId, expanded]);

  const persona = (intakeData["audience.primaryPersona"] as string | undefined)
    ?? (intakeData["targetAudience"] as string | undefined)
    ?? (intakeData["audience"] as string | undefined)
    ?? null;

  const product = (intakeData["product.name"] as string | undefined)
    ?? (intakeData["productName"] as string | undefined)
    ?? null;

  const revenueGoal = formatRevenue(
    intakeData["campaign.revenueTarget"]
    ?? intakeData["revenueGoal"]
    ?? intakeData["revenueTarget"]
    ?? strategyData["revenueTarget"]
  );

  const bigDomino = (strategyData["bigDomino"] as string | undefined)
    ?? (strategyData["dominoBelief"] as string | undefined)
    ?? null;

  const execSummary = (strategyData["executiveSummary"] as string | undefined) ?? null;

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
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-0.5">Objetivo</div>
              <div className="font-mono text-xs text-foreground/80 font-bold">
                {revenueGoal ?? "—"}
              </div>
              {product && (
                <div className="font-mono text-[10px] text-muted-foreground/50 mt-0.5 truncate">{product}</div>
              )}
            </div>
          </div>

          {/* Persona */}
          <div className="px-4 py-3 flex gap-3">
            <Users className="h-3.5 w-3.5 text-cyan-400/50 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-0.5">Para quem</div>
              <div className="font-mono text-xs text-foreground/80 leading-relaxed line-clamp-2">
                {persona ?? "—"}
              </div>
            </div>
          </div>

          {/* Grande Domino */}
          <div className="px-4 py-3 flex gap-3">
            <Zap className="h-3.5 w-3.5 text-yellow-400/50 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 mb-0.5">Grande Domino</div>
              <div className="font-mono text-xs text-foreground/80 leading-relaxed line-clamp-3">
                {bigDomino ?? execSummary?.substring(0, 120) ?? "—"}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CampaignNorthStar;
