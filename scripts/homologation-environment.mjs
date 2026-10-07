import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import path from 'node:path';
export const root = path.resolve(import.meta.dirname, '..');
export function buildHomologationEnvironment(profile, parent = process.env) {
  // Never inherit provider credentials or local database settings.
  const system = Object.fromEntries(Object.entries(parent).filter(([key]) =>
    /^(PATH|PATHEXT|SYSTEMROOT|SYSTEMDRIVE|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA|HOME|PROGRAMFILES|PROGRAMFILES\(X86\)|PROGRAMW6432|PROGRAMDATA|ALLUSERSPROFILE)$/i.test(key)));
  const url = new URL(profile.DATABASE_URL);
  if (profile.HOMOLOGATION_ENVIRONMENT !== 'true' || profile.DATABASE_SSL_MODE !== 'verify-full' ||
      url.hostname !== profile.HOMOLOGATION_DATABASE_HOST ||
      !/^db\.[a-z0-9]+\.supabase\.co$/.test(url.hostname) || url.pathname !== '/postgres' ||
      url.username !== 'nexos_homologation' || !profile.DATABASE_SSL_CA_FILE) {
    throw new Error('Explicit Supabase homologation profile with verified TLS and runtime role required');
  }
  const redis = new URL(profile.REDIS_URL);
  if (!['redis:', 'rediss:'].includes(redis.protocol) || !/^\/[1-9]\d*$/.test(redis.pathname) ||
      profile.QUEUE_PREFIX !== `homologation-${url.hostname.split('.')[1]}`) {
    throw new Error('A separate Redis logical database and project-specific homologation queue prefix are required');
  }
  const environment = { ...system, ...profile, NODE_ENV: 'development' };
  const adminUrl = profile.DATABASE_ADMIN_URL;
  delete environment.DATABASE_ADMIN_URL;
  return { environment, adminUrl };
}
export function homologationEnvironment() {
  return buildHomologationEnvironment(parseEnv(readFileSync(path.join(root, '.env.homologation.local'), 'utf8')));
}
