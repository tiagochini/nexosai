import { AppError } from "../../lib/errors.js";

export function determineSocialDiagnosisStatus(input: {
  accountMetricsAvailable: boolean;
  citedPublicResearchAvailable: boolean;
}): "generated" | "insufficient_data" {
  return input.accountMetricsAvailable || input.citedPublicResearchAvailable
    ? "generated"
    : "insufficient_data";
}

export function assertSocialDiagnosisApproved(brainData: unknown): void {
  const brain = brainData && typeof brainData === "object" ? brainData as Record<string, unknown> : {};
  const diagnosis = brain.socialDiagnosis && typeof brain.socialDiagnosis === "object"
    ? brain.socialDiagnosis as Record<string, unknown>
    : undefined;
  if (diagnosis?.status === "approved") return;
  throw new AppError(
    409,
    "Antes de continuar, conclua e confirme o Diagnóstico de Presença Social no briefing.",
    "SOCIAL_DIAGNOSIS_REQUIRED",
  );
}
