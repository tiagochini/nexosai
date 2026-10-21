import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch, ApiError } from "@workspace/api-client-react/custom-fetch";
import { useAuth } from "@/lib/auth";
import { useUiText } from "@/lib/i18n";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, RefreshCw, Save, ShieldAlert } from "lucide-react";

const NETWORKS = ["instagram", "facebook", "tiktok", "linkedin", "youtube"] as const;
type Network = (typeof NETWORKS)[number];
type Plan = {
  id: string;
  slug: "solo" | "agency";
  name: string;
  priceMonthly: string;
  priceOnboarding: string;
  creditsMonthly: number;
  maxCampaigns: number;
  maxWorkspaces: number;
  allowedSocialNetworks: Network[];
  maxAccountsPerNetwork: Record<Network, number>;
  features: string[];
  active: boolean;
};

function toDraft(plan: Plan) {
  return { ...plan, priceMonthly: String(plan.priceMonthly), priceOnboarding: String(plan.priceOnboarding), featuresText: (plan.features ?? []).join("\n") };
}
type PlanDraft = ReturnType<typeof toDraft>;

function plansLoadFailure(error: unknown, t: ReturnType<typeof useUiText>) {
  if (!(error instanceof ApiError)) return t("Não foi possível conectar à API. Confira a conexão e tente novamente.", "Could not connect to the API. Check the connection and try again.", "No se pudo conectar con la API. Comprueba la conexión e inténtalo de nuevo.");
  if (error.status === 401 || error.status === 403) return t(`A API recusou o acesso administrativo (HTTP ${error.status}). Saia e entre novamente; se persistir, confira a permissão Platform Admin da conta.`, `The API denied admin access (HTTP ${error.status}). Sign out and back in; if it persists, check the account's Platform Admin permission.`, `La API rechazó el acceso de administrador (HTTP ${error.status}). Cierra e inicia sesión; si persiste, revisa el permiso Platform Admin de la cuenta.`);
  if (error.status === 404) return t("A API de produção não encontrou /api/admin/plans. Publique a versão atualizada do servidor.", "The production API did not find /api/admin/plans. Deploy the updated server version.", "La API de producción no encontró /api/admin/plans. Publica la versión actualizada del servidor.");
  return t(`A API falhou ao carregar os planos (HTTP ${error.status}). Verifique os logs do servidor.`, `The API failed to load plans (HTTP ${error.status}). Check the server logs.`, `La API falló al cargar los planes (HTTP ${error.status}). Revisa los registros del servidor.`);
}

function NumericField({ label, value, min = 0, step = 1, onChange }: { label: string; value: string | number; min?: number; step?: number; onChange: (value: string) => void }) {
  return <label className="block space-y-1.5"><span className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span><Input type="number" min={min} step={step} value={value} onChange={(event) => onChange(event.target.value)} className="rounded-none font-mono" /></label>;
}

