import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useGetCreditsBalance, getGetCreditsBalanceQueryKey } from "@workspace/api-client-react";
import {
  LogOut, Rocket, LayoutDashboard, Workflow, CreditCard, Menu,
  Bot, Share2, Video, DollarSign, Shield, Settings, Search,
  ChevronDown, User, Users, ExternalLink,
} from "lucide-react";
import nexosLogo from "/nexos-logo.png";
import { Button } from "@/components/ui/button";
import { RecordButton } from "@/components/recording/RecordButton";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GlobalSearch, useGlobalSearch } from "@/components/global-search";

function SidebarContent({ onNav }: { onNav?: () => void }) {
  const { user, workspace, plan, logout } = useAuth();
  const [location] = useLocation();

  const { data: creditsData } = useGetCreditsBalance({
    query: {
      enabled: !!workspace,
      queryKey: getGetCreditsBalanceQueryKey(),
    },
  });

  const balance = creditsData?.balance ?? 0;
  const total   = plan?.creditsMonthly ?? 1500;
  const pct     = total > 0 ? Math.min(100, (balance / total) * 100) : 0;
  const isLow   = pct < 15;
  const barColor = isLow ? "hsl(var(--destructive))" : pct < 35 ? "hsl(45 100% 50%)" : "hsl(var(--primary))";

  type NavItem  = { name: string; href: string; icon: React.ElementType; badge?: string };
  type NavGroup = { label: string; items: NavItem[] };

  const navGroups: NavGroup[] = [
    {
      label: "Sistemas Principais",
      items: [
        { name: "Dashboard",  href: "/",          icon: LayoutDashboard },
        { name: "Campanhas",  href: "/campaigns", icon: Rocket },
        { name: "Sequências", href: "/sequences", icon: Workflow },
      ],
    },
    {
      label: "Time de IA",
      items: [
        { name: "Agentes IA", href: "/agents", icon: Bot, badge: "16" },
      ],
    },
    {
      label: "Ferramentas",
      items: [
        { name: "VSL Studio",    href: "/vsls",            icon: Video      },
        { name: "Social Media",  href: "/social",          icon: Share2     },
        { name: "Receita",       href: "/revenue",         icon: DollarSign },
        { name: "Compliance",    href: "/compliance",      icon: Shield     },
        { name: "Clientes",      href: "/agency/clients",  icon: Users      },
      ],
    },
    {
      label: "Conta",
      items: [
        { name: "Créditos de IA",  href: "/credits",  icon: CreditCard },
        { name: "Configurações",   href: "/settings", icon: Settings   },
      ],
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-20 shrink-0 flex items-center px-6 border-b border-border/50">
        <Link href="/" onClick={onNav}>
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-primary/20 blur-md rounded-full" />
              <img src={nexosLogo} alt="NexOS AI" className="h-14 w-14 object-contain relative z-10" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-mono font-bold tracking-widest text-base uppercase text-foreground">NexOS</span>
              <span className="font-mono text-[10px] tracking-[0.2em] text-primary uppercase">AI Platform</span>
            </div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="px-3 pt-3 pb-2 flex flex-col gap-3 overflow-y-auto flex-1">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-widest mb-1 px-2">
              {group.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link key={item.name} href={item.href} onClick={onNav}>
                    <div className={`group flex items-center gap-3 px-3 py-2.5 text-sm font-mono tracking-wide transition-all cursor-pointer rounded-sm
                      ${isActive
                        ? "bg-gradient-to-r from-primary/10 to-transparent text-primary border-l-2 border-primary"
                        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground border-l-2 border-transparent hover:border-primary/30"
                      }`}
                    >
                      <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary/70"}`} />
                      <span className="truncate flex-1">{item.name}</span>
                      {item.badge && (
                        <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-sm border shrink-0
                          ${isActive ? "border-primary/40 bg-primary/15 text-primary" : "border-border/40 bg-muted/30 text-muted-foreground/50"}`}>
                          {item.badge}
                        </span>
                      )}
                      {item.href === "/credits" && isLow && (
                        <span className="text-[8px] font-mono px-1.5 py-0.5 border border-destructive/40 bg-destructive/10 text-destructive shrink-0 animate-pulse">!</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Credits widget */}
      {workspace && (
        <Link href="/credits" onClick={onNav}>
          <div className="mx-3 mb-2 bg-background/50 border border-primary/10 hover:border-primary/30 p-3 transition-all cursor-pointer relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="flex items-center justify-between mb-1.5 relative z-10">
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
                <CreditCard className="h-3 w-3 text-primary shrink-0" />
                <span>Créditos de IA</span>
              </div>
              <span className="font-mono text-[9px] text-muted-foreground/40 uppercase tracking-wider">{Math.round(pct)}%</span>
            </div>
            <div className="flex items-baseline gap-1 relative z-10 mb-1.5">
              <span className="text-xl font-mono font-bold" style={{ color: barColor, textShadow: `0 0 8px ${barColor}` }}>
                {balance.toLocaleString("pt-BR")}
              </span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-widest">Cr</span>
              {isLow && <span className="text-[8px] font-mono text-destructive animate-pulse ml-1">Baixo</span>}
            </div>
            <div className="h-1 w-full bg-muted/40 rounded-full overflow-hidden relative z-10">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: barColor, boxShadow: `0 0 4px ${barColor}` }}
              />
            </div>
          </div>
        </Link>
      )}

      {/* User footer */}
      <div className="px-3 py-3 border-t border-border/50 bg-background/30 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 shrink-0 border border-primary/30 bg-primary/10 flex items-center justify-center">
              <span className="font-mono text-xs font-bold text-primary">
                {(user?.name ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-mono font-bold tracking-wide truncate text-foreground/90">
                {user?.name ?? user?.email}
              </span>
              <span className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest truncate">
                {workspace?.name ?? "—"}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            title="Desconectar"
            className="hover:bg-destructive/10 hover:text-destructive transition-colors rounded-sm h-8 w-8 shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { open: searchOpen, setOpen: setSearchOpen, close: closeSearch } = useGlobalSearch();
  const { user, workspace, logout } = useAuth();

  const sidebarStyle = {
    background: "linear-gradient(to bottom, hsl(var(--sidebar)), hsl(230 40% 6%))",
    boxShadow:  "1px 0 20px hsl(var(--primary) / 0.05)",
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background text-foreground font-sans">
      {/* Global Search */}
      <GlobalSearch open={searchOpen} onClose={closeSearch} />

      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex w-64 shrink-0 border-r border-border/50 flex-col overflow-hidden relative z-10"
        style={sidebarStyle}
      >
        <div className="absolute right-0 top-0 bottom-0 w-px bg-primary/10 blur-[2px] pointer-events-none" />
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 border-r border-border/50" style={sidebarStyle}>
          <div className="absolute right-0 top-0 bottom-0 w-px bg-primary/10 blur-[2px] pointer-events-none" />
          <SidebarContent onNav={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Floating record button */}
      <RecordButton />

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="h-14 md:h-16 shrink-0 border-b border-border/50 bg-card/40 backdrop-blur-xl flex items-center px-4 md:px-6 z-20 gap-3">
          {/* Hamburger — mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9 rounded-sm hover:bg-muted/50 shrink-0"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Status indicator */}
          <div className="flex items-center gap-2 bg-success/10 px-2.5 py-1 border border-success/20 rounded-sm shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" style={{ boxShadow: "0 0 6px hsl(var(--success))" }} />
            <span className="text-success font-bold font-mono text-[10px] uppercase tracking-widest hidden sm:inline">Uplink Nominal</span>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 border border-border/40 bg-background/40 hover:border-primary/40 hover:bg-background/60 transition-all rounded-sm group"
          >
            <Search className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors hidden sm:inline">Buscar...</span>
            <div className="hidden sm:flex items-center gap-0.5 ml-1">
              <kbd className="font-mono text-[9px] px-1 py-0.5 border border-border/40 rounded bg-muted/20 text-muted-foreground/50">⌘</kbd>
              <kbd className="font-mono text-[9px] px-1 py-0.5 border border-border/40 rounded bg-muted/20 text-muted-foreground/50">K</kbd>
            </div>
          </button>

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/30 rounded-sm transition-colors group">
                <div className="w-7 h-7 border border-primary/30 bg-primary/10 flex items-center justify-center">
                  <span className="font-mono text-xs font-bold text-primary">
                    {(user?.name ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
                  </span>
                </div>
                <div className="hidden sm:flex flex-col items-start min-w-0">
                  <span className="font-mono text-xs font-bold text-foreground/90 truncate max-w-[100px]">
                    {user?.name ?? user?.email}
                  </span>
                </div>
                <ChevronDown className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-52 rounded-none border-primary/20 bg-card/95 backdrop-blur-xl font-mono"
            >
              <div className="px-3 py-2 border-b border-border/30">
                <div className="text-xs font-bold text-foreground/90 truncate">{user?.name ?? user?.email}</div>
                <div className="text-[10px] text-muted-foreground/60 uppercase tracking-widest truncate mt-0.5">{workspace?.name}</div>
              </div>
              <Link href="/settings">
                <DropdownMenuItem className="gap-2 cursor-pointer text-xs uppercase tracking-widest focus:bg-primary/10 focus:text-primary">
                  <Settings className="h-3.5 w-3.5" />Configurações
                </DropdownMenuItem>
              </Link>
              <Link href="/credits">
                <DropdownMenuItem className="gap-2 cursor-pointer text-xs uppercase tracking-widest focus:bg-primary/10 focus:text-primary">
                  <CreditCard className="h-3.5 w-3.5" />Créditos de IA
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator className="bg-border/30" />
              <DropdownMenuItem
                onClick={logout}
                className="gap-2 cursor-pointer text-xs uppercase tracking-widest text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <LogOut className="h-3.5 w-3.5" />Desconectar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto bg-background/90 p-4 md:p-8 relative">
          <div className="scanline-overlay absolute inset-0 pointer-events-none opacity-20" />
          <div className="max-w-6xl mx-auto relative z-10 animate-in fade-in blur-in duration-700">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
