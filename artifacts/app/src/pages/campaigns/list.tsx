import { useListCampaigns, getListCampaignsQueryKey } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Rocket, ChevronRight, Clock, CheckCircle2, Loader2, Play } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho", intake: "Intake", analyzing: "Analisando",
  strategy_ready: "Estratégia Pronta", generating: "Gerando",
  awaiting_approval: "Aprovação", approved: "Aprovado",
  executing: "Em Execução", live: "Ao Vivo", completed: "Concluído",
};
const STATUS_COLOR: Record<string, string> = {
  live: "text-success border-success/40 bg-success/10",
  executing: "text-primary border-primary/40 bg-primary/10",
  generating: "text-primary border-primary/40 bg-primary/10",
  analyzing: "text-primary border-primary/40 bg-primary/10",
  awaiting_approval: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
  approved: "text-green-400 border-green-400/40 bg-green-400/10",
  strategy_ready: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10",
  completed: "text-muted-foreground border-border bg-muted/20",
  draft: "text-muted-foreground border-border bg-muted/20",
  intake: "text-blue-400 border-blue-400/40 bg-blue-400/10",
};
const STATUS_ICON: Record<string, React.ElementType> = {
  live: Play, executing: Loader2, generating: Loader2, analyzing: Loader2,
  awaiting_approval: Clock, approved: CheckCircle2, strategy_ready: CheckCircle2,
  completed: CheckCircle2, draft: Clock, intake: Loader2,
};
const TYPE_LABEL: Record<string, string> = {
  launch: "Lançamento", perpetual_launch: "Lançamento Perpétuo", flash_sale: "Flash Sale",
  live_sale: "Live Sale", continuous_sales: "Vendas Contínuas", subscription_growth: "Assinaturas",
  authority: "Autoridade", audience_growth: "Crescimento de Audiência", affiliate: "Afiliado",
  branding: "Branding", upsell: "Upsell", remarketing: "Remarketing", scale: "Escala",
};
const TRACK_LABEL: Record<string, string> = {
  six_digits: "6 Dígitos", eight_digits: "8 Dígitos", ten_digits: "10 Dígitos",
  not_applicable: "—",
};

export default function CampaignsList() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useListCampaigns({
    query: { queryKey: getListCampaignsQueryKey() },
  });

  const campaigns = data?.campaigns ?? [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold text-foreground">
            Missões Ativas
          </h1>
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-1">
            {campaigns.length} {campaigns.length === 1 ? "campanha registrada" : "campanhas registradas"}
          </p>
        </div>
        <Link href="/campaigns/new">
          <Button className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-11 px-5">
            <Plus className="h-4 w-4" />Nova Campanha
          </Button>
        </Link>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 bg-muted/20" />)}
        </div>
      )}

      {/* Empty */}
      {!isLoading && campaigns.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 border border-border/50 bg-card/30 flex items-center justify-center">
            <Rocket className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <div className="text-center">
            <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest mb-1">
              Nenhuma campanha registrada
            </p>
            <p className="font-mono text-[10px] text-muted-foreground/50 mb-5">
              Crie sua primeira campanha para iniciar o lançamento
            </p>
            <Link href="/onboarding">
              <Button className="font-mono uppercase tracking-widest rounded-none gap-2 btn-weapon-primary h-11">
                <Plus className="h-4 w-4" />Iniciar Onboarding
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Campaign list */}
      {!isLoading && campaigns.length > 0 && (
        <div className="space-y-3">
          {campaigns.map(campaign => {
            const Icon = STATUS_ICON[campaign.status] ?? Rocket;
            const isAnimated = ["analyzing", "generating", "executing", "live"].includes(campaign.status);
            return (
              <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
                <div className="border border-border/50 bg-card/40 p-4 md:p-5 cursor-pointer hover:border-primary/50 hover:bg-card/60 transition-all group relative overflow-hidden">
                  {/* Corner accents */}
                  <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-primary/20 group-hover:border-primary transition-colors" />
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-primary/20 group-hover:border-primary transition-colors" />

                  <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                    {/* Status icon */}
                    <div className={`w-10 h-10 border flex items-center justify-center shrink-0 ${STATUS_COLOR[campaign.status] ?? "border-border text-muted-foreground"}`}>
                      <Icon className={`h-4 w-4 ${isAnimated ? "animate-spin" : ""}`} />
                    </div>

                    {/* Title + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-sm text-foreground group-hover:text-primary transition-colors uppercase tracking-wide truncate">
                          {campaign.title}
                        </span>
                        <Badge variant="outline" className={`rounded-none font-mono text-[9px] px-2 py-0.5 border shrink-0 ${STATUS_COLOR[campaign.status] ?? ""}`}>
                          {STATUS_LABEL[campaign.status] ?? campaign.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[9px] font-mono uppercase tracking-widest text-muted-foreground/70">
                        <span>{TYPE_LABEL[campaign.type] ?? campaign.type}</span>
                        <span>·</span>
                        <span>{campaign.track ? (TRACK_LABEL[campaign.track] ?? campaign.track) : "—"}</span>
                        {campaign.revenueTarget && (
                          <><span>·</span>
                          <span className="text-success">Meta: R$ {Number(campaign.revenueTarget).toLocaleString("pt-BR")}</span></>
                        )}
                        <span>·</span>
                        <span>{campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString("pt-BR") : "—"}</span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 hidden md:block" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