export default function AdminPricingPage() {
  const { isAdmin } = useAuth();
  const t = useUiText();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, PlanDraft>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const plansQuery = useQuery({
    queryKey: ["/api/admin/plans"],
    enabled: isAdmin,
    queryFn: () => customFetch<{ plans: Plan[] }>("/api/admin/plans"),
  });

  useEffect(() => {
    if (plansQuery.data) setDrafts(Object.fromEntries(plansQuery.data.plans.map((plan) => [plan.slug, toDraft(plan)])));
  }, [plansQuery.data]);

  function update(slug: string, patch: Partial<PlanDraft>) {
    setDrafts((current) => ({ ...current, [slug]: { ...current[slug]!, ...patch } }));
  }

  async function save(slug: string) {
    const draft = drafts[slug];
    if (!draft || saving) return;
    const payload = {
      name: draft.name.trim(),
      priceMonthly: Number(draft.priceMonthly),
      priceOnboarding: Number(draft.priceOnboarding),
      creditsMonthly: Number(draft.creditsMonthly),
      maxCampaigns: Number(draft.maxCampaigns),
      maxWorkspaces: Number(draft.maxWorkspaces),
      allowedSocialNetworks: draft.allowedSocialNetworks,
      maxAccountsPerNetwork: draft.maxAccountsPerNetwork,
      features: draft.featuresText.split("\n").map((feature) => feature.trim()).filter(Boolean),
      active: draft.active,
    };
    if (!Number.isFinite(payload.priceMonthly) || !Number.isFinite(payload.priceOnboarding) || payload.creditsMonthly < 0 || payload.maxCampaigns < 1 || payload.maxWorkspaces < 1) {
      toast.error(t("Revise os preços e limites informados.", "Check the entered prices and limits.", "Revisa los precios y límites introducidos."));
      return;
    }
    setSaving(slug);
    try {
      const result = await customFetch<{ plan: Plan }>(`/api/admin/plans/${slug}`, { method: "PATCH", body: JSON.stringify(payload) });
      setDrafts((current) => ({ ...current, [slug]: toDraft(result.plan) }));
      await queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/plans/", slug] });
      toast.success(t(`Plano ${result.plan.name} atualizado.`, `Plan ${result.plan.name} updated.`, `Plan ${result.plan.name} actualizado.`));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t("Não foi possível salvar o plano.", "Could not save the plan.", "No se pudo guardar el plan."));
    } finally {
      setSaving(null);
    }
  }

  if (!isAdmin) return <div className="mx-auto max-w-3xl py-20 text-center space-y-3"><ShieldAlert className="mx-auto h-10 w-10 text-destructive" /><h1 className="font-mono uppercase">{t("Acesso restrito", "Restricted access", "Acceso restringido")}</h1><p className="text-sm text-muted-foreground">{t("Esta área é exclusiva para administradores da plataforma.", "This area is for platform administrators only.", "Esta área es exclusiva para administradores de la plataforma.")}</p><Button asChild variant="outline" className="rounded-none"><Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" />{t("Voltar ao backoffice", "Back to admin", "Volver al panel")}</Link></Button></div>;

  return <main className="mx-auto max-w-6xl space-y-6 pb-12">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-5">
      <div><Button asChild variant="ghost" size="sm" className="mb-2 rounded-none px-0"><Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" />{t("Voltar ao backoffice", "Back to admin", "Volver al panel")}</Link></Button><h1 className="font-mono text-2xl font-bold uppercase tracking-tight">{t("Preços e recursos dos planos", "Plan pricing and entitlements", "Precios y recursos de planes")}</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t("Altere o preço exibido no checkout, créditos e limites. As mudanças são salvas no banco e afetam novas compras; não alteram pagamentos já registrados.", "Edit checkout price, credits, and limits. Changes are saved to the database and affect new purchases; they do not change recorded payments.", "Edita el precio mostrado en el checkout, créditos y límites. Los cambios se guardan en la base de datos y afectan nuevas compras; no modifican pagos registrados.")}</p></div>
      <Badge variant="outline" className="rounded-none">{t("Somente administradores", "Administrators only", "Solo administradores")}</Badge>
    </header>

    <div className="border border-amber-400/30 bg-amber-400/5 p-4 text-sm text-amber-100/90">{t("Os planos Solo e Agency estão configurados atualmente como acesso único, embora a coluna histórica do banco se chame priceMonthly. Este painel altera preço, créditos, limite de campanhas/workspaces e redes liberadas, que são aplicados pelo checkout e pelas regras de acesso. A lista de recursos abaixo é texto exibido na oferta; não ativa módulos globais do app.", "Solo and Agency are currently configured as one-time access, although the legacy database column is named priceMonthly. This panel edits price, credits, campaign/workspace limits, and enabled networks enforced by checkout/access rules. The feature list below is offer copy; it does not toggle global app modules.", "Los planes Solo y Agency están configurados actualmente como acceso único, aunque la columna histórica se llama priceMonthly. Este panel edita precio, créditos, límites de campañas/espacios y redes habilitadas que aplican el checkout y las reglas de acceso. La lista de recursos es texto de la oferta; no activa módulos globales.")}</div>

    {plansQuery.isLoading ? <div className="py-12 text-center text-sm text-muted-foreground">{t("Carregando planos…", "Loading plans…", "Cargando planes…")}</div> : plansQuery.isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-4 border border-destructive/30 p-5 text-sm text-destructive"><span>{plansLoadFailure(plansQuery.error, t)}</span><Button type="button" variant="outline" size="sm" onClick={() => void plansQuery.refetch()} className="rounded-none gap-2"><RefreshCw className="h-3.5 w-3.5" />{t("Tentar novamente", "Retry", "Reintentar")}</Button></div> : (
      <div className="grid gap-5 lg:grid-cols-2">{plansQuery.data?.plans.map((plan) => {
        const draft = drafts[plan.slug];
        if (!draft) return null;
        return <section key={plan.slug} className="space-y-5 border border-border/60 bg-card/40 p-5">
          <div className="flex items-start justify-between gap-3"><div><div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">{plan.slug}</div><h2 className="text-xl font-bold">{draft.name}</h2></div><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={draft.active} onChange={(event) => update(plan.slug, { active: event.target.checked })} />{t("Disponível no checkout", "Available at checkout", "Disponible en checkout")}</label></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5 sm:col-span-2"><span className="text-[11px] uppercase tracking-widest text-muted-foreground">{t("Nome do plano", "Plan name", "Nombre del plan")}</span><Input value={draft.name} onChange={(event) => update(plan.slug, { name: event.target.value })} maxLength={80} className="rounded-none" /></label>
            <NumericField label={t("Preço de acesso (R$)", "Access price (BRL)", "Precio de acceso (BRL)")} value={draft.priceMonthly} step={0.01} onChange={(value) => update(plan.slug, { priceMonthly: value })} />
            <NumericField label={t("Onboarding (R$)", "Onboarding (BRL)", "Onboarding (BRL)")} value={draft.priceOnboarding} step={0.01} onChange={(value) => update(plan.slug, { priceOnboarding: value })} />
            <NumericField label={t("Créditos incluídos", "Included credits", "Créditos incluidos")} value={draft.creditsMonthly} onChange={(value) => update(plan.slug, { creditsMonthly: Number(value) })} />
            <NumericField label={t("Campanhas simultâneas", "Concurrent campaigns", "Campañas simultáneas")} value={draft.maxCampaigns} min={1} onChange={(value) => update(plan.slug, { maxCampaigns: Number(value) })} />
            <NumericField label={t("Workspaces", "Workspaces", "Espacios de trabajo")} value={draft.maxWorkspaces} min={1} onChange={(value) => update(plan.slug, { maxWorkspaces: Number(value) })} />
          </div>

          <div className="space-y-2"><h3 className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">{t("Canais sociais liberados", "Enabled social networks", "Redes sociales habilitadas")}</h3><div className="flex flex-wrap gap-x-4 gap-y-2">{NETWORKS.map((network) => <label key={network} className="flex items-center gap-2 text-xs capitalize"><input type="checkbox" checked={draft.allowedSocialNetworks.includes(network)} onChange={(event) => update(plan.slug, { allowedSocialNetworks: event.target.checked ? [...draft.allowedSocialNetworks, network] : draft.allowedSocialNetworks.filter((value) => value !== network) })} />{network}</label>)}</div></div>
          <label className="block space-y-1.5"><span className="text-[11px] uppercase tracking-widest text-muted-foreground">{t("Recursos descritos no plano (um por linha)", "Plan features (one per line)", "Recursos del plan (uno por línea)")}</span><textarea value={draft.featuresText} onChange={(event) => update(plan.slug, { featuresText: event.target.value })} rows={6} maxLength={4000} className="w-full resize-y border border-border/60 bg-background p-3 text-sm" /></label>
          <div className="flex justify-end"><Button onClick={() => void save(plan.slug)} disabled={saving !== null} className="rounded-none gap-2">{saving === plan.slug ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{t("Salvar plano", "Save plan", "Guardar plan")}</Button></div>
        </section>;
      })}</div>
    )}
  </main>;
}
