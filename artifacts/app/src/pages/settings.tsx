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
  Settings as SettingsIcon, ShieldAlert, RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import nexosLogo from "/nexos-logo.png";
import { useLocation } from "wouter";
import { AutonomyTab } from "@/components/AutonomyTab";
import { MetaReviewReadinessPanel } from "@/components/meta-review-readiness";
import { intlLocale, useUiLocale, useUiText } from "@/lib/i18n";

type Tab = "perfil" | "workspace" | "seguranca" | "integracoes" | "identidade" | "compliance" | "autonomia";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "perfil",       label: "Perfil",          icon: User        },
  { id: "workspace",    label: "Workspace",       icon: Building2   },
  { id: "autonomia",    label: "Autonomia NexOS AI",    icon: ShieldCheck },
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
  const t = useUiText();

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
      toast.success(t("Nome atualizado com sucesso.", "Name updated successfully.", "Nombre actualizado correctamente."));
      queryClient.setQueryData(getGetMeQueryKey(), (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        const prev = old as Record<string, unknown>;
        return { ...prev, user: { ...(prev.user as Record<string, unknown>), name: name.trim() } };
      });
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    } catch {
      toast.error(t("Erro ao salvar nome.", "Couldn't save name.", "No se pudo guardar el nombre."));
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
      toast.success(t("Idioma da plataforma atualizado com sucesso.", "Platform language updated successfully.", "Idioma de la plataforma actualizado correctamente."));
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    } catch {
      queryClient.setQueryData(getGetMeQueryKey(), (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        const prev = old as Record<string, unknown>;
        return { ...prev, user: { ...(prev.user as Record<string, unknown>), locale: currentLocale } };
      });
      toast.error(t("Erro ao salvar idioma.", "Couldn't save language.", "No se pudo guardar el idioma."));
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
      <SectionCard title={t("Informações pessoais", "Personal information", "Información personal")} icon={User}>
        <FieldRow label={t("Avatar", "Avatar", "Avatar")} sublabel={t("Identificação visual", "Visual identity", "Identificación visual")}>
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

        <FieldRow label={t("Nome completo", "Full name", "Nombre completo")} sublabel={t("Exibido na plataforma", "Shown on the platform", "Se muestra en la plataforma")}>
          <div className="flex gap-3">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="font-mono h-10 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary focus-visible:border-primary flex-1"
              placeholder={t("Seu nome", "Your name", "Tu nombre")}
            />
            <Button
              onClick={() => void handleSaveName()}
              disabled={savingProfile || name.trim() === (user?.name ?? "")}
              className="rounded-none font-mono uppercase text-xs tracking-widest h-10 px-4 btn-weapon-primary shrink-0"
            >
              {savingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("Salvar", "Save", "Guardar")}
            </Button>
          </div>
        </FieldRow>

        <FieldRow label={t("E-mail", "Email", "Correo electrónico")} sublabel={t("Não editável", "Can't be edited", "No se puede editar")}>
          <div className="font-mono text-sm text-muted-foreground h-10 flex items-center px-3 border border-border/30 bg-muted/10">
            {user?.email ?? "—"}
          </div>
        </FieldRow>

        <FieldRow label={t("Idioma da plataforma", "Platform language", "Idioma de la plataforma")} sublabel={t("Idioma da plataforma", "Platform language", "Idioma de la plataforma")}>
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
                    <div className="text-[10px] uppercase tracking-wider opacity-60">
                      {opt.value === "pt-BR" ? t("Brasil", "Brazil", "Brasil")
                        : opt.value === "es-LA" ? t("América Latina", "Latin America", "Latinoamérica")
                          : opt.value === "en-AU" ? t("Austrália", "Australia", "Australia")
                            : t("Estados Unidos", "United States", "Estados Unidos")}
                    </div>
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
            {t("Aplica o idioma à interface e às respostas e relatórios do agente.", "Applies to the interface and agent responses and reports.", "Se aplica a la interfaz y a las respuestas e informes del agente.")}
          </p>
        </FieldRow>
      </SectionCard>

      <SectionCard title={t("Identificadores", "Identifiers", "Identificadores")} icon={CreditCard}>
        <FieldRow label="Workspace ID" sublabel={t("Identificador único da sua conta", "Your account's unique identifier", "Identificador único de tu cuenta")}>
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

        <FieldRow label={t("Função", "Role", "Función")} sublabel={t("Perfil de acesso", "Access profile", "Perfil de acceso")}>
          <Badge variant="outline" className="rounded-none font-mono text-xs uppercase tracking-widest text-primary border-primary/40 bg-primary/10">
            {t("Lançador", "Launch operator", "Operador de lanzamientos")}
          </Badge>
        </FieldRow>
      </SectionCard>
    </div>
  );
}

