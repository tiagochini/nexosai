import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useGetSequence, useGenerateItemCopy, getGetSequenceQueryKey, ItemCopyInputContactSegment } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Wand2, FileText, LayoutTemplate, Activity, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useUiText } from "@/lib/i18n";

export default function SequenceCopyStudio() {
  const t = useUiText();
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
        toast.success(t("Copy gerada com sucesso. (-2 Créditos)", "Copy generated successfully. (-2 credits)", "Texto generado correctamente. (-2 créditos)"));
        queryClient.invalidateQueries({ queryKey: getGetSequenceQueryKey(sequenceId) });
      },
      onError: () => {
        toast.error(t("Erro ao processar requisição de inteligência artificial.", "Failed to process the AI request.", "No se pudo procesar la solicitud de inteligencia artificial."));
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
      <div className="space-y-8 h-full flex flex-col">
        <Skeleton className="h-8 w-64 bg-muted/20" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 flex-1">
          <Skeleton className="h-[600px] col-span-1 bg-muted/20" />
          <Skeleton className="h-[600px] col-span-3 bg-muted/20" />
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
      case 'hot': return 'text-red-400 border-red-400/40 bg-red-400/10';
      case 'warm': return 'text-yellow-400 border-yellow-400/40 bg-yellow-400/10';
      case 'cold': return 'text-blue-400 border-blue-400/40 bg-blue-400/10';
      default: return 'text-foreground border-border bg-background';
    }
  };

  return (
    <div className="space-y-6 h-[calc(100vh-10rem)] flex flex-col">
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-border/50 pb-4 shrink-0">
        <div>
          <Link href={`/sequences/${sequenceId}`}>
            <Button variant="ghost" size="sm" className="font-mono uppercase text-xs tracking-widest mb-4 -ml-2 w-fit text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3 mr-2" />
              {t("Retornar à Sequência", "Back to Sequence", "Volver a la secuencia")}
            </Button>
          </Link>
          <h1 className="text-3xl font-mono uppercase tracking-tighter font-bold text-foreground">{t("Estúdio de Copy", "Copy Studio", "Estudio de textos")}</h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono uppercase tracking-widest">{t("Geração contextual baseada em segmento e fase", "Context-aware generation based on segment and launch phase", "Generación contextual según el segmento y la fase")}</p>
        </div>
        <div className="flex items-center gap-3 border border-border/50 p-2 bg-card/40 backdrop-blur-sm mt-4 md:mt-0 relative overflow-hidden">
          <div className="absolute inset-0 bg-primary/5"></div>
          <Activity className="h-4 w-4 text-primary relative z-10 animate-pulse-slow drop-shadow-[0_0_5px_hsl(var(--primary))]" />
          <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold relative z-10">{t("Agente conectado e pronto", "Agent Link Ready", "Agente conectado y listo")}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 flex-1 min-h-0 overflow-hidden">
        {/* Sidebar Selector */}
        <div className="border border-border/50 bg-card/40 backdrop-blur-sm flex flex-col overflow-hidden card-weapon">
          <div className="p-4 border-b border-border/50 bg-background/50 font-mono text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
            <LayoutTemplate className="h-3 w-3" /> {t("Peças de Conteúdo", "Content Items", "Piezas de contenido")}
          </div>
          <div className="overflow-y-auto flex-1 divide-y divide-border/30 custom-scrollbar">
            {items.map(item => (
              <div 
                key={item.id} 
                onClick={() => setSelectedItemId(item.id)}
                className={`p-4 cursor-pointer transition-all ${selectedItemId === item.id ? 'bg-primary/10 border-l-2 border-l-primary shadow-[inset_10px_0_15px_-10px_hsl(var(--primary)/0.2)]' : 'hover:bg-muted/30 border-l-2 border-l-transparent hover:border-primary/30'}`}
              >
                <div className={`font-mono text-xs font-bold uppercase mb-1 truncate ${selectedItemId === item.id ? 'text-primary' : 'text-foreground'}`}>{item.name}</div>
                <div className="flex items-center justify-between mt-3">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground bg-background/50 px-2 py-0.5 border border-border/50">D{item.dayIndex}</span>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/70">{item.channel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Editor Area */}
        <div className="col-span-1 md:col-span-3 border border-border/50 bg-card/40 backdrop-blur-sm flex flex-col overflow-hidden card-weapon">
          {selectedItem ? (
            <>
              <div className="p-6 border-b border-border/50 bg-background/30 flex flex-col lg:flex-row lg:items-start justify-between gap-6 shrink-0 relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary/50"></div>
                <div className="flex-1">
                  <h2 className="font-mono text-xl font-bold uppercase tracking-tight text-foreground drop-shadow-sm">{selectedItem.name}</h2>
                  <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mt-2 max-w-xl leading-relaxed">{selectedItem.description}</p>
                  <div className="flex flex-wrap gap-2 mt-4">
                     <Badge variant="outline" className="rounded-none font-mono text-[11px] tracking-widest uppercase border-border/50 bg-background/50 text-muted-foreground">{t("FASE:", "PHASE:", "FASE:")} {selectedItem.phase}</Badge>
                     <Badge variant="outline" className="rounded-none font-mono text-[11px] tracking-widest uppercase border-border/50 bg-background/50 text-muted-foreground">{t("GATILHO:", "TRIGGER:", "ACTIVADOR:")} {selectedItem.mentalTrigger?.replace(/_/g, ' ')}</Badge>
                  </div>
                </div>

                <div className="flex flex-col gap-4 border border-border/50 p-4 bg-background/50 min-w-[280px] shrink-0">
                  <div className="space-y-2">
                     <Label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{t("Segmento Alvo", "Target Segment", "Segmento objetivo")}</Label>
                    <Select value={segment} onValueChange={(val: any) => setSegment(val)}>
                      <SelectTrigger className="font-mono rounded-none h-10 text-xs tracking-widest uppercase bg-card/50 border-border/50">
                         <SelectValue placeholder={t("Selecione...", "Select...", "Selecciona...")} />
                      </SelectTrigger>
                      <SelectContent className="rounded-none border-primary/20 bg-card/90 backdrop-blur-xl">
                         <SelectItem value="hot" className="font-mono text-xs tracking-widest uppercase text-red-400 focus:bg-red-400/10 focus:text-red-400">{t("Quente (Hot)", "Hot", "Caliente (Hot)")}</SelectItem>
                         <SelectItem value="warm" className="font-mono text-xs tracking-widest uppercase text-yellow-400 focus:bg-yellow-400/10 focus:text-yellow-400">{t("Morno (Warm)", "Warm", "Templado (Warm)")}</SelectItem>
                         <SelectItem value="cold" className="font-mono text-xs tracking-widest uppercase text-blue-400 focus:bg-blue-400/10 focus:text-blue-400">{t("Frio (Cold)", "Cold", "Frío (Cold)")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button 
                    onClick={handleGenerateCopy} 
                    disabled={generateCopyMutation.isPending}
                    className="w-full font-mono uppercase text-xs rounded-none tracking-widest font-bold gap-2 btn-weapon-primary h-10"
                  >
                    {generateCopyMutation.isPending ? t("Processando...", "Processing...", "Procesando...") : <><Wand2 className="h-3 w-3" /> {t("Solicitar Geração (-2 créditos)", "Generate Copy (-2 credits)", "Generar texto (-2 créditos)")}</>}
                  </Button>
                </div>
              </div>

              <div className="flex-1 p-8 relative bg-[#0a0c10] text-[#a0a8b5] font-mono text-[13px] leading-[1.8] overflow-y-auto whitespace-pre-wrap custom-scrollbar scanline-overlay">
                <div className="absolute top-4 left-4 font-mono text-[11px] uppercase tracking-[0.3em] text-primary/40 flex items-center gap-2 z-20">
                   <Terminal className="h-3 w-3" /> {t("Saída do editor", "Editor Output", "Salida del editor")}
                </div>
                
                {selectedItem.metadata?.generatedCopy ? (
                  <div className="max-w-4xl mx-auto mt-4 relative z-20">
                    {(selectedItem.metadata.generatedCopy as any)[segment] || (
                      <div className="text-destructive/80 border border-destructive/20 bg-destructive/5 p-4 inline-block">
                         {t("ERRO: O conteúdo ainda não foi gerado para o segmento", "ERROR: No content has been generated for the", "ERROR: Aún no se ha generado contenido para el segmento")} '{segment}'. {t("Solicite uma nova geração.", "Request a new generation.", "Solicita una nueva generación.")}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/30 z-20">
                    <div className="w-16 h-16 border border-border/20 rounded-full flex items-center justify-center mb-4">
                      <FileText className="h-6 w-6" />
                    </div>
                     <p className="uppercase tracking-[0.3em] text-xs">{t("Buffer vazio", "Empty Buffer", "Búfer vacío")}</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center font-mono text-xs uppercase tracking-widest text-muted-foreground/50 bg-background/20">
              <LayoutTemplate className="h-8 w-8 mb-4 opacity-20" />
               {t("Selecione um item no painel lateral", "Select an item in the side panel", "Selecciona un elemento en el panel lateral")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
