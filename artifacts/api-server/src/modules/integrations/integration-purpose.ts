/**
 * `provider` predates paid media and is not sufficient to identify a credential:
 * Meta Pages and Meta Ads (and TikTok Login Kit and Ads) share provider values.
 * New records must carry integrationPurpose; records without it are legacy organic
 * records unless they have the narrowly-scoped old OAuth paidMedia marker.
 */
export type IntegrationPurpose = "organic_social" | "paid_media";

export type PurposeMetadata = Record<string, unknown> | null | undefined;

export function integrationPurpose(metadata: PurposeMetadata): IntegrationPurpose {
  if (metadata?.["integrationPurpose"] === "paid_media") return "paid_media";
  if (metadata?.["integrationPurpose"] === "organic_social") return "organic_social";

  // Compatibility only for rows created by the first paid-media OAuth release.
  // A Page token has pageId and was never emitted with paidMedia, so it cannot
  // enter the paid credential resolver through this fallback.
  if (metadata?.["paidMedia"] === true && !metadata?.["pageId"]) return "paid_media";
  return "organic_social";
}

export function isPaidMediaIntegration(metadata: PurposeMetadata): boolean {
  return integrationPurpose(metadata) === "paid_media";
}

export function isOrganicSocialIntegration(metadata: PurposeMetadata): boolean {
  return integrationPurpose(metadata) === "organic_social";
}

export function metadataForPurpose(
  purpose: IntegrationPurpose,
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  return { ...metadata, integrationPurpose: purpose };
}