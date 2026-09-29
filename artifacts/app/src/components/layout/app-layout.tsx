import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useMode } from "@/lib/mode";
import { useGetCreditsBalance, getGetCreditsBalanceQueryKey, getGetMeQueryKey } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import { useQueryClient } from "@tanstack/react-query";
import {
  LogOut, Rocket, LayoutDashboard, Workflow, CreditCard, Menu, Network,
  Bot, Share2, Video, DollarSign, Shield, Settings, Search,
  ChevronDown, User, Users, ShieldCheck, Star, Gauge, Zap,
  Brain, Receipt, Link2, Globe, Clapperboard, Film, ShoppingBag, MessageSquare, Crosshair, Camera,
  GraduationCap, ExternalLink, Fingerprint, RefreshCw, Radar, Megaphone, Target, Activity, FileText, GitCommit, ShieldAlert,
  ChevronsUpDown, Check, Plus, Loader2, Server
} from "lucide-react";
import nexosLogo from "/nexos-logo.png";
import { useAppI18n, useUiText, useUiLocale, intlLocale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { RecordButton } from "@/components/recording/RecordButton";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { GlobalSearch, useGlobalSearch } from "@/components/global-search";
import { toast } from "sonner";
import { AppTour, hasDoneTour, markTourDone } from "@/components/AppTour";
import { useWorkspaceSocket } from "@/lib/socket";

function WorkspaceSwitcher({ onNav, isMobileHeader }: { onNav?: () => void; isMobileHeader?: boolean }) {
  const { workspacesData, switchWorkspace, workspace } = useAuth();
  const [switching, setSwitching] = useState(false);
  const t = useUiText();

  if (!workspacesData) return null;

  const handleSwitch = async (id: string) => {
    if (id === workspace?.id || switching) return;
    setSwitching(true);
    try {
      await switchWorkspace(id);
      onNav?.();
    } catch (err: any) {
      toast.error(err.message || t("Erro ao trocar de workspace", "Couldn't switch workspace", "No se pudo cambiar de espacio de trabajo"));
      setSwitching(false);
    }
  };

  const triggerButton = isMobileHeader ? (
    <button
      disabled={switching}
      title={workspace?.name || t("Selecionar workspace", "Select workspace", "Seleccionar espacio de trabajo")}
      className="flex min-w-0 w-full items-center gap-1.5 px-2 py-1.5 bg-muted/20 border border-border/50 rounded-sm hover:bg-muted/40 transition-colors disabled:opacity-50"
    >
      <span className="font-mono text-[10px] font-semibold truncate text-foreground uppercase tracking-wider">
        {switching ? t("Trocando...", "Switching...", "Cambiando...") : (workspace?.name || "...")}
      </span>
      {switching ? <Loader2 className="h-3 w-3 text-muted-foreground animate-spin shrink-0" /> : <ChevronsUpDown className="h-3 w-3 text-muted-foreground shrink-0" />}
    </button>
  ) : (
    <button
      disabled={switching}
      title={workspace?.name || t("Selecionar workspace", "Select workspace", "Seleccionar espacio de trabajo")}
      className="flex items-center justify-between w-full px-3 py-2 bg-muted/20 border border-border/50 rounded-sm hover:bg-muted/40 transition-colors disabled:opacity-50"
    >
      <div className="flex flex-col items-start min-w-0">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60 mb-0.5">{t("Operação", "Workspace", "Espacio de trabajo")}</span>
        <div className="flex items-center gap-2 max-w-full">
          <span className="font-mono text-xs font-semibold truncate text-foreground">
            {switching ? t("Trocando...", "Switching...", "Cambiando...") : (workspace?.name || "...")}
          </span>
        </div>
      </div>
      {switching ? <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin shrink-0" /> : <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
    </button>
  );

  return (
    <div className={isMobileHeader ? "min-w-0 w-full" : "px-3 py-3 border-b border-border/50 shrink-0"}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {triggerButton}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[240px] rounded-none border border-primary/20 bg-card/95 backdrop-blur-xl font-mono">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("Suas operações", "Your workspaces", "Tus espacios de trabajo")}</DropdownMenuLabel>
          <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-border/30">
            {workspacesData.workspaces.map(ws => (
              <DropdownMenuItem
                key={ws.id}
                onClick={() => handleSwitch(ws.id)}
                className="cursor-pointer rounded-none focus:bg-primary/10 py-2.5"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex flex-col min-w-0">
                    <span className="truncate text-xs font-semibold">{ws.name}</span>
                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5">{ws.id.slice(0, 8)}...</span>
                  </div>
                  {ws.id === workspace?.id && <Check className="h-3.5 w-3.5 text-primary ml-2 shrink-0" />}
                </div>
              </DropdownMenuItem>
            ))}
          </div>
          <DropdownMenuSeparator className="bg-border/30" />
          <DropdownMenuItem asChild className="cursor-pointer rounded-none focus:bg-primary/10 text-primary py-3">
            <Link href="/settings?tab=workspace&workspaceAction=add" onClick={onNav}>
              <Plus className="h-3.5 w-3.5 mr-2" />
              <span className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-widest">{t("Adicionar workspace", "Add workspace", "Añadir espacio de trabajo")}</span>
                <span className="mt-0.5 text-[9px] normal-case tracking-normal text-muted-foreground">
                  {t("Nova marca, cliente ou operação", "New brand, client, or operation", "Nueva marca, cliente u operación")}
                </span>
              </span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer rounded-none focus:bg-primary/10 py-2">
            <Link href="/settings?tab=workspace" onClick={onNav}>
              <Settings className="h-3.5 w-3.5 mr-2" /> <span className="text-[10px] uppercase tracking-widest">{t("Gerenciar operações", "Manage workspaces", "Administrar espacios de trabajo")}</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function AdminTopupButton({ onSuccess, compact }: { onSuccess: () => void; compact?: boolean }) {
  const [loading, setLoading] = useState(false);
  const { locale } = useUiLocale();
  const t = useUiText();
  const handleTopup = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await customFetch<{ ok: boolean; credited: number; newBalance: number }>("/api/credits/admin-topup", { method: "POST" });
      const numberFormat = new Intl.NumberFormat(intlLocale(locale));
      toast.success(t(`+${numberFormat.format(result.credited)} créditos recarregados. Saldo: ${numberFormat.format(result.newBalance)} cr`, `+${numberFormat.format(result.credited)} credits added. Balance: ${numberFormat.format(result.newBalance)} credits`, `+${numberFormat.format(result.credited)} créditos recargados. Saldo: ${numberFormat.format(result.newBalance)} créditos`));
      onSuccess();
    } catch {
      toast.error(t("Erro ao recarregar créditos.", "Couldn't add credits.", "No se pudieron recargar los créditos."));
    } finally {
      setLoading(false);
    }
  };
  if (compact) {
    return (
      <button
        onClick={handleTopup}
        disabled={loading}
        className="mt-1 flex items-center gap-1 font-mono text-[11px] text-primary uppercase tracking-widest hover:text-primary/80 disabled:opacity-50 transition-colors animate-pulse"
      >
        <RefreshCw className={`h-2.5 w-2.5 ${loading ? "animate-spin" : ""}`} />
        {loading ? t("Recarregando...", "Reloading...", "Recargando...") : t("Recarregar grátis", "Top up for free", "Recargar gratis")}
      </button>
    );
  }
  return (
    <Button
      onClick={handleTopup}
      disabled={loading}
      className="rounded-none font-mono uppercase text-xs tracking-widest btn-weapon-primary gap-2 h-9 w-full"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
      {loading ? t("Recarregando...", "Reloading...", "Recargando...") : t("Recarregar créditos (grátis)", "Top up credits (free)", "Recargar créditos (gratis)")}
    </Button>
  );
}

type LocaleCode = "pt-BR" | "en-US" | "en-AU" | "es-LA";
const LOCALE_OPTIONS: { value: LocaleCode; flag: string; label: string }[] = [
  { value: "pt-BR", flag: "PT", label: "Português (BR)" },
  { value: "en-US", flag: "EN", label: "English (US)" },
  { value: "en-AU", flag: "EN", label: "English (AU)" },
  { value: "es-LA", flag: "ES", label: "Español (LA)" },
];

function SidebarContent({ onNav }: { onNav?: () => void }) {
  const { user, workspace, plan, planSlug, isAdmin, logout } = useAuth();
  const [location] = useLocation();
  const { mode, setMode, isExpert } = useMode();
  const queryClient = useQueryClient();
  const [savingLocale, setSavingLocale] = useState(false);
  const tr = useAppI18n();
  const t = useUiText();
  const { locale } = useUiLocale();

  const currentLocale: LocaleCode = (user?.locale as LocaleCode | undefined) ?? "pt-BR";
  const currentLocaleOpt = LOCALE_OPTIONS.find(o => o.value === currentLocale) ?? LOCALE_OPTIONS[0]!

  const handleSetLocale = async (locale: LocaleCode) => {
    if (locale === currentLocale || savingLocale) return;
    setSavingLocale(true);
    try {
      await customFetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      toast.success(t("Idioma da plataforma atualizado.", "Platform language updated.", "Idioma de la plataforma actualizado."));
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    } catch {
      toast.error(t("Erro ao salvar idioma.", "Couldn't save language.", "No se pudo guardar el idioma."));
    } finally {
      setSavingLocale(false);
    }
  };

  const { data: creditsData } = useGetCreditsBalance({
    query: {
      enabled: !!workspace,
      queryKey: getGetCreditsBalanceQueryKey(),
    },
  });

  // Never flash "0 CR" during a background refetch/invalidation race: keep
  // showing the last confirmed non-undefined balance until the server sends
  // a new one. Only show 0 when the backend has actually confirmed 0.
  const lastKnownBalanceRef = useRef<number | null>(null);
  if (creditsData?.balance != null) lastKnownBalanceRef.current = creditsData.balance;
  const balance = creditsData?.balance ?? lastKnownBalanceRef.current ?? 0;
  const total   = plan?.creditsMonthly ?? 1500;
  const pct     = total > 0 ? Math.min(100, (balance / total) * 100) : 0;
  const isLow   = !isAdmin && pct < 15;
  const barColor = isAdmin ? "hsl(var(--primary))" : isLow ? "hsl(var(--destructive))" : pct < 35 ? "hsl(45 100% 50%)" : "hsl(var(--primary))";

  // Auto-activate unlimited credits for admin accounts (idempotent)
  useEffect(() => {
    if (!isAdmin) return;
    customFetch<unknown>("/api/billing/admin/unlimited-credits", { method: "POST" }).catch(() => {});
  }, [isAdmin]);

  const isAgency = planSlug === "agency" || isAdmin || isExpert;

  type NavItem  = { name: string; href: string; icon: React.ElementType; badge?: string; external?: boolean };
  type NavGroup = { label: string; items: NavItem[]; expertOnly?: boolean };

  const navGroups: NavGroup[] = [
    {
      label: tr.nav.main,
      items: [
        { name: tr.sidebar.dashboard,  href: "/",          icon: LayoutDashboard },
        { name: t("Cockpit do lançamento", "Launch cockpit", "Panel de lanzamiento"), href: "/launcher", icon: Crosshair },
        { name: t("Briefing central", "Central brief", "Resumen central"), href: "/intake", icon: FileText, badge: "Hub" },
        { name: tr.sidebar.campaigns,  href: "/campaigns", icon: Rocket },
        { name: t("Inteligência de mercado", "Market intelligence", "Inteligencia de mercado"), href: "/market-intel", icon: Radar, badge: "IA" },
        { name: t("Presença social", "Social presence", "Presencia en redes"), href: "/presence", icon: Megaphone, badge: "IA" },
      ],
    },
    {
      label: tr.nav.agent_team,
      items: [
        { name: tr.sidebar.agents, href: "/agents", icon: Bot, badge: "64" },
      ],
    },
    {
      label: t("Criação", "Creation", "Creación"),
      items: [
        { name: t("Clone de voz e avatar", "Voice & avatar cloning", "Clonación de voz y avatar"), href: "/settings?tab=identidade", icon: Fingerprint, badge: "IA" },
        { name: tr.sidebar.vsl,           href: "/vsls",             icon: Video        },
        { name: t("Produção de vídeo", "Video production", "Producción de video"), href: "/video-production", icon: Clapperboard },
        { name: t("Vídeo diário", "Daily video", "Video diario"), href: "/video-diario", icon: Zap, badge: "✦" },
        { name: tr.sidebar.video,         href: "/video-editor",     icon: Film         },
        { name: t("Gravações", "Recordings", "Grabaciones"), href: "/recordings", icon: Camera },
      ],
    },
    {
      label: tr.nav.tools,
      expertOnly: true,
      items: [
        { name: t("Mídia autônoma", "Autonomous media", "Medios autónomos"), href: "/paid-media", icon: Target, badge: "IA" },
        { name: tr.sidebar.social,       href: "/social",            icon: Share2     },
        { name: tr.sidebar.moderation,   href: "/social/moderation", icon: Shield     },
        { name: tr.sidebar.sequences,    href: "/sequences",         icon: Workflow   },
        { name: t("Pipeline regional", "Regional pipeline", "Flujo regional"), href: "/pipeline", icon: Network },
        { name: "Lifecycle",             href: "/lifecycle",         icon: Activity   },
        { name: tr.sidebar.revenue,      href: "/revenue",           icon: DollarSign },
        { name: tr.sidebar.compliance,   href: "/compliance",        icon: Shield     },
        { name: tr.sidebar.site_builder, href: "/site-builder",      icon: Globe      },
        ...(isAgency ? [
          { name: tr.sidebar.clients,  href: "/agency/clients",   icon: Users },
          { name: tr.sidebar.profiles, href: "/agency/profiles",  icon: Users },
        ] : []),
      ],
    },
    {
      label: tr.nav.growth,
      expertOnly: true,
      items: [
        { name: tr.sidebar.affiliates, href: "/affiliate",  icon: Star   },
        { name: "Self-Proof Engine", href: "/self-proof", icon: Shield },
      ],
    },
    {
      label: tr.nav.automations,
      items: [
        { name: tr.sidebar.products,       href: "/produtos",      icon: ShoppingBag },
        { name: t("Atendimento", "Customer support", "Atención"), href: "/atendimento", icon: MessageSquare },
        { name: tr.sidebar.integrations,   href: "/integracoes",   icon: Link2, badge: "!" },
        { name: t("Infraestrutura", "Infrastructure", "Infraestructura"), href: "/infraestrutura", icon: Server },
      ],
    },
    {
      label: t("Academia", "Academy", "Academia"),
      items: [
        { name: "NexOS Academy", href: "/nexos-academy/", icon: GraduationCap, external: true },
      ],
    },
    {
      label: tr.nav.account,
      items: [
        { name: tr.sidebar.credits,  href: "/credits",  icon: CreditCard },
        { name: tr.sidebar.memory,   href: "/memory",   icon: Brain      },
        { name: tr.sidebar.billing,  href: "/billing",  icon: Receipt    },
        { name: tr.sidebar.settings, href: "/settings", icon: Settings   },
      ],
    },
  ];

  const visibleGroups = navGroups.filter(g => !g.expertOnly || isExpert);

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-36 shrink-0 flex items-center px-4 border-b border-border/50">
        <Link href="/" onClick={onNav}>
          <div className="flex items-center gap-4 cursor-pointer group">
            <div className="relative shrink-0">
              <img src={nexosLogo} alt="NexOS" className="h-28 w-28 object-contain transition-all duration-300" style={{ filter: "drop-shadow(0 0 18px hsl(var(--primary)/0.6))" }} />
              <div className="absolute -inset-3 bg-primary/6 blur-xl rounded-full -z-10" />
            </div>
            <div>
              <div className="font-mono font-black text-2xl uppercase tracking-[0.12em] text-foreground leading-tight">NexOS</div>
              <div className="font-mono text-sm uppercase tracking-[0.3em] text-primary leading-tight">{t("Plataforma NexOS", "NexOS Platform", "Plataforma NexOS")}</div>
              <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground/50 leading-tight mt-1">{t("Operações inteligentes", "Smart operations", "Operaciones inteligentes")}</div>
            </div>
          </div>
        </Link>
      </div>

      <WorkspaceSwitcher onNav={onNav} />

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5 scrollbar-thin scrollbar-thumb-border/30">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <div className="px-2 mb-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground/40">
                {group.label}
              </span>
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const hrefPath = item.href.split("?")[0]!;
                const isActive = item.external
                  ? false
                  : hrefPath === "/"
                    ? location === "/"
                    : location.startsWith(hrefPath);
                const TOUR_HREFS = new Set(["/campaigns", "/agents", "/sequences", "/integracoes", "/revenue"]);
                const inner = (
                  <div
                    {...(TOUR_HREFS.has(item.href) ? { "data-tour": item.href.slice(1) } : {})}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-sm transition-all cursor-pointer group relative overflow-hidden
                      ${isActive
                        ? "bg-primary/15 text-primary shadow-[inset_0_0_12px_hsl(var(--primary)/0.08)]"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      }`}
                  >
                    {isActive && (
                      <div className="absolute left-0 inset-y-0 w-[2px] bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
                    )}
                    <Icon className={`h-3.5 w-3.5 shrink-0 transition-colors ${isActive ? "text-primary" : "text-muted-foreground/60 group-hover:text-foreground"}`} />
                    <span className="font-mono text-xs uppercase tracking-widest font-medium flex-1 truncate">
                      {item.name}
                    </span>
                    {item.badge && (
                      <span className="text-[11px] font-mono bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-sm shrink-0">
                        {item.badge}
                      </span>
                    )}
                    {item.external && (
                      <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
                    )}
                    {item.href === "/admin" && (
                      <span className="text-[11px] font-mono bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 px-1.5 py-0.5 rounded-sm shrink-0">
                        Owner
                      </span>
                    )}
                  </div>
                );
                return item.external ? (
                  <a key={item.href} href={item.href} target="_blank" rel="noreferrer" onClick={onNav}>
                    {inner}
                  </a>
                ) : (
                  <Link key={item.href} href={item.href} onClick={onNav}>
                    {inner}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* Mode toggle */}
        <div>
          <div className="px-2 mb-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground/40">
              {tr.nav.mode}
            </span>
          </div>
          <div className="flex gap-1 border border-border/40 bg-muted/10 p-0.5">
            <button
              onClick={() => setMode("fundador")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 font-mono text-[11px] uppercase tracking-widest transition-all
                ${mode === "fundador"
                  ? "bg-primary text-primary-foreground shadow-[0_0_8px_hsl(var(--primary)/0.4)]"
                  : "text-muted-foreground hover:text-foreground"}`}
            >
              <Gauge className="h-2.5 w-2.5" />
              {t("Fundador", "Founder", "Fundador")}
            </button>
            <button
              onClick={() => setMode("arquiteto")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 font-mono text-[11px] uppercase tracking-widest transition-all
                ${mode === "arquiteto"
                  ? "bg-cyan-500/20 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.3)] border border-cyan-500/20"
                  : "text-muted-foreground hover:text-foreground"}`}
            >
              <Zap className="h-2.5 w-2.5" />
              {t("Arquiteto", "Architect", "Arquitecto")}
            </button>
          </div>
          {mode === "fundador" && (
            <p className="font-mono text-[11px] text-muted-foreground/40 uppercase tracking-widest mt-1.5 px-1 leading-relaxed">
              {t("Visão e resultado · foco no lançamento", "Vision and outcomes · launch focus", "Visión y resultados · enfoque en el lanzamiento")}
            </p>
          )}
          {mode === "arquiteto" && (
            <p className="font-mono text-[11px] text-cyan-500/40 uppercase tracking-widest mt-1.5 px-1 leading-relaxed">
              {t("Profundidade total · agentes · traces · pesos", "Full detail · agents · traces · weights", "Profundidad total · agentes · trazas · pesos")}
            </p>
          )}
        </div>
      </nav>

      {/* Credits bar */}
      <div className="px-4 py-3 border-t border-border/30 mx-3 mb-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/50">{tr.credits.label}</span>
          <Link href="/credits" onClick={onNav}>
            <span className="font-mono text-[11px] text-primary hover:underline uppercase tracking-widest">
              {new Intl.NumberFormat(intlLocale(locale)).format(balance)} {t("cr", "credits", "créditos")}
            </span>
          </Link>
        </div>
        <div className="h-0.5 w-full bg-muted/20 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: isAdmin ? "100%" : `${pct}%`, background: barColor, boxShadow: `0 0 4px ${barColor}` }}
          />
        </div>
        {isAdmin && balance < 500 ? (
          <AdminTopupButton onSuccess={() => queryClient.invalidateQueries({ queryKey: getGetCreditsBalanceQueryKey() })} compact />
        ) : isAdmin ? (
          <div className="mt-1 font-mono text-[11px] text-primary/60 uppercase tracking-widest">
             {t("MODO FUNDADOR", "FOUNDER MODE", "MODO FUNDADOR")}
          </div>
        ) : isLow ? (
          <div className="mt-1 font-mono text-[11px] text-destructive uppercase tracking-widest animate-pulse">
            {tr.credits.low}
          </div>
        ) : null}
      </div>

      {/* User dropdown */}
      <div className="p-3 border-t border-border/50 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm hover:bg-muted/30 transition-all group">
              <div className="w-7 h-7 rounded-sm border border-primary/30 bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="font-mono text-xs text-foreground font-semibold truncate">{user?.name ?? tr.user.default_name}</div>
                <div className="font-mono text-[11px] text-muted-foreground/50 uppercase tracking-widest truncate">
                  {plan?.name ?? "NexOS"}
                  {isAdmin && " · Owner"}
                </div>
              </div>
              <span className="text-base leading-none shrink-0" title={currentLocaleOpt?.label}>{currentLocaleOpt?.flag}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="top"
            className="w-56 rounded-none border border-primary/20 bg-card/95 backdrop-blur-xl font-mono"
          >
            <DropdownMenuItem asChild className="cursor-pointer focus:bg-primary/10 focus:text-primary rounded-none font-mono text-xs uppercase tracking-widest">
              <Link href="/settings" onClick={onNav}>
                <Settings className="h-3.5 w-3.5 mr-2" />{tr.user.settings}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer focus:bg-primary/10 focus:text-primary rounded-none font-mono text-xs uppercase tracking-widest">
              <Link href="/credits" onClick={onNav}>
                <CreditCard className="h-3.5 w-3.5 mr-2" />{tr.user.credits}
              </Link>
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem asChild className="cursor-pointer focus:bg-yellow-400/10 focus:text-yellow-400 rounded-none font-mono text-xs uppercase tracking-widest">
                <Link href="/admin" onClick={onNav}>
                  <ShieldCheck className="h-3.5 w-3.5 mr-2" />{tr.sidebar.admin}
                </Link>
              </DropdownMenuItem>
            )}
            {isAdmin && (
              <DropdownMenuItem asChild className="cursor-pointer focus:bg-red-400/10 focus:text-red-400 rounded-none font-mono text-xs uppercase tracking-widest">
                <Link href="/admin/nexos-launch" onClick={onNav}>
               <Rocket className="h-3.5 w-3.5 mr-2" />{t("Sala de lançamento", "Launch room", "Sala de lanzamiento")}
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-border/30" />
            {/* Locale picker */}
            <div className="px-2 py-1.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Globe className="h-3 w-3 text-muted-foreground/50" />
               <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">{t("Idioma da plataforma", "Platform language", "Idioma de la plataforma")}</span>
              </div>
              <div className="grid grid-cols-2 gap-0.5">
                {LOCALE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    disabled={savingLocale}
                    onClick={() => void handleSetLocale(opt.value)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 text-left transition-all rounded-none text-[11px] font-mono
                      ${currentLocale === opt.value
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : "hover:bg-muted/30 text-muted-foreground hover:text-foreground border border-transparent"
                      }`}
                  >
                    <span className="text-sm leading-none">{opt.flag}</span>
                    <span className="truncate leading-none">{opt.label.split(" ")[0]}</span>
                  </button>
                ))}
              </div>
            </div>
            <DropdownMenuSeparator className="bg-border/30" />
            <DropdownMenuItem
              onClick={() => { logout(); onNav?.(); }}
              className="cursor-pointer focus:bg-destructive/10 focus:text-destructive rounded-none font-mono text-xs uppercase tracking-widest text-destructive/70"
            >
              <LogOut className="h-3.5 w-3.5 mr-2" />{tr.user.logout}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ─── Topbar for mobile ────────────────────────────────────────────────────────