// ── Workspace Tab ─────────────────────────────────────────────────────────────
function WorkspaceTab() {
  const t = useUiText();
  const { workspace, workspacesData, switchWorkspace, createWorkspace, isWorkspacesLoading } = useAuth();
  const queryClient = useQueryClient();
  const [wsName, setWsName] = useState(workspace?.name ?? "");
  const [saving, setSaving] = useState(false);

  // Switch state
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  // Create state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [creating, setCreating] = useState(false);
  const [isWorkspaceInfoOpen, setIsWorkspaceInfoOpen] = useState(false);

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
      toast.success(t("Workspace atualizado.", "Workspace updated.", "Espacio de trabajo actualizado."));
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    } catch {
      toast.error(t("Erro ao atualizar workspace.", "Couldn't update workspace.", "No se pudo actualizar el espacio de trabajo."));
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (newWsName.trim().length < 2) {
      toast.error(t("O nome deve ter no mínimo 2 caracteres.", "Name must be at least 2 characters.", "El nombre debe tener al menos 2 caracteres."));
      return;
    }
    setCreating(true);
    try {
      await createWorkspace(newWsName.trim());
      setNewWsName("");
      setIsCreateOpen(false);
      toast.success(t("Workspace criado e ativo.", "Workspace created and activated.", "Espacio de trabajo creado y activado."));
    } catch (err: any) {
      if (err?.message?.includes("WORKSPACE_LIMIT_REACHED")) {
        toast.error(t("Limite de workspaces atingido para o seu plano.", "You've reached your plan's workspace limit.", "Has alcanzado el límite de espacios de trabajo de tu plan."));
      } else {
        toast.error(err.message || t("Erro ao criar workspace.", "Couldn't create workspace.", "No se pudo crear el espacio de trabajo."));
      }
    } finally {
      setCreating(false);
    }
  };

  const handleSwitch = async (id: string) => {
    if (id === workspace?.id || switchingTo) return;
    setSwitchingTo(id);
    try {
      await switchWorkspace(id);
      toast.success(t("Operação trocada com sucesso.", "Workspace switched successfully.", "Espacio de trabajo cambiado correctamente."));
    } catch (err: any) {
      toast.error(err.message || t("Erro ao trocar operação.", "Couldn't switch workspace.", "No se pudo cambiar de espacio de trabajo."));
    } finally {
      setSwitchingTo(null);
    }
  };

  const usage = workspacesData?.usage;
  const entitlements = workspacesData?.entitlements;
  const workspaces = workspacesData?.workspaces || [];
  const canCreateWorkspace = workspacesData?.workspaceCreation.available === true;
  const planLimitReached = usage && entitlements ? usage.workspacesUsed >= entitlements.maxWorkspaces : false;

  useEffect(() => {
    if (!workspacesData) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("workspaceAction") !== "add") return;
    if (canCreateWorkspace) setIsCreateOpen(true);
    else setIsWorkspaceInfoOpen(true);
    params.delete("workspaceAction");
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, [workspacesData, canCreateWorkspace]);

  return (
    <div className="space-y-6">
      <SectionCard title={t("Sua operação atual", "Your current workspace", "Tu espacio de trabajo actual")} icon={Building2}>
        <div className="bg-primary/5 border border-primary/20 p-4 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl -mr-10 -mt-10" />
          <div className="font-mono text-[10px] uppercase tracking-widest text-primary mb-1">{t("Um workspace por cliente/marca", "One workspace per client/brand", "Un espacio de trabajo por cliente/marca")}</div>
          <p className="font-mono text-xs text-muted-foreground leading-relaxed max-w-2xl relative z-10">
            {t("A arquitetura da NexOS exige que cada cliente, marca ou operação independente possua seu próprio workspace. Isso isola dados de mercado, integrações, faturamento e garante que os agentes não misturem informações entre projetos diferentes.", "NexOS requires each client, brand, or independent operation to have its own workspace. This isolates market data, integrations, and billing, and prevents agents from mixing information across projects.", "La arquitectura de NexOS requiere que cada cliente, marca u operación independiente tenga su propio espacio de trabajo. Esto aísla los datos de mercado, las integraciones y la facturación, y evita que los agentes mezclen información entre proyectos.")}
          </p>
        </div>

        <FieldRow label={t("Nome do workspace", "Workspace name", "Nombre del espacio de trabajo")} sublabel={t("Sua operação ativa no momento", "Your currently active operation", "Tu operación activa actualmente")}>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={wsName}
              onChange={(e) => setWsName(e.target.value)}
              title={workspace?.name}
              className="font-mono h-10 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary focus-visible:border-primary flex-1"
              placeholder={t("Nome da sua empresa", "Your company name", "Nombre de tu empresa")}
            />
            <Button
              onClick={() => void handleSave()}
              disabled={saving || wsName.trim() === (workspace?.name ?? "")}
              className="w-full rounded-none font-mono uppercase text-xs tracking-widest h-10 px-4 btn-weapon-primary shrink-0 sm:w-auto"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("Renomear", "Rename", "Cambiar nombre")}
            </Button>
          </div>
        </FieldRow>
      </SectionCard>

      <SectionCard title={t("Capacidade do ambiente", "Workspace capacity", "Capacidad del espacio de trabajo")} icon={SettingsIcon}>
        {isWorkspacesLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          </div>
        ) : usage && entitlements ? (
          <div className="space-y-6">
            <FieldRow
              label={t("Produto contratado", "Subscribed product", "Producto contratado")}
              sublabel={t("Recursos incluídos na assinatura selecionada", "Entitlements for the selected subscription", "Prestaciones de la suscripción seleccionada")}
            >
              <div className="border border-primary/30 bg-primary/5 p-3">
                <div className="font-mono text-xs uppercase tracking-widest text-primary">
                  {entitlements.selectedSubscription?.productName ?? "Launch"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {t("Todas as capacidades do produto estão desbloqueadas. Limite de 5 contas por rede social.", "All product capabilities are unlocked. Limit: 5 accounts per social network.", "Todas las funciones del producto están habilitadas. Límite: 5 cuentas por red social.")}
                </div>
              </div>
            </FieldRow>
            <FieldRow label="Workspaces" sublabel={t("Operações independentes", "Independent operations", "Operaciones independientes")}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-mono text-xs text-foreground font-semibold">{usage.workspacesUsed} {t("em uso", "in use", "en uso")}</span>
                <span className="font-mono text-xs text-muted-foreground">{t("de", "of", "de")} {entitlements.maxWorkspaces} {t("permitidos", "allowed", "permitidos")}</span>
              </div>
              <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, (usage.workspacesUsed / entitlements.maxWorkspaces) * 100)}%`,
                    background: planLimitReached ? "hsl(var(--destructive))" : "hsl(var(--primary))",
                  }}
                />
              </div>
            </FieldRow>

            <FieldRow label={t("Redes sociais permitidas", "Allowed social networks", "Redes sociales permitidas")} sublabel={t("Plataformas habilitadas neste ambiente", "Platforms enabled in this workspace", "Plataformas habilitadas en este espacio de trabajo")}>
              <div className="flex flex-wrap gap-2">
                {entitlements.allowedSocialNetworks.map(net => (
                  <Badge key={net} variant="outline" className="rounded-none font-mono text-[10px] uppercase tracking-widest text-primary border-primary/40 bg-primary/10">
                    {net}
                  </Badge>
                ))}
              </div>
            </FieldRow>

            <FieldRow label={t("Contas conectadas", "Connected accounts", "Cuentas conectadas")} sublabel={t("Capacidade configurada separadamente para cada rede social", "Capacity configured separately for each social network", "Capacidad configurada por separado para cada red social")}>
              <div className="space-y-4">
                {entitlements.allowedSocialNetworks.map(net => {
                  const connected = usage.connectedAccountsByNetwork[net] || 0;
                  const max = entitlements.maxAccountsPerNetwork[net] ?? 0;
                  return (
                    <div key={net}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-mono text-[10px] text-foreground uppercase tracking-widest">{net}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{connected} / {max}</span>
                      </div>
                      <div className="h-1 w-full bg-muted/20 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700 bg-primary/60"
                          style={{ width: max > 0 ? `${Math.min(100, (connected / max) * 100)}%` : "0%" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </FieldRow>
          </div>
        ) : (
          <div className="py-8 text-center font-mono text-sm text-muted-foreground">{t("Dados de capacidade não disponíveis.", "Capacity data is unavailable.", "Los datos de capacidad no están disponibles.")}</div>
        )}
      </SectionCard>

      <SectionCard title={t("Minhas operações", "My workspaces", "Mis espacios de trabajo")} icon={Building2}>
        {isWorkspacesLoading ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-6 w-6 text-primary animate-spin" />
          </div>
        ) : !workspacesData ? (
          <div className="py-8 text-center font-mono text-sm text-muted-foreground">{t("Erro ao carregar workspaces.", "Couldn't load workspaces.", "No se pudieron cargar los espacios de trabajo.")}</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                {workspaces.length} {t("operação(ões) encontrada(s)", "workspace(s) found", "espacio(s) de trabajo encontrado(s)")}
              </div>
            </div>

            <div className="space-y-2">
              {workspaces.map(ws => {
                const isActive = ws.id === workspace?.id;
                return (
                  <div key={ws.id} className={`flex flex-col items-stretch justify-between gap-3 p-4 border transition-all sm:flex-row sm:items-center ${isActive ? "border-primary/50 bg-primary/5 shadow-[inset_0_0_12px_hsl(var(--primary)/0.08)]" : "border-border/40 bg-card/40 hover:border-primary/30"}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="truncate font-mono font-semibold text-sm" title={ws.name}>{ws.name}</span>
                        {isActive && <Badge variant="outline" className="rounded-none font-mono text-[9px] uppercase tracking-widest text-primary border-primary/40 bg-primary/10 py-0 h-4">{t("Atual", "Current", "Actual")}</Badge>}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                        ID: {ws.id.slice(0, 12)}... · {t("Criado em", "Created", "Creado el")} {new Date(ws.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    {!isActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={switchingTo === ws.id}
                        onClick={() => void handleSwitch(ws.id)}
                        className="w-full rounded-none font-mono uppercase text-[10px] tracking-widest btn-weapon-outline sm:w-auto"
                      >
                        {switchingTo === ws.id ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <RefreshCw className="h-3 w-3 mr-1.5" />}
                        {switchingTo === ws.id ? t("Trocando...", "Switching...", "Cambiando...") : t("Trocar para esta", "Switch to this", "Cambiar a este")}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-border/30 mt-6 flex flex-col items-start gap-4">
               {planLimitReached && !canCreateWorkspace ? (
                 <div className="w-full p-4 border border-destructive/30 bg-destructive/10">
                   <div className="flex items-start gap-3">
                     <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                     <div>
                        <div className="font-mono text-xs font-bold text-destructive uppercase tracking-widest">{t("Limite atingido", "Limit reached", "Límite alcanzado")}</div>
                        <div className="font-mono text-xs text-destructive/80 mt-1">{t(`Você atingiu a capacidade atual de ${entitlements?.maxWorkspaces} operação(ões). A ampliação ainda não está disponível para contratação.`, `You've reached the current limit of ${entitlements?.maxWorkspaces} workspace(s). Additional capacity is not yet available for purchase.`, `Has alcanzado el límite actual de ${entitlements?.maxWorkspaces} espacio(s) de trabajo. La capacidad adicional aún no está disponible para contratar.`)}</div>
                     </div>
                   </div>
                 </div>
               ) : null}

               <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                 {canCreateWorkspace ? <DialogTrigger asChild>
                    <Button className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-primary">
                     <Plus className="h-3.5 w-3.5 mr-2" />
                      {t("Adicionar workspace", "Add workspace", "Añadir espacio de trabajo")}
                   </Button>
                 </DialogTrigger> : null}
                 <DialogContent className="rounded-none border border-primary/30 bg-card/95 backdrop-blur-xl sm:max-w-[425px]">
                   <DialogHeader>
                      <DialogTitle className="font-mono uppercase tracking-widest text-primary text-sm">{t("Criar operação", "Create workspace", "Crear espacio de trabajo")}</DialogTitle>
                     <DialogDescription className="font-mono text-xs text-muted-foreground leading-relaxed mt-2">
                        {t("Crie um ambiente isolado para um novo cliente ou marca. Mantenha os dados separados para o agente atuar com contexto preciso.", "Create an isolated workspace for a new client or brand. Keep data separate so the agent can work with precise context.", "Crea un espacio aislado para un nuevo cliente o marca. Mantén los datos separados para que el agente trabaje con el contexto adecuado.")}
                     </DialogDescription>
                   </DialogHeader>
                   <div className="py-4 space-y-4">
                     <div className="space-y-2">
                        <Label htmlFor="new-ws-name" className="font-mono text-xs uppercase tracking-widest">{t("Nome da operação", "Workspace name", "Nombre del espacio de trabajo")}</Label>
                       <Input
                         id="new-ws-name"
                         value={newWsName}
                         onChange={e => setNewWsName(e.target.value)}
                          aria-describedby="new-ws-name-help"
                          placeholder={t("Ex.: Agência XYZ ou Cliente Alpha", "e.g. XYZ Agency or Alpha Client", "Ej.: Agencia XYZ o Cliente Alpha")}
                         className="font-mono h-10 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary"
                       />
                        <p id="new-ws-name-help" className="font-mono text-[10px] text-muted-foreground">
                          {newWsName.length > 0 && newWsName.trim().length < 2
                             ? t("Digite pelo menos 2 caracteres.", "Enter at least 2 characters.", "Escribe al menos 2 caracteres.")
                             : t("Use o nome do cliente, marca ou operação.", "Use the client, brand, or operation name.", "Usa el nombre del cliente, marca u operación.")}
                        </p>
                     </div>
                   </div>
                   <DialogFooter>
                     <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-none font-mono text-xs uppercase tracking-widest btn-weapon-outline">
                        {t("Cancelar", "Cancel", "Cancelar")}
                     </Button>
                     <Button onClick={() => void handleCreate()} disabled={creating || newWsName.trim().length < 2} className="rounded-none font-mono text-xs uppercase tracking-widest btn-weapon-primary">
                       {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
                        {t("Criar e acessar", "Create and open", "Crear y acceder")}
                     </Button>
                   </DialogFooter>
                 </DialogContent>
               </Dialog>

               {!canCreateWorkspace && (
                 <Button
                   onClick={() => setIsWorkspaceInfoOpen(true)}
                   className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-primary"
                 >
                   <Plus className="h-3.5 w-3.5 mr-2" />
                    {t("Adicionar workspace", "Add workspace", "Añadir espacio de trabajo")}
                 </Button>
               )}

               <Dialog open={isWorkspaceInfoOpen} onOpenChange={setIsWorkspaceInfoOpen}>
                 <DialogContent className="rounded-none border border-primary/30 bg-card/95 backdrop-blur-xl sm:max-w-[520px]">
                   <DialogHeader>
                      <DialogTitle className="font-mono uppercase tracking-widest text-primary text-sm">{t("O que é um workspace NexOS?", "What is a NexOS workspace?", "¿Qué es un espacio de trabajo de NexOS?")}</DialogTitle>
                     <DialogDescription className="font-mono text-xs text-muted-foreground leading-relaxed mt-2">
                        {t("Cada workspace é um ambiente isolado para uma marca, cliente ou operação. Ele mantém estratégia, campanhas, inteligência de mercado, leads, integrações e histórico separados para evitar que os agentes misturem contextos.", "Each workspace is an isolated environment for a brand, client, or operation. It keeps strategy, campaigns, market intelligence, leads, integrations, and history separate so agents don't mix contexts.", "Cada espacio de trabajo es un entorno aislado para una marca, cliente u operación. Mantiene separadas la estrategia, las campañas, la inteligencia de mercado, los leads, las integraciones y el historial para evitar que los agentes mezclen contextos.")}
                     </DialogDescription>
                   </DialogHeader>
                   <div className="space-y-3 border-y border-border/40 py-4">
                     <div className="flex items-start gap-3">
                       <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <p className="font-mono text-xs text-foreground/80">{t("Use um workspace diferente para cada empresa, marca ou cliente atendido.", "Use a separate workspace for each company, brand, or client you serve.", "Usa un espacio de trabajo distinto para cada empresa, marca o cliente.")}</p>
                     </div>
                     <div className="flex items-start gap-3">
                       <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <p className="font-mono text-xs text-foreground/80">{t("Dados, agentes e autorizações sociais permanecem isolados entre as operações.", "Data, agents, and social permissions remain isolated between workspaces.", "Los datos, agentes y permisos sociales permanecen aislados entre las operaciones.")}</p>
                     </div>
                     <div className="flex items-start gap-3">
                       <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <p className="font-mono text-xs text-foreground/80">{t("Além de novos workspaces, a capacidade de contas conectadas poderá ser ampliada separadamente por plataforma.", "In addition to new workspaces, connected-account capacity may be expanded separately for each platform.", "Además de nuevos espacios de trabajo, la capacidad de cuentas conectadas podrá ampliarse por separado para cada plataforma.")}</p>
                     </div>
                   </div>
                   <div className="border border-primary/20 bg-primary/5 p-3 font-mono text-xs text-muted-foreground">
                      {t("A ampliação de capacidade será disponibilizada em breve. Nenhuma contratação ou cobrança será realizada nesta tela.", "Additional capacity will be available soon. No purchase or charge will be made on this screen.", "La capacidad adicional estará disponible pronto. No se realizará ninguna contratación ni cobro en esta pantalla.")}
                   </div>
                   <DialogFooter>
                     <Button onClick={() => setIsWorkspaceInfoOpen(false)} className="rounded-none font-mono text-xs uppercase tracking-widest btn-weapon-primary">
                        {t("Entendi", "Got it", "Entendido")}
                     </Button>
                   </DialogFooter>
                 </DialogContent>
               </Dialog>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
// ── Security Tab ──────────────────────────────────────────────────────────────
function SecurityTab() {
  const t = useUiText();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [saving, setSaving] = useState(false);

  const strength = next.length === 0 ? 0 : next.length < 6 ? 1 : next.length < 10 ? 2 : next.length < 14 ? 3 : 4;
  const strengthLabel = ["", t("Fraca", "Weak", "Débil"), t("Razoável", "Fair", "Aceptable"), t("Boa", "Good", "Buena"), t("Forte", "Strong", "Fuerte")][strength];
  const strengthColor = ["", "bg-destructive", "bg-yellow-400", "bg-primary", "bg-success"][strength];

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) { toast.error(t("As senhas não coincidem.", "Passwords do not match.", "Las contraseñas no coinciden.")); return; }
    if (next.length < 8) { toast.error(t("Senha deve ter ao menos 8 caracteres.", "Password must be at least 8 characters.", "La contraseña debe tener al menos 8 caracteres.")); return; }
    setSaving(true);
    try {
      await customFetch<unknown>("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      toast.success(t("Senha alterada com sucesso.", "Password changed successfully.", "Contraseña cambiada correctamente."));
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("Erro ao alterar senha.", "Couldn't change password.", "No se pudo cambiar la contraseña."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard title={t("Alterar senha", "Change password", "Cambiar contraseña")} icon={ShieldCheck}>
        <form onSubmit={(e) => void handleChange(e)} className="space-y-0">
          <FieldRow label={t("Senha atual", "Current password", "Contraseña actual")} sublabel={t("Para confirmar identidade", "To verify your identity", "Para confirmar tu identidad")}>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="font-mono h-10 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary focus-visible:border-primary pr-10"
                aria-label={t("Senha atual", "Current password", "Contraseña actual")}
                placeholder="••••••••"
                required
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FieldRow>

          <FieldRow label={t("Nova senha", "New password", "Nueva contraseña")} sublabel={t("Mínimo 8 caracteres", "At least 8 characters", "Mínimo 8 caracteres")}>
            <div className="space-y-2">
              <div className="relative">
                <Input
                  type={showNext ? "text" : "password"}
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  className="font-mono h-10 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary focus-visible:border-primary pr-10"
                  aria-label={t("Nova senha", "New password", "Nueva contraseña")}
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

          <FieldRow label={t("Confirmar senha", "Confirm password", "Confirmar contraseña")} sublabel={t("Repita a nova senha", "Re-enter the new password", "Vuelve a escribir la nueva contraseña")}>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={`font-mono h-10 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary focus-visible:border-primary ${
                confirm && confirm !== next ? "border-destructive/60" : ""
              }`}
              aria-label={t("Confirmar senha", "Confirm password", "Confirmar contraseña")}
              placeholder="••••••••"
              required
            />
            {confirm && confirm !== next && (
              <p className="font-mono text-xs text-destructive mt-1">{t("As senhas não coincidem.", "Passwords do not match.", "Las contraseñas no coinciden.")}</p>
            )}
          </FieldRow>

          <div className="pt-4">
            <Button
              type="submit"
              disabled={saving || !current || !next || !confirm || next !== confirm}
              className="rounded-none font-mono uppercase text-xs tracking-widest h-10 px-6 btn-weapon-primary"
            >
              {saving ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />{t("Alterando...", "Changing...", "Cambiando...")}</> : t("Alterar senha", "Change password", "Cambiar contraseña")}
            </Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title={t("Sessão ativa", "Active session", "Sesión activa")} icon={ShieldCheck}>
        <FieldRow label="JWT" sublabel={t("Autenticação atual", "Current authentication", "Autenticación actual")}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" style={{ boxShadow: "0 0 8px hsl(var(--success))" }} />
            <span className="font-mono text-xs text-muted-foreground">{t("Sessão autenticada via JWT · Expira em 15 min (auto-renovado)", "Authenticated via JWT · Expires in 15 minutes (auto-renewed)", "Sesión autenticada mediante JWT · Vence en 15 min (renovación automática)")}</span>
          </div>
        </FieldRow>
        <FieldRow label="Refresh token" sublabel={t("Renovação automática", "Automatic renewal", "Renovación automática")}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-mono text-xs text-muted-foreground">{t("Válido por 30 dias · Armazenado localmente", "Valid for 30 days · Stored locally", "Válido durante 30 días · Almacenado localmente")}</span>
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
    description: "Conexão API, sincronização e gestão de contas Google Ads",
    category: "Mídia Paga",
    color: "text-cyan-400",
    fields: [
      { key: "accountId", label: "Customer ID", placeholder: "123-456-7890" },
      { key: "accountName", label: "Nome da Conta", placeholder: "Google Ads" },
      { key: "accessToken", label: "Developer Token", placeholder: "xxxx...", type: "password" },
    ],
  },
  {
    provider: "tiktok_ads",
    label: "TikTok Ads",
    description: "Conexão API, sincronização e gestão de contas TikTok Ads",
    category: "Mídia Paga",
    color: "text-pink-400",
    fields: [
      { key: "accountId", label: "Advertiser ID", placeholder: "6912345678901234567" },
      { key: "accountName", label: "Nome da Conta", placeholder: "TikTok Ads" },
      { key: "accessToken", label: "Access Token", placeholder: "act.xxxx...", type: "password" },
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

const INTEGRATION_COPY: Partial<Record<IntegrationProvider, {
  description: [string, string];
}>> = {
  whatsapp_business: { description: ["Automated message delivery and agent-powered auto-replies", "Envío automático de mensajes y respuestas automáticas con el agente"] },
  rd_station: { description: ["Email marketing and lead automation integrated with your launch", "Marketing por correo y automatización de leads integrados con tu lanzamiento"] },
  activecampaign: { description: ["CRM and email automation with advanced segmentation", "CRM y automatización de correo con segmentación avanzada"] },
  stripe: { description: ["International checkout · Card · PIX · Recurring payments · High conversion", "Pago internacional · Tarjeta · PIX · Pagos recurrentes · Alta conversión"] },
  paypal: { description: ["International checkout · Accepted in 200+ countries", "Pago internacional · Aceptado en más de 200 países"] },
  mercado_pago: { description: ["PIX · Bank slip · Card · Largest payment gateway in Latin America", "PIX · Boleto · Tarjeta · La pasarela de pago más grande de Latinoamérica"] },
  pagarme: { description: ["Brazilian gateway (Stone) · PIX · Bank slip · Card · Split payments", "Pasarela brasileña (Stone) · PIX · Boleto · Tarjeta · Pagos divididos"] },
  asaas: { description: ["First-party checkout · PIX · Bank slip · Card · No platform commission", "Pago propio · PIX · Boleto · Tarjeta · Sin comisión de plataforma"] },
  hotmart: { description: ["Digital product platform · Automatic sales webhooks", "Plataforma de productos digitales · Webhooks de ventas automáticos"] },
  kiwify: { description: ["Checkout and digital product management · Automatic lead conversion", "Pago y gestión de productos digitales · Conversión automática de leads"] },
  eduzz: { description: ["Brazilian digital product platform · Purchases trigger real-time automation", "Plataforma brasileña de productos digitales · Las compras activan automatizaciones en tiempo real"] },
  meta_ads: { description: ["Facebook and Instagram Ads · Campaign management and optimization", "Anuncios de Facebook e Instagram · Gestión y optimización de campañas"] },
  google_ads: { description: ["API connection, synchronization, and Google Ads account management", "Conexión API, sincronización y gestión de cuentas de Google Ads"] },
  tiktok_ads: { description: ["API connection, synchronization, and TikTok Ads account management", "Conexión API, sincronización y gestión de cuentas de TikTok Ads"] },
  telegram: { description: ["Automation bot and notifications through a Telegram channel", "Bot de automatización y notificaciones mediante un canal de Telegram"] },
  hubspot: { description: ["CRM and sales pipeline integrated with campaigns", "CRM y pipeline de ventas integrado con campañas"] },
  tiktok: { description: ["Automatically post organic TikTok videos and reels in sync with your launch calendar", "Publica automáticamente videos y reels orgánicos en TikTok, sincronizados con tu calendario de lanzamiento"] },
  instagram: { description: ["Automatically post organic content and stories in sync with your launch calendar", "Publica automáticamente contenido orgánico e historias, sincronizados con tu calendario de lanzamiento"] },
  resend: { description: ["High-deliverability transactional email and broadcasts through Resend", "Correos transaccionales y envíos masivos de alta entregabilidad con Resend"] },
};

const INTEGRATION_FIELD_COPY: Record<string, [string, string]> = {
  "Nome da Conta": ["Account name", "Nombre de la cuenta"],
  "Nome do Bot": ["Bot name", "Nombre del bot"],
  "Email / Nome da Conta": ["Email / Account name", "Correo / Nombre de la cuenta"],
  "Stripe Account ID (opcional)": ["Stripe Account ID (optional)", "ID de cuenta de Stripe (opcional)"],
  "Webhook URL (gerada pelo sistema)": ["Webhook URL (generated by the system)", "URL de webhook (generada por el sistema)"],
  "API Key do Asaas": ["Asaas API key", "Clave API de Asaas"],
  "Ambiente (production/sandbox)": ["Environment (production/sandbox)", "Entorno (production/sandbox)"],
  "Minha Empresa": ["My Company", "Mi empresa"],
  "Minha Loja": ["My Store", "Mi tienda"],
  "Minha AC": ["My ActiveCampaign", "Mi ActiveCampaign"],
  "Minha Kiwify": ["My Kiwify", "Mi Kiwify"],
  "Minha Conta Eduzz": ["My Eduzz Account", "Mi cuenta de Eduzz"],
  "Minha Conta Ads": ["My Ads Account", "Mi cuenta de anuncios"],
  "Meu Workspace Resend": ["My Resend Workspace", "Mi espacio de trabajo de Resend"],
  "Auto-gerada": ["Auto-generated", "Generada automáticamente"],
  "seu-client-id": ["your-client-id", "tu-client-id"],
  "@meubot": ["@mybot", "@mibot"],
  "@meucanal": ["@mychannel", "@micanal"],
};

function integrationDescription(t: ReturnType<typeof useUiText>, provider: IntegrationProvider, text: string) {
  const copy = INTEGRATION_COPY[provider]?.description;
  return copy ? t(text, copy[0], copy[1]) : text;
}

function integrationFieldText(t: ReturnType<typeof useUiText>, text: string) {
  const copy = INTEGRATION_FIELD_COPY[text];
  return copy ? t(text, copy[0], copy[1]) : text;
}

const CATEGORIES = ["Mensagens", "E-mail", "Checkout", "Plataformas", "Mídia Paga", "Social Orgânico", "CRM"];

// Organic social and paid-media authorization are intentionally separate.
const SOCIAL_OAUTH_PROVIDERS: Partial<Record<IntegrationProvider, "meta" | "tiktok">> = {
  instagram: "meta",
  facebook: "meta",
  tiktok: "tiktok",
};

const PAID_MEDIA_OAUTH_PROVIDERS: Partial<Record<IntegrationProvider, "meta_ads" | "tiktok_ads" | "google_ads">> = {
  meta_ads: "meta_ads",
  tiktok_ads: "tiktok_ads",
  google_ads: "google_ads",
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
  const t = useUiText();
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
            <h3 className="font-mono font-bold text-sm uppercase tracking-wide">{t("Conectar", "Connect", "Conectar")} {catalog.label}</h3>
            <p className="text-xs font-mono text-muted-foreground/60 mt-0.5">{integrationDescription(t, catalog.provider, catalog.description)}</p>
          </div>
          <button onClick={onClose} aria-label={t("Fechar", "Close", "Cerrar")} className="text-muted-foreground hover:text-foreground font-mono text-lg leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          {catalog.fields.map(f => (
            <div key={f.key} className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/70">{integrationFieldText(t, f.label)}</label>
              <input
                type={f.type ?? "text"}
                placeholder={integrationFieldText(t, f.placeholder)}
                value={fields[f.key] ?? ""}
                onChange={e => setFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full bg-background border border-border/50 px-3 py-2.5 text-sm font-mono rounded-none focus:outline-none focus:border-primary/60 transition-colors placeholder:text-muted-foreground/30"
              />
            </div>
          ))}
          <div className="bg-muted/10 border border-border/20 p-3">
            <p className="font-mono text-[11px] text-muted-foreground/50 leading-relaxed">
              {t("As credenciais são armazenadas de forma segura e criptografadas. Nunca compartilhamos com terceiros. Pagamentos nunca bloqueiam execução de campanhas.", "Credentials are stored securely and encrypted. We never share them with third parties. Payments never block campaign execution.", "Las credenciales se almacenan de forma segura y cifrada. Nunca las compartimos con terceros. Los pagos nunca bloquean la ejecución de campañas.")}
            </p>
          </div>
        </div>
        <div className="border-t border-border/50 px-5 py-4 flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-outline">{t("Cancelar", "Cancel", "Cancelar")}</Button>
          <Button onClick={handleConnect} disabled={loading}
            className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-primary gap-2">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
            {t("Conectar", "Connect", "Conectar")}
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
  const t = useUiText();
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
        {pct === 100 ? t("Compliance Completo", "Compliance complete", "Compliance completo") : t(`${pct}% preenchido`, `${pct}% complete`, `${pct}% completo`)}
      </span>
    </div>
  );
}

function ComplianceTab() {
  const t = useUiText();
  const { locale } = useUiLocale();
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
    if (raw.length !== 8) { toast.error(t("CEP inválido — 8 dígitos.", "Invalid postal code — 8 digits.", "Código postal no válido — 8 dígitos.")); return; }
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      const j = await r.json() as { logradouro?: string; bairro?: string; localidade?: string; uf?: string; erro?: boolean };
      if (j.erro) { toast.error(t("CEP não encontrado.", "Postal code not found.", "No se encontró el código postal.")); return; }
      setData(prev => ({
        ...prev,
        logradouro: j.logradouro ?? prev.logradouro,
        bairro: j.bairro ?? prev.bairro,
        cidade: j.localidade ?? prev.cidade,
        estado: j.uf ?? prev.estado,
        pais: "BR",
      }));
      toast.success(t("Endereço preenchido automaticamente.", "Address filled in automatically.", "Dirección completada automáticamente."));
    } catch { toast.error(t("Erro ao consultar CEP.", "Couldn't look up postal code.", "No se pudo consultar el código postal.")); }
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
      toast.success(t("Identificação salva com sucesso.", "Identification saved successfully.", "Identificación guardada correctamente."));
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/me/compliance"] });
    } catch { toast.error(t("Erro ao salvar identificação.", "Couldn't save identification.", "No se pudo guardar la identificación.")); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-40 bg-muted/20 animate-pulse border border-border/20" />)}
    </div>
  );

  const fmtDate = (iso?: string) => iso ? new Date(iso).toLocaleDateString(intlLocale(locale), { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }) : null;

  return (
    <div className="space-y-6">
      {/* Status header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-mono text-sm font-bold uppercase tracking-widest">{t("Identificação completa", "Complete identification", "Identificación completa")}</h2>
          <p className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest mt-0.5">LGPD · KYC · {t("Compliance total", "Full compliance", "Compliance total")}</p>
        </div>
        <ComplianceStatusBadge data={data} />
      </div>

      {/* ── Dados Pessoais ── */}
      <SectionCard title={t("Dados pessoais", "Personal details", "Datos personales")} icon={User}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">CPF</label>
            <input value={data.cpf ?? ""} onChange={e => set("cpf", e.target.value)}
              placeholder="000.000.000-00"
              className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">{t("Telefone", "Phone", "Teléfono")}</label>
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
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">{t("Data de nascimento", "Date of birth", "Fecha de nacimiento")}</label>
            <input type="date" value={data.birthdate ?? ""} onChange={e => set("birthdate", e.target.value)}
              className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none h-9" />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">{t("Nacionalidade", "Nationality", "Nacionalidad")}</label>
            <input value={data.nationality ?? ""} onChange={e => set("nationality", e.target.value)}
              placeholder={t("Brasileiro(a)", "Brazilian", "Brasileño/a")}
              className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">{t("Estado civil", "Marital status", "Estado civil")}</label>
            <select value={data.maritalStatus ?? ""} onChange={e => set("maritalStatus", e.target.value)}
              className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none h-9">
              <option value="">{t("Selecione", "Select", "Selecciona")}</option>
              {MARITAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(o.label, o.value === "single" ? "Single" : o.value === "married" ? "Married" : o.value === "divorced" ? "Divorced" : o.value === "widowed" ? "Widowed" : "Other", o.value === "single" ? "Soltero/a" : o.value === "married" ? "Casado/a" : o.value === "divorced" ? "Divorciado/a" : o.value === "widowed" ? "Viudo/a" : "Otro")}</option>)}
            </select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">{t("Gênero", "Gender", "Género")}</label>
            <div className="flex flex-wrap gap-2">
              {GENDER_OPTIONS.map(o => (
                <button key={o.value} onClick={() => set("gender", data.gender === o.value ? "" : o.value)}
                  className={`border px-3 py-1.5 font-mono text-[10px] transition-all ${data.gender === o.value ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground/60 hover:border-primary/40"}`}>
                  {t(o.label, o.value === "male" ? "Male" : o.value === "female" ? "Female" : o.value === "non_binary" ? "Non-binary" : "Prefer not to say", o.value === "male" ? "Masculino" : o.value === "female" ? "Femenino" : o.value === "non_binary" ? "No binario" : "Prefiero no decirlo")}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Dados Empresariais ── */}
      <SectionCard title={t("Dados empresariais", "Business details", "Datos de la empresa")} icon={Building2}>
        <div className="space-y-4">
          <div className="flex gap-2">
            {[{ id:"pf", label:"Pessoa Física" }, { id:"pj", label:"Pessoa Jurídica" }].map(o => (
              <button key={o.id} onClick={() => set("personType", o.id)}
                className={`border px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-all ${data.personType === o.id ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground/60 hover:border-primary/40"}`}>
                {t(o.label, o.id === "pf" ? "Individual" : "Business", o.id === "pf" ? "Persona física" : "Persona jurídica")}
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
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">{t("Inscrição estadual", "State registration", "Registro estatal")}</label>
                <input value={data.inscEstadual ?? ""} onChange={e => set("inscEstadual", e.target.value)}
                  placeholder={t("Isento ou número", "Exempt or number", "Exento o número")}
                  className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">{t("Razão social", "Legal business name", "Razón social")}</label>
                <input value={data.razaoSocial ?? ""} onChange={e => set("razaoSocial", e.target.value)}
                  placeholder={t("Nome na Receita Federal", "Name registered with the tax authority", "Nombre registrado ante la autoridad fiscal")}
                  className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">{t("Nome fantasia", "Trade name", "Nombre comercial")}</label>
                <input value={data.nomeFantasia ?? ""} onChange={e => set("nomeFantasia", e.target.value)}
                  placeholder={t("Nome comercial", "Business name", "Nombre comercial")}
                  className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Endereço ── */}
      <SectionCard title={t("Endereço", "Address", "Dirección")} icon={Globe}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1 md:col-span-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">{t("CEP", "Postal code (CEP)", "Código postal (CEP)")}</label>
            <div className="flex gap-2">
              <input value={data.cep ?? ""} onChange={e => set("cep", e.target.value)}
                placeholder="00000-000" maxLength={9}
                className="flex-1 font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
              <button onClick={() => void lookupCep()} disabled={cepLoading}
                className="border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary font-mono text-[10px] uppercase tracking-widest px-3 h-9 shrink-0 flex items-center gap-1.5 transition-colors disabled:opacity-50">
                {cepLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {t("Buscar", "Look up", "Buscar")}
              </button>
            </div>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">{t("Logradouro", "Street address", "Calle y dirección")}</label>
            <input value={data.logradouro ?? ""} onChange={e => set("logradouro", e.target.value)}
              placeholder={t("Rua, Av., Travessa…", "Street, Avenue, etc…", "Calle, avenida, etc.…")}
              className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">{t("Número", "Number", "Número")}</label>
            <input value={data.numero ?? ""} onChange={e => set("numero", e.target.value)}
              placeholder="123"
              className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">{t("Complemento", "Address line 2", "Complemento")}</label>
            <input value={data.complemento ?? ""} onChange={e => set("complemento", e.target.value)}
              placeholder={t("Apto, Sala, Bloco…", "Apartment, suite, building…", "Departamento, oficina, edificio…")}
              className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">{t("Bairro", "District / neighborhood", "Barrio")}</label>
            <input value={data.bairro ?? ""} onChange={e => set("bairro", e.target.value)}
              placeholder={t("Nome do bairro", "Neighbourhood", "Nombre del barrio")}
              className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">{t("Cidade", "City", "Ciudad")}</label>
            <input value={data.cidade ?? ""} onChange={e => set("cidade", e.target.value)}
              placeholder={t("São Paulo", "City", "Ciudad")}
              className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">{t("Estado", "State / region", "Estado / región")}</label>
            <select value={data.estado ?? ""} onChange={e => set("estado", e.target.value)}
              className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none h-9">
              <option value="">{t("UF", "State", "Estado")}</option>
              {STATES_BR.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">{t("País", "Country", "País")}</label>
            <input value={data.pais ?? ""} onChange={e => set("pais", e.target.value)}
              placeholder="BR"
              className="w-full font-mono text-xs bg-background/60 border border-border/50 focus:border-primary px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/30 h-9" />
          </div>
        </div>
      </SectionCard>

      {/* ── LGPD / Consentimentos ── */}
      <SectionCard title={t("LGPD — Consentimentos", "LGPD — Consents", "LGPD — Consentimientos")} icon={ShieldCheck}>
        <div className="space-y-4">
          <div className="border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="font-mono text-[10px] text-muted-foreground/70 leading-relaxed">
              {t("Em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018), registramos seus consentimentos de forma auditável com carimbo de data/hora. Você pode revogar qualquer consentimento a qualquer momento.", "In accordance with Brazil's General Data Protection Law (LGPD — Law No. 13,709/2018), we record your consent in an auditable way with a timestamp. You may revoke any consent at any time.", "De conformidad con la Ley General de Protección de Datos de Brasil (LGPD — Ley n.º 13.709/2018), registramos tus consentimientos de forma auditable y con fecha y hora. Puedes revocar cualquier consentimiento cuando quieras.")}
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
                    <span className={`font-mono text-[11px] font-bold uppercase tracking-widest ${granted ? "text-success" : "text-foreground/80"}`}>{t(consent.title, consent.key === "consentDataProcessing" ? "Data processing" : consent.key === "consentMarketing" ? "Marketing communications" : "Analytics and product improvement", consent.key === "consentDataProcessing" ? "Tratamiento de datos" : consent.key === "consentMarketing" ? "Comunicaciones de marketing" : "Analítica y mejora del producto")}</span>
                    {consent.required && <span className="font-mono text-[9px] border border-destructive/30 text-destructive px-1.5 py-0.5 uppercase tracking-widest">{t("Obrigatório", "Required", "Obligatorio")}</span>}
                    {granted && <span className="font-mono text-[9px] border border-success/30 text-success px-1.5 py-0.5 uppercase tracking-widest">{t("Concedido", "Granted", "Otorgado")}</span>}
                  </div>
                   <p className="font-mono text-[10px] text-muted-foreground/60 mt-1 leading-relaxed">{t(consent.desc, consent.key === "consentDataProcessing" ? "I authorise the processing of my personal data to operate the NexOS platform as described in the Privacy Policy." : consent.key === "consentMarketing" ? "I agree to receive communications about NexOS AI news, updates, and offers by email and WhatsApp." : "I agree to the anonymised use of platform usage data to improve products and services.", consent.key === "consentDataProcessing" ? "Autorizo el tratamiento de mis datos personales para operar la plataforma NexOS según se describe en la Política de privacidad." : consent.key === "consentMarketing" ? "Autorizo el envío de comunicaciones sobre novedades, actualizaciones y ofertas de NexOS AI por correo y WhatsApp." : "Autorizo el uso anonimizado de datos de uso de la plataforma para mejorar los productos y servicios.")}</p>
                  {granted && grantedAt && (
                    <p className="font-mono text-[9px] text-muted-foreground/40 mt-1">
                       {t("Consentido em:", "Consented on:", "Consentido el:")} {fmtDate(grantedAt)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* ── Direitos do Titular ── */}
      <SectionCard title={t("Direitos do titular (LGPD Art. 18)", "Data subject rights (LGPD Art. 18)", "Derechos del titular (LGPD Art. 18)")} icon={ExternalLink}>
        <div className="space-y-3">
          <p className="font-mono text-[10px] text-muted-foreground/60 leading-relaxed">
             {t("Conforme o Art. 18 da LGPD, você tem o direito de solicitar acesso, portabilidade ou exclusão dos seus dados pessoais. Utilize os botões abaixo para formalizar sua solicitação.", "Under Article 18 of the LGPD, you may request access to, portability of, or deletion of your personal data. Use the buttons below to submit a request.", "Según el artículo 18 de la LGPD, tienes derecho a solicitar acceso, portabilidad o eliminación de tus datos personales. Usa los botones de abajo para formalizar tu solicitud.")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
               { label: t("Acessar meus dados", "Access my data", "Acceder a mis datos"), icon: Eye, subject: t("Acesso aos Dados — LGPD Art. 18 II", "Data access — LGPD Art. 18 II", "Acceso a datos — LGPD Art. 18 II") },
               { label: t("Portabilidade", "Portability", "Portabilidad"), icon: Copy, subject: t("Portabilidade dos Dados — LGPD Art. 18 V", "Data portability — LGPD Art. 18 V", "Portabilidad de datos — LGPD Art. 18 V") },
               { label: t("Solicitar exclusão", "Request deletion", "Solicitar eliminación"), icon: XCircle, subject: t("Exclusão dos Dados — LGPD Art. 18 VI", "Data deletion — LGPD Art. 18 VI", "Eliminación de datos — LGPD Art. 18 VI") },
            ].map(item => (
              <a key={item.label}
                 href={`mailto:privacidade@nexos.ai?subject=${encodeURIComponent(item.subject)}&body=${encodeURIComponent(`${t("Olá, solicito o exercício do meu direito de:", "Hello, I am requesting to exercise my right to:", "Hola, solicito ejercer mi derecho de:")} ${item.subject}\n\n${t("Nome:", "Name:", "Nombre:")} ${""}\nWorkspace ID: `)}`}
                className="flex items-center gap-2 border border-border/40 bg-card/20 hover:border-primary/40 hover:bg-primary/5 px-4 py-3 transition-all group"
              >
                <item.icon className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 group-hover:text-primary transition-colors">{item.label}</span>
              </a>
            ))}
          </div>
          <p className="font-mono text-[9px] text-muted-foreground/30">
             {t("Prazo de resposta: até 15 dias úteis conforme Art. 23 LGPD · privacidade@nexos.ai", "Response time: up to 15 business days under LGPD Art. 23 · privacidade@nexos.ai", "Plazo de respuesta: hasta 15 días hábiles según el Art. 23 de la LGPD · privacidade@nexos.ai")}
          </p>
        </div>
      </SectionCard>

      {/* ── Last updated + Save ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {data.updatedAt && (
          <p className="font-mono text-[10px] text-muted-foreground/40">
             {t("Última atualização:", "Last updated:", "Última actualización:")} {fmtDate(data.updatedAt)}
          </p>
        )}
        <Button onClick={() => void handleSave()} disabled={saving}
          className="rounded-none font-mono uppercase tracking-widest text-xs h-10 px-6 btn-weapon-primary gap-2 ml-auto">
          {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{t("Salvando…", "Saving…", "Guardando…")}</> : <><CheckCircle2 className="h-3.5 w-3.5" />{t("Salvar identificação", "Save identification", "Guardar identificación")}</>}
        </Button>
      </div>
    </div>
  );
}

function IntegracaoTab() {
  const t = useUiText();
  const queryClient = useQueryClient();
  const [connectModal, setConnectModal] = useState<ConnectModalState | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("Todos");
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  // Show toast when redirected back from OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const count = params.get("count");
    const account = params.get("account");
    if (connected === "meta" && count) {
      toast.success(t(`${count} conta${Number(count) !== 1 ? "s" : ""} Meta conectada${Number(count) !== 1 ? "s" : ""} com sucesso!`, `${count} Meta account${Number(count) !== 1 ? "s" : ""} connected successfully!`, `¡${count} cuenta${Number(count) !== 1 ? "s" : ""} de Meta conectada${Number(count) !== 1 ? "s" : ""} correctamente!`));
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/me/integrations"] });
      // Clean up query params without full reload
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      url.searchParams.delete("count");
      window.history.replaceState({}, "", url.toString());
    } else if (connected === "tiktok" && account) {
      toast.success(t(`TikTok conectado: ${decodeURIComponent(account)}`, `TikTok connected: ${decodeURIComponent(account)}`, `TikTok conectado: ${decodeURIComponent(account)}`));
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/me/integrations"] });
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      url.searchParams.delete("account");
      window.history.replaceState({}, "", url.toString());
    }
  }, [queryClient, t]);

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
      toast.success(t("Integração conectada com sucesso!", "Integration connected successfully!", "¡Integración conectada correctamente!"));
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/me/integrations"] });
      setConnectModal(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const disconnectSocialMutation = useMutation({
    mutationFn: async (integrationId: string) =>
      customFetch(`/api/social/accounts/${integrationId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("Conta desconectada com sucesso.", "Account disconnected successfully.", "Cuenta desconectada correctamente."));
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces/me/integrations"] });
    },
    onError: () => toast.error(t("Erro ao desconectar conta.", "Couldn't disconnect account.", "No se pudo desconectar la cuenta.")),
  });

  const handleSocialOAuthConnect = async (platform: "meta" | "tiktok") => {
    setOauthLoading(platform);
    try {
      const { url } = await customFetch<{ url: string }>(`/api/social/connect/${platform}`);
      window.location.href = url;
    } catch {
      toast.error(t("Erro ao iniciar conexão OAuth. Verifique a configuração do app Meta/TikTok.", "Couldn't start OAuth connection. Check the Meta/TikTok app configuration.", "No se pudo iniciar la conexión OAuth. Revisa la configuración de la aplicación de Meta/TikTok."));
      setOauthLoading(null);
    }
  };

  const handlePaidMediaOAuthConnect = async (provider: "meta_ads" | "tiktok_ads" | "google_ads") => {
    setOauthLoading(provider);
    try {
      const { url } = await customFetch<{ url: string }>(`/api/integrations/oauth/start/${provider}`);
      window.location.href = url;
    } catch {
      toast.error(t("Erro ao iniciar a conexão da conta de anúncios. Você ainda pode usar a conexão manual via API.", "Couldn't start the ad account connection. You can still connect manually via API.", "No se pudo iniciar la conexión de la cuenta publicitaria. También puedes conectarla manualmente mediante API."));
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

      <MetaReviewReadinessPanel />

      {/* Connected integrations */}
      {integrations.length > 0 && (
       <SectionCard title={`${integrations.length} ${t("Integração", "Integration", "Integración")}${integrations.length > 1 ? t("ões ativas", "s active", "es activas") : t(" ativa", " active", " activa")}`} icon={Wifi}>
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
                      <Badge variant="outline" className="rounded-none font-mono text-[11px] border-orange-400/30 text-orange-400">{t("Pagamento", "Payment", "Pago")}</Badge>
                    )}
                    <Badge variant="outline" className={`rounded-none font-mono text-[11px] ${intg.status === "connected" ? "border-success/40 text-success" : intg.status === "error" ? "border-destructive/40 text-destructive" : "border-border/40 text-muted-foreground"}`}>
                      {intg.status === "connected" ? t("Conectado", "Connected", "Conectado") : intg.status === "error" ? t("Erro", "Error", "Error") : t("Desconectado", "Disconnected", "Desconectado")}
                    </Badge>
                    {isSocial && (
                      <button
                        aria-label={`${t("Desconectar", "Disconnect", "Desconectar")} ${intg.accountName ?? intg.provider}`}
                        onClick={() => disconnectSocialMutation.mutate(intg.id)}
                        disabled={disconnectSocialMutation.isPending}
                        className="p-1 text-muted-foreground/40 hover:text-destructive transition-colors disabled:opacity-50"
                        title={t("Desconectar conta", "Disconnect account", "Desconectar cuenta")}
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
              {t("Gateways de pagamento nunca bloqueiam execução de campanhas", "Payment gateways never block campaign execution", "Las pasarelas de pago nunca bloquean la ejecución de campañas")}
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
             {cat === "Todos" ? t("Todos", "All", "Todas") : t(cat, cat === "Mensagens" ? "Messaging" : cat === "E-mail" ? "Email" : cat === "Checkout" ? "Checkout" : cat === "Plataformas" ? "Platforms" : cat === "Mídia Paga" ? "Paid media" : cat === "Social Orgânico" ? "Organic social" : "CRM", cat === "Mensagens" ? "Mensajería" : cat === "E-mail" ? "Correo" : cat === "Checkout" ? "Pago" : cat === "Plataformas" ? "Plataformas" : cat === "Mídia Paga" ? "Medios pagados" : cat === "Social Orgânico" ? "Redes orgánicas" : "CRM")}
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
            const socialOauthPlatform = SOCIAL_OAUTH_PROVIDERS[intg.provider];
            const paidMediaOauthProvider = PAID_MEDIA_OAUTH_PROVIDERS[intg.provider];
            const isConnected = connectedProviders.has(intg.provider);
            const existing = integrations.find(i => i.provider === intg.provider);
            const connectedAccounts = paidMediaOauthProvider
              ? integrations.filter(integration => integration.provider === intg.provider)
              : socialAccountsByProvider.get(intg.provider) ?? [];

            // OAuth providers — paid-media accounts use their own purpose-scoped route.
            if (socialOauthPlatform || paidMediaOauthProvider) {
              const oauthKey = paidMediaOauthProvider ?? socialOauthPlatform!;
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
                    <div className="text-[11px] font-mono text-muted-foreground/50 uppercase tracking-widest mb-1">{t(intg.category, intg.category === "Mensagens" ? "Messaging" : intg.category === "E-mail" ? "Email" : intg.category === "Checkout" ? "Checkout" : intg.category === "Plataformas" ? "Platforms" : intg.category === "Mídia Paga" ? "Paid media" : intg.category === "Social Orgânico" ? "Organic social" : "CRM", intg.category === "Mensagens" ? "Mensajería" : intg.category === "E-mail" ? "Correo" : intg.category === "Checkout" ? "Pago" : intg.category === "Plataformas" ? "Plataformas" : intg.category === "Mídia Paga" ? "Medios pagados" : intg.category === "Social Orgânico" ? "Redes orgánicas" : "CRM")}</div>
                    <p className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed">{integrationDescription(t, intg.provider, intg.description)}</p>
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
                          {!paidMediaOauthProvider && (
                            <button
                              aria-label={`${t("Desconectar", "Disconnect", "Desconectar")} ${acc.accountName}`}
                              onClick={() => disconnectSocialMutation.mutate(acc.id)}
                              disabled={disconnectSocialMutation.isPending}
                              className="ml-2 p-1 text-muted-foreground/40 hover:text-destructive transition-colors shrink-0 disabled:opacity-50"
                              title={t("Desconectar", "Disconnect", "Desconectar")}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => paidMediaOauthProvider
                      ? handlePaidMediaOAuthConnect(paidMediaOauthProvider)
                      : handleSocialOAuthConnect(socialOauthPlatform!)}
                    disabled={oauthLoading === oauthKey}
                    className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 btn-weapon-outline"
                  >
                    {oauthLoading === oauthKey ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : (
                      <Plus className="h-2.5 w-2.5" />
                    )}
                    {connectedAccounts.length > 0 ? t("Adicionar outra conta", "Add another account", "Añadir otra cuenta") : t("Conectar", "Connect", "Conectar")}
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
                    <div className="text-[11px] font-mono text-muted-foreground/50 uppercase tracking-widest mb-1">{t(intg.category, intg.category === "Mensagens" ? "Messaging" : intg.category === "E-mail" ? "Email" : intg.category === "Checkout" ? "Checkout" : intg.category === "Plataformas" ? "Platforms" : intg.category === "Mídia Paga" ? "Paid media" : intg.category === "Social Orgânico" ? "Organic social" : "CRM", intg.category === "Mensagens" ? "Mensajería" : intg.category === "E-mail" ? "Correo" : intg.category === "Checkout" ? "Pago" : intg.category === "Plataformas" ? "Plataformas" : intg.category === "Mídia Paga" ? "Medios pagados" : intg.category === "Social Orgânico" ? "Redes orgánicas" : "CRM")}</div>
                   <p className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed">{integrationDescription(t, intg.provider, intg.description)}</p>
                </div>
                {isConnected ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-success" />
                    <span className="font-mono text-xs text-success">
                      {existing?.accountName ? `${t("Conectado:", "Connected:", "Conectado:")} ${existing.accountName}` : t("Conectado", "Connected", "Conectado")}
                    </span>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConnectModal({ provider: intg.provider, label: intg.label })}
                    className="rounded-none font-mono uppercase text-[11px] tracking-widest h-7 gap-1.5 btn-weapon-outline"
                  >
                    <Plus className="h-2.5 w-2.5" />{t("Conectar", "Connect", "Conectar")}
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
  const t = useUiText();
  const { locale } = useUiLocale();
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
      toast.error(t("Erro ao salvar preferência de vídeo.", "Couldn't save video preference.", "No se pudo guardar la preferencia de video."));
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
      setCloneError(t("Microfone não disponível — verifique as permissões do navegador.", "Microphone unavailable — check your browser permissions.", "Micrófono no disponible: comprueba los permisos del navegador."));
    }
  }, [t]);

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
      toast.success(t("Voz clonada com sucesso! Voice ID: ", "Voice cloned successfully! Voice ID: ", "¡Voz clonada correctamente! Voice ID: ") + result.voiceCloneId.slice(0, 8) + "…");
    } catch (err: unknown) {
       const msg = err instanceof Error ? err.message : t("Erro ao clonar voz", "Couldn't clone voice", "No se pudo clonar la voz");
      setCloneError(msg);
      setRecState("recorded");
    }
  }, [audioBase64, audioMime, t, voiceName]);

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
      toast.success(t("Identidade salva — agentes usarão seu perfil nos próximos vídeos.", "Identity saved — agents will use your profile in future videos.", "Identidad guardada: los agentes usarán tu perfil en los próximos videos."));
    } catch {
      toast.error(t("Erro ao salvar identidade.", "Couldn't save identity.", "No se pudo guardar la identidad."));
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
      <SectionCard title={t("Clone Studio — Estilo de Vídeo", "Clone Studio — Video style", "Clone Studio — Estilo de video")} icon={Video}>
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
                <span className={`font-mono text-[11px] font-bold uppercase tracking-widest ${videoProductionStyle === "no_face" ? "text-primary" : "text-foreground"}`}>{t("Sem Face", "Faceless", "Sin rostro")}</span>
                {videoProductionStyle === "no_face" && <Badge className="ml-auto rounded-none font-mono text-[9px] px-1.5 py-0 bg-primary/20 text-primary border-primary/30">{t("Ativo", "Active", "Activo")}</Badge>}
              </div>
              <p className="font-mono text-[10px] text-muted-foreground/60 leading-relaxed">
                {t("Narração com IA + animações + texto na tela. Nenhuma aparição sua.", "AI voiceover + animations + on-screen text. No appearance required.", "Narración con IA, animaciones y texto en pantalla. No tienes que aparecer.")}
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
                <span className={`font-mono text-[11px] font-bold uppercase tracking-widest ${videoProductionStyle === "clone" ? "text-primary" : "text-foreground"}`}>{t("Com Clone", "With clone", "Con clon")}</span>
                {cloneSessionId && videoProductionStyle === "clone" && <Badge className="ml-auto rounded-none font-mono text-[9px] px-1.5 py-0 bg-primary/20 text-primary border-primary/30">{t("Ativo", "Active", "Activo")}</Badge>}
                {cloneSessionId && videoProductionStyle !== "clone" && <Badge className="ml-auto rounded-none font-mono text-[9px] px-1.5 py-0 bg-green-500/10 text-green-400 border-green-500/30">{t("Pronto", "Ready", "Listo")}</Badge>}
                {!cloneSessionId && <Badge className="ml-auto rounded-none font-mono text-[9px] px-1.5 py-0 bg-muted/20 text-muted-foreground/50 border-border/30">{t("Criar clone", "Create clone", "Crear clon")}</Badge>}
              </div>
              <p className="font-mono text-[10px] text-muted-foreground/60 leading-relaxed">
                {t("Vídeos com seu rosto e voz clonada. Requer captura de 5 min.", "Videos with your face and cloned voice. Requires a 5-minute capture.", "Videos con tu rostro y voz clonada. Requiere una captura de 5 minutos.")}
              </p>
            </button>
          </div>

          {/* Clone captured status */}
          {cloneSessionId && (
            <div className="flex items-center gap-3 px-4 py-3 border border-green-500/20 bg-green-500/5">
              <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
              <div className="flex-1">
                 <div className="font-mono text-[11px] font-bold text-green-300">{t("Clone de vídeo capturado", "Video clone captured", "Clon de video capturado")}</div>
                 <div className="font-mono text-[10px] text-muted-foreground/60">{t("Sessão:", "Session:", "Sesión:")} {cloneSessionId.slice(0, 12)}… · {t("Disponível para CPL e VSL", "Available for CPL and VSL", "Disponible para CPL y VSL")}</div>
              </div>
            </div>
          )}

          <div className="font-mono text-[9px] text-muted-foreground/30 leading-relaxed">
             {t("Esta preferência se aplica a todos os CPLs e VSLs gerados pelos agentes. Você pode mudar a qualquer momento — as próximas gerações usarão o novo estilo.", "This preference applies to all CPLs and VSLs generated by agents. You can change it anytime — future generations will use the new style.", "Esta preferencia se aplica a todos los CPL y VSL generados por los agentes. Puedes cambiarla cuando quieras; las próximas generaciones usarán el nuevo estilo.")}
          </div>
        </div>
      </SectionCard>

      {/* ── Status Banner ── */}
      <div className="border border-border/40 bg-card/30 px-5 py-4 flex items-center gap-4">
        <Fingerprint className="h-6 w-6 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
           <div className="font-mono text-xs font-bold text-foreground uppercase tracking-widest">{t("Identidade digital do lançador", "Launch operator digital identity", "Identidad digital del operador de lanzamientos")}</div>
          <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">
             {t("Sua voz, presença e trejeitos são injetados nos roteiros e vídeos gerados pelos agentes NexOS", "Your voice, presence, and mannerisms are incorporated into scripts and videos generated by NexOS agents", "Tu voz, presencia y gestos se incorporan a los guiones y videos generados por los agentes de NexOS")}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Badge variant="outline" className={`rounded-none font-mono text-[10px] px-2 py-0.5 ${persona.voiceCloneId ? "text-green-400 border-green-400/40 bg-green-400/10" : "text-muted-foreground/50"}`}>
             {persona.voiceCloneId ? t("✓ Voz clonada", "✓ Voice cloned", "✓ Voz clonada") : t("Voz: Pendente", "Voice: Pending", "Voz: Pendiente")}
          </Badge>
          <Badge variant="outline" className={`rounded-none font-mono text-[10px] px-2 py-0.5 ${persona.heygenAvatarId ? "text-blue-400 border-blue-400/40 bg-blue-400/10" : "text-muted-foreground/50"}`}>
             {persona.heygenAvatarId ? t("✓ Avatar ativo", "✓ Avatar active", "✓ Avatar activo") : t("Avatar: Pendente", "Avatar: Pending", "Avatar: Pendiente")}
          </Badge>
        </div>
      </div>

      {/* ── Seção 1: Clone de Voz ── */}
      <SectionCard title={t("Clone de voz", "Voice clone", "Clon de voz")} icon={Headphones}>
        <div className="space-y-4">
          {/* Status atual */}
          {persona.voiceCloneId && (
            <div className="flex items-center gap-3 px-4 py-3 border border-green-500/20 bg-green-500/5">
              <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
              <div>
                 <div className="font-mono text-[11px] font-bold text-green-300">{t("Voz clonada com sucesso", "Voice cloned successfully", "Voz clonada correctamente")}</div>
                <div className="font-mono text-[10px] text-muted-foreground/60">
                  Voice ID: <span className="text-green-400/80">{persona.voiceCloneId}</span>
                   {persona.voiceCloneUpdatedAt && ` · ${new Date(persona.voiceCloneUpdatedAt).toLocaleDateString(intlLocale(locale))}`}
                </div>
              </div>
            </div>
          )}

          <FieldRow label={t("Nome da voz", "Voice name", "Nombre de la voz")} sublabel={t("Identificação da voz clonada", "Voice clone identifier", "Identificación de la voz clonada")}>
            <Input
              value={voiceName}
              onChange={e => setVoiceName(e.target.value)}
              placeholder={t("Ex: João — Voz NexOS", "e.g. Alex — NexOS voice", "Ej.: Alex — Voz de NexOS")}
              className="font-mono h-9 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary text-sm"
            />
          </FieldRow>

          <FieldRow label={t("Amostras de voz", "Voice samples", "Muestras de voz")} sublabel={t("30–120 segundos falando naturalmente. Quanto mais variado, melhor o clone.", "Speak naturally for 30–120 seconds. More variety improves the clone.", "Habla con naturalidad durante 30–120 segundos. Cuanta más variedad, mejor será el clon.")}>
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
                    {recState === "done" || recState === "recorded" ? t("Regravar", "Record again", "Volver a grabar") : t("Gravar áudio", "Record audio", "Grabar audio")}
                  </Button>
                ) : recState === "recording" ? (
                  <Button
                    size="sm"
                    onClick={stopRecording}
                    className="rounded-none font-mono text-[10px] uppercase tracking-widest h-8 px-3 gap-2 animate-pulse"
                    style={{ background: "rgba(239,68,68,0.25)", border: "1px solid rgba(239,68,68,0.6)", color: "#ef4444" }}
                  >
                    <Square className="h-3 w-3 fill-red-500" />
                    {t("Parar", "Stop", "Detener")} — {fmt(recSeconds)}
                  </Button>
                ) : null}

                <span className="font-mono text-[10px] text-muted-foreground/40">{t("ou", "or", "o")}</span>

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
                    <span><Upload className="h-3.5 w-3.5" />{t("Enviar arquivo", "Upload file", "Subir archivo")}</span>
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
                    title={t("Excluir gravação e recomeçar", "Delete recording and start over", "Eliminar grabación y empezar de nuevo")}
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
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{t("Clonando voz com IA…", "Cloning voice with AI…", "Clonando voz con IA…")}</>
                    : <><Sparkles className="h-3.5 w-3.5" />{t("Clonar minha voz com IA", "Clone my voice with AI", "Clonar mi voz con IA")}</>}
                </Button>
              )}

              {cloneError && (
                <div className="border border-red-500/20 bg-red-500/5 px-4 py-3">
                  <div className="font-mono text-[10px] text-red-400">{cloneError}</div>
                </div>
              )}

              <div className="font-mono text-[9px] text-muted-foreground/30 leading-relaxed">
                 {t("Fale naturalmente por 30–120s. Inclua variações de tom, pausas, entusiasmo. Evite ruído de fundo. Seu Voice ID é armazenado com segurança e usado apenas em vídeos desta conta.", "Speak naturally for 30–120 seconds. Vary your tone, pauses, and energy. Avoid background noise. Your Voice ID is stored securely and used only in videos for this account.", "Habla con naturalidad durante 30–120 segundos. Varía el tono, las pausas y la energía. Evita el ruido de fondo. Tu Voice ID se almacena de forma segura y solo se usa en videos de esta cuenta.")}
              </div>
            </div>
          </FieldRow>
        </div>
      </SectionCard>

      {/* ── Seção 2: Avatar Digital ── */}
      <SectionCard title={t("Avatar digital", "Digital avatar", "Avatar digital")} icon={Camera}>
        <div className="space-y-4">

          {/* Clone capturado */}
          {cloneSessionId ? (
            <div className="flex items-center gap-3 px-4 py-3 border border-green-500/20 bg-green-500/5">
              <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[11px] font-bold text-green-300">{t("Clone de avatar capturado", "Avatar clone captured", "Clon de avatar capturado")}</div>
                <div className="font-mono text-[10px] text-muted-foreground/60">
                  {t("Sessão:", "Session:", "Sesión:")} {cloneSessionId.slice(0, 12)}… · {t("Disponível para CPL e VSL", "Available for CPL and VSL", "Disponible para CPL y VSL")}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate("/clone-digital")}
                className="shrink-0 rounded-none font-mono text-[10px] uppercase tracking-widest h-8 px-3 gap-1.5 border-green-500/30 text-green-400 hover:bg-green-500/10"
              >
                <Camera className="h-3 w-3" /> {t("Regravar", "Record again", "Volver a grabar")}
              </Button>
            </div>
          ) : (
            <div className="flex items-start gap-3 px-4 py-3 border border-border/40 bg-background/30">
              <Camera className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[11px] font-bold text-foreground">{t("Nenhum clone gravado", "No clone recorded", "No hay ningún clon grabado")}</div>
                <div className="font-mono text-[10px] text-muted-foreground/60">
                  {t("Grave 5 takes guiados (~5 min) para criar vídeos com seu rosto e voz clonada.", "Record 5 guided takes (~5 min) to create videos with your face and cloned voice.", "Graba 5 tomas guiadas (~5 min) para crear videos con tu rostro y voz clonada.")}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => navigate("/clone-digital")}
                className="shrink-0 rounded-none font-mono text-[10px] uppercase tracking-widest h-8 px-3 gap-1.5"
                style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.35)", color: "hsl(var(--primary))" }}
              >
                <Camera className="h-3 w-3" /> {t("Gravar", "Record", "Grabar")}
              </Button>
            </div>
          )}

          <div className="font-mono text-[9px] text-muted-foreground/30 leading-relaxed">
            {t("Com sua identidade configurada, os vídeos de lançamento gerados pelo NexOS AI usarão seu perfil de voz clonada automaticamente.", "Once your identity is configured, NexOS AI will automatically use your cloned voice profile in generated launch videos.", "Una vez configurada tu identidad, NexOS AI usará automáticamente tu perfil de voz clonada en los videos de lanzamiento.")}
          </div>
        </div>
      </SectionCard>

      {/* ── Seção 3: Trejeitos & Presença ── */}
      <SectionCard title={t("Trejeitos & Estilo de presença", "Mannerisms & presence style", "Gestos y estilo de presencia")} icon={Sparkles}>
        <div className="space-y-0">
          <FieldRow label={t("Energia", "Energy", "Energía")} sublabel={t("Como você naturalmente se apresenta", "How you naturally present yourself", "Cómo te presentas de forma natural")}>
            <select value={energia} onChange={e => setEnergia(e.target.value)} className={SEL_BASE}>
              <option value="">{t("Selecionar…", "Select…", "Seleccionar…")}</option>
              <option value="baixa">{t("Calma / Reflexiva", "Calm / Reflective", "Tranquila / Reflexiva")}</option>
              <option value="moderada">{t("Equilibrada", "Balanced", "Equilibrada")}</option>
              <option value="alta">{t("Energética / Dinâmica", "Energetic / Dynamic", "Enérgica / Dinámica")}</option>
              <option value="muito_alta">{t("Explosiva / Alta voltagem", "Explosive / High energy", "Explosiva / Alta energía")}</option>
            </select>
          </FieldRow>

          <FieldRow label={t("Velocidade de fala", "Speaking pace", "Velocidad al hablar")} sublabel={t("Ritmo natural de como você fala", "Your natural speaking pace", "Tu ritmo natural al hablar")}>
            <select value={velocidade} onChange={e => setVelocidade(e.target.value)} className={SEL_BASE}>
              <option value="">{t("Selecionar…", "Select…", "Seleccionar…")}</option>
              <option value="lenta">{t("Lenta / Pausada", "Slow / Measured", "Lenta / Pausada")}</option>
              <option value="moderada">{t("Moderada", "Moderate", "Moderada")}</option>
              <option value="rapida">{t("Rápida / Fluida", "Fast / Fluid", "Rápida / Fluida")}</option>
              <option value="variavel">{t("Variável (muda conforme contexto)", "Variable (changes with context)", "Variable (cambia según el contexto)")}</option>
            </select>
          </FieldRow>

          <FieldRow label={t("Uso de pausas", "Use of pauses", "Uso de pausas")} sublabel={t("Como você usa silêncio para impacto", "How you use silence for emphasis", "Cómo usas el silencio para dar énfasis")}>
            <select value={pausas} onChange={e => setPausas(e.target.value)} className={SEL_BASE}>
              <option value="">{t("Selecionar…", "Select…", "Seleccionar…")}</option>
              <option value="frequentes">{t("Frequentes — gosto de deixar respirar", "Frequent — I like to leave room", "Frecuentes — me gusta dejar espacio")}</option>
              <option value="estrategicas">{t("Estratégicas — só nos momentos-chave", "Strategic — only at key moments", "Estratégicas — solo en momentos clave")}</option>
              <option value="minimas">{t("Mínimas — falo de forma contínua", "Minimal — I speak continuously", "Mínimas — hablo de forma continua")}</option>
            </select>
          </FieldRow>

          <FieldRow label={t("Gestos", "Gestures", "Gestos")} sublabel={t("Uso de mãos e corpo", "Use of hands and body", "Uso de las manos y el cuerpo")}>
            <select value={gestos} onChange={e => setGestos(e.target.value)} className={SEL_BASE}>
              <option value="">{t("Selecionar…", "Select…", "Seleccionar…")}</option>
              <option value="discretos">{t("Discretos / Contidos", "Subtle / Restrained", "Discretos / Contenidos")}</option>
              <option value="moderados">{t("Moderados", "Moderate", "Moderados")}</option>
              <option value="expressivos">{t("Expressivos", "Expressive", "Expresivos")}</option>
              <option value="muito_expressivos">{t("Muito expressivos / Amplificados", "Very expressive / Exaggerated", "Muy expresivos / Amplificados")}</option>
            </select>
          </FieldRow>

          <FieldRow label={t("Tom de comunicação", "Communication tone", "Tono de comunicación")} sublabel={t("Estilo dominante de como você fala", "Your dominant speaking style", "Tu estilo predominante al hablar")}>
            <Input
              value={tom}
              onChange={e => setTom(e.target.value)}
              placeholder={t("Ex: consultivo-direto, professor-mentor, provocador-estratégico…", "e.g. direct consultant, mentor-teacher, strategic provocateur…", "Ej.: consultivo y directo, profesor y mentor, provocador estratégico…")}
              className="font-mono h-9 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary text-sm"
            />
          </FieldRow>

          <FieldRow label={t("Trejeitos", "Mannerisms", "Gestos y expresiones")} sublabel={t("Expressões, vícios de linguagem, manias específicas", "Expressions, speech habits, and quirks", "Expresiones, muletillas y hábitos específicos")}>
            <Textarea
              value={trejeitos}
              onChange={e => setTrejeitos(e.target.value)}
              placeholder={t("Ex: Começo frases com 'olha...', uso bastante a palavra 'resultado', faço pausa antes de revelar o ponto principal, tenho o hábito de repetir a última palavra com ênfase...", "e.g. I start sentences with 'look…', often say 'results', pause before the main point, and repeat the last word for emphasis…", "Ej.: Empiezo frases con «mira…», repito mucho «resultado», hago una pausa antes de revelar el punto clave y suelo enfatizar la última palabra…")}
              className="font-mono text-xs rounded-none bg-background/60 border-border/50 focus-visible:ring-primary resize-none"
              rows={4}
            />
          </FieldRow>
        </div>
      </SectionCard>

      {/* ── Seção 4: Marca Pessoal ── */}
      <SectionCard title={t("Marca pessoal & estilo de vídeo", "Personal brand & video style", "Marca personal y estilo de video")} icon={Wand2}>
        <div className="space-y-0">
          <FieldRow label={t("Presença de marca", "Brand presence", "Presencia de marca")} sublabel={t("Como você se posiciona e se apresenta ao mercado", "How you position yourself in the market", "Cómo te posicionas y presentas en el mercado")}>
            <Textarea
              value={brandPresence}
              onChange={e => setBrandPresence(e.target.value)}
              placeholder={t("Ex: Me posiciono como especialista em resultados rápidos para empreendedoras femininas. Minha identidade é de quem já passou pela dor, transformou, e agora ensina. Tom: direto, sem rodeios, com empat…", "e.g. I position myself as an expert in fast results for women entrepreneurs. My identity is someone who has experienced the struggle, transformed, and now teaches. Tone: direct, candid, empathetic…", "Ej.: Me posiciono como especialista en resultados rápidos para emprendedoras. Mi identidad es la de alguien que vivió el problema, se transformó y ahora enseña. Tono: directo, claro y empático…")}
              className="font-mono text-xs rounded-none bg-background/60 border-border/50 focus-visible:ring-primary resize-none"
              rows={3}
            />
          </FieldRow>

          <FieldRow label={t("Estilo de Reels", "Reels style", "Estilo de Reels")} sublabel={t("Como você estrutura e entrega seus vídeos curtos", "How you structure and deliver short-form videos", "Cómo estructuras y presentas tus videos cortos")}>
            <Textarea
              value={reelStyle}
              onChange={e => setReelStyle(e.target.value)}
              placeholder={t("Ex: Começo sempre com uma pergunta provocadora nos primeiros 3 segundos. Uso cortes rápidos. Fecho com uma frase de impacto antes do CTA. Prefiro cenário externo com luz natural…", "e.g. I open with a provocative question in the first 3 seconds, use quick cuts, and end with an impactful line before the CTA. I prefer outdoor settings with natural light…", "Ej.: Empiezo con una pregunta provocadora durante los primeros 3 segundos, uso cortes rápidos y cierro con una frase impactante antes del CTA. Prefiero exteriores con luz natural…")}
              className="font-mono text-xs rounded-none bg-background/60 border-border/50 focus-visible:ring-primary resize-none"
              rows={3}
            />
          </FieldRow>
        </div>
      </SectionCard>

      {/* ── Seção 5: Lifestyle & Preferências Pessoais ── */}
      <SectionCard title={t("Lifestyle & preferências pessoais", "Lifestyle & personal preferences", "Estilo de vida y preferencias personales")} icon={Wand2}>
        <p className="text-[11px] text-muted-foreground/60 mb-4 leading-relaxed">
          {t("Os agentes de roteiro e direção visual usam esses dados para enriquecer", "Script and art direction agents use this information to automatically enrich", "Los agentes de guion y dirección visual usan estos datos para enriquecer")} <strong className="text-muted-foreground/80">{t("automaticamente", "automatically", "automáticamente")}</strong> {t("o", "the", "el")}{" "}
          <code className="font-mono text-[10px]">visualDirection</code> e os scripts de vídeo — adereços, cenários, hobbies e referências que aparecem de forma natural nos conteúdos, sem que você precise especificar em cada post.
        </p>
        <div className="space-y-0">
          <FieldRow label={t("Hobbies & esportes", "Hobbies & sports", "Aficiones y deportes")} sublabel={t("O que você pratica no tempo livre", "What you do in your free time", "Qué practicas en tu tiempo libre")}>
            <Input
              value={lsHobbies}
              onChange={e => setLsHobbies(e.target.value)}
              placeholder={t("Ex: golfe, mergulho, automobilismo, equitação, pesca esportiva", "e.g. golf, diving, motorsports, horseback riding, sport fishing", "Ej.: golf, buceo, automovilismo, equitación, pesca deportiva")}
              className="font-mono h-9 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary text-sm"
            />
          </FieldRow>
          <FieldRow label={t("Gastronomia", "Food & drink", "Gastronomía")} sublabel={t("Culinária, restaurantes, bebidas favoritas", "Favorite cuisines, restaurants, and drinks", "Cocinas, restaurantes y bebidas favoritas")}>
            <Input
              value={lsGastronomy}
              onChange={e => setLsGastronomy(e.target.value)}
              placeholder={t("Ex: japonesa, italiana, vinhos naturais, whisky japonês, fine dining", "e.g. Japanese, Italian, natural wines, Japanese whisky, fine dining", "Ej.: japonesa, italiana, vinos naturales, whisky japonés, alta cocina")}
              className="font-mono h-9 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary text-sm"
            />
          </FieldRow>
          <FieldRow label={t("Veículos", "Vehicles", "Vehículos")} sublabel={t("Carros, motos, embarcações ou aeronaves", "Cars, motorcycles, boats, or aircraft", "Coches, motos, embarcaciones o aeronaves")}>
            <Input
              value={lsVehicles}
              onChange={e => setLsVehicles(e.target.value)}
              placeholder={t("Ex: Porsche 911 GT3 RS, lancha Azimut 50, Ferrari SF90", "e.g. Porsche 911 GT3 RS, Azimut 50 yacht, Ferrari SF90", "Ej.: Porsche 911 GT3 RS, yate Azimut 50, Ferrari SF90")}
              className="font-mono h-9 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary text-sm"
            />
          </FieldRow>
          <FieldRow label={t("Adereços & acessórios", "Props & accessories", "Atrezzo y accesorios")} sublabel={t("Relógios, joias, peças de vestuário icônicas", "Watches, jewelry, and iconic clothing", "Relojes, joyas y prendas icónicas")}>
            <Input
              value={lsAccessories}
              onChange={e => setLsAccessories(e.target.value)}
              placeholder={t("Ex: Richard Mille RM 11-03 (casual), Rolex Daytona (formal), Air Jordan 1 Chicago", "e.g. Richard Mille RM 11-03 (casual), Rolex Daytona (formal), Air Jordan 1 Chicago", "Ej.: Richard Mille RM 11-03 (informal), Rolex Daytona (formal), Air Jordan 1 Chicago")}
              className="font-mono h-9 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary text-sm"
            />
          </FieldRow>
          <FieldRow label={t("Cenários favoritos", "Favorite settings", "Escenarios favoritos")} sublabel={t("Locais, ambientes e paisagens de referência", "Reference locations, environments, and landscapes", "Lugares, ambientes y paisajes de referencia")}>
            <Input
              value={lsScenarios}
              onChange={e => setLsScenarios(e.target.value)}
              placeholder={t("Ex: Alpes suíços, Maldivas, Quinta em Trás-os-Montes, penthouse vista para o mar", "e.g. Swiss Alps, Maldives, countryside estate, penthouse with ocean views", "Ej.: Alpes suizos, Maldivas, finca rural, ático con vistas al mar")}
              className="font-mono h-9 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary text-sm"
            />
          </FieldRow>
          <FieldRow label={t("Países & destinos", "Countries & destinations", "Países y destinos")} sublabel={t("Países com que você tem afinidade ou frequenta", "Countries you feel connected to or visit often", "Países con los que tienes afinidad o que visitas con frecuencia")}>
            <Input
              value={lsCountries}
              onChange={e => setLsCountries(e.target.value)}
              placeholder={t("Ex: Portugal, Japão, Maldivas, Mônaco, Dubai, Itália", "e.g. Portugal, Japan, Maldives, Monaco, Dubai, Italy", "Ej.: Portugal, Japón, Maldivas, Mónaco, Dubái, Italia")}
              className="font-mono h-9 rounded-none bg-background/60 border-border/50 focus-visible:ring-primary text-sm"
            />
          </FieldRow>
          <FieldRow label={t("Outros elementos", "Other details", "Otros elementos")} sublabel={t("Qualquer detalhe de estilo de vida relevante", "Any other relevant lifestyle details", "Cualquier otro detalle relevante sobre tu estilo de vida")}>
            <Textarea
              value={lsOther}
              onChange={e => setLsOther(e.target.value)}
              placeholder={t("Ex: colecionador de arte contemporânea, frequenta leilões em Londres, pratica meditação diária, tem uma adega com mais de 300 rótulos…", "e.g. contemporary art collector, attends auctions in London, meditates daily, has a wine cellar with over 300 labels…", "Ej.: coleccionista de arte contemporáneo, asiste a subastas en Londres, medita a diario, tiene una bodega con más de 300 referencias…")}
              className="font-mono text-xs rounded-none bg-background/60 border-border/50 focus-visible:ring-primary resize-none"
              rows={3}
            />
          </FieldRow>
        </div>
      </SectionCard>

      {/* ── Save Button ── */}
      <div className="flex items-center justify-between pt-2 border-t border-border/30">
        <div className="font-mono text-[10px] text-muted-foreground/40">
          {t("Os agentes usam esses dados para gerar roteiros e takes de vídeo no seu estilo", "Agents use this information to generate scripts and video takes in your style", "Los agentes usan estos datos para generar guiones y tomas de video con tu estilo")}
        </div>
        <Button
          onClick={() => void handleSavePersona()}
          disabled={saving}
          className="rounded-none font-mono uppercase text-xs tracking-widest h-9 px-6 gap-2 btn-weapon-primary shrink-0"
        >
          {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{t("Salvando…", "Saving…", "Guardando…")}</> : <><CheckCircle2 className="h-3.5 w-3.5" />{t("Salvar identidade", "Save identity", "Guardar identidad")}</>}
        </Button>
      </div>

    </div>
  );
}

