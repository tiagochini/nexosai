import { Link } from "wouter";
import { useListCampaigns, useGetCreditsBalance } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Rocket, Plus, Activity, AlertTriangle, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: campaignsData, isLoading: isLoadingCampaigns } = useListCampaigns();
  const { data: creditsData, isLoading: isLoadingCredits } = useGetCreditsBalance();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'badge-glow-green text-success border-success/40 bg-success/10';
      case 'executing': return 'badge-glow-blue text-primary border-primary/40 bg-primary/10';
      case 'draft': return 'text-muted-foreground border-border bg-muted/20';
      default: return 'badge-glow-primary text-primary border-primary/40 bg-primary/10';
    }
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      draft: 'Rascunho',
      analyzing: 'Analisando',
      strategy_ready: 'Estratégia Pronta',
      generating: 'Gerando',
      awaiting_approval: 'Aguardando Aprovação',
      approved: 'Aprovado',
      executing: 'Em Execução',
      live: 'Ao Vivo',
      completed: 'Concluído'
    };
    return map[status] || status;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-border/50 pb-6">
        <div>
          <h1 className="text-4xl font-mono uppercase tracking-tighter font-bold text-foreground flex items-center gap-3">
            Visão Geral Operacional
          </h1>
          <p className="text-sm text-muted-foreground mt-2 font-mono uppercase tracking-widest">Métricas em tempo real e status das missões.</p>
        </div>
        <Link href="/campaigns/new">
          <Button className="font-mono uppercase tracking-widest font-bold rounded-none gap-2 btn-weapon-primary px-6">
            <Plus className="h-4 w-4" />
            Nova Campanha
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-none border-border/50 bg-card/40 backdrop-blur-sm card-weapon relative overflow-hidden group">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/80">Campanhas Ativas</CardTitle>
            <Activity className="h-4 w-4 text-primary drop-shadow-[0_0_5px_hsl(var(--primary)/0.5)]" />
          </CardHeader>
          <CardContent>
            {isLoadingCampaigns ? <Skeleton className="h-8 w-16 bg-muted/20" /> : (
              <div className="text-4xl font-mono font-bold text-foreground drop-shadow-md">{campaignsData?.campaigns?.filter(c => c.status !== 'completed').length || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-none border-border/50 bg-card/40 backdrop-blur-sm card-weapon relative overflow-hidden group">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/80">Créditos de Inteligência</CardTitle>
            <Rocket className="h-4 w-4 text-primary drop-shadow-[0_0_5px_hsl(var(--primary)/0.5)]" />
          </CardHeader>
          <CardContent>
            {isLoadingCredits ? <Skeleton className="h-8 w-24 bg-muted/20" /> : (
              <div className="flex items-baseline gap-3">
                <div className="text-4xl font-mono font-bold text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.5)]">{creditsData?.balance || 0}</div>
                {creditsData?.balance && creditsData.balance < 50 && (
                  <Badge variant="destructive" className="rounded-none font-mono text-[9px] uppercase tracking-widest badge-glow-red animate-pulse-slow">Nível Crítico</Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-none border-border/50 bg-card/40 backdrop-blur-sm card-weapon relative overflow-hidden group">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-success to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/80">Status Global</CardTitle>
            <ShieldCheck className="h-4 w-4 text-success drop-shadow-[0_0_5px_hsl(var(--success)/0.5)]" />
          </CardHeader>
          <CardContent>
             <div className="text-2xl font-mono font-bold text-success uppercase tracking-widest drop-shadow-[0_0_8px_hsl(var(--success)/0.6)] flex items-center gap-2">
               Nominal
               <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
             </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-mono uppercase tracking-widest font-bold text-muted-foreground">Missões Recentes</h2>
        <div className="border border-border/50 bg-card/40 backdrop-blur-sm relative">
          <div className="absolute left-0 inset-y-0 w-[2px] bg-gradient-to-b from-primary/50 to-transparent"></div>
          {isLoadingCampaigns ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-16 w-full bg-muted/20" />
              <Skeleton className="h-16 w-full bg-muted/20" />
            </div>
          ) : campaignsData?.campaigns?.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full border border-border/50 flex items-center justify-center mb-4 bg-muted/10 relative">
                <div className="absolute inset-0 rounded-full border border-primary/30 animate-pulse-slow"></div>
                <AlertTriangle className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest">
                Radar limpo. Nenhuma missão ativa.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {campaignsData?.campaigns?.map(campaign => (
                <div key={campaign.id} className="p-5 flex items-center justify-between table-row-glow group">
                  <div className="flex items-center gap-5">
                    <div className={`w-1.5 h-6 ${campaign.status === 'live' ? 'bg-success shadow-[0_0_8px_hsl(var(--success))]' : 'bg-primary/50'}`}></div>
                    <div>
                      <h3 className="font-bold font-mono text-base truncate max-w-xs md:max-w-md group-hover:text-primary transition-colors">{campaign.title}</h3>
                      <div className="flex gap-3 text-[10px] text-muted-foreground mt-1.5 uppercase font-mono tracking-widest">
                        <span className="bg-background/50 px-2 py-0.5 border border-border/50">{campaign.type}</span>
                        <span className="bg-background/50 px-2 py-0.5 border border-border/50">{campaign.track}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <Badge variant="outline" className={`rounded-none font-mono text-[9px] tracking-widest uppercase ${getStatusColor(campaign.status)} px-3 py-1 border`}>
                      {getStatusLabel(campaign.status)}
                    </Badge>
                    <Link href={`/campaigns/${campaign.id}`}>
                      <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-xs tracking-wider btn-weapon-outline h-9 px-4">
                        Acessar Painel
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
