import { useRoute, Link, useLocation } from "wouter";
import { useGetCampaign, useExecuteCampaign, CampaignExecuteInputPhase, getGetCampaignQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, Play, Settings, FileText, BarChart, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

export default function CampaignDetail() {
  const [match, params] = useRoute("/campaigns/:id");
  const campaignId = params?.id || "";
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data, isLoading } = useGetCampaign(campaignId, {
    query: {
      enabled: !!campaignId,
      queryKey: getGetCampaignQueryKey(campaignId)
    }
  });

  const executeMutation = useExecuteCampaign({
    mutation: {
      onSuccess: () => {
        toast.success("Fase iniciada com sucesso.");
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
      },
      onError: () => {
        toast.error("Falha ao iniciar fase.");
      }
    }
  });

  const handleExecute = (phase: CampaignExecuteInputPhase) => {
    executeMutation.mutate({
      campaignId,
      data: { phase }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data?.campaign) return <div className="p-8 text-center uppercase font-mono text-muted-foreground">Campanha não encontrada</div>;

  const { campaign } = data;

  const phases: { id: CampaignExecuteInputPhase; label: string }[] = [
    { id: "strategy", label: "Estratégia" },
    { id: "content", label: "Conteúdo" },
    { id: "launch", label: "Lançamento" },
    { id: "monitor", label: "Monitoramento" }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-border pb-6">
        <div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="font-mono uppercase text-xs mb-4 -ml-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Painel de Controle
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-mono uppercase tracking-tight font-bold text-foreground">{campaign.title}</h1>
            <Badge variant="outline" className="font-mono uppercase text-xs rounded-none bg-primary/10 text-primary border-primary/20">
              {campaign.status}
            </Badge>
          </div>
          <div className="flex gap-4 text-xs font-mono uppercase tracking-wider text-muted-foreground mt-2">
            <span>Tipo: {campaign.type}</span>
            <span>Alvo: {campaign.track}</span>
            {campaign.revenueTarget && <span>Meta: R$ {campaign.revenueTarget}</span>}
          </div>
        </div>
        <div className="flex gap-4">
          <Link href={`/campaigns/${campaign.id}/intake`}>
            <Button variant="outline" className="font-mono uppercase tracking-wider rounded-none gap-2 border-border">
              <FileText className="h-4 w-4" />
              Intake
            </Button>
          </Link>
          <Button onClick={() => setLocation("/sequences")} className="font-mono uppercase tracking-wider rounded-none gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Sequências
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {phases.map((phase, index) => {
          const isPending = executeMutation.isPending && executeMutation.variables?.data.phase === phase.id;
          return (
            <div key={phase.id} className="border border-border bg-card p-6 relative flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full border border-border flex items-center justify-center bg-muted/30">
                <span className="font-mono font-bold text-lg text-muted-foreground">{index + 1}</span>
              </div>
              <div>
                <h3 className="font-mono font-bold uppercase tracking-wider">{phase.label}</h3>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="font-mono uppercase text-xs rounded-none border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                onClick={() => handleExecute(phase.id)}
                disabled={executeMutation.isPending}
              >
                {isPending ? "Iniciando..." : <><Play className="h-3 w-3 mr-2" /> Iniciar Fase</>}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
