import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes, createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encryptBackup, decryptBackup } from './backup-crypto.mjs';

const root = path.resolve(import.meta.dirname, '..');
const api = path.join(root, 'artifacts/api-server');
const requireApi = createRequire(path.join(api, 'package.json'));
const Redis = requireApi('ioredis'); const { Queue } = requireApi('bullmq');
const requireDb = createRequire(path.join(root, 'lib/db/package.json')); const { Client } = requireDb('pg');
const pnpm = process.env.npm_execpath; if (!pnpm) throw new Error('Use pnpm run test:p2-local');
const project = 'nexos-p2-tests', composeFile = path.join(root, 'scripts/compose.p2-tests.yml');
const backupRoot = path.join(root, '.local-recovery/p2'); await mkdir(backupRoot, { recursive: true });
const runDir = await mkdtemp(path.join(backupRoot, 'owned-'));
const redisPassword = randomBytes(32).toString('hex'), encryptionKey = randomBytes(32);
const secretFile = path.join(runDir, 'redis-password'); await writeFile(secretFile, redisPassword, { mode: 0o600 });
const env = { ...process.env, NODE_ENV: 'test', P2_OWNED_INFRA: 'true',
  REDIS_PASSWORD_FILE: secretFile, REDIS_PORT: '56390',
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:55440/nexos_p2',
  REDIS_URL: `redis://:${redisPassword}@127.0.0.1:56390`, QUEUE_PREFIX: 'p2-owned',
  SESSION_SECRET: 'p2-disposable-session-fixture', INTEGRATION_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  ASAAS_API_KEY: 'offline-p2-fixture', ASAAS_ENV: 'sandbox', ASAAS_SANDBOX: 'true' };
