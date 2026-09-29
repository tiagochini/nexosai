import { and, eq } from "drizzle-orm";
import { db, workspaceIntegrationsTable } from "@workspace/db";
import { env } from "../../lib/env.js";
import { AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { metaGraphUrl } from "../../lib/meta-graph.constants.js";
import { metaGraphFetch } from "../../lib/meta-graph.transport.js";
import { isOrganicSocialIntegration } from "../integrations/integration-purpose.js";

export const META_INSTAGRAM_WEBHOOK_FIELDS = [
  "comments",
  "messages",
  "messaging_postbacks",
] as const;

/**
 * Subscribe one connected Instagram professional account to this Meta app.
 * This changes provider state, so callers must opt in explicitly.
 */
export async function ensureInstagramWebhookSubscription(
  accountId: string,
  accessToken: string,
): Promise<void> {
  const response = await metaGraphFetch(metaGraphUrl(`${accountId}/subscribed_apps`), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      subscribed_fields: META_INSTAGRAM_WEBHOOK_FIELDS.join(","),
      access_token: accessToken,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json().catch(() => ({})) as {
    success?: boolean;
    error?: { message?: string };
  };
  if (!response.ok || payload.success !== true) {
    throw new AppError(
      502,
      payload.error?.message ?? "Meta rejected the Instagram webhook subscription",
      "META_WEBHOOK_SUBSCRIPTION_FAILED",
    );
  }
}

/**
 * Reconcile existing accounts only when explicitly enabled. The default is a
 * no-op so a restored production database cannot mutate Meta from a dev boot.
 */
export async function reconcileInstagramWebhookSubscriptions(): Promise<{
  enabled: boolean;
  subscribed: number;
  failed: number;
}> {
  if (!env.META_WEBHOOK_AUTO_SUBSCRIBE) {
    return { enabled: false, subscribed: 0, failed: 0 };
  }

  const rows = await db.select().from(workspaceIntegrationsTable).where(and(
    eq(workspaceIntegrationsTable.provider, "instagram"),
    eq(workspaceIntegrationsTable.status, "connected"),
  ));
  const integrations = rows.filter((row) =>
    isOrganicSocialIntegration(row.metadata as Record<string, unknown> | null));

  let subscribed = 0;
  let failed = 0;
  for (const integration of integrations) {
    if (!integration.accountId || !integration.accessToken) {
      failed += 1;
      continue;
    }
    try {
      await ensureInstagramWebhookSubscription(integration.accountId, integration.accessToken);
      subscribed += 1;
      logger.info(
        { accountId: integration.accountId, fields: META_INSTAGRAM_WEBHOOK_FIELDS },
        "Instagram webhook subscription verified",
      );
    } catch (error) {
      failed += 1;
      logger.warn(
        { accountId: integration.accountId, errorCode: error instanceof AppError ? error.code : "UNKNOWN" },
        "Instagram webhook subscription failed",
      );
    }
  }
  return { enabled: true, subscribed, failed };
}
