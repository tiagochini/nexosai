import { useState, useEffect, useRef, useCallback } from "react";
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
  Mic, Square, Upload, Fingerprint, Wand2,
  Headphones, Camera, Sparkles, Video, UserCheck, UserX, ChevronRight, Trash2,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import nexosLogo from "/nexos-logo.png";
import { useLocation } from "wouter";
import { AutonomyTab } from "@/components/AutonomyTab";

type Tab = "perfil" | "workspace" | "seguranca" | "integracoes" | "identidade" | "compliance" | "autonomia";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "perfil",       label: "Perfil",          icon: User        },
  { id: "workspace",    label: "Workspace",       icon: Building2   },
  { id: "autonomia",    label: "Autonomia IA",    icon: ShieldCheck },
  { id: "compliance",   label: "Identificação",   icon: ShieldCheck },
  { id: "seguranca",    label: "Segurança",       icon: Zap         },
  { id: "integracoes",  label: "Integrações",     icon: Link2       },
  { id: "identidade",   label: "Identidade",      icon: Fingerprint },
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

function FieldRow({ label, sublabel, children }: { label: string; sublabel?: React.ReactNode; children: React.ReactNode }) {
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

        <FieldRow label="Plano Atual" sublabel="Acesso vitalício · pagamento único">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="rounded-none font-mono text-xs uppercase tracking-widest text-primary border-primary/40 bg-primary/10">
              {plan?.name ?? "—"}
            </Badge>
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              {total > 0 ? `${total} créditos incluídos` : ""}
            </span>
          </div>
        </FieldRow>

        <FieldRow label="Créditos do agente" sublabel="Saldo disponível">
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
  | "meta_ads" | "instagram" | "facebook" | "tiktok" | "tiktok_ads" | "google_ads" | "linkedin_ads"
  | "whatsapp_business" | "telegram"
  | "stripe" | "paypal" | "mercado_pago" | "pagarme" | "asaas"
  | "hotmart" | "eduzz" | "kiwify"
  | "mailchimp" | "activecampaign" | "rd_station" | "resend" | "hubspot"
  | "crypto_native" | "custom_webhook";

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
  // Checkout / payment gateways
  {
    provider: "stripe",
    label: "Stripe",
    description: "Checkout internacional · Cartão · PIX · Recorrência · alta conversão",
    category: "Checkout",
    color: "text-violet-400",
    fields: [
      { key: "accessToken", label: "Secret Key", placeholder: "sk_live_xxxx...", type: "password" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Minha Empresa" },
      { key: "accountId",   label: "Stripe Account ID (opcional)", placeholder: "acct_xxxx" },
    ],
  },
  {
    provider: "paypal",
    label: "PayPal",
    description: "Checkout internacional · aceito em 200+ países",
    category: "Checkout",
    color: "text-blue-500",
    fields: [
      { key: "accountId",   label: "Client ID", placeholder: "AcXxxxx..." },
      { key: "accessToken", label: "Client Secret", placeholder: "EJxxx...", type: "password" },
      { key: "accountName", label: "Email / Nome da Conta", placeholder: "pagamentos@empresa.com" },
    ],
  },
  {
    provider: "mercado_pago",
    label: "Mercado Pago",
    description: "PIX · Boleto · Cartão · maior gateway da América Latina",
    category: "Checkout",
    color: "text-cyan-400",
    fields: [
      { key: "accessToken", label: "Access Token", placeholder: "APP_USR-xxxx...", type: "password" },
      { key: "accountId",   label: "Public Key", placeholder: "APP_USR-xxxx..." },
      { key: "accountName", label: "Nome da Conta", placeholder: "Minha Loja" },
    ],
  },
  {
    provider: "pagarme",
    label: "Pagar.me",
    description: "Gateway brasileiro (Stone) · PIX · Boleto · Cartão · Split",
    category: "Checkout",
    color: "text-green-400",
    fields: [
      { key: "accessToken", label: "Secret Key", placeholder: "sk_live_xxxx...", type: "password" },
      { key: "accountId",   label: "Public Key", placeholder: "pk_live_xxxx..." },
      { key: "accountName", label: "Nome da Conta", placeholder: "Minha Empresa" },
    ],
  },
  {
    provider: "asaas",
    label: "Asaas",
    description: "Checkout próprio · PIX · Boleto · Cartão · sem comissão de plataforma",
    category: "Checkout",
    color: "text-blue-400",
    fields: [
      { key: "accessToken", label: "API Key do Asaas", placeholder: "$aact_prod_xxxx...", type: "password" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Minha Empresa" },
      { key: "accountId",   label: "Ambiente (production/sandbox)", placeholder: "production" },
    ],
  },
  // Product platforms
  {
    provider: "hotmart",
    label: "Hotmart",
    description: "Plataforma de produtos digitais — webhooks de venda automáticos",
    category: "Plataformas",
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
    description: "Plataforma de checkout e gestão de produtos — auto-conversão de leads",
    category: "Plataformas",
    color: "text-orange-400",
    fields: [
      { key: "accountId", label: "Account ID", placeholder: "kiwify-account-id" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Minha Kiwify" },
      { key: "accessToken", label: "API Key", placeholder: "kwf_xxxx...", type: "password" },
    ],
  },
  {
    provider: "eduzz",
    label: "Eduzz",
    description: "Plataforma brasileira de infoprodutos — compra dispara automação em tempo real",
    category: "Plataformas",
    color: "text-orange-400",
    fields: [
      { key: "accountId",   label: "API Key (Public)", placeholder: "xxxx" },
      { key: "accessToken", label: "API Key (Private)", placeholder: "xxxx...", type: "password" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Minha Conta Eduzz" },
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
];

const CATEGORIES = ["Mensagens", "E-mail", "Checkout", "Plataformas", "Mídia Paga", "Social Orgânico", "CRM"];

// Social providers that connect via OAuth (not manual token entry)
const SOCIAL_OAUTH_PROVIDERS: Partial<Record<IntegrationProvider, "meta" | "tiktok">> = {
  meta_ads: "meta",
  instagram: "meta",
  tiktok_ads: "tiktok",
  tiktok: "tiktok",
};

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

// ── Compliance / Full Identification Tab ──────────────────────────────────────

type ComplianceData = {
  cpf?: string; phone?: string; whatsapp?: string; birthdate?: string;
  nationality?: string; maritalStatus?: string; gender?: string;
  personType?: "pf" | "pj"; cnpj?: string; razaoSocial?: string;
  nomeFantasia?: string; inscEstadual?: string;
  cep?: string; logradouro?: string; numero?: string; complemento?: string;
  bairro?: string; cidade?: string; estado?: string; pais?: string;
  consentDataProcessing?: boolean; consentDataProcessingAt?: string;
  consentMarketing?: boolean; consentMarketingAt?: string;
  consentAnalytics?: boolean; consentAnalyticsAt?: string;
  updatedAt?: string;
};

const STATES_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS",
  "MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC",
  "SP","SE","TO",
];

const MARITAL_OPTIONS = [
  { value: "single",    label: "Solteiro(a)" },
  { value: "married",   label: "Casado(a)"   },
  { value: "divorced",  label: "Divorciado(a)" },
  { value: "widowed",   label: "Viúvo(a)"    },
  { value: "other",     label: "Outro"        },
];

const GENDER_OPTIONS = [
  { value: "male",              label: "Masculino"          },
  { value: "female",            label: "Feminino"           },
  { value: "non_binary",        label: "Não-binário"        },
  { value: "prefer_not_to_say", label: "Prefiro não dizer"  },
];

function ComplianceStatusBadge({ data }: { data: ComplianceData }) {
  const filled = [data.cpf, data.phone, data.cidade, data.estado, data.consentDataProcessing ? "t" : ""].filter(Boolean).length;
  const total = 5;
  const pct = Math.round((filled / total) * 100);
  const color = pct === 100 ? "text-success border-success/40 bg-success/10"
              : pct >= 60 ? "text-yellow-400 border-yellow-400/30 bg-yellow-400/10"
              : "text-destructive border-destructive/30 bg-destructive/10";
  return (
    <div className={`border px-3 py-1.5 flex items-center gap-2 ${color}`}>
      <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      <span className="font-mono text-[10px] uppercase tracking-widest font-bold">
        {pct === 100 ? "Compliance Completo" : `${pct}% preenchido`}
      </span>
    </div>
  );
}

function ComplianceTab() {
  const queryClient = useQueryClient();
  const [data, setData] = useState<ComplianceData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  useEffect(() => {
    void customFetch<{ compliance: ComplianceData }>("/api/workspaces/me/compliance")
      .then(r => { setData(r.compliance ?? {}); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const set = (key: keyof ComplianceData, val: unknown) =>
    setData(prev => ({ ...prev, [key]: val }));

  const lookupCep = async () => {
    const raw = (data.cep ?? "").replace(/\D/g, "");
    if (raw.length !== 8) { toast.error("CEP inválido — 8 dígitos."); return; }
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      const j = await r.json() as { logradouro?: string; bairro?: string; localidade?: string; uf?: string; erro?: boolean };
      if (j.erro) { toast.error("CEP não encontrado."); return; }
      setData(prev => ({
        ...prev,
        logradouro: j.logradouro ?? prev.logradouro,
        bairro: j.bairro ?? prev.bairro,
        cidade: j.localidade ?? prev.cidade,
        estado: j.uf ?? prev.estado,
        pais: "BR",
      }));
      toast.success("Endereço preenchido automaticamente.");
    } catch { toast.error("Erro ao consultar CEP."); }
    finally { setCepLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await customFetch("/api/workspaces/me/compliance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      toast.success("Identificação salva com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/me/compliance"] });
    } catch { toast.error("Erro ao salvar identificação."); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-40 bg-muted/20 animate-pulse border border-border/20" />)}
    </div>
  );

  const fmtDate = (iso?: string) => iso ? new Date(iso).toLocaleDateString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }) : null;

  return (
    <div className="space-y-6">
      {/* Status header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-mono text-sm font-bold uppercase tracking-widest">Identificação Completa</h2>
          <p className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest mt-0.5">LGPD · KYC · Compliance Total</p>
        </div>
        <ComplianceStatusBadge data={data} />
      </div>

      {/* ── Dados Pessoais ── */}
      <SectionCard title="Dados Pessoais" icon={User}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">CPF</label>
            <input value={data.cpf ?? ""} onChange={e => set("cpf", e.target.value)}
              placeholder="000.000.000-00"
              className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">Telefone</label>
            <input value={data.phone ?? ""} onChange={e => set("phone", e.target.value)}
              placeholder="+55 11 99999-9999"
              className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">WhatsApp</label>
            <input value={data.whatsapp ?? ""} onChange={e => set("whatsapp", e.target.value)}
              placeholder="+55 11 99999-9999"
              className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">Data de Nascimento</label>
            <input type="date" value={data.birthdate ?? ""} onChange={e => set("birthdate", e.target.value)}
              className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none h-9" />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">Nacionalidade</label>
            <input value={data.nationality ?? ""} onChange={e => set("nationality", e.target.value)}
              placeholder="Brasileiro(a)"
              className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">Estado Civil</label>
            <select value={data.maritalStatus ?? ""} onChange={e => set("maritalStatus", e.target.value)}
              className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none h-9">
              <option value="">Selecione</option>
              {MARITAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">Gênero</label>
            <div className="flex flex-wrap gap-2">
              {GENDER_OPTIONS.map(o => (
                <button key={o.value} onClick={() => set("gender", data.gender === o.value ? "" : o.value)}
                  className={`border px-3 py-1.5 font-mono text-[10px] transition-all ${data.gender === o.value ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground/60 hover:border-primary/40"}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Dados Empresariais ── */}
      <SectionCard title="Dados Empresariais" icon={Building2}>
        <div className="space-y-4">
          <div className="flex gap-2">
            {[{ id:"pf", label:"Pessoa Física" }, { id:"pj", label:"Pessoa Jurídica" }].map(o => (
              <button key={o.id} onClick={() => set("personType", o.id)}
                className={`border px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-all ${data.personType === o.id ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground/60 hover:border-primary/40"}`}>
                {o.label}
              </button>
            ))}
          </div>

          {data.personType === "pj" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">CNPJ</label>
                <input value={data.cnpj ?? ""} onChange={e => set("cnpj", e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">Inscrição Estadual</label>
                <input value={data.inscEstadual ?? ""} onChange={e => set("inscEstadual", e.target.value)}
                  placeholder="Isento ou número"
                  className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">Razão Social</label>
                <input value={data.razaoSocial ?? ""} onChange={e => set("razaoSocial", e.target.value)}
                  placeholder="Nome na Receita Federal"
                  className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">Nome Fantasia</label>
                <input value={data.nomeFantasia ?? ""} onChange={e => set("nomeFantasia", e.target.value)}
                  placeholder="Nome comercial"
                  className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Endereço ── */}
      <SectionCard title="Endereço" icon={Globe}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1 md:col-span-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">CEP</label>
            <div className="flex gap-2">
              <input value={data.cep ?? ""} onChange={e => set("cep", e.target.value)}
                placeholder="00000-000" maxLength={9}
                className="flex-1 font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
              <button onClick={() => void lookupCep()} disabled={cepLoading}
                className="border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary font-mono text-[10px] uppercase tracking-widest px-3 h-9 shrink-0 flex items-center gap-1.5 transition-colors disabled:opacity-50">
                {cepLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Buscar
              </button>
            </div>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">Logradouro</label>
            <input value={data.logradouro ?? ""} onChange={e => set("logradouro", e.target.value)}
              placeholder="Rua, Av., Travessa…"
              className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">Número</label>
            <input value={data.numero ?? ""} onChange={e => set("numero", e.target.value)}
              placeholder="123"
              className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">Complemento</label>
            <input value={data.complemento ?? ""} onChange={e => set("complemento", e.target.value)}
              placeholder="Apto, Sala, Bloco…"
              className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">Bairro</label>
            <input value={data.bairro ?? ""} onChange={e => set("bairro", e.target.value)}
              placeholder="Nome do bairro"
              className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">Cidade</label>
            <input value={data.cidade ?? ""} onChange={e => set("cidade", e.target.value)}
              placeholder="São Paulo"
              className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">Estado</label>
            <select value={data.estado ?? ""} onChange={e => set("estado", e.target.value)}
              className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none h-9">
              <option value="">UF</option>
              {STATES_BR.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">País</label>
            <input value={data.pais ?? ""} onChange={e => set("pais", e.target.value)}
              placeholder="BR"
              className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
          </div>
        </div>
      </SectionCard>

      {/* ── LGPD / Consentimentos ── */}
      <SectionCard title="LGPD — Consentimentos" icon={ShieldCheck}>
        <div className="space-y-4">
          <div className="border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="font-mono text-[10px] text-muted-foreground/70 leading-relaxed">
              Em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018), registramos seus consentimentos de forma auditável com carimbo de data/hora. Você pode revogar qualquer consentimento a qualquer momento.
            </p>
          </div>

          {([
            {
              key: "consentDataProcessing" as const,
              atKey: "consentDataProcessingAt" as const,
              title: "Processamento de Dados",
              desc: "Autorizo o processamento dos meus dados pessoais para operação da plataforma NexOS AI conforme descrito na Política de Privacidade.",
              required: true,
            },
            {
              key: "consentMarketing" as const,
              atKey: "consentMarketingAt" as const,
              title: "Comunicações de Marketing",
              desc: "Autorizo o envio de comunicações sobre novidades, atualizações e ofertas da NexOS AI por e-mail e WhatsApp.",
              required: false,
            },
            {
              key: "consentAnalytics" as const,
              atKey: "consentAnalyticsAt" as const,
              title: "Analytics e Melhoria de Produto",
              desc: "Autorizo o uso de dados de uso da plataforma de forma anonimizada para melhoria dos produtos e serviços.",
              required: false,
            },
          ] as const).map(consent => {
            const granted = !!(data[consent.key]);
            const grantedAt = data[consent.atKey];
            return (
              <div key={consent.key} className={`border px-4 py-4 flex items-start gap-4 ${granted ? "border-success/30 bg-success/5" : "border-border/40 bg-card/20"}`}>
                <button
                  onClick={() => set(consent.key, !granted)}
                  className={`w-10 h-6 rounded-full border-2 relative transition-all shrink-0 mt-0.5 ${granted ? "bg-success border-success" : "bg-muted/30 border-border/50"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${granted ? "left-4" : "left-0.5"}`} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-mono text-[11px] font-bold uppercase tracking-widest ${granted ? "text-success" : "text-foreground/80"}`}>{consent.title}</span>
                    {consent.required && <span className="font-mono text-[9px] border border-destructive/30 text-destructive px-1.5 py-0.5 uppercase tracking-widest">Obrigatório</span>}
                    {granted && <span className="font-mono text-[9px] border border-success/30 text-success px-1.5 py-0.5 uppercase tracking-widest">Concedido</span>}
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground/60 mt-1 leading-relaxed">{consent.desc}</p>
                  {granted && grantedAt && (
                    <p className="font-mono text-[9px] text-muted-foreground/40 mt-1">
                      Consentido em: {fmtDate(grantedAt)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* ── Direitos do Titular ── */}
      <SectionCard title="Direitos do Titular (LGPD Art. 18)" icon={ExternalLink}>
        <div className="space-y-3">
          <p className="font-mono text-[10px] text-muted-foreground/60 leading-relaxed">
            Conforme o Art. 18 da LGPD, você tem o direito de solicitar acesso, portabilidade ou exclusão dos seus dados pessoais. Utilize os botões abaixo para formalizar sua solicitação.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: "Acessar meus dados",     icon: Eye,        subject: "Acesso aos Dados — LGPD Art. 18 II" },
              { label: "Portabilidade",           icon: Copy,       subject: "Portabilidade dos Dados — LGPD Art. 18 V" },
              { label: "Solicitar exclusão",      icon: XCircle,    subject: "Exclusão dos Dados — LGPD Art. 18 VI" },
            ].map(item => (
              <a key={item.label}
                href={`mailto:privacidade@nexos.ai?subject=${encodeURIComponent(item.subject)}&body=${encodeURIComponent(`Olá, solicito o exercício do meu direito de: ${item.subject}\n\nNome: ${""}\nWorkspace ID: `)}`}
                className="flex items-center gap-2 border border-border/40 bg-card/20 hover:border-primary/40 hover:bg-primary/5 px-4 py-3 transition-all group"
              >
                <item.icon className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 group-hover:text-primary transition-colors">{item.label}</span>
              </a>
            ))}
          </div>
          <p className="font-mono text-[9px] text-muted-foreground/30">
            Prazo de resposta: até 15 dias úteis conforme Art. 23 LGPD · privacidade@nexos.ai
          </p>
        </div>
      </SectionCard>

      {/* ── Last updated + Save ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {data.updatedAt && (
          <p className="font-mono text-[10px] text-muted-foreground/40">
            Última atualização: {fmtDate(data.updatedAt)}
          </p>
        )}
        <Button onClick={() => void handleSave()} disabled={saving}
          className="rounded-none font-mono uppercase tracking-widest text-xs h-10 px-6 btn-weapon-primary gap-2 ml-auto">
          {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Salvando…</> : <><CheckCircle2 className="h-3.5 w-3.5" />Salvar Identificação</>}
        </Button>
      </div>
    </div>
  );
}

function IntegracaoTab() {
  const queryClient = useQueryClient();
  const [connectModal, setConnectModal] = useState<ConnectModalState | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("Todos");
  const [oauthLoading, setOauthLoading] = useState<"meta" | "tiktok" | null>(null);

  // Show toast when redirected back from OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const count = params.get("count");
    const account = params.get("account");
    if (connected === "meta" && count) {
      toast.success(`${count} conta${Number(count) !== 1 ? "s" : ""} Meta conectada${Number(count) !== 1 ? "s" : ""} com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/me/integrations"] });
      // Clean up query params without full reload
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      url.searchParams.delete("count");
      window.history.replaceState({}, "", url.toString());
    } else if (connected === "tiktok" && account) {
      toast.success(`TikTok conectado: ${decodeURIComponent(account)}`);
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/me/integrations"] });
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      url.searchParams.delete("account");
      window.history.replaceState({}, "", url.toString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/workspaces/me/integrations"],
    queryFn: async () => {
      return customFetch<{ integrations: WorkspaceIntegration[] }>("/api/workspaces/me/integrations")
        .catch(() => ({ integrations: [] as WorkspaceIntegration[] }));
    },
  });

  const connectMutation = useMutation({
    mutationFn: async ({
      provider, accountId, accountName, accessToken, webhookUrl, metadata,
    }: { provider: IntegrationProvider; accountId?: string; accountName?: string; accessToken?: string; webhookUrl?: string; metadata?: Record<string, unknown> }) => {
      return customFetch<unknown>("/api/workspaces/me/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, accountId, accountName, accessToken, webhookUrl, metadata }),
      });
    },
    onSuccess: () => {
      toast.success("Integração conectada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/me/integrations"] });
      setConnectModal(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const disconnectSocialMutation = useMutation({
    mutationFn: async (integrationId: string) =>
      customFetch(`/api/social/accounts/${integrationId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Conta desconectada com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/me/integrations"] });
    },
    onError: () => toast.error("Erro ao desconectar conta."),
  });

  const handleSocialOAuthConnect = async (platform: "meta" | "tiktok") => {
    setOauthLoading(platform);
    try {
      const { url } = await customFetch<{ url: string }>(`/api/social/connect/${platform}`);
      window.location.href = url;
    } catch {
      toast.error("Erro ao iniciar conexão OAuth. Verifique a configuração do app Meta/TikTok.");
      setOauthLoading(null);
    }
  };

  const integrations = data?.integrations ?? [];
  const connectedProviders = new Set(integrations.map(i => i.provider));

  // Group social integrations by provider for catalog display
  const socialAccountsByProvider = integrations.reduce((map, intg) => {
    if (SOCIAL_OAUTH_PROVIDERS[intg.provider]) {
      const list = map.get(intg.provider) ?? [];
      list.push(intg);
      map.set(intg.provider, list);
    }
    return map;
  }, new Map<IntegrationProvider, WorkspaceIntegration[]>());

  const handleConnect = (provider: IntegrationProvider, fields: Record<string, string>) => {
    const { accountId, accountName, webhookUrl, accessToken, ...rest } = fields;
    const metadata: Record<string, unknown> = { ...rest };
    connectMutation.mutate({
      provider,
      accountId: accountId || undefined,
      accountName: accountName || undefined,
      accessToken: accessToken || undefined,
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
              const isSocial = Boolean(SOCIAL_OAUTH_PROVIDERS[intg.provider]);
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
                    {isSocial && (
                      <button
                        aria-label={`Desconectar ${intg.accountName ?? intg.provider}`}
                        onClick={() => disconnectSocialMutation.mutate(intg.id)}
                        disabled={disconnectSocialMutation.isPending}
                        className="p-1 text-muted-foreground/40 hover:text-destructive transition-colors disabled:opacity-50"
                        title="Desconectar conta"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
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
            const oauthPlatform = SOCIAL_OAUTH_PROVIDERS[intg.provider];
            const isConnected = connectedProviders.has(intg.provider);
            const existing = integrations.find(i => i.provider === intg.provider);
            const connectedAccounts = socialAccountsByProvider.get(intg.provider) ?? [];

            // Social OAuth providers — always show "Add Another Account" button
            if (oauthPlatform) {
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
                  {/* List connected accounts with disconnect */}
                  {connectedAccounts.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {connectedAccounts.map(acc => (
                        <div key={acc.id} className="flex items-center justify-between text-xs font-mono">
                          <span className="flex items-center gap-1.5 text-success truncate">
                            <CheckCircle2 className="h-3 w-3 shrink-0" />
                            <span className="truncate">{acc.accountName ?? acc.accountId ?? "—"}</span>
                          </span>
                          <button
                            aria-label={`Desconectar ${acc.accountName}`}
                            onClick={() => disconnectSocialMutation.mutate(acc.id)}
                            disabled={disconnectSocialMutation.isPending}
                            className="ml-2 p-1 text-muted-foreground/40 hover:text-destructive transition-colors shrink-0 disabled:opacity-50"
                            title="Desconectar"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSocialOAuthConnect(oauthPlatform)}
                    disabled={oauthLoading === oauthPlatform}
                    className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 btn-weapon-outline"
                  >
                    {oauthLoading === oauthPlatform ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : (
                      <Plus className="h-2.5 w-2.5" />
                    )}
                    {connectedAccounts.length > 0 ? "Adicionar outra conta" : "Conectar"}
                  </Button>
                </div>
              );
            }

            // Non-social providers — original behavior
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

// ── Identidade Tab (Voice Clone + Trejeitos + Avatar) ─────────────────────────

type PersonaData = {
  voiceCloneId?: string;
  voiceCloneUpdatedAt?: string;
  voiceName?: string;
  heygenAvatarId?: string;
  speakingStyle?: {
    energia?: string;
    velocidade?: string;
    pausas?: string;
    gestos?: string;
    tom?: string;
  };
  trejeitos?: string;
  brandPresence?: string;
  reelStyle?: string;
  lifestylePreferences?: {
    hobbies?: string;
    gastronomy?: string;
    vehicles?: string;
    scenarios?: string;
    accessories?: string;
    countries?: string;
    other?: string;
  };
  updatedAt?: string;
};

function IdentidadeTab() {
  const { user } = useAuth();
  const [persona, setPersona] = useState<PersonaData>({});
  const [loading, setLoading] = useState(true);

  // ── Clone navigation ──────────────────────────────────────────────────────
  const [, navigate] = useLocation();
  const [cloneSessionId, setCloneSessionId] = useState<string | null>(null);
  const [videoProductionStyle, setVideoProductionStyle] = useState<"clone" | "no_face">("no_face");
  const [savingStyle, setSavingStyle] = useState(false);

  // ── Voice recording state ─────────────────────────────────────────────────
  const [recState, setRecState] = useState<"idle" | "recording" | "recorded" | "cloning" | "done">("idle");
  const [recSeconds, setRecSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioMime, setAudioMime] = useState("audio/webm");
  const [cloneError, setCloneError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<BlobPart[]>([]);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Trejeitos / persona form state ───────────────────────────────────────
  const [voiceName,      setVoiceName]      = useState("");
  const [heygenAvatarId, setHeygenAvatarId] = useState("");
  const [energia,        setEnergia]        = useState("");
  const [velocidade,     setVelocidade]     = useState("");
  const [pausas,         setPausas]         = useState("");
  const [gestos,         setGestos]         = useState("");
  const [tom,            setTom]            = useState("");
  const [trejeitos,      setTrejeitos]      = useState("");
  const [brandPresence,  setBrandPresence]  = useState("");
  const [reelStyle,      setReelStyle]      = useState("");
  // ── Lifestyle preferences ─────────────────────────────────────────────────
  const [lsHobbies,      setLsHobbies]      = useState("");
  const [lsGastronomy,   setLsGastronomy]   = useState("");
  const [lsVehicles,     setLsVehicles]     = useState("");
  const [lsScenarios,    setLsScenarios]    = useState("");
  const [lsAccessories,  setLsAccessories]  = useState("");
  const [lsCountries,    setLsCountries]    = useState("");
  const [lsOther,        setLsOther]        = useState("");
  const [saving,         setSaving]         = useState(false);

  // ── Load persona + workspace metadata (clone state) + HeyGen status ─────
  useEffect(() => {
    Promise.all([
      customFetch<{ persona: PersonaData }>("/api/workspaces/me/persona"),
      customFetch<{ workspace: { metadata?: Record<string, unknown> } }>("/api/workspaces/me"),
    ])
      .then(([{ persona: p }, { workspace }]) => {
        setPersona(p);
        setVoiceName(p.voiceName ?? "");
        setHeygenAvatarId(p.heygenAvatarId ?? "");
        setEnergia(p.speakingStyle?.energia ?? "");
        setVelocidade(p.speakingStyle?.velocidade ?? "");
        setPausas(p.speakingStyle?.pausas ?? "");
        setGestos(p.speakingStyle?.gestos ?? "");
        setTom(p.speakingStyle?.tom ?? "");
        setTrejeitos(p.trejeitos ?? "");
        setBrandPresence(p.brandPresence ?? "");
        setReelStyle(p.reelStyle ?? "");
        setLsHobbies(p.lifestylePreferences?.hobbies ?? "");
        setLsGastronomy(p.lifestylePreferences?.gastronomy ?? "");
        setLsVehicles(p.lifestylePreferences?.vehicles ?? "");
        setLsScenarios(p.lifestylePreferences?.scenarios ?? "");
        setLsAccessories(p.lifestylePreferences?.accessories ?? "");
        setLsCountries(p.lifestylePreferences?.countries ?? "");
        setLsOther(p.lifestylePreferences?.other ?? "");
        if (p.voiceCloneId) setRecState("done");
        // Ler clone state de workspace.settings (onde clone-voice-multi salva)
        // Mantém fallback para workspace.metadata por compatibilidade com sessões antigas
        const meta = (workspace as any).settings ?? (workspace as any).metadata ?? {};
        if (meta.cloneSessionId) setCloneSessionId(meta.cloneSessionId as string);
        // Se voiceCloneId existe na persona mas cloneSessionId não foi salvo ainda,
        // usar o voiceCloneId como indicador de sessão concluída
        if (!meta.cloneSessionId && p.voiceCloneId) setCloneSessionId(p.voiceCloneId);
        if (meta.videoProductionStyle === "clone" || meta.videoProductionStyle === "no_face") {
          setVideoProductionStyle(meta.videoProductionStyle as "clone" | "no_face");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Save video production style to workspace metadata ─────────────────────
  const saveVideoProductionStyle = async (style: "clone" | "no_face", sessionId?: string) => {
    setSavingStyle(true);
    try {
      await customFetch<unknown>("/api/workspaces/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata: {
            videoProductionStyle: style,
            ...(sessionId ? { cloneSessionId: sessionId, hasClone: true } : {}),
          },
        }),
      });
      setVideoProductionStyle(style);
      if (sessionId) setCloneSessionId(sessionId);
    } catch {
      toast.error("Erro ao salvar preferência de vídeo.");
    } finally {
      setSavingStyle(false);
    }
  };

  // ── Recording helpers ─────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setCloneError(null);
    setAudioUrl(null);
    setAudioBase64(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      setAudioMime(mime);
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        const url  = URL.createObjectURL(blob);
        setAudioUrl(url);
        const reader = new FileReader();
        reader.onload = () => {
          const b64 = (reader.result as string).split(",")[1] ?? "";
          setAudioBase64(b64);
        };
        reader.readAsDataURL(blob);
        setRecState("recorded");
        setRecSeconds(0);
        if (timerRef.current) clearInterval(timerRef.current);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecState("recording");
      setRecSeconds(0);
      timerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch {
      setCloneError("Microfone não disponível — verifique as permissões do navegador.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const clearAudio = useCallback(() => {
    setAudioUrl(null);
    setAudioBase64(null);
    setRecState("idle");
    setCloneError(null);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const handleFileUpload = useCallback((file: File) => {
    setCloneError(null);
    const mime = file.type || "audio/mpeg";
    setAudioMime(mime);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(",")[1] ?? "";
      setAudioBase64(b64);
    };
    reader.readAsDataURL(file);
    setRecState("recorded");
  }, []);

  const cloneVoice = useCallback(async () => {
    if (!audioBase64) return;
    setCloneError(null);
    setRecState("cloning");
    try {
      const result = await customFetch<{ voiceCloneId: string; success: boolean }>("/api/workspaces/me/persona/clone-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType: audioMime, voiceName: voiceName || "Minha Voz NexOS" }),
      });
      setPersona(prev => ({ ...prev, voiceCloneId: result.voiceCloneId, voiceCloneUpdatedAt: new Date().toISOString() }));
      setRecState("done");
      toast.success("Voz clonada com sucesso! Voice ID: " + result.voiceCloneId.slice(0, 8) + "…");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao clonar voz";
      setCloneError(msg);
      setRecState("recorded");
    }
  }, [audioBase64, audioMime, voiceName]);

  // ── Save persona form ────────────────────────────────────────────────────
  const handleSavePersona = async () => {
    setSaving(true);
    try {
      const result = await customFetch<{ persona: PersonaData }>("/api/workspaces/me/persona", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceName:      voiceName || undefined,
          heygenAvatarId: heygenAvatarId || undefined,
          speakingStyle:  { energia: energia || undefined, velocidade: velocidade || undefined, pausas: pausas || undefined, gestos: gestos || undefined, tom: tom || undefined },
          trejeitos:      trejeitos || undefined,
          brandPresence:  brandPresence || undefined,
          reelStyle:      reelStyle || undefined,
          lifestylePreferences: {
            hobbies:     lsHobbies     || undefined,
            gastronomy:  lsGastronomy  || undefined,
            vehicles:    lsVehicles    || undefined,
            scenarios:   lsScenarios   || undefined,
            accessories: lsAccessories || undefined,
            countries:   lsCountries   || undefined,
            other:       lsOther       || undefined,
          },
        }),
      });
      setPersona(result.persona);
      toast.success("Identidade salva — agentes usarão seu perfil nos próximos vídeos.");
    } catch {
      toast.error("Erro ao salvar identidade.");
    } finally {
      setSaving(false);
    }
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2,"0")}:${String(s % 60).padStart(2,"0")}`;

  const SEL_BASE = "font-mono text-xs rounded-none bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground w-full outline-none";

  if (loading) return (
    <div className="space-y-4">
      {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
    </div>
  );

  return (
    <div className="space-y-6">

      {/* ── Seção 0: Clone Studio — Estilo de Vídeo ── */}
      <SectionCard title="Clone Studio — Estilo de Vídeo" icon={Video}>
        <div className="space-y-4">

          {/* Style selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => void saveVideoProductionStyle("no_face")}
              disabled={savingStyle}
              className={`border px-4 py-4 text-left space-y-1.5 transition-all ${videoProductionStyle === "no_face" ? "border-primary bg-primary/10" : "border-border/40 bg-background/30 hover:border-primary/40"}`}
            >
              <div className="flex items-center gap-2">
                <UserX className={`h-4 w-4 ${videoProductionStyle === "no_face" ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`font-mono text-[11px] font-bold uppercase tracking-widest ${videoProductionStyle === "no_face" ? "text-primary" : "text-foreground"}`}>Sem Face</span>
                {videoProductionStyle === "no_face" && <Badge className="ml-auto rounded-none font-mono text-[9px] px-1.5 py-0 bg-primary/20 text-primary border-primary/30">Ativo</Badge>}
              </div>
              <p className="font-mono text-[10px] text-muted-foreground/60 leading-relaxed">
                Narração com IA + animações + texto na tela. Nenhuma aparição sua.
              </p>
            </button>

            <button
              onClick={() => {
                if (!cloneSessionId) {
                  navigate("/clone-digital");
                } else {
                  void saveVideoProductionStyle("clone");
                }
              }}
              disabled={savingStyle}
              className={`border px-4 py-4 text-left space-y-1.5 transition-all ${videoProductionStyle === "clone" ? "border-primary bg-primary/10" : "border-border/40 bg-background/30 hover:border-primary/40"}`}
            >
              <div className="flex items-center gap-2">
                <UserCheck className={`h-4 w-4 ${cloneSessionId ? (videoProductionStyle === "clone" ? "text-primary" : "text-green-400") : "text-muted-foreground/40"}`} />
                <span className={`font-mono text-[11px] font-bold uppercase tracking-widest ${videoProductionStyle === "clone" ? "text-primary" : "text-foreground"}`}>Com Clone</span>
                {cloneSessionId && videoProductionStyle === "clone" && <Badge className="ml-auto rounded-none font-mono text-[9px] px-1.5 py-0 bg-primary/20 text-primary border-primary/30">Ativo</Badge>}
                {cloneSessionId && videoProductionStyle !== "clone" && <Badge className="ml-auto rounded-none font-mono text-[9px] px-1.5 py-0 bg-green-500/10 text-green-400 border-green-500/30">Pronto</Badge>}
                {!cloneSessionId && <Badge className="ml-auto rounded-none font-mono text-[9px] px-1.5 py-0 bg-muted/20 text-muted-foreground/50 border-border/30">Criar clone</Badge>}
              </div>
              <p className="font-mono text-[10px] text-muted-foreground/60 leading-relaxed">
                Vídeos com seu rosto e voz clonada. Requer captura de 5 min.
              </p>
            </button>
          </div>

          {/* Clone captured status */}
          {cloneSessionId && (
            <div className="flex items-center gap-3 px-4 py-3 border border-green-500/20 bg-green-500/5">
              <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
              <div className="flex-1">
                <div className="font-mono text-[11px] font-bold text-green-300">Clone de vídeo capturado</div>
                <div className="font-mono text-[10px] text-muted-foreground/60">Sessão: {cloneSessionId.slice(0, 12)}… · Disponível para CPL e VSL</div>
              </div>
            </div>
          )}

          <div className="font-mono text-[9px] text-muted-foreground/30 leading-relaxed">
            Esta preferência se aplica a todos os CPLs e VSLs gerados pelos agentes. Você pode mudar a qualquer momento — as próximas gerações usarão o novo estilo.
          </div>
        </div>
      </SectionCard>

      {/* ── Status Banner ── */}
      <div className="border border-border/40 bg-card/30 px-5 py-4 flex items-center gap-4">
        <Fingerprint className="h-6 w-6 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-xs font-bold text-foreground uppercase tracking-widest">Identidade Digital do Lançador</div>
          <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">
            Sua voz, presença e trejeitos são injetados nos roteiros e vídeos gerados pelos agentes NexOS
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Badge variant="outline" className={`rounded-none font-mono text-[10px] px-2 py-0.5 ${persona.voiceCloneId ? "text-green-400 border-green-400/40 bg-green-400/10" : "text-muted-foreground/50"}`}>
            {persona.voiceCloneId ? "✓ Voz Clonada" : "Voz: Pendente"}
          </Badge>
          <Badge variant="outline" className={`rounded-none font-mono text-[10px] px-2 py-0.5 ${persona.heygenAvatarId ? "text-blue-400 border-blue-400/40 bg-blue-400/10" : "text-muted-foreground/50"}`}>
            {persona.heygenAvatarId ? "✓ Avatar Ativo" : "Avatar: Pendente"}
          </Badge>
        </div>
      </div>

      {/* ── Seção 1: Clone de Voz ── */}
      <SectionCard title="Clone de Voz" icon={Headphones}>
        <div className="space-y-4">
          {/* Status atual */}
          {persona.voiceCloneId && (
            <div className="flex items-center gap-3 px-4 py-3 border border-green-500/20 bg-green-500/5">
              <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
              <div>
                <div className="font-mono text-[11px] font-bold text-green-300">Voz clonada com sucesso</div>
                <div className="font-mono text-[10px] text-muted-foreground/60">
                  Voice ID: <span className="text-green-400/80">{persona.voiceCloneId}</span>
                  {persona.voiceCloneUpdatedAt && ` · ${new Date(persona.voiceCloneUpdatedAt).toLocaleDateString("pt-BR")}`}
                </div>
              </div>
            </div>
          )}

          <FieldRow label="Nome da Voz" sublabel="Identificação da voz clonada">
            <Input
              value={voiceName}
              onChange={e => setVoiceName(e.target.value)}
              placeholder="Ex: João — Voz NexOS"
              className="font-mono h-9 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary text-sm"
            />
          </FieldRow>

          <FieldRow label="Amostras de Voz" sublabel="30–120 segundos falando naturalmente. Quanto mais variado, melhor o clone.">
            <div className="space-y-3">
              {/* Recorder */}
              <div className="flex items-center gap-3">
                {recState === "idle" || recState === "done" || recState === "recorded" ? (
                  <Button
                    size="sm"
                    onClick={() => void startRecording()}
                    className="rounded-none font-mono text-[10px] uppercase tracking-widest h-8 px-3 gap-2"
                    style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", color: "#ef4444" }}
                  >
                    <Mic className="h-3.5 w-3.5" />
                    {recState === "done" || recState === "recorded" ? "Regravar" : "Gravar Áudio"}
                  </Button>
                ) : recState === "recording" ? (
                  <Button
                    size="sm"
                    onClick={stopRecording}
                    className="rounded-none font-mono text-[10px] uppercase tracking-widest h-8 px-3 gap-2 animate-pulse"
                    style={{ background: "rgba(239,68,68,0.25)", border: "1px solid rgba(239,68,68,0.6)", color: "#ef4444" }}
                  >
                    <Square className="h-3 w-3 fill-red-500" />
                    Parar — {fmt(recSeconds)}
                  </Button>
                ) : null}

                <span className="font-mono text-[10px] text-muted-foreground/40">ou</span>

                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="audio/*"
                    className="sr-only"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    asChild
                    className="rounded-none font-mono text-[10px] uppercase tracking-widest h-8 px-3 gap-2 text-muted-foreground hover:text-foreground pointer-events-none"
                  >
                    <span><Upload className="h-3.5 w-3.5" />Enviar Arquivo</span>
                  </Button>
                </label>
              </div>

              {/* Audio preview */}
              {audioUrl && recState !== "recording" && (
                <div className="flex items-center gap-2 border border-border/30 bg-background/30 px-3 py-2">
                  <Headphones className="h-3.5 w-3.5 text-primary shrink-0" />
                  <audio controls src={audioUrl} className="flex-1 h-8 min-w-0" style={{ filter: "invert(0) hue-rotate(180deg) brightness(0.8)" }} />
                  <button
                    onClick={clearAudio}
                    title="Excluir gravação e recomeçar"
                    className="shrink-0 p-1.5 text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-colors rounded"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Clone button */}
              {(recState === "recorded" || recState === "cloning") && (
                <Button
                  onClick={() => void cloneVoice()}
                  disabled={recState === "cloning"}
                  className="rounded-none font-mono text-[11px] uppercase tracking-widest h-9 px-5 gap-2 btn-weapon-primary w-full"
                >
                  {recState === "cloning"
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Clonando voz com IA…</>
                    : <><Sparkles className="h-3.5 w-3.5" />Clonar Minha Voz com IA</>}
                </Button>
              )}

              {cloneError && (
                <div className="border border-red-500/20 bg-red-500/5 px-4 py-3">
                  <div className="font-mono text-[10px] text-red-400">{cloneError}</div>
                </div>
              )}

              <div className="font-mono text-[9px] text-muted-foreground/30 leading-relaxed">
                Fale naturalmente por 30–120s. Inclua variações de tom, pausas, entusiasmo. Evite ruído de fundo. Seu Voice ID é armazenado com segurança e usado apenas em vídeos desta conta.
              </div>
            </div>
          </FieldRow>
        </div>
      </SectionCard>

      {/* ── Seção 2: Avatar Digital ── */}
      <SectionCard title="Avatar Digital" icon={Camera}>
        <div className="space-y-4">

          {/* Clone capturado */}
          {cloneSessionId ? (
            <div className="flex items-center gap-3 px-4 py-3 border border-green-500/20 bg-green-500/5">
              <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[11px] font-bold text-green-300">Clone de avatar capturado</div>
                <div className="font-mono text-[10px] text-muted-foreground/60">
                  Sessão: {cloneSessionId.slice(0, 12)}… · Disponível para CPL e VSL
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate("/clone-digital")}
                className="shrink-0 rounded-none font-mono text-[10px] uppercase tracking-widest h-8 px-3 gap-1.5 border-green-500/30 text-green-400 hover:bg-green-500/10"
              >
                <Camera className="h-3 w-3" /> Regravar
              </Button>
            </div>
          ) : (
            <div className="flex items-start gap-3 px-4 py-3 border border-border/40 bg-background/30">
              <Camera className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[11px] font-bold text-foreground">Nenhum clone gravado</div>
                <div className="font-mono text-[10px] text-muted-foreground/60">
                  Grave 5 takes guiados (~5 min) para criar vídeos com seu rosto e voz clonada.
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => navigate("/clone-digital")}
                className="shrink-0 rounded-none font-mono text-[10px] uppercase tracking-widest h-8 px-3 gap-1.5"
                style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.35)", color: "hsl(var(--primary))" }}
              >
                <Camera className="h-3 w-3" /> Gravar
              </Button>
            </div>
          )}

          <div className="font-mono text-[9px] text-muted-foreground/30 leading-relaxed">
            Com sua identidade configurada, os vídeos de lançamento gerados pelo NexOS AI usarão seu perfil de voz clonada automaticamente.
          </div>
        </div>
      </SectionCard>

      {/* ── Seção 3: Trejeitos & Presença ── */}
      <SectionCard title="Trejeitos & Estilo de Presença" icon={Sparkles}>
        <div className="space-y-0">
          <FieldRow label="Energia" sublabel="Como você naturalmente se apresenta">
            <select value={energia} onChange={e => setEnergia(e.target.value)} className={SEL_BASE}>
              <option value="">Selecionar…</option>
              <option value="baixa">Calma / Reflexiva</option>
              <option value="moderada">Equilibrada</option>
              <option value="alta">Energética / Dinâmica</option>
              <option value="muito_alta">Explosiva / Alta voltagem</option>
            </select>
          </FieldRow>

          <FieldRow label="Velocidade de Fala" sublabel="Ritmo natural de como você fala">
            <select value={velocidade} onChange={e => setVelocidade(e.target.value)} className={SEL_BASE}>
              <option value="">Selecionar…</option>
              <option value="lenta">Lenta / Pausada</option>
              <option value="moderada">Moderada</option>
              <option value="rapida">Rápida / Fluida</option>
              <option value="variavel">Variável (muda conforme contexto)</option>
            </select>
          </FieldRow>

          <FieldRow label="Uso de Pausas" sublabel="Como você usa silêncio para impacto">
            <select value={pausas} onChange={e => setPausas(e.target.value)} className={SEL_BASE}>
              <option value="">Selecionar…</option>
              <option value="frequentes">Frequentes — gosto de deixar respirar</option>
              <option value="estrategicas">Estratégicas — só nos momentos-chave</option>
              <option value="minimas">Mínimas — falo de forma contínua</option>
            </select>
          </FieldRow>

          <FieldRow label="Gestos" sublabel="Uso de mãos e corpo">
            <select value={gestos} onChange={e => setGestos(e.target.value)} className={SEL_BASE}>
              <option value="">Selecionar…</option>
              <option value="discretos">Discretos / Contidos</option>
              <option value="moderados">Moderados</option>
              <option value="expressivos">Expressivos</option>
              <option value="muito_expressivos">Muito expressivos / Amplificados</option>
            </select>
          </FieldRow>

          <FieldRow label="Tom de Comunicação" sublabel="Estilo dominante de como você fala">
            <Input
              value={tom}
              onChange={e => setTom(e.target.value)}
              placeholder="Ex: consultivo-direto, professor-mentor, provocador-estratégico…"
              className="font-mono h-9 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary text-sm"
            />
          </FieldRow>

          <FieldRow label="Trejeitos" sublabel="Expressões, vícios de linguagem, manias específicas">
            <Textarea
              value={trejeitos}
              onChange={e => setTrejeitos(e.target.value)}
              placeholder="Ex: Começo frases com 'olha...', uso bastante a palavra 'resultado', faço pausa antes de revelar o ponto principal, tenho o hábito de repetir a última palavra com ênfase..."
              className="font-mono text-xs rounded-none bg-background/60 border-border/50 focus-visible:ring-primary resize-none"
              rows={4}
            />
          </FieldRow>
        </div>
      </SectionCard>

      {/* ── Seção 4: Marca Pessoal ── */}
      <SectionCard title="Marca Pessoal & Estilo de Vídeo" icon={Wand2}>
        <div className="space-y-0">
          <FieldRow label="Presença de Marca" sublabel="Como você se posiciona e se apresenta ao mercado">
            <Textarea
              value={brandPresence}
              onChange={e => setBrandPresence(e.target.value)}
              placeholder="Ex: Me posiciono como especialista em resultados rápidos para empreendedoras femininas. Minha identidade é de quem já passou pela dor, transformou, e agora ensina. Tom: direto, sem rodeios, com empat…"
              className="font-mono text-xs rounded-none bg-background/60 border-border/50 focus-visible:ring-primary resize-none"
              rows={3}
            />
          </FieldRow>

          <FieldRow label="Estilo de Reels" sublabel="Como você estrutura e entrega seus vídeos curtos">
            <Textarea
              value={reelStyle}
              onChange={e => setReelStyle(e.target.value)}
              placeholder="Ex: Começo sempre com uma pergunta provocadora nos primeiros 3 segundos. Uso cortes rápidos. Fecho com uma frase de impacto antes do CTA. Prefiro cenário externo com luz natural…"
              className="font-mono text-xs rounded-none bg-background/60 border-border/50 focus-visible:ring-primary resize-none"
              rows={3}
            />
          </FieldRow>
        </div>
      </SectionCard>

      {/* ── Seção 5: Lifestyle & Preferências Pessoais ── */}
      <SectionCard title="Lifestyle & Preferências Pessoais" icon={Wand2}>
        <p className="text-[11px] text-muted-foreground/60 mb-4 leading-relaxed">
          Os agentes de roteiro e direção visual usam esses dados para enriquecer <strong className="text-muted-foreground/80">automaticamente</strong> o{" "}
          <code className="font-mono text-[10px]">visualDirection</code> e os scripts de vídeo — adereços, cenários, hobbies e referências que aparecem de forma natural nos conteúdos, sem que você precise especificar em cada post.
        </p>
        <div className="space-y-0">
          <FieldRow label="Hobbies & Esportes" sublabel="O que você pratica no tempo livre">
            <Input
              value={lsHobbies}
              onChange={e => setLsHobbies(e.target.value)}
              placeholder="Ex: golfe, mergulho, automobilismo, equitação, pesca esportiva"
              className="font-mono h-9 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary text-sm"
            />
          </FieldRow>
          <FieldRow label="Gastronomia" sublabel="Culinária, restaurantes, bebidas favoritas">
            <Input
              value={lsGastronomy}
              onChange={e => setLsGastronomy(e.target.value)}
              placeholder="Ex: japonesa, italiana, vinhos naturais, whisky japonês, fine dining"
              className="font-mono h-9 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary text-sm"
            />
          </FieldRow>
          <FieldRow label="Veículos" sublabel="Carros, motos, embarcações ou aeronaves">
            <Input
              value={lsVehicles}
              onChange={e => setLsVehicles(e.target.value)}
              placeholder="Ex: Porsche 911 GT3 RS, lancha Azimut 50, Ferrari SF90"
              className="font-mono h-9 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary text-sm"
            />
          </FieldRow>
          <FieldRow label="Adereços & Acessórios" sublabel="Relógios, joias, peças de vestuário icônicas">
            <Input
              value={lsAccessories}
              onChange={e => setLsAccessories(e.target.value)}
              placeholder="Ex: Richard Mille RM 11-03 (casual), Rolex Daytona (formal), Air Jordan 1 Chicago"
              className="font-mono h-9 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary text-sm"
            />
          </FieldRow>
          <FieldRow label="Cenários Favoritos" sublabel="Locais, ambientes e paisagens de referência">
            <Input
              value={lsScenarios}
              onChange={e => setLsScenarios(e.target.value)}
              placeholder="Ex: Alpes suíços, Maldivas, Quinta em Trás-os-Montes, penthouse vista para o mar"
              className="font-mono h-9 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary text-sm"
            />
          </FieldRow>
          <FieldRow label="Países & Destinos" sublabel="Países com que você tem afinidade ou frequenta">
            <Input
              value={lsCountries}
              onChange={e => setLsCountries(e.target.value)}
              placeholder="Ex: Portugal, Japão, Maldivas, Mônaco, Dubai, Itália"
              className="font-mono h-9 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary text-sm"
            />
          </FieldRow>
          <FieldRow label="Outros Elementos" sublabel="Qualquer detalhe de estilo de vida relevante">
            <Textarea
              value={lsOther}
              onChange={e => setLsOther(e.target.value)}
              placeholder="Ex: colecionador de arte contemporânea, frequenta leilões em Londres, pratica meditação diária, tem uma adega com mais de 300 rótulos…"
              className="font-mono text-xs rounded-none bg-background/60 border-border/50 focus-visible:ring-primary resize-none"
              rows={3}
            />
          </FieldRow>
        </div>
      </SectionCard>

      {/* ── Save Button ── */}
      <div className="flex items-center justify-between pt-2 border-t border-border/30">
        <div className="font-mono text-[10px] text-muted-foreground/40">
          Os agentes usam esses dados para gerar roteiros e takes de vídeo no seu estilo
        </div>
        <Button
          onClick={() => void handleSavePersona()}
          disabled={saving}
          className="rounded-none font-mono uppercase text-xs tracking-widest h-9 px-6 gap-2 btn-weapon-primary shrink-0"
        >
          {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Salvando…</> : <><CheckCircle2 className="h-3.5 w-3.5" />Salvar Identidade</>}
        </Button>
      </div>

    </div>
  );
}

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
      {tab === "autonomia"   && <AutonomyTab />}
      {tab === "compliance"  && <ComplianceTab />}
      {tab === "seguranca"   && <SecurityTab />}
      {tab === "integracoes" && <IntegracaoTab />}
      {tab === "identidade"  && <IdentidadeTab />}
    </div>
  );
}
