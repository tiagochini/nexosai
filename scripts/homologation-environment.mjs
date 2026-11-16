import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import path from 'node:path';
export const root = path.resolve(import.meta.dirname, '..');
export function buildHomologationEnvironment(profile, parent = process.env) {
  // Never inherit provider credentials or local database settings.
  const system = Object.fromEntries(Object.entries(parent).filter(([key]) =>
    /^(PATH|PATHEXT|SYSTEMROOT|SYSTEMDRIVE|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA|HOME|PROGRAMFILES|PROGRAMFILES\(X86\)|PROGRAMW6432|PROGRAMDATA|ALLUSERSPROFILE)$/i.test(key)));
  const url = new URL(profile.DATABASE_URL);
  const adminUrl = profile.DATABASE_ADMIN_URL;
  const directHost = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(url.hostname);
  const sessionPoolerHost = /^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname);
  const adminDirectHost = adminUrl && /^db\.([a-z0-9]+)\.supabase\.co$/.exec(new URL(adminUrl).hostname);
  const projectRef = profile.HOMOLOGATION_PROJECT_REF || directHost?.[1] || adminDirectHost?.[1];
  const expectedDatabaseUser = directHost
    ? 'nexos_homologation'
    : projectRef ? `nexos_homologation.${projectRef}` : '';
  if (profile.HOMOLOGATION_ENVIRONMENT !== 'true' || profile.DATABASE_SSL_MODE !== 'verify-full' ||
      url.hostname !== profile.HOMOLOGATION_DATABASE_HOST ||
      (!directHost && !sessionPoolerHost) || !projectRef ||
      (directHost && directHost[1] !== projectRef) ||
      (adminDirectHost && adminDirectHost[1] !== projectRef) ||
      url.port !== '5432' || url.pathname !== '/postgres' ||
      url.username !== expectedDatabaseUser || !profile.DATABASE_SSL_CA_FILE) {
    throw new Error('Explicit Supabase homologation profile with verified TLS and runtime role required (direct IPv6 or session pooler on port 5432)');
  }
  const redis = new URL(profile.REDIS_URL);
  if (!['redis:', 'rediss:'].includes(redis.protocol) || !/^\/[1-9]\d*$/.test(redis.pathname) ||
      profile.QUEUE_PREFIX !== `homologation-${projectRef}`) {
    throw new Error('A separate Redis logical database and project-specific homologation queue prefix are required');
  }
  const environment = { ...system, ...profile, NODE_ENV: 'development' };
  delete environment.DATABASE_ADMIN_URL;
  return { environment, adminUrl };
}
export function homologationEnvironment() {
  return buildHomologationEnvironment(parseEnv(readFileSync(path.join(root, '.env.homologation.local'), 'utf8')));
}
