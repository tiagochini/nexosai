import { ValidationError } from "../../lib/errors.js";

export function determineSocialDiagnosisStatus(input: {
  accountMetricsAvailable: boolean;
  citedPublicResearchAvailable: boolean;
}): "generated" | "insufficient_data" {
  return input.accountMetricsAvailable || input.citedPublicResearchAvailable
    ? "generated"
    : "insufficient_data";
}

export function assertSocialDiagnosisApproved(socialMediaEntitled: boolean, brainData: unknown): void {
  if (!socialMediaEntitled) return;
  const brain = brainData && typeof brainData === "object" ? brainData as Record<string, unknown> : {};
  const diagnosis = brain.socialDiagnosis && typeof brain.socialDiagnosis === "object"
    ? brain.socialDiagnosis as Record<string, unknown>
    : undefined;
  if (diagnosis?.status === "approved") return;
  throw new ValidationError(
    "Antes de gerar a estratégia, conclua e confirme o Diagnóstico de Presença Social no briefing.",
  );
}
