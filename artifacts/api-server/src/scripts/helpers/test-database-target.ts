import assert from 'node:assert/strict';

export async function assertIsolationTestDatabase(
  _client: { query: (sql: string) => Promise<{ rows: Record<string, unknown>[] }> },
  environment: NodeJS.ProcessEnv = process.env,
) {
  assert.equal(environment.NODE_ENV, 'test');
  const database = new URL(environment.DATABASE_URL!);
  if (['postgres', '127.0.0.1', 'localhost'].includes(database.hostname)) {
    assert.ok(['/nexos_p3', '/nexos_p1', '/nexos_ci'].includes(database.pathname), 'Disposable local test database required');
    return 'local' as const;
  }
  assert.fail('Regression tests require a disposable local/Docker database; Supabase is reserved for homologation');
}