const results = { generatedAt: new Date().toISOString(), scope: 'Owned local containers and inert fixtures; no external provider calls', checks: {}, load: [] };
let worker, base, redis, restoredRedis, queue, started = false;
async function command(bin, args, options = {}) {
  const child = spawn(bin, args, { cwd: root, env, windowsHide: true, ...options });
  let output = '';
  child.stdout?.on('data', chunk => { output += chunk; }); child.stderr?.on('data', () => {});
  const status = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  if (status !== 0) throw new Error(`${path.basename(bin)} ${args[0]} failed (${status}); dependency command output withheld`);
  return output.trim();
}
const compose = (...args) => command('docker', ['compose', '-p', project, '-f', composeFile, ...args]);
const run = (filter, script, extra = [], overrides = {}) => command(process.execPath, [pnpm, '--filter', filter, 'run', script, ...extra], { env: { ...env, ...overrides } });
async function request(route, options = {}) {
  const response = await fetch(base + route, { ...options, signal: AbortSignal.timeout(20_000) });
  return { status: response.status, body: await response.json() };
}
async function waitReady(route, expected = 200, predicate = () => true) {
  const start = performance.now();
  let last;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { const response = await request(route); last = response.body; if (response.status === expected && predicate(response.body)) return Math.round(performance.now() - start); } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Service did not recover at ${route}${route === '/healthz' ? ': ' + JSON.stringify(last) : ''}`);
}
async function redisFingerprints(client) {
  const keys = (await client.keys('*')).sort(); const values = {};
  for (const key of keys) values[key] = { sha256: createHash('sha256').update(await client.dump(key)).digest('hex'), ttlMs: await client.pttl(key) };
  return values;
}
async function databaseFingerprints(client) {
  const tables = await client.query("select tablename from pg_tables where schemaname='public' order by tablename"); const fingerprints = {};
  for (const { tablename } of tables.rows) {
    const table = '"' + tablename.replaceAll('"', '""') + '"';
    const rows = await client.query(`select row_to_json(t)::text as data from ${table} t`);
    const values = rows.rows.map(row => row.data).sort();
    fingerprints[tablename] = { rows: values.length, sha256: createHash('sha256').update(values.join('\n')).digest('hex') };
  }
  return fingerprints;
}
async function benchmark(route, concurrency, count, post = false) {
  const latencies = []; let cursor = 0, errors = 0, peakWaiting = 0;
  let sampling = true;
  const sampler = (async () => { while (sampling) {
    const stats = await request('/pool'); peakWaiting = Math.max(peakWaiting, stats.body.waiting);
    await new Promise(resolve => setTimeout(resolve, 25));
  } })();
  const start = performance.now();
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < count) {
      const index = cursor++; const time = performance.now();
      const response = await request(route, post ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: `load-${concurrency}-${index}` }) } : {});
      if (response.status !== 200) errors++; latencies.push(performance.now() - time);
    }
  }));
  const elapsed = performance.now() - start; sampling = false; await sampler; latencies.sort((a, b) => a - b);
  const result = { route, concurrency, requests: count, errors, elapsedMs: Math.round(elapsed), requestsPerSecond: Math.round(count / elapsed * 1000),
    p50Ms: Math.round(latencies[Math.floor(latencies.length * .5)]), p95Ms: Math.round(latencies[Math.floor(latencies.length * .95)]), maxMs: Math.round(latencies.at(-1)), peakPoolWaiting: peakWaiting };
  results.load.push(result); console.log(`P2 load ${JSON.stringify(result)}`); assert.equal(errors, 0);
  return result;
}
try {
  console.log('P2: starting persistent authenticated Redis 7.4 and disposable PostgreSQL');
  started = true; await compose('up', '-d', '--wait');
  await run('@workspace/db', 'bootstrap:empty'); await run('@workspace/db', 'seed:plans'); await run('@workspace/db', 'verify');
  worker = spawn(process.execPath, [requireApi.resolve('tsx/cli'), 'src/scripts/p2-api-fixture.ts'], { cwd: api, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  base = await new Promise((resolve, reject) => {
    let buffer = ''; const timer = setTimeout(() => reject(new Error('P2 fixture startup timed out')), 60_000);
    worker.once('error', reject); worker.once('exit', code => { clearTimeout(timer); reject(new Error(`P2 fixture exited during startup (${code})`)); });
    worker.stdout.on('data', chunk => { buffer += chunk; const match = buffer.match(/P2_READY (\{[^\n]+\})/); if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${JSON.parse(match[1]).port}`); } if (buffer.length > 50_000) buffer = buffer.slice(-10_000); });
    worker.stderr.on('data', () => {});
  });
  redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 0, retryStrategy: () => null }); redis.on('error', () => {});
  await redis.ping(); const serverInfo = await redis.info('server'); assert.match(serverInfo, /redis_version:7\.4\./);
  results.redisVersion = serverInfo.match(/redis_version:([^\r\n]+)/)[1];
  assert.deepEqual(await redis.config('GET', 'maxmemory-policy'), ['maxmemory-policy', 'noeviction']);
  assert.equal((await redis.config('GET', 'appendonly'))[1], 'yes');
  const unauthenticated = new Redis('redis://127.0.0.1:56390', { maxRetriesPerRequest: 0, retryStrategy: () => null }); unauthenticated.on('error', () => {});
  await assert.rejects(unauthenticated.ping(), /NOAUTH/); unauthenticated.disconnect();
  assert.equal((await request('/readyz')).status, 200);
  await waitReady('/healthz', 200, body => body.status === 'ok');
  const probeJob = key => request('/queue/probe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key }) });
  assert.equal((await probeJob('before-outage')).status, 200); await waitReady('/queue/state', 200, body => body.processed === 1);
  results.checks.redisPolicy = 'PASS authenticated, persistent AOF, noeviction, monitored health';

  // Saturation and transactional traffic exercise real shared pool/ledger code.
  for (const concurrency of [1, 8, 32]) { await benchmark('/balance', concurrency, 96); await benchmark('/deduct', concurrency, 64, true); }
  const saturated = await benchmark('/saturation', 32, 64); assert.ok(saturated.peakPoolWaiting > 0);
  const ledger = await request('/ledger'); assert.equal(ledger.body.transactions, 192); assert.equal(ledger.body.balance, 1_000_000 - 192 * 15);
  const beforeReplay = ledger.body.balance;
  const duplicate = await Promise.all(Array.from({ length: 32 }, () => request('/deduct', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'shared-replay' }) })));
  assert.ok(duplicate.every(response => response.status === 200)); assert.equal(new Set(duplicate.map(response => response.body.id)).size, 1);
  assert.equal((await request('/ledger')).body.balance, beforeReplay - 15);
  results.checks.concurrentLedger = 'PASS 192 unique charges and 32 replays produce one additional debit';
  results.dockerResources = await command('docker', ['info', '--format', '{{.NCPU}} CPUs / {{.MemTotal}} bytes RAM']);
  results.dockerStats = await compose('stats', '--no-stream', '--format', '{{.Name}}: CPU={{.CPUPerc}} RAM={{.MemUsage}}');

  await redis.set('p2-owned:durable', 'inert-persistence-canary'); await redis.hset('p2-owned:hash', { fixture: 'owned' });
  await redis.lpush('p2-owned:list', 'a', 'b'); await redis.zadd('p2-owned:zset', 1, 'inert');
  queue = new Queue('p2-owned-durable', { connection: { host: '127.0.0.1', port: 56390, password: redisPassword } });
  await queue.add('inert', { fixture: true }, { jobId: 'owned-job', delay: 86_400_000 });
  assert.equal((await request('/quota')).status, 200);
  await new Promise(resolve => setTimeout(resolve, 1500));
  const redisContainer = await compose('ps', '-q', 'redis');
  const recoveryStart = performance.now(); await command('docker', ['kill', '--signal', 'KILL', redisContainer]);
  await compose('up', '-d', '--wait', 'redis');
  redis.disconnect(); redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 0, retryStrategy: () => null }); redis.on('error', () => {});
  assert.equal(await redis.get('p2-owned:durable'), 'inert-persistence-canary');
  assert.ok(await queue.getJob('owned-job')); await waitReady('/readyz');
  results.redisCrashRecoveryMs = Math.round(performance.now() - recoveryStart);
  results.checks.redisCrashPersistence = 'PASS SIGKILL and restart retain acknowledged fixture and delayed BullMQ job';

  await compose('stop', 'redis'); const redisDown = await request('/readyz'); assert.equal(redisDown.status, 503);
  assert.equal((await request('/quota')).status, 503); assert.equal((await request('/livez')).status, 200);
  const rejectedAt = performance.now(); assert.equal((await probeJob('during-outage')).status, 503); assert.ok(performance.now() - rejectedAt < 6000);
  await new Promise(resolve => setTimeout(resolve, 9000)); // Exceeds the old three-retry terminal disconnect.
  const redisRestartStarted = performance.now();
  await compose('up', '-d', '--wait', 'redis'); await waitReady('/readyz');
  await waitReady('/healthz', 200, body => body.status === 'ok');
  assert.equal((await request('/quota')).status, 200);
  assert.equal((await probeJob('after-outage')).status, 200); await waitReady('/queue/state', 200, body => body.processed === 2);
  results.redisOutageRecoveryMs = Math.round(performance.now() - redisRestartStarted);
  results.checks.redisOutage = 'PASS live API, unready service, quotas and producer reject; same producer/worker recover after prolonged outage without API restart';
  await compose('stop', 'postgres'); assert.equal((await request('/readyz')).status, 503); assert.equal((await request('/balance')).status, 503); assert.equal((await request('/livez')).status, 200);
  const postgresRestartStarted = performance.now();
  await compose('up', '-d', '--wait', 'postgres'); await waitReady('/readyz');
  assert.equal((await request('/ledger')).body.balance, beforeReplay - 15);
  results.postgresOutageRecoveryMs = Math.round(performance.now() - postgresRestartStarted);
  results.checks.postgresOutage = 'PASS API survives idle pool errors; dependency rejects and existing pool recovers with ledger intact';
  const providers = await request('/provider-failures'); assert.equal(providers.status, 200); assert.equal(providers.body.rejected, 8); assert.ok(providers.body.elapsedMs < 15_000);
  results.providerFailures = providers.body; results.checks.providerFailures = 'PASS billing and Academy reject loopback HTTP 429, 503, malformed JSON and timed-out requests without provider detail';

  redis.disconnect(); redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 0 }); redis.on('error', () => {}); await redis.ping();
  // Real Redis memory pressure rejects writes instead of evicting existing jobs.
  const memory = Number((await redis.info('memory')).match(/used_memory:(\d+)/)[1]);
  await redis.config('SET', 'maxmemory', String(memory + 64 * 1024));
  await assert.rejects(redis.set('p2-owned:oversize', 'x'.repeat(2 * 1024 * 1024)), /OOM/);
  assert.equal(await redis.get('p2-owned:durable'), 'inert-persistence-canary'); await redis.config('SET', 'maxmemory', '512mb');
  results.checks.redisMemoryPressure = 'PASS OOM rejects oversized writes without evicting durable keys';

  console.log('P2: backing up full schema/data and Redis, encrypting and restoring into new targets');
  const original = (await request('/snapshot')).body.tables; assert.equal(Object.keys(original).length, 177);
  const postgresContainer = await compose('ps', '-q', 'postgres');
  const dumpFile = path.join(runDir, 'database.dump');
  await compose('exec', '-T', 'postgres', 'pg_dump', '-U', 'postgres', '-d', 'nexos_p2', '--format=custom', '--no-owner', '--no-privileges', '--file=/tmp/p2-owned.dump');
  await command('docker', ['cp', `${postgresContainer}:/tmp/p2-owned.dump`, dumpFile]);
  await redis.save(); const originalRedis = await redisFingerprints(redis);
  const rdbFile = path.join(runDir, 'redis.rdb');
  await command('docker', ['cp', `${redisContainer}:/data/dump.rdb`, rdbFile]);
  const archives = {};
  for (const [name, file] of [['postgres', dumpFile], ['redis', rdbFile]]) {
    const encrypted = `${file}.enc`, decrypted = `${file}.restored`;
    archives[name] = await encryptBackup(file, encrypted, encryptionKey);
    await assert.rejects(decryptBackup(encrypted, `${file}.wrong-key`, randomBytes(32)));
    const tampered = Buffer.from(await readFile(encrypted)); tampered[tampered.length - 1] ^= 1;
    const badFile = `${file}.tampered`; await writeFile(badFile, tampered); await assert.rejects(decryptBackup(badFile, `${file}.bad-output`, encryptionKey)); await unlink(badFile);
    await decryptBackup(encrypted, decrypted, encryptionKey); assert.deepEqual(await readFile(decrypted), await readFile(file));
  }
  const restoreStart = performance.now();
  const admin = new Client({ connectionString: env.DATABASE_URL }); await admin.connect(); await admin.query('create database nexos_p2_restored'); await admin.end();
  await command('docker', ['cp', `${dumpFile}.restored`, `${postgresContainer}:/tmp/p2-owned-restore.dump`]);
  await compose('exec', '-T', 'postgres', 'pg_restore', '-U', 'postgres', '-d', 'nexos_p2_restored', '--exit-on-error', '--no-owner', '--no-privileges', '/tmp/p2-owned-restore.dump');
  const restored = new Client({ connectionString: env.DATABASE_URL.replace('/nexos_p2', '/nexos_p2_restored') }); await restored.connect();
  assert.deepEqual(await databaseFingerprints(restored), original); await restored.end();
  await run('@workspace/db', 'verify', [], { DATABASE_URL: env.DATABASE_URL.replace('/nexos_p2', '/nexos_p2_restored') });
  const restoreContainer = await compose('ps', '-q', 'redis-restore'); await compose('stop', 'redis-restore');
  await command('docker', ['cp', `${rdbFile}.restored`, `${restoreContainer}:/data/dump.rdb`]);
  await compose('up', '-d', '--wait', 'redis-restore');
  restoredRedis = new Redis('redis://127.0.0.1:56391', { maxRetriesPerRequest: 0 }); restoredRedis.on('error', () => {});
  const recovered = await redisFingerprints(restoredRedis); assert.deepEqual(Object.keys(recovered), Object.keys(originalRedis));
  for (const key of Object.keys(originalRedis)) { assert.equal(recovered[key].sha256, originalRedis[key].sha256); if (originalRedis[key].ttlMs > 0) assert.ok(recovered[key].ttlMs > 0 && recovered[key].ttlMs <= originalRedis[key].ttlMs); }
  results.backup = { tables: Object.keys(original).length, rows: Object.values(original).reduce((sum, table) => sum + table.rows, 0), redisKeys: Object.keys(originalRedis).length, archives,
    restoreMs: Math.round(performance.now() - restoreStart), encryptedTransport: 'AES-256-GCM; wrong-key and tamper rejection passed' };
  results.checks.fullRestore = 'PASS every public table/row digest, schema verifier, encrypted integration ciphertext, Redis value/type/TTL and delayed queue restored';
  // Plaintext artifacts are test-only and removed. The encryption key is not retained with the archives.
  for (const file of [dumpFile, rdbFile, `${dumpFile}.restored`, `${rdbFile}.restored`]) await unlink(file);
  assert.equal((await request('/shutdown', { method: 'POST' })).body.cleaned, true); base = undefined;
  await run('@workspace/db', 'verify');
  await writeFile(path.join(root, 'docs/P2_VALIDATION_RESULTS.json'), JSON.stringify(results, null, 2) + '\n');
  console.log('PASS P2 local persistence, full restore, real outages, provider failure and bounded load');
} finally {
  if (base) { try { await request('/shutdown', { method: 'POST' }); } catch {} }
  worker?.kill(); await queue?.close().catch(() => {}); redis?.disconnect(); restoredRedis?.disconnect();
  // Only the hardcoded project created by this runner is removed.
  if (started) await compose('down', '--volumes', '--remove-orphans');
  await unlink(secretFile).catch(() => {});
}
