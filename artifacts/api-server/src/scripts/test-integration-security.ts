import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  containsLikelyIntegrationCredential,
  redactIntegrationCredentials,
} from "../modules/integrations/integration-credential-safety.js";
import {
  constantTimeTokenMatches,
  verifyWhatsAppWebhookSignature,
} from "../modules/whatsapp/whatsapp-webhook.security.js";

assert.equal(
  containsLikelyIntegrationCredential("accessToken: EAA12345678901234567890"),
  true,
);
assert.equal(
  containsLikelyIntegrationCredential("Authorization: Bearer abcdefghijklmnopqrstuvwxyz"),
  true,
);
assert.equal(
  containsLikelyIntegrationCredential("accountId: 17841400000000000"),
  false,
);
assert.equal(
  containsLikelyIntegrationCredential("Onde encontro meu access token?"),
  false,
);

const secret = "sk_live_1234567890abcdef";
const redacted = redactIntegrationCredentials(`Secret key: ${secret}`);
assert.equal(redacted.includes(secret), false);
assert.match(redacted, /\[REMOVIDO\]/);

assert.equal(constantTimeTokenMatches(" verify-token ", "verify-token"), true);
assert.equal(constantTimeTokenMatches("wrong", "verify-token"), false);

const body = Buffer.from('{"object":"whatsapp_business_account"}');
const appSecret = "test-app-secret";
const signature = `sha256=${crypto.createHmac("sha256", appSecret).update(body).digest("hex")}`;
const invalidLastCharacter = signature.endsWith("0") ? "1" : "0";
assert.equal(verifyWhatsAppWebhookSignature(body, signature, appSecret), true);
assert.equal(
  verifyWhatsAppWebhookSignature(
    body,
    `${signature.slice(0, -1)}${invalidLastCharacter}`,
    appSecret,
  ),
  false,
);
assert.equal(verifyWhatsAppWebhookSignature(body, undefined, appSecret), false);

console.log("integration credential and WhatsApp webhook security tests passed");
