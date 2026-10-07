import test from 'node:test';
import assert from 'node:assert/strict';
import { assertIsolationTestDatabase } from './test-database-target.js';
const client = { query: async () => { throw new Error('Remote query must never run'); } };
test('regression rejects Supabase even with the former external opt-in', async () => {
  await assert.rejects(assertIsolationTestDatabase(client, { NODE_ENV: 'test', DATABASE_URL: 'postgresql://nexos_homologation@db.fixture.supabase.co:5432/postgres', HOMOLOGATION_DB_TESTS: 'true', HOMOLOGATION_ENVIRONMENT: 'true', DATABASE_SSL_MODE: 'verify-full', HOMOLOGATION_DATABASE_HOST: 'db.fixture.supabase.co' }), /reserved for homologation/);
});
test('local guard permits disposable CI databases and rejects persistent development data', async () => {
  await assertIsolationTestDatabase(client, { NODE_ENV: 'test', DATABASE_URL: 'postgresql://postgres@localhost:5432/nexos_ci' });
  await assert.rejects(assertIsolationTestDatabase(client, { NODE_ENV: 'test', DATABASE_URL: 'postgresql://postgres@localhost:5432/nexosAi' }));
});
