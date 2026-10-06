import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { databaseConnectionOptions } from '../src/connection-options.mjs';
import { acceptedSqlChecksums } from "./sql-checksum.mjs";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const requiredTables = ["users", "workspaces", "campaigns", "plans"];
const expectedPlans = new Map([
  ["solo", { price: "3990.00", credits: 900 }],
  ["agency", { price: "9990.00", credits: 2000 }],
]);
const migrationDir = fileURLToPath(new URL("../drizzle/", import.meta.url));
const bootstrapPath = fileURLToPath(
  new URL("../bootstrap/0000_current_schema.sql", import.meta.url),
);

async function expectedMigrationChecksums() {
  const files = (await readdir(migrationDir))
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .sort();
  const entries = await Promise.all(
    files.map(async (file) => [
      file,
      acceptedSqlChecksums(
        await readFile(path.join(migrationDir, file), "utf8"),
      ),
    ]),
  );
  entries.unshift([
    "__bootstrap_0000_current_schema.sql",
    acceptedSqlChecksums(await readFile(bootstrapPath, "utf8")),
  ]);
  return new Map(entries);
}

const pool = new Pool(databaseConnectionOptions());
const client = await pool.connect();
const failures = [];

try {
  const expectedMigrations = await expectedMigrationChecksums();
  // Drizzle snapshots omit procedural protections. History alone cannot prove
  // that the immutable binding and append-only contracts are enforced.
  const integritySql = (await Promise.all(['0068_restore_bootstrap_integrity.sql', '0069_project_memory_isolation.sql'].map(file => readFile(path.join(migrationDir, file), 'utf8')))).join('\n');
  const expectedTriggers = [...integritySql.matchAll(/CREATE TRIGGER\s+"?([\w]+)"?[\s\S]*?\bON\s+"?([\w]+)"?/gi)];
  const triggerResult = await client.query(`
    select t.tgname, c.relname, t.tgenabled
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not t.tgisinternal
  `);
  for (const [, name, table] of expectedTriggers) {
    if (!triggerResult.rows.some(row => row.tgname === name && row.relname === table && ['O', 'A'].includes(row.tgenabled))) {
      failures.push(`integrity trigger is missing or disabled: ${table}.${name}`);
    }
  }
  const expectedForeignKeys = [...integritySql.matchAll(/ALTER TABLE "([\w]+)" ADD CONSTRAINT "([\w]+)" FOREIGN KEY/g)];
  const foreignKeyResult = await client.query(`
    select c.conname, r.relname, c.convalidated
    from pg_constraint c join pg_class r on r.oid = c.conrelid
    join pg_namespace n on n.oid = r.relnamespace
    where n.nspname = 'public' and c.contype = 'f'
  `);
  for (const [, table, name] of expectedForeignKeys) {
    if (!foreignKeyResult.rows.some(row => row.conname === name && row.relname === table && row.convalidated)) {
      failures.push(`scoped foreign key is missing or unvalidated: ${table}.${name}`);
    }
  }
  const tableResult = await client.query(`
    select tablename
      from pg_tables
     where schemaname = 'public'
  `);
  const tables = new Set(tableResult.rows.map((row) => row.tablename));
  for (const table of requiredTables) {
    if (!tables.has(table)) failures.push(`required table is missing: ${table}`);
  }

  if (!tables.has("nexos_schema_migrations")) {
    failures.push("migration history table is missing: nexos_schema_migrations");
  } else {
    const migrationResult = await client.query(`
      select filename, checksum
        from nexos_schema_migrations
       order by filename
    `);
    const recorded = new Map(
      migrationResult.rows.map((row) => [row.filename, row.checksum]),
    );
    for (const [filename, acceptedChecksums] of expectedMigrations) {
      const actualChecksum = recorded.get(filename);
      if (!actualChecksum) {
        failures.push(`migration is not recorded: ${filename}`);
      } else if (!acceptedChecksums.has(actualChecksum)) {
        failures.push(`migration checksum differs: ${filename}`);
      }
    }
    for (const filename of recorded.keys()) {
      if (!expectedMigrations.has(filename)) {
        failures.push(`unknown migration is recorded: ${filename}`);
      }
    }
  }

  const invalidConstraintResult = await client.query(`
    select count(*)::int as count
      from pg_constraint c
      join pg_namespace n on n.oid = c.connamespace
     where n.nspname = 'public'
       and not c.convalidated
  `);
  const invalidConstraints = invalidConstraintResult.rows[0].count;
  if (invalidConstraints > 0) {
    failures.push(`${invalidConstraints} constraint(s) are not validated`);
  }

  let plans = [];
  if (tables.has("plans")) {
    const planResult = await client.query(`
      select slug, price_monthly::text as price, credits_monthly as credits
        from plans
       where slug in ('solo', 'agency')
       order by slug
    `);
    plans = planResult.rows;
    for (const [slug, expected] of expectedPlans) {
      const actual = plans.find((plan) => plan.slug === slug);
      if (!actual) {
        failures.push(`required plan is missing: ${slug}`);
      } else if (
        Number(actual.price) !== Number(expected.price) ||
        actual.credits !== expected.credits
      ) {
        failures.push(`required plan has unexpected values: ${slug}`);
      }
    }
  }

  const counts = {};
  for (const table of ["users", "workspaces", "campaigns"]) {
    if (!tables.has(table)) continue;
    const result = await client.query(`select count(*)::int as count from ${table}`);
    counts[table] = result.rows[0].count;
  }

  if (failures.length > 0) {
    throw new Error(`Database verification failed:\n- ${failures.join("\n- ")}`);
  }

  console.log("Database verification passed.");
  console.log(`Public tables: ${tables.size}`);
  console.log(`Tracked schema entries: ${expectedMigrations.size}`);
  console.log(`Required plans: ${plans.map((plan) => plan.slug).join(", ")}`);
  console.log(
    `Business data counts: users=${counts.users ?? "n/a"}, workspaces=${counts.workspaces ?? "n/a"}, campaigns=${counts.campaigns ?? "n/a"}`,
  );
} finally {
  client.release();
  await pool.end();
}