export default function Settings() {
  const t = useUiText();
  const tabLabels: Record<Tab, string> = {
    perfil: t("Perfil", "Profile", "Perfil"),
    workspace: t("Workspace", "Workspace", "Espacio de trabajo"),
    autonomia: t("Autonomia NexOS AI", "NexOS AI Autonomy", "Autonomía de NexOS AI"),
    compliance: t("Identificação", "Identity verification", "Identificación"),
    seguranca: t("Segurança", "Security", "Seguridad"),
    integracoes: t("Integrações", "Integrations", "Integraciones"),
    identidade: t("Identidade", "Identity", "Identidad"),
  };
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
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-6 overflow-x-hidden">
      <div className="border-b border-border/50 pb-5">
        <h1 className="text-2xl md:text-3xl font-mono uppercase tracking-tighter font-bold text-foreground">
          {t("Configurações", "Settings", "Configuración")}
        </h1>
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-1">
          {t("Perfil · Workspace · Segurança · Integrações", "Profile · Workspace · Security · Integrations", "Perfil · Espacio de trabajo · Seguridad · Integraciones")}
        </p>
      </div>

      {/* Tabs */}
      <div className="grid w-full min-w-0 grid-cols-7 gap-0.5 overflow-hidden border border-border/40 bg-card/30 p-0.5 sm:flex sm:overflow-x-auto scrollbar-none">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex min-w-0 items-center justify-center gap-1 px-1 py-2 font-mono text-[10px] uppercase tracking-widest transition-all sm:flex-1 sm:gap-1.5 sm:px-4 sm:text-xs
                ${active
                  ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.3)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
               <span className="hidden sm:inline">{tabLabels[t.id]}</span>
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
