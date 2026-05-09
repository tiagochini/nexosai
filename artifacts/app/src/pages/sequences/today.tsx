import { useRoute, Link } from "wouter";
import { useGetSequenceToday, getGetSequenceTodayQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, AlertTriangle, PlayCircle, CheckCircle2, TrendingUp } from "lucide-react";
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
      <div className="space-y-8 animate-in fade-in duration-500">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const channelColors: Record<string, string> = {
    email: "text-blue-500 border-blue-500 bg-blue-500/5",
    whatsapp: "text-green-500 border-green-500 bg-green-500/5",
    social: "text-pink-500 border-pink-500 bg-pink-500/5",
    blog: "text-orange-500 border-orange-500 bg-orange-500/5"
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
            <h1 className="text-3xl font-mono uppercase tracking-tight font-bold text-foreground">Operação do Dia</h1>
            <p className="text-sm text-muted-foreground mt-1 font-mono uppercase tracking-wider">Status tático e disparos agendados para hoje</p>
          </div>
          <div className="text-right">
            <div className="font-mono text-4xl font-bold text-primary">DIA {data?.currentDayIndex || 0}</div>
            <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground mt-1">Fase: {data?.currentPhaseLabel || 'N/A'}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-none border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Progresso da Missão</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-mono font-bold">{data?.progress || 0}%</div>
            <Progress value={data?.progress || 0} className="mt-4 h-2 rounded-none bg-muted [&>div]:bg-primary" />
          </CardContent>
        </Card>

        <Card className="rounded-none border-border bg-card col-span-1 md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Avisos e Alertas do Sistema</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {data?.warnings && data.warnings.length > 0 ? (
              <ul className="space-y-2 mt-2">
                {data.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 font-mono text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-2 font-mono text-sm text-green-500 mt-2 bg-green-500/10 border border-green-500/20 p-3">
                <CheckCircle2 className="h-4 w-4" />
                Nenhum alerta crítico reportado. Sistemas nominais.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-mono uppercase tracking-wider font-bold">Disparos de Hoje</h2>
        <div className="border border-border bg-card">
          {data?.today?.items && data.today.items.length > 0 ? (
            <div className="divide-y divide-border">
              {data.today.items.map((item) => (
                <div key={item.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={`rounded-none font-mono text-[10px] uppercase border ${channelColors[item.channel] || 'text-foreground border-border'}`}>
                        {item.channel}
                      </Badge>
                      <span className="font-mono text-sm font-bold truncate max-w-sm">{item.name}</span>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground truncate uppercase">{item.description}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {item.metadata?.generatedCopy ? (
                       <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase border-green-500 text-green-500 bg-green-500/10">Pronto p/ Disparo</Badge>
                     ) : (
                       <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase border-destructive text-destructive bg-destructive/10">Copy Pendente</Badge>
                     )}
                     <Link href={`/sequences/${sequenceId}/copy?item=${item.id}`}>
                       <Button variant="outline" size="sm" className="font-mono text-[10px] uppercase rounded-none h-7 border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                         Acessar Estúdio
                       </Button>
                     </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground font-mono text-sm uppercase flex flex-col items-center">
              <PlayCircle className="h-8 w-8 mb-4 opacity-50" />
              Nenhum disparo agendado para o dia atual.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
