import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod/v4";
import { and, eq } from "drizzle-orm";
import { db, pagesTable, paidMediaDatasetsTable } from "@workspace/db";
import { AppError } from "../../lib/errors.js";
import { recordDatasetEvent } from "../paid-media/attribution.service.js";

export const landingTrackingSchema = z
  .object({
    pageId: z.string().uuid(),
    eventKey: z.string().regex(/^[a-f0-9]{64}$/),
    marketingConsent: z.boolean(),
    fbp: z.string().max(255).optional(),
    fbc: z.string().max(255).optional(),
  })
  .strict();
export type LandingTrackingInput = z.infer<typeof landingTrackingSchema>;
type RequestContext = { origin?: string; ip?: string; userAgent?: string };

export function assertLandingAdTracking(
  snapshot: unknown,
  domain: string,
  tracking: { metaPixelId?: string | null; metaLeadEventName?: string },
): void {
  const plan = snapshot as {
    strategy?: {
      paidMedia?: {
        destinationUrl?: string;
        objective?: string;
        tracking?: { pixelId?: string; conversionEvent?: string };
      };
    };
  } | null;
  const ads = plan?.strategy?.paidMedia;
  if (!ads?.destinationUrl) return;
  try {
    if (new URL(ads.destinationUrl).origin !== `https://${domain}`) return;
  } catch {
    return;
  }
  if (ads.tracking?.pixelId && ads.tracking.pixelId !== tracking.metaPixelId)
    throw new AppError(
      422,
      "O pixel da landing difere do aprovado para este destino no Master Plan.",
      "LANDING_APPROVED_PIXEL_MISMATCH",
    );
  if (
    ads.objective === "OUTCOME_LEADS" &&
    ads.tracking?.conversionEvent !== (tracking.metaLeadEventName ?? "Lead")
  )
    throw new AppError(
      422,
      "Use na captura o mesmo evento de conversão aprovado no Master Plan.",
      "LANDING_APPROVED_EVENT_MISMATCH",
    );
}

export function assertLandingEventScope(
  page: {
    status: string;
    publishedUrl: string | null;
    leadCaptureSequenceId: string | null;
  },
  tracking: { metaEventKey?: string; metaDatasetId?: string },
  input: LandingTrackingInput,
  origin?: string,
  sequenceId?: string,
): void {
  const expected = Buffer.from(tracking.metaEventKey ?? "", "utf8"),
    actual = Buffer.from(input.eventKey, "utf8");
  if (
    page.status !== "published" ||
    !tracking.metaDatasetId ||
    !expected.length ||
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  )
    throw new AppError(
      403,
      "Rastreamento indisponível para esta página.",
      "LANDING_TRACKING_SCOPE_REJECTED",
    );
  let matches = false;
  try {
    matches =
      !!origin &&
      new URL(origin).origin === new URL(page.publishedUrl ?? "").origin;
  } catch {
    /* reject malformed origin */
  }
  if (
    !matches ||
    (sequenceId != null && sequenceId !== page.leadCaptureSequenceId)
  )
    throw new AppError(
      403,
      "Origem ou sequência não corresponde à página publicada.",
      "LANDING_TRACKING_SCOPE_REJECTED",
    );
}

async function contextFor(
  input: LandingTrackingInput,
  request: RequestContext,
  sequenceId?: string,
) {
  const [page] = await db
    .select()
    .from(pagesTable)
    .where(
      and(eq(pagesTable.id, input.pageId), eq(pagesTable.status, "published")),
    )
    .limit(1);
  if (!page)
    throw new AppError(
      404,
      "Página publicada não encontrada.",
      "LANDING_NOT_PUBLISHED",
    );
  const metadata = page.metadata as {
    implementation?: {
      tracking?: {
        metaDatasetId?: string;
        metaEventKey?: string;
        metaLeadEventName?: "Lead" | "CompleteRegistration";
      };
    };
  } | null;
  const tracking = metadata?.implementation?.tracking ?? {};
  assertLandingEventScope(page, tracking, input, request.origin, sequenceId);
  const [dataset] = await db
    .select()
    .from(paidMediaDatasetsTable)
    .where(
      and(
        eq(paidMediaDatasetsTable.id, tracking.metaDatasetId!),
        eq(paidMediaDatasetsTable.workspaceId, page.workspaceId),
        eq(paidMediaDatasetsTable.provider, "meta_ads"),
      ),
    )
    .limit(1);
  if (!dataset)
    throw new AppError(
      409,
      "Dataset da página indisponível.",
      "LANDING_DATASET_UNAVAILABLE",
    );
  return { page, dataset, eventName: tracking.metaLeadEventName ?? "Lead" };
}

export async function trackLandingPageView(
  input: LandingTrackingInput & { eventId: string },
  request: RequestContext,
) {
  if (!input.marketingConsent) return { deliveryStatus: "consent_withheld" };
  const { page, dataset } = await contextFor(input, request);
  return recordDatasetEvent(dataset, {
    source: "server",
    eventId: `pageview:${input.pageId}:${input.eventId}`,
    eventName: "PageView",
    occurredAt: new Date().toISOString(),
    matchKeys: {
      fbp: input.fbp,
      fbc: input.fbc,
      clientIpAddress: request.ip,
      clientUserAgent: request.userAgent,
    },
    payload: { marketingConsent: true, eventSourceUrl: page.publishedUrl },
  });
}

export function landingLeadEventId(pageId: string, contactId: string): string {
  return `lead:${createHash("sha256").update(`${pageId}:${contactId}`).digest("hex")}`;
}

export async function trackCapturedLandingLead(
  input: LandingTrackingInput | undefined,
  request: RequestContext,
  captured: {
    contactId: string;
    duplicate: boolean;
    sequenceId: string;
    email?: string;
    phone?: string;
  },
) {
  if (!input || !input.marketingConsent)
    return { deliveryStatus: "consent_withheld" };
  const eventId = landingLeadEventId(input.pageId, captured.contactId);
  let knownEventName: "Lead" | "CompleteRegistration" | undefined;
  try {
    const { page, dataset, eventName } = await contextFor(
      input,
      request,
      captured.sequenceId,
    );
    knownEventName = eventName;
    if (captured.duplicate)
      return { eventId, eventName, deliveryStatus: "duplicate_not_sent" };
    const receipt = await recordDatasetEvent(dataset, {
      source: "server",
      eventName,
      eventId,
      occurredAt: new Date().toISOString(),
      matchKeys: {
        email: captured.email,
        phone: captured.phone,
        fbp: input.fbp,
        fbc: input.fbc,
        clientIpAddress: request.ip,
        clientUserAgent: request.userAgent,
      },
      payload: { marketingConsent: true, eventSourceUrl: page.publishedUrl },
    });
    return { eventId, eventName, deliveryStatus: receipt.deliveryStatus };
  } catch {
    // A measurement failure must never undo a successful contact capture or
    // expose provider errors/identifiers in the public lead response.
    return {
      eventId,
      eventName: knownEventName,
      deliveryStatus: "tracking_unavailable",
    };
  }
}
