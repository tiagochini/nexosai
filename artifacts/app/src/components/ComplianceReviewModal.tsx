import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { getGetCampaignQueryKey } from "@workspace/api-client-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Shield, AlertTriangle, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, FileWarning, ExternalLink,
} from "lucide-react";
import { useUiText } from "@/lib/i18n";

interface ComplianceViolation {
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  location: string;
  originalText: string;
  issue: string;
  correctedText: string;
  legalBasis: string;
}

interface ComplianceReviewData {
  pieceId: string | null;
  score: number;
  riskLevel: string;
  violations: ComplianceViolation[];
  approvedElements: string[];
  requiredDisclosures: string[];
  legalRecommendations: string[];
  complianceNotes: string;
}

interface Props {
  campaignId: string;
  complianceReview: ComplianceReviewData;
  onResolved: () => void;
}

const SEVERITY_CONFIG: Record<string, { label: [string, string, string]; color: string }> = {
  critical: { label: ["Crítico", "Critical", "Crítico"], color: "text-red-400 border-red-400/40 bg-red-400/10" },
  high:     { label: ["Alto", "High", "Alto"], color: "text-orange-400 border-orange-400/40 bg-orange-400/10" },
  medium:   { label: ["Médio", "Medium", "Medio"], color: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10" },
  low:      { label: ["Baixo", "Low", "Bajo"], color: "text-blue-400 border-blue-400/40 bg-blue-400/10" },
};

export function ComplianceReviewModal({ campaignId, complianceReview, onResolved }: Props) {
  const t = useUiText();
  const queryClient = useQueryClient();
  const violations = complianceReview.violations ?? [];
  const [expanded, setExpanded] = useState<number | null>(0);
  const [customTexts, setCustomTexts] = useState<Record<number, string>>({});
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);

  const resolveMutation = useMutation({
    mutationFn: async (payload: {
      decision: "accept_all" | "custom" | "override";
      corrections?: Array<{ violationIndex: number; acceptedText: string }>;
    }) => {
      return customFetch<{ ok: boolean; status: string }>(
        `/api/campaigns/${campaignId}/compliance/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
    },
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
      if (vars.decision === "override") {
        toast.success(t("Publicação autorizada. Decisão registrada no log de auditoria.", "Publication authorized. Decision recorded in the audit log.", "Publicación autorizada. Decisión registrada en el registro de auditoría."), { duration: 5000 });
      } else if (vars.decision === "accept_all") {
        toast.success(t("Sugestões aceitas! Conteúdo pronto para revisão final.", "Suggestions accepted! Content is ready for final review.", "¡Sugerencias aceptadas! El contenido está listo para la revisión final."));
      } else {
        toast.success(t("Correções salvas. Conteúdo pronto para revisão final.", "Corrections saved. Content is ready for final review.", "Correcciones guardadas. El contenido está listo para la revisión final."));
      }
      onResolved();
    },
    onError: () => {
      toast.error(t("Erro ao salvar decisão. Tente novamente.", "Error saving decision. Try again.", "Error al guardar la decisión. Inténtalo de nuevo."));
    },
  });

  const criticalCount = violations.filter(v => v.severity === "critical").length;
  const highCount = violations.filter(v => v.severity === "high").length;

  const handleAcceptAll = () => {
    resolveMutation.mutate({ decision: "accept_all" });
  };

  const handleCustom = () => {
    const corrections = violations
      .map((_, i) => ({
        violationIndex: i,
        acceptedText: customTexts[i] ?? violations[i]?.correctedText ?? "",
      }))
      .filter(c => c.acceptedText.trim() !== "");
    resolveMutation.mutate({ decision: "custom", corrections });
  };

  const handleOverride = () => {
    resolveMutation.mutate({ decision: "override" });
    setShowOverrideConfirm(false);
  };

  const scoreColor =
    complianceReview.score >= 70 ? "text-yellow-400" :
    complianceReview.score >= 50 ? "text-orange-400" : "text-red-400";

  return (
    <div className="fixed inset-0 z-[9000] flex items-start justify-center overflow-y-auto bg-black/80 backdrop-blur-sm p-4 pt-8">
      <div className="w-full max-w-2xl bg-[#0a0a0a] border border-red-500/30 rounded-sm shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-red-500/20 bg-red-500/5">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-5 w-5 text-red-400 shrink-0" />
           <span className="font-mono text-sm text-red-400 uppercase tracking-widest">{t("Revisão de conformidade necessária", "Compliance review required", "Se requiere una revisión de cumplimiento")}</span>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t("O agente de conformidade encontrou violações que precisam da sua decisão antes de prosseguir.", "The compliance agent found violations that require your decision before you continue.", "El agente de cumplimiento encontró infracciones que requieren tu decisión antes de continuar.")}
          </p>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Score:</span>
              <span className={`font-mono font-bold text-lg ${scoreColor}`}>{complianceReview.score}/100</span>
            </div>
            <div className="flex items-center gap-2">
              {criticalCount > 0 && (
                <Badge variant="outline" className="text-red-400 border-red-400/40 bg-red-400/10 font-mono text-[10px]">
                  {t(`${criticalCount} crítica${criticalCount !== 1 ? "s" : ""}`, `${criticalCount} critical`, `${criticalCount} crítica${criticalCount !== 1 ? "s" : ""}`)}
                </Badge>
              )}
              {highCount > 0 && (
                <Badge variant="outline" className="text-orange-400 border-orange-400/40 bg-orange-400/10 font-mono text-[10px]">
                  {t(`${highCount} alta${highCount !== 1 ? "s" : ""}`, `${highCount} high`, `${highCount} alta${highCount !== 1 ? "s" : ""}`)}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Violations list */}
        <div className="divide-y divide-border/20 max-h-[50vh] overflow-y-auto">
          {violations.map((v, i) => {
            const cfg = SEVERITY_CONFIG[v.severity] ?? SEVERITY_CONFIG.low;
            const isOpen = expanded === i;
            return (
              <div key={i} className="p-4">
                <button
                  onClick={() => setExpanded(isOpen ? null : i)}
                  className="w-full flex items-start gap-3 text-left"
                >
                  <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                       <Badge variant="outline" className={`font-mono text-[10px] ${cfg.color}`}>{t(...cfg.label)}</Badge>
                      <span className="text-xs text-muted-foreground font-mono">{v.category}</span>
                    </div>
                    <p className="text-sm text-foreground/80 truncate">{v.location}</p>
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                </button>

                {isOpen && (
                  <div className="mt-3 ml-7 space-y-3">
                    <div className="bg-red-500/5 border border-red-500/20 rounded-sm p-3">
                       <p className="text-[11px] text-muted-foreground mb-1 font-mono uppercase">{t("Texto original", "Original text", "Texto original")}</p>
                      <p className="text-sm text-foreground/70 italic">"{v.originalText}"</p>
                    </div>
                    <div className="bg-muted/10 rounded-sm p-3">
                       <p className="text-[11px] text-muted-foreground mb-1 font-mono uppercase">{t("Problema", "Issue", "Problema")}</p>
                      <p className="text-sm text-foreground/80">{v.issue}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{v.legalBasis}</p>
                    </div>
                    <div className="bg-green-500/5 border border-green-500/20 rounded-sm p-3">
                       <p className="text-[11px] text-muted-foreground mb-1 font-mono uppercase">{t("Sugestão do agente", "Agent suggestion", "Sugerencia del agente")}</p>
                      <p className="text-sm text-green-300 italic">"{v.correctedText}"</p>
                    </div>
                    <div>
                       <p className="text-[11px] text-muted-foreground mb-1 font-mono uppercase">{t("Sua versão (opcional — deixe em branco para aceitar a sugestão)", "Your version (optional — leave blank to accept the suggestion)", "Tu versión (opcional: déjala en blanco para aceptar la sugerencia)")}</p>
                      <Textarea
                        value={customTexts[i] ?? ""}
                        onChange={e => setCustomTexts(prev => ({ ...prev, [i]: e.target.value }))}
                        placeholder={v.correctedText}
                        className="bg-muted/10 border-border/30 text-sm min-h-[70px] resize-none font-sans"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Required disclosures */}
        {complianceReview.requiredDisclosures?.length > 0 && (
          <div className="p-4 border-t border-border/20 bg-muted/5">
            <div className="flex items-center gap-2 mb-2">
              <FileWarning className="h-4 w-4 text-yellow-400" />
               <span className="text-xs font-mono text-yellow-400 uppercase tracking-widest">{t("Avisos obrigatórios", "Required disclaimers", "Avisos obligatorios")}</span>
            </div>
            <ul className="space-y-1">
              {complianceReview.requiredDisclosures.map((d, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-yellow-400 shrink-0">•</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="p-5 border-t border-border/20 space-y-3">
          {!showOverrideConfirm ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={handleAcceptAll}
                  disabled={resolveMutation.isPending}
                  className="bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 rounded-sm h-auto py-3 flex-col gap-1"
                  variant="ghost"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-xs font-mono">{t("Aceitar sugestões", "Accept suggestions", "Aceptar sugerencias")}</span>
                  <span className="text-[10px] text-muted-foreground">{t("Aplicar correções do agente", "Apply the agent's corrections", "Aplicar las correcciones del agente")}</span>
                </Button>
                <Button
                  onClick={handleCustom}
                  disabled={resolveMutation.isPending}
                  className="bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 rounded-sm h-auto py-3 flex-col gap-1"
                  variant="ghost"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="text-xs font-mono">{t("Ajustar e continuar", "Edit and continue", "Ajustar y continuar")}</span>
                  <span className="text-[10px] text-muted-foreground">{t("Salvar minhas edições", "Save my edits", "Guardar mis cambios")}</span>
                </Button>
              </div>
              <Button
                onClick={() => setShowOverrideConfirm(true)}
                disabled={resolveMutation.isPending}
                variant="ghost"
                className="w-full border border-border/20 text-muted-foreground hover:text-foreground hover:border-border/40 rounded-sm text-xs font-mono"
              >
                 {t("Publicar assim mesmo — assumir responsabilidade", "Publish anyway — accept responsibility", "Publicar de todos modos — asumir la responsabilidad")}
              </Button>
            </>
          ) : (
            <div className="bg-red-500/10 border border-red-500/30 rounded-sm p-4 space-y-3">
              <div className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-foreground/80">
                  {t("Ao prosseguir, você confirma que está ciente das violações identificadas e assume a responsabilidade legal e editorial.", "By continuing, you confirm that you understand the identified violations and accept legal and editorial responsibility.", "Al continuar, confirmas que conoces las infracciones identificadas y asumes la responsabilidad legal y editorial.")}{" "}
                  <span className="text-muted-foreground">{t("Essa decisão ficará registrada no log de auditoria da campanha.", "This decision will be recorded in the campaign audit log.", "Esta decisión quedará registrada en el historial de auditoría de la campaña.")}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleOverride}
                  disabled={resolveMutation.isPending}
                  variant="destructive"
                  className="flex-1 rounded-sm font-mono text-xs"
                >
                  {resolveMutation.isPending ? t("Processando...", "Processing...", "Procesando...") : t("Confirmar — publicar assim mesmo", "Confirm — publish anyway", "Confirmar — publicar de todos modos")}
                </Button>
                <Button
                  onClick={() => setShowOverrideConfirm(false)}
                  variant="ghost"
                  className="border border-border/20 rounded-sm font-mono text-xs"
                >
                   {t("Cancelar", "Cancel", "Cancelar")}
                </Button>
              </div>
            </div>
          )}
          {resolveMutation.isPending && (
             <p className="text-center text-xs text-muted-foreground animate-pulse font-mono">{t("Salvando decisão e avançando pipeline...", "Saving decision and moving the workflow forward...", "Guardando la decisión y avanzando el flujo...")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
