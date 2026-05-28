import { useState, useEffect, useCallback } from "react";
import { CURRICULUM } from "@/data/curriculum";

// ── Brand Config ─────────────────────────────────────────────────────────────
export interface BrandConfig {
  academyName: string;
  ownerName: string;
  ownerEmail: string;
  logoLetter: string;
  tagline: string;
  heroTitle: string;
  heroHighlight: string;
  heroDescription: string;
  primaryColor: string;
}

const BRAND_KEY = "nexos-academy-brand";

export const DEFAULT_BRAND: BrandConfig = {
  academyName: "NexOS Academy",
  ownerName: "",
  ownerEmail: "",
  logoLetter: "N",
  tagline: "Formação completa em lançamentos digitais",
  heroTitle: "Crie, Lance e Venda",
  heroHighlight: "Produtos Digitais",
  heroDescription: "Formação completa em lançamentos: estratégia, tráfego pago e orgânico, copywriting, automações, criação de produto e como transformar sua audiência em clientes.",
  primaryColor: "#7c3aed",
};

export function loadBrand(): BrandConfig {
  try {
    const raw = localStorage.getItem(BRAND_KEY);
    if (!raw) return DEFAULT_BRAND;
    return { ...DEFAULT_BRAND, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_BRAND;
  }
}

function saveBrand(b: BrandConfig) {
  localStorage.setItem(BRAND_KEY, JSON.stringify(b));
  window.dispatchEvent(new Event("brand-updated"));
}

interface FunnelStep {
  step: number;
  subject: string;
  dayOffset: number;
  sent: number;
  failed: number;
  scheduled: number;
  skipped: number;
}

interface FunnelStats {
  totalEnrolled: number;
  totalConverted: number;
  totalUnsubscribed: number;
  byStep: FunnelStep[];
}

const OWNER_PIN = "nexos2025";
const OWNER_KEY = "nexos-owner-mode";
const OWNER_SECRET = "nexos2025";

// sessionStorage: expires when browser tab/window is closed — PIN required every session
export function isOwnerMode(): boolean {
  try {
    return sessionStorage.getItem(OWNER_KEY) === "true";
  } catch {
    return false;
  }
}

function setOwnerMode(val: boolean) {
  try {
    if (val) sessionStorage.setItem(OWNER_KEY, "true");
    else sessionStorage.removeItem(OWNER_KEY);
  } catch {}
}

interface OwnerProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
  onOwnerChange: (isOwner: boolean) => void;
  isOwner: boolean;
}

interface Lead {
  id: string;
  email: string;
  name: string | null;
  source: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  ipAddress: string | null;
  funnelStep: number;
  funnelEnrolledAt: string | null;
  convertedAt: string | null;
  unsubscribedAt: string | null;
  crmStatus: string;
  crmNotes: string | null;
  crmLastActionAt: string | null;
  createdAt: string;
}

interface FunnelEmail {
  id: string;
  step: number;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
  errorMessage: string | null;
}

interface LeadDetail {
  lead: Lead;
  funnelEmails: FunnelEmail[];
  purchases: { id: string; productId: string; status: string; confirmedAt: string | null }[];
}

interface Purchase {
  id: string;
  accessToken: string;
  customerEmail: string;
  customerName: string;
  productId: string;
  status: string;
  amountCents: number;
  createdAt: string;
  confirmedAt: string | null;
}

