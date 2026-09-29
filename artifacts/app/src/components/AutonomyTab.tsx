import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetAutonomyStatus, getGetAutonomyStatusQueryKey,
  useListAutonomyEvidence, getListAutonomyEvidenceQueryKey,
  useRevokeAutonomyAcceptance, useListMandatoryPauses, getListMandatoryPausesQueryKey,
  useResolveMandatoryPause
} from "@workspace/api-client-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldCheck, Activity, KeyRound, Clock, Loader2, XCircle, FileSignature, OctagonAlert
} from "lucide-react";
import { intlLocale, useUiLocale, useUiText } from "@/lib/i18n";

function SectionCard({ children, title, icon: Icon }: { children: React.ReactNode; title: string; icon: React.ElementType }) {
  return (
    <div className="border border-border/50 bg-card/40 backdrop-blur-sm relative overflow-hidden card-weapon">
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-primary/40 pointer-events-none" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-primary/40 pointer-events-none" />
      <div className="px-6 py-4 border-b border-border/40 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{title}</span>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function FieldRow({ label, sublabel, children }: { label: string; sublabel?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-8 py-4 border-b border-border/30 last:border-0">
      <div className="md:w-48 shrink-0">
        <div className="font-mono text-xs text-foreground/90 font-semibold">{label}</div>
        {sublabel && <div className="font-mono text-xs text-muted-foreground/60 mt-0.5">{sublabel}</div>}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export function AutonomyTab() {
  const t = useUiText();
  const { locale } = useUiLocale();
  const queryClient = useQueryClient();
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [resolvingPauseId, setResolvingPauseId] = useState<string | null>(null);
  const [pauseResolutionReason, setPauseResolutionReason] = useState("");

  const { data: statusData, isLoading: isLoadingStatus } = useGetAutonomyStatus(undefined, { query: { queryKey: getGetAutonomyStatusQueryKey(), refetchOnMount: "always", refetchOnWindowFocus: true, refetchInterval: 30_000 } });
  const { data: evidenceData, isLoading: isLoadingEvidence } = useListAutonomyEvidence(undefined, { query: { queryKey: getListAutonomyEvidenceQueryKey(), refetchOnMount: "always", refetchOnWindowFocus: true, refetchInterval: 30_000 } });
  const { data: pauseData, isLoading: isLoadingPauses } = useListMandatoryPauses(undefined, { query: { queryKey: getListMandatoryPausesQueryKey(), refetchOnMount: "always", refetchOnWindowFocus: true, refetchInterval: 30_000 } });

  const revokeMutation = useRevokeAutonomyAcceptance();
  const resolvePauseMutation = useResolveMandatoryPause();

  const handleRevoke = (acceptanceId: string) => {
    if (!revokeReason.trim()) {
      toast.error(t("Informe o motivo da revogação.", "Enter a reason for revocation.", "Indica el motivo de la revocación."));
      return;
    }
    
    revokeMutation.mutate(
      { acceptanceId, data: { reason: revokeReason } },
      {
        onSuccess: () => {
          toast.success(t("Autorização revogada com sucesso.", "Authorization revoked successfully.", "Autorización revocada correctamente."));
          queryClient.invalidateQueries({ queryKey: getGetAutonomyStatusQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListAutonomyEvidenceQueryKey() });
          setRevokingId(null);
          setRevokeReason("");
        },
        onError: () => {
          toast.error(t("Erro ao revogar autorização.", "Failed to revoke authorization.", "No se pudo revocar la autorización."));
        }
      }
    );
  };

  const handleResolvePause = (pauseId: string) => {
    if (!pauseResolutionReason.trim()) { toast.error(t("Informe o motivo da resolução.", "Enter a reason for resolution.", "Indica el motivo de la resolución.")); return; }
    resolvePauseMutation.mutate({ pauseId, data: { reason: pauseResolutionReason } }, {
      onSuccess: () => {
         toast.success(t("Pausa obrigatória resolvida. A campanha não será retomada automaticamente.", "Mandatory pause resolved. The campaign will not resume automatically.", "Pausa obligatoria resuelta. La campaña no se reanudará automáticamente."));
        queryClient.invalidateQueries({ queryKey: getListMandatoryPausesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAutonomyStatusQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAutonomyEvidenceQueryKey() });
        setResolvingPauseId(null); setPauseResolutionReason("");
      },
      onError: () => toast.error(t("Não foi possível resolver a pausa.", "Could not resolve the pause.", "No se pudo resolver la pausa.")),
    });
  };

  if (isLoadingStatus || isLoadingEvidence || isLoadingPauses) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full rounded-none" />
        <Skeleton className="h-64 w-full rounded-none" />
      </div>
    );
  }

  const { contract, requiredAcceptanceTypes = [], acceptedAcceptanceTypes = [], missingAcceptanceTypes = [] } = statusData || {};
  const acceptances = evidenceData?.acceptances || [];
  const pauses = pauseData?.pauses || [];

  return (
    <div className="space-y-6">
      <div className="p-4 border border-primary/20 bg-primary/5 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <h3 className="font-mono text-sm uppercase tracking-widest font-bold text-primary">{t("Autonomia NexOS AI", "NexOS AI Autonomy", "Autonomía de NexOS AI")}</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {t("Aqui você gerencia os limites de atuação dos agentes. O NexOS permite que a IA tome decisões estratégicas, publique conteúdo e aloque orçamento de mídia.", "Manage the agents' operating limits here. NexOS lets AI make strategic decisions, publish content, and allocate media budgets.", "Aquí puedes gestionar los límites de actuación de los agentes. NexOS permite que la IA tome decisiones estratégicas, publique contenido y asigne presupuestos de medios.")}
             <strong> {t("A revogação impede novos lançamentos que dependam desses aceites; operações já iniciadas preservam seu histórico e seguem os controles do Masterplan.", "Revocation prevents new launches that depend on these approvals; operations already started retain their history and follow the Masterplan controls.", "La revocación impide nuevos lanzamientos que dependan de estas aceptaciones; las operaciones ya iniciadas conservan su historial y siguen los controles del Masterplan.")}</strong>
          </p>
        </div>
      </div>

      <SectionCard title={t("Contrato Vigente", "Current Agreement", "Contrato vigente")} icon={FileSignature}>
        <FieldRow label={t("Versão e Integridade", "Version and Integrity", "Versión e integridad")} sublabel={t("Hash criptográfico do contrato", "Cryptographic hash of the agreement", "Hash criptográfico del contrato")}>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-none font-mono text-[10px] bg-muted/20 border-border/50">
                v{contract?.version || "0.0.0"}
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">{t("Última atualização do sistema", "Last system update", "Última actualización del sistema")}</span>
            </div>
            <div className="flex items-center gap-2 p-2 bg-muted/10 border border-border/30">
              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
              <code className="font-mono text-[10px] text-muted-foreground break-all">{contract?.hash || "---"}</code>
            </div>
          </div>
        </FieldRow>

        <FieldRow label={t("Status de Aceite Global", "Global Approval Status", "Estado de aceptación global")} sublabel={t("Requisitos para operação", "Requirements to operate", "Requisitos de operación")}>
          <div className="space-y-3">
            {requiredAcceptanceTypes.length === 0 && (
              <p className="font-mono text-xs text-muted-foreground">{t("Nenhum requisito aplicável no momento.", "No applicable requirements at this time.", "No hay requisitos aplicables en este momento.")}</p>
            )}
            {requiredAcceptanceTypes.map((type) => {
              const isAccepted = acceptedAcceptanceTypes.includes(type);
              return (
                <div key={type} className={`flex items-center justify-between p-3 border ${isAccepted ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'}`}>
                  <div>
                    <div className="font-mono text-xs font-bold uppercase">{acceptanceTypeLabel(type, t)}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {isAccepted ? t("Autorização ativa.", "Authorization active.", "Autorización activa.") : t("Autorização pendente. O lançamento será bloqueado.", "Authorization pending. Launch will be blocked.", "Autorización pendiente. El lanzamiento se bloqueará.")}
                    </div>
                  </div>
                  <Badge variant="outline" className={`rounded-none font-mono text-[9px] uppercase tracking-widest ${isAccepted ? 'text-success border-success/40' : 'text-destructive border-destructive/40'}`}>
                    {isAccepted ? t("Aceito", "Accepted", "Aceptado") : t("Pendente", "Pending", "Pendiente")}
                  </Badge>
                </div>
              );
            })}
          </div>
        </FieldRow>
      </SectionCard>

      <SectionCard title={t("Evidências de Aceite e Revogação", "Approval and Revocation Evidence", "Evidencias de aceptación y revocación")} icon={Activity}>
        <div className="space-y-4">
          {acceptances.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground text-center py-4 border border-dashed border-border/40">{t("Nenhum registro de aceite encontrado.", "No approval records found.", "No se encontraron registros de aceptación.")}</p>
          ) : (
            acceptances.map((acc) => (
              <div key={acc.id} className={`border border-border/40 p-4 ${acc.revokedAt ? 'bg-muted/10 opacity-70' : 'bg-card'}`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-mono text-xs font-bold uppercase text-foreground">{acceptanceTypeLabel(acc.acceptanceType, t)}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {new Date(acc.acceptedAt).toLocaleString(intlLocale(locale))}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className={`rounded-none font-mono text-[9px] uppercase tracking-widest ${acc.revokedAt ? 'text-destructive border-destructive/40' : 'text-success border-success/40'}`}>
                    {acc.revokedAt ? t("Revogado", "Revoked", "Revocado") : t("Ativo", "Active", "Activo")}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4 font-mono text-[10px] text-muted-foreground">
                  <div>
                    <span className="opacity-50">{t("Campanha:", "Campaign:", "Campaña:")}</span> <span className="text-foreground">{acc.campaignId || t("Global (Todas)", "Global (All)", "Global (todas)")}</span>
                  </div>
                  <div>
                    <span className="opacity-50">{t("Contrato:", "Agreement:", "Contrato:")}</span> <span className="text-foreground">v{acc.contractVersion}</span>
                  </div>
                  <div>
                    <span className="opacity-50">IP:</span> <span className="text-foreground">{acc.ipAddress || "---"}</span>
                  </div>
                </div>

                {acc.revokedAt ? (
                  <div className="p-2 border border-destructive/20 bg-destructive/5 font-mono text-[10px] text-destructive">
                    {t("Revogado em", "Revoked on", "Revocado el")} {new Date(acc.revokedAt).toLocaleString(intlLocale(locale))}.<br/>
                    {t("Motivo:", "Reason:", "Motivo:")} {acc.revocationReason}
                  </div>
                ) : (
                  <div className="flex justify-end pt-2 border-t border-border/30">
                    {revokingId === acc.id ? (
                      <div className="w-full flex items-center gap-2">
                        <Input
                          placeholder={t("Motivo da revogação...", "Reason for revocation...", "Motivo de la revocación...")}
                          value={revokeReason}
                          onChange={(e) => setRevokeReason(e.target.value)}
                          className="h-8 font-mono text-xs rounded-none bg-background border-border/50 flex-1"
                          data-testid={`input-revoke-${acc.id}`}
                        />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-3 rounded-none font-mono text-xs hover:bg-muted/20"
                          onClick={() => { setRevokingId(null); setRevokeReason(""); }}
                        >
                          {t("Cancelar", "Cancel", "Cancelar")}
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          className="h-8 px-3 rounded-none font-mono text-xs uppercase tracking-widest"
                          onClick={() => handleRevoke(acc.id)}
                          disabled={revokeMutation.isPending}
                          data-testid={`button-confirm-revoke-${acc.id}`}
                        >
                          {revokeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t("Confirmar Revogação", "Confirm Revocation", "Confirmar revocación")}
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 px-3 rounded-none font-mono text-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive uppercase tracking-widest"
                        onClick={() => setRevokingId(acc.id)}
                        data-testid={`button-revoke-${acc.id}`}
                      >
                        <XCircle className="h-3 w-3 mr-1.5" /> {t("Revogar Autorização", "Revoke Authorization", "Revocar autorización")}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </SectionCard>
      <SectionCard title={t("Pausas Obrigatórias", "Mandatory Pauses", "Pausas obligatorias")} icon={OctagonAlert}>
        <p className="font-mono text-[10px] text-muted-foreground mb-4">{t("Pausas ativas bloqueiam a próxima ação externa correspondente. Uma resolução não retoma campanhas automaticamente.", "Active pauses block the corresponding next external action. Resolving a pause does not automatically resume campaigns.", "Las pausas activas bloquean la siguiente acción externa correspondiente. Resolver una pausa no reanuda automáticamente las campañas.")}</p>
        <div className="space-y-3" data-testid="mandatory-pauses-list">
          {pauses.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground text-center py-4 border border-dashed border-border/40">{t("Nenhuma pausa obrigatória registrada.", "No mandatory pauses recorded.", "No hay pausas obligatorias registradas.")}</p>
          ) : pauses.map((pause) => (
            <div key={pause.id} className={`border p-4 ${pause.status === "active" ? "border-destructive/40 bg-destructive/5" : "border-border/40 bg-muted/10 opacity-75"}`} data-testid={`mandatory-pause-${pause.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-xs font-bold uppercase">{pauseClassLabel(pause.pauseClass, t)}</div>
                  <p className="text-xs text-muted-foreground mt-1">{pause.reason}</p>
                </div>
                <Badge variant="outline" className={`rounded-none font-mono text-[9px] uppercase ${pause.status === "active" ? "text-destructive border-destructive/40" : "text-success border-success/40"}`}>{pause.status === "active" ? t("Ativa", "Active", "Activa") : t("Resolvida", "Resolved", "Resuelta")}</Badge>
              </div>
              <div className="mt-3 font-mono text-[10px] text-muted-foreground">
                {t("Severidade:", "Severity:", "Severidad:")} <span className="text-foreground">{pause.severity}</span> · {t("Escopo:", "Scope:", "Ámbito:")} <span className="text-foreground">{pause.campaignId || "Workspace"}{pause.channel ? ` / ${pause.channel}` : ""}{pause.action ? ` / ${pause.action}` : ""}</span>
                <br />{t("Evidência segura:", "Safe evidence:", "Evidencia segura:")} {pause.evidenceSummary}
              </div>
              {pause.status === "resolved" ? <div className="mt-3 text-[10px] font-mono text-success">{t("Resolvida:", "Resolved:", "Resuelta:")} {pause.resolutionReason}</div> : (
                <div className="mt-3 pt-3 border-t border-border/30">
                  {resolvingPauseId === pause.id ? <div className="flex gap-2">
                    <Input value={pauseResolutionReason} onChange={(e) => setPauseResolutionReason(e.target.value)} placeholder={t("Motivo da resolução...", "Reason for resolution...", "Motivo de la resolución...")} data-testid={`input-resolve-pause-${pause.id}`} className="h-8 font-mono text-xs rounded-none" />
                    <Button size="sm" onClick={() => handleResolvePause(pause.id)} disabled={resolvePauseMutation.isPending} data-testid={`button-confirm-resolve-pause-${pause.id}`}>{t("Resolver", "Resolve", "Resolver")}</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setResolvingPauseId(null); setPauseResolutionReason(""); }}>{t("Cancelar", "Cancel", "Cancelar")}</Button>
                  </div> : <Button size="sm" variant="ghost" className="font-mono text-[10px] text-destructive uppercase" onClick={() => setResolvingPauseId(pause.id)} data-testid={`button-resolve-pause-${pause.id}`}>{t("Resolver pausa", "Resolve pause", "Resolver pausa")}</Button>}
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function acceptanceTypeLabel(type: string, t: ReturnType<typeof useUiText>) {
  switch (type) {
    case "autonomy": return t("Autonomia do Agente", "Agent Autonomy", "Autonomía del agente");
    case "regulated_activity": return t("Atividade Regulada", "Regulated Activity", "Actividad regulada");
    case "asset_rights": return t("Direitos de Ativos", "Asset Rights", "Derechos de activos");
    default: return type;
  }
}

function pauseClassLabel(type: string, t: ReturnType<typeof useUiText>) {
  switch (type) {
    case "probable_illegality": return t("Provável ilegalidade", "Probable illegality", "Probable ilegalidad");
    case "fraud": return t("Fraude", "Fraud", "Fraude");
    case "rights_violation": return t("Violação de direitos", "Rights violation", "Infracción de derechos");
    case "severe_account_ban_risk": return t("Risco grave de banimento", "Severe account ban risk", "Riesgo grave de suspensión de la cuenta");
    case "overspend": return t("Gasto excessivo", "Overspend", "Gasto excesivo");
    case "severe_reputational_crisis": return t("Crise reputacional grave", "Severe reputational crisis", "Crisis reputacional grave");
    default: return type;
  }
}
