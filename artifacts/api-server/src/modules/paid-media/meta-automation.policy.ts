import { z } from "zod/v4";
import { AppError } from "../../lib/errors.js";
export const creativeFeatureNames = [
  "standard_enhancements",
  "text_optimizations",
  "image_touchups",
  "image_uncrop",
  "video_auto_crop",
  "product_browsing",
] as const;
const feature = z
  .object({ enroll_status: z.enum(["OPT_IN", "OPT_OUT"]) })
  .strict();
export const creativeAutomationSchema = z
  .object({
    creative_features_spec: z
      .object(
        Object.fromEntries(
          creativeFeatureNames.map((key) => [key, feature.optional()]),
        ) as Record<
          (typeof creativeFeatureNames)[number],
          z.ZodOptional<typeof feature>
        >,
      )
      .strict(),
  })
  .strict();
export const lifecycleSchema = z
  .object({
    mode: z.enum(["acquisition", "retention"]),
    customerAudienceIds: z.array(z.string().regex(/^\d+$/)).min(1).max(50),
  })
  .strict();
export function assertLifecycle(
  input: unknown,
  targeting: Record<string, any>,
) {
  if (input == null) return;
  const result = lifecycleSchema.safeParse(input);
  if (!result.success)
    throw new AppError(
      422,
      "Revise o objetivo de aquisição/retenção e os públicos de clientes.",
      "LIFECYCLE_INVALID",
    );
  const rule = result.data,
    included = (targeting.custom_audiences ?? []).map((row: any) => row.id),
    excluded = (targeting.excluded_custom_audiences ?? []).map(
      (row: any) => row.id,
    );
  if (
    rule.mode === "acquisition" &&
    rule.customerAudienceIds.some(
      (id) => !excluded.includes(id) || included.includes(id),
    )
  )
    throw new AppError(
      422,
      "Aquisição exige excluir todos os públicos de clientes aprovados.",
      "LIFECYCLE_INVALID",
    );
  if (
    rule.mode === "retention" &&
    (targeting.targeting_automation?.advantage_audience !== 0 ||
      included.some((id: string) => !rule.customerAudienceIds.includes(id)) ||
      rule.customerAudienceIds.some(
        (id) => !included.includes(id) || excluded.includes(id),
      ))
  )
    throw new AppError(
      422,
      "Retenção exige público original restrito aos públicos de clientes, sem expansão Advantage+.",
      "LIFECYCLE_INVALID",
    );
}