function TopBar({ onMenuOpen }: { onMenuOpen: () => void }) {
  const { workspace } = useAuth();
  const { open: isSearchOpen, setOpen: setSearchOpen } = useGlobalSearch();
  const t = useUiText();

  return (
    <header className="h-16 min-w-0 overflow-hidden border-b border-border/50 bg-background/95 backdrop-blur-sm flex items-center justify-between gap-2 px-3 shrink-0 sm:px-4">
      <button
        onClick={onMenuOpen}
        aria-label={t("Abrir menu", "Open menu", "Abrir menú")}
        className="p-2 hover:bg-muted/30 rounded-sm transition-colors md:hidden"
      >
        <Menu className="h-5 w-5 text-muted-foreground" />
      </button>

      <div className="min-w-0 flex-1 flex items-center justify-center md:justify-start md:ml-0 gap-2">
        <Link href="/" className="hidden sm:block">
          <div className="flex items-center gap-2 cursor-pointer md:hidden group">
            <img
              src={nexosLogo}
              alt="NexOS"
              className="h-8 w-8 object-contain transition-all duration-300"
              style={{ filter: "drop-shadow(0 0 10px hsl(var(--primary)/0.65))" }}
            />
            <div className="font-mono font-black text-sm uppercase tracking-widest leading-none whitespace-nowrap hidden sm:block">NEXOS</div>
          </div>
        </Link>
        <div className="md:hidden min-w-0 flex-1 flex justify-center">
          <WorkspaceSwitcher isMobileHeader />
        </div>
        <div className="hidden md:block text-[11px] font-mono uppercase tracking-widest text-muted-foreground/40">
          {workspace?.name}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <RecordButton />
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("Buscar", "Search", "Buscar")}
          onClick={() => setSearchOpen(true)}
          className="hidden h-9 w-9 rounded-sm hover:bg-muted/30 sm:inline-flex"
        >
          <Search className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      <GlobalSearch open={isSearchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}

// ─── Main Layout ──────────────────────────────────────────────────────────────

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  const { workspace } = useAuth();

  // Workspace-level operator alerts (e.g. Instagram post retry exhausted)
  const handleWorkspaceAlert = useCallback((alert: { type: string; message: string }) => {
    if (alert.type === "social_post_manual_retry_exhausted") {
      toast.error(alert.message, { duration: 12000, id: `ws-alert-${Date.now()}` });
    } else if (alert.type === "social_post_manual_retry_warning") {
      toast.warning(alert.message, { duration: 8000, id: `ws-alert-${Date.now()}` });
    } else {
      toast.warning(alert.message, { duration: 8000 });
    }
  }, []);

  useWorkspaceSocket(workspace?.id, handleWorkspaceAlert);

  // Check if welcome page requested a guided tour
  const [showTour, setShowTour] = useState(() => {
    try { return localStorage.getItem("nexos_show_tour_next") === "1" && !hasDoneTour(); } catch { return false; }
  });

  useEffect(() => {
    if (showTour) {
      try { localStorage.removeItem("nexos_show_tour_next"); } catch {}
    }
  }, [showTour]);

  // Close mobile nav on route change
  useEffect(() => { setMobileOpen(false); }, [location]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Guided tour overlay */}
      {showTour && <AppTour onDone={() => setShowTour(false)} />}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border/50 bg-card/30">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 border-r border-primary/20 bg-card/95 backdrop-blur-xl">
          <SidebarContent onNav={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar onMenuOpen={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto flex flex-col min-h-0">
          <div className="mx-auto flex min-h-0 w-full min-w-0 max-w-[1400px] flex-1 flex-col p-4 md:p-6 lg:p-8">
            {children}
          </div>
          <div className="shrink-0 py-3 px-6 flex justify-center">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/25 select-none">
              NexOS AI © 2025
            </span>
          </div>
        </main>
      </div>
    </div>
  );
}
