import test from 'node:test';
import assert from 'node:assert/strict';
import { assertIsolationTestDatabase } from './test-database-target.js';
const environment = { NODE_ENV: 'test', DATABASE_URL: 'postgresql://nexos_homologation@db.fixture.supabase.co:5432/postgres', HOMOLOGATION_DB_TESTS: 'true', HOMOLOGATION_DATABASE_HOST: 'db.fixture.supabase.co', DATABASE_SSL_MODE: 'verify-full' };
const marker = { query: async () => ({ rows: [{ role: 'nexos_homologation', stage: 'homologation' }] }) };
test('external regression requires the explicit target, verified TLS, limited role and server marker', async () => {
  await assertIsolationTestDatabase(marker, environment);
  for (const override of [{ HOMOLOGATION_DB_TESTS: '' }, { DATABASE_SSL_MODE: 'disable' }, { HOMOLOGATION_DATABASE_HOST: 'db.other.supabase.co' }, { DATABASE_URL: environment.DATABASE_URL.replace('nexos_homologation@', 'postgres@') }, { NODE_ENV: 'production' }]) {
    await assert.rejects(assertIsolationTestDatabase(marker, { ...environment, ...override }));
  }
  await assert.rejects(assertIsolationTestDatabase({ query: async () => ({ rows: [] }) }, environment));
  await assert.rejects(assertIsolationTestDatabase({ query: async () => ({ rows: [{ role: 'nexos_homologation', stage: 'production' }] }) }, environment));
});
test('local guard retains its disposable database requirement', async () => {
  await assertIsolationTestDatabase(marker, { NODE_ENV: 'test', DATABASE_URL: 'postgresql://postgres@localhost:5432/nexos_ci' });
  await assert.rejects(assertIsolationTestDatabase(marker, { NODE_ENV: 'test', DATABASE_URL: 'postgresql://postgres@localhost:5432/nexosAi' }));
});
