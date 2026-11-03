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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Copy, Loader2, Plus, Save, ShieldAlert } from "lucide-react";

type Interval = "one_time" | "monthly" | "yearly";
type PlanSlug = "solo" | "agency";
type Offer = {
  id: string; key: string; name: string; description: string; priceCents: number;
  planSlug: PlanSlug | null;
  interval: Interval; nexosAccessLifetime: boolean; campaignsIncluded: number;
  socialMediaDays: number; creditsIncluded: number; active: boolean;
};
type Draft = Omit<Offer, "id">;
const blank: Draft = { key: "", name: "", description: "", priceCents: 10000, planSlug: null, interval: "one_time", nexosAccessLifetime: false, campaignsIncluded: 0, socialMediaDays: 0, creditsIncluded: 0, active: true };

function offerKeyFromName(name: string, existingKeys: string[] = []): string {
  const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 54).replace(/-+$/g, "");
  const base = slug.length >= 3 ? slug : `oferta-${slug || "nova"}`;
  const keys = new Set(existingKeys);
  if (!keys.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base.slice(0, 59 - String(suffix).length)}-${suffix}`;
    if (!keys.has(candidate)) return candidate;
  }
}

function InputField({ label, value, onChange, type = "text", min, max, step }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; min?: number; max?: number; step?: number }) {
  return <label className="block space-y-1.5"><span className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span><Input type={type} value={value} min={min} max={max} step={step} onChange={(event) => onChange(event.target.value)} className="rounded-none" /></label>;
}

export default function AdminSalesOffersPage() {
  const { isAdmin } = useAuth(); const t = useUiText(); const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({}); const [creating, setCreating] = useState(false); const [busy, setBusy] = useState(false);
  const query = useQuery({ queryKey: ["/api/admin/sales-offers"], enabled: isAdmin, queryFn: () => customFetch<{ offers: Offer[] }>("/api/admin/sales-offers") });
  useEffect(() => { if (query.data) setDrafts(Object.fromEntries(query.data.offers.map(o => [o.id, { ...o }]))); }, [query.data]);
  async function save(id?: string) {
    const draft = id ? drafts[id] : drafts.new;
    if (!draft || busy) return;
    const name = draft.name.trim();
    const payload: Draft = {
      key: id ? draft.key.trim().toLowerCase().replace(/\s+/g, "-") : offerKeyFromName(name, query.data?.offers.map(offer => offer.key) ?? []),
      name,
      description: draft.description.trim(),
      priceCents: Number(draft.priceCents),
      planSlug: draft.planSlug,
      interval: draft.interval,
      nexosAccessLifetime: draft.nexosAccessLifetime,
      campaignsIncluded: Number(draft.campaignsIncluded),
      socialMediaDays: Number(draft.socialMediaDays),
      creditsIncluded: Number(draft.creditsIncluded),
      active: draft.active,
    };
    if (!payload.key || !payload.name || !payload.planSlug || !Number.isInteger(payload.priceCents) || payload.priceCents < 100) { toast.error(t("Informe nome, licença (Solo ou Agency) e preço válido (mínimo R$ 1,00).", "Enter a name, license (Solo or Agency), and valid price (minimum BRL 1.00).", "Introduce nombre, licencia (Solo o Agency) y precio válido (mínimo BRL 1,00).")); return; }
    setBusy(true);
    try {
      const result = await customFetch<{ offer: Offer }>(id ? `/api/admin/sales-offers/${id}` : "/api/admin/sales-offers", { method: id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      await qc.invalidateQueries({ queryKey: ["/api/admin/sales-offers"] });
      if (!id) { setCreating(false); setDrafts(current => { const next = { ...current }; delete next.new; return next; }); }
      toast.success(t(`Oferta “${result.offer.name}” salva.`, `Offer “${result.offer.name}” saved.`, `Oferta “${result.offer.name}” guardada.`));
    } catch (error) { toast.error(error instanceof ApiError ? error.message : t("Não foi possível salvar a oferta.", "Could not save the offer.", "No se pudo guardar la oferta.")); }
    finally { setBusy(false); }
  }
  function setDraft(key: string, patch: Partial<Draft>) { setDrafts(current => ({ ...current, [key]: { ...(current[key] ?? blank), ...patch } })); }
  async function copySalesLink(key: string) {
    const url = `${window.location.origin}/oferta/${encodeURIComponent(key)}`;
    try { await navigator.clipboard.writeText(url); toast.success(t("Link público copiado.", "Public link copied.", "Enlace público copiado.")); }
    catch { toast.error(t("Não foi possível copiar o link neste navegador.", "Could not copy the link in this browser.", "No se pudo copiar el enlace en este navegador.")); }
  }
  if (!isAdmin) return <div className="mx-auto max-w-3xl py-20 text-center space-y-3"><ShieldAlert className="mx-auto h-10 w-10 text-destructive" /><h1 className="font-mono uppercase">{t("Acesso restrito", "Restricted access", "Acceso restringido")}</h1><Button asChild variant="outline" className="rounded-none"><Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" />{t("Voltar ao backoffice", "Back to admin", "Volver al panel")}</Link></Button></div>;
  const card = (offer: Offer | undefined, id: string) => {
    const d = drafts[id] ?? (offer ? { ...offer } : blank);
    const isNew = id === "new";
    return <section key={id} className={`space-y-4 ${isNew ? "border-0 bg-transparent p-6" : "border border-border/60 bg-card/40 p-5"}`}>
      <div className="flex items-center justify-between gap-3">{!isNew && <div><div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{d.key}</div><h2 className="text-xl font-bold">{d.name || t("Oferta sem nome", "Untitled offer", "Oferta sin nombre")}</h2>{offer?.active && <Button type="button" variant="link" size="sm" onClick={() => void copySalesLink(offer.key)} className="mt-1 h-auto px-0 font-mono text-xs"><Copy className="mr-1.5 h-3.5 w-3.5" />{t("Copiar link de venda", "Copy sales link", "Copiar enlace de venta")}</Button>}</div>}<label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={d.active} onChange={e => setDraft(id, { active: e.target.checked })} />{t("Disponível", "Available", "Disponible")}</label></div>
      <div className="grid gap-3 sm:grid-cols-2">
        {isNew ? <div className="block space-y-1.5"><span className="text-[11px] uppercase tracking-widest text-muted-foreground">{t("Chave gerada automaticamente", "Automatically generated key", "Clave generada automáticamente")}</span><div className="flex h-10 items-center border border-border/60 bg-background/60 px-3 font-mono text-sm text-muted-foreground" aria-live="polite">{offerKeyFromName(d.name, query.data?.offers.map(existing => existing.key) ?? [])}</div><p className="text-xs text-muted-foreground">{t("Gerada a partir do nome da oferta; será ajustada se já existir outra igual.", "Generated from the offer name; adjusted automatically if a duplicate exists.", "Se genera a partir del nombre y se ajusta si ya existe otra igual.")}</p></div> : <InputField label={t("Identificador", "Offer key", "Clave")} value={d.key} onChange={v => setDraft(id, { key: v })} />}
        <InputField label={t("Nome comercial", "Offer name", "Nombre comercial")} value={d.name} onChange={v => setDraft(id, { name: v, ...(isNew ? { key: offerKeyFromName(v, query.data?.offers.map(existing => existing.key) ?? []) } : {}) })} />
        <InputField label={t("Preço (R$)", "Price (BRL)", "Precio (BRL)")} type="number" min={1} step={0.01} value={(d.priceCents / 100).toFixed(2)} onChange={v => setDraft(id, { priceCents: Math.round(Number(v) * 100) })} />
        <label className="block space-y-1.5"><span className="text-[11px] uppercase tracking-widest text-muted-foreground">{t("Licença NexOS", "NexOS license", "Licencia NexOS")}</span><select value={d.planSlug ?? ""} onChange={e => setDraft(id, { planSlug: (e.target.value || null) as PlanSlug | null })} className="h-10 w-full border border-border/60 bg-background px-3 text-sm"><option value="">{t("Selecione Solo ou Agency", "Choose Solo or Agency", "Selecciona Solo o Agency")}</option><option value="solo">Solo</option><option value="agency">Agency</option></select><p className="text-xs text-muted-foreground">{t("A licença define as ferramentas, redes e limites disponíveis após a confirmação do pagamento.", "The license determines the tools, networks, and limits available after payment confirmation.", "La licencia determina las herramientas, redes y límites disponibles después de confirmar el pago.")}</p></label>
        <label className="block space-y-1.5"><span className="text-[11px] uppercase tracking-widest text-muted-foreground">{t("Cobrança", "Billing", "Cobro")}</span><select value={d.interval} onChange={e => setDraft(id, { interval: e.target.value as Interval, ...(e.target.value === "monthly" ? { socialMediaDays: 30 } : e.target.value === "yearly" ? { socialMediaDays: 365 } : {}) })} className="h-10 w-full border border-border/60 bg-background px-3 text-sm"><option value="one_time">{t("Pagamento único", "One-time payment", "Pago único")}</option><option value="monthly">{t("Mensal — renovação automática", "Monthly — automatic renewal", "Mensual — renovación automática")}</option><option value="yearly">{t("Anual — renovação automática", "Yearly — automatic renewal", "Anual — renovación automática")}</option></select></label>
        <label className="block space-y-1.5 sm:col-span-2"><span className="text-[11px] uppercase tracking-widest text-muted-foreground">{t("Descrição", "Description", "Descripción")}</span><textarea value={d.description} onChange={e => setDraft(id, { description: e.target.value })} rows={2} maxLength={500} className="w-full border border-border/60 bg-background p-3 text-sm" /></label>
      </div>
      <div className="border-t border-border/50 pt-4"><h3 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{t("Benefícios incluídos — combine para criar combos", "Included benefits — combine them into bundles", "Beneficios incluidos — combínalos para crear paquetes")}</h3><div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 border border-border/50 p-3 text-sm"><input type="checkbox" checked={d.nexosAccessLifetime} onChange={e => setDraft(id, { nexosAccessLifetime: e.target.checked })} />{t("Acesso vitalício ao NexOS", "Lifetime NexOS access", "Acceso vitalicio a NexOS")}</label>
        <InputField label={t("Campanhas completas incluídas", "Full campaigns included", "Campañas completas incluidas")} type="number" min={0} max={100} value={d.campaignsIncluded} onChange={v => setDraft(id, { campaignsIncluded: Number(v) })} />
        <InputField label={t("Dias de Social Media", "Social Media days", "Días de Social Media")} type="number" min={0} max={3650} value={d.socialMediaDays} onChange={v => setDraft(id, { socialMediaDays: Number(v) })} />
        <InputField label={t("Créditos incluídos", "Credits included", "Créditos incluidos")} type="number" min={0} max={10000000} value={d.creditsIncluded} onChange={v => setDraft(id, { creditsIncluded: Number(v) })} />
      </div><p className="mt-3 text-xs text-muted-foreground">{d.interval === "monthly" ? t("A vigência de Social Media por ciclo mensal é 30 dias.", "Social Media entitlement renews for 30 days each monthly cycle.", "Social Media se renueva por 30 días en cada ciclo mensual.") : d.interval === "yearly" ? t("A vigência de Social Media por ciclo anual é 365 dias.", "Social Media entitlement renews for 365 days each yearly cycle.", "Social Media se renueva por 365 días en cada ciclo anual.") : t("Em oferta única, configure 30, 60, 90 dias ou outro prazo contratado.", "For one-time offers, set 30, 60, 90 days, or another contracted term.", "En ofertas únicas, configura 30, 60, 90 días u otro plazo contratado.")}</p></div>
      <div className="flex justify-end gap-2">{isNew && <Button variant="outline" onClick={() => { setCreating(false); setDrafts(current => { const next = { ...current }; delete next.new; return next; }); }} disabled={busy} className="rounded-none">{t("Cancelar", "Cancel", "Cancelar")}</Button>}<Button onClick={() => void save(isNew ? undefined : id)} disabled={busy} className="rounded-none gap-2">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{t(isNew ? "Criar oferta" : "Salvar alterações", isNew ? "Create offer" : "Save changes", isNew ? "Create offer" : "Guardar cambios")}</Button></div>
    </section>;
  };
  return <main className="mx-auto max-w-6xl space-y-6 pb-12">
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border/50 pb-5"><div><Button asChild variant="ghost" size="sm" className="mb-2 rounded-none px-0"><Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" />{t("Voltar ao backoffice", "Back to admin", "Volver al panel")}</Link></Button><h1 className="font-mono text-2xl font-bold uppercase tracking-tight">{t("Catálogo de ofertas", "Sales offers catalog", "Catálogo de ofertas")}</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t("Monte produtos individuais ou combos e defina preço, duração e benefícios vendidos.", "Create individual products or bundles and define their price, term, and benefits.", "Crea productos individuales o paquetes y define precio, duración y beneficios.")}</p></div><Badge variant="outline" className="rounded-none">{t("Somente administradores", "Administrators only", "Solo administradores")}</Badge></header>
    <div className="border border-amber-400/30 bg-amber-400/5 p-4 text-sm text-amber-100/90">{t("Os preços e benefícios novos valem para as próximas compras. Contratos já iniciados preservam os termos da compra original; alterações de preço não modificam automaticamente assinaturas existentes no Asaas.", "New prices and benefits apply to future purchases. Existing contracts keep the original purchase terms; price edits do not automatically change existing Asaas subscriptions.", "Los nuevos precios y beneficios aplican a futuras compras. Los contratos existentes conservan los términos originales; cambiar el precio no modifica automáticamente las suscripciones activas de Asaas.")}</div>
    <div className="flex justify-end"><Button onClick={() => { setDraft("new", blank); setCreating(true); }} disabled={creating} className="rounded-none gap-2"><Plus className="h-4 w-4" />{t("Criar oferta", "Create offer", "Crear oferta")}</Button></div>
    <Dialog open={creating} onOpenChange={open => { if (!busy) setCreating(open); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-none border-border bg-background p-0">
        <DialogHeader className="sticky top-0 z-10 border-b border-border/60 bg-background px-6 py-5 pr-12 text-left">
          <DialogTitle className="font-mono uppercase tracking-wide">{t("Nova oferta de venda", "Create sales offer", "Nueva oferta de venta")}</DialogTitle>
          <DialogDescription>{t("Configure o produto, a cobrança e os benefícios incluídos.", "Configure the product, billing, and included benefits.", "Configura el producto, el cobro y los beneficios incluidos.")}</DialogDescription>
        </DialogHeader>
        {card(undefined, "new")}
      </DialogContent>
    </Dialog>
    {query.isLoading ? <div className="py-12 text-center text-sm text-muted-foreground">{t("Carregando ofertas…", "Loading offers…", "Cargando ofertas…")}</div> : query.isError ? <div role="alert" className="border border-destructive/30 p-5 text-sm text-destructive">{query.error instanceof ApiError ? query.error.message : t("Não foi possível carregar as ofertas.", "Could not load offers.", "No se pudieron cargar las ofertas.")}</div> : query.data?.offers.length ? <div className="grid gap-5 lg:grid-cols-2">{query.data.offers.map(o => card(o, o.id))}</div> : !creating ? <div className="border border-border/60 p-8 text-center text-sm text-muted-foreground">{t("Ainda não há ofertas. Crie o primeiro plano ou combo acima.", "No offers yet. Create the first plan or bundle above.", "Aún no hay ofertas. Crea el primer plan o paquete arriba.")}</div> : null}
  </main>;
}
