import { ValidationError } from "../../lib/errors.js";

export const SOCIAL_DIAGNOSIS_CAMPAIGN_TYPES = new Set([
  "launch", "perpetual_launch", "semente_launch", "flash_sale", "live_sale",
]);

export function determineSocialDiagnosisStatus(input: {
  accountMetricsAvailable: boolean;
  citedPublicResearchAvailable: boolean;
}): "generated" | "insufficient_data" {
  return input.accountMetricsAvailable || input.citedPublicResearchAvailable
    ? "generated"
    : "insufficient_data";
}

export function assertSocialDiagnosisApproved(campaignType: string, brainData: unknown): void {
  if (!SOCIAL_DIAGNOSIS_CAMPAIGN_TYPES.has(campaignType)) return;
  const brain = brainData && typeof brainData === "object" ? brainData as Record<string, unknown> : {};
  const diagnosis = brain.socialDiagnosis && typeof brain.socialDiagnosis === "object"
    ? brain.socialDiagnosis as Record<string, unknown>
    : undefined;
  if (diagnosis?.status === "approved") return;
  throw new ValidationError(
    "Antes de gerar a estratégia, conclua e confirme o Diagnóstico de Presença Social no briefing.",
  );
}
