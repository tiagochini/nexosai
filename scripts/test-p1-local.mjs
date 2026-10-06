import { spawnSync } from 'node:child_process';
// Explicitly owned disposable Compose services. Never load application .env files.
const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:55439/nexos_p1',
  REDIS_URL: 'redis://127.0.0.1:56389', SESSION_SECRET: 'ci-only-session-signing-fixture',
  INTEGRATION_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'), APP_URL: 'http://localhost:8081', ALLOWED_ORIGINS: 'http://localhost:8081' };
const pnpm = process.env.npm_execpath;
if (!pnpm) throw new Error('Run via pnpm run test:p1-local');
const steps = [
  ['@workspace/db', 'test:bootstrap-rollback'], ['@workspace/db', 'bootstrap:empty'], ['@workspace/db', 'seed:plans'], ['@workspace/db', 'verify'], ['@workspace/db', 'migrate:tracked'],
  ['@workspace/db', 'test:token-encryption', '--', '--database'],
  ...['auth-registration-db', 'auth-sessions-http', 'realtime-security-db', 'academy-funnel-db', 'academy-settlement-db', 'academy-access-outbox-db', 'academy-delivery-lifecycle-db', 'academy-p0-db', 'academy-content-db', 'academy-quota-redis', 'billing-reversal-db', 'billing-credit-concurrency-db', 'content-checkpoint-resume', 'orchestration-fallback-race', 'boot-recovery-safety', 'operational-health'].map(name => ['@workspace/api-server', `test:${name}`]),
  ['@workspace/db', 'verify'],
];
const from = process.argv.indexOf('--from');
const start = from >= 0 ? steps.findIndex(([, script]) => script === process.argv[from + 1]) : 0;
if (start < 0) throw new Error('Unknown resume step');
for (const [filter, script, ...args] of steps.slice(start)) {
  console.log(`\nP1 validation: ${script}`);
  const result = spawnSync(process.execPath, [pnpm, '--filter', filter, 'run', script, ...args], { env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('PASS P1 disposable PostgreSQL/Redis regression suite');
