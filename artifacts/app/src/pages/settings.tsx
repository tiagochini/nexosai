import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
import nexosLogo from "/nexos-logo.png";

type Tab = "perfil" | "workspace" | "seguranca";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "perfil",    label: "Perfil",     icon: User      },
  { id: "workspace", label: "Workspace",  icon: Building2 },
  { id: "seguranca", label: "Segurança",  icon: ShieldCheck },
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
        {sublabel && <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">{sublabel}</div>}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────
function ProfileTab() {
  const { user, workspace } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState(user?.name ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { setName(user?.name ?? ""); }, [user?.name]);

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSavingProfile(true);
    try {
      const res = await customFetch<Response>("/api/workspaces/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar nome");
      toast.success("Nome atualizado com sucesso.");
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    } catch {
      toast.error("Erro ao salvar nome.");
    } finally {
      setSavingProfile(false);
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
              <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{user?.email}</div>
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
      const res = await customFetch<Response>("/api/plans");
      if (!res.ok) return { plans: [] };
      return res.json() as Promise<{ plans: { id: string; name: string; slug: string; priceMonthlyBrl: string; creditsMonthly: number; maxCampaigns: number; whiteLabel: boolean }[] }>;
    },
  });

  useEffect(() => { setWsName(workspace?.name ?? ""); }, [workspace?.name]);

  const handleSave = async () => {
    if (!wsName.trim()) return;
    setSaving(true);
    try {
      const res = await customFetch<Response>("/api/workspaces/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: wsName.trim() }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar workspace");
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
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              {total > 0 ? `${total} créditos/mês` : ""}
            </span>
          </div>
        </FieldRow>

        <FieldRow label="Créditos de IA" sublabel="Uso do mês atual">
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
              <span className="font-mono text-[10px] text-muted-foreground">{usedPct}% utilizado</span>
              {remaining < total * 0.15 && (
                <span className="font-mono text-[10px] text-destructive animate-pulse">⚠ Créditos baixos</span>
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
                        R$ {parseFloat(p.priceMonthlyBrl).toLocaleString("pt-BR")}/mês
                      </div>
                    </div>
                    {isCurrent && (
                      <Badge variant="outline" className="rounded-none font-mono text-[9px] uppercase tracking-widest text-primary border-primary/40 bg-primary/10">
                        Ativo
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1.5 mb-4">
                    {[
                      `${p.creditsMonthly.toLocaleString("pt-BR")} créditos/mês`,
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
                    <Button variant="outline" size="sm" className="rounded-none font-mono uppercase text-[10px] tracking-widest w-full btn-weapon-outline">
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
      const res = await customFetch<Response>("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Falha ao alterar senha");
      }
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
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{strengthLabel}</span>
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
              <p className="font-mono text-[10px] text-destructive mt-1">As senhas não coincidem.</p>
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Settings() {
  const [tab, setTab] = useState<Tab>("perfil");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="border-b border-border/50 pb-5">
        <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold text-foreground">
          Configurações
        </h1>
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-1">
          Perfil · Workspace · Segurança
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border border-border/40 bg-card/30 p-0.5 rounded-sm w-fit">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase tracking-widest transition-all rounded-sm
                ${active
                  ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.3)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "perfil"    && <ProfileTab />}
      {tab === "workspace" && <WorkspaceTab />}
      {tab === "seguranca" && <SecurityTab />}
    </div>
  );
}
