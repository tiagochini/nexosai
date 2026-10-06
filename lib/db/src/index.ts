import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionTimeout = Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 5000);
if (!Number.isSafeInteger(connectionTimeout) || connectionTimeout < 100 || connectionTimeout > 60_000) {
  throw new Error('DB_CONNECTION_TIMEOUT_MS must be between 100 and 60000');
}
export const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: connectionTimeout });
// pg evicts failed idle clients. Without a listener, a server restart turns an
// idle connection error into an uncaught exception and terminates the API.
pool.on('error', () => undefined);
export const db = drizzle(pool, { schema });

export * from "./schema";
// Explicit export keeps newly staged execution tables available to workspace
// consumers even when incremental TypeScript resolution has a stale barrel.
export * from "./schema/first-touch-attempts";
