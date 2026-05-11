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

const router = Router();

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
  eventId: z.string().optional(),
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
});

function extractClientIp(req: import("express").Request): string | null {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return (Array.isArray(fwd) ? fwd[0] : fwd.split(",")[0])?.trim() ?? null;
  return req.ip ?? null;
}

// POST /api/events/:workspaceId/track — direct workspace ID
router.post("/:workspaceId/track", async (req, res): Promise<void> => {
  const { workspaceId } = req.params as { workspaceId: string };

  const parsed = trackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
    return;
  }

  const { eventName, userData, customData } = parsed.data;
  const ip = extractClientIp(req) ?? userData.ip;
  const userAgent = (req.headers["user-agent"] ?? userData.userAgent)?.slice(0, 400);

  // Fire-and-forget — never block the response
  setImmediate(() => {
    fireServerEvent(workspaceId, eventName, { ...userData, ip: ip ?? undefined, userAgent }, customData)
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

  const [sequence] = await db
    .select({ workspaceId: launchSequencesTable.workspaceId })
    .from(launchSequencesTable)
    .where(eq(launchSequencesTable.id, sequenceId))
    .limit(1);

  if (!sequence) {
    res.status(404).json({ error: "Sequence not found" });
    return;
  }

  const { eventName, userData, customData } = parsed.data;
  const ip = extractClientIp(req) ?? userData.ip;
  const userAgent = (req.headers["user-agent"] ?? userData.userAgent)?.slice(0, 400);

  setImmediate(() => {
    fireServerEvent(sequence.workspaceId, eventName, { ...userData, ip: ip ?? undefined, userAgent }, customData)
      .catch((err) => logger.warn({ err, eventName, sequenceId }, "fireServerEvent failed — non-blocking"));
  });

  res.json({ tracked: true, eventName });
});

export default router;
