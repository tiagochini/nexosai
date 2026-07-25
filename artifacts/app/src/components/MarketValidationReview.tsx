/**
 * MarketValidationReview — exibe o resultado da Avaliação Mercadológica
 * no painel da campanha quando o status é "analyzing" e
 * brainData.marketValidation está preenchido.
 *
 * Estados:
 *  - VIAVEL          → badge verde, colapsado por padrão
 *  - VIAVEL_COM_AJUSTES → badge amarelo, detalhes visíveis
 *  - INVIAVEL        → banner vermelho, pivô sugerido + botão "Continuar assim mesmo"
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  TrendingUp,
  DollarSign,
  ShieldCheck,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type MarketVerdictType = "VIAVEL" | "VIAVEL_COM_AJUSTES" | "INVIAVEL";

interface ValidatorResult {
  validator: "market_validator" | "offer_price_validator" | "brand_validator";
  verdict: MarketVerdictType;
  score: number;
  justification: string;
  criticalIssues: string[];
  adjustmentSuggestions: string[];
  isCriticalBlock: boolean;
}

interface MarketValidationResult {
  overallVerdict: MarketVerdictType;
  validators: ValidatorResult[];
  pivotSuggestions: string[];
  userDecision?: "proceed";
  validatedAt: string;
}

interface Props {
  campaignId: string;
  marketValidation: MarketValidationResult;
  onProceed?: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const VALIDATOR_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  market_validator:      { label: "Mercado & Demanda",     icon: TrendingUp },
  offer_price_validator: { label: "Oferta & Precificação", icon: DollarSign },
  brand_validator:       { label: "Marca & Autoridade",    icon: ShieldCheck },
};

function verdictColor(v: MarketVerdictType) {
  if (v === "VIAVEL")            return "text-emerald-400";
  if (v === "VIAVEL_COM_AJUSTES") return "text-yellow-400";
  return "text-red-400";
}

function verdictBg(v: MarketVerdictType) {
  if (v === "VIAVEL")            return "border-emerald-400/30 bg-emerald-400/5";
  if (v === "VIAVEL_COM_AJUSTES") return "border-yellow-400/30 bg-yellow-400/5";
  return "border-red-400/30 bg-red-400/8";
}

function VerdictIcon({ verdict }: { verdict: MarketVerdictType }) {
  if (verdict === "VIAVEL")            return <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />;
  if (verdict === "VIAVEL_COM_AJUSTES") return <AlertTriangle className="h-4 w-4 text-yellow-400 flex-shrink-0" />;
  return <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />;
}

function verdictLabel(v: MarketVerdictType) {
  if (v === "VIAVEL")            return "Viável";
  if (v === "VIAVEL_COM_AJUSTES") return "Viável com Ajustes";
  return "Inviável";
}

function ScoreBar({ score, verdict }: { score: number; verdict: MarketVerdictType }) {
  const color = verdict === "VIAVEL" ? "bg-emerald-500" : verdict === "VIAVEL_COM_AJUSTES" ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-border/30 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.max(4, score)}%` }} />
      </div>
      <span className="font-mono text-[10px] text-muted-foreground/60 w-8 text-right">{score}</span>
    </div>
  );
}

// ─── Validator Card ─────────────────────────────────────────────────────────────

function ValidatorCard({ result }: { result: ValidatorResult }) {
  const [open, setOpen] = useState(result.verdict !== "VIAVEL");
  const meta = VALIDATOR_LABELS[result.validator] ?? { label: result.validator, icon: CheckCircle2 };
  const Icon = meta.icon;

  return (
    <div className={`border rounded-none p-4 ${verdictBg(result.verdict)}`}>
      <button
        type="button"
        className="w-full flex items-center gap-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon className={`h-4 w-4 ${verdictColor(result.verdict)} flex-shrink-0`} />
        <span className="flex-1 font-mono text-xs uppercase tracking-widest text-foreground/80">
          {meta.label}
        </span>
        <VerdictIcon verdict={result.verdict} />
        <span className={`font-mono text-xs font-bold ${verdictColor(result.verdict)}`}>
          {verdictLabel(result.verdict)}
        </span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-3 pl-7">
          <ScoreBar score={result.score} verdict={result.verdict} />

          <p className="text-sm text-foreground/70 leading-relaxed">{result.justification}</p>

          {result.criticalIssues.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-red-400/70 mb-1.5">
                Problemas críticos
              </p>
              <ul className="space-y-1">
                {result.criticalIssues.map((issue, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-red-300/80">
                    <XCircle className="h-3 w-3 flex-shrink-0 mt-0.5 text-red-400/60" />
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.adjustmentSuggestions.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-yellow-400/70 mb-1.5">
                Sugestões de ajuste
              </p>
              <ul className="space-y-1">
                {result.adjustmentSuggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-yellow-200/70">
                    <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5 text-yellow-400/60" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function MarketValidationReview({ campaignId, marketValidation, onProceed }: Props) {
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(marketValidation.overallVerdict === "VIAVEL");
  const alreadyProceeded = marketValidation.userDecision === "proceed";

  const proceedMutation = useMutation({
    mutationFn: async () => {
      const res = await customFetch(`/api/campaigns/${campaignId}/market-validation/proceed`, {
        method: "POST",
      }) as Response;
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Falha ao retomar pipeline");
      }
    },
    onSuccess: () => {
      toast.success("Pipeline retomado — agentes de estratégia ativados");
      void queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId] });
      onProceed?.();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const verdict = marketValidation.overallVerdict;
  const isInviavel = verdict === "INVIAVEL";
  const isAjustes = verdict === "VIAVEL_COM_AJUSTES";

  return (
    <div className={`border rounded-none mb-4 ${verdictBg(verdict)}`}>
      {/* Header */}
      <button
        type="button"
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2 flex-1">
          <VerdictIcon verdict={verdict} />
          <span className="font-mono text-xs uppercase tracking-widest text-foreground/70">
            Avaliação Mercadológica
          </span>
          <Badge
            variant="outline"
            className={`font-mono text-[10px] uppercase tracking-widest border ${
              isInviavel
                ? "border-red-400/40 text-red-400 bg-red-400/10"
                : isAjustes
                ? "border-yellow-400/40 text-yellow-400 bg-yellow-400/10"
                : "border-emerald-400/40 text-emerald-400 bg-emerald-400/10"
            }`}
          >
            {verdictLabel(verdict)}
          </Badge>
        </div>
        {alreadyProceeded && (
          <span className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest">
            Ignorado pelo usuário
          </span>
        )}
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
        )}
      </button>

      {!collapsed && (
        <div className="px-5 pb-5 space-y-4">
          {/* Validator Cards */}
          <div className="space-y-2">
            {marketValidation.validators.map((v) => (
              <ValidatorCard key={v.validator} result={v} />
            ))}
          </div>

          {/* INVIAVEL: pivot suggestions + proceed button */}
          {isInviavel && !alreadyProceeded && (
            <div className="border border-red-400/20 bg-red-400/5 rounded-none p-4 space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-red-400/70">
                Alternativas sugeridas
              </p>
              <ul className="space-y-2">
                {marketValidation.pivotSuggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/70">
                    <span className="font-mono text-[10px] text-red-400/60 mt-0.5 flex-shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {s}
                  </li>
                ))}
              </ul>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 rounded-none font-mono uppercase tracking-widest text-xs h-10 border-red-400/30 text-red-300 hover:bg-red-400/10"
                  onClick={() => proceedMutation.mutate()}
                  disabled={proceedMutation.isPending}
                >
                  {proceedMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 mr-2" />
                  )}
                  {proceedMutation.isPending ? "Retomando..." : "Continuar assim mesmo — ignorar veredito"}
                </Button>
              </div>

              <p className="text-[11px] text-muted-foreground/40 leading-relaxed">
                Aviso: ao continuar, os créditos de estratégia serão consumidos mesmo com o produto classificado como inviável.
                Esta avaliação é mecânica — considere revisar o briefing antes de prosseguir.
              </p>
            </div>
          )}

          {/* VIAVEL_COM_AJUSTES: informational message only */}
          {isAjustes && !isInviavel && (
            <div className="border border-yellow-400/20 bg-yellow-400/5 rounded-none p-4">
              <p className="text-sm text-yellow-200/70 leading-relaxed">
                O pipeline de estratégia continuará normalmente. Revise as sugestões de ajuste acima —
                os agentes de conteúdo considerarão esses pontos durante a geração.
              </p>
            </div>
          )}

          {/* VIAVEL: confirmation */}
          {verdict === "VIAVEL" && (
            <div className="border border-emerald-400/20 bg-emerald-400/5 rounded-none p-4">
              <p className="text-sm text-emerald-200/70 leading-relaxed flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                Produto aprovado nos 3 validadores — pipeline de estratégia prosseguiu automaticamente.
              </p>
            </div>
          )}

          <p className="font-mono text-[10px] text-muted-foreground/30">
            Validado em {new Date(marketValidation.validatedAt).toLocaleString("pt-BR")}
            {" · "}
            <span className="text-yellow-400/40">Calibração de qualidade: PENDENTE</span>
          </p>
        </div>
      )}
    </div>
  );
}
