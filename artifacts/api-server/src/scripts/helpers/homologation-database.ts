import assert from 'node:assert/strict';
export async function assertHomologationDatabase(
  client: { query: (sql: string) => Promise<{ rows: Record<string, unknown>[] }> },
  environment: NodeJS.ProcessEnv = process.env,
) {
  assert.equal(environment.HOMOLOGATION_ENVIRONMENT, 'true');
  assert.equal(environment.DATABASE_SSL_MODE, 'verify-full');
  const database = new URL(environment.DATABASE_URL!);
  assert.equal(database.hostname, environment.HOMOLOGATION_DATABASE_HOST);
  assert.match(database.hostname, /^db\.[a-z0-9]+\.supabase\.co$/);
  assert.equal(database.pathname, '/postgres');
  assert.equal(database.username, 'nexos_homologation');
  const result = await client.query("select current_user as role, stage from nexos_ops.environment where singleton=true");
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]!.role, 'nexos_homologation');
  assert.equal(result.rows[0]!.stage, 'homologation');
}
