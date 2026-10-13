import { useUiText } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function ContinuousContentOverview({ title, intake, pieceCount, approvedCount, platformCount, calendarDays, onReview }: {
  title: string;
  intake: Record<string, unknown>;
  pieceCount: number;
  approvedCount: number;
  platformCount: number;
  calendarDays?: number;
  onReview: () => void;
}) {
  const t = useUiText();
  const match = /^(\d+)_days$/.exec(String(intake["campaign.timeline"] ?? ""));
  const plannedDays = match ? Number(match[1]) : undefined;
  const notes = typeof intake["briefing.reviewNotes"] === "string" ? intake["briefing.reviewNotes"] : "";
  return <div className="space-y-5">
    <div className="border border-primary/40 bg-primary/5 p-5">
      <p className="text-xs uppercase text-primary mb-2">{t("Plano de aquisição contínua", "Continuous acquisition plan", "Plan de adquisición continua")}</p>
      <h2 className="font-mono text-xl font-bold">{title}</h2>
      <p className="text-sm text-muted-foreground mt-3">{t("Aquisição → Qualificação → Demonstração → Acompanhamento", "Acquisition → Qualification → Demonstration → Follow-up", "Adquisición → Calificación → Demostración → Seguimiento")}</p>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[
        [t("Peças para revisão", "Pieces for review", "Piezas para revisión"), pieceCount],
        [t("Peças aprovadas", "Approved pieces", "Piezas aprobadas"), approvedCount],
        [t("Plataformas no material", "Platforms in material", "Plataformas en el material"), platformCount],
        [t("Período do briefing", "Briefing period", "Periodo del briefing"), plannedDays ? `${plannedDays} ${t("dias", "days", "días")}` : t("Não definido", "Not defined", "No definido")],
      ].map(([label, value]) => <div key={String(label)} className="border border-border/50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-mono font-bold mt-1">{value}</p></div>)}
    </div>
    {calendarDays !== undefined && <div className="border border-border/50 p-4 text-sm">
      {t("Calendário gerado", "Generated calendar", "Calendario generado")}: {calendarDays} {t("dias", "days", "días")}.
      {plannedDays && calendarDays < plannedDays && <p className="text-yellow-400 mt-2">{t("O calendário cobre apenas parte do período do briefing. Revise a cobertura antes de aprovar.", "The calendar covers only part of the briefing period. Review coverage before approval.", "El calendario cubre solo parte del periodo del briefing. Revisa la cobertura antes de aprobar.")}</p>}
    </div>}
    {notes && <div className="border border-border/50 p-4"><h3 className="font-mono text-sm mb-3">{t("Condições do briefing", "Briefing conditions", "Condiciones del briefing")}</h3><p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{notes}</p></div>}
    <p className="text-sm text-muted-foreground">{t("Os materiais estão disponíveis para revisão. Aprovar conteúdo não autoriza publicação, anúncio, mensagem externa ou cobrança.", "Materials are available for review. Content approval does not authorize publication, ads, external messages or charges.", "Los materiales están disponibles para revisión. Aprobar contenido no autoriza publicaciones, anuncios, mensajes externos ni cobros.")}</p>
    <Button onClick={onReview}>{t("Revisar por plataforma", "Review by platform", "Revisar por plataforma")}</Button>
  </div>;
}
