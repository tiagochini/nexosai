import type { RedisOptions } from 'ioredis';
import { env } from './env.js';

export function redisConnectionOptions(role: 'producer' | 'worker'): RedisOptions {
  let url: URL;
  try { url = new URL(env.REDIS_URL); } catch { throw new Error('Invalid REDIS_URL'); }
  if (!['redis:', 'rediss:'].includes(url.protocol)) throw new Error('Invalid Redis protocol');
  const database = url.pathname.replace(/^\//, '') || '0';
  if (!/^\d+$/.test(database)) throw new Error('Invalid Redis database');
  return {
    host: url.hostname, port: Number(url.port || 6379), db: Number(database),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    connectTimeout: 2000, enableReadyCheck: true, lazyConnect: true,
    // Producers must reject promptly so the durable fallback can reconcile.
    // Workers must reconnect after an outage of any duration.
    enableOfflineQueue: role === 'worker', maxRetriesPerRequest: role === 'worker' ? null : 1,
    ...(role === 'producer' ? { commandTimeout: 5000 } : {}),
    retryStrategy: times => Math.min(times * 250, 5000),
  };
}
