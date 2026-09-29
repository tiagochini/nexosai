/**
 * AppTour — Tour guiado do sidebar após o primeiro login.
 *
 * Mostrado uma vez após o welcome. Usuário pode refazer via Configurações.
 * Destaca cada item do menu com tooltip explicativo + "Próximo" button.
 */

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight, X } from "lucide-react";
import { useUiText } from "@/lib/i18n";

const TOUR_DONE_KEY = "nexos_tour_done_v2";

export function hasDoneTour(): boolean {
  try { return !!localStorage.getItem(TOUR_DONE_KEY); } catch { return false; }
}

export function markTourDone() {
  try { localStorage.setItem(TOUR_DONE_KEY, "1"); } catch {}
}

export function resetTour() {
  try { localStorage.removeItem(TOUR_DONE_KEY); } catch {}
}

interface TourStep {
  id: string;
  title: string;
  desc: string;
  anchor: string; // data-tour attribute on the sidebar item
  emoji: string;
}

interface TooltipPos {
  top: number;
  left: number;
  placement: "right" | "bottom";
}

export function AppTour({ onDone }: { onDone?: () => void }) {
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState<TooltipPos | null>(null);
  const [visible, setVisible] = useState(true);
  const t = useUiText();
  const STEPS: TourStep[] = [
    { id: "campaigns", title: t("Campanhas", "Campaigns", "Campañas"), desc: t("É aqui que tudo começa. Você cria a campanha, conversa com o agente, aprova a estratégia e lança. Todo o ciclo de lançamento passa por aqui.", "This is where it all starts. Create a campaign, work with the agent, approve the strategy, and launch. The entire launch cycle happens here.", "Aquí comienza todo. Crea una campaña, conversa con el agente, aprueba la estrategia y lánzala. Todo el ciclo de lanzamiento pasa por aquí."), anchor: "campaigns", emoji: "🚀" },
    { id: "agents", title: t("Agentes IA", "AI Agents", "Agentes de IA"), desc: t("64 especialistas: estrategista, copywriter, mídia, vídeo, compliance, vendas e mais. Converse com qualquer um individualmente a qualquer hora.", "64 specialists: strategist, copywriter, media, video, compliance, sales, and more. Chat with any specialist individually at any time.", "64 especialistas: estrategia, redacción, medios, video, cumplimiento, ventas y más. Habla con cualquier especialista cuando quieras."), anchor: "agents", emoji: "🤖" },
    { id: "sequences", title: t("Sequências de Lançamento", "Launch Sequences", "Secuencias de lanzamiento"), desc: t("O motor de automação. E-mail e WhatsApp são enviados automaticamente a leads quentes, mornos e frios, no momento certo.", "The automation engine. Email and WhatsApp messages are automatically sent to hot, warm, and cold leads at the right time.", "El motor de automatización. Los correos y mensajes de WhatsApp se envían automáticamente a prospectos calientes, tibios y fríos en el momento adecuado."), anchor: "sequences", emoji: "⚡" },
    { id: "integracoes", title: t("Integrações", "Integrations", "Integraciones"), desc: t("Conecte WhatsApp, Instagram, plataformas de e-mail e anúncios. Isso é essencial para a automação — faça antes do primeiro lançamento.", "Connect WhatsApp, Instagram, email platforms, and ads. These connections are essential for automation — set them up before your first launch.", "Conecta WhatsApp, Instagram, plataformas de correo y anuncios. Son esenciales para la automatización; configúralas antes de tu primer lanzamiento."), anchor: "integracoes", emoji: "🔗" },
    { id: "revenue", title: t("Receita", "Revenue", "Ingresos"), desc: t("Acompanhe faturamento, ROAS, CPL e a saúde geral do lançamento. Com Hotmart ou Kiwify conectado, os dados aparecem aqui em tempo real.", "Track revenue, ROAS, CPL, and overall launch health. Connect Hotmart or Kiwify to see data here in real time.", "Consulta los ingresos, el ROAS, el CPL y el estado general del lanzamiento. Con Hotmart o Kiwify conectado, verás los datos aquí en tiempo real."), anchor: "revenue", emoji: "💰" },
  ];

  const current = STEPS[step]!;

  const recalcPos = useCallback(() => {
    const el = document.querySelector(`[data-tour="${current.anchor}"]`);
    if (!el) { setPos(null); return; }
    const rect = el.getBoundingClientRect();
    const sidebar = document.querySelector("aside");
    const sidebarW = sidebar?.getBoundingClientRect().width ?? 256;
    setPos({
      top: rect.top + rect.height / 2 - 80,
      left: sidebarW + 12,
      placement: "right",
    });
  }, [current.anchor]);

  useEffect(() => {
    recalcPos();
    window.addEventListener("resize", recalcPos);
    return () => window.removeEventListener("resize", recalcPos);
  }, [recalcPos]);

  const finish = () => {
    markTourDone();
    setVisible(false);
    onDone?.();
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      finish();
    }
  };

  if (!visible) return null;

  const highlightEl = document.querySelector(`[data-tour="${current.anchor}"]`);
  const highlightRect = highlightEl?.getBoundingClientRect();

  return createPortal(
    <>
      {/* Dark overlay */}
      <div className="fixed inset-0 z-[8000] pointer-events-none">
        <div className="absolute inset-0 bg-black/60" />
        {/* Spotlight cutout */}
        {highlightRect && (
          <div
            className="absolute bg-transparent ring-2 ring-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
            style={{
              top:    highlightRect.top - 4,
              left:   highlightRect.left - 6,
              width:  highlightRect.width + 12,
              height: highlightRect.height + 8,
              borderRadius: 2,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.55), 0 0 0 2px hsl(var(--primary))",
            }}
          />
        )}
      </div>

      {/* Tooltip */}
      {pos && (
        <div
          className="fixed z-[8100] w-72 border border-primary/40 bg-card shadow-2xl"
          style={{ top: pos.top, left: pos.left }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{current.emoji}</span>
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-primary">{current.title}</span>
            </div>
            <button onClick={finish} aria-label={t("Fechar tour", "Close tour", "Cerrar recorrido")} className="text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-3">
            <p className="font-mono text-[11px] text-muted-foreground/80 leading-relaxed">
              {current.desc}
            </p>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-border/30 flex items-center justify-between">
            <span className="font-mono text-[10px] text-muted-foreground/30 uppercase tracking-widest">
              {step + 1} / {STEPS.length}
            </span>
            <div className="flex gap-2">
              <button
                onClick={finish}
                className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
              >
                {t("Pular", "Skip", "Omitir")}
              </button>
              <Button
                size="sm"
                onClick={next}
                className="rounded-none font-mono text-[10px] uppercase tracking-widest h-6 px-3 gap-1 btn-weapon-primary"
              >
                {step < STEPS.length - 1 ? t("Próximo", "Next", "Siguiente") : t("Começar", "Get started", "Comenzar")}
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Step dots */}
          <div className="px-4 pb-3 flex gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-0.5 flex-1 transition-all ${i <= step ? "bg-primary" : "bg-muted/20"}`}
              />
            ))}
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
