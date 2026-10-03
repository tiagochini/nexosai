import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { sqlChecksum } from "./sql-checksum.mjs";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const execute =
  process.argv.includes("--execute") ||
  process.env.BOOTSTRAP_EMPTY_DATABASE === "true";
const bootstrapPath = fileURLToPath(
  new URL("../bootstrap/0000_current_schema.sql", import.meta.url),
);
const migrationDir = fileURLToPath(new URL("../drizzle/", import.meta.url));
const bootstrapSql = await readFile(bootstrapPath, "utf8");
const bootstrapChecksum = sqlChecksum(bootstrapSql);
const migrationFiles = (await readdir(migrationDir))
  .filter((file) => /^\d{4}_.+\.sql$/.test(file))
  .sort();
const migrations = await Promise.all(
  migrationFiles.map(async (file) => {
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

async function publicSchemaObjects() {
  const result = await client.query(`
    select 'relation' as kind, c.relname as name
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'p', 'v', 'm', 'S')
    union all
    select 'enum' as kind, t.typname as name
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public'
       and t.typtype = 'e'
    order by kind, name
  `);
  return result.rows;
}

try {
  await client.query("select pg_advisory_lock(hashtext('nexos-schema-bootstrap'))");
  const existingObjects = await publicSchemaObjects();
  if (existingObjects.length > 0) {
    const sample = existingObjects
      .slice(0, 10)
      .map((item) => `${item.kind}:${item.name}`)
      .join(", ");
    throw new Error(
      `Refusing empty-database bootstrap: public schema contains ${existingObjects.length} object(s)` +
      (sample ? ` (${sample})` : ""),
    );
  }

  if (!execute) {
    console.log(
      `Bootstrap check passed: public schema is empty; ${migrationFiles.length} incremental migrations will be baselined.`,
    );
    console.log(
      "Rerun with --execute (or BOOTSTRAP_EMPTY_DATABASE=true) to create the current schema.",
    );
  } else {
    await client.query("begin");
    try {
      await client.query(bootstrapSql);
      await client.query(`
        create table nexos_schema_migrations (
          filename text primary key,
          checksum text not null,
          applied_at timestamptz not null default now(),
          baseline boolean not null default false
        )
      `);
      await client.query(
        "insert into nexos_schema_migrations (filename, checksum, baseline) values ($1, $2, true)",
        ["__bootstrap_0000_current_schema.sql", bootstrapChecksum],
      );
      for (const migration of migrations) {
        // The immutable snapshot includes migrations through 0062. Apply later
        // migrations before recording them; never baseline unapplied new DDL.
        const inSnapshot = Number(migration.file.slice(0, 4)) <= 62;
        if (!inSnapshot) await client.query(migration.sql);
        await client.query(
          "insert into nexos_schema_migrations (filename, checksum, baseline) values ($1, $2, $3)",
          [migration.file, migration.checksum, inSnapshot],
        );
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }

    const createdObjects = await publicSchemaObjects();
    const tableCount = createdObjects.filter(
      (item) => item.kind === "relation",
    ).length;
    console.log(
      `Database bootstrap completed: ${tableCount} relations created and ${migrationFiles.length} migrations baselined.`,
    );
    console.log(`Bootstrap checksum: ${bootstrapChecksum}`);
  }
} finally {
  await client
    .query("select pg_advisory_unlock(hashtext('nexos-schema-bootstrap'))")
    .catch(() => undefined);
  client.release();
  await pool.end();
}
