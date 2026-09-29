/**
 * FeatureOnboarding — painel de explicação automática de feature (first-visit).
 *
 * Na primeira visita: aparece automaticamente (overlay ou inline).
 * Nas visitas seguintes: aparece apenas quando o usuário clica "Ver explicação".
 * No modo Arquiteto: não aparece automaticamente. Botão "Ver explicação" ainda disponível.
 */

import { X, Lightbulb, ChevronRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMode } from "@/lib/mode";
import { useFeatureOnboarding, type FeatureKey } from "@/hooks/useFeatureOnboarding";
import { useUiText } from "@/lib/i18n";

export interface FeatureOnboardingProps {
  featureKey: FeatureKey;
  title: string;
  description: string;
  /** Passos opcionais — o que o usuário pode fazer nesta área */
  steps?: string[];
  /** Mostrar como inline (dentro da tela) ou como banner no topo */
  variant?: "inline" | "banner";
  /** Botão de ação principal opcional */
  actionLabel?: string;
  onAction?: () => void;
}

export function FeatureOnboarding({
  featureKey,
  title,
  description,
  steps,
  variant = "banner",
  actionLabel,
  onAction,
}: FeatureOnboardingProps) {
  const t = useUiText();
  const { isFundador } = useMode();
  const { isOpen, isFirstVisit, close } = useFeatureOnboarding(featureKey);

  // No modo Arquiteto: não mostra automaticamente. Componente não renderiza nada aqui.
  // O botão manual fica disponível via <FeatureOnboardingTrigger />.
  if (!isFundador && isFirstVisit) return null;
  if (!isOpen) return null;

  if (variant === "inline") {
    return (
      <div className="border border-primary/20 bg-primary/5 relative">
        <button
          onClick={close}
          className="absolute top-3 right-3 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          aria-label={t("Fechar explicação", "Close explanation", "Cerrar explicación")}
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="p-4 pr-8">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold">
              {title}
            </span>
            {isFirstVisit && (
              <span className="font-mono text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary border border-primary/30">
                {t("NOVO", "NEW", "NUEVO")}
              </span>
            )}
          </div>
          <p className="font-mono text-xs text-muted-foreground/80 leading-relaxed mb-3">
            {description}
          </p>
          {steps && steps.length > 0 && (
            <ul className="space-y-1.5 mb-3">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="font-mono text-[10px] text-primary/40 font-bold shrink-0 mt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-mono text-[11px] text-foreground/70 leading-relaxed">
                    {step}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2">
            {actionLabel && onAction && (
              <Button
                size="sm"
                className="rounded-none font-mono uppercase tracking-widest text-[11px] h-7 px-3 btn-weapon-primary gap-1.5"
                onClick={() => { onAction(); close(); }}
              >
                {actionLabel}
                <ChevronRight className="h-3 w-3" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="rounded-none font-mono uppercase tracking-widest text-[11px] h-7 px-3 text-muted-foreground/60 hover:text-muted-foreground"
              onClick={close}
            >
              {t("Entendi", "Got it", "Entendido")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // variant === "banner"
  return (
    <div className="border-b border-primary/20 bg-primary/5 relative">
      <button
        onClick={close}
        className="absolute top-3 right-4 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        aria-label={t("Fechar explicação", "Close explanation", "Cerrar explicación")}
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="px-5 py-3 pr-10">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold">
                  {title}
                </span>
                {isFirstVisit && (
                  <span className="font-mono text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary border border-primary/30">
                    {t("NOVO", "NEW", "NUEVO")}
                  </span>
                )}
              </div>
              <p className="font-mono text-xs text-muted-foreground/70 leading-relaxed">
                {description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {actionLabel && onAction && (
              <Button
                size="sm"
                className="rounded-none font-mono uppercase tracking-widest text-[11px] h-7 px-3 btn-weapon-primary gap-1.5"
                onClick={() => { onAction(); close(); }}
              >
                {actionLabel}
                <ChevronRight className="h-3 w-3" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="rounded-none font-mono uppercase tracking-widest text-[11px] h-7 px-3 text-muted-foreground/60 hover:text-muted-foreground"
              onClick={close}
            >
              {t("Entendi", "Got it", "Entendido")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * FeatureOnboardingTrigger — botão "Ver explicação desta área".
 * Disponível em qualquer modo, em qualquer visita.
 */
export function FeatureOnboardingTrigger({
  featureKey,
  label = "Ver explicação desta área",
}: {
  featureKey: FeatureKey;
  label?: string;
}) {
  const t = useUiText();
  const { openManually } = useFeatureOnboarding(featureKey);
  const translatedLabel = label === "Ver explicação desta área"
    ? t(label, "View this area’s explanation", "Ver explicación de esta sección")
    : label;

  return (
    <button
      onClick={openManually}
      className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
    >
      <BookOpen className="h-3 w-3" />
      {translatedLabel}
    </button>
  );
}