type Tab = "leads" | "compras" | "funil" | "curso" | "acesso" | "marca" | "codigos";

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtBrl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    confirmed: { label: "Confirmado", cls: "bg-green-500/15 text-green-400 border-green-500/30" },
    pending: { label: "Pendente", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
    cancelled: { label: "Cancelado", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
    refunded: { label: "Estornado", cls: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  };
  const s = map[status] ?? { label: status, cls: "bg-[hsl(220_20%_12%)] text-[hsl(220_10%_55%)] border-[hsl(220_20%_18%)]" };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${s.cls}`}>
      {s.label}
    </span>
  );
}

export default function Owner({ onNavigate, onOwnerChange, isOwner }: OwnerProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [showPin, setShowPin] = useState(false);

  const [tab, setTab] = useState<Tab>("leads");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchasesTotal, setPurchasesTotal] = useState(0);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [funnelStats, setFunnelStats] = useState<FunnelStats | null>(null);
  const [funnelLoading, setFunnelLoading] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmMsg, setConfirmMsg] = useState<Record<string, string>>({});
  const [confirmedModal, setConfirmedModal] = useState<Purchase | null>(null);
  const [brand, setBrand] = useState<BrandConfig>(() => loadBrand());
  const [brandSaved, setBrandSaved] = useState(false);

  // Gift codes state
  interface GiftCode { id: string; accessToken: string; customerEmail: string; customerName: string; productId: string; amountCents: number; confirmedAt: string | null; }
  const [giftCodes, setGiftCodes] = useState<GiftCode[]>([]);
  const [giftLoading, setGiftLoading] = useState(false);
  const [giftGenerating, setGiftGenerating] = useState(false);
  const [giftCopied, setGiftCopied] = useState<string | null>(null);

  // CRM state
  const [leadSearch, setLeadSearch] = useState("");
  const [crmFilter, setCrmFilter] = useState<string>("todos");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadDetail, setLeadDetail] = useState<LeadDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const allChapters = CURRICULUM.flatMap(m => m.chapters);
  const allLessons = allChapters.flatMap(c => c.lessons);
  const totalModules = CURRICULUM.length;
  const totalChapters = allChapters.length;
  const totalLessons = allLessons.length;
  const totalDuration = allChapters.reduce((sum, ch) => {
    const match = ch.duration?.match(/(\d+)h\s*(\d+)?/);
    if (!match) return sum;
    return sum + parseInt(match[1]) * 60 + (match[2] ? parseInt(match[2]) : 0);
  }, 0);
  const totalHours = Math.floor(totalDuration / 60);
  const totalMinutes = totalDuration % 60;

  const moduleStats = CURRICULUM.map(mod => {
    const lessons = mod.chapters.flatMap(c => c.lessons);
    return {
      id: mod.id,
      number: mod.number,
      title: mod.title,
      chapters: mod.chapters.length,
      lessons: lessons.length,
      badge: mod.badge,
    };
  });

  const fetchLeads = useCallback(async () => {
    setLeadsLoading(true);
    try {
      const r = await fetch(`/api/academy/leads?secret=${OWNER_SECRET}&limit=200`);
      const j = await r.json();
      setLeads(j.leads ?? []);
      setLeadsTotal(j.total ?? 0);
    } catch {
      // ignore
    } finally {
      setLeadsLoading(false);
    }
  }, []);

  const fetchPurchases = useCallback(async () => {
    setPurchasesLoading(true);
    try {
      const r = await fetch(`/api/academy/purchases?secret=${OWNER_SECRET}&limit=200`);
      const j = await r.json();
      setPurchases(j.purchases ?? []);
      setPurchasesTotal(j.total ?? 0);
    } catch {
      // ignore
    } finally {
      setPurchasesLoading(false);
    }
  }, []);

  const fetchFunnelStats = useCallback(async () => {
    setFunnelLoading(true);
    try {
      const r = await fetch(`/api/academy/funnel/stats?secret=${OWNER_SECRET}`);
      const j = await r.json();
      setFunnelStats(j);
    } catch {
      // ignore
    } finally {
      setFunnelLoading(false);
    }
  }, []);

  const fetchGiftCodes = useCallback(async () => {
    setGiftLoading(true);
    try {
      const r = await fetch(`/api/academy/purchases?secret=${OWNER_SECRET}&limit=500`);
      const j = await r.json();
      const all: GiftCode[] = j.purchases ?? [];
      setGiftCodes(all.filter((p: GiftCode) => p.amountCents === 0 || p.customerEmail === "brinde@agencianexos.vip" || (j.purchases as GiftCode[]).filter((x: GiftCode) => x.accessToken === p.accessToken && x.amountCents === 0).length > 0));
    } catch {
      // ignore
    } finally {
      setGiftLoading(false);
    }
  }, []);

  const generateMoreGiftCodes = async (count: number) => {
    setGiftGenerating(true);
    try {
      const r = await fetch("/api/academy/admin/gift-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": OWNER_SECRET },
        body: JSON.stringify({ count, productId: "complete-bundle" }),
      });
      if (!r.ok) throw new Error("Erro ao gerar");
      await fetchGiftCodes();
    } catch {
      // ignore
    } finally {
      setGiftGenerating(false);
    }
  };

  const copyCode = async (code: string) => {
    try { await navigator.clipboard.writeText(code); } catch { /* ignore */ }
    setGiftCopied(code);
    setTimeout(() => setGiftCopied(null), 2000);
  };

  // ── CRM functions ──────────────────────────────────────────────────────────
  const openLead = useCallback(async (lead: Lead) => {
    setSelectedLead(lead);
    setNotesValue(lead.crmNotes ?? "");
    setEditingNotes(false);
    setActionMsg(null);
    setLeadDetail(null);
    setLoadingDetail(true);
    try {
      const r = await fetch(`/api/academy/leads/${lead.id}?secret=${OWNER_SECRET}`);
      const j = await r.json();
      setLeadDetail(j);
    } catch { /* ignore */ }
    finally { setLoadingDetail(false); }
  }, []);

  const closeLead = () => { setSelectedLead(null); setLeadDetail(null); setActionMsg(null); };

  const updateStatus = async (leadId: string, status: string) => {
    setSavingStatus(true);
    try {
      const r = await fetch(`/api/academy/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-secret": OWNER_SECRET },
        body: JSON.stringify({ crmStatus: status }),
      });
      const j = await r.json();
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, crmStatus: status } : l));
      if (selectedLead?.id === leadId) { setSelectedLead(j.lead); }
      setActionMsg("✓ Status atualizado");
    } catch { setActionMsg("Erro ao atualizar status"); }
    finally { setSavingStatus(false); setTimeout(() => setActionMsg(null), 2500); }
  };

  const saveNotes = async (leadId: string) => {
    setSavingStatus(true);
    try {
      await fetch(`/api/academy/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-secret": OWNER_SECRET },
        body: JSON.stringify({ crmNotes: notesValue }),
      });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, crmNotes: notesValue } : l));
      if (selectedLead) setSelectedLead({ ...selectedLead, crmNotes: notesValue });
      setEditingNotes(false);
      setActionMsg("✓ Nota salva");
    } catch { setActionMsg("Erro ao salvar nota"); }
    finally { setSavingStatus(false); setTimeout(() => setActionMsg(null), 2500); }
  };

  const enrollLead = async (leadId: string) => {
    setSavingStatus(true);
    try {
      await fetch(`/api/academy/leads/${leadId}/enroll`, {
        method: "POST", headers: { "x-admin-secret": OWNER_SECRET },
      });
      await openLead(selectedLead!);
      setActionMsg("✓ Lead inscrito no funil");
    } catch { setActionMsg("Erro ao inscrever no funil"); }
    finally { setSavingStatus(false); setTimeout(() => setActionMsg(null), 3000); }
  };

  const convertLead = async (leadId: string) => {
    setSavingStatus(true);
    try {
      await fetch(`/api/academy/leads/${leadId}/convert`, {
        method: "POST", headers: { "x-admin-secret": OWNER_SECRET },
      });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, crmStatus: "convertido", convertedAt: new Date().toISOString() } : l));
      if (selectedLead) setSelectedLead({ ...selectedLead, crmStatus: "convertido", convertedAt: new Date().toISOString() });
      setActionMsg("✓ Lead marcado como convertido");
    } catch { setActionMsg("Erro ao converter lead"); }
    finally { setSavingStatus(false); setTimeout(() => setActionMsg(null), 3000); }
  };

  const copyCrmEmail = async (email: string) => {
    try { await navigator.clipboard.writeText(email); setActionMsg("✓ E-mail copiado"); }
    catch { setActionMsg("Erro ao copiar"); }
    setTimeout(() => setActionMsg(null), 2000);
  };

  useEffect(() => {
    if (!isOwner) return;
    if (tab === "leads") fetchLeads();
    if (tab === "compras") fetchPurchases();
    if (tab === "funil") fetchFunnelStats();
    if (tab === "codigos") fetchGiftCodes();
  }, [isOwner, tab, fetchLeads, fetchPurchases, fetchFunnelStats, fetchGiftCodes]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (pin === OWNER_PIN) {
      setOwnerMode(true);
      onOwnerChange(true);
      setError("");
    } else {
      setError("PIN incorreto.");
      setPin("");
    }
  }

  function handleLogout() {
    if (confirm("Sair do modo dono?")) {
      setOwnerMode(false);
      onOwnerChange(false);
      onNavigate("home");
    }
  }

  async function confirmPurchase(purchase: Purchase) {
    setConfirmingId(purchase.id);
    try {
      const r = await fetch(`/api/academy/admin/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": OWNER_SECRET },
        body: JSON.stringify({ purchaseId: purchase.id }),
      });
      const j = await r.json() as { ok?: boolean; error?: string };
      if (j.ok) {
        navigator.clipboard.writeText(purchase.accessToken).catch(() => undefined);
        await fetchPurchases();
        setConfirmedModal(purchase);
      } else {
        setConfirmMsg(prev => ({ ...prev, [purchase.id]: `Erro: ${j.error}` }));
        setTimeout(() => setConfirmMsg(prev => { const n = { ...prev }; delete n[purchase.id]; return n; }), 4000);
      }
    } catch {
      setConfirmMsg(prev => ({ ...prev, [purchase.id]: "Erro de rede" }));
      setTimeout(() => setConfirmMsg(prev => { const n = { ...prev }; delete n[purchase.id]; return n; }), 4000);
    } finally {
      setConfirmingId(null);
    }
  }

  function copyToken(token: string) {
    navigator.clipboard.writeText(token).then(() => {
      setCopyMsg("Token copiado!");
      setTimeout(() => setCopyMsg(""), 2000);
    });
  }

  function copyEmails() {
    const text = leads.map(l => l.email).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopyMsg("Copiado!");
      setTimeout(() => setCopyMsg(""), 2000);
    });
  }

  function exportLeadsCsv() {
    const header = "email,nome,fonte,utm_source,utm_medium,utm_campaign,data\n";
    const rows = leads
      .map(l =>
        [
          l.email,
          l.name ?? "",
          l.source,
          l.utmSource ?? "",
          l.utmMedium ?? "",
          l.utmCampaign ?? "",
          new Date(l.createdAt).toISOString(),
        ]
          .map(v => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `academy-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!isOwner) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-extrabold text-white mx-auto mb-4"
              style={{ background: "var(--gradient-primary)" }}
            >
              N
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Área do Dono</h1>
            <p className="text-sm text-[hsl(220_10%_50%)]">Acesso restrito — insira o PIN de administrador</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <input
                type={showPin ? "text" : "password"}
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="PIN de acesso"
                className="w-full px-4 py-3 rounded-xl bg-[hsl(220_20%_8%)] border border-[hsl(220_20%_15%)] text-white text-center text-xl tracking-[0.3em] placeholder:tracking-normal placeholder:text-[hsl(220_10%_40%)] focus:outline-none focus:border-[hsl(250_90%_65%)] transition-colors"
                autoFocus
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(220_10%_40%)] hover:text-white transition-colors text-sm"
                onClick={() => setShowPin(v => !v)}
              >
                {showPin ? "ocultar" : "ver"}
              </button>
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <button type="submit" className="btn-primary w-full py-3">
              Entrar como Dono
            </button>

            <button
              type="button"
              className="w-full text-sm text-[hsl(220_10%_40%)] hover:text-white transition-colors py-2"
              onClick={() => onNavigate("home")}
            >
              ← Voltar ao portal
            </button>
          </form>

          <p className="text-center text-xs text-[hsl(220_10%_30%)] mt-8">
            Esta página não está listada no menu — acesse sempre por URL direta.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[hsl(250_90%_65%/0.2)] text-[hsl(250_90%_75%)] border border-[hsl(250_90%_65%/0.3)]">
              ⚡ MODO DONO ATIVO
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white">Painel do Administrador</h1>
          <p className="text-[hsl(220_10%_50%)] mt-1">NexOS Academy — visão completa</p>
        </div>
        <button onClick={handleLogout} className="btn-outline text-sm px-4 py-2 shrink-0">
          Sair do modo dono
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Leads capturados", value: leadsTotal, icon: "📥", tab: "leads" as Tab },
          { label: "No funil", value: funnelStats?.totalEnrolled ?? "—", icon: "🔄", tab: "funil" as Tab },
          { label: "Convertidos", value: funnelStats?.totalConverted ?? "—", icon: "✅", tab: "compras" as Tab },
          { label: "Compras", value: purchasesTotal, icon: "💳", tab: "compras" as Tab },
        ].map(kpi => (
          <button
            key={kpi.label}
            onClick={() => setTab(kpi.tab)}
            className={`card p-5 text-center hover:border-[hsl(250_90%_65%/0.5)] transition-colors ${tab === kpi.tab ? "border-[hsl(250_90%_65%/0.5)] bg-[hsl(250_90%_65%/0.05)]" : ""}`}
          >
            <div className="text-2xl mb-1">{kpi.icon}</div>
            <div className="text-3xl font-extrabold text-white">{kpi.value}</div>
            <div className="text-xs text-[hsl(220_10%_45%)] mt-0.5">{kpi.label}</div>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-[hsl(220_20%_8%)] border border-[hsl(220_20%_15%)]">
        {(["leads", "funil", "compras", "codigos", "curso", "acesso", "marca"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === t
                ? "bg-[hsl(250_90%_65%)] text-white shadow"
                : "text-[hsl(220_10%_50%)] hover:text-white"
            }`}
          >
            {t === "leads" ? "📥 Leads"
              : t === "funil" ? "🔄 Funil"
              : t === "compras" ? "💳 Compras"
              : t === "codigos" ? "🎟️ Códigos"
              : t === "curso" ? "📦 Curso"
              : t === "marca" ? "🎨 Marca"
              : "🔑 Acesso"}
          </button>
        ))}
      </div>

      {/* TAB: LEADS — CRM */}
      {tab === "leads" && (() => {
        const CRM_STATUSES = [
          { key: "novo",        label: "Novo",        dot: "bg-[hsl(220_10%_40%)]",  text: "text-[hsl(220_10%_60%)]" },
          { key: "contatado",   label: "Contatado",   dot: "bg-blue-400",             text: "text-blue-300" },
          { key: "qualificado", label: "Qualificado", dot: "bg-yellow-400",           text: "text-yellow-300" },
          { key: "convertido",  label: "Convertido",  dot: "bg-green-400",            text: "text-green-300" },
          { key: "perdido",     label: "Perdido",     dot: "bg-red-400",              text: "text-red-400" },
        ];
        const getStatus = (lead: Lead) => {
          if (lead.convertedAt) return "convertido";
          if (lead.unsubscribedAt) return "descadastrado";
          return lead.crmStatus ?? "novo";
        };
        const statusInfo = (s: string) => CRM_STATUSES.find(x => x.key === s) ?? { key: s, label: s, dot: "bg-gray-400", text: "text-gray-400" };

        const filtered = leads.filter(l => {
          const q = leadSearch.toLowerCase();
          const matchSearch = !q || l.email.toLowerCase().includes(q) || (l.name ?? "").toLowerCase().includes(q) || (l.utmSource ?? "").toLowerCase().includes(q);
          const s = getStatus(l);
          const matchFilter = crmFilter === "todos" || s === crmFilter || (crmFilter === "funil" && !!l.funnelEnrolledAt && !l.convertedAt && !l.unsubscribedAt);
          return matchSearch && matchFilter;
        });

        const FUNNEL_STEPS: Record<number, string> = { 0: "Boas-vindas", 1: "Valor", 2: "Prova Social", 3: "Objeções", 4: "Oferta" };

        return (
          <div className="flex gap-4 h-[calc(100vh-280px)] min-h-[500px]">
            {/* ── Left: Lead list ─────────────────────────────────────── */}
            <div className={`flex flex-col gap-3 ${selectedLead ? "hidden md:flex md:w-80 lg:w-96 shrink-0" : "flex-1"}`}>
              {/* Header */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h2 className="text-base font-bold text-white">CRM de Leads</h2>
                  <p className="text-xs text-[hsl(220_10%_45%)]">{leadsTotal} total · {filtered.length} exibidos</p>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={copyEmails} className="btn-outline text-xs px-2.5 py-1.5">{copyMsg || "📋 E-mails"}</button>
                  <button onClick={exportLeadsCsv} className="btn-outline text-xs px-2.5 py-1.5" disabled={leads.length === 0}>↓ CSV</button>
                  <button onClick={fetchLeads} className="btn-outline text-xs px-2.5 py-1.5">↻</button>
                </div>
              </div>

              {/* Search */}
              <input
                type="text"
                placeholder="Buscar por e-mail, nome ou UTM…"
                value={leadSearch}
                onChange={e => setLeadSearch(e.target.value)}
                className="w-full bg-[hsl(220_20%_8%)] border border-[hsl(220_20%_15%)] rounded-lg px-3 py-2 text-sm text-white placeholder-[hsl(220_10%_35%)] focus:outline-none focus:border-[hsl(250_90%_65%)]"
              />

              {/* Status filters */}
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { key: "todos", label: "Todos" },
                  { key: "novo", label: "Novos" },
                  { key: "contatado", label: "Contatados" },
                  { key: "qualificado", label: "Qualificados" },
                  { key: "convertido", label: "Convertidos" },
                  { key: "funil", label: "No Funil" },
                  { key: "perdido", label: "Perdidos" },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setCrmFilter(f.key)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${crmFilter === f.key ? "bg-[hsl(250_90%_65%)] border-[hsl(250_90%_65%)] text-white" : "border-[hsl(220_20%_18%)] text-[hsl(220_10%_50%)] hover:text-white"}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* List */}
              {leadsLoading ? (
                <div className="card p-8 text-center text-[hsl(220_10%_45%)]">Carregando…</div>
              ) : filtered.length === 0 ? (
                <div className="card p-8 text-center text-[hsl(220_10%_45%)]">
                  <p className="font-semibold text-white mb-1">Nenhum lead encontrado</p>
                  <p className="text-xs">Ajuste o filtro ou a busca.</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                  {filtered.map(lead => {
                    const s = getStatus(lead);
                    const si = statusInfo(s);
                    const isSelected = selectedLead?.id === lead.id;
                    return (
                      <button
                        key={lead.id}
                        onClick={() => openLead(lead)}
                        className={`w-full text-left rounded-lg px-3 py-2.5 border transition-all ${isSelected ? "bg-[hsl(250_90%_65%/0.12)] border-[hsl(250_90%_65%/0.4)]" : "bg-[hsl(220_20%_6%)] border-[hsl(220_20%_12%)] hover:border-[hsl(220_20%_22%)] hover:bg-[hsl(220_20%_8%)]"}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-white truncate">{lead.name ?? lead.email.split("@")[0]}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`w-1.5 h-1.5 rounded-full ${si.dot}`} />
                            <span className={`text-[11px] font-medium ${si.text}`}>{si.label}</span>
                          </div>
                        </div>
                        <div className="text-xs text-[hsl(220_10%_45%)] truncate">{lead.email}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {lead.funnelEnrolledAt && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-[hsl(250_90%_65%/0.1)] text-[hsl(250_90%_75%)] border border-[hsl(250_90%_65%/0.2)]">
                              Funil E{lead.funnelStep + 1}
                            </span>
                          )}
                          {lead.utmSource && (
                            <span className="text-[11px] text-[hsl(220_10%_40%)]">{lead.utmSource}</span>
                          )}
                          {lead.crmNotes && (
                            <span className="text-[11px] text-[hsl(220_10%_40%)]">📝</span>
                          )}
                          <span className="text-[11px] text-[hsl(220_10%_35%)] ml-auto">{new Date(lead.createdAt).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Right: Lead drawer ───────────────────────────────────── */}
            {selectedLead && (
              <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
                {/* Drawer header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-white truncate">{selectedLead.name ?? selectedLead.email.split("@")[0]}</h2>
                    <button onClick={() => copyCrmEmail(selectedLead.email)} className="text-sm text-[hsl(250_90%_75%)] hover:underline text-left">
                      {selectedLead.email}
                    </button>
                  </div>
                  <div className="flex gap-2 items-center shrink-0">
                    {actionMsg && <span className="text-xs text-green-400 font-medium">{actionMsg}</span>}
                    <button onClick={closeLead} className="btn-outline text-xs px-2.5 py-1.5">✕ Fechar</button>
                  </div>
                </div>

                {/* Pipeline status selector */}
                <div className="card p-4">
                  <p className="text-xs font-semibold text-[hsl(220_10%_40%)] uppercase tracking-wider mb-3">Pipeline de Status</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {CRM_STATUSES.map(s => {
                      const isActive = (selectedLead.convertedAt ? "convertido" : selectedLead.crmStatus) === s.key;
                      return (
                        <button
                          key={s.key}
                          onClick={() => updateStatus(selectedLead.id, s.key)}
                          disabled={savingStatus}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${isActive ? `bg-[hsl(220_20%_12%)] border-[hsl(220_20%_25%)] ${s.text}` : "border-[hsl(220_20%_14%)] text-[hsl(220_10%_40%)] hover:border-[hsl(220_20%_25%)] hover:text-white"}`}
                        >
                          <span className={`w-2 h-2 rounded-full ${s.dot} ${isActive ? "shadow-[0_0_6px_2px_currentColor]" : ""}`} />
                          {s.label}
                          {isActive && <span className="ml-1">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Fonte", value: selectedLead.source },
                    { label: "UTM Source", value: selectedLead.utmSource ?? "—" },
                    { label: "UTM Medium", value: selectedLead.utmMedium ?? "—" },
                    { label: "UTM Campaign", value: selectedLead.utmCampaign ?? "—" },
                    { label: "Capturado em", value: fmt(selectedLead.createdAt) },
                    { label: "IP", value: selectedLead.ipAddress ?? "—" },
                  ].map(item => (
                    <div key={item.label} className="card px-3 py-2.5">
                      <p className="text-[11px] text-[hsl(220_10%_40%)] uppercase tracking-wider mb-0.5">{item.label}</p>
                      <p className="text-sm text-white font-medium truncate">{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* Funnel status */}
                <div className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-[hsl(220_10%_40%)] uppercase tracking-wider">Funil de E-mails</p>
                    {!selectedLead.funnelEnrolledAt && (
                      <button
                        onClick={() => enrollLead(selectedLead.id)}
                        disabled={savingStatus}
                        className="btn-primary text-xs px-3 py-1.5"
                      >
                        {savingStatus ? "…" : "+ Inscrever no Funil"}
                      </button>
                    )}
                  </div>

                  {!selectedLead.funnelEnrolledAt ? (
                    <p className="text-sm text-[hsl(220_10%_40%)] italic">Lead ainda não inscrito no funil de nutrição.</p>
                  ) : loadingDetail ? (
                    <p className="text-sm text-[hsl(220_10%_40%)]">Carregando…</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-[hsl(220_10%_50%)]">
                        <span>Inscrito em {fmt(selectedLead.funnelEnrolledAt)}</span>
                        {selectedLead.convertedAt && (
                          <span className="text-green-400 font-semibold">· Convertido {fmt(selectedLead.convertedAt)}</span>
                        )}
                        {selectedLead.unsubscribedAt && (
                          <span className="text-red-400">· Descadastrado</span>
                        )}
                      </div>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[0, 1, 2, 3, 4].map(step => {
                          const email = leadDetail?.funnelEmails.find(e => e.step === step);
                          const statusColor = !email ? "border-[hsl(220_20%_14%)] text-[hsl(220_10%_35%)]"
                            : email.status === "sent" ? "border-green-500/30 bg-green-500/10 text-green-400"
                            : email.status === "scheduled" ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                            : email.status === "failed" ? "border-red-500/30 bg-red-500/10 text-red-400"
                            : "border-[hsl(220_20%_14%)] text-[hsl(220_10%_40%)]";
                          return (
                            <div key={step} className={`rounded-lg p-2 border text-center ${statusColor}`}>
                              <div className="text-[11px] font-bold">E{step + 1}</div>
                              <div className="text-[10px] mt-0.5 truncate">{FUNNEL_STEPS[step]}</div>
                              <div className="text-[10px] mt-0.5">
                                {!email ? "—" : email.status === "sent" ? "✓ Enviado" : email.status === "scheduled" ? "Agendado" : email.status === "failed" ? "✗ Falhou" : email.status}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Purchases */}
                {leadDetail && leadDetail.purchases.length > 0 && (
                  <div className="card p-4">
                    <p className="text-xs font-semibold text-[hsl(220_10%_40%)] uppercase tracking-wider mb-3">Compras</p>
                    <div className="space-y-2">
                      {leadDetail.purchases.map(p => (
                        <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-white font-medium">{p.productId === "complete-bundle" ? "Metodologia NexOS — Completa" : "Mini-Guia R$10k"}</span>
                          <StatusBadge status={p.status} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-[hsl(220_10%_40%)] uppercase tracking-wider">Notas CRM</p>
                    {!editingNotes && (
                      <button onClick={() => { setEditingNotes(true); setNotesValue(selectedLead.crmNotes ?? ""); }} className="btn-outline text-xs px-2.5 py-1">
                        {selectedLead.crmNotes ? "Editar" : "+ Adicionar nota"}
                      </button>
                    )}
                  </div>
                  {editingNotes ? (
                    <div className="space-y-2">
                      <textarea
                        value={notesValue}
                        onChange={e => setNotesValue(e.target.value)}
                        rows={4}
                        placeholder="Observações sobre este lead…"
                        className="w-full bg-[hsl(220_20%_8%)] border border-[hsl(220_20%_15%)] rounded-lg px-3 py-2 text-sm text-white placeholder-[hsl(220_10%_35%)] focus:outline-none focus:border-[hsl(250_90%_65%)] resize-none"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => saveNotes(selectedLead.id)} disabled={savingStatus} className="btn-primary text-xs px-3 py-1.5">{savingStatus ? "Salvando…" : "Salvar"}</button>
                        <button onClick={() => setEditingNotes(false)} className="btn-outline text-xs px-3 py-1.5">Cancelar</button>
                      </div>
                    </div>
                  ) : selectedLead.crmNotes ? (
                    <p className="text-sm text-[hsl(220_10%_70%)] whitespace-pre-wrap">{selectedLead.crmNotes}</p>
                  ) : (
                    <p className="text-sm text-[hsl(220_10%_35%)] italic">Nenhuma nota adicionada.</p>
                  )}
                </div>

                {/* Quick actions */}
                <div className="card p-4">
                  <p className="text-xs font-semibold text-[hsl(220_10%_40%)] uppercase tracking-wider mb-3">Ações Rápidas</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => copyCrmEmail(selectedLead.email)} className="btn-outline text-xs px-3 py-1.5">📋 Copiar E-mail</button>
                    <button onClick={() => copyCrmEmail(`${selectedLead.name ?? ""} <${selectedLead.email}>`)} className="btn-outline text-xs px-3 py-1.5">👤 Copiar Nome + E-mail</button>
                    <a href={`mailto:${selectedLead.email}`} className="btn-outline text-xs px-3 py-1.5 no-underline">✉️ Abrir no Mail</a>
                    {!selectedLead.convertedAt && (
                      <button
                        onClick={() => { if (confirm(`Marcar ${selectedLead.email} como convertido?`)) convertLead(selectedLead.id); }}
                        disabled={savingStatus}
                        className="btn-primary text-xs px-3 py-1.5"
                      >
                        ✅ Marcar Convertido
                      </button>
                    )}
                    {!selectedLead.funnelEnrolledAt && (
                      <button onClick={() => enrollLead(selectedLead.id)} disabled={savingStatus} className="btn-outline text-xs px-3 py-1.5">
                        📧 Inscrever no Funil
                      </button>
                    )}
                    <button
                      onClick={() => updateStatus(selectedLead.id, "contatado")}
                      disabled={savingStatus || selectedLead.crmStatus === "contatado"}
                      className="btn-outline text-xs px-3 py-1.5"
                    >
                      📞 Marcar Contatado
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB: FUNIL */}
      {tab === "funil" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-bold text-white">Funil de Venda Perpétuo</h2>
              <p className="text-sm text-[hsl(220_10%_45%)]">Sequência de 5 e-mails enviada automaticamente ao capturar um lead</p>
            </div>
            <button onClick={fetchFunnelStats} className="btn-outline text-sm px-3 py-1.5">↻ Atualizar</button>
          </div>

          {/* Summary KPIs */}
          {funnelStats && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "No funil", value: funnelStats.totalEnrolled, icon: "🔄", color: "text-blue-400" },
                { label: "Convertidos", value: funnelStats.totalConverted, icon: "✅", color: "text-green-400" },
                { label: "Descadastrados", value: funnelStats.totalUnsubscribed, icon: "🚫", color: "text-red-400" },
              ].map(kpi => (
                <div key={kpi.label} className="card p-4 text-center">
                  <div className={`text-2xl font-extrabold ${kpi.color}`}>{kpi.value}</div>
                  <div className="text-xs text-[hsl(220_10%_45%)] mt-0.5">{kpi.label}</div>
                </div>
              ))}
            </div>
          )}

          {funnelLoading ? (
            <div className="card p-10 text-center text-[hsl(220_10%_45%)]">Carregando...</div>
          ) : !funnelStats ? (
            <div className="card p-10 text-center text-[hsl(220_10%_45%)]">Erro ao carregar estatísticas.</div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[hsl(220_10%_55%)] uppercase tracking-wider">Sequência de E-mails</h3>
              {funnelStats.byStep.map(step => {
                const total = step.sent + step.failed + step.scheduled + step.skipped;
                const sentPct = total > 0 ? Math.round((step.sent / total) * 100) : 0;
                return (
                  <div key={step.step} className="card p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[hsl(250_90%_65%/0.15)] flex items-center justify-center text-xs font-bold text-[hsl(250_90%_75%)] shrink-0">
                          {step.step}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{step.subject}</p>
                          <p className="text-xs text-[hsl(220_10%_45%)]">
                            Dia {step.dayOffset} após captura
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3 shrink-0 text-xs">
                        <span className="text-green-400 font-semibold">{step.sent} enviados</span>
                        {step.scheduled > 0 && <span className="text-yellow-400">{step.scheduled} agendados</span>}
                        {step.failed > 0 && <span className="text-red-400">{step.failed} falhas</span>}
                        {step.skipped > 0 && <span className="text-[hsl(220_10%_40%)]">{step.skipped} ignorados</span>}
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 rounded-full bg-[hsl(220_20%_12%)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[hsl(250_90%_55%)] to-[hsl(270_90%_65%)] transition-all"
                        style={{ width: `${sentPct}%` }}
                      />
                    </div>
                    <p className="text-xs text-[hsl(220_10%_35%)] mt-1">{sentPct}% enviados do total agendado</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Info card */}
          <div className="card p-5 border border-[hsl(250_90%_65%/0.2)] bg-[hsl(250_90%_65%/0.04)]">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span>⚙️</span> Como funciona
            </h3>
            <div className="space-y-2 text-sm text-[hsl(220_10%_55%)]">
              <p>→ Lead se inscreve no formulário do guia gratuito</p>
              <p>→ É automaticamente matriculado na sequência de 5 e-mails</p>
              <p>→ O servidor verifica e envia e-mails devidos a cada hora</p>
              <p>→ Quando o lead compra, os e-mails de venda são interrompidos automaticamente</p>
              <p>→ Descadastro funciona via link no rodapé de cada e-mail</p>
            </div>
            <p className="mt-3 text-xs text-[hsl(220_10%_40%)]">
              Configure <code className="text-[hsl(250_90%_70%)]">RESEND_API_KEY</code> e <code className="text-[hsl(250_90%_70%)]">RESEND_FROM_EMAIL</code> nas variáveis de ambiente para ativar o envio real.
            </p>
          </div>
        </div>
      )}

      {/* TAB: COMPRAS */}
      {tab === "compras" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-bold text-white">Compras</h2>
              <p className="text-sm text-[hsl(220_10%_45%)]">
                {purchasesTotal} compra{purchasesTotal !== 1 ? "s" : ""} no total
              </p>
            </div>
            <button onClick={fetchPurchases} className="btn-outline text-sm px-3 py-1.5">
              ↻ Atualizar
            </button>
          </div>

          {purchasesLoading ? (
            <div className="card p-10 text-center text-[hsl(220_10%_45%)]">Carregando...</div>
          ) : purchases.length === 0 ? (
            <div className="card p-10 text-center text-[hsl(220_10%_45%)]">
              <div className="text-4xl mb-3">🛒</div>
              <p className="font-semibold text-white mb-1">Nenhuma compra ainda</p>
              <p className="text-sm">As compras via Asaas aparecem aqui após a confirmação do webhook.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {purchases.map((p) => {
                const productLabel = p.productId === "complete-bundle"
                  ? "Metodologia NexOS Completa"
                  : p.productId === "mini-guide"
                  ? "Mini-Guia: Primeiros R$10k"
                  : p.productId;
                const isConfirmed = p.status === "confirmed";
                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-[hsl(220_20%_14%)] bg-[hsl(222_25%_6%)] overflow-hidden"
                  >
                    {/* Card header */}
                    <div className="px-5 py-4 border-b border-[hsl(220_20%_12%)] flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{p.customerName}</p>
                        <p className="text-[hsl(220_10%_40%)] text-xs mt-0.5">{fmt(p.createdAt)}</p>
                      </div>
                      <StatusBadge status={p.status} />
                    </div>

                    {/* Campo / Status table */}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[hsl(220_20%_12%)]">
                          <th className="text-left px-5 py-2.5 text-xs font-bold text-[hsl(220_10%_45%)] uppercase tracking-wider w-1/2">Campo</th>
                          <th className="text-left px-5 py-2.5 text-xs font-bold text-[hsl(220_10%_45%)] uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-[hsl(220_20%_10%)]">
                          <td className="px-5 py-3 text-[hsl(220_10%_55%)]">Token</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <code className="text-[hsl(250_90%_75%)] font-bold tracking-wider text-xs">{p.accessToken}</code>
                              <button
                                onClick={() => copyToken(p.accessToken)}
                                className="text-[hsl(220_10%_40%)] hover:text-white transition-colors shrink-0"
                                title="Copiar"
                              >📋</button>
                            </div>
                          </td>
                        </tr>
                        <tr className="border-b border-[hsl(220_20%_10%)]">
                          <td className="px-5 py-3 text-[hsl(220_10%_55%)]">Email</td>
                          <td className="px-5 py-3 text-white text-xs break-all">{p.customerEmail}</td>
                        </tr>
                        <tr className="border-b border-[hsl(220_20%_10%)]">
                          <td className="px-5 py-3 text-[hsl(220_10%_55%)]">Produto</td>
                          <td className="px-5 py-3 text-white text-xs">{productLabel}</td>
                        </tr>
                        <tr className="border-b border-[hsl(220_20%_10%)]">
                          <td className="px-5 py-3 text-[hsl(220_10%_55%)]">Pagamento</td>
                          <td className="px-5 py-3">
                            <span className={`text-xs font-semibold ${isConfirmed ? "text-green-400" : "text-yellow-400"}`}>
                              {isConfirmed ? "Confirmado" : "Pendente"}
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-5 py-3 text-[hsl(220_10%_55%)]">Acesso</td>
                          <td className="px-5 py-3">
                            <span className={`text-xs font-semibold ${isConfirmed ? "text-green-400" : "text-[hsl(220_10%_45%)]"}`}>
                              {isConfirmed ? "Válido" : "Aguardando pagamento"}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Actions */}
                    <div className="px-5 py-3 border-t border-[hsl(220_20%_12%)] flex gap-2">
                      {confirmMsg[p.id] ? (
                        <span className="text-xs text-red-400 font-semibold">{confirmMsg[p.id]}</span>
                      ) : !isConfirmed ? (
                        <button
                          onClick={() => confirmPurchase(p)}
                          disabled={confirmingId === p.id}
                          className="flex-1 text-xs py-2 rounded-lg bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 transition-colors disabled:opacity-50 font-semibold"
                        >
                          {confirmingId === p.id ? "Confirmando..." : "✓ Confirmar Pagamento"}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => setConfirmedModal(p)}
                            className="flex-1 text-xs py-2 rounded-lg bg-[hsl(250_90%_65%/0.12)] text-[hsl(250_90%_75%)] border border-[hsl(250_90%_65%/0.25)] hover:bg-[hsl(250_90%_65%/0.2)] transition-colors font-semibold"
                          >
                            📨 Reenviar Email
                          </button>
                          <button
                            onClick={() => copyToken(p.accessToken)}
                            className="text-xs px-3 py-2 rounded-lg bg-[hsl(220_20%_8%)] text-[hsl(220_10%_55%)] border border-[hsl(220_20%_14%)] hover:text-white transition-colors"
                            title="Copiar token"
                          >
                            📋
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: CURSO */}
      {tab === "curso" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Capítulos", value: totalChapters, icon: "📖" },
              { label: "Aulas", value: totalLessons, icon: "🎓" },
              { label: "Horas", value: `${totalHours}h ${totalMinutes}m`, icon: "⏱️" },
            ].map(kpi => (
              <div key={kpi.label} className="card p-4 text-center">
                <div className="text-xl mb-1">{kpi.icon}</div>
                <div className="text-2xl font-extrabold text-white">{kpi.value}</div>
                <div className="text-xs text-[hsl(220_10%_45%)] mt-0.5">{kpi.label}</div>
              </div>
            ))}
          </div>

          <h2 className="text-base font-bold text-white mt-2">Módulos</h2>
          <div className="space-y-2">
            {moduleStats.map(mod => (
              <div
                key={mod.id}
                className="card p-4 flex items-center justify-between gap-4 hover:border-[hsl(250_90%_65%/0.4)] transition-colors cursor-pointer"
                onClick={() => onNavigate("module", { moduleId: mod.id })}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[hsl(250_90%_65%/0.15)] flex items-center justify-center text-xs font-bold text-[hsl(250_90%_75%)] shrink-0">
                    {mod.number}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{mod.title}</p>
                    <p className="text-xs text-[hsl(220_10%_45%)]">{mod.chapters} capítulos · {mod.lessons} aulas</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {mod.badge && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[hsl(220_20%_12%)] text-[hsl(220_10%_55%)] border border-[hsl(220_20%_18%)]">
                      {mod.badge}
                    </span>
                  )}
                  <span className="text-[hsl(220_10%_40%)] text-xs">→</span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-3 gap-3 mt-2">
            {[
              { label: "Ver todos os módulos", icon: "📦", page: "modules" },
              { label: "Ver glossário", icon: "📖", page: "glossary" },
              { label: "Página de produtos", icon: "🛒", page: "products" },
            ].map(action => (
              <button
                key={action.page}
                className="card p-4 text-left hover:border-[hsl(250_90%_65%/0.4)] transition-colors flex items-center gap-3"
                onClick={() => onNavigate(action.page)}
              >
                <span className="text-xl">{action.icon}</span>
                <span className="text-sm font-medium text-white">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TAB: ACESSO */}
      {tab === "acesso" && (
        <div className="space-y-4">
          <div className="card p-6 border border-[hsl(250_90%_65%/0.3)] bg-[hsl(250_90%_65%/0.05)]">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span>🔑</span> Seu Acesso de Dono
            </h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-3">
                {[
                  { title: "Conteúdo 100% desbloqueado", desc: "Você acessa todas as aulas sem pagar" },
                  { title: "Sem paywall nunca", desc: "O modo dono fica salvo neste navegador" },
                  { title: "Badge \"Dono\" visível", desc: "Você sempre sabe que está no modo admin" },
                ].map(item => (
                  <div key={item.title} className="flex items-start gap-3">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <div>
                      <p className="text-white font-medium">{item.title}</p>
                      <p className="text-[hsl(220_10%_45%)]">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-[hsl(220_20%_8%)] space-y-2">
                  <p className="text-xs text-[hsl(220_10%_45%)] uppercase tracking-wider font-semibold">URL do painel</p>
                  <code className="text-[hsl(250_90%_75%)] text-sm break-all">/nexos-academy/#owner</code>
                  <p className="text-xs text-[hsl(220_10%_40%)]">Salve este link. Só você sabe que ele existe.</p>
                </div>
                <div className="p-4 rounded-xl bg-[hsl(220_20%_8%)]">
                  <p className="text-xs text-[hsl(220_10%_45%)] uppercase tracking-wider font-semibold mb-1">PIN atual</p>
                  <code className="text-[hsl(250_90%_75%)] text-sm">{OWNER_PIN}</code>
                  <p className="text-xs text-[hsl(220_10%_40%)] mt-1">Guarde em local seguro.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="text-center text-xs text-[hsl(220_10%_30%)] py-4">
        Painel acessível apenas via <code className="text-[hsl(220_10%_40%)]">/nexos-academy/#owner</code> — não aparece em nenhum menu público.
      </div>

      {/* ── Modal de confirmação de pagamento ── */}
      {confirmedModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}
          onClick={e => e.target === e.currentTarget && setConfirmedModal(null)}
        >
          <div className="w-full max-w-md rounded-2xl border border-green-500/30 bg-[hsl(222_25%_6%)] p-8 space-y-6 shadow-2xl">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="text-4xl">✅</div>
              <h2 className="text-xl font-bold text-white">Pagamento Confirmado!</h2>
              <p className="text-sm text-[hsl(220_10%_50%)]">Entregue o código abaixo ao cliente</p>
            </div>

            {/* Cliente info */}
            <div className="rounded-xl bg-[hsl(220_20%_8%)] border border-[hsl(220_20%_14%)] p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[hsl(220_10%_45%)]">Cliente</span>
                <span className="text-white font-semibold">{confirmedModal.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[hsl(220_10%_45%)]">E-mail</span>
                <span className="text-white">{confirmedModal.customerEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[hsl(220_10%_45%)]">Produto</span>
                <span className="text-[hsl(250_90%_75%)] font-semibold">
                  {confirmedModal.productId === "complete-bundle"
                    ? "Metodologia NexOS — Edição Completa"
                    : confirmedModal.productId === "mini-guide"
                    ? "Mini-Guia: Primeiros R$10k Online"
                    : confirmedModal.productId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[hsl(220_10%_45%)]">Valor</span>
                <span className="text-white font-semibold">{fmtBrl(confirmedModal.amountCents)}</span>
              </div>
            </div>

            {/* Token em destaque */}
            <div className="rounded-xl border-2 border-[hsl(250_90%_65%/0.5)] bg-[hsl(250_90%_65%/0.08)] p-5 text-center space-y-3">
              <p className="text-xs text-[hsl(250_90%_70%)] uppercase tracking-widest font-bold">Código de Acesso</p>
              <p className="text-3xl font-extrabold text-white tracking-[0.25em] font-mono">{confirmedModal.accessToken}</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(confirmedModal.accessToken);
                  setCopyMsg("Copiado!");
                  setTimeout(() => setCopyMsg(""), 2000);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(250_90%_65%/0.2)] text-[hsl(250_90%_75%)] border border-[hsl(250_90%_65%/0.4)] hover:bg-[hsl(250_90%_65%/0.3)] transition-colors text-sm font-semibold"
              >
                {copyMsg === "Copiado!" ? "✓ Copiado!" : "📋 Copiar Código"}
              </button>
            </div>

            {/* Ações */}
            <div className="space-y-3">
              {/* WhatsApp */}
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Olá ${confirmedModal.customerName?.split(" ")[0] ?? ""}! 🎉\n\nSeu acesso à *${confirmedModal.productId === "complete-bundle" ? "Metodologia NexOS — Edição Completa" : "Mini-Guia NexOS"}* está liberado!\n\n*Código de acesso:* \`${confirmedModal.accessToken}\`\n\n👉 Acesse em: ${window.location.origin}/nexos-academy/\n\nClique em "Já tenho um código" e digite o código acima.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition-colors text-sm"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Enviar por WhatsApp
              </a>

              <button
                onClick={() => setConfirmedModal(null)}
                className="w-full py-2.5 rounded-xl border border-[hsl(220_20%_15%)] text-[hsl(220_10%_50%)] hover:text-white hover:border-[hsl(220_20%_25%)] transition-colors text-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* TAB: MARCA */}
      {tab === "marca" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white">Configuração da Marca</h2>
            <p className="text-sm text-[hsl(220_10%_45%)] mt-0.5">
              Personalize como sua academy aparece para os alunos. As alterações são aplicadas imediatamente.
            </p>
          </div>

          {/* Preview */}
          <div className="rounded-xl border border-[hsl(250_90%_65%/0.25)] bg-[hsl(250_30%_6%)] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[hsl(220_20%_12%)] flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              </div>
              <span className="text-[10px] text-[hsl(220_10%_40%)] font-mono ml-2">preview — como os alunos vão ver</span>
            </div>
            {/* Nav preview */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-[hsl(220_20%_10%)] bg-[hsl(222_25%_4%)]">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-extrabold text-white shrink-0"
                style={{ background: brand.primaryColor || "var(--gradient-primary)" }}
              >
                {brand.logoLetter || "N"}
              </div>
              <span className="font-bold text-white text-sm">{brand.academyName || "NexOS Academy"}</span>
              {brand.ownerName && (
                <span className="ml-auto text-[11px] text-[hsl(220_10%_45%)]">por {brand.ownerName}</span>
              )}
            </div>
            {/* Hero preview */}
            <div className="p-5 space-y-1.5">
              <div className="text-[10px] text-[hsl(250_90%_70%)] font-bold uppercase tracking-widest">⚡ {brand.academyName || "NexOS Academy"}</div>
              <div className="text-lg font-extrabold text-white leading-tight">
                {brand.heroTitle || "Crie, Lance e Venda"}<br />
                <span style={{ color: brand.primaryColor || "hsl(250 90% 65%)" }}>{brand.heroHighlight || "Produtos Digitais"}</span>
              </div>
              <p className="text-[12px] text-[hsl(220_10%_60%)] leading-relaxed max-w-md">{brand.heroDescription || DEFAULT_BRAND.heroDescription}</p>
            </div>
          </div>

          {/* Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nome da Academy */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[hsl(220_10%_60%)] uppercase tracking-wider">Nome da Academy</label>
              <input
                type="text"
                value={brand.academyName}
                onChange={e => setBrand(b => ({ ...b, academyName: e.target.value }))}
                placeholder="Ex: Academia do João"
                className="w-full bg-[hsl(220_20%_8%)] border border-[hsl(220_20%_15%)] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[hsl(220_10%_35%)] focus:outline-none focus:border-[hsl(250_90%_65%/0.5)]"
              />
            </div>

            {/* Letra do Logo */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[hsl(220_10%_60%)] uppercase tracking-wider">Letra do Logo</label>
              <input
                type="text"
                maxLength={2}
                value={brand.logoLetter}
                onChange={e => setBrand(b => ({ ...b, logoLetter: e.target.value.toUpperCase() }))}
                placeholder="Ex: J"
                className="w-full bg-[hsl(220_20%_8%)] border border-[hsl(220_20%_15%)] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[hsl(220_10%_35%)] focus:outline-none focus:border-[hsl(250_90%_65%/0.5)]"
              />
            </div>

            {/* Seu nome */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[hsl(220_10%_60%)] uppercase tracking-wider">Seu Nome</label>
              <input
                type="text"
                value={brand.ownerName}
                onChange={e => setBrand(b => ({ ...b, ownerName: e.target.value }))}
                placeholder="Ex: João Silva"
                className="w-full bg-[hsl(220_20%_8%)] border border-[hsl(220_20%_15%)] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[hsl(220_10%_35%)] focus:outline-none focus:border-[hsl(250_90%_65%/0.5)]"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[hsl(220_10%_60%)] uppercase tracking-wider">Seu Email</label>
              <input
                type="email"
                value={brand.ownerEmail}
                onChange={e => setBrand(b => ({ ...b, ownerEmail: e.target.value }))}
                placeholder="Ex: joao@minhacademy.com"
                className="w-full bg-[hsl(220_20%_8%)] border border-[hsl(220_20%_15%)] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[hsl(220_10%_35%)] focus:outline-none focus:border-[hsl(250_90%_65%/0.5)]"
              />
            </div>

            {/* Cor Principal */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[hsl(220_10%_60%)] uppercase tracking-wider">Cor Principal</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={brand.primaryColor}
                  onChange={e => setBrand(b => ({ ...b, primaryColor: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-[hsl(220_20%_15%)] bg-transparent cursor-pointer p-1"
                />
                <input
                  type="text"
                  value={brand.primaryColor}
                  onChange={e => setBrand(b => ({ ...b, primaryColor: e.target.value }))}
                  placeholder="#7c3aed"
                  className="flex-1 bg-[hsl(220_20%_8%)] border border-[hsl(220_20%_15%)] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[hsl(220_10%_35%)] focus:outline-none focus:border-[hsl(250_90%_65%/0.5)] font-mono"
                />
              </div>
              <div className="flex gap-2 flex-wrap mt-1">
                {["#7c3aed", "#2563eb", "#059669", "#dc2626", "#d97706", "#0891b2", "#be185d"].map(c => (
                  <button
                    key={c}
                    onClick={() => setBrand(b => ({ ...b, primaryColor: c }))}
                    title={c}
                    className="w-6 h-6 rounded-full border-2 transition-all"
                    style={{
                      background: c,
                      borderColor: brand.primaryColor === c ? "white" : "transparent",
                      transform: brand.primaryColor === c ? "scale(1.2)" : "scale(1)",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Tagline */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[hsl(220_10%_60%)] uppercase tracking-wider">Tagline</label>
              <input
                type="text"
                value={brand.tagline}
                onChange={e => setBrand(b => ({ ...b, tagline: e.target.value }))}
                placeholder="Ex: Formação completa em lançamentos"
                className="w-full bg-[hsl(220_20%_8%)] border border-[hsl(220_20%_15%)] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[hsl(220_10%_35%)] focus:outline-none focus:border-[hsl(250_90%_65%/0.5)]"
              />
            </div>

            {/* Título do hero */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[hsl(220_10%_60%)] uppercase tracking-wider">Título do Hero (linha 1)</label>
              <input
                type="text"
                value={brand.heroTitle}
                onChange={e => setBrand(b => ({ ...b, heroTitle: e.target.value }))}
                placeholder="Ex: Aprenda, Crie e Venda"
                className="w-full bg-[hsl(220_20%_8%)] border border-[hsl(220_20%_15%)] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[hsl(220_10%_35%)] focus:outline-none focus:border-[hsl(250_90%_65%/0.5)]"
              />
            </div>

            {/* Destaque do hero */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[hsl(220_10%_60%)] uppercase tracking-wider">Título do Hero (linha 2 — colorida)</label>
              <input
                type="text"
                value={brand.heroHighlight}
                onChange={e => setBrand(b => ({ ...b, heroHighlight: e.target.value }))}
                placeholder="Ex: com Consistência e Método"
                className="w-full bg-[hsl(220_20%_8%)] border border-[hsl(220_20%_15%)] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[hsl(220_10%_35%)] focus:outline-none focus:border-[hsl(250_90%_65%/0.5)]"
              />
            </div>

            {/* Descrição do hero */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-xs font-semibold text-[hsl(220_10%_60%)] uppercase tracking-wider">Descrição da Página Inicial</label>
              <textarea
                rows={3}
                value={brand.heroDescription}
                onChange={e => setBrand(b => ({ ...b, heroDescription: e.target.value }))}
                placeholder="Descreva o que os alunos vão aprender..."
                className="w-full bg-[hsl(220_20%_8%)] border border-[hsl(220_20%_15%)] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[hsl(220_10%_35%)] focus:outline-none focus:border-[hsl(250_90%_65%/0.5)] resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => {
                saveBrand(brand);
                setBrandSaved(true);
                setTimeout(() => setBrandSaved(false), 2500);
              }}
              className="btn-primary text-sm px-5 py-2.5"
            >
              {brandSaved ? "✓ Salvo!" : "💾 Salvar Configurações"}
            </button>
            <button
              onClick={() => {
                if (confirm("Resetar para os padrões NexOS?")) {
                  setBrand(DEFAULT_BRAND);
                  saveBrand(DEFAULT_BRAND);
                }
              }}
              className="btn-outline text-sm px-4 py-2.5"
            >
              Restaurar Padrão
            </button>
            {brand.ownerName && (
              <span className="text-xs text-[hsl(220_10%_40%)]">
                Publicado por <strong className="text-[hsl(220_10%_60%)]">{brand.ownerName}</strong>
                {brand.ownerEmail && <> · {brand.ownerEmail}</>}
              </span>
            )}
          </div>
        </div>
      )}

      {/* TAB: CÓDIGOS DE ACESSO */}
      {tab === "codigos" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-bold text-white">🎟️ Códigos de Acesso</h2>
              <p className="text-sm text-[hsl(220_10%_45%)]">
                {giftCodes.filter(c => c.customerEmail !== "brinde@agencianexos.vip").length} em uso ·{" "}
                {giftCodes.filter(c => c.customerEmail === "brinde@agencianexos.vip").length} disponíveis
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => generateMoreGiftCodes(5)}
                disabled={giftGenerating}
                className="btn-primary text-sm px-4 py-2"
              >
                {giftGenerating ? "Gerando..." : "+ 5 Códigos"}
              </button>
              <button
                onClick={() => generateMoreGiftCodes(10)}
                disabled={giftGenerating}
                className="btn-outline text-sm px-4 py-2"
              >
                {giftGenerating ? "..." : "+ 10 Códigos"}
              </button>
              <button onClick={fetchGiftCodes} className="btn-outline text-sm px-3 py-2">↻</button>
            </div>
          </div>

          {giftLoading ? (
            <div className="card p-8 text-center text-[hsl(220_10%_45%)]">Carregando...</div>
          ) : giftCodes.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-[hsl(220_10%_45%)]">Nenhum código gerado ainda.</p>
              <button onClick={() => generateMoreGiftCodes(10)} className="btn-primary text-sm px-4 py-2 mt-3">
                Gerar 10 Códigos
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Em uso */}
              {giftCodes.filter(c => c.customerEmail !== "brinde@agencianexos.vip").length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-green-400 uppercase tracking-widest mb-2">
                    ✅ Em Uso ({giftCodes.filter(c => c.customerEmail !== "brinde@agencianexos.vip").length})
                  </h3>
                  <div className="space-y-1.5">
                    {giftCodes.filter(c => c.customerEmail !== "brinde@agencianexos.vip").map(code => (
                      <div key={code.id} className="card px-4 py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono text-base font-bold text-white tracking-widest shrink-0">{code.accessToken}</span>
                          <div className="min-w-0">
                            <p className="text-sm text-white truncate">{code.customerName}</p>
                            <p className="text-xs text-[hsl(220_10%_40%)] truncate">{code.customerEmail}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => copyCode(code.accessToken)}
                          className="btn-outline text-xs px-3 py-1 shrink-0"
                        >
                          {giftCopied === code.accessToken ? "✓ Copiado" : "Copiar"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Disponíveis */}
              {giftCodes.filter(c => c.customerEmail === "brinde@agencianexos.vip").length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-[hsl(220_10%_40%)] uppercase tracking-widest mb-2">
                    ⚪ Disponíveis ({giftCodes.filter(c => c.customerEmail === "brinde@agencianexos.vip").length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {giftCodes.filter(c => c.customerEmail === "brinde@agencianexos.vip").map(code => (
                      <div key={code.id} className="card px-4 py-3 flex items-center justify-between gap-3">
                        <span className="font-mono text-base font-bold text-[hsl(250_90%_75%)] tracking-widest">{code.accessToken}</span>
                        <button
                          onClick={() => copyCode(code.accessToken)}
                          className="btn-outline text-xs px-3 py-1 shrink-0"
                        >
                          {giftCopied === code.accessToken ? "✓" : "Copiar"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
