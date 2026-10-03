import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { assertLegacyBaselineAllowed } from "./migration-policy.mjs";
import { acceptedSqlChecksums, sqlChecksum } from "./sql-checksum.mjs";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const allowExistingSchemaBaseline =
  process.env.MIGRATION_BASELINE_EXISTING_SCHEMA === "true";
const requiredBaselineTables = ["users", "workspaces", "campaigns", "plans"];

const migrationDir = fileURLToPath(new URL("../drizzle/", import.meta.url));
const files = (await readdir(migrationDir))
  .filter((file) => /^\d{4}_.+\.sql$/.test(file))
  .sort();

const migrations = await Promise.all(
  files.map(async (file) => {
    const sql = await readFile(path.join(migrationDir, file), "utf8");
    return {
      file,
      sql,
      checksum: sqlChecksum(sql),
    };
  }),
);

const pool = new Pool({ connectionString: databaseUrl });
const client = await pool.connect();

try {
  await client.query(
    "select pg_advisory_lock(hashtext('nexos-schema-migrations'))",
  );
  await client.query(`
    create table if not exists nexos_schema_migrations (
      filename text primary key,
      checksum text not null,
      applied_at timestamptz not null default now(),
      baseline boolean not null default false
    )
  `);

  const existing = await client.query(
    "select filename, checksum from nexos_schema_migrations order by filename",
  );

  if (existing.rowCount === 0) {
    // These SQL files are incremental migrations on top of the legacy schema;
    // 0000 is not a complete bootstrap migration. Never mark them as applied on
    // an empty database, because that reports success while leaving the database
    // unusable. Baseline is an explicit, one-time operation for a verified legacy
    // schema only.
    const schemaCheck = await client.query(
      `select relname
         from pg_class
        where relkind in ('r', 'p')
          and relnamespace = 'public'::regnamespace
          and relname = any($1::text[])`,
      [requiredBaselineTables],
    );
    assertLegacyBaselineAllowed({
      allowExistingSchemaBaseline,
      requiredTables: requiredBaselineTables,
      presentTables: schemaCheck.rows.map((row) => row.relname),
    });

    await client.query("begin");
    try {
      for (const migration of migrations) {
        const inSnapshot = Number(migration.file.slice(0, 4)) <= 62;
        if (!inSnapshot) await client.query(migration.sql);
        await client.query(
          "insert into nexos_schema_migrations (filename, checksum, baseline) values ($1, $2, $3)",
          [migration.file, migration.checksum, inSnapshot],
        );
      }
      await client.query("commit");
      console.log(
        `Database migration baseline recorded (${migrations.length} files)`,
      );
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  } else {
    const applied = new Map(
      existing.rows.map((row) => [row.filename, row.checksum]),
    );
    for (const migration of migrations) {
      const previousChecksum = applied.get(migration.file);
      if (
        previousChecksum &&
        !acceptedSqlChecksums(migration.sql).has(previousChecksum)
      ) {
        throw new Error(`Applied migration was modified: ${migration.file}`);
      }
      if (previousChecksum) continue;

      await client.query("begin");
      try {
        await client.query(migration.sql);
        await client.query(
          "insert into nexos_schema_migrations (filename, checksum) values ($1, $2)",
          [migration.file, migration.checksum],
        );
        await client.query("commit");
        console.log(`Applied database migration ${migration.file}`);
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
    console.log("Database migrations are up to date");
  }
} finally {
  await client
    .query("select pg_advisory_unlock(hashtext('nexos-schema-migrations'))")
    .catch(() => undefined);
  client.release();
  await pool.end();
}
