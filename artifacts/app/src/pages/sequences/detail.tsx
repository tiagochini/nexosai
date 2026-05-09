import { useRoute, Link } from "wouter";
import { useGetSequence, useGenerateSequencePlan, useActivateSequence, getGetSequenceQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Zap, Play, Cpu, AlertTriangle, Calendar, Activity, BarChart, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function SequenceDetail() {
  const [match, params] = useRoute("/sequences/:id");
  const sequenceId = params?.id || "";
  const queryClient = useQueryClient();

  const { data, isLoading } = useGetSequence(sequenceId, {
    query: {
      enabled: !!sequenceId,
      queryKey: getGetSequenceQueryKey(sequenceId)
    }
  });

  const generatePlanMutation = useGenerateSequencePlan({
    mutation: {
      onSuccess: () => {
        toast.success("Plano de IA gerado com sucesso. Custou 30 créditos.");
        queryClient.invalidateQueries({ queryKey: getGetSequenceQueryKey(sequenceId) });
      },
      onError: () => {
        toast.error("Erro ao gerar plano via IA.");
      }
    }
  });

  const activateMutation = useActivateSequence({
    mutation: {
      onSuccess: () => {
        toast.success("Sequência ativada. Em operação.");
        queryClient.invalidateQueries({ queryKey: getGetSequenceQueryKey(sequenceId) });
      },
      onError: () => {
        toast.error("Erro ao ativar sequência.");
      }
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500 p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data?.sequence) return <div className="p-8 text-center uppercase font-mono text-muted-foreground">Sequência não encontrada</div>;

  const { sequence } = data;

  const handleGeneratePlan = () => {
    generatePlanMutation.mutate({ sequenceId });
  };

  const handleActivate = () => {
    activateMutation.mutate({ sequenceId, data: {} });
  };

  const channelColors: Record<string, string> = {
    email: "text-blue-500 border-blue-500",
    whatsapp: "text-green-500 border-green-500",
    social: "text-pink-500 border-pink-500",
    blog: "text-orange-500 border-orange-500"
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b border-border pb-6">
        <div>
          <Link href="/sequences">
            <Button variant="ghost" size="sm" className="font-mono uppercase text-xs mb-4 -ml-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Todas as Sequências
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-mono uppercase tracking-tight font-bold text-foreground">{sequence.name}</h1>
            <Badge variant="outline" className="font-mono uppercase text-xs rounded-none bg-primary/10 text-primary border-primary/20">
              {sequence.status}
            </Badge>
          </div>
          <div className="flex gap-4 text-xs font-mono uppercase tracking-wider text-muted-foreground mt-2">
            <span>Dias: {sequence.totalDays}</span>
            <span>Modelo: {sequence.model}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {sequence.items?.length === 0 && sequence.status === 'draft' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="font-mono uppercase tracking-wider rounded-none gap-2 bg-primary text-primary-foreground">
                  <Cpu className="h-4 w-4" />
                  Gerar Plano IA (-30 Cr)
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-border bg-card rounded-none">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-mono uppercase font-bold text-lg border-b border-border pb-2 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-primary" />
                    Autorização Necessária
                  </AlertDialogTitle>
                  <AlertDialogDescription className="font-mono text-sm mt-4">
                    Gerar um plano completo usando IA deduzirá 30 créditos do seu saldo. Confirma a operação?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-6 border-t border-border pt-4">
                  <AlertDialogCancel className="rounded-none font-mono uppercase text-xs border-border">Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleGeneratePlan} className="rounded-none font-mono uppercase text-xs bg-primary text-primary-foreground font-bold">
                    Autorizar Operação
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {sequence.status !== 'live' && sequence.items?.length > 0 && (
            <Button onClick={handleActivate} disabled={activateMutation.isPending} variant="outline" className="font-mono uppercase tracking-wider rounded-none gap-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground">
              {activateMutation.isPending ? "Processando..." : <><Play className="h-4 w-4 fill-current" /> Ativar Protocolo</>}
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Submenu */}
      <div className="flex border-b border-border overflow-x-auto no-scrollbar">
        <Link href={`/sequences/${sequenceId}`}>
          <div className="px-6 py-3 font-mono text-sm font-bold uppercase tracking-wider text-primary border-b-2 border-primary cursor-pointer shrink-0">
            Inventário
          </div>
        </Link>
        <Link href={`/sequences/${sequenceId}/calendar`}>
          <div className="px-6 py-3 font-mono text-sm uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer shrink-0">
            Calendário
          </div>
        </Link>
        <Link href={`/sequences/${sequenceId}/today`}>
          <div className="px-6 py-3 font-mono text-sm uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer shrink-0">
            Operação Dia
          </div>
        </Link>
        <Link href={`/sequences/${sequenceId}/copy`}>
          <div className="px-6 py-3 font-mono text-sm uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer shrink-0">
            Estúdio Copy
          </div>
        </Link>
        <Link href={`/sequences/${sequenceId}/analytics`}>
          <div className="px-6 py-3 font-mono text-sm uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer shrink-0">
            Métricas
          </div>
        </Link>
        <Link href={`/sequences/${sequenceId}/contacts`}>
          <div className="px-6 py-3 font-mono text-sm uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer shrink-0">
            Contatos Base
          </div>
        </Link>
      </div>

      {sequence.items?.length === 0 ? (
        <div className="p-16 flex flex-col items-center justify-center text-center border border-border bg-card">
          <FileText className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
          <p className="font-mono text-sm uppercase text-muted-foreground mb-4">Matriz de itens vazia.</p>
          <p className="font-mono text-xs uppercase text-muted-foreground mb-6">Utilize o botão superior para gerar o plano de ataque via IA.</p>
        </div>
      ) : (
        <div className="border border-border bg-card">
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-border bg-muted/30 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <div className="col-span-1">Dia</div>
            <div className="col-span-2">Fase</div>
            <div className="col-span-5">Mensagem / Pauta</div>
            <div className="col-span-2">Canal</div>
            <div className="col-span-2">Gatilho Mental</div>
          </div>
          <div className="divide-y divide-border">
            {sequence.items?.map((item) => (
              <div key={item.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/10 transition-colors font-mono text-sm">
                <div className="col-span-1 font-bold">D{item.dayIndex}</div>
                <div className="col-span-2 uppercase text-xs tracking-wider">{item.phase}</div>
                <div className="col-span-5 truncate pr-4">
                  <div className="font-bold truncate">{item.name}</div>
                  <div className="text-xs text-muted-foreground truncate uppercase">{item.description}</div>
                </div>
                <div className="col-span-2">
                  <Badge variant="outline" className={`rounded-none font-mono text-[10px] uppercase border bg-transparent ${channelColors[item.channel] || 'text-foreground border-border'}`}>
                    {item.channel}
                  </Badge>
                </div>
                <div className="col-span-2 text-xs uppercase tracking-wider text-muted-foreground">
                  {item.mentalTrigger?.replace(/_/g, ' ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
