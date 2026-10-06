import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { databaseConnectionOptions } from './connection-options.mjs';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool(databaseConnectionOptions());
// pg evicts failed idle clients. Without a listener, a server restart turns an
// idle connection error into an uncaught exception and terminates the API.
pool.on('error', () => undefined);
export const db = drizzle(pool, { schema });

export * from "./schema";
// Explicit export keeps newly staged execution tables available to workspace
// consumers even when incremental TypeScript resolution has a stale barrel.
export * from "./schema/first-touch-attempts";
