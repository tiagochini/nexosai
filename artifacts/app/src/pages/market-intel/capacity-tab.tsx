import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, BarChart2, Check, CheckCircle2, Clock, Copy, Info, Loader2, MapPin, QrCode, Receipt, Search, Shield, Users } from "lucide-react";
import { useGetCampaigns, useRadarPayment, useRegionalCatalog, useRegionalEntitlement, useRequestRegionalUpgrade, useSelectNoRadar, useStartRadarCheckout } from "@/hooks/use-regional-intel";
import { toast } from "sonner";

interface Props { className?: string }
const key = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const date = (value?: string | Date | null) => value ? new Date(value).toLocaleDateString("pt-BR") : "—";
const price = (value: number, currency: "BRL" | "USD") => (value / 100).toLocaleString(currency === "BRL" ? "pt-BR" : "en-US", { style: "currency", currency });
const cadence = (minutes: number) => minutes >= 1440 ? "Diária" : minutes >= 360 ? "A cada 6 horas" : `${minutes} min`;

export function CapacityTab({ className = "" }: Props) {
  const [currency, setCurrency] = useState<"BRL" | "USD">("BRL");
  const [checkout, setCheckout] = useState<{ package: string; name: string; campaignId?: string } | null>(null);
  const [payment, setPayment] = useState<any>(null);
  const { data: catalogData, isLoading: catalogLoading } = useRegionalCatalog();
  const { data, isLoading: entitlementLoading, refetch } = useRegionalEntitlement();
  const commercial = useRequestRegionalUpgrade();
  const startCheckout = useStartRadarCheckout();
  const { data: campaignsData, isLoading: campaignsLoading } = useGetCampaigns();
  const noRadar = useSelectNoRadar();
  const paid = useRadarPayment(payment?.id ?? null);
  const entitlement = data?.entitlement;
  const subscription = entitlement?.subscription;
  const limits = entitlement?.limits;
  const isTrial = subscription?.source === "subscription_included" || subscription?.entitlementSource === "subscription_included";
  const trialStart = subscription?.periodStartsAt;
  const trialEnd = subscription?.periodEndsAt;
  const daysRemaining = trialEnd ? Math.max(0, Math.ceil((new Date(trialEnd).getTime() - Date.now()) / 86_400_000)) : null;
  const fulfillment = paid.data?.fulfillmentStatus ?? paid.data?.payment?.fulfillmentStatus ?? payment?.fulfillmentStatus;
  const activePayment = paid.data?.payment ?? payment;

  if (catalogLoading || entitlementLoading) return <div className="py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /><p className="mt-4 font-mono text-sm uppercase tracking-wider text-muted-foreground">Carregando Radar de Mercado…</p></div>;

  const begin = (pkg: any) => {
    if (currency === "USD") {
      commercial.mutate({ package: pkg.package, currency, idempotencyKey: key() }, {
        onSuccess: () => toast.success("Solicitação comercial registrada. O checkout Asaas opera apenas em BRL."),
        onError: (error: Error) => toast.error(error.message || "Não foi possível registrar a solicitação."),
      });
      return;
    }
    setCheckout({ package: pkg.package, name: pkg.name });
  };
  const pay = (method: "pix" | "boleto") => {
    if (!checkout) return;
    if (checkout.package === "WAR_ROOM" && !checkout.campaignId) {
      toast.error("Selecione a campanha da janela War Room.");
      return;
    }
    startCheckout.mutate({ package: checkout.package, method, idempotencyKey: key(), campaignId: checkout.campaignId }, {
      onSuccess: ({ payment: created }) => { setPayment(created); setCheckout(null); },
      onError: (error: Error) => toast.error(error.message || "Não foi possível criar o checkout Asaas."),
    });
  };
  const selectNoRadar = () => noRadar.mutate(key(), {
    onSuccess: () => toast.success("Preferência salva. O histórico continua disponível; novas varreduras e Councils ficam pausados."),
    onError: (error: Error) => toast.error(error.message || "Não foi possível salvar sua escolha."),
  });
  const pix = activePayment?.pixData;
  const boleto = activePayment?.boletoData;

  return <div className={`space-y-8 ${className}`}>
    <section className="grid lg:grid-cols-2 gap-6 border border-border/50 bg-card/30 p-6 rounded-sm">
      <div className="space-y-4">
        <h2 className="font-mono text-lg uppercase tracking-wider flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> Radar de Mercado</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">Inteligência contínua para acompanhar concorrentes e mercado com velocidade e fluidez. O Radar reduz testes e mídia desperdiçados ao transformar evidências em decisões adaptadas ao idioma e à região.</p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0" />Monitora movimentos concorrenciais e oportunidades de mercado continuamente.</li>
          <li className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0" />Acompanha oportunidades conquistadas no ciclo de vida autorizado, com linguagem adaptativa.</li>
          <li className="flex gap-2"><Check className="h-4 w-4 text-primary shrink-0" />Execução autônoma integralmente governada: sinais e recomendações não enviam contatos sem autorização.</li>
        </ul>
      </div>
      <div className="border border-primary/30 bg-primary/5 p-5 space-y-3">
        <h3 className="font-mono text-xs uppercase tracking-wider text-primary">Como funciona</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">A capacidade ativa define cadência, limites e retenção. Após o período incluído, escolha um pacote base ou <strong>No Radar</strong>. Sem pacote, não há novas varreduras custosas ou Councils; o histórico permanece somente para leitura.</p>
        <p className="text-xs text-muted-foreground leading-relaxed"><strong>War Room</strong> é um adicional de 30 dias para uma campanha/janela de lançamento — não substitui o pacote base.</p>
      </div>
    </section>

    {isTrial && <section className="border border-success/40 bg-success/5 p-5 space-y-3">
      <div className="flex flex-wrap justify-between gap-3"><div><Badge variant="outline" className="border-success/40 text-success">INCLUÍDO NA ASSINATURA NEXOS</Badge><h3 className="font-mono mt-2 text-base">Radar Pro incluído por 3 meses</h3></div><div className="text-right font-mono text-xs"><div>{daysRemaining} dias restantes</div><div className="text-muted-foreground">{date(trialStart)} — {date(trialEnd)}</div></div></div>
      <p className="text-sm text-muted-foreground">Sem cobrança de Radar neste período: 3 campanhas, 10 concorrentes, varreduras diárias, 3 regiões/idiomas, 100 Council runs por período de 30 dias, retenção de 180 dias e Centro de Interação.</p>
    </section>}

    <section className="space-y-4"><div className="flex justify-between border-b border-border/50 pb-2"><div><h3 className="font-mono text-base uppercase tracking-wider">Capacidade atual</h3><p className="text-xs text-muted-foreground mt-1">Consumo do período ativo.</p></div><Button variant="ghost" size="sm" onClick={() => refetch()}>Atualizar</Button></div>
      {entitlement?.active && limits ? <><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4"><Usage icon={BarChart2} label="Campanhas" used={data?.usage?.monitored_campaign || 0} total={limits.monitoredCampaigns}/><Usage icon={Users} label="Concorrentes" used={data?.usage?.competitor || 0} total={limits.competitors}/><Usage icon={MapPin} label="Regiões / idiomas" used={data?.usage?.region || 0} total={limits.regions}/><Usage icon={Search} label="Council runs" used={data?.usage?.council_run || 0} total={limits.councilRuns}/></div><div className="grid sm:grid-cols-3 gap-3 text-xs"><Stat label="Varredura" value={cadence(limits.scanCadenceMinutes)}/><Stat label="Retenção" value={`${limits.retentionDays} dias`}/><Stat label="Vigência" value={`até ${date(subscription?.windowEndsAt ?? subscription?.periodEndsAt)}`}/></div></> : <div className="border border-border/50 p-8 text-center"><Activity className="h-8 w-8 mx-auto text-muted-foreground mb-3"/><p className="font-mono text-sm">SEM PACOTE ATIVO</p><p className="text-xs text-muted-foreground mt-2">Seu histórico está preservado para consulta. Selecione um pacote para retomar novas varreduras e Councils.</p></div>}
    </section>

    {activePayment && <section className="border border-primary/40 bg-card/50 p-5 space-y-3"><div className="flex items-center gap-2 font-mono text-sm"><Receipt className="h-4 w-4 text-primary"/> Checkout Radar · {activePayment.method === "pix" ? "PIX" : "Boleto"}</div>
      {fulfillment === "fulfilled" || activePayment.status === "fulfilled" ? <p className="text-sm text-success flex gap-2"><CheckCircle2 className="h-4 w-4"/>Pagamento confirmado e capacidade ativada.</p> : ["overdue", "expired"].includes(activePayment.status) ? <p className="text-sm text-destructive">Este pagamento venceu/expirou e não ativou o Radar. Gere um novo checkout para continuar.</p> : <><p className="text-xs text-muted-foreground">Aguardando confirmação do Asaas e cumprimento da capacidade. O Radar só fica ativo após essa confirmação.</p>{pix?.qrCode && <img className="w-40 bg-white p-2" src={`data:image/png;base64,${pix.qrCode}`} alt="QR Code PIX"/>}{pix?.copiaECola && <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(pix.copiaECola).then(() => toast.success("PIX copiado."))}><Copy className="h-3.5 w-3.5 mr-1"/>Copiar PIX</Button>}{boleto?.barcodeUrl && <Button variant="outline" size="sm" onClick={() => window.open(boleto.barcodeUrl, "_blank", "noopener,noreferrer")}>Abrir boleto</Button>}<p className="text-[11px] text-muted-foreground flex gap-1"><Clock className="h-3 w-3"/>Status: {activePayment.status} {paid.isFetching ? "· atualizando…" : ""}</p></>}</section>}

    {checkout && <section className="border border-primary/40 bg-primary/5 p-5 flex flex-wrap items-center gap-3"><div className="mr-auto"><p className="font-mono text-sm">{checkout.name}</p><p className="text-xs text-muted-foreground">Checkout Asaas em BRL</p></div>
      {checkout.package === "WAR_ROOM" && <div className="w-full border border-amber-500/30 bg-amber-500/5 p-3 space-y-2"><p className="text-xs text-muted-foreground">A janela War Room dura 30 dias e fica vinculada somente à campanha selecionada; ela não substitui seu pacote Radar base.</p><label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Campanha da janela</label><select value={checkout.campaignId ?? ""} onChange={(event) => setCheckout(current => current ? { ...current, campaignId: event.target.value || undefined } : current)} disabled={campaignsLoading} className="w-full max-w-md border border-border/50 bg-background px-3 py-2 text-sm"><option value="">{campaignsLoading ? "Carregando campanhas…" : "Selecione uma campanha"}</option>{campaignsData?.campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}</select>{!campaignsLoading && !campaignsData?.campaigns.length && <p className="text-xs text-destructive">Crie uma campanha antes de contratar uma janela War Room.</p>}</div>}
      <Button onClick={() => pay("pix")} disabled={startCheckout.isPending || (checkout.package === "WAR_ROOM" && !checkout.campaignId)}><QrCode className="h-4 w-4 mr-1"/>Pagar com PIX</Button><Button variant="outline" onClick={() => pay("boleto")} disabled={startCheckout.isPending || (checkout.package === "WAR_ROOM" && !checkout.campaignId)}>Boleto</Button><Button variant="ghost" onClick={() => setCheckout(null)}>Cancelar</Button></section>}

    <section className="space-y-4 pt-3 border-t border-border/50"><div className="flex justify-between items-end"><div><h3 className="font-mono text-base uppercase tracking-wider">Escolha após o período incluído</h3><p className="text-xs text-muted-foreground mt-1">Valores atuais. Asaas processa somente BRL; USD solicita atendimento comercial.</p></div><div className="border border-border/50 p-1"><button onClick={() => setCurrency("BRL")} className={`px-3 py-1 text-xs ${currency === "BRL" ? "bg-primary/20 text-primary" : ""}`}>BRL</button><button onClick={() => setCurrency("USD")} className={`px-3 py-1 text-xs ${currency === "USD" ? "bg-primary/20 text-primary" : ""}`}>USD</button></div></div>
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">{(catalogData?.packages || []).map((pkg: any) => <Package key={pkg.package} pkg={pkg} currency={currency} active={subscription?.package === pkg.package} onChoose={() => begin(pkg)} loading={startCheckout.isPending || commercial.isPending}/>)}
        <div className="border border-border/50 p-5 flex flex-col"><h4 className="font-mono text-sm">NO RADAR</h4><p className="text-xs text-muted-foreground mt-3 flex-1">Não renovar o Radar. Sem novas varreduras custosas ou Councils; histórico legível.</p><Button variant="outline" className="mt-5" onClick={selectNoRadar} disabled={noRadar.isPending}>Continuar sem Radar</Button></div></div>
      <p className="text-[10px] text-muted-foreground flex gap-1"><Info className="h-3 w-3"/>O adicional War Room mantém sua natureza de janela separada de 30 dias e não troca o pacote base.</p>
    </section>
  </div>;
}

