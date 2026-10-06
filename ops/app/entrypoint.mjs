import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';

// Secrets are loaded only at runtime, never as image build arguments.
const values = parseEnv(readFileSync(process.env.APP_ENV_FILE ?? '/run/secrets/app_env', 'utf8'));
for (const name of ['DATABASE_MODE', 'NODE_ENV', 'PORT', 'APP_ENV_FILE']) {
  if (name in values) throw new Error(`${name} is controlled by Compose and must not be in app_env`);
}
Object.assign(process.env, values);
if (process.env.DATABASE_MODE === 'local') {
  const password = readFileSync('/run/secrets/postgres_password', 'utf8').trim();
  process.env.DATABASE_URL = `postgresql://nexos:${encodeURIComponent(password)}@postgres:5432/nexos`;
  process.env.DATABASE_SSL_MODE = 'disable';
} else if (process.env.DATABASE_MODE !== 'external') {
  throw new Error('DATABASE_MODE must be local or external');
} else {
  process.env.DATABASE_SSL_MODE ??= 'verify-full';
  if (process.env.DATABASE_SSL_MODE !== 'verify-full') {
    throw new Error('External PostgreSQL requires DATABASE_SSL_MODE=verify-full; remove URL SSL parameters');
  }
}
const password = readFileSync('/run/secrets/redis_password', 'utf8').trim();
process.env.REDIS_URL = `redis://:${encodeURIComponent(password)}@redis:6379`;
const args = process.argv.slice(2);
if (!args.length) args.push('--enable-source-maps', 'dist/index.mjs');
const child = spawn(process.execPath, args, { stdio: 'inherit', env: process.env });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
child.once('error', () => process.exit(1));
child.once('exit', code => process.exit(code ?? 1));
