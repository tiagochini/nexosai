import { useRoute, Link } from "wouter";
import { useGetSequenceAnalytics, getGetSequenceAnalyticsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BarChart3, TrendingUp, Users, Target, Activity, Flame, Snowflake, Sun } from "lucide-react";
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
      <div className="space-y-8">
        <Skeleton className="h-8 w-64 bg-muted/20" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Skeleton className="h-32 col-span-1 bg-muted/20" />
          <Skeleton className="h-32 col-span-1 bg-muted/20" />
          <Skeleton className="h-32 col-span-1 bg-muted/20" />
          <Skeleton className="h-32 col-span-1 bg-muted/20" />
        </div>
        <Skeleton className="h-[400px] w-full bg-muted/20" />
      </div>
    );
  }

  const analytics = data?.analytics;

  const getHealthColor = (score: number) => {
    if (score >= 70) return "text-success bg-success shadow-[0_0_10px_hsl(var(--success)/0.5)]";
    if (score >= 40) return "text-yellow-400 bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]";
    return "text-destructive bg-destructive shadow-[0_0_10px_hsl(var(--destructive)/0.5)]";
  };

  const getHealthTextColor = (score: number) => {
    if (score >= 70) return "text-success drop-shadow-[0_0_8px_hsl(var(--success)/0.5)]";
    if (score >= 40) return "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]";
    return "text-destructive drop-shadow-[0_0_8px_hsl(var(--destructive)/0.5)]";
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col border-b border-border/50 pb-6">
        <Link href={`/sequences/${sequenceId}`}>
          <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest mb-6 -ml-2 w-fit text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3 mr-2" />
            Retornar à Sequência
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-mono uppercase tracking-tighter font-bold text-foreground flex items-center gap-3">
              Métricas Táticas
            </h1>
            <p className="text-sm text-muted-foreground mt-2 font-mono uppercase tracking-widest">Performance de conversão e engajamento em tempo real</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="rounded-none border-border/50 bg-card/40 backdrop-blur-sm card-weapon">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/80">Score de Saúde</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground/50" />
          </CardHeader>
          <CardContent>
            <div className={`text-5xl font-mono font-bold ${getHealthTextColor(analytics?.healthScore || 0)}`}>
              {analytics?.healthScore || 0}
            </div>
            <Progress 
              value={analytics?.healthScore || 0} 
              className="mt-4 h-1.5 rounded-none bg-muted/50"
            />
          </CardContent>
        </Card>

        <Card className="rounded-none border-border/50 bg-card/40 backdrop-blur-sm card-weapon">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-success to-transparent opacity-50"></div>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/80">Conversões</CardTitle>
            <Target className="h-4 w-4 text-success drop-shadow-[0_0_5px_hsl(var(--success)/0.5)]" />
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-mono font-bold text-success drop-shadow-[0_0_10px_hsl(var(--success)/0.3)]">{analytics?.segments?.converted || 0}</div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mt-3 border-t border-border/30 pt-2">Leads Convertidos</div>
          </CardContent>
        </Card>

        <Card className="rounded-none border-border/50 bg-card/40 backdrop-blur-sm card-weapon col-span-1 md:col-span-2">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-30"></div>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/80">Temperatura da Base</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground/50" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mt-1">
              <div className="flex flex-col border-l-2 border-red-500/50 pl-4 bg-gradient-to-r from-red-500/5 to-transparent py-2 relative overflow-hidden group">
                <Flame className="absolute -right-2 -bottom-2 h-12 w-12 text-red-500/10 group-hover:text-red-500/20 transition-colors" />
                <span className="font-mono text-3xl font-bold text-foreground drop-shadow-sm">{analytics?.segments?.hot || 0}</span>
                <span className="font-mono text-[11px] uppercase tracking-widest text-red-400 mt-1">Quente (Hot)</span>
              </div>
              <div className="flex flex-col border-l-2 border-yellow-500/50 pl-4 bg-gradient-to-r from-yellow-500/5 to-transparent py-2 relative overflow-hidden group">
                <Sun className="absolute -right-2 -bottom-2 h-12 w-12 text-yellow-500/10 group-hover:text-yellow-500/20 transition-colors" />
                <span className="font-mono text-3xl font-bold text-foreground drop-shadow-sm">{analytics?.segments?.warm || 0}</span>
                <span className="font-mono text-[11px] uppercase tracking-widest text-yellow-400 mt-1">Morno (Warm)</span>
              </div>
              <div className="flex flex-col border-l-2 border-blue-500/50 pl-4 bg-gradient-to-r from-blue-500/5 to-transparent py-2 relative overflow-hidden group">
                <Snowflake className="absolute -right-2 -bottom-2 h-12 w-12 text-blue-500/10 group-hover:text-blue-500/20 transition-colors" />
                <span className="font-mono text-3xl font-bold text-foreground drop-shadow-sm">{analytics?.segments?.cold || 0}</span>
                <span className="font-mono text-[11px] uppercase tracking-widest text-blue-400 mt-1">Frio (Cold)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 border border-border/50 bg-card/40 backdrop-blur-sm flex flex-col card-weapon">
          <div className="p-5 border-b border-border/50 bg-background/50 flex items-center justify-between">
            <h2 className="font-mono font-bold uppercase tracking-widest text-xs flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="h-4 w-4 text-primary" /> Performance Disparos
            </h2>
          </div>
          <div className="p-0 overflow-x-auto custom-scrollbar">
            {analytics?.byItem && analytics.byItem.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/20">
                    <th className="p-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Peça Tática</th>
                    <th className="p-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Abertura</th>
                    <th className="p-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Cliques</th>
                    <th className="p-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {analytics.byItem.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/10 font-mono text-sm table-row-glow transition-colors">
                      <td className="p-4 font-bold text-foreground">{item.name || `Disparo ${idx+1}`}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className={item.openRate > 20 ? 'text-success' : ''}>{item.openRate || '0'}%</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className={item.clickRate > 5 ? 'text-primary' : ''}>{item.clickRate || '0'}%</span>
                        </div>
                      </td>
                      <td className="p-4">
                         <span className="text-xs text-muted-foreground uppercase tracking-widest bg-background/50 px-2 py-1 border border-border/50">{item.status || 'N/A'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-16 text-center text-muted-foreground font-mono text-xs uppercase tracking-widest">
                Dados insuficientes para montagem do relatório tático.
              </div>
            )}
          </div>
        </div>

        <div className="border border-border/50 bg-card/40 backdrop-blur-sm flex flex-col card-weapon">
          <div className="p-5 border-b border-border/50 bg-primary/5 flex items-center justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
            <h2 className="font-mono font-bold uppercase tracking-widest text-xs text-primary flex items-center gap-2 relative z-10">
              <TrendingUp className="h-4 w-4" /> agente: Diretrizes Adaptativas
            </h2>
          </div>
          <div className="p-6">
            {analytics?.adaptiveSuggestions && analytics.adaptiveSuggestions.length > 0 ? (
              <ul className="space-y-4">
                {analytics.adaptiveSuggestions.map((suggestion, idx) => (
                  <li key={idx} className="font-mono text-[11px] leading-relaxed text-foreground pb-4 border-b border-border/30 last:border-0 last:pb-0 flex items-start gap-3">
                    <span className="text-primary mt-1 drop-shadow-[0_0_5px_hsl(var(--primary))]">›</span> 
                    <span className="opacity-90">{suggestion}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center flex flex-col items-center justify-center py-10">
                <div className="w-12 h-12 rounded-full border border-border/50 bg-muted/10 flex items-center justify-center mb-4">
                  <Activity className="h-5 w-5 text-muted-foreground/30" />
                </div>
                <div className="text-muted-foreground font-mono text-[11px] uppercase tracking-widest leading-relaxed max-w-[200px]">
                  Nenhuma anomalia detectada. Inteligência artificial em repouso.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
