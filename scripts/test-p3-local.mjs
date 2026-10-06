import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const project = 'nexos-p3-tests', file = 'scripts/compose.p3-tests.yml', image = 'nexos-api:p3-test';
async function command(bin, args) {
  const child = spawn(bin, args, { cwd: root, windowsHide: true });
  let diagnostic = '';
  child.stdout?.on('data', () => {}); child.stderr?.on('data', chunk => { diagnostic = (diagnostic + chunk).slice(-12_000); });
  const status = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  if (status !== 0) {
    for (const value of Object.values(environment)) if (value.length > 8) diagnostic = diagnostic.replaceAll(value, '[fixture]');
    throw new Error(`P3 ${path.basename(bin)} command failed (${status}): ${diagnostic.slice(-3000)}`);
  }
}
const compose = (...args) => command('docker', ['compose', '-p', project, '-f', file, ...args]);
const environment = { NODE_ENV: 'test', P3_OWNED_INFRA: 'true', DATABASE_URL: 'postgresql://postgres:postgres@postgres:5432/nexos_p3',
  REDIS_URL: 'redis://redis:6379', SESSION_SECRET: randomBytes(32).toString('hex'),
  INTEGRATION_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'), META_E2E_TEST_MODE: 'true', META_E2E_READBACK_SIMULATION: 'true',
  ASAAS_SANDBOX: 'true', ASAAS_SANDBOX_API_KEY: 'owned-offline-fixture', APP_URL: 'http://localhost:8081', ALLOWED_ORIGINS: 'http://localhost:8081',
  LEAD_CAPTURE_HTTP_TESTS: 'true', LIFECYCLE_DB_TESTS: 'true' };
const run = (...args) => command('docker', ['run', '--rm', '--network', `${project}_default`, '--entrypoint', 'node',
  ...(process.argv.includes('--source') ? ['artifacts/api-server/src', 'lib/db/src', 'lib/db/drizzle', 'lib/db/scripts'].flatMap(directory => ['-v', `${path.join(root, directory)}:/workspace/${directory}:ro`]) : []),
  ...Object.entries(environment).flatMap(([key, value]) => ['-e', `${key}=${value}`]), image, ...args]);
const tsx = '/workspace/artifacts/api-server/node_modules/tsx/dist/cli.mjs';
const checks = [
  'test-p3-journey', 'test-academy-funnel-db', 'test-academy-access-outbox-db', 'test-academy-delivery-lifecycle-db',
  'test-native-media-control-plane', 'test-native-media-http', 'test-timeline-render-compiler',
  'test-paid-media', 'test-paid-media-launch', 'test-conditional-execution-db', 'test-social-publication-governance',
  'test-product-asaas-sandbox-unit', 'test-canonical-completion-chain',
];
const results = { generatedAt: new Date().toISOString(), scope: 'Owned isolated containers, mocked providers and reference AI fixtures; no real inference or live publication',
  runtimeSource: process.argv.includes('--source') ? 'Current repository API/database source mounted read-only into the test image' : 'API/database source in freshly built test image', checks: {} };
try {
  console.log(process.argv.includes('--skip-build') ? 'P3: using existing test image (source mode is recorded in results)' : 'P3: building API test image with FFmpeg/Python');
  if (!process.argv.includes('--skip-build')) await command('docker', ['build', '-t', image, '-f', 'ops/app/Dockerfile', '.']);
  await command(process.execPath, ['--test', 'scripts/evaluate-ai-quality.test.mjs']); results.checks.aiEvaluationFramework = 'PASS versioned references, adversarial regressions and artifact/prompt/model-bound human review format; live AI release remains blocked';
  await compose('up', '-d', '--wait');
  await run('/workspace/lib/db/scripts/bootstrap-empty-database.mjs', '--execute');
  await run('/workspace/lib/db/node_modules/tsx/dist/cli.mjs', '/workspace/lib/db/src/seed-plans.ts');
  await run('/workspace/lib/db/scripts/verify-database.mjs');
  await run('/workspace/lib/db/scripts/test-p3-schema-integrity.mjs');
  await run('/workspace/lib/db/scripts/test-bootstrap-rollback.mjs');
  results.checks.schemaIntegrity = 'PASS repeat-safe forward trigger/scope repair, missing-FK and disabled-trigger rejection and atomic bootstrap rollback';
  for (const check of checks) {
    console.log(`P3 validation: ${check}`); await run(tsx, `src/scripts/${check}.ts`); results.checks[check] = 'PASS';
  }
  console.log('P3 validation: CPU worker refusal and self-test');
  await command('docker', ['run', '--rm', '--network', 'none', '--entrypoint', 'python3', '-v', `${path.join(root, 'services/native-media-worker')}:/tests:ro`, image, '/tests/test_worker_self_test.py']);
  results.checks.nativeWorkerSelfTest = 'PASS CPU cannot advertise or execute GPU inference';
  await run('/workspace/lib/db/scripts/verify-database.mjs');
  await writeFile(path.join(root, 'docs/P3_VALIDATION_RESULTS.json'), JSON.stringify(results, null, 2) + '\n');
  console.log('PASS P3 local journey, delivery, media controls, supported paid-media contracts and AI evaluation framework');
} finally { await compose('down', '--volumes', '--remove-orphans'); }
