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
import { intlLocale, useUiLocale, useUiText } from "@/lib/i18n";

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
  const t = useUiText();
  const { locale } = useUiLocale();
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
      toast.success(t("Briefing iniciado!", "Briefing started!", "¡Briefing iniciado!"));
    },
    onError: (e: any) => toast.error(e.message || t("Erro ao iniciar briefing.", "Error starting briefing.", "Error al iniciar el briefing.")),
  });

  const approveMutation = useMutation({
    mutationFn: (intakeId: string) =>
      customFetch<{ intake: Intake }>(`/api/product-intake/${intakeId}/approve`, {
        method: "POST"
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/product-intake", productId] });
      toast.success(t("Briefing aprovado! Pronto para uso em todas as frentes.", "Briefing approved! Ready to use across all channels.", "¡Briefing aprobado! Listo para usar en todos los canales."));
    },
    onError: (e: any) => toast.error(e.message || t("Erro ao aprovar briefing.", "Error approving briefing.", "Error al aprobar el briefing.")),
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
          {t("Briefing central", "Central briefing", "Briefing central")}
        </h1>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground border-l-2 border-primary/50 pl-3">
          {t("A fonte da verdade. Lançamentos, inteligência de mercado, presença social e mídia paga usam estas informações.", "The source of truth. Launches, Market Intelligence, Social Presence, and Paid Media all use this information.", "La fuente de verdad. Los lanzamientos, la inteligencia de mercado, la presencia social y los medios pagados utilizan esta información.")}
        </p>
      </div>

      {!productId ? (
        // List products
        <div className="space-y-4">
          <h2 className="font-mono text-sm uppercase tracking-widest flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> {t("Selecione o produto", "Select a product", "Selecciona un producto")}
          </h2>
          {products.length === 0 ? (
            <div className="border border-dashed border-border/40 p-12 text-center space-y-3">
              <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest">
                 {t("Nenhum produto encontrado", "No products found", "No se encontraron productos")}
              </p>
              <Button onClick={() => setLocation("/produtos")} variant="outline" className="rounded-none font-mono uppercase tracking-widest text-xs gap-2">
                <Plus className="h-3.5 w-3.5" /> {t("Criar produto", "Create product", "Crear producto")}
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
                    {t("Briefing do produto", "Product briefing", "Briefing del producto")}
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
                         {t("Nenhum briefing iniciado", "No briefing started", "No se ha iniciado ningún briefing")}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground/60">
                         {t("Comece agora para centralizar as informações deste produto.", "Get started to centralize information about this product.", "Empieza ahora para centralizar la información de este producto.")}
                      </p>
                    </div>
                    <Button 
                      onClick={() => startMutation.mutate({ productId, entryPoint: requestedEntryPoint })}
                      disabled={startMutation.isPending}
                      className="rounded-none font-mono uppercase tracking-widest text-xs btn-weapon-primary h-10 px-6 gap-2 mx-auto"
                    >
                      <Plus className="h-4 w-4" /> {t("Iniciar briefing", "Start briefing", "Iniciar briefing")}
                    </Button>
                    <p className="font-mono text-[9px] text-muted-foreground mt-4">
                      {t("Você também pode vincular uma campanha existente em andamento.", "You can also link an existing campaign in progress.", "También puedes vincular una campaña existente en curso.")}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* CURRENT APPROVED INTAKE */}
                    {intakeData.current && (
                      <div className="border border-primary/30 bg-primary/5 p-6 space-y-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4">
                          <Badge variant="outline" className="border-success/40 text-success bg-success/10 font-mono text-[9px] uppercase tracking-widest">
                            {t("Aprovado", "Approved", "Aprobado")}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-6 w-6 text-success" />
                          <div>
                            <h3 className="font-mono text-base font-bold uppercase tracking-widest text-foreground">
                              {t("Versão ativa", "Active version", "Versión activa")} (v{intakeData.current.version})
                            </h3>
                            <p className="font-mono text-xs text-muted-foreground/60 mt-0.5">
                              {t("Fonte de verdade para a inteligência artificial.", "Source of truth for the AI.", "Fuente de verdad para la inteligencia artificial.")}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-border/20">
                           <div className="space-y-1">
                              <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{t("ID do snapshot", "Snapshot ID", "ID de la instantánea")}</div>
                             <div className="font-mono text-xs truncate" title={intakeData.current.id}>{intakeData.current.id.slice(0, 8)}</div>
                           </div>
                           <div className="space-y-1">
                              <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{t("Aprovado em", "Approved on", "Aprobado el")}</div>
                              <div className="font-mono text-xs truncate">{new Date(intakeData.current.approvedAt!).toLocaleDateString(intlLocale(locale))}</div>
                           </div>
                           <div className="space-y-1">
                              <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{t("Ponto de entrada", "Entry point", "Punto de entrada")}</div>
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
                                 {t("Rascunho", "Draft", "Borrador")} (v{intakeData.draft.version})
                              </h3>
                              <p className="font-mono text-xs text-muted-foreground/60 mt-0.5">
                                 {t("Alterações pendentes de aprovação.", "Changes awaiting approval.", "Cambios pendientes de aprobación.")}
                              </p>
                            </div>
                          </div>
                          <Button 
                            onClick={() => approveMutation.mutate(intakeData.draft!.id)}
                            disabled={approveMutation.isPending}
                            className="rounded-none font-mono uppercase tracking-widest text-[10px] btn-weapon-primary h-8 gap-2 shrink-0"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> {t("Aprovar", "Approve", "Aprobar")}
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
                      {t("Impacto nas operações", "Impact on operations", "Impacto en las operaciones")}
                   </h3>
                   <div className="space-y-3">
                      <div className="flex items-center gap-3 p-3 bg-background/50 border border-border/20">
                        <Rocket className="h-4 w-4 text-primary shrink-0" />
                        <div>
                          <div className="font-mono text-[11px] uppercase tracking-widest font-bold">{t("Lançamentos", "Launches", "Lanzamientos")}</div>
                          <div className="font-mono text-[9px] text-muted-foreground mt-0.5 leading-tight">{t("Campanhas ativas usarão estas informações", "Active campaigns will use this information", "Las campañas activas usarán esta información")}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-background/50 border border-border/20">
                        <Radar className="h-4 w-4 text-cyan-400 shrink-0" />
                        <div>
                          <div className="font-mono text-[11px] uppercase tracking-widest font-bold">Market Intel</div>
                          <div className="font-mono text-[9px] text-muted-foreground mt-0.5 leading-tight">{t("Análise de concorrência baseada nestas informações", "Competitor analysis based on this information", "Análisis de la competencia basado en esta información")}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-background/50 border border-border/20">
                        <Megaphone className="h-4 w-4 text-pink-400 shrink-0" />
                        <div>
                          <div className="font-mono text-[11px] uppercase tracking-widest font-bold">Social Presence</div>
                          <div className="font-mono text-[9px] text-muted-foreground mt-0.5 leading-tight">{t("Conteúdo autônomo com o mesmo tom", "Autonomous content in the same voice", "Contenido autónomo con el mismo tono")}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-background/50 border border-border/20">
                        <Target className="h-4 w-4 text-green-400 shrink-0" />
                        <div>
                          <div className="font-mono text-[11px] uppercase tracking-widest font-bold">{t("Mídia paga", "Paid media", "Medios pagados")}</div>
                          <div className="font-mono text-[9px] text-muted-foreground mt-0.5 leading-tight">{t("Criação autônoma de anúncios", "Autonomous ad launch", "Lanzamiento autónomo de anuncios")}</div>
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