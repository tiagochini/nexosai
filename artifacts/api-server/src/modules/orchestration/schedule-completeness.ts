type Json = Record<string, unknown>;
const object = (value: unknown): Json => value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};

/** Derive completion from persisted deliverables, never from UI counters. */
export function scheduleCompleteness(timeline: unknown, pieces: Array<{ type: string; launchPhase?: string | null; content?: unknown }>) {
  const preview = object(object(timeline).schedulePreview);
  const phases = Array.isArray(preview.phases) ? preview.phases.map(object) : [];
  const generated = new Set(pieces.filter(piece => piece.type === "content_calendar" && hasUsableCalendar(piece.content))
    .map(piece => piece.launchPhase ?? object(piece.content).launchPhase));
  const missingPhases = phases.map(phase => String(phase.phase ?? phase.id ?? phase.name ?? ""))
    .filter(id => id && !generated.has(id));
  return { required: phases.length > 0, ready: missingPhases.length === 0, missingPhases };
}

export function hasUsableCalendar(content: unknown): boolean {
  const calendar = object(content).calendar;
  return Array.isArray(calendar) && calendar.length > 0 && calendar.every(item => {
    const entry = object(item);
    return typeof entry.caption === "string" && entry.caption.trim().length > 0
      && typeof entry.platform === "string" && entry.platform.trim().length > 0;
  });
}
