import { Link } from "wouter";
import { useListSequences, getListSequencesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, Workflow, Calendar, Activity, Eye, BarChart, AlertTriangle } from "lucide-react";

export default function SequencesList() {
  const { data, isLoading } = useListSequences({
    query: {
      queryKey: getListSequencesQueryKey()
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'live': return <Badge variant="outline" className="rounded-none font-mono text-[9px] uppercase tracking-widest bg-success/10 text-success border-success/40 badge-glow-green">Operante</Badge>;
      case 'draft': return <Badge variant="outline" className="rounded-none font-mono text-[9px] uppercase tracking-widest bg-muted/20 text-muted-foreground border-border/50">Rascunho</Badge>;
      case 'generating': return <Badge variant="outline" className="rounded-none font-mono text-[9px] uppercase tracking-widest bg-primary/10 text-primary border-primary/40 badge-glow-blue animate-pulse-slow">Gerando</Badge>;
      default: return <Badge variant="outline" className="rounded-none font-mono text-[9px] uppercase tracking-widest bg-primary/10 text-primary border-primary/40 badge-glow-primary">{status}</Badge>;
    }
  };

  const getModelName = (model: string) => {
    const models: Record<string, string> = {
      plf: "PLF",
      formula_de_lancamento: "Fórmula de Lançamento",
      semente: "Semente",
      afiliado: "Afiliado",
      perpetual: "Perpétuo",
      custom: "Custom"
    };
    return models[model] || model;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-border/50 pb-6">
        <div>
          <h1 className="text-4xl font-mono uppercase tracking-tighter font-bold text-foreground flex items-center gap-3">
            Matriz de Sequências
          </h1>
          <p className="text-sm text-muted-foreground mt-2 font-mono uppercase tracking-widest">Canais de disparo e automação programada</p>
        </div>
        <Link href="/sequences/new">
          <Button className="font-mono uppercase tracking-widest font-bold rounded-none gap-2 btn-weapon-primary px-6">
            <Plus className="h-4 w-4" />
            Nova Sequência
          </Button>
        </Link>
      </div>

      <div className="border border-border/50 bg-card/40 backdrop-blur-sm relative">
        <div className="absolute left-0 inset-y-0 w-[2px] bg-gradient-to-b from-primary/50 to-transparent"></div>
        {isLoading ? (
          <div className="p-8 space-y-4">
            <Skeleton className="h-16 w-full bg-muted/20" />
            <Skeleton className="h-16 w-full bg-muted/20" />
          </div>
        ) : data?.sequences?.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center border-t border-border/50">
            <div className="w-16 h-16 rounded-full border border-border/50 flex items-center justify-center mb-4 bg-muted/10 relative">
              <div className="absolute inset-0 rounded-full border border-primary/30 animate-pulse-slow"></div>
              <Workflow className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest mb-6">Nenhuma matriz detectada no radar.</p>
            <Link href="/sequences/new">
              <Button variant="outline" className="font-mono uppercase tracking-widest rounded-none border-primary/50 text-primary hover:bg-primary/10 h-10 px-6 btn-weapon-outline">
                Inicializar Matriz
              </Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {data?.sequences?.map(seq => (
              <div key={seq.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between table-row-glow group gap-4 relative">
                <div className="flex items-start gap-5">
                  <div className="w-10 h-10 border border-border/50 bg-background/50 flex items-center justify-center shrink-0 relative">
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <Workflow className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold font-mono uppercase tracking-wider text-lg group-hover:text-primary transition-colors">{seq.name}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-muted-foreground mt-2 uppercase font-mono tracking-widest">
                      <span className="flex items-center gap-2 border border-border/50 px-2 py-1 bg-background/30 shadow-sm">
                        <span className="opacity-50">Modelo:</span> <span className="text-primary font-bold">{getModelName(seq.model)}</span>
                      </span>
                      <span className="flex items-center gap-2 border border-border/50 px-2 py-1 bg-background/30 shadow-sm">
                        <span className="opacity-50">Duração:</span> <span className="text-foreground font-bold">{seq.totalDays} dias</span>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6 pt-4 md:pt-0">
                  {getStatusBadge(seq.status)}
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/sequences/${seq.id}`}>
                      <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-[10px] tracking-widest h-8 px-3 btn-weapon-outline">
                        <Eye className="h-3 w-3 mr-2" />
                        Detalhes
                      </Button>
                    </Link>
                    <Link href={`/sequences/${seq.id}/calendar`}>
                      <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-[10px] tracking-widest h-8 px-3 btn-weapon-outline">
                        <Calendar className="h-3 w-3 mr-2" />
                        Calendário
                      </Button>
                    </Link>
                    <Link href={`/sequences/${seq.id}/today`}>
                      <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-[10px] tracking-widest h-8 px-3 border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground transition-all">
                        <Activity className="h-3 w-3 mr-2" />
                        Operação
                      </Button>
                    </Link>
                    <Link href={`/sequences/${seq.id}/analytics`}>
                      <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-[10px] tracking-widest h-8 px-3 btn-weapon-outline">
                        <BarChart className="h-3 w-3 mr-2" />
                        Métricas
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
