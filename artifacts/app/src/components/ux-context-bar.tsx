/**
 * UxContextBar — responde as 8 perguntas da Regra Suprema de UX da NEXOS.
 *
 * Onde estou? | O que acontece agora? | Por que importa? | O que a NEXOS entendeu?
 * O que falta? | O que posso editar? | O que preciso aprovar? | Qual é o próximo passo?
 *
 * Usado no modo Fundador em qualquer tela que precise orientar o usuário.
 * No modo Arquiteto é omitido (usuário avançado não precisa).
 */

import { ChevronRight, Info, Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMode } from "@/lib/mode";
import { useUiText } from "@/lib/i18n";

export interface UxContextProps {
  /** Onde estou — nome da fase/tela atual */
  where: string;
  /** O que está acontecendo agora */
  happening: string;
  /** Por que esta etapa importa */
  why?: string;
  /** O que a NEXOS já entendeu (resumo breve) */
  understood?: string;
  /** O que falta decidir */
  missing?: string;
  /** O que o usuário pode editar agora */
  canEdit?: string;
  /** O que precisa de aprovação */
  requiresApproval?: string;
  /** Próximo passo — label */
  nextStep: string;
  /** Próximo passo — ação ao clicar (opcional) */
  onNextStep?: () => void;
  /** Próximo passo — link href (alternativa ao onNextStep) */
  nextStepHref?: string;
  /** Estado visual: idle | working | needs_action | done */
  state?: "idle" | "working" | "needs_action" | "done";
  /** Mostrar mesmo no modo Arquiteto (default: false) */
  showInExpertMode?: boolean;
  /** Compacto — só mostra where + nextStep (para telas densas) */
  compact?: boolean;
}

const STATE_CONFIG = {
  idle: {
    icon: Clock,
    color: "text-muted-foreground",
    border: "border-border/40",
    bg: "bg-card/30",
    dot: "bg-muted-foreground/40",
  },
  working: {
    icon: Loader2,
    color: "text-primary",
    border: "border-primary/30",
    bg: "bg-primary/5",
    dot: "bg-primary animate-pulse",
  },
  needs_action: {
    icon: AlertCircle,
    color: "text-yellow-400",
    border: "border-yellow-400/30",
    bg: "bg-yellow-400/5",
    dot: "bg-yellow-400 animate-pulse",
  },
  done: {
    icon: CheckCircle2,
    color: "text-success",
    border: "border-success/30",
    bg: "bg-success/5",
    dot: "bg-success",
  },
};

export function UxContextBar({
  where,
  happening,
  why,
  understood,
  missing,
  canEdit,
  requiresApproval,
  nextStep,
  onNextStep,
  nextStepHref,
  state = "idle",
  showInExpertMode = false,
  compact = false,
}: UxContextProps) {
  const { isArquiteto } = useMode();
  const t = useUiText();

  if (isArquiteto && !showInExpertMode) return null;

  const cfg = STATE_CONFIG[state];
  const StateIcon = cfg.icon;

  if (compact) {
    return (
      <div className={`flex items-center justify-between gap-4 px-4 py-2.5 border ${cfg.border} ${cfg.bg}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
          <span className={`font-mono text-[11px] uppercase tracking-widest font-bold ${cfg.color}`}>
            {where}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground/60 truncate">
            — {happening}
          </span>
        </div>
        <NextStepButton
          label={nextStep}
          href={nextStepHref}
          onClick={onNextStep}
          state={state}
        />
      </div>
    );
  }

  return (
    <div className={`border ${cfg.border} ${cfg.bg} relative overflow-hidden`}>
      {/* accent line */}
      <div className={`absolute left-0 inset-y-0 w-[2px] ${cfg.dot.replace("animate-pulse", "")}`} />

      <div className="px-5 py-4 pl-6">
        {/* Row 1: where + state */}
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2.5">
            <StateIcon
              className={`h-3.5 w-3.5 shrink-0 ${cfg.color} ${state === "working" ? "animate-spin" : ""}`}
            />
            <span className={`font-mono text-[11px] uppercase tracking-widest font-bold ${cfg.color}`}>
              {where}
            </span>
          </div>
          <NextStepButton
            label={nextStep}
            href={nextStepHref}
            onClick={onNextStep}
            state={state}
          />
        </div>

        {/* Row 2: happening */}
        <p className="font-mono text-sm text-foreground/80 mb-3 leading-relaxed">
          {happening}
        </p>

        {/* Row 3: detail grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
          {why && (
            <ContextItem icon={<Info className="h-3 w-3" />} label={t("Por que importa", "Why it matters", "Por qué importa")} value={why} />
          )}
          {understood && (
            <ContextItem icon={<CheckCircle2 className="h-3 w-3 text-success" />} label={t("NEXOS entendeu", "NEXOS understood", "NEXOS entendió")} value={understood} />
          )}
          {missing && (
            <ContextItem icon={<AlertCircle className="h-3 w-3 text-yellow-400" />} label={t("Falta decidir", "Needs a decision", "Falta decidir")} value={missing} />
          )}
          {canEdit && (
            <ContextItem icon={<ChevronRight className="h-3 w-3 text-primary" />} label={t("Você pode editar", "You can edit", "Puedes editar")} value={canEdit} />
          )}
          {requiresApproval && (
            <ContextItem icon={<AlertCircle className="h-3 w-3 text-yellow-400" />} label={t("Aguardando sua aprovação", "Waiting for your approval", "Esperando tu aprobación")} value={requiresApproval} highlighted />
          )}
        </div>
      </div>
    </div>
  );
}

function ContextItem({
  icon,
  label,
  value,
  highlighted = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlighted?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-muted-foreground/50">{icon}</span>
      <div className="min-w-0">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 block mb-0.5">
          {label}
        </span>
        <span className={`font-mono text-[11px] leading-relaxed ${highlighted ? "text-yellow-400" : "text-foreground/70"}`}>
          {value}
        </span>
      </div>
    </div>
  );
}

function NextStepButton({
  label,
  href,
  onClick,
  state,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  state: UxContextProps["state"];
}) {
  const isWorking = state === "working";
  const isDone = state === "done";

  const cls =
    "rounded-none font-mono uppercase tracking-widest font-bold gap-1.5 text-[11px] h-7 px-3 shrink-0 " +
    (isDone
      ? "border-success/40 text-success hover:border-success/60"
      : isWorking
      ? "border-primary/20 text-primary/50 cursor-not-allowed pointer-events-none"
      : "btn-weapon-primary");

  if (href && !onClick) {
    return (
      <a href={href}>
        <Button variant={isDone ? "outline" : "default"} size="sm" className={cls} disabled={isWorking}>
          {isWorking ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          {label}
          {!isWorking && <ChevronRight className="h-3 w-3" />}
        </Button>
      </a>
    );
  }

  return (
    <Button
      variant={isDone ? "outline" : "default"}
      size="sm"
      className={cls}
      onClick={onClick}
      disabled={isWorking}
    >
      {isWorking ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      {label}
      {!isWorking && <ChevronRight className="h-3 w-3" />}
    </Button>
  );
}
