/**
 * ModeToggle — compact switcher for Modo Fundador / Modo Arquiteto
 * Uses the existing @/lib/mode hook — no duplicate state.
 */
import { useMode, type AppMode } from "@/lib/mode";
import { useUiText } from "@/lib/i18n";
import { Gauge, Zap } from "lucide-react";

export function ModeToggle({ compact = false }: { compact?: boolean }) {
  const { mode, setMode } = useMode();
  const t = useUiText();
  const MODES: { id: AppMode; label: string; sub: string; Icon: typeof Gauge }[] = [
    { id: "fundador",  label: t("Fundador", "Founder", "Fundador"),  sub: t("Visão e resultado", "Vision and outcomes", "Visión y resultados"), Icon: Gauge },
    { id: "arquiteto", label: t("Arquiteto", "Architect", "Arquitecto"), sub: t("Profundidade total", "Full detail", "Profundidad total"), Icon: Zap  },
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-0.5 bg-white/5 border border-white/10 rounded-lg p-0.5">
        {MODES.map(m => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={[
                "px-3 py-1.5 rounded-md text-xs font-mono font-medium uppercase tracking-widest transition-all duration-200",
                active
                  ? m.id === "fundador"
                    ? "bg-primary text-primary-foreground shadow-[0_0_8px_hsl(var(--primary)/0.4)]"
                    : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <m.Icon className="h-2.5 w-2.5 inline mr-1.5" />
              {m.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {MODES.map(m => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={[
              "group flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all duration-200 text-left",
              active
                ? m.id === "fundador"
                  ? "bg-primary/15 border-primary/40"
                  : "bg-cyan-500/10 border-cyan-500/30"
                : "bg-white/3 border-white/8 hover:border-white/20 hover:bg-white/5",
            ].join(" ")}
          >
            <m.Icon className={[
              "h-4 w-4 transition-colors",
              active
                ? m.id === "fundador" ? "text-primary" : "text-cyan-400"
                : "text-muted-foreground/40 group-hover:text-muted-foreground",
            ].join(" ")} />
            <div className="flex-1 min-w-0">
              <p className={[
                "text-xs font-mono font-semibold uppercase tracking-widest leading-none mb-0.5",
                active
                  ? m.id === "fundador" ? "text-primary" : "text-cyan-300"
                  : "text-muted-foreground",
              ].join(" ")}>
                {m.label}
              </p>
              <p className="text-[10px] text-muted-foreground/40 leading-none">{m.sub}</p>
            </div>
            {active && (
              <span className={[
                "w-1.5 h-1.5 rounded-full",
                m.id === "fundador" ? "bg-primary" : "bg-cyan-400",
              ].join(" ")} />
            )}
          </button>
        );
      })}
    </div>
  );
}