function Usage({ icon: Icon, label, used, total }: any) { const pct = Math.min(100, Math.round((used / total) * 100)); return <div className="border border-border/50 p-4"><div className="flex gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4 text-primary"/>{label}</div><div className="mt-3 font-mono text-xl">{used}<span className="text-xs text-muted-foreground"> / {total}</span></div><div className="h-1 mt-2 bg-muted"><div className="h-full bg-primary" style={{ width: `${pct}%` }}/></div></div> }
function Stat({ label, value }: { label: string; value: string }) { return <div className="border border-border/50 p-3 flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-mono text-right">{value}</span></div> }
function Package({ pkg, currency, active, onChoose, loading }: any) { const war = pkg.package === "WAR_ROOM"; return <div className={`border p-5 flex flex-col ${war ? "border-amber-500/50" : "border-border/50"}`}><div className="flex justify-between"><h4 className="font-mono text-sm">{pkg.name}</h4>{war && <Badge variant="outline" className="text-amber-500 border-amber-500/30">ADICIONAL</Badge>}</div><p className="font-mono text-xl mt-3">{price(pkg.prices[currency], currency)}</p><p className="text-[10px] text-muted-foreground">{war ? "por janela de 30 dias" : "por 30 dias"}</p><ul className="text-xs text-muted-foreground mt-4 space-y-1 flex-1"><li>{pkg.limits.monitoredCampaigns} campanhas · {pkg.limits.competitors} concorrentes</li><li>{pkg.limits.regions} regiões · {pkg.limits.councilRuns} Councils</li><li>{cadence(pkg.limits.scanCadenceMinutes)} · {pkg.limits.retentionDays} dias de retenção</li></ul><Button className="mt-5" variant={war ? "default" : "outline"} disabled={active || loading} onClick={onChoose}>{active ? "Pacote atual" : currency === "BRL" ? "Escolher e pagar" : "Solicitar comercial"}</Button></div> }