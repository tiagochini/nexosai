import { useRoute, Link } from "wouter";
import { useGetSequenceCalendar, getGetSequenceCalendarQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, Circle, Clock } from "lucide-react";
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
      <div className="space-y-8">
        <Skeleton className="h-8 w-64 bg-muted/20" />
        <Skeleton className="h-[600px] w-full bg-muted/20" />
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
          <Button variant="ghost" size="sm" className="font-mono uppercase text-[10px] tracking-widest mb-6 -ml-2 w-fit text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3 mr-2" />
            Retornar à Sequência
          </Button>
        </Link>
        <h1 className="text-4xl font-mono uppercase tracking-tighter font-bold text-foreground">Cronograma de Disparo</h1>
        <p className="text-sm text-muted-foreground mt-2 font-mono uppercase tracking-widest">Visualização tática linear</p>
      </div>

      <div className="grid gap-8">
        {data?.days?.map((day) => (
          <div key={day.dayIndex} className="card-weapon border border-border/50 bg-card/40 flex overflow-hidden group">
            {/* Day Header Block */}
            <div className="w-32 bg-gradient-to-b from-muted/30 to-muted/10 border-r border-border/50 flex flex-col items-center justify-center p-4 shrink-0 relative overflow-hidden">
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="font-mono text-[10px] uppercase text-primary font-bold tracking-[0.2em] mb-2">Dia</span>
              <span className="font-mono text-4xl font-bold text-foreground drop-shadow-sm">{day.dayIndex}</span>
              {day.date && <span className="font-mono text-[10px] text-muted-foreground mt-3 uppercase tracking-widest">{day.date}</span>}
            </div>

            {/* Content Block */}
            <div className="flex-1 p-0 flex flex-col">
              {/* Phase Header */}
              <div className="px-6 py-3 border-b border-border/50 bg-background/50 font-mono text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center">
                <span className="opacity-60 mr-2">FASE:</span> 
                <span className="text-primary border-b border-primary/30 pb-0.5">{day.phaseLabel}</span>
              </div>

              {/* Items List */}
              <div className="p-0 bg-card/20">
                {day.items.length === 0 ? (
                  <div className="px-8 py-8 flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground/40" />
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                      Pausa tática (Nenhum disparo agendado)
                    </span>
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {day.items.map((item) => (
                      <div key={item.id} className="px-6 py-5 flex flex-col xl:flex-row xl:items-center justify-between gap-5 table-row-glow">
                        <div className="flex flex-col space-y-2 flex-1 min-w-0 pr-4">
                          <div className="flex items-center gap-3 flex-wrap">
                            <Badge variant="outline" className={`rounded-none font-mono text-[9px] tracking-widest uppercase border ${channelColors[item.channel] || 'text-foreground border-border bg-muted/10'}`}>
                              {item.channel}
                            </Badge>
                            <span className="font-mono text-sm font-bold text-foreground truncate max-w-lg">{item.name}</span>
                          </div>
                          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest line-clamp-2">{item.description}</span>
                        </div>
                        
                        <div className="flex items-center gap-6 shrink-0 xl:justify-end">
                           {item.metadata?.generatedCopy ? (
                             <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-success bg-success/10 px-3 py-1.5 border border-success/20">
                               <CheckCircle2 className="h-3 w-3" /> Copy Pronta
                             </div>
                           ) : (
                             <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground bg-muted/20 px-3 py-1.5 border border-border/50">
                               <Circle className="h-3 w-3" /> Pendente
                             </div>
                           )}
                           <Link href={`/sequences/${sequenceId}/copy?item=${item.id}`}>
                             <Button variant="outline" size="sm" className="font-mono text-[10px] tracking-widest uppercase rounded-none h-8 px-4 border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground btn-weapon-outline">
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
