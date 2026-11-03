import { randomBytes, X509Certificate } from 'node:crypto';
import { readFile, writeFile, mkdir, chown, access, unlink } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// Validation errors name the field, never its credential value.
export function validateRuntime(values, redisPassword, ca) {
  const errors = [];
  const placeholder = /(?:USUARIO|SENHA|ENDPOINT_RDS|CHANGE_ME|SUBSTITUA|seudominio|example\.com)/i;
  for (const key of ['NODE_ENV', 'PORT', 'DATABASE_MODE', 'APP_ENV_FILE', 'REDIS_URL']) {
    if (key in values) errors.push(`${key}: controlled by Compose/entrypoint; remove from app.env`);
  }
  for (const key of ['SESSION_SECRET', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'META_APP_SECRET', 'WHATSAPP_WEBHOOK_VERIFY_TOKEN']) {
    const value = values[key] ?? '';
    if (!value || value.trim() !== value || placeholder.test(value)) errors.push(`${key}: missing or placeholder`);
    if (key.includes('SECRET') && key !== 'META_APP_SECRET' && value.length < 32) errors.push(`${key}: at least 32 characters required`);
  }
  const key = values.INTEGRATION_TOKEN_ENCRYPTION_KEY ?? '';
  if (Buffer.from(key, 'base64').length !== 32 || Buffer.from(key, 'base64').toString('base64') !== key) {
    errors.push('INTEGRATION_TOKEN_ENCRYPTION_KEY: canonical base64 encoding of 32 bytes required');
  }
  try {
    const url = new URL(values.DATABASE_URL);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || !url.password || url.pathname.length <= 1 || placeholder.test(url.href)) throw new Error();
    if ([...url.searchParams.keys()].some(k => /^ssl/i.test(k))) errors.push('DATABASE_URL: remove SSL query parameters');
    if (['localhost', '127.0.0.1', 'postgres'].includes(url.hostname)) errors.push('DATABASE_URL: external RDS endpoint required');
  } catch { errors.push('DATABASE_URL: valid external PostgreSQL connection required'); }
  if (values.DATABASE_SSL_MODE !== 'verify-full') errors.push('DATABASE_SSL_MODE: verify-full required');
  if (values.DATABASE_SSL_CA_FILE !== '/run/secrets/database_ca') errors.push('DATABASE_SSL_CA_FILE: expected /run/secrets/database_ca');
  let appOrigin;
  try {
    const url = new URL(values.APP_URL);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || placeholder.test(url.host)) throw new Error();
    appOrigin = url.origin;
  } catch { errors.push('APP_URL: public HTTPS origin required'); }
  const origins = (values.ALLOWED_ORIGINS ?? '').split(',').map(x => x.trim()).filter(Boolean);
  if (!origins.length || (appOrigin && !origins.includes(appOrigin))) errors.push('ALLOWED_ORIGINS: must explicitly include APP_URL origin');
  for (const origin of origins) {
    try { const url = new URL(origin); if (url.protocol !== 'https:' || url.origin !== origin || placeholder.test(origin)) throw new Error(); }
    catch { errors.push('ALLOWED_ORIGINS: invalid HTTPS origin'); }
  }
  if (!/^[a-zA-Z0-9]{32,}$/.test(redisPassword.trim())) errors.push('redis-password: at least 32 alphanumeric characters required');
  try { new X509Certificate(ca); } catch { errors.push('database CA: valid PEM certificate bundle required'); }
  if (values.LOCAL_SAFE_MODE === 'true') errors.push('LOCAL_SAFE_MODE: ignored in production; remove to avoid a false safety assumption');
  if (values.MIGRATION_BASELINE_EXISTING_SCHEMA === 'true') errors.push('MIGRATION_BASELINE_EXISTING_SCHEMA: use a separately reviewed one-time baseline procedure');
  if (values.META_E2E_TEST_MODE === 'true') errors.push('META_E2E_TEST_MODE: forbidden in production');
  return errors;
}

async function initialize(directory) {
  // Refuse replacement: signing/encryption secrets and Redis credentials are persistent data.
  await mkdir(directory, { recursive: true, mode: 0o711 });
  const files = ['app.env', 'redis-password', 'deployment.conf'].map(name => path.join(directory, name));
  for (const file of files) {
    const exists = await access(file).then(() => true, () => false);
    if (exists) throw new Error('Runtime files already exist; initialization refuses to overwrite secrets');
  }
  let template = await readFile(new URL('./app.env.example', import.meta.url), 'utf8');
  for (const name of ['SESSION_SECRET', 'JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    template = template.replace(`${name}=\n`, `${name}=${randomBytes(32).toString('hex')}\n`);
  }
  template = template.replace('INTEGRATION_TOKEN_ENCRYPTION_KEY=\n', `INTEGRATION_TOKEN_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}\n`);
  const created = [];
  try {
    for (const [file, content] of [
      [files[0], template], [files[1], `${randomBytes(32).toString('hex')}\n`],
      [files[2], await readFile(new URL('./deployment.conf.example', import.meta.url), 'utf8')],
    ]) {
      await writeFile(file, content, { flag: 'wx', mode: 0o600 });
      created.push(file);
      if (process.getuid?.() === 0 && file !== files[2]) await chown(file, 1000, 1000);
    }
  } catch (error) {
    for (const file of created) await unlink(file);
    throw error;
  }
  console.log('Runtime files created. Edit app.env and install the RDS CA. Secrets were not printed.');
}

async function main() {
  const command = process.argv[2];
  const directory = process.argv[3] ?? '/run/secrets';
  if (command === 'init') return initialize(directory);
  if (command !== 'check') throw new Error('Usage: runtime.mjs init|check [directory]');
  const values = parseEnv(await readFile(path.join(directory, 'app.env'), 'utf8'));
  const redis = await readFile(path.join(directory, 'redis-password'), 'utf8');
  const ca = await readFile(path.join(directory, 'rds-ca.pem'), 'utf8');
  const errors = validateRuntime(values, redis, ca);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Runtime configuration passed static checks; connectivity and provider credentials still require verification.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    // Filesystem errors contain paths only; validation never interpolates values.
    console.error(error.message);
    process.exitCode = 1;
  });
}
