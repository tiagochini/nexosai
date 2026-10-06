import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, writeFile, unlink, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const workRoot = path.join(root, '.local-recovery/deployment'); await mkdir(workRoot, { recursive: true });
const directory = await mkdtemp(path.join(workRoot, 'owned-'));
const password = randomBytes(32).toString('hex');
const configFile = path.join(directory, 'app.env');
const environment = { ...process.env, APP_ENV_FILE: configFile,
  REDIS_PASSWORD_FILE: path.join(directory, 'redis-password'), POSTGRES_PASSWORD_FILE: path.join(directory, 'postgres-password'),
  DEPLOYMENT_TEST_DIR: directory, WEB_PORT: '55451', NEXOS_DATABASE_NETWORK: 'nexos-deployment-local-test-db' };
await writeFile(environment.POSTGRES_PASSWORD_FILE, password); await writeFile(environment.REDIS_PASSWORD_FILE, randomBytes(32).toString('hex'));
const common = { SESSION_SECRET: randomBytes(32).toString('hex'), META_APP_SECRET: randomBytes(32).toString('hex'),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: randomBytes(32).toString('hex'), INTEGRATION_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  APP_URL: 'http://127.0.0.1:55451', ALLOWED_ORIGINS: 'http://127.0.0.1:55451', QUEUE_PREFIX: 'deployment-owned', DB_POOL_MAX: '4' };
const setConfig = async extra => writeFile(configFile, Object.entries({ ...common, ...extra }).map(([key, value]) => `${key}=${value}`).join('\n') + '\n');
async function command(args, expectFailure = false) {
  const child = spawn('docker', args, { cwd: root, env: environment, windowsHide: true });
  let output = ''; child.stdout.on('data', chunk => output += chunk); child.stderr.on('data', () => {});
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  if (expectFailure) { assert.notEqual(code, 0, 'TLS negative control must reject'); return; }
  if (code !== 0) throw new Error(`Docker ${args[0]} failed (${code}); command output withheld to protect secrets`);
  return output.trim();
}
const base = 'ops/app/compose.yml', local = 'ops/app/compose.local.yml';
const localFiles = [base, local, 'scripts/compose.deployment-local-test.yml'];
const compose = (project, files, ...args) => command(['compose', '-p', project, ...files.flatMap(file => ['-f', file]), ...args]);
const localProject = 'nexos-deployment-local-test', externalProject = 'nexos-deployment-external-test', databaseProject = 'nexos-deployment-database-test';
const externalFiles = [base, 'scripts/compose.deployment-tls-test.yml'];
const dbCommand = (project, files, ...args) => compose(project, files, 'run', '--rm', '--no-deps', 'db-tools', ...args);
const results = { generatedAt: new Date().toISOString(), scope: 'Owned Docker deployment fixtures; no production or provider access', checks: {} };
async function initialize(project, files) {
  await dbCommand(project, files, '/workspace/lib/db/scripts/bootstrap-empty-database.mjs', '--execute');
  await dbCommand(project, files, '/workspace/lib/db/node_modules/tsx/dist/cli.mjs', '/workspace/lib/db/src/seed-plans.ts');
  await dbCommand(project, files, '/workspace/lib/db/scripts/verify-database.mjs');
}
async function smoke() {
  const origin = `http://127.0.0.1:${environment.WEB_PORT}`;
  assert.match(await (await fetch(origin)).text(), /<html/i);
  for (const route of ['/api/livez', '/api/readyz', '/api/plans']) {
    const response = await fetch(origin + route, { signal: AbortSignal.timeout(20_000) }); assert.equal(response.status, 200, route);
  }
  const health = await (await fetch(origin + '/api/healthz')).json();
  assert.equal(health.services.database.ok, true); assert.equal(health.services.database.pool.max, 4);
}
try {
  await setConfig({});
  if (!process.argv.includes('--skip-build')) {
    console.log('Docker deployment: building API and frontend images');
    await compose(localProject, localFiles, 'build', 'api', 'web');
  }
  console.log('Docker deployment: optional local PostgreSQL and real application smoke');
  const localServices = await compose(localProject, localFiles, 'config', '--services'); assert.ok(localServices.split('\n').includes('postgres'));
  await compose(localProject, localFiles, 'up', '-d', '--wait', 'postgres', 'redis');
  await initialize(localProject, localFiles);
  await compose(localProject, localFiles, 'up', '-d', '--wait', '--wait-timeout', '150', 'api', 'web'); await smoke();
  const apiContainer = await compose(localProject, localFiles, 'ps', '-q', 'api');
  assert.equal(await command(['exec', apiContainer, 'id', '-u']), '1000');
  await command(['exec', apiContainer, 'sh', '-ec', 'test ! -e /workspace/.env && test ! -d /workspace/.git && test ! -d /workspace/.local-recovery']);
  await command(['exec', apiContainer, 'sh', '-ec', 'echo owned-recording > uploads/deployment-canary']);
  await compose(localProject, localFiles, 'up', '-d', '--wait', '--force-recreate', 'api');
  const recreated = await compose(localProject, localFiles, 'ps', '-q', 'api');
  assert.equal(await command(['exec', recreated, 'cat', 'uploads/deployment-canary']), 'owned-recording');
  await smoke(); results.checks.local = 'PASS optional local PostgreSQL, explicit bootstrap/seed/verify, real production API and frontend proxy, non-root API and persistent recordings';
  await compose(localProject, localFiles, 'down', '--volumes', '--remove-orphans');

  console.log('Docker deployment: external PostgreSQL with verified TLS and negative control');
  environment.NEXOS_DATABASE_NETWORK = 'nexos-deployment-external-test-db'; environment.WEB_PORT = '55452';
  common.APP_URL = common.ALLOWED_ORIGINS = 'http://127.0.0.1:55452';
  // Generate a disposable CA and server certificate. No certificate or key enters the build context.
  await command(['run', '--rm', '--user', '0', '--entrypoint', 'sh', '-v', `${directory}:/fixtures`, 'nexos-api:local', '-ec',
    'cd /fixtures && openssl req -x509 -newkey rsa:2048 -nodes -keyout ca.key -out ca.pem -days 1 -subj /CN=NexosOwnedTestCA && openssl req -newkey rsa:2048 -nodes -keyout server.key -out server.csr -subj /CN=outside-db && printf "subjectAltName=DNS:outside-db\nextendedKeyUsage=serverAuth\n" > server.ext && openssl x509 -req -in server.csr -CA ca.pem -CAkey ca.key -CAcreateserial -out server.pem -days 1 -extfile server.ext']);
  const databaseURL = `postgresql://nexos:${password}@outside-db:5432/nexos`;
  await setConfig({ DATABASE_URL: databaseURL, DATABASE_SSL_MODE: 'verify-full', DATABASE_SSL_CA_FILE: '/run/secrets/database_ca' });
  await compose(databaseProject, ['scripts/compose.deployment-external-test.yml'], 'up', '-d', '--wait');
  const services = await compose(externalProject, externalFiles, 'config', '--services'); assert.ok(!services.split('\n').includes('postgres'));
  await compose(externalProject, externalFiles, 'up', '-d', '--wait', 'redis');
  await initialize(externalProject, externalFiles);
  await setConfig({ DATABASE_URL: databaseURL.replace('@outside-db:', '@postgres-external:'), DATABASE_SSL_MODE: 'verify-full', DATABASE_SSL_CA_FILE: '/run/secrets/database_ca' });
  await command(['compose', '-p', externalProject, ...externalFiles.flatMap(file => ['-f', file]), 'run', '--rm', '--no-deps', 'db-tools', '/workspace/lib/db/scripts/verify-database.mjs'], true);
  await setConfig({ DATABASE_URL: databaseURL, DATABASE_SSL_MODE: 'verify-full', DATABASE_SSL_CA_FILE: '/run/secrets/database_ca' });
  await compose(externalProject, externalFiles, 'up', '-d', '--wait', '--wait-timeout', '150', 'api', 'web'); await smoke();
  const dbContainer = await compose(databaseProject, ['scripts/compose.deployment-external-test.yml'], 'ps', '-q', 'postgres-external');
  const tls = await command(['exec', dbContainer, 'psql', '-U', 'nexos', '-d', 'nexos', '-Atc', "select count(*) from pg_stat_ssl s join pg_stat_activity a using(pid) where s.ssl and a.usename='nexos'"]); assert.ok(Number(tls) > 0);
  await compose(databaseProject, ['scripts/compose.deployment-external-test.yml'], 'stop', 'postgres-external');
  assert.equal((await fetch('http://127.0.0.1:55452/api/readyz')).status, 503);
  assert.equal((await fetch('http://127.0.0.1:55452/api/livez')).status, 200);
  await compose(databaseProject, ['scripts/compose.deployment-external-test.yml'], 'up', '-d', '--wait');
  await smoke();
  results.checks.external = 'PASS no PostgreSQL in application stack, independently owned database, verified certificate/hostname, TLS sessions, same schema tooling and application smoke';
  results.checks.tlsNegativeControl = 'PASS hostname mismatch rejected; certificate validation is enabled';
  results.checks.externalRecovery = 'PASS external database outage makes readiness fail while API survives; existing TLS pool recovers without application restart';
  await writeFile(path.join(root, 'docs/DOCKER_DEPLOYMENT_RESULTS.json'), JSON.stringify(results, null, 2) + '\n');
  console.log('PASS Docker application with optional local or external PostgreSQL');
} finally {
  await compose(externalProject, externalFiles, 'down', '--volumes', '--remove-orphans').catch(() => {});
  await compose(databaseProject, ['scripts/compose.deployment-external-test.yml'], 'down', '--volumes', '--remove-orphans').catch(() => {});
  environment.NEXOS_DATABASE_NETWORK = 'nexos-deployment-local-test-db';
  await compose(localProject, localFiles, 'down', '--volumes', '--remove-orphans').catch(() => {});
  for (const name of ['app.env', 'redis-password', 'postgres-password', 'ca.key', 'ca.pem', 'ca.srl', 'server.key', 'server.pem', 'server.csr', 'server.ext']) await unlink(path.join(directory, name)).catch(() => {});
}
