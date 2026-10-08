import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const project = 'nexos-billing-tests', image = 'nexos-api:p3-test';
const environment = { NODE_ENV: 'test', DATABASE_URL: 'postgresql://postgres:postgres@postgres:5432/nexos_p3',
  SESSION_SECRET: randomBytes(32).toString('hex'), INTEGRATION_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64') };
async function command(args) {
  const child = spawn('docker', args, { cwd: root, windowsHide: true });
  let diagnostic = '';
  for (const output of [child.stdout, child.stderr]) output.on('data', chunk => { diagnostic = (diagnostic + chunk).slice(-6000); });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  if (code !== 0) throw new Error(diagnostic);
  console.log(diagnostic.trim());
}
const compose = (...args) => command(['compose', '-p', project, '-f', 'scripts/compose.p3-tests.yml', ...args]);
const run = (...args) => command(['run', '--rm', '--network', `${project}_default`, '--entrypoint', 'node',
  ...['artifacts/api-server/src', 'lib/db/src', 'lib/db/drizzle', 'lib/db/scripts'].flatMap(dir => ['-v', `${path.join(root, dir)}:/workspace/${dir}:ro`]),
  ...Object.entries(environment).flatMap(([key, value]) => ['-e', `${key}=${value}`]), image, ...args]);
const checks = ['test-billing-settlement', 'test-billing-plan-activation-db', 'test-billing-credit-concurrency-db', 'test-billing-reversal-db'];
try {
  await compose('up', '-d', '--wait');
  await run('/workspace/lib/db/scripts/bootstrap-empty-database.mjs', '--execute');
  await run('/workspace/lib/db/node_modules/tsx/dist/cli.mjs', '/workspace/lib/db/src/seed-plans.ts');
  for (const test of checks) await run('/workspace/artifacts/api-server/node_modules/tsx/dist/cli.mjs', `src/scripts/${test}.ts`);
  await writeFile(path.join(root, 'docs/BILLING_LOCAL_VALIDATION.json'), JSON.stringify({
    checkedAt: new Date().toISOString(), scope: 'Current source mounted read-only in isolated disposable Docker PostgreSQL; no Supabase or provider credentials; mocked providers with network forbidden by DB tests',
    checks: Object.fromEntries(checks.map(test => [test, 'PASS'])),
  }, null, 2) + '\n');
} finally { await compose('down', '--volumes', '--remove-orphans'); }
