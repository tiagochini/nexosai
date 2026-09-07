import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, Activity, BarChart2, Users, MapPin, Search, Check, Info, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useRegionalCatalog, useRegionalEntitlement, useRequestRegionalUpgrade } from "@/hooks/use-regional-intel";
import { toast } from "sonner";

interface Props {
  className?: string;
}

export function CapacityTab({ className = "" }: Props) {
  const [currency, setCurrency] = useState<"BRL" | "USD">("BRL");
  const [requestingPackage, setRequestingPackage] = useState<string | null>(null);

  const { data: catalogData, isLoading: catalogLoading } = useRegionalCatalog();
  const { data: entitlementData, isLoading: entitlementLoading } = useRegionalEntitlement();
  const { mutate: requestUpgrade, isPending: upgrading } = useRequestRegionalUpgrade();

  if (catalogLoading || entitlementLoading) {
    return (
      <div className="py-20 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="mt-4 font-mono text-sm uppercase tracking-wider text-muted-foreground">Carregando governança...</p>
      </div>
    );
  }

  const packages = catalogData?.packages || [];
  const entitlement = entitlementData?.entitlement;
  const usage = entitlementData?.usage || {};
  const active = entitlement?.active;
  const limits = entitlement?.limits;
  const subscription = entitlement?.subscription;
  const pendingRequest = entitlementData?.pendingRequest;
  const nextEligibleScanAt = entitlementData?.nextEligibleScanAt;

  const handleRequestUpgrade = (pkg: string) => {
    setRequestingPackage(pkg);
    const idempotencyKey = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    requestUpgrade(
      { package: pkg, currency, idempotencyKey },
      {
        onSuccess: () => {
          toast.success("Solicitação comercial registrada com sucesso. A equipe entrará em contato para ativação.");
          setRequestingPackage(null);
        },
        onError: (err: any) => {
          toast.error(err.message || "Erro ao solicitar pacote.");
          setRequestingPackage(null);
        }
      }
    );
  };

  const formatPrice = (cents: number, cur: "BRL" | "USD") => {
    return (cents / 100).toLocaleString(cur === "BRL" ? "pt-BR" : "en-US", {
      style: "currency",
      currency: cur,
    });
  };

  const formatCadence = (minutes: number) => {
    if (minutes >= 10080) return "Semanal";
    if (minutes >= 1440) return "Diária";
    if (minutes >= 360) return "A cada 6 horas";
    if (minutes <= 60) return `${minutes} minutos`;
    return `${Math.floor(minutes / 60)} horas`;
  };

  return (
    <div className={`space-y-10 ${className}`}>
      {/* Value Proposition Header */}
      <div className="grid md:grid-cols-2 gap-8 items-center border border-border/50 bg-card/30 p-6 rounded-sm">
        <div className="space-y-4">
          <h2 className="font-mono text-lg uppercase tracking-wider flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Governança do Radar
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O Radar é o motor de inteligência regional do NexOS. Substitua ferramentas fragmentadas e trabalho de agência por inteligência compartilhada e visibilidade contínua de movimentos concorrenciais. 
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Identifique gaps de oferta, conteúdo e plataforma antes dos concorrentes, desenvolvendo um posicionamento baseado em evidências.</li>
            <li className="flex items-start gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Priorize oportunidades qualificadas baseadas no calor social determinístico.</li>
            <li className="flex items-start gap-2"><Check className="h-4 w-4 text-primary shrink-0 mt-0.5" /> Garanta interações assistidas governadas, operando de forma centralizada.</li>
          </ul>
        </div>
        <div className="border border-amber-500/30 bg-amber-500/5 p-5 rounded-sm space-y-3">
          <h3 className="font-mono text-xs uppercase tracking-wider text-amber-500 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" /> Diretrizes de Governança
          </h3>
          <p className="text-xs text-muted-foreground">
            A atividade de varredura e interação do sistema opera estritamente dentro dos limites do seu pacote ativo.
          </p>
          <div className="bg-background/50 border border-border/50 p-3 rounded-sm">
            <p className="text-xs font-medium text-foreground">As interações de terceiros nunca são automáticas.</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              O sistema coleta sinais, identifica oportunidades e sugere ações de engajamento, mas a execução final sempre exige aprovação humana, garantindo compliance e brand safety.
            </p>
          </div>
        </div>
      </div>

      {/* Current Entitlement & Usage */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/50 pb-2">
          <div>
            <h3 className="font-mono text-base uppercase tracking-wider">Capacidade Atual</h3>
            <p className="text-xs text-muted-foreground mt-1">Consumo no período vigente.</p>
          </div>
          {active && subscription && (
            <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 uppercase tracking-widest text-[10px] py-1 px-3">
              {subscription.package.replace("_", " ")}
            </Badge>
          )}
        </div>

        {active && limits ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <UsageCard icon={BarChart2} label="Campanhas" used={usage.monitored_campaign || 0} total={limits.monitoredCampaigns} />
            <UsageCard icon={Users} label="Concorrentes" used={usage.competitor || 0} total={limits.competitors} />
            <UsageCard icon={MapPin} label="Regiões" used={usage.region || 0} total={limits.regions} />
            <UsageCard icon={Search} label="Análises de Conselho" used={usage.council_run || 0} total={limits.councilRuns} />
            
            <div className="col-span-full grid md:grid-cols-3 gap-4 mt-2">
              <div className="border border-border/50 bg-card/30 p-4 rounded-sm flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Cadência de Varredura</span>
                <span className="text-sm font-medium">{formatCadence(limits.scanCadenceMinutes)}</span>
              </div>
              <div className="border border-border/50 bg-card/30 p-4 rounded-sm flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Retenção de Dados</span>
                <span className="text-sm font-medium">{limits.retentionDays} dias</span>
              </div>
              <div className="border border-border/50 bg-card/30 p-4 rounded-sm flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Período Ativo</span>
                <span className="text-[10px] font-mono text-right">
                  Até {new Date(subscription.package === "WAR_ROOM" ? subscription.windowEndsAt : subscription.periodEndsAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
              {nextEligibleScanAt && (
                <div className="border border-border/50 bg-card/30 p-4 rounded-sm flex items-center justify-between col-span-full md:col-span-1">
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Próxima Varredura</span>
                  <span className="text-sm font-medium">{new Date(nextEligibleScanAt).toLocaleString("pt-BR")}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="border border-border/50 rounded-sm p-12 text-center bg-card/30">
            <Activity className="h-10 w-10 mx-auto text-muted-foreground mb-4 opacity-50" />
            <p className="font-mono text-sm uppercase tracking-wider mb-2">Nenhum Pacote Ativo</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Selecione um dos pacotes comerciais abaixo para habilitar o Radar e iniciar a varredura da sua inteligência regional.
            </p>
          </div>
        )}
      </div>

      {/* Catalog & Upgrade */}
      <div className="space-y-6 pt-4 border-t border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h3 className="font-mono text-base uppercase tracking-wider">Planos e Licenças</h3>
            <p className="text-xs text-muted-foreground mt-1">O pacote War Room oferece uma janela de aceleração intensa por 30 dias.</p>
          </div>
          <div className="flex bg-background border border-border/50 rounded-sm p-1">
            <button
              onClick={() => setCurrency("BRL")}
              className={`px-3 py-1 text-xs font-mono uppercase tracking-widest rounded-sm transition-colors ${currency === "BRL" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              BRL
            </button>
            <button
              onClick={() => setCurrency("USD")}
              className={`px-3 py-1 text-xs font-mono uppercase tracking-widest rounded-sm transition-colors ${currency === "USD" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              USD
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {packages.map((pkg: any) => {
            const isWarRoom = pkg.package === "WAR_ROOM";
            const isActive = active && subscription?.package === pkg.package;
            const price = pkg.prices[currency];

            return (
              <div key={pkg.package} className={`border rounded-sm flex flex-col ${isWarRoom ? "border-amber-500/50 bg-amber-500/5" : isActive ? "border-primary/50 bg-primary/5" : "border-border/50 bg-card/30"}`}>
                <div className="p-5 border-b border-border/50 space-y-3 flex-1">
                  <div className="flex justify-between items-start">
                    <h4 className={`font-mono text-sm uppercase tracking-wider font-bold ${isWarRoom ? "text-amber-500" : "text-foreground"}`}>
                      {pkg.name}
                    </h4>
                    {isWarRoom && <Badge variant="outline" className="text-[9px] uppercase tracking-widest text-amber-500 border-amber-500/30">Lançamento</Badge>}
                  </div>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold font-mono">{formatPrice(price, currency)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                      por {isWarRoom ? "30 dias" : "mês"}
                    </p>
                  </div>
                  
                  <ul className="pt-4 space-y-2 text-xs text-muted-foreground">
                    <li className="flex justify-between"><span>Campanhas:</span> <span className="font-mono text-foreground">{pkg.limits.monitoredCampaigns}</span></li>
                    <li className="flex justify-between"><span>Concorrentes:</span> <span className="font-mono text-foreground">{pkg.limits.competitors}</span></li>
                    <li className="flex justify-between"><span>Regiões:</span> <span className="font-mono text-foreground">{pkg.limits.regions}</span></li>
                    <li className="flex justify-between"><span>Análises (Run):</span> <span className="font-mono text-foreground">{pkg.limits.councilRuns}</span></li>
                    <li className="flex justify-between"><span>Cadência:</span> <span className="font-mono text-foreground">{formatCadence(pkg.limits.scanCadenceMinutes)}</span></li>
                    <li className="flex justify-between"><span>Retenção:</span> <span className="font-mono text-foreground">{pkg.limits.retentionDays} d</span></li>
                    
                    {pkg.limits.interactionCenter && (
                      <li className="flex items-center gap-1.5 pt-2 text-green-400">
                        <CheckCircle2 className="h-3 w-3" /> Centro de Interação
                      </li>
                    )}
                    {pkg.limits.executiveIntelligence && (
                      <li className="flex items-center gap-1.5 pt-1 text-primary">
                        <CheckCircle2 className="h-3 w-3" /> Inteligência Executiva
                      </li>
                    )}
                  </ul>
                </div>
                <div className="p-5 mt-auto">
                  {isActive ? (
                    <Button variant="outline" className="w-full border-primary text-primary" disabled>
                      Plano Atual
                    </Button>
                  ) : (
                    <Button 
                      className="w-full flex-col h-auto py-2.5" 
                      variant={isWarRoom ? "default" : "outline"}
                      onClick={() => handleRequestUpgrade(pkg.package)}
                      disabled={(upgrading && requestingPackage === pkg.package) || pendingRequest?.package === pkg.package}
                    >
                      <span className="uppercase tracking-widest text-xs font-bold">
                        {pendingRequest?.package === pkg.package
                          ? "Solicitação em análise"
                          : upgrading && requestingPackage === pkg.package
                            ? "Solicitando..."
                            : "Solicitar Ativação"}
                      </span>
                      <span className="text-[9px] opacity-70 mt-0.5">
                        {pendingRequest?.package === pkg.package ? "Aguardando retorno comercial" : "Sujeito a aprovação comercial"}
                      </span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1.5 pt-4">
          <Info className="h-3 w-3" /> A ativação do plano ocorre somente após a confirmação pela equipe comercial.
        </p>
      </div>
    </div>
  );
}

function UsageCard({ icon: Icon, label, used, total }: { icon: any, label: string, used: number, total: number }) {
  const percentage = Math.min(Math.round((used / total) * 100), 100);
  const isNearLimit = percentage >= 90;

  return (
    <div className="border border-border/50 bg-card/30 p-4 rounded-sm space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-mono">{used}</span>
        <span className="text-xs text-muted-foreground mb-1">/ {total}</span>
      </div>
      <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all ${isNearLimit ? "bg-destructive" : "bg-primary"}`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
