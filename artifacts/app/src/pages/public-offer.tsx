import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ApiError, customFetch } from "@workspace/api-client-react/custom-fetch";
import { Button } from "@/components/ui/button";
import { GuestLanguageSwitcher } from "@/components/guest-language-switcher";
import { intlLocale, useUiLocale, useUiText } from "@/lib/i18n";
import { CheckCircle2, Infinity, LoaderCircle, Rocket, ShieldCheck } from "lucide-react";

interface PublicOffer {
  id: string;
  key: string;
  name: string;
  description: string;
  priceCents: number;
  planSlug: "solo" | "agency";
  licensePlanName?: string;
  licenseMaxCampaigns?: number;
  licenseMaxWorkspaces?: number;
  licenseSocialNetworks?: string[];
  licenseWhiteLabel?: boolean;
  licenseFeatures?: string[];
  interval: "one_time" | "monthly" | "yearly";
  nexosAccessLifetime: boolean;
  campaignsIncluded: number;
  socialMediaDays: number;
  creditsIncluded: number;
}

interface PublicPlan {
  id: string;
  name: string;
  slug: "solo" | "agency";
  priceMonthly: number | string;
  creditsMonthly: number;
  maxCampaigns: number;
  maxWorkspaces: number;
  allowedSocialNetworks: string[];
  whiteLabel: boolean;
  features: string[];
}

const PLAN_FEATURE_TRANSLATIONS: Record<string, { en: string; es: string }> = {
  "Acesso vitalício à plataforma": { en: "Lifetime access to the platform", es: "Acceso de por vida a la plataforma" },
  "900 créditos incluídos (2 lançamentos completos)": { en: "900 credits included (2 complete launches)", es: "900 créditos incluidos (2 lanzamientos completos)" },
  "2.000 créditos incluídos (~4-5 lançamentos completos)": { en: "2,000 credits included (~4–5 complete launches)", es: "2.000 créditos incluidos (~4–5 lanzamientos completos)" },
  "2.000 créditos incluídos (~4–5 lançamentos completos)": { en: "2,000 credits included (~4–5 complete launches)", es: "2.000 créditos incluidos (~4–5 lanzamientos completos)" },
  "Até 3 campanhas simultâneas": { en: "Up to 3 concurrent campaigns", es: "Hasta 3 campañas simultáneas" },
  "Até 10 campanhas simultâneas": { en: "Up to 10 concurrent campaigns", es: "Hasta 10 campañas simultáneas" },
  "Track de 6 dígitos (R$100k–R$999k em 7 dias)": { en: "6-figure track (R$100k–R$999k in 7 days)", es: "Track de 6 cifras (R$100k–R$999k en 7 días)" },
  "Todos os tracks (6, 8 e 10 dígitos)": { en: "All tracks (6, 8, and 10 figures)", es: "Todos los tracks (6, 8 y 10 cifras)" },
  "1 domínio customizado": { en: "1 custom domain", es: "1 dominio personalizado" },
  "10 domínios customizados": { en: "10 custom domains", es: "10 dominios personalizados" },
  "Nurturing via WhatsApp OU Telegram": { en: "Nurturing via WhatsApp OR Telegram", es: "Nutrición por WhatsApp O Telegram" },
  "Nurturing via WhatsApp E Telegram (multicanal)": { en: "Nurturing via WhatsApp AND Telegram (multichannel)", es: "Nutrición por WhatsApp Y Telegram (multicanal)" },
  "16 agentes de IA especializados": { en: "16 specialized AI agents", es: "16 agentes de IA especializados" },
  "Sequência de lançamento PLF automatizada": { en: "Automated PLF launch sequence", es: "Secuencia de lanzamiento PLF automatizada" },
  "Landing page gerada por IA": { en: "AI-generated landing page", es: "Landing page generada por IA" },
  "Até 5 vídeos por campanha": { en: "Up to 5 videos per campaign", es: "Hasta 5 videos por campaña" },
  "Relatório semanal de performance": { en: "Weekly performance report", es: "Informe semanal de rendimiento" },
  "White-label 'Desenvolvido com NexOS'": { en: "White label: 'Powered by NexOS'", es: "Marca blanca: 'Desarrollado con NexOS'" },
  "Dashboard multi-cliente": { en: "Multi-client dashboard", es: "Panel para múltiples clientes" },
  "Todos os módulos de IA incluindo Creator Engine": { en: "All AI modules, including Creator Engine", es: "Todos los módulos de IA, incluido Creator Engine" },
  "Suporte prioritário": { en: "Priority support", es: "Soporte prioritario" },
};

