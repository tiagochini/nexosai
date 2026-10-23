import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import {
  db,
  paidMediaDatasetsTable,
  paidMediaEventReceiptsTable as receipts,
} from "@workspace/db";
import {
  encryptIntegrationToken,
  decryptIntegrationToken,
} from "@workspace/db/token-crypto";
import {
  paidMediaProvider,
  PaidMediaProviderError,
  type MetaCapiEvent,
  type ProviderConversionResult,
} from "./providers.js";

// Local retention/retry policy, not a claim about Meta's deduplication guarantee.
export const CAPI_RETRY_TTL = 24 * 60 * 60_000;
export const CAPI_LEASE_MS = 5 * 60_000;
export const CAPI_MAX_ATTEMPTS = 5;
export function retryableCapiError(error: unknown) {
  if (!(error instanceof PaidMediaProviderError)) return true; // transport/ambiguous timeout
  return (
    error.code === "RATE_LIMITED" ||
    (error.code === "PROVIDER_ERROR" &&
      (error.status == null || error.status >= 500))
  );
}
export function capiRetryEnvelope(
  dataset: {
    id: string;
    workspaceId: string;
    accountId: string;
    providerDatasetId: string;
  },
  event: MetaCapiEvent,
  now = new Date(),
) {
  return {
    retryPayload: encryptIntegrationToken(
      JSON.stringify({ version: 1, dataset, event }),
    ),
    deliveryAttempts: 1,
    retryAt: new Date(now.getTime() + CAPI_LEASE_MS),
    retryExpiresAt: new Date(now.getTime() + CAPI_RETRY_TTL),
  };
}
export function decodeCapiRetry(
  payload: string,
  dataset: {
    id: string;
    workspaceId: string;
    accountId: string;
    providerDatasetId: string;
  },
  receipt: { eventId: string; eventName: string; occurredAt: Date },
) {
  const saved = JSON.parse(decryptIntegrationToken(payload));
  if (
    saved.version !== 1 ||
    ["id", "workspaceId", "accountId", "providerDatasetId"].some(
      (key) => saved.dataset?.[key] !== dataset[key as keyof typeof dataset],
    ) ||
    saved.event?.eventId !== receipt.eventId ||
    saved.event?.eventName !== receipt.eventName ||
    new Date(saved.event?.eventTime).getTime() !== receipt.occurredAt.getTime()
  )
    throw new Error("Invalid CAPI retry scope");
  // This is already normalized/hashed. Normalizing twice would corrupt match keys.
  return {
    ...saved.event,
    eventTime: new Date(saved.event.eventTime),
  } as MetaCapiEvent;
}
export async function finishCapiAttempt(
  id: string,
  attemptedAt: Date,
  attempts: number,
  expiresAt: Date,
  result?: ProviderConversionResult,
  error?: unknown,
  now = new Date(),
) {
  const providerError =
    error instanceof PaidMediaProviderError ? error : undefined;
  const retry =
    !result &&
    retryableCapiError(error) &&
    attempts < CAPI_MAX_ATTEMPTS &&
    now < expiresAt;
  const delay = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000][
    Math.min(attempts - 1, 3)
  ]!;
  const status = result
    ? "sent"
    : retry
      ? "pending"
      : providerError?.code === "AUTH" || providerError?.code === "UNSUPPORTED"
        ? "capability_blocked"
        : "failed";
  await db
    .update(receipts)
    .set({
      deliveryStatus: status,
      retryAt: retry
        ? new Date(Math.min(now.getTime() + delay, expiresAt.getTime()))
        : null,
      ...(!retry ? { retryPayload: null } : {}),
      providerResponse: result?.evidence ?? null,
      providerErrorCode: result
        ? null
        : (providerError?.code ?? "PROVIDER_ERROR"),
      providerErrorMessage: result
        ? null
        : retry
          ? "Reenvio CAPI agendado; identificador original preservado."
          : "Envio CAPI encerrado; consulte o código seguro.",
    })
    .where(
      and(
        eq(receipts.id, id),
        eq(receipts.providerAttemptedAt, attemptedAt),
        eq(receipts.deliveryAttempts, attempts),
      ),
    );
  return status;
}
export async function capiRetryTick(clock = () => new Date()) {
  let now = clock();
  const due = await db
    .select({ receipt: receipts, dataset: paidMediaDatasetsTable })
    .from(receipts)
    .innerJoin(
      paidMediaDatasetsTable,
      and(
        eq(receipts.datasetId, paidMediaDatasetsTable.id),
        eq(receipts.workspaceId, paidMediaDatasetsTable.workspaceId),
      ),
    )
    .where(
      and(
        eq(receipts.source, "server"),
        eq(receipts.deliveryStatus, "pending"),
        isNotNull(receipts.retryPayload),
        lte(receipts.retryAt, now),
      ),
    )
    .orderBy(receipts.retryAt)
    .limit(50);
  for (const { receipt, dataset } of due) {
    now = clock();
    if (
      !receipt.retryExpiresAt ||
      now >= receipt.retryExpiresAt ||
      receipt.deliveryAttempts >= CAPI_MAX_ATTEMPTS
    ) {
      await db
        .update(receipts)
        .set({
          deliveryStatus: "failed",
          retryAt: null,
          retryPayload: null,
          providerErrorCode: "RETRY_EXHAUSTED",
          providerErrorMessage: "Prazo ou limite de reenvio CAPI atingido.",
        })
        .where(
          and(
            eq(receipts.id, receipt.id),
            eq(receipts.deliveryStatus, "pending"),
            eq(receipts.deliveryAttempts, receipt.deliveryAttempts),
            lte(receipts.retryAt, now),
          ),
        );
      continue;
    }
    // Compare-and-swap lease also fences late responses from a previous attempt.
    const [claimed] = await db
      .update(receipts)
      .set({
        providerAttemptedAt: now,
        deliveryAttempts: sql`${receipts.deliveryAttempts} + 1`,
        retryAt: new Date(now.getTime() + CAPI_LEASE_MS),
      })
      .where(
        and(
          eq(receipts.id, receipt.id),
          eq(receipts.deliveryStatus, "pending"),
          eq(receipts.deliveryAttempts, receipt.deliveryAttempts),
          lte(receipts.retryAt, now),
        ),
      )
      .returning({ id: receipts.id });
    if (!claimed) continue;
    const attempts = receipt.deliveryAttempts + 1;
    let event: MetaCapiEvent;
    try {
      event = decodeCapiRetry(receipt.retryPayload!, dataset, receipt);
      if (
        dataset.provider !== "meta_ads" ||
        (receipt.payload as Record<string, unknown>)["marketingConsent"] !==
          true
      )
        throw new PaidMediaProviderError(
          "Retry not consented",
          "PRECONDITION_FAILED",
        );
    } catch {
      await finishCapiAttempt(
        receipt.id,
        now,
        attempts,
        receipt.retryExpiresAt,
        undefined,
        new PaidMediaProviderError(
          "Invalid retry envelope",
          "PRECONDITION_FAILED",
        ),
      );
      continue;
    }
    let result: ProviderConversionResult | undefined, error: unknown;
    try {
      result = await paidMediaProvider(dataset.provider).sendConversionEvent(
        dataset.workspaceId,
        dataset.accountId,
        dataset.providerDatasetId,
        event,
      );
    } catch (caught) {
      error = caught;
    }
    await finishCapiAttempt(
      receipt.id,
      now,
      attempts,
      receipt.retryExpiresAt,
      result,
      error,
    );
  }
}
