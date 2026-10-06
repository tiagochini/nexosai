import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { buildHomologationEnvironment } from './homologation-environment.mjs';
const profile = {
  DATABASE_URL: 'postgresql://nexos_homologation@db.fixture.supabase.co:5432/postgres',
  DATABASE_ADMIN_URL: 'postgresql://postgres@db.fixture.supabase.co:5432/postgres',
  HOMOLOGATION_DB_TESTS: 'true', HOMOLOGATION_DATABASE_HOST: 'db.fixture.supabase.co',
  DATABASE_SSL_MODE: 'verify-full', DATABASE_SSL_CA_FILE: '/fixture/ca.crt',
  REDIS_URL: 'redis://localhost:6379/5', QUEUE_PREFIX: 'homologation-fixture',
};
test('profile isolates local provider/database secrets and removes the migration credential from child environments', () => {
  const { environment, adminUrl } = buildHomologationEnvironment(profile, {
    PATH: '/fixture/bin', DATABASE_URL: 'local-fixture', OPENAI_API_KEY: 'parent-fixture', GMAIL_APP_PASSWORD: 'parent-fixture', NODE_OPTIONS: '--invalid-parent-option',
  });
  assert.equal(environment.DATABASE_URL, profile.DATABASE_URL);
  assert.equal(environment.PATH, '/fixture/bin');
  assert.equal(environment.NODE_ENV, 'test');
  for (const name of ['DATABASE_ADMIN_URL','OPENAI_API_KEY','GMAIL_APP_PASSWORD','NODE_OPTIONS']) assert.equal(environment[name], undefined);
  assert.equal(adminUrl, profile.DATABASE_ADMIN_URL);
  for (const override of [{ DATABASE_SSL_MODE: 'disable' }, { HOMOLOGATION_DATABASE_HOST: 'db.other.supabase.co' }, { DATABASE_URL: profile.DATABASE_ADMIN_URL }, { REDIS_URL: 'redis://localhost:6379/0' }, { QUEUE_PREFIX: 'dev' }]) {
    assert.throws(() => buildHomologationEnvironment({ ...profile, ...override }, {}));
  }
});
test('regression transport blocks provider HTTP while permitting its loopback test servers', async () => {
  await import('./homologation-test-transport.mjs');
  assert.throws(() => fetch('https://api.example.invalid/fixture'), /disabled/);
  const server = http.createServer((_req, res) => res.end('fixture'));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/`);
    assert.equal(await response.text(), 'fixture');
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
