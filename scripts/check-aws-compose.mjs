import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
// Config rendering never reads these files or starts containers.
const env = { ...process.env,
  APP_ENV_FILE: path.join(root, 'tmp/aws-config/app.env'),
  REDIS_PASSWORD_FILE: path.join(root, 'tmp/aws-config/redis-password'),
  DATABASE_CA_FILE: path.join(root, 'tmp/aws-config/rds-ca.pem'),
  WEB_PORT: '8081', NEXOS_DATABASE_NETWORK: 'nexos-aws-config-check',
  NEXOS_API_IMAGE: 'nexos-api:config-check', NEXOS_WEB_IMAGE: 'nexos-web:config-check',
};
const output = execFileSync('docker', ['compose', '-p', 'nexos-aws-config-check', '--profile', 'tools',
  '-f', 'ops/app/compose.yml', '-f', 'ops/app/compose.ca.yml', '-f', 'ops/app/compose.aws.yml',
  'config', '--format', 'json'], { cwd: root, env, encoding: 'utf8', windowsHide: true });
const { services, secrets } = JSON.parse(output);
assert.equal(services.api.environment.DATABASE_MODE, 'external');
assert.equal(services.api.environment.NODE_ENV, 'production');
assert.equal(services.api.ports.length, 1);
assert.equal(services.api.ports[0].host_ip, '127.0.0.1');
assert.equal(services.api.ports[0].published, '8080');
assert.equal(services.web.ports[0].host_ip, '127.0.0.1');
assert.equal(services.web.ports[0].published, '8081');
assert.equal(services.redis.ports?.length ?? 0, 0);
assert.equal(services['db-tools'].ports?.length ?? 0, 0);
assert.ok(!services.postgres);
for (const service of [services.api, services['db-tools']]) {
  const mounted = service.secrets.map(secret => secret.source);
  for (const secret of ['app_env', 'redis_password', 'database_ca']) assert.ok(mounted.includes(secret));
}
assert.ok(secrets.database_ca.file.endsWith('rds-ca.pem'));
assert.ok(services.api.volumes.some(volume => volume.target === '/workspace/artifacts/api-server/uploads'));
for (const name of ['api', 'web', 'redis', 'db-tools']) {
  assert.equal(services[name].logging.options['max-size'], '10m');
  assert.equal(services[name].logging.options['max-file'], '5');
}
console.log('AWS Compose passed: loopback ingress, private Redis, external DB with CA, persistent uploads and bounded logs.');
