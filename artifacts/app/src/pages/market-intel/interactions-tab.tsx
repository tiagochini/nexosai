import { useState } from "react";
import {
  useInteractionOpportunities,
  useInteractionOpportunity,
  useGovernInteraction,
  useProposeInteractionDraft,
  useDecideInteractionDraft,
  useMarkInteractionOperatorExecuted,
  useRecordInteractionOutcome,
  useInteractionPolicy,
  useUpdateInteractionPolicy,
  useInteractionCapabilities,
  useRunInteractionCouncil
} from "@/hooks/use-interaction-governance";
import { Loader2, MessageSquare, AlertTriangle, Shield, CheckCircle2, Zap, Target, Lock, Play, FileText, Settings, Key, Globe, BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUiText } from "@/lib/i18n";

interface Props {
  campaignId: string;
  preselectedId?: string | null;
}

function interactionStateLabel(state: string, t: ReturnType<typeof useUiText>) {
  const labels: Record<string, [string, string, string]> = {
    all: ["Todas", "All", "Todas"], observed: ["Observada", "Observed", "Observada"], awaiting_approval: ["Aguardando aprovação", "Awaiting approval", "Pendiente de aprobación"],
    approved: ["Aprovada", "Approved", "Aprobada"], executing: ["Em execução", "Executing", "En ejecución"], verified: ["Verificada", "Verified", "Verificada"],
    failed: ["Falhou", "Failed", "Fallida"], blocked: ["Bloqueada", "Blocked", "Bloqueada"], cancelled: ["Cancelada", "Cancelled", "Cancelada"],
  };
  return labels[state] ? t(...labels[state]!) : state.replace(/_/g, " ");
}

function lawfulBasisLabel(value: string, t: ReturnType<typeof useUiText>) {
  if (value === "permitted") return t("Permitido", "Permitted", "Permitido");
  if (value === "not_permitted") return t("Não permitido", "Not permitted", "No permitido");
  if (value === "none" || value === "unknown" || value === "no_basis") return t("Sem base legal", "No legal basis", "Sin base legal");
  return value;
}

function interactionActionLabel(value: string, t: ReturnType<typeof useUiText>) {
  const labels: Record<string, [string, string, string]> = {
    comment: ["Comentar", "Comment", "Comentar"], reply: ["Responder", "Reply", "Responder"],
    like: ["Curtir", "Like", "Me gusta"], follow: ["Seguir", "Follow", "Seguir"],
    message: ["Enviar mensagem", "Send message", "Enviar mensaje"], share: ["Compartilhar", "Share", "Compartir"],
  };
  return labels[value] ? t(...labels[value]!) : value.replace(/_/g, " ");
}

export function InteractionsTab({ campaignId, preselectedId }: Props) {
  const t = useUiText();
  const [view, setView] = useState<"list" | "governance">("list");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-sm uppercase tracking-wider flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" /> {t("Central de Inteligência de Interação", "Interaction Intelligence Hub", "Centro de inteligencia de interacciones")}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant={view === "list" ? "default" : "outline"} size="sm" onClick={() => setView("list")}>
            {t("Fila de Interações", "Interaction Queue", "Cola de interacciones")}
          </Button>
          <Button variant={view === "governance" ? "default" : "outline"} size="sm" onClick={() => setView("governance")}>
            <Shield className="h-4 w-4 mr-1.5" /> {t("Governança", "Governance", "Gobernanza")}
          </Button>
        </div>
      </div>

      {view === "list" && <InteractionsList preselectedId={preselectedId} />}
      {view === "governance" && <GovernancePanel />}
    </div>
  );
}

