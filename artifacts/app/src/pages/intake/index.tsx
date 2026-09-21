import { useState, useEffect } from "react";
import { Link, useLocation, useRoute, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FileText, Database, Plus, Target, Radar, Megaphone, CheckCircle2,
  ChevronRight, ExternalLink, ShieldCheck, Zap, Server, Settings2,
  Rocket
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Product {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  active: boolean;
}

interface Intake {
  id: string;
  workspaceId: string;
  commercialProductId: string;
  commercialSubscriptionId: string | null;
  version: number;
  status: "draft" | "approved" | "superseded";
  entryPoint: string;
  snapshot: Record<string, unknown>;
  contentHash: string;
  createdAt: string;
  approvedAt: string | null;
  lockedAt: string | null;
}

interface IntakeResponse {
  current: Intake | null;
  draft: Intake | null;
  decision: string;
}

export default function IntakeHub() {
  const [, params] = useRoute("/intake/:productId");
  const productId = params?.productId;
  const search = useSearch();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const requestedEntryPoint = (() => {
    const value = new URLSearchParams(search).get("entryPoint");
    return value === "market_intel" || value === "social_media" || value === "paid_media" ? value : "launch";
  })();

  // Fetch products
  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ["/api/products"],
    queryFn: () => customFetch<{ products: Product[] }>("/api/products"),
  });
  const products = productsData?.products ?? [];

  // Fetch intake for selected product
  const { data: intakeData, isLoading: loadingIntake } = useQuery({
    queryKey: ["/api/product-intake", productId],
    queryFn: () => customFetch<IntakeResponse>(`/api/product-intake/${productId}`),
    enabled: !!productId,
  });

  const startMutation = useMutation({
    mutationFn: (args: { productId: string; entryPoint: string }) =>
      customFetch<{ intake: Intake }>(`/api/product-intake/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commercialProductId: args.productId, entryPoint: args.entryPoint }),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/product-intake", productId] });
      toast.success("Briefing iniciado!");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao iniciar briefing."),
  });

  const approveMutation = useMutation({
    mutationFn: (intakeId: string) =>
      customFetch<{ intake: Intake }>(`/api/product-intake/${intakeId}/approve`, {
        method: "POST"
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/product-intake", productId] });
      toast.success("Briefing aprovado! Pronto para uso em todas as frentes.");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao aprovar briefing."),
  });

  if (loadingProducts) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 p-6">
        <Skeleton className="h-8 w-64 bg-muted/20" />
        <Skeleton className="h-64 w-full bg-muted/20" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 md:p-6 flex flex-col min-h-[100dvh]">
      {/* Header */}
      <div className="flex flex-col gap-2 shrink-0 border-b border-border/50 pb-5">
        <h1 className="text-2xl font-black font-mono uppercase tracking-widest text-foreground flex items-center gap-3">
          <Database className="h-7 w-7 text-primary" />
          Briefing Central
        </h1>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground border-l-2 border-primary/50 pl-3">
          A fonte da verdade. Lançamento, Market Intelligence, Social Presence e Mídia Paga bebem daqui.
        </p>
      </div>

      {!productId ? (
        // List products
        <div className="space-y-4">
          <h2 className="font-mono text-sm uppercase tracking-widest flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Selecione o Produto
          </h2>
          {products.length === 0 ? (
            <div className="border border-dashed border-border/40 p-12 text-center space-y-3">
              <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest">
                Nenhum produto encontrado
              </p>
              <Button onClick={() => setLocation("/produtos")} variant="outline" className="rounded-none font-mono uppercase tracking-widest text-xs gap-2">
                <Plus className="h-3.5 w-3.5" /> Criar Produto
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map(p => (
                <button
                  key={p.id}
                  onClick={() => setLocation(`/intake/${p.id}`)}
                  className="text-left border border-border/30 bg-card/30 hover:border-primary/50 hover:bg-primary/5 p-5 transition-all group flex flex-col gap-3"
                >
                  <div className="font-mono text-sm font-bold uppercase tracking-widest text-foreground group-hover:text-primary transition-colors truncate w-full">
                    {p.name}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest">
                    Briefing de Produto
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Product Details & Intake
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/intake")} className="h-8 w-8">
              <ChevronRight className="h-4 w-4 rotate-180" />
            </Button>
            <h2 className="font-mono text-lg font-bold uppercase tracking-widest truncate">
              {products.find(p => p.id === productId)?.name}
            </h2>
          </div>

          {loadingIntake ? (
            <Skeleton className="h-48 w-full bg-muted/20" />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* STATUS COLUMN */}
              <div className="lg:col-span-2 space-y-6">
                {!intakeData?.current && !intakeData?.draft ? (
                  <div className="border border-border/30 bg-card/30 p-8 text-center space-y-4">
                    <Database className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                    <div className="space-y-1">
                      <p className="font-mono text-sm uppercase tracking-widest text-foreground">
                        Nenhum briefing iniciado
                      </p>
                      <p className="font-mono text-xs text-muted-foreground/60">
                        Comece agora para centralizar as informações deste produto.
                      </p>
                    </div>
                    <Button 
                      onClick={() => startMutation.mutate({ productId, entryPoint: requestedEntryPoint })}
                      disabled={startMutation.isPending}
                      className="rounded-none font-mono uppercase tracking-widest text-xs btn-weapon-primary h-10 px-6 gap-2 mx-auto"
                    >
                      <Plus className="h-4 w-4" /> Iniciar Briefing
                    </Button>
                    <p className="font-mono text-[9px] text-muted-foreground mt-4">
                      Você também pode vincular uma campanha existente em andamento.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* CURRENT APPROVED INTAKE */}
                    {intakeData.current && (
                      <div className="border border-primary/30 bg-primary/5 p-6 space-y-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4">
                          <Badge variant="outline" className="border-success/40 text-success bg-success/10 font-mono text-[9px] uppercase tracking-widest">
                            Aprovado
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-6 w-6 text-success" />
                          <div>
                            <h3 className="font-mono text-base font-bold uppercase tracking-widest text-foreground">
                              Versão Ativa (v{intakeData.current.version})
                            </h3>
                            <p className="font-mono text-xs text-muted-foreground/60 mt-0.5">
                              Fonte de verdade para a inteligência artificial.
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-border/20">
                           <div className="space-y-1">
                             <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">ID do Snapshot</div>
                             <div className="font-mono text-xs truncate" title={intakeData.current.id}>{intakeData.current.id.slice(0, 8)}</div>
                           </div>
                           <div className="space-y-1">
                             <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Aprovado em</div>
                             <div className="font-mono text-xs truncate">{new Date(intakeData.current.approvedAt!).toLocaleDateString()}</div>
                           </div>
                           <div className="space-y-1">
                             <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Entry Point</div>
                             <div className="font-mono text-xs uppercase">{intakeData.current.entryPoint}</div>
                           </div>
                        </div>
                      </div>
                    )}

                    {/* DRAFT INTAKE */}
                    {intakeData.draft && (
                      <div className="border border-amber-500/30 bg-amber-500/5 p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <Settings2 className="h-6 w-6 text-amber-500 shrink-0" />
                            <div>
                              <h3 className="font-mono text-base font-bold uppercase tracking-widest text-amber-500">
                                Rascunho (v{intakeData.draft.version})
                              </h3>
                              <p className="font-mono text-xs text-muted-foreground/60 mt-0.5">
                                Alterações pendentes de aprovação.
                              </p>
                            </div>
                          </div>
                          <Button 
                            onClick={() => approveMutation.mutate(intakeData.draft!.id)}
                            disabled={approveMutation.isPending}
                            className="rounded-none font-mono uppercase tracking-widest text-[10px] btn-weapon-primary h-8 gap-2 shrink-0"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* IMPACT PREVIEW & SURFACES */}
              <div className="space-y-4">
                <div className="border border-border/30 bg-card/30 p-5">
                   <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
                     Impacto nas Operações
                   </h3>
                   <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-background/50 border border-border/20">
                        <Rocket className="h-4 w-4 text-primary shrink-0" />
                        <div>
                          <div className="font-mono text-[11px] uppercase tracking-widest font-bold">Lançamentos</div>
                          <div className="font-mono text-[9px] text-muted-foreground mt-0.5 leading-tight">Campanhas ativas beberão desta fonte</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-background/50 border border-border/20">
                        <Radar className="h-4 w-4 text-cyan-400 shrink-0" />
                        <div>
                          <div className="font-mono text-[11px] uppercase tracking-widest font-bold">Market Intel</div>
                          <div className="font-mono text-[9px] text-muted-foreground mt-0.5 leading-tight">Análise de concorrência baseada nisto</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-background/50 border border-border/20">
                        <Megaphone className="h-4 w-4 text-pink-400 shrink-0" />
                        <div>
                          <div className="font-mono text-[11px] uppercase tracking-widest font-bold">Social Presence</div>
                          <div className="font-mono text-[9px] text-muted-foreground mt-0.5 leading-tight">Conteúdo autônomo com o mesmo tom</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-background/50 border border-border/20">
                        <Target className="h-4 w-4 text-green-400 shrink-0" />
                        <div>
                          <div className="font-mono text-[11px] uppercase tracking-widest font-bold">Mídia Paga</div>
                          <div className="font-mono text-[9px] text-muted-foreground mt-0.5 leading-tight">Lançamento de anúncios autônomo</div>
                        </div>
                      </div>
                   </div>
                </div>
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}