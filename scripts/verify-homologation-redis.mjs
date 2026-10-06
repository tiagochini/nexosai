import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { homologationEnvironment } from './homologation-environment.mjs';
const { environment } = homologationEnvironment();
const Redis = createRequire(new URL('../artifacts/api-server/package.json', import.meta.url))('ioredis');
const client = new Redis(environment.REDIS_URL, { lazyConnect: true, connectTimeout: 3000, maxRetriesPerRequest: 0, retryStrategy: () => null });
client.on('error', () => {});
const key = `${environment.QUEUE_PREFIX}-health-${randomUUID()}`;
try {
  await client.connect(); assert.equal(await client.ping(), 'PONG');
  await client.set(key, 'fixture', 'EX', 10);
  assert.equal(await client.get(key), 'fixture'); await client.del(key);
  const url = new URL(environment.REDIS_URL); url.password = 'invalid-fixture';
  const rejected = new Redis(url.href, { lazyConnect: true, connectTimeout: 3000, maxRetriesPerRequest: 0, retryStrategy: () => null });
  rejected.on('error', () => {});
  try { await assert.rejects(async () => { await rejected.connect(); await rejected.ping(); }); }
  finally { rejected.disconnect(); }
  console.log('PASS dedicated loopback Redis, authenticated read/write, invalid credential rejection and owned probe cleanup');
} finally { client.disconnect(); }
