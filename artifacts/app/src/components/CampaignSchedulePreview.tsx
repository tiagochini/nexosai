import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUiText } from "@/lib/i18n";
import { toast } from "sonner";
import { CalendarDays, CheckCircle2, Copy, CreditCard, FileDown, Loader2, Lock, QrCode, Sparkles, WandSparkles } from "lucide-react";

type Phase = Record<string, unknown>;
type Plan = { id: string; name: string; slug: string; monthlyPriceBrl: number };
type Payment = {
  id: string; status: string; amountCents: number; method: string;
  pixData?: { qrCode?: string; copiaECola?: string; instructions?: string } | null;
};
type CardDetails = {
  holderName: string; number: string; expiryMonth: string; expiryYear: string; cvv: string;
  cpfCnpj: string; phone: string; postalCode: string; addressNumber: string;
};
const EMPTY_CARD: CardDetails = { holderName: "", number: "", expiryMonth: "", expiryYear: "", cvv: "", cpfCnpj: "", phone: "", postalCode: "", addressNumber: "" };

function formatScheduleDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return String(value ?? "");
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function CampaignSchedulePreview({ campaignId, timeline, trialAccess, onDownloadPdf }: {
  campaignId: string;
  timeline: Record<string, unknown>;
  trialAccess: boolean;
  onDownloadPdf: () => void;
}) {
  const t = useUiText();
  const queryClient = useQueryClient();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [activePhase, setActivePhase] = useState<Phase | null>(null);
  const [planId, setPlanId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "credit_card">("pix");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [card, setCard] = useState<CardDetails>(EMPTY_CARD);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [copied, setCopied] = useState(false);
  const confirmationHandled = useRef(false);
  const scheduleAttempted = useRef(false);

  const storedSchedulePreview = timeline["schedulePreview"] && typeof timeline["schedulePreview"] === "object"
    ? timeline["schedulePreview"] as Record<string, unknown> : null;
  // Discard the former generic template and refetch once from the approved
  // briefing/Master Plan sources. Version 2 is persisted by the API.
  const schedulePreview = storedSchedulePreview?.["sourceVersion"] === 3 ? storedSchedulePreview : null;
  const phases = Array.isArray(schedulePreview?.["phases"])
    ? (schedulePreview["phases"] as unknown[]).filter((phase): phase is Phase => Boolean(phase && typeof phase === "object" && !Array.isArray(phase)))
    : [];
  const scheduleMutation = useMutation({
    mutationFn: () => customFetch<{ schedulePreview: Record<string, unknown> }>(`/api/campaigns/${campaignId}/schedule-preview/generate`, { method: "POST" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}`] });
      toast.success(t("Cronograma gerado e salvo.", "Schedule generated and saved.", "Cronograma generado y guardado."));
    },
    onError: (error: any) => toast.error(error?.data?.error || error?.message || t("Não foi possível gerar o cronograma.", "Could not generate the schedule.", "No se pudo generar el cronograma."), { duration: 7000 }),
  });
  useEffect(() => {
    if (phases.length > 0 || scheduleAttempted.current) return;
    scheduleAttempted.current = true;
    scheduleMutation.mutate();
  }, [campaignId, phases.length, scheduleMutation.mutate]);
  const plansQuery = useQuery({
    queryKey: ["/api/plans", "quick-license-checkout"],
    queryFn: async () => {
      const response = await customFetch<{ plans: Array<Record<string, unknown>> }>("/api/plans");
      return response.plans.map((plan) => ({
        id: String(plan["id"] ?? ""), name: String(plan["name"] ?? ""), slug: String(plan["slug"] ?? ""),
        monthlyPriceBrl: Math.round(Number(plan["priceMonthly"] ?? plan["monthlyPriceBrl"] ?? 0) * (plan["priceMonthly"] !== undefined ? 100 : 1)),
      })).filter((plan) => plan.id && plan.monthlyPriceBrl > 0) as Plan[];
    }, enabled: checkoutOpen,
  });

  const generatedQuery = useQuery({
    queryKey: ["/api/campaigns", campaignId, "content", "schedule-preview"],
    queryFn: () => customFetch<{ pieces?: Array<Record<string, unknown>> }>(`/api/campaigns/${campaignId}/content`),
    enabled: Boolean(campaignId) && !trialAccess,
  });
  const generatedPhaseIds = new Set((generatedQuery.data?.pieces ?? []).map((piece) => {
    const content = piece["content"] && typeof piece["content"] === "object" ? piece["content"] as Record<string, unknown> : {};
    return String(piece["launchPhase"] ?? content["launchPhase"] ?? "");
  }).filter(Boolean));

  const generateMutation = useMutation({
    mutationFn: (phaseId: string) => customFetch(`/api/campaigns/${campaignId}/content/generate-phase`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phaseId }),
    }),
    onSuccess: (_result, phaseId) => {
      void queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "content", "schedule-preview"] });
      toast.success(generatedPhaseIds.has(phaseId)
        ? t("O conteúdo desta etapa já estava salvo.", "This phase’s content was already saved.", "El contenido de esta etapa ya estaba guardado.")
        : t("Conteúdo gerado e salvo para revisão.", "Content generated and saved for review.", "Contenido generado y guardado para revisión."));
    },
    onError: (error: any) => toast.error(error?.data?.error || t("Não foi possível gerar esta etapa.", "Could not generate this phase.", "No se pudo generar esta etapa."), { duration: 7000 }),
  });

  const purchaseMutation = useMutation({
    mutationFn: async () => customFetch<{ payment: Payment }>("/api/billing/initiate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paymentMethod === "pix"
        ? { planId, method: "pix", cpfCnpj: cpfCnpj.replace(/\D/g, "") }
        : { planId, method: "credit_card", card: { ...card, number: card.number.replace(/\D/g, ""), cpfCnpj: card.cpfCnpj.replace(/\D/g, ""), phone: card.phone.replace(/\D/g, ""), postalCode: card.postalCode.replace(/\D/g, "") } }),
    }),
    onSuccess: (result) => { setPayment(result.payment); setCard(EMPTY_CARD); setCpfCnpj(""); confirmationHandled.current = false; },
    onError: (error: Error) => toast.error(error.message || t("Não foi possível iniciar o checkout.", "Could not start checkout.", "No se pudo iniciar el checkout.")),
  });
  const paymentQuery = useQuery({
    queryKey: ["/api/billing/payment", payment?.id, "quick-checkout"],
    queryFn: () => customFetch<{ payment: Payment }>(`/api/billing/payment/${payment!.id}`),
    enabled: Boolean(payment?.id && !["paid", "failed", "cancelled", "expired"].includes(payment.status)),
    refetchInterval: (query) => ["paid", "failed", "cancelled", "expired"].includes(query.state.data?.payment?.status ?? "") ? false : 5000,
  });
  const currentPayment = paymentQuery.data?.payment ?? payment;
  const cardReady = card.holderName.trim().length > 0 && /^\d{13,19}$/.test(card.number.replace(/\D/g, ""))
    && /^(0[1-9]|1[0-2])$/.test(card.expiryMonth) && /^\d{2}(?:\d{2})?$/.test(card.expiryYear)
    && /^\d{3,4}$/.test(card.cvv) && /^(\d{11}|\d{14})$/.test(card.cpfCnpj.replace(/\D/g, ""))
    && /^\d{10,13}$/.test(card.phone.replace(/\D/g, "")) && /^\d{8}$/.test(card.postalCode.replace(/\D/g, ""))
    && card.addressNumber.trim().length > 0;
  useEffect(() => {
    if (currentPayment?.status !== "paid" || confirmationHandled.current) return;
    confirmationHandled.current = true;
    toast.success(t("Licença confirmada. O acesso será atualizado agora.", "License confirmed. Access is being updated now.", "Licencia confirmada. El acceso se actualizará ahora."));
    void queryClient.invalidateQueries({ queryKey: ["/api/onboarding/status"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/billing/access"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/billing/status"] });
  }, [currentPayment?.status, queryClient, t]);

  const beginGeneration = (phase: Phase) => {
    setActivePhase(phase);
    if (trialAccess) setCheckoutOpen(true);
    else {
      const phaseId = String(phase["phase"] ?? phase["id"] ?? phase["name"] ?? "");
      if (phaseId) generateMutation.mutate(phaseId);
    }
  };

  return <>
    <section className="space-y-4 border border-cyan-400/25 bg-cyan-400/[0.025] p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
        <div className="min-w-0 flex-1">
          <h2 className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-cyan-200">{t("Prévia do cronograma de lançamento", "Launch schedule preview", "Vista previa del cronograma de lanzamiento")}</h2>
          <p className="mt-1 font-mono text-[10px] leading-relaxed text-muted-foreground/65">{t("A prévia reúne datas e um resumo operacional. Copy, imagens e vídeos só são gerados separadamente quando você solicitar.", "The preview contains dates and an operational summary. Copy, images, and videos are generated separately only when requested.", "La vista previa incluye fechas y un resumen operativo. Los textos, imágenes y videos solo se generan por separado cuando los solicites.")}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onDownloadPdf}
          className="w-full shrink-0 gap-1.5 rounded-none font-mono text-[9px] uppercase tracking-wider sm:w-auto"
        >
          <FileDown className="h-3 w-3" />
          {t("Baixar PDF do plano", "Download plan PDF", "Descargar PDF del plan")}
        </Button>
      </div>
      {phases.length === 0 ? <div className="space-y-3 border border-amber-300/20 bg-amber-300/[0.04] p-3">
        <p className="font-mono text-[10px] text-amber-100/75">{t("Montando uma única prévia com os prazos do briefing e as etapas e recomendações do Master Plan aprovado. O sistema não inventa datas ou durações que não estejam nessas fontes.", "Building a one-time preview from the brief’s timing and the approved Master Plan’s phases and recommendations. The system does not invent dates or durations missing from those sources.", "Preparando una única vista previa con los plazos del briefing y las etapas y recomendaciones del Plan Maestro aprobado. El sistema no inventa fechas ni duraciones que no aparezcan en esas fuentes.")}</p>
        {scheduleMutation.isPending && <p className="flex items-center gap-2 font-mono text-[10px] text-cyan-100/75"><Loader2 className="h-3 w-3 animate-spin" />{t("Salvando o cronograma…", "Saving the schedule…", "Guardando el cronograma…")}</p>}
        {scheduleMutation.isError && <Button type="button" size="sm" onClick={() => { scheduleAttempted.current = true; scheduleMutation.mutate(); }} disabled={scheduleMutation.isPending} className="h-8 gap-1.5 rounded-none font-mono text-[9px] uppercase tracking-wider">
          {scheduleMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <WandSparkles className="h-3 w-3" />}
          {t("Tentar salvar prévia", "Retry saving preview", "Reintentar guardar vista previa")}
        </Button>}
      </div> : <div className="space-y-3">
        {typeof schedulePreview?.["dateNote"] === "string" && <p className={`border p-3 font-mono text-[10px] ${schedulePreview?.["dateBasis"] === "suggested" ? "border-amber-300/20 bg-amber-300/[0.04] text-amber-100/75" : "border-cyan-300/20 bg-cyan-300/[0.03] text-cyan-100/75"}`}>
          {schedulePreview?.["dateBasis"] === "suggested" ? t("Janela sugerida para revisão: ", "Suggested window for review: ", "Ventana sugerida para revisar: ") : ""}{String(schedulePreview["dateNote"])}
        </p>}
        {phases.map((phase, index) => {
          const phaseId = String(phase["phase"] ?? phase["id"] ?? phase["name"] ?? `phase-${index + 1}`);
          const phaseName = String(phase["name"] ?? phase["phase"] ?? t(`Etapa ${index + 1}`, `Phase ${index + 1}`, `Etapa ${index + 1}`));
          const alreadyGenerated = generatedPhaseIds.has(phaseId);
          const isGenerating = generateMutation.isPending && generateMutation.variables === phaseId;
          const hasRelativeDays = Number.isFinite(Number(phase["dayStart"])) && phase["dayStart"] !== undefined;
          const recommendedDuration = typeof phase["recommendedDuration"] === "string" ? phase["recommendedDuration"].trim() : "";
          const durationRationale = typeof phase["durationRationale"] === "string" ? phase["durationRationale"].trim() : "";
          return <article key={phaseId} className="border border-border/30 bg-background/35 p-3 sm:p-4">
            <div className="flex flex-wrap items-start gap-3">
              <span className={`border px-2 py-1 font-mono text-[9px] uppercase ${!phase["startDate"] && !hasRelativeDays && recommendedDuration ? "border-amber-300/25 text-amber-200" : "border-cyan-300/20 text-cyan-200/80"}`}>{phase["startDate"] ? `${formatScheduleDate(phase["startDate"])}${phase["endDate"] && phase["endDate"] !== phase["startDate"] ? ` – ${formatScheduleDate(phase["endDate"])}` : ""}` : hasRelativeDays ? `${t("Dias", "Days", "Días")} ${String(phase["dayStart"])}–${String(phase["dayEnd"] ?? phase["dayStart"])}` : recommendedDuration ? `${t("Sugestão do agente", "Agent suggestion", "Sugerencia del agente")}: ${recommendedDuration}` : t("Prazo não definido", "Timing not defined", "Plazo sin definir")}</span>
              <h3 className="min-w-0 flex-1 font-mono text-xs font-bold uppercase tracking-wide text-foreground">{phaseName}</h3>
              {alreadyGenerated && <span className="flex items-center gap-1 font-mono text-[9px] uppercase text-emerald-300"><CheckCircle2 className="h-3 w-3" />{t("Conteúdo salvo", "Content saved", "Contenido guardado")}</span>}
            </div>
            {typeof phase["summary"] === "string" && <p className="mt-3 font-mono text-[10px] leading-relaxed text-muted-foreground/75">{phase["summary"]}</p>}
            {recommendedDuration && (phase["startDate"] || hasRelativeDays) && <p className="mt-2 font-mono text-[10px] leading-relaxed text-amber-200/85">{t("Duração sugerida pelo agente", "Duration suggested by the agent", "Duración sugerida por el agente")}: {recommendedDuration}{durationRationale ? ` — ${durationRationale}` : ""}</p>}
            {!recommendedDuration && !phase["startDate"] && !hasRelativeDays && <p className="mt-2 font-mono text-[9px] leading-relaxed text-amber-100/60">{t("Este Master Plan não registrou uma sugestão de duração para esta etapa. Gere uma nova versão do plano para solicitar a recomendação.", "This Master Plan has no duration recommendation for this phase. Create a new plan version to request one.", "Este Plan Maestro no registró una duración sugerida para esta etapa. Genera una nueva versión para solicitarla.")}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" onClick={() => beginGeneration(phase)} disabled={alreadyGenerated || isGenerating || (!trialAccess && generateMutation.isPending)} className="h-8 gap-1.5 rounded-none font-mono text-[9px] uppercase tracking-wider">
                {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : trialAccess ? <Lock className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                {isGenerating ? t("Gerando etapa…", "Generating phase…", "Generando etapa…") : alreadyGenerated ? t("Conteúdo já gerado", "Content generated", "Contenido generado") : t("Gerar conteúdo desta etapa", "Generate this phase’s content", "Generar contenido de esta etapa")}
              </Button>
              {alreadyGenerated && <Button type="button" size="sm" variant="outline" onClick={() => window.location.assign(`/campaigns/${campaignId}/content`)} className="h-8 rounded-none font-mono text-[9px] uppercase tracking-wider">{t("Revisar conteúdo", "Review content", "Revisar contenido")}</Button>}
            </div>
          </article>;
        })}
      </div>}
    </section>

    <Dialog open={checkoutOpen} onOpenChange={(open) => { setCheckoutOpen(open); if (!open) { setPayment(null); setActivePhase(null); setCard(EMPTY_CARD); setCpfCnpj(""); } }}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto border-primary/30 bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono uppercase tracking-wider"><Lock className="h-4 w-4 text-primary" />{t("Geração disponível com licença", "Generation requires a license", "La generación requiere licencia")}</DialogTitle>
          <DialogDescription className="font-mono text-xs leading-relaxed">{t("A geração de conteúdo é exclusiva para clientes com licença NexOS. Escolha um plano e pague via PIX ou cartão para liberar esta etapa.", "Content generation is available to NexOS license holders. Choose a plan and pay by PIX or card to unlock this phase.", "La generación de contenido está disponible para titulares de licencia NexOS. Elige un plan y paga con PIX o tarjeta para habilitar esta etapa.")}{activePhase?.["name"] ? ` · ${String(activePhase["name"])}` : ""}</DialogDescription>
        </DialogHeader>
        {currentPayment ? currentPayment.status === "paid" ? <div className="space-y-3 border border-emerald-400/30 bg-emerald-400/[0.05] p-4 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-300" /><p className="font-mono text-xs uppercase text-emerald-200">{t("Pagamento confirmado. Feche e gere o conteúdo.", "Payment confirmed. Close this window and generate the content.", "Pago confirmado. Cierra esta ventana y genera el contenido.")}</p></div> : ["failed", "cancelled", "expired"].includes(currentPayment.status) ? <div className="space-y-3 border border-destructive/30 bg-destructive/[0.05] p-4 text-center"><p className="font-mono text-xs text-destructive">{t("O cartão não foi aprovado. Confira os dados ou tente PIX.", "The card was not approved. Check the details or try PIX.", "La tarjeta no fue aprobada. Revisa los datos o intenta con PIX.")}</p><Button type="button" variant="outline" onClick={() => { setPayment(null); setPaymentMethod("pix"); }}>{t("Tentar outro pagamento", "Try another payment method", "Probar otro método de pago")}</Button></div> : currentPayment.method === "pix" ? <div className="space-y-3 border border-primary/25 p-4">
          <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase"><QrCode className="h-4 w-4 text-primary" />PIX · R$ {(currentPayment.amountCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
          {currentPayment.pixData?.qrCode && <img className="mx-auto h-40 w-40 border-4 border-white bg-white p-1" src={`data:image/png;base64,${currentPayment.pixData.qrCode}`} alt="QR Code PIX" />}
          <p className="font-mono text-[10px] text-muted-foreground">{currentPayment.pixData?.instructions ?? t("Escaneie o QR Code ou copie o código PIX. A confirmação é automática.", "Scan the QR code or copy the PIX code. Payment confirmation is automatic.", "Escanea el código QR o copia el código PIX. La confirmación es automática.")}</p>
          {currentPayment.pixData?.copiaECola && <><div className="max-h-20 break-all border border-border/40 bg-muted/10 p-2 font-mono text-[10px]">{currentPayment.pixData.copiaECola}</div><Button type="button" variant="outline" size="sm" className="w-full gap-2 rounded-none font-mono text-[9px] uppercase" onClick={() => { void navigator.clipboard.writeText(currentPayment.pixData!.copiaECola!).then(() => { setCopied(true); toast.success(t("Código PIX copiado.", "PIX code copied.", "Código PIX copiado.")); }); }}><Copy className="h-3 w-3" />{copied ? t("Copiado", "Copied", "Copiado") : t("Copiar PIX", "Copy PIX", "Copiar PIX")}</Button></>}
          <p className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground/70"><Loader2 className="h-3 w-3 animate-spin" />{t("Aguardando confirmação do pagamento…", "Waiting for payment confirmation…", "Esperando confirmación del pago…")}</p>
        </div> : <div className="space-y-3 border border-primary/25 p-4 text-center"><CreditCard className="mx-auto h-7 w-7 text-primary" /><p className="font-mono text-xs uppercase">{t("Pagamento enviado ao cartão", "Card payment submitted", "Pago enviado a la tarjeta")}</p><p className="font-mono text-[10px] text-muted-foreground">{t("A confirmação está sendo consultada automaticamente.", "We are checking the payment status automatically.", "Estamos consultando el estado del pago automáticamente.")}</p><p className="flex items-center justify-center gap-2 font-mono text-[10px] text-muted-foreground/70"><Loader2 className="h-3 w-3 animate-spin" />{t("Aguardando confirmação…", "Waiting for confirmation…", "Esperando confirmación…")}</p></div> : <div className="space-y-4">
          {plansQuery.isLoading ? <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t("Carregando planos…", "Loading plans…", "Cargando planes…")}</div> : <div className="grid gap-2 sm:grid-cols-2">{(plansQuery.data ?? []).map((plan) => <button key={plan.id} type="button" onClick={() => setPlanId(plan.id)} className={`border p-3 text-left ${planId === plan.id ? "border-primary bg-primary/10" : "border-border/40 hover:border-primary/40"}`}><span className="block font-mono text-xs font-bold uppercase">{plan.name}</span><span className="mt-1 block font-mono text-sm text-primary">R$ {(plan.monthlyPriceBrl / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}<span className="text-[9px] text-muted-foreground"> / {t("mês", "month", "mes")}</span></span></button>)}</div>}
          <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("Forma de pagamento", "Payment method", "Método de pago")}>
            <button type="button" aria-pressed={paymentMethod === "pix"} onClick={() => setPaymentMethod("pix")} className={`flex items-center justify-center gap-2 border p-3 font-mono text-xs uppercase ${paymentMethod === "pix" ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground"}`}><QrCode className="h-4 w-4" />PIX</button>
            <button type="button" aria-pressed={paymentMethod === "credit_card"} onClick={() => setPaymentMethod("credit_card")} className={`flex items-center justify-center gap-2 border p-3 font-mono text-xs uppercase ${paymentMethod === "credit_card" ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground"}`}><CreditCard className="h-4 w-4" />{t("Cartão", "Card", "Tarjeta")}</button>
          </div>
          {paymentMethod === "pix" ? <label className="block space-y-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">CPF/CNPJ para o PIX<input value={cpfCnpj} onChange={(event) => setCpfCnpj(event.target.value)} inputMode="numeric" autoComplete="off" className="h-10 w-full border border-border/50 bg-background px-3 font-sans text-sm normal-case tracking-normal text-foreground outline-none focus:border-primary/50" placeholder="000.000.000-00" /></label> : <div className="space-y-3 border border-border/40 p-3">
            <p className="font-mono text-[10px] text-amber-200/80">{t("Pagamento único no cartão · acréscimo de 3,5%", "Single card payment · 3.5% fee", "Pago único con tarjeta · recargo de 3,5 %")}: R$ {((plansQuery.data?.find((plan) => plan.id === planId)?.monthlyPriceBrl ?? 0) * 1.035 / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            <label className="block space-y-1 font-mono text-[10px] uppercase text-muted-foreground">{t("Nome no cartão", "Name on card", "Nombre en la tarjeta")}<input autoComplete="cc-name" value={card.holderName} onChange={(event) => setCard({ ...card, holderName: event.target.value })} className="h-9 w-full border border-border/50 bg-background px-2 font-sans text-sm normal-case text-foreground" /></label>
            <label className="block space-y-1 font-mono text-[10px] uppercase text-muted-foreground">{t("Número do cartão", "Card number", "Número de tarjeta")}<input inputMode="numeric" autoComplete="cc-number" value={card.number} onChange={(event) => setCard({ ...card, number: event.target.value.replace(/\D/g, "").slice(0, 19) })} className="h-9 w-full border border-border/50 bg-background px-2 font-sans text-sm text-foreground" placeholder="0000 0000 0000 0000" /></label>
            <div className="grid grid-cols-3 gap-2"><label className="space-y-1 font-mono text-[10px] uppercase text-muted-foreground">{t("Mês", "Month", "Mes")}<input inputMode="numeric" autoComplete="cc-exp-month" value={card.expiryMonth} onChange={(event) => setCard({ ...card, expiryMonth: event.target.value.replace(/\D/g, "").slice(0, 2) })} className="h-9 w-full border border-border/50 bg-background px-2 font-sans text-sm text-foreground" placeholder="MM" /></label><label className="space-y-1 font-mono text-[10px] uppercase text-muted-foreground">{t("Ano", "Year", "Año")}<input inputMode="numeric" autoComplete="cc-exp-year" value={card.expiryYear} onChange={(event) => setCard({ ...card, expiryYear: event.target.value.replace(/\D/g, "").slice(0, 4) })} className="h-9 w-full border border-border/50 bg-background px-2 font-sans text-sm text-foreground" placeholder="AA ou AAAA" /></label><label className="space-y-1 font-mono text-[10px] uppercase text-muted-foreground">CVV<input inputMode="numeric" autoComplete="cc-csc" value={card.cvv} onChange={(event) => setCard({ ...card, cvv: event.target.value.replace(/\D/g, "").slice(0, 4) })} className="h-9 w-full border border-border/50 bg-background px-2 font-sans text-sm text-foreground" placeholder="123" /></label></div>
            <div className="grid gap-2 sm:grid-cols-2"><label className="space-y-1 font-mono text-[10px] uppercase text-muted-foreground">CPF/CNPJ<input value={card.cpfCnpj} onChange={(event) => setCard({ ...card, cpfCnpj: event.target.value })} className="h-9 w-full border border-border/50 bg-background px-2 font-sans text-sm text-foreground" /></label><label className="space-y-1 font-mono text-[10px] uppercase text-muted-foreground">{t("Telefone", "Phone", "Teléfono")}<input inputMode="tel" autoComplete="tel" value={card.phone} onChange={(event) => setCard({ ...card, phone: event.target.value.replace(/\D/g, "").slice(0, 13) })} className="h-9 w-full border border-border/50 bg-background px-2 font-sans text-sm text-foreground" /></label><label className="space-y-1 font-mono text-[10px] uppercase text-muted-foreground">CEP<input inputMode="numeric" autoComplete="postal-code" value={card.postalCode} onChange={(event) => setCard({ ...card, postalCode: event.target.value.replace(/\D/g, "").slice(0, 8) })} className="h-9 w-full border border-border/50 bg-background px-2 font-sans text-sm text-foreground" /></label><label className="space-y-1 font-mono text-[10px] uppercase text-muted-foreground">{t("Número do endereço", "Address number", "Número de dirección")}<input autoComplete="address-line2" value={card.addressNumber} onChange={(event) => setCard({ ...card, addressNumber: event.target.value })} className="h-9 w-full border border-border/50 bg-background px-2 font-sans text-sm text-foreground" /></label></div>
            <p className="font-mono text-[9px] text-muted-foreground">{t("Os dados do cartão são enviados para autorização e não são salvos pelo NexOS.", "Card details are submitted for authorization and are not stored by NexOS.", "Los datos de la tarjeta se envían para autorización y NexOS no los guarda.")}</p>
          </div>}
          <Button type="button" className="w-full gap-2 rounded-none font-mono text-[10px] font-bold uppercase tracking-wider" disabled={!planId || (paymentMethod === "pix" ? !/^(\d{11}|\d{14})$/.test(cpfCnpj.replace(/\D/g, "")) : !cardReady) || purchaseMutation.isPending} onClick={() => purchaseMutation.mutate()}>{purchaseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : paymentMethod === "pix" ? <QrCode className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}{paymentMethod === "pix" ? t("Continuar com PIX", "Continue with PIX", "Continuar con PIX") : t("Pagar com cartão", "Pay by card", "Pagar con tarjeta")}</Button>
          {plansQuery.data?.length === 0 && <p role="alert" className="font-mono text-[10px] text-destructive">{t("Não há planos disponíveis para checkout neste momento.", "No plans are available for checkout right now.", "No hay planes disponibles para checkout en este momento.")}</p>}
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}
