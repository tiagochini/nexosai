/**
 * MarketValidationReview — Avaliação Mercadológica & Compliance
 *
 * Três casos distintos:
 *
 * 1. INVIAVEL + isCriticalBlock  → Bloqueio definitivo por conteúdo ilegal.
 *    Sem botão de override — mensagem clara de não-conformidade de plataforma.
 *
 * 2. VIAVEL_COM_AJUSTES + requiresAcknowledgment  → Produto regulado.
 *    Mostra alertas legais específicos + botão "Confirmo ciência".
 *    Self-proof registrado via POST /market-validation/acknowledge.
 *    Pipeline segue após clique.
 *
 * 3. VIAVEL / VIAVEL_COM_AJUSTES sem ack  → Alertas mercadológicos informativos.
 *    Pipeline já rodando. Nenhum botão necessário.
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
  ShieldAlert,
  Scale,
  FileWarning,
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
  requiresAcknowledgment?: boolean;
  regulatoryAlerts?: string[];
}

interface MarketValidationResult {
  overallVerdict: MarketVerdictType;
  validators: ValidatorResult[];
  pivotSuggestions: string[];
  acknowledgmentRecordedAt?: string;
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
  if (v === "VIAVEL")             return "text-emerald-400";
  if (v === "VIAVEL_COM_AJUSTES") return "text-yellow-400";
  return "text-red-400";
}

function verdictBg(v: MarketVerdictType) {
  if (v === "VIAVEL")             return "border-emerald-400/30 bg-emerald-400/5";
  if (v === "VIAVEL_COM_AJUSTES") return "border-yellow-400/30 bg-yellow-400/5";
  return "border-red-400/30 bg-red-400/8";
}

function VerdictIcon({ verdict }: { verdict: MarketVerdictType }) {
  if (verdict === "VIAVEL")             return <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />;
  if (verdict === "VIAVEL_COM_AJUSTES") return <AlertTriangle className="h-4 w-4 text-yellow-400 flex-shrink-0" />;
  return <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />;
}

function verdictLabel(v: MarketVerdictType) {
  if (v === "VIAVEL")             return "Viável";
  if (v === "VIAVEL_COM_AJUSTES") return "Viável com Ajustes";
  return "Não Permitido";
}

function ScoreBar({ score, verdict }: { score: number; verdict: MarketVerdictType }) {
  const color =
    verdict === "VIAVEL" ? "bg-emerald-500" :
    verdict === "VIAVEL_COM_AJUSTES" ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-border/30 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.max(4, score)}%` }} />
      </div>
      <span className="font-mono text-[10px] text-muted-foreground/60 w-8 text-right">{score}</span>
    </div>
  );
}

// ─── Regulatory Alert Block ────────────────────────────────────────────────────
// Exibido dentro de ValidatorCard quando requiresAcknowledgment=true.

function RegulatoryAlertBlock({ alerts }: { alerts: string[] }) {
  if (!alerts.length) return null;
  return (
    <div className="border border-orange-400/30 bg-orange-400/5 rounded-none p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Scale className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
        <p className="font-mono text-[10px] uppercase tracking-widest text-orange-400/80">
          Exigências legais / regulatórias
        </p>
      </div>
      <ul className="space-y-1.5">
        {alerts.map((alert, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-orange-200/80 leading-relaxed">
            <FileWarning className="h-3 w-3 flex-shrink-0 mt-0.5 text-orange-400/60" />
            {alert}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Validator Card ─────────────────────────────────────────────────────────────

function ValidatorCard({ result }: { result: ValidatorResult }) {
  const [open, setOpen] = useState(result.verdict !== "VIAVEL" || !!result.requiresAcknowledgment);
  const meta = VALIDATOR_LABELS[result.validator] ?? { label: result.validator, icon: CheckCircle2 };
  const Icon = result.requiresAcknowledgment ? ShieldAlert : meta.icon;
  const borderColor = result.requiresAcknowledgment
    ? "border-orange-400/30 bg-orange-400/5"
    : verdictBg(result.verdict);

  return (
    <div className={`border rounded-none p-4 ${borderColor}`}>
      <button
        type="button"
        className="w-full flex items-center gap-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon className={`h-4 w-4 ${result.requiresAcknowledgment ? "text-orange-400" : verdictColor(result.verdict)} flex-shrink-0`} />
        <span className="flex-1 font-mono text-xs uppercase tracking-widest text-foreground/80">
          {meta.label}
        </span>
        {result.requiresAcknowledgment ? (
          <span className="font-mono text-[10px] font-bold text-orange-400 uppercase tracking-widest">
            Aviso Regulatório
          </span>
        ) : (
          <>
            <VerdictIcon verdict={result.verdict} />
            <span className={`font-mono text-xs font-bold ${verdictColor(result.verdict)}`}>
              {verdictLabel(result.verdict)}
            </span>
          </>
        )}
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

          {/* Regulatory alerts — o mais importante, aparece primeiro */}
          {result.requiresAcknowledgment && (result.regulatoryAlerts?.length ?? 0) > 0 && (
            <RegulatoryAlertBlock alerts={result.regulatoryAlerts!} />
          )}

          {result.criticalIssues.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-yellow-400/70 mb-1.5">
                Pontos de atenção
              </p>
              <ul className="space-y-1">
                {result.criticalIssues.map((issue, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-yellow-200/70">
                    <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5 text-yellow-400/60" />
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.adjustmentSuggestions.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1.5">
                Sugestões
              </p>
              <ul className="space-y-1">
                {result.adjustmentSuggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground/50">
                    <ChevronDown className="h-3 w-3 flex-shrink-0 mt-0.5 rotate-[-90deg] text-muted-foreground/40" />
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

// ─── Compliance Block Panel (conteúdo ilegal — sem override) ───────────────────

function ComplianceBlockPanel() {
  return (
    <div className="border border-red-500/40 bg-red-500/5 rounded-none p-5 space-y-3">
      <div className="flex items-start gap-3">
        <XCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-mono text-xs font-bold text-red-400 uppercase tracking-widest">
            Produto não permitido na plataforma
          </p>
          <p className="text-sm text-red-200/70 leading-relaxed">
            Este produto ou serviço não está em conformidade com as regras de uso da NexOS AI
            e não pode ser lançado. Para criar um produto diferente, inicie uma nova campanha.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Acknowledgment Panel (produto regulado — self-proof) ─────────────────────

function AcknowledgmentPanel({
  campaignId,
  alreadyAcknowledged,
  acknowledgedAt,
  regulatoryAlerts,
  onProceed,
}: {
  campaignId: string;
  alreadyAcknowledged: boolean;
  acknowledgedAt?: string;
  regulatoryAlerts?: string[];
  onProceed?: () => void;
}) {
  const queryClient = useQueryClient();

  const ackMutation = useMutation({
    mutationFn: async () => {
      const res = await customFetch(`/api/campaigns/${campaignId}/market-validation/acknowledge`, {
        method: "POST",
      }) as Response;
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Falha ao registrar ciência");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Ciência registrada — pipeline de estratégia iniciado");
      void queryClient.invalidateQueries({ queryKey: ["campaigns", campaignId] });
      onProceed?.();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (alreadyAcknowledged) {
    return (
      <div className="border border-orange-400/20 bg-orange-400/5 rounded-none p-4 space-y-3">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-orange-400/80 font-bold">
              Ciência regulatória confirmada
            </p>
            <p className="text-xs text-orange-200/70">
              Registrado em{" "}
              <span className="font-mono text-orange-300/80">
                {acknowledgedAt ? new Date(acknowledgedAt).toLocaleString("pt-BR") : "—"}
              </span>
              {" "}— self-proof imutável gravado no sistema.
            </p>
          </div>
        </div>

        {/* Lista dos alertas que foram confirmados — registro permanente */}
        {regulatoryAlerts && regulatoryAlerts.length > 0 && (
          <div className="pl-7 space-y-1.5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-orange-400/50">
              Alertas confirmados pelo founder:
            </p>
            <ul className="space-y-1">
              {regulatoryAlerts.map((alert, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-orange-200/60 leading-relaxed">
                  <FileWarning className="h-3 w-3 flex-shrink-0 mt-0.5 text-orange-400/40" />
                  {alert}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border border-orange-400/30 bg-orange-400/5 rounded-none p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Scale className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <p className="font-mono text-xs font-bold text-orange-400 uppercase tracking-widest">
            Confirmação de ciência obrigatória
          </p>
          <p className="text-sm text-foreground/70 leading-relaxed">
            Este produto opera em um nicho com <strong className="text-foreground/90">exigências legais específicas</strong>.
            A NexOS AI informa as obrigações regulatórias — a responsabilidade pelo cumprimento
            é integralmente do empreendedor.
          </p>
        </div>
      </div>

      <Button
        className="w-full rounded-none font-mono uppercase tracking-widest text-xs h-11 bg-orange-500/20 border border-orange-400/40 text-orange-200 hover:bg-orange-500/30"
        variant="outline"
        onClick={() => ackMutation.mutate()}
        disabled={ackMutation.isPending}
      >
        {ackMutation.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
        )}
        {ackMutation.isPending
          ? "Registrando..."
          : "Confirmo ciência e assumo responsabilidade legal — prosseguir"}
      </Button>

      <p className="text-[11px] text-muted-foreground/40 leading-relaxed">
        Ao clicar, você declara ter lido os alertas regulatórios acima e assume total
        responsabilidade pelo cumprimento das exigências legais aplicáveis. Este registro
        é gravado com data, hora e identificador do usuário.
      </p>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function MarketValidationReview({ campaignId, marketValidation, onProceed }: Props) {
  const [collapsed, setCollapsed] = useState(
    marketValidation.overallVerdict === "VIAVEL" &&
    !marketValidation.validators.some((v) => v.requiresAcknowledgment),
  );

  const verdict = marketValidation.overallVerdict;
  const isIllegal = verdict === "INVIAVEL";
  const isAjustes = verdict === "VIAVEL_COM_AJUSTES";
  const needsAck = marketValidation.validators.some((v) => v.requiresAcknowledgment);
  const alreadyAcknowledged = !!(
    marketValidation.acknowledgmentRecordedAt || marketValidation.userDecision === "proceed"
  );

  // Label do header
  const headerLabel = isIllegal
    ? "Não Permitido"
    : needsAck && !alreadyAcknowledged
    ? "Aviso Regulatório — Aguardando Ciência"
    : needsAck && alreadyAcknowledged
    ? "Regulatório — Ciência Confirmada"
    : isAjustes
    ? "Viável com Ajustes"
    : "Viável";

  const headerBadgeClass = isIllegal
    ? "border-red-400/40 text-red-400 bg-red-400/10"
    : needsAck && !alreadyAcknowledged
    ? "border-orange-400/40 text-orange-400 bg-orange-400/10"
    : needsAck && alreadyAcknowledged
    ? "border-orange-400/30 text-orange-300/70 bg-orange-400/5"
    : isAjustes
    ? "border-yellow-400/40 text-yellow-400 bg-yellow-400/10"
    : "border-emerald-400/40 text-emerald-400 bg-emerald-400/10";

  const panelBorder = isIllegal
    ? "border-red-400/30 bg-red-400/5"
    : needsAck && !alreadyAcknowledged
    ? "border-orange-400/30 bg-orange-400/5"
    : isAjustes
    ? "border-yellow-400/30 bg-yellow-400/5"
    : "border-emerald-400/30 bg-emerald-400/5";

  return (
    <div className={`border rounded-none mb-4 ${panelBorder}`}>
      {/* Header */}
      <button
        type="button"
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2 flex-1">
          {isIllegal ? (
            <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
          ) : needsAck && !alreadyAcknowledged ? (
            <ShieldAlert className="h-4 w-4 text-orange-400 flex-shrink-0" />
          ) : (
            <VerdictIcon verdict={verdict} />
          )}
          <span className="font-mono text-xs uppercase tracking-widest text-foreground/70">
            Avaliação Mercadológica
          </span>
          <Badge
            variant="outline"
            className={`font-mono text-[10px] uppercase tracking-widest border ${headerBadgeClass}`}
          >
            {headerLabel}
          </Badge>
        </div>
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

          {/* Caso 1: Conteúdo ilegal — bloqueio definitivo */}
          {isIllegal && <ComplianceBlockPanel />}

          {/* Caso 2: Produto regulado — self-proof */}
          {!isIllegal && needsAck && (
            <AcknowledgmentPanel
              campaignId={campaignId}
              alreadyAcknowledged={alreadyAcknowledged}
              acknowledgedAt={marketValidation.acknowledgmentRecordedAt}
              regulatoryAlerts={marketValidation.validators
                .filter((v) => v.requiresAcknowledgment)
                .flatMap((v) => v.regulatoryAlerts ?? [])}
              onProceed={onProceed}
            />
          )}

          {/* Caso 3: Alertas mercadológicos — pipeline já rodando, só informativo */}
          {!isIllegal && !needsAck && isAjustes && (
            <div className="border border-yellow-400/20 bg-yellow-400/5 rounded-none p-4">
              <p className="text-sm text-yellow-200/70 leading-relaxed">
                Alertas mercadológicos registrados. O pipeline de estratégia continuará normalmente —
                os agentes considerarão esses pontos durante a geração.
              </p>
            </div>
          )}

          {/* Caso 4: Tudo viável */}
          {verdict === "VIAVEL" && !needsAck && (
            <div className="border border-emerald-400/20 bg-emerald-400/5 rounded-none p-4">
              <p className="text-sm text-emerald-200/70 leading-relaxed flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                Produto aprovado nos 3 validadores — pipeline prosseguiu automaticamente.
              </p>
            </div>
          )}

          <p className="font-mono text-[10px] text-muted-foreground/30">
            Validado em {new Date(marketValidation.validatedAt).toLocaleString("pt-BR")}
          </p>
        </div>
      )}
    </div>
  );
}
