/** Briefing duration is authoritative; legacy plans are only a fallback. */
export function resolveCampaignDays(intake: Record<string, unknown>, plan?: Record<string, unknown>): number {
  const nested = intake.campaign as Record<string, unknown> | undefined;
  const timeline = intake["campaign.timeline"] ?? nested?.timeline;
  const match = typeof timeline === "string" ? /^(\d+)_days$/.exec(timeline) : null;
  for (const value of [match?.[1], intake["campaign.durationDays"] ?? nested?.durationDays, plan?.totalDays, 21]) {
    const days = Number(value);
    if (Number.isSafeInteger(days) && days > 0) return days;
  }
  return 21;
}
export function calendarRanges(days: number): { start: number; end: number }[] {
  return Array.from({ length: Math.ceil(days / 7) }, (_, index) => ({ start: index * 7 + 1, end: Math.min(days, index * 7 + 7) }));
}
export function coversDays(rows: unknown, start: number, end: number): boolean {
  if (!Array.isArray(rows)) return false;
  const days = new Set<number>();
  for (const row of rows) {
    const day = row?.day;
    if (!Number.isInteger(day) || day < start || day > end) return false;
    days.add(day);
  }
  for (let day = start; day <= end; day++) if (!days.has(day)) return false;
  return true;
}
export function assertDayCoverage(rows: unknown, start: number, end: number): void {
  if (!coversDays(rows, start, end)) throw new Error(`Calendário incompleto: é necessário cobrir todos os dias ${start} a ${end}. O material anterior foi preservado.`);
}
