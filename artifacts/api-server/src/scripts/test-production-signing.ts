import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const strong = "test-only-private-signing-secret-".repeat(3);
for (const [session, jwt, expected] of [[strong, strong, 0], ["short", strong, 1], [strong, "short", 1], [undefined, strong, 1], [strong, ` ${strong}`, 1]] as const) {
  const config: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production", SESSION_SECRET: session, JWT_SECRET: jwt,
    INTEGRATION_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"), INTEGRATION_TOKEN_PREVIOUS_KEYS: "",
    META_E2E_TEST_MODE: "false", META_APP_SECRET: strong, WHATSAPP_WEBHOOK_VERIFY_TOKEN: strong,
    ALLOWED_ORIGINS: "https://example.invalid", DATABASE_URL: "postgresql://127.0.0.1:1/unused" };
  if (session === undefined) delete config.SESSION_SECRET;
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", "await import('./src/lib/env.ts')"], { encoding: "utf8", env: config });
  assert.equal(result.status === 0 ? 0 : 1, expected, "Production signing-secret validation failed");
}
console.log("PASS: production startup rejects missing/short/whitespace signing secrets and accepts properly configured private secrets (offline)");
