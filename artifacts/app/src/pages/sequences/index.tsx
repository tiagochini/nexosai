import { Link } from "wouter";
import { useListSequences, getListSequencesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, Workflow, Calendar, Activity, Eye, BarChart } from "lucide-react";

export default function SequencesList() {
  const { data, isLoading } = useListSequences({
    query: {
      queryKey: getListSequencesQueryKey()
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'live': return <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase bg-green-500/10 text-green-500 border-green-500/20">Operante</Badge>;
      case 'draft': return <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase bg-muted text-muted-foreground border-border">Rascunho</Badge>;
      case 'generating': return <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase bg-blue-500/10 text-blue-500 border-blue-500/20">Gerando</Badge>;
      default: return <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase bg-primary/10 text-primary border-primary/20">{status}</Badge>;
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
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-mono uppercase tracking-tight font-bold text-foreground">Matriz de Sequências</h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono uppercase tracking-wider">Canais de disparo e automação programada</p>
        </div>
        <Link href="/sequences/new">
          <Button className="font-mono uppercase tracking-wider rounded-none gap-2">
            <Plus className="h-4 w-4" />
            Nova Sequência
          </Button>
        </Link>
      </div>

      <div className="border border-border bg-card">
        {isLoading ? (
          <div className="p-8 space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : data?.sequences?.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center border-t border-border">
            <Workflow className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <p className="font-mono text-sm uppercase text-muted-foreground mb-4">Nenhuma sequência encontrada no radar.</p>
            <Link href="/sequences/new">
              <Button variant="outline" className="font-mono uppercase text-xs rounded-none border-primary text-primary">
                Inicializar Matriz
              </Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {data?.sequences?.map(seq => (
              <div key={seq.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between hover:bg-muted/30 transition-colors gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 border border-border bg-background flex items-center justify-center shrink-0">
                    <Workflow className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold font-mono uppercase tracking-wider text-lg">{seq.name}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground mt-2 uppercase font-mono tracking-wide">
                      <span className="flex items-center gap-1 border border-border px-2 py-0.5 bg-background">
                        Modelo: <span className="text-foreground">{getModelName(seq.model)}</span>
                      </span>
                      <span className="flex items-center gap-1 border border-border px-2 py-0.5 bg-background">
                        Duração: <span className="text-foreground">{seq.totalDays} dias</span>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 border-t md:border-t-0 border-border pt-4 md:pt-0">
                  {getStatusBadge(seq.status)}
                  <div className="flex items-center gap-2">
                    <Link href={`/sequences/${seq.id}`}>
                      <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-xs h-8 px-3 border-border hover:border-primary hover:text-primary transition-colors">
                        <Eye className="h-3 w-3 mr-2" />
                        Detalhes
                      </Button>
                    </Link>
                    <Link href={`/sequences/${seq.id}/calendar`}>
                      <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-xs h-8 px-3 border-border hover:border-primary hover:text-primary transition-colors">
                        <Calendar className="h-3 w-3 mr-2" />
                        Calendário
                      </Button>
                    </Link>
                    <Link href={`/sequences/${seq.id}/today`}>
                      <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-xs h-8 px-3 border-border hover:bg-primary hover:text-primary-foreground transition-colors">
                        <Activity className="h-3 w-3 mr-2" />
                        Operação
                      </Button>
                    </Link>
                    <Link href={`/sequences/${seq.id}/analytics`}>
                      <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-xs h-8 px-3 border-border hover:border-primary hover:text-primary transition-colors">
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
