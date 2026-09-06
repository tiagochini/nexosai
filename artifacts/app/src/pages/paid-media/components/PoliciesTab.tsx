import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useListPaidMediaPolicies, useUpdatePaidMediaPolicy, getListPaidMediaPoliciesQueryKey } from "@workspace/api-client-react";
import { Shield, ShieldAlert, AlertTriangle } from "lucide-react";

export function PoliciesTab() {
  const queryClient = useQueryClient();
  const { data: policiesData, isLoading } = useListPaidMediaPolicies({
    query: { queryKey: getListPaidMediaPoliciesQueryKey(), refetchInterval: 15000, refetchOnWindowFocus: true }
  });
  const updatePolicy = useUpdatePaidMediaPolicy();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const policies = policiesData?.policies || [];

  const handleEdit = (policy: any) => {
    setEditingId(policy.id);
    setEditForm({
      enabled: policy.enabled,
      mandatoryPause: policy.mandatoryPause,
      mandatoryPauseReason: policy.mandatoryPauseReason || "",
      minimumSampleSize: policy.minimumSampleSize,
      minimumDataQualityScore: policy.minimumDataQualityScore,
      maxDailyBudgetChangePercent: policy.maxDailyBudgetChangePercent || 0,
      maxBidChangePercent: policy.maxBidChangePercent || 0,
    });
  };

  const handleSave = (id: string) => {
    updatePolicy.mutate({ id, policyId: id, data: editForm } as any, {
      onSuccess: () => {
        toast.success("Política de autonomia atualizada com sucesso.");
        setEditingId(null);
        queryClient.invalidateQueries({ queryKey: getListPaidMediaPoliciesQueryKey() });
      },
      onError: (err: any) => toast.error(err?.message || "Erro ao atualizar política.")
    });
  };

  if (isLoading) return <div className="text-muted-foreground animate-pulse font-mono text-xs">Carregando políticas de autonomia...</div>;
  if (!policies.length) return <div className="text-muted-foreground font-mono text-xs p-4">Nenhuma política de autonomia configurada. Conecte uma conta primeiro.</div>;

  return (
    <div className="space-y-6">
      {policies.map((policy: any) => (
        <div key={policy.id} className="card-weapon p-5 border border-border/40 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border/30 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <h3 className="font-mono text-sm uppercase tracking-widest font-bold text-foreground">
                  Política de Controle — {policy.provider === 'meta_ads' ? 'Meta Ads' : policy.provider === 'tiktok_ads' ? 'TikTok Ads' : 'Global'}
                </h3>
              </div>
              <div className="font-mono text-[10px] uppercase text-muted-foreground mt-1">Ref Conta: {policy.accountId || 'Geral'}</div>
            </div>
            {editingId === policy.id ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingId(null)} className="h-7 text-[10px] uppercase font-mono">Cancelar</Button>
                <Button size="sm" onClick={() => handleSave(policy.id)} className="h-7 text-[10px] uppercase font-mono btn-weapon-primary" disabled={updatePolicy.isPending}>Salvar Configuração</Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => handleEdit(policy)} className="h-7 text-[10px] uppercase font-mono">Editar Limites</Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-mono text-xs">
            
            {/* Status & Pauses */}
            <div className="space-y-4 bg-background/30 p-3 rounded-sm border border-border/20">
              <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" /> Estado de Operação
              </h4>
              <div className="flex items-center justify-between">
                <span>Atuação Autônoma</span>
                {editingId === policy.id ? (
                  <Switch checked={editForm.enabled} onCheckedChange={v => setEditForm({...editForm, enabled: v})} />
                ) : (
                  <span className={policy.enabled ? "text-primary font-bold" : "text-muted-foreground"}>{policy.enabled ? "LIGADO" : "DESLIGADO"}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3"/> Pausa Obrigatória (Killswitch)</span>
                {editingId === policy.id ? (
                  <Switch checked={editForm.mandatoryPause} onCheckedChange={v => setEditForm({...editForm, mandatoryPause: v})} />
                ) : (
                  <span className={policy.mandatoryPause ? "text-destructive font-bold" : "text-muted-foreground"}>{policy.mandatoryPause ? "ATIVA" : "NÃO"}</span>
                )}
              </div>
              {((editingId === policy.id && editForm.mandatoryPause) || (!editingId && policy.mandatoryPause)) && (
                <div className="mt-2">
                  {editingId === policy.id ? (
                    <Input 
                      placeholder="Motivo do bloqueio..." 
                      value={editForm.mandatoryPauseReason} 
                      onChange={e => setEditForm({...editForm, mandatoryPauseReason: e.target.value})}
                      className="h-7 text-[10px] bg-background border-destructive/50 focus-visible:ring-destructive"
                    />
                  ) : (
                    <div className="text-[10px] text-destructive/80 bg-destructive/10 p-2 rounded-sm border border-destructive/20 break-words">
                      {policy.mandatoryPauseReason || "Bloqueio imposto sem motivo documentado."}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Thresholds */}
            <div className="space-y-4 bg-background/30 p-3 rounded-sm border border-border/20">
              <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Gatilhos Analíticos</h4>
              <div className="flex items-center justify-between gap-4">
                <span className="truncate">Amostra Mínima (Impr/Cliques)</span>
                {editingId === policy.id ? (
                  <Input type="number" value={editForm.minimumSampleSize} onChange={e => setEditForm({...editForm, minimumSampleSize: Number(e.target.value)})} className="h-7 w-24 text-right text-[10px]" />
                ) : (
                  <span className="font-bold">{policy.minimumSampleSize}</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="truncate">Data Quality Score Mínimo</span>
                {editingId === policy.id ? (
                  <Input type="number" step="0.1" value={editForm.minimumDataQualityScore} onChange={e => setEditForm({...editForm, minimumDataQualityScore: Number(e.target.value)})} className="h-7 w-24 text-right text-[10px]" />
                ) : (
                  <span className="font-bold">{policy.minimumDataQualityScore}</span>
                )}
              </div>
            </div>

            {/* Limits */}
            <div className="space-y-4 bg-background/30 p-3 rounded-sm border border-border/20">
              <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Limites de Modificação</h4>
              <div className="flex items-center justify-between gap-4">
                <span className="truncate">Teto Var. Orçamento Diário</span>
                {editingId === policy.id ? (
                  <Input type="number" step="0.01" value={editForm.maxDailyBudgetChangePercent} onChange={e => setEditForm({...editForm, maxDailyBudgetChangePercent: Number(e.target.value)})} className="h-7 w-24 text-right text-[10px]" />
                ) : (
                  <span className="font-bold text-primary">{(Number(policy.maxDailyBudgetChangePercent || 0) * 100).toFixed(0)}%</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="truncate">Teto Var. de Lance (Bid)</span>
                {editingId === policy.id ? (
                  <Input type="number" step="0.01" value={editForm.maxBidChangePercent} onChange={e => setEditForm({...editForm, maxBidChangePercent: Number(e.target.value)})} className="h-7 w-24 text-right text-[10px]" />
                ) : (
                  <span className="font-bold text-primary">{(Number(policy.maxBidChangePercent || 0) * 100).toFixed(0)}%</span>
                )}
              </div>
            </div>

          </div>
        </div>
      ))}
    </div>
  );
}
