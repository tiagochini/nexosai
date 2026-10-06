import { createRequire } from 'node:module';
import { databaseConnectionOptions } from '../lib/db/src/connection-options.mjs';
import { homologationEnvironment } from './homologation-environment.mjs';
const require = createRequire(new URL('../lib/db/package.json', import.meta.url));
const { Client } = require('pg');
const { environment, adminUrl } = homologationEnvironment();
const runtime = new URL(environment.DATABASE_URL);
const admin = new URL(adminUrl);
if (admin.hostname !== runtime.hostname || admin.pathname !== runtime.pathname || admin.username !== 'postgres') {
  throw new Error('Migration connection must target the same homologation database as the runtime');
}
const client = new Client(databaseConnectionOptions({ ...environment, DATABASE_URL: adminUrl }));
async function prepare() {
  await client.query('BEGIN');
  await client.query("select pg_advisory_xact_lock(hashtext('nexos-homologation-security'))");
  const tables = (await client.query("select tablename, rowsecurity from pg_tables where schemaname='public' order by tablename")).rows;
  if (tables.length && !tables.some(t => t.tablename === 'nexos_schema_migrations')) {
    throw new Error('Refusing to alter privileges of an unrecognized existing public schema');
  }
  const existing = (await client.query("select rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolreplication from pg_roles where rolname='nexos_homologation'")).rows[0];
  if (existing && ['rolsuper','rolcreatedb','rolcreaterole','rolbypassrls','rolreplication'].some(k => existing[k])) {
    throw new Error('Runtime role has unexpected administrative privileges');
  }
  if (!existing) await client.query('CREATE ROLE nexos_homologation LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD ' + client.escapeLiteral(decodeURIComponent(runtime.password)));
  const roles = (await client.query("select rolname from pg_roles where rolname=any($1::text[])", [['anon','authenticated','service_role']])).rows.map(r => r.rolname);
  const denied = ['PUBLIC', ...roles.map(r => '"' + r + '"')].join(', ');
  await client.query(`REVOKE ALL ON SCHEMA public FROM ${denied}`);
  await client.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${denied}`);
  await client.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${denied}`);
  await client.query(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM ${denied}`);
  await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM ${denied}`);
  await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM ${denied}`);
  await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM ${denied}`);
  await client.query('GRANT USAGE ON SCHEMA public TO nexos_homologation');
  await client.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nexos_homologation');
  await client.query('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nexos_homologation');
  await client.query('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO nexos_homologation');
  // Supabase can automatically enable RLS on new tables. The backend role uses
  // the application's workspace/project guards, not Supabase Auth JWT claims.
  // Keep RLS enabled; this policy grants only that private SQL role access.
  const existingPolicies = new Set((await client.query("select tablename from pg_policies where schemaname='public' and policyname='nexos_homologation_backend'")).rows.map(p => p.tablename));
  const policyStatements = [];
  for (const table of tables.filter(t => t.rowsecurity)) {
    const identifier = client.escapeIdentifier(table.tablename);
    if (!existingPolicies.has(table.tablename)) policyStatements.push(`CREATE POLICY nexos_homologation_backend ON public.${identifier} TO nexos_homologation USING (true) WITH CHECK (true)`);
  }
  if (policyStatements.length) await client.query(policyStatements.join(';'));
  if (tables.some(t => t.tablename === 'nexos_schema_migrations')) {
    await client.query('REVOKE INSERT, UPDATE, DELETE ON public.nexos_schema_migrations FROM nexos_homologation');
  }
  await client.query('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nexos_homologation');
  await client.query('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO nexos_homologation');
  await client.query('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO nexos_homologation');
  await client.query('CREATE SCHEMA IF NOT EXISTS nexos_ops');
  await client.query('CREATE TABLE IF NOT EXISTS nexos_ops.environment (singleton boolean PRIMARY KEY CHECK(singleton), stage text NOT NULL CHECK(stage = \'homologation\'))');
  await client.query("INSERT INTO nexos_ops.environment VALUES (true, 'homologation') ON CONFLICT (singleton) DO NOTHING");
  await client.query('REVOKE ALL ON SCHEMA nexos_ops FROM PUBLIC');
  await client.query('GRANT USAGE ON SCHEMA nexos_ops TO nexos_homologation');
  await client.query('GRANT SELECT ON nexos_ops.environment TO nexos_homologation');
  await client.query('COMMIT');
}
try {
  await client.connect();
  for (let attempt = 0; ; attempt++) {
    try { await prepare(); break; }
    catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (!['40P01', '40001'].includes(error.code) || attempt >= 2) throw error;
      console.log('Retrying rolled-back privilege transaction after catalog contention');
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  console.log('PASS homologation role, database marker and public API/default privilege lockdown');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Homologation privilege setup failed:', error.code ?? error.message);
  process.exitCode = 1;
} finally { await client.end(); }
