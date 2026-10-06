import assert from 'node:assert/strict';

export async function assertIsolationTestDatabase(
  client: { query: (sql: string) => Promise<{ rows: Record<string, unknown>[] }> },
  environment: NodeJS.ProcessEnv = process.env,
) {
  assert.equal(environment.NODE_ENV, 'test');
  const database = new URL(environment.DATABASE_URL!);
  if (['postgres', '127.0.0.1', 'localhost'].includes(database.hostname)) {
    assert.ok(['/nexos_p3', '/nexos_p1', '/nexos_ci'].includes(database.pathname), 'Disposable local test database required');
    return 'local' as const;
  }
  assert.equal(environment.HOMOLOGATION_DB_TESTS, 'true', 'External tests require explicit homologation opt-in');
  assert.equal(environment.DATABASE_SSL_MODE, 'verify-full');
  assert.equal(database.hostname, environment.HOMOLOGATION_DATABASE_HOST);
  assert.match(database.hostname, /^db\.[a-z0-9]+\.supabase\.co$/);
  assert.equal(database.pathname, '/postgres');
  assert.equal(database.username, 'nexos_homologation');
  const result = await client.query("select current_user as role, stage from nexos_ops.environment where singleton=true");
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]!.role, 'nexos_homologation');
  assert.equal(result.rows[0]!.stage, 'homologation', 'Server-side homologation marker required');
  return 'homologation' as const;
}
