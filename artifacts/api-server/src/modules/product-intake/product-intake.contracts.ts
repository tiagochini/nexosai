export const PRODUCT_INTAKE_ENTRY_POINTS = ["launch", "market_intel", "social_media", "paid_media"] as const;
export type ProductIntakeEntryPoint = typeof PRODUCT_INTAKE_ENTRY_POINTS[number];

export function continueDecision(hasDraft: boolean) {
  return hasDraft ? "continue_or_review" : "create_other_product_or_start";
}

export function exactProductBinding(binding: { workspaceId: string; commercialProductId: string; intakeProductId: string }, expected: { workspaceId: string; commercialProductId: string; intakeProductId: string }) {
  return binding.workspaceId === expected.workspaceId && binding.commercialProductId === expected.commercialProductId && binding.intakeProductId === expected.intakeProductId;
}

export function successorVersion(latestVersion: number, status: string) {
  return status === "draft" ? latestVersion : latestVersion + 1;
}

export function affectedSurfaceKeys() {
  return ["launch", "marketIntel", "socialMedia", "paidMedia"] as const;
}

export function resolveUnambiguousSubscription(subscriptions: Array<{ id: string; productId: string }>) {
  const productIds = new Set(subscriptions.map((item) => item.productId));
  return productIds.size === 1 && subscriptions.length === 1 ? subscriptions[0] : null;
}

export function canonicalIntakeSnapshot(binding: { approved: boolean; productMatches: boolean }, canonical: unknown, staleCampaignData: unknown) {
  if (!binding.approved || !binding.productMatches) throw new Error("invalid canonical intake binding");
  return canonical ?? staleCampaignData;
}

export function intakeResponseSemantics(status: string) {
  const canonicalCurrent = status === "approved" || status === "locked";
  return { canonicalCurrent, draft: status === "draft" };
}