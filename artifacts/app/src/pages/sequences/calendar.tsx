import { useRoute, Link } from "wouter";
import { useGetSequenceCalendar, getGetSequenceCalendarQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SequenceCalendar() {
  const [match, params] = useRoute("/sequences/:id/calendar");
  const sequenceId = params?.id || "";

  const { data, isLoading } = useGetSequenceCalendar(sequenceId, {
    query: {
      enabled: !!sequenceId,
      queryKey: getGetSequenceCalendarQueryKey(sequenceId)
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[600px] w-full" />
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
        <h1 className="text-3xl font-mono uppercase tracking-tight font-bold text-foreground">Cronograma de Disparo</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono uppercase tracking-wider">Visualização tática linear</p>
      </div>

      <div className="grid gap-6">
        {data?.days?.map((day) => (
          <div key={day.dayIndex} className="border border-border bg-card flex overflow-hidden">
            {/* Day Header Block */}
            <div className="w-24 bg-muted/50 border-r border-border flex flex-col items-center justify-center p-4 shrink-0">
              <span className="font-mono text-xs uppercase text-muted-foreground tracking-widest mb-1">Dia</span>
              <span className="font-mono text-3xl font-bold">{day.dayIndex}</span>
              {day.date && <span className="font-mono text-[10px] text-muted-foreground mt-2">{day.date}</span>}
            </div>

            {/* Content Block */}
            <div className="flex-1 p-0 flex flex-col">
              {/* Phase Header */}
              <div className="px-6 py-2 border-b border-border bg-muted/10 font-mono text-xs uppercase font-bold tracking-wider text-primary">
                Fase: {day.phaseLabel}
              </div>

              {/* Items List */}
              <div className="p-0">
                {day.items.length === 0 ? (
                  <div className="px-6 py-4 text-xs font-mono text-muted-foreground uppercase tracking-widest">
                    Pausa tática (Nenhum disparo agendado)
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {day.items.map((item) => (
                      <div key={item.id} className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                             <div className="flex items-center gap-1 font-mono text-xs uppercase text-green-500">
                               <CheckCircle2 className="h-4 w-4" /> Copy Pronta
                             </div>
                           ) : (
                             <div className="flex items-center gap-1 font-mono text-xs uppercase text-muted-foreground">
                               <Circle className="h-4 w-4" /> Pendente
                             </div>
                           )}
                           <Link href={`/sequences/${sequenceId}/copy?item=${item.id}`}>
                             <Button variant="outline" size="sm" className="font-mono text-[10px] uppercase rounded-none h-7 border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                               Ir p/ Estúdio
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
        ))}
      </div>
    </div>
  );
}
