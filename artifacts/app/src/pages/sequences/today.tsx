import { useRoute, Link } from "wouter";
import { useGetSequenceToday, getGetSequenceTodayQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, AlertTriangle, PlayCircle, CheckCircle2, TrendingUp, Activity, AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SequenceToday() {
  const [match, params] = useRoute("/sequences/:id/today");
  const sequenceId = params?.id || "";

  const { data, isLoading } = useGetSequenceToday(sequenceId, {
    query: {
      enabled: !!sequenceId,
      queryKey: getGetSequenceTodayQueryKey(sequenceId)
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-8 w-64 bg-muted/20" />
        <Skeleton className="h-[400px] w-full bg-muted/20" />
      </div>
    );
  }

  const channelColors: Record<string, string> = {
    email: "text-blue-400 border-blue-400/40 bg-blue-400/10",
    whatsapp: "text-green-400 border-green-400/40 bg-green-400/10",
    social: "text-pink-400 border-pink-400/40 bg-pink-400/10",
    blog: "text-orange-400 border-orange-400/40 bg-orange-400/10"
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
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-mono uppercase tracking-tighter font-bold text-foreground flex items-center gap-3">
              <Activity className="h-8 w-8 text-primary" />
              Operação do Dia
            </h1>
            <p className="text-sm text-muted-foreground mt-2 font-mono uppercase tracking-widest">Status tático e disparos agendados para hoje</p>
          </div>
          <div className="text-left md:text-right bg-card/40 border border-border/50 p-4 min-w-[200px] relative overflow-hidden">
            <div className="absolute inset-0 bg-primary/5"></div>
            <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-1 relative z-10">Tempo Local</div>
            <div className="font-mono text-5xl font-bold text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.5)] relative z-10 leading-none">
              D{data?.currentDayIndex || 0}
            </div>
            <div className="font-mono text-xs uppercase tracking-widest text-foreground mt-2 relative z-10 bg-background/50 px-2 py-1 inline-block border border-border/50">
              FASE: <span className="text-primary font-bold">{data?.currentPhaseLabel || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-none border-border/50 bg-card/40 backdrop-blur-sm card-weapon">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/80">Progresso da Missão</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-mono font-bold text-foreground drop-shadow-sm">{data?.progress || 0}%</div>
            <Progress value={data?.progress || 0} className="mt-4 h-1.5 rounded-none bg-muted/50 [&>div]:bg-primary [&>div]:shadow-[0_0_8px_hsl(var(--primary)/0.5)]" />
          </CardContent>
        </Card>

        <Card className="rounded-none border-border/50 bg-card/40 backdrop-blur-sm card-weapon col-span-1 md:col-span-2">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-destructive to-transparent opacity-30"></div>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-mono uppercase tracking-widest text-muted-foreground/80">Alertas do Sistema</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive drop-shadow-[0_0_5px_hsl(var(--destructive)/0.5)]" />
          </CardHeader>
          <CardContent>
            {data?.warnings && data.warnings.length > 0 ? (
              <ul className="space-y-3 mt-2">
                {data.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-3 font-mono text-xs tracking-widest uppercase text-destructive bg-destructive/10 border border-destructive/20 p-3">
                    <AlertOctagon className="h-4 w-4 shrink-0 animate-pulse-slow" />
                    <span className="leading-tight">{w}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-success mt-2 bg-success/10 border border-success/20 p-4">
                <CheckCircle2 className="h-4 w-4 drop-shadow-[0_0_5px_hsl(var(--success))]" />
                Nenhum alerta crítico reportado. Sistemas operando nominalmente.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-mono uppercase tracking-widest font-bold text-muted-foreground">Disparos de Hoje</h2>
        <div className="border border-border/50 bg-card/40 backdrop-blur-sm relative">
          <div className="absolute left-0 inset-y-0 w-[2px] bg-gradient-to-b from-primary/50 to-transparent"></div>
          
          {data?.today?.items && data.today.items.length > 0 ? (
            <div className="divide-y divide-border/30">
              {data.today.items.map((item) => (
                <div key={item.id} className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 table-row-glow group">
                  <div className="flex flex-col space-y-2 flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge variant="outline" className={`rounded-none font-mono text-[11px] tracking-widest uppercase border ${channelColors[item.channel] || 'text-foreground border-border bg-muted/10'}`}>
                        {item.channel}
                      </Badge>
                      <span className="font-mono text-sm font-bold text-foreground truncate max-w-lg group-hover:text-primary transition-colors">{item.name}</span>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest truncate">{item.description}</span>
                  </div>
                  <div className="flex items-center gap-6 shrink-0 lg:justify-end">
                    {item.metadata?.generatedCopy ? (
                       <Badge variant="outline" className="rounded-none font-mono text-[11px] tracking-widest uppercase border-success/40 text-success bg-success/10 px-3 py-1.5 badge-glow-green">Pronto p/ Disparo</Badge>
                     ) : (
                       <Badge variant="outline" className="rounded-none font-mono text-[11px] tracking-widest uppercase border-destructive/40 text-destructive bg-destructive/10 px-3 py-1.5 badge-glow-red animate-pulse-slow">Copy Pendente</Badge>
                     )}
                     <Link href={`/sequences/${sequenceId}/copy?item=${item.id}`}>
                       <Button variant="outline" size="sm" className="font-mono text-xs tracking-widest uppercase rounded-none h-9 px-5 border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground btn-weapon-outline">
                         Acessar Estúdio
                       </Button>
                     </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-16 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full border border-border/50 flex items-center justify-center mb-6 bg-muted/10">
                <PlayCircle className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground font-bold mb-2">Sem atividade operacional</p>
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground/60">Nenhum disparo agendado para o ciclo solar atual.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
