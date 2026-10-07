import { readFileSync } from 'node:fs';

export function databaseConnectionOptions(environment = process.env) {
  const connectionString = environment.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');
  let url;
  try { url = new URL(connectionString); } catch { throw new Error('Invalid DATABASE_URL'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Invalid database protocol');
  if (environment.NODE_ENV === 'test' && /(^|\.)supabase\.(co|com)$/.test(url.hostname)) {
    throw new Error('Supabase is reserved for homologation; automated regression tests must use local/Docker PostgreSQL');
  }
  const integer = (name, fallback, min, max) => {
    const value = Number(environment[name] ?? fallback);
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${name} must be between ${min} and ${max}`);
    return value;
  };
  const options = { connectionString,
    connectionTimeoutMillis: integer('DB_CONNECTION_TIMEOUT_MS', 5000, 100, 60_000),
    max: integer('DB_POOL_MAX', 10, 1, 100),
    idleTimeoutMillis: integer('DB_IDLE_TIMEOUT_MS', 30_000, 1000, 600_000) };
  const mode = environment.DATABASE_SSL_MODE ?? 'url';
  if (!['url', 'disable', 'verify-full'].includes(mode)) throw new Error('Invalid DATABASE_SSL_MODE');
  if (mode !== 'url') {
    if (['sslmode', 'sslcert', 'sslkey', 'sslrootcert'].some(name => url.searchParams.has(name))) {
      throw new Error('Use either DATABASE_SSL_MODE or URL SSL parameters, not both');
    }
    options.ssl = mode === 'disable' ? false : { rejectUnauthorized: true,
      ...(environment.DATABASE_SSL_CA_FILE ? { ca: readFileSync(environment.DATABASE_SSL_CA_FILE, 'utf8') } : {}) };
  } else if (environment.DATABASE_SSL_CA_FILE) {
    throw new Error('DATABASE_SSL_CA_FILE requires DATABASE_SSL_MODE=verify-full');
  }
  return options;
}