function InteractionsList({ preselectedId }: { preselectedId?: string | null }) {
  const t = useUiText();
  const { data, isLoading } = useInteractionOpportunities();
  const [selectedId, setSelectedId] = useState<string | null>(preselectedId || null);
  const [filterState, setFilterState] = useState<string>("all");

  if (isLoading) return <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;

  const allOpportunities = data?.opportunities || [];
  const opportunities = filterState === "all" ? allOpportunities : allOpportunities.filter((o: any) => o.state === filterState);

  if (selectedId) {
    return <InteractionDetail id={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-2">
        {["all", "observed", "awaiting_approval", "approved", "executing", "verified", "failed", "blocked", "cancelled"].map(state => (
          <Button
            key={state}
            variant={filterState === state ? "secondary" : "outline"}
            size="sm"
            className="h-7 text-xs rounded-full whitespace-nowrap"
            onClick={() => setFilterState(state)}
          >
            {interactionStateLabel(state, t)}
          </Button>
        ))}
      </div>
      <div className="grid gap-4">
        {opportunities.length === 0 ? (
          <div className="border border-border/50 rounded-sm p-12 text-center bg-card/30">
            <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">{t("Nenhuma oportunidade de interação encontrada.", "No interaction opportunities found.", "No se encontraron oportunidades de interacción.")}</p>
          </div>
        ) : (
          opportunities.map((opp: any) => (
            <div key={opp.id} className="border border-border/50 rounded-sm p-5 bg-card/30 hover:bg-card/50 transition-colors space-y-4 cursor-pointer" onClick={() => setSelectedId(opp.id)}>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold uppercase">{interactionActionLabel(opp.action, t)}</span>
                    <Badge variant="outline" className={`text-[10px] ${
                      opp.riskScore > 50 ? "text-destructive border-destructive/30 bg-destructive/5" :
                      opp.riskScore > 20 ? "text-amber-500 border-amber-500/30 bg-amber-500/5" :
                      "text-green-400 border-green-400/30 bg-green-400/5"
                    }`}>
                      {t("Risco:", "Risk:", "Riesgo:")} {opp.riskScore}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] uppercase">{interactionStateLabel(opp.state, t)}</Badge>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/50">
                      {opp.platform}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {t("Destinatário:", "Recipient:", "Destinatario:")} <span className="font-mono">{opp.recipientId?.substring(0, 8)}...</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {opp.lawfulBasis === "permitted" ? (
                      <Badge variant="outline" className="text-green-400 border-green-400/30 text-[10px]">{t("Permitido", "Permitted", "Permitido")}</Badge>
                  ) : opp.lawfulBasis === "not_permitted" ? (
                      <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px]">{t("Não Permitido", "Not Permitted", "No permitido")}</Badge>
                  ) : (
                      <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 text-[10px]">{t("Sem Base Legal", "No Legal Basis", "Sin base legal")}</Badge>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function InteractionDetail({ id, onBack }: { id: string, onBack: () => void }) {
  const t = useUiText();
  const { data, isLoading } = useInteractionOpportunity(id);
  const govern = useGovernInteraction();
  const propose = useProposeInteractionDraft();
  const decide = useDecideInteractionDraft();
  const markExecuted = useMarkInteractionOperatorExecuted();
  const recordOutcome = useRecordInteractionOutcome();
  const runCouncil = useRunInteractionCouncil();

  const [draftContent, setDraftContent] = useState("");
  const [draftCta, setDraftCta] = useState("0");

  const [modContent, setModContent] = useState("");

  const [evidenceText, setEvidenceText] = useState("");
  const [outcomeResult, setOutcomeResult] = useState("");

  const [blockReasons, setBlockReasons] = useState<string[] | null>(null);

  if (isLoading) return <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;
  if (!data || !data.opportunity) return <div>{t("Erro ao carregar detalhes.", "Error loading details.", "Error al cargar los detalles.")}</div>;

  const { opportunity, drafts, executions } = data;
  const currentDraft = drafts?.[0];
  const currentExecution = executions?.[0];

  const handleRunCouncil = () => {
    setBlockReasons(null);
    runCouncil.mutate(opportunity.id, {
      onError: (err: any) => {
        const data = err?.data;
        if (data?.gate?.decision === "blocked") {
          setBlockReasons(data.gate.reasons || [t("Oportunidade bloqueada.", "Opportunity blocked.", "Oportunidad bloqueada.")]);
        } else {
          alert(data?.error || t("Erro ao executar o conselho.", "Error running the council.", "Error al ejecutar el consejo."));
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">
        &larr; {t("Voltar", "Back", "Volver")}
      </Button>

      <div className="border border-border/50 rounded-sm p-6 bg-card/30 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="font-mono text-lg uppercase tracking-wider">{opportunity.action.replace(/_/g, ' ')} no {opportunity.platform}</h3>
            <p className="text-xs text-muted-foreground">ID: {opportunity.id}</p>
          </div>
          <Badge variant="secondary" className="uppercase">{interactionStateLabel(opportunity.state, t)}</Badge>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{t("Contexto & Evidência", "Context & Evidence", "Contexto y evidencia")}</h4>
            <div className="bg-background border border-border/50 rounded-sm p-3 text-xs font-mono overflow-auto max-h-40">
              {JSON.stringify(opportunity.context, null, 2)}
            </div>
            <div className="bg-background border border-border/50 rounded-sm p-3 text-xs font-mono overflow-auto max-h-40">
              {JSON.stringify(opportunity.evidence, null, 2)}
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-border/50 p-3 rounded-sm">
                <span className="text-[10px] text-muted-foreground uppercase">{t("Base Legal", "Legal Basis", "Base legal")}</span>
                <p className="text-sm">{lawfulBasisLabel(opportunity.lawfulBasis, t)}</p>
              </div>
              <div className="border border-border/50 p-3 rounded-sm">
                <span className="text-[10px] text-muted-foreground uppercase">{t("Score de Risco", "Risk Score", "Puntuación de riesgo")}</span>
                <p className={`text-sm ${opportunity.riskScore > 50 ? 'text-destructive' : 'text-green-400'}`}>{opportunity.riskScore}</p>
              </div>
              <div className="border border-border/50 p-3 rounded-sm">
                <span className="text-[10px] text-muted-foreground uppercase">{t("Ativo Próprio?", "Owned Asset?", "¿Activo propio?")}</span>
                <p className="text-sm">{opportunity.assetOwned ? t("Sim", "Yes", "Sí") : t("Não", "No", "No")}</p>
              </div>
              <div className="border border-border/50 p-3 rounded-sm">
                <span className="text-[10px] text-muted-foreground uppercase">{t("Conversa Própria?", "Owned Conversation?", "¿Conversación propia?")}</span>
                <p className="text-sm">{opportunity.conversationOwned ? t("Sim", "Yes", "Sí") : t("Não", "No", "No")}</p>
              </div>
            </div>

            {opportunity.state === "observed" && (
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => govern.mutate(opportunity.id)}
                  disabled={govern.isPending || runCouncil.isPending}
                >
                  {govern.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                  {t("Governar (Avaliar Gate)", "Govern (Evaluate Gate)", "Gobernar (evaluar el control)")}
                </Button>
                <Button
                  className="flex-1"
                  variant="secondary"
                  onClick={handleRunCouncil}
                  disabled={govern.isPending || runCouncil.isPending}
                >
                  {runCouncil.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BrainCircuit className="h-4 w-4 mr-2" />}
                  {t("Gerar com Conselho NexOS", "Generate with NexOS Council", "Generar con el Consejo NexOS")}
                </Button>
              </div>
            )}

            {opportunity.state === "blocked" && (
              <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-sm space-y-2">
                <div className="text-destructive text-sm flex items-center gap-2 font-semibold">
                  <Lock className="h-4 w-4" /> {t("Interação Bloqueada pela Governança", "Interaction Blocked by Governance", "Interacción bloqueada por la gobernanza")}
                </div>
                {blockReasons && blockReasons.length > 0 && (
                  <ul className="list-disc list-inside text-xs text-destructive/90 ml-4 space-y-1">
                    {blockReasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {(opportunity.state === "approved" || opportunity.state === "awaiting_approval") && !currentDraft && (
              <div className="space-y-3 border border-border/50 p-4 rounded-sm bg-card/50">
                <h4 className="font-mono text-xs uppercase tracking-wider">{t("Criar Proposta de Rascunho", "Create Draft Proposal", "Crear propuesta de borrador")}</h4>
                <textarea
                  value={draftContent}
                  onChange={e => setDraftContent(e.target.value)}
                  placeholder={t("Conteúdo da interação...", "Interaction content...", "Contenido de la interacción...")}
                  className="w-full bg-background border border-border/50 rounded-sm p-2 text-sm focus:outline-none focus:border-primary/50"
                  rows={4}
                />
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-[10px] text-muted-foreground uppercase">{t("Nível de CTA (0-5)", "CTA Level (0–5)", "Nivel de CTA (0–5)")}</label>
                    <select
                      value={draftCta}
                      onChange={e => setDraftCta(e.target.value)}
                      className="w-full bg-background border border-border/50 rounded-sm p-1.5 text-sm"
                    >
                      {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <Button
                    className="self-end"
                    disabled={!draftContent.trim() || propose.isPending}
                    onClick={() => propose.mutate({ id: opportunity.id, content: draftContent, ctaLevel: Number(draftCta) }, {
                      onError: (err: any) => {
                        alert(err?.data?.error || t("Erro ao propor rascunho. Possível similaridade com histórico.", "Could not propose draft. It may be too similar to previous content.", "No se pudo proponer el borrador. Puede ser demasiado similar al contenido anterior."));
                      }
                    })}
                  >
                    {t("Propor Rascunho", "Propose Draft", "Proponer borrador")}
                  </Button>
                </div>
              </div>
            )}

            {currentDraft && currentDraft.state === "awaiting_approval" && (
              <div className="space-y-4 border border-amber-500/30 p-4 rounded-sm bg-amber-500/5">
                <h4 className="font-mono text-xs uppercase tracking-wider text-amber-500">{t("Rascunho Pendente de Aprovação", "Draft Awaiting Approval", "Borrador pendiente de aprobación")}</h4>

                {currentDraft.councilAssessment && Object.keys(currentDraft.councilAssessment).length > 0 && (
                  <div className="bg-background/80 border border-border/50 rounded-sm p-3 grid grid-cols-2 gap-3 text-xs">
                    <div><span className="text-muted-foreground uppercase text-[10px] block">{t("Observador", "Observer", "Observador")}</span><span className="font-mono">{currentDraft.councilAssessment.observer || "N/A"}</span></div>
                    <div><span className="text-muted-foreground uppercase text-[10px] block">{t("Intenção", "Intention", "Intención")}</span><span className="font-mono">{currentDraft.councilAssessment.intention || "N/A"}</span></div>
                    <div><span className="text-muted-foreground uppercase text-[10px] block">{t("Afinidade", "Affinity", "Afinidad")}</span><span className="font-mono">{currentDraft.councilAssessment.affinity || "N/A"}</span></div>
                    <div><span className="text-muted-foreground uppercase text-[10px] block">{t("Contato possível", "Contactability", "Posibilidad de contacto")}</span><span className="font-mono">{currentDraft.councilAssessment.contactability || "N/A"}</span></div>
                    <div><span className="text-muted-foreground uppercase text-[10px] block">{t("Risco", "Risk", "Riesgo")}</span><span className="font-mono">{currentDraft.councilAssessment.risk || "N/A"}</span></div>
                    <div><span className="text-muted-foreground uppercase text-[10px] block">{t("Confiança", "Confidence", "Confianza")}</span><span className="font-mono">{currentDraft.councilAssessment.confidence || "N/A"}</span></div>
                    <div><span className="text-muted-foreground uppercase text-[10px] block">{t("Limite de CTA", "CTA Cap", "Límite de CTA")}</span><span className="font-mono">{currentDraft.councilAssessment.ctaCap || "N/A"}</span></div>
                    <div className="col-span-2"><span className="text-muted-foreground uppercase text-[10px] block">{t("Ação recomendada", "Recommended Action", "Acción recomendada")}</span><span className="font-mono">{currentDraft.councilAssessment.recommendedAction || "N/A"}</span></div>
                  </div>
                )}

                <p className="text-sm bg-background p-3 rounded-sm border border-border/50">{currentDraft.content}</p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase">
                  <span>{t("Nível de CTA Proposto:", "Proposed CTA Level:", "Nivel de CTA propuesto:")} {currentDraft.ctaLevel}</span>
                </div>

                <div className="space-y-2 pt-2 border-t border-amber-500/20">
                   <label className="text-[10px] text-muted-foreground uppercase">{t("Modificar conteúdo (opcional)", "Edit content (optional)", "Modificar contenido (opcional)")}</label>
                  <textarea
                    value={modContent}
                    onChange={e => setModContent(e.target.value)}
                    placeholder={t("Deixe em branco para aprovar como está...", "Leave blank to approve as is...", "Déjalo en blanco para aprobarlo tal cual...")}
                    className="w-full bg-background border border-border/50 rounded-sm p-2 text-sm focus:outline-none focus:border-amber-500/50"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-green-500 hover:bg-green-600 text-black"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ draftId: currentDraft.id, opportunityId: opportunity.id, approved: true, modifiedContent: modContent || undefined })}
                  >
                    {t("Aprovar", "Approve", "Aprobar")}
                  </Button>
                  <Button
                    className="flex-1" variant="destructive"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ draftId: currentDraft.id, opportunityId: opportunity.id, approved: false })}
                  >
                    {t("Rejeitar", "Reject", "Rechazar")}
                  </Button>
                </div>
              </div>
            )}

            {opportunity.state === "approved" && currentDraft?.state === "approved" && !currentExecution && (
              <div className="space-y-3 border border-border/50 p-4 rounded-sm bg-card/50">
                <h4 className="font-mono text-xs uppercase tracking-wider text-primary">{t("Pronto para Execução", "Ready for Execution", "Listo para ejecutar")}</h4>
                <p className="text-xs text-muted-foreground">{t("O conteúdo foi aprovado e deve ser executado (Assistido).", "The content is approved and should be executed (Assisted).", "El contenido está aprobado y debe ejecutarse (asistido).")}</p>
                <div className="p-3 bg-background border border-border/50 rounded-sm relative group">
                  <p className="text-sm">{currentDraft.content}</p>
                  <Button
                    size="sm" variant="outline" className="absolute top-2 right-2 h-7 px-2 text-[10px]"
                    onClick={() => navigator.clipboard.writeText(currentDraft.content)}
                  >
                    {t("Copiar", "Copy", "Copiar")}
                  </Button>
                </div>
                <div className="space-y-2 pt-2">
                  <label className="text-[10px] text-muted-foreground uppercase">{t("Evidência de Execução Manual (JSON)", "Manual Execution Evidence (JSON)", "Evidencia de ejecución manual (JSON)")}</label>
                  <textarea
                    value={evidenceText}
                    onChange={e => setEvidenceText(e.target.value)}
                    placeholder='{"url": "https://..."}'
                    className="w-full bg-background border border-border/50 rounded-sm p-2 text-sm focus:outline-none font-mono"
                    rows={2}
                  />
                  <Button
                    className="w-full"
                    disabled={!evidenceText.trim() || markExecuted.isPending}
                    onClick={() => {
                      try {
                        const evidence = JSON.parse(evidenceText);
                        markExecuted.mutate({ opportunityId: opportunity.id, draftId: currentDraft.id, evidence });
                      } catch {
                        alert(t("Evidência deve ser um JSON válido.", "Evidence must be valid JSON.", "La evidencia debe ser JSON válido."));
                      }
                    }}
                  >
                    {t("Registrar Execução", "Record Execution", "Registrar ejecución")}
                  </Button>
                </div>
              </div>
            )}

            {opportunity.state === "executing" && currentExecution && (
              <div className="space-y-3 border border-border/50 p-4 rounded-sm bg-card/50">
                <h4 className="font-mono text-xs uppercase tracking-wider text-amber-500">{t("Execução Registrada", "Execution Recorded", "Ejecución registrada")}</h4>
                <div className="space-y-2">
                  <label className="text-[10px] text-muted-foreground uppercase">{t("Resultado do Engajamento (JSON)", "Engagement Result (JSON)", "Resultado de interacción (JSON)")}</label>
                  <textarea
                    value={outcomeResult}
                    onChange={e => setOutcomeResult(e.target.value)}
                    placeholder='{"likes": 0, "replies": 0}'
                    className="w-full bg-background border border-border/50 rounded-sm p-2 text-sm focus:outline-none font-mono"
                    rows={2}
                  />
                  <Button
                    className="w-full"
                    disabled={!outcomeResult.trim() || recordOutcome.isPending}
                    onClick={() => {
                      try {
                        const result = JSON.parse(outcomeResult);
                        recordOutcome.mutate({ executionId: currentExecution.id, opportunityId: opportunity.id, result });
                      } catch {
                        alert(t("Resultado deve ser um JSON válido.", "Result must be valid JSON.", "El resultado debe ser JSON válido."));
                      }
                    }}
                  >
                    {t("Concluir e Registrar Resultado", "Complete and Record Result", "Completar y registrar resultado")}
                  </Button>
                  <Button
                    className="w-full" variant="outline"
                    disabled={!outcomeResult.trim() || recordOutcome.isPending}
                    onClick={() => {
                      try {
                        const result = JSON.parse(outcomeResult);
                        recordOutcome.mutate({ executionId: currentExecution.id, opportunityId: opportunity.id, result, incident: { error: "Failed manual interaction" } });
                      } catch {
                        alert(t("Resultado deve ser um JSON válido.", "Result must be valid JSON.", "El resultado debe ser JSON válido."));
                      }
                    }}
                  >
                    {t("Registrar Incidente", "Record Incident", "Registrar incidente")}
                  </Button>
                </div>
              </div>
            )}

            {(opportunity.state === "verified" || opportunity.state === "failed") && (
              <div className={`p-4 rounded-sm border ${opportunity.state === 'verified' ? 'border-green-500/30 bg-green-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
                <h4 className={`font-mono text-xs uppercase tracking-wider ${opportunity.state === 'verified' ? 'text-green-500' : 'text-destructive'}`}>
                  {t("Ciclo Concluído", "Cycle Completed", "Ciclo completado")} ({interactionStateLabel(opportunity.state, t)})
                </h4>
                {currentExecution && (
                  <div className="mt-2 text-xs font-mono text-muted-foreground overflow-auto max-h-24">
                    {JSON.stringify(currentExecution.result, null, 2)}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

function GovernancePanel() {
  const t = useUiText();
  const { data: policyData, isLoading: policyLoading } = useInteractionPolicy();
  const { data: capData, isLoading: capLoading } = useInteractionCapabilities();
  const updatePolicy = useUpdateInteractionPolicy();

  const [enabled, setEnabled] = useState(false);
  const [requireApproval, setRequireApproval] = useState(true);
  const [maxRisk, setMaxRisk] = useState(50);
  const [workspaceCeiling, setWorkspaceCeiling] = useState(100);
  const [accountCeiling, setAccountCeiling] = useState(10);
  const [competitorCeiling, setCompetitorCeiling] = useState(0);
  const [postCeiling, setPostCeiling] = useState(0);
  const [recipientCeiling, setRecipientCeiling] = useState(0);
  const [cooldown, setCooldown] = useState(10080);
  const [retentionDays, setRetentionDays] = useState(30);
  const [jurisdictions, setJurisdictions] = useState("BR");

  useState(() => {
    if (policyData?.policy) {
      setEnabled(policyData.policy.enabled);
      setRequireApproval(policyData.policy.requireApproval);
      setMaxRisk(policyData.policy.maximumRiskScore);
      setWorkspaceCeiling(policyData.policy.workspaceCeiling);
      setAccountCeiling(policyData.policy.accountCeiling);
      setCompetitorCeiling(policyData.policy.competitorCeiling);
      setPostCeiling(policyData.policy.postCeiling);
      setRecipientCeiling(policyData.policy.recipientCeiling);
      setCooldown(policyData.policy.recipientCooldownMinutes);
      setRetentionDays(policyData?.policy?.retentionDays);
      setJurisdictions((policyData?.policy?.jurisdictionCodes || []).join(", "));
    }
  });

  if (policyLoading || capLoading) return <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;

  const capabilities = capData?.capabilities || [];

  const savePolicy = () => {
    updatePolicy.mutate({
      enabled,
      requireApproval,
      maximumRiskScore: maxRisk,
      workspaceCeiling,
      accountCeiling,
      competitorCeiling,
      postCeiling,
      recipientCeiling,
      recipientCooldownMinutes: cooldown,
      windowMinutes: policyData?.policy?.windowMinutes || 1440,
      purpose: policyData?.policy?.purpose || "public engagement",
      jurisdictionCodes: jurisdictions.split(",").map(s => s.trim().toUpperCase()).filter(s => s.length === 2),
      retentionDays,
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="border border-border/50 rounded-sm p-6 bg-card/30 space-y-6">
          <div className="space-y-1">
            <h3 className="font-mono text-sm uppercase tracking-wider flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> {t("Política de Governança", "Governance Policy", "Política de gobernanza")}
            </h3>
            <p className="text-xs text-muted-foreground">{t("Configurações globais de interação do workspace.", "Global workspace interaction settings.", "Configuración global de interacciones del espacio de trabajo.")}</p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border border-border/50 rounded-sm bg-background/50">
              <div>
                <p className="text-sm font-medium">{t("Interações Ativas", "Interactions Enabled", "Interacciones activas")}</p>
                <p className="text-[10px] text-muted-foreground">{t("Permitir execuções de interação no workspace", "Allow interaction execution in the workspace", "Permitir ejecuciones de interacción en el espacio de trabajo")}</p>
              </div>
              <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="h-4 w-4" />
            </div>

            <div className="flex items-center justify-between p-3 border border-border/50 rounded-sm bg-background/50">
              <div>
                <p className="text-sm font-medium">{t("Requer Aprovação Humana", "Human Approval Required", "Requiere aprobación humana")}</p>
                <p className="text-[10px] text-muted-foreground">{t("Não permitir modo Automático Oficial", "Do not allow Official Automatic mode", "No permitir el modo automático oficial")}</p>
              </div>
              <input type="checkbox" checked={requireApproval} onChange={e => setRequireApproval(e.target.checked)} className="h-4 w-4" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase text-muted-foreground">{t("Teto Workspace (24h)", "Workspace Limit (24h)", "Límite del espacio de trabajo (24 h)")}</label>
                <input type="number" value={workspaceCeiling} onChange={e => setWorkspaceCeiling(Number(e.target.value))} className="w-full bg-background border border-border/50 rounded-sm px-3 py-1.5 text-sm focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase text-muted-foreground">{t("Teto por Conta (24h)", "Per-Account Limit (24h)", "Límite por cuenta (24 h)")}</label>
                <input type="number" value={accountCeiling} onChange={e => setAccountCeiling(Number(e.target.value))} className="w-full bg-background border border-border/50 rounded-sm px-3 py-1.5 text-sm focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase text-muted-foreground">{t("Teto Concorrente (24h)", "Per-Competitor Limit (24h)", "Límite por competidor (24 h)")}</label>
                <input type="number" value={competitorCeiling} onChange={e => setCompetitorCeiling(Number(e.target.value))} className="w-full bg-background border border-border/50 rounded-sm px-3 py-1.5 text-sm focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase text-muted-foreground">{t("Teto Post (24h)", "Per-Post Limit (24h)", "Límite por publicación (24 h)")}</label>
                <input type="number" value={postCeiling} onChange={e => setPostCeiling(Number(e.target.value))} className="w-full bg-background border border-border/50 rounded-sm px-3 py-1.5 text-sm focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase text-muted-foreground">{t("Teto Destinatário (24h)", "Per-Recipient Limit (24h)", "Límite por destinatario (24 h)")}</label>
                <input type="number" value={recipientCeiling} onChange={e => setRecipientCeiling(Number(e.target.value))} className="w-full bg-background border border-border/50 rounded-sm px-3 py-1.5 text-sm focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase text-muted-foreground">{t("Cooldown Dest. (min)", "Recipient Cooldown (min)", "Espera por destinatario (min)")}</label>
                <input type="number" value={cooldown} onChange={e => setCooldown(Number(e.target.value))} className="w-full bg-background border border-border/50 rounded-sm px-3 py-1.5 text-sm focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase text-muted-foreground">{t("Jurisdições (ISO)", "Jurisdictions (ISO)", "Jurisdicciones (ISO)")}</label>
            <input value={jurisdictions} onChange={e => setJurisdictions(e.target.value)} placeholder="BR, US, PT" aria-label={t("Códigos ISO de jurisdição", "Jurisdiction ISO codes", "Códigos ISO de jurisdicción")} className="w-full bg-background border border-border/50 rounded-sm px-3 py-1.5 text-sm focus:outline-none uppercase" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase text-muted-foreground">{t("Retenção (dias)", "Retention (days)", "Retención (días)")}</label>
                <input type="number" value={retentionDays} onChange={e => setRetentionDays(Number(e.target.value))} className="w-full bg-background border border-border/50 rounded-sm px-3 py-1.5 text-sm focus:outline-none" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">{t("Múltiplas contas compartilham o teto global (Workspace). O menor limite sempre barra a execução.", "Multiple accounts share the global workspace limit. The lowest limit always blocks execution.", "Varias cuentas comparten el límite global del espacio de trabajo. El límite más bajo siempre bloquea la ejecución.")}</p>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-muted-foreground">{t("Score Máximo de Risco Permitido (0-100)", "Maximum Allowed Risk Score (0–100)", "Puntuación máxima de riesgo permitida (0–100)")}</label>
              <input type="number" value={maxRisk} onChange={e => setMaxRisk(Number(e.target.value))} className="w-full bg-background border border-border/50 rounded-sm px-3 py-1.5 text-sm focus:outline-none" />
            </div>

            <Button onClick={savePolicy} disabled={updatePolicy.isPending} className="w-full">
              {updatePolicy.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t("Salvar Política", "Save Policy", "Guardar política")}
            </Button>
          </div>
        </div>

        <div className="border border-border/50 rounded-sm p-6 bg-card/30 space-y-4">
          <div className="space-y-1">
            <h3 className="font-mono text-sm uppercase tracking-wider flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" /> {t("Saúde de Contas e Capabilities", "Account Health & Capabilities", "Estado de cuentas y capacidades")}
            </h3>
            <p className="text-xs text-muted-foreground">{t("Status e permissões de execução via adapters oficiais.", "Execution status and permissions through official adapters.", "Estado y permisos de ejecución mediante adaptadores oficiales.")}</p>
          </div>

          <div className="space-y-3">
            {capabilities.length === 0 ? (
              <p className="text-xs text-muted-foreground p-6 text-center border border-border/50 rounded-sm bg-background/50">{t("Nenhuma account capability registrada.", "No account capabilities registered.", "No hay capacidades de cuenta registradas.")}</p>
            ) : (
              capabilities.map((cap: any) => (
                <div key={cap.id} className="border border-border/50 rounded-sm p-4 bg-background/50 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{cap.platform}</span>
                      <Badge variant="outline" className="text-[10px]">{cap.action}</Badge>
                    </div>
                    {cap.enabled ? (
                       <Badge variant="outline" className="text-green-400 border-green-400/30 text-[10px]">{t("Enabled", "Enabled", "Activado")}</Badge>
                    ) : (
                       <Badge variant="outline" className="text-muted-foreground text-[10px]">{t("Disabled", "Disabled", "Desactivado")}</Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {cap.officialAdapter ? (
                      <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">{t("Adapter Oficial", "Official Adapter", "Adaptador oficial")}</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">{t("Adapter Genérico", "Generic Adapter", "Adaptador genérico")}</Badge>
                    )}
                    {cap.allowsAutomaticExecution && (
                      <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-500">{t("Auto Exec", "Auto Exec", "Ejecución auto.")}</Badge>
                    )}
                    {cap.requiresOwnedAsset && (
                      <Badge variant="secondary" className="text-[10px]">{t("Requer Own Asset", "Requires Owned Asset", "Requiere activo propio")}</Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-border/50">
            <h4 className="font-mono text-[10px] uppercase tracking-wider mb-2 text-muted-foreground">{t("Glossário de Modos de Execução", "Execution Modes Glossary", "Glosario de modos de ejecución")}</h4>
            <ul className="text-xs space-y-1.5 text-muted-foreground">
              <li><span className="text-foreground font-medium">{t("Automático Oficial:", "Official Automatic:", "Automático oficial:")}</span> {t("API suportada, policy permite auto-exec, risco abaixo do teto.", "Supported API, policy allows auto-execution, risk below the limit.", "API compatible, la política permite ejecución automática y el riesgo está bajo el límite.")}</li>
              <li><span className="text-foreground font-medium">{t("Assistido:", "Assisted:", "Asistido:")}</span> {t("Workflow de rascunho aprovado por humano, executado manualmente.", "Human-approved draft workflow, executed manually.", "Flujo de borrador aprobado por una persona y ejecutado manualmente.")}</li>
              <li><span className="text-foreground font-medium">{t("Somente inteligência:", "Intelligence only:", "Solo inteligencia:")}</span> {t("Monitoramento sem ação (account desconectada ou não suportada).", "Monitoring only (account disconnected or unsupported).", "Supervisión sin acciones (cuenta desconectada o no compatible).")}</li>
              <li><span className="text-destructive font-medium">{t("Bloqueado:", "Blocked:", "Bloqueado:")}</span> {t("Gate rejeitou a oportunidade.", "The gate rejected the opportunity.", "El control rechazó la oportunidad.")}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
