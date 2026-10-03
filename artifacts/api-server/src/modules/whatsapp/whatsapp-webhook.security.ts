import crypto from "node:crypto";

export function constantTimeTokenMatches(
  suppliedValue: string,
  expectedValue: string,
): boolean {
  const supplied = Buffer.from(suppliedValue.trim());
  const expected = Buffer.from(expectedValue.trim());
  return (
    expected.length > 0 &&
    supplied.length === expected.length &&
    crypto.timingSafeEqual(supplied, expected)
  );
}

export function verifyWhatsAppWebhookSignature(
  body: Buffer,
  signature: string | undefined,
  appSecret: string,
): boolean {
  if (!appSecret.trim() || !signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }
  const expected = Buffer.from(
    `sha256=${crypto.createHmac("sha256", appSecret).update(body).digest("hex")}`,
  );
  const supplied = Buffer.from(signature);
  return (
    supplied.length === expected.length &&
    crypto.timingSafeEqual(supplied, expected)
  );
}
