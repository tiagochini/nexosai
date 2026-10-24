/**
 * Server-side event tracking endpoint — public, no auth required.
 * Receives browser events and mirrors them server-side to ad platforms.
 *
 * POST /api/events/:workspaceId/track
 * POST /api/events/sequence/:sequenceId/track  (resolves workspaceId from sequence)
 */
import { Router } from "express";
import { z } from "zod/v4";
import { db, launchSequencesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { fireServerEvent } from "./server-events.service.js";
import { logger } from "../../lib/logger.js";

const trackSchema = z.object({
  eventName: z.enum([
    "PageView",
    "Lead",
    "Purchase",
    "InitiateCheckout",
    "Subscribe",
    "Registration",
    "ViewContent",
  ]),
  eventId: z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9._:-]+$/),
  marketingConsent: z.boolean(),
  userData: z.object({
    email: z.email().optional(),
    phone: z.string().max(30).optional(),
    ip: z.string().optional(),
    userAgent: z.string().max(400).optional(),
    fbp: z.string().optional(),
    fbc: z.string().optional(),
    ttclid: z.string().optional(),
  }).optional().default({}),
  customData: z.object({
    currency: z.string().max(3).optional(),
    value: z.number().optional(),
    contentName: z.string().max(200).optional(),
    orderId: z.string().max(100).optional(),
    eventSourceUrl: z.string().max(500).optional(),
  }).optional().default({}),
}).superRefine((value, context) => {
  if (!value.marketingConsent && (
    Object.values(value.userData).some((item) => item !== undefined)
    || Object.values(value.customData).some((item) => item !== undefined)
  )) {
    context.addIssue({ code: "custom", message: "Não envie dados do usuário ou do evento sem consentimento de marketing." });
  }
});

function extractClientIp(req: import("express").Request): string | null {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return (Array.isArray(fwd) ? fwd[0] : fwd.split(",")[0])?.trim() ?? null;
  return req.ip ?? null;
}

export function createServerEventsRouter(dispatch = fireServerEvent) {
const router = Router();

// POST /api/events/:workspaceId/track — direct workspace ID
router.post("/:workspaceId/track", async (req, res): Promise<void> => {
  const { workspaceId } = req.params as { workspaceId: string };

  const parsed = trackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
    return;
  }

  if (!parsed.data.marketingConsent) {
    res.status(202).json({ tracked: false, eventName: parsed.data.eventName, reason: "consent_withheld" });
    return;
  }

  const { eventName, eventId, userData, customData } = parsed.data;
  const ip = extractClientIp(req) ?? userData.ip;
  const userAgent = (req.headers["user-agent"] ?? userData.userAgent)?.slice(0, 400);

  // Fire-and-forget — never block the response
  setImmediate(() => {
    dispatch(workspaceId, eventName, eventId, { ...userData, ip: ip ?? undefined, userAgent }, customData)
      .catch((err) => logger.warn({ err, eventName }, "fireServerEvent failed — non-blocking"));
  });

  res.json({ tracked: true, eventName });
});

// POST /api/events/sequence/:sequenceId/track — resolve via sequence
router.post("/sequence/:sequenceId/track", async (req, res): Promise<void> => {
  const { sequenceId } = req.params as { sequenceId: string };

  const parsed = trackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
    return;
  }

  if (!parsed.data.marketingConsent) {
    res.status(202).json({ tracked: false, eventName: parsed.data.eventName, reason: "consent_withheld" });
    return;
  }

  const [sequence] = await db
    .select({ workspaceId: launchSequencesTable.workspaceId })
    .from(launchSequencesTable)
    .where(eq(launchSequencesTable.id, sequenceId))
    .limit(1);

  if (!sequence) {
    res.status(404).json({ error: "Sequence not found" });
    return;
  }

  const { eventName, eventId, userData, customData } = parsed.data;
  const ip = extractClientIp(req) ?? userData.ip;
  const userAgent = (req.headers["user-agent"] ?? userData.userAgent)?.slice(0, 400);

  setImmediate(() => {
    dispatch(sequence.workspaceId, eventName, eventId, { ...userData, ip: ip ?? undefined, userAgent }, customData)
      .catch((err) => logger.warn({ err, eventName, sequenceId }, "fireServerEvent failed — non-blocking"));
  });

  res.json({ tracked: true, eventName });
});

return router;
}

const router = createServerEventsRouter();
export default router;
