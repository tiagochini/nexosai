import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { databaseConnectionOptions } from '../lib/db/src/connection-options.mjs';
import { homologationEnvironment } from './homologation-environment.mjs';
const { environment, adminUrl } = homologationEnvironment();
const { Client } = createRequire(new URL('../lib/db/package.json', import.meta.url))('pg');
const client = new Client(databaseConnectionOptions({ ...environment, DATABASE_URL: adminUrl }));
try {
  await client.connect();
  await client.query('BEGIN READ ONLY');
  const role = (await client.query("select rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolreplication from pg_roles where rolname='nexos_homologation'")).rows[0];
  assert.ok(role); assert.ok(Object.values(role).every(v => v === false));
  assert.equal((await client.query("select count(*)::int as count from pg_auth_members m join pg_roles r on r.oid=m.member where r.rolname='nexos_homologation'")).rows[0].count, 0);
  const access = (await client.query("select rolname, has_schema_privilege(rolname,'public','USAGE') as usage from pg_roles where rolname in ('anon','authenticated','service_role')")).rows;
  assert.ok(access.every(r => !r.usage), 'Supabase API roles must not access the application schema');
  const runtime = (await client.query("select has_schema_privilege('nexos_homologation','public','CREATE') as ddl, has_table_privilege('nexos_homologation','public.nexos_schema_migrations','UPDATE') as history_write, has_table_privilege('nexos_homologation','nexos_ops.environment','UPDATE') as marker_write")).rows[0];
  assert.ok(Object.values(runtime).every(v => v === false));
  const marker = (await client.query('select stage from nexos_ops.environment where singleton=true')).rows;
  assert.equal(marker.length, 1); assert.equal(marker[0].stage, 'homologation');
  const policies = (await client.query("select tablename from pg_tables t where schemaname='public' and rowsecurity and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=t.tablename and p.policyname='nexos_homologation_backend' and p.roles=array['nexos_homologation']::name[])")).rows;
  assert.equal(policies.length, 0, 'Missing private backend policy on RLS-enabled table');
  await client.query('ROLLBACK');
  console.log('PASS private SQL runtime, API schema denial, immutable environment marker and restricted migration history');
} finally { await client.end(); }
