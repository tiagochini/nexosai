import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useGetCreditsBalance } from "@workspace/api-client-react";
import { LogOut, Rocket, LayoutDashboard, ListTodo, Workflow, CreditCard, Activity, CalendarDays, Contact2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, workspace, logout } = useAuth();
  const [location] = useLocation();

  const { data: creditsData } = useGetCreditsBalance({
    query: {
      enabled: !!workspace,
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
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <div className="flex items-center gap-2 text-primary">
            <Activity className="h-6 w-6" />
            <span className="font-mono font-bold tracking-tight text-lg uppercase">NexOS AI</span>
          </div>
        </div>

        <div className="p-4 flex-1 flex flex-col gap-1 overflow-y-auto">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 px-2">Menu Principal</div>
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.name} href={item.href}>
                <div className={`flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${isActive ? "bg-primary/10 text-primary border-l-2 border-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground border-l-2 border-transparent"}`}>
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </div>

        {workspace && (
          <div className="p-4 border-t border-border">
            <div className="bg-muted p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wider">
                <CreditCard className="h-4 w-4" />
                <span>Créditos</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-mono text-primary">{creditsData?.balance || 0}</span>
                <span className="text-xs text-muted-foreground uppercase">Disp.</span>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-bold truncate">{user?.name || user?.email}</span>
              <span className="text-xs text-muted-foreground truncate">{workspace?.name}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-md flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4 text-sm font-mono text-muted-foreground uppercase tracking-wider">
            <span>Status do Sistema: <span className="text-primary">Operacional</span></span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-background p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
