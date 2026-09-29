import { Link } from "wouter";
import { useListSequences, getListSequencesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, Workflow, Calendar, Activity, Eye, BarChart, AlertTriangle } from "lucide-react";
import { FeatureOnboarding, FeatureOnboardingTrigger } from "@/components/feature-onboarding";
import { FEATURE_KEYS } from "@/hooks/useFeatureOnboarding";
import { useUiText } from "@/lib/i18n";

export default function SequencesList() {
  const t = useUiText();
  const { data, isLoading } = useListSequences({
    query: {
      queryKey: getListSequencesQueryKey()
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'live': return <Badge variant="outline" className="rounded-none font-mono text-[11px] uppercase tracking-widest bg-success/10 text-success border-success/40 badge-glow-green">{t("Operante", "Active", "Activa")}</Badge>;
      case 'draft': return <Badge variant="outline" className="rounded-none font-mono text-[11px] uppercase tracking-widest bg-muted/20 text-muted-foreground border-border/50">{t("Rascunho", "Draft", "Borrador")}</Badge>;
      case 'generating': return <Badge variant="outline" className="rounded-none font-mono text-[11px] uppercase tracking-widest bg-primary/10 text-primary border-primary/40 badge-glow-blue animate-pulse-slow">{t("Gerando", "Generating", "Generando")}</Badge>;
      default: return <Badge variant="outline" className="rounded-none font-mono text-[11px] uppercase tracking-widest bg-primary/10 text-primary border-primary/40 badge-glow-primary">{status}</Badge>;
    }
  };

  const getModelName = (model: string) => {
    const models: Record<string, string> = {
      plf: "PLF",
      formula_de_lancamento: t("Fórmula de Lançamento", "Launch Formula", "Fórmula de Lanzamiento"),
      semente: t("Semente", "Seed Launch", "Lanzamiento Semilla"),
      afiliado: t("Afiliado", "Affiliate", "Afiliado"),
      perpetual: t("Perpétuo", "Evergreen", "Perpetuo"),
      custom: t("Customizado", "Custom", "Personalizado")
    };
    return models[model] || model;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/50 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-mono uppercase tracking-tighter font-bold text-foreground">
            {t("Matriz de Sequências", "Sequence Matrix", "Matriz de Secuencias")}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono uppercase tracking-widest">{t("Canais de disparo e automação programada", "Delivery channels and scheduled automation", "Canales de envío y automatización programada")}</p>
        </div>
        <div className="flex items-center gap-2">
          <FeatureOnboardingTrigger featureKey={FEATURE_KEYS.SEQUENCES} />
          <Link href="/sequences/new">
            <Button className="font-mono uppercase tracking-widest font-bold rounded-none gap-2 btn-weapon-primary h-10 px-5 text-xs w-full sm:w-auto">
              <Plus className="h-3.5 w-3.5" />
              {t("Nova Sequência", "New Sequence", "Nueva secuencia")}
            </Button>
          </Link>
        </div>
      </div>

      <FeatureOnboarding
        featureKey={FEATURE_KEYS.SEQUENCES}
        title={t("MATRIZ DE SEQUÊNCIAS", "SEQUENCE MATRIX", "MATRIZ DE SECUENCIAS")}
        description={t("Automações de disparo que rodam sozinhas durante o lançamento — WhatsApp, e-mail, segmentação por temperatura de lead (hot/warm/cold).", "Automated messages that run throughout the launch — WhatsApp, email, and lead-temperature segmentation (hot/warm/cold).", "Mensajes automatizados durante el lanzamiento — WhatsApp, correo electrónico y segmentación por temperatura del lead (hot/warm/cold).")}
        variant="banner"
        steps={[
          t("Crie uma sequência e vincule à campanha ativa", "Create a sequence and link it to the active campaign", "Crea una secuencia y vincúlala a la campaña activa"),
          t("Configure os canais: WhatsApp Business e/ou e-mail (RD Station, ActiveCampaign)", "Configure channels: WhatsApp Business and/or email (RD Station, ActiveCampaign)", "Configura los canales: WhatsApp Business y/o correo electrónico (RD Station, ActiveCampaign)"),
          t("Ative — a agente despacha no horário certo para cada segmento automaticamente", "Activate it — the agent automatically sends messages to each segment at the right time", "Actívala: el agente envía los mensajes a cada segmento automáticamente en el momento adecuado"),
          t("Acompanhe taxas de abertura, cliques e sugestões adaptativas em tempo real", "Track open and click rates, plus adaptive suggestions in real time", "Consulta las tasas de apertura y clics, además de sugerencias adaptativas en tiempo real"),
        ]}
      />

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
            <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest mb-6">{t("Nenhuma matriz detectada no radar.", "No sequence matrix found.", "No se encontró ninguna matriz de secuencias.")}</p>
            <Link href="/sequences/new">
              <Button variant="outline" className="font-mono uppercase tracking-widest rounded-none border-primary/50 text-primary hover:bg-primary/10 h-10 px-6 btn-weapon-outline">
                {t("Inicializar Matriz", "Create Matrix", "Crear matriz")}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {data?.sequences?.map(seq => (
              <div key={seq.id} className="p-4 sm:p-6 flex flex-col gap-3 table-row-glow group relative">
                <div className="flex items-start gap-3 sm:gap-5">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 border border-border/50 bg-background/50 flex items-center justify-center shrink-0 relative">
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <Workflow className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-bold font-mono uppercase tracking-wider text-base group-hover:text-primary transition-colors">{seq.name}</h3>
                      {getStatusBadge(seq.status)}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground uppercase font-mono tracking-widest">
                      <span className="flex items-center gap-1.5 border border-border/50 px-2 py-0.5 bg-background/30">
                        <span className="opacity-50">{t("Modelo:", "Model:", "Modelo:")}</span> <span className="text-primary font-bold">{getModelName(seq.model)}</span>
                      </span>
                      <span className="flex items-center gap-1.5 border border-border/50 px-2 py-0.5 bg-background/30">
                        <span className="opacity-50">{t("Duração:", "Duration:", "Duración:")}</span> <span className="text-foreground font-bold">{seq.totalDays} {t("dias", "days", "días")}</span>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 pl-12 sm:pl-15">
                  <Link href={`/sequences/${seq.id}`}>
                    <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-[10px] tracking-widest h-7 px-2.5 btn-weapon-outline">
                      <Eye className="h-3 w-3 mr-1.5" />{t("Detalhes", "Details", "Detalles")}
                    </Button>
                  </Link>
                  <Link href={`/sequences/${seq.id}/calendar`}>
                    <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-[10px] tracking-widest h-7 px-2.5 btn-weapon-outline">
                      <Calendar className="h-3 w-3 mr-1.5" />{t("Calendário", "Calendar", "Calendario")}
                    </Button>
                  </Link>
                  <Link href={`/sequences/${seq.id}/today`}>
                    <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-[10px] tracking-widest h-7 px-2.5 border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground transition-all">
                      <Activity className="h-3 w-3 mr-1.5" />{t("Operação", "Operations", "Operación")}
                    </Button>
                  </Link>
                  <Link href={`/sequences/${seq.id}/analytics`}>
                    <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-[10px] tracking-widest h-7 px-2.5 btn-weapon-outline">
                      <BarChart className="h-3 w-3 mr-1.5" />{t("Métricas", "Metrics", "Métricas")}
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
