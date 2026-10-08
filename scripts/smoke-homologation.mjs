import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { databaseConnectionOptions } from '../lib/db/src/connection-options.mjs';
import { homologationEnvironment, root } from './homologation-environment.mjs';
const { environment } = homologationEnvironment();
const credentials = JSON.parse(readFileSync(path.join(root, '.local/founder-homologation-credentials.json'), 'utf8'));
const port = environment.DEV_API_PORT || '8090';
const base = `http://127.0.0.1:${port}`;
// Refuse to adopt another process as the tested API.
const net = await import('node:net');
await new Promise((resolve, reject) => {
  const probe = net.createServer(); probe.once('error', reject);
  probe.listen(Number(port), () => probe.close(resolve));
});
const child = spawn(process.execPath, ['--import', pathToFileURL(path.join(root, 'scripts/homologation-test-transport.mjs')).href, 'artifacts/api-server/dist/index.mjs'], {
  cwd: root, env: { ...environment, NODE_ENV: 'development', PORT: port, LOCAL_SAFE_MODE: 'true' }, windowsHide: true,
});
// Keep API output private; do not dump request bodies or credentials on failure.
child.stdout.on('data', () => {}); child.stderr.on('data', () => {});
const closed = once(child, 'close');
let cookie, sessionId;
const checks = {};
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error('Compiled API exited during homologation startup');
    try { ready = (await fetch(base + '/api/readyz', { signal: AbortSignal.timeout(2000) })).status === 200; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, 'Compiled API readiness did not pass'); checks.readiness = 'PASS';
  const healthResponse = await fetch(base + '/api/healthz'); assert.equal(healthResponse.status, 200);
  const health = await healthResponse.json();
  assert.equal(health.services.database.ok, true); assert.equal(health.services.redis.ok, true); checks.databaseAndRedisHealth = 'PASS';
  const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: environment.APP_URL }, body: JSON.stringify({ email: credentials.email, password: credentials.password }) });
  assert.equal(login.status, 200);
  cookie = login.headers.get('set-cookie').split(';')[0];
  sessionId = decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1)).split('.')[0];
  const tokens = await login.json(); assert.equal(typeof tokens.accessToken, 'string'); checks.founderLogin = 'PASS';
  const admin = await fetch(base + '/api/academy/admin/session', { headers: { authorization: `Bearer ${tokens.accessToken}` } });
  assert.equal(admin.status, 200); assert.equal((await admin.json()).userId, credentials.userId); checks.founderUuidAdministration = 'PASS';
  const platformAdmin = await fetch(`${base}/api/admin/overview`, { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
  assert.equal(platformAdmin.status, 200); checks.platformUuidAdministration = 'PASS';
  const logout = await fetch(base + '/api/auth/logout', { method: 'POST', headers: { cookie, origin: environment.APP_URL } });
  assert.equal(logout.status, 204); checks.logout = 'PASS';
  const revoked = await fetch(base + '/api/academy/admin/session', { headers: { authorization: `Bearer ${tokens.accessToken}` } });
  assert.equal(revoked.status, 401); checks.revokedSessionDenied = 'PASS';
  const revokedPlatform = await fetch(base + '/api/admin/overview', { headers: { authorization: `Bearer ${tokens.accessToken}` } });
  assert.equal(revokedPlatform.status, 401); checks.revokedPlatformAdminSession = 'PASS';
} finally {
  try {
    if (sessionId) {
      const { Client } = createRequire(new URL('../lib/db/package.json', import.meta.url))('pg');
      const client = new Client(databaseConnectionOptions(environment));
      try { await client.connect(); await client.query('update auth_refresh_sessions set revoked_at=coalesce(revoked_at,now()) where id=$1 and user_id=$2', [sessionId, credentials.userId]); }
      finally { await client.end(); }
    }
  } finally {
    child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 10000);
    await closed; clearTimeout(timer);
    writeFileSync(path.join(root, 'docs/SUPABASE_HOMOLOGATION_HTTP_SMOKE.json'), JSON.stringify({ testedAt: new Date().toISOString(), scope: 'Compiled API on temporary local port, Supabase database and isolated local Redis; safe mode; no public deployment or provider HTTP', checks, testSessionRevoked: !!sessionId, apiStopped: true }, null, 2) + '\n');
  }
}
console.log('PASS compiled homologation API readiness, dependencies, founder login/UUID administration and logout/revocation');
