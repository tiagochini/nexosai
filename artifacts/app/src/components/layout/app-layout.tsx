import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useGetCreditsBalance, getGetCreditsBalanceQueryKey } from "@workspace/api-client-react";
import { LogOut, Rocket, LayoutDashboard, Workflow, CreditCard, ShieldAlert } from "lucide-react";
import nexosLogo from "/nexos-logo.png";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: React.ReactNode }) {
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
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border/50 bg-card/80 flex flex-col relative z-10" style={{
        background: 'linear-gradient(to bottom, hsl(var(--sidebar)), hsl(230 40% 6%))',
        boxShadow: '1px 0 20px hsl(var(--primary) / 0.05)'
      }}>
        {/* Glow on right border */}
        <div className="absolute right-0 top-0 bottom-0 w-px bg-primary/10 blur-[2px]"></div>

        <div className="h-20 flex items-center px-6 border-b border-border/50">
          <div className="flex items-center gap-3 relative">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-md rounded-full"></div>
              <img src={nexosLogo} alt="NexOS AI" className="h-10 w-10 object-contain relative z-10" />
            </div>
            <div className="flex flex-col">
              <span className="font-mono font-bold tracking-widest text-base uppercase text-foreground">NexOS</span>
              <span className="font-mono text-[10px] tracking-[0.2em] text-primary uppercase">Command</span>
            </div>
          </div>
        </div>

        <div className="p-4 flex-1 flex flex-col gap-2 overflow-y-auto">
          <div className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-widest mb-2 px-2">Sistemas Principais</div>
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.name} href={item.href}>
                <div className={`group flex items-center gap-3 px-3 py-2.5 text-sm font-mono tracking-wide transition-all cursor-pointer rounded-sm
                  ${isActive ? "bg-gradient-to-r from-primary/10 to-transparent text-primary border-l-2 border-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border-l-2 border-transparent hover:border-primary/30"}`}>
                  <item.icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-primary/70'}`} />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </div>

        {workspace && (
          <div className="p-4 border-t border-border/50">
            <div className="bg-background/50 border border-primary/10 p-3 rounded-sm flex flex-col gap-2 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex items-center justify-between text-xs font-mono text-muted-foreground uppercase tracking-wider relative z-10">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-3 w-3 text-primary" />
                  <span>Inteligência</span>
                </div>
              </div>
              <div className="flex items-baseline gap-1 relative z-10">
                <span className="text-2xl font-mono text-primary font-bold drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]">
                  {creditsData?.balance || 0}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Cr</span>
              </div>
              <div className="h-1 w-full bg-muted/50 mt-1 rounded-full overflow-hidden relative z-10">
                <div className="h-full bg-primary" style={{ width: '70%', boxShadow: '0 0 5px hsl(var(--primary))' }}></div>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-border/50 bg-background/30">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-mono font-bold tracking-wide truncate text-foreground/90">{user?.name || user?.email}</span>
              <span className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-widest truncate">{workspace?.name}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} title="Desconectar" className="hover:bg-destructive/10 hover:text-destructive transition-colors rounded-sm h-8 w-8">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 border-b border-border/50 bg-card/40 backdrop-blur-xl flex items-center justify-between px-8 shrink-0 z-20">
          <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground uppercase tracking-widest">
            <div className="flex items-center gap-2 bg-success/10 px-3 py-1 border border-success/20 rounded-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" style={{ boxShadow: '0 0 8px hsl(var(--success))' }}></div>
              <span className="text-success font-bold">Uplink Nominal</span>
            </div>
            <span className="opacity-50">|</span>
            <span>Secured By NexOS</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-background/90 p-8 relative">
          <div className="scanline-overlay absolute inset-0 pointer-events-none opacity-20"></div>
          <div className="max-w-6xl mx-auto relative z-10 animate-in fade-in blur-in duration-700">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
