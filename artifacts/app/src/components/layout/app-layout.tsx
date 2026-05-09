import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useGetCreditsBalance, getGetCreditsBalanceQueryKey } from "@workspace/api-client-react";
import { LogOut, Rocket, LayoutDashboard, Workflow, CreditCard, Menu, X } from "lucide-react";
import nexosLogo from "/nexos-logo.png";
import { Button } from "@/components/ui/button";
import { RecordButton } from "@/components/recording/RecordButton";
import { Sheet, SheetContent } from "@/components/ui/sheet";

function SidebarContent({ onNav }: { onNav?: () => void }) {
  const { user, workspace, logout } = useAuth();
  const [location] = useLocation();

  const { data: creditsData } = useGetCreditsBalance({
    query: {
      enabled: !!workspace,
      queryKey: getGetCreditsBalanceQueryKey(),
    }
  });

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Campanhas", href: "/campaigns", icon: Rocket },
    { name: "Sequências", href: "/sequences", icon: Workflow },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-20 shrink-0 flex items-center px-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-primary/20 blur-md rounded-full" />
            <img src={nexosLogo} alt="NexOS AI" className="h-10 w-10 object-contain relative z-10" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-mono font-bold tracking-widest text-base uppercase text-foreground">NexOS</span>
            <span className="font-mono text-[10px] tracking-[0.2em] text-primary uppercase">Command</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-4 pt-4 pb-2 flex flex-col gap-1 overflow-y-auto flex-1">
        <div className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-widest mb-2 px-2">
          Sistemas Principais
        </div>
        {navigation.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.name} href={item.href} onClick={onNav}>
              <div
                className={`group flex items-center gap-3 px-3 py-2.5 text-sm font-mono tracking-wide transition-all cursor-pointer rounded-sm
                  ${isActive
                    ? "bg-gradient-to-r from-primary/10 to-transparent text-primary border-l-2 border-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border-l-2 border-transparent hover:border-primary/30"
                  }`}
              >
                <item.icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-primary/70'}`} />
                <span className="truncate">{item.name}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Credits widget */}
      {workspace && (
        <div className="px-4 pb-3 shrink-0">
          <div className="bg-background/50 border border-primary/10 p-3 rounded-sm flex flex-col gap-2 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wider relative z-10">
              <CreditCard className="h-3 w-3 text-primary shrink-0" />
              <span>Inteligência</span>
            </div>
            <div className="flex items-baseline gap-1 relative z-10">
              <span className="text-2xl font-mono text-primary font-bold drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]">
                {creditsData?.balance ?? 0}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Cr</span>
            </div>
            <div className="h-1 w-full bg-muted/50 rounded-full overflow-hidden relative z-10">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: '70%', boxShadow: '0 0 5px hsl(var(--primary))' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* User / logout */}
      <div className="px-4 py-3 border-t border-border/50 bg-background/30 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-mono font-bold tracking-wide truncate text-foreground/90">
              {user?.name ?? user?.email}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-widest truncate">
              {workspace?.name}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            title="Desconectar"
            className="hover:bg-destructive/10 hover:text-destructive transition-colors rounded-sm h-8 w-8 shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarStyle = {
    background: 'linear-gradient(to bottom, hsl(var(--sidebar)), hsl(230 40% 6%))',
    boxShadow: '1px 0 20px hsl(var(--primary) / 0.05)',
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background text-foreground font-sans">

      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside
        className="hidden md:flex w-64 shrink-0 border-r border-border/50 flex-col overflow-hidden relative z-10"
        style={sidebarStyle}
      >
        <div className="absolute right-0 top-0 bottom-0 w-px bg-primary/10 blur-[2px] pointer-events-none" />
        <SidebarContent />
      </aside>

      {/* ── Mobile sidebar — Sheet drawer ───────────────────────────── */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-72 p-0 border-r border-border/50"
          style={sidebarStyle}
        >
          <div className="absolute right-0 top-0 bottom-0 w-px bg-primary/10 blur-[2px] pointer-events-none" />
          <SidebarContent onNav={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* ── Floating record button ───────────────────────────────────── */}
      <RecordButton />

      {/* ── Main content ────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="h-14 md:h-16 shrink-0 border-b border-border/50 bg-card/40 backdrop-blur-xl flex items-center px-4 md:px-8 z-20 gap-4">
          {/* Hamburger — mobile only */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9 rounded-sm hover:bg-muted/50 shrink-0"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-3 md:gap-4 text-xs font-mono text-muted-foreground uppercase tracking-widest min-w-0">
            <div className="flex items-center gap-2 bg-success/10 px-2 md:px-3 py-1 border border-success/20 rounded-sm shrink-0">
              <div
                className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shrink-0"
                style={{ boxShadow: '0 0 8px hsl(var(--success))' }}
              />
              <span className="text-success font-bold hidden sm:inline">Uplink Nominal</span>
              <span className="text-success font-bold sm:hidden">Online</span>
            </div>
            <span className="opacity-50 hidden md:inline">|</span>
            <span className="hidden md:inline">Secured By NexOS</span>
          </div>
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
