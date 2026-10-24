import { z } from "zod/v4";
import { AppError } from "../../lib/errors.js";

export const metaId = z.string().regex(/^\d+$/);
const https = z.url().refine((value) => new URL(value).protocol === "https:");
const ids = z
  .array(z.object({ id: metaId }).strict())
  .min(1)
  .max(50);
export const META_PLACEMENTS = {
  facebook_feed: ["facebook", "facebook_positions", "feed"],
  facebook_stories: ["facebook", "facebook_positions", "story"],
  facebook_reels: ["facebook", "facebook_positions", "facebook_reels"],
  instagram_feed: ["instagram", "instagram_positions", "stream"],
  instagram_stories: ["instagram", "instagram_positions", "story"],
  instagram_reels: ["instagram", "instagram_positions", "reels"],
} as const;
export const metaPlacementKey = z.enum(
  Object.keys(META_PLACEMENTS) as [
    keyof typeof META_PLACEMENTS,
    ...Array<keyof typeof META_PLACEMENTS>,
  ],
);
export function placementTargeting(keys: Array<keyof typeof META_PLACEMENTS>) {
  const result: Record<string, string[]> = { publisher_platforms: [] };
  for (const key of new Set(keys)) {
    const [platform, field, position] = META_PLACEMENTS[key];
    if (!result.publisher_platforms!.includes(platform))
      result.publisher_platforms!.push(platform);
    (result[field] ??= []).push(position);
  }
  return result;
}
const targetingSchema = z
  .object({
    geo_locations: z
      .object({
        countries: z
          .array(z.string().regex(/^[A-Z]{2}$/))
          .min(1)
          .max(50),
      })
      .strict(),
    age_min: z.number().int().min(18).max(65).optional(),
    age_max: z.number().int().min(18).max(65).optional(),
    genders: z
      .array(z.union([z.literal(1), z.literal(2)]))
      .min(1)
      .max(2)
      .optional(),
    custom_audiences: ids.optional(),
    excluded_custom_audiences: ids.optional(),
    targeting_automation: z
      .object({ advantage_audience: z.union([z.literal(0), z.literal(1)]) })
      .strict()
      .optional(),
    publisher_platforms: z
      .array(z.enum(["facebook", "instagram"]))
      .min(1)
      .max(2)
      .optional(),
    facebook_positions: z
      .array(z.enum(["feed", "story", "facebook_reels"]))
      .min(1)
      .max(3)
      .optional(),
    instagram_positions: z
      .array(z.enum(["stream", "story", "reels"]))
      .min(1)
      .max(3)
      .optional(),
  })
  .strict();
export function validateMetaTargeting(input: unknown) {
  const result = targetingSchema.safeParse(input);
  const fail = (message: string): never => {
    throw new AppError(422, message, "AUDIENCE_CONFIGURATION_UNSUPPORTED");
  };
  if (!result.success)
    return fail(
      "Revise países, idades, públicos, Advantage+ e placements. Campos desconhecidos não são aceitos.",
    );
  const value = result.data;
  if ((value.age_min ?? 18) > (value.age_max ?? 65))
    fail("Revise o intervalo de idades.");
  if (
    value.targeting_automation?.advantage_audience === 1 &&
    (value.age_max !== undefined || value.genders !== undefined)
  )
    fail(
      "Advantage+ usa idade mínima; remova limite máximo e gênero deste contrato para não prometer restrições rígidas.",
    );
  if (
    value.custom_audiences?.some((item) =>
      value.excluded_custom_audiences?.some(
        (excluded) => excluded.id === item.id,
      ),
    )
  )
    fail("Um público não pode ser incluído e excluído ao mesmo tempo.");
  for (const platform of ["facebook", "instagram"] as const) {
    const positions = value[`${platform}_positions`];
    if (positions && !value.publisher_platforms?.includes(platform))
      fail("O placement precisa da plataforma correspondente.");
    if (value.publisher_platforms?.includes(platform) && !positions?.length)
      fail("Escolha os placements de cada plataforma manual.");
  }
}

const cta = z
  .object({
    type: z.enum(["LEARN_MORE", "SIGN_UP", "SHOP_NOW"]),
    value: z.object({ link: https }).strict().optional(),
  })
  .strict();
const common = {
  message: z.string().max(5000).optional(),
  name: z.string().max(300).optional(),
  description: z.string().max(500).optional(),
};
const link = z
  .object({
    ...common,
    link: https,
    picture: https.optional(),
    image_hash: z.string().min(1).optional(),
    call_to_action: cta.optional(),
  })
  .strict();
const video = z
  .object({
    video_id: metaId,
    image_url: https,
    message: z.string().max(5000).optional(),
    title: z.string().max(300).optional(),
    call_to_action: cta,
  })
  .strict();
const template = z
  .object({ ...common, link: https, call_to_action: cta.optional() })
  .strict();
const creativeSchema = z
  .object({
    product_set_id: metaId.optional(),
    object_story_spec: z
      .object({
        page_id: metaId,
        link_data: link.optional(),
        video_data: video.optional(),
        template_data: template.optional(),
      })
      .strict(),
  })
  .strict();
export function validateMetaCreative(
  input: unknown,
  campaign: Record<string, unknown>,
) {
  const parsed = creativeSchema.safeParse(input);
  const fail = (): never => {
    throw new AppError(
      422,
      "Revise o criativo aprovado: imagem com destino, vídeo Meta com miniatura e CTA, ou catálogo com product_set_id compatível.",
      "CREATIVE_READINESS_REQUIRED",
    );
  };
  if (!parsed.success) return fail();
  const creative = parsed.data,
    story = creative.object_story_spec;
  if (
    [story.link_data, story.video_data, story.template_data].filter(Boolean)
      .length !== 1
  )
    fail();
  const catalog = campaign.catalog as
    { productSetId?: string; catalogId?: string } | undefined;
  if (
    story.link_data &&
    (story.link_data.link !== campaign.destination ||
      (!story.link_data.picture && !story.link_data.image_hash))
  )
    fail();
  if (
    story.video_data &&
    story.video_data.call_to_action.value?.link !== campaign.destination
  )
    fail();
  if (
    story.link_data?.call_to_action?.value?.link &&
    story.link_data.call_to_action.value.link !== campaign.destination
  )
    fail();
  if (story.template_data) {
    if (
      campaign.objective !== "OUTCOME_SALES" ||
      !catalog?.catalogId ||
      creative.product_set_id !== catalog.productSetId ||
      story.template_data.link !== campaign.destination
    )
      fail();
  } else if (creative.product_set_id || catalog) fail();
}
export function metaCreativePayload(
  creative: Record<string, unknown>,
  name: unknown,
) {
  return {
    name,
    object_story_spec: creative.object_story_spec,
    ...(creative.product_set_id
      ? { product_set_id: creative.product_set_id }
      : {}),
  };
}
