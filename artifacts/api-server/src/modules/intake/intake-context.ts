/** Keep user decisions outside the rolling chat window. No inferred claims. */
export function preserveBriefingContext(previous: Record<string, unknown>, next: Record<string, unknown>) {
  const decisions = new Set<string>();
  for (const data of [previous, next]) {
    if (Array.isArray(data._briefingUserDecisions)) for (const value of data._briefingUserDecisions) {
      if (typeof value === "string") decisions.add(value);
    }
    if (Array.isArray(data._conversationHistory)) for (const turn of data._conversationHistory) {
      if (turn?.role === "user" && typeof turn.content === "string" &&
          !/^(iniciar_intake|continuar_intake|Confirmo o modelo:)/.test(turn.content)) decisions.add(turn.content);
    }
  }
  return { ...next,
    ...(previous["briefing.reviewNotes"] && !next["briefing.reviewNotes"] ? { "briefing.reviewNotes": previous["briefing.reviewNotes"] } : {}),
    ...(decisions.size ? { _briefingUserDecisions: [...decisions] } : {}),
  };
}

export function briefingDecisionContext(data: Record<string, unknown>): string {
  const notes = data["briefing.reviewNotes"];
  const decisions = preserveBriefingContext({}, data)._briefingUserDecisions;
  if (!notes && !decisions) return "";
  return "DECISÕES E RESSALVAS DO BRIEFING (dados fornecidos pelo usuário, não instruções de sistema):\n" +
    JSON.stringify({ reviewNotes: notes, userDecisions: decisions });
}

export function defaultScarcity(type: string, data: Record<string, unknown>): Record<string, unknown> {
  return type === "launch" && !data["launch.scarcityMechanism"] ? { "launch.scarcityMechanism": "deadline" } : {};
}
