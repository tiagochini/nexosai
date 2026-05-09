import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useGetSequence, useGenerateItemCopy, getGetSequenceQueryKey, ItemCopyInputContactSegment } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Wand2, FileText, LayoutTemplate, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function SequenceCopyStudio() {
  const [match, params] = useRoute("/sequences/:id/copy");
  const sequenceId = params?.id || "";
  const queryClient = useQueryClient();
  const searchParams = new URLSearchParams(window.location.search);
  const initialItemId = searchParams.get("item") || "";

  const [selectedItemId, setSelectedItemId] = useState<string>(initialItemId);
  const [segment, setSegment] = useState<ItemCopyInputContactSegment>("warm");

  const { data, isLoading } = useGetSequence(sequenceId, {
    query: {
      enabled: !!sequenceId,
      queryKey: getGetSequenceQueryKey(sequenceId)
    }
  });

  const generateCopyMutation = useGenerateItemCopy({
    mutation: {
      onSuccess: () => {
        toast.success("Copy gerada com sucesso. (-2 Créditos)");
        queryClient.invalidateQueries({ queryKey: getGetSequenceQueryKey(sequenceId) });
      },
      onError: () => {
        toast.error("Erro ao processar requisição de inteligência artificial.");
      }
    }
  });

  const handleGenerateCopy = () => {
    if (!selectedItemId) return;
    generateCopyMutation.mutate({
      sequenceId,
      itemId: selectedItemId,
      data: { contactSegment: segment }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Skeleton className="h-[400px] col-span-1" />
          <Skeleton className="h-[400px] col-span-3" />
        </div>
      </div>
    );
  }

  const items = data?.sequence?.items || [];
  const selectedItem = items.find(i => i.id === selectedItemId);

  // Use the first item if none is selected and there are items
  if (!selectedItemId && items.length > 0) {
    setSelectedItemId(items[0].id);
  }

  const getSegmentColor = (seg: string) => {
    switch (seg) {
      case 'hot': return 'text-red-500 border-red-500 bg-red-500/10';
      case 'warm': return 'text-yellow-500 border-yellow-500 bg-yellow-500/10';
      case 'cold': return 'text-blue-500 border-blue-500 bg-blue-500/10';
      default: return 'text-foreground border-border bg-background';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="flex flex-col border-b border-border pb-6 shrink-0">
        <Link href={`/sequences/${sequenceId}`}>
          <Button variant="ghost" size="sm" className="font-mono uppercase text-xs mb-4 -ml-2 w-fit text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Sequência
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-mono uppercase tracking-tight font-bold text-foreground">Estúdio de Copy IA</h1>
            <p className="text-sm text-muted-foreground mt-1 font-mono uppercase tracking-wider">Geração contextual baseada em segmento e fase</p>
          </div>
          <div className="flex items-center gap-2 border border-border p-2 bg-card">
            <Activity className="h-4 w-4 text-primary" />
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Sistema Cognitivo Pronto</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 flex-1 min-h-[500px]">
        {/* Sidebar Selector */}
        <div className="border border-border bg-card flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30 font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4" /> Peças de Conteúdo
          </div>
          <div className="overflow-y-auto flex-1 divide-y divide-border">
            {items.map(item => (
              <div 
                key={item.id} 
                onClick={() => setSelectedItemId(item.id)}
                className={`p-4 cursor-pointer transition-colors ${selectedItemId === item.id ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted/50 border-l-2 border-l-transparent'}`}
              >
                <div className="font-mono text-xs font-bold uppercase mb-1 truncate text-foreground">{item.name}</div>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">Dia {item.dayIndex}</span>
                  <Badge variant="outline" className={`rounded-none font-mono text-[9px] uppercase px-1 py-0 h-4 border-muted-foreground text-muted-foreground`}>
                    {item.channel}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Editor Area */}
        <div className="col-span-1 md:col-span-3 border border-border bg-card flex flex-col">
          {selectedItem ? (
            <>
              <div className="p-6 border-b border-border bg-muted/10 flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div>
                  <h2 className="font-mono text-lg font-bold uppercase tracking-wide">{selectedItem.name}</h2>
                  <p className="font-mono text-xs uppercase text-muted-foreground mt-1 max-w-lg">{selectedItem.description}</p>
                  <div className="flex gap-2 mt-4">
                    <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase border-border bg-background">Fase: {selectedItem.phase}</Badge>
                    <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase border-border bg-background">Gatilho: {selectedItem.mentalTrigger?.replace(/_/g, ' ')}</Badge>
                  </div>
                </div>

                <div className="flex flex-col gap-4 border border-border p-4 bg-background min-w-[250px]">
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Segmento Alvo</Label>
                    <Select value={segment} onValueChange={(val: any) => setSegment(val)}>
                      <SelectTrigger className="font-mono rounded-none h-8 text-xs">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hot" className="font-mono text-xs uppercase text-red-500">Quente (Hot)</SelectItem>
                        <SelectItem value="warm" className="font-mono text-xs uppercase text-yellow-500">Morno (Warm)</SelectItem>
                        <SelectItem value="cold" className="font-mono text-xs uppercase text-blue-500">Frio (Cold)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button 
                    onClick={handleGenerateCopy} 
                    disabled={generateCopyMutation.isPending}
                    className="w-full font-mono uppercase text-xs rounded-none tracking-wider font-bold gap-2"
                  >
                    {generateCopyMutation.isPending ? "Processando..." : <><Wand2 className="h-3 w-3" /> Gerar Nova Copy</>}
                  </Button>
                </div>
              </div>

              <div className="flex-1 p-6 relative bg-zinc-950 text-zinc-300 font-mono text-sm leading-relaxed overflow-y-auto whitespace-pre-wrap">
                {selectedItem.metadata?.generatedCopy ? (
                  <div className="max-w-3xl">
                    {(selectedItem.metadata.generatedCopy as any)[segment] || "Conteúdo ainda não gerado para este segmento específico. Solicite nova geração."}
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 opacity-50">
                    <FileText className="h-16 w-16 mb-4" />
                    <p className="uppercase tracking-widest text-xs">Sem copy registrada</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center font-mono text-sm uppercase text-muted-foreground">
              Selecione uma peça de conteúdo no painel lateral
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
