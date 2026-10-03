import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { workspaceIntegrationsTable, insertWorkspaceIntegrationSchema } from "../src/schema/workspace-integrations";
import { decryptIntegrationToken, encryptIntegrationToken, validateIntegrationEncryptionConfig } from "../src/integration-token-crypto";

const key = randomBytes(32).toString("base64");
process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = key;
delete process.env.INTEGRATION_TOKEN_PREVIOUS_KEYS;
const token = "fixture-provider-token-not-a-real-credential";
const first = encryptIntegrationToken(token);
const second = encryptIntegrationToken(token);
assert.notEqual(first, second, "each write must have a fresh nonce");
assert.equal(first.includes(token), false);
assert.equal(decryptIntegrationToken(first), token);
assert.equal(decryptIntegrationToken(encryptIntegrationToken("")), "");
assert.throws(() => decryptIntegrationToken(token), /Unencrypted/);
assert.throws(() => decryptIntegrationToken("nexosenc:v2:invalid"), /unsupported/);
const parts = first.split(":");
const tampered = Buffer.from(parts[5]!, "base64");
tampered[0] = tampered[0]! ^ 1;
parts[5] = tampered.toString("base64");
assert.throws(() => decryptIntegrationToken(parts.join(":")), /integrity/);
process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
assert.throws(() => decryptIntegrationToken(first), /unavailable/);
process.env.INTEGRATION_TOKEN_PREVIOUS_KEYS = JSON.stringify([key]);
assert.equal(decryptIntegrationToken(first), token, "previous keys support rotation");
assert.equal(decryptIntegrationToken(encryptIntegrationToken(token)), token);
process.env.INTEGRATION_TOKEN_PREVIOUS_KEYS = "not-json-sensitive-value";
assert.throws(validateIntegrationEncryptionConfig, (error: unknown) => {
  assert.ok(error instanceof Error);
  assert.equal(error.message.includes("not-json-sensitive-value"), false);
  return true;
});
delete process.env.INTEGRATION_TOKEN_PREVIOUS_KEYS;
assert.throws(() => decryptIntegrationToken(`${first}!`), /Invalid/);
process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = "invalid";
assert.throws(validateIntegrationEncryptionConfig, /32 random bytes/);
delete process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
assert.throws(() => encryptIntegrationToken(token), /required/);
process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = key;

// Inspect the actual ORM mapping, including nullable fields and insert validation.
assert.equal(insertWorkspaceIntegrationSchema.shape.accessToken.safeParse(token).success, true);
assert.equal(insertWorkspaceIntegrationSchema.shape.accessToken.safeParse(123).success, false);
const query = drizzle.mock().insert(workspaceIntegrationsTable).values({
  workspaceId: "00000000-0000-0000-0000-000000000001",
  provider: "instagram",
  accessToken: token,
  refreshToken: null,
}).toSQL();
assert.equal(query.params.includes(token), false, "plaintext must never reach SQL parameters");
const persisted = query.params.find((value) => typeof value === "string" && value.startsWith("nexosenc:"));
assert.equal(typeof persisted, "string");
assert.equal(workspaceIntegrationsTable.accessToken.mapFromDriverValue(persisted as string), token);
assert.equal(query.params.includes(null), true, "null credentials remain null");
console.log("Integration token encryption, tamper rejection, key rotation, and ORM mapping passed");

if (process.argv.includes("--database")) {
  let databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    for (const name of [".env", ".env.local"]) {
      const file = new URL(`../../../${name}`, import.meta.url);
      if (existsSync(file)) databaseUrl = parseEnv(readFileSync(file, "utf8")).DATABASE_URL ?? databaseUrl;
    }
  }
  assert.ok(databaseUrl, "DATABASE_URL is required for the database test");
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // A temporary shadow table exercises the real schema and PostgreSQL driver
    // without creating a workspace or touching application integration rows.
    await client.query("CREATE TEMP TABLE workspace_integrations (LIKE public.workspace_integrations INCLUDING DEFAULTS) ON COMMIT DROP");
    const testDb = drizzle(client);
    const [saved] = await testDb.insert(workspaceIntegrationsTable).values({
      workspaceId: "00000000-0000-0000-0000-000000000001",
      provider: "instagram",
      accessToken: token,
      refreshToken: "fixture-refresh-token",
    }).returning();
    assert.equal(saved!.accessToken, token, "RETURNING decodes the encrypted value");
    const raw = await client.query("SELECT access_token, refresh_token FROM pg_temp.workspace_integrations");
    assert.notEqual(raw.rows[0].access_token, token);
    assert.equal(decryptIntegrationToken(raw.rows[0].access_token), token);
    assert.equal(decryptIntegrationToken(raw.rows[0].refresh_token), "fixture-refresh-token");
    await testDb.update(workspaceIntegrationsTable).set({ accessToken: "fixture-refreshed-token", refreshToken: null });
    const [updated] = await testDb.select({ accessToken: workspaceIntegrationsTable.accessToken, refreshToken: workspaceIntegrationsTable.refreshToken }).from(workspaceIntegrationsTable);
    assert.equal(updated!.accessToken, "fixture-refreshed-token");
    assert.equal(updated!.refreshToken, null);
    console.log("PostgreSQL insert, raw ciphertext, RETURNING, SELECT, UPDATE, and null token checks passed");
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
}
