import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ClipboardList, LayoutDashboard, ListChecks, Rocket, Settings2, ShieldCheck } from "lucide-react";
import { useUiText } from "@/lib/i18n";

const links = [
  { href: "/admin", icon: LayoutDashboard, label: ["Visão geral", "Overview", "Resumen"] },
  { href: "/admin/pricing", icon: Settings2, label: ["Planos e preços", "Plans & pricing", "Planes y precios"] },
  { href: "/admin/operations", icon: ListChecks, label: ["Operações", "Operations", "Operaciones"] },
  { href: "/admin/audit-logs", icon: ClipboardList, label: ["Auditoria", "Audit log", "Auditoría"] },
  { href: "/admin/nexos-launch", icon: Rocket, label: ["Sala de lançamento", "Launch room", "Sala de lanzamiento"] },
] as const;

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const t = useUiText();

  return <div className="min-h-screen bg-background text-foreground">
    <header className="border-b border-primary/20 bg-card/70">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center border border-primary/30 bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></div>
          <div><div className="font-mono text-sm font-bold uppercase tracking-[0.18em]">NexOS · Admin</div><div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("Área administrativa restrita", "Restricted administration area", "Área administrativa restringida")}</div></div>
        </div>
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary"><ArrowLeft className="h-3.5 w-3.5" />{t("Voltar ao NexOS", "Back to NexOS", "Volver a NexOS")}</Link>
      </div>
    </header>
    <nav aria-label={t("Navegação administrativa", "Administration navigation", "Navegación administrativa")} className="border-b border-border/60 bg-background">
      <div className="mx-auto flex max-w-screen-2xl gap-1 overflow-x-auto px-5">
        {links.map(({ href, icon: Icon, label }) => {
          const active = href === "/admin" ? location === href : location.startsWith(href);
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 font-mono text-[11px] uppercase tracking-widest transition-colors ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <Icon className="h-3.5 w-3.5" />{t(label[0], label[1], label[2])}
          </Link>;
        })}
      </div>
    </nav>
    <main className="mx-auto max-w-screen-2xl px-5 py-6">{children}</main>
  </div>;
}
