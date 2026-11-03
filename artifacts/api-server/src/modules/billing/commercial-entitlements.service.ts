import { and, eq } from "drizzle-orm";
import {
  commercialProductsTable,
  commercialSubscriptionsTable,
  db,
  entitlementGrantsTable,
} from "@workspace/db";

export type SocialMediaEntitlement = {
  active: boolean;
  status: "active" | "not_included" | "not_started" | "expired";
  subscriptionId: string | null;
  productId: string | null;
  productKey: string | null;
  productName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  durationDays: number | null;
};

type SocialMediaCapability = {
  enabled: boolean;
  durationDays: number | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parseSocialMediaCapability(value: unknown): SocialMediaCapability | null {
  if (value === true) return { enabled: true, durationDays: null };
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const capability = value as Record<string, unknown>;
  if (capability.enabled !== true) return null;
  const durationDays = capability.durationDays;
  return {
    enabled: true,
    durationDays: typeof durationDays === "number" && Number.isInteger(durationDays) && durationDays > 0
      ? durationDays
      : null,
  };
}

function capabilityFrom(productCapabilities: unknown, grantValue: unknown): SocialMediaCapability | null {
  const grant = parseSocialMediaCapability(grantValue);
  if (grant) return grant;
  const capabilities = asRecord(productCapabilities);
  return parseSocialMediaCapability(capabilities.social_media ?? capabilities.socialMedia);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Resolve Social Media access from the workspace's active commercial contracts.
 * Campaign type is intentionally not part of this decision. Product capability
 * is the contract snapshot; subscription dates define the actual access window.
 */
export async function resolveSocialMediaEntitlement(
  workspaceId: string,
  now = new Date(),
): Promise<SocialMediaEntitlement> {
  const subscriptions = await db.select({
    subscriptionId: commercialSubscriptionsTable.id,
    productId: commercialProductsTable.id,
    status: commercialSubscriptionsTable.status,
    startedAt: commercialSubscriptionsTable.startedAt,
    endsAt: commercialSubscriptionsTable.endsAt,
    createdAt: commercialSubscriptionsTable.createdAt,
    productKey: commercialProductsTable.key,
    productName: commercialProductsTable.name,
    productStatus: commercialProductsTable.status,
    capabilities: commercialProductsTable.capabilities,
  }).from(commercialSubscriptionsTable)
    .innerJoin(commercialProductsTable, eq(commercialProductsTable.id, commercialSubscriptionsTable.productId))
    .where(eq(commercialSubscriptionsTable.workspaceId, workspaceId));

  const candidates: Array<SocialMediaEntitlement & { sortAt: number }> = [];
  let notStarted: SocialMediaEntitlement | null = null;
  let expired: SocialMediaEntitlement | null = null;

  for (const subscription of subscriptions) {
    if (subscription.status !== "active" || subscription.productStatus !== "active") continue;
    const [grant] = await db.select({ value: entitlementGrantsTable.value })
      .from(entitlementGrantsTable)
      .where(and(
        eq(entitlementGrantsTable.workspaceId, workspaceId),
        eq(entitlementGrantsTable.subscriptionId, subscription.subscriptionId),
        eq(entitlementGrantsTable.capability, "social_media"),
      )).limit(1);
    const capability = capabilityFrom(subscription.capabilities, grant?.value);
    if (!capability) continue;

    const start = subscription.startedAt ?? subscription.createdAt;
    const end = subscription.endsAt ?? (capability.durationDays ? addDays(start, capability.durationDays) : null);
    const common = {
      subscriptionId: subscription.subscriptionId,
      productId: subscription.productId,
      productKey: subscription.productKey,
      productName: subscription.productName,
      startsAt: start.toISOString(),
      endsAt: end?.toISOString() ?? null,
      durationDays: capability.durationDays,
    };
    if (start > now) {
      notStarted ??= { active: false, status: "not_started", ...common };
      continue;
    }
    if (end && end <= now) {
      if (!expired || new Date(expired.endsAt ?? 0).getTime() < end.getTime()) {
        expired = { active: false, status: "expired", ...common };
      }
      continue;
    }
    candidates.push({ active: true, status: "active", ...common, sortAt: start.getTime() });
  }

  candidates.sort((a, b) => b.sortAt - a.sortAt);
  if (candidates[0]) {
    const { sortAt: _sortAt, ...entitlement } = candidates[0];
    return entitlement;
  }
  if (notStarted) return notStarted;
  if (expired) return expired;
  return {
    active: false,
    status: "not_included",
    subscriptionId: null,
    productId: null,
    productKey: null,
    productName: null,
    startsAt: null,
    endsAt: null,
    durationDays: null,
  };
}
