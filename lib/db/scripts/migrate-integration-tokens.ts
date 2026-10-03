import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import pg from "pg";
import {
  decryptIntegrationToken,
  encryptIntegrationToken,
  isEncryptedIntegrationToken,
  validateIntegrationEncryptionConfig,
} from "../src/integration-token-crypto";

const inheritedKeys = new Set(Object.keys(process.env));
for (const name of [".env", ".env.local"]) {
  const file = new URL(`../../../${name}`, import.meta.url);
  if (existsSync(file)) {
    for (const [key, value] of Object.entries(parseEnv(readFileSync(file, "utf8")))) {
      if (!inheritedKeys.has(key)) process.env[key] = value;
    }
  }
}
const execute = process.argv.includes("--execute");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
validateIntegrationEncryptionConfig();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
let changedRows = 0;
let checkedTokens = 0;
try {
  await client.query("BEGIN");
  await client.query("SET LOCAL lock_timeout = '10s'");
  // Keep concurrent credential writes from racing with the migration.
  await client.query("LOCK TABLE workspace_integrations IN SHARE ROW EXCLUSIVE MODE");
  const result = await client.query<{ id: string; access_token: string | null; refresh_token: string | null }>(
    "SELECT id, access_token, refresh_token FROM workspace_integrations WHERE access_token IS NOT NULL OR refresh_token IS NOT NULL FOR UPDATE",
  );
  for (const row of result.rows) {
    const protect = (value: string | null): string | null => {
      if (value === null) return null;
      checkedTokens++;
      const plain = isEncryptedIntegrationToken(value) ? decryptIntegrationToken(value) : value;
      const encrypted = encryptIntegrationToken(plain);
      // Also checks that key configuration can decrypt the new envelope.
      if (decryptIntegrationToken(encrypted) !== plain) throw new Error("Token migration verification failed");
      return encrypted;
    };
    const accessToken = protect(row.access_token);
    const refreshToken = protect(row.refresh_token);
    if (execute) {
      await client.query("UPDATE workspace_integrations SET access_token = $1, refresh_token = $2 WHERE id = $3", [accessToken, refreshToken, row.id]);
    }
    changedRows++;
  }
  await client.query(execute ? "COMMIT" : "ROLLBACK");
  console.log(JSON.stringify({ mode: execute ? "execute" : "dry-run", checkedTokens, rows: changedRows }));
} catch {
  await client.query("ROLLBACK");
  // Database errors can contain bound parameters; never print raw errors here.
  throw new Error("Integration token migration failed; transaction rolled back. Verify database access and encryption key configuration.");
} finally {
  client.release();
  await pool.end();
}
