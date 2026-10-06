import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
const url = new URL(process.env.DATABASE_URL);
assert.equal(process.env.P3_OWNED_INFRA, 'true');
assert.equal(process.env.NODE_ENV, 'test');
assert.equal(url.hostname, 'postgres');
assert.equal(url.pathname, '/nexos_p3');
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
try {
  const repair = await readFile(new URL('../drizzle/0068_restore_bootstrap_integrity.sql', import.meta.url), 'utf8');
  await client.query('begin');
  await client.query(repair); await client.query(repair);
  await client.query('rollback');
  await client.query('alter table conditional_execution_policies disable trigger conditional_policy_immutable');
  const check = spawnSync(process.execPath, [new URL('./verify-database.mjs', import.meta.url).pathname], { encoding: 'utf8' });
  assert.notEqual(check.status, 0);
  assert.match(check.stderr, /integrity trigger is missing or disabled: conditional_execution_policies.conditional_policy_immutable/);
  await client.query('alter table conditional_execution_policies enable trigger conditional_policy_immutable');
  await client.query('alter table conditional_execution_intents drop constraint conditional_intents_action_policy_scope_fk');
  const scopeCheck = spawnSync(process.execPath, [new URL('./verify-database.mjs', import.meta.url).pathname], { encoding: 'utf8' });
  assert.notEqual(scopeCheck.status, 0);
  assert.match(scopeCheck.stderr, /scoped foreign key is missing or unvalidated/);
  console.log('PASS forward integrity repair is repeat-safe and verification rejects missing scope and disabled trigger');
} finally {
  await client.query('rollback');
  await client.query(await readFile(new URL('../drizzle/0068_restore_bootstrap_integrity.sql', import.meta.url), 'utf8'));
  await client.end();
}
