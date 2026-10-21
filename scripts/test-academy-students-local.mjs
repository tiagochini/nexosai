import { spawn } from 'node:child_process';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const environment = { ...process.env, NODE_ENV: 'test', ACADEMY_STUDENT_OWNED_TESTS: 'true',
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:55443/nexos_academy_students_test',
  SESSION_SECRET: 'academy-students-owned-test-session-secret', APP_URL: 'http://localhost:8081', ALLOWED_ORIGINS: 'http://localhost:8081',
  RESEND_API_KEY: '', GMAIL_USER: '', GMAIL_APP_PASSWORD: '',
};
async function run(binary, args) {
  const child = spawn(binary, args, { cwd: root, env: environment, windowsHide: true, stdio: 'inherit' });
  const status = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  if (status !== 0) throw new Error(`Academy student check failed (${status})`);
}
const compose = (...args) => run('docker', ['compose', '-p', 'nexos-academy-students-test', '-f', 'scripts/compose.academy-students.yml', ...args]);
try {
  await compose('up', '-d', '--wait');
  await run(process.execPath, ['lib/db/scripts/bootstrap-empty-database.mjs', '--execute']);
  await run(process.execPath, ['lib/db/scripts/apply-migrations.mjs']);
  const tsx = 'artifacts/api-server/node_modules/tsx/dist/cli.mjs';
  await run(process.execPath, [tsx, 'lib/db/src/seed-plans.ts']);
  for (const name of ['test-academy-students-db', 'test-academy-content-db', 'test-academy-p0-db']) {
    await run(process.execPath, [tsx, `artifacts/api-server/src/scripts/${name}.ts`]);
  }
  if (process.argv.includes('--ui')) await run(process.execPath, [tsx, 'artifacts/api-server/src/scripts/test-academy-students-ui.ts']);
} finally { await compose('down', '--volumes', '--remove-orphans'); }
