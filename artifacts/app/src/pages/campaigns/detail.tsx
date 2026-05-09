import { useRoute, Link, useLocation } from "wouter";
import { useGetCampaign, useExecuteCampaign, CampaignExecuteInputPhase, getGetCampaignQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, FileText, FileSpreadsheet, Lock } from "lucide-react";
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
      <div className="space-y-8">
        <Skeleton className="h-8 w-64 bg-muted/20" />
        <Skeleton className="h-64 w-full bg-muted/20" />
      </div>
    );
  }

  if (!data?.campaign) return <div className="p-16 text-center uppercase font-mono text-muted-foreground tracking-widest">Campanha não encontrada no registro</div>;

  const { campaign } = data;

  const phases: { id: CampaignExecuteInputPhase; label: string }[] = [
    { id: "strategy", label: "Estratégia" },
    { id: "content", label: "Conteúdo" },
    { id: "launch", label: "Lançamento" },
    { id: "monitor", label: "Monitoramento" }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'badge-glow-green text-success border-success/40 bg-success/10';
      case 'executing': return 'badge-glow-blue text-primary border-primary/40 bg-primary/10';
      case 'draft': return 'text-muted-foreground border-border bg-muted/20';
      default: return 'badge-glow-primary text-primary border-primary/40 bg-primary/10';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-border/50 pb-6">
        <div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="font-mono uppercase text-[10px] tracking-widest mb-6 -ml-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3 mr-2" />
              Retornar ao Radar
            </Button>
          </Link>
          <div className="flex items-center gap-5">
            <h1 className="text-4xl font-mono uppercase tracking-tighter font-bold text-foreground drop-shadow-sm">{campaign.title}</h1>
            <Badge variant="outline" className={`font-mono uppercase text-[10px] tracking-widest rounded-none px-3 py-1 border ${getStatusColor(campaign.status)}`}>
              {campaign.status}
            </Badge>
          </div>
          <div className="flex gap-4 text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-4 flex-wrap">
            <span className="bg-card px-3 py-1 border border-border/50 shadow-sm">TIPO: {campaign.type}</span>
            <span className="bg-card px-3 py-1 border border-border/50 shadow-sm">ALVO: <span className="text-primary">{campaign.track}</span></span>
            {campaign.revenueTarget && <span className="bg-card px-3 py-1 border border-border/50 shadow-sm">META: R$ {campaign.revenueTarget}</span>}
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <Link href={`/campaigns/${campaign.id}/intake`}>
            <Button variant="outline" className="font-mono uppercase tracking-widest rounded-none gap-2 border-border/50 hover:border-primary/50 hover:text-primary transition-all h-10 px-5">
              <FileText className="h-4 w-4" />
              Intake
            </Button>
          </Link>
          <Button onClick={() => setLocation("/sequences")} className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-10 px-5">
            <FileSpreadsheet className="h-4 w-4" />
            Matriz de Sequências
          </Button>
        </div>
      </div>

      <div className="relative pt-12 pb-8">
        {/* Connecting Line */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-border/40 -z-10 hidden md:block"></div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-4 relative z-10">
          {phases.map((phase, index) => {
            const isPending = executeMutation.isPending && executeMutation.variables?.data.phase === phase.id;
            const isFuture = false; // Logic to determine if phase is not yet accessible can go here
            
            return (
              <div key={phase.id} className="card-weapon border border-border/50 bg-card/80 backdrop-blur-md p-6 flex flex-col items-center justify-center text-center space-y-6 group">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border border-border bg-background flex items-center justify-center relative z-10 group-hover:border-primary/50 group-hover:shadow-[0_0_15px_hsl(var(--primary)/0.3)] transition-all">
                    <span className="font-mono font-bold text-xl text-muted-foreground group-hover:text-primary transition-colors">0{index + 1}</span>
                  </div>
                  {/* Phase glow behind circle */}
                  <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
                
                <div>
                  <h3 className="font-mono font-bold uppercase tracking-widest text-sm group-hover:text-primary transition-colors">{phase.label}</h3>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mt-2">Subsistema</p>
                </div>
                
                {isFuture ? (
                  <Button disabled variant="outline" className="font-mono uppercase text-[10px] tracking-widest rounded-none border-border/30 h-8 px-4 w-full">
                    <Lock className="h-3 w-3 mr-2 opacity-50" /> Bloqueado
                  </Button>
                ) : (
                  <Button 
                    variant="outline" 
                    className="font-mono uppercase text-[10px] tracking-widest rounded-none border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground h-8 px-4 w-full hover:shadow-[0_0_10px_hsl(var(--primary)/0.4)] transition-all"
                    onClick={() => handleExecute(phase.id)}
                    disabled={executeMutation.isPending}
                  >
                    {isPending ? "Processando..." : <><Play className="h-3 w-3 mr-2 fill-current" /> Iniciar Fase</>}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
