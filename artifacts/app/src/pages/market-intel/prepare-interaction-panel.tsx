import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Globe, AlertTriangle } from "lucide-react";
import { useInteractionCapabilities, usePrepareRegionalAudienceInteraction } from "@/hooks/use-interaction-governance";

interface Props {
  opportunityId: string;
  onSuccess: (createdId: string) => void;
  onCancel: () => void;
}

export function PrepareInteractionPanel({ opportunityId, onSuccess, onCancel }: Props) {
  const { data: capData, isLoading: capLoading } = useInteractionCapabilities();
  const prepare = usePrepareRegionalAudienceInteraction();

  const [integrationId, setIntegrationId] = useState("");
  const [action, setAction] = useState("");

  if (capLoading) return <div className="p-4 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto text-primary" /></div>;

  const capabilities = (capData?.capabilities || []).filter((c: any) => c.enabled);

  if (capabilities.length === 0) {
    return (
      <div className="mt-3 p-3 bg-destructive/10 border border-destructive/30 rounded-sm">
        <p className="text-[10px] text-destructive flex items-center gap-1 font-semibold">
          <AlertTriangle className="h-3 w-3" /> Nenhuma capability ou conta conectada compatível.
        </p>
        <p className="text-[10px] text-destructive/80 mt-1">Conecte contas e ative capabilities na aba Governança para interagir.</p>
        <Button size="sm" variant="ghost" className="mt-2 text-[10px] h-6" onClick={onCancel}>Fechar</Button>
      </div>
    );
  }

  return (
    <div className="mt-3 p-3 bg-background border border-border/50 rounded-sm space-y-3">
      <p className="text-[10px] uppercase text-muted-foreground font-mono">Preparar Interação</p>
      <div className="space-y-2">
        <div>
          <label className="text-[10px] text-muted-foreground uppercase">Conta / Capability</label>
          <select
            value={integrationId}
            onChange={e => {
              setIntegrationId(e.target.value);
              setAction(""); // reset action when integration changes
            }}
            className="w-full bg-background border border-border/50 rounded-sm p-1.5 text-xs focus:outline-none"
          >
            <option value="">Selecione uma conta...</option>
            {Array.from(new Set(capabilities.map((c: any) => c.integrationId))).map((id: any) => {
              const cap = capabilities.find((c: any) => c.integrationId === id);
              return <option key={id} value={id}>{cap.platform}</option>;
            })}
          </select>
        </div>
        {integrationId && (
          <div>
            <label className="text-[10px] text-muted-foreground uppercase">Ação Permitida</label>
            <select
              value={action}
              onChange={e => setAction(e.target.value)}
              className="w-full bg-background border border-border/50 rounded-sm p-1.5 text-xs focus:outline-none"
            >
              <option value="">Selecione uma ação...</option>
              {capabilities
                .filter((c: any) => c.integrationId === integrationId)
                .map((c: any) => (
                  <option key={c.action} value={c.action}>{c.action.replace(/_/g, ' ')}</option>
                ))}
            </select>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          className="flex-1 text-[10px] h-7"
          disabled={!integrationId || !action || prepare.isPending}
          onClick={() => {
            prepare.mutate({ id: opportunityId, integrationId, action }, {
              onSuccess: (data: any) => {
                if (data?.opportunity?.id) onSuccess(data.opportunity.id);
                else onSuccess("");
              },
              onError: (err: any) => alert(err?.data?.error || "Erro ao preparar interação. Verifique as restrições da capability.")
            });
          }}
        >
          {prepare.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
          Preparar na Central
        </Button>
        <Button size="sm" variant="ghost" className="text-[10px] h-7" onClick={onCancel}>Cancelar</Button>
      </div>
      <p className="text-[9px] text-muted-foreground leading-tight">Isto cria uma oportunidade na Central de Interação para uma abordagem assistida. Não publica nada automaticamente.</p>
    </div>
  );
}
