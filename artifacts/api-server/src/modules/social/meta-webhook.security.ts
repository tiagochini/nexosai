import crypto from "crypto";
import type { Request, Response } from "express";
import { env } from "../../lib/env.js";

/**
 * Meta signs the exact HTTP entity body, not its JSON representation. Webhook
 * routes therefore use express.raw() and call this before JSON.parse().
 */
export function verifyMetaWebhookRequest(req: Request, res: Response): Buffer | null {
  const body = req.body;
  const testSeam =
    env.NODE_ENV === "test" &&
    process.env["META_WEBHOOK_ALLOW_UNSIGNED_TESTS"] === "true";
  const appSecret = env.META_APP_SECRET || process.env["FACEBOOK_APP_SECRET"] || "";
  const signature = req.header("x-hub-signature-256");

  if ((!appSecret || !signature) && !testSeam) {
    res.status(401).json({ error: "Meta webhook signature is required" });
    return null;
  }
  if (testSeam && (!appSecret || !signature)) {
    if (Buffer.isBuffer(body)) return body;
    res.status(400).json({ error: "Meta webhook body must be raw bytes" });
    return null;
  }
  if (!Buffer.isBuffer(body) || !/^sha256=[a-f0-9]{64}$/i.test(signature!)) {
    res.status(401).json({ error: "Invalid Meta webhook signature" });
    return null;
  }

  const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(body).digest("hex")}`;
  const supplied = Buffer.from(signature!);
  const expectedBuffer = Buffer.from(expected);
  if (
    supplied.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(supplied, expectedBuffer)
  ) {
    res.status(401).json({ error: "Invalid Meta webhook signature" });
    return null;
  }
  return body;
}

export function parseVerifiedMetaWebhook(req: Request, res: Response): unknown | null {
  const rawBody = verifyMetaWebhookRequest(req, res);
  if (!rawBody) return null;
  try {
    return JSON.parse(rawBody.toString("utf8")) as unknown;
  } catch {
    res.status(400).json({ error: "Invalid Meta webhook JSON" });
    return null;
  }
}

export function verifyMetaWebhookSubscription(req: Request, res: Response): void {
  // Secret forms and password managers can accidentally preserve surrounding
  // whitespace. Meta sends the semantic token value, so normalize only that
  // whitespace while keeping the token itself exact and case-sensitive.
  const verifyToken = (process.env["META_WEBHOOK_VERIFY_TOKEN"] ?? "").trim();
  const mode = String(req.query["hub.mode"] ?? "").trim();
  const token = String(req.query["hub.verify_token"] ?? "").trim();
  const challenge = String(req.query["hub.challenge"] ?? "").trim();

  const supplied = Buffer.from(token);
  const expected = Buffer.from(verifyToken);
  const tokenMatches =
    supplied.length === expected.length &&
    expected.length > 0 &&
    crypto.timingSafeEqual(supplied, expected);

  if (mode === "subscribe" && tokenMatches) {
    res.status(200).send(challenge);
    return;
  }
  res.status(403).json({ error: "Verification failed" });
}