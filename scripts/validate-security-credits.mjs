// Disposable PostgreSQL/Redis validation. Does not load homologation credentials.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const project = 'nexos-security-credit-tests';
const image = process.env.SECURITY_TEST_IMAGE || 'nexos-api:p3-test';
const output = path.join(root, '.local', 'security-credit-evidence');
mkdirSync(output, { recursive: true });
const results = [];
const tests = ['test-project-execution-isolation', 'test-project-isolation-db', 'test-realtime-security-db',
  'test-credit-concurrency', 'test-billing-credit-concurrency-db', 'test-billing-reversal-db',
  'test-billing-webhook-security', 'test-auth-cookie-security', 'test-log-security', 'test-security-credits-db'];
function docker(args) {
  const result = spawnSync('docker', args, { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 12e6, timeout: 300000 });
  if (result.status !== 0) throw new Error((result.stdout + result.stderr).slice(-4000) || 'Docker command failed');
  return result.stdout;
}
const compose = (...args) => docker(['compose', '-p', project, '-f', 'scripts/compose.p3-tests.yml', ...args]);
const environment = { NODE_ENV: 'test', DATABASE_URL: 'postgresql://postgres:postgres@postgres:5432/nexos_p3',
  REDIS_URL: 'redis://redis:6379', SESSION_SECRET: randomBytes(32).toString('hex'),
  INTEGRATION_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  META_E2E_TEST_MODE: 'true', META_E2E_READBACK_SIMULATION: 'true', APP_URL: 'http://localhost:8081' };
const run = (...args) => docker(['run', '--rm', '--network', project + '_default', '--entrypoint', 'node',
  ...['artifacts/api-server/src', 'lib/db/src', 'lib/db/drizzle', 'lib/db/scripts'].flatMap(dir => ['-v', path.join(root, dir) + ':/workspace/' + dir + ':ro']),
  ...Object.entries(environment).flatMap(([key, value]) => ['-e', key + '=' + value]), image, ...args]);
try {
  compose('up', '-d', '--wait');
  run('/workspace/lib/db/scripts/bootstrap-empty-database.mjs', '--execute');
  run('/workspace/lib/db/node_modules/tsx/dist/cli.mjs', '/workspace/lib/db/src/seed-plans.ts');
  for (const test of tests) {
    try {
      const log = run('/workspace/artifacts/api-server/node_modules/tsx/dist/cli.mjs', '-e',
        `import('./src/scripts/${test}.ts').then(()=>process.exit(0)).catch(err=>{console.error(err);process.exit(1)})`);
      writeFileSync(path.join(output, test + '.log'), log);
      results.push({ test, status: 'PASS' }); console.log('PASS ' + test);
    } catch (error) {
      results.push({ test, status: 'FAIL' }); throw error;
    }
  }
} finally {
  try { compose('down', '--volumes', '--remove-orphans'); }
  finally { writeFileSync(path.join(output, 'results.json'), JSON.stringify({ date: new Date().toISOString(), database: 'disposable Docker nexos_p3', realProviderCalls: false, results }, null, 2)); }
}
