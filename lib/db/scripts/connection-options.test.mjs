import test from 'node:test';
import assert from 'node:assert/strict';
import { databaseConnectionOptions } from '../src/connection-options.mjs';
const DATABASE_URL = 'postgresql://fixture:fixture@database.example.invalid/nexos';
test('external TLS validates the certificate and local mode disables TLS explicitly', () => {
  assert.deepEqual(databaseConnectionOptions({ DATABASE_URL, DATABASE_SSL_MODE: 'verify-full' }).ssl, { rejectUnauthorized: true });
  assert.equal(databaseConnectionOptions({ DATABASE_URL, DATABASE_SSL_MODE: 'disable' }).ssl, false);
  assert.equal(databaseConnectionOptions({ DATABASE_URL, DB_POOL_MAX: '4' }).max, 4);
  for (const value of ['0', '101', 'nan', '1.5']) assert.throws(() => databaseConnectionOptions({ DATABASE_URL, DB_POOL_MAX: value }));
  assert.throws(() => databaseConnectionOptions({ DATABASE_URL: `${DATABASE_URL}?sslmode=no-verify`, DATABASE_SSL_MODE: 'verify-full' }));
  assert.throws(() => databaseConnectionOptions({ DATABASE_URL, DATABASE_SSL_CA_FILE: '/unused' }));
  assert.throws(() => databaseConnectionOptions({ DATABASE_URL: 'not-a-url' }), error => !error.message.includes('not-a-url'));
});
