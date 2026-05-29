import { useRoute, Link } from "wouter";
import { useGetSequence, useGenerateSequencePlan, useActivateSequence, getGetSequenceQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Cpu, AlertTriangle, FileText, Link2, Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";
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

// ── Lead Capture Link Component ────────────────────────────────────────────────

function LeadCaptureLink({ sequenceId }: { sequenceId: string }) {
  const [copied, setCopied] = useState(false);
  const baseUrl = window.location.origin;
  const captureUrl = `${baseUrl}/c/${sequenceId}`;

  const handleCopy = () => {
    void navigator.clipboard.writeText(captureUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="border border-primary/20 bg-primary/5 px-5 py-4 flex items-center gap-4 flex-wrap">
      <Link2 className="h-4 w-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1">Link público de captura de leads</p>
        <p className="font-mono text-xs text-foreground/70 truncate">{captureUrl}</p>
      </div>
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest border border-primary/30 text-primary px-3 py-1.5 hover:bg-primary/10 transition-colors shrink-0"
      >
        {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copiado!" : "Copiar"}
      </button>
      <a
        href={captureUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest border border-border/40 text-muted-foreground px-3 py-1.5 hover:text-foreground hover:border-border transition-colors shrink-0"
      >
        <Link2 className="h-3 w-3" />
        Abrir
      </a>
    </div>
  );
}

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
        toast.success("Plano da equipe especializada gerado com sucesso. Custou 30 créditos.");
        queryClient.invalidateQueries({ queryKey: getGetSequenceQueryKey(sequenceId) });
      },
      onError: () => {
        toast.error("Erro ao gerar plano pela equipe.");
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
      <div className="space-y-8 p-8">
        <Skeleton className="h-8 w-64 bg-muted/20" />
        <Skeleton className="h-64 w-full bg-muted/20" />
      </div>
    );
  }

  if (!data?.sequence) return <div className="p-16 text-center uppercase font-mono text-muted-foreground tracking-widest">Matriz não encontrada no registro</div>;

  const { sequence } = data;

  const handleGeneratePlan = () => {
    generatePlanMutation.mutate({ sequenceId });
  };

  const handleActivate = () => {
    activateMutation.mutate({ sequenceId, data: {} });
  };

  const channelColors: Record<string, string> = {
    email: "text-blue-400 border-blue-400/40 bg-blue-400/10",
    whatsapp: "text-green-400 border-green-400/40 bg-green-400/10",
    social: "text-pink-400 border-pink-400/40 bg-pink-400/10",
    blog: "text-orange-400 border-orange-400/40 bg-orange-400/10"
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'live': return 'badge-glow-green text-success border-success/40 bg-success/10';
      case 'draft': return 'text-muted-foreground border-border bg-muted/20';
      case 'generating': return 'badge-glow-blue text-primary border-primary/40 bg-primary/10 animate-pulse-slow';
      default: return 'badge-glow-primary text-primary border-primary/40 bg-primary/10';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-border/50 pb-6 gap-6">
        <div>
          <Link href="/sequences">
            <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest mb-6 -ml-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3 mr-2" />
              Todas as Sequências
            </Button>
          </Link>
          <div className="flex items-center gap-5">
            <h1 className="text-4xl font-mono uppercase tracking-tighter font-bold text-foreground drop-shadow-sm">{sequence.name}</h1>
            <Badge variant="outline" className={`font-mono uppercase text-xs tracking-widest rounded-none px-3 py-1 border ${getStatusColor(sequence.status)}`}>
              {sequence.status}
            </Badge>
          </div>
          <div className="flex gap-4 text-xs font-mono uppercase tracking-widest text-muted-foreground mt-4 flex-wrap">
            <span className="bg-card px-3 py-1 border border-border/50 shadow-sm">DIAS: {sequence.totalDays}</span>
            <span className="bg-card px-3 py-1 border border-border/50 shadow-sm">MODELO: <span className="text-primary font-bold">{sequence.model}</span></span>
          </div>
        </div>
        <div className="flex gap-3">
          {sequence.items?.length === 0 && sequence.status === 'draft' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-10 px-5">
                  <Cpu className="h-4 w-4" />
                  Gerar Plano equipe especializada (-30 Cr)
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border border-primary/30 bg-card/90 backdrop-blur-xl rounded-none shadow-[0_0_50px_hsl(var(--primary)/0.15)]">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-mono uppercase tracking-widest font-bold text-lg border-b border-border/50 pb-4 flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center border border-primary/30">
                      <AlertTriangle className="h-4 w-4 text-primary" />
                    </div>
                    Autorização Necessária
                  </AlertDialogTitle>
                  <AlertDialogDescription className="font-mono text-sm mt-6 text-foreground/80 leading-relaxed">
                    A geração de um plano tático completo através da equipe especializada deduzirá <strong className="text-primary">30 créditos</strong> do seu saldo. 
                    <br/><br/>
                    A operação levará aproximadamente 45 segundos. Confirma a autorização de gastos?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-8 border-t border-border/50 pt-4">
                  <AlertDialogCancel className="rounded-none font-mono uppercase text-xs tracking-widest border-border/50 hover:bg-muted/20">Abortar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleGeneratePlan} className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-primary">
                    Autorizar Operação
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {sequence.status !== 'live' && sequence.items?.length > 0 && (
            <Button onClick={handleActivate} disabled={activateMutation.isPending} variant="outline" className="font-mono uppercase tracking-widest rounded-none gap-2 border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_15px_hsl(var(--primary)/0.3)] transition-all h-10 px-5">
              {activateMutation.isPending ? "Processando..." : <><Play className="h-4 w-4 fill-current" /> Ativar Protocolo</>}
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Submenu */}
      <div className="flex border-b border-border/50 overflow-x-auto no-scrollbar pb-[1px]">
        <Link href={`/sequences/${sequenceId}`}>
          <div className="px-6 py-4 font-mono text-xs font-bold uppercase tracking-widest text-primary border-b-2 border-primary bg-primary/5 cursor-pointer shrink-0">
            Inventário
          </div>
        </Link>
        <Link href={`/sequences/${sequenceId}/calendar`}>
          <div className="px-6 py-4 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/10 cursor-pointer shrink-0 transition-colors">
            Calendário
          </div>
        </Link>
        <Link href={`/sequences/${sequenceId}/today`}>
          <div className="px-6 py-4 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/10 cursor-pointer shrink-0 transition-colors">
            Operação Dia
          </div>
        </Link>
        <Link href={`/sequences/${sequenceId}/copy`}>
          <div className="px-6 py-4 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/10 cursor-pointer shrink-0 transition-colors">
            Estúdio Copy
          </div>
        </Link>
        <Link href={`/sequences/${sequenceId}/analytics`}>
          <div className="px-6 py-4 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/10 cursor-pointer shrink-0 transition-colors">
            Métricas
          </div>
        </Link>
        <Link href={`/sequences/${sequenceId}/contacts`}>
          <div className="px-6 py-4 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/10 cursor-pointer shrink-0 transition-colors">
            Base Contatos
          </div>
        </Link>
      </div>

      {/* Lead Capture Link — shown when leadCaptureEnabled */}
      {Boolean((sequence as unknown as Record<string, unknown>)["leadCaptureEnabled"]) && (
        <LeadCaptureLink sequenceId={sequenceId} />
      )}

      {sequence.items?.length === 0 ? (
        <div className="p-20 flex flex-col items-center justify-center text-center border border-border/50 bg-card/40 backdrop-blur-sm card-weapon">
          <div className="w-20 h-20 rounded-full border border-border/50 bg-background/50 flex items-center justify-center mb-6 relative">
            <div className="absolute inset-0 rounded-full border border-primary/20 animate-pulse-slow"></div>
            <FileText className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="font-mono text-sm uppercase tracking-widest text-foreground font-bold mb-2">Matriz de itens vazia</p>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground max-w-md leading-relaxed">
            A estrutura desta sequência não contém disparos programados. Utilize o botão superior para gerar o plano de ataque completo pela equipe tática.
          </p>
        </div>
      ) : (
        <div className="border border-border/50 bg-card/40 backdrop-blur-sm relative">
          <div className="absolute left-0 inset-y-0 w-[2px] bg-gradient-to-b from-primary/30 to-transparent"></div>
          
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-border/50 bg-muted/20 font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <div className="col-span-1 pl-2">Dia</div>
            <div className="col-span-2">Fase</div>
            <div className="col-span-5">Mensagem / Pauta</div>
            <div className="col-span-2">Canal</div>
            <div className="col-span-2">Gatilho Mental</div>
          </div>
          
          <div className="divide-y divide-border/30">
            {sequence.items?.map((item) => (
              <div key={item.id} className="grid grid-cols-12 gap-4 p-4 items-center table-row-glow font-mono text-sm group">
                <div className="col-span-1 font-bold text-primary pl-2">D{item.dayIndex}</div>
                <div className="col-span-2 uppercase text-xs tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">{item.phase}</div>
                <div className="col-span-5 truncate pr-4">
                  <div className="font-bold truncate text-foreground group-hover:text-primary transition-colors">{item.name}</div>
                  <div className="text-xs text-muted-foreground truncate uppercase tracking-widest mt-1">{item.description}</div>
                </div>
                <div className="col-span-2">
                  <Badge variant="outline" className={`rounded-none font-mono text-[11px] tracking-widest uppercase border ${channelColors[item.channel] || 'text-foreground border-border bg-muted/10'}`}>
                    {item.channel}
                  </Badge>
                </div>
                <div className="col-span-2 text-xs uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
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