function localizePlanFeature(feature: string, locale: string): string {
  const translation = PLAN_FEATURE_TRANSLATIONS[feature.trim()];
  if (!translation) return feature;
  if (locale === "es-LA") return translation.es;
  if (locale === "en-US" || locale === "en-AU") return translation.en;
  return feature;
}

export default function PublicOfferPage({ offerKey }: { offerKey?: string }) {
  const t = useUiText();
  const { locale } = useUiLocale();
  const [, setLocation] = useLocation();
  const offerQuery = useQuery({
    queryKey: ["/api/billing/public-offers", offerKey],
    queryFn: () => customFetch<{ offer: PublicOffer }>(`/api/billing/public-offers/${encodeURIComponent(offerKey!)}`),
    enabled: Boolean(offerKey),
    retry: false,
    staleTime: 60_000,
  });
  const offerErrorData = offerQuery.error instanceof ApiError ? offerQuery.error.data : null;
  const offerIsUnavailable = Boolean(
    offerErrorData && typeof offerErrorData === "object" &&
    ["OFFER_NOT_AVAILABLE", "NOT_FOUND"].includes(String((offerErrorData as { code?: unknown }).code)),
  );
  const plansQuery = useQuery({
    queryKey: ["/api/plans"],
    queryFn: () => customFetch<{ plans: PublicPlan[] }>("/api/plans"),
    staleTime: 60_000,
  });
  const offer = offerQuery.data?.offer;
  const offerRegisterPath = offerKey ? `/register?offer=${encodeURIComponent(offerKey)}` : "/register";
  const offerLoginPath = offerKey ? `/login?next=${encodeURIComponent(`/billing?offer=${offerKey}`)}` : "/login";
  const price = offer ? new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: "BRL" }).format(offer.priceCents / 100) : "";
  const interval = offer?.interval === "monthly" ? t("por mês, com renovação automática", "per month, auto-renewing", "al mes, con renovación automática")
    : offer?.interval === "yearly" ? t("por ano, com renovação automática", "per year, auto-renewing", "al año, con renovación automática")
      : t("pagamento único", "one-time payment", "pago único");
  const basePlans = (plansQuery.data?.plans ?? []).filter(plan => plan.slug === "solo" || plan.slug === "agency")
    .sort((a, b) => a.slug === "solo" ? -1 : b.slug === "solo" ? 1 : 0);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/"><span className="cursor-pointer font-mono text-xl font-black tracking-[0.25em] text-primary">NEXOS</span></Link>
        <GuestLanguageSwitcher />
      </header>

      <section className="mx-auto max-w-6xl space-y-10 px-5 pb-20 pt-10">
        <div className="grid items-center gap-8 border-b border-border/40 pb-9 lg:grid-cols-[1fr_0.8fr]">
          <div className="space-y-6">
          <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/5 px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-primary">
            <Rocket className="h-4 w-4" /> {t("Oferta oficial NexOS", "Official NexOS offer", "Oferta oficial NexOS")}
          </div>
          <div>
            <h1 className="max-w-2xl font-mono text-4xl font-black uppercase leading-tight tracking-tight md:text-6xl">{offer?.name ?? (offerKey ? t("Oferta selecionada", "Selected offer", "Oferta seleccionada") : t("Planos de licença NexOS", "NexOS license plans", "Planes de licencia NexOS"))}</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">{offer?.description || (offerKey
              ? t("Confira os detalhes e as condições desta oferta.", "Review the details and terms of this offer.", "Consulta los detalles y las condiciones de esta oferta.")
              : t("Escolha a licença Solo ou Agency e contrate o acesso vitalício diretamente pelo NexOS.", "Choose the Solo or Agency license and purchase lifetime access directly through NexOS.", "Elige la licencia Solo o Agency y contrata el acceso vitalicio directamente en NexOS."))}</p>
          </div>
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            <span>{t("A licença e os benefícios desta oferta são ativados após a confirmação do pagamento.", "The license and offer benefits activate after payment is confirmed.", "La licencia y los beneficios de esta oferta se activan tras confirmar el pago.")}</span>
          </div>
          </div>
          {!offer && !offerKey && <div className="border border-primary/20 bg-card/30 p-5 md:p-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-primary">{t("Escolha sua licença", "Choose your license", "Elige tu licencia")}</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("Compare os limites e recursos de cada plano. Você confirma os dados e o pagamento no próximo passo.", "Compare each plan's limits and features. You will confirm your details and payment in the next step.", "Compara los límites y funciones de cada plan. Confirmarás tus datos y el pago en el siguiente paso.")}</p>
            <div className="mt-5 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="border border-border/50 px-3 py-2">{t("Pagamento seguro", "Secure payment", "Pago seguro")}</span>
              <span className="border border-border/50 px-3 py-2">{t("Ativação após confirmação", "Activation after confirmation", "Activación tras la confirmación")}</span>
            </div>
          </div>}
        </div>

        <div className={offer || offerKey ? "mx-auto w-full max-w-3xl border border-primary/30 bg-card/50 p-6 shadow-[0_0_40px_hsl(var(--primary)/0.08)] md:p-8" : "border border-primary/20 bg-card/30 p-5 shadow-[0_0_40px_hsl(var(--primary)/0.05)] md:p-8"}>
          {offerQuery.isLoading ? <div className="flex min-h-64 items-center justify-center"><LoaderCircle className="h-7 w-7 animate-spin text-primary" /></div>
            : offer ? <>
              <div className="flex items-start justify-between gap-4">
                <div><div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{t("Licença", "License", "Licencia")}</div><div className="mt-1 font-mono text-xl font-bold uppercase">NexOS {offer.licensePlanName ?? offer.planSlug}</div></div>
                {offer.nexosAccessLifetime && <span className="flex items-center gap-1 border border-success/30 bg-success/5 px-2 py-1 font-mono text-[10px] uppercase text-success"><Infinity className="h-4 w-4" /> {t("Vitalício", "Lifetime", "Vitalicio")}</span>}
              </div>
              <div className="mt-6 border-y border-border/50 py-5">
                <div className="font-mono text-4xl font-black text-primary">{price}</div>
                <div className="mt-1 text-sm text-muted-foreground">{interval}</div>
              </div>
              <ul className="my-6 space-y-3 text-sm">
                {offer.campaignsIncluded > 0 && <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-success" />{offer.campaignsIncluded} {t("campanha(s) completa(s)", "full campaign(s)", "campaña(s) completa(s)")}</li>}
                {offer.socialMediaDays > 0 && <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-success" />{offer.socialMediaDays} {t("dias de Social Media", "Social Media days", "días de Social Media")}</li>}
                {offer.creditsIncluded > 0 && <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-success" />{offer.creditsIncluded.toLocaleString(intlLocale(locale))} {t("créditos incluídos", "credits included", "créditos incluidos")}</li>}
                {offer.licenseMaxCampaigns !== undefined && <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-success" />{t("Até", "Up to", "Hasta")} {offer.licenseMaxCampaigns} {t("campanhas simultâneas", "concurrent campaigns", "campañas simultáneas")}</li>}
                {offer.licenseMaxWorkspaces !== undefined && <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-success" />{offer.licenseMaxWorkspaces} {t("workspace(s)", "workspace(s)", "workspace(s)")}</li>}
                {offer.licenseWhiteLabel && <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-success" />{t("White-label", "White label", "Marca blanca")}</li>}
              </ul>
              {offer.licenseFeatures?.length ? <details className="mb-5 border-t border-border/40 pt-4 text-sm">
                <summary className="cursor-pointer font-mono text-xs uppercase tracking-wider text-muted-foreground">{t("Ver recursos da licença", "View license features", "Ver funciones de la licencia")}</summary>
                <ul className="mt-3 space-y-2 text-muted-foreground">{offer.licenseFeatures.map((feature, index) => <li key={`${index}-${feature}`} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{localizePlanFeature(feature, locale)}</li>)}</ul>
              </details> : null}
              <Button onClick={() => setLocation(offerRegisterPath)} className="h-12 w-full rounded-none font-mono font-bold uppercase tracking-widest">{t("Criar conta e contratar", "Create account and purchase", "Crear cuenta y contratar")} <Rocket className="ml-2 h-4 w-4" /></Button>
              <div className="mt-4 text-center text-sm text-muted-foreground">{t("Já tem uma conta?", "Already have an account?", "¿Ya tienes una cuenta?")} <Link href={offerLoginPath}><span className="cursor-pointer font-semibold text-primary underline underline-offset-4">{t("Entrar e continuar", "Sign in to continue", "Inicia sesión y continúa")}</span></Link></div>
              <p className="mt-5 text-center text-[11px] leading-relaxed text-muted-foreground">{t("Pagamento processado com segurança pelo Asaas. Os benefícios só são liberados após a confirmação.", "Payments are securely processed by Asaas. Benefits are released only after confirmation.", "Pago procesado de forma segura por Asaas. Los beneficios se liberan solo tras la confirmación.")}</p>
            </> : offerKey ? <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
              <div className="font-mono text-lg font-bold uppercase">{offerQuery.isError && !offerIsUnavailable
                ? t("Falha ao carregar a oferta", "Offer loading failed", "Error al cargar la oferta")
                : t("Oferta indisponível", "Offer unavailable", "Oferta no disponible")}</div>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                {offerQuery.isError && !offerIsUnavailable
                  ? t("A oferta pode estar ativa, mas o serviço não conseguiu consultá-la. Tente novamente ou atualize o serviço.", "The offer may be active, but the service could not retrieve it. Try again or update the service.", "La oferta puede estar activa, pero el servicio no pudo consultarla. Inténtalo de nuevo o actualiza el servicio.")
                  : t("Esta oferta não está ativa ou não foi encontrada.", "This offer is inactive or could not be found.", "Esta oferta está inactiva o no se encontró.")}
              </p>
              {offerQuery.isError && !offerIsUnavailable && <Button variant="outline" onClick={() => offerQuery.refetch()} disabled={offerQuery.isFetching} className="rounded-none font-mono uppercase tracking-wider">
                {offerQuery.isFetching ? t("Carregando...", "Loading...", "Cargando...") : t("Tentar novamente", "Try again", "Intentar de nuevo")}
              </Button>}
            </div> : <div className="space-y-5">
              {plansQuery.isLoading ? <div className="flex min-h-56 items-center justify-center"><LoaderCircle className="h-7 w-7 animate-spin text-primary" /></div>
                : plansQuery.isError || basePlans.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">{t("Não foi possível carregar os planos neste momento.", "Could not load plans right now.", "No se pudieron cargar los planes en este momento.")}</div>
                  : <div className="grid gap-5 md:grid-cols-2">{basePlans.map(plan => {
                    const priceCents = Math.round(Number(plan.priceMonthly) * 100);
                    const planPrice = new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: "BRL" }).format(priceCents / 100);
                    const registerPath = `/register?plan=${encodeURIComponent(plan.slug)}`;
                    const loginPath = `/login?next=${encodeURIComponent(`/billing?plan=${plan.slug}`)}`;
                    const isAgency = plan.slug === "agency";
                    return <article key={plan.id} className={`relative flex flex-col overflow-hidden border bg-background/50 p-6 md:p-7 ${isAgency ? "border-primary/50 shadow-[0_0_28px_hsl(var(--primary)/0.08)]" : "border-border/60"}`}>
                      {isAgency && <div className="absolute right-0 top-0 bg-primary px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-primary-foreground">{t("Mais recursos", "More capacity", "Más capacidad")}</div>}
                      <div className="font-mono text-[11px] uppercase tracking-widest text-primary">{t("Licença NexOS", "NexOS license", "Licencia NexOS")}</div>
                      <h2 className="mt-2 font-mono text-3xl font-black uppercase">{plan.name}</h2>
                      <div className="mt-5 font-mono text-4xl font-bold tracking-tight text-primary">{planPrice}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{t("pagamento único · acesso vitalício", "one-time payment · lifetime access", "pago único · acceso de por vida")}</div>
                      <div className="mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                        <div className="border border-border/40 bg-card/40 p-3"><span className="block text-xs text-muted-foreground">{t("Créditos", "Credits", "Créditos")}</span><strong className="mt-1 block font-mono text-lg">{plan.creditsMonthly.toLocaleString(intlLocale(locale))}</strong></div>
                        <div className="border border-border/40 bg-card/40 p-3"><span className="block text-xs text-muted-foreground">{t("Campanhas simultâneas", "Concurrent campaigns", "Campañas simultáneas")}</span><strong className="mt-1 block font-mono text-lg">{plan.maxCampaigns}</strong></div>
                        <div className="border border-border/40 bg-card/40 p-3"><span className="block text-xs text-muted-foreground">{t("Workspaces", "Workspaces", "Workspaces")}</span><strong className="mt-1 block font-mono text-lg">{plan.maxWorkspaces}</strong></div>
                        <div className="border border-border/40 bg-card/40 p-3"><span className="block text-xs text-muted-foreground">{t("Redes", "Networks", "Redes")}</span><strong className="mt-1 block font-mono text-lg">{plan.allowedSocialNetworks?.length ?? 0}</strong></div>
                      </div>
                      {plan.features?.length > 0 && <ul className="my-6 grid flex-1 gap-x-6 gap-y-3 text-sm text-muted-foreground sm:grid-cols-2">{plan.features.map(feature => <li key={feature} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /><span>{localizePlanFeature(feature, locale)}</span></li>)}</ul>}
                      {plan.whiteLabel && <div className="mb-4 text-sm font-medium text-success">{t("White-label incluído", "White label included", "Marca blanca incluida")}</div>}
                      <Button onClick={() => setLocation(registerPath)} className="min-h-12 h-auto w-full whitespace-normal rounded-none px-4 py-3 text-center font-mono text-sm font-bold uppercase leading-snug tracking-widest">{t("Criar conta e contratar", "Create account and purchase", "Crear cuenta y contratar")} <Rocket className="ml-2 h-4 w-4 shrink-0" /></Button>
                      <div className="mt-4 text-center text-sm text-muted-foreground">{t("Já tem conta?", "Already have an account?", "¿Ya tienes cuenta?")} <Link href={loginPath}><span className="cursor-pointer font-medium text-primary underline underline-offset-4">{t("Entrar e contratar", "Sign in to purchase", "Inicia sesión y contrata")}</span></Link></div>
                    </article>;
                  })}</div>}
              <p className="text-center text-[11px] text-muted-foreground">{t("Os benefícios e créditos são liberados após a confirmação do pagamento.", "Benefits and credits are released after payment is confirmed.", "Los beneficios y créditos se habilitan tras confirmar el pago.")}</p>
            </div>}
        </div>
      </section>
    </main>
  );
}
