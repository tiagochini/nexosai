import { Link } from "wouter";
import { useListCampaigns, useGetCreditsBalance } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Rocket, Plus, Activity, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: campaignsData, isLoading: isLoadingCampaigns } = useListCampaigns();
  const { data: creditsData, isLoading: isLoadingCredits } = useGetCreditsBalance();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'executing': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'draft': return 'bg-muted text-muted-foreground border-border';
      default: return 'bg-primary/10 text-primary border-primary/20';
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-mono uppercase tracking-tight font-bold text-foreground">Visão Geral Operacional</h1>
          <p className="text-sm text-muted-foreground mt-1">Métricas em tempo real e status das missões.</p>
        </div>
        <Link href="/campaigns/new">
          <Button className="font-mono uppercase tracking-wider rounded-none gap-2">
            <Plus className="h-4 w-4" />
            Nova Campanha
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-none border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Campanhas Ativas</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoadingCampaigns ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-3xl font-mono font-bold">{campaignsData?.campaigns?.filter(c => c.status !== 'completed').length || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-none border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Créditos de Inteligência</CardTitle>
            <Rocket className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoadingCredits ? <Skeleton className="h-8 w-24" /> : (
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-mono font-bold">{creditsData?.balance || 0}</div>
                {creditsData?.balance && creditsData.balance < 50 && (
                  <Badge variant="destructive" className="rounded-none font-mono text-[10px] uppercase">Nível Crítico</Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-none border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Status Global</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             <div className="text-xl font-mono font-bold text-green-500 uppercase">Nominal</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-mono uppercase tracking-wider font-bold">Missões Recentes</h2>
        <div className="border border-border bg-card">
          {isLoadingCampaigns ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : campaignsData?.campaigns?.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground font-mono text-sm uppercase">
              Nenhuma campanha registrada no sistema.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {campaignsData?.campaigns?.map(campaign => (
                <div key={campaign.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-2 bg-primary"></div>
                    <div>
                      <h3 className="font-bold font-mono truncate max-w-xs md:max-w-md">{campaign.title}</h3>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-1 uppercase font-mono">
                        <span>{campaign.type}</span>
                        <span>•</span>
                        <span>{campaign.track}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className={`rounded-none font-mono text-[10px] uppercase ${getStatusColor(campaign.status)}`}>
                      {getStatusLabel(campaign.status)}
                    </Badge>
                    <Link href={`/campaigns/${campaign.id}`}>
                      <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-xs">
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
