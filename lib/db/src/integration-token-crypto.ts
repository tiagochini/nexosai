import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "nexosenc:v1:";
const AAD = Buffer.from("nexos:workspace-integrations:tokens:v1");

function decodeKey(value: string): Buffer {
  const key = Buffer.from(value, "base64");
  if (key.length !== 32 || key.toString("base64") !== value) {
    throw new Error("Integration encryption keys must be canonical base64 encoding of 32 random bytes");
  }
  return key;
}

function keyId(key: Buffer): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

function activeKey(): Buffer {
  const value = process.env["INTEGRATION_TOKEN_ENCRYPTION_KEY"];
  if (!value) throw new Error("INTEGRATION_TOKEN_ENCRYPTION_KEY is required to protect integration tokens");
  return decodeKey(value);
}

export function validateIntegrationEncryptionConfig(): void {
  activeKey();
  for (const value of previousKeys()) decodeKey(value);
}

function previousKeys(): string[] {
  const value = process.env["INTEGRATION_TOKEN_PREVIOUS_KEYS"];
  if (!value) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    // JSON parse errors can include the configured key text.
    throw new Error("INTEGRATION_TOKEN_PREVIOUS_KEYS must be a JSON array of base64 keys");
  }
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
    throw new Error("INTEGRATION_TOKEN_PREVIOUS_KEYS must be a JSON array of base64 keys");
  }
  return parsed;
}

export function isEncryptedIntegrationToken(value: string): boolean {
  return value.startsWith("nexosenc:");
}

export function encryptIntegrationToken(value: string): string {
  const key = activeKey();
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${PREFIX}${keyId(key)}:${nonce.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptIntegrationToken(value: string): string {
  if (!value.startsWith(PREFIX)) {
    throw new Error("Unencrypted or unsupported integration token: run the integration token migration before starting the API");
  }
  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 4) throw new Error("Invalid encrypted integration token");
  const [id, encodedNonce, encodedTag, encodedCiphertext] = parts as [string, string, string, string];
  if (!/^[a-f0-9]{16}$/.test(id)) throw new Error("Invalid encrypted integration token");
  for (const part of [encodedNonce, encodedTag, encodedCiphertext]) {
    if (Buffer.from(part, "base64").toString("base64") !== part) {
      throw new Error("Invalid encrypted integration token");
    }
  }
  const keys = [activeKey(), ...previousKeys().map(decodeKey)];
  const key = keys.find((candidate) => keyId(candidate) === id);
  if (!key) throw new Error("Integration token encryption key is unavailable");
  const nonce = Buffer.from(encodedNonce, "base64");
  const tag = Buffer.from(encodedTag, "base64");
  if (nonce.length !== 12 || tag.length !== 16) throw new Error("Invalid encrypted integration token");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAAD(AAD);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(encodedCiphertext, "base64")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Integration token integrity verification failed");
  }
}
