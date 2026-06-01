import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetCreditsBalance, getGetCreditsBalanceQueryKey, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  User, Building2, ShieldCheck, CreditCard, Copy,
  CheckCircle2, Loader2, Eye, EyeOff, ExternalLink, Zap,
  Wifi, WifiOff, Plus, XCircle, AlertTriangle, Link2, Globe,
} from "lucide-react";
import nexosLogo from "/nexos-logo.png";

type Tab = "perfil" | "workspace" | "seguranca" | "integracoes";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "perfil",       label: "Perfil",       icon: User       },
  { id: "workspace",    label: "Workspace",    icon: Building2  },
  { id: "seguranca",    label: "Segurança",    icon: ShieldCheck },
  { id: "integracoes",  label: "Integrações",  icon: Link2      },
];

function SectionCard({ children, title, icon: Icon }: { children: React.ReactNode; title: string; icon: React.ElementType }) {
  return (
    <div className="border border-border/50 bg-card/40 backdrop-blur-sm relative overflow-hidden card-weapon">
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-primary/40 pointer-events-none" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-primary/40 pointer-events-none" />
      <div className="px-6 py-4 border-b border-border/40 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{title}</span>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function FieldRow({ label, sublabel, children }: { label: string; sublabel?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-8 py-4 border-b border-border/30 last:border-0">
      <div className="md:w-48 shrink-0">
        <div className="font-mono text-xs text-foreground/90 font-semibold">{label}</div>
        {sublabel && <div className="font-mono text-xs text-muted-foreground/60 mt-0.5">{sublabel}</div>}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

type Locale = "pt-BR" | "en-US" | "en-AU" | "es-LA";

const LOCALE_OPTIONS: { value: Locale; label: string; flag: string; sublabel: string }[] = [
  { value: "pt-BR", label: "Português (BR)",  flag: "🇧🇷", sublabel: "Brasil" },
  { value: "en-US", label: "English (US)",    flag: "🇺🇸", sublabel: "United States" },
  { value: "en-AU", label: "English (AU)",    flag: "🇦🇺", sublabel: "Australia" },
  { value: "es-LA", label: "Español (LA)",    flag: "🇲🇽", sublabel: "Latinoamérica" },
];

// ── Profile Tab ───────────────────────────────────────────────────────────────
function ProfileTab() {
  const { user, workspace } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState(user?.name ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingLocale, setSavingLocale] = useState(false);
  const [copied, setCopied] = useState(false);
  const currentLocale = user?.locale ?? "pt-BR";

  useEffect(() => { setName(user?.name ?? ""); }, [user?.name]);

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSavingProfile(true);
    try {
      await customFetch("/api/workspaces/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      toast.success("Nome atualizado com sucesso.");
      queryClient.setQueryData(getGetMeQueryKey(), (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        const prev = old as Record<string, unknown>;
        return { ...prev, user: { ...(prev.user as Record<string, unknown>), name: name.trim() } };
      });
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    } catch {
      toast.error("Erro ao salvar nome.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSetLocale = async (locale: Locale) => {
    if (locale === currentLocale || savingLocale) return;
    setSavingLocale(true);
    queryClient.setQueryData(getGetMeQueryKey(), (old: unknown) => {
      if (!old || typeof old !== "object") return old;
      const prev = old as Record<string, unknown>;
      return { ...prev, user: { ...(prev.user as Record<string, unknown>), locale } };
    });
    try {
      await customFetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      toast.success("Idioma atualizado com sucesso.");
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    } catch {
      queryClient.setQueryData(getGetMeQueryKey(), (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        const prev = old as Record<string, unknown>;
        return { ...prev, user: { ...(prev.user as Record<string, unknown>), locale: currentLocale } };
      });
      toast.error("Erro ao salvar idioma.");
    } finally {
      setSavingLocale(false);
    }
  };

  const copyId = () => {
    if (!workspace?.id) return;
    void navigator.clipboard.writeText(workspace.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <SectionCard title="Informações Pessoais" icon={User}>
        <FieldRow label="Avatar" sublabel="Identificação visual">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-sm border border-primary/30 bg-primary/10 flex items-center justify-center relative">
              <img src={nexosLogo} alt="" className="w-10 h-10 object-contain opacity-30" />
              <span className="absolute font-mono font-bold text-xl text-primary">
                {(user?.name ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
              </span>
            </div>
            <div>
              <div className="font-mono text-sm text-foreground/80">{user?.name ?? "—"}</div>
              <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider mt-0.5">{user?.email}</div>
            </div>
          </div>
        </FieldRow>

        <FieldRow label="Nome Completo" sublabel="Exibido na plataforma">
          <div className="flex gap-3">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="font-mono h-10 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary focus-visible:border-primary flex-1"
              placeholder="Seu nome"
            />
            <Button
              onClick={() => void handleSaveName()}
              disabled={savingProfile || name.trim() === (user?.name ?? "")}
              className="rounded-none font-mono uppercase text-xs tracking-widest h-10 px-4 btn-weapon-primary shrink-0"
            >
              {savingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </FieldRow>

        <FieldRow label="E-mail" sublabel="Não editável">
          <div className="font-mono text-sm text-muted-foreground h-10 flex items-center px-3 border border-border/30 bg-muted/10">
            {user?.email ?? "—"}
          </div>
        </FieldRow>

        <FieldRow label="Idioma" sublabel="Idioma da plataforma">
          <div className="flex flex-wrap gap-2">
            {LOCALE_OPTIONS.map(opt => {
              const isActive = currentLocale === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => void handleSetLocale(opt.value)}
                  disabled={savingLocale}
                  className={`flex items-center gap-2.5 px-3 py-2 border font-mono text-xs transition-all rounded-none ${
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/40 bg-background/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  <span className="text-base leading-none">{opt.flag}</span>
                  <div className="text-left">
                    <div className="font-semibold leading-tight">{opt.label}</div>
                    <div className="text-[10px] uppercase tracking-wider opacity-60">{opt.sublabel}</div>
                  </div>
                  {isActive && (
                    savingLocale
                      ? <Loader2 className="h-3 w-3 animate-spin ml-1" />
                      : <CheckCircle2 className="h-3 w-3 text-primary ml-1" />
                  )}
                </button>
              );
            })}
          </div>
          <p className="font-mono text-[11px] text-muted-foreground/50 mt-2 uppercase tracking-widest">
            <Globe className="inline h-3 w-3 mr-1 opacity-60" />
            Define o idioma das cópias e relatórios gerados pelo agente
          </p>
        </FieldRow>
      </SectionCard>

      <SectionCard title="Identificadores" icon={CreditCard}>
        <FieldRow label="Workspace ID" sublabel="Identificador único da sua conta">
          <div className="flex gap-3 items-center">
            <code className="font-mono text-xs text-muted-foreground bg-muted/20 border border-border/30 px-3 py-2 flex-1 truncate">
              {workspace?.id ?? "—"}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={copyId}
              className="rounded-none border-border/50 h-9 w-9 shrink-0 hover:border-primary/50"
            >
              {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </FieldRow>

        <FieldRow label="Função" sublabel="Perfil de acesso">
          <Badge variant="outline" className="rounded-none font-mono text-xs uppercase tracking-widest text-primary border-primary/40 bg-primary/10">
            Lançador
          </Badge>
        </FieldRow>
      </SectionCard>
    </div>
  );
}

// ── Workspace Tab ─────────────────────────────────────────────────────────────
function WorkspaceTab() {
  const { workspace, plan } = useAuth();
  const queryClient = useQueryClient();
  const [wsName, setWsName] = useState(workspace?.name ?? "");
  const [saving, setSaving] = useState(false);

  const { data: creditsData } = useGetCreditsBalance({
    query: { queryKey: getGetCreditsBalanceQueryKey() },
  });

  const { data: plansData } = useQuery({
    queryKey: ["/api/plans"],
    queryFn: async () => {
      return customFetch<{ plans: { id: string; name: string; slug: string; priceMonthlyBrl: string; creditsMonthly: number; maxCampaigns: number; whiteLabel: boolean }[] }>("/api/plans")
        .catch(() => ({ plans: [] as { id: string; name: string; slug: string; priceMonthlyBrl: string; creditsMonthly: number; maxCampaigns: number; whiteLabel: boolean }[] }));
    },
  });

  useEffect(() => { setWsName(workspace?.name ?? ""); }, [workspace?.name]);

  const handleSave = async () => {
    if (!wsName.trim()) return;
    setSaving(true);
    try {
      await customFetch<unknown>("/api/workspaces/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: wsName.trim() }),
      });
      toast.success("Workspace atualizado.");
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    } catch {
      toast.error("Erro ao atualizar workspace.");
    } finally {
      setSaving(false);
    }
  };

  const usedPct = plan?.creditsMonthly
    ? Math.min(100, Math.round(((plan.creditsMonthly - (creditsData?.balance ?? 0)) / plan.creditsMonthly) * 100))
    : 0;
  const remaining = creditsData?.balance ?? 0;
  const total = plan?.creditsMonthly ?? 0;

  return (
    <div className="space-y-6">
      <SectionCard title="Configurações do Workspace" icon={Building2}>
        <FieldRow label="Nome do Workspace" sublabel="Nome da sua operação">
          <div className="flex gap-3">
            <Input
              value={wsName}
              onChange={(e) => setWsName(e.target.value)}
              className="font-mono h-10 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary focus-visible:border-primary flex-1"
              placeholder="Nome da sua empresa"
            />
            <Button
              onClick={() => void handleSave()}
              disabled={saving || wsName.trim() === (workspace?.name ?? "")}
              className="rounded-none font-mono uppercase text-xs tracking-widest h-10 px-4 btn-weapon-primary shrink-0"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </FieldRow>

        <FieldRow label="Plano Atual" sublabel="Seu plano de assinatura">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="rounded-none font-mono text-xs uppercase tracking-widest text-primary border-primary/40 bg-primary/10">
              {plan?.name ?? "—"}
            </Badge>
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              {total > 0 ? `${total} créditos/mês` : ""}
            </span>
          </div>
        </FieldRow>

        <FieldRow label="Créditos do agente" sublabel="Uso do mês atual">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-mono text-2xl font-bold text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.4)]">
                {remaining.toLocaleString("pt-BR")}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                de {total.toLocaleString("pt-BR")} cr
              </span>
            </div>
            <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${100 - usedPct}%`,
                  background: remaining < total * 0.1
                    ? "hsl(var(--destructive))"
                    : remaining < total * 0.3
                    ? "hsl(45 100% 50%)"
                    : "hsl(var(--primary))",
                  boxShadow: "0 0 6px hsl(var(--primary) / 0.4)",
                }}
              />
            </div>
            <div className="flex justify-between">
              <span className="font-mono text-xs text-muted-foreground">{usedPct}% utilizado</span>
              {remaining < total * 0.15 && (
                <span className="font-mono text-xs text-destructive animate-pulse">⚠ Créditos baixos</span>
              )}
            </div>
          </div>
        </FieldRow>
      </SectionCard>

      {plansData?.plans && plansData.plans.length > 0 && (
        <SectionCard title="Planos Disponíveis" icon={Zap}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plansData.plans.map((p) => {
              const isCurrent = p.slug === plan?.slug;
              return (
                <div
                  key={p.id}
                  className={`border p-4 relative transition-all ${
                    isCurrent
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/40 bg-card/40 hover:border-primary/20"
                  }`}
                >
                  {isCurrent && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />
                  )}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-mono font-bold text-sm uppercase tracking-widest">{p.name}</div>
                      <div className="font-mono text-xs text-muted-foreground mt-0.5">
                        R$ {parseFloat(p.priceMonthlyBrl).toLocaleString("pt-BR")} — acesso único
                      </div>
                    </div>
                    {isCurrent && (
                      <Badge variant="outline" className="rounded-none font-mono text-[11px] uppercase tracking-widest text-primary border-primary/40 bg-primary/10">
                        Ativo
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1.5 mb-4">
                    {[
                      `${p.creditsMonthly.toLocaleString("pt-BR")} créditos incluídos`,
                      `${p.maxCampaigns} campanhas simultâneas`,
                      ...(p.whiteLabel ? ["White-label incluso"] : []),
                    ].map((feat) => (
                      <div key={feat} className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                        {feat}
                      </div>
                    ))}
                  </div>
                  {!isCurrent && (
                    <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-xs tracking-widest w-full btn-weapon-outline">
                      <ExternalLink className="h-3 w-3 mr-1.5" />
                      Mudar para este plano
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ── Security Tab ──────────────────────────────────────────────────────────────
function SecurityTab() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [saving, setSaving] = useState(false);

  const strength = next.length === 0 ? 0 : next.length < 6 ? 1 : next.length < 10 ? 2 : next.length < 14 ? 3 : 4;
  const strengthLabel = ["", "Fraca", "Razoável", "Boa", "Forte"][strength];
  const strengthColor = ["", "bg-destructive", "bg-yellow-400", "bg-primary", "bg-success"][strength];

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) { toast.error("As senhas não coincidem."); return; }
    if (next.length < 8) { toast.error("Senha deve ter ao menos 8 caracteres."); return; }
    setSaving(true);
    try {
      await customFetch<unknown>("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      toast.success("Senha alterada com sucesso.");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar senha.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard title="Alterar Senha" icon={ShieldCheck}>
        <form onSubmit={(e) => void handleChange(e)} className="space-y-0">
          <FieldRow label="Senha Atual" sublabel="Para confirmar identidade">
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="font-mono h-10 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary focus-visible:border-primary pr-10"
                placeholder="••••••••"
                required
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FieldRow>

          <FieldRow label="Nova Senha" sublabel="Mínimo 8 caracteres">
            <div className="space-y-2">
              <div className="relative">
                <Input
                  type={showNext ? "text" : "password"}
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  className="font-mono h-10 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary focus-visible:border-primary pr-10"
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
                <button type="button" onClick={() => setShowNext(!showNext)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {next.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= strength ? strengthColor : "bg-muted/30"}`} />
                    ))}
                  </div>
                  <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">{strengthLabel}</span>
                </div>
              )}
            </div>
          </FieldRow>

          <FieldRow label="Confirmar Senha" sublabel="Repita a nova senha">
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={`font-mono h-10 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary focus-visible:border-primary ${
                confirm && confirm !== next ? "border-destructive/60" : ""
              }`}
              placeholder="••••••••"
              required
            />
            {confirm && confirm !== next && (
              <p className="font-mono text-xs text-destructive mt-1">As senhas não coincidem.</p>
            )}
          </FieldRow>

          <div className="pt-4">
            <Button
              type="submit"
              disabled={saving || !current || !next || !confirm || next !== confirm}
              className="rounded-none font-mono uppercase text-xs tracking-widest h-10 px-6 btn-weapon-primary"
            >
              {saving ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Alterando...</> : "Alterar Senha"}
            </Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Sessão Ativa" icon={ShieldCheck}>
        <FieldRow label="Token JWT" sublabel="Autenticação atual">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" style={{ boxShadow: "0 0 8px hsl(var(--success))" }} />
            <span className="font-mono text-xs text-muted-foreground">Sessão autenticada via JWT · Expira em 15 min (auto-renovado)</span>
          </div>
        </FieldRow>
        <FieldRow label="Refresh Token" sublabel="Renovação automática">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-mono text-xs text-muted-foreground">Válido por 30 dias · Armazenado localmente</span>
          </div>
        </FieldRow>
      </SectionCard>
    </div>
  );
}

// ── Integrations Tab ──────────────────────────────────────────────────────────

type IntegrationProvider =
  | "meta_ads" | "instagram" | "tiktok" | "tiktok_ads" | "google_ads"
  | "whatsapp_business" | "telegram" | "stripe" | "hotmart"
  | "eduzz" | "kiwify" | "asaas" | "mailchimp" | "activecampaign" | "rd_station" | "hubspot"
  | "resend" | "crypto_native" | "custom_webhook";

interface WorkspaceIntegration {
  id: string;
  provider: IntegrationProvider;
  status: "connected" | "disconnected" | "error";
  accountId?: string;
  accountName?: string;
  isPaymentGateway: boolean;
  blocksExecution: boolean;
  createdAt: string;
}

interface ConnectModalState {
  provider: IntegrationProvider;
  label: string;
}

const INTEGRATION_CATALOG: {
  provider: IntegrationProvider;
  label: string;
  description: string;
  category: string;
  color: string;
  fields: { key: string; label: string; placeholder: string; type?: string }[];
}[] = [
  {
    provider: "whatsapp_business",
    label: "WhatsApp Business",
    description: "Disparo automatizado de mensagens e auto-resposta com o agente",
    category: "Mensagens",
    color: "text-green-400",
    fields: [
      { key: "accountId", label: "Phone Number ID", placeholder: "123456789012345" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Minha Empresa" },
      { key: "accessToken", label: "Access Token (Meta)", placeholder: "EAAxxxx...", type: "password" },
    ],
  },
  {
    provider: "rd_station",
    label: "RD Station",
    description: "E-mail marketing e automação de leads integrados ao lançamento",
    category: "E-mail",
    color: "text-blue-400",
    fields: [
      { key: "accountId", label: "Client ID", placeholder: "seu-client-id" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Workspace RD" },
      { key: "accessToken", label: "API Token", placeholder: "rdst_xxxx...", type: "password" },
    ],
  },
  {
    provider: "activecampaign",
    label: "ActiveCampaign",
    description: "CRM e automação de e-mail com segmentação avançada",
    category: "E-mail",
    color: "text-blue-400",
    fields: [
      { key: "accountId", label: "Account Name", placeholder: "minhaempresa" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Minha AC" },
      { key: "accessToken", label: "API Key", placeholder: "xxxxxx...", type: "password" },
    ],
  },
  {
    provider: "asaas",
    label: "Asaas",
    description: "Checkout próprio · PIX · Boleto · Cartão · sem comissão de plataforma",
    category: "Pagamentos",
    color: "text-blue-400",
    fields: [
      { key: "accessToken", label: "API Key do Asaas", placeholder: "$aact_prod_xxxx...", type: "password" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Minha Empresa" },
      { key: "accountId",   label: "Ambiente (production/sandbox)", placeholder: "production" },
    ],
  },
  {
    provider: "hotmart",
    label: "Hotmart",
    description: "Plataforma de produtos digitais — webhooks de venda automáticos",
    category: "Pagamentos",
    color: "text-orange-400",
    fields: [
      { key: "accountId", label: "Client ID", placeholder: "hotmart-client-id" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Hotmart Workspace" },
      { key: "webhookUrl", label: "Webhook URL (gerada pelo sistema)", placeholder: "Auto-gerada" },
    ],
  },
  {
    provider: "kiwify",
    label: "Kiwify",
    description: "Checkout e gestão de produtos digitais — auto-conversão de leads",
    category: "Pagamentos",
    color: "text-orange-400",
    fields: [
      { key: "accountId", label: "Account ID", placeholder: "kiwify-account-id" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Minha Kiwify" },
      { key: "accessToken", label: "API Key", placeholder: "kwf_xxxx...", type: "password" },
    ],
  },
  {
    provider: "stripe",
    label: "Stripe",
    description: "Processamento de pagamentos internacionais",
    category: "Pagamentos",
    color: "text-purple-400",
    fields: [
      { key: "accountId", label: "Account ID", placeholder: "acct_xxxx" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Stripe Workspace" },
      { key: "accessToken", label: "Secret Key", placeholder: "sk_live_xxxx...", type: "password" },
    ],
  },
  {
    provider: "meta_ads",
    label: "Meta Ads",
    description: "Facebook e Instagram Ads — gestão e otimização de campanhas",
    category: "Mídia Paga",
    color: "text-cyan-400",
    fields: [
      { key: "accountId", label: "Ad Account ID", placeholder: "act_123456789" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Minha Conta Ads" },
      { key: "accessToken", label: "Access Token", placeholder: "EAAxxxx...", type: "password" },
    ],
  },
  {
    provider: "google_ads",
    label: "Google Ads",
    description: "Campanhas de pesquisa e display no Google",
    category: "Mídia Paga",
    color: "text-cyan-400",
    fields: [
      { key: "accountId", label: "Customer ID", placeholder: "123-456-7890" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Google Ads" },
      { key: "accessToken", label: "Developer Token", placeholder: "xxxx...", type: "password" },
    ],
  },
  {
    provider: "telegram",
    label: "Telegram",
    description: "Bot de automação e notificações via canal do Telegram",
    category: "Mensagens",
    color: "text-sky-400",
    fields: [
      { key: "accountId", label: "Bot Token", placeholder: "1234567890:AAFxxxx..." },
      { key: "accountName", label: "Nome do Bot", placeholder: "@meubot" },
    ],
  },
  {
    provider: "hubspot",
    label: "HubSpot",
    description: "CRM e pipeline de vendas integrado com campanhas",
    category: "CRM",
    color: "text-orange-300",
    fields: [
      { key: "accountId", label: "Portal ID", placeholder: "12345678" },
      { key: "accountName", label: "Nome da Conta", placeholder: "HubSpot CRM" },
      { key: "accessToken", label: "Private App Token", placeholder: "pat-xxxx...", type: "password" },
    ],
  },
  {
    provider: "tiktok",
    label: "TikTok",
    description: "Auto-post de vídeos orgânicos e reels no TikTok sincronizados ao calendário de lançamento",
    category: "Social Orgânico",
    color: "text-pink-400",
    fields: [
      { key: "accountId", label: "TikTok Account ID", placeholder: "6912345678901234567" },
      { key: "accountName", label: "Nome da Conta", placeholder: "@meucanal" },
      { key: "accessToken", label: "Access Token", placeholder: "act.xxxx...", type: "password" },
    ],
  },
  {
    provider: "tiktok_ads",
    label: "TikTok Ads",
    description: "Gestão de campanhas pagas no TikTok — anúncios sincronizados ao lançamento",
    category: "Mídia Paga",
    color: "text-pink-400",
    fields: [
      { key: "accountId", label: "Advertiser ID", placeholder: "6912345678901234567" },
      { key: "accountName", label: "Nome da Conta", placeholder: "TikTok Ads" },
      { key: "accessToken", label: "Access Token", placeholder: "act.xxxx...", type: "password" },
    ],
  },
  {
    provider: "instagram",
    label: "Instagram",
    description: "Auto-post de conteúdo orgânico e stories sincronizados ao calendário de lançamento",
    category: "Social Orgânico",
    color: "text-pink-300",
    fields: [
      { key: "accountId", label: "Instagram Account ID", placeholder: "17841400000000000" },
      { key: "accountName", label: "Nome da Conta", placeholder: "@meucanal" },
      { key: "accessToken", label: "Access Token (Meta)", placeholder: "EAAxxxx...", type: "password" },
    ],
  },
  {
    provider: "resend",
    label: "Resend",
    description: "E-mail transacional e broadcast de alta entregabilidade via Resend",
    category: "E-mail",
    color: "text-violet-400",
    fields: [
      { key: "accountId", label: "Audience ID (Resend)", placeholder: "78261eea-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Meu Workspace Resend" },
      { key: "accessToken", label: "API Key", placeholder: "re_xxxx...", type: "password" },
    ],
  },
  {
    provider: "heygen" as IntegrationProvider,
    label: "HeyGen",
    description: "Avatar IA realista com lip-sync — use sua própria chave para custo reduzido",
    category: "Geração de Vídeo",
    color: "text-violet-400",
    fields: [
      { key: "accessToken", label: "API Key do HeyGen", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", type: "password" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Meu HeyGen" },
    ],
  },
  {
    provider: "runway_ml" as IntegrationProvider,
    label: "Runway ML",
    description: "Geração de clipes de vídeo IA de alta qualidade — sua conta, seu custo",
    category: "Geração de Vídeo",
    color: "text-green-400",
    fields: [
      { key: "accessToken", label: "API Key do Runway", placeholder: "rw_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", type: "password" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Meu Runway" },
    ],
  },
  {
    provider: "kling_fal" as IntegrationProvider,
    label: "Kling via fal.ai",
    description: "Geração de vídeo Kling v1.6 via fal.ai — alternativa ao Runway",
    category: "Geração de Vídeo",
    color: "text-blue-400",
    fields: [
      { key: "accessToken", label: "API Key do fal.ai", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:xxxxxxxxxxxxxxxx", type: "password" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Meu fal.ai" },
    ],
  },
  {
    provider: "elevenlabs" as IntegrationProvider,
    label: "ElevenLabs",
    description: "Clonagem de voz e narração IA — sua voz, sua conta",
    category: "Geração de Vídeo",
    color: "text-yellow-400",
    fields: [
      { key: "accessToken", label: "API Key do ElevenLabs", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", type: "password" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Meu ElevenLabs" },
    ],
  },
];

const CATEGORIES = ["Mensagens", "E-mail", "Pagamentos", "Mídia Paga", "Social Orgânico", "CRM", "Geração de Vídeo"];

function ConnectModal({
  info,
  onClose,
  onConnect,
}: {
  info: ConnectModalState;
  onClose: () => void;
  onConnect: (provider: IntegrationProvider, fields: Record<string, string>) => void;
}) {
  const catalog = INTEGRATION_CATALOG.find(c => c.provider === info.provider);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  if (!catalog) return null;

  const handleConnect = async () => {
    setLoading(true);
    try { onConnect(info.provider, fields); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="border border-border/70 bg-card w-full max-w-md shadow-2xl">
        <div className="border-b border-border/50 px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-mono font-bold text-sm uppercase tracking-wide">Conectar {catalog.label}</h3>
            <p className="text-xs font-mono text-muted-foreground/60 mt-0.5">{catalog.description}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground font-mono text-lg leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          {catalog.fields.map(f => (
            <div key={f.key} className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/70">{f.label}</label>
              <input
                type={f.type ?? "text"}
                placeholder={f.placeholder}
                value={fields[f.key] ?? ""}
                onChange={e => setFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full bg-background border border-border/50 px-3 py-2.5 text-sm font-mono rounded-none focus:outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/30"
              />
            </div>
          ))}
          <div className="bg-muted/10 border border-border/20 p-3">
            <p className="font-mono text-[11px] text-muted-foreground/50 leading-relaxed">
              As credenciais são armazenadas de forma segura e criptografadas. Nunca compartilhamos com terceiros.
              Pagamentos nunca bloqueiam execução de campanhas.
            </p>
          </div>
        </div>
        <div className="border-t border-border/50 px-5 py-4 flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline">Cancelar</Button>
          <Button onClick={handleConnect} disabled={loading}
            className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-primary gap-2">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
            Conectar
          </Button>
        </div>
      </div>
    </div>
  );
}

function IntegracaoTab() {
  const queryClient = useQueryClient();
  const [connectModal, setConnectModal] = useState<ConnectModalState | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("Todos");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/workspaces/me/integrations"],
    queryFn: async () => {
      return customFetch<{ integrations: WorkspaceIntegration[] }>("/api/workspaces/me/integrations")
        .catch(() => ({ integrations: [] as WorkspaceIntegration[] }));
    },
  });

  const connectMutation = useMutation({
    mutationFn: async ({
      provider, accountId, accountName, webhookUrl, metadata,
    }: { provider: IntegrationProvider; accountId?: string; accountName?: string; webhookUrl?: string; metadata?: Record<string, unknown> }) => {
      return customFetch<unknown>("/api/workspaces/me/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, accountId, accountName, webhookUrl, metadata }),
      });
    },
    onSuccess: () => {
      toast.success("Integração conectada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/me/integrations"] });
      setConnectModal(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const integrations = data?.integrations ?? [];
  const connectedProviders = new Set(integrations.map(i => i.provider));

  const handleConnect = (provider: IntegrationProvider, fields: Record<string, string>) => {
    const { accountId, accountName, webhookUrl, accessToken, ...rest } = fields;
    const metadata: Record<string, unknown> = { ...rest };
    if (accessToken) metadata["accessToken"] = accessToken;
    connectMutation.mutate({
      provider,
      accountId: accountId || undefined,
      accountName: accountName || undefined,
      webhookUrl: webhookUrl || undefined,
      metadata,
    });
  };

  const filtered = activeCategory === "Todos"
    ? INTEGRATION_CATALOG
    : INTEGRATION_CATALOG.filter(c => c.category === activeCategory);

  return (
    <div className="space-y-6">
      {connectModal && (
        <ConnectModal
          info={connectModal}
          onClose={() => setConnectModal(null)}
          onConnect={handleConnect}
        />
      )}

      {/* Connected integrations */}
      {integrations.length > 0 && (
        <SectionCard title={`${integrations.length} Integração${integrations.length > 1 ? "ões" : ""} Ativa${integrations.length > 1 ? "s" : ""}`} icon={Wifi}>
          <div className="space-y-2">
            {integrations.map(intg => {
              const catalog = INTEGRATION_CATALOG.find(c => c.provider === intg.provider);
              return (
                <div key={intg.id} className="flex items-center justify-between py-2.5 border-b border-border/20 last:border-0 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${intg.status === "connected" ? "bg-success animate-pulse" : intg.status === "error" ? "bg-destructive" : "bg-muted-foreground/30"}`} />
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-bold truncate">{catalog?.label ?? intg.provider}</div>
                      {intg.accountName && <div className="font-mono text-xs text-muted-foreground/60 truncate">{intg.accountName}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {intg.isPaymentGateway && (
                      <Badge variant="outline" className="rounded-none font-mono text-[11px] border-orange-400/30 text-orange-400">Pagamento</Badge>
                    )}
                    <Badge variant="outline" className={`rounded-none font-mono text-[11px] ${intg.status === "connected" ? "border-success/40 text-success" : intg.status === "error" ? "border-destructive/40 text-destructive" : "border-border/40 text-muted-foreground"}`}>
                      {intg.status === "connected" ? "Conectado" : intg.status === "error" ? "Erro" : "Desconectado"}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
          {integrations.some(i => i.isPaymentGateway) && (
            <div className="mt-4 flex items-center gap-2 text-[11px] font-mono text-muted-foreground/50">
              <AlertTriangle className="h-3 w-3" />
              Gateways de pagamento nunca bloqueiam execução de campanhas
            </div>
          )}
        </SectionCard>
      )}

      {/* Category filter */}
      <div className="flex gap-1 border-b border-border/40 overflow-x-auto">
        {["Todos", ...CATEGORIES].map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`px-3 py-2 text-[11px] font-mono uppercase tracking-widest transition-all border-b-2 whitespace-nowrap
              ${activeCategory === cat ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Integration catalog */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 bg-muted/20" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(intg => {
            const isConnected = connectedProviders.has(intg.provider);
            const existing = integrations.find(i => i.provider === intg.provider);
            return (
              <div key={intg.provider}
                className={`border bg-card/30 p-4 relative transition-all ${isConnected ? "border-success/30 bg-success/5" : "border-border/50 hover:border-primary/30"}`}>
                {isConnected && (
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  </div>
                )}
                <div className="mb-3">
                  <div className={`font-mono font-bold text-sm mb-0.5 ${intg.color}`}>{intg.label}</div>
                  <div className="text-[11px] font-mono text-muted-foreground/50 uppercase tracking-widest mb-1">{intg.category}</div>
                  <p className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed">{intg.description}</p>
                </div>
                {isConnected ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-success" />
                    <span className="font-mono text-xs text-success">
                      {existing?.accountName ? `Conectado: ${existing.accountName}` : "Conectado"}
                    </span>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConnectModal({ provider: intg.provider, label: intg.label })}
                    className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 btn-weapon-outline"
                  >
                    <Plus className="h-2.5 w-2.5" />Conectar
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Settings() {
  const initialTab = (): Tab => {
    try {
      const params = new URLSearchParams(window.location.search);
      const t = params.get("tab") as Tab | null;
      if (t && TABS.some((x) => x.id === t)) return t;
    } catch { /* ignore */ }
    return "perfil";
  };
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="border-b border-border/50 pb-5">
        <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold text-foreground">
          Configurações
        </h1>
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-1">
          Perfil · Workspace · Segurança · Integrações
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border border-border/40 bg-card/30 p-0.5 w-full overflow-x-auto scrollbar-none">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 font-mono text-[10px] sm:text-xs uppercase tracking-widest transition-all flex-1 justify-center whitespace-nowrap
                ${active
                  ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.3)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {tab === "perfil"      && <ProfileTab />}
      {tab === "workspace"   && <WorkspaceTab />}
      {tab === "seguranca"   && <SecurityTab />}
      {tab === "integracoes" && <IntegracaoTab />}
    </div>
  );
}
