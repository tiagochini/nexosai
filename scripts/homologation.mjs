import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { homologationEnvironment, root } from './homologation-environment.mjs';
const mode = process.argv[2];
if (!['prepare','verify','founder','redis','smoke','seed'].includes(mode)) throw new Error('Supabase is reserved for homologation. Usage: homologation.mjs prepare|verify|founder|redis|smoke|seed. Run regression suites with test:p1-local or test:p3-local.');
const { environment, adminUrl } = homologationEnvironment();
const tsx = path.join(root, 'artifacts/api-server/node_modules/tsx/dist/cli.mjs');
const checks = {};
async function run(label, args, admin = false, cwd = root, binary = process.execPath) {
  console.log('Homologation:', label);
  const child = spawn(binary, args, { cwd, env: { ...environment, ...(admin ? { DATABASE_URL: adminUrl } : {}) }, windowsHide: true });
  let output = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output = (output + chunk).slice(-24000); });
  const status = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  if (status !== 0) {
    for (const value of [adminUrl, ...Object.values(environment), new URL(adminUrl).password, decodeURIComponent(new URL(adminUrl).password), new URL(environment.DATABASE_URL).password, decodeURIComponent(new URL(environment.DATABASE_URL).password)]) {
      if (value && value.length > 6) output = output.replaceAll(value, '[redacted]');
    }
    checks[label] = 'FAIL';
    throw new Error(`${label} failed (${status}): ${output.slice(-4500)}`);
  }
  checks[label] = 'PASS';
  console.log('PASS', label);
}
try {
  if (mode === 'redis') {
    await run('isolated Redis', ['compose', '-p', 'nexos-homologation', '-f', 'scripts/compose.homologation.yml', 'up', '-d', '--wait'], false, root, 'docker');
    await run('Redis authentication and isolation', ['scripts/verify-homologation-redis.mjs']);
  }
  if (mode === 'prepare') {
    // Lock down default grants BEFORE any application tables are created.
    await run('privileges', ['scripts/prepare-homologation-database.mjs']);
    const { createRequire } = await import('node:module');
    const { databaseConnectionOptions } = await import('../lib/db/src/connection-options.mjs');
    const { Client } = createRequire(new URL('../lib/db/package.json', import.meta.url))('pg');
    const client = new Client(databaseConnectionOptions(environment));
    let exists;
    try { await client.connect(); exists = (await client.query("select to_regclass('public.nexos_schema_migrations') is not null as exists")).rows[0].exists; }
    finally { await client.end(); }
    await run(exists ? 'migrations' : 'bootstrap', [exists ? 'lib/db/scripts/apply-migrations.mjs' : 'lib/db/scripts/bootstrap-empty-database.mjs', ...(exists ? [] : ['--execute'])], true);
    await run('runtime policies', ['scripts/prepare-homologation-database.mjs']);
    await run('plans', [tsx, 'lib/db/src/seed-plans.ts']);
  }
  await run('schema verification', ['lib/db/scripts/verify-database.mjs']);
  await run('security verification', ['scripts/verify-homologation-security.mjs']);
  if (mode === 'seed') {
    await run('standard plans', [tsx, 'lib/db/src/seed-plans.ts']);
    await run('workspace defaults', ['scripts/seed-homologation-defaults.mjs']);
    await run('final schema verification', ['lib/db/scripts/verify-database.mjs']);
  }
  if (mode === 'founder') {
    await run('founder UUID activation', [tsx, 'src/scripts/provision-homologation-founder.ts'], false, path.join(root, 'artifacts/api-server'));
  }
  if (mode === 'smoke') await run('compiled API smoke', ['scripts/smoke-homologation.mjs']);
} finally {
  writeFileSync(path.join(root, `docs/SUPABASE_HOMOLOGATION_${mode.toUpperCase()}_RESULTS.json`), JSON.stringify({ testedAt: new Date().toISOString(), mode, host: environment.HOMOLOGATION_DATABASE_HOST, tls: 'verify-full with official CA', runtimeRole: 'nexos_homologation', localDatabaseChanged: false, limitations: ['Destructive schema-repair control runs only on disposable local databases; remote tests keep all live constraints and triggers enabled', 'No live provider delivery, AI inference or public deployment is certified'], checks }, null, 2) + '\n');
}
