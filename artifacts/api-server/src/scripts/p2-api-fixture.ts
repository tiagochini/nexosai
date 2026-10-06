import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import { eq, sql } from 'drizzle-orm';
import Redis from 'ioredis';
import { Queue, Worker } from 'bullmq';
import { redisConnectionOptions } from '../lib/redis-connection.js';
import { db, pool, workspacesTable, academyPurchasesTable, creditTransactionsTable } from '@workspace/db';
import healthRouter from '../routes/health.js';
import { closeAllQueues } from '../modules/queue/queue.service.js';
import { createAcademyVerificationLimiter, closeAcademyQuotaConnections } from '../modules/academy/academy-verification.security.js';
import { seedE2eFixtures, cleanupE2eFixtures, markerFromSuffix } from './e2e-fixtures.js';
import { getBalance, deductCredits } from '../modules/credits/credits.service.js';
import { fetchAsaasSettlement } from '../modules/billing/billing-settlement.js';
import { fetchAcademySettlement } from '../modules/academy/academy-settlement.service.js';
import { logger } from '../lib/logger.js';

assert.equal(process.env.NODE_ENV, 'test'); assert.equal(process.env.P2_OWNED_INFRA, 'true');
const url = new URL(process.env.DATABASE_URL!); assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55440'); assert.equal(url.pathname, '/nexos_p2');
const nativeFetch = fetch;
globalThis.fetch = async (input, options) => {
  const target = new URL(String(input));
  assert.equal(target.hostname, '127.0.0.1', 'P2 fixture forbids external requests');
  return nativeFetch(input, options);
};
const marker = markerFromSuffix(`p2_${randomUUID().replaceAll('-', '')}`);
const manifest = await seedE2eFixtures(marker);
const workspace = manifest.workspaces[0]!;
const purchaseId = randomUUID();
await db.update(workspacesTable).set({ creditsBalance: 1_000_000 }).where(eq(workspacesTable.id, workspace));
await db.insert(academyPurchasesTable).values({ id: purchaseId, accessToken: `NX-P2-${randomUUID().replaceAll('-', '').slice(0, 24)}`, customerName: 'Owned P2 fixture', customerEmail: 'p2@example.invalid', productId: 'complete-bundle', status: 'confirmed', amountCents: 100 });
const redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: 0, enableOfflineQueue: false, retryStrategy: () => null }); redis.on('error', () => {}); await once(redis, 'ready');
const app = express(); app.use(express.json()); app.use(healthRouter);
let workerRuns = 0;
const fixtureQueue = new Queue('p2-owned-recovery', { connection: redisConnectionOptions('producer') }); fixtureQueue.on('error', () => {});
const fixtureWorker = new Worker('p2-owned-recovery', async () => { workerRuns++; }, { connection: redisConnectionOptions('worker'), maxStalledCount: 0 }); fixtureWorker.on('error', () => {});
await fixtureWorker.waitUntilReady();
app.post('/queue/probe', async (req, res) => { assert.match(req.body.key, /^[a-z-]+$/); await fixtureQueue.add('inert', {}, { jobId: req.body.key }); res.json({ queued: true }); });
app.get('/queue/state', (_req, res) => res.json({ processed: workerRuns }));
app.get('/balance', async (_req, res) => { res.json({ balance: await getBalance(workspace) }); });
app.post('/deduct', async (req, res) => {
  assert.match(req.body.key, /^[a-zA-Z0-9_-]{1,100}$/);
  const result = await deductCredits(workspace, 'strategy_generation', logger, undefined, undefined, undefined, undefined, `${marker}-${req.body.key}`);
  res.json({ id: result.id });
});
app.get('/saturation', async (_req, res) => { await pool.query('select pg_sleep(0.15)'); res.json({ ok: true }); });
app.get('/pool', (_req, res) => { res.json({ total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount, max: pool.options.max }); });
app.get('/quota', createAcademyVerificationLimiter([], { redisURL: process.env.REDIS_URL, prefix: `${marker}-quota:` }), (_req, res) => res.json({ ok: true }));
app.get('/snapshot', async (_req, res) => {
  const tables = await pool.query("select tablename from pg_tables where schemaname='public' order by tablename");
  const fingerprints: Record<string, { rows: number; sha256: string }> = {};
  for (const { tablename } of tables.rows) {
    const table = '"' + String(tablename).replaceAll('"', '""') + '"';
    const rows = await pool.query(`select row_to_json(t)::text as data from ${table} t`);
    const values = rows.rows.map(row => row.data as string).sort();
    fingerprints[tablename] = { rows: values.length, sha256: createHash('sha256').update(values.join('\n')).digest('hex') };
  }
  const ciphertext = await pool.query('select access_token from workspace_integrations where workspace_id=$1', [workspace]);
  assert.ok(ciphertext.rows.every(row => String(row.access_token).startsWith('nexosenc:v1:')));
  res.json({ tables: fingerprints });
});
app.get('/ledger', async (_req, res) => {
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(creditTransactionsTable).where(eq(creditTransactionsTable.workspaceId, workspace));
  res.json({ balance: await getBalance(workspace), transactions: count[0]!.count });
});
// Real loopback HTTP failures through production provider parsers/timeouts.
const provider = express();
provider.get('/:mode', (req, res) => {
  if (req.params.mode === 'timeout') return;
  if (req.params.mode === 'malformed') { res.type('json').send('{broken'); return; }
  res.status(Number(req.params.mode)).send('private-p2-provider-canary');
});
const providerServer = provider.listen(0, '127.0.0.1'); await once(providerServer, 'listening');
const providerAddress = providerServer.address(); assert.ok(providerAddress && typeof providerAddress !== 'string');
app.get('/provider-failures', async (_req, res) => {
  const started = performance.now(); let rejected = 0;
  for (const mode of ['429', '503', 'malformed', 'timeout']) {
    await Promise.all([fetchAsaasSettlement, fetchAcademySettlement].map(async lookup => {
      const localRequest: typeof fetch = async (_input, options) => nativeFetch(`http://127.0.0.1:${providerAddress.port}/${mode}`, options);
      await assert.rejects(lookup('owned-p2-payment', localRequest), (err: unknown) => {
        assert.ok(err instanceof Error); assert.ok(!err.message.includes('private-p2-provider-canary')); rejected++; return true;
      });
    }));
  }
  res.json({ rejected, elapsedMs: Math.round(performance.now() - started) });
});
app.post('/shutdown', async (_req, res) => {
  await db.delete(academyPurchasesTable).where(eq(academyPurchasesTable.id, purchaseId)); await cleanupE2eFixtures(manifest);
  await fixtureWorker.close(); await fixtureQueue.close();
  await closeAllQueues(); closeAcademyQuotaConnections(); redis.disconnect(); await pool.end();
  res.json({ cleaned: true });
  providerServer.closeAllConnections(); providerServer.close(); server.close();
});
app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(503).json({ error: 'Dependency unavailable' }); });
const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
const address = server.address(); assert.ok(address && typeof address !== 'string');
console.log(`P2_READY ${JSON.stringify({ port: address.port })}`);
