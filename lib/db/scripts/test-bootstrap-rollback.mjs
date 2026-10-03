import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const suffix = randomBytes(6).toString("hex");
const testDatabase = `nexos_bootstrap_rollback_${process.pid}_${suffix}`;
if (!/^[a-z0-9_]+$/.test(testDatabase)) throw new Error("Unsafe test database name");
const quotedDatabase = `"${testDatabase}"`;

const maintenanceUrl = new URL(databaseUrl);
maintenanceUrl.pathname = "/postgres";
const testUrl = new URL(databaseUrl);
testUrl.pathname = `/${testDatabase}`;
const bootstrapPath = fileURLToPath(
  new URL("../bootstrap/0000_current_schema.sql", import.meta.url),
);
const bootstrapSql = await readFile(bootstrapPath, "utf8");

const admin = new Client({ connectionString: maintenanceUrl.toString() });
let testClient;
let databaseCreated = false;

try {
  await admin.connect();
  await admin.query(`create database ${quotedDatabase}`);
  databaseCreated = true;

  testClient = new Client({ connectionString: testUrl.toString() });
  await testClient.connect();
  let schemaApplied = false;
  await testClient.query("begin");
  try {
    await testClient.query(bootstrapSql);
    const migrationDir = fileURLToPath(new URL("../drizzle/", import.meta.url));
    for (const file of (await readdir(migrationDir)).filter((name) => /^\d{4}_.+\.sql$/.test(name) && Number(name.slice(0, 4)) > 62).sort()) {
      await testClient.query(await readFile(new URL(`../drizzle/${file}`, import.meta.url), "utf8"));
    }
    schemaApplied = true;
    await testClient.query("select 1 / 0");
    assert.fail("forced rollback error did not occur");
  } catch {
    await testClient.query("rollback");
  }
  assert.equal(schemaApplied, true, "bootstrap SQL must succeed before the forced failure");

  const result = await testClient.query(`
    select
      (select count(*)::int
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind in ('r', 'p', 'v', 'm', 'S')) as relations,
      (select count(*)::int
         from pg_type t
         join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public'
          and t.typtype = 'e') as enums
  `);
  assert.deepEqual(result.rows[0], { relations: 0, enums: 0 });
  console.log("Bootstrap rollback test passed: no schema objects survived the forced failure.");
} finally {
  if (testClient) await testClient.end().catch(() => undefined);
  if (databaseCreated) {
    await admin.query(
      "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
      [testDatabase],
    ).catch(() => undefined);
    await admin.query(`drop database if exists ${quotedDatabase}`);
  }
  await admin.end().catch(() => undefined);
}
