import test from 'node:test';
import assert from 'node:assert/strict';
import { rootCertificates } from 'node:tls';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { validateRuntime } from './runtime.mjs';

function fixture() {
  return {
    DATABASE_URL: 'postgresql://USUARIO:SENHA@db.internal:5432/nexos',
    DATABASE_SSL_MODE: 'verify-full', DATABASE_SSL_CA_FILE: '/run/secrets/database_ca',
    SESSION_SECRET: randomBytes(32).toString('hex'), JWT_SECRET: randomBytes(32).toString('hex'),
    JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
    META_APP_SECRET: randomBytes(32).toString('hex'), WHATSAPP_WEBHOOK_VERIFY_TOKEN: randomBytes(32).toString('hex'),
    INTEGRATION_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    APP_URL: 'https://app.nexos.test', ALLOWED_ORIGINS: 'https://app.nexos.test',
  };
}
const redis = randomBytes(32).toString('hex');
const ca = rootCertificates[0];
// Set non-placeholder URL credentials at runtime, never check credentials into source.
function valid() {
  const values = fixture();
  const url = new URL(values.DATABASE_URL);
  url.username = 'runtime'; url.password = randomBytes(16).toString('hex');
  values.DATABASE_URL = url.href;
  return values;
}
test('accepts complete HTTPS/external TLS runtime configuration', () => {
  assert.deepEqual(validateRuntime(valid(), redis, ca), []);
});
test('rejects insecure/misleading configuration without revealing credentials', () => {
  const values = valid();
  values.DATABASE_URL += '?sslmode=no-verify';
  values.DATABASE_SSL_MODE = 'disable';
  values.APP_URL = 'http://localhost:8081';
  values.LOCAL_SAFE_MODE = 'true';
  values.NODE_ENV = 'development';
  values.MIGRATION_BASELINE_EXISTING_SCHEMA = 'true';
  const errors = validateRuntime(values, 'short', 'not a certificate');
  for (const name of ['DATABASE_URL', 'DATABASE_SSL_MODE', 'APP_URL', 'LOCAL_SAFE_MODE', 'NODE_ENV', 'MIGRATION_BASELINE_EXISTING_SCHEMA', 'redis-password', 'database CA']) {
    assert.ok(errors.some(error => error.startsWith(`${name}:`)), name);
  }
  assert.ok(!errors.join('\n').includes(new URL(values.DATABASE_URL).password));
});
test('rejects template, mismatched origins and invalid encryption keys', () => {
  const values = fixture();
  values.INTEGRATION_TOKEN_ENCRYPTION_KEY = Buffer.alloc(16).toString('base64');
  values.ALLOWED_ORIGINS = '*';
  const errors = validateRuntime(values, redis, ca);
  assert.ok(errors.some(error => error.startsWith('DATABASE_URL:')));
  assert.ok(errors.some(error => error.startsWith('ALLOWED_ORIGINS:')));
  assert.ok(errors.some(error => error.startsWith('INTEGRATION_TOKEN_ENCRYPTION_KEY:')));
});
test('init generates independent keys and refuses to replace existing credentials', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'nexos-aws-runtime-'));
  const script = fileURLToPath(new URL('./runtime.mjs', import.meta.url));
  const run = () => spawnSync(process.execPath, [script, 'init', directory], { encoding: 'utf8', windowsHide: true });
  try {
    const first = run();
    assert.equal(first.status, 0, first.stderr);
    const content = await readFile(path.join(directory, 'app.env'), 'utf8');
    const values = parseEnv(content);
    assert.equal(new Set([values.SESSION_SECRET, values.JWT_SECRET, values.JWT_REFRESH_SECRET]).size, 3);
    assert.equal(Buffer.from(values.INTEGRATION_TOKEN_ENCRYPTION_KEY, 'base64').length, 32);
    for (const name of ['SESSION_SECRET', 'JWT_SECRET', 'JWT_REFRESH_SECRET']) {
      assert.equal(values[name].length, 64);
      assert.ok(!first.stdout.includes(values[name]));
    }
    assert.equal(run().status, 1);
    assert.equal(await readFile(path.join(directory, 'app.env'), 'utf8'), content);
  } finally {
    // Only this uniquely created fixture directory is removed.
    await rm(directory, { recursive: true, force: true });
  }
});
