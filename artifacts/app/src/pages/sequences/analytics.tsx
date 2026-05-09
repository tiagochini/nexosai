import { useRoute, Link } from "wouter";
import { useGetSequenceAnalytics, getGetSequenceAnalyticsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BarChart3, TrendingUp, Users, Target, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function SequenceAnalytics() {
  const [match, params] = useRoute("/sequences/:id/analytics");
  const sequenceId = params?.id || "";

  const { data, isLoading } = useGetSequenceAnalytics(sequenceId, {
    query: {
      enabled: !!sequenceId,
      queryKey: getGetSequenceAnalyticsQueryKey(sequenceId)
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Skeleton className="h-32 col-span-1" />
          <Skeleton className="h-32 col-span-1" />
          <Skeleton className="h-32 col-span-1" />
          <Skeleton className="h-32 col-span-1" />
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const analytics = data?.analytics;

  const getHealthColor = (score: number) => {
    if (score >= 70) return "text-green-500 bg-green-500";
    if (score >= 40) return "text-yellow-500 bg-yellow-500";
    return "text-red-500 bg-red-500";
  };

  const getHealthTextColor = (score: number) => {
    if (score >= 70) return "text-green-500";
    if (score >= 40) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col border-b border-border pb-6">
        <Link href={`/sequences/${sequenceId}`}>
          <Button variant="ghost" size="sm" className="font-mono uppercase text-xs mb-4 -ml-2 w-fit text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Sequência
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-mono uppercase tracking-tight font-bold text-foreground">Métricas Táticas</h1>
            <p className="text-sm text-muted-foreground mt-1 font-mono uppercase tracking-wider">Performance de conversão e engajamento em tempo real</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="rounded-none border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Score de Saúde</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-mono font-bold ${getHealthTextColor(analytics?.healthScore || 0)}`}>
              {analytics?.healthScore || 0}
            </div>
            <Progress 
              value={analytics?.healthScore || 0} 
              className={`mt-4 h-1 rounded-none bg-muted [&>div]:${getHealthColor(analytics?.healthScore || 0)}`} 
            />
          </CardContent>
        </Card>

        <Card className="rounded-none border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Conversões Reais</CardTitle>
            <Target className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-mono font-bold text-green-500">{analytics?.segments?.converted || 0}</div>
            <div className="font-mono text-[10px] uppercase text-muted-foreground mt-2">Leads Convertidos</div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-border bg-card col-span-1 md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Distribuição de Temperatura</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mt-2">
              <div className="flex flex-col border-l-2 border-red-500 pl-3">
                <span className="font-mono text-2xl font-bold">{analytics?.segments?.hot || 0}</span>
                <span className="font-mono text-[10px] uppercase text-red-500">Quente (Hot)</span>
              </div>
              <div className="flex flex-col border-l-2 border-yellow-500 pl-3">
                <span className="font-mono text-2xl font-bold">{analytics?.segments?.warm || 0}</span>
                <span className="font-mono text-[10px] uppercase text-yellow-500">Morno (Warm)</span>
              </div>
              <div className="flex flex-col border-l-2 border-blue-500 pl-3">
                <span className="font-mono text-2xl font-bold">{analytics?.segments?.cold || 0}</span>
                <span className="font-mono text-[10px] uppercase text-blue-500">Frio (Cold)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 border border-border bg-card flex flex-col">
          <div className="p-6 border-b border-border bg-muted/10 flex items-center justify-between">
            <h2 className="font-mono font-bold uppercase tracking-wider text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Performance por Disparo
            </h2>
          </div>
          <div className="p-0 overflow-x-auto">
            {analytics?.byItem && analytics.byItem.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="p-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Item</th>
                    <th className="p-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Abertura</th>
                    <th className="p-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Cliques</th>
                    <th className="p-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {analytics.byItem.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/10 font-mono text-sm">
                      <td className="p-4 font-bold">{item.name || `Disparo ${idx+1}`}</td>
                      <td className="p-4">{item.openRate || '0'}%</td>
                      <td className="p-4">{item.clickRate || '0'}%</td>
                      <td className="p-4 text-xs text-muted-foreground uppercase">{item.status || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center text-muted-foreground font-mono text-sm uppercase">
                Dados insuficientes para montagem do relatório tático.
              </div>
            )}
          </div>
        </div>

        <div className="border border-border bg-card flex flex-col">
          <div className="p-6 border-b border-border bg-primary/5 flex items-center justify-between">
            <h2 className="font-mono font-bold uppercase tracking-wider text-sm text-primary flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Diretrizes Adaptativas IA
            </h2>
          </div>
          <div className="p-6">
            {analytics?.adaptiveSuggestions && analytics.adaptiveSuggestions.length > 0 ? (
              <ul className="space-y-4">
                {analytics.adaptiveSuggestions.map((suggestion, idx) => (
                  <li key={idx} className="font-mono text-sm leading-relaxed text-foreground pb-4 border-b border-border last:border-0 last:pb-0">
                    <span className="text-primary mr-2">›</span> {suggestion}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center text-muted-foreground font-mono text-xs uppercase tracking-wider py-8">
                Nenhuma anomalia detectada. Inteligência artificial em repouso.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
