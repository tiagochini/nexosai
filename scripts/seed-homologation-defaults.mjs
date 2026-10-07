import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { homologationEnvironment, root } from './homologation-environment.mjs';
import { databaseConnectionOptions } from '../lib/db/src/connection-options.mjs';
const { environment } = homologationEnvironment();
const { Client } = createRequire(new URL('../lib/db/package.json', import.meta.url))('pg');
const client = new Client(databaseConnectionOptions(environment));
try {
  await client.connect(); await client.query('BEGIN');
  await client.query("select pg_advisory_xact_lock(hashtext('nexos-homologation-defaults'))");
  const marker = (await client.query("select stage from nexos_ops.environment where singleton=true")).rows;
  assert.equal(marker.length, 1); assert.equal(marker[0].stage, 'homologation');
  const founder = (await client.query("select u.id as user_id, w.id as workspace_id, p.slug as plan from users u join workspaces w on w.owner_id=u.id join plans p on p.id=w.plan_id where u.email=$1 and w.status='active' order by w.created_at limit 1", ['founder@nexos.ai'])).rows[0];
  assert.ok(founder, 'Provision the homologation founder before seeding workspace defaults');
  assert.ok((environment.ACADEMY_ADMIN_USER_IDS ?? '').split(',').map(v => v.trim()).includes(founder.user_id), 'Founder must be the authorized homologation administrator');
  const plans = (await client.query("select slug, price_monthly, credits_monthly from plans where slug in ('solo','agency') order by slug")).rows;
  assert.equal(plans.length, 2);
  const created = await client.query(`insert into recording_folders (workspace_id, name, slug, system_type, is_system)
    values ($1,'Gravações automáticas','gravacoes-automaticas','automatic',true),
           ($1,'Uploads manuais','uploads-manuais','manual',true)
    on conflict do nothing returning id`, [founder.workspace_id]);
  const folders = (await client.query("select system_type, name from recording_folders where workspace_id=$1 and is_system=true order by system_type", [founder.workspace_id])).rows;
  assert.ok(['automatic','manual'].every(type => folders.some(f => f.system_type === type)));
  await client.query('COMMIT');
  const evidence = { populatedAt: new Date().toISOString(), scope: 'Standard data in persistent Supabase homologation; no development/regression fixtures', plans, founder: { userId: founder.user_id, workspaceId: founder.workspace_id, plan: founder.plan, accountPreserved: true }, systemFolders: folders, foldersCreatedThisRun: created.rowCount, sharedProjectMemorySeeded: false, localDatabaseChanged: false };
  writeFileSync(path.join(root, 'docs/SUPABASE_HOMOLOGATION_DEFAULT_DATA.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('PASS standard plans, preserved founder and workspace-scoped recording folders; created folders:', created.rowCount);
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Standard data seed failed:', error.code ?? error.message); process.exitCode = 1;
} finally { await client.end(); }
